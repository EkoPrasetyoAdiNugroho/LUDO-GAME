# 🎲 LUDO GAME

A modern **real-time multiplayer Ludo game** built with **React, TypeScript, Vite, Node.js, WebSocket, and Google Gemini AI**.

Play Ludo locally against computer bots or create an online room and play with other players in real time. The game also includes **AI-powered commentary, sound effects, background music, and an in-game chat system**.

## 🌐 Live Demo

🎮 **Play LUDO GAME:**
👉 https://ludo-game-seven-theta.vercel.app/

## ✨ Features

### 🎮 Local Game

* Play Ludo directly in your browser
* Play against up to 3 computer opponents
* Multiple bot difficulty levels:

  * Easy
  * Medium
  * Hard
* No internet connection is required for local gameplay

### 🌐 Online Multiplayer

* Create a multiplayer room
* Join rooms using a room code
* Support for up to 4 players
* Real-time synchronization using WebSocket
* Player connection status
* Bot support in online rooms
* Real-time multiplayer gameplay

### 🤖 AI Commentary

* Powered by **Google Gemini AI**
* Generates dynamic commentary based on game events
* Reacts to events such as:

  * Rolling a 6
  * Capturing an opponent
  * Reaching the finish
  * Winning the game
* Includes fallback commentary when Gemini is unavailable

### 💬 Real-Time Chat

* Chat with other players during online matches
* Messages are synchronized in real time
* Room-based chat system

### 🔊 Audio & Effects

* Dice rolling sound effects
* Background music
* Victory sounds
* Sound effects toggle
* Music toggle
* Victory animations and confetti

### 🎨 Modern UI

* Responsive design
* Animated interface
* Interactive Ludo board
* Player status indicators
* Game event log
* Rules panel
* Connection status
* Modern icons and visual effects

---

## 🛠️ Tech Stack

| Technology           | Purpose                             |
| -------------------- | ----------------------------------- |
| **React**            | User interface                      |
| **TypeScript**       | Type safety and application logic   |
| **Vite**             | Frontend development and build tool |
| **Node.js**          | Backend runtime                     |
| **WebSocket**        | Real-time multiplayer               |
| **Google Gemini AI** | AI game commentary                  |
| **Motion**           | UI animations                       |
| **Lucide React**     | Icons                               |
| **Tailwind CSS**     | Styling                             |
| **ESBuild**          | Server bundling                     |

---

## 🎯 Game Modes

### 🖥️ Local Mode

Play against computer-controlled opponents.

```text
You
 │
 ├── Bot
 ├── Bot
 └── Bot
```

Choose your preferred difficulty and start playing immediately.

### 🌍 Online Multiplayer

Play against real players through an online room.

```text
Player 1 ──┐
Player 2 ──┼── WebSocket ──> Game Server
Player 3 ──┤
Player 4 ──┘
```

---

## 🚀 Getting Started

### Clone the Repository

```bash
git clone https://github.com/EkoPrasetyoAdiNugroho/LUDO-GAME.git
cd LUDO-GAME
```

### Install Dependencies

```bash
npm install
```

### Configure Gemini AI

Create an environment file and add your Gemini API key:

```env
GEMINI_API_KEY=your_gemini_api_key
```

> ⚠️ Never commit your API key to GitHub.

### Run the Development Server

```bash
npm run dev
```

Then open the local URL shown in your terminal.

---

## 📦 Production Build

```bash
npm run build
```

Start the production server:

```bash
npm start
```

---

## 🎮 How to Play

### Local Game

1. Open the game.
2. Select **Local Game**.
3. Select the number of bot opponents.
4. Choose the bot difficulty.
5. Start the match.
6. Roll the dice.
7. Move your pieces strategically.
8. Capture opponents and reach the finish first.

### Online Multiplayer

1. Select **Online Multiplayer**.
2. Enter your player name.
3. Create a room.
4. Share the room code.
5. Other players join using the room code.
6. Start the game.
7. Play together in real time.

---

## 🏗️ Project Architecture

```text
                 ┌─────────────────────┐
                 │      LUDO GAME      │
                 │   React + TypeScript│
                 └──────────┬──────────┘
                            │
              ┌─────────────┴─────────────┐
              │                           │
              ▼                           ▼
       ┌──────────────┐            ┌───────────────┐
       │  Local Mode  │            │  Online Mode  │
       └──────┬───────┘            └───────┬───────┘
              │                            │
              ▼                            ▼
        Game State                  WebSocket Server
                                           │
                                           ▼
                                    Multiplayer Room
                                           │
                                           ▼
                                      Game State
                                           │
                                           ▼
                                        Players

                         ┌─────────────────────┐
                         │   Google Gemini AI  │
                         │   Game Commentary   │
                         └─────────────────────┘
```

---

## ⚠️ Notes

The online multiplayer system uses an in-memory room system. Active room data may be lost when the server restarts.

The application requires a WebSocket-compatible server environment for multiplayer functionality.

AI commentary requires a valid Gemini API key. Without it, fallback commentary can be used.

---

## 👨‍💻 Developer

**Eko Prasetyo Adi Nugroho**

GitHub:
https://github.com/EkoPrasetyoAdiNugroho

Repository:
https://github.com/EkoPrasetyoAdiNugroho/LUDO-GAME

---

## 📄 License

This project was created for **educational and academic purposes**.

---

## ⭐ LUDO GAME

> **Roll the dice. Move your pieces. Capture your rivals. Rule the board.** 🎲🏆
