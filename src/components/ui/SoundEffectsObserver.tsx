'use client';

import { useEffect } from 'react';
import { audioEngine } from '../../utils/audioEngine';

export default function SoundEffectsObserver() {
  useEffect(() => {
    // Only run in browser
    if (typeof window === 'undefined') return;

    let hasInteracted = false;

    const initAudio = () => {
      if (!hasInteracted) {
        audioEngine.init();
        hasInteracted = true;
      }
    };

    const onClick = (e: MouseEvent) => {
      initAudio();
      // If clicking a button or link, play click sound
      if ((e.target as HTMLElement).closest('a, button, [role="button"]')) {
        audioEngine.playClick();
      }
    };

    const onMouseOver = (e: MouseEvent) => {
      if (!hasInteracted) return; // Cannot play sound yet
      if ((e.target as HTMLElement).closest('a, button, [role="button"]')) {
        audioEngine.playHover();
      }
    };

    // We can also bind keyboard enter/space
    const onKeyDown = (e: KeyboardEvent) => {
      initAudio();
      if ((e.key === 'Enter' || e.key === ' ') && (e.target as HTMLElement).closest('a, button, [role="button"]')) {
        audioEngine.playClick();
      }
    };

    window.addEventListener('click', onClick, { capture: true });
    window.addEventListener('mouseover', onMouseOver, { passive: true });
    window.addEventListener('keydown', onKeyDown, { capture: true });

    return () => {
      window.removeEventListener('click', onClick, { capture: true });
      window.removeEventListener('mouseover', onMouseOver);
      window.removeEventListener('keydown', onKeyDown, { capture: true });
    };
  }, []);

  return null;
}
