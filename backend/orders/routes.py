import random
import string
import json
from datetime import datetime, timezone

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from extensions import db
from models import Order, Waypoint, SensorReading, HealthScore, User, Vehicle
from services.vehicle_selector import select_vehicle
from services.eta import compute_eta, haversine_km
from services.anti_empty_truck import reassign_vehicle_after_delivery
from services.pricing import (
    calculate_price,
    calculate_refund,
    RETURN_POLICY_TEXT,
    RETURN_POLICIES,
    TRUCK_COEFFICIENTS,
    TRUCK_TIERS,
    MIN_DISTANCE_KM,
    MAX_DISTANCE_KM,
)
from ml.health_model import score_health

orders_bp = Blueprint("orders", __name__)


def _generate_track_id():
    suffix = "".join(random.choices(string.digits, k=4))
    return f"HLT-{suffix}-IN"


def _infer_truck_type(weight_kg: float) -> str:
    if weight_kg <= 1500:
        return "SMALL"
    elif weight_kg <= 5000:
        return "MEDIUM"
    else:
        return "LARGE"


@orders_bp.route("/pricing-config", methods=["GET"])
def get_pricing_config():
    """Returns the pricing formula configuration and official return policy."""
    return jsonify({
        "min_distance_km": MIN_DISTANCE_KM,
        "max_distance_km": MAX_DISTANCE_KM,
        "coefficients": TRUCK_COEFFICIENTS,
        "return_policy_text": RETURN_POLICY_TEXT,
        "return_policies": RETURN_POLICIES,
    }), 200


@orders_bp.route("/calculate-price", methods=["POST"])
def estimate_price():
    """
    Calculates estimated price using:
    norm = (dist - 25) / (4000 - 25)
    stable = 130
    coeff = 1 (MINI), 1.5 (SMALL), 2 (MEDIUM), 2.5 (Large)
    price = round(coeff * w * norm * stable, 2)
    """
    data = request.get_json(silent=True) or {}
    weight_kg = float(data.get("weight_kg", 500))
    truck_type = data.get("truck_type") or _infer_truck_type(weight_kg)

    if "distance_km" in data and data["distance_km"] is not None:
        distance_km = float(data["distance_km"])
    elif all(k in data for k in ["pickup_lat", "pickup_lon", "delivery_lat", "delivery_lon"]):
        distance_km = haversine_km(
            float(data["pickup_lat"]), float(data["pickup_lon"]),
            float(data["delivery_lat"]), float(data["delivery_lon"])
        )
    else:
        distance_km = 3000.0

    cargo_type = data.get("cargo_type", "standard")
    calc = calculate_price(weight_kg, distance_km, truck_type, cargo_type)
    return jsonify(calc), 200


@orders_bp.route("/", methods=["POST"])
@orders_bp.route("", methods=["POST"])
def create_order():
    # Extract user identity if valid token is provided; otherwise fallback to guest/demo
    uid = None
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header.split(" ", 1)[1].strip()
        try:
            from flask_jwt_extended import decode_token
            decoded = decode_token(token)
            uid = int(decoded.get("sub"))
        except Exception:
            uid = None

    if not uid:
        user = User.query.filter_by(email="demo@haulit.in").first() or User.query.first()
        if not user:
            import bcrypt
            hashed = bcrypt.hashpw("demo1234".encode(), bcrypt.gensalt()).decode()
            user = User(name="Guest Shipper", email="guest@haulit.in", password_hash=hashed)
            db.session.add(user)
            db.session.commit()
        uid = user.id

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

    truck_type = data.get("truck_type") or _infer_truck_type(weight_kg)
    if "distance_km" in data and data["distance_km"] is not None:
        distance_km = float(data["distance_km"])
    else:
        distance_km = haversine_km(pickup_lat, pickup_lon, delivery_lat, delivery_lon)
    pricing = calculate_price(weight_kg, distance_km, truck_type, cargo_type)

    track_id = _generate_track_id()
    while Order.query.filter_by(track_id=track_id).first():
        track_id = _generate_track_id()

    now = datetime.now(timezone.utc)
    vehicle = None
    if "vehicle_id" in data and data["vehicle_id"] is not None:
        try:
            req_vid = int(data["vehicle_id"])
        except (ValueError, TypeError):
            return jsonify({"error": "Invalid vehicle_id format"}), 400

        vehicle = db.session.get(Vehicle, req_vid)
        if not vehicle:
            return jsonify({"error": f"Vehicle with ID {req_vid} not found"}), 404

        if not vehicle.is_available_at(now):
            reason = vehicle.get_current_unavailability_reason(now) or "temporarily unavailable"
            next_avail = vehicle.get_next_available_time(now)
            return jsonify({
                "error": f"Truck '{vehicle.name}' is currently Unavailable ({reason}) and cannot be booked.",
                "vehicle_id": vehicle.id,
                "availability_status": "unavailable",
                "reason": reason,
                "next_available_time": next_avail,
            }), 400

        if vehicle.status != "idle":
            return jsonify({
                "error": f"Truck '{vehicle.name}' is currently {vehicle.status.replace('_', ' ')} and cannot be booked. Only eligible idle trucks can be booked for new shipments.",
                "vehicle_id": vehicle.id,
                "status": vehicle.status,
            }), 400

        if vehicle.capacity_kg < weight_kg:
            return jsonify({
                "error": f"Vehicle capacity ({vehicle.capacity_kg} kg) is insufficient for required weight ({weight_kg} kg)"
            }), 400
    else:
        vehicle = select_vehicle(weight_kg, pickup_lat, pickup_lon, target_time=now)

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
        price        = pricing["price"],
        distance_km  = round(distance_km, 2),
        truck_type   = pricing["truck_type"],
        payment_status = data.get("payment_status", "paid"),
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

    return jsonify({"order": order.to_dict(), "pricing": pricing}), 201


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


@orders_bp.route("/<track_id>/return", methods=["POST"])
def request_return(track_id):
    """
    Process Return & Cancellation:
    - Customer cancels: 50% payment return
    - Company's fault: 90% return
    - No damage payment from haulit
    Requires acceptance of the return policy terms.
    """
    order = Order.query.filter_by(track_id=track_id).first_or_404()

    if order.status == "cancelled":
        return jsonify({"error": "Order has already been cancelled"}), 400

    data = request.get_json(silent=True) or {}
    reason = data.get("reason", "customer_cancellation")
    if reason not in ["customer_cancellation", "company_fault"]:
        return jsonify({"error": "Reason must be 'customer_cancellation' or 'company_fault'"}), 400

    policy_agreed = data.get("policy_agreed", False)
    if not policy_agreed:
        return jsonify({
            "error": "You must agree to the Return & Cancellation Policy conditions before proceeding.",
            "policy": RETURN_POLICY_TEXT
        }), 400

    refund_info = calculate_refund(order.price or 0.0, reason)

    order.return_status = "processed"
    order.return_reason = reason
    order.refund_amount = refund_info["refund_amount"]
    order.return_policy_agreed = True
    order.status = "cancelled"
    order.updated_at = datetime.now(timezone.utc)

    if order.vehicle:
        order.vehicle.status = "idle"

    cancel_wp = Waypoint(
        order_id=order.id,
        location=f"Order Cancelled & Return Processed ({refund_info['label']})",
        sequence=len(order.waypoints),
        arrived_at=datetime.now(timezone.utc)
    )
    db.session.add(cancel_wp)
    db.session.commit()

    return jsonify({
        "message": f"Return processed successfully: {refund_info['label']}. Refund: {refund_info['formatted_refund']}",
        "order": order.to_dict(),
        "refund": refund_info,
        "policy": RETURN_POLICY_TEXT,
    }), 200


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


@orders_bp.route("/<track_id>/location", methods=["GET"])
def get_truck_location(track_id):
    """
    Demo-mode truck location simulation.
    Interpolates truck position along the route based on order status and timing.
    Returns lat/lon of simulated current position, remaining distance, and ETA minutes.
    """
    order = Order.query.filter_by(track_id=track_id).first_or_404()

    pickup_lat    = order.pickup_lat
    pickup_lon    = order.pickup_lon
    delivery_lat  = order.delivery_lat
    delivery_lon  = order.delivery_lon

    status = order.status

    # Fraction of journey completed per status
    STATUS_PROGRESS = {
        "pending":          0.0,
        "assigned":         0.02,
        "picked_up":        0.05,
        "in_transit":       None,   # dynamically calculated
        "out_for_delivery": 0.90,
        "delivered":        1.0,
        "cancelled":        None,
    }

    progress = STATUS_PROGRESS.get(status, 0.0)

    # For in_transit: interpolate based on elapsed time since pickup
    if status == "in_transit":
        transit_wp = next((w for w in order.waypoints if w.sequence == 1), None)
        delivery_wp = next((w for w in order.waypoints if w.sequence == 2), None)

        if transit_wp and transit_wp.arrived_at:
            now = datetime.now(timezone.utc)
            transit_start = transit_wp.arrived_at.replace(tzinfo=timezone.utc) \
                if transit_wp.arrived_at.tzinfo is None else transit_wp.arrived_at

            elapsed_h = (now - transit_start).total_seconds() / 3600.0

            # Estimate total transit time from distance and vehicle speed
            vehicle = order.vehicle
            speed = vehicle.avg_speed_kmh if vehicle else 60.0
            dist  = order.distance_km or haversine_km(pickup_lat, pickup_lon, delivery_lat, delivery_lon)
            total_transit_h = (dist * 0.85) / speed  # 85% of distance is the "transit" leg

            frac = min(elapsed_h / max(total_transit_h, 0.01), 1.0)
            # Map 0-1 elapsed to 0.05-0.90 journey fraction
            progress = 0.05 + frac * 0.85
        else:
            progress = 0.30

    if status == "cancelled":
        return jsonify({
            "demo_mode": True,
            "status": status,
            "lat": pickup_lat,
            "lon": pickup_lon,
            "progress": 0.0,
            "remaining_km": 0,
            "eta_minutes": None,
        }), 200

    # Interpolate lat/lon
    lat = pickup_lat + (delivery_lat - pickup_lat) * progress
    lon = pickup_lon + (delivery_lon - pickup_lon) * progress

    total_dist = order.distance_km or haversine_km(pickup_lat, pickup_lon, delivery_lat, delivery_lon)
    remaining_km = round(total_dist * (1.0 - progress), 2)

    vehicle = order.vehicle
    speed   = vehicle.avg_speed_kmh if vehicle else 60.0
    eta_minutes = round((remaining_km / speed) * 60) if speed > 0 and remaining_km > 0 else 0

    return jsonify({
        "demo_mode": True,
        "status": status,
        "lat": round(lat, 6),
        "lon": round(lon, 6),
        "progress": round(progress, 4),
        "remaining_km": remaining_km,
        "eta_minutes": eta_minutes,
        "pickup_lat": pickup_lat,
        "pickup_lon": pickup_lon,
        "delivery_lat": delivery_lat,
        "delivery_lon": delivery_lon,
    }), 200


@orders_bp.route("/<string:track_id>/invoice", methods=["GET"])
def get_order_invoice(track_id: str):
    """
    Returns structured B2B invoice data for the truck company / logistics partner,
    matching the official HaulIt Invoice template.
    """
    clean_id = track_id.strip()
    order = Order.query.filter(Order.track_id.ilike(clean_id)).first()
    if not order:
        return jsonify({"error": f"Order with Tracking ID '{clean_id}' not found."}), 404

    # Calculate deterministic invoice number
    created_dt = order.created_at or datetime.now(timezone.utc)
    if created_dt.tzinfo is None:
        created_dt = created_dt.replace(tzinfo=timezone.utc)

    inv_suffix = clean_id.replace("HLT-", "").replace("-IN", "").replace("-", "")
    invoice_no = f"INV-{created_dt.strftime('%Y%m%d')}-{inv_suffix}"

    # Vehicle and Partner resolution
    vehicle = order.vehicle
    partner = vehicle.partner if vehicle and vehicle.partner else None

    partner_name = (
        partner.name if partner
        else (vehicle.partner_name if vehicle and vehicle.partner_name else "Sharma Logistics")
    )
    partner_address = (
        partner.address if partner and partner.address
        else "Plot 42, Transport Nagar, Nigdi, Pune, Maharashtra - 411044"
    )
    partner_gstin = (
        partner.gstin if partner and partner.gstin
        else "27AAACS1234A1Z5"
    )
    partner_phone = (
        partner.phone if partner and partner.phone
        else "+91 98111 22334"
    )
    partner_email = (
        partner.contact_email if partner and partner.contact_email
        else "dispatch@sharmalogistics.com"
    )

    vehicle_no = (
        vehicle.plate_number if vehicle and vehicle.plate_number
        else (f"DL-01-HL-{vehicle.id:04d}" if vehicle else "PENDING DISPATCH")
    )

    # Recalculate or retrieve charges breakdown
    pricing = calculate_price(
        weight_kg=order.weight_kg,
        distance_km=order.distance_km or 0.0,
        truck_type=order.truck_type or "SMALL",
        cargo_type=order.cargo_type or "standard"
    )

    base_price = pricing["base_price"]
    extra_charge = pricing["extra_charge"]
    extra_label = pricing["extra_charge_name"] or "Padding Charges"
    total_price = order.price if (order.price and order.price > 0) else pricing["price"]

    # ETA formatting
    eta_str = None
    if order.eta:
        eta_dt = order.eta.replace(tzinfo=timezone.utc) if order.eta.tzinfo is None else order.eta
        eta_str = eta_dt.strftime("%d %b %Y, %I:%M %p")

    pickup_date_str = created_dt.strftime("%d %b %Y")
    invoice_date_str = created_dt.strftime("%d %b %Y")

    invoice_data = {
        "invoice_no": invoice_no,
        "invoice_date": invoice_date_str,
        "invoice_date_iso": created_dt.isoformat(),
        "track_id": order.track_id,
        "issuer": {
            "name": "HAULIT LOGISTICS",
            "legal_business_name": "HaulIt Logistics Technologies India Private Limited",
            "address": "Plot 104, Sector 18, Transport Hub, Gurugram, Haryana - 122015, India",
            "gstin": "07AAAAH0000A1Z5",
            "phone": "+91 (800) 428-5480",
            "email": "billing@haulit.in",
            "support_email": "support@haulit.in",
        },
        "bill_to": {
            "truck_company": partner_name,
            "billing_address": partner_address,
            "gstin": partner_gstin,
            "phone": partner_phone,
            "email": partner_email,
        },
        "shipment": {
            "pickup": order.pickup,
            "delivery": order.delivery,
            "pickup_date": pickup_date_str,
            "expected_delivery": eta_str or "In Transit / Real-time Dispatch",
            "goods_nature": (order.cargo_type or "standard").capitalize(),
            "weight": f"{order.weight_kg:,.1f} kg" if order.weight_kg else "—",
            "weight_kg": order.weight_kg,
            "distance_km": order.distance_km,
        },
        "charges": [
            {
                "s_no": 1,
                "description": "Freight Charges",
                "rate": base_price,
                "amount": base_price,
                "formatted_rate": f"₹ {base_price:,.2f}",
                "formatted_amount": f"₹ {base_price:,.2f}",
            },
            {
                "s_no": 2,
                "description": extra_label if extra_charge > 0 else "Padding Charges",
                "rate": extra_charge,
                "amount": extra_charge,
                "formatted_rate": f"₹ {extra_charge:,.2f}" if extra_charge > 0 else "₹ 0.00",
                "formatted_amount": f"₹ {extra_charge:,.2f}" if extra_charge > 0 else "₹ 0.00",
            },
        ],
        "summary": {
            "subtotal": round(base_price + extra_charge, 2),
            "total_amount": round(total_price, 2),
            "formatted_total": f"₹ {total_price:,.2f}",
            "payment_status": (order.payment_status or "paid").upper(),
        },
        "vehicle_and_driver": {
            "category": order.truck_type or (vehicle.name if vehicle else "SMALL"),
            "vehicle_number": vehicle_no,
            "logistics_partner": partner_name,
            "vehicle_name": vehicle.name if vehicle else "Assigned Fleet Partner",
        },
        "terms_and_notes": [
            "1. This invoice relates to the booking and services listed above.",
            "2. Additional charges should follow the booking agreement.",
            "3. Insurance applies only if confirmed by the applicable policy.",
            "4. Verify GST treatment for the actual supplier and transaction.",
            "5. Support: support@haulit.in | +91 (800) 428-5480",
        ],
        "booking_qr_payload": f"https://haulit.in/track?id={order.track_id}",
        "qr_track_url": f"/track?id={order.track_id}",
    }

    return jsonify(invoice_data), 200
