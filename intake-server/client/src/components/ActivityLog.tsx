import { useQuery } from '@tanstack/react-query';
import { fetchActivityLog } from '../api';

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function ActivityLog() {
  const { data } = useQuery({
    queryKey: ['activity-log'],
    queryFn: fetchActivityLog,
    refetchInterval: 30_000,
  });

  const log = data?.log ?? [];

  if (log.length === 0) {
    return (
      <div style={{ fontSize: 12, color: '#9CA3AF', padding: '12px 0' }}>
        No recent activity.
      </div>
    );
  }

  return (
    <div>
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: '#9CA3AF',
          marginBottom: 8,
          paddingBottom: 6,
          borderBottom: '1px solid #E5E7EB',
        }}
      >
        Recent Activity
      </div>
      {log.map((entry, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 10,
            padding: '7px 0',
            borderBottom: '1px solid #F9FAFB',
            fontSize: 12,
          }}
        >
          <span
            style={{
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              padding: '2px 7px',
              borderRadius: 3,
              flexShrink: 0,
              background: entry.action === 'approved' ? '#DCFCE7' : '#FEE2E2',
              color: entry.action === 'approved' ? '#15803D' : '#B91C1C',
            }}
          >
            {entry.action}
          </span>
          <span style={{ flex: 1, color: '#374151', lineHeight: 1.4 }}>
            {entry.headline}
            {entry.reason && (
              <span style={{ color: '#9CA3AF', marginLeft: 6 }}>— {entry.reason}</span>
            )}
          </span>
          <span style={{ fontSize: 10, color: '#9CA3AF', flexShrink: 0 }}>
            {timeAgo(entry.timestamp)}
          </span>
        </div>
      ))}
    </div>
  );
}
