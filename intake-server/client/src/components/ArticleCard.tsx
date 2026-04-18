import { useState } from 'react';
import type { V2Brief } from '../types';

interface ArticleCardProps {
  brief: V2Brief;
  onApprove: (id: string) => void;
  onReject: (id: string, reason: string) => void;
  onRetry: (id: string) => void;
  approving?: boolean;
  /** Compact mode for held tab — no sidebar, inline actions */
  compact?: boolean;
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
    return `${d.getUTCDate()} ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  } catch { return dateStr; }
}

export default function ArticleCard({ brief, onApprove, onReject, onRetry, approving, compact }: ArticleCardProps) {
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
  const stripeColor = score == null ? '#D1D5DB' : score >= 75 ? '#15803D' : score >= 60 ? '#D97706' : '#B91C1C';
  const fabColor = fabVerdict === 'CLEAN' ? '#15803D' : fabVerdict === 'SUSPECT' ? '#B45309' : fabVerdict === 'FAIL' ? '#B91C1C' : '#9CA3AF';

  const checks = evaluation?.checks;
  const checkCount = checks ? Object.keys(checks).length : 0;
  const passCount = checks ? Object.values(checks).filter((c: { pass: boolean }) => c.pass).length : 0;
  const flaggedCount = checkCount - passCount;

  const articleDate = formatDate(entry.date);
  const processedDate = formatDate(brief.processed_at);

  const handleReject = () => {
    if (!rejectReason) return;
    onReject(brief.id, rejectReason + (rejectNotes ? ` — ${rejectNotes}` : ''));
    setRejecting(false);
    setRejectReason('');
    setRejectNotes('');
  };

  // Hold reasons for held/compact cards
  const holdReasons: string[] = [];
  if (brief.status === 'held') {
    if (score != null && score < 75) holdReasons.push(`Score ${score}/100`);
    if (fabVerdict === 'SUSPECT') holdReasons.push('Suspect fabrication');
    if (fabVerdict === 'FAIL') holdReasons.push('Failed fabrication');
    if (holdReasons.length === 0) holdReasons.push('Quality review');
  }

  const age = brief.processed_at
    ? Math.floor((Date.now() - new Date(brief.processed_at).getTime()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <div
      className="mb-8 relative overflow-hidden"
      style={{
        background: '#FFFFFF',
        border: '1px solid #E4DFD4',
        display: compact ? 'block' : 'grid',
        gridTemplateColumns: compact ? undefined : '1fr 280px',
      }}
    >
      {/* Left accent stripe */}
      <div
        style={{
          position: 'absolute',
          left: 0, top: 0, bottom: 0,
          width: 3,
          background: stripeColor,
          zIndex: 1,
        }}
      />

      {/* ─── MAIN COLUMN ─── */}
      <div style={{ padding: compact ? '28px 32px' : '48px 48px 32px', borderRight: compact ? 'none' : '1px solid #E4DFD4' }}>

        {/* Meta row */}
        <div className="flex items-center gap-4 mb-6" style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase' as const }}>
          <span style={{ color: '#990F3D', fontWeight: 600 }}>
            {entry.company_name}
          </span>
          <span style={{ width: 3, height: 3, background: '#9CA3AF', borderRadius: '50%', display: 'inline-block' }} />
          <span style={{ color: '#6B7280', fontWeight: 500 }}>
            {entry.type?.replace(/_/g, ' ') || 'intelligence'}
          </span>
          <span style={{ flex: 1 }} />
          <span style={{ color: '#6B7280', fontWeight: 400, letterSpacing: '0.12em' }}>
            Article · {articleDate}
          </span>
        </div>

        {/* Hold reason badges (held cards only) */}
        {holdReasons.length > 0 && (
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            {holdReasons.map((reason, i) => (
              <span
                key={i}
                className="text-[10px] font-bold uppercase px-3 py-1 rounded"
                style={{
                  letterSpacing: '0.1em',
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
        )}

        {/* Headline */}
        <h2
          className="font-bold leading-tight mb-8"
          style={{ fontSize: compact ? 20 : 28, color: '#0E1116', maxWidth: '38ch', lineHeight: 1.15, letterSpacing: '-0.01em' }}
        >
          {entry.headline}
        </h2>

        {/* The So What */}
        {entry.the_so_what && (
          <div className="mb-8" style={{ padding: '24px 0 24px 24px', borderLeft: '2px solid #990F3D' }}>
            <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, letterSpacing: '0.24em', textTransform: 'uppercase' as const, color: '#990F3D', fontWeight: 600, marginBottom: 10 }}>
              Why It Matters
            </div>
            <p style={{ fontSize: compact ? 14 : 17, lineHeight: 1.5, color: '#2A2F37', maxWidth: '62ch', margin: 0, fontStyle: 'italic' }}>
              {entry.the_so_what}
            </p>
          </div>
        )}

        {/* Key stat */}
        {entry.key_stat && !compact && (
          <div className="flex items-baseline gap-4 mb-6" style={{ padding: '24px 0', borderTop: '1px solid #EFEAE0', borderBottom: '1px solid #EFEAE0' }}>
            <span style={{ fontSize: 44, fontWeight: 700, lineHeight: 1, color: '#990F3D', letterSpacing: '-0.02em' }}>
              {entry.key_stat.number}
            </span>
            <span style={{ fontSize: 13, color: '#6B7280', maxWidth: '28ch' }}>
              {entry.key_stat.label}
            </span>
          </div>
        )}

        {/* Summary */}
        {entry.summary && !compact && (
          <p style={{ fontSize: 15, lineHeight: 1.65, color: '#2A2F37', maxWidth: '68ch', margin: '0 0 28px' }}>
            {entry.summary}
          </p>
        )}

        {/* Sources */}
        {sources.length > 0 && (
          <div className="mb-6">
            <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, letterSpacing: '0.24em', textTransform: 'uppercase' as const, color: '#6B7280', fontWeight: 600, marginBottom: 10 }}>
              Sources · {sources.length}
            </div>
            <div className="flex flex-wrap gap-2.5">
              {sources.map((s, i) => {
                const isPrimary = s.type === 'primary';
                const label = s.name || (() => { try { return new URL(s.url).hostname.replace('www.', ''); } catch { return 'source'; } })();
                return (
                  <a
                    key={i}
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="no-underline transition-colors inline-flex items-center gap-1.5"
                    style={{
                      fontSize: 12,
                      padding: '5px 10px',
                      border: isPrimary ? '1px solid #0E1116' : '1px solid #E4DFD4',
                      background: isPrimary ? '#0E1116' : 'transparent',
                      color: isPrimary ? '#F7F2E8' : '#2A2F37',
                      fontWeight: isPrimary ? 500 : 400,
                    }}
                  >
                    {isPrimary && <span style={{ fontSize: 10, color: '#FFC857' }}>★</span>}
                    {label}
                  </a>
                );
              })}
            </div>
          </div>
        )}

        {/* Expand toggle */}
        {!compact && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="cursor-pointer inline-flex items-center gap-2"
            style={{
              fontFamily: 'ui-monospace, monospace',
              fontSize: 12,
              letterSpacing: '0.06em',
              textTransform: 'uppercase' as const,
              color: '#990F3D',
              background: 'transparent',
              border: '1px solid #E4DFD4',
              padding: '8px 16px',
              fontWeight: 600,
            }}
          >
            <span style={{ fontSize: 10, transition: 'transform 0.15s', transform: expanded ? 'rotate(90deg)' : 'none' }}>▸</span>
            {expanded ? 'Hide details' : 'Show research, fabrication & checks'}
          </button>
        )}

        {/* Expanded detail sections */}
        {expanded && (
          <div className="mt-5 space-y-4">
            {/* McKinsey Test */}
            {checks && (
              <DetailSection title="McKinsey 6-Check Test" accent="#6366F1">
                <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                  {Object.entries(checks).map(([check, result]) => (
                    <div key={check} className="flex items-start gap-2 text-sm">
                      <span style={{ color: result.pass ? '#15803D' : '#B91C1C', fontSize: 14, flexShrink: 0, marginTop: 1 }}>
                        {result.pass ? '✓' : '✗'}
                      </span>
                      <div>
                        <span className="font-medium text-gray-700 capitalize">{check.replace(/_/g, ' ')}</span>
                        {!result.pass && result.feedback && (
                          <div className="text-xs text-gray-400 mt-0.5">{result.feedback}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </DetailSection>
            )}

            {/* Research Brief */}
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
                    <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase' as const, fontWeight: 600, color: '#9CA3AF' }}>
                      Peer context
                    </span>
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
              <DetailSection title="Refinement History" accent="#9CA3AF">
                <div className="space-y-3">
                  {iterations.map((it, i) => (
                    <div key={i} className="text-sm text-gray-600 leading-relaxed">
                      <span className="font-semibold text-gray-700">Iteration {it.version ?? i + 1}</span>
                      {it.score != null && <span className="ml-2 text-gray-500">evaluator score {it.score}/10</span>}
                      {it.feedback && <div className="text-gray-400 mt-1 pl-4" style={{ borderLeft: '1px solid #E4DFD4' }}>{it.feedback}</div>}
                    </div>
                  ))}
                </div>
              </DetailSection>
            )}
          </div>
        )}
      </div>

      {/* ─── SIDEBAR (full cards only) ─── */}
      {!compact && (
        <aside style={{ padding: '32px 28px', background: '#FAF7F2', display: 'flex', flexDirection: 'column', gap: 28 }}>

          {/* Score block */}
          <div style={{ paddingBottom: 24, borderBottom: '1px solid #E4DFD4' }}>
            <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, letterSpacing: '0.24em', textTransform: 'uppercase' as const, fontWeight: 600, color: scoreColor, marginBottom: 16 }}>
              Editorial Score
            </div>
            <div className="flex items-baseline gap-1" style={{ marginBottom: 20 }}>
              <span style={{ fontSize: 56, fontWeight: 700, lineHeight: 1, letterSpacing: '-0.03em', color: scoreColor }}>
                {score ?? '—'}
              </span>
              <span style={{ fontSize: 20, color: '#9CA3AF' }}>/100</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <StatusRow label="Status" value={
                <span className="flex items-center gap-1.5">
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: fabColor, display: 'inline-block' }} />
                  {fabVerdict === 'CLEAN' ? 'Clean' : fabVerdict === 'SUSPECT' ? 'Suspect' : fabVerdict === 'FAIL' ? 'Failed' : '—'}
                </span>
              } />
              <StatusRow label="Checks" value={`${flaggedCount} / ${checkCount} flagged`} />
              {processedDate && <StatusRow label="Processed" value={processedDate} />}
            </div>
          </div>

          {/* Actions */}
          <div style={{ marginTop: 'auto', paddingTop: 24, borderTop: '1px solid #E4DFD4', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {!rejecting ? (
              <>
                <button
                  onClick={() => onApprove(brief.id)}
                  disabled={approving}
                  className="w-full text-center cursor-pointer disabled:opacity-60 disabled:cursor-wait"
                  style={{
                    padding: '13px 20px',
                    background: approving ? '#86EFAC' : '#0E1116',
                    color: '#F7F2E8',
                    border: '1px solid transparent',
                    fontSize: 13,
                    fontWeight: 600,
                    letterSpacing: '0.02em',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                  }}
                >
                  {approving ? 'Publishing...' : 'Approve & Publish →'}
                </button>
                <button
                  onClick={() => onRetry(brief.id)}
                  className="w-full text-center cursor-pointer"
                  style={{
                    padding: '13px 20px',
                    background: 'transparent',
                    color: '#0E1116',
                    border: '1px solid #6B7280',
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  Re-research
                </button>
                <button
                  onClick={() => setRejecting(true)}
                  className="w-full text-center cursor-pointer"
                  style={{
                    padding: '8px 20px',
                    background: 'transparent',
                    color: '#6B7280',
                    border: '1px solid transparent',
                    fontSize: 12,
                    fontWeight: 500,
                  }}
                >
                  Reject
                </button>
              </>
            ) : (
              <div className="space-y-3">
                <div className="text-xs font-semibold text-gray-700">Rejection reason</div>
                <div className="flex gap-1.5 flex-wrap">
                  {REJECT_REASONS.map((r) => (
                    <button
                      key={r}
                      onClick={() => setRejectReason(r)}
                      className="text-[11px] px-3 py-1.5 cursor-pointer transition-colors"
                      style={{
                        border: `1px solid ${rejectReason === r ? '#990F3D' : '#E4DFD4'}`,
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
                  className="w-full px-3 py-2 text-sm outline-none resize-y"
                  style={{ border: '1px solid #E4DFD4', minHeight: 52, fontFamily: 'inherit' }}
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleReject}
                    disabled={!rejectReason}
                    className="text-white border-none px-4 py-2 text-xs font-bold cursor-pointer disabled:cursor-not-allowed"
                    style={{ background: rejectReason ? '#B91C1C' : '#9CA3AF' }}
                  >
                    Confirm Reject
                  </button>
                  <button
                    onClick={() => { setRejecting(false); setRejectReason(''); setRejectNotes(''); }}
                    className="bg-transparent text-gray-500 px-4 py-2 text-xs cursor-pointer"
                    style={{ border: '1px solid #E4DFD4' }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </aside>
      )}

      {/* ─── COMPACT ACTIONS (held tab) ─── */}
      {compact && !rejecting && (
        <div className="flex gap-3 px-8 pb-6">
          <button
            onClick={() => onRetry(brief.id)}
            className="text-sm font-semibold px-6 py-2.5 cursor-pointer"
            style={{ border: '1px solid #BFDBFE', color: '#1D4ED8', background: 'transparent' }}
          >
            Retry
          </button>
          <button
            onClick={() => onReject(brief.id, 'Rejected from Held tab')}
            className="text-sm font-semibold px-6 py-2.5 cursor-pointer"
            style={{ border: '1px solid #E4DFD4', color: '#6B7280', background: 'transparent' }}
          >
            Reject
          </button>
          {brief.source_url && (
            <a
              href={brief.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-medium no-underline hover:underline flex items-center ml-auto"
              style={{ color: '#990F3D' }}
            >
              View source ↗
            </a>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Sidebar status row ── */
function StatusRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between items-center" style={{ fontSize: 12 }}>
      <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase' as const, color: '#6B7280' }}>
        {label}
      </span>
      <span style={{ fontWeight: 600, color: '#0E1116' }}>{value}</span>
    </div>
  );
}

/* ── Expandable detail section ── */
function DetailSection({ title, accent, children }: { title: string; accent: string; children: React.ReactNode }) {
  return (
    <div style={{ border: '1px solid #E4DFD4', overflow: 'hidden' }}>
      <div className="px-5 py-3" style={{ background: '#FAF7F2', borderBottom: '1px solid #EFEAE0' }}>
        <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase' as const, fontWeight: 700, color: accent }}>
          {title}
        </span>
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}
