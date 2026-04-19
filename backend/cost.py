"""
Energy & cost savings calculator.

Business-facing numbers investors care about:
- Current power draw (kW) and annualized energy cost at a configurable tariff.
- PUE (Power Usage Effectiveness) — industry KPI for data-center efficiency.
- Estimated savings from cutting PUE toward a target (AI-optimized setpoint),
  expressed as $/yr and CO2 tonnes/yr avoided.
"""
from __future__ import annotations

from typing import Dict, List
import statistics


# --- defaults you can override via env / query string later ---
DEFAULT_ELECTRICITY_USD_PER_KWH = 0.12      # US commercial avg
DEFAULT_HOURS_PER_YEAR = 8760
DEFAULT_TARGET_PUE = 1.30                   # best-in-class industry target
DEFAULT_CO2_KG_PER_KWH = 0.40               # IEA global grid average


def savings_snapshot(
    rows: List[Dict],
    electricity_usd_per_kwh: float = DEFAULT_ELECTRICITY_USD_PER_KWH,
    target_pue: float = DEFAULT_TARGET_PUE,
    co2_kg_per_kwh: float = DEFAULT_CO2_KG_PER_KWH,
    num_racks_scale: int = 1,
) -> Dict:
    """
    Compute business metrics from the most recent telemetry window.
    num_racks_scale lets us present the figure 'at scale' for the pitch
    (e.g., multiply by a projected number of racks in a production deployment).
    """
    if not rows:
        return {"status": "no_data"}

    # Aggregate current state across racks (take last ~60 readings per zone)
    recent = rows[-400:]
    power = [r["power_draw_kw"] for r in recent]
    pue_vals = [r["pue"] for r in recent]

    avg_power_kw = statistics.mean(power)
    avg_pue = statistics.mean(pue_vals)

    # IT load = total power / pue  (industry formula)
    it_load_kw = avg_power_kw / avg_pue if avg_pue > 0 else avg_power_kw

    # Project to a full-facility scale
    scaled_total_kw = avg_power_kw * num_racks_scale
    scaled_it_kw = it_load_kw * num_racks_scale

    annual_kwh = scaled_total_kw * DEFAULT_HOURS_PER_YEAR
    annual_cost_usd = annual_kwh * electricity_usd_per_kwh
    annual_co2_tonnes = (annual_kwh * co2_kg_per_kwh) / 1000

    # Savings if we drive PUE from current -> target
    pue_delta = max(0.0, avg_pue - target_pue)
    pue_improvement_pct = (pue_delta / avg_pue) * 100 if avg_pue > 0 else 0

    # New total power at target PUE = IT load * target_pue
    new_total_kw = scaled_it_kw * target_pue
    kwh_saved_annual = (scaled_total_kw - new_total_kw) * DEFAULT_HOURS_PER_YEAR
    kwh_saved_annual = max(0.0, kwh_saved_annual)
    usd_saved_annual = kwh_saved_annual * electricity_usd_per_kwh
    co2_saved_tonnes = (kwh_saved_annual * co2_kg_per_kwh) / 1000

    return {
        "status": "ok",
        "inputs": {
            "electricity_usd_per_kwh": electricity_usd_per_kwh,
            "target_pue": target_pue,
            "num_racks_scale": num_racks_scale,
            "co2_kg_per_kwh": co2_kg_per_kwh,
        },
        "current": {
            "avg_power_kw": round(avg_power_kw, 2),
            "avg_pue": round(avg_pue, 3),
            "it_load_kw": round(it_load_kw, 2),
            "scaled_total_kw": round(scaled_total_kw, 2),
            "annual_kwh": round(annual_kwh, 0),
            "annual_cost_usd": round(annual_cost_usd, 0),
            "annual_co2_tonnes": round(annual_co2_tonnes, 1),
        },
        "optimized": {
            "target_pue": target_pue,
            "new_total_kw": round(new_total_kw, 2),
            "pue_improvement_pct": round(pue_improvement_pct, 2),
        },
        "savings": {
            "kwh_saved_annual": round(kwh_saved_annual, 0),
            "usd_saved_annual": round(usd_saved_annual, 0),
            "co2_saved_tonnes_annual": round(co2_saved_tonnes, 1),
        },
    }
