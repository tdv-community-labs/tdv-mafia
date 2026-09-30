'use client';

import { useEffect } from 'react';

export function SpotlightEffect() {
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // We look for elements with 'spotlight-card' or 'bg-zinc-900/60' etc. 
      // To be safe and global, let's just use elements that look like cards.
      // But adding a specific class is safer. Let's just hook into any div that has border-zinc-200/5 or bg-white/5 etc
      const card = target.closest('.glass-card, .ui-card, [class*="bg-zinc-900"], [class*="bg-white/5"]') as HTMLElement;
      
      if (card && !card.classList.contains('no-spotlight')) {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        card.style.setProperty('--mouse-x', `${x}px`);
        card.style.setProperty('--mouse-y', `${y}px`);
      }
    };

    document.addEventListener('mousemove', handleMouseMove);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  return (
    <style dangerouslySetInnerHTML={{ __html: `
      .glass-card, .ui-card, [class*="bg-zinc-900"], [class*="bg-white/5"] {
        position: relative;
        overflow: hidden;
      }
      
      .glass-card::before, .ui-card::before, [class*="bg-zinc-900"]::before, [class*="bg-white/5"]::before {
        content: '';
        position: absolute;
        top: 0; left: 0; right: 0; bottom: 0;
        background: radial-gradient(
          600px circle at var(--mouse-x, -500px) var(--mouse-y, -500px),
          rgba(255, 255, 255, 0.08),
          transparent 40%
        );
        z-index: 0;
        pointer-events: none;
        transition: opacity 0.5s ease;
        opacity: 0;
      }
      
      .glass-card:hover::before, .ui-card:hover::before, [class*="bg-zinc-900"]:hover::before, [class*="bg-white/5"]:hover::before {
        opacity: 1;
      }
      
      /* Keep children above the spotlight */
      .glass-card > *, .ui-card > *, [class*="bg-zinc-900"] > *, [class*="bg-white/5"] > * {
        position: relative;
        z-index: 1;
      }
      
      .no-spotlight::before {
        display: none !important;
      }
    `}} />
  );
}
