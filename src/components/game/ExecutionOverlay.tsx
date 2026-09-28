import React, { useEffect, useState } from 'react';
import { Gavel, Skull } from 'lucide-react';
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
    if (lynchedPlayerName && lynchedPlayerName !== currentPlayer) {
      setCurrentPlayer(lynchedPlayerName);
      setShow(true);
      playElimination();
    }
  }, [lynchedPlayerName, currentPlayer]);

  useEffect(() => {
    if (show) {
      const timer = setTimeout(() => setShow(false), 5000); // Wait 5 seconds
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
          className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none"
        >
          {/* Bloody Backdrop Background */}
          <motion.div 
            initial={{ scale: 1.1, opacity: 0 }}
            animate={{ scale: 1, opacity: 1, transition: { duration: 0.8, ease: "easeOut" } }}
            className="absolute inset-0 bg-gradient-to-t from-red-950 via-red-900/80 to-transparent"
          />

          <motion.div
            initial={{ y: 50, scale: 0.9, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1, transition: { type: 'spring', damping: 20, stiffness: 100 } }}
            exit={{ y: 20, opacity: 0 }}
            className="relative bg-zinc-950/80 backdrop-blur-md p-10 border-t border-b border-red-600/50 shadow-2xl flex flex-col items-center justify-center w-full shadow-red-900/50"
          >
            <motion.div 
              initial={{ rotate: -20, scale: 0 }}
              animate={{ rotate: 0, scale: 1, transition: { type: 'spring', delay: 0.3 } }}
              className="bg-red-900/40 p-4 rounded-full mb-4 shadow-[0_0_50px_rgba(220,38,38,0.3)]"
            >
              <Gavel className="w-16 h-16 text-red-500" />
            </motion.div>
            
            <h2 className="text-xl font-bold text-red-400/80 uppercase tracking-[0.3em] mb-2">Şəhərin Qərarı</h2>
            <h1 className="text-5xl md:text-7xl font-black text-white drop-shadow-[0_4px_4px_rgba(0,0,0,0.5)] mb-4 text-center">
              {currentPlayer} <span className="text-red-500">ASILDI</span>
            </h1>

            {lynchedRole && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0, transition: { delay: 1.5, duration: 1 } }}
                className="mt-6 flex flex-col items-center bg-black/40 px-6 py-4 rounded-2xl border border-red-500/20"
              >
                <div className="text-sm font-bold text-zinc-400 uppercase tracking-widest mb-1 flex items-center gap-2">
                  <Skull className="w-4 h-4"/>
                  Əsl Rolu Məlum Oldu
                </div>
                <div className="text-2xl font-black text-red-400">
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
