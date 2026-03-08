import Link from 'next/link';
import Header from '@/components/Header';
import SectionLabel from '@/components/SectionLabel';
import {
  getLatestWeek,
  getIntelligenceEntry,
  getThoughtLeadershipEntry,
  formatDateShort,
  TYPE_LABELS,
  FORMAT_LABELS,
  type IntelligenceEntry,
} from '@/lib/data';

export default function HomePage() {
  const week = getLatestWeek();
  if (!week) return <div>No weekly digest found.</div>;

  const leadStory = getIntelligenceEntry(week.lead_story_id);
  const featuredEntries = week.featured_intelligence
    .map(id => getIntelligenceEntry(id))
    .filter((e): e is IntelligenceEntry => e !== null);
  const featuredThought = getThoughtLeadershipEntry(week.featured_thought_leadership);

  return (
    <div className="min-h-screen bg-white">
      <Header />

      <main className="max-w-6xl mx-auto px-6 py-10">

        {/* Masthead */}
        <div className="mb-10 pb-6 border-b border-gray-200">
          <p className="section-label mb-1">Living Intelligence</p>
          <h1 className="text-3xl font-bold text-gray-900 mb-1">
            AI in Wealth Management &amp; Financial Services
          </h1>
          <p className="text-sm text-gray-500">{week.display_date}</p>
          {week.editors_note && (
            <p className="mt-4 text-base text-gray-700 max-w-3xl leading-relaxed border-l-4 border-[#1B2E5E] pl-4">
              {week.editors_note}
            </p>
          )}
        </div>

        {/* Lead Story */}
        {leadStory && (
          <section className="mb-14">
            <SectionLabel label="The Lead Story" />
            <Link href={`/intelligence/${leadStory.id}`} className="group block">
              <div className="grid md:grid-cols-2 gap-8 items-start">
                {/* Image */}
                <div className="bg-gray-50 rounded overflow-hidden h-60 flex items-center justify-center border border-gray-100">
                  {leadStory.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={leadStory.image_url}
                      alt={leadStory.company_name}
                      className="max-h-full max-w-[70%] object-contain"
                    />
                  ) : (
                    <span className="text-gray-400 text-sm">{leadStory.company_name}</span>
                  )}
                </div>
                {/* Text */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className={`type-badge badge-${leadStory.type}`}>
                      {TYPE_LABELS[leadStory.type]}
                    </span>
                    <span className="text-xs text-gray-400">{leadStory.company_name}</span>
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 leading-snug mb-3 group-hover:text-[#1B2E5E] transition-colors">
                    {leadStory.headline}
                  </h2>
                  <p className="text-gray-600 leading-relaxed text-sm line-clamp-4">
                    {leadStory.summary}
                  </p>
                  {leadStory.key_stat && (
                    <div className="mt-4">
                      <div className="key-stat-number">{leadStory.key_stat.number}</div>
                      <div className="key-stat-label">{leadStory.key_stat.label}</div>
                    </div>
                  )}
                  <div className="mt-4 flex items-center gap-3">
                    <span className="text-xs text-gray-400">{formatDateShort(leadStory.date)}</span>
                    <span className="text-xs text-gray-300">·</span>
                    <span className="text-xs text-[#1B2E5E] font-medium">
                      {leadStory.source_name}
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          </section>
        )}

        {/* This Week In AI */}
        <section className="mb-14">
          <SectionLabel label="This Week in AI Wealth Management" />
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {featuredEntries.map((entry) => (
              <Link
                key={entry.id}
                href={`/intelligence/${entry.id}`}
                className="article-card rounded p-4 block group"
              >
                {/* Logo thumbnail */}
                <div className="h-10 mb-3 flex items-center">
                  {entry.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={entry.image_url}
                      alt={entry.company_name}
                      className="max-h-8 max-w-[100px] object-contain"
                    />
                  ) : (
                    <span className="text-xs text-gray-400 font-medium">{entry.company_name}</span>
                  )}
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`type-badge badge-${entry.type}`}>
                    {TYPE_LABELS[entry.type]}
                  </span>
                </div>
                <h3 className="text-sm font-bold text-gray-900 leading-snug mb-2 group-hover:text-[#1B2E5E] transition-colors">
                  {entry.headline}
                </h3>
                {entry.key_stat && (
                  <div className="mt-2 mb-2">
                    <span className="text-lg font-extrabold text-[#1B2E5E]">
                      {entry.key_stat.number}
                    </span>
                    <span className="text-xs text-gray-500 ml-2">{entry.key_stat.label}</span>
                  </div>
                )}
                <p className="text-xs text-gray-500 mt-auto">
                  {formatDateShort(entry.date)} · {entry.source_name}
                </p>
              </Link>
            ))}
          </div>
          <div className="mt-5">
            <Link
              href="/intelligence"
              className="text-sm font-medium text-[#1B2E5E] hover:underline"
            >
              View all market intelligence →
            </Link>
          </div>
        </section>

        {/* By the Numbers */}
        <section className="mb-14">
          <SectionLabel label="By the Numbers" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {week.by_the_numbers.map((stat, i) => (
              <div key={i} className="border border-gray-100 rounded p-4 bg-gray-50">
                <div className="key-stat-number">{stat.number}</div>
                <div className="key-stat-label">{stat.label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Featured Thought Leadership */}
        {featuredThought && (
          <section className="mb-14">
            <SectionLabel label="Featured Thought Leadership" />
            <Link href={`/thought-leadership/${featuredThought.id}`} className="group block">
              <div className="border border-gray-200 rounded p-6 hover:border-[#1B2E5E] transition-colors">
                <div className="flex items-start gap-4">
                  {/* Author photo */}
                  <div className="w-14 h-14 rounded-full overflow-hidden bg-gray-100 flex-shrink-0 border border-gray-200">
                    {featuredThought.author.photo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={featuredThought.author.photo_url}
                        alt={featuredThought.author.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="flex items-center justify-center h-full text-lg text-gray-400">
                        {featuredThought.author.name[0]}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`format-badge badge-${featuredThought.format}`}>
                        {FORMAT_LABELS[featuredThought.format]}
                      </span>
                      <span className="text-xs text-gray-400">
                        {featuredThought.author.organization}
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 leading-snug mb-1 group-hover:text-[#1B2E5E] transition-colors">
                      {featuredThought.title}
                    </h3>
                    <p className="text-sm text-gray-500 mb-3">
                      {featuredThought.author.name} · {featuredThought.publication} ·{' '}
                      {formatDateShort(featuredThought.date_published)}
                    </p>
                    <blockquote className="text-sm text-gray-700 italic border-l-2 border-[#1B2E5E] pl-3">
                      &ldquo;{featuredThought.the_one_insight}&rdquo;
                    </blockquote>
                  </div>
                  <div className="flex-shrink-0 text-[#1B2E5E] font-bold text-sm hidden md:block">
                    Read →
                  </div>
                </div>
              </div>
            </Link>
            <div className="mt-4">
              <Link
                href="/thought-leadership"
                className="text-sm font-medium text-[#1B2E5E] hover:underline"
              >
                View all thought leadership →
              </Link>
            </div>
          </section>
        )}

        {/* Landscape Teaser */}
        <section className="mb-6">
          <SectionLabel label="The AI Landscape" />
          <div className="bg-gray-50 border border-gray-200 rounded p-6 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-gray-900 mb-1">Who Is Doing What</h3>
              <p className="text-sm text-gray-500">
                12 institutions · 7 capability dimensions · Updated March 2026
              </p>
            </div>
            <Link
              href="/landscape"
              className="text-sm font-bold text-[#1B2E5E] hover:underline flex-shrink-0"
            >
              View full landscape →
            </Link>
          </div>
        </section>

      </main>

      <footer className="border-t border-gray-200 mt-16 py-8">
        <div className="max-w-6xl mx-auto px-6">
          <p className="text-xs text-gray-400">
            Living Intelligence — AI in Wealth Management &amp; Financial Services.
            All sources linked. Updated weekly.
          </p>
        </div>
      </footer>
    </div>
  );
}
