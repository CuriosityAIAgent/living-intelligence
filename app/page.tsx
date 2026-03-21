import Link from 'next/link';
import Header from '@/components/Header';
import { getAllIntelligence, getAllCompetitors, getCapabilities, formatDateShort, TYPE_LABELS } from '@/lib/data';

const TYPE_COLORS: Record<string, string> = {
  partnership: 'bg-blue-50 text-blue-700',
  product_launch: 'bg-purple-50 text-purple-700',
  milestone: 'bg-green-50 text-green-700',
  strategy_move: 'bg-orange-50 text-orange-700',
  market_signal: 'bg-rose-50 text-rose-700',
};

export default function LandingPage() {
  const allEntries = getAllIntelligence();
  const competitors = getAllCompetitors();
  const capabilities = getCapabilities();
  const previewEntries = allEntries.slice(0, 3);

  return (
    <div className="min-h-screen">
      <Header />

      {/* HERO */}
      <section className="bg-[#1C1C2E]">
        <div className="max-w-6xl mx-auto px-6 py-20 md:py-28">
          <div className="max-w-2xl">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#990F3D] mb-5">
              Living Intelligence
            </p>
            <h1 className="text-4xl md:text-[52px] font-extrabold text-white leading-[1.1] mb-6">
              AI in wealth management.<br />Curated for leaders.
            </h1>
            <p className="text-[17px] text-[#9999BB] leading-relaxed mb-10">
              Every significant AI move across private banks, wirehouses, RIAs, and digital platforms —
              tracked, verified, and structured so you can stay ahead in minutes, not hours.
            </p>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <Link
                href="/intelligence"
                className="inline-flex items-center gap-2 bg-[#990F3D] hover:bg-[#7a0c31] text-white text-[15px] font-bold px-7 py-3.5 rounded transition-colors no-underline"
              >
                Start reading free →
              </Link>
              <span className="text-[12px] text-[#444458]">No sign-up · Updated weekly</span>
            </div>
          </div>
        </div>
        {/* Stats strip */}
        <div className="border-t border-[#2A2A3E]">
          <div className="max-w-6xl mx-auto px-6 py-4 flex flex-wrap gap-x-10 gap-y-2">
            {[
              { n: allEntries.length, label: 'Developments tracked' },
              { n: competitors.length, label: 'Institutions mapped' },
              { n: capabilities.length, label: 'Capability dimensions' },
            ].map(s => (
              <div key={s.label} className="flex items-center gap-2.5">
                <span className="text-[22px] font-extrabold text-white">{s.n}</span>
                <span className="text-[11px] uppercase tracking-wider text-[#444458]">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* RECENT INTELLIGENCE */}
      <section className="py-14 bg-[#FDF8F2] border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#990F3D] mb-1">Recent Intelligence</p>
          <hr className="border-t-2 border-[#990F3D] mb-8 w-10" />
          <div className="space-y-3 mb-7">
            {previewEntries.map(entry => (
              <Link
                key={entry.id}
                href={`/intelligence/${entry.id}`}
                className="flex items-start gap-4 p-5 bg-white border border-gray-100 rounded hover:border-[#990F3D] transition-all no-underline group"
              >
                <div className="w-10 h-10 bg-gray-50 border border-gray-100 rounded flex items-center justify-center flex-shrink-0">
                  {entry.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={entry.image_url} alt={entry.company_name} className="max-h-7 max-w-8 object-contain" />
                  ) : (
                    <span className="text-[9px] font-bold text-gray-400">{entry.company_name.slice(0, 3)}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-sm ${TYPE_COLORS[entry.type] || 'bg-gray-100 text-gray-600'}`}>
                      {TYPE_LABELS[entry.type]}
                    </span>
                    <span className="text-xs text-gray-400">{entry.company_name} · {formatDateShort(entry.date)}</span>
                  </div>
                  <h3 className="text-[14px] font-bold text-gray-900 leading-snug group-hover:text-[#990F3D] transition-colors">
                    {entry.headline}
                  </h3>
                </div>
                {entry.key_stat && (
                  <div className="flex-shrink-0 text-right hidden sm:block min-w-[70px]">
                    <div className="text-lg font-extrabold text-[#990F3D]">{entry.key_stat.number}</div>
                    <div className="text-[9px] text-gray-400 leading-tight">{entry.key_stat.label.slice(0, 40)}…</div>
                  </div>
                )}
              </Link>
            ))}
          </div>
          <Link href="/intelligence" className="text-[12px] font-bold text-[#990F3D] hover:underline uppercase tracking-wider">
            View all {allEntries.length} developments →
          </Link>
        </div>
      </section>

      {/* WHAT'S INSIDE */}
      <section className="py-14 bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#990F3D] mb-1">What&apos;s Inside</p>
          <hr className="border-t-2 border-[#990F3D] mb-8 w-10" />
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                title: 'Market Intelligence',
                desc: `${allEntries.length} verified developments. Every AI product launch, partnership, and strategic move — structured and source-linked.`,
                href: '/intelligence',
                cta: 'Browse intelligence →',
              },
              {
                title: 'AI Landscape',
                desc: `${competitors.length} institutions mapped across ${capabilities.length} capability dimensions. See who leads, who lags, and where the gaps are widening.`,
                href: '/landscape',
                cta: 'View landscape →',
              },
              {
                title: 'Thought Leadership',
                desc: 'Curated essays from Sam Altman, Dario Amodei, and practitioners inside the industry on what AI means for wealth management.',
                href: '/thought-leadership',
                cta: 'Read essays →',
              },
            ].map(item => (
              <div key={item.title} className="border-t-2 border-[#990F3D] pt-5">
                <h3 className="text-[15px] font-bold text-gray-900 mb-2">{item.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed mb-4">{item.desc}</p>
                <Link href={item.href} className="text-[11px] font-bold text-[#990F3D] hover:underline uppercase tracking-wider">
                  {item.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section className="py-14 bg-[#1C1C2E]">
        <div className="max-w-6xl mx-auto px-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#990F3D] mb-1">Access</p>
          <hr className="border-t-2 border-[#990F3D] mb-10 w-10" />
          <div className="grid md:grid-cols-2 gap-6 max-w-2xl">

            <div className="border border-[#2A2A3E] rounded-lg p-7">
              <p className="text-[11px] uppercase tracking-widest text-[#555568] mb-5">Individual</p>
              <div className="mb-1">
                <span className="text-4xl font-extrabold text-white">$500</span>
                <span className="text-[#555568] text-sm ml-1.5">/ month</span>
              </div>
              <p className="text-[#555568] text-sm mb-6">
                or <span className="text-white font-semibold">$5,000 / year</span>
                <span className="ml-2 text-[10px] bg-[#990F3D] text-white px-1.5 py-0.5 rounded-sm font-bold">2 MONTHS FREE</span>
              </p>
              <ul className="space-y-2.5 mb-7 text-sm text-[#9999BB]">
                {['Full intelligence feed', 'AI Landscape matrix', 'Thought Leadership library', 'Weekly notifications', '14-day free trial'].map(f => (
                  <li key={f} className="flex items-center gap-2">
                    <span className="text-[#990F3D]">→</span>{f}
                  </li>
                ))}
              </ul>
              <Link
                href="/intelligence"
                className="block text-center bg-[#990F3D] hover:bg-[#7a0c31] text-white text-sm font-bold py-3 rounded transition-colors no-underline"
              >
                Start free trial
              </Link>
            </div>

            <div className="border border-[#2A2A3E] rounded-lg p-7 flex flex-col justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-widest text-[#555568] mb-5">Team</p>
                <p className="text-4xl font-extrabold text-white mb-1">Custom</p>
                <p className="text-[#555568] text-sm mb-6">3–10 seats · volume pricing</p>
                <ul className="space-y-2.5 mb-7 text-sm text-[#9999BB]">
                  {['Everything in Individual', 'Shared team access', 'Quarterly briefing call', 'Custom onboarding'].map(f => (
                    <li key={f} className="flex items-center gap-2">
                      <span className="text-[#990F3D]">→</span>{f}
                    </li>
                  ))}
                </ul>
              </div>
              <a
                href="mailto:hello@livingintel.ai"
                className="block text-center border border-[#990F3D] text-[#990F3D] hover:bg-[#990F3D] hover:text-white text-sm font-bold py-3 rounded transition-colors no-underline"
              >
                Get in touch
              </a>
            </div>

          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="py-16 bg-[#FDF8F2] text-center">
        <div className="max-w-xl mx-auto px-6">
          <h2 className="text-2xl font-extrabold text-gray-900 mb-3">
            Stay ahead of AI in wealth management.
          </h2>
          <p className="text-sm text-gray-500 mb-8">Start free. No credit card required.</p>
          <Link
            href="/intelligence"
            className="inline-flex items-center gap-2 bg-[#990F3D] hover:bg-[#7a0c31] text-white text-[14px] font-bold px-8 py-4 rounded transition-colors no-underline"
          >
            Start reading free →
          </Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-[#141420] border-t border-[#2A2A3E] py-7">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p className="text-[13px] font-bold text-white mb-0.5">Living Intelligence · livingintel.ai</p>
            <p className="text-[11px] text-[#444458]">AI in Wealth Management. All sources linked. Updated regularly.</p>
          </div>
          <div className="flex items-center gap-5">
            <Link href="/intelligence" className="text-[12px] text-[#555568] hover:text-white transition-colors">Intelligence</Link>
            <Link href="/thought-leadership" className="text-[12px] text-[#555568] hover:text-white transition-colors">Thought Leadership</Link>
            <Link href="/landscape" className="text-[12px] text-[#555568] hover:text-white transition-colors">Landscape</Link>
            <a href="mailto:hello@livingintel.ai" className="text-[12px] text-[#555568] hover:text-white transition-colors">Contact</a>
          </div>
        </div>
      </footer>

    </div>
  );
}
