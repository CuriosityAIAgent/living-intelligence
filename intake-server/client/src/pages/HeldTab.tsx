import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchV2Held, decideBrief } from '../api';
import ArticleCard from '../components/ArticleCard';

export default function HeldTab() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['v2-held'],
    queryFn: fetchV2Held,
    refetchInterval: 60_000,
  });

  const briefs = data?.entries ?? [];

  const handleRetry = async (id: string) => {
    await decideBrief(id, 'RETRY', 'Re-research from Held tab');
    queryClient.invalidateQueries({ queryKey: ['v2-held'] });
    queryClient.invalidateQueries({ queryKey: ['v2-history'] });
  };

  const handleReject = async (id: string) => {
    await decideBrief(id, 'REJECTED', 'Rejected from Held tab');
    queryClient.invalidateQueries({ queryKey: ['v2-held'] });
    queryClient.invalidateQueries({ queryKey: ['v2-history'] });
  };

  return (
    <div>
      {/* ── Toolbar ── */}
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '32px 40px 0' }}>
        <div className="flex justify-between items-center mb-6 pb-5" style={{ borderBottom: '1px solid #E4DFD4' }}>
          <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase' as const, color: '#6B7280' }}>
            <strong style={{ color: '#0E1116', fontWeight: 600 }}>{briefs.length} held {briefs.length === 1 ? 'entry' : 'entries'}</strong> · low score, suspect claims, or thin sourcing
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 40px 48px' }}>
        {isLoading ? (
          <div className="text-gray-400 text-sm py-20 text-center">Loading...</div>
        ) : briefs.length === 0 ? (
          <div style={{ padding: '80px 24px', textAlign: 'center' }}>
            <div
              style={{ width: 80, height: 80, background: '#F0FDF4', border: '2px solid #D1E7D1', borderRadius: '50%', margin: '0 auto 32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#15803D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h3 style={{ fontSize: 22, fontWeight: 700, color: '#111827', marginBottom: 12 }}>No quality holds</h3>
            <p style={{ fontSize: 15, color: '#6B7280', maxWidth: 448, margin: '0 auto', lineHeight: 1.6 }}>
              When the pipeline holds an entry for quality concerns, it will appear here for review.
              Retry sends them back through the v2 pipeline.
            </p>
          </div>
        ) : (
          briefs.map((brief) => (
            <ArticleCard
              key={brief.id}
              brief={brief}
              onApprove={() => {}}
              onReject={handleReject}
              onRetry={handleRetry}
              compact
            />
          ))
        )}
      </div>
    </div>
  );
}
