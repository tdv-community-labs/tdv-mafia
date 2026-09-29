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
      outlineX += (mouseX - outlineX) * 0.15;
      outlineY += (mouseY - outlineY) * 0.15;
      setOutlinePosition({ x: outlineX, y: outlineY });
      animationFrameId = requestAnimationFrame(animate);
    };

    const onMouseOver = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest('a, button, [role="button"]')) {
        setIsHovering(true);
      }
    };
    
    const onMouseOut = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest('a, button, [role="button"]')) {
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

  return (
    <>
      <div 
        className="fixed top-0 left-0 w-2 h-2 rounded-full pointer-events-none z-[9999] transition-colors duration-200"
        style={{ 
          transform: `translate(${position.x}px, ${position.y}px) translate(-50%, -50%)`,
          backgroundColor: isHovering ? '#10b981' : '#a855f7'
        }}
      />
      <div 
        className="fixed top-0 left-0 rounded-full pointer-events-none z-[9999] transition-all duration-200 border-2"
        style={{ 
          transform: `translate(${outlinePosition.x}px, ${outlinePosition.y}px) translate(-50%, -50%)`,
          width: isHovering ? '60px' : '40px',
          height: isHovering ? '60px' : '40px',
          borderColor: isHovering ? 'rgba(16, 185, 129, 0.8)' : 'rgba(168, 85, 247, 0.5)',
          backgroundColor: isHovering ? 'rgba(16, 185, 129, 0.1)' : 'rgba(168, 85, 247, 0.1)',
          backdropFilter: 'blur(2px)'
        }}
      />
    </>
  );
}
