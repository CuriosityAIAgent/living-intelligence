import { notFound } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/Header';
import { getThoughtLeadershipEntry, getAllThoughtLeadership, formatDate, FORMAT_LABELS } from '@/lib/data';

export async function generateStaticParams() {
  const entries = getAllThoughtLeadership();
  return entries.map(e => ({ slug: e.id }));
}

export default async function ThoughtLeadershipPiecePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const entry = getThoughtLeadershipEntry(slug);
  if (!entry) notFound();

  return (
    <div className="min-h-screen bg-white">
      <Header />

      <main className="max-w-3xl mx-auto px-6 py-10">

        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-xs text-gray-400 mb-8">
          <Link href="/" className="hover:text-[#1B2E5E]">Latest</Link>
          <span>›</span>
          <Link href="/thought-leadership" className="hover:text-[#1B2E5E]">Thought Leadership</Link>
          <span>›</span>
          <span className="text-gray-600">{entry.author.name}</span>
        </nav>

        {/* Author block */}
        <div className="flex items-start gap-4 mb-8 pb-8 border-b border-gray-100">
          <div className="w-16 h-16 rounded-full overflow-hidden bg-gray-100 border border-gray-200 flex-shrink-0">
            {entry.author.photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={entry.author.photo_url}
                alt={entry.author.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="flex items-center justify-center h-full text-2xl text-gray-400 font-bold">
                {entry.author.name[0]}
              </span>
            )}
          </div>
          <div>
            <h2 className="font-bold text-gray-900">{entry.author.name}</h2>
            <p className="text-sm text-gray-500">{entry.author.title}</p>
            <p className="text-sm text-gray-500">{entry.author.organization}</p>
          </div>
        </div>

        {/* Meta */}
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <span className={`format-badge badge-${entry.format}`}>
            {FORMAT_LABELS[entry.format]}
          </span>
          <span className="text-xs text-gray-400">{entry.publication}</span>
          <span className="text-xs text-gray-300">·</span>
          <span className="text-xs text-gray-400">{formatDate(entry.date_published)}</span>
          {entry.has_document && (
            <span className="text-xs text-green-700 bg-green-50 px-1.5 py-0.5 rounded">
              PDF available
            </span>
          )}
        </div>

        {/* Title */}
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 leading-snug mb-8">
          {entry.title}
        </h1>

        {/* The One Insight — callout */}
        <div className="bg-[#F0F4FF] border border-[#C7D2FE] rounded p-5 mb-10">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#1B2E5E] mb-2">
            The One Insight
          </p>
          <p className="text-base font-medium text-[#1B2E5E] leading-relaxed italic">
            &ldquo;{entry.the_one_insight}&rdquo;
          </p>
        </div>

        {/* Executive Summary */}
        <div className="mb-10">
          <h2 className="text-sm font-bold uppercase tracking-wide text-gray-500 mb-4">
            Executive Summary
          </h2>
          <ul className="space-y-3">
            {entry.executive_summary.map((point, i) => (
              <li key={i} className="flex gap-3 text-sm text-gray-700 leading-relaxed">
                <span className="text-[#1B2E5E] font-bold mt-0.5 flex-shrink-0">→</span>
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Key Quotes */}
        {entry.key_quotes.length > 0 && (
          <div className="mb-10">
            <h2 className="text-sm font-bold uppercase tracking-wide text-gray-500 mb-4">
              Key Quotes
            </h2>
            <div className="space-y-5">
              {entry.key_quotes.map((quote, i) => (
                <div key={i} className="border-l-2 border-[#1B2E5E] pl-4">
                  <blockquote className="text-base text-gray-800 italic mb-2 leading-relaxed">
                    &ldquo;{quote.text}&rdquo;
                  </blockquote>
                  <p className="text-xs text-gray-400">{quote.context}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tags */}
        <div className="flex flex-wrap gap-2 mb-8">
          {entry.tags.map(tag => (
            <span key={tag} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
              {tag.replace(/_/g, ' ')}
            </span>
          ))}
        </div>

        {/* Read original + document */}
        <div className="border-t border-gray-100 pt-6 mb-8 space-y-3">
          <a
            href={entry.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-[#1B2E5E] text-white text-sm font-medium px-5 py-2.5 rounded hover:bg-[#2A4080] transition-colors"
          >
            Read the Original ↗
          </a>
          {entry.has_document && entry.document_url && (
            <a
              href={entry.document_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 border border-gray-200 text-sm font-medium px-5 py-2.5 rounded hover:border-[#1B2E5E] hover:text-[#1B2E5E] transition-colors ml-3"
            >
              Download PDF ↓
            </a>
          )}
        </div>

        {/* Back */}
        <div className="flex items-center gap-4">
          <Link
            href="/thought-leadership"
            className="text-sm text-[#1B2E5E] font-medium hover:underline"
          >
            ← Back to Thought Leadership
          </Link>
          <Link
            href="/"
            className="text-sm text-gray-400 hover:text-[#1B2E5E] hover:underline"
          >
            ← Latest
          </Link>
        </div>

      </main>
    </div>
  );
}
