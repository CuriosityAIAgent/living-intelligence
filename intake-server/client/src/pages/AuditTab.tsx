import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchAuditReport } from '../api';

export default function AuditTab() {
  const [mode, setMode] = useState<'fast' | 'deep'>('fast');
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState<string[]>([]);

  const { data: report, refetch } = useQuery({
    queryKey: ['audit-report'],
    queryFn: fetchAuditReport,
    enabled: false,
  });

  const handleRun = async () => {
    setRunning(true);
    setLog([]);
    try {
      const res = await fetch(mode === 'fast' ? '/api/audit' : '/api/audit/deep');
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
              if (data.done) refetch();
            } catch { /* skip */ }
          }
        }
      }
    } catch (err) {
      setLog((prev) => [...prev, `Error: ${err}`]);
    } finally {
      setRunning(false);
    }
  };

  const issues = report?.issues ?? [];
  const errors = issues.filter((i) => i.severity === 'error');
  const warnings = issues.filter((i) => i.severity === 'warning');

  return (
    <div>
      {/* ── Toolbar ── */}
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '32px 40px 0' }}>
        <div className="flex justify-between items-center mb-6 pb-5" style={{ borderBottom: '1px solid #E4DFD4' }}>
          <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase' as const, color: '#6B7280' }}>
            <strong style={{ color: '#0E1116', fontWeight: 600 }}>Data Audit</strong>
            {report && (
              <span> · {report.total} entries · {errors.length} errors · {warnings.length} warnings</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <div className="flex overflow-hidden" style={{ border: '1px solid #E4DFD4' }}>
              {(['fast', 'deep'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className="cursor-pointer capitalize"
                  style={{
                    padding: '5px 14px',
                    fontSize: 11,
                    fontWeight: 600,
                    border: 'none',
                    background: mode === m ? '#0E1116' : '#fff',
                    color: mode === m ? '#F7F2E8' : '#6B7280',
                    fontFamily: 'ui-monospace, monospace',
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase' as const,
                  }}
                >
                  {m}
                </button>
              ))}
            </div>
            <button
              onClick={handleRun}
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
              {running ? 'Running...' : 'Run Audit'}
            </button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 40px 48px' }}>
        {/* Log */}
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

        {/* Summary pills */}
        {report && (
          <>
            <div className="flex gap-3 mb-8 flex-wrap">
              <SummaryPill
                count={report.total - errors.length - warnings.length}
                label="Clean"
                color="#15803D"
                bg="#F0FDF4"
                border="#BBF7D0"
              />
              {warnings.length > 0 && (
                <SummaryPill count={warnings.length} label="Warnings" color="#B45309" bg="#FFFBEB" border="#FDE68A" />
              )}
              {errors.length > 0 && (
                <SummaryPill count={errors.length} label="Errors" color="#B91C1C" bg="#FEF2F2" border="#FECACA" />
              )}
            </div>

            {/* Issues list */}
            {issues.length > 0 && (
              <div className="space-y-2">
                {issues.map((issue, i) => (
                  <div
                    key={i}
                    style={{
                      border: '1px solid',
                      borderColor: issue.severity === 'error' ? '#FECACA' : '#FDE68A',
                      background: issue.severity === 'error' ? '#FFF8F8' : '#FFFDF0',
                      padding: '12px 18px',
                    }}
                  >
                    <div className="flex items-center gap-3 mb-1.5">
                      <span
                        className="text-[9px] font-bold uppercase px-2 py-0.5"
                        style={{
                          letterSpacing: '0.08em',
                          background: issue.severity === 'error' ? '#FEE2E2' : '#FEF3C7',
                          color: issue.severity === 'error' ? '#B91C1C' : '#B45309',
                        }}
                      >
                        {issue.severity}
                      </span>
                      <span className="text-xs font-semibold" style={{ color: '#0E1116' }}>
                        {issue.id}
                      </span>
                    </div>
                    <div className="text-xs" style={{ color: '#374151' }}>
                      <strong>{issue.field}:</strong> {issue.issue}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {issues.length === 0 && (
              <div className="text-center py-12">
                <div style={{ fontSize: 32, marginBottom: 8, color: '#15803D' }}>✓</div>
                <div className="text-sm font-semibold" style={{ color: '#15803D' }}>
                  All {report.total} entries clean
                </div>
              </div>
            )}
          </>
        )}

        {!report && !running && log.length === 0 && (
          <div style={{ padding: '80px 24px', textAlign: 'center' }}>
            <h3 style={{ fontSize: 20, fontWeight: 700, color: '#111827', marginBottom: 12 }}>No audit results</h3>
            <p style={{ fontSize: 14, color: '#6B7280', maxWidth: 448, margin: '0 auto', lineHeight: 1.6 }}>
              Run a fast or deep audit to check all published entries for data quality issues.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryPill({ count, label, color, bg, border }: {
  count: number; label: string; color: string; bg: string; border: string;
}) {
  return (
    <div
      className="flex items-center gap-2"
      style={{ padding: '10px 16px', background: bg, color, border: `1px solid ${border}`, fontSize: 13, fontWeight: 600 }}
    >
      <span style={{ fontSize: 20, fontWeight: 800 }}>{count}</span>
      <span>{label}</span>
    </div>
  );
}
