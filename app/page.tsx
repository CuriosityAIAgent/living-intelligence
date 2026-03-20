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

  // 3 most recent entries for preview
  const previewEntries = allEntries.slice(0, 3);

  // Key stats for the numbers bar
  const keyStats = allEntries.filter(e => e.key_stat).slice(0, 3);

  return (
    <div className="min-h-screen">
      <Header />

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section className="bg-[#1C1C2E] border-b border-[#2A2A3E]">
        <div className="max-w-6xl mx-auto px-6 py-16 md:py-24">
          <div className="max-w-3xl">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#990F3D] mb-6">
              Living Intelligence · AI in Wealth Management
            </p>
            <h1 className="text-4xl md:text-5xl font-extrabold text-white leading-tight mb-6">
              Every week, AI reshapes<br className="hidden md:block" /> wealth management.
            </h1>
            <p className="text-lg text-[#9999BB] leading-relaxed mb-10 max-w-2xl">
              Curated intelligence on every significant AI development across the industry.
              Who is doing what, what it means, and what to watch — structured for senior executives,
              not developers.
            </p>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <Link
                href="/intelligence"
                className="inline-flex items-center gap-2 bg-[#990F3D] hover:bg-[#7a0c31] text-white text-[14px] font-bold px-6 py-3 rounded transition-colors no-underline"
              >
                Start reading free
                <span>→</span>
              </Link>
              <span className="text-[12px] text-[#555568]">
                No sign-up required · Updated weekly
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ── NUMBERS BAR ──────────────────────────────────────────────────── */}
      <section className="bg-[#141420] border-b border-[#2A2A3E]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-wrap items-center gap-x-8 gap-y-3 py-4">
            <div className="flex items-center gap-2">
              <span className="text-2xl font-extrabold text-white">{allEntries.length}</span>
              <span className="text-[11px] uppercase tracking-wider text-[#555568]">Developments tracked</span>
            </div>
            <span className="text-[#2A2A3E] hidden md:block">|</span>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-extrabold text-white">{competitors.length}</span>
              <span className="text-[11px] uppercase tracking-wider text-[#555568]">Institutions mapped</span>
            </div>
            <span className="text-[#2A2A3E] hidden md:block">|</span>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-extrabold text-white">{capabilities.length}</span>
              <span className="text-[11px] uppercase tracking-wider text-[#555568]">Capability dimensions</span>
            </div>
            <span className="text-[#2A2A3E] hidden md:block">|</span>
            <div className="flex items-center gap-2">
              <span className="text-[11px] uppercase tracking-wider text-[#555568]">Updated</span>
              <span className="text-[11px] font-bold text-[#990F3D] uppercase tracking-wider">Weekly</span>
            </div>
          </div>
        </div>
      </section>

      <main>

        {/* ── WHAT'S INSIDE ─────────────────────────────────────────────── */}
        <section className="bg-[#FDF8F2] border-b border-gray-200 py-16">
          <div className="max-w-6xl mx-auto px-6">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#990F3D] mb-2">What&apos;s Inside</p>
            <hr className="border-t-2 border-[#990F3D] mb-10 w-12" />
            <div className="grid md:grid-cols-3 gap-8">

              <div className="border-t-2 border-[#990F3D] pt-6">
                <h3 className="text-[17px] font-bold text-gray-900 mb-3">Market Intelligence</h3>
                <p className="text-sm text-gray-600 leading-relaxed mb-4">
                  Every significant AI product launch, partnership, milestone, and strategic move
                  across wealth management — tracked, source-verified, and structured so you can
                  absorb it in minutes.
                </p>
                <Link href="/intelligence" className="text-[12px] font-bold text-[#990F3D] hover:underline uppercase tracking-wider">
                  Browse all developments →
                </Link>
              </div>

              <div className="border-t-2 border-[#990F3D] pt-6">
                <h3 className="text-[17px] font-bold text-gray-900 mb-3">The AI Landscape</h3>
                <p className="text-sm text-gray-600 leading-relaxed mb-4">
                  {competitors.length} institutions mapped across {capabilities.length} capability dimensions —
                  wirehouses, private banks, digital disruptors, and AI-native platforms.
                  See who leads, who lags, and where the gaps are widening.
                </p>
                <Link href="/landscape" className="text-[12px] font-bold text-[#990F3D] hover:underline uppercase tracking-wider">
                  View the landscape →
                </Link>
              </div>

              <div className="border-t-2 border-[#990F3D] pt-6">
                <h3 className="text-[17px] font-bold text-gray-900 mb-3">Thought Leadership</h3>
                <p className="text-sm text-gray-600 leading-relaxed mb-4">
                  Curated essays and reports from leading thinkers on what AI actually means
                  for financial services — from Sam Altman and Dario Amodei to practitioners
                  inside the industry.
                </p>
                <Link href="/thought-leadership" className="text-[12px] font-bold text-[#990F3D] hover:underline uppercase tracking-wider">
                  Read the essays →
                </Link>
              </div>

            </div>
          </div>
        </section>

        {/* ── SAMPLE INTELLIGENCE ───────────────────────────────────────── */}
        <section className="py-16 bg-white border-b border-gray-200">
          <div className="max-w-6xl mx-auto px-6">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#990F3D] mb-2">Recent Intelligence</p>
            <hr className="border-t-2 border-[#990F3D] mb-8 w-12" />
            <div className="space-y-4 mb-8">
              {previewEntries.map(entry => (
                <Link
                  key={entry.id}
                  href={`/intelligence/${entry.id}`}
                  className="flex items-start gap-5 p-5 border border-gray-100 rounded hover:border-[#990F3D] hover:shadow-sm transition-all no-underline group"
                >
                  {/* Logo */}
                  <div className="w-12 h-12 bg-gray-50 border border-gray-100 rounded flex items-center justify-center flex-shrink-0">
                    {entry.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={entry.image_url} alt={entry.company_name} className="max-h-8 max-w-10 object-contain" />
                    ) : (
                      <span className="text-[9px] font-bold text-gray-400">{entry.company_name.slice(0, 4)}</span>
                    )}
                  </div>
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm ${TYPE_COLORS[entry.type] || 'bg-gray-100 text-gray-600'}`}>
                        {TYPE_LABELS[entry.type]}
                      </span>
                      <span className="text-xs text-gray-400">{entry.company_name}</span>
                      <span className="text-gray-200">·</span>
                      <span className="text-xs text-gray-400">{formatDateShort(entry.date)}</span>
                    </div>
                    <h3 className="text-[15px] font-bold text-gray-900 leading-snug group-hover:text-[#990F3D] transition-colors">
                      {entry.headline}
                    </h3>
                  </div>
                  {/* Key stat */}
                  {entry.key_stat && (
                    <div className="flex-shrink-0 text-right hidden sm:block">
                      <div className="text-xl font-extrabold text-[#990F3D]">{entry.key_stat.number}</div>
                      <div className="text-[10px] text-gray-400 max-w-[90px] leading-tight">{entry.key_stat.label}</div>
                    </div>
                  )}
                </Link>
              ))}
            </div>
            <Link
              href="/intelligence"
              className="inline-flex items-center gap-2 text-sm font-bold text-[#990F3D] hover:underline"
            >
              View all {allEntries.length} developments →
            </Link>
          </div>
        </section>

        {/* ── WHO IT'S FOR ──────────────────────────────────────────────── */}
        <section className="py-16 bg-[#FDF8F2] border-b border-gray-200">
          <div className="max-w-6xl mx-auto px-6">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#990F3D] mb-2">Who Reads This</p>
            <hr className="border-t-2 border-[#990F3D] mb-10 w-12" />
            <div className="grid md:grid-cols-2 gap-x-16 gap-y-8 max-w-4xl">
              {[
                {
                  role: 'Chief Executive Officers',
                  desc: 'Need the competitive picture before board meetings and strategy off-sites. Not the details — the signal.',
                },
                {
                  role: 'Chief Digital & Technology Officers',
                  desc: 'Building the AI roadmap. Need to know what peers are shipping, what\'s working, and where to allocate.',
                },
                {
                  role: 'Heads of Wealth Management',
                  desc: 'Watching which platforms are pulling ahead in advisor productivity and client engagement through AI.',
                },
                {
                  role: 'Chief Investment & Strategy Officers',
                  desc: 'Understanding how AI is reshaping investment research, portfolio construction, and client advisory models.',
                },
              ].map(item => (
                <div key={item.role} className="flex gap-4">
                  <div className="flex-shrink-0 mt-1 w-1 h-12 bg-[#990F3D] rounded-full" />
                  <div>
                    <h4 className="text-[14px] font-bold text-gray-900 mb-1">{item.role}</h4>
                    <p className="text-sm text-gray-500 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── KEY NUMBERS ────────────────────────────────────────────────── */}
        {keyStats.length > 0 && (
          <section className="py-16 bg-white border-b border-gray-200">
            <div className="max-w-6xl mx-auto px-6">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#990F3D] mb-2">By the Numbers</p>
              <hr className="border-t-2 border-[#990F3D] mb-10 w-12" />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {keyStats.map(e => (
                  <Link
                    key={e.id}
                    href={`/intelligence/${e.id}`}
                    className="group no-underline"
                  >
                    <div className="text-4xl font-extrabold text-[#990F3D] mb-2 group-hover:opacity-80 transition-opacity">
                      {e.key_stat!.number}
                    </div>
                    <div className="text-sm text-gray-600 leading-snug mb-2">{e.key_stat!.label}</div>
                    <div className="text-[11px] text-gray-400 group-hover:text-[#990F3D] transition-colors font-medium">
                      {e.source_name} · Read source →
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ── PRICING ───────────────────────────────────────────────────── */}
        <section className="py-16 bg-[#1C1C2E]">
          <div className="max-w-6xl mx-auto px-6">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#990F3D] mb-2">Access</p>
            <hr className="border-t-2 border-[#990F3D] mb-10 w-12" />
            <div className="grid md:grid-cols-2 gap-8 max-w-3xl">

              {/* Individual */}
              <div className="border border-[#2A2A3E] rounded p-8">
                <p className="text-[11px] uppercase tracking-widest text-[#555568] mb-4">Individual</p>
                <div className="flex items-end gap-2 mb-2">
                  <span className="text-4xl font-extrabold text-white">$399</span>
                  <span className="text-[#555568] mb-1.5 text-sm">/ month</span>
                </div>
                <p className="text-[#555568] text-sm mb-6">or $3,500 / year &nbsp;·&nbsp; save two months</p>
                <ul className="space-y-3 mb-8">
                  {[
                    'Full intelligence feed, updated weekly',
                    'AI Landscape — 27 institutions, 7 dimensions',
                    'Thought Leadership library',
                    'Notifications on new developments',
                    '14-day free trial, no card required',
                  ].map(f => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-[#9999BB]">
                      <span className="text-[#990F3D] mt-0.5 flex-shrink-0">→</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/intelligence"
                  className="block text-center bg-[#990F3D] hover:bg-[#7a0c31] text-white text-sm font-bold py-3 px-6 rounded transition-colors no-underline"
                >
                  Start free trial
                </Link>
              </div>

              {/* Team */}
              <div className="border border-[#2A2A3E] rounded p-8 relative">
                <div className="absolute top-4 right-4">
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-[#990F3D] text-white px-2 py-1 rounded-sm">
                    Popular
                  </span>
                </div>
                <p className="text-[11px] uppercase tracking-widest text-[#555568] mb-4">Team</p>
                <div className="flex items-end gap-2 mb-2">
                  <span className="text-4xl font-extrabold text-white">Custom</span>
                </div>
                <p className="text-[#555568] text-sm mb-6">3–10 seats &nbsp;·&nbsp; volume pricing</p>
                <ul className="space-y-3 mb-8">
                  {[
                    'Everything in Individual',
                    'Shared team dashboard',
                    'Custom onboarding session',
                    'Quarterly briefing call',
                    'Priority feature requests',
                  ].map(f => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-[#9999BB]">
                      <span className="text-[#990F3D] mt-0.5 flex-shrink-0">→</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <a
                  href="mailto:hello@tigerai.tech"
                  className="block text-center border border-[#990F3D] text-[#990F3D] hover:bg-[#990F3D] hover:text-white text-sm font-bold py-3 px-6 rounded transition-colors no-underline"
                >
                  Get in touch
                </a>
              </div>

            </div>
          </div>
        </section>

        {/* ── FINAL CTA ─────────────────────────────────────────────────── */}
        <section className="py-20 bg-[#FDF8F2] border-t border-gray-200">
          <div className="max-w-2xl mx-auto px-6 text-center">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#990F3D] mb-6">
              Living Intelligence
            </p>
            <h2 className="text-3xl font-extrabold text-gray-900 mb-4 leading-tight">
              The intelligence layer for wealth management&apos;s AI era.
            </h2>
            <p className="text-base text-gray-500 mb-10 leading-relaxed">
              Senior executives at the world&apos;s leading wealth management firms are reading this now.
              Start your free trial — no credit card required.
            </p>
            <Link
              href="/intelligence"
              className="inline-flex items-center gap-2 bg-[#990F3D] hover:bg-[#7a0c31] text-white text-[14px] font-bold px-8 py-4 rounded transition-colors no-underline"
            >
              Start reading free
              <span>→</span>
            </Link>
          </div>
        </section>

      </main>

      {/* ── FOOTER ────────────────────────────────────────────────────────── */}
      <footer className="bg-[#141420] border-t border-[#2A2A3E] py-8">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p className="text-[13px] font-bold text-white mb-1">AI in Wealth Management</p>
            <p className="text-[11px] text-[#444458]">All sources linked. Updated regularly.</p>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/intelligence" className="text-[12px] text-[#555568] hover:text-white transition-colors">Intelligence</Link>
            <Link href="/thought-leadership" className="text-[12px] text-[#555568] hover:text-white transition-colors">Thought Leadership</Link>
            <Link href="/landscape" className="text-[12px] text-[#555568] hover:text-white transition-colors">Landscape</Link>
          </div>
        </div>
      </footer>

    </div>
  );
}
