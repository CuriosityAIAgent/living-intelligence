import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchLandscapeSuggestions, fetchLandscapeStale, applyLandscapeSuggestion, dismissLandscapeSuggestion } from '../api';
import { useState } from 'react';
import { useProcessTracker } from '../App';

const MATURITY_COLORS: Record<string, string> = {
  scaled: '#15803D',
  deployed: '#1D4ED8',
  piloting: '#B45309',
  announced: '#D97706',
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
    startProcess('landscape-sweep', 'Landscape sweep...');
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
            } catch { /* skip */ }
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
      {/* ── Toolbar ── */}
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '32px 40px 0' }}>
        <div className="flex justify-between items-center mb-6 pb-5" style={{ borderBottom: '1px solid #E4DFD4' }}>
          <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase' as const, color: '#6B7280' }}>
            <strong style={{ color: '#0E1116', fontWeight: 600 }}>{suggestions.length} suggestions</strong> · {stale.length} stale entries
          </div>
          <button
            onClick={handleSweep}
            disabled={sweeping}
            className="cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
            style={{
              fontFamily: 'ui-monospace, monospace',
              fontSize: 11,
              letterSpacing: '0.1em',
              textTransform: 'uppercase' as const,
              padding: '6px 14px',
              border: '1px solid #990F3D',
              background: sweeping ? '#9CA3AF' : '#990F3D',
              color: '#F7F2E8',
              fontWeight: 600,
            }}
          >
            {sweeping ? 'Sweeping...' : 'Run Sweep'}
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 40px 48px' }}>
        {/* Sweep log */}
        {sweepLog.length > 0 && (
          <div
            className="font-mono text-xs max-h-48 overflow-y-auto leading-relaxed mb-8"
            style={{ background: '#1C1C2E', color: '#86EFAC', padding: '16px 20px' }}
          >
            {sweepLog.map((line, i) => (
              <div key={i} className="mb-1">{line}</div>
            ))}
          </div>
        )}

        {/* Suggestions */}
        {suggestions.length > 0 && (
          <div className="mb-10">
            <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase' as const, color: '#990F3D', fontWeight: 600, marginBottom: 12, borderTop: '2px solid #990F3D', paddingTop: 12 }}>
              Maturity Suggestions ({suggestions.length})
            </div>
            <div className="space-y-3">
              {suggestions.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center gap-4"
                  style={{ background: '#FFFFFF', border: '1px solid #E4DFD4', padding: '16px 24px' }}
                >
                  <div style={{ flex: 1 }}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold" style={{ color: '#0E1116' }}>{s.company}</span>
                      <span style={{ width: 3, height: 3, background: '#D1D5DB', borderRadius: '50%', display: 'inline-block' }} />
                      <span className="text-xs" style={{ color: '#6B7280' }}>{s.capability.replace(/_/g, ' ')}</span>
                      <span className="text-gray-300">→</span>
                      <span
                        className="text-xs font-bold uppercase"
                        style={{ color: MATURITY_COLORS[s.suggested_maturity] ?? '#374151' }}
                      >
                        {s.suggested_maturity.replace(/_/g, ' ')}
                      </span>
                    </div>
                    {s.reason && (
                      <p className="text-xs text-gray-500 mt-1.5 m-0 leading-relaxed">{s.reason}</p>
                    )}
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleApply(s.id)}
                      className="text-white border-none px-4 py-2 text-xs font-bold cursor-pointer"
                      style={{ background: '#15803D' }}
                    >
                      Apply
                    </button>
                    <button
                      onClick={() => handleDismiss(s.id)}
                      className="px-3 py-2 text-xs cursor-pointer"
                      style={{ background: 'transparent', color: '#6B7280', border: '1px solid #E4DFD4' }}
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Stale entries */}
        {stale.length > 0 && (
          <div>
            <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase' as const, color: '#9CA3AF', fontWeight: 600, marginBottom: 12, borderTop: '1px solid #E4DFD4', paddingTop: 12 }}>
              Stale Entries ({stale.length})
            </div>
            {stale.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between"
                style={{ padding: '14px 0', borderBottom: '1px solid #EFEAE0', fontSize: 13 }}
              >
                <div className="flex items-center gap-3">
                  <span style={{ fontWeight: 600, color: '#0E1116' }}>{s.company}</span>
                  <span style={{ width: 3, height: 3, background: '#D1D5DB', borderRadius: '50%', display: 'inline-block' }} />
                  <span style={{ color: '#6B7280' }}>{s.capability.replace(/_/g, ' ')}</span>
                  <span
                    className="font-bold uppercase ml-1"
                    style={{ color: MATURITY_COLORS[s.current_maturity] ?? '#374151', fontSize: 11, letterSpacing: '0.06em' }}
                  >
                    {s.current_maturity.replace(/_/g, ' ')}
                  </span>
                </div>
                <span style={{ color: '#9CA3AF', fontSize: 12, fontFamily: 'ui-monospace, monospace', letterSpacing: '0.06em' }}>
                  Last assessed: {s.last_assessed}
                </span>
              </div>
            ))}
          </div>
        )}

        {suggestions.length === 0 && stale.length === 0 && (
          <div style={{ padding: '80px 24px', textAlign: 'center' }}>
            <h3 style={{ fontSize: 20, fontWeight: 700, color: '#111827', marginBottom: 12 }}>Landscape up to date</h3>
            <p style={{ fontSize: 14, color: '#6B7280', maxWidth: 448, margin: '0 auto', lineHeight: 1.6 }}>
              Run a sweep to check all 37 companies for capability changes and stale assessments.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
