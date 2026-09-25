import { useState, useRef, useEffect } from 'react'
import { gsap } from 'gsap'

export default function CommandCenter({ onExecute, onLoadDemo, isLoading }) {
  const [query, setQuery] = useState('Artificial Intelligence')
  const [limit, setLimit] = useState(10)
  const [timeMode, setTimeMode] = useState('latest')
  const [hoursAgo, setHoursAgo] = useState(0.5)
  const [since, setSince] = useState('')
  const [until, setUntil] = useState('')
  const [scrapeComments, setScrapeComments] = useState(false)
  const [commentsLimit, setCommentsLimit] = useState(10)
  const [engines, setEngines] = useState({
    sentiment: true,
    demographics: true,
    trends: true,
    network: true,
  })

  const formRef = useRef(null)

  useEffect(() => {
    if (formRef.current) {
      gsap.fromTo(formRef.current, { opacity: 0, y: 15 }, { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out' })
    }
  }, [])

  const toggleEngine = (key) => {
    setEngines(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!query.trim()) return
    onExecute({
      query: query.trim(),
      limit,
      timeMode,
      hoursAgo,
      since,
      until,
      scrapeComments,
      commentsLimit,
      ...engines,
    })
  }

  const engineList = [
    { key: 'sentiment', icon: '🎭', label: 'Sentiment (MuRIL)', styleKey: 'sentiment' },
    { key: 'demographics', icon: '👥', label: 'Demographics (spaCy)', styleKey: 'demographics' },
    { key: 'trends', icon: '📈', label: 'Trends (Kleinberg)', styleKey: 'trends' },
    { key: 'network', icon: '🔗', label: 'Network (Topology)', styleKey: 'network' },
    { key: 'scrapeComments', icon: '💬', label: 'Replies / Comments', styleKey: 'comments', isComment: true },
  ]

  return (
    <div className="command-section" ref={formRef}>
      <div className="command-header">
        <div className="command-header-left">
          <span className="command-num">/02</span>
          <h3>Pipeline Command Center</h3>
        </div>
        <div className="command-mode-pills">
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
            TARGET BACKEND: HTTP://127.0.0.1:8000
          </span>
        </div>
      </div>

      <form className="command-body" onSubmit={handleSubmit}>
        <div className="form-grid">
          {/* Query input */}
          <div className="form-group col-span-2">
            <label className="form-label">
              <span>Target Search Query</span>
              <span className="form-label-hint">Keyword, #hashtag, or @handle</span>
            </label>
            <input
              className="form-input"
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="e.g. AI, #TechPolicy, OpenAI, ElonMusk..."
              required
            />
          </div>

          {/* Volume */}
          <div className="form-group">
            <label className="form-label">
              <span>Volume Limit</span>
              <span className="form-label-hint">Max Posts</span>
            </label>
            <select className="form-select" value={limit} onChange={e => setLimit(Number(e.target.value))}>
              <option value={5}>5 posts (Ultra-fast)</option>
              <option value={10}>10 posts (Recommended)</option>
              <option value={20}>20 posts (In-depth)</option>
              <option value={50}>50 posts (Comprehensive)</option>
            </select>
          </div>

          {/* Time Window Mode */}
          <div className="form-group">
            <label className="form-label">Time Window Mode</label>
            <select className="form-select" value={timeMode} onChange={e => setTimeMode(e.target.value)}>
              <option value="latest">Latest Ingestion</option>
              <option value="from_hours_ago">From X Hours Ago to Now</option>
              <option value="older_than_hours">Historical (Older Than X Hours)</option>
              <option value="by_date">Date Range Filter</option>
            </select>
          </div>

          {(timeMode === 'from_hours_ago' || timeMode === 'older_than_hours') && (
            <div className="form-group">
              <label className="form-label">Hours Offset</label>
              <input
                className="form-input"
                type="number"
                value={hoursAgo}
                onChange={e => setHoursAgo(parseFloat(e.target.value))}
                min={0.1}
                max={168}
                step={0.1}
              />
            </div>
          )}

          {timeMode === 'by_date' && (
            <>
              <div className="form-group">
                <label className="form-label">Since Date</label>
                <input className="form-input" type="date" value={since} onChange={e => setSince(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Until Date</label>
                <input className="form-input" type="date" value={until} onChange={e => setUntil(e.target.value)} />
              </div>
            </>
          )}

          {scrapeComments && (
            <div className="form-group">
              <label className="form-label">Max Replies / Post</label>
              <select className="form-select" value={commentsLimit} onChange={e => setCommentsLimit(Number(e.target.value))}>
                <option value={5}>5 replies</option>
                <option value={10}>10 replies</option>
                <option value={20}>20 replies</option>
              </select>
            </div>
          )}

          {/* Intelligence Engine Toggles */}
          <div className="form-group col-span-3">
            <label className="form-label">
              <span>Active Inference Engines</span>
              <span className="form-label-hint">Toggle to configure analysis pipeline</span>
            </label>
            <div className="engine-toggles">
              {engineList.map(eng => {
                const isActive = eng.isComment ? scrapeComments : engines[eng.key]
                return (
                  <button
                    key={eng.key}
                    type="button"
                    className={`engine-toggle ${eng.styleKey} ${isActive ? 'active' : ''}`}
                    onClick={() => eng.isComment ? setScrapeComments(!scrapeComments) : toggleEngine(eng.key)}
                  >
                    <span className="toggle-icon">{eng.icon}</span>
                    <span>{eng.label}</span>
                    <span style={{ fontSize: '0.62rem', marginLeft: '4px', opacity: 0.8 }}>
                      {isActive ? '● ON' : '○ OFF'}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Dual Actions: Execute Live or Load Demo Intelligence */}
        <div className="command-actions">
          <button
            className={`btn-execute ${isLoading ? 'loading' : ''}`}
            type="submit"
            disabled={isLoading || !query.trim()}
          >
            <span className="spinner" />
            <span>{isLoading ? 'Executing Intelligence Pipeline...' : 'Execute Live Intelligence Pipeline ↗'}</span>
          </button>

          <button
            type="button"
            className="btn-load-demo"
            onClick={onLoadDemo}
            disabled={isLoading}
          >
            <span>⚡ Load Demo Intelligence Dataset</span>
          </button>
        </div>
      </form>
    </div>
  )
}
