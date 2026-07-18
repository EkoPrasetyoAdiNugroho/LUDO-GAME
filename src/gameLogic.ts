/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { PlayerColor, GameState, Player } from './types';

export const GRID_SIZE = 15;

// Outer circular track coordinate coordinates (52 cells)
export const TRACK_COORDS: [number, number][] = [
  [0, 6], [1, 6], [2, 6], [3, 6], [4, 6], [5, 6],       // Left arm top row
  [6, 5], [6, 4], [6, 3], [6, 2], [6, 1], [6, 0],       // Top arm left col
  [7, 0],                                               // Top edge turn
  [8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5],       // Top arm right col
  [9, 6], [10, 6], [11, 6], [12, 6], [13, 6], [14, 6],  // Right arm top row
  [14, 7],                                              // Right edge turn
  [14, 8], [13, 8], [12, 8], [11, 8], [10, 8], [9, 8],  // Right arm bottom row
  [8, 9], [8, 10], [8, 11], [8, 12], [8, 13], [8, 14],  // Bottom arm right col
  [7, 14],                                              // Bottom edge turn
  [6, 14], [6, 13], [6, 12], [6, 11], [6, 10], [6, 9],  // Bottom arm left col
  [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8],       // Left arm bottom row
  [0, 7]                                                // Left edge turn
];

export const PLAYER_START_INDEX: { [color in PlayerColor]: number } = {
  green: 1,    // [1, 6]
  yellow: 14,  // [8, 1]
  blue: 27,    // [13, 8]
  red: 40      // [6, 13]
};

export const HOME_LANES: { [color in PlayerColor]: [number, number][] } = {
  green: [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7]],
  yellow: [[7, 1], [7, 2], [7, 3], [7, 4], [7, 5]],
  blue: [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7]],
  red: [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9]]
};

export const HOME_YARD_COORDS: { [color in PlayerColor]: [number, number][] } = {
  green: [[1.5, 1.5], [3.5, 1.5], [1.5, 3.5], [3.5, 3.5]],
  yellow: [[10.5, 1.5], [12.5, 1.5], [10.5, 3.5], [12.5, 3.5]],
  blue: [[10.5, 10.5], [12.5, 10.5], [10.5, 12.5], [12.5, 12.5]],
  red: [[1.5, 10.5], [3.5, 10.5], [1.5, 12.5], [3.5, 12.5]]
};

export const SAFE_ZONES: [number, number][] = [
  [1, 6], [8, 1], [13, 8], [6, 13], // 4 Starts
  [6, 2], [12, 6], [8, 12], [2, 8]  // 4 Star symbols
];

export function isSafeCoordinate(x: number, y: number): boolean {
  return SAFE_ZONES.some(coord => coord[0] === x && coord[1] === y);
}

/**
 * Maps a color, token index, and positions (-1 to 56) to 2D board [X, Y] coordinates
 */
export function getTokenCoordinates(color: PlayerColor, tokenIndex: number, position: number): [number, number] {
  if (position === -1) {
    return HOME_YARD_COORDS[color][tokenIndex];
  }
  if (position === 56) {
    // Finish. In 15x15 Ludo, center is [7,7] but let's disperse tokens slightly in the center triangle
    const centerOffsets: { [color in PlayerColor]: [number, number] } = {
      green: [6.5, 7],
      yellow: [7, 6.5],
      blue: [7.5, 7],
      red: [7, 7.5]
    };
    return centerOffsets[color];
  }
  if (position >= 51 && position <= 55) {
    return HOME_LANES[color][position - 51];
  }
  
  // On outer track
  const startIndex = PLAYER_START_INDEX[color];
  const trackIndex = (startIndex + position) % 52;
  return TRACK_COORDS[trackIndex];
}

/**
 * Returns which tokens can move for the current player with a given dice roll
 */
export function getValidMoves(tokens: number[], diceValue: number): number[] {
  const validIndices: number[] = [];
  
  for (let i = 0; i < tokens.length; i++) {
    const pos = tokens[i];
    
    if (pos === -1) {
      // Out of home requires a 6
      if (diceValue === 6) {
        validIndices.push(i);
      }
    } else if (pos >= 0 && pos < 56) {
      // Must not overshoot the finish (56)
      if (pos + diceValue <= 56) {
        validIndices.push(i);
      }
    }
  }
  
  return validIndices;
}

/**
 * Checks if landing on a cell will capture any opponent tokens and returns them
 */
export function checkCaptures(
  currentPlayerColor: PlayerColor,
  targetPosition: number,
  allTokens: { [color in PlayerColor]: number[] }
): { color: PlayerColor; tokenIndex: number }[] {
  // If we are not on the outer track (position >= 51), there are no captures possible
  if (targetPosition < 0 || targetPosition >= 51) {
    return [];
  }

  const currentStartIndex = PLAYER_START_INDEX[currentPlayerColor];
  const targetTrackIndex = (currentStartIndex + targetPosition) % 52;
  const targetCoord = TRACK_COORDS[targetTrackIndex];

  // If this coordinate is a safe zone, no capture
  if (isSafeCoordinate(targetCoord[0], targetCoord[1])) {
    return [];
  }

  const captures: { color: PlayerColor; tokenIndex: number }[] = [];

  // Look for other players' tokens at the exact same track index
  const colors: PlayerColor[] = ['red', 'green', 'yellow', 'blue'];
  for (const col of colors) {
    if (col === currentPlayerColor) continue;

    const opTokens = allTokens[col];
    const opStartIndex = PLAYER_START_INDEX[col];

    for (let i = 0; i < opTokens.length; i++) {
      const opPos = opTokens[i];
      if (opPos >= 0 && opPos < 51) {
        const opTrackIndex = (opStartIndex + opPos) % 52;
        if (opTrackIndex === targetTrackIndex) {
          captures.push({ color: col, tokenIndex: i });
        }
      }
    }
  }

  return captures;
}

/**
 * Select the best move for a bot player
 */
export function calculateBotMove(
  gameState: GameState,
  botColor: PlayerColor,
  diceValue: number,
  difficulty: 'easy' | 'medium' | 'hard' = 'medium'
): number | null {
  const tokens = gameState.tokens[botColor];
  const validMoves = getValidMoves(tokens, diceValue);

  if (validMoves.length === 0) return null;
  if (validMoves.length === 1) return validMoves[0];

  if (difficulty === 'easy') {
    // Easy difficulty: pick completely random move
    const randomIndex = Math.floor(Math.random() * validMoves.length);
    return validMoves[randomIndex];
  }

  // Heuristic evaluation for Medium & Hard
  let bestTokenId = validMoves[0];
  let highestScore = -Infinity;

  for (const tokenId of validMoves) {
    const currentPos = tokens[tokenId];
    let score = 0;

    // 1. Moving out of home base with a 6 is high priority
    if (currentPos === -1 && diceValue === 6) {
      score += 50;
    }

    // Evaluate position if moved
    const nextPos = currentPos === -1 ? 0 : currentPos + diceValue;

    // 2. Prioritize capturing opponent tokens (Huge points!)
    const captures = checkCaptures(botColor, nextPos, gameState.tokens);
    if (captures.length > 0) {
      score += 100 * captures.length;
    }

    // 3. Prioritize landing on a safe zone
    if (nextPos >= 0 && nextPos < 51) {
      const startIdx = PLAYER_START_INDEX[botColor];
      const targetCoord = TRACK_COORDS[(startIdx + nextPos) % 52];
      if (isSafeCoordinate(targetCoord[0], targetCoord[1])) {
        score += 15;
      }
    }

    // 4. Prioritize entering home lane / safe area
    if (nextPos >= 51 && currentPos < 51) {
      score += 30;
    }

    // 5. Prioritize finishing tokens (position 56)
    if (nextPos === 56) {
      score += 80;
    }

    // 6. Hard Difficulty: Evade danger! Check if current position is vulnerable and moving escapes it,
    // or if the next position is highly vulnerable (landing in front of opponent)
    if (difficulty === 'hard') {
      const startIdx = PLAYER_START_INDEX[botColor];
      
      // Vulnerability at current position (if on track)
      if (currentPos >= 0 && currentPos < 51) {
        const curTrackIdx = (startIdx + currentPos) % 52;
        if (!isSafeCoordinate(TRACK_COORDS[curTrackIdx][0], TRACK_COORDS[curTrackIdx][1])) {
          // Check if opponent is right behind us (within 6 steps)
          if (isOpponentBehind(curTrackIdx, gameState.tokens, botColor)) {
            score += 25; // Good to run away!
          }
        }
      }

      // Vulnerability at target position
      if (nextPos >= 0 && nextPos < 51) {
        const nextTrackIdx = (startIdx + nextPos) % 52;
        if (!isSafeCoordinate(TRACK_COORDS[nextTrackIdx][0], TRACK_COORDS[nextTrackIdx][1])) {
          if (isOpponentBehind(nextTrackIdx, gameState.tokens, botColor)) {
            score -= 20; // Bad idea to land in a danger zone!
          }
        }
      }

      // Keep tokens together (Ludo block strategy)
      score += (nextPos * 0.1); // Slightly favor moving tokens that are further ahead
    } else {
      // Medium difficulty: simple progress bonus
      score += (nextPos * 0.2);
    }

    if (score > highestScore) {
      highestScore = score;
      bestTokenId = tokenId;
    }
  }

  return bestTokenId;
}

/**
 * Helper to check if any opponent is behind a track index (within 6 cells)
 */
function isOpponentBehind(
  trackIndex: number,
  allTokens: { [color in PlayerColor]: number[] },
  selfColor: PlayerColor
): boolean {
  const colors: PlayerColor[] = ['red', 'green', 'yellow', 'blue'];
  
  for (const col of colors) {
    if (col === selfColor) continue;
    
    const startIdx = PLAYER_START_INDEX[col];
    const opTokens = allTokens[col];
    
    for (const opPos of opTokens) {
      if (opPos >= 0 && opPos < 51) {
        const opTrackIdx = (startIdx + opPos) % 52;
        
        // Calculate modular distance from op to us
        const dist = (trackIndex - opTrackIdx + 52) % 52;
        if (dist > 0 && dist <= 6) {
          return true;
        }
      }
    }
  }
  
  return false;
}

/**
 * Returns names of players who are finished (all 4 tokens are in 56)
 */
export function checkWinner(tokens: { [color in PlayerColor]: number[] }): PlayerColor | null {
  const colors: PlayerColor[] = ['red', 'green', 'yellow', 'blue'];
  for (const color of colors) {
    const playerTokens = tokens[color];
    if (playerTokens && playerTokens.every(pos => pos === 56)) {
      return color;
    }
  }
  return null;
}

/**
 * Generates a random dice value between 1 and 6
 */
export function rollDiceValue(): number {
  return Math.floor(Math.random() * 6) + 1;
}

/**
 * Helper to find the next active player color/index
 */
export function getNextPlayerIndex(
  currentIndex: number,
  players: Player[]
): number {
  if (players.length === 0) return 0;
  
  // Turn passes in clockwise sequence:
  // We look for the next player who is actively in the game
  let nextIndex = currentIndex;
  for (let i = 0; i < 4; i++) {
    nextIndex = (nextIndex + 1) % players.length;
    
    // In real-time mode, players might be marked offline but we can still let bots or active players play.
    // If we have a status, we skip finished players or empty slots
    const nextPlayer = players[nextIndex];
    if (nextPlayer) {
      return nextIndex;
    }
  }
  
  return (currentIndex + 1) % players.length;
}
