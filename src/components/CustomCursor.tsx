'use client';

import { useEffect, useState, useRef } from 'react';

export default function CustomCursor() {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [outlinePosition, setOutlinePosition] = useState({ x: 0, y: 0 });
  const [trail1, setTrail1] = useState({ x: 0, y: 0 });
  const [trail2, setTrail2] = useState({ x: 0, y: 0 });
  
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
    let t1X = mouseX; let t1Y = mouseY;
    let t2X = mouseX; let t2Y = mouseY;
    
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
      const speed = Math.min(Math.sqrt(dx * dx + dy * dy) * 0.02, 0.4); // Max squeeze 0.4
      const angle = Math.atan2(dy, dx) * (180 / Math.PI);
      
      prevX = mouseX;
      prevY = mouseY;
      setVelocity({ speed, angle });

      // Spring physics
      outlineX += (mouseX - outlineX) * 0.25;
      outlineY += (mouseY - outlineY) * 0.25;
      
      t1X += (outlineX - t1X) * 0.2;
      t1Y += (outlineY - t1Y) * 0.2;

      t2X += (t1X - t2X) * 0.15;
      t2Y += (t1Y - t2Y) * 0.15;

      setOutlinePosition({ x: outlineX, y: outlineY });
      setTrail1({ x: t1X, y: t1Y });
      setTrail2({ x: t2X, y: t2Y });

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
        @keyframes cyber-spin {
          from { transform: translate(-50%, -50%) rotate(0deg); }
          to { transform: translate(-50%, -50%) rotate(360deg); }
        }
        @keyframes cyber-pulse-ring {
          0% { transform: translate(-50%, -50%) scale(1); opacity: 0.8; }
          100% { transform: translate(-50%, -50%) scale(1.5); opacity: 0; }
        }
      `}} />
      
      {/* Ghost Trail 2 */}
      <div 
        className="fixed top-0 left-0 rounded-full pointer-events-none z-[999996]"
        style={{ 
          transform: `translate(${trail2.x}px, ${trail2.y}px) translate(-50%, -50%) scale(${isHovering ? 0 : 1})`,
          width: '12px',
          height: '12px',
          backgroundColor: 'rgba(236, 72, 153, 0.3)', // Pinkish ghost
          filter: 'blur(2px)',
          transition: 'transform 0.1s linear',
          willChange: 'transform'
        }}
      />

      {/* Ghost Trail 1 */}
      <div 
        className="fixed top-0 left-0 rounded-full pointer-events-none z-[999997]"
        style={{ 
          transform: `translate(${trail1.x}px, ${trail1.y}px) translate(-50%, -50%) scale(${isHovering ? 0.5 : 1})`,
          width: '20px',
          height: '20px',
          backgroundColor: 'rgba(168, 85, 247, 0.4)', // Purple ghost
          filter: 'blur(3px)',
          transition: 'transform 0.1s linear',
          willChange: 'transform'
        }}
      />

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
        {/* Inner rotating dash (only visible on hover) */}
        <div 
          className="absolute rounded-full pointer-events-none"
          style={{
            width: '100%',
            height: '100%',
            border: '2px dashed rgba(236, 72, 153, 0.8)',
            opacity: isHovering ? 1 : 0,
            animation: isHovering ? 'cyber-spin 4s linear infinite' : 'none',
            transition: 'opacity 0.3s ease',
            transformOrigin: 'center center'
          }}
        />
        
        {/* Click Shockwave */}
        <div
          className="absolute rounded-full pointer-events-none"
          style={{
            width: '100%',
            height: '100%',
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
