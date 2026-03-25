import { useState } from 'react';
import type { InboxItem } from '../types';
import { approveUrl, rejectItem } from '../api';

const REJECT_REASONS = [
  'Already covered',
  'Duplicate',
  'Off topic',
  'Low quality',
  'Fabrication suspected',
  'Source unclear',
  'Other',
];

interface StoryCardProps {
  item: InboxItem;
  index: number;
  total: number;
  onDone: () => void;
}

export default function StoryCard({ item, index, total, onDone }: StoryCardProps) {
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectNotes, setRejectNotes] = useState('');
  const [approving, setApproving] = useState(false);
  const [approveLog, setApproveLog] = useState<string[]>([]);
  const [done, setDone] = useState(false);

  const entry = item.entry;
  const gov = item.governance || entry._governance;
  const score = item.score;

  const verdict = gov?.verdict ?? 'REVIEW';
  const verdictColor =
    verdict === 'PASS' ? '#15803D' : verdict === 'REVIEW' ? '#B45309' : '#B91C1C';

  const handleApprove = async () => {
    setApproving(true);
    setApproveLog([]);
    try {
      const res = await fetch(approveUrl(item.id));
      if (!res.body) throw new Error('No stream');
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { done: streamDone, value } = await reader.read();
        if (streamDone) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.message) setApproveLog((prev) => [...prev, data.message]);
              if (data.done) {
                setDone(true);
                setTimeout(onDone, 1200);
              }
            } catch {}
          }
        }
      }
    } catch (err) {
      setApproveLog((prev) => [...prev, `Error: ${err}`]);
    } finally {
      setApproving(false);
    }
  };

  const handleReject = async () => {
    if (!rejectReason) return;
    try {
      await rejectItem(item.id, rejectReason, rejectNotes);
      setDone(true);
      setTimeout(onDone, 600);
    } catch (err) {
      console.error('Reject failed', err);
    }
  };

  if (done) {
    return (
      <div
        style={{
          border: '1px solid #BBF7D0',
          borderRadius: 8,
          background: '#F0FDF4',
          padding: '12px 16px',
          marginBottom: 16,
          color: '#15803D',
          fontSize: 13,
          fontWeight: 600,
        }}
      >
        ✓ {approveLog.length ? 'Published' : 'Rejected'} — {entry.headline}
      </div>
    );
  }

  return (
    <div
      style={{
        border: '1px solid #E5E7EB',
        borderRadius: 8,
        marginBottom: 20,
        background: '#fff',
        overflow: 'hidden',
      }}
    >
      {/* Card header: score + verdict */}
      <div
        style={{
          padding: '10px 16px',
          background: verdict === 'PASS' ? '#F0FDF4' : '#FFFBEB',
          borderBottom: `1px solid ${verdict === 'PASS' ? '#BBF7D0' : '#FDE68A'}`,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        {score !== undefined && (
          <span
            style={{
              fontSize: 18,
              fontWeight: 800,
              color: score >= 75 ? '#15803D' : score >= 60 ? '#B45309' : '#B91C1C',
            }}
          >
            {score}
          </span>
        )}
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.06em',
            color: verdictColor,
            background: verdict === 'PASS' ? '#DCFCE7' : verdict === 'REVIEW' ? '#FEF3C7' : '#FEE2E2',
            padding: '2px 8px',
            borderRadius: 3,
          }}
        >
          {verdict}
        </span>
        {gov?.paywall_caveat && (
          <span
            style={{
              fontSize: 9,
              fontWeight: 700,
              background: '#FEF3C7',
              color: '#B45309',
              padding: '2px 7px',
              borderRadius: 3,
            }}
          >
            PAYWALL
          </span>
        )}
        <span style={{ marginLeft: 'auto', fontSize: 10, color: '#9CA3AF' }}>
          {index + 1} / {total}
        </span>
      </div>

      {/* Card body */}
      <div style={{ padding: 16 }}>
        {/* Meta */}
        <div
          style={{
            display: 'flex',
            gap: 10,
            alignItems: 'center',
            marginBottom: 8,
            flexWrap: 'wrap',
          }}
        >
          <span
            style={{
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              background: '#EEF2FF',
              color: '#3730A3',
              padding: '2px 7px',
              borderRadius: 3,
            }}
          >
            {entry.type}
          </span>
          <span style={{ fontSize: 11, fontWeight: 600, color: '#374151' }}>
            {entry.company_name}
          </span>
          <span style={{ fontSize: 11, color: '#9CA3AF' }}>{entry.date}</span>
          {item.queued_at && (
            <span style={{ fontSize: 10, color: '#9CA3AF', marginLeft: 'auto' }}>
              Queued {new Date(item.queued_at).toLocaleDateString()}
            </span>
          )}
        </div>

        {/* Headline */}
        <h3
          style={{
            fontSize: 15,
            fontWeight: 700,
            color: '#111827',
            lineHeight: 1.4,
            marginBottom: 10,
          }}
        >
          {entry.headline}
        </h3>

        {/* Key stat */}
        {entry.key_stat && (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'baseline',
              gap: 6,
              marginBottom: 12,
              padding: '6px 12px',
              background: '#F9FAFB',
              border: '1px solid #E5E7EB',
              borderRadius: 4,
            }}
          >
            <span style={{ fontSize: 20, fontWeight: 800, color: '#990F3D' }}>
              {entry.key_stat.number}
            </span>
            <span style={{ fontSize: 11, color: '#6B7280' }}>{entry.key_stat.label}</span>
          </div>
        )}

        {/* The so what */}
        {entry.the_so_what && (
          <div
            style={{
              borderLeft: '4px solid #990F3D',
              padding: '10px 14px',
              marginBottom: 14,
              background: '#FFF5F7',
              borderRadius: '0 4px 4px 0',
            }}
          >
            <div
              style={{
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: '#990F3D',
                marginBottom: 5,
              }}
            >
              The So What
            </div>
            <p style={{ fontSize: 13, color: '#1F2937', lineHeight: 1.5, fontWeight: 500 }}>
              {entry.the_so_what}
            </p>
          </div>
        )}

        {/* Summary */}
        {entry.summary && (
          <div style={{ marginBottom: 14 }}>
            <div
              style={{
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: '#9CA3AF',
                marginBottom: 5,
              }}
            >
              Summary
            </div>
            <p style={{ fontSize: 12, color: '#374151', lineHeight: 1.6 }}>{entry.summary}</p>
          </div>
        )}

        {/* Governance claims */}
        {gov && (gov.unverified_claims.length > 0 || gov.fabricated_claims.length > 0) && (
          <div
            style={{
              background: '#FFFBEB',
              border: '1px solid #FDE68A',
              borderRadius: 4,
              padding: '8px 12px',
              marginBottom: 12,
            }}
          >
            <div
              style={{
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: '#B45309',
                marginBottom: 5,
              }}
            >
              Verification Issues
            </div>
            {gov.fabricated_claims.map((c, i) => (
              <div key={i} style={{ fontSize: 11, color: '#B91C1C', padding: '2px 0' }}>
                ✗ {c}
              </div>
            ))}
            {gov.unverified_claims.map((c, i) => (
              <div key={i} style={{ fontSize: 11, color: '#B45309', padding: '2px 0' }}>
                ⚠ {c}
              </div>
            ))}
          </div>
        )}

        {/* Verified claims */}
        {gov && gov.verified_claims.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <div
              style={{
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: '#9CA3AF',
                marginBottom: 5,
              }}
            >
              Verified Claims
            </div>
            {gov.verified_claims.slice(0, 3).map((c, i) => (
              <div key={i} style={{ fontSize: 11, color: '#15803D', padding: '2px 0' }}>
                ✓ {c}
              </div>
            ))}
            {gov.verified_claims.length > 3 && (
              <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 3 }}>
                +{gov.verified_claims.length - 3} more verified
              </div>
            )}
          </div>
        )}

        {/* Source */}
        {entry.source_url && (
          <div style={{ fontSize: 11, marginBottom: 8 }}>
            <span style={{ color: '#9CA3AF' }}>Source: </span>
            <a
              href={entry.source_url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#990F3D', textDecoration: 'none' }}
            >
              {entry.source_name || entry.source_url} ↗
            </a>
          </div>
        )}

        {/* Score breakdown */}
        {item.score_breakdown && (
          <div
            style={{
              fontSize: 10,
              color: '#6B7280',
              background: '#F9FAFB',
              padding: '6px 10px',
              borderRadius: 4,
              marginBottom: 14,
              fontFamily: 'monospace',
            }}
          >
            {item.score_breakdown}
          </div>
        )}

        {/* Approve log (during approval) */}
        {approveLog.length > 0 && (
          <div
            style={{
              background: '#111827',
              borderRadius: 6,
              padding: 12,
              marginBottom: 12,
              fontFamily: 'monospace',
              fontSize: 11,
              color: '#D1FAE5',
            }}
          >
            {approveLog.map((line, i) => (
              <div key={i}>{line}</div>
            ))}
          </div>
        )}

        {/* Actions */}
        <div
          style={{
            display: 'flex',
            gap: 8,
            alignItems: 'flex-start',
            paddingTop: 14,
            borderTop: '1px solid #F3F4F6',
            flexWrap: 'wrap',
          }}
        >
          <button
            onClick={handleApprove}
            disabled={approving}
            style={{
              background: '#15803D',
              color: '#fff',
              border: 'none',
              borderRadius: 4,
              padding: '8px 18px',
              fontSize: 12,
              fontWeight: 700,
              cursor: approving ? 'wait' : 'pointer',
              opacity: approving ? 0.7 : 1,
            }}
          >
            {approving ? 'Publishing…' : 'Approve →'}
          </button>

          {!rejecting ? (
            <button
              onClick={() => setRejecting(true)}
              style={{
                background: '#fff',
                color: '#B91C1C',
                border: '1px solid #FECACA',
                borderRadius: 4,
                padding: '8px 16px',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Reject ▾
            </button>
          ) : (
            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                background: '#FFF8F8',
                border: '1px solid #FECACA',
                borderRadius: 6,
                padding: 10,
              }}
            >
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {REJECT_REASONS.map((r) => (
                  <button
                    key={r}
                    onClick={() => setRejectReason(r)}
                    style={{
                      fontSize: 11,
                      padding: '4px 10px',
                      borderRadius: 10,
                      border: '1px solid',
                      borderColor: rejectReason === r ? '#990F3D' : '#E5E7EB',
                      background: rejectReason === r ? '#990F3D' : '#fff',
                      color: rejectReason === r ? '#fff' : '#374151',
                      cursor: 'pointer',
                    }}
                  >
                    {r}
                  </button>
                ))}
              </div>
              <textarea
                placeholder="Notes (optional)"
                value={rejectNotes}
                onChange={(e) => setRejectNotes(e.target.value)}
                style={{
                  width: '100%',
                  border: '1px solid #E5E7EB',
                  borderRadius: 4,
                  padding: '6px 8px',
                  fontSize: 12,
                  fontFamily: 'inherit',
                  resize: 'vertical',
                  minHeight: 60,
                }}
              />
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  onClick={handleReject}
                  disabled={!rejectReason}
                  style={{
                    background: rejectReason ? '#B91C1C' : '#9CA3AF',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 4,
                    padding: '6px 14px',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: rejectReason ? 'pointer' : 'not-allowed',
                  }}
                >
                  Confirm Reject
                </button>
                <button
                  onClick={() => {
                    setRejecting(false);
                    setRejectReason('');
                    setRejectNotes('');
                  }}
                  style={{
                    background: '#fff',
                    color: '#6B7280',
                    border: '1px solid #D1D5DB',
                    borderRadius: 4,
                    padding: '6px 12px',
                    fontSize: 12,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
