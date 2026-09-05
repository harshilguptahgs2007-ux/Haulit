from math import radians, sin, cos, sqrt, atan2
from models import Order, Vehicle
from extensions import db
import config
from datetime import datetime, timezone


def haversine_km(lat1, lon1, lat2, lon2):
    R = 6371.0
    dlat = radians(lat2 - lat1)
    dlon = radians(lon2 - lon1)
    a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2) ** 2
    return R * 2 * atan2(sqrt(a), sqrt(1 - a))


def find_next_order_for_vehicle(vehicle: Vehicle):
    pending_orders = Order.query.filter_by(status="pending", vehicle_id=None).all()

    if not pending_orders:
        return None

    scored = []
    for order in pending_orders:
        dist = haversine_km(
            vehicle.current_lat, vehicle.current_lon,
            order.pickup_lat,    order.pickup_lon,
        )
        if dist <= config.ANTI_EMPTY_RADIUS_KM and vehicle.capacity_kg >= order.weight_kg:
            scored.append((dist, order))

    if not scored:
        return None

    scored.sort(key=lambda x: x[0])
    return scored[0][1]


def reassign_vehicle_after_delivery(vehicle: Vehicle):
    next_order = find_next_order_for_vehicle(vehicle)
    if next_order is None:
        vehicle.status = "idle"
        db.session.commit()
        return None

    from services.eta import compute_eta
    next_order.vehicle_id = vehicle.id
    next_order.status     = "assigned"
    next_order.eta        = compute_eta(
        vehicle.current_lat, vehicle.current_lon,
        next_order.delivery_lat, next_order.delivery_lon,
        vehicle.avg_speed_kmh,
    )
    vehicle.status = "assigned"
    db.session.commit()
    return next_order
