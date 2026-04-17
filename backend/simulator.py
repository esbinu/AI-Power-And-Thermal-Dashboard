"""
Synthetic telemetry simulator for AI-Based Thermal & Power Monitoring.

Generates realistic server-room telemetry every TICK_SECONDS for 4 rack zones.
Formulas match the specification from the project spec email
(synthetic dataset blueprint by Binu E S, Deutsche Bank TDI/GTI).

The simulator runs in a background thread and keeps the most recent rows
in an in-memory deque so the API can serve them to the dashboard.
"""
from __future__ import annotations

import threading
import time
import random
from collections import deque
from dataclasses import dataclass, asdict
from datetime import datetime, timedelta
from typing import Deque, List, Dict, Optional
import numpy as np


RACK_ZONES = ["A1", "A2", "B1", "B2"]
TICK_SECONDS = 3  # produce a new reading every N seconds
BUFFER_MAX = 8000  # keep roughly 6+ hours of data per rack at TICK_SECONDS


@dataclass
class Reading:
    timestamp: str
    rack_zone: str
    cpu_load_pct: float
    power_draw_kw: float
    ambient_temp_c: float
    inlet_temp_c: float
    outlet_temp_c: float
    humidity_pct: float
    fan_speed_pct: float
    cooling_efficiency_pct: float
    pue: float
    # anomaly_flag / type are set later by the anomaly detector
    anomaly_flag: int = 0
    anomaly_type: str = "normal"

    def to_dict(self) -> Dict:
        return asdict(self)


class TelemetrySimulator:
    """
    Streams synthetic telemetry into an in-memory ring buffer.
    Designed to look realistic: daily cycles, weekend dips, occasional
    injected incidents (cooling failure, power surge, workload spike).
    """

    def __init__(self, tick_seconds: float = TICK_SECONDS):
        self.tick_seconds = tick_seconds
        self.buffer: Deque[Reading] = deque(maxlen=BUFFER_MAX)
        self._lock = threading.Lock()
        self._thread: Optional[threading.Thread] = None
        self._stop = threading.Event()
        self._rng = np.random.default_rng(42)
        self._step = 0

        # Incident state: (rack_zone, type, remaining_ticks, strength)
        self._active_incidents: List[Dict] = []
        self._ticks_since_incident = 0

        # Bootstrap: pre-fill the buffer with ~2 hours of history so charts
        # and models have something to work with immediately.
        self._bootstrap(hours=2)

    # ----------------------- public API -----------------------

    def start(self) -> None:
        if self._thread and self._thread.is_alive():
            return
        self._stop.clear()
        self._thread = threading.Thread(
            target=self._run, name="telemetry-simulator", daemon=True
        )
        self._thread.start()

    def stop(self) -> None:
        self._stop.set()
        if self._thread:
            self._thread.join(timeout=2)

    def latest(self, n: int = 400, rack: Optional[str] = None) -> List[Dict]:
        with self._lock:
            items = list(self.buffer)
        if rack and rack != "all":
            items = [r for r in items if r.rack_zone == rack]
        return [r.to_dict() for r in items[-n:]]

    def latest_per_rack(self) -> Dict[str, Dict]:
        """Most recent reading for each rack zone."""
        with self._lock:
            items = list(self.buffer)
        result: Dict[str, Dict] = {}
        for r in reversed(items):
            if r.rack_zone not in result:
                result[r.rack_zone] = r.to_dict()
            if len(result) == len(RACK_ZONES):
                break
        return result

    def all_rows(self) -> List[Dict]:
        with self._lock:
            return [r.to_dict() for r in self.buffer]

    # ----------------------- internals ------------------------

    def _bootstrap(self, hours: int = 2) -> None:
        """Pre-fill the buffer with synthesized history for first-render."""
        steps_per_rack = int((hours * 3600) / self.tick_seconds)
        start = datetime.utcnow() - timedelta(seconds=steps_per_rack * self.tick_seconds)
        for i in range(steps_per_rack):
            ts = start + timedelta(seconds=i * self.tick_seconds)
            for zone in RACK_ZONES:
                reading = self._generate_reading(ts, zone, bootstrap_step=i)
                self.buffer.append(reading)
        self._step = steps_per_rack

    def _run(self) -> None:
        while not self._stop.is_set():
            now = datetime.utcnow()
            self._maybe_start_incident()
            for zone in RACK_ZONES:
                reading = self._generate_reading(now, zone)
                with self._lock:
                    self.buffer.append(reading)
            self._step += 1
            self._decay_incidents()
            self._stop.wait(self.tick_seconds)

    def _generate_reading(
        self, ts: datetime, zone: str, bootstrap_step: Optional[int] = None
    ) -> Reading:
        """Core formula — faithful to the project spec blueprint."""
        hour = ts.hour + ts.minute / 60 + ts.second / 3600
        dow = ts.weekday()
        is_weekend = 1 if dow >= 5 else 0
        workday_factor = 0.70 if is_weekend else 1.00

        daily_wave = 0.5 + 0.5 * np.sin(2 * np.pi * (hour - 7) / 24)
        secondary_wave = 0.5 + 0.5 * np.sin(4 * np.pi * (hour - 13) / 24)

        # Each rack gets a slightly different base profile
        zone_offset = {"A1": 0.0, "A2": 1.2, "B1": -0.8, "B2": 2.0}[zone]
        zone_cpu_bias = {"A1": 0.0, "A2": 2.0, "B1": -3.0, "B2": 4.0}[zone]

        base_cpu = (
            38
            + 22 * daily_wave * workday_factor
            + 6 * secondary_wave
            + zone_cpu_bias
            + self._rng.normal(0, 2.4)
        )
        cpu_load_pct = float(np.clip(base_cpu, 12, 92))

        ambient_temp_c = float(22 + 4.0 * daily_wave + self._rng.normal(0, 0.6))
        humidity_pct = float(
            np.clip(46 + 10 * (1 - daily_wave) + self._rng.normal(0, 2.2), 30, 70)
        )
        power_draw_kw = float(
            9.5
            + 0.16 * cpu_load_pct
            + 0.12 * (ambient_temp_c - 22)
            + self._rng.normal(0, 0.45)
        )
        inlet_temp_c = float(
            19.8
            + 0.06 * cpu_load_pct
            + 0.38 * (ambient_temp_c - 22)
            + zone_offset
            + self._rng.normal(0, 0.35)
        )
        outlet_temp_c = float(
            inlet_temp_c + 7.5 + 0.05 * cpu_load_pct + self._rng.normal(0, 0.40)
        )
        fan_speed_pct = float(
            np.clip(
                33 + 0.70 * (inlet_temp_c - 20) + 0.22 * cpu_load_pct + self._rng.normal(0, 2.2),
                20, 100
            )
        )
        cooling_efficiency_pct = float(
            np.clip(
                90
                - 0.22 * (ambient_temp_c - 22)
                - 0.12 * (cpu_load_pct - 45)
                + self._rng.normal(0, 1.8),
                60, 98,
            )
        )
        pue = float(
            np.clip(
                1.28
                + 0.0018 * cpu_load_pct
                + 0.0042 * (ambient_temp_c - 22)
                + self._rng.normal(0, 0.015),
                1.18, 1.95,
            )
        )

        # Apply any active incidents affecting this zone
        cpu_load_pct, power_draw_kw, inlet_temp_c, outlet_temp_c, \
            fan_speed_pct, cooling_efficiency_pct, pue, incident_type = \
            self._apply_incidents(
                zone,
                cpu_load_pct, power_draw_kw, inlet_temp_c, outlet_temp_c,
                fan_speed_pct, cooling_efficiency_pct, pue,
            )

        return Reading(
            timestamp=ts.isoformat(timespec="seconds") + "Z",
            rack_zone=zone,
            cpu_load_pct=round(cpu_load_pct, 2),
            power_draw_kw=round(power_draw_kw, 2),
            ambient_temp_c=round(ambient_temp_c, 2),
            inlet_temp_c=round(inlet_temp_c, 2),
            outlet_temp_c=round(outlet_temp_c, 2),
            humidity_pct=round(humidity_pct, 2),
            fan_speed_pct=round(fan_speed_pct, 2),
            cooling_efficiency_pct=round(cooling_efficiency_pct, 2),
            pue=round(pue, 3),
            anomaly_flag=1 if incident_type != "normal" else 0,
            anomaly_type=incident_type,
        )

    # ------------------ incident injection --------------------

    _INCIDENT_TYPES = [
        "cooling_failure",
        "power_surge",
        "workload_spike",
        "cooling_oscillation",
        "rack_hotspot",
    ]

    def _maybe_start_incident(self) -> None:
        self._ticks_since_incident += 1
        # roughly one incident every ~90–180 ticks (~4–9 minutes at 3s tick)
        if self._ticks_since_incident < 90:
            return
        if self._rng.random() > 0.02:
            return
        itype = str(self._rng.choice(self._INCIDENT_TYPES))
        zone = random.choice(RACK_ZONES)
        duration = int(self._rng.integers(15, 40))
        self._active_incidents.append({
            "zone": zone,
            "type": itype,
            "remaining": duration,
            "age": 0,
            "total": duration,
        })
        self._ticks_since_incident = 0

    def _decay_incidents(self) -> None:
        for inc in self._active_incidents:
            inc["remaining"] -= 1
            inc["age"] += 1
        self._active_incidents = [i for i in self._active_incidents if i["remaining"] > 0]

    def _apply_incidents(
        self, zone: str,
        cpu: float, power: float, inlet: float, outlet: float,
        fan: float, cool_eff: float, pue: float,
    ):
        itype = "normal"
        for inc in self._active_incidents:
            if inc["zone"] != zone:
                continue
            itype = inc["type"]
            progress = inc["age"] / max(inc["total"], 1)  # 0..1
            if itype == "cooling_failure":
                inlet += 3.5 + progress * 3.5
                outlet += 4.5 + progress * 4.0
                cool_eff = max(35.0, cool_eff - (10 + progress * 8))
                fan = min(100.0, fan + (8 + progress * 10))
                pue = min(2.5, pue + 0.04 + progress * 0.08)
            elif itype == "power_surge":
                power += 6 + progress * 5
                cpu = min(100.0, cpu + 3 + progress * 5)
                pue = min(2.5, pue + 0.03 + progress * 0.05)
            elif itype == "workload_spike":
                cpu = min(100.0, cpu + 14 + progress * 14)
                power += 2.5 + progress * 3
                outlet += 1.8 + progress * 2
                fan = min(100.0, fan + 6 + progress * 6)
            elif itype == "cooling_oscillation":
                osc = np.sin(inc["age"] * 0.6)
                inlet += 2.4 * osc + 2.0
                fan = min(100.0, fan + 9 * abs(osc))
                cool_eff = max(35.0, cool_eff - 8 * abs(osc))
            elif itype == "rack_hotspot":
                inlet += 4.2
                outlet += 5.0
                fan = min(100.0, fan + 12)
        return cpu, power, inlet, outlet, fan, cool_eff, pue, itype


# Singleton
simulator = TelemetrySimulator()
