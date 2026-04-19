"""
Short-horizon forecasting for temperature and power draw.

We use Holt-Winters exponential smoothing from statsmodels — lightweight,
robust, installs cleanly on Mac M2 without pain (Prophet alternative avoided
for install complexity). Produces an hourly-aggregated forecast for the next
`horizon_hours` and a confidence envelope.
"""
from __future__ import annotations

from typing import Dict, List, Optional
import warnings

import numpy as np
import pandas as pd
from statsmodels.tsa.holtwinters import ExponentialSmoothing

warnings.filterwarnings("ignore")


def _prep_series(rows: List[Dict], metric: str) -> pd.Series:
    df = pd.DataFrame(rows)
    if df.empty:
        return pd.Series(dtype=float)
    df["timestamp"] = pd.to_datetime(df["timestamp"])
    df = df.set_index("timestamp").sort_index()
    # aggregate to 1-minute resolution so the model is fast
    s = df[metric].resample("1min").mean().interpolate("linear").dropna()
    return s


def forecast_metric(
    rows: List[Dict],
    metric: str,
    horizon_hours: int = 6,
) -> Dict:
    """Return a dict with the forecast for one metric, hourly points."""
    s = _prep_series(rows, metric)
    if len(s) < 60:
        return {
            "metric": metric,
            "horizon_hours": horizon_hours,
            "points": [],
            "status": "insufficient_data",
        }

    # Holt-Winters with hourly seasonality
    seasonal_periods = min(60, len(s) // 3)  # 60 minutes per cycle if we have enough
    try:
        model = ExponentialSmoothing(
            s,
            trend="add",
            seasonal="add" if seasonal_periods >= 12 else None,
            seasonal_periods=seasonal_periods if seasonal_periods >= 12 else None,
            initialization_method="estimated",
        ).fit(optimized=True)
    except Exception:
        # Fall back to simple smoothing if seasonal fit fails
        model = ExponentialSmoothing(
            s, trend="add", initialization_method="estimated"
        ).fit(optimized=True)

    steps = horizon_hours * 60
    fc = model.forecast(steps=steps)
    # Aggregate to hourly buckets for the UI
    fc_df = fc.to_frame("value")
    hourly = fc_df.resample("1h").agg(["mean", "min", "max"]).dropna()
    hourly.columns = ["mean", "low", "high"]

    # Add a small envelope based on historical residual std
    resid_std = float(np.std(model.resid.dropna().values)) if model.resid is not None else 0.0
    hourly["low"] = hourly["low"] - 1.5 * resid_std
    hourly["high"] = hourly["high"] + 1.5 * resid_std

    def _iso_utc(ts) -> str:
        """Return a clean '...Z' ISO-8601 string without double timezone."""
        t = ts
        if hasattr(t, "tz_localize"):
            if t.tzinfo is not None:
                t = t.tz_convert("UTC").tz_localize(None)
        return t.isoformat(timespec="seconds") + "Z"

    points = [
        {
            "timestamp": _iso_utc(idx),
            "mean": round(float(row["mean"]), 3),
            "low": round(float(row["low"]), 3),
            "high": round(float(row["high"]), 3),
        }
        for idx, row in hourly.iterrows()
    ]

    last_actual = float(s.iloc[-1])
    first_fc = float(hourly["mean"].iloc[0]) if len(hourly) else last_actual
    last_fc = float(hourly["mean"].iloc[-1]) if len(hourly) else last_actual

    return {
        "metric": metric,
        "horizon_hours": horizon_hours,
        "status": "ok",
        "last_actual": round(last_actual, 3),
        "first_hour": round(first_fc, 3),
        "last_hour": round(last_fc, 3),
        "delta": round(last_fc - last_actual, 3),
        "points": points,
    }


def forecast_bundle(rows: List[Dict], horizon_hours: int = 6) -> Dict:
    """Forecast all KPI metrics in one call."""
    return {
        "horizon_hours": horizon_hours,
        "metrics": {
            "inlet_temp_c": forecast_metric(rows, "inlet_temp_c", horizon_hours),
            "power_draw_kw": forecast_metric(rows, "power_draw_kw", horizon_hours),
            "cpu_load_pct": forecast_metric(rows, "cpu_load_pct", horizon_hours),
            "pue": forecast_metric(rows, "pue", horizon_hours),
        },
    }
