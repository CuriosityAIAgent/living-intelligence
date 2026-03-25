import Link from 'next/link';
import Header from '@/components/Header';
import SectionLabel from '@/components/SectionLabel';
import AuthorAvatar from '@/components/AuthorAvatar';
import {
  getAllIntelligence,
  getAllThoughtLeadership,
  getAllCompetitors,
  getCapabilities,
  formatDateShort,
  TYPE_LABELS,
  FORMAT_LABELS,
} from '@/lib/data';

export default function HomePage() {
  const allEntries = getAllIntelligence();
  const allTL = getAllThoughtLeadership();
  const competitors = getAllCompetitors();
  const capabilities = getCapabilities();

  const latestDate = allEntries[0]?.date ? new Date(allEntries[0].date) : new Date();
  const monthLabel = latestDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  // Lead story = most recent featured entry, fallback to most recent
  const leadStory = allEntries.find(e => e.featured) || allEntries[0];

  // Featured grid = 6 most recent entries after lead story
  const featured = allEntries.filter(e => e.id !== leadStory?.id).slice(0, 6);

  // Featured TL = most recent entry
  const featuredThought = allTL[0] || null;

  return (
    <div className="min-h-screen">
      <Header />

      {/* Date bar */}
      <div className="border-b border-gray-200 bg-gray-50">
        <div className="max-w-6xl mx-auto px-6 h-9 flex items-center gap-4">
          <span className="text-[11px] font-bold uppercase tracking-widest text-[#990F3D]">{monthLabel}</span>
          <span className="text-gray-300">|</span>
          <span className="text-[11px] text-gray-500">{allEntries.length} developments tracked</span>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-6 py-8">

        {/* Lead Story */}
        {leadStory && (
          <section className="mb-12">
            <div className="mb-4">
              <p className="section-label">Lead Story</p>
              <hr className="section-rule" />
            </div>
            <Link href={`/intelligence/${leadStory.id}`} className="group block">
              <div className="grid md:grid-cols-5 gap-8 items-stretch">
                {/* Logo panel */}
                <div className="md:col-span-2 bg-[#1C1C2E] rounded flex items-center justify-center overflow-hidden p-10 min-h-[220px]">
                  {leadStory.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={leadStory.image_url}
                      alt={leadStory.company_name}
                      className="max-h-20 max-w-[65%] object-contain brightness-0 invert"
                    />
                  ) : (
                    <span className="text-white text-2xl font-bold opacity-80">{leadStory.company_name}</span>
                  )}
                </div>
                {/* Content */}
                <div className="md:col-span-3 flex flex-col justify-between py-1">
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <span className={`type-badge badge-${leadStory.type}`}>
                        {TYPE_LABELS[leadStory.type]}
                      </span>
                      <span className="text-xs text-gray-500 font-medium">{leadStory.company_name}</span>
                      <span className="text-gray-300">·</span>
                      <span className="text-xs text-gray-400">{formatDateShort(leadStory.date)}</span>
                    </div>
                    <h2 className="text-[28px] font-bold text-gray-900 leading-tight mb-4 group-hover:text-[#990F3D] transition-colors">
                      {leadStory.headline}
                    </h2>
                    <p className="text-[15px] text-gray-600 leading-relaxed line-clamp-3">{leadStory.summary}</p>
                  </div>
                  <div>
                    {leadStory.key_stat && (
                      <div className="mt-5 pt-4 border-t border-gray-100 flex items-baseline gap-3">
                        <span className="text-3xl font-extrabold text-[#990F3D]">{leadStory.key_stat.number}</span>
                        <span className="text-xs text-gray-500 leading-snug max-w-xs">{leadStory.key_stat.label}</span>
                      </div>
                    )}
                    {leadStory.source_url && (
                      <div className="mt-4">
                        <span className="text-xs text-[#990F3D] font-medium">{leadStory.source_name} ↗</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </Link>
          </section>
        )}

        {/* Featured Intelligence */}
        {featured.length > 0 && (
          <section className="mb-12">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="section-label">Featured Intelligence</p>
                <hr className="section-rule mt-1" />
              </div>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 mb-5">
              {featured.map(entry => (
                <Link
                  key={entry.id}
                  href={`/intelligence/${entry.id}`}
                  className="article-card rounded p-4 block group flex flex-col"
                >
                  <div className="h-7 mb-3 flex items-center">
                    {entry.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={entry.image_url}
                        alt={entry.company_name}
                        className="max-h-7 max-w-[100px] object-contain"
                      />
                    ) : (
                      <span className="text-xs text-gray-500 font-bold">{entry.company_name}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className={`type-badge badge-${entry.type}`}>
                      {TYPE_LABELS[entry.type]}
                    </span>
                    <span className="text-[10px] text-gray-300">·</span>
                    <span className="text-[10px] text-gray-400 uppercase">{entry.tags?.region}</span>
                  </div>
                  <h3 className="text-sm font-bold text-gray-900 leading-snug mb-2 group-hover:text-[#990F3D] transition-colors flex-1">
                    {entry.headline}
                  </h3>
                  {entry.key_stat && (
                    <div className="mb-2">
                      <span className="text-base font-extrabold text-[#990F3D]">{entry.key_stat.number}</span>
                      <span className="text-[10px] text-gray-400 ml-1.5">{entry.key_stat.label}</span>
                    </div>
                  )}
                  <div className="mt-auto flex items-center justify-between pt-2 border-t border-gray-50">
                    <span className="text-[10px] text-gray-400">{formatDateShort(entry.date)}</span>
                    <span className="text-[10px] text-gray-400">{entry.source_name}</span>
                  </div>
                </Link>
              ))}
            </div>
            <Link href="/intelligence" className="text-sm font-bold text-[#990F3D] hover:underline">
              View all intelligence →
            </Link>
          </section>
        )}

        {/* Featured Thought Leadership */}
        {featuredThought && (
          <section className="mb-12">
            <div className="mb-4">
              <p className="section-label">Featured Thought Leadership</p>
              <hr className="section-rule" />
            </div>
            <Link href={`/thought-leadership/${featuredThought.id}`} className="group block">
              <div className="border border-gray-200 rounded p-6 hover:border-[#990F3D] transition-colors">
                <div className="flex items-start gap-4">
                  <AuthorAvatar name={featuredThought.author.name} size="md" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`format-badge badge-${featuredThought.format}`}>
                        {FORMAT_LABELS[featuredThought.format]}
                      </span>
                      <span className="text-xs text-gray-400">{featuredThought.author.organization}</span>
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 leading-snug mb-1 group-hover:text-[#990F3D] transition-colors">
                      {featuredThought.title}
                    </h3>
                    <p className="text-sm text-gray-500 mb-3">
                      {featuredThought.author.name} · {featuredThought.publication} · {formatDateShort(featuredThought.date_published)}
                    </p>
                    <p className="text-sm text-gray-700 leading-relaxed border-l-2 border-[#990F3D] pl-3">
                      {featuredThought.the_one_insight}
                    </p>
                  </div>
                  <span className="flex-shrink-0 text-[#990F3D] font-bold text-sm hidden md:block">Read →</span>
                </div>
              </div>
            </Link>
            <div className="mt-4">
              <Link href="/thought-leadership" className="text-sm font-bold text-[#990F3D] hover:underline">
                View all thought leadership →
              </Link>
            </div>
          </section>
        )}

        {/* Landscape teaser */}
        <section className="mb-6">
          <SectionLabel label="The AI Landscape" />
          <div className="bg-gray-50 border border-gray-200 rounded p-6">
            <h3 className="font-bold text-gray-900 mb-1">Who Is Doing What</h3>
            <p className="text-sm text-gray-500">
              {competitors.length} institutions · {capabilities.length} capability dimensions
            </p>
          </div>
          <div className="mt-4">
            <Link href="/landscape" className="text-sm font-bold text-[#990F3D] hover:underline">
              View full landscape →
            </Link>
          </div>
        </section>

      </main>
    </div>
  );
}
