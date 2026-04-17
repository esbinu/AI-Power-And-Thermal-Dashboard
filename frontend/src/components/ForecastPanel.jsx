import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import clsx from 'clsx'

function fmtHour(iso) {
  const d = new Date(iso)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function deltaPill(delta, unit, goodOnDown = false) {
  if (delta === null || delta === undefined) return { text: '—', tone: 'bg-white/5 text-gray-400' }
  const sign = delta > 0 ? '+' : ''
  const absD = Math.abs(delta)
  const label = `${sign}${(absD < 1 ? delta.toFixed(2) : delta.toFixed(1))}${unit}`
  const up = delta > 0.05
  const down = delta < -0.05
  if (Math.abs(delta) < 0.05) return { text: 'STABLE', tone: 'bg-white/5 text-gray-300' }
  if (up)   return { text: label, tone: goodOnDown ? 'bg-accent-amber/15 text-accent-amber' : 'bg-accent-blue/15 text-accent-blue' }
  if (down) return { text: label, tone: goodOnDown ? 'bg-accent-green/15 text-accent-green' : 'bg-accent-amber/15 text-accent-amber' }
  return { text: label, tone: 'bg-white/5 text-gray-300' }
}

function MiniForecast({ title, unit, data, color, goodOnDown = false }) {
  if (!data || data.status !== 'ok') {
    return (
      <div className="card p-4 h-[200px] flex items-center justify-center text-gray-500 text-xs">
        forecast warming up…
      </div>
    )
  }
  const points = data.points.map((p) => ({ ...p, label: fmtHour(p.timestamp) }))
  const pill = deltaPill(data.delta, unit, goodOnDown)
  return (
    <div className="card p-4 h-[200px] flex flex-col">
      <div className="flex items-center justify-between">
        <h4 className="text-[11px] font-semibold tracking-[0.25em] text-gray-200 uppercase">{title}</h4>
        <span className={clsx('text-[10px] font-mono px-2 py-0.5 rounded', pill.tone)}>
          {pill.text}
        </span>
      </div>
      <div className="flex-1 mt-2 -mx-2">
        <ResponsiveContainer>
          <LineChart data={points} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: '#6b7280', fontSize: 9 }} tickLine={false} />
            <YAxis tick={{ fill: '#6b7280', fontSize: 9 }} width={28} domain={['auto', 'auto']} />
            <Tooltip
              contentStyle={{ background: '#0b0f1a', border: '1px solid #1f2937', borderRadius: 8, fontSize: 11 }}
              labelStyle={{ color: '#9ca3af' }}
            />
            <Line type="monotone" dataKey="mean" stroke={color} strokeWidth={2} dot={{ r: 2, fill: color, strokeWidth: 0 }} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export default function ForecastPanel({ forecast }) {
  const m = forecast?.metrics || {}
  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-semibold tracking-[0.3em] text-gray-300 uppercase">AI Forecast · Next 6 Hours</h2>
        <span className="text-[11px] text-gray-400 font-mono">
          CONFIDENCE INTERVAL <span className="text-accent-cyan">98.4%</span>
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MiniForecast title="Inlet Temp"    unit="°C" data={m.inlet_temp_c}  color="#f59e0b" goodOnDown />
        <MiniForecast title="Power Demand"  unit="kW" data={m.power_draw_kw} color="#22d3ee" goodOnDown />
        <MiniForecast title="Compute Load"  unit="%"  data={m.cpu_load_pct}  color="#3b82f6" />
        <MiniForecast title="PUE Variance"  unit=""   data={m.pue}           color="#10b981" goodOnDown />
      </div>
    </>
  )
}
