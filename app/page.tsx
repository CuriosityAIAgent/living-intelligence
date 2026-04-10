'use client';

import { useState, useEffect } from 'react';
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

const NAV_LINKS = [
  { label: 'Why Now', href: '#challenge' },
  { label: 'How It Works', href: '#how' },
  { label: 'Intelligence', href: '#sample' },
  { label: 'Landscape', href: '#coverage' },
  { label: 'Pricing', href: '#pricing' },
];

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // If user came back from OAuth with a pending invite code, redirect to /invite
  useEffect(() => {
    const pendingCode = localStorage.getItem('li_invite_code');
    if (pendingCode) {
      window.location.href = `/invite?code=${pendingCode}`;
    }
  }, []);

  return (
    <div className="min-h-screen">

      {/* ─── STICKY CTA — pill on desktop, bottom bar on mobile ─── */}
      <div className="fixed bottom-6 right-6 z-50 hidden md:block">
        <a
          href="/login"
          className="bg-[#990F3D] hover:bg-[#7a0c31] text-white text-[13px] font-bold px-6 py-3 rounded-full shadow-lg transition-colors no-underline flex items-center gap-2"
        >
          Request access <span className="text-[16px]">&rarr;</span>
        </a>
      </div>
      <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-[#1C1C2E] border-t border-[#2A2A3E] px-6 py-3">
        <a
          href="/login"
          className="block text-center bg-[#990F3D] hover:bg-[#7a0c31] text-white text-[14px] font-bold py-3 rounded transition-colors no-underline"
        >
          Request access
        </a>
      </div>

      {/* ─── STICKY NAV ─── */}
      <nav className="sticky top-0 z-50">
        <div className="bg-[#1C1C2E] border-b border-[#2A2A3E]">
          <div className="max-w-5xl mx-auto px-6 flex items-center justify-between py-4">
            <a href="/" className="text-[18px] md:text-[24px] font-extrabold uppercase tracking-[0.12em] text-white no-underline">
              Living Intelligence
            </a>
            <div className="flex items-center gap-5">
              <span className="hidden md:inline text-[15px] font-bold text-white tracking-wide">AI in Wealth Management</span>
              <span className="hidden md:inline text-[#444] text-[18px] font-light">|</span>
              <a
                href="/login"
                className="text-[14px] text-[#CCCCDD] hover:text-white transition-colors no-underline hidden md:inline"
              >
                Sign in
              </a>
              {/* Hamburger — mobile only */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden text-white p-1"
                aria-label="Menu"
              >
                <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  {mobileMenuOpen ? (
                    <><line x1="6" y1="6" x2="18" y2="18" /><line x1="6" y1="18" x2="18" y2="6" /></>
                  ) : (
                    <><line x1="4" y1="7" x2="20" y2="7" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="17" x2="20" y2="17" /></>
                  )}
                </svg>
              </button>
            </div>
          </div>
        </div>
        {/* Desktop section nav */}
        <div className="bg-[#141420] border-b border-[#2A2A3E] hidden md:block">
          <div className="max-w-5xl mx-auto px-6 flex items-center gap-7 py-2.5">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-[14px] text-[#B0B0C8] hover:text-white transition-colors no-underline tracking-wide whitespace-nowrap"
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>
        {/* Mobile dropdown menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-[#141420] border-b border-[#2A2A3E] px-6 py-4 space-y-3">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className="block text-[15px] text-[#B0B0C8] hover:text-white transition-colors no-underline tracking-wide"
              >
                {link.label}
              </a>
            ))}
            <div className="pt-2 border-t border-[#2A2A3E]">
              <a href="/login" className="block text-[15px] text-[#CCCCDD] hover:text-white no-underline">Sign in</a>
            </div>
          </div>
        )}
      </nav>

      {/* ─── SECTION 1: HERO ─── */}
      <section className="bg-[#1C1C2E]">
        <div className="max-w-5xl mx-auto px-6 pt-8 pb-8 md:pt-14 md:pb-14 text-center">
          <p className="text-[13px] md:text-[15px] font-bold text-[#8888A0] tracking-wide mb-4 md:hidden">AI in Wealth Management</p>
          <div className="max-w-3xl mx-auto">
            <RotatingHeadline />
            <a
              href="#sample"
              className="inline-block bg-[#990F3D] hover:bg-[#7a0c31] text-white text-[14px] md:text-[15px] font-bold px-6 md:px-8 py-3 md:py-4 rounded transition-colors no-underline mt-2"
            >
              View sample intelligence
            </a>
          </div>
        </div>

        {/* Stats strip */}
        <div className="border-t border-[#2A2A3E]">
          <div className="max-w-5xl mx-auto px-6 py-4 md:py-5 grid grid-cols-2 md:flex md:flex-wrap md:justify-center gap-x-10 gap-y-3">
            {[
              { n: STATS.firms, label: 'Firms Tracked' },
              { n: STATS.capabilities, label: 'Capability Dimensions' },
              { n: STATS.entries, label: 'Verified Developments' },
              { n: STATS.queries, label: 'Daily Queries' },
            ].map((s) => (
              <div key={s.label} className="flex items-center gap-2">
                <span className="text-[18px] md:text-[20px] font-extrabold text-white">{s.n}</span>
                <span className="text-[11px] md:text-[12px] uppercase tracking-wider text-[#8888A0]">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── SECTION 2: THE HOOK ─── */}
      <section id="challenge" className="py-16 md:py-20 bg-[#FDF8F2] scroll-mt-24">
        <div className="max-w-5xl mx-auto px-6">
          <div className="space-y-5 text-[17px] text-gray-700 leading-relaxed max-w-3xl">
            <p className="text-[22px] md:text-[26px] font-extrabold text-gray-900 leading-snug">
              The wealth management business model is being rewritten. Right now.
            </p>
            <p>
              BofA: 3.2 billion Erica interactions. Morgan Stanley: 98% advisor AI adoption. Altruist: 1,600 RIA firms signed up in 30 days. These are not pilots. They are live, scaled, and the gap is widening every quarter.
            </p>
            <p className="text-gray-900 font-semibold">
              The question is not whether AI will reshape your business. It is whether you will see it happening in time to respond.
            </p>
            <p className="text-gray-500">
              A consulting firm charges six figures for this picture. By delivery, it&apos;s already out of date.
            </p>
          </div>
        </div>
      </section>

      {/* ─── SECTION 3: HOW IT WORKS ─── */}
      <section id="how" className="py-16 md:py-20 bg-white border-t border-gray-200 scroll-mt-24">
        <div className="max-w-5xl mx-auto px-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#990F3D] mb-2">
            How it works
          </p>
          <hr className="border-t-2 border-[#990F3D] mb-4 w-10" />
          <p className="text-[20px] md:text-[22px] font-extrabold text-gray-900 leading-snug mb-4 max-w-3xl">
            Not a newsletter. Not an AI-generated feed.
          </p>
          <p className="text-[17px] text-gray-700 leading-relaxed mb-10 max-w-3xl">
            We scan thousands of sources daily, verify every claim against original documents, and add editorial analysis on what each development means for your firm. Nothing publishes without human sign-off.
          </p>

          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mb-10">
            <div className="border-l-2 border-[#990F3D] pl-5">
              <p className="text-[14px] font-semibold text-gray-900 mb-1.5">Every source linked</p>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                Click through to the press release, the earnings call, the company newsroom. The original source is always there.
              </p>
            </div>
            <div className="border-l-2 border-gray-300 pl-5">
              <p className="text-[14px] font-semibold text-gray-900 mb-1.5">Multi-source corroboration</p>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                Key developments are cross-referenced across multiple independent sources before publishing.
              </p>
            </div>
            <div className="border-l-2 border-gray-300 pl-5">
              <p className="text-[14px] font-semibold text-gray-900 mb-1.5">Editorial judgement</p>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                Every entry includes analysis on why it matters competitively — not a summary, a point of view.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-x-8 gap-y-2 border-t border-gray-200 pt-5 max-w-4xl">
            {[
              { n: STATS.sources, label: 'Source references' },
              { n: STATS.qualityChecks, label: 'Quality checks per entry' },
              { n: STATS.queries, label: 'Daily discovery queries' },
            ].map((s) => (
              <div key={s.label} className="flex items-center gap-2">
                <span className="text-[16px] font-extrabold text-gray-900">{s.n}</span>
                <span className="text-[11px] text-gray-500 uppercase tracking-wider">{s.label}</span>
              </div>
            ))}
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
                desc: 'AI developments across wealth management, verified against original sources. Each entry tells you what happened, why it matters, and what your competitors are doing about it.',
              },
              {
                title: 'Landscape',
                desc: '37+ firms mapped across 7 AI capability dimensions. Who\u2019s live, who\u2019s piloting, who\u2019s still talking about it. Updated continuously, not once a quarter.',
              },
              {
                title: 'Thought leadership',
                desc: 'Selected essays and research from McKinsey, BCG, Harvard Business School, Wharton, and leading practitioners. The thinking that shapes how the industry\u2019s decision-makers approach AI.',
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
      <section id="sample" className="py-16 md:py-20 bg-white border-t border-gray-200 scroll-mt-24">
        <div className="max-w-5xl mx-auto px-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#990F3D] mb-2">
            Intelligence
          </p>
          <hr className="border-t-2 border-[#990F3D] mb-4 w-10" />
          <p className="text-[17px] text-gray-700 leading-relaxed mb-10 max-w-3xl">
            Each entry is verified against original sources, tells you why it matters, and connects it to the competitive landscape. Three examples from the platform:
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
      <section id="coverage" className="py-16 md:py-20 bg-[#FDF8F2] border-t border-gray-200 scroll-mt-24">
        <div className="max-w-5xl mx-auto px-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#990F3D] mb-2">
            Landscape
          </p>
          <hr className="border-t-2 border-[#990F3D] mb-4 w-10" />
          <p className="text-[17px] text-gray-700 leading-relaxed mb-4 max-w-3xl">
            37+ firms across 7 segments and 7 AI capability dimensions. Every assessment sourced to press releases, earnings calls, and company newsrooms. The competitive picture a consulting firm charges six figures to build — kept current week by week.
          </p>
          <p className="text-[13px] text-gray-500 mb-10 max-w-3xl">
            The full landscape is available to subscribers. Here is how we classify the market.
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
      <section id="thought-leadership" className="py-16 md:py-20 bg-white border-t border-gray-200 scroll-mt-24">
        <div className="max-w-5xl mx-auto px-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#990F3D] mb-2">
            Thought leadership
          </p>
          <hr className="border-t-2 border-[#990F3D] mb-4 w-10" />
          <p className="text-[17px] text-gray-700 leading-relaxed mb-10 max-w-3xl">
            Essays and research from the people shaping how the industry thinks about AI. Selected for relevance, not volume.
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
            One firm license. Up to five people. For the team that needs to know what competitors are doing with AI, without spending hours piecing the picture together.
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
      <section id="pricing" className="py-16 md:py-20 bg-[#FDF8F2] border-t border-gray-200 scroll-mt-24">
        <div className="max-w-5xl mx-auto px-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#990F3D] mb-2">
            Pricing
          </p>
          <hr className="border-t-2 border-[#990F3D] mb-6 w-10" />

          <p className="text-[15px] text-gray-500 mb-10 max-w-2xl">
            A consulting firm charges $75,000+ for a competitive landscape that&apos;s out of date by delivery. Analyst subscriptions cost $25,000+ a year and bury you in volume. We deliver the same quality of intelligence, kept current, for a fraction of either.
          </p>

          <div className="max-w-md">
            <div className="border border-gray-200 rounded-lg p-8 relative bg-white">
              <span className="absolute top-4 right-4 text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-800 px-2 py-0.5 rounded-sm">
                Founding Member
              </span>
              <div className="mb-2 mt-2">
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
                ].map((f) => (
                  <li key={f} className="flex items-start gap-2 text-[13px] text-gray-600">
                    <span className="text-green-500 mt-0.5">&#x2713;</span> {f}
                  </li>
                ))}
              </ul>

              <a
                href="/login"
                className="block text-center bg-[#990F3D] hover:bg-[#7a0c31] text-white text-[14px] font-bold py-3.5 rounded transition-colors no-underline"
              >
                Request access
              </a>

              <p className="text-[12px] text-gray-400 mt-4 text-center">
                Available to the first 50 firms. Standard rate of $5,000/year applies after.
              </p>
            </div>
          </div>

          <p className="text-[13px] text-gray-400 mt-8 max-w-2xl">
            Enterprise pricing available for larger teams and custom research.{' '}
            <a href="mailto:hello@livingintel.ai" className="text-[#990F3D] hover:underline">Get in touch</a>.
          </p>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <section className="bg-[#1C1C2E] py-12 pb-24 md:pb-12 text-center">
        <div className="max-w-2xl mx-auto px-6">
          <p className="text-[12px] text-[#444458]">
            {STATS.entries} verified developments. {STATS.firms} firms tracked. {STATS.capabilities} capability dimensions.{' '}
            Every source linked, every claim verified.
          </p>
          <p className="text-[12px] text-[#444458] mt-3">
            <a href="mailto:hello@livingintel.ai" className="text-[#666680] hover:text-white transition-colors">hello@livingintel.ai</a>
          </p>
        </div>
      </section>

    </div>
  );
}
