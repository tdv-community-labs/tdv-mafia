'use client';

import { useEffect, useState } from 'react';

export default function CustomCursor() {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [outlinePosition, setOutlinePosition] = useState({ x: 0, y: 0 });
  
  const [isHovering, setIsHovering] = useState(false);
  const [isClicking, setIsClicking] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  // For velocity-based distortion
  const [velocity, setVelocity] = useState({ speed: 0, angle: 0 });

  useEffect(() => {
    if (window.matchMedia('(pointer: coarse)').matches) return;
    setIsVisible(true);

    let mouseX = window.innerWidth / 2;
    let mouseY = window.innerHeight / 2;
    let outlineX = mouseX;
    let outlineY = mouseY;
    let prevX = mouseX;
    let prevY = mouseY;
    let animationFrameId: number;

    const onMouseMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      setPosition({ x: mouseX, y: mouseY });
    };

    const animate = () => {
      // Calculate cursor speed and angle for squash/stretch
      const dx = mouseX - prevX;
      const dy = mouseY - prevY;
      const speed = Math.min(Math.sqrt(dx * dx + dy * dy) * 0.01, 0.25);
      const angle = Math.atan2(dy, dx) * (180 / Math.PI);
      
      prevX = mouseX;
      prevY = mouseY;
      setVelocity({ speed, angle });

      // Clean, fast spring physics
      outlineX += (mouseX - outlineX) * 0.85;
      outlineY += (mouseY - outlineY) * 0.85;

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

    const onMouseDown = () => setIsClicking(true);
    const onMouseUp = () => setIsClicking(false);

    window.addEventListener('mousemove', onMouseMove);
    document.body.addEventListener('mouseover', onMouseOver);
    document.body.addEventListener('mouseout', onMouseOut);
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    animate();

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      document.body.removeEventListener('mouseover', onMouseOver);
      document.body.removeEventListener('mouseout', onMouseOut);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  if (!isVisible) return null;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        @media (pointer: fine) {
          body, a, button, input, select, textarea { cursor: none !important; }
        }
        @keyframes cyber-spin-clean {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}} />

      {/* The core dot - stays difference for perfect contrast over text */}
      <div 
        className="fixed top-0 left-0 rounded-full pointer-events-none z-[999999]"
        style={{ 
          transform: `translate(${position.x}px, ${position.y}px) translate(-50%, -50%) scale(${isHovering ? 0 : (isClicking ? 0.5 : 1)})`,
          width: '6px',
          height: '6px',
          backgroundColor: '#fff',
          mixBlendMode: 'difference',
          transition: 'transform 0.15s cubic-bezier(0.25, 1, 0.5, 1)',
          willChange: 'transform'
        }}
      />
      
      {/* The main dynamic Cyberpunk aura */}
      <div 
        className="fixed top-0 left-0 pointer-events-none z-[999998] flex items-center justify-center"
        style={{ 
          transform: `translate(${outlinePosition.x}px, ${outlinePosition.y}px) translate(-50%, -50%) rotate(${velocity.angle}deg) scale(${1 + velocity.speed}, ${1 - velocity.speed}) scale(${isClicking ? 0.85 : 1})`,
          width: isHovering ? '72px' : '36px',
          height: isHovering ? '72px' : '36px',
          borderRadius: isHovering ? '16px' : '50%',
          backgroundColor: isHovering ? 'rgba(168, 85, 247, 0.15)' : 'transparent',
          border: isHovering ? '2px solid rgba(168, 85, 247, 0.9)' : (isClicking ? '1.5px solid rgba(236, 72, 153, 0.8)' : '1.5px solid rgba(16, 185, 129, 0.7)'),
          boxShadow: isHovering 
            ? '0 0 25px rgba(168, 85, 247, 0.4), inset 0 0 15px rgba(168, 85, 247, 0.3)' 
            : (isClicking ? '0 0 15px rgba(236, 72, 153, 0.5)' : '0 0 10px rgba(16, 185, 129, 0.2)'),
          transition: 'width 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275), height 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275), border-radius 0.4s ease, background-color 0.4s ease, border-color 0.2s ease, box-shadow 0.2s ease',
          willChange: 'transform, width, height, border-radius',
        }}
      >
        {/* Inner rotating dash (properly aligned) */}
        <div 
          className="absolute rounded-full pointer-events-none"
          style={{
            width: '100%',
            height: '100%',
            top: 0,
            left: 0,
            border: '2px dashed rgba(236, 72, 153, 0.8)',
            opacity: isHovering ? 1 : 0,
            animation: isHovering ? 'cyber-spin-clean 4s linear infinite' : 'none',
            transition: 'opacity 0.3s ease',
            transformOrigin: 'center center'
          }}
        />
        
        {/* Click Shockwave (properly aligned) */}
        <div
          className="absolute rounded-full pointer-events-none"
          style={{
            width: '100%',
            height: '100%',
            top: 0,
            left: 0,
            border: '2px solid rgba(16, 185, 129, 0.8)',
            opacity: isClicking ? 0.8 : 0,
            transform: isClicking ? 'scale(1.5)' : 'scale(1)',
            transition: isClicking ? 'transform 0.4s cubic-bezier(0.1, 0.9, 0.2, 1), opacity 0.4s ease-out' : 'none',
          }}
        />
      </div>
    </>
  );
}
