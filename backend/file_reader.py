"""
CSV-backed telemetry reader for AI-Based Thermal & Power Monitoring.

Loads the synthetic telemetry CSV(s) from `backend/data/*.csv` and replays
them as if they were a live telemetry stream. The CSV's ground-truth
`anomaly_flag` and `anomaly_type` columns are preserved so the dashboard
can compare the Isolation Forest model's output against the labelled
incidents baked into the dataset.

The public API (class name, method names, and the `simulator` singleton)
mirrors `simulator.py` exactly so the rest of the backend
(`main.py`, `anomaly.py`, `forecast.py`, `cost.py`) does NOT need to
change. To swap back to the pure synthetic generator, revert the
import in `main.py`.

To add more data later (e.g. next month's export from the TDI team):
    just drop any additional CSV files with the same column schema into
    `backend/data/` and restart the backend. They will be concatenated
    and sorted automatically.
"""
from __future__ import annotations

import threading
from collections import deque
from dataclasses import asdict, dataclass, replace
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Deque, Dict, List, Optional

import pandas as pd


RACK_ZONES = ["A1", "A2", "B1", "B2"]
TICK_SECONDS = 3  # playback cadence — one new tick every N seconds
BUFFER_MAX = 8000  # keeps roughly 6+ hours of recent readings in memory
DATA_DIR = Path(__file__).resolve().parent / "data"


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
    anomaly_flag: int = 0
    anomaly_type: str = "normal"

    def to_dict(self) -> Dict:
        return asdict(self)


class CsvTelemetryReader:
    """
    Replays pre-generated CSV telemetry as a live stream.

    * On startup the full dataset is read into memory and grouped into
      "ticks" — one tick = one reading per rack zone (A1, A2, B1, B2).
      The dataset rotates through the four racks every 15 minutes,
      so every four consecutive rows form one complete rotation.
    * The buffer is seeded with ~2 hours of historical ticks so charts
      and the Isolation Forest have data to train on immediately.
    * A background thread advances a cursor through the dataset every
      `TICK_SECONDS` seconds, appending the next tick's four readings
      to the buffer with a fresh "now" timestamp. When the end of the
      dataset is reached the cursor wraps back to 0.
    """

    def __init__(self, tick_seconds: float = TICK_SECONDS):
        self.tick_seconds = tick_seconds
        self.buffer: Deque[Reading] = deque(maxlen=BUFFER_MAX)
        self._lock = threading.Lock()
        self._thread: Optional[threading.Thread] = None
        self._stop = threading.Event()

        # Load CSV(s) once and pre-group them into tick batches
        self._ticks: List[List[Reading]] = self._load_csvs()
        self._cursor = 0  # index into self._ticks used by the background thread

        # Seed the buffer with ~2 hours of synthetic history
        self._bootstrap(hours=2)

    # ----------------------- public API (mirrors simulator.py) ----------------

    def start(self) -> None:
        if not self._ticks:
            return  # nothing to stream — fail quietly, /api/health still works
        if self._thread and self._thread.is_alive():
            return
        self._stop.clear()
        self._thread = threading.Thread(
            target=self._run, name="csv-telemetry-reader", daemon=True
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

    # ----------------------- internals ----------------------------------------

    def _load_csvs(self) -> List[List[Reading]]:
        """Load every *.csv in DATA_DIR and group rows into per-tick batches."""
        if not DATA_DIR.exists():
            return []
        csv_files = sorted(DATA_DIR.glob("*.csv"))
        if not csv_files:
            return []

        frames = []
        for path in csv_files:
            try:
                frames.append(pd.read_csv(path, parse_dates=["timestamp"]))
            except Exception as exc:  # noqa: BLE001
                print(f"[file_reader] Could not read {path.name}: {exc}")
        if not frames:
            return []

        df = pd.concat(frames, ignore_index=True)
        df = df.sort_values(["timestamp", "rack_zone"]).reset_index(drop=True)

        # Backfill expected columns if a CSV is missing them
        if "anomaly_flag" not in df.columns:
            df["anomaly_flag"] = 0
        if "anomaly_type" not in df.columns:
            df["anomaly_type"] = "normal"

        readings: List[Reading] = []
        for row in df.itertuples(index=False):
            atype = getattr(row, "anomaly_type", "normal")
            if pd.isna(atype) or not str(atype).strip():
                atype = "normal"
            try:
                aflag = int(row.anomaly_flag) if not pd.isna(row.anomaly_flag) else 0
            except Exception:  # noqa: BLE001
                aflag = 0
            readings.append(
                Reading(
                    timestamp="",  # filled in at playback time
                    rack_zone=str(row.rack_zone),
                    cpu_load_pct=float(row.cpu_load_pct),
                    power_draw_kw=float(row.power_draw_kw),
                    ambient_temp_c=float(row.ambient_temp_c),
                    inlet_temp_c=float(row.inlet_temp_c),
                    outlet_temp_c=float(row.outlet_temp_c),
                    humidity_pct=float(row.humidity_pct),
                    fan_speed_pct=float(row.fan_speed_pct),
                    cooling_efficiency_pct=float(row.cooling_efficiency_pct),
                    pue=float(row.pue),
                    anomaly_flag=aflag,
                    anomaly_type=str(atype),
                )
            )

        # Each tick is one complete rotation through the four rack zones.
        # If the dataset length isn't a multiple of 4 the trailing partial
        # batch is dropped — it would otherwise skew the aggregate charts.
        ticks: List[List[Reading]] = []
        rack_count = len(RACK_ZONES)
        for i in range(0, len(readings), rack_count):
            group = readings[i : i + rack_count]
            if len(group) == rack_count:
                ticks.append(group)
        return ticks

    def _bootstrap(self, hours: int = 2) -> None:
        """Pre-fill the buffer so charts and the anomaly model start warm."""
        if not self._ticks:
            return
        steps = int((hours * 3600) / self.tick_seconds)
        steps = min(steps, BUFFER_MAX // len(RACK_ZONES))

        start_time = datetime.now(tz=timezone.utc) - timedelta(
            seconds=steps * self.tick_seconds
        )
        for i in range(steps):
            ts = start_time + timedelta(seconds=i * self.tick_seconds)
            ts_str = ts.strftime("%Y-%m-%dT%H:%M:%SZ")
            group = self._ticks[i % len(self._ticks)]
            for reading in group:
                self.buffer.append(replace(reading, timestamp=ts_str))
        # live cursor picks up where the bootstrap left off
        self._cursor = steps % len(self._ticks)

    def _run(self) -> None:
        while not self._stop.is_set():
            now = datetime.now(tz=timezone.utc)
            ts_str = now.strftime("%Y-%m-%dT%H:%M:%SZ")
            if self._ticks:
                group = self._ticks[self._cursor]
                with self._lock:
                    for reading in group:
                        self.buffer.append(replace(reading, timestamp=ts_str))
                self._cursor = (self._cursor + 1) % len(self._ticks)
            self._stop.wait(self.tick_seconds)


# Singleton — drop-in replacement for `simulator.simulator`
simulator = CsvTelemetryReader()
