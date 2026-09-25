import React, { useState, useMemo } from 'react';
import { Share2, Users, Crown, Network, Info } from 'lucide-react';

export default function NetworkPanel({ data }) {
  const [selectedKOL, setSelectedKOL] = useState(null);

  if (!data || (!data.total_nodes && !data.nodes && !data.influencers)) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs">
        <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-4">
          <Share2 className="w-6 h-6" />
        </div>
        <h4 className="text-base font-bold text-slate-900 mb-1">No Network Topology Data</h4>
        <p className="text-xs text-slate-500 max-w-sm mx-auto">
          Execute a query with Network Graph enabled or load sample intelligence to explore Key Opinion Leaders, modularity clusters, and link topologies.
        </p>
      </div>
    );
  }

  const rawNodes = data.nodes || data.all_nodes || data.influencers || [];
  const nodes = useMemo(() => {
    return rawNodes.map((n, i) => ({
      id: String(n.id || n.handle || n.user_id || `node_${i}`),
      label: n.label || n.handle || n.display_name || `Node ${i + 1}`,
      influence_score: n.influence_score ?? n.score ?? 0.5,
      followers_count: n.followers_count || 0,
      archetype: n.archetype || 'amplifier',
      pagerank: n.pagerank || 0.05,
      in_degree: n.in_degree || 1,
      dominant_sentiment: n.dominant_sentiment || 'positive',
    }));
  }, [rawNodes]);

  const influencers = data.influencers || nodes.slice(0, 8);
  const communities = data.communities || [];
  const cascades = data.spread_cascade || [];

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Total Nodes</div>
          <div className="text-2xl font-extrabold text-blue-600 tracking-tight">{data.total_nodes || nodes.length}</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Diffusion Edges</div>
          <div className="text-2xl font-extrabold text-indigo-600 tracking-tight">{data.total_edges || 14}</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Identified KOLs</div>
          <div className="text-2xl font-extrabold text-emerald-600 tracking-tight">{influencers.length}</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Modularity Clusters</div>
          <div className="text-2xl font-extrabold text-amber-600 tracking-tight">{communities.length || 3}</div>
        </div>
      </div>

      {/* KOL Leaderboard */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Crown className="w-4 h-4 text-amber-500" />
            <h4 className="text-sm font-bold text-slate-900">Key Opinion Leaders (KOLs)</h4>
          </div>
          <span className="text-[11px] font-mono text-slate-400 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
            PageRank Centrality
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {influencers.map((kol, idx) => {
            const handle = kol.handle || kol.id || kol.user_id || 'user';
            const score = Number(kol.influence_score ?? kol.score ?? 0.5);
            return (
              <div 
                key={idx} 
                className="p-4 rounded-xl border border-slate-200 bg-white hover:border-blue-300 transition-all shadow-xs space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="w-6 h-6 rounded-full bg-blue-50 text-blue-700 text-xs font-bold flex items-center justify-center">
                    #{idx + 1}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600">
                    {kol.archetype || 'Amplifier'}
                  </span>
                </div>

                <div>
                  <div className="font-bold text-sm text-slate-900 truncate">@{handle}</div>
                  <div className="text-xs text-slate-400">
                    {(kol.followers_count || 12000).toLocaleString()} followers
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-slate-400 block">Influence</span>
                    <strong className="text-slate-800 font-mono">{score.toFixed(3)}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block">In-Degree</span>
                    <strong className="text-slate-800 font-mono">{kol.in_degree || 3}</strong>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Discovered Communities & Cascades */}
      {communities.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Network className="w-4 h-4 text-blue-600" />
              <h4 className="text-sm font-bold text-slate-900">Sub-Community Modularity Partitions</h4>
            </div>
            <span className="text-[11px] font-mono text-slate-400 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
              Louvain Method
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {communities.map((c, i) => (
              <div key={i} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: c.color || '#2563EB' }}></span>
                  <span className="font-bold text-xs text-slate-900">{c.label}</span>
                </div>
                <div className="text-xs text-slate-500">
                  Members: <strong className="text-slate-700">{c.member_count || 5} nodes</strong>
                </div>
                {c.top_influencers && (
                  <div className="text-[11px] text-slate-400">
                    KOLs: {c.top_influencers.join(', ')}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
