import clsx from 'clsx'

function statusFor(r) {
  if (r.model_anomaly_flag === 1 || r.anomaly_flag === 1) return 'anomaly'
  if (r.inlet_temp_c > 27 || r.pue > 1.55)               return 'warn'
  return 'healthy'
}

const LABEL = {
  healthy: 'HEALTHY',
  warn: 'WARN',
  anomaly: 'ANOMALY',
}
const TONE_BG = {
  healthy: 'border-accent-green/40 shadow-[0_0_0_1px_rgba(16,185,129,0.15)]',
  warn:    'border-accent-amber/50 shadow-[0_0_0_1px_rgba(245,158,11,0.15)]',
  anomaly: 'border-accent-red/50   shadow-[0_0_0_1px_rgba(239,68,68,0.20)]',
}
const PILL = {
  healthy: 'bg-accent-green/15 text-accent-green border border-accent-green/30',
  warn:    'bg-accent-amber/15 text-accent-amber border border-accent-amber/30',
  anomaly: 'bg-accent-red/15   text-accent-red   border border-accent-red/30',
}
const VAL_COLOR = {
  healthy: 'text-white',
  warn:    'text-accent-amber',
  anomaly: 'text-accent-red',
}

function humanizeIncident(t) {
  if (!t || t === 'normal') return null
  return '⚠ ' + t.replaceAll('_', ' ').toUpperCase() + ' DETECTED'
}

export default function RackGrid({ perRack }) {
  const zones = Object.keys(perRack || {}).sort()
  if (!zones.length) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[0,1,2,3].map((i) => (
          <div key={i} className="card h-[180px] animate-pulse" />
        ))}
      </div>
    )
  }
  return (
    <>
      <h2 className="text-xs font-semibold tracking-[0.3em] text-gray-300 uppercase mb-3">Live Rack Infrastructure</h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {zones.map((z) => {
          const r = perRack[z]
          const st = statusFor(r)
          const inletAccent = r.inlet_temp_c > 27 ? 'text-accent-red' : r.inlet_temp_c > 24.5 ? 'text-accent-amber' : 'text-white'
          return (
            <div key={z} className={clsx('card p-5 border rounded-xl', TONE_BG[st])}>
              <div className="flex items-start justify-between">
                <h3 className="text-lg font-semibold text-white tracking-tight">Rack Zone {z}</h3>
                <span className={clsx('text-[10px] font-semibold tracking-[0.18em] px-2 py-0.5 rounded', PILL[st])}>
                  {LABEL[st]}
                </span>
              </div>
              <div className="mt-4 space-y-2.5 text-sm">
                <Row label="INLET TEMP" value={`${r.inlet_temp_c.toFixed(1)}°C`} valueClass={inletAccent} />
                <Row label="POWER"      value={`${r.power_draw_kw.toFixed(1)} kW`} />
                <Row label="PUE"        value={r.pue.toFixed(2)} />
              </div>
              {st === 'anomaly' && (
                <div className="mt-4 pt-3 border-t border-white/5 text-[11px] font-semibold tracking-[0.15em] text-accent-red">
                  {humanizeIncident(r.anomaly_type) || '⚠ ANOMALY DETECTED'}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </>
  )
}

function Row({ label, value, valueClass = 'text-white' }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[11px] text-gray-400 tracking-wider">{label}</span>
      <span className={clsx('font-mono text-base', valueClass)}>{value}</span>
    </div>
  )
}
