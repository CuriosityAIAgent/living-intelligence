import { getAllCompetitors, SEGMENT_LABELS } from '@/lib/data';
import { Navigation } from '@/components/Navigation';
import { MaturityBadge } from '@/components/MaturityBadge';
import Link from 'next/link';

export default function CompetitorsPage() {
  const competitors = getAllCompetitors();
  const segmentOrder = ['global_bank', 'regional_champion', 'digital_disruptor', 'ria_independent', 'ai_native'];

  const grouped = segmentOrder.map(seg => ({
    segment: seg,
    label: SEGMENT_LABELS[seg],
    competitors: competitors.filter(c => c.segment === seg),
  })).filter(g => g.competitors.length > 0);

  return (
    <div className="min-h-screen bg-[#0A1628]">
      <Navigation />
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-8">
          <div className="text-[#C9A84C] text-xs font-semibold uppercase tracking-widest mb-2">Intelligence Database</div>
          <h1 className="text-3xl font-bold text-[#F0F4F8] mb-2">Competitor Profiles</h1>
          <p className="text-[#7A9BB5] text-sm">Deep intelligence on every tracked competitor. Click any card to see their full AI strategy.</p>
        </div>

        {grouped.map(group => (
          <div key={group.segment} className="mb-10">
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-xs font-bold text-[#C9A84C] uppercase tracking-widest">{group.label}</h2>
              <div className="flex-1 border-t border-[#1E3A5F]"></div>
              <span className="text-xs text-[#7A9BB5]">{group.competitors.length} tracked</span>
            </div>
            <div className="grid grid-cols-3 gap-4">
              {group.competitors.map(competitor => {
                const capCount = Object.keys(competitor.capabilities).length;
                const scaledCaps = Object.values(competitor.capabilities).filter(c => c.maturity === 'scaled').length;
                const deployedCaps = Object.values(competitor.capabilities).filter(c => c.maturity === 'deployed').length;
                return (
                  <Link key={competitor.id} href={`/competitors/${competitor.id}`}>
                    <div className="card card-hover p-5 h-full group">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold uppercase"
                            style={{ backgroundColor: competitor.color + '30', border: `1px solid ${competitor.color}50` }}
                          >
                            {competitor.name.slice(0, 2)}
                          </div>
                          <div>
                            <div className="text-sm font-bold text-[#F0F4F8] group-hover:text-[#C9A84C] transition-colors">{competitor.name}</div>
                            <MaturityBadge maturity={competitor.overall_maturity} size="sm" />
                          </div>
                        </div>
                      </div>
                      <p className="text-xs text-[#7A9BB5] leading-relaxed mb-4 line-clamp-3">{competitor.ai_strategy_summary}</p>
                      <div className="border-t border-[#1E3A5F] pt-3 flex items-center justify-between">
                        <div className="text-xs text-[#7A9BB5]">
                          <span className="font-semibold text-[#C9A84C]">{capCount}</span> capability areas
                        </div>
                        <div className="flex gap-2">
                          {scaledCaps > 0 && <span className="text-[10px] text-[#10B981]">{scaledCaps} scaled</span>}
                          {deployedCaps > 0 && <span className="text-[10px] text-[#3B82F6]">{deployedCaps} deployed</span>}
                        </div>
                      </div>
                      <div className="mt-2 text-[10px] text-[#7A9BB5] italic">{competitor.headline_metric}</div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </main>
    </div>
  );
}
