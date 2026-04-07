'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { label: 'Latest', shortLabel: 'Latest', href: '/intelligence' },
  { label: 'Thought Leadership', shortLabel: 'Thought', href: '/thought-leadership' },
  { label: 'Landscape', shortLabel: 'Landscape', href: '/landscape' },
];

export default function Header() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50">

      {/* Masthead — dark slate */}
      <div className="bg-[#1C1C2E]">
        <div className="max-w-6xl mx-auto px-6 h-[56px] flex items-center justify-between">
          <Link href="/intelligence" className="no-underline">
            <span className="text-white text-[22px] font-bold tracking-tight leading-none">
              AI in Wealth Management
            </span>
          </Link>
          <div className="hidden md:flex items-center">
            <span className="text-[15px] font-bold uppercase tracking-widest text-white">
              Living Intelligence
            </span>
          </div>
        </div>
      </div>

      {/* Nav bar — slightly darker */}
      <div className="bg-[#141420] border-b border-[#2A2A3E]">
        <div className="max-w-6xl mx-auto px-6 flex items-stretch h-10 overflow-x-auto scrollbar-none">
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center whitespace-nowrap flex-shrink-0 pl-0 pr-6 text-[13px] font-medium border-b-2 transition-colors ${
                  isActive
                    ? 'text-white border-[#990F3D]'
                    : 'text-[#9999BB] border-transparent hover:text-white hover:border-[#9999BB]'
                }`}
              >
                <span className="hidden sm:inline">{item.label}</span>
                <span className="sm:hidden">{item.shortLabel}</span>
              </Link>
            );
          })}
        </div>
      </div>

    </header>
  );
}
