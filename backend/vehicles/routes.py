from flask import Blueprint, request, jsonify
from extensions import db
from models import Vehicle, Order

vehicles_bp = Blueprint("vehicles", __name__)

TERMINAL_STATUSES = {"delivered", "cancelled"}


@vehicles_bp.route("/fleet", methods=["GET"])
def fleet():
    vehicles = Vehicle.query.order_by(Vehicle.status).all()
    result = []
    for v in vehicles:
        active_order = (
            Order.query
            .filter_by(vehicle_id=v.id)
            .filter(Order.status.notin_(TERMINAL_STATUSES))
            .order_by(Order.created_at.desc())
            .first()
        )
        vd = v.to_dict()
        vd["active_order"] = {
            "track_id":   active_order.track_id,
            "pickup":     active_order.pickup,
            "delivery":   active_order.delivery,
            "weight_kg":  active_order.weight_kg,
            "cargo_type": active_order.cargo_type,
            "status":     active_order.status,
            "eta":        active_order.eta.isoformat() if active_order.eta else None,
            "user_id":    active_order.user_id,
        } if active_order else None
        result.append(vd)

    total    = len(result)
    idle     = sum(1 for v in result if v["status"] == "idle")
    assigned = sum(1 for v in result if v["status"] == "assigned")
    transit  = sum(1 for v in result if v["status"] == "in_transit")

    return jsonify({
        "summary":  {"total": total, "idle": idle, "assigned": assigned, "in_transit": transit},
        "vehicles": result,
    }), 200


@vehicles_bp.route("/", methods=["GET"])
def list_vehicles():
    vehicles = Vehicle.query.all()
    return jsonify({"vehicles": [v.to_dict() for v in vehicles]}), 200


@vehicles_bp.route("/", methods=["POST"])
def add_vehicle():
    data = request.get_json(silent=True) or {}
    required = ["name", "capacity_kg", "avg_speed_kmh", "current_location",
                "current_lat", "current_lon"]
    if any(data.get(f) is None for f in required):
        return jsonify({"error": f"Missing fields: {required}"}), 400

    v = Vehicle(
        name             = data["name"],
        capacity_kg      = float(data["capacity_kg"]),
        avg_speed_kmh    = float(data["avg_speed_kmh"]),
        current_location = data["current_location"],
        current_lat      = float(data["current_lat"]),
        current_lon      = float(data["current_lon"]),
        status           = data.get("status", "idle"),
    )
    db.session.add(v)
    db.session.commit()
    return jsonify({"vehicle": v.to_dict()}), 201


@vehicles_bp.route("/<int:vid>", methods=["PUT"])
def update_vehicle(vid):
    v    = Vehicle.query.get_or_404(vid)
    data = request.get_json(silent=True) or {}

    if "current_location" in data:
        v.current_location = data["current_location"]
    if "current_lat" in data:
        v.current_lat = float(data["current_lat"])
    if "current_lon" in data:
        v.current_lon = float(data["current_lon"])
    if "status" in data:
        v.status = data["status"]

    db.session.commit()
    return jsonify({"vehicle": v.to_dict()}), 200
