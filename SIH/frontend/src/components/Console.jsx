import { useRef, useEffect } from 'react'

export default function Console({ logs, onClear }) {
  const bodyRef = useRef(null)

  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight
    }
  }, [logs])

  return (
    <div className="console-section">
      <div className="console-header">
        <h4>▸ System Console</h4>
        <button className="console-clear-btn" onClick={onClear}>Clear</button>
      </div>
      <div className="console-body" ref={bodyRef}>
        {logs.length === 0 && (
          <div className="log-line">
            <span className="log-time">[--:--:--]</span>
            <span className="log-msg">Awaiting pipeline execution...</span>
          </div>
        )}
        {logs.map((log, i) => (
          <div className="log-line" key={i}>
            <span className="log-time">[{log.time}]</span>
            <span className={`log-msg ${log.type}`}>{log.msg}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
