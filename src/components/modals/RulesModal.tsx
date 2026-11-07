'use client';

import React, { useState } from 'react';
import { X, Book, Shield, Crosshair, Eye, Ban, Ghost, Scale, Skull, Moon, Sun, ScrollText } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '../ui/Button';

interface RulesModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
}

export const RulesModal: React.FC<RulesModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'rules' | 'roles'>('rules');

  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-zinc-950/90 p-4 sm:p-6">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0, transition: { type: 'spring', damping: 25, stiffness: 300 } }}
            exit={{ opacity: 0, scale: 0.95, y: -20, transition: { duration: 0.2 } }}
            className="w-full max-w-3xl bg-zinc-900 border border-zinc-700/50 rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]"
          >
            {/* Header */}
            <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-950">
              <div className="flex items-center gap-3">
                <Book className="w-6 h-6 text-indigo-500" />
                <h2 className="text-xl font-black text-white uppercase tracking-wider">Rulebook & Codex</h2>
              </div>
              <button onClick={onClose} className="p-2 rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* Tabs */}
            <div className="flex p-2 bg-zinc-950 border-b border-zinc-800">
              <button
                onClick={() => setActiveTab('rules')}
                className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors ${activeTab === 'rules' ? 'bg-indigo-500 text-white' : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'}`}
              >
                Qaydalar
              </button>
              <button
                onClick={() => setActiveTab('roles')}
                className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors ${activeTab === 'roles' ? 'bg-rose-600 text-white' : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'}`}
              >
                Rollar & Vəzifələr
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar">
              {activeTab === 'rules' ? (
                <div className="flex flex-col gap-6 text-zinc-300 space-y-2">
                  <section>
                    <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2"><Sun className="w-5 h-5 text-amber-500"/> Day Deliberation Phase</h3>
                    <p className="text-sm leading-relaxed mb-2">During daylight, all surviving players deliberate openly in the assembly. Scrutinize statements, present evidence, and deduce who among you is concealing their true allegiance.</p>
                    <ul className="list-disc pl-5 text-sm space-y-1">
                      <li>During trial voting, the accused suspect receiving the majority vote is <strong className="text-red-400">placed on the defense podium and executed</strong>.</li>
                      <li>If no majority verdict is reached, the trial concludes and no citizen is lynched.</li>
                    </ul>
                  </section>

                  <section>
                    <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2"><Moon className="w-5 h-5 text-blue-400"/> Night Operations</h3>
                    <p className="text-sm leading-relaxed mb-2">Under cover of darkness, the Mafia Syndicate and rogue killers strike their designated marks. Special Town investigative and protective operatives mobilize into action.</p>
                    <ul className="list-disc pl-5 text-sm space-y-1">
                      <li>Only players with active night abilities can submit orders.</li>
                      <li>Syndicate conspirators deliberate secretly within the encrypted <strong className="text-red-400">Mafia Night Channel</strong>.</li>
                    </ul>
                  </section>

                  <section>
                    <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2"><Ghost className="w-5 h-5 text-zinc-400"/> The Afterlife (Ghost Realm)</h3>
                    <p className="text-sm leading-relaxed mb-2">Eliminated players transcend into the spectral Ghost Realm. While living participants cannot hear your voice, you can converse freely with fellow spirits in the <strong className="text-zinc-200">Spectral Channel</strong> and wager Spirit Essence on trial outcomes.</p>
                  </section>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Town */}
                  <div className="bg-emerald-950/20 border border-emerald-900/30 p-4 rounded-xl">
                    <h3 className="text-emerald-500 font-bold mb-3 flex items-center gap-2"><Shield className="w-4 h-4"/> The Town (Innocents)</h3>
                    <div className="space-y-3">
                      <div>
                        <div className="font-bold text-zinc-200 text-sm">Doctor (City Surgeon)</div>
                        <div className="text-xs text-zinc-400">Protects one chosen player each night from lethal strikes.</div>
                      </div>
                      <div>
                        <div className="font-bold text-zinc-200 text-sm">Sheriff (Investigator)</div>
                        <div className="text-xs text-zinc-400">Interrogates one suspect each night to determine whether they belong to the Town or hostile factions.</div>
                      </div>
                      <div>
                        <div className="font-bold text-zinc-200 text-sm">Escort (Disrupter)</div>
                        <div className="text-xs text-zinc-400">Distracts and blocks one player each night, nullifying their night action.</div>
                      </div>
                    </div>
                  </div>

                  {/* Mafia */}
                  <div className="bg-rose-950/20 border border-rose-900/30 p-4 rounded-xl">
                    <h3 className="text-rose-500 font-bold mb-3 flex items-center gap-2"><Crosshair className="w-4 h-4"/> Mafia Family</h3>
                    <div className="space-y-3">
                      <div>
                        <div className="font-bold text-zinc-200 text-sm">Godfather (The Don)</div>
                        <div className="text-xs text-zinc-400">Supreme syndicate leader. Inscrutable to regular investigations, appearing innocent to the Sheriff.</div>
                      </div>
                      <div>
                        <div className="font-bold text-zinc-200 text-sm">Mafioso (Enforcer)</div>
                        <div className="text-xs text-zinc-400">Carries out the Don’s assassination directives in the midnight fog.</div>
                      </div>
                      <div>
                        <div className="font-bold text-zinc-200 text-sm">Consigliere (Advisor)</div>
                        <div className="text-xs text-zinc-400">Investigates a target to reveal their exact canonical role and abilities.</div>
                      </div>
                    </div>
                  </div>

                  {/* Neutral */}
                  <div className="bg-purple-950/20 border border-purple-900/30 p-4 rounded-xl md:col-span-2">
                    <h3 className="text-purple-400 font-bold mb-3 flex items-center gap-2"><Skull className="w-4 h-4"/> Neutral Alignments</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <div className="font-bold text-zinc-200 text-sm">Serial Killer (Neutral Killing)</div>
                        <div className="text-xs text-zinc-400">Hostile to everyone. Strikes one victim nightly and wins as sole survivor.</div>
                      </div>
                      <div>
                        <div className="font-bold text-zinc-200 text-sm">Jester (Neutral Evil)</div>
                        <div className="text-xs text-zinc-400">Wins solely by intentionally deceiving the court into executing them on the podium. If executed, claims vengeance upon one guilty voter!</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};