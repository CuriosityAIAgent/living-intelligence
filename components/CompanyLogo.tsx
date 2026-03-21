'use client';

// Deterministic color from company name — cycles through a professional palette
const PALETTE = [
  '#990F3D', // navy
  '#0F6B8A', // teal
  '#2E5E3B', // forest
  '#5E2E4A', // plum
  '#5E4A1B', // amber-dark
  '#2E1B5E', // indigo
  '#0A4D3C', // emerald
  '#4A1B2E', // burgundy
];

function getColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

export default function CompanyLogo({
  name,
  size = 'sm',
}: {
  name?: string;
  size?: 'sm' | 'lg';
}) {
  const safeName = name || '';
  const initial = safeName.trim()[0]?.toUpperCase() || '?';
  const bg = getColor(safeName);

  if (size === 'lg') {
    return (
      <div
        className="flex items-center justify-center rounded"
        style={{ width: '100%', height: '100%', backgroundColor: bg }}
      >
        <span style={{ fontSize: '4rem', fontWeight: 700, color: 'rgba(255,255,255,0.9)', lineHeight: 1 }}>
          {initial}
        </span>
      </div>
    );
  }

  return (
    <div
      className="flex items-center justify-center rounded flex-shrink-0"
      style={{ width: 28, height: 28, backgroundColor: bg }}
    >
      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'rgba(255,255,255,0.9)' }}>
        {initial}
      </span>
    </div>
  );
}
