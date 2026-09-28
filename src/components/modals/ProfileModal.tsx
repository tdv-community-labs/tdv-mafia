'use client';

import React, { useState } from 'react';
import { User, Trophy, Shield, Settings, Check, Edit2, X } from 'lucide-react';
import { Button } from '../ui/Button';
import { PlayerProfileCard } from '../ui/PlayerProfileCard';

interface ProfileModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly currentUsername: string;
  readonly onUpdateUsername: (newName: string) => void;
  readonly tier: string;
  readonly totalXp: number;
  readonly userId?: string;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({ 
  isOpen, 
  onClose, 
  currentUsername, 
  onUpdateUsername,
  userId
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [draftName, setDraftName] = useState(currentUsername);

  if (!isOpen) return null;

  const handleSave = () => {
    if (draftName.trim().length >= 3) {
      onUpdateUsername(draftName.trim());
      setIsEditing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn" onClick={onClose}>
      <div 
        className="w-full max-w-3xl bg-zinc-900 border border-zinc-800 rounded-[32px] overflow-hidden shadow-2xl relative"
        onClick={e => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute top-6 right-6 z-20 text-zinc-400 hover:text-white bg-black/50 hover:bg-black p-2 rounded-full transition-colors">
          <X className="w-5 h-5" />
        </button>
        
        <div className="p-6 md:p-10 pt-16 relative">
          
          <div className="absolute top-6 left-6 z-20">
              {isEditing ? (
                <div className="flex items-center gap-2 bg-zinc-950 p-2 rounded-xl shadow-lg border border-zinc-800">
                  <input 
                    type="text" 
                    value={draftName} 
                    onChange={e => setDraftName(e.target.value)}
                    className="bg-zinc-900 text-white rounded-lg px-3 py-1.5 outline-none border border-zinc-700 w-40 text-sm font-bold"
                    autoFocus
                    onKeyDown={e => e.key === 'Enter' && handleSave()}
                  />
                  <Button variant="primary" size="sm" onClick={handleSave}>Yadda Saxla</Button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setIsEditing(true)} 
                    className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-500 bg-amber-500/10 hover:bg-amber-500/20 px-3 py-1.5 rounded-lg transition-colors border border-amber-500/30"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    Adı Dəyiş
                  </button>
                </div>
              )}
          </div>

          <div className="mt-8">
            {userId ? (
              <PlayerProfileCard userId={userId} username={currentUsername} />
            ) : (
              <div className="text-center text-zinc-500 py-10">Profil məlumatları tapılmadı.</div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
};
