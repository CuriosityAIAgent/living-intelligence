'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { label: 'Latest', href: '/' },
  { label: 'Intelligence', href: '/intelligence' },
  { label: 'Thought Leadership', href: '/thought-leadership' },
  { label: 'Landscape', href: '/landscape' },
];

export default function Header() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50">

      {/* Masthead — dark slate */}
      <div className="bg-[#1C1C2E]">
        <div className="max-w-6xl mx-auto px-6 h-[56px] flex items-center justify-between">
          <Link href="/" className="no-underline flex flex-col gap-0.5">
            <span className="text-white text-[22px] font-bold tracking-tight leading-none">
              AI in Wealth Management
            </span>
            <span className="text-[9px] font-medium uppercase tracking-[0.2em] text-[#555570]">
              AI of the Tiger
            </span>
          </Link>
          <span className="hidden md:block text-[11px] font-medium uppercase tracking-widest text-[#888899]">
            Living Intelligence
          </span>
        </div>
      </div>

      {/* Nav bar — slightly darker */}
      <div className="bg-[#141420] border-b border-[#2A2A3E]">
        <div className="max-w-6xl mx-auto px-6 flex items-stretch h-10">
          {navItems.map((item) => {
            const isActive =
              item.href === '/'
                ? pathname === '/'
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center pl-0 pr-6 text-[13px] font-medium border-b-2 transition-colors ${
                  isActive
                    ? 'text-white border-[#990F3D]'
                    : 'text-[#9999BB] border-transparent hover:text-white hover:border-[#9999BB]'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>

    </header>
  );
}
