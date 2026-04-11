import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="bg-[#1C1C2E] text-white mt-16">
      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">

          {/* Brand */}
          <div>
            <p className="text-[13px] font-bold uppercase tracking-widest mb-3">
              Living Intelligence
            </p>
            <p className="text-[13px] text-[#9999BB] leading-relaxed">
              AI adoption intelligence for wealth management decision-makers.
              7 capability dimensions tracked across the industry — verified, analysed, and updated daily.
            </p>
          </div>

          {/* Platform links */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-[#990F3D] mb-3">
              Platform
            </p>
            <ul className="space-y-2">
              {[
                { label: 'Latest', href: '/latest' },
                { label: 'Intelligence', href: '/intelligence' },
                { label: 'Landscape', href: '/landscape' },
                { label: 'Thought Leadership', href: '/thought-leadership' },
              ].map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="text-[13px] text-[#9999BB] hover:text-white transition-colors no-underline"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company + Feedback */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-[#990F3D] mb-3">
              Company
            </p>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/about"
                  className="text-[13px] text-[#9999BB] hover:text-white transition-colors no-underline"
                >
                  About Living Intelligence
                </Link>
              </li>
              <li>
                <Link
                  href="/privacy"
                  className="text-[13px] text-[#9999BB] hover:text-white transition-colors no-underline"
                >
                  Privacy
                </Link>
              </li>
              <li>
                <a
                  href="mailto:hello@livingintel.ai"
                  className="text-[13px] text-[#9999BB] hover:text-white transition-colors no-underline"
                >
                  Contact
                </a>
              </li>
            </ul>

            <div className="mt-5 pt-4 border-t border-[#2A2A3E]">
              <a
                href="mailto:hello@livingintel.ai?subject=Living%20Intelligence%20Feedback"
                className="inline-flex items-center gap-1.5 text-[13px] text-[#990F3D] hover:text-white transition-colors no-underline font-medium"
              >
                Share feedback →
              </a>
            </div>
          </div>
        </div>

        {/* Disclaimer + copyright */}
        <div className="mt-8 pt-6 border-t border-[#2A2A3E]">
          <p className="text-[11px] text-[#666680] leading-relaxed mb-3">
            AI-assisted analysis for informational purposes only. Not investment advice.
            All sources linked. Assessments are directional and based on publicly available evidence.
          </p>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <p className="text-[11px] text-[#666680]">
              © {new Date().getFullYear()} Curiosity AI
            </p>
            <p className="text-[11px] text-[#666680]">
              hello@livingintel.ai
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
