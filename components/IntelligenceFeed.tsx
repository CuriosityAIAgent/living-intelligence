'use client';

import { useState } from 'react';
import Link from 'next/link';
import { TYPE_LABELS } from '@/lib/constants';

type IntelligenceEntry = {
  id: string;
  type: string;
  headline: string;
  company: string;
  company_name: string;
  date: string;
  source_name: string;
  source_url: string;
  source_verified: boolean;
  image_url: string;
  summary: string;
  key_stat: { number: string; label: string } | null;
  tags: { capability: string; region: string; segment: string; theme: string[] };
  featured: boolean;
};

const REGIONS = [
  { value: 'all', label: 'All Regions' },
  { value: 'us', label: 'United States' },
  { value: 'emea', label: 'EMEA' },
  { value: 'asia', label: 'Asia Pacific' },
  { value: 'latam', label: 'LatAm' },
];

const CAPABILITIES = [
  { value: 'all', label: 'All Topics' },
  { value: 'advisor_productivity', label: 'Advisor Productivity' },
  { value: 'client_experience', label: 'Client Experience' },
  { value: 'investment_analytics', label: 'Investment & Research' },
  { value: 'operations_compliance', label: 'Operations & Compliance' },
  { value: 'new_business_models', label: 'New Business Models' },
  { value: 'client_acquisition', label: 'Client Acquisition' },
];

function formatDateShort(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

export default function IntelligenceFeed({ entries, leadStoryId }: {
  entries: IntelligenceEntry[];
  leadStoryId: string;
}) {
  const [region, setRegion] = useState('all');
  const [capability, setCapability] = useState('all');

  const leadStory = entries.find(e => e.id === leadStoryId) || entries[0];

  const filtered = entries.filter(e => {
    if (e.id === leadStory?.id) return false; // lead story shown separately
    const regionMatch = region === 'all' || e.tags.region === region;
    const capMatch = capability === 'all' || e.tags.capability === capability;
    return regionMatch && capMatch;
  });

  return (
    <div>
      {/* Lead Story */}
      {leadStory && (
        <section className="mb-12">
          <div className="mb-3">
            <p className="section-label">Lead Story</p>
            <hr className="section-rule" />
          </div>
          <Link href={`/intelligence/${leadStory.id}`} className="group block">
            <div className="grid md:grid-cols-5 gap-6 items-start">
              <div className="md:col-span-2 bg-gray-50 border border-gray-100 rounded h-52 flex items-center justify-center overflow-hidden">
                {leadStory.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={leadStory.image_url}
                    alt={leadStory.company_name}
                    className="max-h-24 max-w-[60%] object-contain"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                ) : (
                  <span className="text-gray-300 text-sm font-medium">{leadStory.company_name}</span>
                )}
              </div>
              <div className="md:col-span-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`type-badge badge-${leadStory.type}`}>
                    {TYPE_LABELS[leadStory.type]}
                  </span>
                  <span className="text-xs text-gray-400">{leadStory.company_name}</span>
                  <span className="text-xs text-gray-300">·</span>
                  <span className="text-xs text-gray-400">{formatDateShort(leadStory.date)}</span>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 leading-snug mb-3 group-hover:text-[#1B2E5E] transition-colors">
                  {leadStory.headline}
                </h2>
                <p className="text-sm text-gray-600 leading-relaxed line-clamp-3">{leadStory.summary}</p>
                {leadStory.key_stat && (
                  <div className="mt-4">
                    <span className="text-2xl font-extrabold text-[#1B2E5E]">{leadStory.key_stat.number}</span>
                    <span className="text-xs text-gray-400 ml-2">{leadStory.key_stat.label}</span>
                  </div>
                )}
                <div className="mt-3 flex items-center gap-2">
                  <span className="text-xs text-gray-400">Source:</span>
                  {leadStory.source_verified && leadStory.source_url ? (
                    <a href={leadStory.source_url} target="_blank" rel="noopener noreferrer" className="text-xs text-[#1B2E5E] hover:underline font-medium">
                      {leadStory.source_name} ↗
                    </a>
                  ) : (
                    <span className="text-xs text-gray-400">{leadStory.source_name}</span>
                  )}
                  {!leadStory.source_verified && (
                    <span className="text-[9px] text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                      Pending verification
                    </span>
                  )}
                </div>
              </div>
            </div>
          </Link>
        </section>
      )}

      {/* Filters */}
      <section className="mb-8">
        <div className="mb-4">
          <p className="section-label">Intelligence Feed</p>
          <hr className="section-rule" />
        </div>

        {/* Region filter */}
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">Region:</span>
          {REGIONS.map(r => (
            <button
              key={r.value}
              onClick={() => setRegion(r.value)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors font-medium ${
                region === r.value
                  ? 'bg-[#1B2E5E] text-white border-[#1B2E5E]'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-[#1B2E5E] hover:text-[#1B2E5E]'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>

        {/* Capability filter */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">Topic:</span>
          {CAPABILITIES.map(c => (
            <button
              key={c.value}
              onClick={() => setCapability(c.value)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors font-medium ${
                capability === c.value
                  ? 'bg-[#1B2E5E] text-white border-[#1B2E5E]'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-[#1B2E5E] hover:text-[#1B2E5E]'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </section>

      {/* Results count */}
      <div className="mb-4 text-xs text-gray-400">
        {filtered.length} {filtered.length === 1 ? 'story' : 'stories'}
        {region !== 'all' && ` in ${REGIONS.find(r => r.value === region)?.label}`}
        {capability !== 'all' && ` · ${CAPABILITIES.find(c => c.value === capability)?.label}`}
      </div>

      {/* Story grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400 text-sm border border-dashed border-gray-200 rounded">
          No stories match this filter combination yet.
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map(entry => (
            <Link
              key={entry.id}
              href={`/intelligence/${entry.id}`}
              className="article-card rounded p-4 block group flex flex-col"
            >
              {/* Logo */}
              <div className="h-8 mb-3 flex items-center">
                {entry.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={entry.image_url}
                    alt={entry.company_name}
                    className="max-h-7 max-w-[90px] object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).replaceWith(
                        Object.assign(document.createElement('span'), {
                          className: 'text-xs text-gray-400 font-medium',
                          textContent: entry.company_name,
                        })
                      );
                    }}
                  />
                ) : (
                  <span className="text-xs text-gray-400 font-medium">{entry.company_name}</span>
                )}
              </div>

              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <span className={`type-badge badge-${entry.type}`}>
                  {TYPE_LABELS[entry.type]}
                </span>
                <span className="text-[10px] text-gray-300">·</span>
                <span className="text-[10px] text-gray-400 uppercase">{entry.tags.region}</span>
              </div>

              <h3 className="text-sm font-bold text-gray-900 leading-snug mb-2 group-hover:text-[#1B2E5E] transition-colors flex-1">
                {entry.headline}
              </h3>

              {entry.key_stat && (
                <div className="mb-2">
                  <span className="text-base font-extrabold text-[#1B2E5E]">{entry.key_stat.number}</span>
                  <span className="text-[10px] text-gray-400 ml-1.5">{entry.key_stat.label}</span>
                </div>
              )}

              <div className="mt-auto flex items-center justify-between pt-2 border-t border-gray-50">
                <span className="text-[10px] text-gray-400">{formatDateShort(entry.date)}</span>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-gray-400">{entry.source_name}</span>
                  {!entry.source_verified && (
                    <span className="text-[8px] text-amber-500" title="Source pending verification">⚠</span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
