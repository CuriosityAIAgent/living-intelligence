'use client';

import { useState, useRef, useEffect } from 'react';
import { createClient } from '@/lib/supabase';

export default function FeedbackModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open, onClose]);

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    if (open) document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  async function handleSubmit() {
    if (!text.trim()) return;
    setSubmitting(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'feedback',
          feedback: text.trim(),
          user_id: user?.id,
          user_email: user?.email,
        }),
      });
      setSubmitted(true);
      setTimeout(() => {
        onClose();
        setText('');
        setSubmitted(false);
      }, 1500);
    } catch {
      // Fail silently — better than blocking the user
      setSubmitted(true);
      setTimeout(() => {
        onClose();
        setText('');
        setSubmitted(false);
      }, 1500);
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40">
      <div
        ref={modalRef}
        className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 overflow-hidden"
      >
        {submitted ? (
          <div className="p-8 text-center">
            <div className="text-2xl mb-2">✓</div>
            <p className="text-sm font-medium text-gray-800">Thank you for your feedback</p>
          </div>
        ) : (
          <>
            <div className="px-6 pt-5 pb-3">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-[15px] font-bold text-gray-900">Share feedback</h3>
                <button
                  onClick={onClose}
                  className="text-gray-400 hover:text-gray-600 text-lg leading-none"
                >
                  ×
                </button>
              </div>
              <p className="text-xs text-gray-500">
                What&apos;s working? What could be better? We read every response.
              </p>
            </div>
            <div className="px-6 pb-5">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Your feedback..."
                rows={4}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-[#990F3D] focus:ring-1 focus:ring-[#990F3D] resize-none"
                autoFocus
              />
              <div className="flex justify-end mt-3">
                <button
                  onClick={handleSubmit}
                  disabled={!text.trim() || submitting}
                  className="bg-[#990F3D] text-white text-sm font-medium px-5 py-2 rounded hover:bg-[#7a0c31] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Sending...' : 'Send feedback'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
