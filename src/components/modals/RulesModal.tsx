'use client';

import React, { useState } from 'react';
import { X, Book, Shield, Crosshair, Eye, Ban, Ghost, Scale, Skull, Moon, Sun, ScrollText } from 'lucide-react';
import { Button } from '../ui/Button';

interface RulesModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
}

export const RulesModal: React.FC<RulesModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'rules' | 'roles'>('rules');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-zinc-950/90 p-4 sm:p-6 animate-fadeIn">
      <div className="w-full max-w-3xl bg-zinc-900 border border-zinc-700/50 rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
        
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
        <div className="flex px-4 pt-4 border-b border-zinc-800 bg-zinc-950/50 gap-4">
          <button
            onClick={() => setActiveTab('rules')}
            className={`pb-3 px-2 text-sm font-bold uppercase tracking-wider transition-colors border-b-2 ${
              activeTab === 'rules' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <div className="flex items-center gap-2">
              <Scale className="w-4 h-4" /> Ümumi Qaydalar
            </div>
          </button>
          <button
            onClick={() => setActiveTab('roles')}
            className={`pb-3 px-2 text-sm font-bold uppercase tracking-wider transition-colors border-b-2 ${
              activeTab === 'roles' ? 'border-amber-500 text-amber-400' : 'border-transparent text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <div className="flex items-center gap-2">
              <ScrollText className="w-4 h-4" /> Rollar ensiklopediyası
            </div>
          </button>
        </div>
        
        {/* Content */}
        <div className="p-6 overflow-y-auto custom-scrollbar flex-1 flex flex-col gap-6 text-zinc-300">
          
          {activeTab === 'rules' && (
            <div className="space-y-6 animate-fadeIn">
              <p className="text-sm font-medium leading-relaxed opacity-90">
                <strong className="text-white">TDV Mafia</strong> - klassik mafiya oyununun genişləndirilmiş və avtomatlaşdırılmış versiyasıdır. 
                Oyunda məqsəd sadədir: Şəhərlilər mafiyanı tapıb edam etməli, Mafiya isə şəhərliləri gizlicə öldürüb çoxluğu ələ keçirməlidir.
              </p>
              
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="bg-zinc-950/50 border border-zinc-800 rounded-xl p-4">
                  <div className="flex items-center gap-2 text-blue-400 mb-2">
                    <Sun className="w-5 h-5" />
                    <h3 className="font-bold">Gündüz Fazası</h3>
                  </div>
                  <p className="text-xs leading-relaxed text-zinc-400">
                    Bütün sağ qalan oyunçular sərbəst müzakirə aparır, bir-birlərini ittiham edir və günahkarları axtarırlar. Müzakirə bitdikdən sonra səsvermə (məhkəmə) başlayır.
                  </p>
                </div>
                
                <div className="bg-zinc-950/50 border border-zinc-800 rounded-xl p-4">
                  <div className="flex items-center gap-2 text-indigo-400 mb-2">
                    <Moon className="w-5 h-5" />
                    <h3 className="font-bold">Gecə Fazası</h3>
                  </div>
                  <p className="text-xs leading-relaxed text-zinc-400">
                    Gecə hər kəs yatır, lakin xüsusi gücü olan rollar gizlicə fəaliyyət göstərir (qatillər öldürür, həkimlər qoruyur, şeriflər yoxlayır). Bütün gecə hərəkətləri gizli saxlanılır.
                  </p>
                </div>
              </div>

              <div className="bg-zinc-800/30 border border-zinc-700/50 rounded-xl p-4 mt-2">
                <div className="flex items-center gap-2 text-rose-400 mb-2">
                  <Skull className="w-5 h-5" />
                  <h3 className="font-bold">Ölüm və Son Vəsiyyət</h3>
                </div>
                <p className="text-xs leading-relaxed text-zinc-400">
                  Əgər siz gecə qətlə yetirilsəniz və ya gündüz səsvermə ilə edam edilsəniz, oyundan çıxırsınız. Amma ölmədən əvvəl yazdığınız <strong>Son Vəsiyyət</strong> (📝) səhər qəzetində bütün şəhərə oxunacaq. Ölülər qəbiristanlıq çatında danışa bilər, amma dirilər onları görmür.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'roles' && (
            <div className="grid gap-4 animate-fadeIn">
              <div className="flex items-start gap-4 p-4 rounded-xl bg-red-950/20 border border-red-900/30">
                <Crosshair className="w-6 h-6 text-red-500 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-red-400 font-bold mb-1">Mafiya Qatili</h3>
                  <p className="text-xs">Gecələr bir nəfəri seçib öldürür. Digər mafiya üzvləri ilə birlikdə ortaq qərar verməlidir. Məqsədi şəhərdə çoxluğu ələ keçirməkdir.</p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 rounded-xl bg-red-950/20 border border-red-900/30">
                <Ghost className="w-6 h-6 text-red-500 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-red-400 font-bold mb-1">Şər Atan (Framer)</h3>
                  <p className="text-xs">Mafiyanın hiyləgər üzvüdür. Gecələr bir vətəndaşı seçib ona "şər atır". Əgər Şərif həmin gecə o adamı yoxlasa, onu təmiz vətəndaş yox, mafiya kimi görəcək.</p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 rounded-xl bg-emerald-950/20 border border-emerald-900/30">
                <Eye className="w-6 h-6 text-emerald-500 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-emerald-400 font-bold mb-1">Şərif (İnvestigator)</h3>
                  <p className="text-xs">Şəhərin qoruyucusu. Gecələr bir nəfəri seçərək onun gizli kimliyini yoxlayır və Məsum yoxsa Qatil olduğunu öyrənir.</p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 rounded-xl bg-emerald-950/20 border border-emerald-900/30">
                <Shield className="w-6 h-6 text-emerald-500 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-emerald-400 font-bold mb-1">Həkim (Doctor)</h3>
                  <p className="text-xs">Gecələr bir nəfəri hədəf seçib onu qətllərdən qoruyur (mühafizə edir). Özünü ardıcıl qoruya bilməz.</p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 rounded-xl bg-emerald-950/20 border border-emerald-900/30">
                <Ban className="w-6 h-6 text-emerald-500 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-emerald-400 font-bold mb-1">Gözbağlayıcı (Blocker/Escort)</h3>
                  <p className="text-xs">Gecələr bir nəfəri ziyarət edərək onun fəaliyyətini bloklayır. Bloklanan şəxs heç bir əməliyyat (qətl, qoruma, yoxlama) həyata keçirə bilməz.</p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 rounded-xl bg-purple-950/20 border border-purple-900/30">
                <Ghost className="w-6 h-6 text-purple-500 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-purple-400 font-bold mb-1">Dəli (Jester)</h3>
                  <p className="text-xs">Neytral, psixopat rol. Tək bir məqsədi var: Səhər məhkəmədə səsvermə ilə YANDIRILMAQ! Əgər şəhər onu edam edərsə, Dəli təkbaşına oyunu qazanır və digərləri uduzur.</p>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};