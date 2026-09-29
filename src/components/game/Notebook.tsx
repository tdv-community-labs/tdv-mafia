'use client';

import React, { useState, useEffect } from 'react';
import { BookOpen, X, Edit3, Trash2 } from 'lucide-react';

interface NotebookProps {
  readonly lobbyId: string;
  readonly userId: string;
  readonly isOpen: boolean;
  readonly onClose: () => void;
}

export const Notebook: React.FC<NotebookProps> = ({ lobbyId, userId, isOpen, onClose }) => {
  const [content, setContent] = useState('');
  
  const storageKey = `mafia_notebook_${lobbyId}_${userId}`;

  useEffect(() => {
    if (isOpen) {
      const saved = localStorage.getItem(storageKey);
      if (saved) setContent(saved);
    }
  }, [isOpen, storageKey]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setContent(val);
    localStorage.setItem(storageKey, val);
  };

  const clearNotebook = () => {
    if (confirm('Qeydləri silmək istədiyinizə əminsiniz?')) {
      setContent('');
      localStorage.removeItem(storageKey);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed top-24 right-4 sm:right-10 w-72 sm:w-80 bg-amber-50/90 dark:bg-amber-950/70 backdrop-blur-2xl border border-amber-500/20 rounded-2xl shadow-[0_20px_60px_rgba(245,158,11,0.15)] z-50 flex flex-col overflow-hidden animate-[fadeIn_0.2s_ease-out] ring-1 ring-amber-500/10">
      {/* Header */}
      <div className="bg-amber-100/50 dark:bg-amber-900/40 p-3 flex items-center justify-between border-b border-amber-500/20 backdrop-blur-sm">
        <div className="flex items-center gap-2 text-amber-900 dark:text-amber-100 font-bold text-sm">
          <BookOpen className="w-4 h-4" />
          Şəxsi Qeyd Dəftəri
        </div>
        <div className="flex items-center gap-1">
          <button 
            onClick={clearNotebook}
            className="p-1 hover:bg-amber-300 dark:hover:bg-amber-800 rounded text-amber-700 dark:text-amber-300 transition-colors"
            title="Təmizlə"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <button 
            onClick={onClose}
            className="p-1 hover:bg-amber-300 dark:hover:bg-amber-800 rounded text-amber-700 dark:text-amber-300 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
      
      {/* Body */}
      <div className="p-3 bg-amber-50/50 dark:bg-zinc-900/50 flex-1 relative">
        <div className="absolute top-4 left-4 text-amber-900/10 dark:text-amber-100/5 pointer-events-none">
          <Edit3 className="w-24 h-24" />
        </div>
        <textarea
          value={content}
          onChange={handleChange}
          placeholder="Şübhələrinizi buraya qeyd edin... (Kim hansı roldur, kim yalan danışır)"
          className="w-full h-64 bg-transparent resize-none outline-none text-sm text-amber-950 dark:text-amber-100 placeholder:text-amber-900/30 dark:placeholder:text-amber-100/30 relative z-10 custom-scrollbar leading-relaxed"
          style={{ backgroundImage: 'linear-gradient(transparent, transparent 27px, rgba(0,0,0,0.05) 28px)', backgroundSize: '100% 28px' }}
        />
      </div>
    </div>
  );
};
