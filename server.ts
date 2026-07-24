/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import http from 'http';
import path from 'path';
import { WebSocket, WebSocketServer } from 'ws';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { GameState, Player, PlayerColor, ClientMessage, ServerMessage, ChatMessage } from './src/types';
import {
  rollDiceValue,
  getValidMoves,
  checkCaptures,
  checkWinner,
  getNextPlayerIndex,
  calculateBotMove,
  PLAYER_START_INDEX,
  TRACK_COORDS,
} from './src/gameLogic';

dotenv.config();

const app = express();
const server = http.createServer(app);
const PORT = Number(process.env.PORT || 8000);

// Enable JSON body parsing for API endpoints
app.use(express.json());

// In-memory rooms repository
const rooms = new Map<string, GameState>();

// Sockets mapped to player sessions: roomId -> Map<playerId, WebSocket>
const roomSockets = new Map<string, Map<string, WebSocket>>();

// Lazy-initialized Gemini Client
let geminiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI | null {
  if (!geminiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (key && key !== 'MY_GEMINI_API_KEY') {
      try {
        geminiClient = new GoogleGenAI({
          apiKey: key,
          httpOptions: {
            headers: {
              'User-Agent': 'aistudio-build',
            },
          },
        });
        console.log('Gemini client successfully initialized');
      } catch (err) {
        console.error('Failed to initialize Gemini client:', err);
      }
    } else {
      console.warn('GEMINI_API_KEY is not defined or is placeholder. AI commentary will fall back to local responses.');
    }
  }
  return geminiClient;
}

/**
 * Generate witty AI Commentary on Ludo events using Gemini
 */
async function generateAICommentary(eventDescription: string, state: GameState): Promise<string> {
  const client = getGeminiClient();
  const playerColors = state.players.map(p => `${p.name} (${p.color.toUpperCase()})`).join(', ');
  
  const fallbackCommentary = `Bung komentator: "Aksi luar biasa! ${eventDescription}. Ludo semakin seru!"`;

  if (!client) {
    return fallbackCommentary;
  }

  try {
    const systemPrompt = `Anda adalah seorang komentator pertandingan Ludo profesional yang sangat lucu, jenaka, dan ekspresif dalam bahasa Indonesia gaul/slang. 
Gunakan kosakata khas tongkrongan Indonesia (seperti 'hoki', 'ciamik', 'ampas', 'kocak', 'beban', 'santuy', 'gas', 'gokil').
Tugas Anda adalah mengomentari kejadian terbaru di game Ludo. Berikan komentar yang pendek (maksimal 2 kalimat), humoris, dan sedikit menyindir tapi tetap ramah dan menghibur.

Daftar Pemain saat ini: ${playerColors}.
Keadaan Bidak: ${JSON.stringify(state.tokens)}.
Kejadian terbaru: "${eventDescription}"`;

    const response = await client.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: 'Tulis komentar reaksi Anda!',
      config: {
        systemInstruction: systemPrompt,
        temperature: 1.0,
      },
    });

    if (response.text) {
      return response.text.trim();
    }
  } catch (error) {
    console.error('Error generating AI commentary with Gemini:', error);
  }
  return fallbackCommentary;
}

/**
 * Generate a random 6-character room code
 */
function generateRoomCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Broadcast message to all connected players in a room
 */
function broadcastToRoom(roomId: string, message: ServerMessage) {
  const sockets = roomSockets.get(roomId);
  if (!sockets) return;

  const payload = JSON.stringify(message);
  for (const [playerId, ws] of sockets.entries()) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
    }
  }
}

/**
 * Trigger Gemini AI Commentary and broadcast to room
 */
async function triggerAICommentary(eventDescription: string, state: GameState, delayMs: number = 500, isExtraordinary: boolean = false) {
  setTimeout(async () => {
    try {
      const commentary = await generateAICommentary(eventDescription, state);
      broadcastToRoom(state.roomId, {
        type: 'ai_commentary',
        commentary,
      });
      
      // Add commentary as a system chat message for history log
      const systemMessage: ChatMessage = {
        id: `sys-${Date.now()}-${Math.random()}`,
        senderName: '🎙️ Bung Ludo',
        message: commentary,
        timestamp: Date.now(),
        isExtraordinary,
      };
      state.chatHistory.push(systemMessage);
      if (state.chatHistory.length > 50) state.chatHistory.shift();
      
      broadcastToRoom(state.roomId, {
        type: 'state_update',
        state,
      });
    } catch (e) {
      console.error(e);
    }
  }, delayMs);
}

/**
 * Initialize a new game state
 */
function createInitialState(roomId: string): GameState {
  return {
    roomId,
    status: 'waiting',
    players: [],
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
    lastActionDescription: 'Lobi game dibuat. Menunggu pemain lain...',
  };
}

/**
 * Check and execute bot turn recursively if necessary
 */
async function processBotTurnsIfNeeded(roomId: string) {
  const state = rooms.get(roomId);
  if (!state || state.status !== 'playing') return;

  const activePlayer = state.players[state.currentPlayerIndex];
  if (!activePlayer || !activePlayer.isBot) return;

  // Wait 1.5 seconds to simulate a natural bot thinking time
  await new Promise(resolve => setTimeout(resolve, 1500));

  // Fetch updated state in case anything changed
  const currentState = rooms.get(roomId);
  if (!currentState || currentState.status !== 'playing') return;

  // Roll dice for Bot
  const roll = rollDiceValue();
  currentState.diceValue = roll;
  currentState.diceRolled = true;
  
  let actionLog = `${activePlayer.name} (${activePlayer.color.toUpperCase()}) mengocok dadu dan mendapatkan angka ${roll}.`;
  console.log(`Bot rolling: ${activePlayer.name} got ${roll}`);

  const botTokens = currentState.tokens[activePlayer.color];
  const validMoves = getValidMoves(botTokens, roll);

  if (validMoves.length === 0) {
    // Bot has no valid moves, pass turn after some visual delay
    actionLog += ` Tidak ada langkah valid. Giliran dilewati.`;
    currentState.lastActionDescription = actionLog;
    
    broadcastToRoom(roomId, { type: 'state_update', state: currentState });
    
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Switch turn
    currentState.currentPlayerIndex = getNextPlayerIndex(currentState.currentPlayerIndex, currentState.players);
    currentState.diceValue = null;
    currentState.diceRolled = false;
    currentState.consecutiveSixesCount = 0;
    currentState.hasMovedThisTurn = false;
    currentState.lastActionDescription = `Sekarang giliran ${currentState.players[currentState.currentPlayerIndex].name}.`;
    
    broadcastToRoom(roomId, { type: 'state_update', state: currentState });
    
    // Continue bot chain if next player is also a bot
    processBotTurnsIfNeeded(roomId);
    return;
  }

  // Choose the best token move based on Bot difficulty
  const botDiff = activePlayer.botDifficulty || 'medium';
  const chosenTokenId = calculateBotMove(currentState, activePlayer.color, roll, botDiff);

  if (chosenTokenId === null) {
    // Fallback pass
    currentState.currentPlayerIndex = getNextPlayerIndex(currentState.currentPlayerIndex, currentState.players);
    currentState.diceValue = null;
    currentState.diceRolled = false;
    currentState.consecutiveSixesCount = 0;
    currentState.hasMovedThisTurn = false;
    currentState.lastActionDescription = `Sekarang giliran ${currentState.players[currentState.currentPlayerIndex].name}.`;
    broadcastToRoom(roomId, { type: 'state_update', state: currentState });
    processBotTurnsIfNeeded(roomId);
    return;
  }

  // Move bot token
  const oldPos = botTokens[chosenTokenId];
  let newPos = oldPos === -1 ? 0 : oldPos + roll;
  botTokens[chosenTokenId] = newPos;

  let moveDetail = oldPos === -1 
    ? `mengeluarkan Bidak #${chosenTokenId + 1} dari kandang.` 
    : `melangkahkan Bidak #${chosenTokenId + 1} sebanyak ${roll} langkah (posisi ${newPos}).`;
  actionLog = `${activePlayer.name} ${moveDetail}`;

  // Check captures
  const captures = checkCaptures(activePlayer.color, newPos, currentState.tokens);
  let capturedLog = '';
  if (captures.length > 0) {
    for (const cap of captures) {
      currentState.tokens[cap.color][cap.tokenIndex] = -1;
      const victim = currentState.players.find(p => p.color === cap.color);
      capturedLog += ` Bidak #${cap.tokenIndex + 1} milik ${victim ? victim.name : cap.color} dimakan dan pulang ke kandang!`;
    }
  }

  actionLog += capturedLog;

  // Check for finished token
  if (newPos === 56) {
    actionLog += ` Bidak #${chosenTokenId + 1} berhasil FINISH! 🎉`;
  }

  // Check for game winner
  const winner = checkWinner(currentState.tokens);
  if (winner) {
    currentState.status = 'finished';
    currentState.winnerColor = winner;
    const winnerPlayer = currentState.players.find(p => p.color === winner);
    currentState.lastActionDescription = `🏆 PERTANDINGAN SELESAI! ${winnerPlayer ? winnerPlayer.name : winner.toUpperCase()} ADALAH PEMENANGNYA!`;
    broadcastToRoom(roomId, { type: 'state_update', state: currentState });
    triggerAICommentary(`Permainan selesai! ${winnerPlayer ? winnerPlayer.name : winner} telah memenangkan game Ludo! Semua bidaknya sudah finish!`, currentState, 200, true);
    return;
  }

  // Standard turn progression
  let hasBonusRoll = roll === 6 || captures.length > 0 || newPos === 56;
  
  if (roll === 6) {
    currentState.consecutiveSixesCount++;
    if (currentState.consecutiveSixesCount >= 3) {
      actionLog += ` (Tiga kali dapet angka 6 berturut-turut! Giliran dibatalkan dan dilewati).`;
      hasBonusRoll = false;
      currentState.consecutiveSixesCount = 0;
    }
  } else {
    currentState.consecutiveSixesCount = 0;
  }

  currentState.lastActionDescription = actionLog;

  if (hasBonusRoll) {
    actionLog += ` Mendapat bonus kocokan tambahan!`;
    currentState.diceValue = null;
    currentState.diceRolled = false;
    currentState.hasMovedThisTurn = false;
    broadcastToRoom(roomId, { type: 'state_update', state: currentState });
    
    // AI commentary for exciting events
    if (captures.length > 0) {
      triggerAICommentary(`${activePlayer.name} baru saja memakan bidak lawan dan mendapat bonus giliran!`, currentState, 500, true);
    } else if (roll === 6) {
      triggerAICommentary(`${activePlayer.name} mendapat dadu angka 6 dan berhak melempar dadu lagi!`, currentState, 500, true);
    }
  } else {
    // Pass turn
    currentState.currentPlayerIndex = getNextPlayerIndex(currentState.currentPlayerIndex, currentState.players);
    currentState.diceValue = null;
    currentState.diceRolled = false;
    currentState.consecutiveSixesCount = 0;
    currentState.hasMovedThisTurn = false;
    
    const nextPlayer = currentState.players[currentState.currentPlayerIndex];
    currentState.lastActionDescription = `${actionLog} Sekarang giliran ${nextPlayer.name}.`;
    broadcastToRoom(roomId, { type: 'state_update', state: currentState });

    // AI commentary for a standard progress/capture
    if (captures.length > 0) {
      triggerAICommentary(`${activePlayer.name} menyantap bidak lawan tanpa ampun!`, currentState, 500, true);
    }
  }

  // Trigger next bot turn recursively
  processBotTurnsIfNeeded(roomId);
}

// Instantiate WebSocket Server
const wss = new WebSocketServer({ noServer: true });

// Upgrade HTTP Server to handle WebSockets
server.on('upgrade', (request, socket, head) => {
  const pathname = new URL(request.url || '', `http://${request.headers.host}`).pathname;
  
  if (pathname.startsWith('/ws')) {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});

// WebSocket Connection Handler
wss.on('connection', (ws: WebSocket, request) => {
  const urlParams = new URL(request.url || '', `http://${request.headers.host}`).searchParams;
  const clientPlayerId = urlParams.get('playerId') || `p-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  let currentRoomId = urlParams.get('roomId') || '';

  console.log(`WebSocket connected! Player: ${clientPlayerId}, Room: ${currentRoomId}`);

  // Helper to register socket
  function registerSocket(roomId: string, playerId: string) {
    if (!roomSockets.has(roomId)) {
      roomSockets.set(roomId, new Map());
    }
    roomSockets.get(roomId)!.set(playerId, ws);
  }

  if (currentRoomId && rooms.has(currentRoomId)) {
    registerSocket(currentRoomId, clientPlayerId);
    
    // Sync client presence
    const state = rooms.get(currentRoomId)!;
    const player = state.players.find(p => p.id === clientPlayerId);
    if (player) {
      player.isOnline = true;
      state.lastActionDescription = `${player.name} kembali online.`;
      broadcastToRoom(currentRoomId, { type: 'state_update', state });
    }
  }

  ws.on('message', async (data) => {
    try {
      const message: ClientMessage = JSON.parse(data.toString());
      console.log('Received WebSocket Message:', message);

      switch (message.type) {
        case 'create_room': {
          const roomId = generateRoomCode();
          const hostName = message.playerName || 'Pemain 1';
          
          const state = createInitialState(roomId);
          const hostPlayer: Player = {
            id: clientPlayerId,
            name: hostName,
            color: 'red',
            isBot: false,
            isHost: true,
            isOnline: true,
            joinedAt: Date.now(),
          };
          state.players.push(hostPlayer);
          
          rooms.set(roomId, state);
          currentRoomId = roomId;
          registerSocket(roomId, clientPlayerId);

          ws.send(JSON.stringify({
            type: 'room_created',
            roomId,
            playerId: clientPlayerId,
            state,
          } as ServerMessage));

          console.log(`Ludo Room Created: ${roomId} by ${hostName}`);
          break;
        }

        case 'join_room': {
          const joinRoomId = (message.roomId || '').toUpperCase();
          const playerName = message.playerName || `Pemain ${Date.now().toString().slice(-3)}`;

          if (!rooms.has(joinRoomId)) {
            ws.send(JSON.stringify({
              type: 'room_error',
              error: 'Room Ludo tidak ditemukan! Silakan cek kembali kode room Anda.',
            } as ServerMessage));
            return;
          }

          const state = rooms.get(joinRoomId)!;
          
          if (state.status !== 'waiting') {
            // Check if it's a reconnection
            const existingPlayer = state.players.find(p => p.id === clientPlayerId);
            if (existingPlayer) {
              existingPlayer.isOnline = true;
              currentRoomId = joinRoomId;
              registerSocket(joinRoomId, clientPlayerId);
              
              ws.send(JSON.stringify({
                type: 'room_joined',
                roomId: joinRoomId,
                playerId: clientPlayerId,
                state,
              } as ServerMessage));
              
              state.lastActionDescription = `${existingPlayer.name} terhubung kembali ke permainan.`;
              broadcastToRoom(joinRoomId, { type: 'state_update', state });
              return;
            }

            ws.send(JSON.stringify({
              type: 'room_error',
              error: 'Game sudah berjalan atau telah selesai! Anda tidak bisa bergabung.',
            } as ServerMessage));
            return;
          }

          if (state.players.length >= 4) {
            ws.send(JSON.stringify({
              type: 'room_error',
              error: 'Room Ludo penuh! Maksimal 4 pemain.',
            } as ServerMessage));
            return;
          }

          currentRoomId = joinRoomId;
          registerSocket(joinRoomId, clientPlayerId);

          // Find an available color
          const takenColors = state.players.map(p => p.color);
          const availableColors: PlayerColor[] = ['red', 'green', 'yellow', 'blue'];
          const color = availableColors.find(c => !takenColors.includes(c)) || 'red';

          const newPlayer: Player = {
            id: clientPlayerId,
            name: playerName,
            color,
            isBot: false,
            isHost: false,
            isOnline: true,
            joinedAt: Date.now(),
          };

          state.players.push(newPlayer);
          state.lastActionDescription = `${playerName} bergabung ke dalam lobi.`;

          ws.send(JSON.stringify({
            type: 'room_joined',
            roomId: joinRoomId,
            playerId: clientPlayerId,
            state,
          } as ServerMessage));

          broadcastToRoom(joinRoomId, {
            type: 'state_update',
            state,
          });

          console.log(`Ludo Room Joined: ${joinRoomId} by ${playerName} (${color})`);
          break;
        }

        case 'add_bot': {
          if (!currentRoomId || !rooms.has(currentRoomId)) return;
          const state = rooms.get(currentRoomId)!;

          if (state.status !== 'waiting') return;
          if (state.players.length >= 4) return;

          const difficulty = message.botDifficulty || 'medium';
          const takenColors = state.players.map(p => p.color);
          const availableColors: PlayerColor[] = ['red', 'green', 'yellow', 'blue'];
          const color = availableColors.find(c => !takenColors.includes(c));

          if (!color) return;

          const botNames: { [c in PlayerColor]: string } = {
            red: '🤖 Bot Merah',
            green: '🤖 Bot Hijau',
            yellow: '🤖 Bot Kuning',
            blue: '🤖 Bot Biru',
          };

          const botPlayer: Player = {
            id: `bot-${color}-${Date.now()}`,
            name: `${botNames[color]} (${difficulty.toUpperCase()})`,
            color,
            isBot: true,
            botDifficulty: difficulty,
            isHost: false,
            isOnline: true,
            joinedAt: Date.now(),
          };

          state.players.push(botPlayer);
          state.lastActionDescription = `${botPlayer.name} ditambahkan ke permainan.`;
          
          broadcastToRoom(currentRoomId, {
            type: 'state_update',
            state,
          });
          break;
        }

        case 'remove_bot': {
          if (!currentRoomId || !rooms.has(currentRoomId)) return;
          const state = rooms.get(currentRoomId)!;

          if (state.status !== 'waiting') return;
          const botColor = message.botColor;
          if (!botColor) return;

          const botIndex = state.players.findIndex(p => p.color === botColor && p.isBot);
          if (botIndex !== -1) {
            const removedBotName = state.players[botIndex].name;
            state.players.splice(botIndex, 1);
            state.lastActionDescription = `${removedBotName} dikeluarkan dari lobi.`;
            broadcastToRoom(currentRoomId, {
              type: 'state_update',
              state,
            });
          }
          break;
        }

        case 'start_game': {
          if (!currentRoomId || !rooms.has(currentRoomId)) return;
          const state = rooms.get(currentRoomId)!;

          if (state.players.length < 2) {
            ws.send(JSON.stringify({
              type: 'room_error',
              error: 'Butuh minimal 2 pemain untuk memulai permainan!',
            } as ServerMessage));
            return;
          }

          state.status = 'playing';
          state.currentPlayerIndex = 0; // Red starts (first joined usually red)
          state.diceValue = null;
          state.diceRolled = false;
          state.consecutiveSixesCount = 0;
          state.hasMovedThisTurn = false;
          
          // Clear previous board tokens
          const colors: PlayerColor[] = ['red', 'green', 'yellow', 'blue'];
          for (const c of colors) {
            state.tokens[c] = [-1, -1, -1, -1];
          }

          state.lastActionDescription = `Permainan dimulai! Giliran pertama: ${state.players[0].name}.`;

          broadcastToRoom(currentRoomId, {
            type: 'state_update',
            state,
          });

          triggerAICommentary(`Pertandingan Ludo dimulai! Para kontestan yang berlaga hari ini adalah ${state.players.map(p => p.name).join(', ')}. Semoga hoki menyertai kalian!`, state, 100);

          // If the first player is a bot, trigger it
          processBotTurnsIfNeeded(currentRoomId);
          break;
        }

        case 'roll_dice': {
          if (!currentRoomId || !rooms.has(currentRoomId)) return;
          const state = rooms.get(currentRoomId)!;

          if (state.status !== 'playing') return;
          
          const currentPlayer = state.players[state.currentPlayerIndex];
          if (currentPlayer.id !== clientPlayerId) {
            ws.send(JSON.stringify({
              type: 'room_error',
              error: 'Bukan giliran Anda untuk mengocok dadu!',
            } as ServerMessage));
            return;
          }

          if (state.diceRolled) {
            ws.send(JSON.stringify({
              type: 'room_error',
              error: 'Anda sudah mengocok dadu di giliran ini!',
            } as ServerMessage));
            return;
          }

          const roll = rollDiceValue();
          state.diceValue = roll;
          state.diceRolled = true;
          
          let actionLog = `${currentPlayer.name} (${currentPlayer.color.toUpperCase()}) mengocok dadu dapet angka ${roll}.`;

          const pTokens = state.tokens[currentPlayer.color];
          const validMoves = getValidMoves(pTokens, roll);

          if (validMoves.length === 0) {
            actionLog += ` Tidak ada langkah valid. Giliran dialihkan.`;
            state.lastActionDescription = actionLog;
            broadcastToRoom(currentRoomId, { type: 'state_update', state });

            // Automatically pass turn to next player after a 1.8 second delay so they can see the dice value
            setTimeout(() => {
              const innerState = rooms.get(currentRoomId);
              if (!innerState || innerState.status !== 'playing') return;

              innerState.currentPlayerIndex = getNextPlayerIndex(innerState.currentPlayerIndex, innerState.players);
              innerState.diceValue = null;
              innerState.diceRolled = false;
              innerState.consecutiveSixesCount = 0;
              innerState.hasMovedThisTurn = false;
              
              const nextP = innerState.players[innerState.currentPlayerIndex];
              innerState.lastActionDescription = `Giliran dialihkan ke ${nextP.name}.`;
              
              broadcastToRoom(currentRoomId, { type: 'state_update', state: innerState });
              processBotTurnsIfNeeded(currentRoomId);
            }, 1800);

            triggerAICommentary(`${currentPlayer.name} melempar dadu dan dapet angka ${roll}, ampas sekali karena tidak ada bidak yang bisa jalan!`, state);
            return;
          }

          state.lastActionDescription = actionLog;
          broadcastToRoom(currentRoomId, {
            type: 'state_update',
            state,
          });
          break;
        }

        case 'move_token': {
          if (!currentRoomId || !rooms.has(currentRoomId)) return;
          const state = rooms.get(currentRoomId)!;

          if (state.status !== 'playing') return;
          if (!state.diceRolled || state.diceValue === null) return;

          const currentPlayer = state.players[state.currentPlayerIndex];
          if (currentPlayer.id !== clientPlayerId) return;

          const tokenId = message.tokenId;
          if (tokenId === undefined || tokenId < 0 || tokenId > 3) return;

          const pTokens = state.tokens[currentPlayer.color];
          const validMoves = getValidMoves(pTokens, state.diceValue);

          if (!validMoves.includes(tokenId)) {
            ws.send(JSON.stringify({
              type: 'room_error',
              error: 'Langkah bidak tersebut tidak valid!',
            } as ServerMessage));
            return;
          }

          // Move the token
          const roll = state.diceValue;
          const oldPos = pTokens[tokenId];
          const newPos = oldPos === -1 ? 0 : oldPos + roll;
          pTokens[tokenId] = newPos;

          let moveDetail = oldPos === -1 
            ? `mengeluarkan Bidak #${tokenId + 1} dari kandang.` 
            : `melangkahkan Bidak #${tokenId + 1} sebanyak ${roll} langkah.`;
          let actionLog = `${currentPlayer.name} ${moveDetail}`;

          // Check captures
          const captures = checkCaptures(currentPlayer.color, newPos, state.tokens);
          let capturedLog = '';
          if (captures.length > 0) {
            for (const cap of captures) {
              state.tokens[cap.color][cap.tokenIndex] = -1;
              const victim = state.players.find(p => p.color === cap.color);
              capturedLog += ` Bidak #${cap.tokenIndex + 1} milik ${victim ? victim.name : cap.color} dicaplok dan dipaksa pulang kandang!`;
            }
          }
          actionLog += capturedLog;

          // Check if token reached finish (56)
          if (newPos === 56) {
            actionLog += ` Bidak #${tokenId + 1} berhasil FINISH! Hore! 🥳`;
          }

          // Check for winner
          const winner = checkWinner(state.tokens);
          if (winner) {
            state.status = 'finished';
            state.winnerColor = winner;
            const winnerPlayer = state.players.find(p => p.color === winner);
            state.lastActionDescription = `🏆 PERTANDINGAN SELESAI! ${winnerPlayer ? winnerPlayer.name : winner.toUpperCase()} MENANG MUTLAK!`;
            broadcastToRoom(currentRoomId, { type: 'state_update', state });
            triggerAICommentary(`Luar biasa! Bidak terakhir sudah finish. ${winnerPlayer ? winnerPlayer.name : winner} resmi menjadi raja Ludo hari ini! Beri tepuk tangan!`, state, 200, true);
            return;
          }

          // Bonus roll check
          let hasBonusRoll = roll === 6 || captures.length > 0 || newPos === 56;
          
          if (roll === 6) {
            state.consecutiveSixesCount++;
            if (state.consecutiveSixesCount >= 3) {
              actionLog += ` (Tiga angka 6 berturut-turut! Dadu terbakar dan giliran dibatalkan).`;
              hasBonusRoll = false;
              state.consecutiveSixesCount = 0;
            }
          } else {
            state.consecutiveSixesCount = 0;
          }

          state.lastActionDescription = actionLog;

          if (hasBonusRoll) {
            actionLog += ` Mendapat bonus melempar lagi!`;
            state.diceValue = null;
            state.diceRolled = false;
            state.hasMovedThisTurn = false;
            broadcastToRoom(currentRoomId, { type: 'state_update', state });
            
            // Commentary reactions
            if (captures.length > 0) {
              triggerAICommentary(`${currentPlayer.name} memakan bidak milik lawan dan dapet bonus giliran kocokan!`, state, 500, true);
            } else if (roll === 6) {
              triggerAICommentary(`${currentPlayer.name} dapet angka 6 dan dapet kesempatan melempar dadu lagi!`, state, 500, true);
            } else if (newPos === 56) {
              triggerAICommentary(`${currentPlayer.name} berhasil memasukkan bidak ke garis finish dan berhak jalan lagi!`, state, 500, true);
            }
          } else {
            // Standard pass turn
            state.currentPlayerIndex = getNextPlayerIndex(state.currentPlayerIndex, state.players);
            state.diceValue = null;
            state.diceRolled = false;
            state.consecutiveSixesCount = 0;
            state.hasMovedThisTurn = false;
            
            const nextP = state.players[state.currentPlayerIndex];
            state.lastActionDescription = `${actionLog} Sekarang giliran ${nextP.name}.`;
            broadcastToRoom(currentRoomId, { type: 'state_update', state });

            // AI commentary for normal capture/turn transition
            if (captures.length > 0) {
              triggerAICommentary(`Bidak dicaplok tanpa belas kasihan oleh ${currentPlayer.name}!`, state, 500, true);
            }
          }

          // Trigger bot recursive turns if next player is bot
          processBotTurnsIfNeeded(currentRoomId);
          break;
        }

        case 'send_chat': {
          if (!currentRoomId || !rooms.has(currentRoomId)) return;
          const state = rooms.get(currentRoomId)!;

          const player = state.players.find(p => p.id === clientPlayerId);
          const senderName = player ? player.name : 'Penonton';
          const senderColor = player ? player.color : undefined;
          
          const chatMessage: ChatMessage = {
            id: `chat-${Date.now()}-${Math.random()}`,
            senderName,
            senderColor,
            message: message.message || '',
            timestamp: Date.now(),
          };

          state.chatHistory.push(chatMessage);
          if (state.chatHistory.length > 50) state.chatHistory.shift();

          broadcastToRoom(currentRoomId, {
            type: 'chat_message',
            chat: chatMessage,
            state, // Include latest state for consistency
          });
          break;
        }

        case 'restart_game': {
          if (!currentRoomId || !rooms.has(currentRoomId)) return;
          const state = rooms.get(currentRoomId)!;

          state.status = 'playing';
          state.currentPlayerIndex = 0;
          state.diceValue = null;
          state.diceRolled = false;
          state.consecutiveSixesCount = 0;
          state.hasMovedThisTurn = false;
          state.winnerColor = null;

          const colors: PlayerColor[] = ['red', 'green', 'yellow', 'blue'];
          for (const c of colors) {
            state.tokens[c] = [-1, -1, -1, -1];
          }

          state.lastActionDescription = `Permainan di-restart! Giliran pertama: ${state.players[0].name}.`;

          broadcastToRoom(currentRoomId, {
            type: 'state_update',
            state,
          });

          triggerAICommentary(`Permainan diulang dari awal! Dendam membara membakar lobi ini. Siapakah yang akan balas dendam?`, state, 100);

          processBotTurnsIfNeeded(currentRoomId);
          break;
        }
      }
    } catch (err) {
      console.error('Error handling websocket message:', err);
    }
  });

  // Handle client disconnection
  ws.on('close', () => {
    console.log(`WebSocket closed for player: ${clientPlayerId}`);
    
    if (currentRoomId && rooms.has(currentRoomId)) {
      const state = rooms.get(currentRoomId)!;
      const player = state.players.find(p => p.id === clientPlayerId);
      
      if (player) {
        player.isOnline = false;
        state.lastActionDescription = `${player.name} terputus (offline).`;
        
        // Clean up socket mapping
        if (roomSockets.has(currentRoomId)) {
          roomSockets.get(currentRoomId)!.delete(clientPlayerId);
        }

        // Check if all human players are offline, if so we can optionally delete the room after a delay
        const anyHumansOnline = state.players.some(p => !p.isBot && p.isOnline);
        if (!anyHumansOnline) {
          console.log(`All human players in room ${currentRoomId} are offline. Scheduling room deletion.`);
          setTimeout(() => {
            const currentSockets = roomSockets.get(currentRoomId);
            if (!currentSockets || currentSockets.size === 0) {
              rooms.delete(currentRoomId);
              roomSockets.delete(currentRoomId);
              console.log(`Room ${currentRoomId} successfully cleaned up due to inactivity.`);
            }
          }, 30000); // Wait 30 seconds before clean up
        }

        broadcastToRoom(currentRoomId, {
          type: 'state_update',
          state,
        });
      }
    }
  });
});

// Serve frontend assets
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    // In development mode, load Vite server as middleware
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    console.log('Vite middleware mounted');
  } else {
    // In production, serve the built files directly
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
    console.log('Serving production static assets from:', distPath);
  }

  const startListening = (port: number) => {
    server.listen(port, '0.0.0.0', () => {
      console.log(`Express server running on http://localhost:${port}`);
    });
  };

  server.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      const failedPort = err.port;
      console.log(`Port ${failedPort} is in use, trying ${failedPort + 1}...`);
      setTimeout(() => startListening(failedPort + 1), 100);
    } else {
      console.error('Server error:', err);
    }
  });

  startListening(PORT);
}

startServer();
