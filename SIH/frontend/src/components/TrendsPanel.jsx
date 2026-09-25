import React from 'react';
import { TrendingUp, Zap, Sparkles, Layers } from 'lucide-react';

export default function TrendsPanel({ data }) {
  if (!data || (!data.rising_trends && !data.predicted_viral_topics)) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs">
        <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-4">
          <TrendingUp className="w-6 h-6" />
        </div>
        <h4 className="text-base font-bold text-slate-900 mb-1">No Trend Bursts Detected</h4>
        <p className="text-xs text-slate-500 max-w-sm mx-auto">
          Execute a search query with Trend Detection enabled or load sample intelligence to examine Kleinberg Poisson burst automations.
        </p>
      </div>
    );
  }

  const rising = data.rising_trends || [];
  const viral = data.predicted_viral_topics || data.viral_predictions || [];
  const clusters = data.topic_clusters || [];
  const shifts = data.chronological_shifts || [];

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Window Scope</div>
          <div className="text-2xl font-extrabold text-slate-900 tracking-tight">{data.analyzed_window_hours || 24}h</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Rising Surges</div>
          <div className="text-2xl font-extrabold text-blue-600 tracking-tight">{rising.length}</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Imminent Peaks</div>
          <div className="text-2xl font-extrabold text-amber-600 tracking-tight">{viral.length}</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Topic Clusters</div>
          <div className="text-2xl font-extrabold text-indigo-600 tracking-tight">{clusters.length}</div>
        </div>
      </div>

      {/* Grid: Rising Bursts & Predictive Virality */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Rising Trends Table */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-600" />
              <h4 className="text-sm font-bold text-slate-900">Velocity Burst Detection</h4>
            </div>
            <span className="text-[11px] font-mono text-slate-400 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
              Kleinberg (2002)
            </span>
          </div>

          {rising.length === 0 ? (
            <p className="text-xs text-slate-400 py-4 text-center">No burst velocity detected.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                    <th className="pb-2.5">Topic / Tag</th>
                    <th className="pb-2.5">Growth</th>
                    <th className="pb-2.5">Virality</th>
                    <th className="pb-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rising.map((t, i) => {
                    const term = t.keyword || t.term || t[0] || 'Unknown';
                    const rate = t.growth_rate ?? t.velocity ?? t[1] ?? 0;
                    const vScore = t.virality_score ?? 0.5;
                    const status = t.status || (vScore > 0.8 ? 'viral_surge' : 'rising');
                    return (
                      <tr key={i} className="hover:bg-slate-50/50">
                        <td className="py-2.5 font-bold text-slate-800">
                          {term}
                        </td>
                        <td className="py-2.5 font-mono font-bold text-emerald-600">
                          +{typeof rate === 'number' ? rate.toFixed(1) : rate}x
                        </td>
                        <td className="py-2.5 font-mono text-slate-600 font-medium">
                          {typeof vScore === 'number' ? vScore.toFixed(2) : vScore}
                        </td>
                        <td className="py-2.5">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200">
                            {status.replace('_', ' ')}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Predictive Virality */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500 fill-amber-500" />
              <h4 className="text-sm font-bold text-slate-900">Predictive Virality Forecast</h4>
            </div>
            <span className="text-[11px] font-mono text-slate-400 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
              Poisson Automaton
            </span>
          </div>

          {viral.length === 0 ? (
            <p className="text-xs text-slate-400 py-4 text-center">No imminent virality forecast.</p>
          ) : (
            <div className="space-y-3.5">
              {viral.map((v, i) => {
                const term = v.keyword || v.term || v[0] || 'Unknown';
                const score = v.virality_score ?? v.score ?? v[1] ?? 0.8;
                return (
                  <div key={i} className="p-3 rounded-lg border border-slate-100 bg-slate-50/50 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-slate-800 text-xs">{term}</div>
                      <div className="text-[11px] text-slate-400 font-medium mt-0.5">
                        High velocity peak trajectory
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <div className="w-16 h-2 rounded-full bg-slate-200 overflow-hidden">
                        <div 
                          className="h-full rounded-full bg-amber-500" 
                          style={{ width: `${Math.min(100, score * 100)}%` }} 
                        />
                      </div>
                      <span className="font-mono text-xs font-bold text-slate-700">
                        {typeof score === 'number' ? score.toFixed(2) : score}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Semantic Topic Clusters */}
      {clusters.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-600" />
              <h4 className="text-sm font-bold text-slate-900">Semantic Topic Clusters</h4>
            </div>
            <span className="text-[11px] font-mono text-slate-400 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
              BERTopic
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {clusters.map((c, i) => {
              const label = c.label || c.name || `Cluster #${i + 1}`;
              const terms = c.top_terms || c.terms || [];
              const snippets = c.sample_snippets || [];
              return (
                <div key={i} className="p-4 rounded-xl border border-slate-200 bg-white hover:border-blue-200 transition-all shadow-xs space-y-2.5">
                  <div className="font-bold text-xs text-slate-900">{label}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {terms.map((t, idx) => (
                      <span key={idx} className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-mono font-medium">
                        #{t}
                      </span>
                    ))}
                  </div>
                  {snippets.length > 0 && (
                    <p className="text-[11px] text-slate-500 italic border-l-2 border-blue-500 pl-2">
                      "{snippets[0]}"
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
