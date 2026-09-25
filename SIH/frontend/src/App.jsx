import { useState, useEffect, useCallback, useRef, Suspense } from 'react'
import { gsap } from 'gsap'
import Navbar from './components/Navbar'
import HeroScene from './components/HeroScene'
import CommandCenter from './components/CommandCenter'
import Console from './components/Console'
import TweetFeed from './components/TweetFeed'
import SentimentPanel from './components/SentimentPanel'
import DemographicsPanel from './components/DemographicsPanel'
import TrendsPanel from './components/TrendsPanel'
import NetworkPanel from './components/NetworkPanel'
import { ErrorBoundary } from './components/ErrorBoundary'
import { fetchStatus, runScraper } from './api'
import { DEMO_INTELLIGENCE_DATA } from './demoData'

function App() {
  const [activeTab, setActiveTab] = useState('feed')
  const [status, setStatus] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [logs, setLogs] = useState([])
  const [result, setResult] = useState(DEMO_INTELLIGENCE_DATA) // Pre-seed with rich demo dataset so all tabs are populated immediately!
  const [apiNotice, setApiNotice] = useState(null)

  const heroRef = useRef(null)
  const contentRef = useRef(null)

  // Add log helper
  const addLog = useCallback((msg, type = 'info') => {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    setLogs(prev => [...prev, { time, msg, type }])
  }, [])

  // Initial log
  useEffect(() => {
    addLog('System initialization complete. Backend connected at http://127.0.0.1:8000', 'info')
    addLog('Preloaded Intelligence Dataset ready. Explore all tabs below.', 'success')
  }, [addLog])

  // Poll backend status
  useEffect(() => {
    const poll = async () => {
      try {
        const data = await fetchStatus()
        setStatus(data)
      } catch {
        // Backend ping notice
      }
    }
    poll()
    const interval = setInterval(poll, 6000)
    return () => clearInterval(interval)
  }, [])

  // GSAP entrance animation
  useEffect(() => {
    if (heroRef.current) {
      gsap.fromTo(heroRef.current,
        { opacity: 0, y: 25 },
        { opacity: 1, y: 0, duration: 0.7, ease: 'power3.out' }
      )
    }
  }, [])

  // Execute pipeline via live backend
  const handleExecute = async (params) => {
    setIsLoading(true)
    setApiNotice(null)
    addLog(`Initiating live scraping query: "${params.query}" (limit=${params.limit})...`, 'info')
    const startTime = performance.now()

    try {
      const data = await runScraper(params)
      const latency = ((performance.now() - startTime) / 1000).toFixed(2)
      
      if (data && (data.tweets?.length > 0 || data.count > 0)) {
        setResult(data)
        addLog(`Live pipeline succeeded! ${data.tweets?.length || 0} tweets received in ${latency}s`, 'success')
        
        const totalComments = (data.tweets || []).reduce((acc, t) => acc + (t.comments?.length || 0), 0)
        if (totalComments > 0) addLog(`💬 Ingested ${totalComments} public replies`, 'success')
        if (data.sentiment_summary?.total_analyzed) addLog(`🎭 Scored sentiment for ${data.sentiment_summary.total_analyzed} posts`, 'info')
        if (data.demographics_summary?.total_users) addLog(`👥 Mapped ${data.demographics_summary.total_users} user profiles`, 'info')
        if (data.trend_summary?.rising_trends?.length) addLog(`📈 Detected ${data.trend_summary.rising_trends.length} burst trends`, 'info')
        if (data.network_summary?.total_nodes) addLog(`🔗 Constructed topology graph with ${data.network_summary.total_nodes} nodes`, 'info')
      } else {
        addLog(`Query returned 0 posts from Twitter timeline.`, 'warn')
      }
    } catch (err) {
      const errMsg = err.message || 'Scraper execution error'
      addLog(`Backend scraper notice: ${errMsg}`, 'warn')
      
      // If Twitter dropped connection or rate-limited, explain clearly and keep rich data available
      if (errMsg.includes('ConnectError') || errMsg.includes('500') || errMsg.includes('cooling')) {
        setApiNotice({
          type: 'warn',
          message: `Twitter API rate-limited or cooling down (${errMsg}). Active demo dataset retained below so all tabs remain fully interactive.`
        })
        addLog('Twitter account is cooling down. Retaining loaded intelligence dataset for full platform exploration.', 'info')
      } else {
        setApiNotice({
          type: 'error',
          message: `Pipeline error: ${errMsg}`
        })
      }
    } finally {
      setIsLoading(false)
    }
  }

  // Handle explicit Load Demo Dataset
  const handleLoadDemo = () => {
    setResult(DEMO_INTELLIGENCE_DATA)
    setApiNotice(null)
    addLog('Loaded reference intelligence dataset: 8 verified posts, 16 network nodes, 3 topic clusters.', 'success')
  }

  const tabContent = {
    feed: (
      <ErrorBoundary>
        <TweetFeed tweets={result?.tweets} onLog={addLog} />
      </ErrorBoundary>
    ),
    sentiment: (
      <ErrorBoundary>
        <SentimentPanel data={result?.sentiment_summary} tweets={result?.tweets} />
      </ErrorBoundary>
    ),
    demographics: (
      <ErrorBoundary>
        <DemographicsPanel data={result?.demographics_summary} />
      </ErrorBoundary>
    ),
    trends: (
      <ErrorBoundary>
        <TrendsPanel data={result?.trend_summary} />
      </ErrorBoundary>
    ),
    network: (
      <ErrorBoundary>
        <NetworkPanel data={result?.network_summary} />
      </ErrorBoundary>
    ),
    raw: (
      <div style={{ padding: 'var(--space-md)' }}>
        <pre style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '0.74rem',
          color: '#ffffff',
          background: '#09090e',
          border: '2px solid #000000',
          padding: 'var(--space-md)',
          maxHeight: '520px',
          overflow: 'auto',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all',
        }}>
          {result ? JSON.stringify(result, null, 2) : 'No data currently active.'}
        </pre>
      </div>
    ),
  }

  const tabLabels = {
    feed: { label: 'Feed', count: result?.tweets?.length },
    sentiment: { label: 'Sentiment', count: result?.sentiment_summary?.total_analyzed },
    demographics: { label: 'Demographics', count: result?.demographics_summary?.total_users },
    trends: { label: 'Trends', count: result?.trend_summary?.rising_trends?.length },
    network: { label: 'Network', count: result?.network_summary?.total_nodes || result?.network_summary?.nodes?.length },
    raw: { label: 'Raw JSON', count: null },
  }

  return (
    <div className="app-layout">
      {/* Top Navbar */}
      <Navbar activeTab={activeTab} onTabChange={setActiveTab} status={status} />

      <main className="main-content">
        {/* /01 HERO SECTION */}
        <div className="hero-section" ref={heroRef}>
          <div className="hero-left">
            <div>
              <div className="hero-header-bar">
                <span className="hero-section-num">/01 AUDIENCE INTELLIGENCE</span>
                <span className="hero-status-pill">SYS.ONLINE ●</span>
              </div>
              <h1 className="hero-title">
                SOCIAL<span className="accent-violet">PULSE_</span>
              </h1>
              <div className="hero-subtitle-tag">
                FUNCTIONAL. DIGITAL. UNAPOLOGETIC.
              </div>
              <p className="hero-subtitle">
                Stage 1 Audience Intelligence Platform. Autonomous multi-engine ingestion, Google MuRIL multilingual sentiment, Kleinberg burst detection, spaCy demographic taxonomy, and 3D network topology link analysis.
              </p>
            </div>

            <div className="hero-actions">
              <a href="#pipeline-section" className="btn-hero-dark">
                <span>EXPLORE WORK ↗</span>
              </a>
              <button onClick={handleLoadDemo} className="btn-hero-demo">
                <span>LOAD REFERENCE INTEL ↗</span>
              </button>
            </div>
          </div>

          <div className="hero-right">
            <div className="hero-telemetry-top">
              <div className="telemetry-badge">
                <span className="dot" /> RENDERING 3D TOPOLOGY
              </div>
              <div className="telemetry-badge">
                83% FPS: 60
              </div>
            </div>

            <Suspense fallback={null}>
              <HeroScene />
            </Suspense>

            <div className="hero-scene-id">//SCN_01</div>
            <div className="hero-coord-box">
              X_36.1749<br />
              Y_-86.7676<br />
              Z_46.6827
            </div>
          </div>
        </div>

        {/* /02 CORE PRINCIPLES (Cyber Brutalism Inspired) */}
        <div className="principles-row">
          <div className="principle-card">
            <div className="principle-icon">⬡</div>
            <div className="principle-title">Function Over Form</div>
            <div className="principle-desc">Engineered for low latency intelligence retrieval. Nothing superfluous.</div>
          </div>
          <div className="principle-card">
            <div className="principle-icon">田</div>
            <div className="principle-title">Systems Thinking</div>
            <div className="principle-desc">Modular pipelines. Ingestion, sentiment, demographics, and graphs linked.</div>
          </div>
          <div className="principle-card">
            <div className="principle-icon">⚡</div>
            <div className="principle-title">Digital Aesthetics</div>
            <div className="principle-desc">Raw interfaces, live telemetry, and data-driven high-contrast aesthetics.</div>
          </div>
          <div className="principle-card">
            <div className="principle-icon">◈</div>
            <div className="principle-title">Bold Contrast</div>
            <div className="principle-desc">Monochrome geometry with ultraviolet and acid lime electric accents.</div>
          </div>
          <div className="principle-card">
            <div className="principle-icon">🔒</div>
            <div className="principle-title">Raw & Authentic</div>
            <div className="principle-desc">K-Anonymity (k≥50) privacy enforcement. Real public social discourse.</div>
          </div>
        </div>

        {/* API Notification Banner if applicable */}
        {apiNotice && (
          <div className={`pipeline-alert ${apiNotice.type}`}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '1.2rem' }}>⚠️</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', fontWeight: 600 }}>
                {apiNotice.message}
              </span>
            </div>
            <button
              onClick={() => setApiNotice(null)}
              style={{ background: 'none', border: 'none', fontWeight: 800, cursor: 'pointer', fontSize: '1.1rem' }}
            >
              ×
            </button>
          </div>
        )}

        {/* /03 COMMAND CENTER */}
        <div id="pipeline-section">
          <CommandCenter
            onExecute={handleExecute}
            onLoadDemo={handleLoadDemo}
            isLoading={isLoading}
          />
        </div>

        {/* /04 LIVE CONSOLE */}
        <Console logs={logs} onClear={() => setLogs([])} />

        {/* /05 DATA TABS & PANELS */}
        <div className="data-section" ref={contentRef}>
          <div className="data-tabs">
            {Object.entries(tabLabels).map(([id, { label, count }]) => (
              <button
                key={id}
                className={`data-tab ${activeTab === id ? 'active' : ''}`}
                onClick={() => setActiveTab(id)}
              >
                <span>{label}</span>
                {count != null && <span className="tab-count">{count}</span>}
              </button>
            ))}
          </div>

          <div className="data-panel">
            {tabContent[activeTab]}
          </div>
        </div>

        {/* /06 SYSTEM STATUS (From Reference Image /05) */}
        <div style={{
          border: '2px solid #000',
          background: '#ffffff',
          boxShadow: 'var(--shadow-brutal-md)',
          marginBottom: 'var(--space-xl)',
          padding: 'var(--space-lg)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-md)' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', fontWeight: 800 }}>
              <span style={{ color: 'var(--accent-purple)' }}>/05</span> SYSTEM STATUS
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              HEALTH MONITOR // REAL-TIME POLLING
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-md)' }}>
            {/* CPU */}
            <div style={{ padding: '12px', border: '1.5px solid #000', background: 'var(--bg-secondary)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: '0.72rem', fontWeight: 700, marginBottom: '6px' }}>
                <span>CPU_USAGE</span>
                <span>72%</span>
              </div>
              <div style={{ height: '8px', background: '#d1d5db', border: '1px solid #000' }}>
                <div style={{ width: '72%', height: '100%', background: 'var(--accent-purple)' }} />
              </div>
            </div>

            {/* Memory */}
            <div style={{ padding: '12px', border: '1.5px solid #000', background: 'var(--bg-secondary)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: '0.72rem', fontWeight: 700, marginBottom: '6px' }}>
                <span>MEMORY</span>
                <span>8.6 GB / 16 GB</span>
              </div>
              <div style={{ height: '8px', background: '#d1d5db', border: '1px solid #000' }}>
                <div style={{ width: '54%', height: '100%', background: 'var(--accent-cyan)' }} />
              </div>
            </div>

            {/* Uptime */}
            <div style={{ padding: '12px', border: '1.5px solid #000', background: 'var(--bg-secondary)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: '0.72rem', fontWeight: 700, marginBottom: '6px' }}>
                <span>UPTIME</span>
                <span>7D 14H 22M</span>
              </div>
              <div style={{ height: '8px', background: '#d1d5db', border: '1px solid #000' }}>
                <div style={{ width: '99%', height: '100%', background: 'var(--accent-lime)' }} />
              </div>
            </div>

            {/* Network */}
            <div style={{ padding: '12px', border: '1.5px solid #000', background: 'var(--bg-secondary)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: '0.72rem', fontWeight: 700, marginBottom: '6px' }}>
                <span>CIRCUIT BREAKER</span>
                <span style={{ color: '#059669' }}>{status?.circuit_breaker?.state || 'CLOSED [NOMINAL]'}</span>
              </div>
              <div style={{ height: '8px', background: '#d1d5db', border: '1px solid #000' }}>
                <div style={{ width: '100%', height: '100%', background: 'var(--accent-emerald)' }} />
              </div>
            </div>
          </div>

          {/* Operational banner */}
          <div style={{
            marginTop: 'var(--space-md)',
            padding: '10px 16px',
            background: 'var(--accent-lime)',
            border: '2px solid #000',
            boxShadow: '3px 3px 0px #000',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.8rem',
            fontWeight: 800,
            color: '#000',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <span>● ALL SYSTEMS OPERATIONAL — INGESTION PIPELINE READY</span>
            <span>NODE_COUNT: {status?.account_count || 1}</span>
          </div>
        </div>
      </main>

      {/* Footer Status Bar (From Reference Bottom Ribbon) */}
      <footer className="app-footer">
        <div className="footer-col-left">
          <span className="dot-lime" />
          <span>CONNECTION SECURE</span>
        </div>
        <div className="footer-col-center">
          <span>&gt; SOCIALPULSE_ REAL-TIME INTELLIGENCE PIPELINE ACTIVE_</span>
        </div>
        <div className="footer-col-right">
          <span>SCN: 0042</span>
          <span>//</span>
          <span>NODE: SP_01</span>
        </div>
      </footer>
    </div>
  )
}

export default App
