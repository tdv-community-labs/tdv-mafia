'use client';

import { useEffect, useState } from 'react';

export default function CustomCursor() {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [outlinePosition, setOutlinePosition] = useState({ x: 0, y: 0 });
  const [isHovering, setIsHovering] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Only run on non-touch devices
    if (window.matchMedia('(pointer: coarse)').matches) return;
    setIsVisible(true);

    let mouseX = window.innerWidth / 2;
    let mouseY = window.innerHeight / 2;
    let outlineX = mouseX;
    let outlineY = mouseY;
    let animationFrameId: number;

    const onMouseMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      setPosition({ x: mouseX, y: mouseY });
    };

    const animate = () => {
      // Smoother interpolation for the ring (0.15 to 0.2 makes it feel more responsive but fluid)
      outlineX += (mouseX - outlineX) * 0.2;
      outlineY += (mouseY - outlineY) * 0.2;
      setOutlinePosition({ x: outlineX, y: outlineY });
      animationFrameId = requestAnimationFrame(animate);
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
    animate();

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      document.body.removeEventListener('mouseover', onMouseOver);
      document.body.removeEventListener('mouseout', onMouseOut);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  if (!isVisible) return null;

  // Ultra-Premium Cinematic Cursor using mix-blend-mode: difference
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        @media (pointer: fine) {
          body, a, button, input, select, textarea { cursor: none !important; }
        }
      `}} />
      
      {/* The core dot */}
      <div 
        className="fixed top-0 left-0 rounded-full pointer-events-none z-[999999]"
        style={{ 
          transform: `translate(${position.x}px, ${position.y}px) translate(-50%, -50%) scale(${isHovering ? 0 : 1})`,
          width: '6px',
          height: '6px',
          backgroundColor: '#fff',
          mixBlendMode: 'difference',
          transition: 'transform 0.2s cubic-bezier(0.25, 1, 0.5, 1)',
          willChange: 'transform'
        }}
      />
      
      {/* The trailing ring / hover aura */}
      <div 
        className="fixed top-0 left-0 rounded-full pointer-events-none z-[999998]"
        style={{ 
          transform: `translate(${outlinePosition.x}px, ${outlinePosition.y}px) translate(-50%, -50%)`,
          width: isHovering ? '64px' : '36px',
          height: isHovering ? '64px' : '36px',
          backgroundColor: isHovering ? '#fff' : 'transparent',
          border: isHovering ? 'none' : '1.5px solid rgba(255, 255, 255, 0.8)',
          mixBlendMode: 'difference',
          transition: 'width 0.3s cubic-bezier(0.25, 1, 0.5, 1), height 0.3s cubic-bezier(0.25, 1, 0.5, 1), background-color 0.3s ease, border 0.3s ease',
          willChange: 'transform, width, height, background-color, border'
        }}
      />
    </>
  );
}
