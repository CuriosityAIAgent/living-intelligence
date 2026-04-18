import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchTLCandidates, fetchTLPublished, dismissTLCandidate } from '../api';
import { useProcessTracker } from '../App';

export default function ThoughtLeadershipTab() {
  const queryClient = useQueryClient();
  const [discovering, setDiscovering] = useState(false);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const { start: startProcess, stop: stopProcess } = useProcessTracker();

  const { data: candidatesData } = useQuery({
    queryKey: ['tl-candidates'],
    queryFn: fetchTLCandidates,
  });

  const { data: publishedData } = useQuery({
    queryKey: ['tl-published'],
    queryFn: fetchTLPublished,
  });

  const candidates = candidatesData?.candidates ?? [];
  const published = publishedData?.entries ?? [];

  const handleDiscover = async () => {
    setDiscovering(true);
    startProcess('tl-discover', 'Discovering TL...');
    try {
      const res = await fetch('/api/tl-discover', { method: 'POST' });
      if (res.body) {
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
                if (data.done) {
                  queryClient.invalidateQueries({ queryKey: ['tl-candidates'] });
                }
              } catch { /* skip */ }
            }
          }
        }
      }
      queryClient.invalidateQueries({ queryKey: ['tl-candidates'] });
    } finally {
      setDiscovering(false);
      stopProcess('tl-discover');
    }
  };

  const handleDismiss = async (url: string) => {
    await dismissTLCandidate(url);
    queryClient.invalidateQueries({ queryKey: ['tl-candidates'] });
  };

  const handlePublish = async (url: string) => {
    setPublishingId(url);
    setLog([]);
    try {
      const res = await fetch('/api/tl-publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
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
              if (data.done) {
                queryClient.invalidateQueries({ queryKey: ['tl-candidates'] });
                queryClient.invalidateQueries({ queryKey: ['tl-published'] });
              }
            } catch { /* skip */ }
          }
        }
      }
    } catch (err) {
      setLog((prev) => [...prev, `Error: ${err}`]);
    } finally {
      setPublishingId(null);
    }
  };

  return (
    <div>
      {/* ── Toolbar ── */}
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '32px 40px 0' }}>
        <div className="flex justify-between items-center mb-6 pb-5" style={{ borderBottom: '1px solid #E4DFD4' }}>
          <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase' as const, color: '#6B7280' }}>
            <strong style={{ color: '#0E1116', fontWeight: 600 }}>{candidates.length} candidates</strong> · {published.length} published
          </div>
          <button
            onClick={handleDiscover}
            disabled={discovering}
            className="cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
            style={{
              fontFamily: 'ui-monospace, monospace',
              fontSize: 11,
              letterSpacing: '0.1em',
              textTransform: 'uppercase' as const,
              padding: '6px 14px',
              border: '1px solid #990F3D',
              background: discovering ? '#9CA3AF' : '#990F3D',
              color: '#F7F2E8',
              fontWeight: 600,
            }}
          >
            {discovering ? 'Discovering...' : 'Discover TL'}
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 40px 48px' }}>
        {/* Publish log */}
        {log.length > 0 && (
          <div
            className="font-mono text-xs max-h-56 overflow-y-auto leading-relaxed mb-8"
            style={{ background: '#1C1C2E', color: '#86EFAC', padding: '16px 20px' }}
          >
            {log.map((line, i) => (
              <div key={i} className="mb-1">{line}</div>
            ))}
          </div>
        )}

        {/* Candidates */}
        {candidates.length > 0 && (
          <div className="mb-10">
            <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase' as const, color: '#990F3D', fontWeight: 600, marginBottom: 12, borderTop: '2px solid #990F3D', paddingTop: 12 }}>
              Candidates ({candidates.length})
            </div>
            <div className="space-y-3">
              {candidates.map((c) => (
                <div
                  key={c.url}
                  className="flex items-start justify-between gap-4"
                  style={{ background: '#FFFFFF', border: '1px solid #E4DFD4', padding: '18px 24px' }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="text-sm font-semibold mb-2" style={{ color: '#0E1116' }}>
                      {c.title}
                    </div>
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                      <span
                        className="text-[10px] font-bold uppercase px-2 py-0.5"
                        style={{ background: '#EFF6FF', color: '#1E40AF', letterSpacing: '0.08em' }}
                      >
                        {(() => {
                          try {
                            const host = new URL(c.url).hostname.replace('www.', '');
                            const parts = host.split('.');
                            return parts.length > 2 ? parts.slice(-2, -1)[0] : parts[0];
                          } catch { return c.source || 'Unknown'; }
                        })().toUpperCase()}
                      </span>
                      {c.date ? (
                        <span className="text-xs text-gray-500">
                          {(() => {
                            try {
                              return new Date(c.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
                            } catch { return c.date; }
                          })()}
                        </span>
                      ) : (
                        <span className="text-[10px] text-gray-300 italic">No date</span>
                      )}
                    </div>
                    {c.snippet && (
                      <p className="text-xs text-gray-500 leading-relaxed mb-2 m-0">
                        {c.snippet.slice(0, 180)}{c.snippet.length > 180 ? '...' : ''}
                      </p>
                    )}
                    <a
                      href={c.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs no-underline hover:underline"
                      style={{ color: '#990F3D' }}
                    >
                      {c.source || 'View source'} ↗
                    </a>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => handlePublish(c.url)}
                      disabled={publishingId === c.url}
                      className="text-white border-none px-4 py-2 text-xs font-bold cursor-pointer disabled:cursor-wait disabled:opacity-50"
                      style={{ background: publishingId === c.url ? '#9CA3AF' : '#15803D' }}
                    >
                      {publishingId === c.url ? 'Publishing...' : 'Publish'}
                    </button>
                    <button
                      onClick={() => handleDismiss(c.url)}
                      className="px-3 py-2 text-xs cursor-pointer"
                      style={{ background: 'transparent', color: '#B91C1C', border: '1px solid #FECACA' }}
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Published */}
        {published.length > 0 && (
          <div>
            <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase' as const, color: '#9CA3AF', fontWeight: 600, marginBottom: 12, borderTop: '1px solid #E4DFD4', paddingTop: 12 }}>
              Published ({published.length})
            </div>
            <div className="space-y-3">
              {published.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-start justify-between gap-4"
                  style={{ background: '#FFFFFF', border: '1px solid #E4DFD4', padding: '18px 24px' }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, color: '#0E1116', fontSize: 14, marginBottom: 4 }}>
                      {entry.title}
                    </div>
                    <div style={{ color: '#9CA3AF', fontSize: 12 }}>
                      {entry.author?.name || entry.author?.organization}
                    </div>
                  </div>
                  <span className="flex-shrink-0" style={{ color: '#9CA3AF', fontSize: 12, fontFamily: 'ui-monospace, monospace', letterSpacing: '0.06em' }}>
                    {entry.date_published}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {candidates.length === 0 && published.length === 0 && (
          <div style={{ padding: '80px 24px', textAlign: 'center' }}>
            <h3 style={{ fontSize: 20, fontWeight: 700, color: '#111827', marginBottom: 12 }}>No thought leadership content</h3>
            <p style={{ fontSize: 14, color: '#6B7280', maxWidth: 448, margin: '0 auto', lineHeight: 1.6 }}>
              Run discovery to find new thought leadership pieces from known authors and institutions.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
