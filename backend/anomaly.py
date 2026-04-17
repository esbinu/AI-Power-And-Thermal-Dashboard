"""
Isolation Forest anomaly detector (scikit-learn).
Matches the model choice in the project spec.
Trains once on bootstrap data, then scores new rows incrementally.
Model is retrained periodically in the background.
"""
from __future__ import annotations

import threading
import time
from typing import Dict, List, Optional

import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler


FEATURES = [
    "cpu_load_pct",
    "power_draw_kw",
    "ambient_temp_c",
    "inlet_temp_c",
    "outlet_temp_c",
    "humidity_pct",
    "fan_speed_pct",
    "cooling_efficiency_pct",
    "pue",
]


class AnomalyDetector:
    def __init__(
        self,
        contamination: float = 0.02,
        n_estimators: int = 200,
        retrain_interval_s: int = 120,
    ):
        self.contamination = contamination
        self.n_estimators = n_estimators
        self.retrain_interval_s = retrain_interval_s

        self._scaler: Optional[StandardScaler] = None
        self._model: Optional[IsolationForest] = None
        self._lock = threading.Lock()
        self._last_trained: float = 0.0

    def is_ready(self) -> bool:
        with self._lock:
            return self._model is not None

    def train(self, rows: List[Dict]) -> Dict:
        """Train on a list of reading dicts. Returns training stats."""
        if len(rows) < 200:
            return {"trained": False, "reason": "insufficient_data", "rows": len(rows)}
        df = pd.DataFrame(rows)
        X = df[FEATURES].to_numpy()
        scaler = StandardScaler()
        Xs = scaler.fit_transform(X)
        model = IsolationForest(
            n_estimators=self.n_estimators,
            contamination=self.contamination,
            random_state=42,
            n_jobs=-1,
        )
        model.fit(Xs)
        with self._lock:
            self._scaler = scaler
            self._model = model
            self._last_trained = time.time()
        return {
            "trained": True,
            "rows": len(rows),
            "features": FEATURES,
            "contamination": self.contamination,
        }

    def score(self, rows: List[Dict]) -> List[Dict]:
        """Score a list of rows. Adds model_anomaly_flag, model_anomaly_score,
        dominant_signal to each returned row."""
        with self._lock:
            ready = self._model is not None and self._scaler is not None
            model = self._model
            scaler = self._scaler
        if not ready or not rows:
            # Fall back to passthrough
            return [
                {**r, "model_anomaly_flag": 0, "model_anomaly_score": 0.0,
                 "dominant_signal": ""}
                for r in rows
            ]
        df = pd.DataFrame(rows)
        X = df[FEATURES].to_numpy()
        Xs = scaler.transform(X)
        pred = model.predict(Xs)
        score = -model.score_samples(Xs)
        # dominant signal = feature with largest abs z-score within this batch
        z = (df[FEATURES] - df[FEATURES].mean()) / (df[FEATURES].std(ddof=0) + 1e-9)
        dominant = z.abs().idxmax(axis=1).tolist()

        out: List[Dict] = []
        for i, r in enumerate(rows):
            out.append({
                **r,
                "model_anomaly_flag": int(pred[i] == -1),
                "model_anomaly_score": round(float(score[i]), 4),
                "dominant_signal": dominant[i],
            })
        return out

    def maybe_retrain(self, rows_provider) -> None:
        """Retrain if enough time has passed. rows_provider: callable -> list of dicts."""
        if time.time() - self._last_trained < self.retrain_interval_s and self.is_ready():
            return
        rows = rows_provider()
        self.train(rows)


detector = AnomalyDetector()
