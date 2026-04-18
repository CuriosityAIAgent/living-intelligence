import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchV2Inbox, decideBrief } from '../api';
import ArticleCard from '../components/ArticleCard';

const TYPE_FILTERS = ['All', 'Funding', 'Milestone', 'Product', 'Partnership', 'Strategic'];

export default function InboxTab() {
  const queryClient = useQueryClient();
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [showDiscover, setShowDiscover] = useState(false);
  const [typeFilter, setTypeFilter] = useState('All');

  const { data, isLoading } = useQuery({
    queryKey: ['v2-inbox'],
    queryFn: fetchV2Inbox,
    refetchInterval: 30_000,
  });

  const allBriefs = data?.entries ?? [];
  const briefs = typeFilter === 'All'
    ? allBriefs
    : allBriefs.filter(b => b.v2_entry?.type?.toLowerCase().includes(typeFilter.toLowerCase()));

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
      {/* ── Discover panel (collapsible) ── */}
      {showDiscover && <DiscoverPanel />}

      {/* ── Toolbar ── */}
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '32px 40px 0' }}>
        <div className="flex justify-between items-center mb-6 pb-5" style={{ borderBottom: '1px solid #E4DFD4' }}>
          <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase' as const, color: '#6B7280' }}>
            Showing <strong style={{ color: '#0E1116', fontWeight: 600 }}>{briefs.length} {briefs.length === 1 ? 'article' : 'articles'}</strong> · sorted by processed date
          </div>
          <div className="flex items-center gap-3">
            {TYPE_FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setTypeFilter(f)}
                className="cursor-pointer transition-all"
                style={{
                  fontFamily: 'ui-monospace, monospace',
                  fontSize: 11,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase' as const,
                  padding: '6px 12px',
                  border: '1px solid',
                  borderColor: typeFilter === f ? '#0E1116' : '#E4DFD4',
                  background: typeFilter === f ? '#0E1116' : 'transparent',
                  color: typeFilter === f ? '#F7F2E8' : '#6B7280',
                }}
              >
                {f}
              </button>
            ))}
            <div style={{ width: 1, height: 20, background: '#E4DFD4', margin: '0 4px' }} />
            <button
              onClick={() => setShowDiscover(!showDiscover)}
              className="cursor-pointer transition-all"
              style={{
                fontFamily: 'ui-monospace, monospace',
                fontSize: 11,
                letterSpacing: '0.1em',
                textTransform: 'uppercase' as const,
                padding: '6px 12px',
                border: '1px solid',
                borderColor: showDiscover ? '#990F3D' : '#E4DFD4',
                background: showDiscover ? '#990F3D' : 'transparent',
                color: showDiscover ? '#F7F2E8' : '#990F3D',
                fontWeight: 600,
              }}
            >
              + Process URL
            </button>
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 40px 48px' }}>
        {isLoading ? (
          <div className="text-gray-400 text-sm py-20 text-center">Loading inbox...</div>
        ) : briefs.length === 0 ? (
          <EmptyState />
        ) : (
          briefs.map((brief) => (
            <ArticleCard
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
        when the pipeline runs.
      </p>
      <div
        className="flex items-center gap-6 text-sm text-gray-500"
        style={{ background: '#FAF7F2', border: '1px solid #E4DFD4', padding: '16px 28px' }}
      >
        <div className="text-center">
          <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase' as const, color: '#9CA3AF', fontWeight: 600, marginBottom: 4 }}>Discovery</div>
          <div className="font-semibold text-gray-700">5:00 AM daily</div>
        </div>
        <div style={{ width: 1, height: 32, background: '#E4DFD4' }} />
        <div className="text-center">
          <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase' as const, color: '#9CA3AF', fontWeight: 600, marginBottom: 4 }}>v2 Batch</div>
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
            } catch { /* skip malformed SSE */ }
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
    <div style={{ borderBottom: '1px solid #E4DFD4', background: '#FAF7F2' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '24px 40px' }}>
        <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase' as const, color: '#990F3D', fontWeight: 600, marginBottom: 12 }}>
          Manual Article Processing
        </div>
        <div className="flex gap-3 mb-4" style={{ maxWidth: 640 }}>
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleProcess()}
            placeholder="Paste article URL..."
            className="flex-1 px-4 py-2.5 text-sm outline-none"
            style={{ border: '1px solid #E4DFD4', background: '#fff' }}
          />
          <button
            onClick={handleProcess}
            disabled={processing || !url.trim()}
            className="text-white border-none px-6 py-2.5 text-sm font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            style={{ background: processing || !url.trim() ? '#9CA3AF' : '#990F3D' }}
          >
            {processing ? 'Processing...' : 'Process'}
          </button>
        </div>
        {log.length > 0 && (
          <div
            className="font-mono text-xs max-h-56 overflow-y-auto leading-relaxed"
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
