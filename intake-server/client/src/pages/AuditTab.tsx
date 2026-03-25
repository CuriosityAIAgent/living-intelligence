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
            } catch {}
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
          <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>Data Audit</span>
          {report && (
            <span style={{ fontSize: 11, color: '#9CA3AF', marginLeft: 12 }}>
              {report.total} entries checked · {errors.length} errors · {warnings.length} warnings
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div
            style={{
              display: 'flex',
              border: '1px solid #E5E7EB',
              borderRadius: 4,
              overflow: 'hidden',
            }}
          >
            {(['fast', 'deep'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                style={{
                  padding: '5px 12px',
                  fontSize: 11,
                  fontWeight: 600,
                  border: 'none',
                  background: mode === m ? '#1C1C2E' : '#fff',
                  color: mode === m ? '#fff' : '#6B7280',
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                }}
              >
                {m}
              </button>
            ))}
          </div>
          <button
            onClick={handleRun}
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
            }}
          >
            {running ? 'Running…' : '▶ Run Audit'}
          </button>
        </div>
      </div>

      <div style={{ padding: 24, maxWidth: 900 }}>
        {/* Log */}
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

        {/* Summary */}
        {report && (
          <>
            <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
              <SummaryPill
                count={report.total - errors.length - warnings.length}
                label="Clean"
                color="#15803D"
                bg="#DCFCE7"
                border="#BBF7D0"
              />
              {warnings.length > 0 && (
                <SummaryPill
                  count={warnings.length}
                  label="Warnings"
                  color="#B45309"
                  bg="#FEF3C7"
                  border="#FDE68A"
                />
              )}
              {errors.length > 0 && (
                <SummaryPill
                  count={errors.length}
                  label="Errors"
                  color="#B91C1C"
                  bg="#FEE2E2"
                  border="#FECACA"
                />
              )}
            </div>

            {/* Issues list */}
            {issues.length > 0 && (
              <div>
                {issues.map((issue, i) => (
                  <div
                    key={i}
                    style={{
                      border: '1px solid',
                      borderColor:
                        issue.severity === 'error' ? '#FECACA' : '#FDE68A',
                      borderRadius: 6,
                      marginBottom: 6,
                      background:
                        issue.severity === 'error' ? '#FFF8F8' : '#FFFDF0',
                      padding: '10px 14px',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        marginBottom: 4,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 800,
                          textTransform: 'uppercase',
                          letterSpacing: '0.08em',
                          padding: '2px 7px',
                          borderRadius: 3,
                          background: issue.severity === 'error' ? '#FEE2E2' : '#FEF3C7',
                          color: issue.severity === 'error' ? '#B91C1C' : '#B45309',
                        }}
                      >
                        {issue.severity}
                      </span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#111827' }}>
                        {issue.id}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: '#374151' }}>
                      <strong>{issue.field}:</strong> {issue.issue}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {issues.length === 0 && (
              <div
                style={{
                  textAlign: 'center',
                  padding: '40px 20px',
                  color: '#15803D',
                }}
              >
                <div style={{ fontSize: 32, marginBottom: 8 }}>✓</div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>All {report.total} entries clean</div>
              </div>
            )}
          </>
        )}

        {!report && !running && log.length === 0 && (
          <div style={{ color: '#9CA3AF', fontSize: 13 }}>
            Run an audit to check all published entries for data quality issues.
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryPill({
  count,
  label,
  color,
  bg,
  border,
}: {
  count: number;
  label: string;
  color: string;
  bg: string;
  border: string;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '8px 14px',
        borderRadius: 6,
        fontSize: 13,
        fontWeight: 600,
        background: bg,
        color,
        border: `1px solid ${border}`,
      }}
    >
      <span style={{ fontSize: 18, fontWeight: 800 }}>{count}</span>
      <span>{label}</span>
    </div>
  );
}
