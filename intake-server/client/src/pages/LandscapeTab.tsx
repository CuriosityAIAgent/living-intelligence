import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchLandscapeSuggestions, fetchLandscapeStale, applyLandscapeSuggestion, dismissLandscapeSuggestion } from '../api';
import { useState } from 'react';
import { useProcessTracker } from '../App';

const MATURITY_COLORS: Record<string, string> = {
  scaled: '#15803D',
  deployed: '#1D4ED8',
  piloting: '#B45309',
  announced: '#B45309',
  no_activity: '#9CA3AF',
};

export default function LandscapeTab() {
  const queryClient = useQueryClient();
  const [sweeping, setSweeping] = useState(false);
  const [sweepLog, setSweepLog] = useState<string[]>([]);
  const { start: startProcess, stop: stopProcess } = useProcessTracker();

  const { data: suggestionsData } = useQuery({
    queryKey: ['landscape-suggestions'],
    queryFn: fetchLandscapeSuggestions,
  });

  const { data: staleData } = useQuery({
    queryKey: ['landscape-stale'],
    queryFn: fetchLandscapeStale,
  });

  const suggestions = suggestionsData?.suggestions ?? [];
  const stale = staleData?.stale ?? [];

  const handleSweep = async () => {
    setSweeping(true);
    setSweepLog([]);
    startProcess('landscape-sweep', 'Landscape sweep…');
    try {
      const res = await fetch('/api/landscape-sweep', { method: 'POST' });
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
              if (data.message) setSweepLog(prev => [...prev, data.message]);
              if (data.done) {
                queryClient.invalidateQueries({ queryKey: ['landscape-suggestions'] });
                queryClient.invalidateQueries({ queryKey: ['landscape-stale'] });
              }
            } catch {}
          }
        }
      }
    } catch (err) {
      setSweepLog(prev => [...prev, `Error: ${err}`]);
    } finally {
      setSweeping(false);
      stopProcess('landscape-sweep');
    }
  };

  const handleApply = async (id: string) => {
    await applyLandscapeSuggestion(id);
    queryClient.invalidateQueries({ queryKey: ['landscape-suggestions'] });
  };

  const handleDismiss = async (id: string) => {
    await dismissLandscapeSuggestion(id);
    queryClient.invalidateQueries({ queryKey: ['landscape-suggestions'] });
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
          <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>Landscape</span>
          <span style={{ fontSize: 11, color: '#9CA3AF', marginLeft: 12 }}>
            {suggestions.length} suggestions · {stale.length} stale entries
          </span>
        </div>
        <button
          onClick={handleSweep}
          disabled={sweeping}
          style={{
            background: sweeping ? '#9CA3AF' : '#990F3D',
            color: '#fff',
            border: 'none',
            borderRadius: 4,
            padding: '7px 14px',
            fontSize: 12,
            fontWeight: 600,
            cursor: sweeping ? 'not-allowed' : 'pointer',
          }}
        >
          {sweeping ? 'Sweeping…' : '▶ Run Sweep'}
        </button>
      </div>

      <div style={{ padding: 24, maxWidth: 900 }}>
        {/* Sweep log */}
        {sweepLog.length > 0 && (
          <div style={{
            background: '#111827', color: '#D1FAE5', borderRadius: 6,
            padding: 14, fontFamily: 'monospace', fontSize: 11,
            marginBottom: 20, maxHeight: 200, overflowY: 'auto', lineHeight: 1.6,
          }}>
            {sweepLog.map((line, i) => (
              <div key={i} style={{ marginBottom: 2 }}>{line}</div>
            ))}
          </div>
        )}

        {/* Suggestions */}
        {suggestions.length > 0 && (
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
              Maturity Suggestions ({suggestions.length})
            </div>
            {suggestions.map((s) => (
              <div
                key={s.id}
                style={{
                  background: '#fff',
                  border: '1px solid #E5E7EB',
                  borderRadius: 6,
                  padding: '12px 16px',
                  marginBottom: 8,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <div style={{ flex: 1 }}>
                  <span style={{ fontWeight: 600, color: '#111827', fontSize: 13 }}>
                    {s.company}
                  </span>
                  <span style={{ color: '#9CA3AF', margin: '0 6px', fontSize: 12 }}>·</span>
                  <span style={{ color: '#6B7280', fontSize: 12 }}>{s.capability}</span>
                  <span style={{ color: '#9CA3AF', margin: '0 6px', fontSize: 12 }}>→</span>
                  <span
                    style={{
                      fontWeight: 700,
                      fontSize: 12,
                      color: MATURITY_COLORS[s.suggested_maturity] ?? '#374151',
                    }}
                  >
                    {s.suggested_maturity}
                  </span>
                  {s.reason && (
                    <div style={{ fontSize: 11, color: '#6B7280', marginTop: 3 }}>{s.reason}</div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    onClick={() => handleApply(s.id)}
                    style={{
                      background: '#15803D',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 4,
                      padding: '5px 12px',
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Apply
                  </button>
                  <button
                    onClick={() => handleDismiss(s.id)}
                    style={{
                      background: '#fff',
                      color: '#6B7280',
                      border: '1px solid #D1D5DB',
                      borderRadius: 4,
                      padding: '5px 10px',
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

        {/* Stale entries */}
        {stale.length > 0 && (
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
              Stale Entries ({stale.length})
            </div>
            {stale.map((s) => (
              <div
                key={s.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '9px 0',
                  borderBottom: '1px solid #F3F4F6',
                  fontSize: 12,
                }}
              >
                <div>
                  <span style={{ fontWeight: 600, color: '#111827' }}>{s.company}</span>
                  <span style={{ color: '#9CA3AF', margin: '0 6px' }}>·</span>
                  <span style={{ color: '#6B7280' }}>{s.capability}</span>
                  <span
                    style={{
                      marginLeft: 8,
                      fontWeight: 700,
                      color: MATURITY_COLORS[s.current_maturity] ?? '#374151',
                    }}
                  >
                    {s.current_maturity}
                  </span>
                </div>
                <span style={{ fontSize: 11, color: '#9CA3AF' }}>
                  Last assessed: {s.last_assessed}
                </span>
              </div>
            ))}
          </div>
        )}

        {suggestions.length === 0 && stale.length === 0 && (
          <div style={{ color: '#9CA3AF', fontSize: 13 }}>
            No pending landscape updates. Run sweep to check for changes.
          </div>
        )}
      </div>
    </div>
  );
}
