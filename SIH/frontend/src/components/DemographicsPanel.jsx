import React from 'react'

function CohortBar({ label, count, percentage, isSuppressed, color = 'purple' }) {
  const pct = Math.min(100, Math.max(0, percentage || 0))
  return (
    <div className="dist-row">
      <span className="dist-label" style={{ fontWeight: isSuppressed ? 800 : 600, color: isSuppressed ? 'var(--accent-purple)' : 'inherit' }}>
        {label}
      </span>
      <div className="dist-bar-bg">
        <div className={`dist-bar-fill ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="dist-val">
        {count != null ? count : ''} ({pct.toFixed(1)}%)
      </span>
    </div>
  )
}

function renderCohortList(distObj, total, colorList) {
  if (!distObj || Object.keys(distObj).length === 0) {
    return (
      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', padding: '8px 0' }}>
        No cohort signals detected in active sample.
      </div>
    )
  }

  const entries = Object.entries(distObj).map(([k, v]) => {
    let count = 0
    let percentage = 0
    let note = ''
    if (typeof v === 'object' && v !== null) {
      count = v.count ?? 0
      percentage = v.percentage ?? ((count / total) * 100)
      note = v.note || ''
    } else {
      count = Number(v) || 0
      percentage = (count / total) * 100
    }
    const isSuppressed = k.includes('<k') || k.includes('suppressed')
    return {
      key: isSuppressed ? '🔒 k<50 Protected' : k,
      count,
      percentage,
      isSuppressed,
      note,
    }
  })

  entries.sort((a, b) => b.count - a.count)

  return (
    <div className="dist-list">
      {entries.map((item, i) => (
        <CohortBar
          key={i}
          label={item.key}
          count={item.count}
          percentage={item.percentage}
          isSuppressed={item.isSuppressed}
          color={colorList[i % colorList.length]}
        />
      ))}
    </div>
  )
}

export default function DemographicsPanel({ data }) {
  if (!data || !data.total_users) {
    return (
      <div className="empty-state">
        <div className="empty-icon">👥</div>
        <h4>No Demographic Signals Detected</h4>
        <p>Demographic inference requires user bios from ingested tweets. Execute the pipeline or click "Load Demo Intelligence Dataset".</p>
      </div>
    )
  }

  const total = Number(data.total_users) || 1
  const kThreshold = data.k_anonymity_threshold || 50

  const geo = data.geo_distribution || data.region_distribution || {}
  const lang = data.language_distribution || {}
  const prof = data.profession_distribution || {}
  const age = data.age_distribution || data.age_bracket_distribution || {}

  return (
    <div>
      {/* Privacy Notice Banner */}
      <div className="privacy-badge-banner">
        <span style={{ fontSize: '1.2rem' }}>🔒</span>
        <div>
          <span style={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Privacy Guarantee Active: K-Anonymity (k≥{kThreshold}) Enforced.
          </span>
          <div style={{ fontSize: '0.7rem', fontWeight: 500, color: 'var(--text-secondary)', marginTop: '2px' }}>
            No individual user identities are ever exposed. Cohorts below {kThreshold} members are automatically suppressed into aggregate buckets.
          </div>
        </div>
      </div>

      {/* Stats Banner */}
      <div className="stats-banner">
        <div className="stat-item">
          <span className="stat-label">Total User Profiles</span>
          <span className="stat-value">{total}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Privacy Standard</span>
          <span className="stat-value accent-lime">k≥{kThreshold}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Multilingual NER</span>
          <span className="stat-value accent-purple">xx_ent_wiki_sm</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Taxonomy Depth</span>
          <span className="stat-value accent-cyan">7 Sectors</span>
        </div>
      </div>

      {/* Grid of Cohorts */}
      <div className="intel-grid">
        <div className="intel-card">
          <div className="intel-card-header">
            <span>/01 Geographic Disclosures</span>
            <span style={{ color: 'var(--accent-purple)' }}>spaCy NER (GPE)</span>
          </div>
          <div className="intel-card-body">
            {renderCohortList(geo, total, ['cyan', 'purple', 'lime', 'emerald'])}
          </div>
        </div>

        <div className="intel-card">
          <div className="intel-card-header">
            <span>/02 Language Distribution</span>
            <span style={{ color: 'var(--accent-purple)' }}>langdetect</span>
          </div>
          <div className="intel-card-body">
            {renderCohortList(lang, total, ['purple', 'lime', 'cyan', 'amber'])}
          </div>
        </div>

        <div className="intel-card">
          <div className="intel-card-header">
            <span>/03 Profession Taxonomy</span>
            <span style={{ color: 'var(--accent-purple)' }}>Hybrid Classifier</span>
          </div>
          <div className="intel-card-body">
            {renderCohortList(prof, total, ['emerald', 'cyan', 'purple', 'rose'])}
          </div>
        </div>

        <div className="intel-card">
          <div className="intel-card-header">
            <span>/04 Age Bracket Disclosures</span>
            <span style={{ color: 'var(--accent-purple)' }}>Self-Disclosed Only</span>
          </div>
          <div className="intel-card-body">
            {renderCohortList(age, total, ['amber', 'purple', 'cyan', 'lime'])}
          </div>
        </div>
      </div>
    </div>
  )
}
