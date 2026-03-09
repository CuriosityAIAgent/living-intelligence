'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { label: 'This Week', href: '/' },
  { label: 'Intelligence', href: '/intelligence' },
  { label: 'Thought Leadership', href: '/thought-leadership' },
  { label: 'Landscape', href: '/landscape' },
];

export default function Header() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-gray-200">
      <div className="max-w-6xl mx-auto px-6">
        <div className="flex items-center justify-between h-14">
          {/* Wordmark */}
          <Link href="/" className="flex items-center gap-3 no-underline">
            <span className="text-base font-bold tracking-tight text-[#1B2E5E]">
              AI in Wealth Management
            </span>
          </Link>

          {/* Nav */}
          <nav className="flex items-center gap-1">
            {navItems.map((item) => {
              const isActive =
                item.href === '/'
                  ? pathname === '/'
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-3 py-1.5 text-sm font-medium rounded transition-colors ${
                    isActive
                      ? 'text-[#1B2E5E] bg-blue-50'
                      : 'text-gray-600 hover:text-[#1B2E5E] hover:bg-gray-50'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </header>
  );
}
