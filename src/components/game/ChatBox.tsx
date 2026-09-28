'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Send, MessageSquare } from 'lucide-react';
import { playMessagePing } from '../../utils/sfx';
import { ChatMessage, ChatChannel } from '../../types/game';

interface ChatBoxProps {
  messages: ChatMessage[];
  currentUserId: string;
  onSendMessage: (content: string, channel: ChatChannel) => void;
  availableChannels: { id: ChatChannel; label: string }[];
}

export const ChatBox = React.memo(({ messages, currentUserId, onSendMessage, availableChannels }: ChatBoxProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeChannel, setActiveChannel] = useState<ChatChannel>(availableChannels[0]?.id || 'LOBBY');
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prevMessagesLengthRef = useRef(messages.length);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (messages.length > prevMessagesLengthRef.current) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg.senderId !== currentUserId) {
        playMessagePing();
        if (!isOpen) {
          setUnreadCount(prev => prev + 1);
        }
      }
    }
    prevMessagesLengthRef.current = messages.length;
  }, [messages, currentUserId, isOpen]);

  useEffect(() => {
    if (isOpen) setUnreadCount(0);
  }, [isOpen]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  // Update active channel if not available
  useEffect(() => {
    if (!availableChannels.find(c => c.id === activeChannel) && availableChannels.length > 0) {
      setActiveChannel(availableChannels[0].id);
    }
  }, [availableChannels, activeChannel]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    onSendMessage(input, activeChannel);
    setInput('');
  };

  const channelMessages = messages.filter(m => m.channel === activeChannel);

  // Floating Button
  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed top-[50%] right-0 z-40 bg-zinc-900/90 hover:bg-zinc-800 text-white p-3 rounded-l-xl shadow-[-5px_0_15px_rgba(0,0,0,0.5)] border-y border-l border-zinc-700  transition-transform flex items-center justify-center group"
      >
        <MessageSquare className="w-6 h-6 group-hover:scale-110 transition-transform" />
        {unreadCount > 0 && (
          <span className="absolute -top-2 -left-2 bg-red-500 text-white text-xs font-black w-6 h-6 rounded-full flex items-center justify-center shadow-lg border-2 border-zinc-900 animate-bounce">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
    );
  }

  return (
    <div className="fixed top-0 right-0 bottom-0 w-full sm:w-80 bg-zinc-950/95 sm:border-l border-zinc-800 z-50 flex flex-col shadow-2xl  animate-[slideInRight_0.3s_ease-out]">
      {/* Header */}
      <div className="p-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50">
        <h3 className="font-bold text-white flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-blue-400" />
          Gizli Söhbət
        </h3>
        <button 
          onClick={() => setIsOpen(false)}
          className="text-zinc-500 hover:text-white transition-colors text-xl font-bold px-2"
        >
          &times;
        </button>
      </div>

      {/* Tabs */}
      {availableChannels.length > 1 && (
        <div className="flex bg-zinc-900/30 p-2 gap-1 border-b border-zinc-800/50 overflow-x-auto">
          {availableChannels.map(c => (
            <button
              key={c.id}
              onClick={() => setActiveChannel(c.id)}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors whitespace-nowrap ${activeChannel === c.id ? (c.id === 'MAFIA' ? 'bg-red-500/20 text-red-400 border border-red-500/30' : c.id === 'DEAD' ? 'bg-zinc-800 text-zinc-300 border border-zinc-700' : 'bg-blue-500/20 text-blue-400 border border-blue-500/30') : 'text-zinc-500 hover:bg-zinc-800/50'}`}
            >
              {c.label}
            </button>
          ))}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
        {channelMessages.length === 0 ? (
          <div className="text-center text-zinc-600 text-xs mt-10">Bu kanalda hələ mesaj yoxdur.</div>
        ) : (
          channelMessages.map(m => {
            const isMe = m.senderId === currentUserId;
            return (
              <div key={m.id} className={`flex flex-col max-w-[85%] ${isMe ? 'self-end items-end' : 'self-start items-start'}`}>
                <span className="text-[10px] text-zinc-500 mb-0.5 px-1">{m.senderName}</span>
                <div className={`px-3 py-2 rounded-2xl text-sm ${isMe ? 'bg-blue-600 text-white rounded-tr-sm' : (activeChannel === 'MAFIA' ? 'bg-red-950/50 text-red-100 border border-red-900/50 rounded-tl-sm' : activeChannel === 'DEAD' ? 'bg-zinc-800 text-zinc-200 rounded-tl-sm' : 'bg-zinc-800 text-zinc-100 rounded-tl-sm')}`}>
                  {m.content}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      {/* Quick Chat */}
      <div className="flex gap-1.5 overflow-x-auto px-3 py-2 border-t border-zinc-800 bg-zinc-950/80 scroll-smooth custom-scrollbar snap-x">
        {[
          "Məncə mafiyadır!", 
          "Mən şerifəm", 
          "Məni qoruyun", 
          "Təmizəm", 
          "Səs verin asaq", 
          "Tələsməyin!"
        ].map((phrase, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => {
              onSendMessage(phrase, activeChannel);
              setTimeout(() => {
                if (messagesEndRef.current) {
                  messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
                }
              }, 100);
            }}
            className="shrink-0 snap-start bg-zinc-800/80 hover:bg-indigo-600/80 text-zinc-300 hover:text-white text-[10px] font-bold tracking-wider uppercase px-3 py-1.5 rounded-full whitespace-nowrap transition-colors border border-zinc-700 hover:border-indigo-500 shadow-sm"
          >
            {phrase}
          </button>
        ))}
      </div>

      <form onSubmit={handleSend} className="p-3 border-t border-zinc-800 bg-zinc-900/50 flex gap-2">
        <input 
          type="text" 
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Mesaj yaz..."
          maxLength={300}
          className="flex-1 bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
        />
        <button 
          type="submit"
          disabled={!input.trim()}
          className="bg-blue-600 hover:bg-blue-500 text-white p-2.5 rounded-xl transition-colors disabled:opacity-50 disabled:hover:bg-blue-600 flex items-center justify-center"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}} />
    </div>
  );
});
