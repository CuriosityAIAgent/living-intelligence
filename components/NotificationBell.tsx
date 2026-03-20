'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

interface Notification {
  id: string;
  headline: string;
  company_name: string;
  date: string;
  type: string;
  image_url: string;
}

const TYPE_LABELS: Record<string, string> = {
  partnership: 'Partnership',
  product_launch: 'Launch',
  milestone: 'Milestone',
  strategy_move: 'Strategy',
  market_signal: 'Signal',
};

function timeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const days = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

const LS_KEY = 'li_notif_read_at';

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [readAt, setReadAt] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/notifications')
      .then(r => r.json())
      .then(setNotifications)
      .catch(() => {});
    setReadAt(localStorage.getItem(LS_KEY));
  }, []);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const unreadCount = notifications.filter(n => {
    if (!readAt) return true;
    return new Date(n.date) > new Date(readAt);
  }).length;

  function markRead() {
    const now = new Date().toISOString();
    localStorage.setItem(LS_KEY, now);
    setReadAt(now);
  }

  return (
    <div ref={ref} className="relative flex items-center">
      <button
        onClick={() => { setOpen(o => !o); }}
        className="relative flex items-center justify-center w-8 h-8 rounded hover:bg-white/10 transition-colors"
        aria-label="Notifications"
      >
        {/* Bell icon */}
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#9999BB]">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        {unreadCount > 0 && (
          <span className="absolute top-0.5 right-0.5 flex items-center justify-center w-4 h-4 rounded-full bg-[#990F3D] text-white text-[9px] font-bold leading-none">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-[360px] bg-white border border-gray-200 rounded shadow-xl z-[100] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
            <span className="text-[11px] font-bold uppercase tracking-widest text-[#990F3D]">
              What&apos;s New
            </span>
            {unreadCount > 0 && (
              <button
                onClick={markRead}
                className="text-[11px] text-gray-400 hover:text-[#990F3D] transition-colors"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* Notification list */}
          <div className="divide-y divide-gray-50 max-h-[400px] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-gray-400">
                No updates yet
              </div>
            ) : (
              notifications.map(n => {
                const isUnread = !readAt || new Date(n.date) > new Date(readAt);
                return (
                  <Link
                    key={n.id}
                    href={`/intelligence/${n.id}`}
                    onClick={() => setOpen(false)}
                    className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors no-underline group"
                  >
                    {/* Unread dot */}
                    <div className="flex-shrink-0 mt-1.5">
                      {isUnread
                        ? <span className="block w-1.5 h-1.5 rounded-full bg-[#990F3D]" />
                        : <span className="block w-1.5 h-1.5" />
                      }
                    </div>
                    {/* Logo */}
                    <div className="flex-shrink-0 w-8 h-8 bg-gray-50 border border-gray-100 rounded flex items-center justify-center">
                      {n.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={n.image_url} alt={n.company_name} className="max-h-5 max-w-7 object-contain" />
                      ) : (
                        <span className="text-[8px] font-bold text-gray-400">{n.company_name.slice(0, 3)}</span>
                      )}
                    </div>
                    {/* Text */}
                    <div className="flex-1 min-w-0">
                      <p className={`text-[12px] leading-snug mb-0.5 line-clamp-2 group-hover:text-[#990F3D] transition-colors ${isUnread ? 'font-semibold text-gray-900' : 'font-normal text-gray-600'}`}>
                        {n.headline}
                      </p>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-gray-400">{n.company_name}</span>
                        <span className="text-gray-200 text-[10px]">·</span>
                        <span className="text-[10px] text-gray-400">{timeAgo(n.date)}</span>
                        <span className="text-gray-200 text-[10px]">·</span>
                        <span className="text-[10px] text-[#990F3D] font-medium">{TYPE_LABELS[n.type] || n.type}</span>
                      </div>
                    </div>
                  </Link>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50">
            <Link
              href="/intelligence"
              onClick={() => setOpen(false)}
              className="text-[11px] font-medium text-[#990F3D] hover:underline"
            >
              View all intelligence →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
