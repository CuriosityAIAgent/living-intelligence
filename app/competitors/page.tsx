import { getAllCompetitors, SEGMENT_LABELS } from '@/lib/data';
import Header from '@/components/Header';
import SectionLabel from '@/components/SectionLabel';
import Link from 'next/link';

const MATURITY_COLORS: Record<string, string> = {
  scaled: 'text-green-700 bg-green-50 border-green-200',
  deployed: 'text-blue-700 bg-blue-50 border-blue-200',
  piloting: 'text-orange-700 bg-orange-50 border-orange-200',
  announced: 'text-yellow-700 bg-yellow-50 border-yellow-200',
};

export default function CompetitorsPage() {
  const competitors = getAllCompetitors();
  const segmentOrder = ['global_bank', 'regional_champion', 'digital_disruptor', 'retail_digital', 'ria_independent', 'uhnw_digital', 'ai_native'];

  const grouped = segmentOrder.map(seg => ({
    segment: seg,
    label: SEGMENT_LABELS[seg] || seg,
    competitors: competitors.filter(c => c.segment === seg),
  })).filter(g => g.competitors.length > 0);

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main className="max-w-6xl mx-auto px-6 py-10">
        <div className="mb-8 pb-6 border-b border-gray-200">
          <p className="section-label mb-1">Institution Profiles</p>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Company Profiles</h1>
          <p className="text-sm text-gray-500">
            Deep AI capability profiles for {competitors.length} institutions. Click any card for full detail.
          </p>
        </div>

        {grouped.map(group => (
          <div key={group.segment} className="mb-10">
            <SectionLabel label={`${group.label} — ${group.competitors.length} tracked`} />
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {group.competitors.map(competitor => {
                const capCount = Object.keys(competitor.capabilities).length;
                const scaledCaps = Object.values(competitor.capabilities).filter(c => c.maturity === 'scaled').length;
                const mc = MATURITY_COLORS[competitor.overall_maturity] || 'text-gray-600 bg-gray-50 border-gray-200';
                return (
                  <Link
                    key={competitor.id}
                    href={`/competitors/${competitor.id}`}
                    className="article-card rounded p-5 block group"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="font-bold text-gray-900 text-sm mb-1 group-hover:text-[#1B2E5E] transition-colors">
                          {competitor.name}
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wide ${mc}`}>
                          {competitor.overall_maturity}
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 leading-relaxed mb-3 line-clamp-3">
                      {competitor.ai_strategy_summary}
                    </p>
                    <div className="border-t border-gray-100 pt-3 flex items-center justify-between">
                      <span className="text-xs text-gray-400">{capCount} capabilities tracked</span>
                      {scaledCaps > 0 && (
                        <span className="text-xs text-green-700 font-medium">{scaledCaps} scaled</span>
                      )}
                    </div>
                    <div className="mt-1 text-[10px] text-[#1B2E5E] font-medium italic">
                      {competitor.headline_metric}
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
