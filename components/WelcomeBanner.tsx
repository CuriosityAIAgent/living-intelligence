'use client';

import { useState, useEffect } from 'react';

export default function WelcomeBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem('li_welcome_dismissed')) {
      setVisible(true);
    }
  }, []);

  function dismiss() {
    localStorage.setItem('li_welcome_dismissed', '1');
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="bg-[#FDF8F2] border border-[#E8DFD4] rounded-lg p-5 mb-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[15px] font-bold text-gray-900 mb-1.5">
            Welcome to Living Intelligence
          </h2>
          <p className="text-[13px] text-gray-600 leading-relaxed">
            Track how wealth management firms are deploying AI — across 7 capability
            dimensions, updated daily. Every claim is source-linked and editorially reviewed.
          </p>
          <div className="flex flex-wrap gap-4 mt-3 text-[12px] text-gray-500">
            <span><strong className="text-gray-700">Latest</strong> — lead stories and recent developments</span>
            <span><strong className="text-gray-700">Intelligence</strong> — all tracked developments</span>
            <span><strong className="text-gray-700">Landscape</strong> — AI capabilities matrix</span>
          </div>
        </div>
        <button
          onClick={dismiss}
          className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors text-lg leading-none mt-0.5"
          aria-label="Dismiss welcome banner"
        >
          ×
        </button>
      </div>
    </div>
  );
}
