import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchTLCandidates, fetchTLPublished, dismissTLCandidate, runTLDiscover } from '../api';
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
    startProcess('tl-discover', 'Discovering TL…');
    try {
      await runTLDiscover();
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
            } catch {}
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
      {/* Header */}
      <div
        style={{
          background: '#fff',
          borderBottom: '1px solid #E5E7EB',
          padding: '14px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>
            Thought Leadership
          </span>
          <span style={{ fontSize: 11, color: '#9CA3AF', marginLeft: 12 }}>
            {candidates.length} candidates · {published.length} published
          </span>
        </div>
        <button
          onClick={handleDiscover}
          disabled={discovering}
          style={{
            background: discovering ? '#9CA3AF' : '#990F3D',
            color: '#fff',
            border: 'none',
            borderRadius: 4,
            padding: '7px 14px',
            fontSize: 12,
            fontWeight: 600,
            cursor: discovering ? 'not-allowed' : 'pointer',
          }}
        >
          {discovering ? 'Discovering…' : '▶ Discover TL'}
        </button>
      </div>

      <div style={{ padding: 24, maxWidth: 900 }}>
        {/* Publish log */}
        {log.length > 0 && (
          <div
            style={{
              background: '#111827',
              color: '#D1FAE5',
              borderRadius: 6,
              padding: 14,
              fontFamily: 'monospace',
              fontSize: 12,
              marginBottom: 20,
            }}
          >
            {log.map((line, i) => (
              <div key={i} style={{ marginBottom: 3 }}>
                {line}
              </div>
            ))}
          </div>
        )}

        {/* Candidates */}
        {candidates.length > 0 && (
          <div style={{ marginBottom: 32 }}>
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
              Candidates ({candidates.length})
            </div>
            {candidates.map((c) => (
              <div
                key={c.url}
                style={{
                  background: '#fff',
                  border: '1px solid #E5E7EB',
                  borderRadius: 6,
                  padding: '14px 18px',
                  marginBottom: 8,
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: 16,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', marginBottom: 4 }}>
                    {c.title}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                    {/* Source organisation */}
                    <span style={{
                      fontSize: 11, fontWeight: 600, color: '#1E40AF',
                      background: '#EFF6FF', padding: '2px 8px', borderRadius: 3,
                    }}>
                      {(() => {
                        try {
                          const host = new URL(c.url).hostname.replace('www.', '');
                          const parts = host.split('.');
                          return parts.length > 2 ? parts.slice(-2, -1)[0] : parts[0];
                        } catch { return c.source || 'Unknown'; }
                      })().toUpperCase()}
                    </span>
                    {/* Publication date */}
                    {c.date && (
                      <span style={{ fontSize: 11, color: '#6B7280' }}>
                        {(() => {
                          try {
                            return new Date(c.date).toLocaleDateString('en-GB', {
                              day: 'numeric', month: 'short', year: 'numeric',
                            });
                          } catch { return c.date; }
                        })()}
                      </span>
                    )}
                    {!c.date && (
                      <span style={{ fontSize: 10, color: '#D1D5DB', fontStyle: 'italic' }}>No date</span>
                    )}
                  </div>
                  {c.snippet && (
                    <div
                      style={{
                        fontSize: 11,
                        color: '#6B7280',
                        marginBottom: 4,
                        lineHeight: 1.5,
                      }}
                    >
                      {c.snippet.slice(0, 160)}…
                    </div>
                  )}
                  <div style={{ fontSize: 11 }}>
                    <a
                      href={c.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: '#990F3D', textDecoration: 'none' }}
                    >
                      {c.source || c.url} ↗
                    </a>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button
                    onClick={() => handlePublish(c.url)}
                    disabled={publishingId === c.url}
                    style={{
                      background: publishingId === c.url ? '#9CA3AF' : '#15803D',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 4,
                      padding: '6px 12px',
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: publishingId === c.url ? 'wait' : 'pointer',
                    }}
                  >
                    {publishingId === c.url ? '…' : 'Publish'}
                  </button>
                  <button
                    onClick={() => handleDismiss(c.url)}
                    style={{
                      background: '#fff',
                      color: '#B91C1C',
                      border: '1px solid #FECACA',
                      borderRadius: 4,
                      padding: '6px 10px',
                      fontSize: 11,
                      cursor: 'pointer',
                    }}
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Published */}
        {published.length > 0 && (
          <div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: '#9CA3AF',
                marginBottom: 12,
              }}
            >
              Published ({published.length})
            </div>
            {published.map((entry) => (
              <div
                key={entry.id}
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  justifyContent: 'space-between',
                  padding: '9px 0',
                  borderBottom: '1px solid #F3F4F6',
                  fontSize: 13,
                }}
              >
                <div>
                  <span style={{ fontWeight: 600, color: '#111827' }}>{entry.title}</span>
                  <span style={{ fontSize: 11, color: '#9CA3AF', marginLeft: 8 }}>
                    {entry.author?.name || entry.author?.organization}
                  </span>
                </div>
                <span style={{ fontSize: 11, color: '#9CA3AF', flexShrink: 0, marginLeft: 12 }}>
                  {entry.date_published}
                </span>
              </div>
            ))}
          </div>
        )}

        {candidates.length === 0 && published.length === 0 && (
          <div style={{ color: '#9CA3AF', fontSize: 13 }}>
            No thought leadership candidates. Run discovery to find new pieces.
          </div>
        )}
      </div>
    </div>
  );
}
