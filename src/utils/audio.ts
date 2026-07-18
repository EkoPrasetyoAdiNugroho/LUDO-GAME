/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Web Audio API Retro Sound Effects Synthesizer and HTML5 Audio Player for Local MP3 files
let audioCtx: AudioContext | null = null;
let isMuted = false;
let isBgmMuted = false;
let bgmVolume = 0.3; // Default background volume (lower so it doesn't overpower SFX)

// Predefined local and remote fallback URLs
const LOCAL_AUDIO_PATHS = {
  click: '/assets/sounds/click.mp3',
  roll: '/assets/sounds/roll.mp3',
  jump: '/assets/sounds/jump.mp3',
  capture: '/assets/sounds/capture.mp3',
  home: '/assets/sounds/home.mp3',
  victory: '/assets/sounds/victory.mp3',
  bgm: '/assets/sounds/bgm.mp3'
};

// Candidate paths to search for background music (prioritizing the uploaded "coin toss garden.mp3")
const BGM_CANDIDATES = [
  '/coin toss garden.mp3',
  '/coin%20toss%20garden.mp3',
  '/assets/sounds/coin toss garden.mp3',
  '/assets/sounds/coin%20toss%20garden.mp3',
  '/assets/coin toss garden.mp3',
  '/assets/coin%20toss%20garden.mp3',
  '/assets/sounds/bgm.mp3',
  '/bgm.mp3'
];

// Fallback BGM URL in case local file is not present
const FALLBACK_BGM_URL = 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3';

let bgmAudio: HTMLAudioElement | null = null;
const sfxAudioCache: Record<string, HTMLAudioElement> = {};

// Initialize state from localStorage
if (typeof window !== 'undefined') {
  isMuted = localStorage.getItem('ludo_sfx_muted') === 'true';
  isBgmMuted = localStorage.getItem('ludo_bgm_muted') === 'true';
  const savedVol = localStorage.getItem('ludo_bgm_volume');
  if (savedVol) bgmVolume = parseFloat(savedVol);
}

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

// Lazy-load and cache audio elements
function getLocalAudio(key: keyof typeof LOCAL_AUDIO_PATHS, isBgm = false): HTMLAudioElement | null {
  if (typeof window === 'undefined') return null;
  
  if (isBgm) {
    if (!bgmAudio) {
      let candidateIdx = 0;
      bgmAudio = new Audio(BGM_CANDIDATES[candidateIdx]);
      bgmAudio.loop = true;
      bgmAudio.volume = bgmVolume;
      
      // Handle fallback to next candidate or remote URL if missing
      bgmAudio.addEventListener('error', (e) => {
        candidateIdx++;
        if (bgmAudio) {
          if (candidateIdx < BGM_CANDIDATES.length) {
            const nextCandidate = BGM_CANDIDATES[candidateIdx];
            console.log(`BGM candidate failed. Trying next candidate: ${nextCandidate}`);
            bgmAudio.src = nextCandidate;
            if (!isBgmMuted) {
              bgmAudio.play().catch(err => console.log('BGM candidate play deferred:', err.message));
            }
          } else if (bgmAudio.src !== FALLBACK_BGM_URL) {
            console.warn('All local BGM/coin toss garden candidates failed. Trying fallback remote music loop...');
            bgmAudio.src = FALLBACK_BGM_URL;
            if (!isBgmMuted) {
              bgmAudio.play().catch(err => console.log('Autoplay BGM failed:', err.message));
            }
          }
        }
      });
    }
    return bgmAudio;
  }

  if (!sfxAudioCache[key]) {
    sfxAudioCache[key] = new Audio(LOCAL_AUDIO_PATHS[key]);
  }
  return sfxAudioCache[key];
}

// Helper to play local files with immediate synth fallback
function playLocalWithFallback(key: keyof typeof LOCAL_AUDIO_PATHS, synthCallback: () => void) {
  if (isMuted) return;
  const audio = getLocalAudio(key);
  if (!audio) {
    synthCallback();
    return;
  }

  audio.currentTime = 0;
  audio.play()
    .then(() => {
      console.log(`Playing local audio asset for: ${key}`);
    })
    .catch((err) => {
      // Clean fallback if local asset is 404 or blocked by browser policies
      console.debug(`Local file for ${key} was not found or blocked. Playing synthesizer fallback.`, err.message);
      synthCallback();
    });
}

export const sfx = {
  getMuted: () => isMuted,
  setMuted: (muted: boolean) => {
    isMuted = muted;
    if (typeof window !== 'undefined') {
      localStorage.setItem('ludo_sfx_muted', String(muted));
    }
  },
  toggleMuted: () => {
    const nextVal = !isMuted;
    sfx.setMuted(nextVal);
    sfx.playClick();
    return nextVal;
  },

  // BGM specific handlers
  getBgmMuted: () => isBgmMuted,
  setBgmMuted: (muted: boolean) => {
    isBgmMuted = muted;
    if (typeof window !== 'undefined') {
      localStorage.setItem('ludo_bgm_muted', String(muted));
    }
    const bgm = getLocalAudio('bgm', true);
    if (bgm) {
      if (muted) {
        bgm.pause();
      } else {
        bgm.volume = bgmVolume;
        bgm.play().catch(err => console.log('BGM resume play prevented:', err.message));
      }
    }
  },
  toggleBgmMuted: () => {
    const nextVal = !isBgmMuted;
    sfx.setBgmMuted(nextVal);
    return nextVal;
  },
  getBgmVolume: () => bgmVolume,
  setBgmVolume: (vol: number) => {
    bgmVolume = vol;
    if (typeof window !== 'undefined') {
      localStorage.setItem('ludo_bgm_volume', String(vol));
    }
    const bgm = getLocalAudio('bgm', true);
    if (bgm) {
      bgm.volume = vol;
    }
  },
  playBgm: () => {
    if (isBgmMuted) return;
    const bgm = getLocalAudio('bgm', true);
    if (bgm) {
      bgm.play().catch(err => console.log('BGM play deferred until user interaction:', err.message));
    }
  },
  stopBgm: () => {
    const bgm = getLocalAudio('bgm', true);
    if (bgm) {
      bgm.pause();
    }
  },

  playClick: () => {
    playLocalWithFallback('click', () => {
      const ctx = getAudioContext();
      if (!ctx) return;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.08);

      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 0.08);

      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    });
  },

  playRoll: () => {
    playLocalWithFallback('roll', () => {
      const ctx = getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const duration = 0.6;
      const clicksCount = 8;

      for (let i = 0; i < clicksCount; i++) {
        const clickTime = now + (i * (duration / clicksCount));
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.connect(gain);
        gain.connect(ctx.destination);

        const freq = 120 + Math.random() * 80;
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, clickTime);
        osc.frequency.exponentialRampToValueAtTime(freq / 2, clickTime + 0.05);

        gain.gain.setValueAtTime(0.12, clickTime);
        gain.gain.linearRampToValueAtTime(0.0001, clickTime + 0.05);

        osc.start(clickTime);
        osc.stop(clickTime + 0.05);
      }
    });
  },

  playJump: (stepIndex = 0) => {
    // Custom jump local play
    playLocalWithFallback('jump', () => {
      const ctx = getAudioContext();
      if (!ctx) return;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.type = 'sine';
      const baseFreq = 220 + (stepIndex * 35);
      const targetFreq = baseFreq * 1.5;

      osc.frequency.setValueAtTime(baseFreq, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(targetFreq, ctx.currentTime + 0.12);

      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);

      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    });
  },

  playCapture: () => {
    playLocalWithFallback('capture', () => {
      const ctx = getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      
      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(900, now);
      osc1.frequency.exponentialRampToValueAtTime(60, now + 0.45);
      
      gain1.gain.setValueAtTime(0.12, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      
      osc1.start(now);
      osc1.stop(now + 0.45);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(100, now + 0.05);
      osc2.frequency.linearRampToValueAtTime(20, now + 0.35);
      
      gain2.gain.setValueAtTime(0.2, now + 0.05);
      gain2.gain.linearRampToValueAtTime(0.001, now + 0.35);
      
      osc2.start(now + 0.05);
      osc2.stop(now + 0.35);
    });
  },

  playHome: () => {
    playLocalWithFallback('home', () => {
      const ctx = getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const notes = [261.63, 329.63, 392.00, 523.25];
      
      notes.forEach((freq, idx) => {
        const noteTime = now + (idx * 0.08);
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, noteTime);
        
        gain.gain.setValueAtTime(0.12, noteTime);
        gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.25);

        osc.start(noteTime);
        osc.stop(noteTime + 0.25);
      });
    });
  },

  playVictory: () => {
    playLocalWithFallback('victory', () => {
      const ctx = getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const fanNotes = [
        { freq: 261.63, duration: 0.15, delay: 0 },
        { freq: 329.63, duration: 0.15, delay: 0.15 },
        { freq: 392.00, duration: 0.15, delay: 0.3 },
        { freq: 523.25, duration: 0.3, delay: 0.45 },
        { freq: 392.00, duration: 0.15, delay: 0.75 },
        { freq: 523.25, duration: 0.5, delay: 0.9 },
      ];

      fanNotes.forEach((note) => {
        const noteTime = now + note.delay;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(note.freq, noteTime);

        gain.gain.setValueAtTime(0.15, noteTime);
        gain.gain.linearRampToValueAtTime(0.001, noteTime + note.duration);

        osc.start(noteTime);
        osc.stop(noteTime + note.duration);
      });
    });
  },
};

