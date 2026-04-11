import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Link from 'next/link';

export default function AboutPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="max-w-3xl mx-auto px-6 py-12 flex-1">

        {/* Hero */}
        <div className="mb-10">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-[#990F3D] mb-3">
            About the Platform
          </p>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 leading-snug mb-4">
            AI adoption intelligence for wealth management decision-makers
          </h1>
          <p className="text-[15px] text-gray-600 leading-relaxed">
            Living Intelligence tracks how wealth management firms are deploying artificial
            intelligence — across every major capability area, updated daily. Built for
            CIOs, strategists, and senior leaders who need to know what competitors are
            doing, what&apos;s working, and what it means for their firm.
          </p>
        </div>

        {/* What we track */}
        <div className="mb-10 pb-10 border-b border-gray-200">
          <h2 className="text-base font-bold text-gray-900 mb-4">What we track</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div>
              <div className="text-2xl font-bold text-[#990F3D] mb-1">37+</div>
              <div className="text-sm text-gray-600">Wealth management firms tracked globally</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-[#990F3D] mb-1">7</div>
              <div className="text-sm text-gray-600">AI capability dimensions assessed per firm</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-[#990F3D] mb-1">Daily</div>
              <div className="text-sm text-gray-600">Continuous monitoring across 80,000+ sources</div>
            </div>
          </div>
        </div>

        {/* Capability dimensions */}
        <div className="mb-10 pb-10 border-b border-gray-200">
          <h2 className="text-base font-bold text-gray-900 mb-4">Seven capability dimensions</h2>
          <p className="text-sm text-gray-600 mb-5 leading-relaxed">
            Every firm is assessed across the same seven dimensions, making it possible to
            compare AI maturity across the industry — not just within a single firm.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { name: 'Advisor Productivity', desc: 'Meeting prep, CRM automation, note-taking, workflow' },
              { name: 'Client Personalisation', desc: 'Hyper-personalised advice, next-best-action, nudges' },
              { name: 'Investment & Portfolio', desc: 'Portfolio construction, rebalancing, risk analytics' },
              { name: 'Research & Content', desc: 'Market commentary, client reports, content generation' },
              { name: 'Client Acquisition', desc: 'Lead scoring, prospecting, onboarding automation' },
              { name: 'Operations & Compliance', desc: 'KYC/AML, regulatory reporting, document processing' },
              { name: 'New Business Models', desc: 'AI-native products, direct-to-consumer platforms' },
            ].map((cap) => (
              <div key={cap.name} className="flex gap-3 items-start">
                <div className="w-1.5 h-1.5 rounded-full bg-[#990F3D] mt-2 flex-shrink-0" />
                <div>
                  <span className="text-sm font-semibold text-gray-800">{cap.name}</span>
                  <span className="text-sm text-gray-500"> — {cap.desc}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quality standards */}
        <div className="mb-10 pb-10 border-b border-gray-200">
          <h2 className="text-base font-bold text-gray-900 mb-4">How we maintain quality</h2>
          <p className="text-sm text-gray-600 mb-5 leading-relaxed">
            This is not a news aggregator. Every piece of intelligence on this platform
            goes through a rigorous editorial process before publication.
          </p>
          <div className="space-y-4">
            {[
              {
                title: 'Source-linked',
                desc: 'Every claim links back to the original source — press releases, earnings transcripts, product announcements, regulatory filings. Nothing is published without a verifiable origin.',
              },
              {
                title: 'Multi-source verification',
                desc: 'Developments are cross-referenced across multiple independent sources before assessment. Single-source claims are flagged explicitly.',
              },
              {
                title: 'Editorially reviewed',
                desc: 'Every entry is reviewed by a human editor before publication. AI assists with research and structuring — editorial judgement is never automated.',
              },
              {
                title: 'Consulting-grade analysis',
                desc: 'Each development includes a "Why this matters" assessment that connects the news to competitive implications — the kind of analysis you would expect from a strategy consultancy.',
              },
            ].map((item) => (
              <div key={item.title} className="flex gap-3 items-start">
                <span className="text-[#990F3D] font-bold mt-0.5 flex-shrink-0">→</span>
                <div>
                  <span className="text-sm font-semibold text-gray-800">{item.title}.</span>{' '}
                  <span className="text-sm text-gray-600">{item.desc}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Coverage */}
        <div className="mb-10 pb-10 border-b border-gray-200">
          <h2 className="text-base font-bold text-gray-900 mb-4">Coverage</h2>
          <p className="text-sm text-gray-600 leading-relaxed mb-4">
            The platform covers wirehouses, global private banks, regional champions,
            digital disruptors, AI-native platforms, RIA custodians, and specialist advisor tools.
            From Morgan Stanley to Savvy Wealth — if a firm is deploying AI in wealth management,
            we track it.
          </p>
          <div className="flex flex-wrap gap-2">
            {['Wirehouses', 'Global Private Banks', 'Regional Champions', 'Digital Disruptors', 'AI-Native', 'RIA / Independent', 'Advisor Tools'].map((seg) => (
              <span key={seg} className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded">
                {seg}
              </span>
            ))}
          </div>
        </div>

        {/* Contact */}
        <div className="mb-10">
          <h2 className="text-base font-bold text-gray-900 mb-3">Get in touch</h2>
          <p className="text-sm text-gray-600 leading-relaxed">
            Questions, feedback, or partnership enquiries:{' '}
            <a href="mailto:hello@livingintel.ai" className="text-[#990F3D] hover:underline font-medium">
              hello@livingintel.ai
            </a>
          </p>
        </div>

        {/* Explore links */}
        <div className="flex flex-wrap gap-3">
          <Link href="/latest" className="text-sm font-medium text-[#990F3D] border border-[#990F3D] rounded px-4 py-2 hover:bg-[#990F3D] hover:text-white transition-colors">
            Latest intelligence →
          </Link>
          <Link href="/landscape" className="text-sm font-medium text-[#990F3D] border border-[#990F3D] rounded px-4 py-2 hover:bg-[#990F3D] hover:text-white transition-colors">
            View the landscape →
          </Link>
        </div>

      </main>

      <Footer />
    </div>
  );
}
