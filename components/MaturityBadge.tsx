import clsx from 'clsx';

interface Props {
  maturity: string;
  size?: 'sm' | 'md';
}

const LABELS: Record<string, string> = {
  announced: 'Announced',
  piloting: 'Piloting',
  deployed: 'Deployed',
  scaled: 'Scaled',
  none: '—',
};

export function MaturityBadge({ maturity, size = 'md' }: Props) {
  return (
    <span className={clsx(
      'inline-flex items-center font-semibold rounded-full',
      size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-xs',
      `maturity-bg-${maturity}`,
      `maturity-${maturity}`,
    )}>
      {LABELS[maturity] || '—'}
    </span>
  );
}
