import React from 'react'

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '24px',
          border: '2px solid #f43f5e',
          background: '#fff1f2',
          margin: '16px 0',
          fontFamily: 'var(--font-mono, monospace)'
        }}>
          <div style={{ color: '#e11d48', fontWeight: 'bold', fontSize: '0.9rem', marginBottom: '8px' }}>
            [!] COMPONENT RENDER ANOMALY RECOVERED
          </div>
          <div style={{ fontSize: '0.78rem', color: '#881337', marginBottom: '12px' }}>
            {this.state.error?.message || 'Unexpected parsing state.'}
          </div>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              padding: '6px 14px',
              background: '#0a0a0a',
              color: '#fff',
              border: 'none',
              fontSize: '0.74rem',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            ↺ RESET VIEW
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
