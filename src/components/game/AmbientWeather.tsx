'use client';

import React, { useEffect, useState } from 'react';
import { GamePhase } from '../../types/game';

interface AmbientWeatherProps {
  readonly phase: GamePhase;
}

const AmbientWeatherComponent: React.FC<AmbientWeatherProps> = ({ phase }) => {
  const isNight = phase === 'NIGHT_BUFFER';
  const isVoting = phase === 'DAY_VOTING' || phase === 'TRIAL_DEFENSE';
  const isDay = phase === 'DAY_CENTRAL_ASSEMBLY' || phase === 'DAY_REGIONAL_CAUCUS';

  const [lightning, setLightning] = useState(false);

  // Random lightning during the night
  useEffect(() => {
    if (!isNight) return;
    const triggerLightning = () => {
      setLightning(true);
      setTimeout(() => setLightning(false), 150);
      setTimeout(() => {
        setLightning(true);
        setTimeout(() => setLightning(false), 200);
      }, 300);
    };

    const interval = setInterval(() => {
      if (Math.random() > 0.7) triggerLightning();
    }, 8000);

    return () => clearInterval(interval);
  }, [isNight]);

  return (
    <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden mix-blend-screen transition-opacity duration-1000">
      {/* ─── NIGHT: FOG & LIGHTNING ─── */}
      <div className={`absolute inset-0 transition-opacity duration-[2000ms] ease-in-out ${isNight ? 'opacity-100' : 'opacity-0'}`}>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-indigo-900/20 via-transparent to-transparent opacity-30 animate-drift" />
        <div className="absolute inset-0 bg-gradient-to-t from-blue-950/20 to-transparent" />
        
        {/* Lightning Flash */}
        {lightning && (
          <div className="absolute inset-0 bg-indigo-200 mix-blend-overlay opacity-40 z-10" />
        )}
      </div>

      {/* ─── DAY: DUST MOTES & SUN RAYS ─── */}
      <div className={`absolute inset-0 transition-opacity duration-[2000ms] ease-in-out ${isDay ? 'opacity-100' : 'opacity-0'}`}>
        <div className="absolute inset-0 bg-gradient-to-tr from-amber-500/5 via-transparent to-amber-200/10 mix-blend-overlay" />
      </div>

      {/* ─── VOTING: TENSION VIGNETTE ─── */}
      <div className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${isVoting ? 'opacity-100' : 'opacity-0'}`}>
        <div className="absolute inset-0 shadow-[inset_0_0_150px_rgba(153,27,27,0.25)] pointer-events-none" />
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes drift {
          0% { transform: translateY(0) translateX(0); }
          100% { transform: translateY(-50px) translateX(20px); }
        }
        .animate-drift {
          animation: drift 20s linear infinite alternate;
        }
      `}} />
    </div>
  );
};

export const AmbientWeather = React.memo(AmbientWeatherComponent);
