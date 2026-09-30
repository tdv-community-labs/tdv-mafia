'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Network } from 'lucide-react';

export function EcosystemNexus() {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const apps = [
    { name: 'TDV Hub', url: 'https://github.com/tdv-community-labs/tdv-hub', color: '#8b5cf6', id: 'hub' },
    { name: 'TDV Mafia', url: 'https://github.com/tdv-community-labs/tdv-mafia', color: '#a855f7', id: 'mafia' },
    { name: 'TDV Games', url: 'https://github.com/tdv-community-labs/tdv-games', color: '#ec4899', id: 'games' },
    { name: 'TDV E-School', url: 'https://github.com/tdv-community-labs/tdv-e-school', color: '#0ea5e9', id: 'eschool' },
    { name: 'MiniFootball', url: 'https://github.com/tdv-community-labs/school-minifootball-tournament', color: '#22c55e', id: 'football' },
  ];

  return (
    <div className="fixed bottom-8 right-8 z-[999990] font-sans" ref={menuRef}>
      <div 
        className={`absolute bottom-20 right-0 w-64 bg-zinc-950/85 backdrop-blur-xl border border-white/10 rounded-2xl p-3 shadow-2xl flex flex-col gap-2 transition-all duration-300 origin-bottom-right ${isOpen ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-95 pointer-events-none'}`}
      >
        <div className="text-[11px] uppercase tracking-[0.2em] text-white/40 px-3 pt-2 pb-1 border-b border-white/5 mb-1 font-mono">
          TDV Ecosystem
        </div>
        
        {apps.map((app) => (
          <a
            key={app.id}
            href={app.url}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 text-white/70 hover:text-white hover:bg-white/5 hover:translate-x-1 cursor-none group"
          >
            <div 
              className="w-2.5 h-2.5 rounded-full transition-shadow duration-300"
              style={{ 
                backgroundColor: app.color, 
                boxShadow: `0 0 10px ${app.color}` 
              }} 
            />
            <span className="text-sm font-medium tracking-wide">{app.name}</span>
          </a>
        ))}
      </div>

      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-16 h-16 rounded-full bg-zinc-900/95 backdrop-blur-xl border-2 border-purple-500/40 text-purple-400 flex items-center justify-center shadow-[0_0_20px_rgba(168,85,247,0.3)] transition-all duration-300 hover:scale-110 cursor-none hover:shadow-[0_0_35px_rgba(168,85,247,0.6)] hover:border-purple-400 hover:bg-zinc-800 ${isOpen ? 'rotate-45 scale-90' : ''}`}
      >
        <Network className="w-8 h-8" />
      </button>
    </div>
  );
}
