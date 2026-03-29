'use client';

import { useState, useEffect } from 'react';

const HEADLINES = [
  'The AI moves you\u2019re not hearing about.',
  '14 launches last quarter. You heard about 3.',
  'Less noise. More signal. Fewer surprises.',
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
    <h1
      className="text-3xl md:text-[48px] font-extrabold text-white leading-[1.12] mb-6 min-h-[120px] md:min-h-[140px] transition-opacity duration-500"
      style={{ opacity: visible ? 1 : 0 }}
    >
      {HEADLINES[index]}
    </h1>
  );
}
