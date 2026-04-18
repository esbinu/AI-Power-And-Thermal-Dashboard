AI Data-Center Monitoring Dashboard

A pitch-ready demo dashboard for real-time AI-driven monitoring of server temperature, power draw, and workload — with anomaly detection, forecasting, and business-impact projection.

**Stack**
- **Backend:** Python 3.11 · FastAPI · scikit-learn (Isolation Forest) · statsmodels (Holt-Winters forecasting)
- **Frontend:** React · Vite · Tailwind CSS · Recharts
- **Data:** Synthetic telemetry simulator (4 rack zones, live stream every 3 seconds) — formulas match the project spec

---

## 1. First-time setup (one-time, ~3 minutes)

### Step 1 — Open a Terminal
1. Press **Cmd + Space** to open Spotlight.
2. Type `Terminal` and hit **Return**.

### Step 2 — Install prerequisites (skip anything you already have)

Paste these one at a time:

```bash
# Installs Homebrew (Mac's package manager). Skip if `brew --version` already works.
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

```bash
# Installs Python 3.11 and Node.js via Homebrew.
brew install python@3.11 node
```

### Step 3 — Run the setup script

```bash
# Move into the project folder (adjust the path if you saved it elsewhere).
cd "$HOME/Binu project/thermal-dashboard"
```

```bash
# Installs all Python + Node dependencies. First run takes ~2 minutes.
./setup.sh
```

**If you see "permission denied":**
```bash
chmod +x setup.sh start.sh && ./setup.sh
```

---

## 2. Run the dashboard

```bash
cd "$HOME/Binu project/thermal-dashboard"
./start.sh
```

You'll see:
```
✓ Dashboard running.
  → Open http://localhost:5173 in your browser
```

Open **http://localhost:5173** in Chrome/Safari. That's your dashboard.

To stop: go back to Terminal and press **Ctrl + C**.

---

## 3. What you'll see

- **Header** — live status indicator + buffer count
- **KPI row** — Avg Inlet Temp, Total Power, CPU Load, PUE, Fan Speed, Cooling Efficiency (all racks aggregated)
- **Live charts** — Temperature, Power, CPU per rack with red diamonds marking AI-flagged anomalies
- **Incident Feed** — scrolling list of detected incidents (cooling failure, power surge, workload spike, etc.)
- **6-Hour AI Forecast** — next 6 hours for temp / power / CPU / PUE
- **Rack status grid** — one card per rack zone with current state
- **Business Impact card** — Annual cost saved, CO₂ avoided, with sliders for facility scale / electricity tariff / target PUE. **This is the investor money slide.**

---

## 4. Running in your Antigravity IDE

1. Open **Antigravity**.
2. Go to **File → Open Folder** and select `thermal-dashboard`.
3. Open a terminal inside Antigravity with **Terminal → New Terminal** (or **Ctrl + \``).
4. Run `./setup.sh` (first time only) then `./start.sh`.

---

## 5. Common errors & fixes

| Error on screen | What it means | Fix |
|---|---|---|
| `command not found: python3` | Python not installed | `brew install python@3.11` |
| `command not found: node` | Node not installed | `brew install node` |
| `permission denied: ./setup.sh` | Script not executable | `chmod +x setup.sh start.sh` |
| `port 8000 is already in use` | Backend port busy | `lsof -ti:8000 \| xargs kill -9` |
| `port 5173 is already in use` | Frontend port busy | `lsof -ti:5173 \| xargs kill -9` |
| `statsmodels` or `scikit-learn` install fails | Compiler missing on M2 | `xcode-select --install` then re-run `./setup.sh` |
| Dashboard shows "CONNECTING…" | Backend not ready yet | Wait 10 seconds and refresh — backend bootstraps 2 hours of history on startup |

---

## 6. Project structure

```
thermal-dashboard/
├── backend/
│   ├── main.py           # FastAPI app, all API endpoints
│   ├── simulator.py      # Synthetic telemetry generator (4 racks, 3s tick)
│   ├── anomaly.py        # Isolation Forest detector
│   ├── forecast.py       # Holt-Winters 6-hour forecaster
│   ├── cost.py           # Energy / $ / CO₂ savings calculator
│   ├── requirements.txt
│   └── .env.example      # Copy to .env to override defaults
├── frontend/
│   ├── src/
│   │   ├── App.jsx                 # Main layout
│   │   ├── api.js                  # Backend client + SSE
│   │   └── components/             # Header, KpiRow, RackGrid, etc.
│   ├── package.json
│   └── vite.config.js              # Proxies /api to localhost:8000
├── setup.sh              # One-time install
├── start.sh              # Launch dev
└── STITCH_DESIGN_BRIEF.md
```

---

## 7. What's next

1. **Design in Stitch** — paste the prompt from `STITCH_DESIGN_BRIEF.md` into [stitch.withgoogle.com](https://stitch.withgoogle.com). Generate mockups and share the screenshots back to Claude.
2. **Refine the UI** — Claude will rebuild the React components to match your approved Stitch designs.
3. **Deploy to Render** — separate deploy guide will be generated once the UI is finalised. Free tier, one public URL for pitch emails.

---

## 8. API reference (useful if your dad wants to poke at it)

| Endpoint | What it returns |
|---|---|
| `GET /api/health` | Service status, buffer size, model-ready flag |
| `GET /api/telemetry/latest?n=400&rack=A1` | Most recent N readings (optionally per rack) |
| `GET /api/telemetry/per-rack` | Latest reading for each rack zone |
| `GET /api/telemetry/stream` | Server-Sent Events live stream |
| `GET /api/anomalies/recent?n=50` | Recent anomaly-flagged rows |
| `GET /api/forecast?horizon_hours=6` | 1–12 hour Holt-Winters forecasts |
| `GET /api/savings?target_pue=1.3&num_racks_scale=100` | Business-impact numbers |
| `POST /api/anomaly/retrain` | Force-retrain the Isolation Forest |

Open **http://localhost:8000/docs** for the auto-generated interactive API playground.
