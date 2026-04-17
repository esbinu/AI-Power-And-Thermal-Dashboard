import { Thermometer, Zap, Cpu, Gauge, Fan, Droplets } from 'lucide-react'

function caption(key, value) {
  // Context-aware sub-captions that change with value
  switch (key) {
    case 'inlet':
      if (value > 27) return { text: 'Above baseline', tone: 'text-accent-red' }
      if (value > 25) return { text: 'Running warm',   tone: 'text-accent-amber' }
      return { text: `${value > 23 ? '+' : ''}${(value - 23).toFixed(1)}° from baseline`, tone: 'text-gray-400' }
    case 'power':
      if (value > 60) return { text: 'Peak demand window',    tone: 'text-accent-amber' }
      if (value > 40) return { text: 'Optimal operating range', tone: 'text-gray-400' }
      return { text: 'Low-utilisation window', tone: 'text-gray-400' }
    case 'cpu':
      if (value > 80) return { text: 'Critical saturation', tone: 'text-accent-red' }
      if (value > 65) return { text: 'High density tasking', tone: 'text-gray-400' }
      if (value > 40) return { text: 'Steady workload',      tone: 'text-gray-400' }
      return { text: 'Idle capacity available',  tone: 'text-gray-400' }
    case 'pue':
      if (value > 1.55) return { text: 'Inefficient', tone: 'text-accent-red' }
      if (value > 1.40) return { text: 'Target 1.30 (Improving)', tone: 'text-accent-amber' }
      return { text: 'Target 1.30 (Efficient)', tone: 'text-accent-green' }
    case 'fan':
      if (value > 80) return { text: 'Aggressive cooling', tone: 'text-accent-amber' }
      if (value > 50) return { text: 'Active regulation',  tone: 'text-gray-400' }
      return { text: 'Manual override disabled', tone: 'text-gray-400' }
    case 'cooling':
      if (value > 92) return { text: 'Peak thermal recovery', tone: 'text-accent-green' }
      if (value > 80) return { text: 'Nominal recovery',       tone: 'text-gray-400' }
      return { text: 'Degraded — investigate', tone: 'text-accent-red' }
  }
  return { text: '', tone: 'text-gray-400' }
}

function Kpi({ icon: Icon, label, value, unit, sub }) {
  return (
    <div className="card p-5 flex flex-col">
      <div className="flex items-center gap-2 text-gray-400">
        <Icon className="w-3.5 h-3.5" />
        <span className="kpi-label">{label}</span>
      </div>
      <div className="mt-3 flex items-baseline">
        <span className="text-[34px] font-semibold tracking-tight text-white leading-none">{value}</span>
        {unit && <span className="text-sm text-gray-400 ml-1">{unit}</span>}
      </div>
      <div className={`mt-2 text-xs ${sub.tone}`}>{sub.text}</div>
    </div>
  )
}

export default function KpiRow({ perRack }) {
  const values = Object.values(perRack || {})
  if (!values.length) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="card p-5 h-[130px] animate-pulse" />
        ))}
      </div>
    )
  }
  const avg = (k) => values.reduce((s, r) => s + r[k], 0) / values.length
  const total = (k) => values.reduce((s, r) => s + r[k], 0)

  const inlet   = avg('inlet_temp_c')
  const power   = total('power_draw_kw')
  const cpu     = avg('cpu_load_pct')
  const pue     = avg('pue')
  const fan     = avg('fan_speed_pct')
  const cooling = avg('cooling_efficiency_pct')

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      <Kpi icon={Thermometer} label="AVG INLET TEMP"  value={inlet.toFixed(1)}   unit="°C" sub={caption('inlet', inlet)} />
      <Kpi icon={Zap}         label="TOTAL POWER"     value={Math.round(power)}  unit="kW" sub={caption('power', power)} />
      <Kpi icon={Cpu}         label="AVG CPU LOAD"    value={cpu.toFixed(1)}     unit="%"  sub={caption('cpu', cpu)} />
      <Kpi icon={Gauge}       label="AVG PUE"         value={pue.toFixed(2)}     unit=""   sub={caption('pue', pue)} />
      <Kpi icon={Fan}         label="AVG FAN SPEED"   value={Math.round(fan)}    unit="%"  sub={caption('fan', fan)} />
      <Kpi icon={Droplets}    label="COOLING EFF."    value={cooling.toFixed(1)} unit="%"  sub={caption('cooling', cooling)} />
    </div>
  )
}
