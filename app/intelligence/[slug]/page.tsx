import React from 'react';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/Header';
import { getIntelligenceEntry, getAllIntelligence, formatDate, TYPE_LABELS } from '@/lib/data';

// Bold financial figures + multi-word proper nouns (company/product names)
function boldKey(text: string): React.ReactNode {
  const parts = text.split(
    /(\$[\d,.]+\s*(?:billion|million|trillion|[BMTKbmtk])?\+?|[\d,.]+\+?\s*%|[\d,]+\+?\s*(?:advisors?|clients?|firms?|employees?|institutions?|hours?|models?)|[A-Z][a-zA-Z&.]+(?:\s+[A-Z][a-zA-Z&.]+){1,4})/g
  );
  return (
    <>
      {parts.map((p, i) =>
        i % 2 === 1
          ? <strong key={i} className="font-semibold text-gray-900">{p}</strong>
          : p
      )}
    </>
  );
}

// Split into sentences; bold opening clause (lede) + key figures + proper nouns
function FormattedSummary({ text }: { text: string }) {
  const sentences = (text.match(/[^.!?]+[.!?]+(?:\s|$)/g) || [text])
    .map(s => s.trim())
    .filter(s => s.length > 10);

  return (
    <ul className="space-y-4">
      {sentences.map((s, i) => {
        // Bold the opening clause — text before first comma/semicolon/colon (chars 15–85)
        const candidates = [s.indexOf(',', 15), s.indexOf(';', 15), s.indexOf(':', 15)]
          .filter(p => p > 0 && p < 85);
        const cut = candidates.length ? Math.min(...candidates) : -1;

        return (
          <li key={i} className="flex gap-3 text-[15px] text-gray-700 leading-relaxed">
            <span className="text-[#990F3D] font-bold mt-[3px] flex-shrink-0 text-xs">→</span>
            <span>
              {cut > 0 ? (
                <>
                  <strong className="font-semibold text-gray-900">{s.slice(0, cut + 1)}</strong>
                  {boldKey(s.slice(cut + 1))}
                </>
              ) : boldKey(s)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

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
    <div className="min-h-screen">
      <Header />

      <main className="max-w-3xl mx-auto px-6 py-10">

        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-xs text-gray-400 mb-8">
          <Link href="/" className="hover:text-[#990F3D]">Latest</Link>
          <span>›</span>
          <Link href="/intelligence" className="hover:text-[#990F3D]">Intelligence</Link>
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
        <div className="mb-10">
          <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-4">AI Summary</p>
          <FormattedSummary text={entry.summary} />
        </div>

        {/* Summary disclaimer */}
        <div className="bg-gray-50 border border-gray-100 rounded px-4 py-2 mb-6 text-xs text-gray-400">
          AI-generated summary from source material · Always refer to the original source
        </div>

        {/* Sources */}
        <div className="border-t border-gray-100 pt-6 mb-8">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-3">
            {entry.additional_sources?.length ? 'Sources' : 'Source'}
          </p>
          <div className="flex flex-col gap-2">
            {entry.source_url ? (
              <a href={entry.source_url} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm font-medium text-[#990F3D] hover:underline">
                {entry.source_name}<span className="text-gray-400">↗</span>
              </a>
            ) : (
              <span className="text-sm text-gray-700">{entry.source_name}</span>
            )}
            {entry.additional_sources?.map((s, i) => (
              <a key={i} href={s.url} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-[#990F3D] hover:underline">
                {s.name}<span className="text-gray-400">↗</span>
              </a>
            ))}
          </div>
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
            className="text-sm text-[#990F3D] font-medium hover:underline"
          >
            ← Back to Intelligence
          </Link>
          <Link
            href="/"
            className="text-sm text-gray-400 hover:text-[#990F3D] hover:underline"
          >
            ← Latest
          </Link>
        </div>

      </main>
    </div>
  );
}
