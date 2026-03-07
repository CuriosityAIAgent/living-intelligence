import { getCompetitor, getCapabilities, getAllCompetitors, SEGMENT_LABELS } from '@/lib/data';
import { Navigation } from '@/components/Navigation';
import { MaturityBadge } from '@/components/MaturityBadge';
import { notFound } from 'next/navigation';
import Link from 'next/link';

export async function generateStaticParams() {
  const competitors = getAllCompetitors();
  return competitors.map(c => ({ slug: c.id }));
}

function getMaturityColor(maturity: string): string {
  const colors: Record<string, string> = {
    scaled: '#10B981',
    deployed: '#3B82F6',
    piloting: '#F97316',
    announced: '#F59E0B',
  };
  return colors[maturity] || '#1E3A5F';
}

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
    <div className="min-h-screen bg-[#0A1628]">
      <Navigation />
      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 mb-6 text-xs text-[#7A9BB5]">
          <Link href="/competitors" className="hover:text-[#C9A84C] transition-colors">Competitors</Link>
          <span>/</span>
          <span className="text-[#F0F4F8]">{competitor.name}</span>
        </div>

        {/* Header */}
        <div className="card p-6 mb-8">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-xl font-bold uppercase"
                style={{ backgroundColor: competitor.color + '30', border: `1px solid ${competitor.color}50` }}
              >
                {competitor.name.slice(0, 2)}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-[#F0F4F8] mb-1">{competitor.name}</h1>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-[#7A9BB5] bg-[#0A1628] px-3 py-1 rounded-full border border-[#1E3A5F]">
                    {SEGMENT_LABELS[competitor.segment] || competitor.segment}
                  </span>
                  <MaturityBadge maturity={competitor.overall_maturity} />
                  {competitor.regions.map(r => (
                    <span key={r} className="text-[10px] text-[#7A9BB5] uppercase">{r}</span>
                  ))}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[#C9A84C] font-bold text-lg">{competitor.headline_metric}</div>
              <div className="text-xs text-[#7A9BB5] mt-1">headline metric</div>
            </div>
          </div>

          <div className="mt-5 pt-5 border-t border-[#1E3A5F]">
            <div className="text-xs text-[#C9A84C] font-semibold uppercase tracking-wide mb-2">AI Strategy</div>
            <p className="text-sm text-[#7A9BB5] leading-relaxed">{competitor.ai_strategy_summary}</p>
          </div>

          <div className="mt-4 pt-4 border-t border-[#1E3A5F] grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-[#7A9BB5] mb-1">Headline Initiative</div>
              <div className="text-sm font-semibold text-[#F0F4F8]">{competitor.headline_initiative}</div>
            </div>
            {competitor.head_of_ai && (
              <div>
                <div className="text-xs text-[#7A9BB5] mb-1">AI Leadership</div>
                <div className="text-sm font-semibold text-[#F0F4F8]">{competitor.head_of_ai.name}</div>
                <div className="text-xs text-[#7A9BB5]">{competitor.head_of_ai.title}</div>
              </div>
            )}
          </div>
        </div>

        {/* Capability Details */}
        <div className="mb-6">
          <h2 className="text-lg font-bold text-[#F0F4F8] mb-1">AI Capability Breakdown</h2>
          <p className="text-xs text-[#7A9BB5]">Assessed March 7, 2026 — {capEntries.length} of {capabilities.length} capability areas active</p>
        </div>

        <div className="space-y-4 mb-8">
          {capEntries.map(({ cap, entry }) => {
            if (!entry) return null;
            return (
              <div key={cap.id} id={cap.id} className="card p-6" style={{ borderLeft: `2px solid ${getMaturityColor(entry.maturity)}` }}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="text-xs text-[#7A9BB5] uppercase tracking-wide mb-1">{cap.label}</div>
                    <h3 className="text-sm font-bold text-[#F0F4F8]">{entry.headline}</h3>
                  </div>
                  <MaturityBadge maturity={entry.maturity} />
                </div>
                <p className="text-sm text-[#7A9BB5] leading-relaxed mb-4">{entry.detail}</p>

                {entry.evidence.length > 0 && (
                  <div className="mb-4">
                    <div className="text-xs font-semibold text-[#7A9BB5] uppercase tracking-wide mb-2">Evidence</div>
                    <ul className="space-y-1">
                      {entry.evidence.map((e, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-[#7A9BB5]">
                          <span className="text-[#C9A84C] mt-0.5 shrink-0">✓</span>
                          <span>{e}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="bg-[#C9A84C]/5 border border-[#C9A84C]/20 rounded-lg p-3">
                  <div className="text-xs font-semibold text-[#C9A84C] uppercase tracking-wide mb-1">JPM Implication</div>
                  <p className="text-xs text-[#C9A84C]/80 leading-relaxed">{entry.jpm_implication}</p>
                  {entry.jpm_segments_affected.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {entry.jpm_segments_affected.map(seg => (
                        <span key={seg} className="text-[9px] px-2 py-0.5 rounded bg-[#C9A84C]/10 text-[#C9A84C] border border-[#C9A84C]/20 font-semibold">{seg}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {noActivityCaps.length > 0 && (
          <div className="card p-4 mb-8">
            <div className="text-xs font-semibold text-[#7A9BB5] uppercase tracking-wide mb-2">No tracked activity in:</div>
            <div className="flex flex-wrap gap-2">
              {noActivityCaps.map(cap => (
                <span key={cap.id} className="text-xs text-[#7A9BB5] bg-[#0A1628] px-3 py-1 rounded-full border border-[#1E3A5F]">{cap.label}</span>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between text-xs text-[#7A9BB5]">
          <Link href="/competitors" className="hover:text-[#C9A84C] transition-colors">← All Competitors</Link>
          <span>Last updated: {competitor.last_updated}</span>
        </div>
      </main>
    </div>
  );
}
