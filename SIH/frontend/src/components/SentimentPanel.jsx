import React from 'react'

function DistBar({ label, count, percentage, color = 'purple' }) {
  const pct = Math.min(100, Math.max(0, percentage || 0))
  return (
    <div className="dist-row">
      <span className="dist-label">{label}</span>
      <div className="dist-bar-bg">
        <div className={`dist-bar-fill ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="dist-val">
        {count != null ? count : ''} ({pct.toFixed(1)}%)
      </span>
    </div>
  )
}

export default function SentimentPanel({ data, tweets }) {
  if (!data || !data.total_analyzed) {
    return (
      <div className="empty-state">
        <div className="empty-icon">🎭</div>
        <h4>No Sentiment Intelligence Available</h4>
        <p>Execute the pipeline with Sentiment Engine enabled or load the Demo Intelligence Dataset to inspect the Google MuRIL & Emotion results.</p>
      </div>
    )
  }

  // Safely extract sentiment mix
  const rawMix = data.sentiment_mix || data.label_distribution || {}
  const total = Number(data.total_analyzed) || 1

  const extractMix = (key) => {
    const val = rawMix[key]
    if (val == null) return { count: 0, percentage: 0 }
    if (typeof val === 'object') {
      return { count: val.count ?? 0, percentage: val.percentage ?? ((val.count / total) * 100) }
    }
    return { count: val, percentage: (val / total) * 100 }
  }

  const pos = extractMix('positive')
  const neu = extractMix('neutral')
  const neg = extractMix('negative')

  // Dominant sentiment
  let dominant = 'Neutral'
  if (pos.count > neu.count && pos.count > neg.count) dominant = 'Positive'
  else if (neg.count > pos.count && neg.count > neu.count) dominant = 'Negative'

  // Emotion mix
  const rawEmotions = data.emotion_mix || data.top_emotions || {}
  const emotionEntries = Array.isArray(rawEmotions)
    ? rawEmotions.map(e => ({
        label: e.emotion || e.label || e[0] || 'Unknown',
        count: e.count || e[1] || 0,
        percentage: e.percentage ?? (((e.count || e[1] || 0) / total) * 100),
      }))
    : Object.entries(rawEmotions).map(([k, v]) => ({
        label: k,
        count: typeof v === 'object' ? v.count : v,
        percentage: typeof v === 'object' ? v.percentage : ((v / total) * 100),
      }))

  emotionEntries.sort((a, b) => b.count - a.count)

  const sarcasmPct = data.avg_sarcasm_probability 
    ? (data.avg_sarcasm_probability * 100).toFixed(1) 
    : '0.0'

  return (
    <div>
      {/* Top Stats Banner */}
      <div className="stats-banner">
        <div className="stat-item">
          <span className="stat-label">Total Analyzed</span>
          <span className="stat-value">{total}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Dominant Tone</span>
          <span className={`stat-value ${dominant === 'Positive' ? 'accent-lime' : dominant === 'Negative' ? 'accent-rose' : ''}`}>
            {dominant}
          </span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Positive Ratio</span>
          <span className="stat-value accent-emerald">{pos.percentage.toFixed(1)}%</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Sarcasm Probability</span>
          <span className="stat-value accent-purple">{sarcasmPct}%</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Model Engine</span>
          <span className="stat-value" style={{ fontSize: '1rem', color: 'var(--accent-purple)' }}>
            Google MuRIL
          </span>
        </div>
      </div>

      {/* Main Grid */}
      <div className="intel-grid">
        {/* Sentiment Distribution */}
        <div className="intel-card">
          <div className="intel-card-header">
            <span>/01 Sentiment Polarity Mix</span>
            <span style={{ color: 'var(--accent-purple)' }}>Ensemble Classifier</span>
          </div>
          <div className="intel-card-body">
            <div className="dist-list">
              <DistBar label="Positive" count={pos.count} percentage={pos.percentage} color="lime" />
              <DistBar label="Neutral" count={neu.count} percentage={neu.percentage} color="cyan" />
              <DistBar label="Negative" count={neg.count} percentage={neg.percentage} color="rose" />
            </div>

            {/* Visual ratio strip */}
            <div style={{ marginTop: '20px', border: '1.5px solid #000', height: '24px', display: 'flex', overflow: 'hidden' }}>
              <div style={{ width: `${pos.percentage}%`, background: 'var(--accent-lime)', title: 'Positive' }} />
              <div style={{ width: `${neu.percentage}%`, background: 'var(--accent-cyan)', title: 'Neutral' }} />
              <div style={{ width: `${neg.percentage}%`, background: 'var(--accent-rose)', title: 'Negative' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '0.68rem', fontFamily: 'var(--font-mono)' }}>
              <span>● Positive: {pos.percentage.toFixed(0)}%</span>
              <span>● Neutral: {neu.percentage.toFixed(0)}%</span>
              <span>● Negative: {neg.percentage.toFixed(0)}%</span>
            </div>
          </div>
        </div>

        {/* Emotion Nuances */}
        <div className="intel-card">
          <div className="intel-card-header">
            <span>/02 Nuanced Emotion Breakdown</span>
            <span style={{ color: 'var(--accent-purple)' }}>Multi-Class Latent</span>
          </div>
          <div className="intel-card-body">
            <div className="dist-list">
              {emotionEntries.slice(0, 6).map((item, i) => (
                <DistBar
                  key={i}
                  label={item.label}
                  count={item.count}
                  percentage={item.percentage}
                  color={['purple', 'cyan', 'lime', 'amber', 'rose', 'emerald'][i % 6]}
                />
              ))}
              {emotionEntries.length === 0 && (
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  No emotion vectors generated.
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
