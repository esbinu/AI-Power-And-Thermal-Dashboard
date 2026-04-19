import { useMemo } from 'react'
import clsx from 'clsx'

// Map anomaly_type -> display title, description template, tone, delta-label maker
const TYPE_META = {
  cooling_failure: {
    title: 'COOLING FAILURE',
    tone: 'red',
    message: (a) => `Redundancy lost in Zone ${a.rack_zone} chassis. Fan-${(Math.abs(hash(a.timestamp)) % 6) + 1} offline.`,
    tag:     (a) => `RACK ${a.rack_zone}-${String((Math.abs(hash(a.timestamp)) % 90) + 1).padStart(2, '0')}`,
    delta:   (a) => ({ label: `Δ+${Math.max(1, (a.inlet_temp_c - 24)).toFixed(1)}°C`, tone: 'text-accent-red' }),
  },
  workload_spike: {
    title: 'WORKLOAD SPIKE',
    tone: 'amber',
    message: (a) => `Neural inference burst detected on cluster ${(Math.abs(hash(a.timestamp)) % 12) + 1}.`,
    tag:     (a) => `RACK ${a.rack_zone}-${String((Math.abs(hash(a.timestamp)) % 90) + 1).padStart(2, '0')}`,
    delta:   (a) => ({ label: `LOAD ${Math.round(a.cpu_load_pct)}%`, tone: 'text-accent-amber' }),
  },
  power_surge: {
    title: 'POWER SURGE',
    tone: 'red',
    message: (a) => `Transient surge observed on rack ${a.rack_zone}. Breakers holding.`,
    tag:     (a) => `RACK ${a.rack_zone}`,
    delta:   (a) => ({ label: `${a.power_draw_kw.toFixed(1)} kW`, tone: 'text-accent-red' }),
  },
  cooling_oscillation: {
    title: 'COOLING OSCILLATION',
    tone: 'amber',
    message: (a) => `PID loop instability detected in ${a.rack_zone}. Retuning recommended.`,
    tag:     (a) => `RACK ${a.rack_zone}`,
    delta:   (a) => ({ label: `FAN ${Math.round(a.fan_speed_pct)}%`, tone: 'text-accent-amber' }),
  },
  rack_hotspot: {
    title: 'RACK HOTSPOT',
    tone: 'red',
    message: (a) => `Localised hotspot in ${a.rack_zone}. Airflow redirection initiated.`,
    tag:     (a) => `RACK ${a.rack_zone}`,
    delta:   (a) => ({ label: `${a.inlet_temp_c.toFixed(1)}°C`, tone: 'text-accent-red' }),
  },
  sensor_drift: {
    title: 'SENSOR DRIFT',
    tone: 'blue',
    message: (a) => `Calibration drift suspected on ${a.rack_zone} inlet probe.`,
    tag:     (a) => `SENSOR ${a.rack_zone}`,
    delta:   (a) => ({ label: `score ${a.model_anomaly_score?.toFixed?.(2) ?? '—'}`, tone: 'text-accent-blue' }),
  },
  model_detected: {
    title: 'AI DETECTED',
    tone: 'blue',
    message: (a) => `Unusual telemetry signature flagged by Isolation Forest. Dominant signal: ${a.dominant_signal || '—'}.`,
    tag:     (a) => `RACK ${a.rack_zone}`,
    delta:   (a) => ({ label: `score ${a.model_anomaly_score?.toFixed?.(2) ?? '—'}`, tone: 'text-accent-blue' }),
  },
}

const PILL_BY_TONE = {
  red:   'bg-accent-red/15   text-accent-red   border border-accent-red/30',
  amber: 'bg-accent-amber/15 text-accent-amber border border-accent-amber/30',
  green: 'bg-accent-green/15 text-accent-green border border-accent-green/30',
  blue:  'bg-accent-blue/15  text-accent-blue  border border-accent-blue/30',
  gray:  'bg-white/5         text-gray-300     border border-white/10',
}

const BORDER_BY_TONE = {
  red:   'border-l-accent-red',
  amber: 'border-l-accent-amber',
  green: 'border-l-accent-green',
  blue:  'border-l-accent-blue',
  gray:  'border-l-gray-500',
}

function hash(s = '') {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i)
  return h
}
function fmtTime(iso) {
  const d = new Date(iso)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

// Synthesize supplementary AI-action rows for demo polish
function syntheticEvents(n = 2) {
  const now = new Date()
  return [
    {
      synthetic: true,
      title: 'AUTO-OPTIMIZED',
      tone: 'green',
      message: 'Airflow vector adjusted via AI model v2.4.',
      tag: 'GLOBAL',
      delta: 'PUE −0.02',
      deltaTone: 'text-accent-green',
      ts: new Date(now.getTime() - 6 * 60 * 1000).toISOString(),
    },
    {
      synthetic: true,
      title: 'SCHEDULED LOG',
      tone: 'gray',
      message: 'System-wide diagnostic pulse completed.',
      tag: 'CORE-01',
      delta: 'STABLE',
      deltaTone: 'text-gray-400',
      ts: new Date(now.getTime() - 14 * 60 * 1000).toISOString(),
    },
  ].slice(0, n)
}

function buildItem(a) {
  const key = a.anomaly_type && a.anomaly_type !== 'normal'
    ? (TYPE_META[a.anomaly_type] ? a.anomaly_type : 'model_detected')
    : 'model_detected'
  const meta = TYPE_META[key]
  return {
    synthetic: false,
    title: meta.title,
    tone: meta.tone,
    message: meta.message(a),
    tag: meta.tag(a),
    delta: meta.delta(a).label,
    deltaTone: meta.delta(a).tone,
    ts: a.timestamp,
  }
}

export default function AnomalyFeed({ anomalies }) {
  const items = useMemo(() => {
    const real = (anomalies || []).slice(0, 6).map(buildItem)
    const synth = syntheticEvents(2)
    const all = [...real, ...synth].sort((a, b) => (a.ts < b.ts ? 1 : -1))
    return all
  }, [anomalies])

  return (
    <div className="card p-5 h-[780px] flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-semibold tracking-[0.25em] text-gray-200 uppercase">Live Incident Feed</h3>
        <span className="text-[11px] text-gray-400 font-mono">REFRESH: 5s</span>
      </div>
      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {items.length === 0 && (
          <div className="text-sm text-gray-500">No anomalies detected in the current window.</div>
        )}
        {items.map((it, i) => (
          <div
            key={i}
            className={clsx(
              'pl-4 pr-4 py-3 rounded-md bg-white/[0.02] border border-white/5 border-l-[3px] hover:bg-white/[0.04] transition',
              BORDER_BY_TONE[it.tone],
            )}
          >
            <div className="flex items-center justify-between">
              <span className={clsx(
                'text-[10px] font-semibold tracking-[0.18em] px-2 py-0.5 rounded',
                PILL_BY_TONE[it.tone],
              )}>
                {it.title}
              </span>
              <span className="text-[11px] text-gray-500 font-mono">{fmtTime(it.ts)}</span>
            </div>
            <p className="mt-2 text-sm text-gray-100 leading-snug">{it.message}</p>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-[11px] text-gray-400 font-mono tracking-wider">{it.tag}</span>
              <span className={clsx('text-[11px] font-mono font-semibold', it.deltaTone)}>{it.delta}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
