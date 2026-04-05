export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-gray-200 mt-16 py-10 bg-white">
      <div className="max-w-6xl mx-auto px-6">

        {/* Main disclaimer */}
        <div className="mb-6 pb-6 border-b border-gray-100">
          <p className="text-xs text-gray-500 leading-relaxed max-w-3xl">
            <span className="font-semibold text-gray-700">For informational purposes only.</span>{' '}
            Nothing on this portal constitutes investment advice, financial advice, trading advice,
            a securities recommendation, or an offer to buy or sell any security or financial
            instrument. The information provided is general in nature and should not be relied upon
            for making any investment decision. You should consult a qualified financial advisor
            before making investment decisions. All content is curated from publicly available
            sources. Any decisions you make based on information from this portal are made solely
            at your own risk.
          </p>
        </div>

        {/* Landscape / ratings disclaimer */}
        <div className="mb-6 pb-6 border-b border-gray-100">
          <p className="text-xs text-gray-500 leading-relaxed max-w-3xl">
            <span className="font-semibold text-gray-700">Capability assessments are directional.</span>{' '}
            Maturity ratings (Scaled, Deployed, Piloting, Announced) reflect editorial judgements
            based on publicly available disclosures, press releases, and reporting as of the date
            shown. They are not certifications, endorsements, or investment ratings. Assessed
            companies have not reviewed or approved these ratings. These ratings reflect our
            editorial opinion only and should not be construed as statements of fact. A rating
            of &ldquo;No Activity&rdquo; means no publicly available evidence was identified — it
            does not mean a company has no internal initiatives in that area.
          </p>
        </div>

        {/* AI-assisted content */}
        <div className="mb-6 pb-6 border-b border-gray-100">
          <p className="text-xs text-gray-500 leading-relaxed max-w-3xl">
            <span className="font-semibold text-gray-700">AI-assisted content.</span>{' '}
            Intelligence summaries on this portal are structured with the assistance of artificial
            intelligence (Anthropic Claude). A separate AI verification step checks all factual
            claims against the original source, and a human editor reviews and approves every entry
            before publication. Despite these safeguards, summaries may contain errors or
            omissions — always refer to the original linked source before acting on any information.
          </p>
        </div>

        {/* Sources, copyright & trademarks */}
        <div className="mb-6 pb-6 border-b border-gray-100">
          <p className="text-xs text-gray-500 leading-relaxed max-w-3xl">
            <span className="font-semibold text-gray-700">Source attribution and copyright.</span>{' '}
            All intelligence entries link to the original source publication. Summaries are
            independently structured editorial abstracts created for research and commentary
            purposes. They are not reproductions or substitutes for the original reporting.
            Copyright in original articles remains with their respective publishers.
          </p>
          <p className="text-xs text-gray-500 leading-relaxed max-w-3xl mt-2">
            <span className="font-semibold text-gray-700">Trademarks.</span>{' '}
            Company names, logos, and trademarks displayed on this portal are the property of their
            respective owners and are used solely for identification and editorial reference
            purposes. Their use does not imply any affiliation with, endorsement by, or sponsorship
            by the respective trademark holders. Living Intelligence is an independent editorial
            publication.
          </p>
        </div>

        {/* Limitation of liability */}
        <div className="mb-6 pb-6 border-b border-gray-100">
          <p className="text-xs text-gray-500 leading-relaxed max-w-3xl">
            <span className="font-semibold text-gray-700">No warranty.</span>{' '}
            All content, data, and ratings are provided on an &ldquo;as is&rdquo; and &ldquo;as
            available&rdquo; basis without warranties of any kind, express or implied. To the
            maximum extent permitted by applicable law, Living Intelligence and its operators shall
            not be liable for any direct, indirect, incidental, or consequential damages arising
            from your use of or reliance on any content on this portal.
          </p>
        </div>

        {/* Footer bottom row */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <span className="text-xs font-semibold text-gray-700">AI in Wealth Management</span>
            <span className="text-xs text-gray-300">|</span>
            <span className="text-xs text-gray-400">Living Intelligence by AI of the Tiger</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs text-gray-400">
              Content updated continuously · Ratings dated per entry
            </span>
            <span className="text-xs text-gray-300">|</span>
            <span className="text-xs text-gray-400">© {year} Tiger AI</span>
          </div>
        </div>

      </div>
    </footer>
  );
}
