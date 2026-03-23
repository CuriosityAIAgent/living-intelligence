import Header from '@/components/Header';
import IntelligenceFilter from '@/components/IntelligenceFilter';
import { getAllIntelligence } from '@/lib/data';

export default function IntelligencePage() {
  const entries = getAllIntelligence();

  return (
    <div className="min-h-screen">
      <Header />

      <main className="max-w-6xl mx-auto px-6 py-10">

        <div className="mb-8 pb-6 border-b border-gray-200">
          <p className="section-label mb-1">Market Intelligence</p>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            What Companies Are Doing with AI
          </h1>
          <p className="text-sm text-gray-500">
            {entries.length} developments tracked · Wealth management &amp; financial services
          </p>
        </div>

        <IntelligenceFilter entries={entries} />

      </main>
    </div>
  );
}
