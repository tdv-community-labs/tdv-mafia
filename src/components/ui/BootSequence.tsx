'use client';

import React, { useEffect, useState } from 'react';

export function BootSequence() {
  const [isVisible, setIsVisible] = useState(false);
  const [logIndex, setLogIndex] = useState(0);
  
  const logs = [
    "INITIALIZING SECURE UPLINK...",
    "DECRYPTING ECOSYSTEM PROTOCOLS...",
    "CONNECTING TO TDV MAINFRAME...",
    "ACCESS GRANTED."
  ];

  useEffect(() => {
    // Only show once per session
    if (typeof window !== 'undefined' && !sessionStorage.getItem('tdv_mafia_booted')) {
      setIsVisible(true);
      
      let currentLog = 0;
      const interval = setInterval(() => {
        if (currentLog < logs.length) {
          setLogIndex(currentLog);
          currentLog++;
        } else {
          clearInterval(interval);
          setTimeout(() => {
            setIsVisible(false);
            sessionStorage.setItem('tdv_mafia_booted', 'true');
          }, 300);
        }
      }, 350);
      
      return () => clearInterval(interval);
    }
  }, []);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-[9999999] bg-zinc-950 flex flex-col items-center justify-center font-mono transition-opacity duration-700 ease-out">
      <div className="relative text-5xl md:text-6xl font-black tracking-[0.2em] mb-5 text-transparent [-webkit-text-stroke:1px_rgba(255,255,255,0.1)]">
        TDV CORE
        <div 
          className="absolute inset-0 text-white overflow-hidden border-r-2 border-white whitespace-nowrap"
          style={{
            animation: 'fillText 1s cubic-bezier(0.4, 0, 0.2, 1) forwards',
          }}
        >
          TDV CORE
        </div>
      </div>
      
      <div className="text-emerald-500 text-xs md:text-sm h-5 opacity-0 animate-[blinkLog_1.5s_steps(1)_forwards]">
        {`> ${logs[logIndex]}`}
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes fillText { 
          0% { width: 0%; } 
          100% { width: 100%; } 
        }
        @keyframes blinkLog {
          0% { opacity: 1; } 25% { opacity: 0; } 50% { opacity: 1; }
          75% { opacity: 0; } 100% { opacity: 1; }
        }
      `}} />
    </div>
  );
}
