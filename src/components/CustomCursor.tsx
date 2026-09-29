'use client';

import { useEffect, useState } from 'react';

export default function CustomCursor() {
  const [position, setPosition] = useState({ x: -100, y: -100 });
  const [isHovering, setIsHovering] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(pointer: coarse)').matches) return;
    setIsVisible(true);

    const onMouseMove = (e: MouseEvent) => {
      setPosition({ x: e.clientX, y: e.clientY });
    };

    const onMouseOver = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest('a, button, input, textarea, select, [role="button"]')) {
        setIsHovering(true);
      }
    };
    
    const onMouseOut = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest('a, button, input, textarea, select, [role="button"]')) {
        setIsHovering(false);
      }
    };

    window.addEventListener('mousemove', onMouseMove);
    document.body.addEventListener('mouseover', onMouseOver);
    document.body.addEventListener('mouseout', onMouseOut);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      document.body.removeEventListener('mouseover', onMouseOver);
      document.body.removeEventListener('mouseout', onMouseOut);
    };
  }, []);

  if (!isVisible) return null;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        @media (pointer: fine) {
          body, a, button, input, select, textarea { cursor: none !important; }
        }
      `}} />

      {/* Center White Dot */}
      <div 
        className="fixed top-0 left-0 rounded-full pointer-events-none z-[999999]"
        style={{ 
          transform: `translate(${position.x}px, ${position.y}px) translate(-50%, -50%) scale(${isHovering ? 0 : 1})`,
          width: '6px',
          height: '6px',
          backgroundColor: '#fff',
          mixBlendMode: 'difference',
          transition: 'transform 0.1s ease-out',
          willChange: 'transform'
        }}
      />
      
      {/* Smooth Purple Follower Ring */}
      <div 
        className="fixed top-0 left-0 pointer-events-none z-[999998]"
        style={{ 
          transform: `translate(${position.x}px, ${position.y}px) translate(-50%, -50%)`,
          width: isHovering ? '60px' : '36px',
          height: isHovering ? '60px' : '36px',
          borderRadius: isHovering ? '12px' : '50%',
          backgroundColor: isHovering ? 'rgba(168, 85, 247, 0.15)' : 'transparent',
          border: '2px solid rgba(168, 85, 247, 0.8)',
          boxShadow: '0 0 15px rgba(168, 85, 247, 0.4)',
          transition: 'transform 0.25s ease-out, width 0.3s ease, height 0.3s ease, border-radius 0.3s ease, background-color 0.3s ease',
          willChange: 'transform, width, height, border-radius',
        }}
      />
    </>
  );
}
