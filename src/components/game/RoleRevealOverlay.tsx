import React, { useEffect, useState } from 'react';
import { CoreFaction, FormattedRoleDisplay } from '../../types/roles';
import { Target, Shield, Heart, Skull, Search, Ghost, Swords, EyeOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface RoleRevealOverlayProps {
  readonly displayRole?: FormattedRoleDisplay;
  readonly faction?: CoreFaction;
  readonly phase: string;
  readonly roundNumber: number;
}

export const RoleRevealOverlay = React.memo(({ displayRole, faction, phase, roundNumber }: RoleRevealOverlayProps) => {
  const [show, setShow] = useState(false);
  const [isRendered, setIsRendered] = useState(false);

  useEffect(() => {
    // Only reveal when the first round starts
    if (roundNumber === 1 && (phase === 'NIGHT_BUFFER' || phase === 'DAY_REGIONAL_CAUCUS')) {
      setIsRendered(true);
      setShow(true);
      const t = setTimeout(() => setShow(false), 5000); // 5 seconds dramatic reveal
      return () => clearTimeout(t);
    }
  }, [phase, roundNumber]);

  if (!isRendered) return null;

  const roleName = displayRole?.localizedRoleName || displayRole?.originalRoleName || 'Vətəndaş';
  const roleNameLower = roleName.toLowerCase();
  
  let Icon = Shield;
  let factionName = 'Şəhərli';
  let gradientClass = 'from-emerald-950 via-zinc-950 to-emerald-950';
  let textClass = 'text-emerald-500';
  let desc = 'Sənin vəzifən şəhəri qorumaq və günahkarları tapıb asmaqdır.';

  if (faction === 'MAFIA' || faction === 'YAKUZA') {
    Icon = Target;
    factionName = 'Mafiya';
    gradientClass = 'from-red-950 via-zinc-950 to-red-950';
    textClass = 'text-red-500';
    desc = 'Sənin vəzifən gizli qalmaq və hər gecə birini aradan götürməkdir.';
  } else if (faction === 'NEUTRAL_KILLER') {
    Icon = Skull;
    factionName = 'Təkbaşına Qatil';
    gradientClass = 'from-purple-950 via-zinc-950 to-purple-950';
    textClass = 'text-purple-500';
    desc = 'Sənin dostun yoxdur. Hər kəsi öldür və tək sağ qal.';
  } else if (faction === 'NEUTRAL_EVIL') {
    Icon = Ghost;
    factionName = 'Neytral Pis';
    gradientClass = 'from-fuchsia-950 via-zinc-950 to-fuchsia-950';
    textClass = 'text-fuchsia-500';
    desc = 'Kaos yarat. Məqsədinə çatmaq üçün hər yola əl at.';
  }

  // Specific role overrides
  if (roleNameLower.includes('həkim')) Icon = Heart;
  else if (roleNameLower.includes('şərif')) Icon = Search;
  else if (roleNameLower.includes('gözbağlayıcı')) Icon = EyeOff;
  else if (roleNameLower.includes('qatil')) Icon = Swords;

  return (
    <div
      className={`fixed inset-0 z-[150] pointer-events-none flex flex-col items-center justify-center bg-gradient-to-br ${gradientClass} transition-opacity duration-700 ease-in-out backdrop-blur-2xl`}
      style={{ opacity: show ? 1 : 0 }}
      onTransitionEnd={() => !show && setIsRendered(false)}
    >
      <div className="flex flex-col items-center animate-[roleReveal_2s_ease-out_forwards]">
        <div className="relative mb-8">
          <div className={`absolute inset-0 bg-current opacity-20 blur-3xl rounded-full ${textClass}`} />
          <Icon className={`w-32 h-32 ${textClass} drop-shadow-[0_0_40px_currentColor]`} strokeWidth={1} />
        </div>
        
        <div className="text-center space-y-4 max-w-2xl px-6">
          <p className="text-zinc-400 font-bold uppercase tracking-[0.5em] text-sm">
            Sənin Rolun
          </p>
          <h1 className={`text-6xl sm:text-8xl font-black uppercase tracking-widest ${textClass} drop-shadow-2xl`}>
            {roleName}
          </h1>
          <div className={`inline-block px-4 py-1.5 rounded-full border-2 ${textClass.replace('text-', 'border-')}/50 bg-black/40 backdrop-blur-sm mt-4`}>
            <span className={`text-sm font-black uppercase tracking-widest ${textClass}`}>
              Fraksiya: {factionName}
            </span>
          </div>
          <p className="text-zinc-300 font-medium tracking-wide text-lg sm:text-xl mt-8 opacity-90 leading-relaxed">
            {desc}
          </p>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes roleReveal {
          0% { transform: scale(0.5) translateY(50px); opacity: 0; filter: blur(20px) contrast(200%); }
          40% { transform: scale(1.05) translateY(-10px); opacity: 1; filter: blur(0px) contrast(100%); }
          60% { transform: scale(0.98) translateY(5px); }
          100% { transform: scale(1) translateY(0); opacity: 1; }
        }
      `}} />
    </div>
  );
});
