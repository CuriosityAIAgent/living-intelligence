import Link from 'next/link';
import Header from '@/components/Header';
import SectionLabel from '@/components/SectionLabel';
import { getAllIntelligence, formatDateShort, TYPE_LABELS } from '@/lib/data';

const TYPE_FILTERS = [
  { value: '', label: 'All' },
  { value: 'partnership', label: 'Partnerships' },
  { value: 'product_launch', label: 'Product Launches' },
  { value: 'milestone', label: 'Milestones' },
  { value: 'strategy_move', label: 'Strategy' },
  { value: 'market_signal', label: 'Market Signals' },
];

export default function IntelligencePage() {
  const entries = getAllIntelligence();

  const byType: Record<string, typeof entries> = {};
  entries.forEach(e => {
    if (!byType[e.type]) byType[e.type] = [];
    byType[e.type].push(e);
  });

  return (
    <div className="min-h-screen">
      <Header />

      <main className="max-w-6xl mx-auto px-6 py-10">

        {/* Page header */}
        <div className="mb-10 pb-6 border-b border-gray-200">
          <p className="section-label mb-1">Market Intelligence</p>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            What Companies Are Doing with AI
          </h1>
          <p className="text-sm text-gray-500">
            {entries.length} developments tracked · Wealth management &amp; financial services · Updated March 2026
          </p>
        </div>

        {/* All entries — list view */}
        <section>
          <SectionLabel label={`All Intelligence — ${entries.length} entries`} />
          <div className="space-y-4">
            {entries.map((entry) => (
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
                    />
                  ) : (
                    <span className="text-xs text-gray-400 font-bold text-center leading-tight px-1">
                      {entry.company_name.slice(0, 4)}
                    </span>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className={`type-badge badge-${entry.type}`}>
                      {TYPE_LABELS[entry.type]}
                    </span>
                    <span className="text-xs text-gray-400">{entry.company_name}</span>
                    <span className="text-xs text-gray-300">·</span>
                    <span className="text-xs text-gray-400">{formatDateShort(entry.date)}</span>
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
        </section>

      </main>

    </div>
  );
}
