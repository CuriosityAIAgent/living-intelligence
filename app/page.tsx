import Link from 'next/link';
import Header from '@/components/Header';
import SectionLabel from '@/components/SectionLabel';
import IntelligenceFeed from '@/components/IntelligenceFeed';
import {
  getAllIntelligence,
  getLatestWeek,
  getThoughtLeadershipEntry,
  formatDateShort,
  FORMAT_LABELS,
} from '@/lib/data';

export default function HomePage() {
  const allEntries = getAllIntelligence();
  const week = getLatestWeek();
  const featuredThought = week
    ? getThoughtLeadershipEntry(week.featured_thought_leadership)
    : null;

  // Lead story = most recent featured entry, fallback to most recent entry
  const leadStoryId =
    allEntries.find(e => e.featured)?.id || allEntries[0]?.id || '';

  // Auto-generate key stats from entries that have them
  const keyStats = allEntries
    .filter(e => e.key_stat)
    .slice(0, 4)
    .map(e => ({ number: e.key_stat!.number, label: e.key_stat!.label }));

  return (
    <div className="min-h-screen bg-white">
      <Header />

      <main className="max-w-6xl mx-auto px-6 py-10">

        {/* Masthead */}
        <div className="mb-10 pb-6 border-b border-gray-200">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">
            AI in Wealth Management &amp; Financial Services
          </h1>
          <p className="text-sm text-gray-500">
            {allEntries.length} developments tracked · Last updated March 2026
          </p>
          {week?.editors_note && (
            <p className="mt-4 text-sm text-gray-600 max-w-3xl leading-relaxed border-l-4 border-[#1B2E5E] pl-4 italic">
              {week.editors_note}
            </p>
          )}
        </div>

        {/* Intelligence Feed — client component with filters */}
        <IntelligenceFeed entries={allEntries} leadStoryId={leadStoryId} />

        {/* By the numbers — auto from key_stat fields */}
        {keyStats.length > 0 && (
          <section className="mt-14 mb-14">
            <SectionLabel label="By the Numbers" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {keyStats.map((stat, i) => (
                <div key={i} className="bg-gray-50 border border-gray-100 rounded p-4">
                  <div className="key-stat-number">{stat.number}</div>
                  <div className="key-stat-label">{stat.label}</div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Featured Thought Leadership */}
        {featuredThought && (
          <section className="mb-14">
            <SectionLabel label="Featured Thought Leadership" />
            <Link href={`/thought-leadership/${featuredThought.id}`} className="group block">
              <div className="border border-gray-200 rounded p-6 hover:border-[#1B2E5E] transition-colors">
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 rounded-full overflow-hidden bg-gray-100 flex-shrink-0 border border-gray-200">
                    {featuredThought.author.photo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={featuredThought.author.photo_url}
                        alt={featuredThought.author.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="flex items-center justify-center h-full text-lg text-gray-400 font-bold">
                        {featuredThought.author.name[0]}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`format-badge badge-${featuredThought.format}`}>
                        {FORMAT_LABELS[featuredThought.format]}
                      </span>
                      <span className="text-xs text-gray-400">{featuredThought.author.organization}</span>
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 leading-snug mb-1 group-hover:text-[#1B2E5E] transition-colors">
                      {featuredThought.title}
                    </h3>
                    <p className="text-sm text-gray-500 mb-2">
                      {featuredThought.author.name} · {featuredThought.publication} · {formatDateShort(featuredThought.date_published)}
                    </p>
                    <blockquote className="text-sm text-gray-700 italic border-l-2 border-[#1B2E5E] pl-3">
                      &ldquo;{featuredThought.the_one_insight}&rdquo;
                    </blockquote>
                  </div>
                  <span className="flex-shrink-0 text-[#1B2E5E] font-bold text-sm hidden md:block">Read →</span>
                </div>
              </div>
            </Link>
            <div className="mt-4">
              <Link href="/thought-leadership" className="text-sm font-medium text-[#1B2E5E] hover:underline">
                View all thought leadership →
              </Link>
            </div>
          </section>
        )}

        {/* Landscape teaser */}
        <section className="mb-6">
          <SectionLabel label="The AI Landscape" />
          <div className="bg-gray-50 border border-gray-200 rounded p-6 flex items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-gray-900 mb-1">Who Is Doing What</h3>
              <p className="text-sm text-gray-500">
                12 institutions · 7 capability dimensions · Updated March 2026
              </p>
            </div>
            <Link href="/landscape" className="text-sm font-bold text-[#1B2E5E] hover:underline flex-shrink-0">
              View full landscape →
            </Link>
          </div>
        </section>

      </main>

      <footer className="border-t border-gray-200 mt-16 py-8">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between">
          <p className="text-xs text-gray-400">
            AI in Wealth Management &amp; Financial Services.
            All summaries are AI-generated from source material. Internal use only.
          </p>
          <p className="text-xs text-gray-300">Updated March 2026</p>
        </div>
      </footer>
    </div>
  );
}
