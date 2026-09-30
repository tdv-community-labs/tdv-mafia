'use client';

import { useEffect, useState, useRef } from 'react';
import { ArrowLeft, RefreshCw, Link, Zap } from 'lucide-react';

export function ContextMenu() {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isVisible, setIsVisible] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      
      let x = e.clientX;
      let y = e.clientY;
      
      const menuWidth = 220;
      const menuHeight = 180;
      
      if (x + menuWidth > window.innerWidth) x = window.innerWidth - menuWidth - 10;
      if (y + menuHeight > window.innerHeight) y = window.innerHeight - menuHeight - 10;
      
      setPosition({ x, y });
      setIsVisible(true);
    };

    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsVisible(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsVisible(false);
    };

    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('click', handleClick);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('click', handleClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const copyUrl = () => {
    navigator.clipboard.writeText(window.location.href);
    setIsVisible(false);
  };

  return (
    <div 
      ref={menuRef}
      className={`fixed z-[99999999] w-[220px] bg-zinc-950/80 backdrop-blur-xl border border-white/10 rounded-xl p-1.5 shadow-2xl transition-all duration-150 origin-top-left ${isVisible ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-95 pointer-events-none'}`}
      style={{ left: position.x, top: position.y }}
    >
      <button onClick={() => window.history.back()} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-white/80 hover:text-white hover:bg-white/10 hover:translate-x-1 transition-all duration-200 text-sm font-medium cursor-none">
        <ArrowLeft className="w-4 h-4 opacity-70" />
        Geri Qayıt
      </button>
      <button onClick={() => window.location.reload()} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-white/80 hover:text-white hover:bg-white/10 hover:translate-x-1 transition-all duration-200 text-sm font-medium cursor-none">
        <RefreshCw className="w-4 h-4 opacity-70" />
        Səhifəni Yenilə
      </button>
      
      <div className="h-px bg-white/10 my-1.5 mx-1" />
      
      <a href="https://github.com/tdv-community-labs/tdv-hub" className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-white/80 hover:text-white hover:bg-white/10 hover:translate-x-1 transition-all duration-200 text-sm font-medium cursor-none">
        <Zap className="w-4 h-4 text-purple-500" />
        TDV Hub'a Keçid
      </a>
      <button onClick={copyUrl} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-white/80 hover:text-white hover:bg-white/10 hover:translate-x-1 transition-all duration-200 text-sm font-medium cursor-none">
        <Link className="w-4 h-4 opacity-70" />
        Linki Kopyala
      </button>
    </div>
  );
}
