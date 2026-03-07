import { getLatestPulse, getAllCompetitors } from '@/lib/data';
import { Navigation } from '@/components/Navigation';
import { MaturityBadge } from '@/components/MaturityBadge';
import Link from 'next/link';

const IMPACT_COLORS: Record<string, string> = {
  high: 'text-red-400 bg-red-400/10 border-red-400/20',
  medium: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
  low: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
};

const SEGMENT_LABELS: Record<string, string> = {
  global_bank: 'Global Bank',
  regional_champion: 'Regional Champion',
  digital_disruptor: 'Digital Disruptor',
  ria_independent: 'RIA / Independent',
  ai_native: 'AI-Native',
};

function getCompetitorColor(id: string): string {
  const colors: Record<string, string> = {
    'morgan-stanley': '#1E3A8A',
    'goldman-sachs': '#1A3A5C',
    'ubs': '#E31837',
    'dbs': '#E01A22',
    'robinhood': '#00C805',
    'lpl-financial': '#003087',
    'bofa-merrill': '#E31837',
    'hsbc': '#DB0011',
    'wealthfront': '#059669',
    'citi-private-bank': '#003B70',
    'arta-ai': '#7C3AED',
    'altruist': '#0F172A',
  };
  return colors[id] || '#C9A84C';
}

export default function HomePage() {
  const pulse = getLatestPulse();
  const competitors = getAllCompetitors();

  const scaledCount = competitors.filter(c => c.overall_maturity === 'scaled').length;
  const deployedCount = competitors.filter(c => c.overall_maturity === 'deployed').length;

  return (
    <div className="min-h-screen bg-[#0A1628]">
      <Navigation />
      <main className="max-w-7xl mx-auto px-6 py-8">

        {/* Hero Header */}
        <div className="mb-10">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[#C9A84C] text-xs font-semibold uppercase tracking-widest">Week of March 7, 2026</span>
            <span className="text-[#1E3A5F]">·</span>
            <span className="text-[#7A9BB5] text-xs">{pulse.total_developments_tracked} developments tracked</span>
          </div>
          <h1 className="text-3xl font-bold text-[#F0F4F8] mb-2">
            What just happened in AI &amp;<br/>
            <span className="text-[#C9A84C]">Wealth Management</span>
          </h1>
          <p className="text-[#7A9BB5] text-sm max-w-xl">
            The developments that matter most, synthesized for senior leaders across J.P. Morgan Asset &amp; Wealth Management.
          </p>
        </div>

        {/* Stat Banner */}
        <div className="grid grid-cols-4 gap-4 mb-10">
          <div className="col-span-1 card p-5 border-l-2 border-l-[#C9A84C]">
            <div className="text-3xl font-bold text-[#C9A84C] mb-1">{pulse.stat_of_the_week.number}</div>
            <div className="text-xs font-semibold text-[#F0F4F8] mb-1">{pulse.stat_of_the_week.label}</div>
            <div className="text-xs text-[#7A9BB5] leading-relaxed">{pulse.stat_of_the_week.context}</div>
          </div>
          <div className="card p-5 text-center">
            <div className="text-3xl font-bold text-[#10B981] mb-1">{scaledCount}</div>
            <div className="text-xs text-[#7A9BB5]">competitors at<br/><span className="text-[#10B981] font-semibold">Scale</span></div>
          </div>
          <div className="card p-5 text-center">
            <div className="text-3xl font-bold text-[#3B82F6] mb-1">{deployedCount}</div>
            <div className="text-xs text-[#7A9BB5]">competitors<br/><span className="text-[#3B82F6] font-semibold">Deployed</span></div>
          </div>
          <div className="card p-5 text-center">
            <div className="text-3xl font-bold text-[#F59E0B] mb-1">{competitors.length}</div>
            <div className="text-xs text-[#7A9BB5]">competitors<br/><span className="text-[#F59E0B] font-semibold">tracked</span></div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-8">
          {/* Main: Developments */}
          <div className="col-span-2">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-[#F0F4F8]">Developments That Matter</h2>
              <span className="text-xs text-[#7A9BB5]">Click to explore</span>
            </div>
            <div className="space-y-4">
              {pulse.headline_cards.map((card) => (
                <Link key={card.id} href={`/competitors/${card.competitor_id}`}>
                  <div className="card card-hover p-5 group">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex items-center gap-3 flex-1">
                        <div
                          className="w-9 h-9 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0 uppercase"
                          style={{ backgroundColor: getCompetitorColor(card.competitor_id) + '40', border: `1px solid ${getCompetitorColor(card.competitor_id)}60` }}
                        >
                          {card.competitor_name.slice(0, 2)}
                        </div>
                        <div>
                          <div className="text-xs text-[#7A9BB5] mb-0.5">{card.competitor_name} · {SEGMENT_LABELS[card.segment] || card.segment}</div>
                          <h3 className="text-sm font-semibold text-[#F0F4F8] group-hover:text-[#C9A84C] transition-colors leading-tight">
                            {card.headline}
                          </h3>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border uppercase tracking-wide ${IMPACT_COLORS[card.impact]}`}>
                          {card.impact} impact
                        </span>
                        <span className="text-xs text-[#7A9BB5] capitalize bg-[#0A1628] px-2 py-0.5 rounded-full border border-[#1E3A5F]">
                          {card.region.toUpperCase()}
                        </span>
                      </div>
                    </div>
                    <p className="text-sm text-[#7A9BB5] leading-relaxed mb-3">{card.detail}</p>
                    <div className="border-t border-[#1E3A5F] pt-3">
                      <div className="flex items-start gap-2">
                        <span className="text-[#C9A84C] text-xs font-bold shrink-0 mt-0.5">→ IMPLICATION</span>
                        <p className="text-xs text-[#C9A84C]/80 leading-relaxed">{card.implication}</p>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Sidebar: Talking Points + Quick Links */}
          <div className="space-y-6">
            {/* Talking Points */}
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-[#C9A84C]">💬</span>
                <h3 className="text-sm font-bold text-[#F0F4F8]">Talking Points for Leaders</h3>
              </div>
              <p className="text-[10px] text-[#7A9BB5] mb-4 uppercase tracking-wide">Ready for team meetings &amp; board discussions</p>
              <div className="space-y-4">
                {pulse.talking_points.map((point, i) => (
                  <div key={i} className="flex gap-3">
                    <div className="w-5 h-5 rounded-full bg-[#C9A84C]/10 border border-[#C9A84C]/30 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-[#C9A84C] text-[10px] font-bold">{i + 1}</span>
                    </div>
                    <p className="text-xs text-[#7A9BB5] leading-relaxed">{point}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Nav */}
            <div className="card p-5">
              <h3 className="text-sm font-bold text-[#F0F4F8] mb-4">Explore the Portal</h3>
              <div className="space-y-2">
                <Link href="/landscape" className="flex items-center justify-between p-3 rounded-lg hover:bg-[#162B55] transition-colors group">
                  <div>
                    <div className="text-sm font-medium text-[#F0F4F8] group-hover:text-[#C9A84C] transition-colors">AI Landscape</div>
                    <div className="text-xs text-[#7A9BB5]">Who is doing what, across all dimensions</div>
                  </div>
                  <span className="text-[#7A9BB5] group-hover:text-[#C9A84C]">→</span>
                </Link>
                <Link href="/competitors" className="flex items-center justify-between p-3 rounded-lg hover:bg-[#162B55] transition-colors group">
                  <div>
                    <div className="text-sm font-medium text-[#F0F4F8] group-hover:text-[#C9A84C] transition-colors">Competitor Profiles</div>
                    <div className="text-xs text-[#7A9BB5]">Deep dive on each competitor</div>
                  </div>
                  <span className="text-[#7A9BB5] group-hover:text-[#C9A84C]">→</span>
                </Link>
              </div>
            </div>

            {/* Maturity Legend */}
            <div className="card p-5">
              <h3 className="text-xs font-bold text-[#7A9BB5] uppercase tracking-wide mb-3">Maturity Scale</h3>
              <div className="space-y-2">
                {[
                  { level: 'scaled', desc: 'Proven at full production scale' },
                  { level: 'deployed', desc: 'Live in production environments' },
                  { level: 'piloting', desc: 'Active pilots underway' },
                  { level: 'announced', desc: 'Publicly committed, not yet live' },
                ].map(({ level, desc }) => (
                  <div key={level} className="flex items-center gap-3">
                    <MaturityBadge maturity={level} size="sm" />
                    <span className="text-xs text-[#7A9BB5]">{desc}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
