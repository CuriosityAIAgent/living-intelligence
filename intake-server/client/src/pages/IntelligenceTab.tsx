import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchInbox, fetchPipelineStatus, fetchPipelineHistory, fetchBlocked, unblockUrl } from '../api';
import StoryCard from '../components/StoryCard';
import ActivityLog from '../components/ActivityLog';
import { useProcessTracker } from '../App';

type SubTab = 'review' | 'discover' | 'blocked' | 'pipeline';

export default function IntelligenceTab() {
  const [subTab, setSubTab] = useState<SubTab>('review');
  const [running, setPipelineRunning] = useState(false);
  const [pipelineLog, setPipelineLog] = useState<string[]>([]);
  const [showLog, setShowLog] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const queryClient = useQueryClient();
  const { start: startProcess, stop: stopProcess } = useProcessTracker();

  const { data: inbox, isLoading } = useQuery({
    queryKey: ['inbox'],
    queryFn: fetchInbox,
    refetchInterval: 30_000,
  });

  const { data: pipelineStatus } = useQuery({
    queryKey: ['pipeline-status'],
    queryFn: fetchPipelineStatus,
    refetchInterval: 60_000,
  });

  const items = inbox?.items ?? [];
  const archiveCount = inbox?.archive_count ?? 0;

  const handleRunPipeline = async () => {
    setPipelineRunning(true);
    setPipelineLog([]);
    setShowLog(true);
    startProcess('pipeline', 'Pipeline running…');

    try {
      const res = await fetch('/api/run-pipeline', { method: 'POST' });
      if (!res.body) throw new Error('No stream');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.message) setPipelineLog((prev) => [...prev, data.message]);
              if (data.done) {
                await Promise.all([
                  queryClient.invalidateQueries({ queryKey: ['inbox'] }),
                  queryClient.invalidateQueries({ queryKey: ['pipeline-status'] }),
                ]);
                setPipelineLog((prev) => [...prev, '✓ Inbox updated']);
                setTimeout(() => setShowLog(false), 2000);
              }
            } catch {}
          }
        }
      }
    } catch (err) {
      setPipelineLog((prev) => [...prev, `Error: ${err}`]);
    } finally {
      setPipelineRunning(false);
      stopProcess('pipeline');
    }
  };

  const lastRunAt = pipelineStatus?.last_run_at || pipelineStatus?.started_at;
  const lastRun = lastRunAt
    ? new Date(lastRunAt).toLocaleString('en-GB', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'Never';
  const blockedCount = pipelineStatus?.blocked_total ?? pipelineStatus?.last_run_blocked ?? pipelineStatus?.blocked ?? 0;
  const errorsCount = pipelineStatus?.errors ?? 0;
  const tlCount = pipelineStatus?.tl_candidates ?? 0;

  return (
    <div>
      {/* KPI header */}
      <div
        style={{
          background: '#fff',
          borderBottom: '1px solid #E5E7EB',
          padding: '12px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
          <Kpi value={items.length} label="In Review" color={items.length > 0 ? '#15803D' : '#9CA3AF'} onClick={() => setSubTab('review')} />
          <KpiDivider />
          <Kpi value={blockedCount} label="Blocked" color={blockedCount > 0 ? '#B91C1C' : '#9CA3AF'} onClick={() => setSubTab('blocked')} />
          <KpiDivider />
          <Kpi value={errorsCount} label="Errors" color={errorsCount > 0 ? '#B45309' : '#9CA3AF'} />
          <KpiDivider />
          <Kpi value={tlCount} label="TL Queue" color={tlCount > 0 ? '#3730A3' : '#9CA3AF'} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <span style={{ fontSize: 11, color: '#9CA3AF' }}>Last run: {lastRun}</span>
          <button
            onClick={handleRunPipeline}
            disabled={running}
            style={{
              background: running ? '#9CA3AF' : '#990F3D',
              color: '#fff',
              border: 'none',
              borderRadius: 4,
              padding: '7px 14px',
              fontSize: 12,
              fontWeight: 600,
              cursor: running ? 'not-allowed' : 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {running ? 'Running…' : '▶ Run Pipeline'}
          </button>
        </div>
      </div>

      {/* Pipeline log modal */}
      {showLog && (
        <div
          onClick={() => !running && setShowLog(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 200,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#111827',
              color: '#D1FAE5',
              borderRadius: 8,
              padding: 20,
              width: 560,
              maxHeight: '70vh',
              overflowY: 'auto',
              fontFamily: 'monospace',
              fontSize: 12,
            }}
          >
            <div
              style={{
                color: '#9CA3AF',
                fontSize: 10,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                marginBottom: 12,
              }}
            >
              Pipeline Log {running && '— Running…'}
            </div>
            {pipelineLog.map((line, i) => (
              <div key={i} style={{ marginBottom: 4, lineHeight: 1.5 }}>
                {line}
              </div>
            ))}
            {!running && (
              <button
                onClick={() => setShowLog(false)}
                style={{
                  marginTop: 16,
                  background: '#374151',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 4,
                  padding: '6px 14px',
                  fontSize: 11,
                  cursor: 'pointer',
                }}
              >
                Close
              </button>
            )}
          </div>
        </div>
      )}

      {/* Sub nav */}
      <div
        style={{
          background: '#fff',
          borderBottom: '1px solid #E5E7EB',
          padding: '0 24px',
          display: 'flex',
          alignItems: 'stretch',
          height: 36,
        }}
      >
        {([
          { id: 'review' as SubTab, label: 'Review', badge: items.length > 0 ? items.length : null, badgeColor: '#990F3D' },
          { id: 'discover' as SubTab, label: 'Discover', badge: null, badgeColor: '' },
          { id: 'blocked' as SubTab, label: 'Blocked', badge: blockedCount > 0 ? blockedCount : null, badgeColor: '#B91C1C' },
          { id: 'pipeline' as SubTab, label: 'Pipeline', badge: null, badgeColor: '' },
        ]).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setSubTab(tab.id)}
            style={{
              background: 'none',
              border: 'none',
              borderBottom: subTab === tab.id ? '2px solid #990F3D' : '2px solid transparent',
              color: subTab === tab.id ? '#111827' : '#6B7280',
              fontSize: 12,
              fontWeight: subTab === tab.id ? 600 : 500,
              padding: '0 14px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
            }}
          >
            {tab.label}
            {tab.badge !== null && (
              <span
                style={{
                  background: tab.badgeColor,
                  color: '#fff',
                  fontSize: 9,
                  fontWeight: 700,
                  padding: '1px 5px',
                  borderRadius: 8,
                }}
              >
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ padding: 24 }}>
        {/* Main panel */}
        <div>
          {subTab === 'review' ? (
            <>
              {isLoading ? (
                <div style={{ color: '#9CA3AF', fontSize: 13 }}>Loading inbox…</div>
              ) : items.length === 0 ? (
                <div
                  style={{
                    textAlign: 'center',
                    padding: '60px 20px',
                    color: '#9CA3AF',
                  }}
                >
                  <div style={{ fontSize: 32, marginBottom: 12 }}>✓</div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                    Inbox clear
                  </div>
                  <div style={{ fontSize: 13 }}>
                    All stories reviewed. Run pipeline for new candidates.
                  </div>
                </div>
              ) : (
                <>
                  {items.map((item, i) => (
                    <StoryCard
                      key={item.id}
                      item={item}
                      index={i}
                      total={items.length}
                      onDone={() => queryClient.invalidateQueries({ queryKey: ['inbox'] })}
                    />
                  ))}
                  {archiveCount > 0 && !showArchive && (
                    <button
                      onClick={() => setShowArchive(true)}
                      style={{
                        width: '100%',
                        background: '#F9FAFB',
                        border: '1px solid #E5E7EB',
                        borderRadius: 6,
                        padding: '10px 16px',
                        fontSize: 12,
                        color: '#6B7280',
                        cursor: 'pointer',
                        textAlign: 'center',
                      }}
                    >
                      Show {archiveCount} older stories →
                    </button>
                  )}
                </>
              )}
            </>
          ) : subTab === 'blocked' ? (
            <BlockedPanel />
          ) : subTab === 'pipeline' ? (
            <PipelinePanel pipelineLog={pipelineLog} running={running} />
          ) : (
            <DiscoverPanel />
          )}
        </div>

        {/* Activity log — full width below main content */}
        <div
          style={{
            marginTop: 32,
            borderTop: '1px solid #E5E7EB',
            paddingTop: 24,
          }}
        >
          <ActivityLog />
        </div>
      </div>
    </div>
  );
}

// ── KPI components ────────────────────────────────────────────────────────────

function Kpi({ value, label, color, onClick }: { value: number; label: string; color: string; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '0 16px',
        cursor: onClick ? 'pointer' : 'default',
        borderRadius: 4,
        transition: 'background 0.1s',
      }}
      onMouseEnter={(e) => { if (onClick) (e.currentTarget as HTMLDivElement).style.background = '#F9FAFB'; }}
      onMouseLeave={(e) => { if (onClick) (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
    >
      <span style={{ fontSize: 20, fontWeight: 700, color, lineHeight: 1 }}>{value}</span>
      <span
        style={{
          fontSize: 10,
          color: '#9CA3AF',
          marginTop: 2,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        {label}
      </span>
    </div>
  );
}

function KpiDivider() {
  return (
    <div style={{ width: 1, background: '#E5E7EB', height: 28, margin: '0 4px', flexShrink: 0 }} />
  );
}

// ── Discover panel (placeholder for now) ─────────────────────────────────────

function DiscoverPanel() {
  const [url, setUrl] = useState('');
  const [processing, setProcessing] = useState(false);
  const [log, setLog] = useState<string[]>([]);

  const handleProcessUrl = async () => {
    if (!url.trim()) return;
    setProcessing(true);
    setLog([]);
    try {
      const res = await fetch('/api/process-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim(), source_name: 'Manual' }),
      });
      if (!res.body) throw new Error('No stream');
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.message) setLog((prev) => [...prev, data.message]);
            } catch {}
          }
        }
      }
    } catch (err) {
      setLog((prev) => [...prev, `Error: ${err}`]);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div style={{ maxWidth: 700 }}>
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: '#990F3D',
          marginBottom: 12,
        }}
      >
        Manual Article Processing
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleProcessUrl()}
          placeholder="Paste article URL…"
          style={{
            flex: 1,
            border: '1px solid #D1D5DB',
            borderRadius: 4,
            padding: '7px 10px',
            fontSize: 13,
            outline: 'none',
          }}
        />
        <button
          onClick={handleProcessUrl}
          disabled={processing || !url.trim()}
          style={{
            background: processing || !url.trim() ? '#9CA3AF' : '#990F3D',
            color: '#fff',
            border: 'none',
            borderRadius: 4,
            padding: '7px 14px',
            fontSize: 12,
            fontWeight: 600,
            cursor: processing || !url.trim() ? 'not-allowed' : 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          {processing ? 'Processing…' : 'Process'}
        </button>
      </div>

      {log.length > 0 && (
        <div
          style={{
            background: '#111827',
            color: '#D1FAE5',
            borderRadius: 6,
            padding: 14,
            fontFamily: 'monospace',
            fontSize: 12,
          }}
        >
          {log.map((line, i) => (
            <div key={i} style={{ marginBottom: 3 }}>
              {line}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Blocked panel ─────────────────────────────────────────────────────────────

function BlockedPanel() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [unblocking, setUnblocking] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['blocked'],
    queryFn: fetchBlocked,
  });

  const blocked = (data?.blocked ?? [])
    .slice()
    .sort((a, b) => (b.blocked_at || '').localeCompare(a.blocked_at || ''));

  const filtered = search.trim()
    ? blocked.filter(b =>
        b.url.toLowerCase().includes(search.toLowerCase()) ||
        (b.reason ?? '').toLowerCase().includes(search.toLowerCase())
      )
    : blocked;

  const handleUnblock = async (url: string) => {
    setUnblocking(url);
    try {
      await unblockUrl(url);
      queryClient.invalidateQueries({ queryKey: ['blocked'] });
      // Also refresh inbox — the unblocked article will be reprocessed and land there
      queryClient.invalidateQueries({ queryKey: ['inbox'] });
    } finally {
      setUnblocking(null);
    }
  };

  if (isLoading) return <div style={{ color: '#9CA3AF', fontSize: 13 }}>Loading…</div>;

  return (
    <div style={{ maxWidth: 860 }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#B91C1C' }}>
          Permanently Blocked — {blocked.length} URL{blocked.length !== 1 ? 's' : ''}
        </div>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search URL or reason…"
          style={{
            marginLeft: 'auto',
            width: 260,
            padding: '5px 10px',
            fontSize: 12,
            border: '1px solid #E5E7EB',
            borderRadius: 4,
            outline: 'none',
            fontFamily: 'inherit',
          }}
        />
      </div>

      {filtered.length === 0 && (
        <div style={{ color: '#9CA3AF', fontSize: 13 }}>
          {blocked.length === 0 ? 'No blocked URLs yet.' : 'No matches.'}
        </div>
      )}

      {filtered.map((b, i) => {
        // Extract score from reason string or from stored score
        const scoreMatch = b.reason?.match(/Score (\d+)\/100/);
        const score = (b as any).score ?? (scoreMatch ? parseInt(scoreMatch[1]) : null);
        const isFabrication = b.reason?.startsWith('Fabrication');
        const isNearMiss = score != null && score >= 35 && !isFabrication;
        // Extract source domain from URL
        let sourceDomain = '';
        try { sourceDomain = new URL(b.url).hostname.replace('www.', ''); } catch {}

        return (
          <div
            key={i}
            style={{
              background: isNearMiss ? '#FFFBEB' : '#fff',
              border: `1px solid ${isNearMiss ? '#FDE68A' : '#FECACA'}`,
              borderRadius: 6,
              padding: '12px 14px',
              marginBottom: 6,
            }}
          >
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              {/* Score badge */}
              {score != null && (
                <span style={{
                  fontSize: 16,
                  fontWeight: 800,
                  color: score >= 45 ? '#B45309' : isFabrication ? '#DC2626' : '#B91C1C',
                  minWidth: 32,
                  flexShrink: 0,
                  lineHeight: 1,
                  paddingTop: 2,
                }}>
                  {score}
                </span>
              )}
              {isFabrication && score == null && (
                <span style={{ fontSize: 10, fontWeight: 700, color: '#DC2626', padding: '2px 6px', background: '#FEE2E2', borderRadius: 3, flexShrink: 0 }}>
                  FAB
                </span>
              )}

              <div style={{ flex: 1, minWidth: 0 }}>
                {/* Title — the most important thing */}
                {(b as any).title && (
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', marginBottom: 3, lineHeight: 1.4 }}>
                    {(b as any).title}
                  </div>
                )}
                {/* Source + date row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                  {sourceDomain && (
                    <span style={{ fontSize: 10, fontWeight: 600, color: '#6B7280', background: '#F3F4F6', padding: '1px 6px', borderRadius: 2 }}>
                      {sourceDomain}
                    </span>
                  )}
                  {b.blocked_at && (
                    <span style={{ fontSize: 10, color: '#9CA3AF' }}>
                      Blocked {new Date(b.blocked_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </span>
                  )}
                  {isNearMiss && (
                    <span style={{ fontSize: 9, fontWeight: 700, color: '#B45309', background: '#FEF3C7', padding: '1px 6px', borderRadius: 3 }}>
                      NEAR MISS
                    </span>
                  )}
                </div>
                {/* Reason */}
                <div style={{ fontSize: 11, color: isFabrication ? '#DC2626' : '#6B7280', lineHeight: 1.4 }}>
                  {b.reason}
                </div>
                {/* URL */}
                <div style={{ fontSize: 10, marginTop: 3 }}>
                  <a href={b.url} target="_blank" rel="noopener noreferrer" style={{ color: '#990F3D', textDecoration: 'none' }}>
                    {b.url.length > 80 ? b.url.substring(0, 80) + '…' : b.url} ↗
                  </a>
                </div>
              </div>

              {/* Unblock button */}
              <button
                onClick={() => handleUnblock(b.url)}
                disabled={unblocking === b.url}
                style={{
                  flexShrink: 0,
                  alignSelf: 'center',
                  background: unblocking === b.url ? '#F3F4F6' : '#fff',
                  border: '1px solid #D1D5DB',
                  borderRadius: 4,
                  padding: '4px 10px',
                  fontSize: 11,
                  fontWeight: 600,
                  color: '#374151',
                  cursor: unblocking === b.url ? 'wait' : 'pointer',
                }}
              >
                {unblocking === b.url ? '…' : 'Unblock'}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Pipeline Control panel ───────────────────────────────────────────────────

function PipelinePanel({ pipelineLog, running }: { pipelineLog: string[]; running: boolean }) {
  const { data: historyData, isLoading } = useQuery({
    queryKey: ['pipeline-history'],
    queryFn: fetchPipelineHistory,
    refetchInterval: 60_000,
  });

  const runs = historyData?.runs ?? [];

  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) +
        ', ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    } catch { return iso; }
  };

  return (
    <div style={{ maxWidth: 900 }}>
      {/* Live log (visible during/after a run) */}
      {pipelineLog.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
            textTransform: 'uppercase', color: running ? '#15803D' : '#9CA3AF',
            marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6,
          }}>
            {running && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22C55E', display: 'inline-block', animation: 'pulse 2s infinite' }} />}
            {running ? 'Pipeline Running' : 'Last Run Log'}
          </div>
          <div style={{
            background: '#111827', color: '#D1FAE5', borderRadius: 6,
            padding: 14, fontFamily: 'monospace', fontSize: 11,
            maxHeight: 300, overflowY: 'auto', lineHeight: 1.6,
          }}>
            {pipelineLog.map((line, i) => (
              <div key={i} style={{ marginBottom: 2 }}>{line}</div>
            ))}
          </div>
        </div>
      )}

      {/* Run history */}
      <div style={{
        fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
        textTransform: 'uppercase', color: '#990F3D', marginBottom: 12,
      }}>
        Run History ({runs.length} runs)
      </div>

      {isLoading && <div style={{ color: '#9CA3AF', fontSize: 13 }}>Loading…</div>}

      {runs.length === 0 && !isLoading && (
        <div style={{ color: '#9CA3AF', fontSize: 13 }}>
          No pipeline runs recorded yet. History starts accumulating from the next run.
        </div>
      )}

      {runs.length > 0 && (
        <div style={{ border: '1px solid #E5E7EB', borderRadius: 6, overflow: 'hidden' }}>
          {/* Header */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 80px 80px 80px 80px',
            padding: '8px 14px', background: '#F9FAFB', borderBottom: '1px solid #E5E7EB',
            fontSize: 10, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em',
          }}>
            <span>Date</span>
            <span style={{ textAlign: 'center' }}>Found</span>
            <span style={{ textAlign: 'center' }}>Queued</span>
            <span style={{ textAlign: 'center' }}>Blocked</span>
            <span style={{ textAlign: 'center' }}>Errors</span>
          </div>
          {/* Rows */}
          {runs.map((run, i) => (
            <div
              key={i}
              style={{
                display: 'grid', gridTemplateColumns: '1fr 80px 80px 80px 80px',
                padding: '10px 14px', borderBottom: i < runs.length - 1 ? '1px solid #F3F4F6' : 'none',
                fontSize: 12, color: '#374151',
                background: i === 0 ? '#FFFBEB' : '#fff',
              }}
            >
              <span style={{ fontWeight: i === 0 ? 600 : 400 }}>
                {formatDate(run.started_at)}
                {i === 0 && <span style={{ fontSize: 9, color: '#B45309', marginLeft: 8, fontWeight: 700 }}>LATEST</span>}
              </span>
              <span style={{ textAlign: 'center', fontWeight: 600 }}>{run.candidates_found}</span>
              <span style={{ textAlign: 'center', fontWeight: 600, color: run.queued > 0 ? '#15803D' : '#9CA3AF' }}>
                {run.queued}
              </span>
              <span style={{ textAlign: 'center', fontWeight: 600, color: run.blocked > 0 ? '#B91C1C' : '#9CA3AF' }}>
                {run.blocked}
              </span>
              <span style={{ textAlign: 'center', fontWeight: 600, color: run.errors > 0 ? '#DC2626' : '#9CA3AF' }}>
                {run.errors}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
