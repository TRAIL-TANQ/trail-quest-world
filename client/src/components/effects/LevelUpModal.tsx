import { useEffect, useState, useMemo } from 'react';
import { X } from 'lucide-react';

interface LevelUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  newLevel: number;
  title: string;
}

interface GoldParticle {
  id: number;
  x: number;
  y: number;
  size: number;
  delay: number;
  duration: number;
  px: number;
  py: number;
}

export default function LevelUpModal({ isOpen, onClose, newLevel, title }: LevelUpModalProps) {
  const [phase, setPhase] = useState(0);

  const particles = useMemo<GoldParticle[]>(() => {
    const arr: GoldParticle[] = [];
    for (let i = 0; i < 30; i++) {
      const angle = (Math.PI * 2 * i) / 30;
      const dist = 80 + Math.random() * 120;
      arr.push({
        id: i,
        x: 50 + (Math.random() - 0.5) * 60,
        y: 50 + (Math.random() - 0.5) * 40,
        size: 4 + Math.random() * 6,
        delay: Math.random() * 0.6,
        duration: 1.5 + Math.random() * 1,
        px: Math.cos(angle) * dist,
        py: Math.sin(angle) * dist,
      });
    }
    return arr;
  }, []);

  useEffect(() => {
    if (!isOpen) { setPhase(0); return; }
    setPhase(1);
    const t1 = setTimeout(() => setPhase(2), 200);
    const t2 = setTimeout(() => setPhase(3), 700);
    const t3 = setTimeout(() => setPhase(4), 1200);
    const t4 = setTimeout(() => setPhase(5), 1700);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
  }, [isOpen]);

  if (!isOpen && phase === 0) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center"
      style={{ background: phase >= 1 ? 'rgba(0,0,0,0.85)' : 'transparent', transition: 'background 0.3s ease' }}>
      {/* Flash effect */}
      {phase === 2 && (
        <div className="absolute inset-0"
          style={{ background: 'radial-gradient(circle, rgba(255,215,0,0.3) 0%, transparent 70%)', animation: 'flash 0.6s ease-out forwards' }} />
      )}

      {/* Gold particles */}
      {phase >= 5 && particles.map((p) => (
        <div key={p.id} className="absolute rounded-full"
          style={{
            left: `${p.x}%`, top: `${p.y}%`, width: p.size, height: p.size,
            background: '#ffd700', boxShadow: '0 0 6px rgba(255,215,0,0.5)',
            '--px': `${p.px}px`, '--py': `${p.py}px`,
            animation: `particle-fly ${p.duration}s ${p.delay}s ease-out infinite`, opacity: 0,
          } as React.CSSProperties} />
      ))}

      <div className="relative flex flex-col items-center gap-4 px-8">
        {/* LEVEL UP! text */}
        {phase >= 2 && (
          <div className="text-4xl font-black tracking-widest"
            style={{
              color: '#ffd700',
              textShadow: '0 0 20px rgba(255,215,0,0.6), 0 0 40px rgba(255,215,0,0.3), 0 2px 4px rgba(0,0,0,0.5)',
              animation: 'level-up-text 0.6s ease-out forwards',
              fontFamily: 'var(--font-cinzel), serif',
            }}>
            LEVEL UP!
          </div>
        )}

        {/* Level number */}
        {phase >= 3 && (
          <div className="text-6xl font-black font-[var(--font-orbitron)]"
            style={{
              color: '#fde68a',
              textShadow: '0 0 16px rgba(255,215,0,0.5), 0 2px 4px rgba(0,0,0,0.5)',
              animation: 'bounce-in 0.5s ease-out forwards',
            }}>
            Lv. {newLevel}
          </div>
        )}

        {/* Title */}
        {phase >= 4 && (
          <div className="text-lg font-bold px-6 py-2 rounded-full"
            style={{
              background: 'rgba(255,215,0,0.1)',
              border: '1px solid rgba(255,215,0,0.3)',
              color: '#fde68a',
              animation: 'scale-in 0.3s ease-out forwards',
            }}>
            {title}
          </div>
        )}

        {/* OK button */}
        {phase >= 5 && (
          <button onClick={onClose}
            className="rpg-btn rpg-btn-gold mt-6 px-10 py-3 text-base"
            style={{ animation: 'scale-in 0.3s ease-out forwards' }}>
            OK
          </button>
        )}
      </div>

      {/* Close button */}
      {phase >= 5 && (
        <button onClick={onClose} className="absolute top-8 right-6 p-2 rounded-full active:scale-90"
          style={{ color: 'rgba(255,215,0,0.4)' }}>
          <X className="w-5 h-5" />
        </button>
      )}
    </div>
  );
}
