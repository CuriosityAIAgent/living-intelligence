'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase';

const QUESTIONS = [
  { key: 'usefulness', label: 'How useful is this platform?' },
  { key: 'quality', label: 'How would you rate the quality of intelligence?' },
];

function Stars({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          onClick={() => onChange(n)}
          className={`w-8 h-8 rounded text-sm font-bold transition-colors ${
            n <= value
              ? 'bg-[#990F3D] text-white'
              : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
          }`}
        >
          {n}
        </button>
      ))}
    </div>
  );
}

export default function RatingWidget() {
  const [visible, setVisible] = useState(false);
  const [open, setOpen] = useState(false);
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Don't show if already rated
    if (localStorage.getItem('li_rating_submitted')) return;

    // Show after 3 page visits
    const visits = parseInt(localStorage.getItem('li_page_visits') || '0', 10) + 1;
    localStorage.setItem('li_page_visits', String(visits));
    if (visits >= 3) {
      setVisible(true);
    }
  }, []);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  async function handleSubmit() {
    if (Object.keys(ratings).length < QUESTIONS.length) return;
    setSubmitting(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'rating',
          ratings,
          comment: comment.trim() || null,
          user_id: user?.id,
          user_email: user?.email,
        }),
      });
    } catch {
      // Fail silently
    }
    localStorage.setItem('li_rating_submitted', '1');
    setSubmitting(false);
    setSubmitted(true);
    setTimeout(() => {
      setVisible(false);
    }, 2000);
  }

  function dismiss() {
    localStorage.setItem('li_rating_submitted', '1');
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 left-4 sm:bottom-6 sm:left-6 z-[90]" ref={panelRef}>
      {open ? (
        <div className="bg-white rounded-lg shadow-xl border border-gray-200 w-[calc(100vw-2rem)] sm:w-80 max-w-80 overflow-hidden">
          {submitted ? (
            <div className="p-6 text-center">
              <div className="text-2xl mb-2">✓</div>
              <p className="text-sm font-medium text-gray-800">Thanks for rating!</p>
            </div>
          ) : (
            <>
              <div className="px-5 pt-4 pb-2 flex items-center justify-between">
                <h3 className="text-[13px] font-bold text-gray-900">Quick rating</h3>
                <button
                  onClick={dismiss}
                  className="text-gray-400 hover:text-gray-600 text-sm"
                >
                  ×
                </button>
              </div>
              <div className="px-5 pb-4 space-y-4">
                {QUESTIONS.map((q) => (
                  <div key={q.key}>
                    <p className="text-[12px] text-gray-600 mb-1.5">{q.label}</p>
                    <Stars
                      value={ratings[q.key] || 0}
                      onChange={(v) =>
                        setRatings((prev) => ({ ...prev, [q.key]: v }))
                      }
                    />
                  </div>
                ))}
                <div>
                  <input
                    type="text"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Any quick thoughts? (optional)"
                    className="w-full border border-gray-200 rounded px-3 py-2 text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:border-[#990F3D]"
                  />
                </div>
                <button
                  onClick={handleSubmit}
                  disabled={
                    Object.keys(ratings).length < QUESTIONS.length || submitting
                  }
                  className="w-full bg-[#990F3D] text-white text-xs font-medium py-2 rounded hover:bg-[#7a0c31] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Submitting...' : 'Submit'}
                </button>
              </div>
            </>
          )}
        </div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="bg-[#990F3D] text-white text-xs font-medium px-4 py-2.5 rounded-full shadow-lg hover:bg-[#7a0c31] transition-colors flex items-center gap-1.5"
        >
          <span className="text-sm">★</span> Rate this platform
        </button>
      )}
    </div>
  );
}
