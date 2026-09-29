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
        @keyframes cyber-spin {
          from { transform: translate(-50%, -50%) rotate(0deg); }
          to { transform: translate(-50%, -50%) rotate(360deg); }
        }
      `}} />
      
      {/* The core dot - stays difference for perfect contrast over text */}
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
      
      {/* The trailing Cyberpunk aura */}
      <div 
        className="fixed top-0 left-0 pointer-events-none z-[999998] flex items-center justify-center"
        style={{ 
          transform: `translate(${outlinePosition.x}px, ${outlinePosition.y}px) translate(-50%, -50%)`,
          width: isHovering ? '72px' : '36px',
          height: isHovering ? '72px' : '36px',
          borderRadius: isHovering ? '16px' : '50%',
          backgroundColor: isHovering ? 'rgba(168, 85, 247, 0.1)' : 'transparent',
          border: isHovering ? '2px solid rgba(168, 85, 247, 0.8)' : '1.5px solid rgba(16, 185, 129, 0.6)',
          boxShadow: isHovering 
            ? '0 0 20px rgba(168, 85, 247, 0.3), inset 0 0 10px rgba(168, 85, 247, 0.2)' 
            : '0 0 10px rgba(16, 185, 129, 0.1)',
          transition: 'width 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275), height 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275), border-radius 0.4s ease, background-color 0.4s ease, border-color 0.4s ease, box-shadow 0.4s ease',
          willChange: 'transform, width, height, border-radius',
        }}
      >
        {/* Inner rotating dash (only visible on hover) */}
        <div 
          className="absolute rounded-full pointer-events-none"
          style={{
            width: '100%',
            height: '100%',
            border: '1px dashed rgba(236, 72, 153, 0.6)',
            opacity: isHovering ? 1 : 0,
            animation: isHovering ? 'cyber-spin 4s linear infinite' : 'none',
            transition: 'opacity 0.3s ease',
            transformOrigin: 'center center'
          }}
        />
      </div>
    </>
  );
}
