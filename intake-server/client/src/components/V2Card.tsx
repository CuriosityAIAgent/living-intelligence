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
  const iterations = entry._iterations;
  const fabrication = entry._fabrication;
  const sources = entry.sources ?? [];

  const scoreColor = score == null ? '#9CA3AF' : score >= 75 ? '#15803D' : score >= 60 ? '#B45309' : '#B91C1C';
  const fabColor = fabVerdict === 'CLEAN' ? '#15803D' : fabVerdict === 'SUSPECT' ? '#B45309' : fabVerdict === 'FAIL' ? '#B91C1C' : '#9CA3AF';
  const fabBg = fabVerdict === 'CLEAN' ? '#F0FDF4' : fabVerdict === 'SUSPECT' ? '#FFFBEB' : fabVerdict === 'FAIL' ? '#FEF2F2' : '#F9FAFB';

  const handleReject = () => {
    if (!rejectReason) return;
    onReject(brief.id, rejectReason + (rejectNotes ? ` — ${rejectNotes}` : ''));
    setRejecting(false);
    setRejectReason('');
    setRejectNotes('');
  };

  return (
    <div className="rounded mb-6" style={{ background: '#FFFCF8', border: '1px solid #E5E7EB' }}>
      {/* ── Confidence bar ── */}
      <div className="px-6 py-3 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Score */}
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-extrabold" style={{ color: scoreColor }}>
              {score ?? '—'}
            </span>
            <span className="text-[10px] text-gray-400 font-medium">/100</span>
          </div>

          <div className="w-px h-6 bg-gray-200" />

          {/* Fabrication */}
          {fabVerdict && (
            <span
              className="text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded"
              style={{ background: fabBg, color: fabColor }}
            >
              {fabVerdict}
            </span>
          )}

          {/* Source count */}
          {sources.length > 0 && (
            <span className="text-xs text-gray-500 font-medium">
              {sources.length} source{sources.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Right side: type + date */}
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded bg-indigo-50 text-indigo-700">
            {entry.type?.replace(/_/g, ' ') || 'intelligence'}
          </span>
          {brief.processed_at && (
            <span className="text-xs text-gray-400">
              {new Date(brief.processed_at).toLocaleDateString('en-GB', {
                day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
              })}
            </span>
          )}
        </div>
      </div>

      {/* ── Card body ── */}
      <div className="px-6 py-5">
        {/* Company + date row */}
        <div className="flex items-center gap-3 mb-3">
          <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: '#990F3D' }}>
            {entry.company_name}
          </span>
          <span className="text-xs text-gray-400">{entry.date}</span>
        </div>

        {/* Headline */}
        <h3 className="text-lg font-bold text-gray-900 leading-snug mb-4">
          {entry.headline}
        </h3>

        {/* The So What — accent bar */}
        {entry.the_so_what && (
          <div
            className="border-l-4 rounded-r mb-5"
            style={{ borderColor: '#990F3D', background: '#FFF8F5', padding: '14px 18px' }}
          >
            <div className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: '#990F3D' }}>
              The So What
            </div>
            <p className="text-[14px] text-gray-800 leading-relaxed">
              {entry.the_so_what}
            </p>
          </div>
        )}

        {/* Key stat */}
        {entry.key_stat && (
          <div className="inline-flex items-baseline gap-2 mb-5 px-4 py-2.5 bg-gray-50 border border-gray-100 rounded">
            <span className="text-2xl font-extrabold" style={{ color: '#990F3D' }}>
              {entry.key_stat.number}
            </span>
            <span className="text-sm text-gray-500">{entry.key_stat.label}</span>
          </div>
        )}

        {/* Summary */}
        {entry.summary && (
          <p className="text-[14px] text-gray-600 leading-relaxed mb-5">
            {entry.summary}
          </p>
        )}

        {/* Sources */}
        {sources.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap mb-5">
            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Sources</span>
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

        {/* Expand toggle */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs font-semibold cursor-pointer bg-transparent border-none p-0 mb-4"
          style={{ color: '#990F3D' }}
        >
          {expanded ? '▾ Hide details' : '▸ Show research, fabrication & iterations'}
        </button>

        {/* ── Expanded detail sections ── */}
        {expanded && (
          <div className="space-y-4 mt-3 mb-2">
            {/* Research */}
            {research && (
              <DetailSection title="Research Brief" accent="#3730A3">
                {research.whats_new && (
                  <p className="text-sm text-gray-700 mb-3 leading-relaxed">
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
                    <div className="flex gap-4 mt-1.5 flex-wrap">
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

            {/* McKinsey Test */}
            {evaluation?.checks && (
              <DetailSection title="McKinsey 6-Check Test" accent="#6366F1">
                <div className="space-y-2">
                  {Object.entries(evaluation.checks).map(([check, result]) => (
                    <div key={check} className="flex items-start gap-2 text-sm">
                      <span className="mt-0.5" style={{ color: result.pass ? '#15803D' : '#B91C1C' }}>
                        {result.pass ? '✓' : '✗'}
                      </span>
                      <span className="font-medium text-gray-700 capitalize min-w-[80px]">{check}</span>
                      {result.feedback && <span className="text-gray-500">{result.feedback}</span>}
                      {!result.feedback && result.pass && <span className="text-green-600">Pass</span>}
                    </div>
                  ))}
                </div>
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
        <div className="pt-5 mt-2 border-t border-gray-100">
          {!rejecting ? (
            <div className="flex items-center justify-between">
              {/* Primary action */}
              <button
                onClick={() => onApprove(brief.id)}
                disabled={approving}
                className="text-white border-none rounded px-8 py-2.5 text-sm font-bold cursor-pointer disabled:opacity-60 disabled:cursor-wait transition-opacity"
                style={{ background: '#15803D' }}
              >
                {approving ? 'Publishing…' : 'Approve & Publish'}
              </button>

              {/* Secondary actions — right side, text-style */}
              <div className="flex items-center gap-6">
                <button
                  onClick={() => onRetry(brief.id)}
                  className="bg-transparent border-none text-sm font-medium cursor-pointer p-0"
                  style={{ color: '#1D4ED8' }}
                >
                  Re-research
                </button>
                <button
                  onClick={() => setRejecting(true)}
                  className="bg-transparent border-none text-sm font-medium cursor-pointer p-0"
                  style={{ color: '#B91C1C' }}
                >
                  Reject
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3 rounded-md p-4" style={{ background: '#FFF8F8', border: '1px solid #FECACA' }}>
              <div className="flex gap-2 flex-wrap">
                {REJECT_REASONS.map((r) => (
                  <button
                    key={r}
                    onClick={() => setRejectReason(r)}
                    className="text-xs px-3 py-1.5 rounded-full border cursor-pointer transition-colors"
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
                className="w-full border border-gray-200 rounded px-3 py-2 text-sm font-[inherit] resize-y min-h-[60px] outline-none focus:border-gray-400"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleReject}
                  disabled={!rejectReason}
                  className="text-white border-none rounded px-4 py-2 text-sm font-bold cursor-pointer disabled:cursor-not-allowed transition-opacity"
                  style={{ background: rejectReason ? '#B91C1C' : '#9CA3AF' }}
                >
                  Confirm Reject
                </button>
                <button
                  onClick={() => { setRejecting(false); setRejectReason(''); setRejectNotes(''); }}
                  className="bg-transparent text-gray-500 border-none text-sm cursor-pointer p-0"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Expandable detail section ── */
function DetailSection({ title, accent, children }: { title: string; accent: string; children: React.ReactNode }) {
  return (
    <div className="border border-gray-200 rounded overflow-hidden">
      <div className="px-5 py-2.5" style={{ background: '#FAFAFA', borderBottom: '1px solid #F3F4F6' }}>
        <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: accent }}>
          {title}
        </span>
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}
