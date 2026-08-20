# 🎲 LUDO GAME

A modern web-based Ludo game with **local multiplayer, AI bots, online multiplayer, real-time chat, animations, sound effects, and AI-powered game commentary**.

Built with **React, TypeScript, Vite, WebSocket, Express, and Google Gemini**.

---

## 🎮 Features

### 🏠 Local Game

* Play Ludo locally without requiring other players.
* Add computer-controlled opponents.
* Support up to **4 players**.
* Bot difficulty levels:

  * 🟢 Easy
  * 🟡 Medium
  * 🔴 Hard

### 🌐 Online Multiplayer

* Create an online game room.
* Join a room using a unique room code.
* Real-time game synchronization using **WebSocket**.
* Supports up to **4 players** in one room.
* Automatic reconnection when the connection is temporarily lost.
* Online bots are processed server-side.

### 🤖 AI Bot

Computer opponents can make decisions based on the selected difficulty level.

The bot evaluates available moves and selects a token to move according to the current game state.

### 🎙️ AI Ludo Commentary

The game includes an AI-powered commentator using **Google Gemini**.

The commentator can react to events such as:

* 🎲 Dice rolls
* 🍖 Capturing opponent tokens
* ⭐ Getting bonus turns
* 🏆 Winning the match
* 🔥 Other important game events

If the Gemini API is unavailable, the game automatically falls back to local commentary.

### 💬 Real-Time Chat

Players can communicate with each other through the in-game chat system.

### 🔊 Audio System

* Background music
* Dice roll sound effects
* Victory sound effects
* Sound effects toggle
* Background music toggle

### 🎨 Interactive UI

* Animated game components
* Animated dice
* Token movement
* Victory celebration
* Confetti effects
* Responsive game interface
* Lucide icons
* Motion animations

---

## 🕹️ Game Rules

The game follows the basic mechanics of Ludo.

### Dice

Players roll a six-sided dice to determine how many spaces a token can move.

### Starting a Token

Tokens start inside their home area.

A token can enter the board when the required condition is met according to the game rules.

### Capturing

If a player's token lands on an opponent's token at a capturable position, the opponent's token is sent back to its home area.

### Bonus Turn

Players can receive another dice roll after certain actions, including:

* Rolling a **6**
* Capturing an opponent's token
* Reaching the final position

### Three Consecutive Sixes

Rolling six three times consecutively causes the current turn to be cancelled and passed to the next player.

### Winning

A player wins when all of their tokens successfully reach the final position.

---

## 🧠 Game Architecture

The project supports two main gameplay modes.

```text
                    ┌─────────────────┐
                    │   LUDO GAME     │
                    └────────┬────────┘
                             │
              ┌──────────────┴──────────────┐
              │                             │
       ┌──────▼──────┐               ┌──────▼──────┐
       │ Local Mode  │               │ Online Mode │
       └──────┬──────┘               └──────┬──────┘
              │                             │
       ┌──────▼──────┐               ┌──────▼──────┐
       │ Bot Engine  │               │  WebSocket  │
       └──────┬──────┘               └──────┬──────┘
              │                             │
              │                      ┌──────▼──────┐
              │                      │   Express    │
              │                      │    Server    │
              │                      └──────┬──────┘
              │                             │
              │                      ┌──────▼──────┐
              │                      │ Game Rooms  │
              │                      └─────────────┘
              │
              └──────────────┬──────────────┘
                             │
                    ┌────────▼────────┐
                    │   Game Logic    │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │ Gemini AI       │
                    │ Commentary      │
                    └─────────────────┘
```

---

## 🛠️ Technologies

| Technology            | Purpose                             |
| --------------------- | ----------------------------------- |
| **React**             | User interface                      |
| **TypeScript**        | Type-safe application development   |
| **Vite**              | Frontend development and build tool |
| **Express**           | Backend HTTP server                 |
| **WebSocket (`ws`)**  | Real-time multiplayer communication |
| **Google Gemini API** | AI game commentary                  |
| **Motion**            | UI and game animations              |
| **Lucide React**      | Interface icons                     |
| **Tailwind CSS**      | UI styling                          |
| **esbuild**           | Server bundling                     |
| **tsx**               | Running TypeScript server code      |

The project currently uses React 19, TypeScript 5.8, Vite 6, Express 4, WebSocket, Motion, and the Google GenAI SDK.

---

## 📂 Project Structure

```text
LUDO-GAME/
│
├── assets/
│   └── .aistudio
│
├── public/
│   └── assets/
│       └── sounds/
│
├── src/
│   ├── components/
│   │   ├── ConfettiCelebration.tsx
│   │   ├── GameControls.tsx
│   │   ├── GeminiCommentary.tsx
│   │   ├── LudoBoard.tsx
│   │   └── LudoLobby.tsx
│   │
│   ├── gameLogic.ts
│   ├── types.ts
│   ├── App.tsx
│   └── main.tsx
│
├── .env.example
├── .gitignore
├── index.html
├── metadata.json
├── package.json
├── server.ts
├── tsconfig.json
├── vite.config.ts
└── README.md
```

The repository contains separate frontend components, game logic, a TypeScript server, WebSocket functionality, and game audio assets.

---

## 🚀 Getting Started

### Prerequisites

Make sure you have installed:

* [Node.js](https://nodejs.org/)
* npm

You can also use Bun because the repository includes a `bun.lock` file.

---

### 1. Clone Repository

```bash
git clone https://github.com/EkoPrasetyoAdiNugroho/LUDO-GAME.git
```

```bash
cd LUDO-GAME
```

---

### 2. Install Dependencies

Using npm:

```bash
npm install
```

Or using Bun:

```bash
bun install
```

---

### 3. Configure Environment Variables

Create a `.env` file based on `.env.example`.

```env
GEMINI_API_KEY=your_gemini_api_key
```

The Gemini API key is used by the server to generate AI-powered Ludo commentary. If the key is unavailable, the application uses fallback commentary.

> **Important:** Never commit your real API key to GitHub.

---

### 4. Run Development Server

```bash
npm run dev
```

The project uses `tsx server.ts` for its development command.

Then open the local address displayed by the development server in your browser.

---

## 🏗️ Production Build

Create a production build:

```bash
npm run build
```

Start the production server:

```bash
npm start
```

Preview the Vite production build:

```bash
npm run preview
```

TypeScript checking:

```bash
npm run lint
```

These commands are defined in the project's `package.json`.

---

## 🌐 Multiplayer System

The online multiplayer mode uses a WebSocket connection.

```text
Player 1
   │
   │ WebSocket
   ▼
┌───────────────┐
│ Express + WS  │
│    Server     │
└───────┬───────┘
        │
        │ Game State
        ▼
┌───────────────┐
│  Room Manager │
└───────┬───────┘
        │
   ┌────┴────┐
   ▼         ▼
Player 2   Player 3
```

Players can:

* Create rooms
* Join rooms
* Start games
* Roll dice
* Move tokens
* Add/remove bots
* Send chat messages
* Restart games

The server maintains game rooms in memory and broadcasts game-state updates to connected players.

---

## 🤖 Bot Difficulty

Bots can be configured with three difficulty levels:

```text
Easy
  ↓
Medium
  ↓
Hard
```

The bot system uses the current game state, available moves, dice value, token positions, and selected difficulty to determine which token should be moved.

---

## 🎙️ Gemini AI Commentary

The AI commentator is powered by Google's Gemini API.

Example events that can trigger commentary:

```text
Player rolls a 6
        ↓
Bonus turn
        ↓
Gemini generates commentary
        ↓
Commentary broadcast to room
        ↓
Displayed in game chat/commentator UI
```

The server sends the current game information and recent event to Gemini to generate short, humorous Indonesian commentary.

---

## 🔐 Security Notes

* Keep `GEMINI_API_KEY` inside environment variables.
* Do not upload `.env` files containing secrets.
* The current multiplayer server stores rooms **in memory**.
* Restarting the server will clear active rooms and game sessions.

---

## 📌 Current Limitations

* Game rooms are stored in server memory.
* Active rooms are lost when the server restarts.
* Multiplayer requires a running WebSocket server.
* Gemini commentary requires a valid Gemini API key for AI-generated responses.
* The project is currently designed as a web-based game rather than a persistent account-based multiplayer platform.

---

## 🔮 Future Improvements

Possible future improvements:

* [ ] Persistent database for game rooms
* [ ] User accounts and authentication
* [ ] Player statistics
* [ ] Leaderboards
* [ ] Match history
* [ ] Spectator mode
* [ ] More advanced AI bots
* [ ] Mobile optimization
* [ ] Custom player avatars
* [ ] Private/invite-only rooms
* [ ] Improved anti-cheat validation
* [ ] Persistent online profiles
* [ ] Deployment with scalable WebSocket infrastructure

---

## 👨‍💻 Author

**Eko Prasetyo Adi Nugroho**

Universitas Muhammadiyah Makassar
Teknik Informatika

GitHub:
https://github.com/EkoPrasetyoAdiNugroho

---

## 📄 License

This project contains source code licensed under the **Apache License 2.0**. See the source files and repository for the applicable license information.

---

⭐ If you find this project interesting, consider giving the repository a star!

**Repository:**
https://github.com/EkoPrasetyoAdiNugroho/LUDO-GAME
