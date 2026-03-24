'use client';

import { useState } from 'react';
import Link from 'next/link';
import { TYPE_LABELS } from '@/lib/constants';

type IntelligenceEntry = {
  id: string;
  type: string;
  headline: string;
  company_name: string;
  date: string;
  source_name: string;
  image_url: string;
  summary: string;
  key_stat: { number: string; label: string } | null;
  tags: { capability: string; region: string; segment: string; theme: string[] };
};

const REGIONS = [
  { value: 'all', label: 'All Regions' },
  { value: 'us', label: 'United States' },
  { value: 'emea', label: 'EMEA' },
  { value: 'asia', label: 'Asia Pacific' },
  { value: 'latam', label: 'LatAm' },
];

const PERIODS = [
  { value: 'all', label: 'All Time' },
  { value: '90',  label: 'Last 90 Days' },
  { value: '30',  label: 'Last 30 Days' },
  { value: '7',   label: 'Last 7 Days' },
];

const CAPABILITIES = [
  { value: 'all', label: 'All Topics' },
  { value: 'advisor_productivity', label: 'Advisor Productivity' },
  { value: 'client_personalization', label: 'Client Personalization' },
  { value: 'investment_portfolio', label: 'Investment & Portfolio' },
  { value: 'research_content', label: 'Research & Content' },
  { value: 'client_acquisition', label: 'Client Acquisition' },
  { value: 'operations_compliance', label: 'Operations & Compliance' },
  { value: 'new_business_models', label: 'New Business Models' },
];

function formatDateShort(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

export default function IntelligenceFilter({ entries }: { entries: IntelligenceEntry[] }) {
  const [region, setRegion] = useState('all');
  const [capability, setCapability] = useState('all');
  const [period, setPeriod] = useState('all');

  const periodCutoff = period !== 'all' ? (() => {
    const d = new Date();
    d.setDate(d.getDate() - parseInt(period, 10));
    return d.toISOString().split('T')[0];
  })() : null;

  const filtered = entries.filter(e => {
    const regionMatch = region === 'all' || e.tags?.region === region;
    const capMatch = capability === 'all' || e.tags?.capability === capability;
    const periodMatch = !periodCutoff || e.date >= periodCutoff;
    return regionMatch && capMatch && periodMatch;
  });

  return (
    <div>
      {/* Filters */}
      <div className="mb-6 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          {/* Region */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mr-1">Region</span>
            {REGIONS.map(r => (
              <button
                key={r.value}
                onClick={() => setRegion(r.value)}
                className={`text-[11px] px-2.5 py-1 border transition-colors font-medium rounded ${
                  region === r.value
                    ? 'bg-[#990F3D] text-white border-[#990F3D]'
                    : 'bg-white text-gray-500 border-gray-200 hover:border-[#990F3D] hover:text-[#990F3D]'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
          {/* Period + count */}
          <div className="flex items-center gap-2">
            <select
              value={period}
              onChange={e => setPeriod(e.target.value)}
              className="text-[11px] text-gray-600 border border-gray-200 rounded px-2 py-1 bg-white cursor-pointer hover:border-[#990F3D] focus:outline-none focus:border-[#990F3D]"
            >
              {PERIODS.map(p => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
            <span className="text-[11px] text-gray-400">
              {filtered.length} {filtered.length === 1 ? 'entry' : 'entries'}
            </span>
          </div>
        </div>

        {/* Topic */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mr-1">Topic</span>
          {CAPABILITIES.map(c => (
            <button
              key={c.value}
              onClick={() => setCapability(c.value)}
              className={`text-[11px] px-2.5 py-1 border transition-colors font-medium rounded ${
                capability === c.value
                  ? 'bg-[#990F3D] text-white border-[#990F3D]'
                  : 'bg-white text-gray-500 border-gray-200 hover:border-[#990F3D] hover:text-[#990F3D]'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <hr className="section-rule mb-6" />

      {/* List */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400 text-sm border border-dashed border-gray-200 rounded">
          No entries match this filter combination.
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(entry => (
            <Link
              key={entry.id}
              href={`/intelligence/${entry.id}`}
              className="article-card rounded p-5 flex gap-5 items-start group block"
            >
              {/* Logo */}
              <div className="w-14 h-14 bg-gray-50 border border-gray-100 rounded flex items-center justify-center flex-shrink-0">
                {entry.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={entry.image_url}
                    alt={entry.company_name}
                    className="max-h-10 max-w-12 object-contain"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                ) : (
                  <span className="text-xs text-gray-400 font-bold text-center leading-tight px-1">
                    {entry.company_name.slice(0, 4)}
                  </span>
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5 min-w-0">
                  <span className={`type-badge badge-${entry.type} flex-shrink-0`}>
                    {TYPE_LABELS[entry.type] ?? entry.type}
                  </span>
                  <span className="text-xs text-gray-400 truncate min-w-0">{entry.company_name}</span>
                  <span className="text-xs text-gray-400 flex-shrink-0 whitespace-nowrap">· {formatDateShort(entry.date)}</span>
                </div>
                <h3 className="text-base font-bold text-gray-900 leading-snug mb-1.5 group-hover:text-[#990F3D] transition-colors">
                  {entry.headline}
                </h3>
                <p className="text-sm text-gray-500 leading-relaxed line-clamp-2">
                  {entry.summary}
                </p>
              </div>

              {/* Key stat */}
              {entry.key_stat && (
                <div className="flex-shrink-0 text-right min-w-[80px]">
                  <div className="text-xl font-extrabold text-[#990F3D]">{entry.key_stat.number}</div>
                  <div className="text-xs text-gray-400 leading-tight">{entry.key_stat.label}</div>
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
