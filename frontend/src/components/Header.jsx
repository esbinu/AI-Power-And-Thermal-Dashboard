import { Bell, Settings, Cpu } from 'lucide-react'
import { useState } from 'react'
import clsx from 'clsx'

const TABS = ['FLEET', 'THERMAL', 'GRID', 'ANALYTICS', 'LOGS']

export default function Header({ health }) {
  const [active, setActive] = useState('FLEET')
  const live = health?.status === 'ok'
  return (
    <header className="flex items-center justify-between px-8 py-4 border-b border-white/5 bg-bg-900/70 backdrop-blur sticky top-0 z-20">
      <div className="flex items-center gap-10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-accent-cyan to-accent-blue flex items-center justify-center shadow-card">
            <Cpu className="w-4 h-4 text-white" />
          </div>
          <div className="leading-tight">
            <h1 className="text-base font-bold tracking-[0.2em] text-accent-cyan">DASHBOARD</h1>
            <p className="text-[10px] text-gray-400 tracking-[0.18em] -mt-0.5 uppercase">AI-Based Thermal and Power Monitor</p>
          </div>
        </div>
        <nav className="hidden md:flex items-center gap-8">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setActive(t)}
              className={clsx(
                'relative text-xs tracking-[0.2em] font-semibold transition-colors py-4',
                active === t ? 'text-accent-cyan' : 'text-gray-400 hover:text-gray-200',
              )}
            >
              {t}
              {active === t && (
                <span className="absolute left-0 right-0 -bottom-px h-[2px] bg-accent-cyan rounded-full" />
              )}
            </button>
          ))}
        </nav>
      </div>
      <div className="flex items-center gap-5 text-sm">
        <div className="flex items-center gap-2 text-gray-300 font-mono text-xs">
          <span className="relative inline-flex w-2 h-2">
            <span className={clsx(
              'absolute inline-flex h-full w-full rounded-full opacity-60 animate-ping',
              live ? 'bg-accent-green' : 'bg-accent-red',
            )} />
            <span className={clsx(
              'relative inline-flex w-2 h-2 rounded-full',
              live ? 'bg-accent-green' : 'bg-accent-red',
            )} />
          </span>
          <span className="text-accent-green font-semibold tracking-wider">LIVE:</span>
          <span className="text-gray-300">{(health?.buffer_rows ?? 0).toLocaleString()} rows buffered</span>
          <span className="text-gray-500">·</span>
          <span className="text-gray-300">model {health?.model_ready ? 'ready' : 'warming'}</span>
        </div>
        <button className="p-2 text-gray-400 hover:text-gray-100 transition" title="Alerts"><Bell className="w-4 h-4" /></button>
        <button className="p-2 text-gray-400 hover:text-gray-100 transition" title="Settings"><Settings className="w-4 h-4" /></button>
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-accent-purple to-accent-blue flex items-center justify-center text-xs font-semibold text-white">
          GK
        </div>
      </div>
    </header>
  )
}
