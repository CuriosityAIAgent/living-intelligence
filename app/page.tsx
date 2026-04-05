'use client';

import RotatingHeadline from '@/components/RotatingHeadline';

/* ─── Single source of truth for all landing page numbers ─── */
const STATS = {
  firms: '37+',
  entries: '43+',
  capabilities: '7',
  queries: '60+',
  qualityChecks: '6',
  sources: '300+',
} as const;

export default function LandingPage() {
  return (
    <div className="min-h-screen">

      {/* ─── STICKY REQUEST ACCESS CTA ─── */}
      <div className="fixed bottom-6 right-6 z-50 hidden md:block">
        <a
          href="mailto:hello@livingintel.ai?subject=Living Intelligence — Request Access&body=I'd like to learn more about Living Intelligence for my firm."
          className="bg-[#990F3D] hover:bg-[#7a0c31] text-white text-[13px] font-bold px-6 py-3 rounded-full shadow-lg transition-colors no-underline flex items-center gap-2"
        >
          Request access <span className="text-[16px]">&rarr;</span>
        </a>
      </div>

      {/* ─── STICKY SECTION NAV ─── */}
      <nav className="sticky top-0 z-50 bg-[#141420] border-b border-[#2A2A3E] hidden md:block">
        <div className="max-w-5xl mx-auto px-6 flex items-center gap-6 py-2.5">
          <span className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-white mr-4">Living Intelligence</span>
          {[
            { label: 'Why Now', href: '#challenge' },
            { label: 'How It Works', href: '#how' },
            { label: 'Intelligence', href: '#sample' },
            { label: 'Landscape', href: '#coverage' },
            { label: 'Thought Leadership', href: '#thought-leadership' },
            { label: 'Pricing', href: '#pricing' },
          ].map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-[11px] text-[#8888A0] hover:text-white transition-colors no-underline uppercase tracking-wider"
            >
              {link.label}
            </a>
          ))}
        </div>
      </nav>

      {/* ─── SECTION 1: HERO ─── */}
      <section className="bg-[#1C1C2E]">
        <div className="max-w-5xl mx-auto px-6 pt-16 pb-20 md:pt-24 md:pb-28">

          {/* Headline block */}
          <div className="max-w-3xl">
            <RotatingHeadline />
            <p className="text-[17px] md:text-[19px] text-[#9999BB] leading-relaxed mb-10 max-w-2xl">
              AI is redrawing the competitive map in wealth management. The firms that see it first will move first. We track every development — daily, verified, consulting-grade — so your leadership team is never the last to know.
            </p>
            <a
              href="#sample"
              className="inline-block bg-[#990F3D] hover:bg-[#7a0c31] text-white text-[15px] font-bold px-8 py-4 rounded transition-colors no-underline"
            >
              View sample intelligence
            </a>
          </div>
        </div>

        {/* Stats strip */}
        <div className="border-t border-[#2A2A3E]">
          <div className="max-w-5xl mx-auto px-6 py-5 flex flex-wrap gap-x-8 gap-y-3">
            {[
              { n: STATS.firms, label: 'Firms Tracked' },
              { n: STATS.capabilities, label: 'AI Capability Dimensions' },
              { n: STATS.entries, label: 'Verified Developments' },
              { n: STATS.queries, label: 'Daily Discovery Queries' },
            ].map((s) => (
              <div key={s.label} className="flex items-center gap-2.5">
                <span className="text-[20px] font-extrabold text-white">{s.n}</span>
                <span className="text-[12px] uppercase tracking-wider text-[#8888A0]">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── SECTION 2: THE HOOK ─── */}
      <section id="challenge" className="py-16 md:py-20 bg-[#FDF8F2] scroll-mt-12">
        <div className="max-w-5xl mx-auto px-6">
          <div className="space-y-5 text-[17px] text-gray-700 leading-relaxed max-w-3xl">
            <p className="text-[22px] md:text-[26px] font-extrabold text-gray-900 leading-snug">
              The wealth management business model is being rewritten. Right now.
            </p>
            <p>
              BofA: 3.2 billion Erica interactions. Morgan Stanley: 98% advisor AI adoption. Altruist: 1,600 RIA firms in 30 days. These are not pilots. They are deployed, scaled, and widening the gap every quarter.
            </p>
            <p className="text-gray-900 font-semibold">
              The question is not whether AI will affect your business. It is whether you will see it coming in time to respond.
            </p>
            <p className="text-gray-500">
              A consulting firm charges six figures for this picture. By delivery, it&apos;s stale. We deliver it continuously.
            </p>
          </div>
        </div>
      </section>

      {/* ─── SECTION 3: HOW IT WORKS — Pipeline ─── */}
      <section id="how" className="py-16 md:py-20 bg-white border-t border-gray-200 scroll-mt-12">
        <div className="max-w-5xl mx-auto px-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#990F3D] mb-2">
            How it works
          </p>
          <hr className="border-t-2 border-[#990F3D] mb-4 w-10" />
          <p className="text-[17px] text-gray-700 leading-relaxed mb-12 max-w-3xl">
            Not a newsletter. Not an AI-generated feed. An editorial intelligence system with a multi-stage verification pipeline.
          </p>

          {/* Pipeline steps */}
          <div className="grid md:grid-cols-5 gap-4 mb-12">
            {[
              { step: '01', title: 'Discovery', desc: '60+ targeted queries daily across thousands of sources. News wires, press releases, trade publications, company newsrooms.' },
              { step: '02', title: 'Scoring', desc: 'Algorithm scores every story on source credibility, claim strength, recency, and capability impact.' },
              { step: '03', title: 'Verification', desc: 'Every claim checked against the original source document. Multi-source corroboration.' },
              { step: '04', title: 'Editorial review', desc: 'Human sign-off before anything publishes. No exceptions.' },
              { step: '05', title: 'Published', desc: 'Verified intelligence with editorial analysis on why it matters competitively.' },
            ].map((s, i) => (
              <div key={s.step} className="relative">
                <div className="text-[11px] font-bold text-[#990F3D] mb-2">{s.step}</div>
                <h4 className="text-[14px] font-bold text-gray-900 mb-2">{s.title}</h4>
                <p className="text-[13px] text-gray-500 leading-relaxed">{s.desc}</p>
                {i < 4 && <div className="hidden md:block absolute top-3 -right-2 text-gray-300">&#x2192;</div>}
              </div>
            ))}
          </div>

          {/* Quality standard — unified block */}
          <div className="border border-gray-200 rounded-lg overflow-hidden max-w-4xl">
            <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-200">
              <div className="p-6">
                <p className="text-[14px] font-semibold text-gray-900 mb-2">Every source linked. Every link verified.</p>
                <p className="text-[13px] text-gray-600 leading-relaxed">
                  Every intelligence entry and landscape assessment links back to the original source — press releases, company newsrooms, trade publications, regulatory filings. Click through. It will be there.
                </p>
              </div>
              <div className="p-6">
                <p className="text-[14px] font-semibold text-gray-900 mb-2">Consulting-grade editorial standards.</p>
                <p className="text-[13px] text-gray-600 leading-relaxed">
                  Every entry is assessed across {STATS.qualityChecks} quality dimensions — the same rigour a McKinsey engagement applies to competitive intelligence. Multi-source corroboration. Iterative refinement. Nothing ships until it meets the standard we&apos;d put in front of a CXO.
                </p>
              </div>
            </div>
            <div className="border-t border-gray-200 bg-[#FAFAF8] px-6 py-4 flex flex-wrap gap-x-8 gap-y-2">
              {[
                { n: '15+', label: 'Specialised systems' },
                { n: STATS.qualityChecks, label: 'Quality dimensions' },
                { n: STATS.sources, label: 'Source references' },
                { n: '2', label: 'Refinement iterations' },
              ].map((s) => (
                <div key={s.label} className="flex items-center gap-2">
                  <span className="text-[16px] font-extrabold text-gray-900">{s.n}</span>
                  <span className="text-[11px] text-gray-500 uppercase tracking-wider">{s.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="border-l-2 border-[#990F3D] pl-5 mt-8 max-w-4xl">
            <p className="text-[14px] text-gray-800 font-semibold">
              We do not publish unverified claims. We do not summarise press releases. Every development includes editorial analysis on what it means competitively.
            </p>
          </div>
        </div>
      </section>

      {/* ─── SECTION 4: WHAT'S INSIDE ─── */}
      <section className="py-16 md:py-20 bg-[#FDF8F2] border-t border-gray-200">
        <div className="max-w-5xl mx-auto px-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#990F3D] mb-2">
            What&apos;s inside
          </p>
          <hr className="border-t-2 border-[#990F3D] mb-10 w-10" />

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                title: 'Intelligence',
                desc: 'Verified AI developments across wealth management. Multi-source corroboration. Each entry includes editorial analysis on what it means for your firm — not a press release rewrite.',
              },
              {
                title: 'Landscape',
                desc: '37+ firms mapped across 7 AI capability dimensions. Who\u2019s scaled, who\u2019s piloting, who\u2019s still announcing. Every assessment sourced and evidence-linked. A living matrix, not a static slide deck.',
              },
              {
                title: 'Thought leadership',
                desc: 'Curated from McKinsey, BCG, Harvard Business School, Wharton, Venrock, Ethan Mollick, and leading practitioners. The strategic frameworks and research shaping how the industry\u2019s smartest minds think about AI.',
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

      {/* ─── SECTION 5: SAMPLE INTELLIGENCE ─── */}
      <section id="sample" className="py-16 md:py-20 bg-white border-t border-gray-200">
        <div className="max-w-5xl mx-auto px-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#990F3D] mb-2">
            Intelligence
          </p>
          <hr className="border-t-2 border-[#990F3D] mb-4 w-10" />
          <p className="text-[17px] text-gray-700 leading-relaxed mb-10 max-w-3xl">
            This is what consulting-grade competitive intelligence looks like — verified against original sources, multi-source where possible, with editorial analysis on what each development means for your firm. Not summaries. Strategic context.
          </p>

          {/* Intelligence feed sample — 3 stacked cards */}
          <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-gray-400 mb-4">
            From intelligence
          </p>
          <div className="space-y-4 max-w-3xl mb-14">
            {[
              {
                company: 'BofA / Merrill',
                type: 'Product Launch',
                typeColor: 'bg-[#FFF7ED] text-[#C2410C]',
                sources: 3,
                sourceNames: 'BofA Newsroom · American Banker · Fortune',
                headline: 'BofA Deploys AI Meeting Journey Across Merrill and Private Bank Advisors',
                insight: 'Full-scale AI meeting automation across Merrill and Private Bank, saving up to 4 hours per meeting. The advisor productivity gap between firms with deployed AI and those still piloting is widening every quarter.',
                stat: '4hrs',
                statLabel: 'saved per advisor meeting',
              },
              {
                company: 'Robinhood',
                type: 'Market Signal',
                typeColor: 'bg-[#EFF6FF] text-[#1D4ED8]',
                sources: 2,
                sourceNames: 'Fortune · Yahoo Finance / McKinsey',
                headline: 'One-Third of Consumers Now Use AI for Investment Guidance, McKinsey Finds',
                insight: 'The $100K-to-$1M wealth segment is getting squeezed from both ends. Wirehouses can\u2019t match Robinhood\u2019s $250/year AI advice price without cannibalizing their own AUM-fee economics.',
                stat: '250K',
                statLabel: 'paying AI advisory customers',
              },
              {
                company: 'Altruist',
                type: 'Product Launch',
                typeColor: 'bg-[#FFF7ED] text-[#C2410C]',
                sources: 4,
                sourceNames: 'Altruist Newsroom · RIABiz · CNBC · PLANADVISER',
                headline: 'Altruist Hazel Adds AI Tax Planning — 1,600 RIA Firms Subscribe in 30 Days',
                insight: 'The independent channel is adopting AI faster than the institutional channel. 1,600 RIA firms in one month is a structural reversal of the historic adoption curve.',
                stat: '1,600',
                statLabel: 'RIA firms in first 30 days',
              },
            ].map((entry) => (
              <div key={entry.headline} className="border border-gray-200 rounded-lg p-6 bg-[#FAFAF8]">
                <div className="flex flex-wrap items-center gap-2.5 mb-3">
                  <span className="text-[11px] font-bold text-gray-500">{entry.company}</span>
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm ${entry.typeColor}`}>
                    {entry.type}
                  </span>
                  <span className="text-[10px] text-gray-400 border border-gray-200 rounded px-1.5 py-0.5">{entry.sources} sources</span>
                </div>

                <h3 className="text-[16px] font-extrabold text-gray-900 leading-snug mb-3">
                  {entry.headline}
                </h3>

                <div className="border-l-2 border-[#990F3D] pl-4 mb-4">
                  <p className="text-[12px] font-semibold text-[#990F3D] mb-0.5">Why it matters</p>
                  <p className="text-[13px] text-gray-700 leading-relaxed">{entry.insight}</p>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-end gap-2">
                    <span className="text-2xl font-extrabold text-[#1C1C2E] leading-none">{entry.stat}</span>
                    <span className="text-[11px] text-gray-500 pb-0.5">{entry.statLabel}</span>
                  </div>
                  <span className="text-[10px] text-gray-400">{entry.sourceNames}</span>
                </div>
              </div>
            ))}
            <p className="text-[12px] text-gray-400 text-center pt-2 italic">+ 40 more verified entries — growing weekly</p>
          </div>

        </div>
      </section>

      {/* ─── SECTION 6: COVERAGE ─── */}
      <section id="coverage" className="py-16 md:py-20 bg-[#FDF8F2] border-t border-gray-200 scroll-mt-12">
        <div className="max-w-5xl mx-auto px-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#990F3D] mb-2">
            Landscape
          </p>
          <hr className="border-t-2 border-[#990F3D] mb-4 w-10" />
          <p className="text-[17px] text-gray-700 leading-relaxed mb-4 max-w-3xl">
            37+ firms. 7 segments. 7 AI capability dimensions. Every assessment sourced to press releases, earnings calls, product announcements, and company newsrooms. This is the competitive picture a consulting firm charges six figures to assemble — delivered as a living, continuously updated matrix.
          </p>
          <p className="text-[13px] text-gray-500 mb-10 max-w-3xl">
            The full landscape is available to subscribers. Here is how we classify the market and what you see when you log in.
          </p>

          {/* Segments as classification framework — one example each */}
          <div className="grid md:grid-cols-2 gap-x-12 gap-y-5 mb-12">
            {[
              { segment: 'Wirehouses', example: 'Morgan Stanley, BofA/Merrill, JPMorgan, Wells Fargo', desc: 'The largest US advisor-network broker-dealers' },
              { segment: 'Global Private Banks', example: 'UBS, Goldman Sachs, Citi PB, HSBC PB, Julius Baer', desc: 'HNW/UHNW focused institutions globally' },
              { segment: 'Regional Champions', example: 'DBS, BBVA, Standard Chartered, RBC', desc: 'Dominant in their home region, full-service banking + wealth' },
              { segment: 'Digital Disruptors', example: 'Robinhood, Wealthfront, eToro, Public.com', desc: 'Tech-first platforms redefining access and pricing' },
              { segment: 'AI-Native Wealth', example: 'Arta Finance, Savvy Wealth', desc: 'Built from scratch on AI infrastructure' },
              { segment: 'RIA / Independent', example: 'Altruist, LPL Financial', desc: 'Independent channel platforms and custodians' },
              { segment: 'Advisor Tools', example: 'Jump, Zocks, Holistiplan, Conquest Planning', desc: 'AI tools used by advisors across firms' },
            ].map((s) => (
              <div key={s.segment} className="py-1">
                <span className="text-[13px] font-semibold text-gray-900">{s.segment}</span>
                <p className="text-[12px] text-gray-500 mt-0.5">{s.desc}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">{s.example}</p>
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

          {/* Landscape snapshot — shows actual cell content like the real product */}
          <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-gray-400 mb-4">
            Landscape — what you see when you log in
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]" style={{ minWidth: 750 }}>
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 pr-3 text-gray-400 font-semibold w-[130px]">Institution</th>
                  <th className="text-left px-2 py-2 text-gray-400 font-normal">Advisor Productivity</th>
                  <th className="text-left px-2 py-2 text-gray-400 font-normal">Client Personalisation</th>
                  <th className="text-left px-2 py-2 text-gray-400 font-normal">Research &amp; Content</th>
                </tr>
              </thead>
              <tbody>
                {[
                  {
                    name: 'BofA / Merrill',
                    segment: 'Wirehouse',
                    cells: [
                      { maturity: 'Scaled', color: 'bg-green-500', headline: 'AI Meeting Journey: full-scale rollout, up to 4 hours saved per meeting' },
                      { maturity: 'Scaled', color: 'bg-green-500', headline: 'Erica: 3.2B interactions, 20.6M active users, 700M interactions in 2025' },
                      { maturity: 'Piloting', color: 'bg-orange-400', headline: 'Internal research synthesis tools in pilot with analysts' },
                    ],
                  },
                  {
                    name: 'Morgan Stanley',
                    segment: 'Wirehouse',
                    cells: [
                      { maturity: 'Scaled', color: 'bg-green-500', headline: 'AI @ Morgan Stanley: 98% advisor adoption, meeting prep + insights' },
                      { maturity: 'Deployed', color: 'bg-blue-500', headline: 'Next Best Action engine live across Private Wealth Management' },
                      { maturity: 'Piloting', color: 'bg-orange-400', headline: 'Internal GPT for research synthesis — piloting with equity research' },
                    ],
                  },
                  {
                    name: 'Goldman Sachs',
                    segment: 'Global PB',
                    cells: [
                      { maturity: 'Deployed', color: 'bg-blue-500', headline: '46,000 employees using GS AI platform for knowledge retrieval' },
                      { maturity: 'Piloting', color: 'bg-orange-400', headline: 'AI-driven client profiling in pilot with Private Wealth division' },
                      { maturity: 'Piloting', color: 'bg-orange-400', headline: 'AI-assisted research drafting in Global Investment Research' },
                    ],
                  },
                ].map((row) => (
                  <tr key={row.name} className="border-b border-gray-100 align-top">
                    <td className="py-3 pr-3">
                      <span className="font-semibold text-gray-900 text-[12px]">{row.name}</span>
                      <div className="text-[10px] text-gray-400 mt-0.5">{row.segment}</div>
                    </td>
                    {row.cells.map((cell, i) => (
                      <td key={i} className="px-2 py-3">
                        <div className="border border-gray-200 rounded p-2.5 bg-white min-h-[70px]">
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <span className={`inline-block w-2 h-2 rounded-full ${cell.color}`} />
                            <span className="text-[10px] font-semibold text-gray-500 uppercase">{cell.maturity}</span>
                          </div>
                          <p className="text-[11px] text-gray-700 leading-snug">{cell.headline}</p>
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
                <tr>
                  <td colSpan={4} className="py-3 text-center text-[11px] text-gray-400 italic">
                    + 34 more firms · 7 capability dimensions each · Click any cell on the platform to see full evidence and sources
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

      {/* ─── SECTION 6a: COMPANY DEEP-DIVE ─── */}
      <section className="py-16 md:py-20 bg-white border-t border-gray-200">
        <div className="max-w-5xl mx-auto px-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-gray-400 mb-4">
            Company deep-dive — click any firm to see this
          </p>
          <div className="border border-gray-200 rounded-lg bg-[#FAFAF8] max-w-3xl overflow-hidden">
            <div className="p-6 pb-4">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-[18px] font-extrabold text-gray-900">BofA / Merrill</span>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-gray-100 text-gray-600 px-2 py-0.5 rounded-sm">Wirehouse</span>
              </div>
              <p className="text-[15px] font-bold text-gray-900 leading-snug mb-4">
                3.2B Erica interactions total (700M in 2025) across 20.6M users; 23,000 monthly active advisors
              </p>
              <div className="border-l-2 border-[#990F3D] pl-5 mb-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#990F3D] mb-1.5">AI Strategy</p>
                <p className="text-[13px] text-gray-700 leading-relaxed">
                  The longest-running AI program in wealth management. Erica has surpassed 3.2 billion total interactions with 20.6 million active users and 700 million interactions in 2025 alone. BofA&apos;s 30 billion total digital interactions in 2025 grew 14% YoY — 86% of wealth management clients now engage digitally.
                </p>
              </div>
              <div className="mb-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Headline Initiative</p>
                <p className="text-[13px] text-gray-700">Erica + Ask Merrill + Ask Private Bank + AI Meeting Journey</p>
              </div>
            </div>
            <div className="border-t border-gray-200 p-6 pt-4 bg-white">
              <p className="text-[11px] font-bold text-gray-900 mb-3">AI Capability Breakdown</p>
              <div className="space-y-2.5">
                {[
                  { cap: 'Advisor Productivity', maturity: 'Scaled', color: 'bg-green-500', headline: 'AI Meeting Journey: full-scale rollout across Merrill and Private Bank, up to 4 hours saved per meeting' },
                  { cap: 'Client Personalisation', maturity: 'Scaled', color: 'bg-green-500', headline: 'Ask Merrill: 23,000 advisors, 10,000+ Q&A answers per month' },
                  { cap: 'Client Acquisition', maturity: 'Deployed', color: 'bg-blue-500', headline: 'Erica proactive insights driving 20.6M monthly active users across deposits and investments' },
                ].map((row) => (
                  <div key={row.cap} className="flex items-start gap-2.5 border border-gray-100 rounded p-2.5 bg-[#FAFAF8]">
                    <span className={`inline-block w-2 h-2 rounded-full mt-1 flex-shrink-0 ${row.color}`} />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-semibold text-gray-900">{row.cap}</span>
                        <span className="text-[10px] font-bold text-gray-400 uppercase">{row.maturity}</span>
                      </div>
                      <p className="text-[11px] text-gray-600 leading-snug mt-0.5">{row.headline}</p>
                    </div>
                  </div>
                ))}
                <p className="text-[10px] text-gray-400 pt-1 italic">+ 4 more capabilities assessed · All evidence linked to original sources</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── SECTION 6b: THOUGHT LEADERSHIP ─── */}
      <section id="thought-leadership" className="py-16 md:py-20 bg-white border-t border-gray-200 scroll-mt-12">
        <div className="max-w-5xl mx-auto px-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#990F3D] mb-2">
            Thought leadership
          </p>
          <hr className="border-t-2 border-[#990F3D] mb-4 w-10" />
          <p className="text-[17px] text-gray-700 leading-relaxed mb-10 max-w-3xl">
            Curated essays and reports from the people shaping how the industry thinks about AI. Not aggregated — selected for strategic relevance.
          </p>

          <div className="grid md:grid-cols-2 gap-4 max-w-3xl">
            <div className="border border-gray-200 rounded-lg p-5 bg-[#FAFAF8]">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">McKinsey</span>
              <h3 className="text-[14px] font-bold text-gray-900 leading-snug mt-1.5 mb-2">
                US Wealth Management in 2035: A Transformative Decade Begins
              </h3>
              <p className="text-[12px] text-gray-500 leading-relaxed">110,000 advisors retiring by 2034. A structural opening for AI-native advisory.</p>
            </div>
            <div className="border border-gray-200 rounded-lg p-5 bg-[#FAFAF8]">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Venrock &middot; Nick Beim</span>
              <h3 className="text-[14px] font-bold text-gray-900 leading-snug mt-1.5 mb-2">
                The Week Altruist Shook the Markets
              </h3>
              <p className="text-[12px] text-gray-500 leading-relaxed">$130B in AUM shifted in one week. What happens when AI meets custody economics.</p>
            </div>
          </div>
          <p className="text-[11px] text-gray-400 mt-3">+ 6 more from BCG, Deloitte, and domain practitioners</p>
        </div>
      </section>

      {/* ─── SECTION 7: BUILT FOR ─── */}
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

      {/* ─── SECTION 8: PRICING ─── */}
      <section id="pricing" className="py-16 md:py-20 bg-[#FDF8F2] border-t border-gray-200">
        <div className="max-w-5xl mx-auto px-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#990F3D] mb-2">
            Pricing
          </p>
          <hr className="border-t-2 border-[#990F3D] mb-6 w-10" />

          <p className="text-[15px] text-gray-500 mb-10 max-w-2xl">
            A consulting firm charges $75,000–$150,000 for a competitive landscape that&apos;s stale by delivery. Analyst subscriptions start at $25,000 a year and bury you in volume without editorial judgement. We deliver consulting-grade intelligence — continuously updated, multi-source verified — for a fraction of either.
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
                  'Full intelligence + landscape access',
                  'Multi-source verified entries',
                  'Thought leadership library',
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
                  'Full intelligence + landscape access',
                  'Multi-source verified entries',
                  'Thought leadership library',
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

      {/* ─── SECTION 9: FINAL CTA ─── */}
      <section className="bg-[#1C1C2E] py-20 md:py-24 text-center">
        <div className="max-w-2xl mx-auto px-6">
          <p className="text-[17px] md:text-[19px] text-[#9999BB] leading-relaxed mb-10">
            {STATS.entries} verified developments. {STATS.firms} firms tracked. {STATS.capabilities} capability dimensions. Consulting-grade editorial standards. New intelligence published as it happens. Every source linked, every claim verified.
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
