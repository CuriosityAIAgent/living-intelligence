'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';

const NAV_ITEMS = [
  { href: '/', label: 'This Week', icon: '📡' },
  { href: '/landscape', label: 'AI Landscape', icon: '🗺' },
  { href: '/competitors', label: 'Competitors', icon: '🏦' },
];

export function Navigation() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-50 border-b border-[#1E3A5F] bg-[#0A1628]/95 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-6 py-0 flex items-center justify-between h-16">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#C9A84C] to-[#A07830] flex items-center justify-center text-[#0A1628] font-bold text-sm">LI</div>
          <div>
            <div className="font-bold text-[#F0F4F8] text-sm leading-tight">Living Intelligence</div>
            <div className="text-[10px] text-[#7A9BB5] leading-tight">AI in Wealth Management</div>
          </div>
        </div>
        <nav className="flex items-center gap-1">
          {NAV_ITEMS.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
                pathname === item.href
                  ? 'bg-[#C9A84C]/10 text-[#C9A84C] border border-[#C9A84C]/30'
                  : 'text-[#7A9BB5] hover:text-[#F0F4F8] hover:bg-[#0F2040]'
              )}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2 text-xs text-[#7A9BB5]">
          <div className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse"></div>
          <span>Updated Mar 7, 2026</span>
        </div>
      </div>
    </header>
  );
}
