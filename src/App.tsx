/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { Player, GameState, PlayerColor, ServerMessage, ChatMessage } from './types';
import { LudoBoard } from './components/LudoBoard';
import { GameControls } from './components/GameControls';
import { LudoLobby } from './components/LudoLobby';
import { GeminiCommentary } from './components/GeminiCommentary';
import {
  rollDiceValue,
  getValidMoves,
  checkCaptures,
  checkWinner,
  getNextPlayerIndex,
  calculateBotMove,
} from './gameLogic';
import { ArrowLeft, Wifi, WifiOff, HelpCircle, X, Sparkles, Trophy, Volume2, VolumeX, Music } from 'lucide-react';
import { sfx } from './utils/audio';
import { ConfettiCelebration } from './components/ConfettiCelebration';

const LOCAL_PLAYER_ID = 'local-user';

export default function App() {
  const [isOnlineMode, setIsOnlineMode] = useState<boolean | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [myPlayer, setMyPlayer] = useState<Player | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [showRulesOverlay, setShowRulesOverlay] = useState(false);

  const [isSfxMuted, setIsSfxMuted] = useState(sfx.getMuted());
  const [isBgmMuted, setIsBgmMuted] = useState(sfx.getBgmMuted());
  const prevDiceRolledRef = useRef(false);
  const prevStatusRef = useRef<'waiting' | 'playing' | 'finished' | null>(null);

  const handleToggleSfx = () => {
    const nextMuted = sfx.toggleMuted();
    setIsSfxMuted(nextMuted);
  };

  const handleToggleBgm = () => {
    const nextMuted = sfx.toggleBgmMuted();
    setIsBgmMuted(nextMuted);
  };

  // Start background music loop on first user interaction (browser autoplay guard bypass)
  useEffect(() => {
    const startBgmOnInteraction = () => {
      sfx.playBgm();
      window.removeEventListener('click', startBgmOnInteraction);
      window.removeEventListener('touchstart', startBgmOnInteraction);
      window.removeEventListener('keydown', startBgmOnInteraction);
    };

    window.addEventListener('click', startBgmOnInteraction);
    window.addEventListener('touchstart', startBgmOnInteraction);
    window.addEventListener('keydown', startBgmOnInteraction);

    // Attempt immediately (might be blocked, which is fine as interaction handles it)
    sfx.playBgm();

    return () => {
      window.removeEventListener('click', startBgmOnInteraction);
      window.removeEventListener('touchstart', startBgmOnInteraction);
      window.removeEventListener('keydown', startBgmOnInteraction);
    };
  }, []);

  // Monitor GameState to automatically play dice rolls for bots/other players, and victory fanfares
  useEffect(() => {
    if (!gameState) return;

    // 1. Play dice roll rattle if dice was just rolled by someone else (bots, online opponents)
    if (gameState.diceRolled && !prevDiceRolledRef.current) {
      const currentPlayer = gameState.players[gameState.currentPlayerIndex];
      const isMyTurn = myPlayer && currentPlayer && myPlayer.id === currentPlayer.id;
      
      // If it's a bot's turn, or an online opponent's turn, trigger the sound
      if (!isMyTurn || currentPlayer?.isBot) {
        sfx.playRoll();
      }
    }
    prevDiceRolledRef.current = gameState.diceRolled;

    // 2. Play victory fanfare when the game finishes
    if (gameState.status === 'finished' && prevStatusRef.current !== 'finished') {
      sfx.playVictory();
    }
    prevStatusRef.current = gameState.status;
  }, [gameState, myPlayer]);

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Retrieve saved player info on mount
  useEffect(() => {
    const savedRoomId = localStorage.getItem('ludo_room_id');
    const savedPlayerId = localStorage.getItem('ludo_player_id');
    const savedMode = localStorage.getItem('ludo_mode');

    if (savedMode === 'online' && savedRoomId && savedPlayerId) {
      setIsOnlineMode(true);
      connectWebSocket(savedRoomId, savedPlayerId);
    } else if (savedMode === 'local') {
      setIsOnlineMode(false);
      initializeLocalGame();
    }
  }, []);

  // ---------------------------------------------------------------------------
  // 1. WEBSOCKET CONNECTION ENGINE (ONLINE MODE)
  // ---------------------------------------------------------------------------
  const connectWebSocket = (roomId: string | null, playerId: string, isCreateRoom: boolean = false, name: string = '') => {
    setIsConnecting(true);
    setConnectionError(null);

    if (socketRef.current) {
      try {
        socketRef.current.close();
      } catch (err) {
        console.error('Error closing existing socket:', err);
      }
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const query = roomId ? `roomId=${roomId}&playerId=${playerId}` : `playerId=${playerId}`;
    const wsUrl = `${protocol}//${window.location.host}/ws?${query}`;
    
    console.log(`Connecting to WebSocket: ${wsUrl}`);
    const ws = new WebSocket(wsUrl);
    socketRef.current = ws;

    ws.onopen = () => {
      console.log('WebSocket Connection Opened!');
      setIsConnecting(false);
      reconnectAttemptsRef.current = 0;
      setConnectionError(null);

      if (isCreateRoom) {
        ws.send(JSON.stringify({
          type: 'create_room',
          playerName: name || localStorage.getItem('ludo_player_name') || 'Pemain 1',
        }));
      } else if (roomId) {
        ws.send(JSON.stringify({
          type: 'join_room',
          roomId,
          playerName: name || localStorage.getItem('ludo_player_name') || 'Pemain 1',
        }));
      }
    };

    ws.onmessage = (event) => {
      try {
        const message: ServerMessage = JSON.parse(event.data);
        console.log('Client received socket message:', message);

        switch (message.type) {
          case 'room_created':
          case 'room_joined': {
            if (message.roomId && message.playerId && message.state) {
              localStorage.setItem('ludo_room_id', message.roomId);
              localStorage.setItem('ludo_player_id', message.playerId);
              localStorage.setItem('ludo_mode', 'online');
              
              const matchedPlayer = message.state.players.find(p => p.id === message.playerId);
              if (matchedPlayer) {
                setMyPlayer(matchedPlayer);
                localStorage.setItem('ludo_player_name', matchedPlayer.name);
              }
              
              setGameState(message.state);
              setIsOnlineMode(true);
              setIsConnecting(false);
            }
            break;
          }

          case 'state_update': {
            if (message.state) {
              setGameState(message.state);
              const pId = localStorage.getItem('ludo_player_id');
              const matched = message.state.players.find(p => p.id === pId);
              if (matched) setMyPlayer(matched);
            }
            break;
          }

          case 'chat_message': {
            if (message.chat && message.state) {
              setGameState(message.state);
            }
            break;
          }

          case 'room_error': {
            setConnectionError(message.error || 'Terjadi kesalahan pada room.');
            setIsConnecting(false);
            break;
          }
        }
      } catch (err) {
        console.error('Error parsing socket message:', err);
      }
    };

    ws.onclose = (event) => {
      console.warn('WebSocket closed.', event);
      setIsConnecting(false);
      
      const savedRoomId = localStorage.getItem('ludo_room_id');
      const savedPlayerId = localStorage.getItem('ludo_player_id');
      const savedMode = localStorage.getItem('ludo_mode');
      
      if (savedMode === 'online' && savedRoomId && savedPlayerId && reconnectAttemptsRef.current < 5) {
        reconnectAttemptsRef.current++;
        const backoffDelay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 10000);
        console.log(`Scheduling reconnect attempt #${reconnectAttemptsRef.current} in ${backoffDelay}ms`);
        
        reconnectTimeoutRef.current = setTimeout(() => {
          connectWebSocket(savedRoomId, savedPlayerId);
        }, backoffDelay);
      } else if (reconnectAttemptsRef.current >= 5) {
        setConnectionError('Koneksi terputus dari server. Silakan muat ulang halaman.');
      }
    };

    ws.onerror = (err) => {
      console.error('WebSocket Error:', err);
      setConnectionError('Gagal terhubung ke server multiplayer. Coba muat ulang halaman.');
      setIsConnecting(false);
    };
  };

  const handleCreateOnlineRoom = (name: string) => {
    localStorage.setItem('ludo_player_name', name);
    const pId = `p-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    connectWebSocket(null, pId, true, name);
  };

  const handleJoinOnlineRoom = (name: string, roomId: string) => {
    localStorage.setItem('ludo_player_name', name);
    const pId = `p-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    connectWebSocket(roomId, pId, false, name);
  };

  const handleStartOnlineGame = () => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: 'start_game' }));
    }
  };

  const handleAddOnlineBot = (difficulty: 'easy' | 'medium' | 'hard') => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: 'add_bot', botDifficulty: difficulty }));
    }
  };

  const handleRemoveOnlineBot = (color: PlayerColor) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: 'remove_bot', botColor: color }));
    }
  };

  const handleRestartOnlineGame = () => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: 'restart_game' }));
    }
  };

  const handleSendOnlineChat = (message: string) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: 'send_chat', message }));
    }
  };

  const handleOnlineRollDice = () => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: 'roll_dice' }));
    }
  };

  const handleOnlineMoveToken = (tokenId: number) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: 'move_token', tokenId }));
    }
  };

  // ---------------------------------------------------------------------------
  // 2. LOCAL SIMULATOR ENGINE (OFFLINE MODE FALLBACK)
  // ---------------------------------------------------------------------------
  const initializeLocalGame = () => {
    localStorage.setItem('ludo_mode', 'local');
    const initialLocalState: GameState = {
      roomId: 'LOKAL',
      status: 'waiting',
      players: [
        {
          id: LOCAL_PLAYER_ID,
          name: localStorage.getItem('ludo_player_name') || 'Pemain Utama',
          color: 'red',
          isBot: false,
          isHost: true,
          isOnline: true,
          joinedAt: Date.now(),
        }
      ],
      currentPlayerIndex: 0,
      tokens: {
        red: [-1, -1, -1, -1],
        green: [-1, -1, -1, -1],
        yellow: [-1, -1, -1, -1],
        blue: [-1, -1, -1, -1],
      },
      diceValue: null,
      diceRolled: false,
      consecutiveSixesCount: 0,
      hasMovedThisTurn: false,
      winnerColor: null,
      chatHistory: [],
      lastActionDescription: 'Game lokal dikonfigurasi. Tambahkan bot komputer atau mulai sekarang!',
    };

    setGameState(initialLocalState);
    setMyPlayer(initialLocalState.players[0]);
  };

  const handleAddLocalBot = (difficulty: 'easy' | 'medium' | 'hard') => {
    if (!gameState) return;
    if (gameState.players.length >= 4) return;

    const availableColors: PlayerColor[] = ['red', 'green', 'yellow', 'blue'];
    const takenColors = gameState.players.map(p => p.color);
    const color = availableColors.find(c => !takenColors.includes(c));
    if (!color) return;

    const botNames: { [c in PlayerColor]: string } = {
      red: '🤖 Komputer Merah',
      green: '🤖 Komputer Hijau',
      yellow: '🤖 Komputer Kuning',
      blue: '🤖 Komputer Biru',
    };

    const newBot: Player = {
      id: `bot-${color}-${Date.now()}`,
      name: `${botNames[color]} (${difficulty.toUpperCase()})`,
      color,
      isBot: true,
      botDifficulty: difficulty,
      isHost: false,
      isOnline: true,
      joinedAt: Date.now(),
    };

    const updated = {
      ...gameState,
      players: [...gameState.players, newBot],
      lastActionDescription: `${newBot.name} ditambahkan ke dalam game.`,
    };
    setGameState(updated);
  };

  const handleRemoveLocalBot = (color: PlayerColor) => {
    if (!gameState) return;
    const filtered = gameState.players.filter(p => !(p.isBot && p.color === color));
    setGameState({
      ...gameState,
      players: filtered,
      lastActionDescription: `Bot warna ${color.toUpperCase()} dikeluarkan.`,
    });
  };

  const handleStartLocalGame = () => {
    if (!gameState || gameState.players.length < 2) return;
    
    const updated: GameState = {
      ...gameState,
      status: 'playing',
      currentPlayerIndex: 0,
      diceValue: null,
      diceRolled: false,
      consecutiveSixesCount: 0,
      hasMovedThisTurn: false,
      winnerColor: null,
      tokens: {
        red: [-1, -1, -1, -1],
        green: [-1, -1, -1, -1],
        yellow: [-1, -1, -1, -1],
        blue: [-1, -1, -1, -1],
      },
      lastActionDescription: `Pertandingan dimulai! Giliran pertama: ${gameState.players[0].name}.`,
    };
    setGameState(updated);
  };

  const handleLocalRollDice = () => {
    if (!gameState || gameState.status !== 'playing') return;
    if (gameState.diceRolled) return;

    const roll = rollDiceValue();
    const activePlayer = gameState.players[gameState.currentPlayerIndex];
    const pTokens = gameState.tokens[activePlayer.color];
    const validMoves = getValidMoves(pTokens, roll);

    let nextState = {
      ...gameState,
      diceValue: roll,
      diceRolled: true,
      lastActionDescription: `${activePlayer.name} mengocok dadu dan dapet angka ${roll}.`,
    };

    if (validMoves.length === 0) {
      nextState.lastActionDescription += ` Tidak ada langkah valid. Giliran dialihkan.`;
      setGameState(nextState);

      // Auto pass turn after delay
      setTimeout(() => {
        setGameState(current => {
          if (!current || current.status !== 'playing') return current;
          const nextIdx = getNextPlayerIndex(current.currentPlayerIndex, current.players);
          const nextP = current.players[nextIdx];
          return {
            ...current,
            currentPlayerIndex: nextIdx,
            diceValue: null,
            diceRolled: false,
            consecutiveSixesCount: 0,
            hasMovedThisTurn: false,
            lastActionDescription: `Sekarang giliran ${nextP.name}.`,
          };
        });
      }, 1800);
      return;
    }

    setGameState(nextState);
  };

  const handleLocalMoveToken = (tokenId: number) => {
    if (!gameState || gameState.status !== 'playing') return;
    if (!gameState.diceRolled || gameState.diceValue === null) return;

    const activePlayer = gameState.players[gameState.currentPlayerIndex];
    const roll = gameState.diceValue;
    const pTokens = [...gameState.tokens[activePlayer.color]];

    const oldPos = pTokens[tokenId];
    const newPos = oldPos === -1 ? 0 : oldPos + roll;
    pTokens[tokenId] = newPos;

    const nextTokens = {
      ...gameState.tokens,
      [activePlayer.color]: pTokens,
    };

    let actionLog = `${activePlayer.name} melangkahkan Bidak #${tokenId + 1} sebanyak ${roll} langkah.`;

    // Check Captures
    const captures = checkCaptures(activePlayer.color, newPos, nextTokens);
    if (captures.length > 0) {
      for (const cap of captures) {
        nextTokens[cap.color][cap.tokenIndex] = -1;
        const victim = gameState.players.find(p => p.color === cap.color);
        actionLog += ` Bidak #${cap.tokenIndex + 1} milik ${victim ? victim.name : cap.color} dicaplok dan pulang kandang!`;
      }
    }

    // Check winner
    const winner = checkWinner(nextTokens);
    if (winner) {
      const winnerPlayer = gameState.players.find(p => p.color === winner);
      setGameState({
        ...gameState,
        status: 'finished',
        winnerColor: winner,
        tokens: nextTokens,
        lastActionDescription: `🏆 PERTANDINGAN SELESAI! ${winnerPlayer ? winnerPlayer.name : winner.toUpperCase()} MENANG MUTLAK!`,
      });
      return;
    }

    // Consecutive Sixes Check
    let hasBonusRoll = roll === 6 || captures.length > 0 || newPos === 56;
    let currentSixes = gameState.consecutiveSixesCount;

    if (roll === 6) {
      currentSixes++;
      if (currentSixes >= 3) {
        actionLog += ` (Tiga angka 6 berturut-turut! Dadu meleleh dan giliran dilewati).`;
        hasBonusRoll = false;
        currentSixes = 0;
      }
    } else {
      currentSixes = 0;
    }

    let nextState: GameState = {
      ...gameState,
      tokens: nextTokens,
      consecutiveSixesCount: currentSixes,
      lastActionDescription: actionLog,
    };

    if (hasBonusRoll) {
      nextState.lastActionDescription += ` Mendapat bonus giliran lempar lagi!`;
      nextState.diceValue = null;
      nextState.diceRolled = false;
      nextState.hasMovedThisTurn = false;
    } else {
      // Pass standard turn
      const nextIdx = getNextPlayerIndex(gameState.currentPlayerIndex, gameState.players);
      const nextP = gameState.players[nextIdx];
      
      nextState.currentPlayerIndex = nextIdx;
      nextState.diceValue = null;
      nextState.diceRolled = false;
      nextState.consecutiveSixesCount = 0;
      nextState.hasMovedThisTurn = false;
      nextState.lastActionDescription += ` Sekarang giliran ${nextP.name}.`;
    }

    setGameState(nextState);
  };

  const handleSendLocalChat = (message: string) => {
    if (!gameState) return;
    const chat: ChatMessage = {
      id: `chat-${Date.now()}`,
      senderName: myPlayer ? myPlayer.name : 'Pemain',
      senderColor: myPlayer ? myPlayer.color : undefined,
      message,
      timestamp: Date.now(),
    };

    setGameState({
      ...gameState,
      chatHistory: [...gameState.chatHistory, chat],
    });
  };

  const handleRestartLocalGame = () => {
    if (!gameState) return;
    setGameState({
      ...gameState,
      status: 'playing',
      currentPlayerIndex: 0,
      diceValue: null,
      diceRolled: false,
      consecutiveSixesCount: 0,
      hasMovedThisTurn: false,
      winnerColor: null,
      tokens: {
        red: [-1, -1, -1, -1],
        green: [-1, -1, -1, -1],
        yellow: [-1, -1, -1, -1],
        blue: [-1, -1, -1, -1],
      },
      lastActionDescription: `Game di-restart! Giliran pertama: ${gameState.players[0].name}.`,
    });
  };

  // ---------------------------------------------------------------------------
  // 3. RECURSIVE BOT AUTOMATION SIMULATOR FOR LOCAL MODE
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (isOnlineMode) return; // Online bots are fully handled server-side
    if (!gameState || gameState.status !== 'playing') return;

    const activePlayer = gameState.players[gameState.currentPlayerIndex];
    if (!activePlayer || !activePlayer.isBot) return;

    // Trigger local bot move after some delay
    const botTimer = setTimeout(() => {
      // 1. Roll Dice automatically
      if (!gameState.diceRolled) {
        handleLocalRollDice();
        return;
      }

      // 2. Decide move
      if (gameState.diceValue !== null) {
        const botTokens = gameState.tokens[activePlayer.color];
        const moves = getValidMoves(botTokens, gameState.diceValue);

        if (moves.length === 0) {
          // Fallback, handled by timeout in dice roller
          return;
        }

        const bestToken = calculateBotMove(gameState, activePlayer.color, gameState.diceValue, activePlayer.botDifficulty);
        if (bestToken !== null) {
          handleLocalMoveToken(bestToken);
        }
      }
    }, 1500);

    return () => clearTimeout(botTimer);
  }, [gameState, isOnlineMode]);

  // Clean up timeouts
  useEffect(() => {
    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    };
  }, []);

  // ---------------------------------------------------------------------------
  // 4. MAIN DISPATCHER HOOKS
  // ---------------------------------------------------------------------------
  const handleRollDice = () => {
    if (isOnlineMode) handleOnlineRollDice();
    else handleLocalRollDice();
  };

  const handleTokenClick = (tokenId: number) => {
    if (isOnlineMode) handleOnlineMoveToken(tokenId);
    else handleLocalMoveToken(tokenId);
  };

  const handleSendChat = (message: string) => {
    if (isOnlineMode) handleSendOnlineChat(message);
    else handleSendLocalChat(message);
  };

  const handleLeaveRoom = () => {
    localStorage.removeItem('ludo_room_id');
    localStorage.removeItem('ludo_player_id');
    localStorage.removeItem('ludo_mode');
    
    if (socketRef.current) {
      socketRef.current.close();
    }
    
    setGameState(null);
    setMyPlayer(null);
    setIsOnlineMode(null);
    setConnectionError(null);
  };

  // Pre-calculate valid token indices that can be moved with current roll
  const validTokenMoves = (() => {
    if (!gameState || gameState.status !== 'playing') return [];
    if (!gameState.diceRolled || gameState.diceValue === null) return [];

    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    if (!currentPlayer) return [];

    // Ensure it's the client player's turn (in online mode)
    if (isOnlineMode && myPlayer && currentPlayer.id !== myPlayer.id) return [];

    return getValidMoves(gameState.tokens[currentPlayer.color], gameState.diceValue);
  })();

  // Render entry select view if mode is null
  if (isOnlineMode === null) {
    return (
      <div className="min-h-screen bg-brand-dark flex flex-col justify-between text-white selection:bg-brand-cyan selection:text-black">
        <LudoLobby
          gameState={null}
          myPlayer={null}
          onEnterLocalMode={() => {
            setIsOnlineMode(false);
            initializeLocalGame();
          }}
          onCreateRoom={handleCreateOnlineRoom}
          onJoinRoom={handleJoinOnlineRoom}
          onAddBot={() => {}}
          onRemoveBot={() => {}}
          onStartGame={() => {}}
          onBack={handleLeaveRoom}
          isConnecting={isConnecting}
          connectionError={connectionError}
        />

      </div>
    );
  }

  // Render waiting lobby view if game hasn't started
  if (gameState && gameState.status === 'waiting') {
    return (
      <div className="min-h-screen bg-brand-dark flex flex-col text-white">
        {/* Connection errors */}
        {connectionError && (
          <div className="bg-red-950 border-b-4 border-red-800 text-red-200 text-xs py-3 px-4 text-center font-bold font-mono flex items-center justify-center gap-2 uppercase tracking-wide">
            <CircleAlertIcon size={14} /> ERROR: {connectionError}
            <button onClick={() => window.location.reload()} className="underline cursor-pointer hover:text-white font-black">RELOAD</button>
          </div>
        )}

        {isConnecting && (
          <div className="bg-slate-950 border-b-4 border-brand-cyan text-brand-cyan text-xs py-3 px-4 text-center font-mono font-black flex items-center justify-center gap-2 uppercase tracking-widest">
            <span className="w-2.5 h-2.5 bg-brand-cyan animate-ping" />
            CONNECTING TO SERVER LUDO...
          </div>
        )}

        <div className="flex-1 flex flex-col justify-center py-6">
          <LudoLobby
            gameState={gameState}
            myPlayer={myPlayer}
            onEnterLocalMode={() => {}}
            onCreateRoom={() => {}}
            onJoinRoom={() => {}}
            onAddBot={isOnlineMode ? handleAddOnlineBot : handleAddLocalBot}
            onRemoveBot={isOnlineMode ? handleRemoveOnlineBot : handleRemoveLocalBot}
            onStartGame={isOnlineMode ? handleStartOnlineGame : handleStartLocalGame}
            onBack={handleLeaveRoom}
            isConnecting={isConnecting}
            connectionError={connectionError}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FFFDF6] text-slate-800 flex flex-col">
      {/* Top Navigation Control bar */}
      <header className="bg-white border-b-2 sm:border-b-4 border-slate-900 px-3 py-2 sm:px-5 sm:py-3.5 shrink-0 flex items-center justify-between shadow-sm sticky top-0 z-30">
        <div className="flex items-center gap-2 sm:gap-4">
          <button
            onClick={handleLeaveRoom}
            className="flex items-center gap-1 sm:gap-1.5 text-[9px] sm:text-[10px] font-black font-sans uppercase tracking-wider text-slate-800 hover:bg-slate-100 border-2 border-slate-900 bg-white rounded-lg sm:rounded-xl px-2.5 py-1.5 sm:px-4 sm:py-2 transition-all cursor-pointer shadow-[2px_2px_0px_#000] sm:shadow-[3px_3px_0px_#000] active:translate-y-0.5"
            title="Keluar dari ruangan"
          >
            <ArrowLeft size={13} className="stroke-[3]" />
            <span className="hidden xs:inline">KELUAR</span>
          </button>
          
          <div className="h-4 sm:h-5 w-0.5 sm:w-1 bg-slate-300" />
          
          <div className="flex items-center gap-1.5 sm:gap-3">
            <span className="text-sm sm:text-xl font-black uppercase tracking-tight text-slate-900 font-sans">
              Ludo Bung AI
            </span>
            <span className="text-[8px] sm:text-[10px] bg-amber-50 border sm:border-2 border-slate-900 px-1.5 sm:px-2.5 py-0.5 rounded-full text-brand-orange font-sans font-black tracking-wider">
              {isOnlineMode ? `ROOM: ${gameState?.roomId}` : 'LOKAL'}
            </span>
          </div>
        </div>

        {/* Rules and Sound controls */}
        <div className="flex items-center gap-1.5 sm:gap-3">
          {/* BGM Toggle */}
          <button
            onClick={handleToggleBgm}
            className={`p-1.5 sm:p-2 border-2 transition-all cursor-pointer active:translate-y-0.5 rounded-lg sm:rounded-xl ${
              isBgmMuted
                ? 'border-slate-300 text-slate-400 bg-slate-50'
                : 'border-brand-orange text-brand-orange hover:bg-brand-orange hover:text-white bg-orange-50/50'
            }`}
            title={isBgmMuted ? 'Putar Musik Latar (BGM)' : 'Matikan Musik Latar (BGM)'}
          >
            <Music size={16} className="sm:w-[18px] sm:h-[18px] stroke-[2.5]" />
          </button>

          {/* SFX Toggle */}
          <button
            onClick={handleToggleSfx}
            className={`p-1.5 sm:p-2 border-2 transition-all cursor-pointer active:translate-y-0.5 rounded-lg sm:rounded-xl ${
              isSfxMuted
                ? 'border-slate-300 text-slate-400 bg-slate-50'
                : 'border-brand-cyan text-brand-cyan hover:bg-brand-cyan hover:text-white bg-sky-50'
            }`}
            title={isSfxMuted ? 'Aktifkan Suara Efek (SFX)' : 'Bisukan Suara Efek (SFX)'}
          >
            {isSfxMuted ? <VolumeX size={16} className="sm:w-[18px] sm:h-[18px] stroke-[2.5]" /> : <Volume2 size={16} className="sm:w-[18px] sm:h-[18px] stroke-[2.5]" />}
          </button>

          <button
            onClick={() => setShowRulesOverlay(true)}
            className="p-1.5 sm:p-2 border-2 border-slate-900 hover:bg-slate-100 text-slate-800 bg-white rounded-lg sm:rounded-xl transition-all cursor-pointer active:translate-y-0.5 shadow-[2px_2px_0px_#000]"
            title="Lihat Aturan"
          >
            <HelpCircle size={16} className="sm:w-[18px] sm:h-[18px] stroke-[2.5]" />
          </button>

          {isOnlineMode && (
            <div className="hidden xs:flex items-center gap-1.5 bg-emerald-50 border-2 border-emerald-500 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full">
              <Wifi size={12} className="text-emerald-600 animate-pulse" />
              <span className="text-[8px] sm:text-[9px] font-black text-emerald-700 uppercase tracking-widest font-sans">SYNCED</span>
            </div>
          )}
        </div>
      </header>

      {/* Main Grid: Responsive 1-col (Mobile), 2-col (Tablet md), 3-col (Desktop lg) */}
      {gameState && (
        <main className="flex-1 overflow-y-auto p-2 sm:p-4 lg:p-6 grid grid-cols-1 md:grid-cols-12 gap-3 sm:gap-4 lg:gap-6 max-w-7xl mx-auto w-full">
          {/* Column 1: Ludo Board Graphic */}
          <div className="md:col-span-7 lg:col-span-6 flex flex-col justify-center items-center w-full">
            <LudoBoard
              gameState={gameState}
              myPlayer={myPlayer}
              onTokenClick={handleTokenClick}
              validTokenMoves={validTokenMoves}
            />
          </div>

          {/* Column 2: Interactive Controls and Players panel */}
          <div className="md:col-span-5 lg:col-span-3 flex flex-col gap-3 sm:gap-6 justify-center w-full">
            <GameControls
              gameState={gameState}
              myPlayer={myPlayer}
              onRollDice={handleRollDice}
              isOnlineMode={isOnlineMode}
            />
          </div>

          {/* Column 3: Gemini Commentator & Real-Time Chats */}
          <div className="col-span-1 md:col-span-12 lg:col-span-3 flex flex-col justify-center w-full">
            <GeminiCommentary
              gameState={gameState}
              myPlayer={myPlayer}
              onSendChat={handleSendChat}
            />
          </div>
        </main>
      )}

      {/* RESTART OVERLAY BUTTON (FOR FINISHED STATE) */}
      {gameState && gameState.status === 'finished' && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 z-50 animate-fade-in">
          <motion.div
            initial={{ y: -10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="bg-white border-4 border-slate-900 p-5 sm:p-8 rounded-2xl sm:rounded-3xl shadow-[6px_6px_0px_rgba(255,127,17,1)] sm:shadow-[8px_8px_0px_rgba(255,127,17,1)] max-w-sm w-full text-center flex flex-col items-center max-h-[90vh] overflow-y-auto"
          >
            <div className="w-16 h-16 bg-amber-50 border-4 border-brand-orange flex items-center justify-center mb-4 rounded-2xl shadow-[4px_4px_0px_rgba(0,0,0,1)]">
              <Trophy className="w-8 h-8 text-brand-orange animate-bounce" />
            </div>
            
            <h3 className="text-2xl font-black text-slate-900 font-sans uppercase tracking-tight">PERTANDINGAN SELESAI</h3>
            <p className="text-[11px] font-sans font-bold uppercase text-slate-500 mt-2 max-w-xs mb-6 leading-relaxed">
              🎉 Bidak warna <strong className="text-brand-cyan font-black uppercase">{gameState.winnerColor}</strong> telah berhasil memenangkan pertandingan! Ingin melakukan tarung ulang?
            </p>

            <div className="flex gap-3 w-full">
              <button
                onClick={handleLeaveRoom}
                className="flex-1 py-3 border-4 border-slate-900 hover:bg-slate-100 bg-white rounded-2xl text-xs font-black uppercase font-sans text-slate-800 transition-all cursor-pointer active:translate-y-0.5 shadow-[3px_3px_0px_#000]"
              >
                KELUAR
              </button>
              <button
                onClick={isOnlineMode ? handleRestartOnlineGame : handleRestartLocalGame}
                className="flex-1 py-3 bg-brand-orange border-4 border-slate-900 hover:bg-amber-400 text-white font-black uppercase font-sans text-xs transition-all cursor-pointer active:translate-y-0.5 shadow-[3px_3px_0px_#000]"
              >
                TARUNG ULANG!
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* RULES MANUAL OVERLAY MODAL */}
      {showRulesOverlay && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white border-4 border-slate-900 max-w-md rounded-3xl shadow-[8px_8px_0px_rgba(14,165,233,1)] overflow-hidden w-full">
            <div className="bg-amber-50/50 border-b-4 border-slate-900 px-5 py-4 flex items-center justify-between">
              <span className="text-xs font-black font-sans tracking-wider text-brand-orange flex items-center gap-1.5 uppercase">
                <Sparkles size={14} className="fill-brand-orange text-brand-orange" /> BUKU ATURAN LUDO BUNG AI
              </span>
              <button
                onClick={() => setShowRulesOverlay(false)}
                className="p-1.5 text-slate-500 hover:bg-slate-100 border-2 border-slate-200 hover:border-slate-900 rounded-xl transition-all cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 max-h-[400px] overflow-y-auto text-[11px] font-sans font-bold text-slate-600 flex flex-col gap-5 leading-relaxed uppercase">
              <div>
                <strong className="text-slate-900 text-xs block mb-1 font-black text-brand-cyan tracking-wider">// 1. PELEPASAN BIDAK DARI KANDANG</strong>
                <p>Anda harus mendapatkan angka dadu <strong className="text-slate-900">6</strong> untuk bisa meluncurkan bidak baru keluar dari kandang menuju jalur star.</p>
              </div>

              <div>
                <strong className="text-slate-900 text-xs block mb-1 font-black text-brand-cyan tracking-wider">// 2. LEMPARAN DADU BONUS</strong>
                <p>Setiap kali Anda mendapatkan angka <strong className="text-slate-900">6</strong>, memakan bidak lawan, atau memasukkan bidak ke gawang FINISH, Anda berhak mendapatkan bonus lemparan dadu lagi secara gratis!</p>
              </div>

              <div>
                <strong className="text-slate-900 text-xs block mb-1 font-black text-brand-cyan tracking-wider">// 3. ATURAN BATAS ANGKA 6</strong>
                <p>Jika seorang pemain mengocok dadu angka <strong className="text-slate-900">6 tiga kali berturut-turut</strong>, gilirannya secara otomatis dibatalkan karena dinilai hoki yang mencurigakan (Over-Hoki system skip)!</p>
              </div>

              <div>
                <strong className="text-slate-900 text-xs block mb-1 font-black text-brand-cyan tracking-wider">// 4. AREA AMAN (SAFE ZONES)</strong>
                <p>Setiap petak yang bertanda gambar bintang cyan, jalur star warna masing-masing, serta kolom rumah berwarna adalah <strong className="text-slate-900">ZONA AMAN</strong>. Bidak Anda tidak akan bisa dicaplok/dimakan oleh lawan saat berada di zona aman.</p>
              </div>

              <div>
                <strong className="text-slate-900 text-xs block mb-1 font-black text-brand-cyan tracking-wider">// 5. MEMAKAN BIDAK (CAPTURES)</strong>
                <p>Jika bidak Anda mendarat di petak luar biasa yang sudah ditempati bidak lawan, bidak lawan tersebut akan <strong className="text-slate-900">dicaplok/dimakan</strong> dan langsung terbang pulang ke kandangnya dalam posisi -1.</p>
              </div>
            </div>

            <div className="bg-slate-50 px-5 py-4 border-t-2 border-slate-100 text-center">
              <button
                onClick={() => setShowRulesOverlay(false)}
                className="w-full bg-brand-cyan text-white border-4 border-slate-900 shadow-[4px_4px_0px_#000] py-3 rounded-2xl text-xs font-black uppercase font-sans tracking-widest transition-all cursor-pointer hover:bg-sky-400 hover:text-slate-900 active:translate-y-0.5 active:shadow-none"
              >
                SAYA MENGERTI!
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confetti Celebration on Victory */}
      {gameState?.status === 'finished' && <ConfettiCelebration />}
    </div>
  );
}

// Inline fallback icons for safety
function CircleAlertIcon({ size }: { size: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}
