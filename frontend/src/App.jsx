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
      <Header health={health} />
      <main className="p-6 lg:p-8 space-y-6 max-w-[1400px] mx-auto">
        <KpiRow perRack={perRack} />

        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            <InletZoneChart rows={rows} />
            <AggregateChart rows={rows} field="power_draw_kw" title="Power Draw Optimization" color="#f59e0b" unit="kW" sum />
            <AggregateChart rows={rows} field="cpu_load_pct"  title="CPU Core Utilization"    color="#8b5cf6" unit="%"  />
          </div>
          <AnomalyFeed anomalies={anomalies} />
        </section>

        <section>
          <ForecastPanel forecast={forecast} />
        </section>

        <section>
          <RackGrid perRack={perRack} />
        </section>

        <section>
          <SavingsCard savings={savings} onChange={onSavingsChange} />
        </section>

        <Footer />
      </main>
    </div>
  )
}
