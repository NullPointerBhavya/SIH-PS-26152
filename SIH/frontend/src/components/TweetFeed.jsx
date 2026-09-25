import React, { useState } from 'react';
import { Heart, Repeat, MessageSquare, ShieldCheck, CheckCircle2, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { scrapeComments } from '../api';

function CommentItem({ comment }) {
  const u = comment.user || {};
  const initials = (u.display_name || u.handle || 'C').substring(0, 2).toUpperCase();
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 border border-slate-100 text-xs">
      <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center shrink-0 text-[10px]">
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-bold text-slate-800">{u.display_name || u.handle || 'Anonymous'}</span>
          <span className="text-slate-400 font-mono text-[11px]">@{u.handle || 'user'}</span>
          {comment.sentiment && (
            <span className={`ml-auto px-2 py-0.2 rounded-full text-[10px] font-semibold uppercase ${
              comment.sentiment.label === 'positive' 
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                : comment.sentiment.label === 'negative'
                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                : 'bg-slate-100 text-slate-600 border border-slate-200'
            }`}>
              {comment.sentiment.label}
            </span>
          )}
        </div>
        <p className="text-slate-700 leading-relaxed">{comment.text}</p>
      </div>
    </div>
  );
}

function TweetCard({ tweet, onLog }) {
  const [comments, setComments] = useState(tweet.comments || []);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [scraping, setScraping] = useState(false);

  const user = tweet.user || {};
  const initials = (user.display_name || user.handle || 'A').substring(0, 2).toUpperCase();
  const dateStr = tweet.created_at 
    ? new Date(tweet.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) 
    : 'Recent';

  const handleScrape = async () => {
    setScraping(true);
    onLog?.(`Scraping replies for post ${tweet.post_id}...`, 'info');
    try {
      const data = await scrapeComments(tweet.post_id);
      if (data.comments?.length > 0) {
        setComments(data.comments);
        setDrawerOpen(true);
        onLog?.(`Retrieved ${data.comments.length} replies for post ${tweet.post_id}`, 'success');
      } else {
        onLog?.(`No public replies found for post ${tweet.post_id}`, 'info');
      }
    } catch (err) {
      onLog?.(`Comment scrape error: ${err.message}`, 'error');
    } finally {
      setScraping(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs hover:border-slate-300 transition-all space-y-4">
      {/* Author & Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-xs shadow-xs">
            {initials}
          </div>
          <div>
            <div className="flex items-center gap-1.5 font-bold text-slate-900 text-sm">
              <span>{user.display_name || user.handle || 'Anonymous'}</span>
              {user.verified && <CheckCircle2 className="w-4 h-4 text-blue-600 fill-blue-50" />}
            </div>
            <div className="text-xs text-slate-400 font-mono">@{user.handle || 'user'}</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {tweet.sentiment && (
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase ${
              tweet.sentiment.label === 'positive' 
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                : tweet.sentiment.label === 'negative'
                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                : 'bg-slate-100 text-slate-600 border border-slate-200'
            }`}>
              {tweet.sentiment.label} · {tweet.sentiment.emotion || 'scored'}
            </span>
          )}
          <span className="text-xs text-slate-400 font-mono">{dateStr}</span>
        </div>
      </div>

      {/* Tweet Body */}
      <p className="text-slate-800 text-sm leading-relaxed whitespace-pre-wrap">{tweet.text}</p>

      {/* Translated text if applicable */}
      {tweet.sentiment?.translated_text && (
        <div className="bg-blue-50/60 border border-blue-100 rounded-lg p-3 text-xs text-blue-900/90 italic">
          🌐 <strong>Translated:</strong> "{tweet.sentiment.translated_text}"
        </div>
      )}

      {/* Hashtags */}
      {tweet.hashtags && tweet.hashtags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {tweet.hashtags.map((tag, i) => (
            <span key={i} className="text-xs font-mono font-medium text-blue-600 hover:underline cursor-pointer">
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* Action / Engagement Counts */}
      <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs text-slate-500 font-medium">
        <div className="flex items-center gap-6">
          <span className="flex items-center gap-1.5 hover:text-rose-600 cursor-pointer">
            <Heart className="w-4 h-4" />
            <span>{tweet.like_count || 0}</span>
          </span>
          <span className="flex items-center gap-1.5 hover:text-emerald-600 cursor-pointer">
            <Repeat className="w-4 h-4" />
            <span>{tweet.retweet_count || 0}</span>
          </span>
          <span className="flex items-center gap-1.5 hover:text-blue-600 cursor-pointer">
            <MessageSquare className="w-4 h-4" />
            <span>{tweet.reply_count || 0}</span>
          </span>
        </div>

        <div>
          {comments.length > 0 ? (
            <button
              onClick={() => setDrawerOpen(!drawerOpen)}
              className="flex items-center gap-1 text-blue-600 hover:text-blue-700 font-semibold"
            >
              <span>{comments.length} Replies</span>
              {drawerOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          ) : (
            <button
              onClick={handleScrape}
              disabled={scraping}
              className="flex items-center gap-1 text-slate-500 hover:text-blue-600 font-semibold"
            >
              {scraping ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Fetching...</span>
                </>
              ) : (
                <span>Scrape Replies</span>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Comments Drawer */}
      {drawerOpen && comments.length > 0 && (
        <div className="space-y-2 pt-3 border-t border-slate-100 pl-4 border-l-2 border-l-blue-200">
          {comments.map((c, i) => (
            <CommentItem key={i} comment={c} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function TweetFeed({ tweets, onLog }) {
  if (!tweets || tweets.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs">
        <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-4">
          <MessageSquare className="w-6 h-6" />
        </div>
        <h4 className="text-base font-bold text-slate-900 mb-1">No Social Posts Ingested</h4>
        <p className="text-xs text-slate-500 max-w-sm mx-auto">
          Execute a live pipeline query or click "Load Sample Intelligence" above to review live posts, verified metadata, and sentiment tags.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {tweets.map((t, idx) => (
        <TweetCard key={t.post_id || idx} tweet={t} onLog={onLog} />
      ))}
    </div>
  );
}
