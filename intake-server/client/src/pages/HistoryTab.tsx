import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchV2History } from '../api';
import type { EditorialDecision } from '../types';

const DECISION_FILTERS = [
  { value: '', label: 'All' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'HELD', label: 'Held' },
  { value: 'RETRY', label: 'Retried' },
  { value: 'PRODUCED', label: 'Produced' },
  { value: 'DUPLICATE', label: 'Duplicate' },
];

const DECISION_STYLES: Record<string, { bg: string; text: string }> = {
  APPROVED: { bg: '#F0FDF4', text: '#15803D' },
  REJECTED: { bg: '#FEF2F2', text: '#B91C1C' },
  HELD:     { bg: '#FFFBEB', text: '#B45309' },
  RETRY:    { bg: '#EFF6FF', text: '#1D4ED8' },
  PRODUCED: { bg: '#EEF2FF', text: '#3730A3' },
  DUPLICATE:{ bg: '#F9FAFB', text: '#6B7280' },
  ENRICHED: { bg: '#ECFDF5', text: '#065F46' },
  approve:  { bg: '#F0FDF4', text: '#15803D' },
  reject:   { bg: '#FEF2F2', text: '#B91C1C' },
  held:     { bg: '#FFFBEB', text: '#B45309' },
  retry:    { bg: '#EFF6FF', text: '#1D4ED8' },
  produced: { bg: '#EEF2FF', text: '#3730A3' },
  duplicate:{ bg: '#F9FAFB', text: '#6B7280' },
  enriched: { bg: '#ECFDF5', text: '#065F46' },
};

function getDecisionStyle(decision: string) {
  return DECISION_STYLES[decision] ?? DECISION_STYLES[decision.toUpperCase()] ?? { bg: '#F9FAFB', text: '#6B7280' };
}

export default function HistoryTab() {
  const [filter, setFilter] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['v2-history', filter],
    queryFn: () => fetchV2History({ limit: 100, decision: filter || undefined }),
    refetchInterval: 60_000,
  });

  const decisions = data?.decisions ?? [];
  const grouped = groupByDate(decisions);
  const stats = computeStats(decisions);

  return (
    <div>
      {/* ── Page header ── */}
      <div style={{ borderBottom: '1px solid #E5E7EB', background: '#FFFCF8' }}>
        <div style={{ maxWidth: 1152, margin: '0 auto', padding: '20px 24px' }}>
          <div
            className="text-[11px] font-bold uppercase mb-2"
            style={{ color: '#990F3D', letterSpacing: '0.14em' }}
          >
            Audit Trail
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-1">Decision History</h2>
          <p className="text-sm text-gray-400">
            Every pipeline and editorial action is logged. Use this to spot patterns and calibrate the pipeline.
          </p>
        </div>
      </div>

      {/* ── Content ── */}
      <div style={{ maxWidth: 1152, margin: '0 auto', padding: '32px 24px' }}>

        {/* Stats bar */}
        {decisions.length > 0 && (
          <div className="flex gap-4 mb-8 flex-wrap">
            {Object.entries(stats).map(([decision, count]) => {
              const style = getDecisionStyle(decision);
              const isActive = filter.toLowerCase() === decision.toLowerCase();
              return (
                <button
                  key={decision}
                  onClick={() => setFilter(isActive ? '' : decision)}
                  className="flex items-baseline gap-2 px-5 py-3 rounded cursor-pointer transition-colors"
                  style={{
                    background: isActive ? style.bg : '#FFFCF8',
                    border: `1px solid ${isActive ? style.text : '#E5E7EB'}`,
                  }}
                >
                  <span className="text-xl font-extrabold" style={{ color: style.text }}>{count}</span>
                  <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: style.text }}>
                    {decision}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Filter pills */}
        <div className="flex gap-2 mb-8 flex-wrap">
          {DECISION_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className="text-xs font-semibold px-4 py-2 rounded-full cursor-pointer transition-colors"
              style={{
                border: `1px solid ${filter === f.value ? '#990F3D' : '#E5E7EB'}`,
                background: filter === f.value ? '#990F3D' : 'transparent',
                color: filter === f.value ? '#fff' : '#6B7280',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="text-gray-400 text-sm py-20 text-center">Loading…</div>
        ) : decisions.length === 0 ? (
          <div className="text-center" style={{ padding: '80px 24px' }}>
            <h3 className="text-2xl font-bold text-gray-900 mb-3">No decisions yet</h3>
            <p className="text-[15px] text-gray-500 leading-relaxed max-w-md mx-auto">
              Pipeline and editorial decisions will appear here once the v2 pipeline runs
              and entries are reviewed.
            </p>
          </div>
        ) : (
          <div className="space-y-10">
            {Object.entries(grouped).map(([dateLabel, items]) => (
              <div key={dateLabel}>
                <div
                  className="text-[11px] font-bold uppercase mb-4"
                  style={{
                    color: '#990F3D',
                    letterSpacing: '0.14em',
                    borderTop: '2px solid #990F3D',
                    paddingTop: 12,
                  }}
                >
                  {dateLabel} — {items.length} decision{items.length !== 1 ? 's' : ''}
                </div>
                <div className="space-y-2">
                  {items.map((d) => (
                    <DecisionRow key={d.id} decision={d} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function DecisionRow({ decision }: { decision: EditorialDecision }) {
  const [expanded, setExpanded] = useState(false);
  const style = getDecisionStyle(decision.decision);
  const time = new Date(decision.decided_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const headline = decision.draft_snapshot?.headline || decision.entry_id || decision.brief_id || '—';

  return (
    <div
      className="rounded overflow-hidden cursor-pointer transition-colors"
      style={{
        background: '#FFFCF8',
        border: '1px solid #E5E7EB',
      }}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="px-6 py-4 flex items-center gap-4">
        {/* Badge */}
        <span
          className="text-[9px] font-bold uppercase tracking-wider px-3 py-1 rounded flex-shrink-0"
          style={{ background: style.bg, color: style.text }}
        >
          {decision.decision}
        </span>

        {/* Headline */}
        <span className="text-sm text-gray-800 font-medium truncate flex-1">
          {headline}
        </span>

        {/* Score */}
        {decision.pipeline_score != null && (
          <span className="text-xs font-bold text-gray-400 flex-shrink-0">
            {decision.pipeline_score}
          </span>
        )}

        {/* Time */}
        <span className="text-xs text-gray-400 flex-shrink-0">{time}</span>

        {/* Expand */}
        <span className="text-gray-300 text-xs flex-shrink-0">{expanded ? '▾' : '▸'}</span>
      </div>

      {expanded && (
        <div className="px-6 py-5 space-y-3" style={{ borderTop: '1px solid #F3F4F6', background: '#FAFAF8' }}>
          {decision.reason && (
            <div className="text-sm text-gray-600">
              <span className="font-semibold text-gray-400 text-[10px] uppercase tracking-widest mr-2">Reason</span>
              {decision.reason}
            </div>
          )}
          {decision.editor_notes && (
            <div className="text-sm text-gray-600">
              <span className="font-semibold text-gray-400 text-[10px] uppercase tracking-widest mr-2">Notes</span>
              {decision.editor_notes}
            </div>
          )}
          <div className="flex gap-8 text-xs text-gray-400 pt-1">
            {decision.decided_by && <span>By: {decision.decided_by}</span>}
            {decision.evaluator_score != null && <span>Evaluator: {decision.evaluator_score}/10</span>}
            {decision.capability && <span>Capability: {decision.capability}</span>}
            {decision.entry_type && <span>Type: {decision.entry_type.replace(/_/g, ' ')}</span>}
          </div>

          {/* Snapshot */}
          {decision.draft_snapshot && (
            <div className="mt-4 rounded p-5" style={{ border: '1px solid #E5E7EB', background: '#FFFCF8' }}>
              <div
                className="text-[10px] font-bold uppercase mb-2"
                style={{ color: '#990F3D', letterSpacing: '0.14em' }}
              >
                Entry Snapshot
              </div>
              <div className="text-sm font-bold text-gray-900 mb-1">
                {decision.draft_snapshot.headline}
              </div>
              {decision.draft_snapshot.the_so_what && (
                <p className="text-sm text-gray-500 leading-relaxed" style={{ fontStyle: 'italic' }}>
                  {decision.draft_snapshot.the_so_what}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function groupByDate(decisions: EditorialDecision[]): Record<string, EditorialDecision[]> {
  const groups: Record<string, EditorialDecision[]> = {};
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();

  for (const d of decisions) {
    const dateStr = new Date(d.decided_at).toDateString();
    let label: string;
    if (dateStr === today) label = 'Today';
    else if (dateStr === yesterday) label = 'Yesterday';
    else label = new Date(d.decided_at).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
    if (!groups[label]) groups[label] = [];
    groups[label].push(d);
  }
  return groups;
}

function computeStats(decisions: EditorialDecision[]): Record<string, number> {
  const stats: Record<string, number> = {};
  for (const d of decisions) {
    stats[d.decision] = (stats[d.decision] ?? 0) + 1;
  }
  return stats;
}
