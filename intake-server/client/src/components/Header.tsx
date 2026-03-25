import { useQuery } from '@tanstack/react-query';
import { fetchInbox } from '../api';

type Tab = 'intelligence' | 'thought-leadership' | 'landscape' | 'audit';

interface HeaderProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}

export default function Header({ activeTab, onTabChange }: HeaderProps) {
  const { data: inbox } = useQuery({
    queryKey: ['inbox'],
    queryFn: fetchInbox,
    refetchInterval: 30_000,
  });

  const pendingCount = inbox?.count ?? 0;

  const tabs: { id: Tab; label: string }[] = [
    { id: 'intelligence', label: 'Intelligence' },
    { id: 'thought-leadership', label: 'Thought Leadership' },
    { id: 'landscape', label: 'Landscape' },
    { id: 'audit', label: 'Data Audit' },
  ];

  return (
    <header style={{ position: 'sticky', top: 0, zIndex: 100 }}>
      {/* Masthead */}
      <div
        style={{
          background: '#1C1C2E',
          height: 52,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 24px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>
            AI in Wealth Management
          </span>
          <span style={{ fontSize: 12, color: '#6B7280' }}>Editorial Studio</span>
        </div>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            padding: '3px 8px',
            borderRadius: 3,
            background: '#990F3D',
            color: '#fff',
          }}
        >
          Editorial
        </span>
      </div>

      {/* Nav bar */}
      <div
        style={{
          background: '#141420',
          height: 40,
          display: 'flex',
          alignItems: 'stretch',
          padding: '0 24px',
          borderBottom: '1px solid #2D2D44',
        }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            style={{
              background: 'none',
              border: 'none',
              borderBottom: activeTab === tab.id ? '2px solid #990F3D' : '2px solid transparent',
              color: activeTab === tab.id ? '#fff' : '#9CA3AF',
              fontSize: 13,
              fontWeight: activeTab === tab.id ? 600 : 500,
              padding: '0 16px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              whiteSpace: 'nowrap',
              transition: 'color .15s',
            }}
          >
            {tab.label}
            {tab.id === 'intelligence' && pendingCount > 0 && (
              <span
                style={{
                  background: '#990F3D',
                  color: '#fff',
                  fontSize: 9,
                  fontWeight: 700,
                  padding: '1px 5px',
                  borderRadius: 8,
                }}
              >
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>
    </header>
  );
}
