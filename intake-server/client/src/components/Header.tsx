import { useQuery } from '@tanstack/react-query';
import { fetchV2Inbox, fetchV2Held } from '../api';
import { useProcessTracker } from '../App';

export type Tab = 'inbox' | 'pipeline' | 'held' | 'history';

interface HeaderProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}

export default function Header({ activeTab, onTabChange }: HeaderProps) {
  const { data: inbox } = useQuery({
    queryKey: ['v2-inbox'],
    queryFn: fetchV2Inbox,
    refetchInterval: 30_000,
  });

  const { data: held } = useQuery({
    queryKey: ['v2-held'],
    queryFn: fetchV2Held,
    refetchInterval: 60_000,
  });

  const { active: activeProcesses } = useProcessTracker();
  const processLabels = Object.values(activeProcesses);

  const inboxCount = inbox?.count ?? inbox?.entries?.length ?? 0;
  const heldCount = held?.count ?? held?.entries?.length ?? 0;

  const tabs: { id: Tab; label: string; count?: number; countColor?: string }[] = [
    { id: 'inbox', label: 'Inbox', count: inboxCount || undefined, countColor: '#990F3D' },
    { id: 'pipeline', label: 'Pipeline' },
    { id: 'held', label: 'Held', count: heldCount || undefined, countColor: '#B45309' },
    { id: 'history', label: 'History' },
  ];

  return (
    <header className="sticky top-0 z-50">
      {/* Masthead — portal-matching top tier */}
      <div style={{ background: '#1C1C2E', height: 56 }}>
        <div
          className="flex items-center justify-between h-full"
          style={{ maxWidth: 1152, margin: '0 auto', padding: '0 24px' }}
        >
          <div className="flex items-center gap-4">
            <span
              className="font-bold text-white uppercase"
              style={{ fontSize: 22, letterSpacing: '0.01em' }}
            >
              Living Intelligence
            </span>
            <span
              className="text-white uppercase font-semibold hidden md:inline"
              style={{ fontSize: 12, letterSpacing: '0.14em', opacity: 0.45 }}
            >
              Editorial Studio
            </span>
          </div>

          <div className="flex items-center gap-4">
            {processLabels.length > 0 && (
              <span
                className="text-[11px] font-semibold px-3 py-1 rounded flex items-center gap-2"
                style={{ background: '#1E3A5F', color: '#93C5FD' }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full inline-block"
                  style={{ background: '#60A5FA', animation: 'pulse 2s infinite' }}
                />
                {processLabels[0]}
              </span>
            )}
            <span
              className="font-medium text-white uppercase hidden md:inline"
              style={{ fontSize: 13, letterSpacing: '0.14em', opacity: 0.6 }}
            >
              AI in Wealth Management
            </span>
          </div>
        </div>
      </div>

      {/* Nav bar — portal-matching bottom tier */}
      <div style={{ background: '#141420', borderBottom: '1px solid #2D2D44' }}>
        <div
          className="flex items-stretch"
          style={{ maxWidth: 1152, margin: '0 auto', padding: '0 24px', height: 44 }}
        >
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className="bg-transparent border-none cursor-pointer flex items-center gap-2 transition-colors duration-150"
                style={{
                  padding: '0 0',
                  paddingRight: 24,
                  borderBottom: isActive ? '2px solid #990F3D' : '2px solid transparent',
                  color: isActive ? '#fff' : '#9999BB',
                  fontWeight: isActive ? 700 : 500,
                  fontSize: 13,
                }}
              >
                {tab.label}
                {tab.count != null && tab.count > 0 && (
                  <span
                    className="text-[10px] font-bold text-white rounded-full"
                    style={{
                      background: tab.countColor ?? '#990F3D',
                      padding: '2px 8px',
                    }}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
}
