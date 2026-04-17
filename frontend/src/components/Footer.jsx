export default function Footer() {
  return (
    <footer className="pt-10 pb-6 text-center">
      <div className="flex items-center justify-center gap-8 text-[11px] font-semibold tracking-[0.25em] text-gray-500 uppercase">
        <a href="#" className="hover:text-gray-300 transition">API Status</a>
        <a href="#" className="hover:text-gray-300 transition">Security Protocol</a>
        <a href="#" className="hover:text-gray-300 transition">Internal Support</a>
      </div>
      <div className="mt-4 text-[11px] text-gray-600 font-mono tracking-[0.18em]">
        DASHBOARD · AI-BASED THERMAL AND POWER MONITOR · DEMO BUILD 2.4.0
      </div>
    </footer>
  )
}
