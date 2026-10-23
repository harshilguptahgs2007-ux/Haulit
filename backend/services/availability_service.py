import json
from datetime import datetime, timezone, timedelta
from extensions import db
from models import Vehicle, VehicleAvailability

def parse_to_utc(dt_val):
    """
    Parses any ISO string, timestamp, or datetime object into a timezone-aware UTC datetime.
    """
    if dt_val is None:
        return None
    if isinstance(dt_val, str):
        clean_str = dt_val.strip().replace("Z", "+00:00")
        dt = datetime.fromisoformat(clean_str)
    elif isinstance(dt_val, datetime):
        dt = dt_val
    else:
        raise ValueError(f"Unsupported datetime type: {type(dt_val)}")

    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    else:
        dt = dt.astimezone(timezone.utc)

    return dt

def check_overlapping_period(vehicle_id: int, start_time: datetime, end_time: datetime, exclude_id: int = None):
    """
    Checks if [start_time, end_time] overlaps with any active unavailability window for this vehicle.
    Overlaps condition: (new_start < existing_end) and (new_end > existing_start).
    Only checks active periods that have not yet expired (existing_end > now).
    """
    now = datetime.now(timezone.utc)
    st_utc = parse_to_utc(start_time)
    et_utc = parse_to_utc(end_time)

    query = VehicleAvailability.query.filter(
        VehicleAvailability.vehicle_id == vehicle_id,
        VehicleAvailability.is_active == True,
    )
    if exclude_id is not None:
        query = query.filter(VehicleAvailability.id != exclude_id)

    candidates = query.all()

    for rec in candidates:
        rec_st = parse_to_utc(rec.start_time)
        rec_et = parse_to_utc(rec.end_time)

        if rec_et <= now:
            continue

        if st_utc < rec_et and et_utc > rec_st:
            return rec

    return None

def create_unavailability_period(
    vehicle: Vehicle,
    start_time,
    end_time,
    reason: str = None,
    notes: str = None,
    reasons: list = None,
):
    """
    Creates an unavailability window for a vehicle with validation.
    Supports single reason or multiple selected reasons.
    """
    now = datetime.now(timezone.utc)
    st = parse_to_utc(start_time)
    et = parse_to_utc(end_time)

    if et <= st:
        raise ValueError("End date/time must be strictly after start date/time.")

    if et < (now - timedelta(minutes=1)):
        raise ValueError("End date/time cannot be in the past.")

    overlap = check_overlapping_period(vehicle.id, st, et)
    if overlap:
        overlap_st = parse_to_utc(overlap.start_time).strftime("%Y-%m-%d %H:%M UTC")
        overlap_et = parse_to_utc(overlap.end_time).strftime("%Y-%m-%d %H:%M UTC")
        raise ValueError(
            f"Overlapping unavailability period already exists for {vehicle.name} from {overlap_st} to {overlap_et} ({overlap.reason})."
        )

    st_naive = st.astimezone(timezone.utc).replace(tzinfo=None)
    et_naive = et.astimezone(timezone.utc).replace(tzinfo=None)

    if reasons and isinstance(reasons, list) and len(reasons) > 0:
        reasons_list = [str(r).strip() for r in reasons if str(r).strip()]
        reasons_json = json.dumps(reasons_list)
        if not reason:
            reason = ", ".join(reasons_list)
    else:
        reasons_list = [reason] if reason else ["other"]
        reasons_json = json.dumps(reasons_list)
        if not reason:
            reason = "other"

    unavail = VehicleAvailability(
        vehicle_id   = vehicle.id,
        start_time   = st_naive,
        end_time     = et_naive,
        reason       = (reason or "other").strip()[:255],
        reasons_json = reasons_json,
        notes        = (notes or "").strip() or None,
        is_active    = True,
    )
    db.session.add(unavail)
    db.session.commit()

    return unavail

def restore_vehicle_availability(vehicle: Vehicle):
    """
    Manually restores availability for a vehicle by ending any active/current unavailability window.
    Validates that the vehicle is actually currently unavailable.
    Does NOT cancel or modify any existing confirmed bookings.
    """
    now = datetime.now(timezone.utc)
    now_naive = now.replace(tzinfo=None)

    active_records = [
        av for av in vehicle.availabilities
        if av.is_active and parse_to_utc(av.end_time) > now
    ]

    if not active_records:
        raise ValueError(f"Vehicle '{vehicle.name}' is already available.")

    for av in active_records:
        av.is_active = False
        av.end_time = min(av.end_time, now_naive)
        av.updated_at = now_naive

    db.session.commit()
    return vehicle

def toggle_vehicle_availability(
    vehicle: Vehicle,
    start_time=None,
    end_time=None,
    reason: str = "other",
    notes: str = None,
):
    """
    Toggles availability:
    - If currently unavailable: ends active unavailability and marks available.
    - If currently available: creates a new unavailability period (defaulting to next 24h if times omitted).
    """
    now = datetime.now(timezone.utc)
    current_unavail = vehicle.get_current_unavailability(now)

    if current_unavail:
        restore_vehicle_availability(vehicle)
        return {
            "status": "available",
            "message": f"Truck '{vehicle.name}' is now marked Available.",
            "vehicle": vehicle.to_dict(),
        }
    else:
        st = parse_to_utc(start_time) if start_time else now
        et = parse_to_utc(end_time) if end_time else (st + timedelta(hours=24))

        record = create_unavailability_period(
            vehicle    = vehicle,
            start_time = st,
            end_time   = et,
            reason     = reason,
            notes      = notes,
        )
        return {
            "status": "unavailable",
            "message": f"Truck '{vehicle.name}' marked Unavailable until {et.strftime('%d %b %Y, %H:%M UTC')}.",
            "vehicle": vehicle.to_dict(),
            "unavailability": record.to_dict(),
        }
