import RotatingHeadline from '@/components/RotatingHeadline';

export default function LandingPage() {
  return (
    <div className="min-h-screen">

      {/* ─── SECTION 1: HERO ─── */}
      <section className="bg-[#1C1C2E]">
        <div className="max-w-5xl mx-auto px-6 pt-16 pb-20 md:pt-24 md:pb-28">

          {/* Masthead wordmark */}
          <p className="text-[13px] font-extrabold uppercase tracking-[0.25em] text-white mb-16 md:mb-20">
            Living Intelligence
          </p>

          {/* Headline block */}
          <div className="max-w-3xl">
            <RotatingHeadline />
            <p className="text-[17px] md:text-[19px] text-[#9999BB] leading-relaxed mb-10 max-w-2xl">
              37+ wealth management firms monitored daily &mdash; and growing. 7 AI capability dimensions. AI-powered discovery. Human-verified editorial. A living competitive intelligence platform.
            </p>
            <a
              href="#pricing"
              className="inline-block bg-[#990F3D] hover:bg-[#7a0c31] text-white text-[15px] font-bold px-8 py-4 rounded transition-colors no-underline"
            >
              Start your 7-day trial
            </a>
          </div>
        </div>

        {/* Stats strip */}
        <div className="border-t border-[#2A2A3E]">
          <div className="max-w-5xl mx-auto px-6 py-5 flex flex-wrap gap-x-8 gap-y-3">
            {[
              { n: '37+', label: 'Institutions & Growing' },
              { n: '7', label: 'Capability Dimensions' },
              { n: '43+', label: 'Verified Developments' },
              { n: '●', label: 'Daily Monitoring' },
            ].map((s) => (
              <div key={s.label} className="flex items-center gap-2.5">
                {s.n === '●' ? (
                  <span className="text-[10px] text-[#990F3D]">●</span>
                ) : (
                  <span className="text-[20px] font-extrabold text-white">{s.n}</span>
                )}
                <span className="text-[12px] uppercase tracking-wider text-[#8888A0]">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── SECTION 2: THE CHALLENGE ─── */}
      <section className="py-16 md:py-20 bg-[#FDF8F2]">
        <div className="max-w-3xl mx-auto px-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#990F3D] mb-2">
            The Challenge
          </p>
          <hr className="border-t-2 border-[#990F3D] mb-10 w-10" />

          <div className="space-y-6 text-[17px] text-gray-700 leading-relaxed">
            <p>
              Last quarter, 14 wealth management firms launched or expanded AI capabilities. Most went unreported outside of industry press.
            </p>
            <p>
              A competitive landscape analysis covering this ground costs $75,000&ndash;$250,000 from a consulting firm. It&apos;s outdated the week it&apos;s delivered. Analyst subscriptions from Gartner or Forrester start at $25,000 a year.
            </p>
            <p className="text-gray-900 font-semibold">
              Living Intelligence tracks it all, continuously, for a fraction of the cost.
            </p>
          </div>
        </div>
      </section>

      {/* ─── SECTION 2B: THE PLATFORM ─── */}
      <section className="py-16 md:py-20 bg-white border-t border-gray-200">
        <div className="max-w-5xl mx-auto px-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#990F3D] mb-2">
            The Platform
          </p>
          <hr className="border-t-2 border-[#990F3D] mb-4 w-10" />
          <p className="text-[17px] text-gray-700 leading-relaxed mb-12 max-w-3xl">
            Living Intelligence is not a newsletter. It is an AI-powered editorial platform with a multi-stage pipeline that discovers, verifies, scores, and publishes intelligence continuously.
          </p>

          <div className="grid md:grid-cols-2 gap-8">
            {[
              {
                title: 'AI-Powered Discovery',
                desc: 'Over 60 search queries run daily across Google News, content analysis APIs, and specialist financial publications. Three discovery layers: broad market scans, capability-specific searches, and deep per-company monitoring.',
              },
              {
                title: 'Automated Verification',
                desc: 'Every article is structured by AI, then independently verified in a second pass that checks every factual claim against the original source. Claims that contradict the source are flagged and blocked automatically.',
              },
              {
                title: 'Multi-Dimensional Scoring',
                desc: 'Each development is scored across four dimensions: source credibility, claim verification, recency, and capability impact. Scores determine whether a story reaches the editorial inbox or is filtered out.',
              },
              {
                title: 'Human Editorial Gate',
                desc: 'Nothing publishes automatically. Every story is reviewed and approved by a human editor in the Editorial Studio before it reaches subscribers. The AI surfaces and verifies. The editor decides.',
              },
              {
                title: 'Competitive Landscape Matrix',
                desc: '37 firms and growing, assessed across 7 capability dimensions with maturity ratings: Scaled, Deployed, Piloting, or Announced. Updated continuously as new evidence emerges from the intelligence feed.',
              },
              {
                title: 'Source-Linked Provenance',
                desc: 'Every claim links to its original source. Every entry carries a verification audit trail. No inference, no fabrication, no unattributed statistics. Built for environments where accuracy is non-negotiable.',
              },
            ].map((card) => (
              <div key={card.title} className="flex gap-4">
                <div className="w-1 bg-[#990F3D] rounded flex-shrink-0 mt-1" style={{ minHeight: 20 }} />
                <div>
                  <h3 className="text-[14px] font-bold text-gray-900 mb-2">{card.title}</h3>
                  <p className="text-[13px] text-gray-600 leading-relaxed">{card.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── SECTION 3: WHAT'S INSIDE ─── */}
      <section className="py-16 md:py-20 bg-[#FDF8F2] border-t border-gray-200">
        <div className="max-w-5xl mx-auto px-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#990F3D] mb-2">
            What&apos;s Inside
          </p>
          <hr className="border-t-2 border-[#990F3D] mb-10 w-10" />

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                title: 'The Intelligence',
                desc: 'Every significant AI development in wealth management, verified against source. Not a news feed \u2014 an analytical lens on what each move means across the competitive landscape.',
              },
              {
                title: 'The Landscape',
                desc: '37 firms mapped across 7 capability dimensions. Who\u2019s deployed, who\u2019s piloting, who\u2019s announced. A living matrix, not a quarterly slide deck.',
              },
              {
                title: 'The Insight',
                desc: 'Every entry answers one question: why does this matter? Not a summary \u2014 a strategic interpretation you won\u2019t find in a press release.',
              },
            ].map((card) => (
              <div
                key={card.title}
                className="border-l-2 border-[#990F3D] pl-6 py-1"
              >
                <h3 className="text-[16px] font-bold text-gray-900 mb-3">{card.title}</h3>
                <p className="text-[15px] text-gray-600 leading-relaxed">{card.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── SECTION 3B: LANDSCAPE COVERAGE ─── */}
      <section className="py-16 md:py-20 bg-white border-t border-gray-200">
        <div className="max-w-5xl mx-auto px-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#990F3D] mb-2">
            The Landscape
          </p>
          <hr className="border-t-2 border-[#990F3D] mb-4 w-10" />
          <p className="text-[17px] text-gray-700 leading-relaxed mb-10 max-w-3xl">
            37 institutions currently tracked across 8 segments &mdash; and growing. Every company assessed across 7 AI capability dimensions, from advisor productivity to new business models.
          </p>

          {/* Segments with sample names */}
          <div className="grid md:grid-cols-2 gap-x-12 gap-y-6 mb-12">
            {[
              { segment: 'Wirehouses', names: 'Morgan Stanley, BofA/Merrill, Wells Fargo, JPMorgan' },
              { segment: 'Global Private Banks', names: 'UBS, Goldman Sachs, HSBC, Julius Baer, BNP Paribas' },
              { segment: 'Regional Champions', names: 'DBS, BBVA, Standard Chartered, RBC' },
              { segment: 'Digital Disruptors', names: 'Robinhood, Wealthfront, eToro, Betterment' },
              { segment: 'AI-Native Wealth', names: 'Arta Finance, Savvy Wealth' },
              { segment: 'RIA / Independent', names: 'Altruist, LPL Financial' },
              { segment: 'Advisor Tools', names: 'Jump, Zocks, Holistiplan, Nevis' },
              { segment: 'Asset Managers', names: 'Fidelity, Vanguard' },
            ].map((s) => (
              <div key={s.segment} className="flex items-start gap-3">
                <span className="text-[11px] font-bold text-[#990F3D] uppercase tracking-wide min-w-[140px] pt-0.5 flex-shrink-0">{s.segment}</span>
                <span className="text-[13px] text-gray-600">{s.names}</span>
              </div>
            ))}
          </div>

          {/* Capability dimensions */}
          <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-gray-400 mb-4">
            7 Capability Dimensions
          </p>
          <div className="flex flex-wrap gap-2 mb-12">
            {[
              'Advisor Productivity', 'Client Personalisation', 'Investment & Portfolio',
              'Research & Content', 'Client Acquisition', 'Operations & Compliance', 'New Business Models',
            ].map((cap) => (
              <span key={cap} className="text-[12px] text-gray-700 bg-gray-100 px-3 py-1.5 rounded border border-gray-200">
                {cap}
              </span>
            ))}
          </div>

          {/* Mini matrix snapshot */}
          <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-gray-400 mb-4">
            Landscape Snapshot
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]" style={{ minWidth: 600 }}>
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 pr-4 text-gray-400 font-semibold">Company</th>
                  <th className="text-center px-2 py-2 text-gray-400 font-normal">Advisor Prod.</th>
                  <th className="text-center px-2 py-2 text-gray-400 font-normal">Client Pers.</th>
                  <th className="text-center px-2 py-2 text-gray-400 font-normal">Investment</th>
                  <th className="text-center px-2 py-2 text-gray-400 font-normal">Research</th>
                  <th className="text-center px-2 py-2 text-gray-400 font-normal">Acquisition</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { name: 'Morgan Stanley', caps: ['scaled', 'deployed', 'deployed', 'piloting', 'none'] },
                  { name: 'JPMorgan', caps: ['scaled', 'deployed', 'piloting', 'deployed', 'announced'] },
                  { name: 'Goldman Sachs', caps: ['deployed', 'piloting', 'deployed', 'piloting', 'none'] },
                ].map((row) => (
                  <tr key={row.name} className="border-b border-gray-100">
                    <td className="py-2.5 pr-4 font-semibold text-gray-900">{row.name}</td>
                    {row.caps.map((c, i) => (
                      <td key={i} className="text-center px-2 py-2.5">
                        <span className={`inline-block w-2.5 h-2.5 rounded-full ${
                          c === 'scaled' ? 'bg-green-500' :
                          c === 'deployed' ? 'bg-blue-500' :
                          c === 'piloting' ? 'bg-orange-400' :
                          c === 'announced' ? 'bg-yellow-400' :
                          'bg-gray-200'
                        }`} />
                      </td>
                    ))}
                  </tr>
                ))}
                <tr>
                  <td colSpan={6} className="py-3 text-center text-[11px] text-gray-400 italic">
                    + 34 more institutions across all segments
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="flex items-center gap-4 mt-4 text-[11px] text-gray-400">
            <span className="flex items-center gap-1.5"><span className="inline-block w-2 h-2 rounded-full bg-green-500" /> Scaled</span>
            <span className="flex items-center gap-1.5"><span className="inline-block w-2 h-2 rounded-full bg-blue-500" /> Deployed</span>
            <span className="flex items-center gap-1.5"><span className="inline-block w-2 h-2 rounded-full bg-orange-400" /> Piloting</span>
            <span className="flex items-center gap-1.5"><span className="inline-block w-2 h-2 rounded-full bg-yellow-400" /> Announced</span>
            <span className="flex items-center gap-1.5"><span className="inline-block w-2 h-2 rounded-full bg-gray-200" /> No Activity</span>
          </div>
        </div>
      </section>

      {/* ─── SECTION 4: SAMPLE ENTRY ─── */}
      <section className="py-16 md:py-20 bg-white border-t border-gray-200">
        <div className="max-w-4xl mx-auto px-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#990F3D] mb-2">
            A Recent Entry
          </p>
          <hr className="border-t-2 border-[#990F3D] mb-10 w-10" />

          {/* Sample card */}
          <div className="border border-gray-200 rounded-lg p-8 md:p-10 bg-[#FFFCF8]">
            {/* Card header */}
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <span className="text-[11px] font-bold text-gray-500">BofA / Merrill</span>
              <span className="text-[10px] font-bold uppercase tracking-wider bg-[#FFF7ED] text-[#C2410C] px-2 py-0.5 rounded-sm">
                Milestone
              </span>
            </div>

            {/* Headline */}
            <h3 className="text-xl md:text-2xl font-extrabold text-gray-900 leading-snug mb-6">
              BofA&apos;s AI and digital estate reaches 30 billion client interactions
            </h3>

            {/* Insight callout */}
            <div className="border-l-2 border-[#990F3D] pl-6 mb-8">
              <p className="text-[15px] text-gray-700 leading-relaxed">
                At 30 billion digital interactions and $211 billion in AI-linked asset growth, BofA&apos;s consumer AI estate is now larger than most standalone digital wealth platforms &mdash; establishing scale economics that make replication prohibitively expensive for firms still in pilot mode.
              </p>
            </div>

            {/* Key stat */}
            <div className="flex items-end gap-3">
              <span className="text-4xl md:text-5xl font-extrabold text-[#1C1C2E] leading-none">30B</span>
              <span className="text-[13px] text-gray-500 pb-1">client interactions in 2025</span>
            </div>
          </div>
        </div>
      </section>

      {/* ─── SECTION 5: BUILT FOR ─── */}
      <section className="py-16 md:py-20 bg-[#FDF8F2] border-t border-gray-200">
        <div className="max-w-3xl mx-auto px-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#990F3D] mb-2">
            Built For
          </p>
          <hr className="border-t-2 border-[#990F3D] mb-10 w-10" />

          <p className="text-[17px] text-gray-700 leading-relaxed">
            Decision makers at private banks, wirehouses, and wealth platforms who would rather spend 5 minutes a week staying informed than 5 hours chasing headlines.
          </p>
        </div>
      </section>

      {/* ─── SECTION 6: PRICING ─── */}
      <section id="pricing" className="py-16 md:py-20 bg-white border-t border-gray-200">
        <div className="max-w-4xl mx-auto px-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#990F3D] mb-2">
            Pricing
          </p>
          <hr className="border-t-2 border-[#990F3D] mb-6 w-10" />

          <p className="text-[15px] text-gray-500 mb-10 max-w-2xl">
            A single competitive landscape analysis from a consulting firm costs $75,000. An analyst subscription starts at $25,000/year.
          </p>

          <div className="grid md:grid-cols-2 gap-6 max-w-3xl">
            {/* Founding Member */}
            <div className="border border-gray-200 rounded-lg p-8 relative">
              <span className="absolute top-4 right-4 text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-800 px-2 py-0.5 rounded-sm">
                Limited
              </span>
              <p className="text-[11px] uppercase tracking-widest text-gray-400 mb-5">Founding Member</p>
              <div className="mb-1">
                <span className="text-4xl font-extrabold text-gray-900">$400</span>
                <span className="text-gray-400 text-sm ml-1.5">/ month</span>
              </div>
              <p className="text-[13px] text-gray-500 mb-1">First 50 subscribers. Locked for life.</p>
              <p className="text-[13px] text-gray-500 mb-8">
                <span className="text-gray-900 font-semibold">$4,000 / year</span>
              </p>
              <a
                href="#"
                className="block text-center bg-[#990F3D] hover:bg-[#7a0c31] text-white text-[14px] font-bold py-3.5 rounded transition-colors no-underline"
              >
                Start your 7-day trial
              </a>
            </div>

            {/* Individual */}
            <div className="border border-gray-200 rounded-lg p-8">
              <p className="text-[11px] uppercase tracking-widest text-gray-400 mb-5 mt-2">Individual</p>
              <div className="mb-1">
                <span className="text-4xl font-extrabold text-gray-900">$500</span>
                <span className="text-gray-400 text-sm ml-1.5">/ month</span>
              </div>
              <p className="text-[13px] text-gray-500 mb-8">
                <span className="text-gray-900 font-semibold">$5,000 / year</span>
                <span className="text-gray-400 ml-1.5">(save $1,000)</span>
              </p>
              <a
                href="#"
                className="block text-center bg-[#990F3D] hover:bg-[#7a0c31] text-white text-[14px] font-bold py-3.5 rounded transition-colors no-underline"
              >
                Start your 7-day trial
              </a>
            </div>
          </div>

          <p className="text-[13px] text-gray-400 mt-6">
            Team pricing available.{' '}
            <a href="mailto:hello@livingintel.ai" className="text-[#990F3D] hover:underline">Contact us</a>.
          </p>
        </div>
      </section>

      {/* ─── SECTION 7: FINAL CTA ─── */}
      <section className="bg-[#1C1C2E] py-20 md:py-24 text-center">
        <div className="max-w-2xl mx-auto px-6">
          <p className="text-[17px] md:text-[19px] text-[#9999BB] leading-relaxed mb-10">
            43 developments tracked since launch. The pace is accelerating.
          </p>
          <a
            href="#pricing"
            className="inline-block bg-[#990F3D] hover:bg-[#7a0c31] text-white text-[15px] font-bold px-8 py-4 rounded transition-colors no-underline mb-10"
          >
            Start your 7-day trial
          </a>
          <p className="text-[12px] text-[#444458]">By AI of the Tiger</p>
        </div>
      </section>

    </div>
  );
}
