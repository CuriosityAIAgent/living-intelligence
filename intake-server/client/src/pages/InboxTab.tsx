import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchV2Inbox, decideBrief } from '../api';
import V2Card from '../components/V2Card';

export default function InboxTab() {
  const queryClient = useQueryClient();
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [showDiscover, setShowDiscover] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['v2-inbox'],
    queryFn: fetchV2Inbox,
    refetchInterval: 30_000,
  });

  const briefs = data?.entries ?? [];

  const handleApprove = async (id: string) => {
    setApprovingId(id);
    try {
      await decideBrief(id, 'APPROVED', 'Editorial approval');
      queryClient.invalidateQueries({ queryKey: ['v2-inbox'] });
      queryClient.invalidateQueries({ queryKey: ['v2-history'] });
    } finally {
      setApprovingId(null);
    }
  };

  const handleReject = async (id: string, reason: string) => {
    await decideBrief(id, 'REJECTED', reason);
    queryClient.invalidateQueries({ queryKey: ['v2-inbox'] });
    queryClient.invalidateQueries({ queryKey: ['v2-history'] });
  };

  const handleRetry = async (id: string) => {
    await decideBrief(id, 'RETRY', 'Re-research requested');
    queryClient.invalidateQueries({ queryKey: ['v2-inbox'] });
    queryClient.invalidateQueries({ queryKey: ['v2-held'] });
  };

  return (
    <div>
      {/* ── Page header bar ── */}
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
              Editorial Inbox
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-1">
              {briefs.length > 0
                ? `${briefs.length} ${briefs.length === 1 ? 'entry' : 'entries'} ready for review`
                : 'No entries pending'}
            </h2>
            <p className="text-sm text-gray-400">
              v2 pipeline output — review, approve, or send back for deeper research
            </p>
          </div>
          <button
            onClick={() => setShowDiscover(!showDiscover)}
            className="text-sm font-bold cursor-pointer rounded transition-colors"
            style={{
              border: showDiscover ? '1px solid #990F3D' : '1px solid #990F3D',
              color: showDiscover ? '#fff' : '#990F3D',
              background: showDiscover ? '#990F3D' : 'transparent',
              padding: '10px 20px',
            }}
          >
            + Process URL
          </button>
        </div>
      </div>

      {/* ── Discover panel ── */}
      {showDiscover && <DiscoverPanel />}

      {/* ── Content ── */}
      <div style={{ maxWidth: 1152, margin: '0 auto', padding: '32px 24px' }}>
        {isLoading ? (
          <div className="text-gray-400 text-sm py-20 text-center">Loading inbox…</div>
        ) : briefs.length === 0 ? (
          <EmptyState />
        ) : (
          briefs.map((brief) => (
            <V2Card
              key={brief.id}
              brief={brief}
              onApprove={handleApprove}
              onReject={handleReject}
              onRetry={handleRetry}
              approving={approvingId === brief.id}
            />
          ))
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center" style={{ padding: '100px 24px' }}>
      <div
        className="flex items-center justify-center rounded-full mb-8"
        style={{ width: 80, height: 80, background: '#F0F9F0', border: '2px solid #D1E7D1' }}
      >
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#15803D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
      <h3 className="text-2xl font-bold text-gray-900 mb-3 text-center">All caught up</h3>
      <p className="text-[15px] text-gray-500 leading-relaxed text-center mb-8" style={{ maxWidth: 420 }}>
        Every entry from the v2 pipeline has been reviewed. New entries arrive daily
        when the pipeline runs at 5:27 AM.
      </p>
      <div
        className="flex items-center gap-6 rounded text-sm text-gray-500"
        style={{ background: '#FFFCF8', border: '1px solid #E5E7EB', padding: '16px 28px' }}
      >
        <div className="text-center">
          <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Discovery</div>
          <div className="font-semibold text-gray-700">5:00 AM daily</div>
        </div>
        <div style={{ width: 1, height: 32, background: '#E5E7EB' }} />
        <div className="text-center">
          <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">v2 Batch</div>
          <div className="font-semibold text-gray-700">5:27 AM daily</div>
        </div>
      </div>
    </div>
  );
}

function DiscoverPanel() {
  const [url, setUrl] = useState('');
  const [processing, setProcessing] = useState(false);
  const [log, setLog] = useState<string[]>([]);

  const handleProcess = async () => {
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
              if (data.message) setLog(prev => [...prev, data.message]);
            } catch {}
          }
        }
      }
    } catch (err) {
      setLog(prev => [...prev, `Error: ${err}`]);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div style={{ borderBottom: '1px solid #E5E7EB', background: '#FFFCF8' }}>
      <div style={{ maxWidth: 1152, margin: '0 auto', padding: '24px 24px' }}>
        <div
          className="text-[11px] font-bold uppercase mb-4"
          style={{ color: '#990F3D', letterSpacing: '0.14em' }}
        >
          Manual Article Processing
        </div>
        <div className="flex gap-3 mb-4" style={{ maxWidth: 640 }}>
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleProcess()}
            placeholder="Paste article URL…"
            className="flex-1 rounded px-4 py-2.5 text-sm outline-none"
            style={{ border: '1px solid #D1D5DB', background: '#fff' }}
          />
          <button
            onClick={handleProcess}
            disabled={processing || !url.trim()}
            className="text-white border-none rounded px-6 py-2.5 text-sm font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            style={{ background: processing || !url.trim() ? '#9CA3AF' : '#990F3D' }}
          >
            {processing ? 'Processing…' : 'Process'}
          </button>
        </div>
        {log.length > 0 && (
          <div
            className="rounded font-mono text-xs max-h-56 overflow-y-auto leading-relaxed"
            style={{ background: '#1C1C2E', color: '#86EFAC', padding: '16px 20px' }}
          >
            {log.map((line, i) => (
              <div key={i} className="mb-1">{line}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
