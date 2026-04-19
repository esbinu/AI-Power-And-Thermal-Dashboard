import { useEffect, useRef, useState } from 'react'
import { api, openStream } from './api'
import Header from './components/Header.jsx'
import KpiRow from './components/KpiRow.jsx'
import RackGrid from './components/RackGrid.jsx'
import { InletZoneChart, AggregateChart } from './components/TelemetryChart.jsx'
import AnomalyFeed from './components/AnomalyFeed.jsx'
import ForecastPanel from './components/ForecastPanel.jsx'
import SavingsCard from './components/SavingsCard.jsx'
import Footer from './components/Footer.jsx'

export default function App() {
  const [health, setHealth]     = useState(null)
  const [rows, setRows]         = useState([])
  const [perRack, setPerRack]   = useState({})
  const [anomalies, setAnom]    = useState([])
  const [forecast, setForecast] = useState(null)
  const [savings, setSavings]   = useState(null)
  const [activeTab, setActiveTab] = useState('FLEET')
  const savingsOptsRef = useRef({ racks: 42, tariff: 0.12, targetPue: 1.30 })

  const loadAll = async () => {
    try {
      const [h, latest, per, anom, fc, sv] = await Promise.all([
        api.health(),
        api.latest(400),
        api.perRack(),
        api.anomalies(30),
        api.forecast(6),
        api.savings(savingsOptsRef.current),
      ])
      setHealth(h)
      setRows(latest.rows)
      setPerRack(per)
      setAnom(anom.anomalies)
      setForecast(fc)
      setSavings(sv)
    } catch (err) {
      console.error(err)
    }
  }

  useEffect(() => {
    loadAll()
    const stream = openStream((payload) => {
      if (payload?.readings?.length) {
        setPerRack((prev) => {
          const next = { ...prev }
          payload.readings.forEach((r) => { next[r.rack_zone] = r })
          return next
        })
      }
    })
    const fast = setInterval(async () => {
      try {
        const [latest, per] = await Promise.all([api.latest(400), api.perRack()])
        setRows(latest.rows); setPerRack(per)
      } catch {}
    }, 4000)
    const slow = setInterval(async () => {
      try {
        const [h, anom, fc, sv] = await Promise.all([
          api.health(), api.anomalies(30), api.forecast(6), api.savings(savingsOptsRef.current),
        ])
        setHealth(h); setAnom(anom.anomalies); setForecast(fc); setSavings(sv)
      } catch {}
    }, 15000)
    return () => { stream(); clearInterval(fast); clearInterval(slow) }
  }, [])

  const onSavingsChange = async (opts) => {
    savingsOptsRef.current = { ...savingsOptsRef.current, ...opts }
    try {
      const sv = await api.savings(savingsOptsRef.current)
      setSavings(sv)
    } catch {}
  }

  return (
    <div className="min-h-screen ops-grid">
      <Header health={health} activeTab={activeTab} onTabChange={setActiveTab} />
      <main className="p-6 lg:p-8 space-y-6 max-w-[1400px] mx-auto">
        <KpiRow perRack={perRack} />

        {activeTab === 'FLEET' && (
          <>
            <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 space-y-4">
                <InletZoneChart rows={rows} />
                <AggregateChart rows={rows} field="power_draw_kw" title="Power Draw Optimization" color="#f59e0b" unit="kW" sum />
                <AggregateChart rows={rows} field="cpu_load_pct"  title="CPU Core Utilization"    color="#8b5cf6" unit="%"  />
              </div>
              <AnomalyFeed anomalies={anomalies} />
            </section>
            <section><ForecastPanel forecast={forecast} /></section>
            <section><RackGrid perRack={perRack} /></section>
            <section><SavingsCard savings={savings} onChange={onSavingsChange} /></section>
          </>
        )}

        {activeTab === 'THERMAL' && (
          <>
            <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 space-y-4">
                <InletZoneChart rows={rows} />
                <AggregateChart rows={rows} field="outlet_temp_c" title="Outlet Temperature (Hot Aisle)" color="#ef4444" unit="°C" />
              </div>
              <AnomalyFeed anomalies={anomalies} />
            </section>
            <section><RackGrid perRack={perRack} /></section>
          </>
        )}

        {activeTab === 'GRID' && (
          <>
            <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 space-y-4">
                <AggregateChart rows={rows} field="power_draw_kw" title="Power Draw Optimization" color="#f59e0b" unit="kW" sum />
                <AggregateChart rows={rows} field="cpu_load_pct"  title="CPU Core Utilization"    color="#8b5cf6" unit="%"  />
              </div>
              <AnomalyFeed anomalies={anomalies} />
            </section>
            <section><ForecastPanel forecast={forecast} /></section>
            <section><SavingsCard savings={savings} onChange={onSavingsChange} /></section>
          </>
        )}

        {activeTab === 'ANALYTICS' && (
          <>
            <section><ForecastPanel forecast={forecast} /></section>
            <section><SavingsCard savings={savings} onChange={onSavingsChange} /></section>
            <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <InletZoneChart rows={rows} />
              <AggregateChart rows={rows} field="power_draw_kw" title="Power Draw Optimization" color="#f59e0b" unit="kW" sum />
            </section>
          </>
        )}

        {activeTab === 'LOGS' && (
          <>
            <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2">
                <TelemetryLogTable rows={rows} />
              </div>
              <AnomalyFeed anomalies={anomalies} />
            </section>
          </>
        )}

        <Footer />
      </main>
    </div>
  )
}

function TelemetryLogTable({ rows }) {
  const recent = (rows || []).slice(-60).reverse()
  return (
    <div className="card p-5 h-[780px] flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-semibold tracking-[0.25em] text-gray-200 uppercase">Telemetry Log Stream</h3>
        <span className="text-[11px] text-gray-400 font-mono">LAST {recent.length} ROWS</span>
      </div>
      <div className="flex-1 overflow-y-auto">
        <table className="w-full text-xs font-mono">
          <thead className="text-[10px] tracking-[0.18em] text-gray-500 uppercase sticky top-0 bg-bg-900/90 backdrop-blur">
            <tr>
              <th className="text-left py-2 pr-3">Time</th>
              <th className="text-left py-2 pr-3">Zone</th>
              <th className="text-right py-2 pr-3">Inlet °C</th>
              <th className="text-right py-2 pr-3">Outlet °C</th>
              <th className="text-right py-2 pr-3">kW</th>
              <th className="text-right py-2 pr-3">CPU %</th>
              <th className="text-right py-2 pr-3">PUE</th>
              <th className="text-right py-2">Flag</th>
            </tr>
          </thead>
          <tbody>
            {recent.map((r, i) => {
              const anom = r.model_anomaly_flag === 1 || r.anomaly_flag === 1
              const time = new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
              return (
                <tr key={i} className="border-t border-white/5 hover:bg-white/[0.02]">
                  <td className="py-1.5 pr-3 text-gray-400">{time}</td>
                  <td className="py-1.5 pr-3 text-gray-200">{r.rack_zone}</td>
                  <td className="py-1.5 pr-3 text-right text-gray-100">{r.inlet_temp_c?.toFixed(1)}</td>
                  <td className="py-1.5 pr-3 text-right text-gray-300">{r.outlet_temp_c?.toFixed(1)}</td>
                  <td className="py-1.5 pr-3 text-right text-accent-amber">{r.power_draw_kw?.toFixed(1)}</td>
                  <td className="py-1.5 pr-3 text-right text-accent-purple">{r.cpu_load_pct?.toFixed(0)}</td>
                  <td className="py-1.5 pr-3 text-right text-gray-200">{r.pue?.toFixed(2)}</td>
                  <td className="py-1.5 text-right">
                    {anom
                      ? <span className="px-1.5 py-0.5 rounded bg-accent-red/15 text-accent-red border border-accent-red/30 text-[10px]">ANOM</span>
                      : <span className="px-1.5 py-0.5 rounded bg-accent-green/10 text-accent-green border border-accent-green/20 text-[10px]">OK</span>}
                  </td>
                </tr>
              )
            })}
            {recent.length === 0 && (
              <tr><td colSpan={8} className="py-6 text-center text-gray-500">Waiting for telemetry…</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
