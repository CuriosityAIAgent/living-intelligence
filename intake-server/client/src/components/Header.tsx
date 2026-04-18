import { useQuery } from '@tanstack/react-query';
import { fetchV2Inbox, fetchV2Held } from '../api';
import { useProcessTracker } from '../App';

export type Tab = 'inbox' | 'pipeline' | 'held' | 'history' | 'tl' | 'landscape' | 'audit';

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

  const editorialTabs: { id: Tab; label: string; count?: number; countColor?: string }[] = [
    { id: 'inbox', label: 'Inbox', count: inboxCount || undefined, countColor: '#990F3D' },
    { id: 'pipeline', label: 'Pipeline' },
    { id: 'held', label: 'Held', count: heldCount || undefined, countColor: '#B45309' },
    { id: 'history', label: 'History' },
  ];

  const toolTabs: { id: Tab; label: string }[] = [
    { id: 'tl', label: 'Thought Leadership' },
    { id: 'landscape', label: 'Landscape' },
    { id: 'audit', label: 'Audit' },
  ];

  return (
    <header className="sticky top-0 z-50">
      {/* Masthead */}
      <div style={{ background: '#1C1C2E', height: 56 }}>
        <div
          className="flex items-center justify-between h-full"
          style={{ maxWidth: 1280, margin: '0 auto', padding: '0 40px' }}
        >
          <div className="flex items-center gap-5">
            <span
              className="font-bold text-white uppercase"
              style={{ fontSize: 20, letterSpacing: '0.12em' }}
            >
              Living Intelligence
            </span>
            <span style={{ width: 1, height: 18, background: 'rgba(247,242,232,0.3)', display: 'inline-block' }} />
            <span
              className="uppercase hidden md:inline"
              style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11, letterSpacing: '0.18em', color: 'rgba(247,242,232,0.6)' }}
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
              className="hidden md:inline"
              style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase' as const, color: 'rgba(247,242,232,0.6)' }}
            >
              Desk · <strong style={{ color: '#F7F2E8', fontWeight: 500 }}>AI in Wealth Management</strong>
            </span>
          </div>
        </div>
      </div>

      {/* Nav bar */}
      <div style={{ background: '#141420', borderBottom: '1px solid #2D2D44' }}>
        <div
          className="flex items-stretch"
          style={{ maxWidth: 1280, margin: '0 auto', padding: '0 40px', height: 44 }}
        >
          {/* Editorial workflow tabs */}
          {editorialTabs.map((tab) => (
            <TabButton
              key={tab.id}
              tab={tab}
              isActive={activeTab === tab.id}
              onClick={() => onTabChange(tab.id)}
            />
          ))}

          {/* Visual separator */}
          <div className="flex items-center px-4">
            <div style={{ width: 1, height: 16, background: 'rgba(247,242,232,0.15)' }} />
          </div>

          {/* Content tool tabs */}
          {toolTabs.map((tab) => (
            <TabButton
              key={tab.id}
              tab={tab}
              isActive={activeTab === tab.id}
              onClick={() => onTabChange(tab.id)}
            />
          ))}
        </div>
      </div>
    </header>
  );
}

function TabButton({ tab, isActive, onClick }: {
  tab: { id: string; label: string; count?: number; countColor?: string };
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="bg-transparent border-none cursor-pointer flex items-center gap-2 transition-colors duration-150"
      style={{
        padding: '0 20px 0 0',
        borderBottom: isActive ? '2px solid #F7F2E8' : '2px solid transparent',
        color: isActive ? '#F7F2E8' : 'rgba(247,242,232,0.5)',
        fontWeight: isActive ? 600 : 500,
        fontSize: 13,
        letterSpacing: '0.03em',
      }}
    >
      {tab.label}
      {tab.count != null && tab.count > 0 && (
        <span
          className="text-[10px] font-medium rounded-xl"
          style={{
            background: isActive ? tab.countColor ?? '#990F3D' : 'rgba(247,242,232,0.12)',
            color: isActive ? '#F7F2E8' : 'rgba(247,242,232,0.65)',
            padding: '2px 8px',
          }}
        >
          {tab.count}
        </span>
      )}
    </button>
  );
}
