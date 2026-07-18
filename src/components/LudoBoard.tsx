/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState, useEffect, useRef } from 'react';
import { PlayerColor, GameState, Player } from '../types';
import { sfx } from '../utils/audio';
import {
  GRID_SIZE,
  TRACK_COORDS,
  PLAYER_START_INDEX,
  HOME_LANES,
  SAFE_ZONES,
  getTokenCoordinates,
  getValidMoves,
  isSafeCoordinate,
} from '../gameLogic';

interface LudoBoardProps {
  gameState: GameState;
  myPlayer: Player | null;
  onTokenClick: (tokenId: number) => void;
  validTokenMoves: number[]; // indices of tokens that current user can move
}

const CELL_SIZE = 40; // 40px per grid cell in our 600x600 viewBox
const BOARD_WIDTH = GRID_SIZE * CELL_SIZE; // 600

export const LudoBoard: React.FC<LudoBoardProps> = ({
  gameState,
  myPlayer,
  onTokenClick,
  validTokenMoves,
}) => {
  const { status, tokens, currentPlayerIndex, players } = gameState;
  const currentPlayer = players[currentPlayerIndex];

  // Visual tokens state that lags behind/interpolates tokens state from props
  const [visualTokens, setVisualTokens] = useState<typeof tokens>(tokens);
  const [animatingToken, setAnimatingToken] = useState<{ color: PlayerColor; index: number; jumpHeight: number } | null>(null);
  const isAnimatingRef = useRef(false);

  // Synchronize visual tokens state with props tokens state (with animations)
  useEffect(() => {
    if (isAnimatingRef.current) return;

    let moveFound = false;

    for (const color of ['red', 'green', 'yellow', 'blue'] as PlayerColor[]) {
      const propPositions = tokens[color];
      const visPositions = visualTokens[color];
      if (!propPositions || !visPositions) continue;

      for (let i = 0; i < 4; i++) {
        const pPos = propPositions[i];
        const vPos = visPositions[i];

        if (pPos !== vPos) {
          moveFound = true;

          // Case A: Captured (sent back to yard) - Snap instantly with capture sound
          if (pPos === -1 && vPos > -1) {
            sfx.playCapture();
            setVisualTokens(prev => ({
              ...prev,
              [color]: prev[color].map((val, idx) => idx === i ? -1 : val)
            }));
            return;
          }

          // Case B: Launched from yard (-1 to 0) - Jump with jump sound
          if (vPos === -1 && pPos === 0) {
            sfx.playJump(1);
            setVisualTokens(prev => ({
              ...prev,
              [color]: prev[color].map((val, idx) => idx === i ? 0 : val)
            }));
            return;
          }

          // Case C: Standard Forward movement (animate step-by-step!)
          if (pPos > vPos) {
            isAnimatingRef.current = true;
            animateMovement(color, i, vPos, pPos);
            return;
          }

          // Case D: Fallback synchronization (e.g. game restart or manual sync)
          setVisualTokens(prev => ({
            ...prev,
            [color]: prev[color].map((val, idx) => idx === i ? pPos : val)
          }));
          return;
        }
      }
    }

    if (!moveFound) {
      setVisualTokens(tokens);
    }
  }, [tokens, visualTokens]);

  const animateMovement = async (color: PlayerColor, tokenIndex: number, startPos: number, endPos: number) => {
    let currentPos = startPos;
    const totalSteps = endPos - startPos;

    for (let step = 1; step <= totalSteps; step++) {
      currentPos++;

      // Play hop sound with slightly increasing pitch for consecutive steps
      sfx.playJump(step);

      // Bounce token upward (Y axis subtraction in SVG)
      setAnimatingToken({ color, index: tokenIndex, jumpHeight: 12 });

      setVisualTokens(prev => ({
        ...prev,
        [color]: prev[color].map((val, idx) => idx === tokenIndex ? currentPos : val)
      }));

      // Half step duration (bouncing peak)
      await new Promise(resolve => setTimeout(resolve, 110));
      setAnimatingToken({ color, index: tokenIndex, jumpHeight: 0 }); // come back down
      await new Promise(resolve => setTimeout(resolve, 90));
    }

    setAnimatingToken(null);
    isAnimatingRef.current = false;

    // Play home chime if piece reaches finish area
    if (endPos === 56) {
      sfx.playHome();
    }
  };

  // Colors dictionary for styling - vibrant neon with dark borders
  const colorPalette: { [color in PlayerColor]: { primary: string; light: string; border: string; glow: string } } = {
    red: { primary: '#EF4444', light: '#220808', border: '#B91C1C', glow: 'rgba(239, 68, 68, 0.4)' },
    green: { primary: '#10B981', light: '#041c10', border: '#047857', glow: 'rgba(16, 185, 129, 0.4)' },
    yellow: { primary: '#F59E0B', light: '#261803', border: '#B45309', glow: 'rgba(245, 158, 11, 0.4)' },
    blue: { primary: '#3B82F6', light: '#081735', border: '#1D4ED8', glow: 'rgba(59, 130, 246, 0.4)' },
  };

  // Safe zones coordinates map for quick lookup
  const safeZonesSet = useMemo(() => {
    return new Set(SAFE_ZONES.map(coord => `${coord[0]},${coord[1]}`));
  }, []);

  // Determine if a token can be clicked by the current client
  const isTokenInteractive = (color: PlayerColor, tokenIdx: number) => {
    if (status !== 'playing') return false;
    if (isAnimatingRef.current) return false; // Block user inputs during active step animations!
    if (!currentPlayer || currentPlayer.isBot) return false;
    
    // Check if it's our color and the token is valid for movement
    const isOurTurn = myPlayer && currentPlayer.id === myPlayer.id;
    if (!isOurTurn) return false;
    
    return currentPlayer.color === color && validTokenMoves.includes(tokenIdx);
  };

  // Group tokens by their [x, y] coordinates to apply clustering offsets
  const tokenClusterData = useMemo(() => {
    const coordsMap: { [coordStr: string]: { color: PlayerColor; tokenIndex: number; isInteractive: boolean }[] } = {};
    
    const colors: PlayerColor[] = ['red', 'green', 'yellow', 'blue'];
    
    colors.forEach(color => {
      const positions = visualTokens[color];
      if (!positions) return;
      
      positions.forEach((pos, idx) => {
        const [x, y] = getTokenCoordinates(color, idx, pos);
        // Round to avoid float keys
        const coordKey = `${x.toFixed(1)},${y.toFixed(1)}`;
        
        if (!coordsMap[coordKey]) {
          coordsMap[coordKey] = [];
        }
        
        coordsMap[coordKey].push({
          color,
          tokenIndex: idx,
          isInteractive: isTokenInteractive(color, idx),
        });
      });
    });
    
    return coordsMap;
  }, [visualTokens, currentPlayerIndex, status, myPlayer, validTokenMoves]);

  // Compute offset and size for a token based on its cluster
  const getTokenLayout = (color: PlayerColor, tokenIdx: number, pos: number) => {
    const [rawX, rawY] = getTokenCoordinates(color, tokenIdx, pos);
    const coordKey = `${rawX.toFixed(1)},${rawY.toFixed(1)}`;
    const cluster = tokenClusterData[coordKey] || [];
    const total = cluster.length;
    
    const xBase = rawX * CELL_SIZE + CELL_SIZE / 2;
    const yBase = rawY * CELL_SIZE + CELL_SIZE / 2;
    
    if (total <= 1 || pos === -1) {
      // No offset, standard size
      return {
        cx: xBase,
        cy: yBase,
        r: 14,
        fontSize: 11,
      };
    }
    
    // Find index of this specific token in the cluster
    const clusterIdx = cluster.findIndex(item => item.color === color && item.tokenIndex === tokenIdx);
    
    // Position offset values
    let dx = 0;
    let dy = 0;
    const offsetAmt = 10;
    
    if (total === 2) {
      dx = clusterIdx === 0 ? -offsetAmt : offsetAmt;
      dy = clusterIdx === 0 ? -offsetAmt : offsetAmt;
    } else if (total === 3) {
      if (clusterIdx === 0) { dx = -offsetAmt; dy = -offsetAmt; }
      else if (clusterIdx === 1) { dx = offsetAmt; dy = -offsetAmt; }
      else { dx = 0; dy = offsetAmt; }
    } else {
      // 4 or more
      if (clusterIdx === 0) { dx = -offsetAmt; dy = -offsetAmt; }
      else if (clusterIdx === 1) { dx = offsetAmt; dy = -offsetAmt; }
      else if (clusterIdx === 2) { dx = -offsetAmt; dy = offsetAmt; }
      else { dx = offsetAmt; dy = offsetAmt; }
    }
    
    return {
      cx: xBase + dx,
      cy: yBase + dy,
      r: 10, // Shrunken radius for clusters
      fontSize: 8,
    };
  };

  // Render a cell on the board
  const renderCell = (x: number, y: number, key: string) => {
    const isSafe = safeZonesSet.has(`${x},${y}`);
    
    // Grid coordinate bounds
    const rectX = x * CELL_SIZE;
    const rectY = y * CELL_SIZE;
    
    // Default style: Dark tech-grid style
    let fill = '#0b0b0b'; 
    let stroke = '#222222'; 
    
    // Color starting points
    if (x === 1 && y === 6) fill = colorPalette.green.primary;
    else if (x === 8 && y === 1) fill = colorPalette.yellow.primary;
    else if (x === 13 && y === 8) fill = colorPalette.blue.primary;
    else if (x === 6 && y === 13) fill = colorPalette.red.primary;
    
    // Home Columns
    else if (x >= 1 && x <= 5 && y === 7) fill = colorPalette.green.primary;
    else if (x === 7 && y >= 1 && y <= 5) fill = colorPalette.yellow.primary;
    else if (x >= 9 && x <= 13 && y === 7) fill = colorPalette.blue.primary;
    else if (x === 7 && y >= 9 && y <= 13) fill = colorPalette.red.primary;
    
    return (
      <g key={key}>
        <rect
          x={rectX}
          y={rectY}
          width={CELL_SIZE}
          height={CELL_SIZE}
          fill={fill}
          stroke={stroke}
          strokeWidth="2"
        />
        {isSafe && (
          <path
            d={`M ${rectX + 20} ${rectY + 8} L ${rectX + 23} ${rectY + 16} L ${rectX + 32} ${rectY + 16} L ${rectX + 25} ${rectY + 22} L ${rectX + 28} ${rectY + 30} L ${rectX + 20} ${rectY + 25} L ${rectX + 12} ${rectY + 30} L ${rectX + 15} ${rectY + 22} L ${rectX + 8} ${rectY + 16} L ${rectX + 17} ${rectY + 16} Z`}
            fill="#00F0FF" // cyan star
            opacity="0.9"
          />
        )}
      </g>
    );
  };

  // Generate board tracks cells that are not base yards or centers
  const cells = useMemo(() => {
    const list: React.ReactNode[] = [];
    for (let x = 0; x < 15; x++) {
      for (let y = 0; y < 15; y++) {
        // Skip corner base yards
        if (x < 6 && y < 6) continue;
        if (x > 8 && y < 6) continue;
        if (x < 6 && y > 8) continue;
        if (x > 8 && y > 8) continue;
        
        // Skip center triangle
        if (x >= 6 && x <= 8 && y >= 6 && y <= 8) continue;
        
        list.push(renderCell(x, y, `cell-${x}-${y}`));
      }
    }
    return list;
  }, []);

  return (
    <div className="relative w-full aspect-square max-w-[500px] md:max-w-[550px] mx-auto bg-black rounded-none shadow-[10px_10px_0px_#F27D26] border-8 border-[#333] p-1.5 overflow-hidden">
      <svg
        id="ludo-board-svg"
        viewBox={`0 0 ${BOARD_WIDTH} ${BOARD_WIDTH}`}
        className="w-full h-full select-none"
      >
        <defs>
          <radialGradient id="center-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0" />
          </radialGradient>
          
          <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0" dy="2" stdDeviation="2" floodOpacity="0.3" />
          </filter>
          
          <filter id="token-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* 1. RENDER CORNER BASE YARDS (BLOCKY DESIGN) */}
        {/* GREEN YARD (Top-Left) */}
        <g id="green-yard">
          <rect x="0" y="0" width="240" height="240" fill={colorPalette.green.primary} stroke="#333" strokeWidth="4" />
          <rect x="35" y="35" width="170" height="170" fill="#050505" stroke="#333" strokeWidth="4" />
          <rect x="45" y="45" width="150" height="150" fill="none" stroke={colorPalette.green.primary} strokeWidth="4" />
          <rect x="62" y="62" width="36" height="36" fill={colorPalette.green.light} stroke={colorPalette.green.primary} strokeWidth="3" />
          <rect x="142" y="62" width="36" height="36" fill={colorPalette.green.light} stroke={colorPalette.green.primary} strokeWidth="3" />
          <rect x="62" y="142" width="36" height="36" fill={colorPalette.green.light} stroke={colorPalette.green.primary} strokeWidth="3" />
          <rect x="142" y="142" width="36" height="36" fill={colorPalette.green.light} stroke={colorPalette.green.primary} strokeWidth="3" />
        </g>

        {/* YELLOW YARD (Top-Right) */}
        <g id="yellow-yard">
          <rect x="360" y="0" width="240" height="240" fill={colorPalette.yellow.primary} stroke="#333" strokeWidth="4" />
          <rect x="395" y="35" width="170" height="170" fill="#050505" stroke="#333" strokeWidth="4" />
          <rect x="405" y="45" width="150" height="150" fill="none" stroke={colorPalette.yellow.primary} strokeWidth="4" />
          <rect x="422" y="62" width="36" height="36" fill={colorPalette.yellow.light} stroke={colorPalette.yellow.primary} strokeWidth="3" />
          <rect x="502" y="62" width="36" height="36" fill={colorPalette.yellow.light} stroke={colorPalette.yellow.primary} strokeWidth="3" />
          <rect x="422" y="142" width="36" height="36" fill={colorPalette.yellow.light} stroke={colorPalette.yellow.primary} strokeWidth="3" />
          <rect x="502" y="142" width="36" height="36" fill={colorPalette.yellow.light} stroke={colorPalette.yellow.primary} strokeWidth="3" />
        </g>

        {/* RED YARD (Bottom-Left) */}
        <g id="red-yard">
          <rect x="0" y="360" width="240" height="240" fill={colorPalette.red.primary} stroke="#333" strokeWidth="4" />
          <rect x="35" y="395" width="170" height="170" fill="#050505" stroke="#333" strokeWidth="4" />
          <rect x="45" y="405" width="150" height="150" fill="none" stroke={colorPalette.red.primary} strokeWidth="4" />
          <rect x="62" y="422" width="36" height="36" fill={colorPalette.red.light} stroke={colorPalette.red.primary} strokeWidth="3" />
          <rect x="142" y="422" width="36" height="36" fill={colorPalette.red.light} stroke={colorPalette.red.primary} strokeWidth="3" />
          <rect x="62" y="502" width="36" height="36" fill={colorPalette.red.light} stroke={colorPalette.red.primary} strokeWidth="3" />
          <rect x="142" y="502" width="36" height="36" fill={colorPalette.red.light} stroke={colorPalette.red.primary} strokeWidth="3" />
        </g>

        {/* BLUE YARD (Bottom-Right) */}
        <g id="blue-yard">
          <rect x="360" y="360" width="240" height="240" fill={colorPalette.blue.primary} stroke="#333" strokeWidth="4" />
          <rect x="395" y="395" width="170" height="170" fill="#050505" stroke="#333" strokeWidth="4" />
          <rect x="405" y="405" width="150" height="150" fill="none" stroke={colorPalette.blue.primary} strokeWidth="4" />
          <rect x="422" y="422" width="36" height="36" fill={colorPalette.blue.light} stroke={colorPalette.blue.primary} strokeWidth="3" />
          <rect x="502" y="422" width="36" height="36" fill={colorPalette.blue.light} stroke={colorPalette.blue.primary} strokeWidth="3" />
          <rect x="422" y="502" width="36" height="36" fill={colorPalette.blue.light} stroke={colorPalette.blue.primary} strokeWidth="3" />
          <rect x="502" y="502" width="36" height="36" fill={colorPalette.blue.light} stroke={colorPalette.blue.primary} strokeWidth="3" />
        </g>

        {/* 2. RENDER OUTER TRACK CELLS */}
        <g id="track-cells">{cells}</g>

        {/* 3. RENDER CENTRAL TRIANGLE HOME STRETCH */}
        <g id="center-triangles">
          {/* Green (Left) */}
          <polygon points="240,240 240,360 300,300" fill={colorPalette.green.primary} stroke="#333" strokeWidth="4" />
          {/* Yellow (Top) */}
          <polygon points="240,240 360,240 300,300" fill={colorPalette.yellow.primary} stroke="#333" strokeWidth="4" />
          {/* Blue (Right) */}
          <polygon points="360,240 360,360 300,300" fill={colorPalette.blue.primary} stroke="#333" strokeWidth="4" />
          {/* Red (Bottom) */}
          <polygon points="240,360 360,360 300,300" fill={colorPalette.red.primary} stroke="#333" strokeWidth="4" />
          
          <rect x="286" y="286" width="28" height="28" fill="#FFFFFF" stroke="#333" strokeWidth="3" />
          <rect x="292" y="292" width="16" height="16" fill="#050505" />
        </g>

        {/* 4. RENDER TOKENS (RETRO CHIPS STYLE) */}
        <g id="tokens">
          {(['red', 'green', 'yellow', 'blue'] as PlayerColor[]).map((color) => {
            const playerTokens = visualTokens[color];
            if (!playerTokens) return null;
            
            return playerTokens.map((pos, idx) => {
              const layout = getTokenLayout(color, idx, pos);
              const interactive = isTokenInteractive(color, idx);
              const activePlayerColor = currentPlayer ? currentPlayer.color : null;
              
              // Glowing effect for tokens that can be moved
              const isMovingActive = interactive && activePlayerColor === color;
              
              // Check if this token is currently in a step jump animation
              const isThisTokenAnimating = animatingToken && animatingToken.color === color && animatingToken.index === idx;
              const jumpY = isThisTokenAnimating ? animatingToken.jumpHeight : 0;
              
              return (
                <g
                  key={`token-${color}-${idx}`}
                  className={`transition-all duration-300 ${interactive ? 'cursor-pointer' : 'pointer-events-none'}`}
                  onClick={() => interactive && onTokenClick(idx)}
                >
                  {/* Outer Pulsing highlight (lands flat on board) */}
                  {isMovingActive && (
                    <rect
                      x={layout.cx - layout.r - 4}
                      y={layout.cy - layout.r - 4}
                      width={(layout.r + 4) * 2}
                      height={(layout.r + 4) * 2}
                      fill="none"
                      stroke="#00F0FF"
                      strokeWidth="3"
                      className="animate-pulse"
                      opacity="0.9"
                    />
                  )}
                  
                  {/* Token Base Shadow (stays flat, shifts/fades when piece jumps!) */}
                  <rect
                    x={layout.cx - layout.r}
                    y={layout.cy - layout.r}
                    width={layout.r * 2}
                    height={layout.r * 2}
                    fill="black"
                    opacity={isThisTokenAnimating ? 0.15 : 0.4}
                    transform={isThisTokenAnimating ? "translate(4, 4) scale(0.95)" : "translate(2, 2)"}
                    className="transition-all duration-100"
                    style={{ transformOrigin: `${layout.cx}px ${layout.cy}px` }}
                  />

                  {/* Jumping Token Group (Translates vertically upwards by jumpY) */}
                  <g transform={`translate(0, ${-jumpY})`} className="transition-all duration-100">
                    {/* Main Token Body (Industrial Hexagonal/Square Feel) */}
                    <rect
                      x={layout.cx - layout.r}
                      y={layout.cy - layout.r}
                      width={layout.r * 2}
                      height={layout.r * 2}
                      fill={colorPalette[color].primary}
                      stroke="#FFFFFF"
                      strokeWidth={isMovingActive ? "4" : "2"}
                      filter={isMovingActive ? "url(#token-glow)" : undefined}
                      className="transition-all duration-300"
                    />

                    {/* Inner Details */}
                    <rect
                      x={layout.cx - layout.r + 3}
                      y={layout.cy - layout.r + 3}
                      width={(layout.r - 3) * 2}
                      height={(layout.r - 3) * 2}
                      fill="none"
                      stroke="black"
                      strokeWidth="1.5"
                      opacity="0.5"
                    />
                    
                    <rect
                      x={layout.cx - layout.r + 5}
                      y={layout.cy - layout.r + 5}
                      width={(layout.r - 5) * 2}
                      height={(layout.r - 5) * 2}
                      fill="#FFFFFF"
                      opacity="0.9"
                    />

                    {/* Text index representing the token ID */}
                    <text
                      x={layout.cx}
                      y={layout.cy + (layout.r > 10 ? 4 : 3)}
                      textAnchor="middle"
                      fill="black"
                      fontWeight="black"
                      fontFamily="monospace"
                      fontSize={layout.fontSize}
                    >
                      {idx + 1}
                    </text>
                  </g>
                </g>
              );
            });
          })}
        </g>
      </svg>
      
      {/* Overlay status screen for start / finish */}
      {status === 'waiting' && (
        <div className="absolute inset-0 bg-black/90 backdrop-blur-sm flex flex-col justify-center items-center p-6 text-center animate-fade-in z-20">
          <div className="bg-brand-dark border-4 border-brand-cyan p-8 rounded-none shadow-[10px_10px_0px_#00F0FF] max-w-sm">
            <h3 className="text-2xl font-black text-white mb-2 uppercase tracking-tight">LOBI GAME LUDO</h3>
            <p className="text-slate-400 text-xs font-mono uppercase mb-6 leading-relaxed">// Menunggu pembuat lobi memulai pertandingan. Minimal membutuhkan 2 pemain.</p>
            <div className="flex justify-center items-center gap-2">
              <span className="w-3.5 h-3.5 bg-brand-orange rounded-none animate-pulse"></span>
              <span className="w-3.5 h-3.5 bg-brand-cyan rounded-none animate-pulse delay-100"></span>
              <span className="w-3.5 h-3.5 bg-white rounded-none animate-pulse delay-200"></span>
            </div>
          </div>
        </div>
      )}
      
      {status === 'finished' && (
        <div className="absolute inset-0 bg-black/95 backdrop-blur-sm flex flex-col justify-center items-center p-6 text-center animate-fade-in z-20">
          <div className="bg-brand-dark border-8 border-brand-orange p-8 rounded-none shadow-[10px_10px_0px_rgba(242,125,38,0.3)] max-w-md">
            <span className="text-5xl mb-4 block animate-bounce">🏆</span>
            <h3 className="text-3xl font-black text-white mb-2 uppercase tracking-tighter">PERMAINAN SELESAI</h3>
            <p className="text-xl text-brand-cyan font-black mb-4 uppercase tracking-wider">
              PEMAIN {gameState.winnerColor} WINNER!
            </p>
            <p className="text-slate-300 text-xs font-mono uppercase mt-2 leading-relaxed">
              Bung Ludo: "Selamat atas kemenangan spektakuler ini! Sungguh pertandingan dengan tingkat kehokian yang tinggi!"
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

