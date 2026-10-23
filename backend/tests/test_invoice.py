import unittest
import os
import sys

# Ensure backend directory is in python path
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from datetime import datetime, timezone, timedelta
from app import create_app
from extensions import db
from models import User, Vehicle, Partner, Order


class InvoiceTestCase(unittest.TestCase):
    def setUp(self):
        self.app = create_app()
        self.app.config.update({
            "TESTING": True,
        })
        self.app_context = self.app.app_context()
        self.app_context.push()
        self.client = self.app.test_client()

        # Find or create partner
        self.partner = Partner.query.filter_by(name="Sharma Logistics").first()
        if not self.partner:
            self.partner = Partner(
                name="Sharma Logistics",
                code="PRT-TEST-SHR",
                contact_name="Vikram Sharma",
                contact_email="vikram@sharmalogistics.com",
                phone="+91 98111 22334",
                address="Plot 42, Transport Nagar, Nigdi, Pune, MH - 411044",
                gstin="27AAACS1234A1Z5",
            )
            db.session.add(self.partner)
            db.session.commit()
        else:
            self.partner.address = "Plot 42, Transport Nagar, Nigdi, Pune, MH - 411044"
            self.partner.gstin = "27AAACS1234A1Z5"
            db.session.commit()

        # Find or create user
        self.user = User.query.filter_by(email="shipper@test.com").first()
        if not self.user:
            self.user = User(name="Test Shipper", email="shipper@test.com", password_hash="dummy")
            db.session.add(self.user)
            db.session.commit()

        # Find or create vehicle
        self.vehicle = Vehicle.query.filter_by(name="Small Truck (Tata 407)").first()
        if not self.vehicle:
            self.vehicle = Vehicle(
                name="Small Truck (Tata 407)",
                capacity_kg=1500,
                avg_speed_kmh=70,
                current_location="Delhi",
                current_lat=28.7041,
                current_lon=77.1025,
                status="assigned",
                partner_id=self.partner.id,
                partner_name="Sharma Logistics",
                plate_number="MH-12-RN-4071",
            )
            db.session.add(self.vehicle)
            db.session.commit()
        else:
            self.vehicle.plate_number = "MH-12-RN-4071"
            self.vehicle.partner_id = self.partner.id
            self.vehicle.partner_name = self.partner.name
            db.session.commit()

        # Delete existing test order if present
        existing_order = Order.query.filter_by(track_id="HLT-9999-IN").first()
        if existing_order:
            db.session.delete(existing_order)
            db.session.commit()

        # Create fragile order (tests padding charges)
        now = datetime.now(timezone.utc)
        self.order = Order(
            track_id="HLT-9999-IN",
            user_id=self.user.id,
            vehicle_id=self.vehicle.id,
            pickup="Delhi Depot",
            pickup_lat=28.7041,
            pickup_lon=77.1025,
            delivery="Jaipur Hub",
            delivery_lat=26.9124,
            delivery_lon=75.7873,
            weight_kg=1200.0,
            cargo_type="fragile",
            truck_type="SMALL",
            distance_km=280.0,
            price=2450.0,
            status="assigned",
            eta=now + timedelta(hours=5),
            created_at=now,
            payment_status="paid",
        )
        db.session.add(self.order)
        db.session.commit()

    def tearDown(self):
        order = Order.query.filter_by(track_id="HLT-9999-IN").first()
        if order:
            db.session.delete(order)
            db.session.commit()
        self.app_context.pop()

    def test_get_invoice_success(self):
        res = self.client.get("/api/orders/HLT-9999-IN/invoice")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()

        # Top-level placeholders
        self.assertIn("invoice_no", data)
        self.assertEqual(data["track_id"], "HLT-9999-IN")
        self.assertIn("invoice_date", data)

        # BILL TO (Customer = Truck Company / Partner)
        bill_to = data["bill_to"]
        self.assertEqual(bill_to["truck_company"], "Sharma Logistics")
        self.assertIn("Plot 42, Transport Nagar", bill_to["billing_address"])
        self.assertEqual(bill_to["gstin"], "27AAACS1234A1Z5")

        # SHIPMENT DETAILS
        shipment = data["shipment"]
        self.assertEqual(shipment["pickup"], "Delhi Depot")
        self.assertEqual(shipment["delivery"], "Jaipur Hub")
        self.assertEqual(shipment["goods_nature"], "Fragile")
        self.assertIn("1,200.0 kg", shipment["weight"])

        # CHARGES table
        charges = data["charges"]
        self.assertGreaterEqual(len(charges), 2)
        self.assertEqual(charges[0]["description"], "Freight Charges")
        self.assertGreater(charges[0]["rate"], 0)
        self.assertIn("Padding", charges[1]["description"])
        self.assertGreater(charges[1]["amount"], 0)

        # VEHICLE & DRIVER DETAILS
        vd = data["vehicle_and_driver"]
        self.assertEqual(vd["category"], "SMALL")
        self.assertEqual(vd["vehicle_number"], "MH-12-RN-4071")
        self.assertEqual(vd["logistics_partner"], "Sharma Logistics")

        # TERMS & NOTES
        self.assertGreaterEqual(len(data["terms_and_notes"]), 4)

        # QR Code payload
        self.assertIn("https://haulit.in/track?id=HLT-9999-IN", data["booking_qr_payload"])

    def test_get_invoice_not_found(self):
        res = self.client.get("/api/orders/HLT-NONEXISTENT/invoice")
        self.assertEqual(res.status_code, 404)


if __name__ == "__main__":
    unittest.main()
