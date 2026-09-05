import random
import string
import json
from datetime import datetime, timezone

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from extensions import db
from models import Order, Waypoint, SensorReading, HealthScore
from services.vehicle_selector import select_vehicle
from services.eta import compute_eta
from services.anti_empty_truck import reassign_vehicle_after_delivery
from ml.health_model import score_health

orders_bp = Blueprint("orders", __name__)


def _generate_track_id():
    suffix = "".join(random.choices(string.digits, k=4))
    return f"HLT-{suffix}-IN"


@orders_bp.route("/", methods=["POST"])
@jwt_required()
def create_order():
    uid  = int(get_jwt_identity())
    data = request.get_json(silent=True) or {}

    required = ["pickup", "delivery", "weight_kg", "pickup_lat", "pickup_lon",
                "delivery_lat", "delivery_lon"]
    if any(data.get(f) is None for f in required):
        return jsonify({"error": f"Missing fields: {required}"}), 400

    weight_kg   = float(data["weight_kg"])
    cargo_type  = data.get("cargo_type", "standard")
    pickup_lat  = float(data["pickup_lat"])
    pickup_lon  = float(data["pickup_lon"])
    delivery_lat = float(data["delivery_lat"])
    delivery_lon = float(data["delivery_lon"])

    track_id = _generate_track_id()
    while Order.query.filter_by(track_id=track_id).first():
        track_id = _generate_track_id()

    vehicle = select_vehicle(weight_kg, pickup_lat, pickup_lon)

    eta = None
    if vehicle:
        eta = compute_eta(
            vehicle.current_lat, vehicle.current_lon,
            delivery_lat, delivery_lon,
            vehicle.avg_speed_kmh,
        )
        vehicle.status = "assigned"

    order = Order(
        track_id     = track_id,
        user_id      = uid,
        vehicle_id   = vehicle.id if vehicle else None,
        pickup       = data["pickup"],
        pickup_lat   = pickup_lat,
        pickup_lon   = pickup_lon,
        delivery     = data["delivery"],
        delivery_lat = delivery_lat,
        delivery_lon = delivery_lon,
        weight_kg    = weight_kg,
        cargo_type   = cargo_type,
        status       = "assigned" if vehicle else "pending",
        eta          = eta,
    )
    db.session.add(order)
    db.session.flush()

    waypoints = [
        Waypoint(order_id=order.id, location=data["pickup"],    lat=pickup_lat,   lon=pickup_lon,   sequence=0),
        Waypoint(order_id=order.id, location="In Transit",                                          sequence=1),
        Waypoint(order_id=order.id, location=data["delivery"],  lat=delivery_lat, lon=delivery_lon, sequence=2),
    ]
    db.session.add_all(waypoints)
    db.session.commit()

    return jsonify({"order": order.to_dict()}), 201


@orders_bp.route("/<track_id>", methods=["GET"])
def get_order(track_id):
    order = Order.query.filter_by(track_id=track_id).first_or_404()
    return jsonify({"order": order.to_dict()}), 200


@orders_bp.route("/my", methods=["GET"])
@jwt_required()
def my_orders():
    uid    = int(get_jwt_identity())
    orders = Order.query.filter_by(user_id=uid).order_by(Order.created_at.desc()).all()
    return jsonify({"orders": [o.to_dict() for o in orders]}), 200


@orders_bp.route("/<track_id>/sensor", methods=["POST"])
def ingest_sensor(track_id):
    order = Order.query.filter_by(track_id=track_id).first_or_404()
    data  = request.get_json(silent=True) or {}

    vibration     = float(data.get("vibration", 0))
    temperature_c = float(data.get("temperature_c", 25))
    moisture_pct  = float(data.get("moisture_pct", 30))

    reading = SensorReading(
        order_id      = order.id,
        vibration     = vibration,
        temperature_c = temperature_c,
        moisture_pct  = moisture_pct,
    )
    db.session.add(reading)

    result = score_health(vibration, temperature_c, moisture_pct, order.cargo_type)
    health = HealthScore(
        order_id   = order.id,
        score      = result["score"],
        risk_level = result["risk_level"],
        detail     = json.dumps(result["detail"]),
    )
    db.session.add(health)
    db.session.commit()

    return jsonify({"health": health.to_dict(), "sensor": reading.to_dict()}), 201


@orders_bp.route("/<track_id>/status", methods=["PUT"])
def update_status(track_id):
    order  = Order.query.filter_by(track_id=track_id).first_or_404()
    data   = request.get_json(silent=True) or {}
    status = data.get("status")

    valid_statuses = ["pending", "assigned", "picked_up", "in_transit", "out_for_delivery", "delivered", "cancelled"]
    if status not in valid_statuses:
        return jsonify({"error": f"status must be one of {valid_statuses}"}), 400

    order.status     = status
    order.updated_at = datetime.now(timezone.utc)

    if status == "in_transit":
        transit_wp = next((w for w in order.waypoints if w.sequence == 1), None)
        if transit_wp:
            transit_wp.arrived_at = datetime.now(timezone.utc)

    if status == "delivered":
        delivery_wp = next((w for w in order.waypoints if w.sequence == 2), None)
        if delivery_wp:
            delivery_wp.arrived_at = datetime.now(timezone.utc)

        if order.vehicle:
            order.vehicle.current_location = order.delivery
            order.vehicle.current_lat      = order.delivery_lat
            order.vehicle.current_lon      = order.delivery_lon
            order.vehicle.status           = "idle"
            db.session.flush()
            reassign_vehicle_after_delivery(order.vehicle)

    if status == "picked_up":
        pickup_wp = next((w for w in order.waypoints if w.sequence == 0), None)
        if pickup_wp:
            pickup_wp.arrived_at = datetime.now(timezone.utc)
        if order.vehicle:
            order.vehicle.status = "in_transit"

    db.session.commit()
    return jsonify({"order": order.to_dict()}), 200
