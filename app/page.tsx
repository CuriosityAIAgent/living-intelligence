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
              37 wealth management firms tracked continuously across 7 AI capability dimensions. Multi-source verified. Human-edited. Updated daily.
            </p>
            <a
              href="#pricing"
              className="inline-block bg-[#990F3D] hover:bg-[#7a0c31] text-white text-[15px] font-bold px-8 py-4 rounded transition-colors no-underline"
            >
              Request access
            </a>
          </div>
        </div>

        {/* Stats strip */}
        <div className="border-t border-[#2A2A3E]">
          <div className="max-w-5xl mx-auto px-6 py-5 flex flex-wrap gap-x-8 gap-y-3">
            {[
              { n: '37+', label: 'Firms & Growing' },
              { n: '7', label: 'Capability Dimensions' },
              { n: '44+', label: 'Verified Developments' },
              { n: '\u25CF', label: 'Daily Monitoring' },
            ].map((s) => (
              <div key={s.label} className="flex items-center gap-2.5">
                {s.n === '\u25CF' ? (
                  <span className="text-[10px] text-[#990F3D]">{s.n}</span>
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
        <div className="max-w-5xl mx-auto px-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#990F3D] mb-2">
            The challenge
          </p>
          <hr className="border-t-2 border-[#990F3D] mb-10 w-10" />

          <div className="space-y-6 text-[17px] text-gray-700 leading-relaxed max-w-3xl">
            <p>
              Last quarter, 14 wealth firms quietly launched or expanded AI capabilities. Most never made it past industry press.
            </p>
            <p>
              Getting this picture from a consulting firm runs $75,000 to $250,000. By delivery, it&apos;s already stale. Gartner and Forrester start at $25,000 a year.
            </p>
            <p className="text-gray-900 font-semibold">
              We track it continuously. You get it for a fraction of that.
            </p>
          </div>
        </div>
      </section>

      {/* ─── SECTION 2B: THE PLATFORM ─── */}
      <section className="py-16 md:py-20 bg-white border-t border-gray-200">
        <div className="max-w-5xl mx-auto px-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#990F3D] mb-2">
            The platform
          </p>
          <hr className="border-t-2 border-[#990F3D] mb-4 w-10" />
          <p className="text-[17px] text-gray-700 leading-relaxed mb-10 max-w-3xl">
            This is not a newsletter. It&apos;s an editorial intelligence system. AI discovers, verifies, and scores. A human editor approves every story before it reaches you.
          </p>

          <ul className="space-y-4 max-w-2xl">
            {[
              '60+ search queries run daily across news sources and financial publications',
              'Every claim verified against the original source in a separate AI pass',
              'Scored on four dimensions: source credibility, claim accuracy, recency, capability impact',
              'Nothing publishes without human editorial approval',
              '37 firms mapped across 7 capability dimensions, updated as evidence comes in',
              'Every claim links back to its source. One click to the original.',
            ].map((item) => (
              <li key={item} className="flex items-start gap-3">
                <span className="text-[#990F3D] mt-1 flex-shrink-0">&#x2022;</span>
                <span className="text-[15px] text-gray-700 leading-relaxed">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ─── SECTION 3: WHAT'S INSIDE ─── */}
      <section className="py-16 md:py-20 bg-[#FDF8F2] border-t border-gray-200">
        <div className="max-w-5xl mx-auto px-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#990F3D] mb-2">
            What&apos;s inside
          </p>
          <hr className="border-t-2 border-[#990F3D] mb-10 w-10" />

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                title: 'The intelligence',
                desc: 'AI developments in wealth management, verified against source. Not a feed. A lens on what each move means competitively.',
              },
              {
                title: 'The landscape',
                desc: '37 firms, 7 dimensions. Who\u2019s live, who\u2019s testing, who\u2019s announced. A matrix that updates, not a slide deck gathering dust.',
              },
              {
                title: 'The insight',
                desc: 'Each entry answers: why does this matter? Not a press release rewrite. Context you won\u2019t get anywhere else.',
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
            Coverage
          </p>
          <hr className="border-t-2 border-[#990F3D] mb-4 w-10" />
          <p className="text-[17px] text-gray-700 leading-relaxed mb-10 max-w-3xl">
            37 firms across 8 segments. New firms get added as they make credible, trackable moves in AI. Each assessed across 7 capability dimensions, from advisor productivity to new business models.
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
            7 capability dimensions
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
            Snapshot
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
                    + 34 more firms across all segments
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
            <span className="flex items-center gap-1.5"><span className="inline-block w-2 h-2 rounded-full bg-gray-200" /> No activity</span>
          </div>
        </div>
      </section>

      {/* ─── SECTION 4: SAMPLE ENTRIES ─── */}
      <section className="py-16 md:py-20 bg-[#FDF8F2] border-t border-gray-200">
        <div className="max-w-5xl mx-auto px-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#990F3D] mb-2">
            What you get
          </p>
          <hr className="border-t-2 border-[#990F3D] mb-4 w-10" />
          <p className="text-[17px] text-gray-700 leading-relaxed mb-10 max-w-3xl">
            Every entry is verified against the original source, scored for credibility, and includes an editorial insight you won&apos;t find in the headline. Here are two recent examples.
          </p>

          <div className="grid md:grid-cols-2 gap-6 max-w-5xl">
            {/* Sample card 1 */}
            <div className="border border-gray-200 rounded-lg p-7 bg-white">
              <div className="flex flex-wrap items-center gap-3 mb-3">
                <span className="text-[11px] font-bold text-gray-500">BofA / Merrill</span>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-[#FFF7ED] text-[#C2410C] px-2 py-0.5 rounded-sm">
                  Product Launch
                </span>
                <span className="text-[10px] text-gray-400 border border-gray-200 rounded px-1.5 py-0.5">3 sources</span>
              </div>

              <h3 className="text-lg font-extrabold text-gray-900 leading-snug mb-4">
                BofA Deploys AI Meeting Journey Across Merrill and Private Bank Advisors
              </h3>

              <div className="border-l-2 border-[#990F3D] pl-5 mb-5">
                <p className="text-[13px] font-semibold text-[#990F3D] mb-1">Why it matters</p>
                <p className="text-[14px] text-gray-700 leading-relaxed">
                  Full-scale AI meeting automation across Merrill and Private Bank, saving up to 4 hours per meeting. The advisor productivity gap between firms with deployed AI and those still piloting is widening every quarter.
                </p>
              </div>

              <div className="flex items-end gap-3">
                <span className="text-3xl font-extrabold text-[#1C1C2E] leading-none">4hrs</span>
                <span className="text-[12px] text-gray-500 pb-0.5">saved per advisor meeting</span>
              </div>
            </div>

            {/* Sample card 2 */}
            <div className="border border-gray-200 rounded-lg p-7 bg-white">
              <div className="flex flex-wrap items-center gap-3 mb-3">
                <span className="text-[11px] font-bold text-gray-500">Robinhood</span>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-[#EFF6FF] text-[#1D4ED8] px-2 py-0.5 rounded-sm">
                  Market Signal
                </span>
                <span className="text-[10px] text-gray-400 border border-gray-200 rounded px-1.5 py-0.5">2 sources</span>
              </div>

              <h3 className="text-lg font-extrabold text-gray-900 leading-snug mb-4">
                One-Third of Consumers Now Use AI for Investment Guidance, McKinsey Finds
              </h3>

              <div className="border-l-2 border-[#990F3D] pl-5 mb-5">
                <p className="text-[13px] font-semibold text-[#990F3D] mb-1">Why it matters</p>
                <p className="text-[14px] text-gray-700 leading-relaxed">
                  The $100K-to-$1M wealth segment is getting squeezed from both ends. Wirehouses can&apos;t match Robinhood&apos;s $250/year AI advice price without cannibalizing their own AUM-fee economics.
                </p>
              </div>

              <div className="flex items-end gap-3">
                <span className="text-3xl font-extrabold text-[#1C1C2E] leading-none">250K</span>
                <span className="text-[12px] text-gray-500 pb-0.5">paying AI advisory customers</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── SECTION 5: BUILT FOR ─── */}
      <section className="py-16 md:py-20 bg-white border-t border-gray-200">
        <div className="max-w-5xl mx-auto px-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#990F3D] mb-2">
            Built for your leadership team
          </p>
          <hr className="border-t-2 border-[#990F3D] mb-4 w-10" />

          <p className="text-[17px] text-gray-700 leading-relaxed max-w-3xl mb-10">
            One firm license. Up to five people. The executives who need to know what competitors are doing with AI, without spending hours assembling the picture themselves.
          </p>

          <div className="grid md:grid-cols-2 gap-x-12 gap-y-4 max-w-3xl">
            {[
              { role: 'Head of Digital / CDO', why: 'Owns the digital transformation agenda' },
              { role: 'Head of AI / Chief AI Officer', why: 'Needs to benchmark AI capabilities against peers' },
              { role: 'Head of Strategy', why: 'Feeds competitive intelligence into strategic planning' },
              { role: 'CTO / CIO', why: 'Makes build-vs-buy decisions on AI infrastructure' },
              { role: 'CEO / COO', why: 'Needs the 5-minute view of what moved' },
              { role: 'Head of Innovation', why: 'Scouts new capabilities and emerging entrants' },
            ].map((p) => (
              <div key={p.role} className="flex items-start gap-3 py-2">
                <span className="text-[#990F3D] mt-0.5 flex-shrink-0">&#x2022;</span>
                <div>
                  <span className="text-[15px] font-semibold text-gray-900">{p.role}</span>
                  <span className="text-[13px] text-gray-500 ml-2">{p.why}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── SECTION 6: PRICING ─── */}
      <section id="pricing" className="py-16 md:py-20 bg-[#FDF8F2] border-t border-gray-200">
        <div className="max-w-5xl mx-auto px-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#990F3D] mb-2">
            Pricing
          </p>
          <hr className="border-t-2 border-[#990F3D] mb-6 w-10" />

          <p className="text-[15px] text-gray-500 mb-10 max-w-2xl">
            A consulting firm charges $75,000 for a competitive landscape that&apos;s stale by delivery. Analyst subscriptions start at $25,000 a year. We deliver continuous intelligence for a fraction of that.
          </p>

          <div className="grid md:grid-cols-2 gap-6 max-w-2xl">
            {/* Founding Member */}
            <div className="border border-gray-200 rounded-lg p-8 relative bg-white">
              <span className="absolute top-4 right-4 text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-800 px-2 py-0.5 rounded-sm">
                First 50 firms
              </span>
              <p className="text-[11px] uppercase tracking-widest text-gray-400 mb-5">Founding Member</p>
              <div className="mb-2">
                <span className="text-4xl font-extrabold text-gray-900">$4,500</span>
                <span className="text-gray-400 text-sm ml-1.5">/ year</span>
              </div>
              <p className="text-[13px] text-gray-500 mb-6">Annual contract. This rate is locked for life.</p>

              <ul className="space-y-2 mb-8">
                {[
                  'Up to 5 users per firm',
                  'Full intelligence feed + landscape matrix',
                  'Multi-source verified entries daily',
                  'Founding Member Advisory Board status',
                ].map((f) => (
                  <li key={f} className="flex items-start gap-2 text-[13px] text-gray-600">
                    <span className="text-green-500 mt-0.5">&#x2713;</span> {f}
                  </li>
                ))}
              </ul>

              <a
                href="mailto:hello@livingintel.ai?subject=Founding Member — Living Intelligence&body=I'd like to learn more about founding member access to Living Intelligence."
                className="block text-center bg-[#990F3D] hover:bg-[#7a0c31] text-white text-[14px] font-bold py-3.5 rounded transition-colors no-underline"
              >
                Request access
              </a>
            </div>

            {/* Standard */}
            <div className="border border-gray-200 rounded-lg p-8 relative bg-white">
              <p className="text-[11px] uppercase tracking-widest text-gray-400 mb-5 mt-5">Standard</p>
              <div className="mb-2">
                <span className="text-4xl font-extrabold text-gray-900">$5,000</span>
                <span className="text-gray-400 text-sm ml-1.5">/ year</span>
              </div>
              <p className="text-[13px] text-gray-500 mb-6">Annual contract. Firm license.</p>

              <ul className="space-y-2 mb-8">
                {[
                  'Up to 5 users per firm',
                  'Full intelligence feed + landscape matrix',
                  'Multi-source verified entries daily',
                  'Standard support',
                ].map((f) => (
                  <li key={f} className="flex items-start gap-2 text-[13px] text-gray-600">
                    <span className="text-green-500 mt-0.5">&#x2713;</span> {f}
                  </li>
                ))}
              </ul>

              <a
                href="mailto:hello@livingintel.ai?subject=Living Intelligence — Annual Access&body=I'd like to learn more about Living Intelligence for my firm."
                className="block text-center bg-gray-800 hover:bg-gray-900 text-white text-[14px] font-bold py-3.5 rounded transition-colors no-underline"
              >
                Request access
              </a>
            </div>
          </div>

          <p className="text-[13px] text-gray-400 mt-8 max-w-2xl">
            Enterprise pricing available for larger teams and custom research.{' '}
            <a href="mailto:hello@livingintel.ai" className="text-[#990F3D] hover:underline">Get in touch</a>.
          </p>
        </div>
      </section>

      {/* ─── SECTION 7: FINAL CTA ─── */}
      <section className="bg-[#1C1C2E] py-20 md:py-24 text-center">
        <div className="max-w-2xl mx-auto px-6">
          <p className="text-[17px] md:text-[19px] text-[#9999BB] leading-relaxed mb-10">
            44 developments tracked across 37 firms. New intelligence published daily. The pace is picking up.
          </p>
          <a
            href="mailto:hello@livingintel.ai?subject=Living Intelligence — Request Access&body=I'd like to learn more about Living Intelligence for my firm."
            className="inline-block bg-[#990F3D] hover:bg-[#7a0c31] text-white text-[15px] font-bold px-8 py-4 rounded transition-colors no-underline mb-10"
          >
            Request access
          </a>
          <p className="text-[12px] text-[#444458]">
            Founding member spots are limited.{' '}
            <a href="mailto:hello@livingintel.ai" className="text-[#666680] hover:text-white transition-colors">hello@livingintel.ai</a>
          </p>
        </div>
      </section>

    </div>
  );
}
