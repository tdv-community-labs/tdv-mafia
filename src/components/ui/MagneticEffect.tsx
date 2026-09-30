'use client';

import { useEffect } from 'react';

export function MagneticEffect() {
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // We only apply this to buttons or elements with 'magnetic' class
      const magneticElement = target.closest('button, a, .magnetic') as HTMLElement;
      
      if (magneticElement) {
        const rect = magneticElement.getBoundingClientRect();
        const x = e.clientX - rect.left - rect.width / 2;
        const y = e.clientY - rect.top - rect.height / 2;
        
        const moveX = x * 0.15;
        const moveY = y * 0.15;
        
        magneticElement.style.transition = 'none';
        magneticElement.style.transform = `translate(${moveX}px, ${moveY}px)`;
      }
    };

    const handleMouseLeave = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const magneticElement = target.closest('button, a, .magnetic') as HTMLElement;
      
      if (magneticElement) {
        magneticElement.style.transition = 'transform 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
        magneticElement.style.transform = 'translate(0px, 0px)';
      }
    };

    // Attach via event delegation on document
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseout', handleMouseLeave);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseout', handleMouseLeave);
    };
  }, []);

  return null;
}
