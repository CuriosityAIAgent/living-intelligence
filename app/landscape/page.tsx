import React from 'react';
import { getAllCompetitors, getCapabilities, SEGMENT_LABELS } from '@/lib/data';
import Header from '@/components/Header';
import SectionLabel from '@/components/SectionLabel';
import Link from 'next/link';

const MATURITY_STYLES: Record<string, { cell: string; dot: string; label: string }> = {
  scaled:    { cell: 'bg-green-50 border border-green-200', dot: 'bg-green-500', label: 'Scaled' },
  deployed:  { cell: 'bg-blue-50 border border-blue-200', dot: 'bg-blue-500', label: 'Deployed' },
  piloting:  { cell: 'bg-orange-50 border border-orange-200', dot: 'bg-orange-400', label: 'Piloting' },
  announced: { cell: 'bg-yellow-50 border border-yellow-200', dot: 'bg-yellow-400', label: 'Announced' },
  none:      { cell: 'bg-gray-50 border border-gray-100', dot: 'bg-gray-200', label: '—' },
};

export default function LandscapePage() {
  const competitors = getAllCompetitors();
  const capabilities = getCapabilities();

  const segmentOrder = ['wirehouse', 'global_private_bank', 'regional_champion', 'digital_disruptor', 'ai_native', 'ria_independent', 'advisor_tools'];
  const grouped = segmentOrder.map(seg => ({
    segment: seg,
    label: SEGMENT_LABELS[seg] || seg,
    competitors: competitors.filter(c => c.segment === seg),
  })).filter(g => g.competitors.length > 0);

  return (
    <div className="min-h-screen">
      <Header />

      <main className="max-w-6xl mx-auto px-6 py-10">

        {/* Page header */}
        <div className="mb-8 pb-6 border-b border-gray-200">
          <p className="section-label mb-1">The Landscape</p>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            AI Capabilities Across Wealth Management
          </h1>
          <p className="text-sm text-gray-500 max-w-2xl">
            {competitors.length} institutions tracked across {capabilities.length} capability dimensions.
            Click any cell for details.
          </p>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-5 mb-8 flex-wrap">
          <span className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Maturity:</span>
          {['scaled', 'deployed', 'piloting', 'announced'].map(m => {
            const s = MATURITY_STYLES[m];
            return (
              <div key={m} className="flex items-center gap-1.5">
                <div className={`w-2.5 h-2.5 rounded-full ${s.dot}`} />
                <span className="text-xs text-gray-600 capitalize">{m}</span>
              </div>
            );
          })}
          <div className="flex items-center gap-1.5 ml-2">
            <div className="w-2.5 h-2.5 rounded-full bg-gray-200" />
            <span className="text-xs text-gray-400">No activity</span>
          </div>
        </div>

        {/* Matrix */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b-2 border-gray-900">
                <th className="text-left py-3 px-3 text-xs font-bold text-gray-700 uppercase tracking-wide w-44 sticky left-0 bg-white">
                  Institution
                </th>
                {capabilities.map(cap => (
                  <th key={cap.id} className="py-3 px-2 text-center min-w-[100px]">
                    <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wide leading-tight">
                      {cap.label}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {grouped.map(group => (
                <React.Fragment key={group.segment}>
                  <tr>
                    <td colSpan={capabilities.length + 1} className="px-3 pt-6 pb-1">
                      <p className="section-label">{group.label}</p>
                    </td>
                  </tr>
                  {group.competitors.map((competitor, i) => (
                    <tr
                      key={competitor.id}
                      className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${i % 2 === 0 ? '' : 'bg-gray-50/30'}`}
                    >
                      <td className="py-3 px-3 sticky left-0 bg-white">
                        <div>
                          <div className="font-semibold text-gray-900 text-xs">{competitor.name}</div>
                          <div className="text-[10px] text-gray-400 leading-tight">{competitor.headline_metric}</div>
                        </div>
                      </td>
                      {capabilities.map(cap => {
                        const entry = competitor.capabilities[cap.id];
                        const maturity = entry?.maturity || 'none';
                        const style = MATURITY_STYLES[maturity] || MATURITY_STYLES.none;
                        return (
                          <td key={cap.id} className="p-1.5 text-center">
                            {entry && maturity !== 'none' ? (
                              <Link href={`/competitors/${competitor.id}#${cap.id}`}>
                                <div
                                  className={`${style.cell} rounded p-1.5 cursor-pointer hover:opacity-80 transition-opacity`}
                                  title={entry.headline}
                                >
                                  <div className="flex items-center justify-center gap-1 mb-0.5">
                                    <div className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
                                    <span className="text-[9px] font-semibold text-gray-600">{style.label}</span>
                                  </div>
                                  <div className="text-[8px] text-gray-500 leading-tight line-clamp-2">
                                    {entry.headline.split(':')[0]}
                                  </div>
                                </div>
                              </Link>
                            ) : (
                              <div className="text-gray-300 text-xs">—</div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>

        {/* Maturity Definitions */}
        <div className="mt-12 mb-10">
          <SectionLabel label="How to Read the Matrix" />
          <div className="grid grid-cols-1 md:grid-cols-5 gap-0 border border-gray-200 rounded overflow-hidden">
            <div className="p-4 border-r border-gray-200">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2.5 h-2.5 rounded-full bg-green-500 flex-shrink-0" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-gray-800">Scaled</span>
              </div>
              <p className="text-[11px] text-gray-500 leading-relaxed">
                AI is core to operations at full institutional scale — measurable adoption across the firm, advisor network, or client base (tens of thousands of users, billions of interactions, or embedded in all client workflows). Efficiency or revenue impact is documented.
              </p>
            </div>
            <div className="p-4 border-r border-gray-200">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2.5 h-2.5 rounded-full bg-blue-500 flex-shrink-0" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-gray-800">Deployed</span>
              </div>
              <p className="text-[11px] text-gray-500 leading-relaxed">
                AI capability is live in production with real clients or advisors, but not yet at full organizational scale. Rollout is underway or limited to specific regions, divisions, or user groups.
              </p>
            </div>
            <div className="p-4 border-r border-gray-200">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2.5 h-2.5 rounded-full bg-orange-400 flex-shrink-0" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-gray-800">Piloting</span>
              </div>
              <p className="text-[11px] text-gray-500 leading-relaxed">
                A formal internal pilot or limited external trial is confirmed and underway. The capability is not yet generally available — a defined group of users is actively testing it in a controlled environment.
              </p>
            </div>
            <div className="p-4 border-r border-gray-200">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-400 flex-shrink-0" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-gray-800">Announced</span>
              </div>
              <p className="text-[11px] text-gray-500 leading-relaxed">
                A public statement, press release, partnership signing, or product preview has confirmed intent. No live client or advisor access confirmed yet. Subject to revision as rollout evidence emerges.
              </p>
            </div>
            <div className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2.5 h-2.5 rounded-full bg-gray-200 flex-shrink-0" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">No Activity</span>
              </div>
              <p className="text-[11px] text-gray-400 leading-relaxed">
                No public evidence of activity in this capability area as of the assessment date. Absence of evidence is not evidence of absence — some initiatives may be unannounced.
              </p>
            </div>
          </div>
          <p className="text-[10px] text-gray-400 mt-2">
            Ratings based on publicly available evidence as of the date shown per entry. All assessments are directional — not investment advice.
          </p>
        </div>

        {/* Summary */}
        <div className="mt-10">
          <SectionLabel label="At a Glance" />
          <div className="grid grid-cols-4 gap-4">
            {['scaled', 'deployed', 'piloting', 'announced'].map(maturity => {
              const count = competitors.filter(c => c.overall_maturity === maturity).length;
              const s = MATURITY_STYLES[maturity];
              return (
                <div key={maturity} className={`${s.cell} rounded p-5`}>
                  <div className={`text-3xl font-bold mb-1 maturity-${maturity}`}>{count}</div>
                  <div className="text-xs text-gray-500 capitalize">
                    at <span className="font-semibold">{maturity}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </main>

    </div>
  );
}
