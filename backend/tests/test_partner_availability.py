import unittest
from datetime import datetime, timezone, timedelta
import json
import os
import sys

# Ensure backend directory is in sys.path
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from app import create_app
from extensions import db
from models import Vehicle, Order, Partner, VehicleAvailability, User
from services.availability_service import (
    create_unavailability_period,
    restore_vehicle_availability,
    check_overlapping_period,
    parse_to_utc,
)
from services.vehicle_selector import select_vehicle, get_recommendations
from services.anti_empty_truck import reassign_vehicle_after_delivery


class TestPartnerAvailability(unittest.TestCase):
    def setUp(self):
        self.app = create_app()
        self.app.config["TESTING"] = True
        self.client = self.app.test_client()
        self.ctx = self.app.app_context()
        self.ctx.push()
        VehicleAvailability.query.delete()
        Order.query.filter(Order.track_id.like("%TEST%")).delete()
        db.session.commit()

    def tearDown(self):
        # Clean up any test availability records and orders created during test
        VehicleAvailability.query.delete()
        Order.query.filter(Order.track_id.like("%TEST%")).delete()
        db.session.commit()
        self.ctx.pop()

    def test_01_set_unavailability_and_display_status(self):
        """Test setting an unavailability period and checking current availability status."""
        v = Vehicle.query.first()
        self.assertIsNotNone(v)

        now = datetime.now(timezone.utc)
        start = now
        end = now + timedelta(hours=3)

        res = self.client.post(
            f"/api/vehicles/{v.id}/availability",
            json={
                "start_time": start.isoformat(),
                "end_time": end.isoformat(),
                "reason": "maintenance",
                "notes": "TEST: Scheduled brake maintenance",
            },
        )
        self.assertEqual(res.status_code, 201)
        data = res.get_json()
        self.assertIn("unavailability", data)
        self.assertEqual(data["unavailability"]["reason"], "maintenance")
        self.assertEqual(data["vehicle"]["is_available"], False)
        self.assertEqual(data["vehicle"]["availability_status"], "unavailable")
        self.assertIsNotNone(data["vehicle"]["next_available_time"])

        # Fetch via GET availability endpoint
        get_res = self.client.get(f"/api/vehicles/{v.id}/availability")
        self.assertEqual(get_res.status_code, 200)
        get_data = get_res.get_json()
        self.assertEqual(get_data["is_available"], False)
        self.assertEqual(get_data["availability_status"], "unavailable")
        self.assertEqual(get_data["current_unavailability"]["reason"], "maintenance")

    def test_02_timezone_handling(self):
        """Test parsing ISO strings with timezone offsets (e.g. IST +05:30) vs UTC."""
        v = Vehicle.query.filter_by(id=2).first() or Vehicle.query.first()
        now = datetime.now(timezone.utc)

        # Create times with +05:30 offset
        ist_offset = timezone(timedelta(hours=5, minutes=30))
        ist_now = now.astimezone(ist_offset)
        ist_start = ist_now + timedelta(hours=1)
        ist_end = ist_now + timedelta(hours=4)

        res = self.client.post(
            f"/api/vehicles/{v.id}/availability",
            json={
                "start_time": ist_start.isoformat(),
                "end_time": ist_end.isoformat(),
                "reason": "direct_booking",
                "notes": "TEST: Direct customer shipment",
            },
        )
        self.assertEqual(res.status_code, 201)
        data = res.get_json()
        unavail = data["unavailability"]
        parsed_utc_end = datetime.fromisoformat(unavail["end_time"])
        expected_utc_end = ist_end.astimezone(timezone.utc)
        self.assertEqual(int(parsed_utc_end.timestamp()), int(expected_utc_end.timestamp()))

    def test_03_prevent_overlapping_periods(self):
        """Test that overlapping unavailability intervals are strictly rejected."""
        v = Vehicle.query.filter_by(id=3).first() or Vehicle.query.first()
        now = datetime.now(timezone.utc)

        # Set first window: +2h to +6h
        t1 = now + timedelta(hours=2)
        t2 = now + timedelta(hours=6)
        res1 = self.client.post(
            f"/api/vehicles/{v.id}/availability",
            json={
                "start_time": t1.isoformat(),
                "end_time": t2.isoformat(),
                "reason": "maintenance",
                "notes": "TEST: Window 1",
            },
        )
        self.assertEqual(res1.status_code, 201)

        # Attempt overlapping window: +4h to +8h
        t3 = now + timedelta(hours=4)
        t4 = now + timedelta(hours=8)
        res2 = self.client.post(
            f"/api/vehicles/{v.id}/availability",
            json={
                "start_time": t3.isoformat(),
                "end_time": t4.isoformat(),
                "reason": "personal_request",
                "notes": "TEST: Window 2 Overlap",
            },
        )
        self.assertEqual(res2.status_code, 400)
        data2 = res2.get_json()
        self.assertIn("Overlapping", data2["error"])

    def test_04_prevent_past_and_inverted_periods(self):
        """Test rejection when end_time <= start_time or end_time is in the past."""
        v = Vehicle.query.first()
        now = datetime.now(timezone.utc)

        # Inverted: end before start
        res1 = self.client.post(
            f"/api/vehicles/{v.id}/availability",
            json={
                "start_time": (now + timedelta(hours=5)).isoformat(),
                "end_time": (now + timedelta(hours=2)).isoformat(),
                "reason": "maintenance",
                "notes": "TEST: Inverted",
            },
        )
        self.assertEqual(res1.status_code, 400)

        # Past period
        res2 = self.client.post(
            f"/api/vehicles/{v.id}/availability",
            json={
                "start_time": (now - timedelta(hours=5)).isoformat(),
                "end_time": (now - timedelta(hours=2)).isoformat(),
                "reason": "maintenance",
                "notes": "TEST: Past",
            },
        )
        self.assertEqual(res2.status_code, 400)

    def test_05_manual_restoration(self):
        """Test manually marking a truck available again with validation."""
        v = db.session.get(Vehicle, 4) or Vehicle.query.first()
        now = datetime.now(timezone.utc)

        # First mark unavailable
        res_set = self.client.post(
            f"/api/vehicles/{v.id}/availability",
            json={
                "start_time": now.isoformat(),
                "end_time": (now + timedelta(hours=5)).isoformat(),
                "reason": "other",
                "notes": "TEST: Temporary hold",
            },
        )
        self.assertEqual(res_set.status_code, 201)

        # Verify unavailable
        v_updated = db.session.get(Vehicle, v.id)
        self.assertFalse(v_updated.is_available_at())

        # Manually restore availability
        res_restore = self.client.post(f"/api/vehicles/{v.id}/availability/restore")
        self.assertEqual(res_restore.status_code, 200)
        restore_data = res_restore.get_json()
        self.assertTrue(restore_data["vehicle"]["is_available"])
        self.assertEqual(restore_data["vehicle"]["availability_status"], "available")

        # Attempting to restore again should fail validation (already available)
        res_restore_again = self.client.post(f"/api/vehicles/{v.id}/availability/restore")
        self.assertEqual(res_restore_again.status_code, 400)

    def test_06_automatic_restoration_when_period_ends(self):
        """Test that a vehicle is automatically available once the period has elapsed."""
        v = db.session.get(Vehicle, 5) or Vehicle.query.first()
        now = datetime.now(timezone.utc)

        # Set an unavailability window that expires in 1 hour
        create_unavailability_period(
            vehicle=v,
            start_time=now,
            end_time=now + timedelta(hours=1),
            reason="maintenance",
            notes="TEST: 1hr maintenance",
        )
        # At current time, it is unavailable
        self.assertFalse(v.is_available_at(now))

        # At current time + 61 minutes, the period has ended!
        future_time = now + timedelta(minutes=61)
        self.assertTrue(v.is_available_at(future_time))
        self.assertIsNone(v.get_current_unavailability(future_time))
        self.assertIsNone(v.get_next_available_time(future_time))

    def test_07_existing_confirmed_bookings_remain_unchanged(self):
        """Test that existing confirmed bookings are never cancelled or modified when truck is marked unavailable."""
        v = Vehicle.query.first()
        user = User.query.first()

        order = Order(
            track_id="HLT-TEST-EX",
            user_id=user.id,
            vehicle_id=v.id,
            pickup="Mumbai",
            pickup_lat=19.0760,
            pickup_lon=72.8777,
            delivery="Pune",
            delivery_lat=18.5204,
            delivery_lon=73.8567,
            weight_kg=200,
            status="assigned",
            price=1500.0,
        )
        db.session.add(order)
        db.session.commit()

        # Partner marks truck unavailable
        now = datetime.now(timezone.utc)
        create_unavailability_period(
            vehicle=v,
            start_time=now,
            end_time=now + timedelta(hours=4),
            reason="direct_booking",
            notes="TEST: Outside trip",
        )

        # Verify existing order is UNCHANGED
        check_order = Order.query.filter_by(track_id="HLT-TEST-EX").first()
        self.assertEqual(check_order.status, "assigned")
        self.assertEqual(check_order.vehicle_id, v.id)
        self.assertIsNotNone(check_order.price)

    def test_08_matching_excludes_unavailable_truck(self):
        """Test that an unavailable truck is never recommended or selected by truck-matching."""
        v = Vehicle.query.filter_by(status="idle").first()
        if not v:
            v = Vehicle.query.first()
            v.status = "idle"
            db.session.commit()

        now = datetime.now(timezone.utc)
        create_unavailability_period(
            vehicle=v,
            start_time=now,
            end_time=now + timedelta(hours=5),
            reason="maintenance",
            notes="TEST: Matching test",
        )

        matched = select_vehicle(weight_kg=100, pickup_lat=v.current_lat, pickup_lon=v.current_lon)
        if matched:
            self.assertNotEqual(matched.id, v.id, "select_vehicle selected an unavailable truck!")

        rec_res = self.client.post(
            "/api/vehicles/recommend",
            json={
                "weight_kg": 100,
                "pickup_lat": v.current_lat,
                "pickup_lon": v.current_lon,
            },
        )
        self.assertEqual(rec_res.status_code, 200)
        recs = rec_res.get_json()["recommendations"]
        rec_ids = [r["id"] for r in recs]
        self.assertNotIn(v.id, rec_ids, "Unavailable vehicle appeared in booking recommendations!")

    def test_09_direct_api_booking_rejected_for_unavailable_truck(self):
        """Test that a direct API booking request specifying an unavailable vehicle_id is rejected with HTTP 400."""
        v = Vehicle.query.first()
        now = datetime.now(timezone.utc)

        create_unavailability_period(
            vehicle=v,
            start_time=now,
            end_time=now + timedelta(hours=6),
            reason="maintenance",
            notes="TEST: Direct booking block",
        )

        res = self.client.post(
            "/api/orders/",
            json={
                "vehicle_id": v.id,
                "pickup": "Mumbai",
                "pickup_lat": 19.0760,
                "pickup_lon": 72.8777,
                "delivery": "Pune",
                "delivery_lat": 18.5204,
                "delivery_lon": 73.8567,
                "weight_kg": 150,
                "cargo_type": "standard",
            },
        )
        self.assertEqual(res.status_code, 400)
        data = res.get_json()
        self.assertIn("Unavailable", data["error"])
        self.assertEqual(data["availability_status"], "unavailable")

    def test_10_fleet_summary_includes_availability(self):
        """Test that /fleet endpoint returns available and unavailable counts."""
        res = self.client.get("/api/vehicles/fleet")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertIn("summary", data)
        self.assertIn("available", data["summary"])
        self.assertIn("unavailable", data["summary"])
        self.assertEqual(
            data["summary"]["available"] + data["summary"]["unavailable"],
            data["summary"]["total"]
        )

    def test_11_quick_toggle_endpoint(self):
        """Test toggling availability from Available -> Unavailable -> Available."""
        v = db.session.get(Vehicle, 6) or Vehicle.query.first()

        # Ensure available first
        if not v.is_available_at():
            restore_vehicle_availability(v)

        # 1. Toggle to Unavailable
        res1 = self.client.post(
            f"/api/vehicles/{v.id}/availability/toggle",
            json={"reason": "driver_rest", "notes": "TEST: Shift rest"},
        )
        self.assertEqual(res1.status_code, 200)
        data1 = res1.get_json()
        self.assertEqual(data1["status"], "unavailable")
        self.assertFalse(data1["vehicle"]["is_available"])

        # 2. Toggle back to Available
        res2 = self.client.post(f"/api/vehicles/{v.id}/availability/toggle")
        self.assertEqual(res2.status_code, 200)
        data2 = res2.get_json()
        self.assertEqual(data2["status"], "available")
        self.assertTrue(data2["vehicle"]["is_available"])

    def test_12_cancel_scheduled_period_endpoint(self):
        """Test cancelling/deleting a scheduled unavailability record."""
        v = db.session.get(Vehicle, 7) or Vehicle.query.first()
        now = datetime.now(timezone.utc)

        # Create scheduled window
        av = create_unavailability_period(
            vehicle=v,
            start_time=now + timedelta(days=2),
            end_time=now + timedelta(days=3),
            reason="maintenance",
            notes="TEST: Scheduled inspection",
        )
        rec_id = av.id

        # Delete it via endpoint
        del_res = self.client.delete(f"/api/vehicles/availability/{rec_id}")
        self.assertEqual(del_res.status_code, 200)

        # Verify record no longer exists
        deleted_av = db.session.get(VehicleAvailability, rec_id)
        self.assertIsNone(deleted_av)

    def test_13_anti_empty_truck_skips_unavailable_vehicle(self):
        """Test that reassign_vehicle_after_delivery skips a vehicle if it is unavailable."""
        v = Vehicle.query.first()
        user = User.query.first()

        # Create a pending unassigned order
        pending_order = Order(
            track_id="HLT-TEST-PEND",
            user_id=user.id,
            pickup="Mumbai",
            pickup_lat=v.current_lat,
            pickup_lon=v.current_lon,
            delivery="Thane",
            delivery_lat=v.current_lat + 0.1,
            delivery_lon=v.current_lon + 0.1,
            weight_kg=100,
            status="pending",
        )
        db.session.add(pending_order)
        db.session.commit()

        # Mark vehicle unavailable
        now = datetime.now(timezone.utc)
        create_unavailability_period(
            vehicle=v,
            start_time=now,
            end_time=now + timedelta(hours=2),
            reason="maintenance",
            notes="TEST: Maintenance block",
        )

        # Call reassign_vehicle_after_delivery
        result = reassign_vehicle_after_delivery(v)
        self.assertIsNone(result, "Vehicle was reassigned even though it is unavailable!")
        self.assertEqual(v.status, "idle")

    def test_14_partners_endpoint(self):
        """Test that /api/vehicles/partners returns registered logistics partners."""
        res = self.client.get("/api/vehicles/partners")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertIn("partners", data)
        self.assertGreater(len(data["partners"]), 0)
        p = data["partners"][0]
        self.assertIn("name", p)
        self.assertIn("vehicle_count", p)

    def test_15_fleet_mark_unavailable_with_multiple_reasons(self):
        """Test Fleet section mark-unavailable endpoint with multi-select reasons and Other custom text."""
        v = db.session.get(Vehicle, 1) or Vehicle.query.first()
        # Ensure available initially
        if not v.is_available_at():
            restore_vehicle_availability(v)

        # Mark unavailable with two standard reasons and 'Other' with custom text
        res = self.client.post(
            f"/api/vehicles/{v.id}/mark-unavailable",
            json={
                "reasons": [
                    "Truck under maintenance or repair",
                    "Driver on leave / unavailable",
                    "Other",
                ],
                "custom_reason": "Engine replacement and brake check",
                "notes": "TEST: Fleet multi-reason",
            },
        )
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertIn("vehicle", data)
        self.assertFalse(data["vehicle"]["is_available"])
        self.assertIn("unavailability", data)
        reasons = data["unavailability"]["reasons"]
        self.assertIn("Truck under maintenance or repair", reasons)
        self.assertIn("Driver on leave / unavailable", reasons)
        self.assertIn("Other: Engine replacement and brake check", reasons)

        # Verify persistence across /api/vehicles/fleet call
        fleet_res = self.client.get("/api/vehicles/fleet")
        self.assertEqual(fleet_res.status_code, 200)
        fleet_data = fleet_res.get_json()
        matched_veh = next((veh for veh in fleet_data["vehicles"] if veh["id"] == v.id), None)
        self.assertIsNotNone(matched_veh)
        self.assertFalse(matched_veh["is_available"])
        self.assertIn("Truck under maintenance or repair", matched_veh["unavailability_reasons"])
        self.assertIn("Other: Engine replacement and brake check", matched_veh["unavailability_reasons"])

        # Verify booking is strictly blocked for this truck
        order_res = self.client.post(
            "/api/orders/",
            json={
                "vehicle_id": v.id,
                "pickup": "Mumbai",
                "pickup_lat": 19.0760,
                "pickup_lon": 72.8777,
                "delivery": "Pune",
                "delivery_lat": 18.5204,
                "delivery_lon": 73.8567,
                "weight_kg": 100,
            },
        )
        self.assertEqual(order_res.status_code, 400)
        self.assertIn("Unavailable", order_res.get_json()["error"])

    def test_16_fleet_mark_unavailable_validation(self):
        """Test Fleet section mark-unavailable rejects empty or whitespace-only reasons with HTTP 400."""
        v = db.session.get(Vehicle, 2) or Vehicle.query.first()
        if not v.is_available_at():
            restore_vehicle_availability(v)

        # 1. Empty reasons list and no custom_reason
        res1 = self.client.post(
            f"/api/vehicles/{v.id}/mark-unavailable",
            json={"reasons": [], "notes": "TEST: empty reasons"},
        )
        self.assertEqual(res1.status_code, 400)
        self.assertIn("At least one reason must be selected", res1.get_json()["error"])

        # 2. Whitespace-only reasons
        res2 = self.client.post(
            f"/api/vehicles/{v.id}/mark-unavailable",
            json={"reasons": ["   ", ""], "notes": "TEST: whitespace reasons"},
        )
        self.assertEqual(res2.status_code, 400)

        # Vehicle must remain available
        v_check = db.session.get(Vehicle, v.id)
        self.assertTrue(v_check.is_available_at())

    def test_17_fleet_mark_available_restores_and_clears_reasons(self):
        """Test Fleet section mark-available restores status to Available and clears active reasons."""
        v = db.session.get(Vehicle, 3) or Vehicle.query.first()

        # First mark unavailable
        self.client.post(
            f"/api/vehicles/{v.id}/mark-unavailable",
            json={
                "reasons": ["Personal or emergency commitment"],
                "notes": "TEST: restore test",
            },
        )
        v_unavail = db.session.get(Vehicle, v.id)
        self.assertFalse(v_unavail.is_available_at())

        # Now mark available
        res = self.client.post(f"/api/vehicles/{v.id}/mark-available")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data["vehicle"]["is_available"])
        self.assertEqual(data["vehicle"]["unavailability_reasons"], [])

        # Verify on /api/vehicles/fleet
        fleet_res = self.client.get("/api/vehicles/fleet")
        fleet_data = fleet_res.get_json()
        matched = next((x for x in fleet_data["vehicles"] if x["id"] == v.id), None)
        self.assertIsNotNone(matched)
        self.assertTrue(matched["is_available"])
        self.assertEqual(matched["unavailability_reasons"], [])

        # Marking available again returns 400 validation error
        res_dup = self.client.post(f"/api/vehicles/{v.id}/mark-available")
        self.assertEqual(res_dup.status_code, 400)
        self.assertIn("already available", res_dup.get_json()["error"])


if __name__ == "__main__":
    unittest.main()
