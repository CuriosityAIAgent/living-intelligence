import { useState } from 'react';
import type { V2Brief } from '../types';

interface V2CardProps {
  brief: V2Brief;
  onApprove: (id: string) => void;
  onReject: (id: string, reason: string) => void;
  onRetry: (id: string) => void;
  approving?: boolean;
}

const REJECT_REASONS = [
  'Already covered',
  'Off topic',
  'Low quality',
  'Weak sourcing',
  'Other',
];

function formatDate(dateStr?: string): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${d.getUTCDate()} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  } catch {
    return dateStr;
  }
}

export default function V2Card({ brief, onApprove, onReject, onRetry, approving }: V2CardProps) {
  const [expanded, setExpanded] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectNotes, setRejectNotes] = useState('');

  const entry = brief.v2_entry;
  if (!entry) return null;

  const score = brief.v2_score;
  const fabVerdict = brief.v2_fabrication_verdict;
  const evaluation = brief.v2_evaluation;
  const research = entry._research;
  const iterations = brief.v2_iterations ?? entry._iterations;
  const fabrication = entry._fabrication;
  const sources = entry.sources ?? [];

  const scoreColor = score == null ? '#9CA3AF' : score >= 75 ? '#15803D' : score >= 60 ? '#B45309' : '#B91C1C';
  const fabColor = fabVerdict === 'CLEAN' ? '#15803D' : fabVerdict === 'SUSPECT' ? '#B45309' : fabVerdict === 'FAIL' ? '#B91C1C' : '#9CA3AF';
  const fabBg = fabVerdict === 'CLEAN' ? '#F0FDF4' : fabVerdict === 'SUSPECT' ? '#FFFBEB' : fabVerdict === 'FAIL' ? '#FEF2F2' : '#F9FAFB';

  // McKinsey checks summary
  const checks = evaluation?.checks;
  const checkCount = checks ? Object.keys(checks).length : 0;
  const passCount = checks ? Object.values(checks).filter((c: { pass: boolean }) => c.pass).length : 0;

  const articleDate = formatDate(entry.date);
  const processedDate = formatDate(brief.processed_at);

  const handleReject = () => {
    if (!rejectReason) return;
    onReject(brief.id, rejectReason + (rejectNotes ? ` — ${rejectNotes}` : ''));
    setRejecting(false);
    setRejectReason('');
    setRejectNotes('');
  };

  return (
    <div className="rounded-lg mb-8" style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 6px 16px rgba(0,0,0,0.03)' }}>

      {/* ── Top bar: company + type + dates ── */}
      <div className="px-8 pt-6 pb-0 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: '#990F3D' }}>
            {entry.company_name}
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded" style={{ background: '#F0F0FF', color: '#4338CA' }}>
            {entry.type?.replace(/_/g, ' ') || 'intelligence'}
          </span>
        </div>
        <div className="flex flex-col items-end gap-0.5">
          <span className="text-xs font-medium text-gray-600">
            Article: {articleDate}
          </span>
          {processedDate && (
            <span className="text-[11px] text-gray-400">
              Processed: {processedDate}
            </span>
          )}
        </div>
      </div>

      {/* ── Headline ── */}
      <div className="px-8 pt-4 pb-2">
        <h3 className="text-xl font-bold text-gray-900 leading-snug">
          {entry.headline}
        </h3>
      </div>

      {/* ── Confidence strip: score + fabrication + checks + sources ── */}
      <div className="mx-8 my-4 flex items-center gap-5 py-3 px-5 rounded-lg" style={{ background: '#FAFAFA', border: '1px solid #F0F0F0' }}>
        {/* Score */}
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-extrabold" style={{ color: scoreColor }}>
            {score ?? '—'}
          </span>
          <span className="text-[10px] text-gray-400 font-medium">/100</span>
        </div>

        <div className="w-px h-8 bg-gray-200" />

        {/* Fabrication */}
        {fabVerdict && (
          <span
            className="text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded"
            style={{ background: fabBg, color: fabColor }}
          >
            {fabVerdict}
          </span>
        )}

        <div className="w-px h-8 bg-gray-200" />

        {/* McKinsey checks */}
        {checkCount > 0 && (
          <span className="text-xs text-gray-500 font-medium">
            {passCount}/{checkCount} checks
          </span>
        )}

        <div className="w-px h-8 bg-gray-200" />

        {/* Source count */}
        <span className="text-xs text-gray-500 font-medium">
          {sources.length} source{sources.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* ── The So What ── */}
      {entry.the_so_what && (
        <div className="mx-8 mb-5">
          <div
            className="border-l-4 rounded-r"
            style={{ borderColor: '#990F3D', background: '#FDF8F5', padding: '16px 20px' }}
          >
            <div className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: '#990F3D' }}>
              The So What
            </div>
            <p className="text-[14px] text-gray-800 leading-relaxed m-0">
              {entry.the_so_what}
            </p>
          </div>
        </div>
      )}

      {/* ── Key stat ── */}
      {entry.key_stat && (
        <div className="mx-8 mb-5">
          <div className="inline-flex items-baseline gap-3 px-5 py-3 rounded-lg" style={{ background: '#FAF5FF', border: '1px solid #EDE9FE' }}>
            <span className="text-2xl font-extrabold" style={{ color: '#990F3D' }}>
              {entry.key_stat.number}
            </span>
            <span className="text-sm text-gray-500">{entry.key_stat.label}</span>
          </div>
        </div>
      )}

      {/* ── Summary ── */}
      {entry.summary && (
        <div className="mx-8 mb-5">
          <p className="text-[14px] text-gray-600 leading-relaxed m-0">
            {entry.summary}
          </p>
        </div>
      )}

      {/* ── Sources ── */}
      {sources.length > 0 && (
        <div className="mx-8 mb-5 flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mr-1">Sources</span>
          {sources.map((s, i) => (
            <span key={i} className="inline-flex items-center gap-1">
              {s.url ? (
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs no-underline hover:underline"
                  style={{ color: '#990F3D' }}
                >
                  {s.name || (() => { try { return new URL(s.url).hostname.replace('www.', ''); } catch { return 'source'; } })()}
                </a>
              ) : (
                <span className="text-xs text-gray-500">{s.name || 'unknown'}</span>
              )}
              {s.type === 'primary' && (
                <span className="text-[8px] font-bold uppercase text-green-700 bg-green-50 px-1 py-px rounded">
                  primary
                </span>
              )}
              {i < sources.length - 1 && <span className="text-gray-300 mx-1">·</span>}
            </span>
          ))}
        </div>
      )}

      {/* ── Expand toggle ── */}
      <div className="mx-8 mb-2">
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs font-semibold cursor-pointer bg-transparent border-none p-0"
          style={{ color: '#990F3D' }}
        >
          {expanded ? '▾ Hide details' : '▸ Show research, fabrication & checks'}
        </button>
      </div>

      {/* ── Expanded detail sections ── */}
      {expanded && (
        <div className="mx-8 mb-4 space-y-4 mt-3">
          {/* McKinsey Test */}
          {checks && (
            <DetailSection title="McKinsey 6-Check Test" accent="#6366F1">
              <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                {Object.entries(checks).map(([check, result]) => (
                  <div key={check} className="flex items-center gap-2 text-sm">
                    <span style={{ color: result.pass ? '#15803D' : '#B91C1C', fontSize: 14 }}>
                      {result.pass ? '✓' : '✗'}
                    </span>
                    <span className="font-medium text-gray-700 capitalize">{check.replace(/_/g, ' ')}</span>
                    {!result.pass && result.feedback && (
                      <span className="text-xs text-gray-400 truncate" title={result.feedback}>— {result.feedback}</span>
                    )}
                  </div>
                ))}
              </div>
            </DetailSection>
          )}

          {/* Research */}
          {research && (
            <DetailSection title="Research Brief" accent="#3730A3">
              {research.whats_new && (
                <p className="text-sm text-gray-700 mb-3 leading-relaxed m-0">
                  <span className="font-semibold">What's new: </span>{research.whats_new}
                </p>
              )}
              <div className="flex gap-6 text-xs text-gray-500">
                <span>{research.source_count ?? 0} sources found</span>
                <span>Confidence: {research.research_confidence ?? 'unknown'}</span>
              </div>
              {research.peer_context && research.peer_context.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Peer context</span>
                  <div className="flex gap-3 mt-1.5 flex-wrap">
                    {research.peer_context.map((p, i) => (
                      <span key={i} className="text-xs text-gray-600 bg-gray-50 px-2.5 py-1 rounded">
                        {p.company}: <span className="font-semibold">{p.maturity}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </DetailSection>
          )}

          {/* Fabrication */}
          {fabrication && (
            <DetailSection
              title={`Fabrication: ${fabrication.verdict}`}
              accent={fabrication.verdict === 'CLEAN' ? '#15803D' : fabrication.verdict === 'SUSPECT' ? '#B45309' : '#B91C1C'}
            >
              <div className="flex gap-6 text-xs text-gray-500 mb-3">
                <span>{fabrication.claims_checked ?? 0} checked</span>
                <span>{fabrication.claims_verified ?? 0} verified</span>
                {(fabrication.claims_fabricated ?? 0) > 0 && (
                  <span className="text-red-600 font-semibold">{fabrication.claims_fabricated} fabricated</span>
                )}
              </div>
              {fabrication.details && fabrication.details.length > 0 && (
                <div className="space-y-1">
                  {fabrication.details.slice(0, 8).map((d, i) => (
                    <div key={i} className="text-sm leading-relaxed" style={{
                      color: d.status === 'verified' ? '#15803D' : d.status === 'fabricated' ? '#B91C1C' : '#B45309',
                    }}>
                      {d.status === 'verified' ? '✓' : d.status === 'fabricated' ? '✗' : '⚠'}{' '}
                      {d.claim}
                      {d.source && <span className="text-gray-400 ml-1 text-xs">({d.source})</span>}
                    </div>
                  ))}
                </div>
              )}
            </DetailSection>
          )}

          {/* Iterations */}
          {iterations && iterations.length > 0 && (
            <DetailSection title="Iteration History" accent="#9CA3AF">
              <div className="space-y-2">
                {iterations.map((it, i) => (
                  <div key={i} className="text-sm text-gray-600 leading-relaxed">
                    <span className="font-semibold text-gray-700">v{it.version}</span>
                    {it.score != null && <span className="ml-2 text-gray-500">score {it.score}/10</span>}
                    {it.feedback && <span className="ml-2 text-gray-400">— {it.feedback}</span>}
                  </div>
                ))}
              </div>
            </DetailSection>
          )}
        </div>
      )}

      {/* ── Actions ── */}
      <div className="px-8 py-5 mt-2" style={{ background: '#FAFAFA', borderTop: '2px solid #F0F0F0', borderRadius: '0 0 8px 8px' }}>
        {!rejecting ? (
          <div className="flex items-center gap-4">
            <button
              onClick={() => onApprove(brief.id)}
              disabled={approving}
              className="text-white border-none rounded px-8 py-3 text-sm font-bold cursor-pointer disabled:opacity-60 disabled:cursor-wait"
              style={{ background: approving ? '#86EFAC' : '#15803D', letterSpacing: '0.03em' }}
            >
              {approving ? 'Publishing…' : 'Approve & Publish'}
            </button>
            <button
              onClick={() => onRetry(brief.id)}
              className="rounded px-6 py-3 text-sm font-bold cursor-pointer"
              style={{ border: '1px solid #990F3D', color: '#990F3D', background: 'transparent' }}
            >
              Re-research
            </button>
            <button
              onClick={() => setRejecting(true)}
              className="rounded px-6 py-3 text-sm font-bold cursor-pointer"
              style={{ border: '1px solid #D1D5DB', color: '#6B7280', background: 'transparent' }}
            >
              Reject
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-4 rounded-lg p-5" style={{ background: '#FFFFFF', border: '1px solid #FECACA' }}>
            <div className="text-sm font-semibold text-gray-700 mb-1">Rejection reason</div>
            <div className="flex gap-2 flex-wrap">
              {REJECT_REASONS.map((r) => (
                <button
                  key={r}
                  onClick={() => setRejectReason(r)}
                  className="text-xs px-4 py-2 rounded-full border cursor-pointer transition-colors"
                  style={{
                    borderColor: rejectReason === r ? '#990F3D' : '#E5E7EB',
                    background: rejectReason === r ? '#990F3D' : '#fff',
                    color: rejectReason === r ? '#fff' : '#374151',
                  }}
                >
                  {r}
                </button>
              ))}
            </div>
            <textarea
              placeholder="Notes (optional)"
              value={rejectNotes}
              onChange={(e) => setRejectNotes(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm font-[inherit] resize-y min-h-[60px] outline-none focus:border-gray-400"
            />
            <div className="flex gap-3">
              <button
                onClick={handleReject}
                disabled={!rejectReason}
                className="text-white border-none rounded-lg px-6 py-2.5 text-sm font-bold cursor-pointer disabled:cursor-not-allowed transition-opacity"
                style={{ background: rejectReason ? '#B91C1C' : '#9CA3AF' }}
              >
                Confirm Reject
              </button>
              <button
                onClick={() => { setRejecting(false); setRejectReason(''); setRejectNotes(''); }}
                className="bg-transparent text-gray-500 border border-gray-200 rounded-lg px-6 py-2.5 text-sm cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Expandable detail section ── */
function DetailSection({ title, accent, children }: { title: string; accent: string; children: React.ReactNode }) {
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <div className="px-5 py-3" style={{ background: '#FAFAFA', borderBottom: '1px solid #F3F4F6' }}>
        <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: accent }}>
          {title}
        </span>
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}
