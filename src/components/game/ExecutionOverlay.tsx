import React, { useEffect, useState } from 'react';
import { Gavel, Skull, Droplet } from 'lucide-react';
import { playElimination } from '../../utils/sfx';
import { motion, AnimatePresence } from 'framer-motion';

interface ExecutionOverlayProps {
  lynchedPlayerName: string | null;
  lynchedRole?: string | null;
}

const ExecutionOverlayComponent: React.FC<ExecutionOverlayProps> = ({ lynchedPlayerName, lynchedRole }) => {
  const [show, setShow] = useState(false);
  const [currentPlayer, setCurrentPlayer] = useState<string | null>(null);

  useEffect(() => {
    if (!lynchedPlayerName) {
      setCurrentPlayer(null);
      setShow(false);
      return;
    }
    if (lynchedPlayerName && lynchedPlayerName !== currentPlayer) {
      setCurrentPlayer(lynchedPlayerName);
      setShow(true);
      playElimination();
    }
  }, [lynchedPlayerName, currentPlayer]);

  useEffect(() => {
    if (show) {
      const timer = setTimeout(() => setShow(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [show]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 1 } }}
          className="fixed inset-0 z-[200] flex items-center justify-center pointer-events-none overflow-hidden bg-black/90 backdrop-blur-sm"
        >
          {/* GUILLOTINE BLADE DROP */}
          <motion.div 
            initial={{ y: '-100vh', rotate: -5 }}
            animate={{ y: '20vh', rotate: 0 }}
            transition={{ type: 'spring', damping: 10, stiffness: 50, delay: 0.5 }}
            className="absolute top-0 w-[120vw] h-[80vh] bg-gradient-to-b from-zinc-800 to-zinc-300 shadow-[0_20px_50px_rgba(0,0,0,0.8)] border-b-8 border-zinc-200 z-10 flex items-end justify-center"
            style={{ clipPath: 'polygon(0 0, 100% 0, 100% 80%, 0 100%)' }}
          >
            {/* Blood Splash on Blade */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
              className="w-full h-32 bg-gradient-to-t from-red-700/80 to-transparent"
            />
          </motion.div>
          
          {/* Blood Splatter on Screen */}
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: [0, 1.5, 1], opacity: [0, 1, 0] }}
            transition={{ delay: 0.7, duration: 1.5 }}
            className="absolute inset-0 z-20 flex items-center justify-center"
          >
             <div className="w-[80vw] h-[80vh] bg-[radial-gradient(ellipse_at_center,_rgba(220,38,38,0.8)_0%,_transparent_70%)] blur-2xl rounded-full" />
          </motion.div>

          <motion.div
            initial={{ y: 50, scale: 0.9, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1, transition: { type: 'spring', damping: 20, stiffness: 100, delay: 1 } }}
            exit={{ y: 20, opacity: 0 }}
            className="relative z-30 bg-zinc-950/80 backdrop-blur-md p-10 border-t border-b border-red-600/50 shadow-2xl flex flex-col items-center justify-center w-full shadow-red-900/50"
          >
            <motion.div 
              initial={{ rotate: -20, scale: 0 }}
              animate={{ rotate: 0, scale: 1, transition: { type: 'spring', delay: 1.2 } }}
              className="bg-red-900/40 p-4 rounded-full mb-4 shadow-[0_0_50px_rgba(220,38,38,0.3)] border border-red-500/50"
            >
              <Gavel className="w-16 h-16 text-red-500" />
            </motion.div>
            
            <h2 className="text-xl font-bold text-red-400/80 uppercase tracking-[0.3em] mb-2 font-serif">MƏHKƏMƏ QƏRARI</h2>
            <h1 className="text-5xl md:text-7xl font-black text-white drop-shadow-[0_4px_4px_rgba(0,0,0,0.5)] mb-4 text-center font-serif">
              {currentPlayer} <span className="text-red-500 bg-red-950/50 px-4 py-1 rounded border border-red-500/30">EDAM EDİLDİ</span>
            </h1>

            {lynchedRole && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0, transition: { delay: 2, duration: 1 } }}
                className="mt-6 flex flex-col items-center bg-black/60 px-8 py-5 rounded-2xl border border-red-500/40"
              >
                <div className="text-sm font-bold text-zinc-400 uppercase tracking-widest mb-1 flex items-center gap-2">
                  <Skull className="w-5 h-5 text-red-400"/>
                  Gerçək Rolu Məlum Oldu
                </div>
                <div className="text-3xl font-black text-red-400 font-mono tracking-wider drop-shadow-lg">
                  {lynchedRole}
                </div>
              </motion.div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export const ExecutionOverlay = React.memo(ExecutionOverlayComponent);
