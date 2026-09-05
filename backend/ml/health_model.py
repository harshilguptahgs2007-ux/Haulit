import torch
import torch.nn as nn
import os
import json
import config


class LuggageHealthNet(nn.Module):
    def __init__(self):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(3, 32),
            nn.ReLU(),
            nn.Linear(32, 16),
            nn.ReLU(),
            nn.Linear(16, 1),
            nn.Sigmoid(),
        )

    def forward(self, x):
        return self.net(x)


_model = None


def _load_model():
    global _model
    if _model is not None:
        return _model

    _model = LuggageHealthNet()
    if os.path.exists(config.ML_WEIGHTS_PATH):
        _model.load_state_dict(torch.load(config.ML_WEIGHTS_PATH, map_location="cpu"))
    else:
        os.makedirs(os.path.dirname(config.ML_WEIGHTS_PATH), exist_ok=True)
        _train_and_save(_model)

    _model.eval()
    return _model


def _train_and_save(model):
    import random
    optimizer = torch.optim.Adam(model.parameters(), lr=0.01)
    loss_fn   = nn.MSELoss()

    for _ in range(2000):
        v = random.uniform(0, 3)
        t = random.uniform(-10, 60)
        m = random.uniform(0, 100)

        norm_v = min(v / 3.0, 1.0)
        norm_t = (t + 10) / 70.0
        norm_m = m / 100.0

        health = 1.0 - (0.5 * norm_v + 0.3 * (abs(norm_t - 0.5) * 2) + 0.2 * norm_m)
        health = max(0.0, min(1.0, health))

        x = torch.tensor([[norm_v, norm_t, norm_m]], dtype=torch.float32)
        y = torch.tensor([[health]], dtype=torch.float32)

        optimizer.zero_grad()
        loss = loss_fn(model(x), y)
        loss.backward()
        optimizer.step()

    torch.save(model.state_dict(), config.ML_WEIGHTS_PATH)


def _normalize_inputs(vibration, temperature_c, moisture_pct):
    norm_v = min(vibration / 3.0, 1.0)
    norm_t = max(0.0, min(1.0, (temperature_c + 10) / 70.0))
    norm_m = min(moisture_pct / 100.0, 1.0)
    return norm_v, norm_t, norm_m


def score_health(vibration: float, temperature_c: float, moisture_pct: float,
                 cargo_type: str) -> dict:
    model = _load_model()
    norm_v, norm_t, norm_m = _normalize_inputs(vibration, temperature_c, moisture_pct)

    x = torch.tensor([[norm_v, norm_t, norm_m]], dtype=torch.float32)
    with torch.no_grad():
        raw_score = model(x).item()

    thresholds = config.CARGO_THRESHOLDS.get(cargo_type, config.CARGO_THRESHOLDS["standard"])

    violations = []
    penalty = 0.0

    if vibration > thresholds["vibration_max"]:
        violations.append(f"Vibration {vibration:.2f}g exceeds limit {thresholds['vibration_max']}g")
        penalty += 0.25

    if not (thresholds["temp_min"] <= temperature_c <= thresholds["temp_max"]):
        violations.append(
            f"Temperature {temperature_c:.1f}°C outside range "
            f"{thresholds['temp_min']}–{thresholds['temp_max']}°C"
        )
        penalty += 0.20

    if moisture_pct > thresholds["moisture_max"]:
        violations.append(f"Moisture {moisture_pct:.1f}% exceeds limit {thresholds['moisture_max']}%")
        penalty += 0.15

    final_score = max(0.0, raw_score - penalty) * 100

    if final_score >= 80:
        risk = "good"
    elif final_score >= 55:
        risk = "moderate"
    elif final_score >= 30:
        risk = "high"
    else:
        risk = "critical"

    return {
        "score":      round(final_score, 2),
        "risk_level": risk,
        "detail": {
            "violations":      violations,
            "thresholds_used": thresholds,
            "raw_model_score": round(raw_score * 100, 2),
        },
    }
