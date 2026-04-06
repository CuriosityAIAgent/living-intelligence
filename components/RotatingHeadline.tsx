'use client';

import { useState, useEffect } from 'react';

const HEADLINES = [
  'Your competitors are deploying AI at scale. Are you seeing it in time?',
  'The firms moving fastest on AI will absorb the clients of those that don\u2019t.',
  'Hundreds of AI announcements a week. Which ones actually matter to your firm?',
  'The gap between AI leaders and everyone else is widening every quarter.',
];

export default function RotatingHeadline() {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIndex((prev) => (prev + 1) % HEADLINES.length);
        setVisible(true);
      }, 500);
    }, 4500);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="min-h-[80px] md:min-h-[165px] mb-4 flex items-start justify-center">
      <h1
        className="text-[22px] md:text-[48px] font-extrabold text-white leading-[1.15] transition-opacity duration-500 px-2"
        style={{ opacity: visible ? 1 : 0 }}
      >
        {HEADLINES[index]}
      </h1>
    </div>
  );
}
