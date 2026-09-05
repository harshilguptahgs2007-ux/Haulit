import bcrypt
from app import create_app
from extensions import db
from models import User, Vehicle


VEHICLES = [
    {"name": "Mini Truck (Tata Ace)",           "capacity_kg": 250,   "avg_speed_kmh": 60,
     "current_location": "Mumbai",    "current_lat": 19.0760, "current_lon": 72.8777},
    {"name": "Small Truck (Tata 407)",           "capacity_kg": 1500,  "avg_speed_kmh": 70,
     "current_location": "Delhi",     "current_lat": 28.7041, "current_lon": 77.1025},
    {"name": "Medium Truck (Eicher 10.90)",      "capacity_kg": 5000,  "avg_speed_kmh": 65,
     "current_location": "Pune",      "current_lat": 18.5204, "current_lon": 73.8567},
    {"name": "Large Truck (Ashok Leyland 2518)", "capacity_kg": 15000, "avg_speed_kmh": 55,
     "current_location": "Chennai",   "current_lat": 13.0827, "current_lon": 80.2707},
    {"name": "Heavy Truck (Volvo FH)",           "capacity_kg": 99999, "avg_speed_kmh": 50,
     "current_location": "Hyderabad", "current_lat": 17.3850, "current_lon": 78.4867},
    {"name": "Mini Truck (Tata Ace) #2",         "capacity_kg": 250,   "avg_speed_kmh": 60,
     "current_location": "Bangalore", "current_lat": 12.9716, "current_lon": 77.5946},
    {"name": "Small Truck (Tata 407) #2",        "capacity_kg": 1500,  "avg_speed_kmh": 70,
     "current_location": "Kolkata",   "current_lat": 22.5726, "current_lon": 88.3639},
]

DEMO_USER = {"name": "Demo User", "email": "demo@haulit.in", "password": "demo1234"}


def seed():
    app = create_app()
    with app.app_context():
        db.create_all()

        for vdata in VEHICLES:
            if not Vehicle.query.filter_by(name=vdata["name"]).first():
                db.session.add(Vehicle(**vdata))

        if not User.query.filter_by(email=DEMO_USER["email"]).first():
            hashed = bcrypt.hashpw(DEMO_USER["password"].encode(), bcrypt.gensalt()).decode()
            db.session.add(User(
                name          = DEMO_USER["name"],
                email         = DEMO_USER["email"],
                password_hash = hashed,
            ))

        db.session.commit()
        print("Seeded successfully.")
        print(f"Demo login -> email: {DEMO_USER['email']}  password: {DEMO_USER['password']}")


if __name__ == "__main__":
    seed()
