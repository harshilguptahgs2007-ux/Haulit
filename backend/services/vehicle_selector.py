from datetime import datetime, timezone
from math import radians, sin, cos, sqrt, atan2
from models import Vehicle
import config


def haversine_km(lat1, lon1, lat2, lon2):
    R = 6371.0
    dlat = radians(lat2 - lat1)
    dlon = radians(lon2 - lon1)
    a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2) ** 2
    return R * 2 * atan2(sqrt(a), sqrt(1 - a))


def select_vehicle(weight_kg: float, pickup_lat: float, pickup_lon: float, target_time=None):
    """
    Selects the closest available vehicle for a shipment.
    Unavailable trucks are strictly excluded from selection.
    """
    if target_time is None:
        target_time = datetime.now(timezone.utc)

    # Filter idle vehicles by capacity
    idle_candidates = Vehicle.query.filter_by(status="idle").filter(
        Vehicle.capacity_kg >= weight_kg
    ).all()

    # Enforce availability: vehicle must be available at target_time
    available_idle = [v for v in idle_candidates if v.is_available_at(target_time)]

    candidates = available_idle
    if not candidates:
        # Fall back to other non-idle vehicles of sufficient capacity ONLY IF available
        all_candidates = Vehicle.query.filter(Vehicle.capacity_kg >= weight_kg).all()
        candidates = [v for v in all_candidates if v.is_available_at(target_time)]

    if not candidates:
        return None

    # Sort by Haversine distance from pickup coordinates
    candidates.sort(
        key=lambda v: haversine_km(pickup_lat, pickup_lon, v.current_lat, v.current_lon)
    )
    return candidates[0]


def get_recommendations(weight_kg: float, pickup_lat: float, pickup_lon: float, target_time=None, limit: int = 5):
    """
    Returns ranked recommendations of available vehicles for a new booking.
    Unavailable vehicles during target_time are excluded.
    """
    if target_time is None:
        target_time = datetime.now(timezone.utc)

    vehicles = Vehicle.query.filter(Vehicle.capacity_kg >= weight_kg).all()
    # Strictly exclude unavailable vehicles
    available_vehicles = [v for v in vehicles if v.is_available_at(target_time)]

    scored = []
    for v in available_vehicles:
        dist = haversine_km(pickup_lat, pickup_lon, v.current_lat, v.current_lon)
        vd = v.to_dict()
        vd["distance_to_pickup_km"] = round(dist, 2)
        vd["is_idle"] = v.status == "idle"
        scored.append((dist, vd))

    # Sort primarily by idle status first, then by distance
    scored.sort(key=lambda item: (0 if item[1]["is_idle"] else 1, item[0]))
    return [item[1] for item in scored[:limit]]
