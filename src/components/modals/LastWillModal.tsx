'use client';

import React, { useState, useEffect } from 'react';
import { X, Feather, Save } from 'lucide-react';

interface LastWillModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialText: string;
  onSave: (text: string) => void;
  isDead: boolean;
}

export const LastWillModal: React.FC<LastWillModalProps> = ({ isOpen, onClose, initialText, onSave, isDead }) => {
  const [text, setText] = useState(initialText || '');

  useEffect(() => {
    if (isOpen) {
      setText(initialText || '');
    }
  }, [isOpen, initialText]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[70] bg-zinc-950/90 flex items-center justify-center p-4 animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-orange-50 dark:bg-zinc-900 border border-orange-200 dark:border-zinc-700/50 rounded-[20px] overflow-hidden shadow-2xl relative flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-orange-100 dark:bg-zinc-950/50 p-4 border-b border-orange-200 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2 text-orange-900 dark:text-amber-500">
            <Feather className="w-5 h-5" />
            <h3 className="font-bold text-lg">Son Vəsiyyətnamə</h3>
          </div>
          <button
            onClick={onClose}
            className="text-orange-900/50 hover:text-orange-900 dark:text-zinc-400 dark:hover:text-white p-2 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 flex flex-col gap-4">
          <p className="text-xs text-orange-800/80 dark:text-zinc-400 font-medium leading-relaxed">
            {isDead 
              ? "Siz artıq həyatda deyilsiniz. Vəsiyyətnaməniz şəhər əhalisinə oxundu." 
              : "Ölümünüz halında şəhərə buraxmaq istədiyiniz son sözlərinizi yazın. Gecə öldürülsəniz və ya məhkəmədə edam edilsəniz bu kağız kütləyə oxunacaq."}
          </p>

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={isDead}
            placeholder="Məni kimsə öldürsə, bilin ki o adam..."
            className="w-full h-32 bg-white/50 dark:bg-black/20 border border-orange-200 dark:border-zinc-800 rounded-xl p-3 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none font-serif italic"
            maxLength={300}
          />

          {!isDead && (
            <button
              onClick={() => {
                onSave(text);
                onClose();
              }}
              className="w-full py-3 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-colors active:scale-95"
            >
              <Save className="w-4 h-4" />
              Yadda Saxla
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
