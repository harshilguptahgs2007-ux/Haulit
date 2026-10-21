MIN_DISTANCE_KM = 25.0
MAX_DISTANCE_KM = 4000.0

# Per-tier truck configuration: coeff and stable value
TRUCK_TIERS = {
    "SMALL":  {"coeff": 1.0,  "stable": 55},
    "MEDIUM": {"coeff": 1.5,  "stable": 15},
    "LARGE":  {"coeff": 2.0,  "stable": 4},
}

# Kept for backward-compatible API responses
TRUCK_COEFFICIENTS = {k: v["coeff"] for k, v in TRUCK_TIERS.items()}

RETURN_POLICY_TEXT = (
    "Haulit Return & Cancellation Policy: Orders can be cancelled or returned under the following "
    "strict conditions. If a return or cancellation is initiated by the customer, a 50% refund of the "
    "total booking payment will be issued. If the cancellation or return occurs due to company or logistics "
    "fault (such as vehicle breakdown, unexpected operational delays, or dispatch errors), a 90% refund will "
    "be returned. Please note that no damage payment or compensation is provided by Haulit under any circumstances. "
    "By accepting, you agree to these binding terms."
)

RETURN_POLICIES = {
    "customer_cancellation": {
        "refund_percentage": 50.0,
        "label": "Customer Cancellation",
        "description": "Customer requested cancellation or return: 50% payment returned.",
    },
    "company_fault": {
        "refund_percentage": 90.0,
        "label": "Company Fault",
        "description": "Logistics or company operational failure: 90% payment returned.",
    },
    "damage_disclaimer": "No damage payment from Haulit.",
}


def normalize_distance(dist: float) -> float:
    """
    Normalizes distance between 0 and 1 using:
    norm = (dist - 25) / (4000 - 25)
    Clamped within [25, 4000] km.
    """
    clamped_dist = max(MIN_DISTANCE_KM, min(MAX_DISTANCE_KM, float(dist)))
    return (clamped_dist - MIN_DISTANCE_KM) / (MAX_DISTANCE_KM - MIN_DISTANCE_KM)


def get_truck_coefficient(truck_type: str) -> float:
    normalized_type = (truck_type or "SMALL").strip().upper()
    tier = TRUCK_TIERS.get(normalized_type, TRUCK_TIERS["SMALL"])
    return tier["coeff"]


def get_truck_stable(truck_type: str) -> float:
    normalized_type = (truck_type or "SMALL").strip().upper()
    tier = TRUCK_TIERS.get(normalized_type, TRUCK_TIERS["SMALL"])
    return tier["stable"]


def calculate_price(weight_kg: float, distance_km: float, truck_type: str = "SMALL") -> dict:
    """
    Formula:
    w = weight (min 50, max 25000)
    dist = distance (min 25, max 4000)
    norm = (dist - 25) / (4000 - 25)
    SMALL:  coeff=1.0, stable=55
    MEDIUM: coeff=1.5, stable=15
    LARGE:  coeff=2.0, stable=4
    price = round(coeff * w * norm * stable, 2)
    """
    normalized_type = (truck_type or "SMALL").strip().upper()
    if normalized_type not in TRUCK_TIERS:
        normalized_type = "SMALL"

    w = float(weight_kg)
    dist = float(distance_km)
    coeff = TRUCK_TIERS[normalized_type]["coeff"]
    stable = TRUCK_TIERS[normalized_type]["stable"]
    norm = normalize_distance(dist)

    raw_price = coeff * w * norm * stable
    price = round(raw_price, 2)

    return {
        "weight_kg": w,
        "distance_km": round(dist, 2),
        "truck_type": normalized_type,
        "coefficient": coeff,
        "norm": round(norm, 6),
        "stable": stable,
        "price": price,
        "formatted_price": f"{price:.2f}/-",
    }


def calculate_refund(price: float, reason: str) -> dict:
    """
    If customer cancels: 50% payment
    If company's fault: 90% return
    No damage payment from Haulit
    """
    if reason == "company_fault":
        pct = 90.0
        label = "Company Fault (90% Return)"
    else:
        pct = 50.0
        label = "Customer Cancellation (50% Return)"

    refund_amount = round(float(price) * (pct / 100.0), 2)
    return {
        "original_price": float(price),
        "reason": reason,
        "refund_percentage": pct,
        "label": label,
        "refund_amount": refund_amount,
        "formatted_refund": f"{refund_amount:.2f}/-",
        "damage_disclaimer": "No damage payment from Haulit",
    }
