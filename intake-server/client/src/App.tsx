import { useState } from 'react';
import Header from './components/Header';
import IntelligenceTab from './pages/IntelligenceTab';
import ThoughtLeadershipTab from './pages/ThoughtLeadershipTab';
import LandscapeTab from './pages/LandscapeTab';
import AuditTab from './pages/AuditTab';

type Tab = 'intelligence' | 'thought-leadership' | 'landscape' | 'audit';

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('intelligence');

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header activeTab={activeTab} onTabChange={setActiveTab} />

      <main style={{ flex: 1 }}>
        {activeTab === 'intelligence' && <IntelligenceTab />}
        {activeTab === 'thought-leadership' && <ThoughtLeadershipTab />}
        {activeTab === 'landscape' && <LandscapeTab />}
        {activeTab === 'audit' && <AuditTab />}
      </main>
    </div>
  );
}
