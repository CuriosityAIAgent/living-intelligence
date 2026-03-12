import { getCompetitor, getCapabilities, getAllCompetitors, SEGMENT_LABELS } from '@/lib/data';
import Header from '@/components/Header';
import { notFound } from 'next/navigation';
import Link from 'next/link';

export async function generateStaticParams() {
  const competitors = getAllCompetitors();
  return competitors.map(c => ({ slug: c.id }));
}

const MATURITY_BORDER: Record<string, string> = {
  scaled:    'border-l-green-500',
  deployed:  'border-l-blue-500',
  piloting:  'border-l-orange-400',
  announced: 'border-l-yellow-400',
};

const MATURITY_BADGE: Record<string, string> = {
  scaled:    'text-green-700 bg-green-50 border-green-200',
  deployed:  'text-blue-700 bg-blue-50 border-blue-200',
  piloting:  'text-orange-700 bg-orange-50 border-orange-200',
  announced: 'text-yellow-700 bg-yellow-50 border-yellow-200',
};

export default async function CompetitorPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const competitor = getCompetitor(slug);
  if (!competitor) notFound();
  const capabilities = getCapabilities();

  const capEntries = capabilities.map(cap => ({
    cap,
    entry: competitor.capabilities[cap.id] || null,
  })).filter(({ entry }) => entry !== null);

  const noActivityCaps = capabilities.filter(cap => !competitor.capabilities[cap.id]);

  return (
    <div className="min-h-screen">
      <Header />
      <main className="max-w-4xl mx-auto px-6 py-10">

        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-xs text-gray-400 mb-8">
          <Link href="/landscape" className="hover:text-[#990F3D]">Landscape</Link>
          <span>›</span>
          <Link href="/competitors" className="hover:text-[#990F3D]">Profiles</Link>
          <span>›</span>
          <span className="text-gray-600">{competitor.name}</span>
        </nav>

        {/* Header card */}
        <div className="border border-gray-200 rounded p-6 mb-8">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">{competitor.name}</h1>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-gray-500 px-2 py-0.5 bg-gray-100 rounded">
                  {SEGMENT_LABELS[competitor.segment] || competitor.segment}
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wide ${MATURITY_BADGE[competitor.overall_maturity] || 'text-gray-500 bg-gray-50 border-gray-200'}`}>
                  {competitor.overall_maturity}
                </span>
                {competitor.regions.map(r => (
                  <span key={r} className="text-[10px] text-gray-400 uppercase">{r}</span>
                ))}
              </div>
            </div>
            <div className="text-right">
              <div className="text-xl font-extrabold text-[#990F3D]">{competitor.headline_metric}</div>
              <div className="text-xs text-gray-400 mt-0.5">headline metric</div>
            </div>
          </div>

          <div className="mt-5 pt-5 border-t border-gray-100">
            <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-2">AI Strategy</p>
            <p className="text-sm text-gray-700 leading-relaxed">{competitor.ai_strategy_summary}</p>
          </div>

          <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-400 mb-1">Headline Initiative</p>
              <p className="text-sm font-semibold text-gray-800">{competitor.headline_initiative}</p>
            </div>
            {competitor.head_of_ai && (
              <div>
                <p className="text-xs text-gray-400 mb-1">AI Leadership</p>
                <p className="text-sm font-semibold text-gray-800">{competitor.head_of_ai.name}</p>
                <p className="text-xs text-gray-500">{competitor.head_of_ai.title}</p>
              </div>
            )}
          </div>
        </div>

        {/* Capabilities */}
        <div className="mb-4">
          <h2 className="text-base font-bold text-gray-900 mb-1">AI Capability Breakdown</h2>
          <p className="text-xs text-gray-400">
            {capEntries.length} of {capabilities.length} capability areas active · Assessed March 2026
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
                    {entry.maturity}
                  </span>
                </div>
                <p className="text-sm text-gray-600 leading-relaxed mb-4">{entry.detail}</p>

                {entry.evidence.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Evidence</p>
                    <ul className="space-y-1">
                      {entry.evidence.map((e, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-gray-600">
                          <span className="text-green-600 mt-0.5 flex-shrink-0">✓</span>
                          <span>{e}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {noActivityCaps.length > 0 && (
          <div className="border border-gray-100 rounded p-4 mb-8 bg-gray-50">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">No tracked activity in:</p>
            <div className="flex flex-wrap gap-2">
              {noActivityCaps.map(cap => (
                <span key={cap.id} className="text-xs text-gray-500 bg-white px-3 py-1 rounded border border-gray-200">
                  {cap.label}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between text-xs text-gray-400">
          <Link href="/competitors" className="hover:text-[#990F3D] transition-colors">← All Profiles</Link>
          <span>Last updated: {competitor.last_updated}</span>
        </div>

      </main>
    </div>
  );
}
