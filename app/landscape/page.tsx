import { getAllCompetitors, getCapabilities, SEGMENT_LABELS } from '@/lib/data';
import { Navigation } from '@/components/Navigation';
import { MaturityBadge } from '@/components/MaturityBadge';
import Link from 'next/link';

export default function LandscapePage() {
  const competitors = getAllCompetitors();
  const capabilities = getCapabilities();

  // Group by segment
  const segmentOrder = ['global_bank', 'regional_champion', 'digital_disruptor', 'ria_independent', 'ai_native'];
  const grouped = segmentOrder.map(seg => ({
    segment: seg,
    label: SEGMENT_LABELS[seg],
    competitors: competitors.filter(c => c.segment === seg),
  })).filter(g => g.competitors.length > 0);

  return (
    <div className="min-h-screen bg-[#0A1628]">
      <Navigation />
      <main className="max-w-[1400px] mx-auto px-6 py-8">
        <div className="mb-8">
          <div className="text-[#C9A84C] text-xs font-semibold uppercase tracking-widest mb-2">Competitive Intelligence</div>
          <h1 className="text-3xl font-bold text-[#F0F4F8] mb-2">AI Landscape</h1>
          <p className="text-[#7A9BB5] text-sm max-w-2xl">
            Where every competitor stands across every AI capability dimension.
            Click any cell to see the full intelligence briefing.
          </p>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-6 mb-8">
          <span className="text-xs text-[#7A9BB5] font-semibold uppercase tracking-wide">Maturity:</span>
          {['scaled', 'deployed', 'piloting', 'announced'].map(m => (
            <MaturityBadge key={m} maturity={m} size="sm" />
          ))}
          <div className="flex items-center gap-2 ml-4">
            <div className="w-8 h-5 rounded bg-white/5 border border-white/10"></div>
            <span className="text-xs text-[#7A9BB5]">No activity</span>
          </div>
        </div>

        {/* Matrix */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="text-left p-3 text-xs font-semibold text-[#7A9BB5] uppercase tracking-wide w-48 sticky left-0 bg-[#0A1628]">Competitor</th>
                {capabilities.map(cap => (
                  <th key={cap.id} className="p-3 text-center min-w-[110px]">
                    <div className="text-[10px] font-semibold text-[#7A9BB5] uppercase tracking-wide leading-tight">{cap.label}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {grouped.map(group => (
                <>
                  <tr key={`group-${group.segment}`}>
                    <td colSpan={capabilities.length + 1} className="px-3 py-2">
                      <div className="text-[10px] font-bold text-[#C9A84C] uppercase tracking-widest pt-4 pb-1 border-b border-[#1E3A5F]">
                        {group.label}
                      </div>
                    </td>
                  </tr>
                  {group.competitors.map(competitor => (
                    <tr key={competitor.id} className="hover:bg-[#0F2040]/50 transition-colors group">
                      <td className="p-3 sticky left-0 bg-[#0A1628] group-hover:bg-[#0F2040]/50">
                        <Link href={`/competitors/${competitor.id}`} className="flex items-center gap-3 hover:text-[#C9A84C] transition-colors">
                          <div
                            className="w-7 h-7 rounded flex items-center justify-center text-white text-[10px] font-bold shrink-0 uppercase"
                            style={{ backgroundColor: competitor.color + '30', border: `1px solid ${competitor.color}50` }}
                          >
                            {competitor.name.slice(0, 2)}
                          </div>
                          <div>
                            <div className="text-xs font-semibold text-[#F0F4F8]">{competitor.name}</div>
                            <div className="text-[10px] text-[#7A9BB5]">{competitor.headline_metric}</div>
                          </div>
                        </Link>
                      </td>
                      {capabilities.map(cap => {
                        const entry = competitor.capabilities[cap.id];
                        const maturity = entry?.maturity || 'none';
                        return (
                          <td key={cap.id} className="p-2 text-center">
                            {entry && maturity !== 'none' ? (
                              <Link href={`/competitors/${competitor.id}#${cap.id}`}>
                                <div className={`maturity-bg-${maturity} rounded-lg p-2 cursor-pointer hover:opacity-80 transition-opacity`} title={entry.headline}>
                                  <MaturityBadge maturity={maturity} size="sm" />
                                  <div className="text-[9px] text-[#7A9BB5] mt-1 leading-tight line-clamp-2">{entry.headline.split(':')[0]}</div>
                                </div>
                              </Link>
                            ) : (
                              <div className="maturity-bg-none rounded-lg p-3 text-[#1E3A5F] text-xs">—</div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </>
              ))}
            </tbody>
          </table>
        </div>

        {/* Summary Stats */}
        <div className="mt-10 grid grid-cols-4 gap-4">
          {['scaled', 'deployed', 'piloting', 'announced'].map(maturity => {
            const count = competitors.filter(c => c.overall_maturity === maturity).length;
            return (
              <div key={maturity} className={`card p-4 maturity-bg-${maturity}`}>
                <div className={`text-2xl font-bold maturity-${maturity} mb-1`}>{count}</div>
                <div className="text-xs text-[#7A9BB5]">competitors at <span className={`font-semibold maturity-${maturity}`}>{maturity}</span></div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
