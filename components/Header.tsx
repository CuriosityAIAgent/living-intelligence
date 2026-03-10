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
    <header className="sticky top-0 z-50 bg-white border-b border-gray-200">
      <div className="max-w-6xl mx-auto px-6 flex items-stretch justify-between h-14">

        {/* Wordmark */}
        <Link href="/" className="flex items-center no-underline flex-shrink-0 mr-10">
          <span className="text-[13px] font-bold tracking-widest uppercase text-[#1B2E5E] letter-spacing-wide">
            AI in Wealth Management
          </span>
        </Link>

        {/* Nav */}
        <nav className="flex items-stretch">
          {navItems.map((item) => {
            const isActive =
              item.href === '/'
                ? pathname === '/'
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center px-4 text-sm border-b-2 transition-colors ${
                  isActive
                    ? 'text-[#1B2E5E] font-semibold border-[#1B2E5E]'
                    : 'text-gray-500 font-medium border-transparent hover:text-gray-900 hover:border-gray-300'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

      </div>
    </header>
  );
}
