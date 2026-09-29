'use client';

import React, { useState, useEffect } from 'react';
import { PenTool, X, Save, Trash2, CheckCircle2 } from 'lucide-react';
import { Button } from '../ui/Button';

interface DetectiveNotebookProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
}

export const DetectiveNotebook: React.FC<DetectiveNotebookProps> = ({ isOpen, onClose, userId }) => {
  const [notes, setNotes] = useState('');
  const [saved, setSaved] = useState(false);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    const savedNotes = localStorage.getItem(`mafia_notes_${userId}`);
    if (savedNotes) {
      setNotes(savedNotes);
    }
  }, [userId]);

  const handleSave = () => {
    localStorage.setItem(`mafia_notes_${userId}`, notes);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleClear = () => {
    if (window.confirm('Bütün qeydləri silmək istədiyinizə əminsiniz?')) {
      setNotes('');
      localStorage.removeItem(`mafia_notes_${userId}`);
    }
  };

  if (!isOpen || !isClient) return null;

  return (
    <>
      <div 
        className="fixed inset-0 z-[150] bg-zinc-950/40 backdrop-blur-sm transition-opacity animate-fadeIn"
        onClick={onClose}
      />
      
      <div className="fixed right-0 top-0 bottom-0 w-full max-w-sm z-[160] bg-white/95 dark:bg-zinc-950/90 backdrop-blur-2xl border-l border-white/20 dark:border-white/10 shadow-[-10px_0_50px_rgba(0,0,0,0.5)] flex flex-col animate-slideInRight">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-zinc-100 dark:border-zinc-900 bg-zinc-50/50 dark:bg-zinc-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-500/20">
              <PenTool className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black tracking-tight text-zinc-900 dark:text-white">Xəfiyyə Dəftəri</h3>
              <p className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest">Şəxsi Qeydlər</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 p-4 sm:p-5 flex flex-col gap-2 relative bg-[url('https://www.transparenttextures.com/patterns/lined-paper.png')] dark:bg-none bg-repeat">
          <div className="absolute inset-0 bg-white/90 dark:bg-zinc-950/95 pointer-events-none" />
          
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Şübhəliləri, iddiaları və yalanları buraya qeyd edin...&#10;&#10;Məsələn:&#10;1-ci gün: Orxan Həkim olduğunu iddia etdi.&#10;2-ci gün: Əli səsvermədə aqressiv idi."
            className="w-full h-full relative z-10 resize-none bg-transparent outline-none text-zinc-800 dark:text-zinc-300 placeholder:text-zinc-400/70 font-medium text-sm leading-relaxed"
            style={{ 
              lineHeight: '2rem',
              backgroundImage: 'linear-gradient(transparent, transparent calc(2rem - 1px), rgba(200,200,200,0.2) 0px)',
              backgroundSize: '100% 2rem'
            }}
          />
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-zinc-100 dark:border-zinc-900 bg-white dark:bg-zinc-950 flex items-center justify-between gap-3">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleClear}
            className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10"
            icon={<Trash2 className="w-4 h-4" />}
          >
            Təmizlə
          </Button>
          
          <Button 
            variant="primary" 
            size="sm" 
            onClick={handleSave}
            icon={saved ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            className={saved ? 'bg-emerald-500 hover:bg-emerald-600 ring-emerald-500/20 text-white' : 'bg-amber-500 hover:bg-amber-600 ring-amber-500/20 text-white'}
          >
            {saved ? 'Yadda Saxlanıldı' : 'Yadda Saxla'}
          </Button>
        </div>
      </div>
    </>
  );
};
