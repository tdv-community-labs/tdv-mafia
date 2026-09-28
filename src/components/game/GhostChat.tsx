import React, { useState, useEffect, useRef } from 'react';
import { Ghost, Send, X, Users, Skull } from 'lucide-react';
import { ChatMessage } from '../../types/game';

interface GhostChatProps {
  readonly currentUserId: string;
  readonly currentUsername: string;
  readonly isAlive: boolean;
  readonly lobbyId: string;
  readonly deadPlayerNames: ReadonlyArray<{ userId: string; username: string }>;
  readonly phase: string;
  readonly messages: ChatMessage[];
  readonly onSendMessage: (content: string) => void;
}

export const GhostChat: React.FC<GhostChatProps> = ({
  currentUserId,
  currentUsername,
  isAlive,
  lobbyId,
  deadPlayerNames,
  phase,
  messages,
  onSendMessage,
}) => {
  const [input, setInput] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [hasNewMessage, setHasNewMessage] = useState(false);
  const [prevMsgCount, setPrevMsgCount] = useState(messages.length);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messages.length > prevMsgCount) {
      if (!isOpen) setHasNewMessage(true);
      setPrevMsgCount(messages.length);
    }
  }, [messages.length, prevMsgCount, isOpen]);

  useEffect(() => {
    if (isOpen) {
      setHasNewMessage(false);
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [isOpen, messages.length]);

  const sendMessage = () => {
    const txt = input.trim();
    if (!txt || isAlive) return;

    let finalTxt = txt;
    if (txt === '/roll') finalTxt = `🎲 zər atdı: ${Math.floor(Math.random() * 6) + 1}`;
    if (txt === '/flip') finalTxt = `🪙 qəpik atdı: ${Math.random() > 0.5 ? 'Xət (Heads)' : 'Yazı (Tails)'}`;

    onSendMessage(finalTxt);
    setInput('');
  };

  return (
    <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-3">
      {isOpen && (
        <div className="w-80 sm:w-96 rounded-2xl border bg-gradient-to-b from-zinc-900/95 to-zinc-950/95 border-zinc-700/60 ring-1 ring-zinc-500/30 shadow-2xl flex flex-col overflow-hidden animate-slideUp">
          <div className="px-4 py-3 flex items-center justify-between border-b border-white/10">
            <div className="flex items-center gap-2">
              <Ghost className="w-4 h-4 text-zinc-400" />
              <span className="text-sm font-black tracking-wider uppercase text-zinc-400">
                Xəyalət Çatı
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 text-xs text-zinc-500">
                <Skull className="w-3 h-3" />
                {deadPlayerNames.length}
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
                <Ghost className="w-8 h-8 mb-2 opacity-30" />
                <p className="text-xs uppercase tracking-wider font-bold">Burada hələ kimsə yoxdur</p>
                <p className="text-[10px] mt-1">Sakitlikdir...</p>
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
                          ? 'bg-zinc-700/50 text-zinc-200 rounded-tr-sm'
                          : 'bg-black/40 text-zinc-400 rounded-tl-sm'
                      }`}
                    >
                      {msg.content}
                    </div>
                  </div>
                );
              })
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
                placeholder={isAlive ? "Canlılar buraya yaza bilməz" : "Mesaj yazın..."}
                disabled={isAlive}
                maxLength={200}
                className="flex-1 bg-black/40 border border-white/10 rounded-lg pl-3 pr-10 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-500 transition-all disabled:opacity-50"
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || isAlive}
                className="absolute right-1.5 p-1.5 rounded-md bg-zinc-700 hover:bg-zinc-600 ring-zinc-500/30 text-white transition-all disabled:opacity-50 disabled:active:scale-100 active:scale-95"
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
          title="Xəyalət Çatı"
          className="relative p-3 rounded-full bg-zinc-900/90 hover:bg-zinc-800 text-zinc-300 shadow-[0_0_20px_rgba(39,39,42,0.5)] border border-zinc-500/30 transition-transform hover:scale-110 active:scale-95"
        >
          {hasNewMessage && (
            <span className="absolute top-0 right-0 w-3 h-3 bg-zinc-400 border-2 border-zinc-900 rounded-full animate-pulse" />
          )}
          <Ghost className="w-5 h-5" />
        </button>
      )}
    </div>
  );
};
