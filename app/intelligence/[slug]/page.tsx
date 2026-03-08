import { notFound } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/Header';
import { getIntelligenceEntry, getAllIntelligence, formatDate, TYPE_LABELS } from '@/lib/data';

export async function generateStaticParams() {
  const entries = getAllIntelligence();
  return entries.map(e => ({ slug: e.id }));
}

export default async function IntelligenceArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const entry = getIntelligenceEntry(slug);
  if (!entry) notFound();

  return (
    <div className="min-h-screen bg-white">
      <Header />

      <main className="max-w-3xl mx-auto px-6 py-10">

        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-xs text-gray-400 mb-8">
          <Link href="/" className="hover:text-[#1B2E5E]">This Week</Link>
          <span>›</span>
          <Link href="/intelligence" className="hover:text-[#1B2E5E]">Intelligence</Link>
          <span>›</span>
          <span className="text-gray-600">{entry.company_name}</span>
        </nav>

        {/* Company logo */}
        <div className="mb-6 h-12 flex items-center">
          {entry.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={entry.image_url}
              alt={entry.company_name}
              className="max-h-10 max-w-[160px] object-contain"
            />
          ) : (
            <span className="text-lg font-bold text-gray-700">{entry.company_name}</span>
          )}
        </div>

        {/* Meta */}
        <div className="flex items-center gap-3 mb-4">
          <span className={`type-badge badge-${entry.type}`}>
            {TYPE_LABELS[entry.type]}
          </span>
          <span className="text-xs text-gray-400">{entry.company_name}</span>
          <span className="text-xs text-gray-300">·</span>
          <span className="text-xs text-gray-400">{formatDate(entry.date)}</span>
        </div>

        {/* Headline */}
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 leading-snug mb-6">
          {entry.headline}
        </h1>

        {/* Key stat */}
        {entry.key_stat && (
          <div className="bg-gray-50 border border-gray-100 rounded p-5 mb-8 flex items-center gap-6">
            <div>
              <div className="key-stat-number">{entry.key_stat.number}</div>
              <div className="key-stat-label">{entry.key_stat.label}</div>
            </div>
            <div className="w-px h-10 bg-gray-200" />
            <div className="text-sm text-gray-500">Key figure from this development</div>
          </div>
        )}

        {/* Summary */}
        <div className="prose prose-gray max-w-none mb-10">
          <p className="text-base text-gray-700 leading-relaxed">{entry.summary}</p>
        </div>

        {/* Source */}
        <div className="border-t border-gray-100 pt-6 mb-8">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Source</p>
          <a
            href={entry.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm font-medium text-[#1B2E5E] hover:underline"
          >
            {entry.source_name}
            <span className="text-gray-400">↗</span>
          </a>
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-2 mb-10">
          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
            {entry.tags.region.toUpperCase()}
          </span>
          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
            {entry.tags.segment.replace(/_/g, ' ')}
          </span>
          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
            {entry.tags.capability.replace(/_/g, ' ')}
          </span>
          {entry.tags.theme.map(t => (
            <span key={t} className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded">
              {t.replace(/_/g, ' ')}
            </span>
          ))}
        </div>

        {/* Back */}
        <div className="flex items-center gap-4">
          <Link
            href="/intelligence"
            className="text-sm text-[#1B2E5E] font-medium hover:underline"
          >
            ← Back to Intelligence
          </Link>
          <Link
            href="/"
            className="text-sm text-gray-400 hover:text-[#1B2E5E] hover:underline"
          >
            ← This Week
          </Link>
        </div>

      </main>
    </div>
  );
}
