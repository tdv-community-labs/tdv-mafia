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
                <h2 className="text-xl font-black text-white uppercase tracking-wider">Məlumat Kitabçası</h2>
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
                    <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2"><Sun className="w-5 h-5 text-amber-500"/> Gündüz Fazası</h3>
                    <p className="text-sm leading-relaxed mb-2">Gündüz vaxtı bütün sağ qalan oyunçular sərbəst şəkildə müzakirə apara bilərlər. Şübhələndiyiniz şəxsləri ifşa etmək üçün məntiqdən istifadə edin.</p>
                    <ul className="list-disc pl-5 text-sm space-y-1">
                      <li>Səsvermə vaxtı ən çox səs toplayan şəxs <strong className="text-red-400">edam edilir</strong>.</li>
                      <li>Qərar vermədiyiniz təqdirdə, səsvermə yekunlaşır və heç kim asılmır.</li>
                    </ul>
                  </section>

                  <section>
                    <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2"><Moon className="w-5 h-5 text-blue-400"/> Gecə Fazası</h3>
                    <p className="text-sm leading-relaxed mb-2">Gecə vaxtı qatillər (Mafiya, Manyak) kimsəsizləri ovlayır. Xüsusi rollara malik olan Vətəndaşlar (Şərif, Həkim) isə şəhəri qorumaq üçün hərəkətə keçir.</p>
                    <ul className="list-disc pl-5 text-sm space-y-1">
                      <li>Gecə yalnız xüsusi rollar (aktivlər) hərəkət edə bilər.</li>
                      <li>Mafiya üzvləri öz aralarında gizli <strong className="text-red-400">Mafiya Çatında</strong> danışa və strategiya qura bilərlər.</li>
                    </ul>
                  </section>

                  <section>
                    <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2"><Ghost className="w-5 h-5 text-zinc-400"/> Öldükdən Sonra (Xəyalət)</h3>
                    <p className="text-sm leading-relaxed mb-2">Öldükdən sonra oyundan kənarda qalırsınız, lakin digər ölü oyunçularla birlikdə <strong className="text-zinc-200">Gizli Xəyalət Çatında</strong> söhbət edə bilərsiniz. Canlılar sizi eşidə bilməz.</p>
                  </section>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Town */}
                  <div className="bg-emerald-950/20 border border-emerald-900/30 p-4 rounded-xl">
                    <h3 className="text-emerald-500 font-bold mb-3 flex items-center gap-2"><Shield className="w-4 h-4"/> Vətəndaşlar (Town)</h3>
                    <div className="space-y-3">
                      <div>
                        <div className="font-bold text-zinc-200 text-sm">Həkim (Müdafiəçi)</div>
                        <div className="text-xs text-zinc-400">Hər gecə bir nəfəri ölümcül zərbədən xilas edir.</div>
                      </div>
                      <div>
                        <div className="font-bold text-zinc-200 text-sm">Şərif (Təhqiqatçı)</div>
                        <div className="text-xs text-zinc-400">Hər gecə bir nəfərin əsl kimliyini (Vətəndaş və ya Mafiya) öyrənir.</div>
                      </div>
                      <div>
                        <div className="font-bold text-zinc-200 text-sm">Eskort (Gözbağlayıcı)</div>
                        <div className="text-xs text-zinc-400">Hər gecə bir nəfərin diqqətini yayındıraraq onun fəaliyyətini bloklayır.</div>
                      </div>
                    </div>
                  </div>

                  {/* Mafia */}
                  <div className="bg-rose-950/20 border border-rose-900/30 p-4 rounded-xl">
                    <h3 className="text-rose-500 font-bold mb-3 flex items-center gap-2"><Crosshair className="w-4 h-4"/> Mafiya Sindikatı</h3>
                    <div className="space-y-3">
                      <div>
                        <div className="font-bold text-zinc-200 text-sm">Don (Xaçatası)</div>
                        <div className="text-xs text-zinc-400">Mafiyanın lideridir. Şərif onu yoxlasa belə "Vətəndaş" olaraq görünür.</div>
                      </div>
                      <div>
                        <div className="font-bold text-zinc-200 text-sm">Qatil (Mafioso)</div>
                        <div className="text-xs text-zinc-400">Donun göstərişlərini yerinə yetirən icraçıdır.</div>
                      </div>
                      <div>
                        <div className="font-bold text-zinc-200 text-sm">Müşavir (Consigliere)</div>
                        <div className="text-xs text-zinc-400">Seçdiyi hədəfin dəqiq olaraq hansı rolda olduğunu öyrənir (məs: Həkim, Təlxək).</div>
                      </div>
                    </div>
                  </div>

                  {/* Neutral */}
                  <div className="bg-purple-950/20 border border-purple-900/30 p-4 rounded-xl md:col-span-2">
                    <h3 className="text-purple-400 font-bold mb-3 flex items-center gap-2"><Skull className="w-4 h-4"/> Neytrallar (Bitərəf)</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <div className="font-bold text-zinc-200 text-sm">Manyak (Serial Killer)</div>
                        <div className="text-xs text-zinc-400">Hər kəsə qarşıdır. Hər gecə birini öldürür. Tək qalarsa qazanır.</div>
                      </div>
                      <div>
                        <div className="font-bold text-zinc-200 text-sm">Təlxək (Jester)</div>
                        <div className="text-xs text-zinc-400">Qələbə qazanmaq üçün məhkəmədə özünü asdırmalıdır. Asılarsa, onu asanlardan birinə lənət atır!</div>
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