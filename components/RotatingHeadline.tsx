'use client';

import { useState, useEffect } from 'react';

const HEADLINES = [
  'Your competitors are deploying AI at scale. Are you seeing it in time?',
  'The firms moving fastest on AI will absorb the clients of those that don\u2019t.',
  'A hundred AI announcements a week. Which ones are real, and which ones matter to your firm?',
  'Every week you\u2019re not tracking this, your competitors are pulling ahead.',
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
    <div className="h-[110px] md:h-[165px] mb-4 flex items-start justify-center">
      <h1
        className="text-3xl md:text-[48px] font-extrabold text-white leading-[1.12] transition-opacity duration-500"
        style={{ opacity: visible ? 1 : 0 }}
      >
        {HEADLINES[index]}
      </h1>
    </div>
  );
}
