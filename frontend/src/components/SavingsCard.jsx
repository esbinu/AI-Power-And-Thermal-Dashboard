import { TrendingUp, Leaf, FileDown } from 'lucide-react'
import { useState } from 'react'

function fmtMoney(n) {
  if (!Number.isFinite(n)) return '$—'
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`
  return `$${Math.round(n)}`
}

function exportCsv(savings) {
  const c = savings.current, s = savings.savings, i = savings.inputs
  const rows = [
    ['metric', 'value'],
    ['avg_power_kw',        c.avg_power_kw],
    ['avg_pue',             c.avg_pue],
    ['scaled_total_kw',     c.scaled_total_kw],
    ['annual_kwh',          c.annual_kwh],
    ['annual_cost_usd',     c.annual_cost_usd],
    ['annual_co2_tonnes',   c.annual_co2_tonnes],
    ['target_pue',          i.target_pue],
    ['num_racks_scale',     i.num_racks_scale],
    ['electricity_usd_per_kwh', i.electricity_usd_per_kwh],
    ['usd_saved_annual',    s.usd_saved_annual],
    ['kwh_saved_annual',    s.kwh_saved_annual],
    ['co2_saved_tonnes_annual', s.co2_saved_tonnes_annual],
  ]
  const csv = rows.map(r => r.join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `aegis-thermal-audit-${new Date().toISOString().slice(0,10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export default function SavingsCard({ savings, onChange }) {
  const [racks, setRacks]   = useState(42)
  const [tariff, setTariff] = useState(0.12)
  const [pue, setPue]       = useState(1.30)

  const emit = (patch) => {
    const next = { racks, tariff, targetPue: pue, ...patch }
    onChange?.(next)
  }

  if (!savings || savings.status !== 'ok') {
    return <div className="card p-6 text-sm text-gray-400">Computing business impact…</div>
  }
  const s = savings.savings
  const c = savings.current

  return (
    <div className="card p-6">
      <div className="grid grid-cols-12 gap-6 items-center">
        {/* Savings + CO2 */}
        <div className="col-span-12 md:col-span-4 flex items-center gap-8">
          <div>
            <div className="kpi-label">ANNUAL SAVINGS</div>
            <div className="mt-1 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-accent-green" />
              <span className="text-[40px] font-semibold text-accent-green leading-none">{fmtMoney(s.usd_saved_annual)}</span>
            </div>
          </div>
          <div>
            <div className="kpi-label">CO₂ AVOIDED</div>
            <div className="mt-1 flex items-center gap-2">
              <Leaf className="w-5 h-5 text-accent-green" />
              <span className="text-[32px] font-semibold text-accent-green leading-none">
                {Math.round(s.co2_saved_tonnes_annual).toLocaleString()}<span className="text-lg text-gray-400">t</span>
              </span>
            </div>
          </div>
        </div>

        {/* Sliders */}
        <div className="col-span-12 md:col-span-5 space-y-4">
          <SliderRow
            label="FACILITY SCALE"
            value={`${racks} RACKS`}
            min={10} max={500} step={1} val={racks}
            onChange={(v) => { setRacks(v); emit({ racks: v }) }}
          />
          <SliderRow
            label="ELEC. COST"
            value={`$${tariff.toFixed(2)}/KWH`}
            min={0.05} max={0.35} step={0.01} val={tariff}
            onChange={(v) => { setTariff(v); emit({ tariff: v }) }}
          />
        </div>

        {/* Investor run rate + Export */}
        <div className="col-span-12 md:col-span-3 flex flex-col items-end">
          <div className="kpi-label">INVESTOR RUN RATE</div>
          <div className="text-[38px] font-semibold text-white leading-none mt-1">{fmtMoney(c.annual_cost_usd)}</div>
          <button
            onClick={() => exportCsv(savings)}
            className="mt-4 inline-flex items-center gap-2 text-xs font-semibold tracking-[0.2em] px-4 py-2 rounded-md bg-accent-cyan text-bg-900 hover:bg-accent-cyan/90 transition"
          >
            <FileDown className="w-3.5 h-3.5" /> EXPORT AUDIT
          </button>
        </div>
      </div>
    </div>
  )
}

function SliderRow({ label, value, min, max, step, val, onChange }) {
  return (
    <div>
      <div className="flex items-center justify-between text-[11px] tracking-wider">
        <span className="text-gray-400">{label}</span>
        <span className="text-gray-200 font-mono">{value}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={val}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full mt-1 accent-accent-cyan"
      />
    </div>
  )
}
