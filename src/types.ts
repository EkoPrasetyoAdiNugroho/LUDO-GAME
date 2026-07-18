/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type PlayerColor = 'red' | 'green' | 'yellow' | 'blue';

export interface Player {
  id: string;
  name: string;
  color: PlayerColor;
  isBot: boolean;
  botDifficulty?: 'easy' | 'medium' | 'hard';
  isHost: boolean;
  isOnline: boolean;
  joinedAt: number;
}

export interface ChatMessage {
  id: string;
  senderName: string;
  senderColor?: PlayerColor;
  message: string;
  timestamp: number;
}

export interface GameState {
  roomId: string;
  status: 'waiting' | 'playing' | 'finished';
  players: Player[];
  currentPlayerIndex: number;
  tokens: { [color in PlayerColor]: number[] }; // 4 tokens per color, values from -1 to 56
  diceValue: number | null;
  diceRolled: boolean;
  consecutiveSixesCount: number;
  hasMovedThisTurn: boolean;
  winnerColor: PlayerColor | null;
  chatHistory: ChatMessage[];
  lastActionDescription: string;
}

// WebSocket message protocols
export type ClientMessageType =
  | 'create_room'
  | 'join_room'
  | 'start_game'
  | 'roll_dice'
  | 'move_token'
  | 'add_bot'
  | 'remove_bot'
  | 'send_chat'
  | 'restart_game';

export interface ClientMessage {
  type: ClientMessageType;
  roomId?: string;
  playerName?: string;
  botDifficulty?: 'easy' | 'medium' | 'hard';
  botColor?: PlayerColor;
  tokenId?: number; // 0 to 3
  message?: string;
}

export type ServerMessageType =
  | 'room_created'
  | 'room_joined'
  | 'room_error'
  | 'state_update'
  | 'chat_message'
  | 'ai_commentary';

export interface ServerMessage {
  type: ServerMessageType;
  roomId?: string;
  playerId?: string;
  error?: string;
  state?: GameState;
  chat?: ChatMessage;
  commentary?: string;
}
