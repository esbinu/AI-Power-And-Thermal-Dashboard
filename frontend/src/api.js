// Backend API client. In dev, Vite proxies /api to http://localhost:8000.
// In prod (single-service deploy) the backend serves the frontend, so paths stay relative.
const API_BASE = ''

async function j(url) {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`${url} -> ${r.status}`)
  return r.json()
}

export const api = {
  health:        () => j(`${API_BASE}/api/health`),
  latest:        (n = 400, rack = null) =>
    j(`${API_BASE}/api/telemetry/latest?n=${n}${rack ? `&rack=${rack}` : ''}`),
  perRack:       () => j(`${API_BASE}/api/telemetry/per-rack`),
  anomalies:     (n = 50) => j(`${API_BASE}/api/anomalies/recent?n=${n}`),
  forecast:      (horizon_hours = 6) => j(`${API_BASE}/api/forecast?horizon_hours=${horizon_hours}`),
  savings:       (opts = {}) => {
    const qs = new URLSearchParams({
      electricity_usd_per_kwh: opts.tariff ?? 0.12,
      target_pue: opts.targetPue ?? 1.3,
      num_racks_scale: opts.racks ?? 100,
    }).toString()
    return j(`${API_BASE}/api/savings?${qs}`)
  },
}

// Server-Sent Events live stream
export function openStream(onEvent) {
  const es = new EventSource(`${API_BASE}/api/telemetry/stream`)
  es.onmessage = (e) => {
    try { onEvent(JSON.parse(e.data)) } catch {}
  }
  es.onerror = () => { /* auto-reconnect is built into EventSource */ }
  return () => es.close()
}
