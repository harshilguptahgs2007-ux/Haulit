import os

BASE_DIR = os.path.abspath(os.path.dirname(__file__))

SQLALCHEMY_DATABASE_URI = "sqlite:///" + os.path.join(BASE_DIR, "haulit.db")
SQLALCHEMY_TRACK_MODIFICATIONS = False

JWT_SECRET_KEY = "haulit-super-secret-key-change-in-prod"
JWT_ACCESS_TOKEN_EXPIRES = 86400

VEHICLE_TIERS = [
    {"name": "Mini Truck (Tata Ace)",            "capacity_kg": 250,   "avg_speed_kmh": 60},
    {"name": "Small Truck (Tata 407)",            "capacity_kg": 1500,  "avg_speed_kmh": 70},
    {"name": "Medium Truck (Eicher 10.90)",       "capacity_kg": 5000,  "avg_speed_kmh": 65},
    {"name": "Large Truck (Ashok Leyland 2518)",  "capacity_kg": 15000, "avg_speed_kmh": 55},
    {"name": "Heavy Truck (Volvo FH)",            "capacity_kg": 99999, "avg_speed_kmh": 50},
]

CARGO_THRESHOLDS = {
    "standard":  {
        "vibration_min": 0.1, "vibration_max": 0.5,
        "temp_min": -10, "temp_max": 35,
        "moisture_min": 30, "moisture_max": 70,
    },
    "fragile": {
        "vibration_min": 0.0, "vibration_max": 0.3,
        "temp_min": 15, "temp_max": 25,
        "moisture_min": 45, "moisture_max": 55,
    },
    "hazmat": {
        "vibration_min": 0.0, "vibration_max": 1.0,
        "temp_min": -40, "temp_max": 55,
        "moisture_min": 40, "moisture_max": 60,
    },
    "oversized": {
        "vibration_min": 0.0, "vibration_max": 0.8,
        "temp_min": -10, "temp_max": 35,
        "moisture_min": 0, "moisture_max": 15,
    },
}

ANTI_EMPTY_RADIUS_KM = 200
ML_WEIGHTS_PATH = os.path.join(BASE_DIR, "ml", "weights.pt")
