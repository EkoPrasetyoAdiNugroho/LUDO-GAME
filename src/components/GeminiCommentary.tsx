/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { GameState, Player, ChatMessage, PlayerColor } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Send, Volume2, MessageSquare, Sparkles, Smile, Database, Plus, Trash2, RotateCcw, X, Check } from 'lucide-react';

interface GeminiCommentaryProps {
  gameState: GameState;
  myPlayer: Player | null;
  onSendChat: (message: string) => void;
}

const DEFAULT_QUICK_CHATS = [
  'Aduh sial! 😭',
  'Hoki banget sih! 😡',
  'Caplok bidakmu! 😋',
  'Ampun om, jangan makan bidakku! 🙏',
  'Hoki murni ini mah! 😎',
  'Curang ya kelihatannya... 🤔',
  'Menuju Finish ciamik! 🚀',
  'GG WP! Mantap sekali permainan! 🤝'
];

export const GeminiCommentary: React.FC<GeminiCommentaryProps> = ({
  gameState,
  myPlayer,
  onSendChat,
}) => {
  const { chatHistory } = gameState;
  const [chatInput, setChatInput] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Loaded customized quick chats from local database
  const [quickChats, setQuickChats] = useState<string[]>(() => {
    const saved = localStorage.getItem('ludo_quick_chats');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Error parsing ludo_quick_chats:', e);
      }
    }
    return DEFAULT_QUICK_CHATS;
  });

  const [showDbEditor, setShowDbEditor] = useState(false);
  const [newQuickChat, setNewQuickChat] = useState('');
  const [justAdded, setJustAdded] = useState(false);

  const handleSaveQuickChats = (newChats: string[]) => {
    setQuickChats(newChats);
    localStorage.setItem('ludo_quick_chats', JSON.stringify(newChats));
  };

  const handleAddQuickChat = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newQuickChat.trim()) return;
    const updated = [...quickChats, newQuickChat.trim()];
    handleSaveQuickChats(updated);
    setNewQuickChat('');
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1500);
  };

  const handleDeleteQuickChat = (index: number) => {
    const updated = quickChats.filter((_, idx) => idx !== index);
    handleSaveQuickChats(updated);
  };

  const handleResetQuickChats = () => {
    if (window.confirm('Apakah Anda yakin ingin menyetel ulang database pesan cepat ke awal?')) {
      handleSaveQuickChats(DEFAULT_QUICK_CHATS);
    }
  };

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  const handleSendSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    onSendChat(chatInput.trim());
    setChatInput('');
  };

  const handleQuickChatClick = (msg: string) => {
    onSendChat(msg);
  };

  // Speaks commentary out loud using Web Speech API (Indonesian TTS)
  const handleVoicePlayback = (text: string) => {
    if (!('speechSynthesis' in window) || isMuted) return;

    window.speechSynthesis.cancel(); // Stop active voices
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'id-ID'; // Indonesian voice
    utterance.rate = 1.05; // Slightly faster for natural Indonesian style
    utterance.pitch = 1.0;
    
    // Find Indonesian voice if available
    const voices = window.speechSynthesis.getVoices();
    const idVoice = voices.find(v => v.lang.startsWith('id') || v.lang.includes('Indonesia'));
    if (idVoice) {
      utterance.voice = idVoice;
    }

    window.speechSynthesis.speak(utterance);
  };

  // Automatically trigger Indonesian voice whenever a new AI commentary lands
  const lastSpokenMsgIdRef = useRef<string | null>(null);
  
  useEffect(() => {
    if (chatHistory.length === 0) return;
    const latestMsg = chatHistory[chatHistory.length - 1];
    
    // Check if the latest message is indeed from "Bung Ludo" (system AI)
    if (latestMsg.senderName.includes('Bung Ludo') && !isMuted) {
      // Only speak if this specific message hasn't been spoken yet
      if (lastSpokenMsgIdRef.current !== latestMsg.id) {
        lastSpokenMsgIdRef.current = latestMsg.id;
        
        // Small delay for natural feel after board animations
        const timer = setTimeout(() => {
          handleVoicePlayback(latestMsg.message);
        }, 300);
        return () => clearTimeout(timer);
      }
    }
  }, [chatHistory, isMuted]);

  // Extract color classes for player chats
  const getSenderColorClass = (color?: PlayerColor) => {
    if (!color) return 'text-slate-600';
    const map = {
      red: 'text-red-600',
      green: 'text-emerald-600',
      yellow: 'text-amber-600',
      blue: 'text-blue-600',
    };
    return map[color];
  };

  const getSenderBgClass = (color?: PlayerColor) => {
    if (!color) return 'bg-slate-100 border-2 border-slate-200 text-slate-800';
    const map = {
      red: 'bg-red-50 border-2 border-red-200 text-red-900',
      green: 'bg-emerald-5 border-2 border-emerald-200 text-emerald-900',
      yellow: 'bg-amber-5 border-2 border-amber-200 text-amber-900',
      blue: 'bg-blue-5 border-2 border-blue-200 text-blue-900',
    };
    return map[color];
  };

  // Find the latest AI Comment to highlight prominently
  const latestCommentary = chatHistory
    .slice()
    .reverse()
    .find(m => m.senderName.includes('Bung Ludo'));

  return (
    <div className="bg-white border-4 border-slate-900 rounded-3xl flex flex-col h-[520px] shadow-[6px_6px_0px_rgba(14,165,233,1)] overflow-hidden">
      {/* 1. BUNG LUDO AI COMMENTATOR HEADER (Prominent Bubble) */}
      <div className="bg-amber-50/50 border-b-4 border-slate-900 p-4 shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <span className="text-2xl" role="img" aria-label="Commentator Microphone">🎙️</span>
            <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-brand-orange border-2 border-slate-900 rounded-full animate-ping" />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-sans font-black text-brand-orange uppercase tracking-widest flex items-center gap-1">
              <Sparkles size={11} className="fill-brand-orange animate-pulse text-brand-orange" /> LIVE COMMENTATOR
            </span>
            <span className="text-sm font-black text-slate-900 uppercase tracking-wider font-sans">Bung Ludo</span>
          </div>
        </div>

        {/* Audio Mute Switch */}
        <button
          onClick={() => setIsMuted(!isMuted)}
          className={`px-3 py-1.5 rounded-xl transition-all border-2 font-sans text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer ${
            isMuted
              ? 'bg-slate-100 text-slate-500 border-slate-300 hover:text-slate-700'
              : 'bg-brand-cyan/10 text-brand-cyan border-brand-cyan hover:bg-brand-cyan hover:text-white'
          }`}
          title={isMuted ? 'Aktifkan Suara Komentator (TTS)' : 'Bisukan Suara Komentator (TTS)'}
        >
          <Volume2 size={14} className={isMuted ? 'opacity-40' : 'animate-pulse'} />
          <span>{isMuted ? 'MUTE: ON' : 'MUTE: OFF'}</span>
        </button>
      </div>

      {/* 2. LIVE COMMENTATOR QUOTE BOX */}
      {latestCommentary && (
        <div className="bg-white border-b-2 border-slate-100 p-3 shrink-0">
          <motion.div
            key={latestCommentary.id}
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-amber-50 border-2 border-brand-orange p-3.5 rounded-2xl flex items-start gap-2.5 shadow-sm"
          >
            <span className="text-xl shrink-0">🎙️</span>
            <p className="text-xs font-sans font-black text-brand-orange italic leading-relaxed">
              "{latestCommentary.message}"
            </p>
          </motion.div>
        </div>
      )}

      {/* 3. SCROLLABLE CHAT MESSAGES HISTORY AREA */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 scrollbar-thin bg-slate-50/50 relative">
        <AnimatePresence>
          {showDbEditor && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 15 }}
              className="absolute inset-0 bg-white p-4 flex flex-col z-10 overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b-2 border-slate-100 pb-2 mb-3">
                <span className="text-[10px] font-black text-brand-orange uppercase tracking-wider flex items-center gap-1.5">
                  <Database size={13} className="text-brand-orange" /> DATABASE CHAT KUSTOM (LOCAL DB)
                </span>
                <button
                  type="button"
                  onClick={() => setShowDbEditor(false)}
                  className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Add Custom Chat Form */}
              <form onSubmit={handleAddQuickChat} className="flex gap-1.5 mb-3 shrink-0">
                <input
                  type="text"
                  placeholder="TAMBAH KALIMAT EJEKAN BARU..."
                  value={newQuickChat}
                  onChange={(e) => setNewQuickChat(e.target.value)}
                  maxLength={40}
                  className="flex-1 bg-slate-50 border-2 border-slate-200 focus:border-brand-orange text-slate-900 rounded-xl py-2 px-3 text-[11px] font-sans font-black outline-none uppercase placeholder-slate-400"
                />
                <button
                  type="submit"
                  disabled={!newQuickChat.trim()}
                  className="bg-brand-cyan border-2 border-slate-900 text-white rounded-xl py-2 px-3 text-[10px] font-black uppercase transition-all flex items-center gap-1 hover:bg-sky-400 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  <Plus size={12} className="stroke-[3]" /> TAMBAH
                </button>
              </form>

              {justAdded && (
                <div className="text-[10px] font-black font-sans text-emerald-600 uppercase mb-2 animate-pulse flex items-center gap-1 shrink-0">
                  <Check size={11} /> Berhasil disimpan ke Database!
                </div>
              )}

              {/* Database List */}
              <div className="flex-1 overflow-y-auto flex flex-col gap-1.5 scrollbar-thin pr-1">
                {quickChats.length === 0 ? (
                  <div className="text-center text-slate-400 py-6 text-[10px] font-sans uppercase font-bold">
                    Database kosong! Tambahkan ejekan taktis di atas.
                  </div>
                ) : (
                  quickChats.map((chat, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl py-1.5 px-3 text-[11px] font-sans font-bold text-slate-700 uppercase">
                      <span className="truncate pr-2">{chat}</span>
                      <button
                        type="button"
                        onClick={() => handleDeleteQuickChat(idx)}
                        className="text-slate-400 hover:text-red-500 p-1 rounded-md transition-colors shrink-0 cursor-pointer"
                        title="Hapus dari Database"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* Reset to defaults */}
              <div className="border-t border-slate-100 pt-3 mt-3 flex justify-between items-center shrink-0">
                <span className="text-[9px] font-bold text-slate-400 uppercase">
                  TOTAL: {quickChats.length} TEMPLATE
                </span>
                <button
                  type="button"
                  onClick={handleResetQuickChats}
                  className="text-red-500 hover:bg-red-50 py-1.5 px-2.5 rounded-xl text-[9px] font-black uppercase transition-all flex items-center gap-1 border border-transparent hover:border-red-200 cursor-pointer"
                >
                  <RotateCcw size={11} /> RESET KE AWAL
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {chatHistory.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center text-slate-400 p-6">
            <MessageSquare size={36} className="opacity-30 mb-2 text-brand-cyan" />
            <span className="text-xs font-sans font-black uppercase tracking-widest text-slate-500">// CHAT HISTORY EMPTY //</span>
            <p className="text-[10px] font-sans font-bold mt-1 max-w-xs leading-relaxed uppercase">
              Gunakan panel quick chat di bawah atau kirim ejekan taktis ke lawan anda!
            </p>
          </div>
        ) : (
          chatHistory.map((m) => {
            const isSystem = m.senderName.includes('Bung Ludo');
            const timeStr = new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            if (isSystem) return null; // We already render latest system commentary above; let's keep chat log for players

            const isMe = myPlayer && m.senderName === myPlayer.name;

            return (
              <div
                key={m.id}
                className={`flex flex-col max-w-[85%] ${
                  isMe ? 'self-end items-end' : 'self-start items-start'
                }`}
              >
                {/* Sender Title Name */}
                <span className={`text-[10px] font-black font-sans mb-1 uppercase tracking-wider flex items-center gap-1.5 ${getSenderColorClass(m.senderColor)}`}>
                  {m.senderName}
                  <span className="text-slate-400 font-normal">{timeStr}</span>
                </span>

                {/* Bubble box */}
                <div className={`p-3 rounded-2xl text-xs font-sans font-bold uppercase tracking-tight leading-relaxed shadow-sm ${
                  isMe 
                    ? 'bg-brand-orange text-white rounded-tr-none border-2 border-slate-900' 
                    : `${getSenderBgClass(m.senderColor)} rounded-tl-none`
                }`}>
                  {m.message}
                </div>
              </div>
            );
          })
        )}
        <div ref={chatEndRef} />
      </div>

      {/* 4. HORIZONTAL SCROLLABLE QUICK PRESETS CHATS ROW */}
      <div className="bg-slate-50 border-t border-slate-100 p-2 shrink-0 flex items-center gap-2 overflow-x-auto select-none scrollbar-none">
        <button
          type="button"
          onClick={() => setShowDbEditor(!showDbEditor)}
          className={`shrink-0 border-2 rounded-xl py-1.5 px-3 text-[10px] font-sans font-black uppercase tracking-wider transition-all active:translate-y-0.5 cursor-pointer flex items-center gap-1 ${
            showDbEditor 
              ? 'bg-amber-400 text-slate-900 border-slate-900 shadow-[2px_2px_0px_#000]' 
              : 'bg-white hover:bg-slate-100 text-slate-800 border-slate-200'
          }`}
          title="Kelola Database Quick Chat"
        >
          <Database size={11} className={showDbEditor ? "text-slate-900" : "text-brand-orange"} />
          <span>{showDbEditor ? 'TUTUP DB' : 'KUSTOM DB'}</span>
        </button>

        <div className="h-4 w-[1px] bg-slate-300 shrink-0" />

        {quickChats.map((msg, i) => (
          <button
            key={i}
            onClick={() => handleQuickChatClick(msg)}
            className="shrink-0 bg-white hover:bg-brand-orange hover:text-white border-2 border-slate-200 hover:border-slate-900 text-slate-700 rounded-xl py-1.5 px-3 text-[10px] font-sans font-black uppercase tracking-wider transition-all active:translate-y-0.5 cursor-pointer flex items-center gap-1"
          >
            <Smile size={11} className="text-slate-400 shrink-0" />
            {msg}
          </button>
        ))}
      </div>

      {/* 5. INTERACTIVE CHAT FOOTER FORM BAR */}
      <form onSubmit={handleSendSubmit} className="bg-white border-t-4 border-slate-900 p-3 shrink-0 flex gap-2">
        <input
          type="text"
          placeholder="KETIK EJEKAN TAKTIS ANDA..."
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
          maxLength={80}
          className="flex-1 bg-slate-50 border-2 border-slate-200 focus:border-brand-orange text-slate-900 rounded-2xl py-2.5 px-3.5 text-xs font-sans font-black outline-none transition-all uppercase placeholder-slate-400"
        />
        <button
          type="submit"
          disabled={!chatInput.trim()}
          className={`w-10 h-10 rounded-2xl border-4 border-slate-900 flex items-center justify-center transition-all shrink-0 ${
            chatInput.trim()
              ? 'bg-brand-cyan text-white hover:bg-amber-400 hover:text-slate-900 shadow-[3px_3px_0px_rgba(0,0,0,1)] active:translate-y-0.5'
              : 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
          }`}
        >
          <Send size={15} className="stroke-[3]" />
        </button>
      </form>
    </div>
  );
};
