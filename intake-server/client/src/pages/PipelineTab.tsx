import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchPipelineStatus, fetchPipelineHistory } from '../api';
import { useProcessTracker } from '../App';

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
              if (data.message) setPipelineLog(prev => [...prev, data.message]);
              if (data.done) {
                queryClient.invalidateQueries({ queryKey: ['v2-inbox'] });
                queryClient.invalidateQueries({ queryKey: ['pipeline-status'] });
                queryClient.invalidateQueries({ queryKey: ['pipeline-history'] });
              }
            } catch {}
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
      {/* ── Page header ── */}
      <div style={{ borderBottom: '1px solid #E5E7EB', background: '#FFFCF8' }}>
        <div
          className="flex items-center justify-between"
          style={{ maxWidth: 1152, margin: '0 auto', padding: '20px 24px' }}
        >
          <div>
            <div
              className="text-[11px] font-bold uppercase mb-2"
              style={{ color: '#990F3D', letterSpacing: '0.14em' }}
            >
              Pipeline Control
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-1">Discovery Pipeline</h2>
            <p className="text-sm text-gray-400">
              Last run: {lastRun}
            </p>
          </div>
          <button
            onClick={handleRunPipeline}
            disabled={running}
            className="text-white border-none rounded px-7 py-3 text-sm font-bold cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap transition-opacity"
            style={{ background: running ? '#9CA3AF' : '#990F3D' }}
          >
            {running ? 'Running…' : 'Run Pipeline'}
          </button>
        </div>
      </div>

      {/* ── Content ── */}
      <div style={{ maxWidth: 1152, margin: '0 auto', padding: '32px 24px' }}>

        {/* Pipeline stages */}
        <div className="mb-10">
          <div
            className="text-[11px] font-bold uppercase mb-4"
            style={{ color: '#990F3D', letterSpacing: '0.14em', borderTop: '2px solid #990F3D', paddingTop: 12 }}
          >
            Pipeline Stages
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {['Discovery', 'Triage', 'Dedup', 'Research', 'Produce', 'Review'].map((stage, i) => (
              <div key={stage} className="flex items-center gap-3">
                <div
                  className="text-sm font-medium px-5 py-2.5 rounded"
                  style={{ background: '#FFFCF8', border: '1px solid #E5E7EB', color: '#374151' }}
                >
                  {stage}
                </div>
                {i < 5 && <span className="text-gray-300 text-lg">→</span>}
              </div>
            ))}
          </div>
        </div>

        {/* Schedule + last run stats side by side */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
          {/* Schedule */}
          <div className="rounded" style={{ background: '#FFFCF8', border: '1px solid #E5E7EB', padding: '24px' }}>
            <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-4">
              Daily Schedule
            </div>
            <div className="space-y-3">
              <div className="flex items-baseline gap-3">
                <span className="text-lg font-extrabold text-gray-900">5:00 AM</span>
                <span className="text-sm text-gray-500">Discovery + triage (Railway)</span>
              </div>
              <div className="flex items-baseline gap-3">
                <span className="text-lg font-extrabold text-gray-900">5:27 AM</span>
                <span className="text-sm text-gray-500">Research + write + verify (Remote Trigger)</span>
              </div>
            </div>
          </div>

          {/* Last run stats */}
          {pipelineStatus && (
            <div className="rounded" style={{ background: '#FFFCF8', border: '1px solid #E5E7EB', padding: '24px' }}>
              <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-4">
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
                className="text-[11px] font-bold uppercase"
                style={{ color: running ? '#15803D' : '#9CA3AF', letterSpacing: '0.14em' }}
              >
                {running ? 'Pipeline Running' : 'Last Run Log'}
              </span>
            </div>
            <div
              className="rounded font-mono text-xs max-h-80 overflow-y-auto leading-relaxed"
              style={{ background: '#1C1C2E', color: '#86EFAC', padding: '20px 24px' }}
            >
              {pipelineLog.map((line, i) => (
                <div key={i} className="mb-1">{line}</div>
              ))}
            </div>
          </div>
        )}

        {/* Run history */}
        <div>
          <div
            className="text-[11px] font-bold uppercase mb-4"
            style={{ color: '#990F3D', letterSpacing: '0.14em', borderTop: '2px solid #990F3D', paddingTop: 12 }}
          >
            Run History
          </div>

          {historyLoading && <div className="text-gray-400 text-sm py-12 text-center">Loading…</div>}

          {runs.length === 0 && !historyLoading && (
            <div className="text-gray-400 text-sm py-12 text-center">
              No pipeline runs recorded yet. History accumulates from the next run.
            </div>
          )}

          {runs.length > 0 && (
            <div className="rounded overflow-hidden" style={{ border: '1px solid #E5E7EB', background: '#FFFCF8' }}>
              {/* Table header */}
              <div
                className="grid px-6 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest"
                style={{ gridTemplateColumns: '1fr 90px 90px 90px 90px', borderBottom: '1px solid #E5E7EB' }}
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
                  className="grid px-6 py-4 text-sm text-gray-700"
                  style={{
                    gridTemplateColumns: '1fr 90px 90px 90px 90px',
                    borderBottom: i < runs.length - 1 ? '1px solid #F3F4F6' : 'none',
                    background: i === 0 ? '#FFFDF7' : 'transparent',
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
      </div>
    </div>
  );
}

function StatCell({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="text-center">
      <div className="text-2xl font-extrabold mb-0.5" style={{ color: color || (value > 0 ? '#1C1C2E' : '#D1D5DB') }}>
        {value}
      </div>
      <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
        {label}
      </div>
    </div>
  );
}
