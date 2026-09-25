import React from 'react'

export default function TrendsPanel({ data }) {
  if (!data || (!data.rising_trends && !data.predicted_viral_topics)) {
    return (
      <div className="empty-state">
        <div className="empty-icon">📈</div>
        <h4>No Trend Intelligence Found</h4>
        <p>Run a search query with Trends Engine active or load the Demo Intelligence Dataset to visualize Kleinberg Poisson automaton burst detection and BERTopic clusters.</p>
      </div>
    )
  }

  const rising = data.rising_trends || []
  const viral = data.predicted_viral_topics || data.viral_predictions || []
  const clusters = data.topic_clusters || []
  const shifts = data.chronological_shifts || []

  return (
    <div>
      {/* Stats Banner */}
      <div className="stats-banner">
        <div className="stat-item">
          <span className="stat-label">Analyzed Window</span>
          <span className="stat-value">{data.analyzed_window_hours || 24}h</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Rising Trends</span>
          <span className="stat-value accent-lime">{rising.length}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Imminent Viral</span>
          <span className="stat-value accent-rose">{viral.length}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Topic Clusters</span>
          <span className="stat-value accent-purple">{clusters.length}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Burst Engine</span>
          <span className="stat-value" style={{ fontSize: '0.92rem', color: 'var(--accent-purple)' }}>
            Kleinberg (2002)
          </span>
        </div>
      </div>

      {/* Main Grid */}
      <div className="intel-grid">
        {/* Rising Trends Table */}
        <div className="intel-card">
          <div className="intel-card-header">
            <span>/01 Velocity Burst Detection</span>
            <span style={{ color: 'var(--accent-lime-dark)' }}>Rising Topics</span>
          </div>
          <div className="intel-card-body">
            {rising.length === 0 ? (
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>No emerging surges in current window.</span>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Term / Hashtag</th>
                    <th>Growth Rate</th>
                    <th>Virality Score</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rising.map((t, i) => {
                    const term = t.keyword || t.term || t[0] || 'Unknown'
                    const rate = t.growth_rate ?? t.velocity ?? t[1] ?? 0
                    const vScore = t.virality_score ?? 0.5
                    const status = t.status || (vScore > 0.8 ? 'viral_surge' : 'rising')
                    return (
                      <tr key={i}>
                        <td style={{ fontWeight: 800 }}>
                          <span style={{ color: term.startsWith('#') ? 'var(--accent-purple)' : 'inherit' }}>
                            {term}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#059669' }}>
                            +{typeof rate === 'number' ? rate.toFixed(1) : rate}x
                          </span>
                        </td>
                        <td>
                          <span style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: '0.72rem',
                            fontWeight: 800,
                            padding: '2px 6px',
                            background: vScore > 0.85 ? 'var(--accent-lime)' : 'var(--bg-inset)',
                            border: '1px solid #000',
                          }}>
                            {typeof vScore === 'number' ? vScore.toFixed(2) : vScore}
                          </span>
                        </td>
                        <td>
                          <span style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: '0.65rem',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            color: status.includes('viral') ? 'var(--accent-rose)' : 'var(--text-secondary)'
                          }}>
                            {status.replace('_', ' ')}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Predicted Viral Topics */}
        <div className="intel-card">
          <div className="intel-card-header">
            <span>/02 Predictive Viral Trajectory</span>
            <span style={{ color: 'var(--accent-rose)' }}>High-Probability Peak</span>
          </div>
          <div className="intel-card-body">
            {viral.length === 0 ? (
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>No imminent viral anomalies identified.</span>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Predicted Term</th>
                    <th>Viral Index</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {viral.map((v, i) => {
                    const term = v.keyword || v.term || v[0] || 'Unknown'
                    const score = v.virality_score ?? v.score ?? v[1] ?? 0.8
                    const status = v.status || 'Imminent Surge'
                    return (
                      <tr key={i}>
                        <td style={{ fontWeight: 800 }}>{term}</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ width: '60px', height: '8px', background: '#e2e2ec', border: '1px solid #000' }}>
                              <div style={{ width: `${Math.min(100, score * 100)}%`, height: '100%', background: 'var(--accent-rose)' }} />
                            </div>
                            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: '0.72rem' }}>
                              {typeof score === 'number' ? score.toFixed(2) : score}
                            </span>
                          </div>
                        </td>
                        <td>
                          <span style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: '0.65rem',
                            fontWeight: 800,
                            padding: '2px 6px',
                            background: '#fee2e2',
                            border: '1px solid #ef4444',
                            color: '#b91c1c',
                            textTransform: 'uppercase'
                          }}>
                            {status}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Topic Clusters Section */}
      {clusters.length > 0 && (
        <div style={{ marginTop: 'var(--space-lg)' }}>
          <div className="intel-card">
            <div className="intel-card-header">
              <span>/03 Semantic Topic Clusters (BERTopic + Co-occurrence Graph)</span>
              <span style={{ color: 'var(--accent-purple)' }}>{clusters.length} Clusters</span>
            </div>
            <div className="intel-card-body">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-md)' }}>
                {clusters.map((c, i) => {
                  const label = c.label || c.name || `Topic Cluster #${i + 1}`
                  const terms = c.top_terms || c.terms || []
                  const snippets = c.sample_snippets || []
                  return (
                    <div key={i} style={{
                      padding: 'var(--space-md)',
                      border: '2px solid #000',
                      background: 'var(--bg-secondary)',
                      boxShadow: '3px 3px 0px #000'
                    }}>
                      <div style={{ fontWeight: 800, fontSize: '0.88rem', color: '#000', marginBottom: '8px' }}>
                        {label}
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
                        {terms.map((term, j) => (
                          <span key={j} style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            padding: '2px 8px',
                            background: '#ffffff',
                            color: 'var(--accent-purple)',
                            border: '1.5px solid #000',
                          }}>
                            #{term}
                          </span>
                        ))}
                      </div>
                      {snippets.length > 0 && (
                        <div style={{
                          fontSize: '0.74rem',
                          color: 'var(--text-secondary)',
                          fontStyle: 'italic',
                          borderLeft: '2px solid var(--accent-lime)',
                          paddingLeft: '8px',
                        }}>
                          "{snippets[0]}"
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Chronological Shifts */}
      {shifts.length > 0 && (
        <div style={{ marginTop: 'var(--space-md)', padding: '12px 16px', background: 'var(--bg-acid-yellow)', border: '2px solid #000', fontFamily: 'var(--font-mono)', fontSize: '0.74rem', fontWeight: 700 }}>
          ⚡ CHRONOLOGICAL DISCOURSE SHIFT: {shifts[0]}
        </div>
      )}
    </div>
  )
}
