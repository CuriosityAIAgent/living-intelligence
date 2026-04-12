import Header from '@/components/Header';
import Footer from '@/components/Footer';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-10 flex-1">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-6">Privacy Policy</h1>

        <div className="prose prose-sm text-gray-600 space-y-6">
          <section>
            <h2 className="text-base font-semibold text-gray-800 mb-2">What we collect</h2>
            <p className="leading-relaxed">
              When you create an account, we collect your name, email address, and company.
              We use cookies to maintain your login session. We do not sell, share, or distribute
              your personal information to third parties.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-800 mb-2">Authentication</h2>
            <p className="leading-relaxed">
              Authentication is handled by Supabase (a Postgres-backed auth service).
              If you sign in with Google, we receive your name and email from your Google
              account. We do not store your Google password.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-800 mb-2">Analytics</h2>
            <p className="leading-relaxed">
              We may use privacy-focused analytics (PostHog) to understand how the platform is
              used. This helps us improve the product. We do not use analytics data for advertising
              or share it with third parties.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-800 mb-2">AI-assisted content</h2>
            <p className="leading-relaxed">
              Intelligence summaries are structured with the assistance of AI (Anthropic Claude).
              A separate verification step checks all claims against the original source, and a
              human editor reviews every entry before publication. Despite these safeguards,
              summaries may contain errors — always refer to the original linked source.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-800 mb-2">Data security</h2>
            <p className="leading-relaxed">
              All data is transmitted over HTTPS. User data is stored in Supabase
              (hosted in Europe) with row-level security enabled. Payment processing
              is handled by Stripe — we never see or store your card details.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-800 mb-2">Not investment advice</h2>
            <p className="leading-relaxed">
              Nothing on this platform constitutes investment advice, financial advice,
              or a securities recommendation. Capability assessments are editorial opinions
              based on publicly available evidence. Consult a qualified financial advisor
              before making investment decisions.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-800 mb-2">Contact</h2>
            <p className="leading-relaxed">
              Questions about this policy? Email us at{' '}
              <a href="mailto:hello@livingintel.ai" className="text-[#990F3D] hover:underline">
                hello@livingintel.ai
              </a>.
            </p>
          </section>

          <p className="text-xs text-gray-400 pt-4 border-t border-gray-100">
            Last updated: April 2026
          </p>
        </div>
      </main>

      <Footer />
    </div>
  );
}
