import Header from '@/components/Header';
import Link from 'next/link';
import { getAllIntelligence } from '@/lib/data';
import { TYPE_LABELS } from '@/lib/constants';

function formatDateShort(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

export default function LatestPage() {
  const entries = getAllIntelligence().slice(0, 13);
  const lead = entries[0];
  const grid = entries.slice(1, 5);
  const rest = entries.slice(5);

  return (
    <div className="min-h-screen">
      <Header />

      <main className="max-w-6xl mx-auto px-6 py-10">

        <div className="mb-8 pb-6 border-b border-gray-200">
          <p className="section-label mb-1">Latest Developments</p>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            AI in Wealth Management
          </h1>
          <p className="text-sm text-gray-500">
            The most recent developments across {entries.length}+ tracked firms
          </p>
        </div>

        {/* Lead story */}
        {lead && (
          <Link
            href={`/intelligence/${lead.id}`}
            className="block mb-8 p-6 bg-white border border-gray-200 rounded-lg hover:border-[#990F3D] transition-colors group"
          >
            <div className="flex gap-6 items-start">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`type-badge badge-${lead.type}`}>
                    {TYPE_LABELS[lead.type] ?? lead.type}
                  </span>
                  <span className="text-xs text-gray-400">{lead.company_name}</span>
                  <span className="text-xs text-gray-400">· {formatDateShort(lead.date)}</span>
                  {(lead.source_count ?? lead.sources?.length ?? 0) > 1 && (
                    <span className="text-[10px] text-gray-400 border border-gray-200 rounded px-1.5 py-0.5">
                      {lead.source_count ?? lead.sources?.length} sources
                    </span>
                  )}
                </div>
                <h2 className="text-xl font-bold text-gray-900 leading-snug mb-2 group-hover:text-[#990F3D] transition-colors">
                  {lead.headline}
                </h2>
                <p className="text-sm text-gray-600 leading-relaxed mb-3 line-clamp-3">
                  {lead.summary}
                </p>
                {lead.the_so_what && (
                  <p className="text-xs text-gray-600 leading-relaxed border-l-2 border-[#990F3D] pl-2.5 line-clamp-2">
                    <span className="font-semibold text-[#990F3D]">Why it matters</span>{' '}
                    {lead.the_so_what}
                  </p>
                )}
              </div>
              {lead.key_stat && (
                <div className="flex-shrink-0 text-right w-44">
                  <div className="text-3xl font-extrabold text-[#990F3D] leading-none">{lead.key_stat.number}</div>
                  <div className="text-xs text-gray-400 leading-snug mt-1.5">{lead.key_stat.label}</div>
                </div>
              )}
            </div>
          </Link>
        )}

        {/* Featured grid — 4 cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {grid.map(entry => (
            <Link
              key={entry.id}
              href={`/intelligence/${entry.id}`}
              className="block p-5 bg-white border border-gray-200 rounded-lg hover:border-[#990F3D] transition-colors group"
            >
              <div className="flex items-center gap-2 mb-1.5">
                <span className={`type-badge badge-${entry.type}`}>
                  {TYPE_LABELS[entry.type] ?? entry.type}
                </span>
                <span className="text-xs text-gray-400 truncate">{entry.company_name}</span>
                <span className="text-xs text-gray-400 flex-shrink-0">· {formatDateShort(entry.date)}</span>
              </div>
              <h3 className="text-sm font-bold text-gray-900 leading-snug mb-1.5 group-hover:text-[#990F3D] transition-colors line-clamp-2">
                {entry.headline}
              </h3>
              {entry.key_stat && (
                <div className="flex items-baseline gap-2 mt-2">
                  <span className="text-lg font-extrabold text-[#990F3D]">{entry.key_stat.number}</span>
                  <span className="text-[10px] text-gray-400">{entry.key_stat.label}</span>
                </div>
              )}
            </Link>
          ))}
        </div>

        {/* Rest — compact list */}
        {rest.length > 0 && (
          <div className="space-y-3 mb-8">
            {rest.map(entry => (
              <Link
                key={entry.id}
                href={`/intelligence/${entry.id}`}
                className="block p-4 bg-white border border-gray-200 rounded-lg hover:border-[#990F3D] transition-colors group flex items-center gap-4"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`type-badge badge-${entry.type}`}>
                      {TYPE_LABELS[entry.type] ?? entry.type}
                    </span>
                    <span className="text-xs text-gray-400 truncate">{entry.company_name}</span>
                    <span className="text-xs text-gray-400 flex-shrink-0">· {formatDateShort(entry.date)}</span>
                  </div>
                  <h3 className="text-sm font-bold text-gray-900 leading-snug group-hover:text-[#990F3D] transition-colors truncate">
                    {entry.headline}
                  </h3>
                </div>
                {entry.key_stat && (
                  <div className="flex-shrink-0 text-right">
                    <span className="text-base font-extrabold text-[#990F3D]">{entry.key_stat.number}</span>
                  </div>
                )}
              </Link>
            ))}
          </div>
        )}

        {/* View all */}
        <div className="text-center">
          <Link
            href="/intelligence"
            className="inline-block text-sm font-medium text-[#990F3D] hover:text-[#7a0c31] transition-colors"
          >
            View all intelligence entries →
          </Link>
        </div>

      </main>
    </div>
  );
}
