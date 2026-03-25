import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchInbox, fetchPipelineStatus } from '../api';
import StoryCard from '../components/StoryCard';
import ActivityLog from '../components/ActivityLog';

type SubTab = 'review' | 'discover';

export default function IntelligenceTab() {
  const [subTab, setSubTab] = useState<SubTab>('review');
  const [running, setPipelineRunning] = useState(false);
  const [pipelineLog, setPipelineLog] = useState<string[]>([]);
  const [showLog, setShowLog] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const queryClient = useQueryClient();

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
    }
  };

  const lastRun = pipelineStatus?.started_at
    ? new Date(pipelineStatus.started_at).toLocaleString('en-GB', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'Never';

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
          <Kpi value={items.length} label="In Review" color="#111827" />
          <KpiDivider />
          <Kpi
            value={pipelineStatus?.blocked ?? 0}
            label="Blocked"
            color="#B91C1C"
          />
          <KpiDivider />
          <Kpi
            value={pipelineStatus?.errors ?? 0}
            label="Errors"
            color="#B45309"
          />
          <KpiDivider />
          <Kpi
            value={pipelineStatus?.tl_candidates ?? 0}
            label="TL Queue"
            color="#3730A3"
          />
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
        {(['review', 'discover'] as SubTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setSubTab(tab)}
            style={{
              background: 'none',
              border: 'none',
              borderBottom: subTab === tab ? '2px solid #990F3D' : '2px solid transparent',
              color: subTab === tab ? '#111827' : '#6B7280',
              fontSize: 12,
              fontWeight: subTab === tab ? 600 : 500,
              padding: '0 14px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              textTransform: 'capitalize',
            }}
          >
            {tab}
            {tab === 'review' && items.length > 0 && (
              <span
                style={{
                  background: '#990F3D',
                  color: '#fff',
                  fontSize: 9,
                  fontWeight: 700,
                  padding: '1px 5px',
                  borderRadius: 8,
                }}
              >
                {items.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ display: 'flex', minHeight: 'calc(100vh - 168px)' }}>
        {/* Main panel */}
        <div style={{ flex: 1, padding: 24, overflowY: 'auto' }}>
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
          ) : (
            <DiscoverPanel />
          )}
        </div>

        {/* Activity log sidebar */}
        <div
          style={{
            width: 300,
            borderLeft: '1px solid #E5E7EB',
            padding: 16,
            background: '#fff',
            overflowY: 'auto',
          }}
        >
          <ActivityLog />
        </div>
      </div>
    </div>
  );
}

// ── KPI components ────────────────────────────────────────────────────────────

function Kpi({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '0 16px',
      }}
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
