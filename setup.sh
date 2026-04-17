#!/usr/bin/env bash
# One-shot setup for the Aegis Thermal dashboard on macOS.
# Installs Python deps into a local venv and Node deps for the frontend.

set -e

cd "$(dirname "$0")"

echo "▶ Checking prerequisites…"
if ! command -v python3 >/dev/null; then
  echo "✗ python3 not found. Install it with: brew install python@3.11"
  exit 1
fi
if ! command -v node >/dev/null; then
  echo "✗ node not found. Install it with: brew install node"
  exit 1
fi
echo "  ✓ python3 $(python3 --version)"
echo "  ✓ node    $(node --version)"

echo ""
echo "▶ Creating Python virtual environment in backend/.venv …"
python3 -m venv backend/.venv
# shellcheck disable=SC1091
source backend/.venv/bin/activate
pip install --upgrade pip >/dev/null
pip install -r backend/requirements.txt
deactivate

echo ""
echo "▶ Installing frontend dependencies (this takes 1–2 minutes the first time)…"
cd frontend
npm install --silent
cd ..

echo ""
echo "✓ Setup complete."
echo ""
echo "To start the dashboard, run:"
echo "    ./start.sh"
