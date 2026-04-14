import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchV2Held, decideBrief } from '../api';
import type { V2Brief } from '../types';

export default function HeldTab() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['v2-held'],
    queryFn: fetchV2Held,
    refetchInterval: 60_000,
  });

  const briefs = data?.entries ?? [];

  const handleRetry = async (id: string) => {
    await decideBrief(id, 'RETRY', 'Re-research from Held tab');
    queryClient.invalidateQueries({ queryKey: ['v2-held'] });
    queryClient.invalidateQueries({ queryKey: ['v2-history'] });
  };

  const handleReject = async (id: string) => {
    await decideBrief(id, 'REJECTED', 'Rejected from Held tab');
    queryClient.invalidateQueries({ queryKey: ['v2-held'] });
    queryClient.invalidateQueries({ queryKey: ['v2-history'] });
  };

  return (
    <div>
      {/* ── Page header ── */}
      <div style={{ borderBottom: '1px solid #E5E7EB', background: '#FFFCF8' }}>
        <div style={{ maxWidth: 1152, margin: '0 auto', padding: '20px 24px' }}>
          <div
            className="text-[11px] font-bold uppercase mb-2"
            style={{ color: '#990F3D', letterSpacing: '0.14em' }}
          >
            Quality Review
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-1">
            {briefs.length > 0 ? `${briefs.length} held ${briefs.length === 1 ? 'entry' : 'entries'}` : 'No held entries'}
          </h2>
          <p className="text-sm text-gray-400">
            Entries held for quality review — low score, suspect claims, or thin sourcing.
            Retry sends them back through the v2 pipeline.
          </p>
        </div>
      </div>

      {/* ── Content ── */}
      <div style={{ maxWidth: 1152, margin: '0 auto', padding: '32px 24px' }}>
        {isLoading ? (
          <div className="text-gray-400 text-sm py-20 text-center">Loading…</div>
        ) : briefs.length === 0 ? (
          <div className="text-center" style={{ padding: '80px 24px' }}>
            <div
              className="mx-auto mb-8 flex items-center justify-center rounded-full"
              style={{ width: 80, height: 80, background: '#F0FDF4', border: '2px solid #D1E7D1' }}
            >
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#15803D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-3">No quality holds</h3>
            <p className="text-[15px] text-gray-500 leading-relaxed max-w-md mx-auto">
              When the pipeline holds an entry for quality concerns — low score,
              suspect fabrication, or thin sourcing — it will appear here for your review.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {briefs.map((brief) => (
              <HeldCard
                key={brief.id}
                brief={brief}
                onRetry={handleRetry}
                onReject={handleReject}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function HeldCard({ brief, onRetry, onReject }: {
  brief: V2Brief;
  onRetry: (id: string) => void;
  onReject: (id: string) => void;
}) {
  const entry = brief.v2_entry;
  const score = brief.v2_score;
  const fabVerdict = brief.v2_fabrication_verdict;

  const holdReasons: string[] = [];
  if (score != null && score < 75) holdReasons.push(`Score ${score}/100`);
  if (fabVerdict === 'SUSPECT') holdReasons.push('Suspect fabrication');
  if (fabVerdict === 'FAIL') holdReasons.push('Failed fabrication');
  if (holdReasons.length === 0) holdReasons.push('Quality review');

  const scoreColor = score == null ? '#9CA3AF' : score >= 75 ? '#15803D' : score >= 60 ? '#B45309' : '#B91C1C';

  const age = brief.processed_at
    ? Math.floor((Date.now() - new Date(brief.processed_at).getTime()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <div className="rounded" style={{ background: '#FFFCF8', border: '1px solid #E5E7EB', padding: '28px' }}>
      <div className="flex items-start gap-6">
        {/* Score */}
        <div className="flex-shrink-0 text-center" style={{ minWidth: 56 }}>
          <div className="text-3xl font-extrabold" style={{ color: scoreColor }}>
            {score ?? '—'}
          </div>
          <div className="text-[10px] text-gray-400 mt-1 font-medium">/100</div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Hold reasons */}
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            {holdReasons.map((reason, i) => (
              <span
                key={i}
                className="text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded"
                style={{
                  background: reason.includes('Fail') ? '#FEF2F2' : '#FFFBEB',
                  color: reason.includes('Fail') ? '#B91C1C' : '#B45309',
                }}
              >
                {reason}
              </span>
            ))}
            {age != null && age > 7 && (
              <span className="text-xs text-gray-400">{age} days old</span>
            )}
          </div>

          {/* Company */}
          <div
            className="text-[11px] font-bold uppercase mb-2"
            style={{ color: '#990F3D', letterSpacing: '0.14em' }}
          >
            {entry?.company_name || brief.company_name}
          </div>

          {/* Headline */}
          <h3 className="text-lg font-bold text-gray-900 leading-snug mb-3">
            {entry?.headline || brief.headline}
          </h3>

          {/* The so what */}
          {entry?.the_so_what && (
            <p className="text-[14px] text-gray-500 leading-relaxed mb-4">
              {entry.the_so_what}
            </p>
          )}

          {/* Fabrication issues */}
          {entry?._fabrication?.details && (
            <div className="space-y-1.5 mb-4">
              {entry._fabrication.details
                .filter(d => d.status !== 'verified')
                .slice(0, 3)
                .map((d, i) => (
                  <div key={i} className="text-sm" style={{
                    color: d.status === 'fabricated' ? '#B91C1C' : '#B45309',
                  }}>
                    {d.status === 'fabricated' ? '✗' : '⚠'} {d.claim}
                  </div>
                ))}
            </div>
          )}

          {/* Source link */}
          {brief.source_url && (
            <a
              href={brief.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-medium no-underline hover:underline"
              style={{ color: '#990F3D' }}
            >
              View source ↗
            </a>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3 flex-shrink-0">
          <button
            onClick={() => onRetry(brief.id)}
            className="text-sm font-bold px-6 py-2.5 rounded cursor-pointer transition-colors"
            style={{ border: '1px solid #BFDBFE', color: '#1D4ED8', background: 'transparent' }}
          >
            Retry
          </button>
          <button
            onClick={() => onReject(brief.id)}
            className="text-sm font-semibold px-6 py-2.5 rounded cursor-pointer transition-colors"
            style={{ border: '1px solid #E5E7EB', color: '#6B7280', background: 'transparent' }}
          >
            Reject
          </button>
        </div>
      </div>
    </div>
  );
}
