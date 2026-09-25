import { useState } from 'react'
import { scrapeComments } from '../api'

function escapeHtml(s) {
  if (!s) return ''
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function CommentItem({ comment }) {
  const u = comment.user || {}
  const initials = (u.display_name || u.handle || 'C').substring(0, 2).toUpperCase()
  return (
    <div className="comment-item">
      <div className="comment-avatar">{initials}</div>
      <div className="comment-body" style={{ flex: 1 }}>
        <div className="comment-meta" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <strong style={{ fontSize: '0.82rem' }}>{u.display_name || u.handle || 'Anonymous'}</strong>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            @{u.handle || 'user'}
          </span>
          {comment.sentiment && (
            <span className={`sentiment-badge ${comment.sentiment.label}`} style={{ marginLeft: 'auto', fontSize: '0.62rem' }}>
              {comment.sentiment.label}
            </span>
          )}
        </div>
        <div style={{ fontSize: '0.84rem', color: 'var(--text-primary)', lineHeight: 1.45 }}>
          {escapeHtml(comment.text)}
        </div>
      </div>
    </div>
  )
}

function TweetCard({ tweet, onLog }) {
  const [comments, setComments] = useState(tweet.comments || [])
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [scraping, setScraping] = useState(false)

  const user = tweet.user || {}
  const initials = (user.display_name || user.handle || 'A').substring(0, 2).toUpperCase()
  const dateStr = tweet.created_at 
    ? new Date(tweet.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) 
    : 'Recent'

  const handleScrape = async () => {
    setScraping(true)
    onLog?.(`Scraping replies for post ${tweet.post_id}...`, 'info')
    try {
      const data = await scrapeComments(tweet.post_id)
      if (data.comments?.length > 0) {
        setComments(data.comments)
        setDrawerOpen(true)
        onLog?.(`Retrieved ${data.comments.length} comments for post ${tweet.post_id}`, 'success')
      } else {
        onLog?.(`No public replies found for post ${tweet.post_id}`, 'info')
      }
    } catch (err) {
      onLog?.(`Comment scrape notice: ${err.message}`, 'error')
    } finally {
      setScraping(false)
    }
  }

  return (
    <div className="tweet-card">
      <div className="tweet-header">
        <div className="tweet-author">
          <div className="tweet-avatar">{initials}</div>
          <div className="tweet-author-info">
            <span className="tweet-name">
              {user.display_name || user.handle || 'Anonymous'}
              {user.verified && <span style={{ color: 'var(--accent-purple)', marginLeft: '4px' }}>✓</span>}
            </span>
            <span className="tweet-handle">@{user.handle || 'user'}</span>
          </div>
        </div>
        <div className="tweet-meta">
          <span className="tweet-time">{dateStr}</span>
          {tweet.sentiment && (
            <span className={`sentiment-badge ${tweet.sentiment.label}`}>
              {tweet.sentiment.label} · {tweet.sentiment.emotion || 'scored'}
            </span>
          )}
        </div>
      </div>

      <div className="tweet-text">{tweet.text}</div>

      {tweet.sentiment?.translated_text && (
        <div className="tweet-translated">
          🌐 <strong>Translated:</strong> "{tweet.sentiment.translated_text}"
        </div>
      )}

      {tweet.hashtags && tweet.hashtags.length > 0 && (
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '10px' }}>
          {tweet.hashtags.map((tag, i) => (
            <span key={i} style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.68rem',
              fontWeight: 700,
              padding: '1px 6px',
              background: '#f3f4f6',
              border: '1px solid #000',
              color: 'var(--accent-purple)'
            }}>
              #{tag}
            </span>
          ))}
        </div>
      )}

      <div className="tweet-stats">
        <span className="tweet-stat">❤ {tweet.like_count || 0}</span>
        <span className="tweet-stat">↻ {tweet.retweet_count || 0}</span>
        <span className="tweet-stat">💬 {tweet.reply_count || 0}</span>
        <span className="tweet-stat" style={{ marginLeft: 'auto', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
          ID: {tweet.post_id}
        </span>
      </div>

      <div className="comments-section">
        {comments.length > 0 ? (
          <>
            <button className="btn-comments" onClick={() => setDrawerOpen(!drawerOpen)}>
              💬 Comments ({comments.length}) {drawerOpen ? '▲' : '▼'}
            </button>
            {drawerOpen && (
              <div className="comments-drawer">
                {comments.map((c, i) => <CommentItem key={i} comment={c} />)}
              </div>
            )}
          </>
        ) : (
          <button
            className="btn-comments scrape"
            onClick={handleScrape}
            disabled={scraping}
          >
            {scraping ? '⏳ Scraping Comments...' : '💬 Scrape Public Comments'}
          </button>
        )}
      </div>
    </div>
  )
}

export default function TweetFeed({ tweets, onLog }) {
  if (!tweets || tweets.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon">📡</div>
        <h4>No Social Posts Ingested</h4>
        <p>Execute the intelligence pipeline with your search query or click "Load Demo Intelligence Dataset" above to explore live tweets with verified sentiment scores.</p>
      </div>
    )
  }

  return (
    <div className="tweet-grid">
      {tweets.map((tweet, i) => (
        <TweetCard key={tweet.post_id || i} tweet={tweet} onLog={onLog} />
      ))}
    </div>
  )
}
