from datetime import datetime, timezone
import json
from extensions import db


class User(db.Model):
    __tablename__ = "users"

    id           = db.Column(db.Integer, primary_key=True)
    name         = db.Column(db.String(120), nullable=False)
    email        = db.Column(db.String(254), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    created_at   = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    orders = db.relationship("Order", backref="user", lazy=True)

    def to_dict(self):
        return {
            "id":         self.id,
            "name":       self.name,
            "email":      self.email,
            "created_at": self.created_at.isoformat(),
        }


class Vehicle(db.Model):
    __tablename__ = "vehicles"

    id               = db.Column(db.Integer, primary_key=True)
    name             = db.Column(db.String(120), nullable=False)
    capacity_kg      = db.Column(db.Float, nullable=False)
    avg_speed_kmh    = db.Column(db.Float, nullable=False)
    current_location = db.Column(db.String(255), nullable=False)
    current_lat      = db.Column(db.Float, nullable=False)
    current_lon      = db.Column(db.Float, nullable=False)
    status           = db.Column(db.String(32), default="idle")

    orders = db.relationship("Order", backref="vehicle", lazy=True)

    def to_dict(self):
        return {
            "id":               self.id,
            "name":             self.name,
            "capacity_kg":      self.capacity_kg,
            "avg_speed_kmh":    self.avg_speed_kmh,
            "current_location": self.current_location,
            "current_lat":      self.current_lat,
            "current_lon":      self.current_lon,
            "status":           self.status,
        }


class Order(db.Model):
    __tablename__ = "orders"

    id           = db.Column(db.Integer, primary_key=True)
    track_id     = db.Column(db.String(32), unique=True, nullable=False, index=True)
    user_id      = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    vehicle_id   = db.Column(db.Integer, db.ForeignKey("vehicles.id"), nullable=True)

    pickup          = db.Column(db.String(255), nullable=False)
    pickup_lat      = db.Column(db.Float, nullable=False)
    pickup_lon      = db.Column(db.Float, nullable=False)
    delivery        = db.Column(db.String(255), nullable=False)
    delivery_lat    = db.Column(db.Float, nullable=False)
    delivery_lon    = db.Column(db.Float, nullable=False)

    weight_kg   = db.Column(db.Float, nullable=False)
    cargo_type  = db.Column(db.String(32), nullable=False, default="standard")

    status      = db.Column(db.String(32), default="pending")
    eta         = db.Column(db.DateTime, nullable=True)
    created_at  = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at  = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc),
                            onupdate=lambda: datetime.now(timezone.utc))

    waypoints       = db.relationship("Waypoint", backref="order", lazy=True,
                                      order_by="Waypoint.sequence")
    sensor_readings = db.relationship("SensorReading", backref="order", lazy=True,
                                      order_by="SensorReading.timestamp.desc()")
    health_scores   = db.relationship("HealthScore", backref="order", lazy=True,
                                      order_by="HealthScore.timestamp.desc()")

    def to_dict(self):
        latest_health = self.health_scores[0].to_dict() if self.health_scores else None
        latest_sensor = self.sensor_readings[0].to_dict() if self.sensor_readings else None
        return {
            "id":           self.id,
            "track_id":     self.track_id,
            "user_id":      self.user_id,
            "vehicle":      self.vehicle.to_dict() if self.vehicle else None,
            "pickup":       self.pickup,
            "pickup_lat":   self.pickup_lat,
            "pickup_lon":   self.pickup_lon,
            "delivery":     self.delivery,
            "delivery_lat": self.delivery_lat,
            "delivery_lon": self.delivery_lon,
            "weight_kg":    self.weight_kg,
            "cargo_type":   self.cargo_type,
            "status":       self.status,
            "eta":          self.eta.isoformat() if self.eta else None,
            "created_at":   self.created_at.isoformat(),
            "updated_at":   self.updated_at.isoformat(),
            "waypoints":    [w.to_dict() for w in self.waypoints],
            "latest_health": latest_health,
            "latest_sensor": latest_sensor,
        }


class Waypoint(db.Model):
    __tablename__ = "waypoints"

    id         = db.Column(db.Integer, primary_key=True)
    order_id   = db.Column(db.Integer, db.ForeignKey("orders.id"), nullable=False)
    location   = db.Column(db.String(255), nullable=False)
    lat        = db.Column(db.Float, nullable=True)
    lon        = db.Column(db.Float, nullable=True)
    arrived_at = db.Column(db.DateTime, nullable=True)
    sequence   = db.Column(db.Integer, nullable=False, default=0)

    def to_dict(self):
        return {
            "id":         self.id,
            "location":   self.location,
            "lat":        self.lat,
            "lon":        self.lon,
            "arrived_at": self.arrived_at.isoformat() if self.arrived_at else None,
            "sequence":   self.sequence,
        }


class SensorReading(db.Model):
    __tablename__ = "sensor_readings"

    id           = db.Column(db.Integer, primary_key=True)
    order_id     = db.Column(db.Integer, db.ForeignKey("orders.id"), nullable=False)
    timestamp    = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    vibration    = db.Column(db.Float, nullable=False)
    temperature_c = db.Column(db.Float, nullable=False)
    moisture_pct = db.Column(db.Float, nullable=False)

    def to_dict(self):
        return {
            "id":            self.id,
            "timestamp":     self.timestamp.isoformat(),
            "vibration":     self.vibration,
            "temperature_c": self.temperature_c,
            "moisture_pct":  self.moisture_pct,
        }


class HealthScore(db.Model):
    __tablename__ = "health_scores"

    id         = db.Column(db.Integer, primary_key=True)
    order_id   = db.Column(db.Integer, db.ForeignKey("orders.id"), nullable=False)
    timestamp  = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    score      = db.Column(db.Float, nullable=False)
    risk_level = db.Column(db.String(16), nullable=False)
    detail     = db.Column(db.Text, nullable=True)

    def to_dict(self):
        return {
            "id":         self.id,
            "timestamp":  self.timestamp.isoformat(),
            "score":      self.score,
            "risk_level": self.risk_level,
            "detail":     json.loads(self.detail) if self.detail else {},
        }
