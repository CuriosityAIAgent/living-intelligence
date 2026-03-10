/**
 * AuthorAvatar — reliable letter avatar for thought leadership authors.
 * Never depends on external image URLs.
 */

const PALETTE = [
  '#1B2E5E', '#0F5E8A', '#1A5C3A', '#5E1B2E',
  '#3D1B5E', '#0A4D5E', '#5E3D1B', '#1B4A5E',
];

function getColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function AuthorAvatar({
  name,
  size = 'md',
}: {
  name: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const bg = getColor(name);
  const initials = getInitials(name);
  const dims = size === 'sm' ? 'w-9 h-9 text-xs' : size === 'lg' ? 'w-16 h-16 text-lg' : 'w-14 h-14 text-sm';

  return (
    <div
      className={`${dims} rounded-full flex items-center justify-center flex-shrink-0 font-semibold tracking-wide text-white`}
      style={{ backgroundColor: bg }}
    >
      {initials}
    </div>
  );
}
