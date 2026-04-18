import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchPipelineStatus, fetchPipelineHistory, fetchBlocked, unblockUrl } from '../api';
import { useProcessTracker } from '../App';
import type { BlockedUrl } from '../types';

export default function PipelineTab() {
  const [running, setPipelineRunning] = useState(false);
  const [pipelineLog, setPipelineLog] = useState<string[]>([]);
  const queryClient = useQueryClient();
  const { start: startProcess, stop: stopProcess } = useProcessTracker();

  const { data: pipelineStatus } = useQuery({
    queryKey: ['pipeline-status'],
    queryFn: fetchPipelineStatus,
    refetchInterval: 60_000,
  });

  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ['pipeline-history'],
    queryFn: fetchPipelineHistory,
    refetchInterval: 60_000,
  });

  const runs = historyData?.runs ?? [];

  const lastRunAt = pipelineStatus?.last_run_at || pipelineStatus?.started_at;
  const lastRun = lastRunAt
    ? new Date(lastRunAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : 'Never';

  const handleRunPipeline = async () => {
    setPipelineRunning(true);
    setPipelineLog([]);
    startProcess('pipeline', 'Pipeline running...');

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
              if (data.message) setPipelineLog(prev => [...prev, data.message]);
              if (data.done) {
                queryClient.invalidateQueries({ queryKey: ['v2-inbox'] });
                queryClient.invalidateQueries({ queryKey: ['pipeline-status'] });
                queryClient.invalidateQueries({ queryKey: ['pipeline-history'] });
              }
            } catch { /* skip */ }
          }
        }
      }
    } catch (err) {
      setPipelineLog(prev => [...prev, `Error: ${err}`]);
    } finally {
      setPipelineRunning(false);
      stopProcess('pipeline');
    }
  };

  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) +
        ', ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    } catch { return iso; }
  };

  return (
    <div>
      {/* ── Toolbar ── */}
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '32px 40px 0' }}>
        <div className="flex justify-between items-center mb-6 pb-5" style={{ borderBottom: '1px solid #E4DFD4' }}>
          <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase' as const, color: '#6B7280' }}>
            <strong style={{ color: '#0E1116', fontWeight: 600 }}>Discovery Pipeline</strong> · last run: {lastRun}
          </div>
          <button
            onClick={handleRunPipeline}
            disabled={running}
            className="cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
            style={{
              fontFamily: 'ui-monospace, monospace',
              fontSize: 11,
              letterSpacing: '0.1em',
              textTransform: 'uppercase' as const,
              padding: '6px 14px',
              border: '1px solid #990F3D',
              background: running ? '#9CA3AF' : '#990F3D',
              color: '#F7F2E8',
              fontWeight: 600,
            }}
          >
            {running ? 'Running...' : 'Run Pipeline'}
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 40px 48px' }}>

        {/* Schedule + last run stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
          <div style={{ background: '#FFFFFF', border: '1px solid #E4DFD4', padding: 28 }}>
            <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase' as const, color: '#9CA3AF', fontWeight: 600, marginBottom: 20 }}>
              Daily Schedule
            </div>
            <div className="space-y-4">
              <div className="flex items-baseline gap-4">
                <span style={{ fontSize: 18, fontWeight: 800, color: '#0E1116' }}>5:00 AM</span>
                <span className="text-sm text-gray-500">Discovery + triage (Railway)</span>
              </div>
              <div className="flex items-baseline gap-4">
                <span style={{ fontSize: 18, fontWeight: 800, color: '#0E1116' }}>5:27 AM</span>
                <span className="text-sm text-gray-500">Research + write + verify (Remote Trigger)</span>
              </div>
            </div>
          </div>

          {pipelineStatus && (
            <div style={{ background: '#FFFFFF', border: '1px solid #E4DFD4', padding: 28 }}>
              <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase' as const, color: '#9CA3AF', fontWeight: 600, marginBottom: 20 }}>
                Last Run
              </div>
              <div className="grid grid-cols-4 gap-4">
                <StatCell label="Found" value={pipelineStatus.last_run_found ?? pipelineStatus.candidates_found ?? 0} />
                <StatCell label="Queued" value={pipelineStatus.last_run_queued ?? pipelineStatus.queued ?? 0} color="#15803D" />
                <StatCell label="Blocked" value={pipelineStatus.last_run_blocked ?? pipelineStatus.blocked ?? 0} color="#B91C1C" />
                <StatCell label="Errors" value={pipelineStatus.errors ?? 0} color="#B45309" />
              </div>
            </div>
          )}
        </div>

        {/* Live log */}
        {pipelineLog.length > 0 && (
          <div className="mb-10">
            <div className="flex items-center gap-2 mb-3">
              {running && (
                <span
                  className="w-2 h-2 rounded-full inline-block"
                  style={{ background: '#15803D', animation: 'pulse 2s infinite' }}
                />
              )}
              <span
                style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase' as const, fontWeight: 600, color: running ? '#15803D' : '#9CA3AF' }}
              >
                {running ? 'Pipeline Running' : 'Last Run Log'}
              </span>
            </div>
            <div
              className="font-mono text-xs max-h-80 overflow-y-auto leading-relaxed"
              style={{ background: '#1C1C2E', color: '#86EFAC', padding: '20px 24px' }}
            >
              {pipelineLog.map((line, i) => (
                <div key={i} className="mb-1">{line}</div>
              ))}
            </div>
          </div>
        )}

        {/* Run history */}
        <div className="mb-10">
          <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase' as const, color: '#990F3D', fontWeight: 600, marginBottom: 12, borderTop: '2px solid #990F3D', paddingTop: 12 }}>
            Run History
          </div>

          {historyLoading && <div className="text-gray-400 text-sm py-12 text-center">Loading...</div>}

          {runs.length === 0 && !historyLoading && (
            <div className="text-gray-400 text-sm py-12 text-center">
              No pipeline runs recorded yet.
            </div>
          )}

          {runs.length > 0 && (
            <div className="overflow-hidden" style={{ border: '1px solid #E4DFD4', background: '#FFFFFF' }}>
              <div
                className="grid px-6 py-4"
                style={{ gridTemplateColumns: '1fr 100px 100px 100px 100px', borderBottom: '1px solid #E4DFD4', fontFamily: 'ui-monospace, monospace', fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase' as const, color: '#9CA3AF', fontWeight: 600 }}
              >
                <span>Date</span>
                <span className="text-center">Found</span>
                <span className="text-center">Queued</span>
                <span className="text-center">Blocked</span>
                <span className="text-center">Errors</span>
              </div>
              {runs.map((run, i) => (
                <div
                  key={i}
                  className="grid px-6 py-5 text-sm text-gray-700"
                  style={{
                    gridTemplateColumns: '1fr 100px 100px 100px 100px',
                    borderBottom: i < runs.length - 1 ? '1px solid #EFEAE0' : 'none',
                    background: i === 0 ? '#FAF7F2' : 'transparent',
                  }}
                >
                  <span style={{ fontWeight: i === 0 ? 600 : 400 }}>
                    {formatDate(run.started_at)}
                    {i === 0 && (
                      <span className="text-[9px] font-bold ml-2" style={{ color: '#990F3D' }}>LATEST</span>
                    )}
                  </span>
                  <span className="text-center font-semibold">{run.candidates_found}</span>
                  <span className="text-center font-semibold" style={{ color: run.queued > 0 ? '#15803D' : '#9CA3AF' }}>
                    {run.queued}
                  </span>
                  <span className="text-center font-semibold" style={{ color: run.blocked > 0 ? '#B91C1C' : '#9CA3AF' }}>
                    {run.blocked}
                  </span>
                  <span className="text-center font-semibold" style={{ color: run.errors > 0 ? '#DC2626' : '#9CA3AF' }}>
                    {run.errors}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Blocked URLs ── */}
        <BlockedPanel />
      </div>
    </div>
  );
}

function StatCell({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="text-center">
      <div style={{ fontSize: 32, fontWeight: 800, marginBottom: 4, color: color || (value > 0 ? '#0E1116' : '#D1D5DB'), lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase' as const, color: '#9CA3AF', fontWeight: 600 }}>
        {label}
      </div>
    </div>
  );
}

function BlockedPanel() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [unblocking, setUnblocking] = useState<string | null>(null);

  const { data: blockedData } = useQuery({
    queryKey: ['blocked'],
    queryFn: fetchBlocked,
    refetchInterval: 120_000,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawBlocked: any = blockedData?.blocked ?? [];
  // Normalize: API returns either an array or a Record<string, BlockedUrl>
  const blocked: BlockedUrl[] = Array.isArray(rawBlocked)
    ? rawBlocked.map((item: BlockedUrl) => ({ ...item, reason: item.reason ?? 'Blocked' }))
    : Object.entries(rawBlocked as Record<string, unknown>).map(([url, item]) => ({
        url,
        reason: 'Blocked',
        ...(typeof item === 'object' && item !== null ? item : { reason: String(item) }),
      } as BlockedUrl));

  const filtered = search
    ? blocked.filter(b =>
        b.url.toLowerCase().includes(search.toLowerCase()) ||
        (b.title ?? '').toLowerCase().includes(search.toLowerCase()) ||
        b.reason.toLowerCase().includes(search.toLowerCase())
      )
    : blocked;

  const handleUnblock = async (url: string) => {
    setUnblocking(url);
    try {
      await unblockUrl(url);
      queryClient.invalidateQueries({ queryKey: ['blocked'] });
      queryClient.invalidateQueries({ queryKey: ['v2-inbox'] });
    } finally {
      setUnblocking(null);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-5" style={{ borderTop: '2px solid #990F3D', paddingTop: 14 }}>
        <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase' as const, color: '#990F3D', fontWeight: 600 }}>
          Blocked URLs ({blocked.length})
        </div>
        {blocked.length > 3 && (
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search URL or reason..."
            className="text-xs outline-none"
            style={{ border: '1px solid #E4DFD4', padding: '8px 14px', width: 240, background: '#fff' }}
          />
        )}
      </div>

      {filtered.length === 0 && (
        <div className="text-sm text-gray-400 py-6 text-center">
          {blocked.length === 0 ? 'No blocked URLs' : 'No matches'}
        </div>
      )}

      {filtered.length > 0 && (
        <div className="space-y-2">
          {filtered.slice(0, 20).map((b) => {
            const isNearMiss = b.score != null && b.score >= 35 && b.score < 45;
            const isFab = b.reason?.toLowerCase().includes('fabricat');
            let domain = '';
            try { domain = new URL(b.url).hostname.replace('www.', ''); } catch { domain = b.url; }

            return (
              <div
                key={b.url}
                className="flex items-start gap-4"
                style={{
                  background: '#FFFFFF',
                  border: '1px solid #E4DFD4',
                  padding: '16px 24px',
                  borderLeft: `3px solid ${isFab ? '#B91C1C' : isNearMiss ? '#D97706' : '#E4DFD4'}`,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    {b.score != null && (
                      <span className="text-xs font-bold" style={{ color: b.score >= 45 ? '#15803D' : b.score >= 35 ? '#B45309' : '#B91C1C' }}>
                        {b.score}
                      </span>
                    )}
                    {b.title && (
                      <span className="text-xs font-medium text-gray-800 truncate">{b.title}</span>
                    )}
                    {isNearMiss && (
                      <span className="text-[9px] font-bold uppercase px-2 py-0.5" style={{ background: '#FFFBEB', color: '#B45309', letterSpacing: '0.06em' }}>
                        Near miss
                      </span>
                    )}
                    {isFab && (
                      <span className="text-[9px] font-bold uppercase px-2 py-0.5" style={{ background: '#FEF2F2', color: '#B91C1C', letterSpacing: '0.06em' }}>
                        Fabrication
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 truncate mb-1">{domain}</div>
                  <div className="text-xs text-gray-400 truncate">{b.reason}</div>
                </div>
                <button
                  onClick={() => handleUnblock(b.url)}
                  disabled={unblocking === b.url}
                  className="text-xs font-semibold px-3 py-1.5 cursor-pointer disabled:opacity-50 flex-shrink-0"
                  style={{ border: '1px solid #E4DFD4', color: '#990F3D', background: 'transparent' }}
                >
                  {unblocking === b.url ? '...' : 'Unblock'}
                </button>
              </div>
            );
          })}
          {filtered.length > 20 && (
            <div className="text-xs text-gray-400 text-center py-2">
              Showing 20 of {filtered.length} — use search to filter
            </div>
          )}
        </div>
      )}
    </div>
  );
}
