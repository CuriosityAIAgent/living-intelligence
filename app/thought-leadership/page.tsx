import Link from 'next/link';
import Header from '@/components/Header';
import AuthorAvatar from '@/components/AuthorAvatar';
import SectionLabel from '@/components/SectionLabel';
import { getAllThoughtLeadership, formatDateShort, FORMAT_LABELS } from '@/lib/data';

export default function ThoughtLeadershipPage() {
  const entries = getAllThoughtLeadership();

  return (
    <div className="min-h-screen bg-white">
      <Header />

      <main className="max-w-6xl mx-auto px-6 py-10">

        {/* Page header */}
        <div className="mb-10 pb-6 border-b border-gray-200">
          <p className="section-label mb-2">Thought Leadership</p>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            What the Smartest People Are Thinking
          </h1>
          <p className="text-sm text-gray-500">
            Essays, reports, and speeches on AI in financial services — curated and summarized.
          </p>
        </div>

        {/* All entries */}
        <section>
          <SectionLabel label={`All Pieces — ${entries.length} entries`} />
          <div className="space-y-4">
            {entries.map((entry) => (
              <Link
                key={entry.id}
                href={`/thought-leadership/${entry.id}`}
                className="article-card rounded p-5 flex gap-5 items-start group block"
              >
                {/* Author avatar */}
                <AuthorAvatar name={entry.author.name} size="md" />

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className={`format-badge badge-${entry.format}`}>
                      {FORMAT_LABELS[entry.format]}
                    </span>
                    <span className="text-xs text-gray-400">{entry.author.organization}</span>
                    <span className="text-xs text-gray-200">·</span>
                    <span className="text-xs text-gray-400">{formatDateShort(entry.date_published)}</span>
                    {entry.has_document && (
                      <>
                        <span className="text-xs text-gray-200">·</span>
                        <span className="text-xs text-green-700 bg-green-50 px-1.5 py-0.5 rounded">PDF</span>
                      </>
                    )}
                  </div>
                  <h3 className="text-[15px] font-bold text-gray-900 leading-snug mb-1 group-hover:text-[#1B2E5E] transition-colors">
                    {entry.title}
                  </h3>
                  <p className="text-xs text-gray-400 mb-2">
                    {entry.author.name} · {entry.publication}
                  </p>
                  <p className="text-sm text-gray-500 italic leading-relaxed line-clamp-2">
                    &ldquo;{entry.the_one_insight}&rdquo;
                  </p>
                </div>

                <div className="flex-shrink-0 text-[#1B2E5E] text-sm font-semibold hidden md:flex items-center self-center">
                  Read →
                </div>
              </Link>
            ))}
          </div>
        </section>

      </main>

      <footer className="border-t border-gray-200 mt-16 py-8">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between">
          <p className="text-xs text-gray-400">
            AI in Wealth Management. All sources linked. Updated regularly.
          </p>
          <p className="text-xs text-gray-300">Internal use only</p>
        </div>
      </footer>
    </div>
  );
}
