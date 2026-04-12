'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import Link from 'next/link';
import { TYPE_LABELS } from '@/lib/constants';

type IntelligenceEntry = {
  id: string;
  type: string;
  headline: string;
  the_so_what?: string;
  company_name: string;
  date: string;
  source_name: string;
  image_url: string;
  summary: string;
  key_stat: { number: string; label: string } | null;
  tags: { capability: string; region: string; segment: string; theme: string[] };
  sources?: { name: string; url: string; type: string }[];
  source_count?: number;
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
  const [search, setSearch] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Unique company names for autocomplete
  const companyNames = useMemo(() => {
    const names = [...new Set(entries.map(e => e.company_name))].sort();
    return names;
  }, [entries]);

  // Suggestions filtered by current search input
  const suggestions = useMemo(() => {
    if (!search || search.length < 1) return [];
    const q = search.toLowerCase();
    return companyNames.filter(name => name.toLowerCase().includes(q)).slice(0, 8);
  }, [search, companyNames]);

  // Close suggestions on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const periodCutoff = period !== 'all' ? (() => {
    const d = new Date();
    d.setDate(d.getDate() - parseInt(period, 10));
    return d.toISOString().split('T')[0];
  })() : null;

  const filtered = entries.filter(e => {
    const regionMatch = region === 'all' || e.tags?.region === region;
    const capMatch = capability === 'all' || e.tags?.capability === capability;
    const periodMatch = !periodCutoff || e.date >= periodCutoff;
    const searchMatch = !search || (() => {
      const q = search.toLowerCase();
      return e.company_name.toLowerCase().includes(q)
        || e.headline.toLowerCase().includes(q)
        || e.summary.toLowerCase().includes(q)
        || (e.the_so_what || '').toLowerCase().includes(q);
    })();
    return regionMatch && capMatch && periodMatch && searchMatch;
  });

  return (
    <div>
      {/* Search */}
      <div className="mb-5 relative" ref={searchRef}>
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search by company, headline, or keyword..."
            value={search}
            onChange={e => { setSearch(e.target.value); setShowSuggestions(true); }}
            onFocus={() => setShowSuggestions(true)}
            className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-200 rounded-lg bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#990F3D] focus:ring-1 focus:ring-[#990F3D] transition-colors"
          />
          {search && (
            <button
              onClick={() => { setSearch(''); setShowSuggestions(false); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        {/* Autocomplete suggestions */}
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
            {suggestions.map(name => (
              <button
                key={name}
                onClick={() => { setSearch(name); setShowSuggestions(false); }}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-[#990F3D] transition-colors flex items-center gap-2"
              >
                <svg className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                {name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="mb-6 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          {/* Region */}
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-1 sm:pb-0 sm:flex-wrap">
            <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mr-1">Region</span>
            {REGIONS.map(r => (
              <button
                key={r.value}
                onClick={() => setRegion(r.value)}
                className={`text-[11px] px-2.5 py-1 border transition-colors font-medium rounded flex-shrink-0 ${
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
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-1 sm:pb-0 sm:flex-wrap">
          <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mr-1 flex-shrink-0">Topic</span>
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
              className="article-card rounded p-4 sm:p-5 flex gap-3 sm:gap-5 items-start group block"
            >
              {/* Logo */}
              <div className="w-10 h-10 sm:w-14 sm:h-14 bg-gray-50 border border-gray-100 rounded flex items-center justify-center flex-shrink-0">
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
                  {(entry.source_count ?? entry.sources?.length ?? 0) > 1 && (
                    <span className="text-[10px] text-gray-400 border border-gray-200 rounded px-1.5 py-0.5 flex-shrink-0">
                      {entry.source_count ?? entry.sources?.length} sources
                    </span>
                  )}
                </div>
                <h3 className="text-base font-bold text-gray-900 leading-snug mb-1.5 group-hover:text-[#990F3D] transition-colors">
                  {entry.headline}
                </h3>
                <p className="text-sm text-gray-500 leading-relaxed line-clamp-2">
                  {entry.summary}
                </p>
                {entry.the_so_what && (
                  <p className="mt-2 text-xs text-gray-600 leading-relaxed border-l-2 border-[#990F3D] pl-2.5 line-clamp-2">
                    <span className="font-semibold text-[#990F3D]">Why it matters</span>{' '}
                    {entry.the_so_what}
                  </p>
                )}
              </div>

              {/* Key stat — hidden on mobile, shown inline in content on small screens */}
              {entry.key_stat && (
                <div className="flex-shrink-0 text-right w-44 hidden md:block">
                  <div className="text-2xl font-extrabold text-[#990F3D] leading-none">{entry.key_stat.number}</div>
                  <div className="text-xs text-gray-400 leading-snug mt-1.5">{entry.key_stat.label}</div>
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
