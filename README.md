# AI-Based Thermal and Power Monitoring Dashboard
An AI-powered operations platform for real-time observability of data-centre thermal and electrical performance. The system ingests per-rack telemetry, detects anomalies with an unsupervised Isolation Forest model, produces six-hour forward forecasts using Holt–Winters exponential smoothing, and projects annualised energy, cost, and carbon-reduction outcomes against a configurable target Power Usage Effectiveness (PUE).

---

## 1. Capabilities

- **Live telemetry ingestion** — four rack zones (A1, A2, B1, B2) streamed on a three-second cadence over Server-Sent Events.
- **Key performance indicators** — inlet temperature, aggregate power draw, CPU load, PUE, fan speed, and cooling efficiency.
- **Anomaly detection** — scikit-learn Isolation Forest (contamination = 0.02, 200 estimators) with incremental retraining.
- **Six-hour forecasting** — statsmodels Holt–Winters exponential smoothing across inlet temperature, power draw, CPU load, and PUE.
- **Business-impact calculator** — annualised kWh, cost (USD), and CO₂ savings derived from a configurable target PUE, facility scale, and electricity tariff.
- **Audit export** — downloadable CSV snapshot of current and projected metrics for governance and finance review.
- **Operator console** — five navigational views (Fleet, Thermal, Grid, Analytics, Logs) tuned to different stakeholder audiences.

---

## 2. System Architecture

| Layer | Technology | Responsibility |
|---|---|---|
| Frontend | React 18, Vite 5, Tailwind CSS 3.4, Recharts, lucide-react | Operator console, charts, live view, export |
| Backend | Python 3.11, FastAPI, Uvicorn | REST + SSE API, model orchestration |
| Machine learning | scikit-learn (Isolation Forest), statsmodels (Holt–Winters) | Anomaly scoring and short-horizon forecasting |
| Data | Synthetic telemetry simulator (in-memory deque, 8 000 rows) | Deterministic test fixture and demonstration signal |
| Packaging | Single-service deployment — FastAPI serves the compiled React bundle from `frontend/dist` | Simplified hosting, one public URL |

---

## 3. Prerequisites

The following runtimes are required on any workstation that will run the project locally.

| Component | Minimum Version | Purpose |
|---|---|---|
| Python | 3.11 | Backend services, ML models |
| Node.js | 18.x (20.x recommended) | Frontend build toolchain |
| Git | 2.30+ | Source control and deployment |

No database server is required — the current build uses an in-memory simulator. A persistent store can be introduced later without schema migration, as all telemetry flows through the backend's `simulator` module boundary.

---

## 4. Installation — macOS

### 4.1 Open Terminal

1. Press **Cmd + Space** to open Spotlight Search.
2. Type `Terminal` and press **Return**.

### 4.2 Install Homebrew (skip if already installed)

Run this command to install Homebrew, the macOS package manager:

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

Verify:

```bash
brew --version
```

### 4.3 Install Python 3.11 and Node.js

```bash
brew install python@3.11 node git
```

### 4.4 Obtain the source code

Replace `<repository-url>` with the HTTPS clone URL of your Git repository.

```bash
cd ~
git clone <repository-url> thermal-dashboard
cd thermal-dashboard
```

### 4.5 Install backend dependencies

```bash
cd backend
python3.11 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
cd ..
```

### 4.6 Install frontend dependencies

```bash
cd frontend
npm install
cd ..
```

---

## 5. Installation — Windows

### 5.1 Open PowerShell

1. Press the **Windows key**.
2. Type `PowerShell`, right-click **Windows PowerShell**, and select **Run as administrator**.

### 5.2 Install prerequisites

If you do not have Python, Node.js, or Git installed:

1. Download and install **Python 3.11** from [https://www.python.org/downloads/windows/](https://www.python.org/downloads/windows/). On the first installer screen, tick the box **"Add python.exe to PATH"** before clicking **Install Now**.
2. Download and install **Node.js LTS** from [https://nodejs.org/](https://nodejs.org/). Accept the default options.
3. Download and install **Git for Windows** from [https://git-scm.com/download/win](https://git-scm.com/download/win). Accept the default options.
4. Close and reopen PowerShell so the new tools are recognised.

Verify each tool:

```powershell
python --version
node --version
git --version
```

### 5.3 Obtain the source code

Replace `<repository-url>` with the HTTPS clone URL of your Git repository.

```powershell
cd $HOME
git clone <repository-url> thermal-dashboard
cd thermal-dashboard
```

### 5.4 Install backend dependencies

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install --upgrade pip
pip install -r requirements.txt
cd ..
```

If PowerShell blocks the activation script with a red execution-policy error, run this **once** in an elevated PowerShell, then retry:

```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

### 5.5 Install frontend dependencies

```powershell
cd frontend
npm install
cd ..
```

---

## 6. Running the Application Locally

The project runs as two processes during development: the FastAPI backend on port **8000** and the Vite dev server on port **5173**.

### 6.1 Start the backend

**macOS / Linux:**

```bash
cd backend
source .venv/bin/activate
uvicorn main:app --reload --port 8000
```

**Windows:**

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
uvicorn main:app --reload --port 8000
```

Leave this terminal running.

### 6.2 Start the frontend (new terminal window)

```bash
cd frontend
npm run dev
```

### 6.3 Open the application

Navigate to **http://localhost:5173** in any modern browser. The interactive API documentation is available at **http://localhost:8000/docs**.

### 6.4 Stop the application

Return to each terminal window and press **Ctrl + C**.

---

## 7. Configuration

Runtime behaviour is controlled by environment variables. A template is provided at `backend/.env.example`; copy it to `backend/.env` and edit as required.

| Variable | Default | Description |
|---|---|---|
| `ELECTRICITY_USD_PER_KWH` | `0.12` | Blended tariff used by the savings calculator |
| `CO2_KG_PER_KWH` | `0.40` | Grid carbon intensity factor |
| `TARGET_PUE` | `1.30` | Target Power Usage Effectiveness for optimisation uplift |
| `ANOMALY_CONTAMINATION` | `0.02` | Expected anomaly rate for Isolation Forest |
| `FORECAST_HORIZON_HOURS` | `6` | Default forward horizon for Holt–Winters forecast |

Environment variables can also be configured in the hosting provider's dashboard (see section 10).

---

## 8. API Reference

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/health` | Service status, buffer size, model readiness |
| GET | `/api/telemetry/latest?n=400&rack=A1` | Most recent readings (optionally per rack) |
| GET | `/api/telemetry/per-rack` | Latest reading for each of the four zones |
| GET | `/api/telemetry/stream` | Server-Sent Events live stream |
| GET | `/api/anomalies/recent?n=50` | Flagged anomaly events |
| GET | `/api/forecast?horizon_hours=6` | Forward-looking forecast bundle |
| GET | `/api/savings` | Annualised energy, cost, CO₂ projection |
| POST | `/api/anomaly/retrain` | Force retrain of the Isolation Forest |

OpenAPI and Swagger UI are auto-generated at `/docs` and `/redoc`.

---

## 9. Project Structure

```
thermal-dashboard/
├── backend/
│   ├── main.py              FastAPI application and routing
│   ├── simulator.py         Synthetic telemetry generator
│   ├── anomaly.py           Isolation Forest detector
│   ├── forecast.py          Holt–Winters forecaster
│   ├── cost.py              Energy, cost, and CO₂ calculator
│   ├── requirements.txt     Python dependency manifest
│   └── .env.example         Configuration template
├── frontend/
│   ├── src/
│   │   ├── App.jsx          Tab-routed console shell
│   │   ├── api.js           Backend client and SSE handler
│   │   └── components/      Header, KpiRow, RackGrid, charts, etc.
│   ├── package.json
│   └── vite.config.js       Dev proxy to backend on port 8000
├── README.md
├── STITCH_DESIGN_BRIEF.md   UI design-system specification
├── setup.sh                 Convenience installer (macOS / Linux)
└── start.sh                 Convenience launcher (macOS / Linux)
```

---

## 10. Deployment to Render (Current Environment)

The production build is served as a single Render web service that runs the FastAPI backend and serves the compiled React bundle from `frontend/dist`.

**Service configuration summary:**

| Setting | Value |
|---|---|
| Environment | Python 3 |
| Build command | `pip install -r backend/requirements.txt && cd frontend && npm install && npm run build` |
| Start command | `cd backend && uvicorn main:app --host 0.0.0.0 --port $PORT` |
| Branch | `main` |

Render auto-redeploys on every push to the `main` branch.

---


## 11. Troubleshooting

| Symptom | Diagnosis | Resolution |
|---|---|---|
| `command not found: python3` (macOS) | Python missing | `brew install python@3.11` |
| `'python' is not recognized` (Windows) | Python not on PATH | Re-run the Python installer and tick "Add python.exe to PATH" |
| `permission denied: ./setup.sh` (macOS) | Script not executable | `chmod +x setup.sh start.sh` |
| `port 8000 is already in use` | Another process is using the port | macOS: `lsof -ti:8000 \| xargs kill -9` — Windows: `netstat -ano \| findstr :8000` then `taskkill /PID <pid> /F` |
| `port 5173 is already in use` | Vite port busy | Same as above, substituting 5173 |
| `statsmodels` or `scikit-learn` install fails on Apple Silicon | Missing compiler toolchain | `xcode-select --install`, then rerun `pip install -r requirements.txt` |
| Frontend shows "CONNECTING…" indefinitely | Backend still bootstrapping history buffer | Allow 10–15 seconds on first load, then refresh |
| Render deploy fails with "unable to access GitHub repository" | Render's access to the repository has been revoked | Render dashboard → **Account Settings → GitHub → Disconnect**, then reconnect and grant repository access |
| 502 response on Render `onrender.com` URL | Free-tier instance is spinning up from cold | Wait 30–60 seconds and retry; the service will warm and remain up while traffic continues |

---

## 12. Licence and Attribution

This project is an internal engineering deliverable. Third-party components are used under their respective open-source licences (FastAPI, scikit-learn, statsmodels, React, Vite, Tailwind CSS, Recharts, lucide-react).
