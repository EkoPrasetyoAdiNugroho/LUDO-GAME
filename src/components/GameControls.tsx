/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { PlayerColor, GameState, Player } from '../types';
import { getValidMoves } from '../gameLogic';
import { Dices, Bot, Shield, User, CircleAlert, Wifi, WifiOff } from 'lucide-react';
import { sfx } from '../utils/audio';

interface GameControlsProps {
  gameState: GameState;
  myPlayer: Player | null;
  onRollDice: () => void;
  isOnlineMode: boolean;
}

export const GameControls: React.FC<GameControlsProps> = ({
  gameState,
  myPlayer,
  onRollDice,
  isOnlineMode,
}) => {
  const { players, currentPlayerIndex, diceValue, diceRolled, tokens } = gameState;
  const currentPlayer = players[currentPlayerIndex];
  
  const [isRollingLocal, setIsRollingLocal] = useState(false);
  const [visualDiceValue, setVisualDiceValue] = useState<number | null>(null);
  const [isVisualRolling, setIsVisualRolling] = useState(false);
  
  const prevDiceRolled = useRef(false);
  const prevCurrentPlayerIndex = useRef(currentPlayerIndex);

  // Checks if the current client is allowed to roll the dice
  const isMyTurnToRoll = () => {
    if (gameState.status !== 'playing') return false;
    if (!currentPlayer) return false;
    if (currentPlayer.isBot) return false;
    if (diceRolled) return false;
    
    if (isOnlineMode) {
      return myPlayer && myPlayer.id === currentPlayer.id;
    }
    return true; // Local mode: any human can roll
  };

  const handleRollClick = () => {
    if (!isMyTurnToRoll() || isRollingLocal || isVisualRolling) return;
    
    setIsRollingLocal(true);
    sfx.playRoll(); // Play live synthesized dice rolling rattle
    
    // Simulate dice rolling animation for 850ms before sending action
    setTimeout(() => {
      setIsRollingLocal(false);
      onRollDice();
    }, 850);
  };

  // Synchronize visual rolling state for Bot and Online players
  useEffect(() => {
    if (gameState.status !== 'playing') {
      setVisualDiceValue(gameState.diceValue);
      setIsVisualRolling(false);
      prevDiceRolled.current = false;
      return;
    }

    const isCurrentPlayerMyLocalHuman = () => {
      if (!currentPlayer) return false;
      if (currentPlayer.isBot) return false;
      if (isOnlineMode) {
        return myPlayer && myPlayer.id === currentPlayer.id;
      }
      return true; // Local mode: human players are local
    };

    // If a roll just happened in the game state
    if (gameState.diceRolled && !prevDiceRolled.current && gameState.diceValue !== null) {
      if (isCurrentPlayerMyLocalHuman()) {
        // Local human already has their own manual click + roll animation
        setVisualDiceValue(gameState.diceValue);
        setIsVisualRolling(false);
      } else {
        // It's a Bot or Online opponent rolling!
        setIsVisualRolling(true);
        sfx.playRoll(); // Play rattle sound

        let count = 0;
        const interval = setInterval(() => {
          // Rapidly flicker random values to simulate spinning dice
          setVisualDiceValue(Math.floor(Math.random() * 6) + 1);
          count++;
          if (count > 8) {
            clearInterval(interval);
            setIsVisualRolling(false);
            setVisualDiceValue(gameState.diceValue);
          }
        }, 90);
      }
    } else if (!gameState.diceRolled) {
      // Clear visual dice value on new turn
      setVisualDiceValue(null);
      setIsVisualRolling(false);
    } else {
      // Keep static synchronization
      if (!isVisualRolling) {
        setVisualDiceValue(gameState.diceValue);
      }
    }

    prevDiceRolled.current = gameState.diceRolled;
    prevCurrentPlayerIndex.current = currentPlayerIndex;
  }, [gameState.diceRolled, gameState.diceValue, currentPlayerIndex, isOnlineMode, myPlayer, currentPlayer, gameState.status]);

  // Helper to render the dice dots based on its numeric value (1 to 6)
  const renderDiceDots = (val: number | null) => {
    if (!val) return <span className="text-slate-800 font-black text-xs uppercase tracking-wider font-sans">KOCOK</span>;

    const dotPositions: { [v: number]: string[] } = {
      1: ['col-start-2 row-start-2'],
      2: ['col-start-1 row-start-1', 'col-start-3 row-start-3'],
      3: ['col-start-1 row-start-1', 'col-start-2 row-start-2', 'col-start-3 row-start-3'],
      4: ['col-start-1 row-start-1', 'col-start-3 row-start-1', 'col-start-1 row-start-3', 'col-start-3 row-start-3'],
      5: ['col-start-1 row-start-1', 'col-start-3 row-start-1', 'col-start-2 row-start-2', 'col-start-1 row-start-3', 'col-start-3 row-start-3'],
      6: ['col-start-1 row-start-1', 'col-start-3 row-start-1', 'col-start-1 row-start-2', 'col-start-3 row-start-2', 'col-start-1 row-start-3', 'col-start-3 row-start-3'],
    };

    const dots = dotPositions[val] || [];
    const currentPlayerColorClass = currentPlayer ? getPlayerColorBg(currentPlayer.color) : 'bg-slate-900';

    return (
      <div className="grid grid-cols-3 grid-rows-3 gap-1.5 w-12 h-12 p-1 bg-transparent">
        {dots.map((pos, i) => (
          <div
            key={i}
            className={`w-3 h-3 rounded-full border border-white shadow-sm ${currentPlayerColorClass} ${pos}`}
          />
        ))}
      </div>
    );
  };

  // Color classes map
  const getPlayerColorText = (color: PlayerColor) => {
    const map = {
      red: 'text-red-500',
      green: 'text-emerald-500',
      yellow: 'text-amber-500',
      blue: 'text-blue-500',
    };
    return map[color] || 'text-slate-500';
  };

  const getPlayerColorBg = (color: PlayerColor) => {
    const map = {
      red: 'bg-red-500',
      green: 'bg-emerald-500',
      yellow: 'bg-amber-500',
      blue: 'bg-blue-500',
    };
    return map[color] || 'bg-slate-500';
  };

  const getPlayerBorderColor = (color: PlayerColor) => {
    const map = {
      red: 'border-red-500',
      green: 'border-emerald-500',
      yellow: 'border-amber-500',
      blue: 'border-blue-500',
    };
    return map[color] || 'border-slate-500';
  };

  return (
    <div className="bg-white border-4 border-slate-900 rounded-3xl p-5 shadow-[6px_6px_0px_rgba(255,127,17,1)] flex flex-col gap-6">
      {/* 1. SECTION: LIST OF CONTENDING PLAYERS */}
      <div>
        <h4 className="text-sm font-sans font-black text-brand-orange uppercase tracking-widest mb-3 border-b-2 border-dashed border-slate-200 pb-2 flex items-center gap-1.5">
          <User size={15} className="stroke-[2.5]" /> KONTESTAN LUDO
        </h4>
        <div className="flex flex-col gap-2.5">
          {players.map((p, idx) => {
            const isActive = idx === currentPlayerIndex && gameState.status === 'playing';
            const colorBg = getPlayerColorBg(p.color);
            const borderCol = getPlayerBorderColor(p.color);
            const finishedCount = tokens[p.color] ? tokens[p.color].filter(pos => pos === 56).length : 0;
            
            return (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className={`relative flex items-center justify-between p-3 rounded-2xl border-4 transition-all ${
                  isActive
                    ? `bg-amber-50/40 ${borderCol} shadow-[4px_4px_0px_rgba(0,0,0,1)]`
                    : 'bg-slate-50 border-slate-200'
                }`}
              >
                {/* Active Indicator Glow Bar */}
                {isActive && (
                  <div className={`absolute left-0 top-3 bottom-3 w-1.5 rounded-r-lg ${colorBg}`} />
                )}

                <div className="flex items-center gap-3 pl-1.5">
                  {/* Colored status box */}
                  <div className={`w-4 h-4 rounded-full ${colorBg} border-2 border-white flex items-center justify-center shrink-0`}>
                    <div className="w-1.5 h-1.5 bg-white rounded-full opacity-80 animate-pulse" />
                  </div>
                  
                  <div className="flex flex-col">
                    <span className="text-sm font-black text-slate-800 uppercase tracking-tight flex items-center gap-1.5">
                      {p.name}
                      {p.isHost && (
                        <Shield size={12} className="text-brand-orange fill-brand-orange stroke-[2]" title="Host Lobi" />
                      )}
                      {p.isBot && (
                        <Bot size={13} className="text-brand-cyan stroke-[2]" title="AI Computer Player" />
                      )}
                      {myPlayer && p.id === myPlayer.id && (
                        <span className="text-[9px] bg-slate-900 text-white font-sans font-black px-1.5 py-0.5 rounded-full border border-slate-900">ANDA</span>
                      )}
                    </span>
                    
                    {/* Bidak Finished Tracker */}
                    <span className="text-[11px] text-slate-500 font-sans font-bold flex items-center gap-1 uppercase tracking-wide">
                      BIDAK FINISH: <strong className="text-slate-900 font-black">{finishedCount}/4</strong>
                    </span>
                  </div>
                </div>

                {/* Connection Status badge */}
                <div className="flex items-center gap-2">
                  {isOnlineMode && !p.isBot ? (
                    p.isOnline ? (
                      <span className="text-brand-cyan flex items-center gap-1 text-[10px] font-mono uppercase tracking-widest font-bold">
                        <Wifi size={12} className="stroke-[2.5]" /> ON
                      </span>
                    ) : (
                      <span className="text-red-500 flex items-center gap-1 text-[10px] font-mono uppercase tracking-widest font-bold">
                        <WifiOff size={12} className="stroke-[2.5]" /> OFF
                      </span>
                    )
                  ) : null}

                  {/* Turn Status overlay */}
                  {isActive && (
                    <span className={`text-[10px] font-sans font-black uppercase tracking-widest px-2.5 py-1 rounded-xl ${colorBg} text-white shadow-sm`}>
                      GILIRAN
                    </span>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* 2. SECTION: INTERACTIVE DICE ROLLER */}
      {gameState.status === 'playing' && (
        <div className="bg-amber-50/20 border-4 border-slate-900 p-5 rounded-2xl flex flex-col items-center gap-5 text-center shadow-[inset_3px_3px_0px_rgba(0,0,0,0.02)]">
          <div className="flex flex-col items-center">
            <span className="text-xs font-sans font-black text-slate-500 uppercase tracking-widest mb-1">
              DADU {currentPlayer ? `${currentPlayer.name}`.toUpperCase() : ''}
            </span>
            <span className="text-[11px] text-brand-orange font-sans font-black uppercase tracking-wide">
              {currentPlayer?.isBot ? '🤖 AI SEDANG BERPIKIR...' : 'KAMPANYEKAN DADU ANDA!'}
            </span>
          </div>

          <div className="relative flex items-center justify-center h-28">
            <AnimatePresence mode="wait">
              {isRollingLocal || isVisualRolling ? (
                // Dice rolling animation
                <motion.div
                  key="rolling-dice"
                  animate={{
                    rotate: [0, 90, 180, 270, 360, 450, 540],
                    x: [0, -12, 18, -18, 12, -6, 0],
                    y: [0, -18, 6, -12, 6, -3, 0],
                    scale: [1, 1.2, 0.9, 1.1, 1],
                  }}
                  transition={{ duration: 0.8, ease: 'easeInOut' }}
                  className="w-18 h-18 bg-white rounded-2xl shadow-[4px_4px_0px_rgba(255,127,17,0.3)] flex items-center justify-center border-4 border-brand-orange"
                >
                  <Dices className={`w-10 h-10 ${currentPlayer ? getPlayerColorText(currentPlayer.color) : 'text-slate-800'} animate-pulse`} />
                </motion.div>
              ) : (
                // Stationary or static dice
                <motion.button
                  key="idle-dice"
                  onClick={handleRollClick}
                  disabled={!isMyTurnToRoll() || isRollingLocal || isVisualRolling}
                  whileHover={isMyTurnToRoll() ? { scale: 1.08, rotate: 3 } : {}}
                  whileTap={isMyTurnToRoll() ? { scale: 0.95 } : {}}
                  className={`w-18 h-18 rounded-2xl flex items-center justify-center shadow-md transition-all border-4 ${
                    isMyTurnToRoll()
                      ? `bg-white text-black cursor-pointer border-brand-orange shadow-[5px_5px_0px_#0EA5E9]`
                      : 'bg-slate-100 opacity-60 cursor-not-allowed border-slate-300 text-slate-400'
                  }`}
                >
                  {renderDiceDots(visualDiceValue)}
                </motion.button>
              )}
            </AnimatePresence>

            {/* Glowing active border overlay on the roller area */}
            {isMyTurnToRoll() && !isRollingLocal && !isVisualRolling && (
              <div className="absolute inset-0 -m-3 border-4 border-dashed border-brand-cyan/40 animate-pulse pointer-events-none rounded-2xl" />
            )}
          </div>

          {/* Dice instructions action button */}
          <button
            onClick={handleRollClick}
            disabled={!isMyTurnToRoll() || isRollingLocal || isVisualRolling}
            className={`w-full py-3.5 rounded-2xl font-black text-sm uppercase tracking-widest border-4 border-slate-900 transition-all shadow-[4px_4px_0px_rgba(0,0,0,1)] ${
              isMyTurnToRoll()
                ? `${getPlayerColorBg(currentPlayer.color)} text-white hover:bg-slate-900 hover:text-white hover:border-slate-900 active:translate-y-1 active:shadow-none cursor-pointer`
                : 'bg-slate-100 border-slate-300 text-slate-400 shadow-none cursor-not-allowed'
            }`}
          >
            {isRollingLocal || isVisualRolling 
              ? 'MENGOKOK...' 
              : diceRolled 
                ? 'SELESAI KOCAK' 
                : isMyTurnToRoll() 
                  ? 'KOCOK DADU!' 
                  : 'MENUNGGU...'}
          </button>
        </div>
      )}

      {/* 3. GAME RUN LOG INFO PANEL */}
      <div className="bg-sky-50 border-4 border-slate-900 p-4 rounded-2xl flex items-start gap-3 shadow-[4px_4px_0px_rgba(14,165,233,0.08)]">
        <CircleAlert size={18} className="text-brand-orange shrink-0 mt-0.5 stroke-[2.5]" />
        <div className="flex flex-col">
          <span className="text-[10px] font-mono font-black text-brand-cyan uppercase tracking-widest">// LOG PERTANDINGAN //</span>
          <p className="text-xs text-slate-700 font-sans font-bold mt-1 leading-relaxed">
            {gameState.lastActionDescription}
          </p>
        </div>
      </div>
    </div>
  );
};
