'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase';
import FeedbackModal from '@/components/FeedbackModal';

const navItems = [
  { label: 'Latest', shortLabel: 'Latest', href: '/latest' },
  { label: 'Intelligence', shortLabel: 'Intelligence', href: '/intelligence' },
  { label: 'Thought Leadership', shortLabel: 'Thought', href: '/thought-leadership' },
  { label: 'Landscape', shortLabel: 'Landscape', href: '/landscape' },
];

export default function Header() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [initials, setInitials] = useState('');
  const [userName, setUserName] = useState('');
  const [userCompany, setUserCompany] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadUser() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const meta = user.user_metadata || {};
        const name = meta.full_name || meta.name || user.email || '';
        setUserName(name);
        setUserCompany(meta.company || '');
        const parts = name.split(' ').filter(Boolean);
        if (parts.length >= 2) {
          setInitials((parts[0][0] + parts[parts.length - 1][0]).toUpperCase());
        } else if (parts.length === 1) {
          setInitials(parts[0][0].toUpperCase());
        }
      }
    }
    loadUser();
  }, []);

  // Close menu on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [menuOpen]);

  return (
    <header className="sticky top-0 z-50">

      {/* Masthead — dark slate */}
      <div className="bg-[#1C1C2E]">
        <div className="max-w-6xl mx-auto px-6 h-[56px] flex items-center justify-between">
          <Link href="/latest" className="no-underline flex items-center gap-3">
            <span className="text-[15px] font-bold uppercase tracking-widest text-white">
              Living Intelligence
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <span className="hidden md:inline text-[15px] text-[#9999BB]">
              AI in Wealth Management
            </span>

            {/* User menu */}
            {initials && (
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setMenuOpen(!menuOpen)}
                  className="w-8 h-8 rounded-full bg-[#990F3D] text-white text-[12px] font-bold flex items-center justify-center hover:bg-[#7a0c31] transition-colors"
                >
                  {initials}
                </button>

                {menuOpen && (
                  <div className="absolute right-0 top-10 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                    <div className="px-4 py-3 border-b border-gray-100">
                      <div className="text-sm font-medium text-gray-900 truncate">{userName}</div>
                      {userCompany && (
                        <div className="text-xs text-gray-500 truncate">{userCompany}</div>
                      )}
                    </div>
                    <button
                      onClick={() => { setMenuOpen(false); setFeedbackOpen(true); }}
                      className="block w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      Share feedback
                    </button>
                    <a
                      href="/about"
                      className="block px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 no-underline"
                    >
                      About Living Intelligence
                    </a>
                    <div className="border-t border-gray-100" />
                    <a
                      href="/api/auth/signout"
                      className="block px-4 py-2.5 text-sm text-red-600 hover:bg-gray-50 no-underline"
                    >
                      Sign out
                    </a>
                  </div>
                )}
              </div>
            )}
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

      <FeedbackModal open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
    </header>
  );
}
