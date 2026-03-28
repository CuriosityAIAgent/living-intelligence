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
            <h1 className="text-3xl md:text-[48px] font-extrabold text-white leading-[1.12] mb-6">
              See the AI moves your competitors are making.
            </h1>
            <p className="text-[17px] md:text-[19px] text-[#9999BB] leading-relaxed mb-10 max-w-2xl">
              37 wealth management firms. 7 AI capability dimensions. Every development verified, analysed, and updated weekly.
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
              { n: '37', label: 'Institutions Tracked' },
              { n: '7', label: 'Capability Dimensions' },
              { n: '43+', label: 'Verified Developments' },
              { n: '●', label: 'Updated Weekly' },
            ].map((s) => (
              <div key={s.label} className="flex items-center gap-2.5">
                {s.n === '●' ? (
                  <span className="text-[10px] text-[#990F3D]">●</span>
                ) : (
                  <span className="text-[20px] font-extrabold text-white">{s.n}</span>
                )}
                <span className="text-[11px] uppercase tracking-wider text-[#555568]">{s.label}</span>
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
