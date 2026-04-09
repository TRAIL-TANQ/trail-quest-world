import { useEffect, useState, useRef } from 'react';
import { useAltStore } from '@/lib/stores';

interface Particle {
  id: number;
  tx: number;
  ty: number;
  delay: number;
}

export default function AltEarnEffect() {
  const { showEarnEffect, earnedAmount, clearEarnEffect } = useAltStore();
  const [particles, setParticles] = useState<Particle[]>([]);
  const [visible, setVisible] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    if (showEarnEffect && earnedAmount > 0) {
      // Generate particles
      const newParticles: Particle[] = [];
      const count = 6 + Math.floor(Math.random() * 3);
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
        const dist = 40 + Math.random() * 40;
        newParticles.push({
          id: i,
          tx: Math.cos(angle) * dist,
          ty: Math.sin(angle) * dist - 20,
          delay: Math.random() * 0.2,
        });
      }
      setParticles(newParticles);
      setVisible(true);

      timeoutRef.current = setTimeout(() => {
        setVisible(false);
        clearEarnEffect();
      }, 1800);
    }
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [showEarnEffect, earnedAmount, clearEarnEffect]);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[100] pointer-events-none flex items-center justify-center">
      {/* Floating text */}
      <div
        className="text-2xl font-extrabold"
        style={{
          color: '#F59E0B',
          textShadow: '0 0 16px rgba(245,158,11,0.6), 0 2px 4px rgba(0,0,0,0.5)',
          animation: 'coin-float 1.5s ease-out forwards',
        }}
      >
        +{earnedAmount} ALT
      </div>

      {/* Coin particles */}
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute w-2.5 h-2.5 rounded-full"
          style={{
            background: '#F59E0B',
            boxShadow: '0 0 6px rgba(245,158,11,0.6)',
            '--tx': `${p.tx}px`,
            '--ty': `${p.ty}px`,
            animation: `coin-burst 0.8s ${p.delay}s ease-out forwards`,
            opacity: 0,
            animationFillMode: 'forwards',
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}
