import React, { useEffect, useRef } from 'react';

interface ConfettiParticle {
  x: number;
  y: number;
  size: number;
  color: string;
  vx: number;
  vy: number;
  rotation: number;
  rotationSpeed: number;
  opacity: number;
  shape: 'circle' | 'square' | 'triangle';
}

const COLORS = [
  '#FF5964', // Red
  '#35A7FF', // Blue
  '#386150', // Emerald/Green
  '#FFE74C', // Yellow
  '#FF9F1C', // Orange
  '#F26419', // Dark Orange
  '#864879', // Purple
  '#00F0FF', // Cyan
  '#E63946', // Rose
];

const SHAPES: Array<'circle' | 'square' | 'triangle'> = ['circle', 'square', 'triangle'];

export const ConfettiCelebration: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let particles: ConfettiParticle[] = [];

    // Resize canvas
    const resizeCanvas = () => {
      if (canvas) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      }
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Create initial burst
    const spawnBurst = () => {
      const particleCount = 180;
      for (let i = 0; i < particleCount; i++) {
        // Spawn mostly from the lower corners or center bottom pointing upward
        const fromLeft = Math.random() < 0.5;
        const x = fromLeft ? -10 : window.innerWidth + 10;
        const y = window.innerHeight * 0.7 + (Math.random() * 50);
        
        const angle = fromLeft 
          ? -Math.PI / 4 + (Math.random() * Math.PI / 6) // point top-right
          : -3 * Math.PI / 4 - (Math.random() * Math.PI / 6); // point top-left

        const speed = 15 + Math.random() * 22;

        particles.push({
          x,
          y,
          size: 6 + Math.random() * 10,
          color: COLORS[Math.floor(Math.random() * COLORS.length)],
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          rotation: Math.random() * Math.PI * 2,
          rotationSpeed: -0.1 + Math.random() * 0.2,
          opacity: 1,
          shape: SHAPES[Math.floor(Math.random() * SHAPES.length)],
        });
      }

      // Add central high bursts
      for (let i = 0; i < 70; i++) {
        particles.push({
          x: window.innerWidth / 2,
          y: window.innerHeight + 10,
          size: 6 + Math.random() * 8,
          color: COLORS[Math.floor(Math.random() * COLORS.length)],
          vx: -5 + Math.random() * 10,
          vy: -15 - Math.random() * 12,
          rotation: Math.random() * Math.PI * 2,
          rotationSpeed: -0.15 + Math.random() * 0.3,
          opacity: 1,
          shape: SHAPES[Math.floor(Math.random() * SHAPES.length)],
        });
      }
    };

    spawnBurst();

    // Spawn mini bursts intermittently
    const interval = setInterval(() => {
      // Small randomized bursts
      const x = Math.random() * window.innerWidth;
      for (let i = 0; i < 20; i++) {
        particles.push({
          x,
          y: window.innerHeight + 10,
          size: 5 + Math.random() * 8,
          color: COLORS[Math.floor(Math.random() * COLORS.length)],
          vx: -4 + Math.random() * 8,
          vy: -10 - Math.random() * 10,
          rotation: Math.random() * Math.PI * 2,
          rotationSpeed: -0.1 + Math.random() * 0.2,
          opacity: 1,
          shape: SHAPES[Math.floor(Math.random() * SHAPES.length)],
        });
      }
    }, 1800);

    // Animation Loop
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles = particles.filter(p => p.opacity > 0.01 && p.y < window.innerHeight + 50 && p.x > -100 && p.x < window.innerWidth + 100);

      particles.forEach(p => {
        // Physics update
        p.vy += 0.35; // gravity
        p.vx *= 0.98; // air resistance
        p.vy *= 0.98;
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.rotationSpeed;
        
        // Horizontal drift (wind)
        p.x += Math.sin(p.y / 30) * 0.35;

        // Draw particle
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.globalAlpha = p.opacity;
        ctx.fillStyle = p.color;

        if (p.shape === 'circle') {
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
          ctx.fill();
        } else if (p.shape === 'triangle') {
          ctx.beginPath();
          ctx.moveTo(0, -p.size / 2);
          ctx.lineTo(p.size / 2, p.size / 2);
          ctx.lineTo(-p.size / 2, p.size / 2);
          ctx.closePath();
          ctx.fill();
        } else {
          // square
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        }

        ctx.restore();

        // Slow fade out near bottom half
        if (p.y > window.innerHeight * 0.5) {
          p.opacity -= 0.005;
        }
      });

      animationId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      clearInterval(interval);
      cancelAnimationFrame(animationId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      id="victory-confetti"
      className="fixed inset-0 pointer-events-none z-[100]"
    />
  );
};
