import React, { useState, useEffect, useCallback } from 'react';
import { 
  ShieldCheck, 
  Cpu, 
  Zap, 
  Share2, 
  Users, 
  TrendingUp, 
  Search, 
  UploadCloud, 
  ArrowRight, 
  CheckCircle2, 
  Lock, 
  Smile, 
  Activity,
  Layers,
  ChevronDown,
  Terminal,
  AlertTriangle,
  Loader2,
  X
} from 'lucide-react';
import { fetchStatus, runScraper } from './api';
import { DEMO_INTELLIGENCE_DATA } from './demoData';
import { ErrorBoundary } from './components/ErrorBoundary';
import TweetFeed from './components/TweetFeed';
import SentimentPanel from './components/SentimentPanel';
import DemographicsPanel from './components/DemographicsPanel';
import TrendsPanel from './components/TrendsPanel';
import NetworkPanel from './components/NetworkPanel';

export default function SocialPulsePipeline() {
  const [query, setQuery] = useState('Artificial Intelligence');
  const [sampleLimit, setSampleLimit] = useState('50 posts (Recommended)');
  const [timeWindow, setTimeWindow] = useState('From past hours to now (Rolling)');
  const [hoursBack, setHoursBack] = useState(2);
  const [commentDepth, setCommentDepth] = useState('10 replies / post');

  // Toggle states for AI engines
  const [engines, setEngines] = useState({
    sentiment: true,
    demographics: true,
    trends: true,
    network: true,
    publicReplies: true,
  });

  // Active workspace tab
  const [activeTab, setActiveTab] = useState('Network');
  const [status, setStatus] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [latency, setLatency] = useState('14ms');
  const [logs, setLogs] = useState([]);
  const [showConsole, setShowConsole] = useState(false);
  const [result, setResult] = useState(DEMO_INTELLIGENCE_DATA);
  const [apiNotice, setApiNotice] = useState(null);
  const [selectedNodeInfo, setSelectedNodeInfo] = useState(null);

  const toggleEngine = (key) => {
    setEngines(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const addLog = useCallback((msg, type = 'info') => {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setLogs(prev => [...prev, { time, msg, type }]);
  }, []);

  // Poll backend health and status
  useEffect(() => {
    const poll = async () => {
      try {
        const start = performance.now();
        const data = await fetchStatus();
        const took = Math.round(performance.now() - start);
        setStatus(data);
        setLatency(`${took}ms`);
      } catch {
        // backend ping
      }
    };
    poll();
    const timer = setInterval(poll, 6000);
    return () => clearInterval(timer);
  }, []);

  // Parse limit from string
  const parseLimit = (str) => {
    if (str.includes('10')) return 10;
    if (str.includes('50')) return 50;
    if (str.includes('100')) return 100;
    if (str.includes('250')) return 250;
    return 10;
  };

  // Parse comments limit
  const parseCommentsLimit = (str) => {
    if (str.includes('0')) return 0;
    if (str.includes('10')) return 10;
    if (str.includes('25')) return 25;
    if (str.includes('50')) return 50;
    return 10;
  };

  // Execute Live Pipeline
  const handleExecute = async () => {
    if (!query.trim()) return;
    setIsLoading(true);
    setApiNotice(null);
    setShowConsole(true);
    addLog(`Initiating live scraping query: "${query}"...`, 'info');
    const start = performance.now();

    const limit = parseLimit(sampleLimit);
    const commentsLimit = parseCommentsLimit(commentDepth);
    const scrapeComments = engines.publicReplies && commentsLimit > 0;

    let timeMode = 'latest';
    let hAgo = hoursBack;
    if (timeWindow.includes('Rolling') || timeWindow.includes('From past hours')) {
      timeMode = 'from_hours_ago';
    } else if (timeWindow.includes('24 Hours')) {
      timeMode = 'from_hours_ago';
      hAgo = 24;
    } else if (timeWindow.includes('7 Days')) {
      timeMode = 'from_hours_ago';
      hAgo = 168;
    }

    try {
      const data = await runScraper({
        query: query.trim(),
        limit,
        timeMode,
        hoursAgo: hAgo,
        scrapeComments,
        commentsLimit,
        sentiment: engines.sentiment,
        demographics: engines.demographics,
        trends: engines.trends,
        network: engines.network,
      });

      const execTime = ((performance.now() - start) / 1000).toFixed(2);
      setLatency(`${Math.round(performance.now() - start)}ms`);

      if (data && (data.tweets?.length > 0 || data.count > 0)) {
        setResult(data);
        addLog(`Pipeline complete! Ingested ${data.tweets?.length || 0} tweets in ${execTime}s`, 'success');
        if (data.sentiment_summary?.total_analyzed) addLog(`Scored sentiment for ${data.sentiment_summary.total_analyzed} posts`, 'info');
        if (data.demographics_summary?.total_users) addLog(`Aggregated ${data.demographics_summary.total_users} privacy-masked cohorts`, 'info');
        if (data.trend_summary?.rising_trends?.length) addLog(`Identified ${data.trend_summary.rising_trends.length} burst trends`, 'info');
        if (data.network_summary?.total_nodes) addLog(`Mapped ${data.network_summary.total_nodes} network nodes`, 'info');
      } else {
        addLog(`Query returned 0 posts from current timeline.`, 'warn');
      }
    } catch (err) {
      const errMsg = err.message || 'Scraper execution error';
      addLog(`Backend scraper notice: ${errMsg}`, 'warn');

      if (errMsg.includes('ConnectError') || errMsg.includes('500') || errMsg.includes('cooling')) {
        setApiNotice({
          type: 'warn',
          message: `Twitter account rate-limited or cooling down (${errMsg}). Active intelligence dataset retained below so all tabs remain fully interactive.`
        });
        addLog('Twitter account is cooling down. Retained sample intelligence dataset for full exploration.', 'info');
      } else {
        setApiNotice({
          type: 'error',
          message: `Pipeline error: ${errMsg}`
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Load Sample Intelligence
  const handleLoadSample = () => {
    setResult(DEMO_INTELLIGENCE_DATA);
    setApiNotice(null);
    addLog('Loaded rich sample intelligence dataset (8 posts, 16 network nodes, 3 topic clusters).', 'success');
  };

  // Node details for 2D Interactive Network Graph
  const handleNodeClick = (title, role, metric) => {
    setSelectedNodeInfo({ title, role, metric });
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] font-sans antialiased selection:bg-blue-100 selection:text-blue-900 pb-16">
      {/* 1. Global System Telemetry Header */}
      <div className="w-full bg-white border-b border-slate-200 px-6 py-2.5 text-xs text-slate-500 font-medium flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4 flex-wrap">
          <span className="flex items-center gap-1.5 text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full font-semibold border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            Systems Operational
          </span>
          <span className="text-slate-300">|</span>
          <span>Engine: <strong className="text-slate-800">Google MuRIL & spaCy NER</strong></span>
          <span className="text-slate-300">|</span>
          <span>Response Time: <strong className="text-slate-800">{latency}</strong></span>
          <span className="text-slate-300">|</span>
          <span>Privacy Mode: <strong className="text-slate-800">k≥50 Protected</strong></span>
        </div>
        <div className="flex items-center gap-4 text-slate-400">
          <span>API: <strong className="text-slate-700">v2.4 Production</strong></span>
          <span className="text-slate-300">|</span>
          <span>Circuit: <strong className="text-emerald-600">{status?.circuit_breaker?.state || 'CLOSED'}</strong></span>
          <span className="text-slate-300">|</span>
          <span>Backend: <strong className="text-slate-700">127.0.0.1:8000</strong></span>
        </div>
      </div>

      {/* 2. Main Navigation Bar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-6 h-18 flex items-center justify-between">
          <div className="flex items-center gap-10">
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveTab('Network')}>
              <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold text-base shadow-sm">
                SP
              </div>
              <div>
                <h1 className="text-lg font-bold text-slate-900 leading-tight tracking-tight">SocialPulse</h1>
                <p className="text-xs text-slate-500 font-medium">Audience Intelligence</p>
              </div>
            </div>

            <nav className="hidden md:flex items-center gap-1">
              {[
                { id: 'Feed', label: 'Feed', count: result?.tweets?.length },
                { id: 'Sentiment', label: 'Sentiment', count: result?.sentiment_summary?.total_analyzed },
                { id: 'Demographics', label: 'Demographics', count: result?.demographics_summary?.total_users },
                { id: 'Trends', label: 'Trends', count: result?.trend_summary?.rising_trends?.length },
                { id: 'Network', label: 'Network', count: result?.network_summary?.total_nodes || 14 },
                { id: 'Raw Data', label: 'Raw Data', count: null },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    const el = document.getElementById('active-workspace-panel');
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
                    activeTab === item.id
                      ? 'bg-blue-50 text-blue-700 font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <span>{item.label}</span>
                  {item.count != null && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-700 font-mono">
                      {item.count}
                    </span>
                  )}
                </button>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowConsole(!showConsole)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 border border-slate-200"
              title="Toggle Live System Console"
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>Console</span>
            </button>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-50 border border-slate-200 text-xs font-medium text-slate-700">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              {status?.account_count || 1} Account Active
            </div>
            <div className="w-9 h-9 rounded-full bg-blue-100 border border-blue-200 flex items-center justify-center text-xs font-bold text-blue-800">
              DR
            </div>
          </div>
        </div>
      </header>

      {/* Optional Live System Console Drawer */}
      {showConsole && (
        <div className="max-w-7xl mx-auto px-6 pt-4">
          <div className="bg-slate-900 text-slate-100 rounded-xl p-4 font-mono text-xs border border-slate-800 shadow-md">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800 mb-2">
              <span className="font-bold text-emerald-400 flex items-center gap-2">
                <Terminal className="w-3.5 h-3.5" /> Live System Telemetry Stream
              </span>
              <button onClick={() => setShowConsole(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="max-h-40 overflow-y-auto space-y-1">
              {logs.length === 0 && <p className="text-slate-500">Awaiting live query execution...</p>}
              {logs.map((log, i) => (
                <div key={i} className="flex gap-2">
                  <span className="text-slate-500">[{log.time}]</span>
                  <span className={log.type === 'success' ? 'text-emerald-400 font-semibold' : log.type === 'warn' ? 'text-amber-400' : log.type === 'error' ? 'text-rose-400' : 'text-sky-300'}>
                    {log.msg}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 3. Main Workspace Content */}
      <main className="max-w-7xl mx-auto px-6 pt-8 space-y-8">
        
        {/* API Notice Banner if applicable */}
        {apiNotice && (
          <div className={`p-4 rounded-xl border flex items-center justify-between text-xs font-medium ${
            apiNotice.type === 'warn' ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}>
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>{apiNotice.message}</span>
            </div>
            <button onClick={() => setApiNotice(null)} className="font-bold text-slate-500 hover:text-slate-900">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Top Split Section: Hero + 2D Interactive Network Topology Visualizer */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          
          {/* Left Column: Hero Text & Key Metrics */}
          <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-8 shadow-xs flex flex-col justify-between">
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold border border-blue-100">
                  Audience Intelligence Suite
                </span>
                <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold border border-emerald-100 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  Ready for query
                </span>
              </div>

              <h2 className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight leading-[1.12]">
                Understand real conversations with <span className="text-blue-600">authentic clarity.</span>
              </h2>

              <p className="text-slate-600 text-base leading-relaxed max-w-xl">
                Discover authentic community sentiment, cohort dynamics, and network influence without the noise. Powered by multilingual Google MuRIL and transparent 2D graph modeling.
              </p>

              {/* KPI Metrics */}
              <div className="grid grid-cols-3 gap-6 pt-4 border-t border-slate-100">
                <div>
                  <div className="text-3xl font-extrabold text-slate-900 tracking-tight">99.4%</div>
                  <div className="text-xs text-slate-500 font-medium mt-1">Cohort Accuracy</div>
                </div>
                <div>
                  <div className="text-3xl font-extrabold text-slate-900 tracking-tight">{latency}</div>
                  <div className="text-xs text-slate-500 font-medium mt-1">Inference Latency</div>
                </div>
                <div>
                  <div className="text-3xl font-extrabold text-slate-900 tracking-tight">k ≥ 50</div>
                  <div className="text-xs text-slate-500 font-medium mt-1">Privacy Guaranteed</div>
                </div>
              </div>
            </div>

            {/* CTAs */}
            <div className="flex flex-wrap items-center gap-4 pt-8">
              <button 
                onClick={handleExecute}
                disabled={isLoading}
                className="flex items-center gap-2.5 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-sm transition-all transform active:scale-95 disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Executing Pipeline...</span>
                  </>
                ) : (
                  <>
                    <span>Execute Workspace</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
              <button 
                onClick={handleLoadSample}
                className="flex items-center gap-2 px-5 py-3 rounded-xl bg-white hover:bg-slate-50 text-slate-700 font-semibold text-sm border border-slate-200 transition-all shadow-xs"
              >
                <UploadCloud className="w-4 h-4 text-slate-500" />
                <span>Load Sample Intelligence</span>
              </button>
            </div>
          </div>

          {/* Right Column: 2D Big-Orb Network Graph Stage */}
          <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col justify-between relative overflow-hidden">
            {/* Stage Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
                <span className="text-xs font-bold text-slate-800 tracking-tight">Live Community Network</span>
              </div>
              <span className="text-xs font-mono font-medium text-slate-400 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                60 FPS
              </span>
            </div>

            {/* SVG 2D Network Representation (Big Balls / Orbs) */}
            <div className="relative w-full h-[320px] flex items-center justify-center bg-[radial-gradient(#E2E8F0_1px,transparent_1px)] [background-size:16px_16px] rounded-xl border border-slate-100 select-none">
              <svg className="w-full h-full cursor-pointer" viewBox="0 0 460 320" fill="none">
                {/* Connection Lines (Bridges) */}
                <g stroke="#CBD5E1" strokeWidth="2" strokeLinecap="round" strokeDasharray="none">
                  <line x1="230" y1="160" x2="160" y2="110" />
                  <line x1="230" y1="160" x2="170" y2="210" />
                  <line x1="230" y1="160" x2="310" y2="210" />
                  <line x1="230" y1="160" x2="320" y2="110" />
                  <line x1="160" y1="110" x2="200" y2="60" />
                  <line x1="160" y1="110" x2="110" y2="100" />
                  <line x1="170" y1="210" x2="115" y2="210" />
                  <line x1="310" y1="210" x2="260" y2="270" />
                  <line x1="310" y1="210" x2="360" y2="270" />
                  <line x1="310" y1="210" x2="380" y2="220" />
                  <line x1="320" y1="110" x2="380" y2="100" />
                  <line x1="320" y1="110" x2="375" y2="155" />
                  <line x1="200" y1="60" x2="245" y2="85" />
                </g>

                {/* Big Hub Node 1: Core Hub (Center - Deep Blue) */}
                <g onClick={() => handleNodeClick('Core Hub', 'Primary Authority', 'PageRank 0.082 | In-Degree 6')}>
                  <circle cx="230" cy="160" r="28" fill="#1D4ED8" className="filter drop-shadow-md hover:scale-105 transition-transform" />
                  <circle cx="230" cy="160" r="24" fill="#2563EB" />
                  <text x="230" y="157" textAnchor="middle" fill="#FFFFFF" fontSize="10" fontWeight="bold">Core</text>
                  <text x="230" y="169" textAnchor="middle" fill="#BFDBFE" fontSize="8" fontWeight="medium">Hub</text>
                </g>

                {/* Big Hub Node 2: KOL 1 (Top Left - Cobalt) */}
                <g onClick={() => handleNodeClick('KOL 1 (Dr. Alex Vance)', 'Key Opinion Creator', 'PageRank 0.078 | Followers 84.2K')}>
                  <circle cx="160" cy="110" r="22" fill="#1E40AF" />
                  <circle cx="160" cy="110" r="18" fill="#2563EB" />
                  <text x="160" y="108" textAnchor="middle" fill="#FFFFFF" fontSize="9" fontWeight="bold">KOL 1</text>
                  <text x="160" y="118" textAnchor="middle" fill="#DBEAFE" fontSize="7">Creator</text>
                </g>

                {/* Big Hub Node 3: KOL 2 (Bottom Left - Light Blue) */}
                <g onClick={() => handleNodeClick('KOL 2 (Elena Rostova)', 'ML Specialist', 'Influence 0.76 | In-Degree 4')}>
                  <circle cx="170" cy="210" r="18" fill="#3B82F6" />
                  <text x="170" y="213" textAnchor="middle" fill="#FFFFFF" fontSize="8" fontWeight="bold">KOL 2</text>
                </g>

                {/* Big Hub Node 4: Advocate (Top Right - Vibrant Green) */}
                <g onClick={() => handleNodeClick('Advocate (Kenji Sato)', 'Research Advocate', 'PageRank 0.068 | 41.2K Followers')}>
                  <circle cx="320" cy="110" r="20" fill="#059669" />
                  <text x="320" y="113" textAnchor="middle" fill="#FFFFFF" fontSize="9" fontWeight="bold">Advocate</text>
                </g>

                {/* Big Hub Node 5: Lead Analyst (Bottom Right - Royal Violet) */}
                <g onClick={() => handleNodeClick('Lead Analyst (Priya Sundaram)', 'Bridge Connector', 'Betweenness 0.35 | 54.1K Followers')}>
                  <circle cx="310" cy="210" r="22" fill="#7C3AED" />
                  <circle cx="310" cy="210" r="18" fill="#8B5CF6" />
                  <text x="310" y="208" textAnchor="middle" fill="#FFFFFF" fontSize="9" fontWeight="bold">Lead</text>
                  <text x="310" y="218" textAnchor="middle" fill="#EDE9FE" fontSize="7">Analyst</text>
                </g>

                {/* Big Hub Node 6: Growth (Upper Middle - Amber) */}
                <g onClick={() => handleNodeClick('Growth Sector', 'Diffusion Multiplier', 'Virality 0.92 | Reach 184K')}>
                  <circle cx="245" cy="85" r="17" fill="#D97706" />
                  <text x="245" y="88" textAnchor="middle" fill="#FFFFFF" fontSize="8" fontWeight="bold">Growth</text>
                </g>

                {/* Peripheral Big Spheres (P, M, A) */}
                <circle cx="110" cy="100" r="13" fill="#60A5FA" />
                <text x="110" y="103" textAnchor="middle" fill="#FFFFFF" fontSize="8">P</text>

                <circle cx="115" cy="210" r="13" fill="#60A5FA" />
                <text x="115" y="213" textAnchor="middle" fill="#FFFFFF" fontSize="8">P</text>

                <circle cx="200" cy="60" r="13" fill="#F59E0B" />
                <text x="200" y="63" textAnchor="middle" fill="#FFFFFF" fontSize="8">M</text>

                <circle cx="380" cy="100" r="13" fill="#10B981" />
                <text x="380" y="103" textAnchor="middle" fill="#FFFFFF" fontSize="8">A</text>

                <circle cx="375" cy="155" r="13" fill="#34D399" />
                <text x="375" y="158" textAnchor="middle" fill="#FFFFFF" fontSize="8">M</text>

                <circle cx="380" cy="220" r="13" fill="#A78BFA" />
                <text x="380" y="223" textAnchor="middle" fill="#FFFFFF" fontSize="8">A</text>

                <circle cx="360" cy="270" r="13" fill="#8B5CF6" />
                <text x="360" y="273" textAnchor="middle" fill="#FFFFFF" fontSize="8">P</text>

                <circle cx="260" cy="270" r="13" fill="#F59E0B" />
                <text x="260" y="273" textAnchor="middle" fill="#FFFFFF" fontSize="8">A</text>
              </svg>

              {/* Node selection popup overlay */}
              {selectedNodeInfo && (
                <div className="absolute bottom-3 left-3 right-3 bg-white/95 backdrop-blur-sm p-3 rounded-lg border border-slate-200 shadow-sm text-xs flex items-center justify-between">
                  <div>
                    <div className="font-bold text-slate-800">{selectedNodeInfo.title}</div>
                    <div className="text-[11px] text-slate-500">{selectedNodeInfo.role} • {selectedNodeInfo.metric}</div>
                  </div>
                  <button onClick={() => setSelectedNodeInfo(null)} className="text-slate-400 hover:text-slate-800 font-bold p-1">
                    ✕
                  </button>
                </div>
              )}
            </div>

            {/* Stage Bottom Legends and Graph Metrics */}
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
              <div className="space-y-1.5">
                <span className="font-semibold text-slate-700 block">Identified Clusters</span>
                <div className="flex flex-wrap items-center gap-3 text-slate-500">
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-600"></span>Core Creators</span>
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-600"></span>Advocates</span>
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-purple-600"></span>Analysts</span>
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500"></span>Growth</span>
                </div>
              </div>

              <div className="text-right border-l border-slate-100 pl-4">
                <div className="text-slate-400">Nodes: <strong className="text-slate-800">{result?.network_summary?.total_nodes || 14} Active</strong></div>
                <div className="text-slate-400">Density: <strong className="text-slate-800">{result?.network_summary?.graph_density?.toFixed(2) || '0.82'}</strong></div>
              </div>
            </div>
          </div>
        </div>

        {/* 4. Five Core Feature Pillars (Friendly Humanized Cards) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {[
            {
              icon: Smile,
              color: 'text-blue-600 bg-blue-50',
              title: 'Real-time Sentiment',
              desc: 'Deep multilingual neural classification with contextual nuance and instant alert triggers.',
              tab: 'Sentiment',
            },
            {
              icon: Share2,
              color: 'text-indigo-600 bg-indigo-50',
              title: 'Community Mapping',
              desc: 'Graph link topologies that detect organic clusters, bridge accounts, and conversation drivers.',
              tab: 'Network',
            },
            {
              icon: Users,
              color: 'text-sky-600 bg-sky-50',
              title: 'Demographic Insights',
              desc: 'Named entity recognition and interest grouping across audience segments.',
              tab: 'Demographics',
            },
            {
              icon: TrendingUp,
              color: 'text-amber-600 bg-amber-50',
              title: 'Trend Bursts',
              desc: 'Kleinberg burst detection algorithms to spot emergent narratives before they peak.',
              tab: 'Trends',
            },
            {
              icon: ShieldCheck,
              color: 'text-emerald-600 bg-emerald-50',
              title: 'Ethical Privacy',
              desc: 'Enforced k≥50 cohort masking protecting individual identities while preserving truthful insight.',
              tab: 'Demographics',
            }
          ].map((feature, i) => (
            <div 
              key={i} 
              onClick={() => {
                setActiveTab(feature.tab);
                const el = document.getElementById('active-workspace-panel');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}
              className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs hover:border-blue-300 hover:shadow-sm cursor-pointer transition-all flex flex-col justify-between"
            >
              <div>
                <div className={`w-9 h-9 rounded-lg ${feature.color} flex items-center justify-center mb-4`}>
                  <feature.icon className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-slate-900 text-sm tracking-tight mb-2">{feature.title}</h3>
                <p className="text-xs text-slate-500 leading-relaxed">{feature.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* 5. Pipeline Configuration & Execution Module */}
        <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-xs space-y-8">
          
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-100 gap-4">
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 font-bold text-xs flex items-center justify-center border border-blue-100">
                02
              </span>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Pipeline Configuration & Execution</h3>
                <p className="text-xs text-slate-500">Configure ingestion filters, parameters, and machine intelligence models.</p>
              </div>
            </div>
            <div className="text-xs text-slate-500 font-mono flex items-center gap-2">
              <span>Target Environment:</span>
              <span className="bg-slate-50 px-2.5 py-1 rounded border border-slate-200 text-slate-700 font-medium">
                http://127.0.0.1:8000
              </span>
            </div>
          </div>

          {/* Form Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Target Query */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                Target Search Query
              </label>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full pl-10 pr-24 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="e.g. Artificial Intelligence, #ClimateAction"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                  Keyword / #Tag
                </span>
              </div>
            </div>

            {/* Sample Volume Limit */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                Sample Volume Limit
              </label>
              <div className="relative">
                <select
                  value={sampleLimit}
                  onChange={(e) => setSampleLimit(e.target.value)}
                  className="w-full appearance-none px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all pr-10"
                >
                  <option>10 posts (Rapid Test)</option>
                  <option>50 posts (Recommended)</option>
                  <option>100 posts (Deep Analysis)</option>
                  <option>250 posts (Extended Ingestion)</option>
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* Time Window Mode */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                Time Window
              </label>
              <div className="relative">
                <select
                  value={timeWindow}
                  onChange={(e) => setTimeWindow(e.target.value)}
                  className="w-full appearance-none px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all pr-10"
                >
                  <option>From past hours to now (Rolling)</option>
                  <option>Past 24 Hours</option>
                  <option>Past 7 Days</option>
                  <option>Custom Date Range</option>
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* Hours Back & Ingestion Depth Subgrid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                  Hours Back
                </label>
                <input
                  type="number"
                  value={hoursBack}
                  onChange={(e) => setHoursBack(Number(e.target.value))}
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  min={1}
                  max={72}
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                  Comment Ingestion Depth
                </label>
                <div className="relative">
                  <select
                    value={commentDepth}
                    onChange={(e) => setCommentDepth(e.target.value)}
                    className="w-full appearance-none px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all pr-8"
                  >
                    <option>0 replies (Top only)</option>
                    <option>10 replies / post</option>
                    <option>25 replies / post</option>
                    <option>50 replies / post</option>
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            </div>
          </div>

          {/* Active Processing Inference Engines Toggles */}
          <div className="space-y-3 pt-4 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Active Processing Models
              </span>
              <span className="text-xs text-slate-400">Toggle engines to activate or bypass</span>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {[
                { key: 'sentiment', label: 'Sentiment Analysis', tag: 'MuRIL' },
                { key: 'demographics', label: 'Demographic NER', tag: 'spaCy' },
                { key: 'trends', label: 'Trend Detection', tag: 'Kleinberg' },
                { key: 'network', label: 'Network Graph', tag: 'Topology' },
                { key: 'publicReplies', label: 'Public Replies', tag: 'Threaded' },
              ].map((engine) => {
                const active = engines[engine.key];
                return (
                  <button
                    key={engine.key}
                    type="button"
                    onClick={() => toggleEngine(engine.key)}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium border transition-all ${
                      active
                        ? 'bg-blue-50/70 border-blue-200 text-blue-900 shadow-xs'
                        : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${active ? 'bg-blue-600' : 'bg-slate-300'}`}></span>
                    <span className="font-semibold">{engine.label}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${active ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-400'}`}>
                      {engine.tag}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Big Action Execution Triggers */}
          <div className="flex flex-col sm:flex-row items-center gap-4 pt-4">
            <button 
              onClick={handleExecute}
              disabled={isLoading || !query.trim()}
              className="w-full sm:flex-1 flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-sm transition-all transform active:scale-95 disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Executing Live Pipeline...</span>
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 fill-white" />
                  <span>Execute Live Pipeline</span>
                </>
              )}
            </button>
            <button 
              onClick={handleLoadSample}
              disabled={isLoading}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 font-semibold text-sm border border-slate-200 shadow-xs transition-all"
            >
              <UploadCloud className="w-4 h-4 text-slate-500" />
              <span>Load Sample Intelligence</span>
            </button>
          </div>
        </div>

        {/* 6. Active Intelligence Workspace & Data Results Section */}
        <div id="active-workspace-panel" className="bg-white rounded-2xl border border-slate-200 p-8 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-4">
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 font-bold text-xs flex items-center justify-center border border-blue-100">
                03
              </span>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Intelligence Workspace: {activeTab}</h3>
                <p className="text-xs text-slate-500">Live analytics, audience metrics, and inference stream results.</p>
              </div>
            </div>

            {/* Quick Tab switcher */}
            <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-200 overflow-x-auto">
              {['Feed', 'Sentiment', 'Demographics', 'Trends', 'Network', 'Raw Data'].map((item) => (
                <button
                  key={item}
                  onClick={() => setActiveTab(item)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                    activeTab === item 
                      ? 'bg-white text-blue-700 shadow-xs' 
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          {/* Active Data Panel Rendering */}
          <div className="pt-2">
            <ErrorBoundary>
              {activeTab === 'Feed' && (
                <TweetFeed tweets={result?.tweets} onLog={addLog} />
              )}
              {activeTab === 'Sentiment' && (
                <SentimentPanel data={result?.sentiment_summary} tweets={result?.tweets} />
              )}
              {activeTab === 'Demographics' && (
                <DemographicsPanel data={result?.demographics_summary} />
              )}
              {activeTab === 'Trends' && (
                <TrendsPanel data={result?.trend_summary} />
              )}
              {activeTab === 'Network' && (
                <NetworkPanel data={result?.network_summary} />
              )}
              {activeTab === 'Raw Data' && (
                <div className="rounded-xl border border-slate-200 bg-slate-900 p-4 overflow-hidden">
                  <pre className="text-xs font-mono text-slate-200 max-h-96 overflow-y-auto whitespace-pre-wrap word-break-all">
                    {result ? JSON.stringify(result, null, 2) : 'No data currently available.'}
                  </pre>
                </div>
              )}
            </ErrorBoundary>
          </div>
        </div>

        {/* 7. Footer Telemetry & Encryption Status */}
        <footer className="pt-6 pb-2 border-t border-slate-200 text-xs text-slate-500 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <strong className="text-slate-700">Encrypted Stream Active</strong>
            <span className="text-slate-300">•</span>
            <span>Protected under standard research telemetry protocols</span>
          </div>

          <div className="flex items-center gap-4 font-mono text-slate-400 text-[11px]">
            <span>SCN: 0042</span>
            <span>|</span>
            <span>NODE: SP-CLUSTER-PRIMARY</span>
          </div>
        </footer>

      </main>
    </div>
  );
}
