import { useState, createContext, useContext } from 'react';
import Header from './components/Header';
import IntelligenceTab from './pages/IntelligenceTab';
import ThoughtLeadershipTab from './pages/ThoughtLeadershipTab';
import LandscapeTab from './pages/LandscapeTab';
import AuditTab from './pages/AuditTab';

type Tab = 'intelligence' | 'thought-leadership' | 'landscape' | 'audit';

// Global process tracker — survives tab switches
interface ProcessState {
  active: Record<string, string>; // key → label (e.g. 'tl-discover' → 'Discovering TL…')
  start: (key: string, label: string) => void;
  stop: (key: string) => void;
}

const ProcessContext = createContext<ProcessState>({
  active: {},
  start: () => {},
  stop: () => {},
});

export const useProcessTracker = () => useContext(ProcessContext);

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('intelligence');
  const [active, setActive] = useState<Record<string, string>>({});

  const processState: ProcessState = {
    active,
    start: (key, label) => setActive(prev => ({ ...prev, [key]: label })),
    stop: (key) => setActive(prev => { const next = { ...prev }; delete next[key]; return next; }),
  };

  return (
    <ProcessContext.Provider value={processState}>
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <Header activeTab={activeTab} onTabChange={setActiveTab} />

        {/* Use display:none instead of unmount — preserves state across tab switches */}
        <main style={{ flex: 1 }}>
          <div style={{ display: activeTab === 'intelligence' ? 'block' : 'none' }}>
            <IntelligenceTab />
          </div>
          <div style={{ display: activeTab === 'thought-leadership' ? 'block' : 'none' }}>
            <ThoughtLeadershipTab />
          </div>
          <div style={{ display: activeTab === 'landscape' ? 'block' : 'none' }}>
            <LandscapeTab />
          </div>
          <div style={{ display: activeTab === 'audit' ? 'block' : 'none' }}>
            <AuditTab />
          </div>
        </main>
      </div>
    </ProcessContext.Provider>
  );
}
