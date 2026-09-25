import React from 'react';
import { Smile, Frown, Meh, AlertCircle, Sparkles } from 'lucide-react';

function DistBar({ label, count, percentage, colorBg, colorFill }) {
  const pct = Math.min(100, Math.max(0, percentage || 0));
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-slate-700 capitalize">{label}</span>
        <span className="font-mono text-slate-500 font-medium">
          {count != null ? count : ''} ({pct.toFixed(1)}%)
        </span>
      </div>
      <div className={`h-2.5 w-full rounded-full ${colorBg} overflow-hidden`}>
        <div 
          className={`h-full rounded-full ${colorFill} transition-all duration-500`} 
          style={{ width: `${pct}%` }} 
        />
      </div>
    </div>
  );
}

export default function SentimentPanel({ data }) {
  if (!data || !data.total_analyzed) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs">
        <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-4">
          <Smile className="w-6 h-6" />
        </div>
        <h4 className="text-base font-bold text-slate-900 mb-1">No Sentiment Data Available</h4>
        <p className="text-xs text-slate-500 max-w-sm mx-auto">
          Execute the pipeline with Sentiment Analysis enabled or load sample intelligence to view Google MuRIL inferences.
        </p>
      </div>
    );
  }

  const rawMix = data.sentiment_mix || data.label_distribution || {};
  const total = Number(data.total_analyzed) || 1;

  const extractMix = (key) => {
    const val = rawMix[key];
    if (val == null) return { count: 0, percentage: 0 };
    if (typeof val === 'object') {
      return { count: val.count ?? 0, percentage: val.percentage ?? ((val.count / total) * 100) };
    }
    return { count: val, percentage: (val / total) * 100 };
  };

  const pos = extractMix('positive');
  const neu = extractMix('neutral');
  const neg = extractMix('negative');

  let dominant = 'Neutral';
  let dominantColor = 'text-slate-600 bg-slate-50 border-slate-200';
  if (pos.count > neu.count && pos.count > neg.count) {
    dominant = 'Positive';
    dominantColor = 'text-emerald-700 bg-emerald-50 border-emerald-200';
  } else if (neg.count > pos.count && neg.count > neu.count) {
    dominant = 'Negative';
    dominantColor = 'text-rose-700 bg-rose-50 border-rose-200';
  }

  const rawEmotions = data.emotion_mix || data.top_emotions || {};
  const emotionEntries = Array.isArray(rawEmotions)
    ? rawEmotions.map(e => ({
        label: e.emotion || e.label || e[0] || 'Unknown',
        count: e.count || e[1] || 0,
        percentage: e.percentage ?? (((e.count || e[1] || 0) / total) * 100),
      }))
    : Object.entries(rawEmotions).map(([k, v]) => ({
        label: k,
        count: typeof v === 'object' ? v.count : v,
        percentage: typeof v === 'object' ? v.percentage : ((v / total) * 100),
      }));

  emotionEntries.sort((a, b) => b.count - a.count);

  const sarcasmPct = data.avg_sarcasm_probability 
    ? (data.avg_sarcasm_probability * 100).toFixed(1) 
    : '0.0';

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Posts Analyzed</div>
          <div className="text-2xl font-extrabold text-slate-900 tracking-tight">{total}</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Dominant Tone</div>
          <div className="flex items-center gap-2">
            <span className={`text-sm font-bold px-2.5 py-0.5 rounded-full border ${dominantColor}`}>
              {dominant}
            </span>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Positive Ratio</div>
          <div className="text-2xl font-extrabold text-emerald-600 tracking-tight">{pos.percentage.toFixed(1)}%</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Sarcasm Probability</div>
          <div className="text-2xl font-extrabold text-indigo-600 tracking-tight">{sarcasmPct}%</div>
        </div>
      </div>

      {/* Grid: Polarity & Emotions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Polarity Mix */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h4 className="text-sm font-bold text-slate-900">Sentiment Polarity Mix</h4>
            <span className="text-[11px] font-mono font-medium text-slate-400 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
              Google MuRIL
            </span>
          </div>

          <div className="space-y-4">
            <DistBar 
              label="Positive" 
              count={pos.count} 
              percentage={pos.percentage} 
              colorBg="bg-emerald-100" 
              colorFill="bg-emerald-500" 
            />
            <DistBar 
              label="Neutral" 
              count={neu.count} 
              percentage={neu.percentage} 
              colorBg="bg-slate-100" 
              colorFill="bg-slate-400" 
            />
            <DistBar 
              label="Negative" 
              count={neg.count} 
              percentage={neg.percentage} 
              colorBg="bg-rose-100" 
              colorFill="bg-rose-500" 
            />
          </div>

          {/* Visual Ratio Strip */}
          <div className="pt-2">
            <div className="h-4 w-full rounded-full flex overflow-hidden border border-slate-200">
              <div style={{ width: `${pos.percentage}%` }} className="bg-emerald-500" title="Positive" />
              <div style={{ width: `${neu.percentage}%` }} className="bg-slate-300" title="Neutral" />
              <div style={{ width: `${neg.percentage}%` }} className="bg-rose-500" title="Negative" />
            </div>
            <div className="flex justify-between items-center text-[11px] text-slate-500 mt-2 font-medium">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500"></span>{pos.percentage.toFixed(0)}% Positive</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-slate-400"></span>{neu.percentage.toFixed(0)}% Neutral</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-rose-500"></span>{neg.percentage.toFixed(0)}% Negative</span>
            </div>
          </div>
        </div>

        {/* Nuanced Emotions */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h4 className="text-sm font-bold text-slate-900">Nuanced Emotion Distribution</h4>
            <span className="text-[11px] font-mono font-medium text-slate-400 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
              Multi-Class Latent
            </span>
          </div>

          <div className="space-y-3.5">
            {emotionEntries.slice(0, 5).map((e, idx) => {
              const fills = ['bg-blue-600', 'bg-indigo-600', 'bg-sky-500', 'bg-amber-500', 'bg-rose-500'];
              const bgs = ['bg-blue-100', 'bg-indigo-100', 'bg-sky-100', 'bg-amber-100', 'bg-rose-100'];
              return (
                <DistBar
                  key={idx}
                  label={e.label}
                  count={e.count}
                  percentage={e.percentage}
                  colorBg={bgs[idx % bgs.length]}
                  colorFill={fills[idx % fills.length]}
                />
              );
            })}
            {emotionEntries.length === 0 && (
              <p className="text-xs text-slate-400 py-4 text-center">No emotion dimensions detected.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
