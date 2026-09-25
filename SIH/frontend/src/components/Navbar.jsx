import { useState, useEffect } from 'react'

export default function Navbar({ activeTab, onTabChange, status }) {
  const [time, setTime] = useState(new Date())

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const tabs = [
    { id: 'feed', label: 'Feed' },
    { id: 'sentiment', label: 'Sentiment' },
    { id: 'demographics', label: 'Demographics' },
    { id: 'trends', label: 'Trends' },
    { id: 'network', label: 'Network' },
    { id: 'raw', label: 'Raw JSON' },
  ]

  const isOnline = status?.initialized !== false

  return (
    <>
      {/* Top Telemetry Ticker Ribbon */}
      <div className="top-ticker">
        <div className="ticker-left">
          <span className="ticker-pill">SYS.INTEL</span>
          <span className="ticker-text">
            <span>● PIPELINE: ACTIVE</span>
            <span>/</span>
            <span>MODEL: Google MuRIL + spaCy NER</span>
            <span>/</span>
            <span>PRIVACY: k≥50 K-ANONYMITY</span>
          </span>
        </div>
        <div className="ticker-right">
          <span>PORT: 8000</span>
          <span>//</span>
          <span>LATENCY: 22ms</span>
          <span>//</span>
          <span>CIRCUIT: {status?.circuit_breaker?.state || 'CLOSED'}</span>
        </div>
      </div>

      {/* Main Navbar */}
      <nav className="navbar">
        <a className="navbar-brand" href="/">
          <div className="brand-badge">SP</div>
          <div className="brand-title">
            SOCIALPULSE<span className="brand-accent">_</span>
          </div>
        </a>

        <ul className="navbar-nav">
          {tabs.map(tab => (
            <li key={tab.id}>
              <button
                className={`nav-item ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => onTabChange(tab.id)}
              >
                {tab.label}
              </button>
            </li>
          ))}
        </ul>

        <div className="navbar-status">
          <div className={isOnline ? 'status-badge-lime' : 'status-badge-offline'}>
            <span>●</span>
            <span>{status?.account_count || 1} ACCOUNT{status?.account_count === 1 ? '' : 'S'} POOLED</span>
          </div>

          <div className="clock-display">
            <span>SYS.TIME</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800 }}>
              {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          </div>
        </div>
      </nav>
    </>
  )
}
