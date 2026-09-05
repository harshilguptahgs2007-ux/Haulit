from math import radians, sin, cos, sqrt, atan2
from models import Vehicle
import config


def haversine_km(lat1, lon1, lat2, lon2):
    R = 6371.0
    dlat = radians(lat2 - lat1)
    dlon = radians(lon2 - lon1)
    a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2) ** 2
    return R * 2 * atan2(sqrt(a), sqrt(1 - a))


def select_vehicle(weight_kg: float, pickup_lat: float, pickup_lon: float):
    required_capacity = next(
        (t["capacity_kg"] for t in config.VEHICLE_TIERS if t["capacity_kg"] >= weight_kg),
        config.VEHICLE_TIERS[-1]["capacity_kg"],
    )

    candidates = Vehicle.query.filter_by(status="idle").filter(
        Vehicle.capacity_kg >= weight_kg
    ).all()

    if not candidates:
        candidates = Vehicle.query.filter(Vehicle.capacity_kg >= weight_kg).all()

    if not candidates:
        return None

    candidates.sort(
        key=lambda v: haversine_km(pickup_lat, pickup_lon, v.current_lat, v.current_lon)
    )
    return candidates[0]
