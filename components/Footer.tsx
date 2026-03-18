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
            or any other advice. All content is curated from publicly available sources.
            AI-generated summaries are produced from source material and may contain errors or
            omissions — always refer to the original source before acting on any information.
          </p>
        </div>

        {/* Landscape / ratings disclaimer */}
        <div className="mb-6 pb-6 border-b border-gray-100">
          <p className="text-xs text-gray-500 leading-relaxed max-w-3xl">
            <span className="font-semibold text-gray-700">Capability assessments are directional.</span>{' '}
            Maturity ratings (Scaled, Deployed, Piloting, Announced) reflect editorial judgements
            based on publicly available disclosures, press releases, and reporting as of the date
            shown. They are not certifications, endorsements, or investment ratings. Assessed
            companies have not reviewed or approved these ratings.
          </p>
        </div>

        {/* Sources & IP */}
        <div className="mb-6 pb-6 border-b border-gray-100">
          <p className="text-xs text-gray-500 leading-relaxed max-w-3xl">
            <span className="font-semibold text-gray-700">Source attribution.</span>{' '}
            All intelligence entries link to the original source publication. Summaries represent
            condensed excerpts for research and reference purposes. Copyright in original articles
            remains with their respective publishers.
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
              Content updated continuously · Ratings as of March 2026
            </span>
            <span className="text-xs text-gray-300">|</span>
            <span className="text-xs text-gray-400">© {year} Tiger AI</span>
          </div>
        </div>

      </div>
    </footer>
  );
}
