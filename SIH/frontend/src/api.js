const API_BASE = '';

export async function fetchStatus() {
  const res = await fetch(`${API_BASE}/api/scraper/status`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function runScraper(params) {
  const runFull = params.sentiment || params.demographics || params.trends || params.network;
  const endpoint = runFull ? '/api/scraper/test-full' : '/api/scraper/test';

  const body = {
    query: params.query,
    limit: params.limit,
    time_window_mode: params.timeMode,
    hours_ago: (params.timeMode === 'from_hours_ago' || params.timeMode === 'older_than_hours') ? params.hoursAgo : null,
    since: params.since || null,
    until: params.until || null,
    scrape_comments: params.scrapeComments,
    comments_limit: params.commentsLimit,
  };

  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || `HTTP ${res.status}`);
  return data;
}

export async function scrapeComments(postId, limit = 10) {
  const res = await fetch(`${API_BASE}/api/scraper/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ post_id: parseInt(postId, 10), limit }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'Failed to scrape comments');
  return data;
}

export async function fetchAccounts() {
  const res = await fetch(`${API_BASE}/api/scraper/accounts`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function updateAccounts(content) {
  const res = await fetch(`${API_BASE}/api/scraper/accounts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'Update failed');
  return data;
}
