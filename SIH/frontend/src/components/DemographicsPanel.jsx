import React from 'react';
import { Users, ShieldCheck, Lock, Globe, Briefcase, Calendar } from 'lucide-react';

function CohortBar({ label, count, percentage, isSuppressed, colorFill, colorBg }) {
  const pct = Math.min(100, Math.max(0, percentage || 0));
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className={`font-semibold ${isSuppressed ? 'text-blue-700 flex items-center gap-1.5' : 'text-slate-700'}`}>
          {isSuppressed && <Lock className="w-3 h-3 text-blue-600" />}
          {label}
        </span>
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

function renderCohortList(distObj, total, fillColors, bgColors) {
  if (!distObj || Object.keys(distObj).length === 0) {
    return (
      <div className="text-xs text-slate-400 py-3 text-center">
        No cohort signals detected in active sample.
      </div>
    );
  }

  const entries = Object.entries(distObj).map(([k, v]) => {
    let count = 0;
    let percentage = 0;
    if (typeof v === 'object' && v !== null) {
      count = v.count ?? 0;
      percentage = v.percentage ?? ((count / total) * 100);
    } else {
      count = Number(v) || 0;
      percentage = (count / total) * 100;
    }
    const isSuppressed = k.includes('<k') || k.includes('suppressed');
    return {
      key: isSuppressed ? 'k<50 Privacy Protected' : k,
      count,
      percentage,
      isSuppressed,
    };
  });

  entries.sort((a, b) => b.count - a.count);

  return (
    <div className="space-y-3.5">
      {entries.map((item, i) => (
        <CohortBar
          key={i}
          label={item.key}
          count={item.count}
          percentage={item.percentage}
          isSuppressed={item.isSuppressed}
          colorFill={fillColors[i % fillColors.length]}
          colorBg={bgColors[i % bgColors.length]}
        />
      ))}
    </div>
  );
}

export default function DemographicsPanel({ data }) {
  if (!data || !data.total_users) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs">
        <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-4">
          <Users className="w-6 h-6" />
        </div>
        <h4 className="text-base font-bold text-slate-900 mb-1">No Demographic Signals Detected</h4>
        <p className="text-xs text-slate-500 max-w-sm mx-auto">
          Demographic modeling runs over public bio signals using spaCy NER. Ingest live posts or load sample intelligence to inspect cohorts.
        </p>
      </div>
    );
  }

  const total = Number(data.total_users) || 1;
  const kThreshold = data.k_anonymity_threshold || 50;

  const geo = data.geo_distribution || data.region_distribution || {};
  const lang = data.language_distribution || {};
  const prof = data.profession_distribution || {};
  const age = data.age_distribution || data.age_bracket_distribution || {};

  return (
    <div className="space-y-6">
      {/* Privacy Guarantee Alert Box */}
      <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
        <div className="p-1 rounded-md bg-blue-100 text-blue-700 mt-0.5">
          <ShieldCheck className="w-4 h-4" />
        </div>
        <div>
          <h4 className="text-xs font-bold text-blue-900 uppercase tracking-wider">
            Active Ethical Privacy: K-Anonymity (k ≥ {kThreshold}) Enforced
          </h4>
          <p className="text-xs text-blue-800/80 mt-0.5 leading-relaxed">
            No individually identifiable data is ever exposed. Any cohort containing fewer than {kThreshold} members is mathematically masked into privacy aggregates.
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Profile Cohorts</div>
          <div className="text-2xl font-extrabold text-slate-900 tracking-tight">{total}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Privacy Threshold</div>
          <div className="text-2xl font-extrabold text-blue-600 tracking-tight">k ≥ {kThreshold}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">NER Pipeline</div>
          <div className="text-sm font-bold text-slate-800 font-mono mt-1">xx_ent_wiki_sm</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Taxonomy Depth</div>
          <div className="text-2xl font-extrabold text-emerald-600 tracking-tight">7 Sectors</div>
        </div>
      </div>

      {/* Cohort Breakdown Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Geography */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-blue-600" />
              <h4 className="text-sm font-bold text-slate-900">Geographic Entities</h4>
            </div>
            <span className="text-[11px] font-mono text-slate-400 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
              spaCy NER
            </span>
          </div>
          {renderCohortList(geo, total, ['bg-blue-600', 'bg-indigo-600', 'bg-sky-500'], ['bg-blue-100', 'bg-indigo-100', 'bg-sky-100'])}
        </div>

        {/* Language */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-indigo-600" />
              <h4 className="text-sm font-bold text-slate-900">Language Detection</h4>
            </div>
            <span className="text-[11px] font-mono text-slate-400 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
              langdetect
            </span>
          </div>
          {renderCohortList(lang, total, ['bg-indigo-600', 'bg-blue-600', 'bg-sky-500'], ['bg-indigo-100', 'bg-blue-100', 'bg-sky-100'])}
        </div>

        {/* Profession Taxonomy */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-emerald-600" />
              <h4 className="text-sm font-bold text-slate-900">Professional Sectors</h4>
            </div>
            <span className="text-[11px] font-mono text-slate-400 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
              Hybrid Taxonomy
            </span>
          </div>
          {renderCohortList(prof, total, ['bg-emerald-600', 'bg-blue-600', 'bg-indigo-600', 'bg-amber-500'], ['bg-emerald-100', 'bg-blue-100', 'bg-indigo-100', 'bg-amber-100'])}
        </div>

        {/* Age Disclosures */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-amber-600" />
              <h4 className="text-sm font-bold text-slate-900">Age Disclosures</h4>
            </div>
            <span className="text-[11px] font-mono text-slate-400 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
              Self-Reported Only
            </span>
          </div>
          {renderCohortList(age, total, ['bg-amber-500', 'bg-blue-600', 'bg-indigo-600'], ['bg-amber-100', 'bg-blue-100', 'bg-indigo-100'])}
        </div>
      </div>
    </div>
  );
}
