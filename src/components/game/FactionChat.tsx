import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, Send, X, Users, Loader2 } from 'lucide-react';
import { ChatMessage } from '../../types/game';
import { playMessagePing } from '../../utils/sfx';

interface FactionChatProps {
  readonly currentUserId: string;
  readonly currentUsername: string;
  readonly faction: string; // 'MAFIA' | 'YAKUZA' | etc.
  readonly lobbyId: string;
  readonly factionMates: ReadonlyArray<{ userId: string; username: string }>;
  readonly phase: string;
  readonly messages: ChatMessage[];
  readonly onSendMessage: (content: string) => void;
}

export const FactionChat: React.FC<FactionChatProps> = ({
  currentUserId,
  currentUsername,
  faction,
  lobbyId,
  factionMates,
  phase,
  messages,
  onSendMessage,
}) => {
  const [input, setInput] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [hasNewMessage, setHasNewMessage] = useState(false);
  const [prevMsgCount, setPrevMsgCount] = useState(messages.length);
  const [isTyping, setIsTyping] = useState(false);
  const [typistName, setTypistName] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messages.length > prevMsgCount) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg && lastMsg.senderId !== currentUserId) {
        playMessagePing();
        if (!isOpen) setHasNewMessage(true);
      }
      setPrevMsgCount(messages.length);
    }
  }, [messages, prevMsgCount, isOpen, currentUserId]);

  useEffect(() => {
    if (isOpen) {
      setHasNewMessage(false);
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [isOpen, messages.length]);

  // Simulate teammates typing periodically for immersion
  useEffect(() => {
    if (!isOpen || factionMates.length === 0 || !phase.includes('NIGHT')) return;
    
    const interval = setInterval(() => {
      // 15% chance to start "typing" every 3 seconds
      if (Math.random() < 0.15 && !isTyping) {
        const randomMate = factionMates[Math.floor(Math.random() * factionMates.length)];
        if (randomMate) {
          setTypistName(randomMate.username);
          setIsTyping(true);
          
          // Stop typing after 2-4 seconds
          setTimeout(() => {
            setIsTyping(false);
          }, 2000 + Math.random() * 2000);
        }
      }
    }, 3000);
    
    return () => clearInterval(interval);
  }, [isOpen, factionMates, phase, isTyping]);

  const sendMessage = () => {
    const txt = input.trim();
    if (!txt) return;

    let finalTxt = txt;
    if (txt === '/roll') finalTxt = `🎲 zər atdı: ${Math.floor(Math.random() * 6) + 1}`;
    if (txt === '/flip') finalTxt = `🪙 qəpik atdı: ${Math.random() > 0.5 ? 'Xət (Heads)' : 'Yazı (Tails)'}`;

    onSendMessage(finalTxt);
    setInput('');
  };

  const factionLabel = faction === 'MAFIA' ? 'Mafiya' : faction === 'YAKUZA' ? 'Yakuza' : 'Klan';
  const factionColor =
    faction === 'MAFIA'
      ? 'from-red-900/95 to-red-950/95 border-red-700/60 ring-red-500/30'
      : faction === 'YAKUZA'
      ? 'from-purple-900/95 to-purple-950/95 border-purple-700/60 ring-purple-500/30'
      : 'from-zinc-900/95 to-zinc-950/95 border-zinc-700/60 ring-zinc-500/30';
  const accentColor =
    faction === 'MAFIA' ? 'text-red-400' : faction === 'YAKUZA' ? 'text-purple-400' : 'text-zinc-400';
  const btnColor =
    faction === 'MAFIA'
      ? 'bg-red-600 hover:bg-red-500 ring-red-500/30'
      : faction === 'YAKUZA'
      ? 'bg-purple-600 hover:bg-purple-500 ring-purple-500/30'
      : 'bg-zinc-600 hover:bg-zinc-500 ring-zinc-500/30';

  const isNightPhase = phase.includes('NIGHT');

  return (
    <div className="fixed bottom-6 right-24 z-40 flex flex-col items-end gap-3">
      {isOpen && (
        <div
          className={`w-80 sm:w-96 rounded-2xl border bg-gradient-to-b ${factionColor} ring-1 shadow-2xl flex flex-col overflow-hidden animate-slideUp`}
        >
          <div className={`px-4 py-3 flex items-center justify-between border-b border-white/10`}>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isNightPhase ? 'bg-red-500 animate-pulse' : 'bg-zinc-500'}`}></div>
              <span className={`text-sm font-black tracking-wider uppercase ${accentColor}`}>
                {factionLabel} Şifrəli Kanal
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 text-xs text-zinc-500">
                <Users className="w-3 h-3" />
                {factionMates.length + 1}
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 rounded hover:bg-white/10 text-zinc-400 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="flex-1 p-4 overflow-y-auto custom-scrollbar flex flex-col gap-3 min-h-[200px] max-h-[300px]">
            {messages.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center opacity-50">
                <MessageSquare className="w-8 h-8 mb-2 opacity-50" />
                <p className="text-xs uppercase tracking-wider font-bold">Heç bir mesaj yoxdur</p>
                <p className="text-[10px] mt-1">/roll və /flip komandalarını sınayın</p>
              </div>
            ) : (
              messages.map((msg, i) => {
                const isMe = msg.senderId === currentUserId;
                return (
                  <div key={i} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} animate-fadeIn`}>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-0.5">
                      {isMe ? 'Siz' : msg.senderName}
                    </span>
                    <div
                      className={`px-3 py-2 rounded-xl text-sm leading-relaxed max-w-[85%] ${
                        isMe
                          ? `bg-white/10 text-white rounded-tr-sm`
                          : `bg-black/40 text-zinc-200 rounded-tl-sm`
                      }`}
                    >
                      {msg.content}
                    </div>
                  </div>
                );
              })
            )}
            
            {/* Fake typing indicator loop for immersion */}
            {isTyping && factionMates.length > 0 && isNightPhase && (
               <div className="flex flex-col items-start animate-fadeIn opacity-70">
                 <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-0.5">
                   {typistName || 'Müttəfiq'} yazır...
                 </span>
                 <div className="px-3 py-2 rounded-xl bg-black/40 text-zinc-200 rounded-tl-sm flex items-center gap-1">
                   <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style={{animationDelay: '0ms'}}></span>
                   <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style={{animationDelay: '150ms'}}></span>
                   <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style={{animationDelay: '300ms'}}></span>
                 </div>
               </div>
            )}
            
            <div ref={bottomRef} />
          </div>
          <div className="p-3 border-t border-white/10 bg-black/20">
            <div className="flex items-center gap-2 relative">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                placeholder="Mesaj yazın... (Gecə vaxtı)"
                disabled={!isNightPhase}
                maxLength={200}
                className="flex-1 bg-black/40 border border-white/10 rounded-lg pl-3 pr-10 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-white/20 transition-all disabled:opacity-50"
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || !isNightPhase}
                className={`absolute right-1.5 p-1.5 rounded-md ${btnColor} text-white transition-all disabled:opacity-50 disabled:active:scale-100 active:scale-95`}
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          title="Mafiya Çatı"
          className={`relative p-3 rounded-full bg-red-900/90 hover:bg-red-800 text-red-100 shadow-[0_0_20px_rgba(153,27,27,0.5)] border border-red-500/30 transition-transform hover:scale-110 active:scale-95`}
        >
          {hasNewMessage && (
            <span className="absolute top-0 right-0 w-3 h-3 bg-red-500 border-2 border-red-900 rounded-full animate-ping" />
          )}
          <MessageSquare className="w-5 h-5" />
        </button>
      )}
    </div>
  );
};
