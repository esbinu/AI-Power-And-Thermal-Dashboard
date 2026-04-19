import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  Scatter, ComposedChart, Legend,
} from 'recharts'

function fmtTime(iso) {
  const d = new Date(iso)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

// Average values across a set of rack zones per timestamp
function aggregateByZones(rows, zones, field) {
  // Build per-timestamp bucket across zones of interest
  const bucket = new Map() // ts -> { sum, count, anom }
  rows.forEach((r) => {
    if (!zones.includes(r.rack_zone)) return
    const b = bucket.get(r.timestamp) || { sum: 0, count: 0, anom: 0 }
    b.sum += r[field]
    b.count += 1
    if (r.anomaly_flag || r.model_anomaly_flag) b.anom = 1
    bucket.set(r.timestamp, b)
  })
  return Array.from(bucket.entries())
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([ts, b]) => ({
      t: ts, label: fmtTime(ts),
      v: b.sum / b.count,
      anom: b.anom ? (b.sum / b.count) : null,
    }))
}

function aggregateAll(rows, field) {
  const allZones = Array.from(new Set(rows.map((r) => r.rack_zone)))
  return aggregateByZones(rows, allZones, field)
}

const BASE_TOOLTIP = {
  contentStyle: {
    background: '#0b0f1a',
    border: '1px solid #1f2937',
    borderRadius: 8,
    fontSize: 12,
    color: '#e5e7eb',
  },
  labelStyle: { color: '#9ca3af' },
}

// ---------- Inlet Temperature (Zone A vs Zone B) ----------
export function InletZoneChart({ rows }) {
  const a = aggregateByZones(rows, ['A1', 'A2'], 'inlet_temp_c')
  const b = aggregateByZones(rows, ['B1', 'B2'], 'inlet_temp_c')
  // Merge by timestamp
  const byTs = new Map()
  a.forEach((p) => byTs.set(p.t, { t: p.t, label: p.label, zoneA: p.v, anomA: p.anom }))
  b.forEach((p) => {
    const e = byTs.get(p.t) || { t: p.t, label: p.label }
    e.zoneB = p.v; e.anomB = p.anom
    byTs.set(p.t, e)
  })
  const data = Array.from(byTs.values()).sort((x, y) => x.t.localeCompare(y.t)).slice(-180)

  return (
    <div className="card p-5 h-[240px] flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold tracking-[0.25em] text-gray-200 uppercase">Inlet Temperature Distribution</h3>
        <div className="flex items-center gap-4 text-[11px] text-gray-400">
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-accent-cyan" /> ZONE A</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-accent-blue" /> ZONE B</span>
        </div>
      </div>
      <div className="flex-1">
        <ResponsiveContainer>
          <ComposedChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
            <XAxis dataKey="label" tick={{ fill: '#6b7280', fontSize: 10 }} minTickGap={30} />
            <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} width={36} domain={['auto', 'auto']} />
            <Tooltip {...BASE_TOOLTIP} />
            <Line type="monotone" dataKey="zoneA" stroke="#22d3ee" strokeWidth={2} dot={false} isAnimationActive={false} />
            <Line type="monotone" dataKey="zoneB" stroke="#3b82f6" strokeWidth={2} strokeDasharray="5 4" dot={false} isAnimationActive={false} />
            <Scatter dataKey="anomA" fill="#ef4444" shape="diamond" isAnimationActive={false} />
            <Scatter dataKey="anomB" fill="#ef4444" shape="diamond" isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// ---------- Single-series aggregated chart ----------
export function AggregateChart({ rows, field, title, color, unit, sum = false }) {
  // If sum==true, aggregate across timestamps by summing (e.g., total power).
  let data = aggregateAll(rows, field)
  if (sum) {
    const byTs = new Map()
    rows.forEach((r) => {
      const e = byTs.get(r.timestamp) || { t: r.timestamp, label: fmtTime(r.timestamp), v: 0, anom: 0 }
      e.v += r[field]
      if (r.anomaly_flag || r.model_anomaly_flag) e.anom = e.v
      byTs.set(r.timestamp, e)
    })
    data = Array.from(byTs.values()).sort((a, b) => a.t.localeCompare(b.t))
  }
  data = data.slice(-180)

  return (
    <div className="card p-5 h-[240px] flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold tracking-[0.25em] text-gray-200 uppercase">{title}</h3>
        <span className="text-[11px] text-gray-400 font-mono">{field}{unit ? ` (${unit})` : ''}</span>
      </div>
      <div className="flex-1">
        <ResponsiveContainer>
          <ComposedChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
            <XAxis dataKey="label" tick={{ fill: '#6b7280', fontSize: 10 }} minTickGap={30} />
            <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} width={36} domain={['auto', 'auto']} />
            <Tooltip {...BASE_TOOLTIP} />
            <Line type="monotone" dataKey="v" stroke={color} strokeWidth={2} dot={false} isAnimationActive={false} />
            <Scatter dataKey="anom" fill="#ef4444" shape="diamond" isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
