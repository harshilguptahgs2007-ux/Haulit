from datetime import datetime, timezone
import json
from extensions import db


class User(db.Model):
    __tablename__ = "users"

    id            = db.Column(db.Integer, primary_key=True)
    name          = db.Column(db.String(120), nullable=False)
    email         = db.Column(db.String(254), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    created_at    = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    orders = db.relationship("Order", backref="user", lazy=True)

    def to_dict(self):
        return {
            "id":         self.id,
            "name":       self.name,
            "email":      self.email,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class Partner(db.Model):
    __tablename__ = "partners"

    id            = db.Column(db.Integer, primary_key=True)
    name          = db.Column(db.String(120), nullable=False)
    code          = db.Column(db.String(32), unique=True, nullable=True)
    contact_name  = db.Column(db.String(120), nullable=True)
    contact_email = db.Column(db.String(254), nullable=True)
    phone         = db.Column(db.String(32), nullable=True)
    address       = db.Column(db.String(255), nullable=True)
    gstin         = db.Column(db.String(32), nullable=True)
    created_at    = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    vehicles = db.relationship("Vehicle", backref="partner", lazy=True)

    def to_dict(self):
        return {
            "id":            self.id,
            "name":          self.name,
            "code":          self.code,
            "contact_name":  self.contact_name,
            "contact_email": self.contact_email,
            "phone":         self.phone,
            "address":       self.address,
            "gstin":         self.gstin,
            "vehicle_count": len(self.vehicles) if self.vehicles else 0,
            "created_at":    self.created_at.isoformat() if self.created_at else None,
        }


class VehicleAvailability(db.Model):
    __tablename__ = "vehicle_availabilities"

    id         = db.Column(db.Integer, primary_key=True)
    vehicle_id = db.Column(db.Integer, db.ForeignKey("vehicles.id"), nullable=False, index=True)
    start_time = db.Column(db.DateTime, nullable=False)
    end_time   = db.Column(db.DateTime, nullable=False)
    reason     = db.Column(db.String(255), nullable=False, default="other")
    notes      = db.Column(db.Text, nullable=True)
    reasons_json = db.Column(db.Text, nullable=True)
    is_active  = db.Column(db.Boolean, default=True, nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc),
                           onupdate=lambda: datetime.now(timezone.utc))

    @staticmethod
    def _normalize_dt(dt):
        if dt is None:
            return None
        if dt.tzinfo is None:
            return dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)

    def get_reasons_list(self):
        if self.reasons_json:
            try:
                parsed = json.loads(self.reasons_json)
                if isinstance(parsed, list):
                    return parsed
            except Exception:
                pass
        if self.notes:
            try:
                parsed = json.loads(self.notes)
                if isinstance(parsed, dict) and "reasons" in parsed and isinstance(parsed["reasons"], list):
                    return parsed["reasons"]
                elif isinstance(parsed, list):
                    return parsed
            except Exception:
                pass
        if self.reason:
            if ", " in self.reason:
                return [r.strip() for r in self.reason.split(", ") if r.strip()]
            return [self.reason]
        return []

    def to_dict(self):
        now = datetime.now(timezone.utc)
        st = self._normalize_dt(self.start_time)
        et = self._normalize_dt(self.end_time)

        is_current = bool(self.is_active and (st <= now <= et))
        is_future  = bool(self.is_active and (st > now))
        is_past    = bool((et < now) or not self.is_active)

        return {
            "id":         self.id,
            "vehicle_id": self.vehicle_id,
            "start_time": st.isoformat() if st else None,
            "end_time":   et.isoformat() if et else None,
            "reason":     self.reason,
            "reasons":    self.get_reasons_list(),
            "notes":      self.notes or "",
            "is_active":  self.is_active,
            "is_current": is_current,
            "is_future":  is_future,
            "is_past":    is_past,
            "created_at": self._normalize_dt(self.created_at).isoformat() if self.created_at else None,
        }


class Vehicle(db.Model):
    __tablename__ = "vehicles"

    id               = db.Column(db.Integer, primary_key=True)
    name             = db.Column(db.String(120), nullable=False)
    capacity_kg      = db.Column(db.Float, nullable=False)
    avg_speed_kmh    = db.Float if False else db.Column(db.Float, nullable=False)
    current_location = db.Column(db.String(255), nullable=False)
    current_lat      = db.Column(db.Float, nullable=False)
    current_lon      = db.Column(db.Float, nullable=False)
    status           = db.Column(db.String(32), default="idle")
    plate_number     = db.Column(db.String(32), nullable=True)

    # Partner relationship
    partner_id       = db.Column(db.Integer, db.ForeignKey("partners.id"), nullable=True)
    partner_name     = db.Column(db.String(120), nullable=True, default="Logistics Partner")

    orders         = db.relationship("Order", backref="vehicle", lazy=True)
    availabilities = db.relationship(
        "VehicleAvailability",
        backref="vehicle",
        lazy=True,
        order_by="VehicleAvailability.start_time.asc()",
        cascade="all, delete-orphan",
    )

    @staticmethod
    def _normalize_dt(dt):
        if dt is None:
            return None
        if dt.tzinfo is None:
            return dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)

    def get_current_unavailability(self, target_dt=None):
        """Returns the active VehicleAvailability covering target_dt (default now), or None."""
        if target_dt is None:
            target_dt = datetime.now(timezone.utc)
        else:
            target_dt = self._normalize_dt(target_dt)

        for av in self.availabilities:
            if not av.is_active:
                continue
            st = self._normalize_dt(av.start_time)
            et = self._normalize_dt(av.end_time)
            if st <= target_dt <= et:
                return av
        return None

    def is_available_at(self, target_dt=None) -> bool:
        """A vehicle is available if there is no active unavailability covering target_dt."""
        return self.get_current_unavailability(target_dt) is None

    def get_next_available_time(self, target_dt=None):
        """
        If currently unavailable, returns the ISO timestamp when availability is restored (end_time).
        If currently available, returns None.
        """
        cur = self.get_current_unavailability(target_dt)
        if cur:
            et = self._normalize_dt(cur.end_time)
            return et.isoformat() if et else None
        return None

    def get_current_unavailability_reason(self, target_dt=None):
        cur = self.get_current_unavailability(target_dt)
        return cur.reason if cur else None

    def get_upcoming_unavailabilities(self, target_dt=None):
        if target_dt is None:
            target_dt = datetime.now(timezone.utc)
        else:
            target_dt = self._normalize_dt(target_dt)

        results = []
        for av in self.availabilities:
            if not av.is_active:
                continue
            st = self._normalize_dt(av.start_time)
            if st > target_dt:
                results.append(av)
        return results

    def to_dict(self):
        cur_unavail = self.get_current_unavailability()
        is_avail = cur_unavail is None
        next_avail = self.get_next_available_time()
        p_name = self.partner_name or (self.partner.name if self.partner else "Logistics Partner")

        return {
            "id":                     self.id,
            "name":                   self.name,
            "capacity_kg":            self.capacity_kg,
            "avg_speed_kmh":          self.avg_speed_kmh,
            "current_location":       self.current_location,
            "current_lat":            self.current_lat,
            "current_lon":            self.current_lon,
            "status":                 self.status,
            "plate_number":           self.plate_number or f"DL-01-HL-{self.id:04d}",
            "partner_id":             self.partner_id,
            "partner_name":           p_name,
            "is_available":           is_avail,
            "is_bookable":            (self.status == "idle" and is_avail),
            "availability_status":    "available" if is_avail else "unavailable",
            "next_available_time":    next_avail,
            "current_unavailability": cur_unavail.to_dict() if cur_unavail else None,
            "unavailability_reasons": cur_unavail.get_reasons_list() if cur_unavail else [],
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

    price                = db.Column(db.Float, nullable=True, default=0.0)
    distance_km          = db.Column(db.Float, nullable=True, default=0.0)
    truck_type           = db.Column(db.String(32), nullable=True, default="SMALL")
    payment_status       = db.Column(db.String(32), nullable=True, default="paid")
    return_status        = db.Column(db.String(32), nullable=True, default=None)
    return_reason        = db.Column(db.String(64), nullable=True, default=None)
    refund_amount        = db.Column(db.Float, nullable=True, default=0.0)
    return_policy_agreed = db.Column(db.Boolean, nullable=True, default=False)

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
            "id":                   self.id,
            "track_id":             self.track_id,
            "user_id":              self.user_id,
            "vehicle":              self.vehicle.to_dict() if self.vehicle else None,
            "pickup":               self.pickup,
            "pickup_lat":           self.pickup_lat,
            "pickup_lon":           self.pickup_lon,
            "delivery":             self.delivery,
            "delivery_lat":         self.delivery_lat,
            "delivery_lon":         self.delivery_lon,
            "weight_kg":            self.weight_kg,
            "cargo_type":           self.cargo_type,
            "status":               self.status,
            "eta":                  self.eta.isoformat() if self.eta else None,
            "created_at":           self.created_at.isoformat() if self.created_at else None,
            "updated_at":           self.updated_at.isoformat() if self.updated_at else None,
            "price":                self.price,
            "distance_km":          self.distance_km,
            "truck_type":           self.truck_type,
            "payment_status":       self.payment_status,
            "return_status":        self.return_status,
            "return_reason":        self.return_reason,
            "refund_amount":        self.refund_amount,
            "return_policy_agreed": self.return_policy_agreed,
            "waypoints":            [w.to_dict() for w in self.waypoints],
            "latest_health":        latest_health,
            "latest_sensor":        latest_sensor,
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
            "timestamp":     self.timestamp.isoformat() if self.timestamp else None,
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
            "timestamp":  self.timestamp.isoformat() if self.timestamp else None,
            "score":      self.score,
            "risk_level": self.risk_level,
            "detail":     json.loads(self.detail) if self.detail else {},
        }
