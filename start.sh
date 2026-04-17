#!/usr/bin/env bash
# Launches backend + frontend together for local development.
# Backend  -> http://localhost:8000
# Frontend -> http://localhost:5173   (proxies /api to the backend)

set -e
cd "$(dirname "$0")"

cleanup() {
  echo ""
  echo "▶ Stopping services…"
  kill "$BACKEND_PID" 2>/dev/null || true
  kill "$FRONTEND_PID" 2>/dev/null || true
  exit 0
}
trap cleanup INT TERM

echo "▶ Starting backend on http://localhost:8000 …"
(
  cd backend
  # shellcheck disable=SC1091
  source .venv/bin/activate
  uvicorn main:app --host 0.0.0.0 --port 8000 --reload
) &
BACKEND_PID=$!

sleep 2

echo "▶ Starting frontend on http://localhost:5173 …"
(
  cd frontend
  npm run dev
) &
FRONTEND_PID=$!

echo ""
echo "✓ Dashboard running."
echo "  → Open http://localhost:5173 in your browser"
echo "  → Press Ctrl+C here to stop both services."
echo ""

wait
