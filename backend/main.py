"""
FastAPI backend for the AI-Based Thermal & Power Monitoring Dashboard.

Endpoints:
  GET  /api/health                -> service status
  GET  /api/telemetry/latest      -> recent readings (optionally filtered by rack)
  GET  /api/telemetry/per-rack    -> latest single reading per rack (for KPI tiles)
  GET  /api/telemetry/stream      -> Server-Sent Events live stream
  GET  /api/anomalies/recent      -> recent rows flagged as anomalies
  GET  /api/forecast              -> 1-6 hour forecasts for key metrics
  GET  /api/savings               -> energy & cost savings snapshot
  POST /api/anomaly/retrain       -> force retrain the Isolation Forest

Run locally:
  uvicorn main:app --reload --port 8000
"""
from __future__ import annotations

import asyncio
import json
from typing import Optional

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
import os
from pathlib import Path

from simulator import simulator, RACK_ZONES
from anomaly import detector
from forecast import forecast_bundle, forecast_metric
from cost import savings_snapshot


app = FastAPI(
    title="AI Thermal & Power Monitoring API",
    description="Backend for data-center energy optimization dashboard",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # demo app — tighten for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ------------------ lifecycle ------------------

@app.on_event("startup")
async def _startup():
    simulator.start()
    # Bootstrap-train the anomaly detector on the pre-filled history
    detector.train(simulator.all_rows())


@app.on_event("shutdown")
async def _shutdown():
    simulator.stop()


# ------------------ endpoints ------------------

@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "racks": RACK_ZONES,
        "buffer_rows": len(simulator.buffer),
        "model_ready": detector.is_ready(),
    }


@app.get("/api/telemetry/latest")
def telemetry_latest(
    n: int = Query(400, ge=1, le=5000),
    rack: Optional[str] = Query(None),
):
    rows = simulator.latest(n=n, rack=rack)
    scored = detector.score(rows)
    return {"rows": scored, "count": len(scored)}


@app.get("/api/telemetry/per-rack")
def telemetry_per_rack():
    latest = simulator.latest_per_rack()
    # Score them one at a time
    scored = detector.score(list(latest.values()))
    out = {}
    for r in scored:
        out[r["rack_zone"]] = r
    return out


@app.get("/api/telemetry/stream")
async def telemetry_stream(rack: Optional[str] = Query(None)):
    """SSE stream — emits latest per-rack snapshot every ~2s."""

    async def event_gen():
        last_ts = ""
        while True:
            rows = simulator.latest(n=1 if rack else 4, rack=rack)
            if rows:
                scored = detector.score(rows)
                payload = {
                    "readings": scored,
                    "ts": scored[-1]["timestamp"],
                }
                # Only push when we have a new timestamp
                if payload["ts"] != last_ts:
                    last_ts = payload["ts"]
                    yield f"data: {json.dumps(payload)}\n\n"
            await asyncio.sleep(2)

    return StreamingResponse(event_gen(), media_type="text/event-stream")


@app.get("/api/anomalies/recent")
def anomalies_recent(n: int = Query(50, ge=1, le=500)):
    # Look at last ~2000 rows, return only those flagged by model OR injected
    rows = simulator.latest(n=2000)
    scored = detector.score(rows)
    flagged = [
        r for r in scored
        if r.get("model_anomaly_flag") == 1 or r.get("anomaly_flag") == 1
    ]
    # Most recent first
    flagged.sort(key=lambda r: r["timestamp"], reverse=True)
    return {"anomalies": flagged[:n], "count": len(flagged[:n])}


@app.get("/api/forecast")
def forecast(horizon_hours: int = Query(6, ge=1, le=12),
             metric: Optional[str] = Query(None)):
    # Use the full buffer — forecaster needs at least ~60 min of history
    rows = simulator.all_rows()
    if metric:
        return forecast_metric(rows, metric, horizon_hours)
    return forecast_bundle(rows, horizon_hours)


@app.get("/api/savings")
def savings(
    electricity_usd_per_kwh: float = Query(0.12, ge=0.01, le=2.0),
    target_pue: float = Query(1.30, ge=1.05, le=2.0),
    num_racks_scale: int = Query(100, ge=1, le=100000),
):
    rows = simulator.latest(n=800)
    return savings_snapshot(
        rows,
        electricity_usd_per_kwh=electricity_usd_per_kwh,
        target_pue=target_pue,
        num_racks_scale=num_racks_scale,
    )


@app.post("/api/anomaly/retrain")
def retrain():
    return detector.train(simulator.all_rows())


# ------------------ serve frontend (prod single-service) ------------------
# If a built frontend exists next to the backend, serve it.
_FRONTEND_DIST = Path(__file__).resolve().parent.parent / "frontend" / "dist"
if _FRONTEND_DIST.exists():
    app.mount("/", StaticFiles(directory=str(_FRONTEND_DIST), html=True), name="spa")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=int(os.environ.get("PORT", 8000)),
                reload=False)
