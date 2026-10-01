'use client';

import React from 'react';
import { motion } from 'framer-motion';

export const SynthwaveGrid: React.FC = () => {
  return (
    <div className="fixed inset-0 z-[-1] pointer-events-none overflow-hidden bg-black">
      <div 
        className="absolute inset-0" 
        style={{
          backgroundImage: 'linear-gradient(transparent 95%, rgba(139, 92, 246, 0.4) 100%), linear-gradient(90deg, transparent 95%, rgba(139, 92, 246, 0.4) 100%)',
          backgroundSize: '40px 40px',
          transform: 'perspective(500px) rotateX(60deg) translateY(100px) translateZ(-200px)',
          animation: 'gridMove 10s linear infinite'
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-transparent via-black to-black opacity-80" />
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes gridMove {
          0% { background-position: 0 0; }
          100% { background-position: 0 40px; }
        }
      `}} />
    </div>
  );
};
