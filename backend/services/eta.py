from math import radians, sin, cos, sqrt, atan2
from datetime import datetime, timedelta, timezone


def haversine_km(lat1, lon1, lat2, lon2):
    R = 6371.0
    dlat = radians(lat2 - lat1)
    dlon = radians(lon2 - lon1)
    a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2) ** 2
    return R * 2 * atan2(sqrt(a), sqrt(1 - a))


def compute_eta(from_lat, from_lon, to_lat, to_lon, avg_speed_kmh):
    distance_km   = haversine_km(from_lat, from_lon, to_lat, to_lon)
    hours_needed  = distance_km / avg_speed_kmh
    eta_dt        = datetime.now(timezone.utc) + timedelta(hours=hours_needed)
    return eta_dt
