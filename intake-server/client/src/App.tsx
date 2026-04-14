import { useState, createContext, useContext } from 'react';
import Header, { type Tab } from './components/Header';
import InboxTab from './pages/InboxTab';
import PipelineTab from './pages/PipelineTab';
import HeldTab from './pages/HeldTab';
import HistoryTab from './pages/HistoryTab';

// Global process tracker — survives tab switches
interface ProcessState {
  active: Record<string, string>; // key → label (e.g. 'v2-batch' → 'Processing briefs…')
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
  const [activeTab, setActiveTab] = useState<Tab>('inbox');
  const [active, setActive] = useState<Record<string, string>>({});

  const processState: ProcessState = {
    active,
    start: (key, label) => setActive(prev => ({ ...prev, [key]: label })),
    stop: (key) => setActive(prev => { const next = { ...prev }; delete next[key]; return next; }),
  };

  return (
    <ProcessContext.Provider value={processState}>
      <div className="min-h-screen flex flex-col" style={{ background: '#FDF8F2' }}>
        <Header activeTab={activeTab} onTabChange={setActiveTab} />

        {/* Use display:none instead of unmount — preserves state across tab switches */}
        <main className="flex-1">
          <div style={{ display: activeTab === 'inbox' ? 'block' : 'none' }}>
            <InboxTab />
          </div>
          <div style={{ display: activeTab === 'pipeline' ? 'block' : 'none' }}>
            <PipelineTab />
          </div>
          <div style={{ display: activeTab === 'held' ? 'block' : 'none' }}>
            <HeldTab />
          </div>
          <div style={{ display: activeTab === 'history' ? 'block' : 'none' }}>
            <HistoryTab />
          </div>
        </main>
      </div>
    </ProcessContext.Provider>
  );
}
