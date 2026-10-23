from datetime import datetime, timezone
from flask import Blueprint, request, jsonify
from extensions import db
from models import Vehicle, Order, Partner, VehicleAvailability
from services.availability_service import (
    create_unavailability_period,
    restore_vehicle_availability,
    toggle_vehicle_availability,
    parse_to_utc,
)
from services.vehicle_selector import get_recommendations

vehicles_bp = Blueprint("vehicles", __name__)

TERMINAL_STATUSES = {"delivered", "cancelled"}


@vehicles_bp.route("/partners", methods=["GET"])
def list_partners():
    partners = Partner.query.order_by(Partner.name).all()
    return jsonify({"partners": [p.to_dict() for p in partners]}), 200


@vehicles_bp.route("/fleet", methods=["GET"])
def fleet():
    vehicles = Vehicle.query.order_by(Vehicle.status).all()
    result = []
    now = datetime.now(timezone.utc)

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

    total       = len(result)
    idle        = sum(1 for v in result if v["status"] == "idle")
    assigned    = sum(1 for v in result if v["status"] == "assigned")
    transit     = sum(1 for v in result if v["status"] == "in_transit")
    available   = sum(1 for v in result if v["is_available"])
    unavailable = sum(1 for v in result if not v["is_available"])

    return jsonify({
        "summary": {
            "total": total,
            "idle": idle,
            "assigned": assigned,
            "in_transit": transit,
            "available": available,
            "unavailable": unavailable,
        },
        "vehicles": result,
    }), 200


@vehicles_bp.route("/", methods=["GET"])
def list_vehicles():
    vehicles = Vehicle.query.all()
    return jsonify({"vehicles": [v.to_dict() for v in vehicles]}), 200


@vehicles_bp.route("/<int:vid>", methods=["GET"])
def get_vehicle(vid):
    v = Vehicle.query.get_or_404(vid)
    return jsonify({"vehicle": v.to_dict()}), 200


@vehicles_bp.route("/<int:vid>/availability", methods=["GET"])
def get_vehicle_availability(vid):
    v = Vehicle.query.get_or_404(vid)
    records = (
        VehicleAvailability.query
        .filter_by(vehicle_id=vid)
        .order_by(VehicleAvailability.start_time.desc())
        .all()
    )
    return jsonify({
        "vehicle": v.to_dict(),
        "is_available": v.is_available_at(),
        "availability_status": "available" if v.is_available_at() else "unavailable",
        "next_available_time": v.get_next_available_time(),
        "current_unavailability": v.get_current_unavailability().to_dict() if v.get_current_unavailability() else None,
        "history": [r.to_dict() for r in records],
    }), 200


@vehicles_bp.route("/<int:vid>/availability", methods=["POST"])
def set_unavailability(vid):
    v = Vehicle.query.get_or_404(vid)
    data = request.get_json(silent=True) or {}

    start_time_raw = data.get("start_time")
    end_time_raw   = data.get("end_time")
    reason         = data.get("reason", "other")
    notes          = data.get("notes")

    if not end_time_raw:
        return jsonify({"error": "end_time is required"}), 400

    now = datetime.now(timezone.utc)
    if not start_time_raw:
        start_time = now
    else:
        try:
            start_time = parse_to_utc(start_time_raw)
        except Exception as e:
            return jsonify({"error": f"Invalid start_time format: {str(e)}"}), 400

    try:
        end_time = parse_to_utc(end_time_raw)
    except Exception as e:
        return jsonify({"error": f"Invalid end_time format: {str(e)}"}), 400

    try:
        record = create_unavailability_period(
            vehicle    = v,
            start_time = start_time,
            end_time   = end_time,
            reason     = reason,
            notes      = notes,
        )
    except ValueError as val_err:
        return jsonify({"error": str(val_err)}), 400

    return jsonify({
        "message": f"Truck '{v.name}' marked Unavailable from {start_time.strftime('%Y-%m-%d %H:%M UTC')} to {end_time.strftime('%Y-%m-%d %H:%M UTC')}.",
        "unavailability": record.to_dict(),
        "vehicle": v.to_dict(),
    }), 201


@vehicles_bp.route("/<int:vid>/availability/toggle", methods=["POST"])
def toggle_availability_endpoint(vid):
    v = Vehicle.query.get_or_404(vid)
    data = request.get_json(silent=True) or {}

    start_time = data.get("start_time")
    end_time   = data.get("end_time")
    reason     = data.get("reason", "other")
    notes      = data.get("notes")

    try:
        res = toggle_vehicle_availability(
            vehicle    = v,
            start_time = start_time,
            end_time   = end_time,
            reason     = reason,
            notes      = notes,
        )
        return jsonify(res), 200
    except ValueError as val_err:
        return jsonify({"error": str(val_err)}), 400


@vehicles_bp.route("/<int:vid>/availability/restore", methods=["POST"])
def restore_availability_endpoint(vid):
    v = Vehicle.query.get_or_404(vid)
    try:
        restore_vehicle_availability(v)
        return jsonify({
            "message": f"Truck '{v.name}' is now Available.",
            "vehicle": v.to_dict(),
        }), 200
    except ValueError as val_err:
        return jsonify({"error": str(val_err)}), 400


@vehicles_bp.route("/availability/<int:aid>", methods=["DELETE"])
def delete_availability_record(aid):
    rec = VehicleAvailability.query.get_or_404(aid)
    vehicle = rec.vehicle
    db.session.delete(rec)
    db.session.commit()
    return jsonify({
        "message": "Unavailability period cancelled successfully.",
        "vehicle": vehicle.to_dict(),
    }), 200


@vehicles_bp.route("/recommend", methods=["POST", "GET"])
def recommend_vehicles():
    """
    Returns available vehicles matching consignment weight and pickup location.
    Unavailable trucks are excluded.
    """
    if request.method == "POST":
        data = request.get_json(silent=True) or {}
    else:
        data = request.args

    weight_kg  = float(data.get("weight_kg", 500))
    pickup_lat = float(data.get("pickup_lat", 19.0760))
    pickup_lon = float(data.get("pickup_lon", 72.8777))
    limit      = int(data.get("limit", 5))

    target_time_raw = data.get("target_time")
    target_time = parse_to_utc(target_time_raw) if target_time_raw else None

    recommendations = get_recommendations(
        weight_kg   = weight_kg,
        pickup_lat  = pickup_lat,
        pickup_lon  = pickup_lon,
        target_time = target_time,
        limit       = limit,
    )

    return jsonify({
        "weight_kg": weight_kg,
        "recommendations": recommendations,
        "count": len(recommendations),
    }), 200


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
        partner_id       = data.get("partner_id"),
        partner_name     = data.get("partner_name", "Logistics Partner"),
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
    if "partner_name" in data:
        v.partner_name = data["partner_name"]
    if "partner_id" in data:
        v.partner_id = data["partner_id"]

    db.session.commit()
    return jsonify({"vehicle": v.to_dict()}), 200
