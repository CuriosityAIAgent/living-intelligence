import { getCompetitor, getCapabilities, getAllCompetitors, getIntelligenceByCompany, SEGMENT_LABELS } from '@/lib/data';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { notFound } from 'next/navigation';
import Link from 'next/link';

export async function generateStaticParams() {
  const competitors = getAllCompetitors();
  return competitors.map(c => ({ slug: c.id }));
}

const MATURITY_BORDER: Record<string, string> = {
  scaled:      'border-l-green-500',
  deployed:    'border-l-blue-500',
  piloting:    'border-l-orange-400',
  announced:   'border-l-yellow-400',
  no_activity: 'border-l-gray-300',
};

const MATURITY_BADGE: Record<string, string> = {
  scaled:      'text-green-700 bg-green-50 border-green-200',
  deployed:    'text-blue-700 bg-blue-50 border-blue-200',
  piloting:    'text-orange-700 bg-orange-50 border-orange-200',
  announced:   'text-yellow-700 bg-yellow-50 border-yellow-200',
  no_activity: 'text-gray-500 bg-gray-50 border-gray-200',
};

export default async function CompetitorPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const competitor = getCompetitor(slug);
  if (!competitor) notFound();
  const capabilities = getCapabilities();
  const relatedIntelligence = getIntelligenceByCompany(slug);

  const capEntries = capabilities.map(cap => ({
    cap,
    entry: competitor.capabilities[cap.id] || null,
  })).filter(({ entry }) => entry !== null && entry.maturity !== 'no_activity');

  // Merge: capabilities with no_activity maturity + capabilities with no entry at all
  const noActivityCaps = capabilities.filter(cap =>
    !competitor.capabilities[cap.id] ||
    competitor.capabilities[cap.id]?.maturity === 'no_activity'
  );

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="max-w-4xl mx-auto px-6 py-10 flex-1">

        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-xs text-gray-400 mb-8">
          <Link href="/landscape" className="hover:text-[#990F3D]">Landscape</Link>
          <span>›</span>
          <Link href="/competitors" className="hover:text-[#990F3D]">Profiles</Link>
          <span>›</span>
          <span className="text-gray-600">{competitor.name}</span>
        </nav>

        {/* Company name + segment */}
        <div className="mb-2">
          <h1 className="text-2xl font-bold text-gray-900">{competitor.name}</h1>
          <span className="text-xs text-gray-500">
            {SEGMENT_LABELS[competitor.segment] || competitor.segment}
          </span>
        </div>

        {/* Headline metric — big, bold, first thing after the name */}
        <div className="mb-6">
          <p className="text-xl font-extrabold text-[#990F3D] leading-snug">{competitor.headline_metric}</p>
        </div>

        {/* AI Strategy */}
        <div className="border-l-2 border-[#990F3D] pl-5 mb-8">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-[#990F3D] mb-3">AI Strategy</p>
          <p className="text-[15px] text-gray-800 leading-relaxed">{competitor.ai_strategy_summary}</p>
        </div>

        {/* Headline Initiative */}
        <div className="border-t border-gray-200 pt-5 mb-8">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1.5">Headline Initiative</p>
          <p className="text-sm font-semibold text-gray-800">{competitor.headline_initiative}</p>
        </div>

        {/* Capabilities */}
        <div className="mb-4">
          <h2 className="text-base font-bold text-gray-900 mb-1">AI Capability Breakdown</h2>
          <p className="text-xs text-gray-400">
            {capEntries.length} of {capabilities.length} capability areas with tracked activity · Last updated {competitor.last_updated}
          </p>
        </div>

        <div className="space-y-4 mb-8">
          {capEntries.map(({ cap, entry }) => {
            if (!entry) return null;
            const borderClass = MATURITY_BORDER[entry.maturity] || 'border-l-gray-300';
            const badgeClass = MATURITY_BADGE[entry.maturity] || 'text-gray-600 bg-gray-50 border-gray-200';
            return (
              <div key={cap.id} id={cap.id} className={`border border-gray-200 border-l-2 ${borderClass} rounded p-5`}>
                <div className="flex items-start justify-between gap-4 mb-2">
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">{cap.label}</p>
                    <h3 className="text-sm font-bold text-gray-900">{entry.headline}</h3>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wide flex-shrink-0 ${badgeClass}`}>
                    {entry.maturity.replace('_', ' ')}
                  </span>
                </div>
                <p className="text-sm text-gray-600 leading-relaxed mb-4">{entry.detail}</p>

                {entry.evidence.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Evidence</p>
                    <ul className="space-y-1">
                      {entry.evidence.map((e, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-gray-600">
                          <span className={`mt-0.5 flex-shrink-0 ${entry.maturity === 'no_activity' ? 'text-gray-400' : 'text-green-600'}`}>
                            {entry.maturity === 'no_activity' ? '—' : '✓'}
                          </span>
                          <span>{e}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {entry.sources && entry.sources.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Sources</p>
                    <div className="flex flex-col gap-1">
                      {entry.sources.map((s, i) => (
                        <a key={i} href={s.url} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs text-[#990F3D] hover:underline">
                          {s.name} <span className="text-gray-400">↗</span>
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {noActivityCaps.length > 0 && (
          <div className="border border-gray-100 rounded p-4 mb-8 bg-gray-50">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">No tracked activity in:</p>
            <div className="flex flex-wrap gap-2 mb-3">
              {noActivityCaps.map(cap => (
                <span key={cap.id} className="text-xs text-gray-500 bg-white px-3 py-1 rounded border border-gray-200">
                  {cap.label}
                </span>
              ))}
            </div>
            <p className="text-xs text-gray-400 leading-relaxed">
              No publicly disclosed AI capabilities in {noActivityCaps.length === 1
                ? 'this area'
                : 'these areas'} based on available sources. Assessments are updated as new evidence emerges.
            </p>
          </div>
        )}

        {/* Related Intelligence */}
        {relatedIntelligence.length > 0 && (
          <div className="mb-8">
            <div className="flex items-baseline justify-between mb-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-[#990F3D] mb-1">Intelligence Feed</p>
                <h2 className="text-base font-bold text-gray-900">Latest from {competitor.name}</h2>
              </div>
              <Link href={`/intelligence?company=${slug}`} className="text-xs text-[#990F3D] hover:underline">
                View all →
              </Link>
            </div>
            <div className="space-y-3">
              {relatedIntelligence.map(entry => (
                <Link key={entry.id} href={`/intelligence/${entry.id}`}
                  className="block border border-gray-200 rounded p-4 hover:border-[#990F3D] hover:shadow-sm transition-all group">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
                          {entry.type.replace('_', ' ')}
                        </span>
                        <span className="text-[11px] text-gray-400">
                          {new Date(entry.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      </div>
                      <h3 className="text-sm font-semibold text-gray-900 leading-snug group-hover:text-[#990F3D] transition-colors line-clamp-2">
                        {entry.headline}
                      </h3>
                      {entry.the_so_what && (
                        <p className="text-xs text-gray-500 mt-1.5 leading-relaxed line-clamp-2">{entry.the_so_what}</p>
                      )}
                    </div>
                    {entry.key_stat && (
                      <div className="text-right flex-shrink-0">
                        <div className="text-lg font-extrabold text-[#990F3D] leading-none">{entry.key_stat.number}</div>
                        <div className="text-[10px] text-gray-400 mt-0.5 max-w-[120px] leading-tight">{entry.key_stat.label.split('—')[0].trim()}</div>
                      </div>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between text-xs text-gray-400">
          <Link href="/competitors" className="hover:text-[#990F3D] transition-colors">← All Profiles</Link>
          <span>Last updated: {competitor.last_updated}</span>
        </div>

      </main>

      <Footer />
    </div>
  );
}
