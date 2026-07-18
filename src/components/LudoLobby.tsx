/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Player, GameState, PlayerColor } from '../types';
import { motion } from 'motion/react';
import { Play, UserPlus, Users, HelpCircle, Copy, Check, Bot, Trash2, ArrowLeft, Gamepad2, Info, Shield } from 'lucide-react';

interface LudoLobbyProps {
  gameState: GameState | null;
  myPlayer: Player | null;
  onEnterLocalMode: () => void;
  onCreateRoom: (playerName: string) => void;
  onJoinRoom: (playerName: string, roomId: string) => void;
  onAddBot: (difficulty: 'easy' | 'medium' | 'hard') => void;
  onRemoveBot: (color: PlayerColor) => void;
  onStartGame: () => void;
  onBack?: () => void;
  isConnecting?: boolean;
  connectionError?: string | null;
}

export const LudoLobby: React.FC<LudoLobbyProps> = ({
  gameState,
  myPlayer,
  onEnterLocalMode,
  onCreateRoom,
  onJoinRoom,
  onAddBot,
  onRemoveBot,
  onStartGame,
  onBack,
  isConnecting,
  connectionError,
}) => {
  const [playerName, setPlayerName] = useState('');
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [botDifficulty, setBotDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [copied, setCopied] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [isJoining, setIsJoining] = useState(false);

  // Copy Room ID helper
  const handleCopyCode = () => {
    if (!gameState) return;
    navigator.clipboard.writeText(gameState.roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCreateClick = (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerName.trim()) return;
    onCreateRoom(playerName.trim());
  };

  const handleJoinClick = (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerName.trim() || !roomCodeInput.trim()) return;
    onJoinRoom(playerName.trim(), roomCodeInput.trim().toUpperCase());
  };

  const isHost = myPlayer ? myPlayer.isHost : false;

  // Visual Palette
  const colorMap: { [c in PlayerColor]: string } = {
    red: 'bg-red-500',
    green: 'bg-emerald-500',
    yellow: 'bg-amber-500',
    blue: 'bg-blue-500',
  };

  const colorTextMap: { [c in PlayerColor]: string } = {
    red: 'text-red-400',
    green: 'text-emerald-400',
    yellow: 'text-amber-400',
    blue: 'text-blue-400',
  };

  return (
    <div className="max-w-4xl mx-auto p-6 flex flex-col justify-center min-h-[90vh] items-center relative">
      {/* BACKGROUND GRAPHIC GLOW */}
      <div className="absolute inset-0 bg-gradient-to-b from-amber-50 via-sky-50 to-amber-50/30 z-[-2] pointer-events-none" />
      <div className="absolute inset-0 opacity-[0.05] bg-[linear-gradient(#0EA5E9_1px,transparent_1px),linear-gradient(90deg,#0EA5E9_1px,transparent_1px)] bg-[size:40px_40px] z-[-1] pointer-events-none" />

      {/* HEADER LOGO */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="text-center mb-8 flex flex-col items-center"
      >
        <div className="relative w-24 h-24 bg-white rounded-3xl border-4 border-slate-900 flex items-center justify-center shadow-[6px_6px_0px_rgba(255,127,17,1)] mb-6">
          <Gamepad2 size={48} className="text-brand-orange" />
          <div className="absolute -top-1 -left-1 w-6 h-6 bg-red-500 border-2 border-slate-900 rounded-full" />
          <div className="absolute -top-1 -right-1 w-6 h-6 bg-yellow-500 border-2 border-slate-900 rounded-full" />
          <div className="absolute -bottom-1 -left-1 w-6 h-6 bg-emerald-500 border-2 border-slate-900 rounded-full" />
          <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-blue-500 border-2 border-slate-900 rounded-full" />
        </div>
        
        <h1 className="text-5xl md:text-7xl font-black text-slate-900 tracking-tighter uppercase leading-none font-sans mb-3 drop-shadow-sm">
          LUDO <span className="text-brand-orange text-transparent bg-clip-text bg-gradient-to-r from-brand-orange to-red-500">BUNG</span> <span className="text-brand-cyan text-transparent bg-clip-text bg-gradient-to-r from-brand-cyan to-blue-500">AI</span>
        </h1>
        
        <p className="text-slate-600 text-xs font-mono max-w-lg uppercase tracking-wider leading-relaxed border-t-2 border-dashed border-slate-300 pt-3">
          ✨ MULTIPLAYER REAL-TIME SYSTEM // POWERED BY GEMINI COMMENTARY ✨
        </p>
      </motion.div>

      {/* LOBBY FLOW */}
      {!gameState ? (
        // STAGE 1: ENTRY OPTIONS (Create / Join / Local Play)
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-3xl bg-white border-4 border-slate-900 rounded-3xl shadow-[10px_10px_0px_0px_rgba(255,127,17,1)] p-6 md:p-10 flex flex-col md:flex-row gap-8"
        >
          {/* Main Controls Panel */}
          <div className="flex-1 flex flex-col gap-6 justify-center">
            <h3 className="text-2xl font-black text-slate-900 tracking-tight uppercase flex items-center gap-2 border-b-4 border-brand-orange pb-2">
              <Users size={22} className="text-brand-orange" /> ATUR NAMA PEMAIN
            </h3>

            {/* Connection errors inside entry selection */}
            {connectionError && (
              <div className="bg-red-50 border-2 border-red-500 text-red-700 text-xs py-3 px-4 rounded-2xl font-bold font-sans flex items-center gap-2 uppercase tracking-wide">
                <span className="w-2 h-2 bg-red-600 rounded-full animate-ping" />
                ERROR: {connectionError}
              </div>
            )}

            {isConnecting && (
              <div className="bg-amber-50 border-2 border-brand-orange text-slate-900 text-xs py-3 px-4 rounded-2xl font-sans font-black flex items-center gap-2 uppercase tracking-wider">
                <span className="w-2.5 h-2.5 bg-brand-orange rounded-full animate-ping" />
                MENGHUBUNGKAN KE SERVER LUDO...
              </div>
            )}
            
            <div className="flex flex-col gap-2">
              <label className="text-xs font-mono text-slate-700 font-bold uppercase tracking-widest">NAMA IDENTITAS</label>
              <input
                type="text"
                placeholder="MASUKKAN NAMA ANDA..."
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                maxLength={15}
                className="w-full bg-amber-50/50 border-4 border-slate-900 focus:border-brand-cyan text-slate-900 rounded-2xl py-3.5 px-4 outline-none font-sans font-black text-sm transition-all shadow-[inset_3px_3px_0px_rgba(0,0,0,0.05)] uppercase placeholder-slate-400"
              />
            </div>

            {/* Quick Choice Grid */}
            <div className="flex flex-col gap-4 mt-2">
              <button
                onClick={handleCreateClick}
                disabled={!playerName.trim()}
                className={`py-4 px-6 rounded-2xl font-black text-md uppercase tracking-wider shadow-[4px_4px_0px_#000] border-4 border-slate-900 transition-all flex items-center justify-center gap-2.5 ${
                  playerName.trim()
                    ? 'bg-brand-orange text-white hover:bg-amber-400 hover:text-slate-900 active:translate-y-1 active:shadow-none cursor-pointer'
                    : 'bg-slate-100 text-slate-400 border-slate-300 shadow-none cursor-not-allowed'
                }`}
              >
                <UserPlus size={18} /> BUAT LOBI MULTIPLAYER
              </button>

              <div className="relative flex items-center justify-center my-2">
                <hr className="border border-slate-200 w-full" />
                <span className="absolute bg-white px-4 text-xs text-slate-500 font-mono font-bold">// ATAU //</span>
              </div>

              {/* Join Room Form */}
              <form onSubmit={handleJoinClick} className="flex gap-3">
                <input
                  type="text"
                  placeholder="KODE"
                  value={roomCodeInput}
                  onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
                  maxLength={6}
                  disabled={!playerName.trim()}
                  className="w-32 text-center bg-amber-50/50 border-4 border-slate-900 focus:border-brand-cyan text-slate-900 font-sans font-black uppercase rounded-2xl py-3 outline-none text-base placeholder-slate-400 disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={!playerName.trim() || !roomCodeInput.trim()}
                  className={`flex-1 py-3 px-6 rounded-2xl font-black text-sm uppercase tracking-wider border-4 border-slate-900 shadow-[4px_4px_0px_#000] flex items-center justify-center gap-2 transition-all ${
                    playerName.trim() && roomCodeInput.trim()
                      ? 'bg-brand-cyan text-white hover:bg-sky-400 hover:text-slate-900 active:translate-y-1 cursor-pointer'
                      : 'bg-slate-100 text-slate-400 border-slate-300 shadow-none cursor-not-allowed'
                  }`}
                >
                  GABUNG ROOM
                </button>
              </form>
            </div>
            
            <button
              onClick={onEnterLocalMode}
              className="py-3 px-4 rounded-2xl font-black uppercase tracking-wider text-brand-cyan hover:text-slate-900 bg-sky-50 border-4 border-dashed border-brand-cyan hover:border-brand-orange hover:bg-amber-50 transition-all text-xs text-center cursor-pointer mt-2"
            >
              🎮 MAIN MODE LOKAL (PASS & PLAY / VS BOT)
            </button>
          </div>

          {/* Right Info Section */}
          <div className="w-full md:w-72 bg-amber-50/30 rounded-2xl border-4 border-slate-900 p-6 flex flex-col justify-between">
            <div>
              <h4 className="text-sm font-sans font-black text-brand-orange uppercase tracking-widest flex items-center gap-1.5 mb-4 border-b-2 border-brand-orange/30 pb-1">
                <Info size={15} /> CARA BERMAIN LUDO
              </h4>
              <ul className="text-xs text-slate-700 flex flex-col gap-3 font-sans leading-relaxed">
                <li className="flex items-start gap-2">
                  <span className="text-brand-orange shrink-0">★</span>
                  <span>Setiap pemain memiliki <strong className="text-slate-900 font-black">4 bidak</strong> di dalam kandang.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-brand-orange shrink-0">★</span>
                  <span>Kocokan dadu bernilai <strong className="text-slate-900 font-black">6</strong> untuk mengeluarkan bidak.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-brand-orange shrink-0">★</span>
                  <span>Bidak berjalan memutar searah jarum jam untuk masuk jalur finish.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-brand-orange shrink-0">★</span>
                  <span>Mendarat di atas bidak lawan akan <strong className="text-brand-cyan font-black">memakan</strong> dan memulangkannya ke kandang.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-brand-orange shrink-0">★</span>
                  <span>Pemenang adalah pemain pertama yang <strong className="text-slate-900 font-black">keempat bidaknya</strong> masuk finish.</span>
                </li>
              </ul>
            </div>
            
            <div className="border-t-2 border-dashed border-slate-300 pt-4 mt-6">
              <span className="text-[11px] font-sans text-brand-cyan font-black uppercase tracking-wider leading-tight block">
                🎙️ LIVE COMMENTARY POWERED BY GOOGLE GEMINI AI UNTUK PERTANDINGAN YANG LEBIH SERU!
              </span>
            </div>
          </div>
        </motion.div>
      ) : (
        // STAGE 2: WAITING ROOM LOBBY (Multiplayer code shared, invite bots, config start)
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-3xl bg-white border-4 border-slate-900 rounded-3xl shadow-[10px_10px_0px_0px_rgba(255,127,17,1)] p-6 md:p-10 flex flex-col gap-6"
        >
          {/* Room Header Info */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b-4 border-slate-200">
            <div>
              <span className="text-xs font-mono font-bold text-brand-cyan uppercase tracking-widest">// LOBI MULTIPLAYER READY //</span>
              <h2 className="text-3xl font-black text-slate-950 uppercase tracking-tight mt-1">
                UNDANG KONTESAN
              </h2>
            </div>

            {/* Room Code Code Copy */}
            <div className="bg-amber-50/40 border-4 border-slate-900 rounded-2xl p-4 flex items-center justify-between gap-6">
              <div className="flex flex-col">
                <span className="text-[10px] font-mono font-bold text-slate-500 tracking-wider">KODE ROOM LUDO</span>
                <span className="text-3xl font-sans font-black text-brand-orange tracking-widest">{gameState.roomId}</span>
              </div>
              <button
                onClick={handleCopyCode}
                className="w-12 h-12 bg-brand-orange text-white font-black rounded-xl flex items-center justify-center transition-all cursor-pointer hover:bg-amber-400 border-2 border-slate-900 shadow-[3px_3px_0px_#000] active:translate-y-0.5"
                title="Salin Kode Lobi"
              >
                {copied ? <Check size={22} className="text-slate-950 stroke-[3]" /> : <Copy size={22} className="stroke-[3]" />}
              </button>
            </div>
          </div>

          {/* Lobby Grid - Players, Bots, AI settings */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Left: Player Slot Cards */}
            <div className="flex flex-col gap-4">
              <h4 className="text-sm font-sans font-black text-brand-orange uppercase tracking-wider flex items-center gap-1.5 border-b-2 border-brand-orange/30 pb-1">
                <Users size={16} /> PEMAIN TERGABUNG ({gameState.players.length}/4)
              </h4>
              
              <div className="flex flex-col gap-2.5">
                {gameState.players.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 border-2 border-slate-200"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-4 h-4 rounded-full ${colorMap[p.color] || 'bg-slate-500'} border-2 border-white`} />
                      <span className="text-sm font-black text-slate-900 uppercase tracking-tight flex items-center gap-1.5">
                        {p.name}
                        {p.isHost && <Shield size={12} className="text-brand-orange fill-brand-orange" title="Host Lobi" />}
                        {p.isBot && <Bot size={14} className="text-brand-cyan" />}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className={`text-[10px] uppercase font-mono font-black tracking-widest px-2.5 py-1 rounded-full border ${p.color === 'red' ? 'border-red-500/50 bg-red-500/10 text-red-600' : p.color === 'green' ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-600' : p.color === 'yellow' ? 'border-amber-500/50 bg-amber-500/10 text-amber-600' : 'border-blue-500/50 bg-blue-500/10 text-blue-600'}`}>
                        {p.color}
                      </span>
                      {isHost && p.isBot && (
                        <button
                          onClick={() => onRemoveBot(p.color)}
                          className="p-1 text-slate-400 hover:text-red-500 transition-all cursor-pointer"
                          title="Hapus Bot"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                
                {/* Empty slots placeholders */}
                {Array.from({ length: 4 - gameState.players.length }).map((_, i) => (
                  <div
                    key={`empty-${i}`}
                    className="border-2 border-dashed border-slate-300 p-3.5 rounded-2xl flex items-center justify-center text-xs text-slate-400 font-mono font-bold"
                  >
                    // SLOT KOSONG //
                  </div>
                ))}
              </div>
            </div>

            {/* Right: AI Bot Panel Config */}
            <div className="bg-amber-50/20 border-4 border-slate-900 p-5 rounded-2xl flex flex-col justify-between shadow-[4px_4px_0px_rgba(0,0,0,0.05)]">
              <div>
                <h4 className="text-sm font-sans font-black text-brand-cyan uppercase tracking-wider flex items-center gap-1.5 mb-3 border-b-2 border-brand-cyan/20 pb-1">
                  <Bot size={16} className="text-brand-cyan" /> HUBUNGKAN BOT KOMPUTER
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed mb-4 font-sans font-medium">
                  Isi slot kosong dengan bot AI. Mereka diprogram dengan kalkulasi taktis untuk menghalangi jalan kemenangan Anda!
                </p>

                {/* Difficulty Selector */}
                <div className="flex flex-col gap-2 mb-4">
                  <label className="text-[10px] font-mono text-slate-600 font-bold uppercase tracking-widest">TINGKAT INTELEGENSI BOT</label>
                  <div className="grid grid-cols-3 gap-2 bg-slate-100 border-2 border-slate-200 p-1 rounded-xl">
                    {(['easy', 'medium', 'hard'] as const).map((diff) => (
                      <button
                        key={diff}
                        onClick={() => setBotDifficulty(diff)}
                        className={`py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                          botDifficulty === diff
                            ? 'bg-brand-cyan text-white shadow-sm'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        {diff === 'easy' ? 'Mudah' : diff === 'medium' ? 'Sedang' : 'Sulit'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Add Bot button (disabled if full) */}
              <button
                onClick={() => onAddBot(botDifficulty)}
                disabled={!isHost || gameState.players.length >= 4}
                className={`w-full py-3.5 rounded-2xl font-black text-xs uppercase tracking-wider border-4 border-slate-900 shadow-[3px_3px_0px_rgba(0,0,0,1)] transition-all ${
                  isHost && gameState.players.length < 4
                    ? 'bg-brand-cyan text-white hover:bg-sky-400 hover:text-slate-900 active:translate-y-0.5'
                    : 'bg-slate-100 border-slate-300 text-slate-400 shadow-none cursor-not-allowed'
                }`}
              >
                <UserPlus size={14} /> HUBUNGKAN BOT COMP
              </button>
            </div>
          </div>

          {/* Action buttons (Start / Back) */}
          <div className="flex items-center justify-between gap-4 border-t-2 border-slate-200 pt-5 mt-4">
            <button
              onClick={() => {
                if (onBack) onBack();
                else window.location.reload();
              }}
              className="px-5 py-3 rounded-2xl border-4 border-slate-900 hover:bg-slate-100 text-slate-800 font-black text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 shadow-[3px_3px_0px_#000] active:translate-y-0.5"
            >
              <ArrowLeft size={14} /> GANTI MODE
            </button>

            {isHost ? (
              <button
                onClick={onStartGame}
                disabled={gameState.players.length < 2}
                className={`py-3.5 px-8 rounded-2xl font-black text-sm uppercase tracking-widest flex items-center gap-2 border-4 border-slate-900 shadow-[4px_4px_0px_#000] transition-all ${
                  gameState.players.length >= 2
                    ? 'bg-brand-orange text-white hover:bg-amber-400 hover:text-slate-900 active:translate-y-0.5'
                    : 'bg-slate-100 border-slate-300 text-slate-400 shadow-none cursor-not-allowed'
                }`}
              >
                <Play size={16} fill="currentColor" /> MULAI PERTANDINGAN!
              </button>
            ) : (
              <div className="bg-sky-50 px-5 py-3 rounded-2xl border-2 border-brand-cyan/30 text-xs font-sans font-black text-brand-cyan uppercase tracking-wider flex items-center gap-1.5 animate-pulse">
                <Info size={14} className="text-brand-cyan" />
                MENUNGGU HOST MEMULAI MISI...
              </div>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
};

