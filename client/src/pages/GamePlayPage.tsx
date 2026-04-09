/*
 * GamePlayPage: Playable number tap game
 * Full-screen RPG game interface with ornate score display, timer, game board
 * Rich gold frames, magical atmosphere
 * Keeps ALT earn effect triggers from v2
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useLocation } from 'wouter';
import { useUserStore, useGameStore, useAltStore } from '@/lib/stores';
import { MOCK_GAMES } from '@/lib/mockData';

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

type GamePhase = 'start' | 'playing' | 'finished';

const tileColors = [
  '#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#8b5cf6',
  '#ec4899', '#06b6d4', '#f97316', '#14b8a6', '#a855f7',
  '#eab308', '#6366f1', '#10b981', '#e11d48', '#0ea5e9', '#d946ef',
];

export default function GamePlayPage() {
  const params = useParams<{ gameId: string }>();
  const [, navigate] = useLocation();
  const addTotalAlt = useUserStore((s) => s.addTotalAlt);
  const setLastResult = useGameStore((s) => s.setLastResult);
  const triggerEarnEffect = useAltStore((s) => s.triggerEarnEffect);

  const game = MOCK_GAMES.find((g) => g.id === params.gameId);

  const [phase, setPhase] = useState<GamePhase>('start');
  const [score, setScore] = useState(0);
  const [nextNumber, setNextNumber] = useState(1);
  const [numbers, setNumbers] = useState<number[]>([]);
  const [tappedNumbers, setTappedNumbers] = useState<Set<number>>(new Set());
  const [timeLeft, setTimeLeft] = useState(60);
  const [combo, setCombo] = useState(0);
  const [showCombo, setShowCombo] = useState(false);
  const [wrongTap, setWrongTap] = useState<number | null>(null);
  const startTimeRef = useRef(0);
  const gridSize = 16;

  const initGame = useCallback(() => {
    const nums = Array.from({ length: gridSize }, (_, i) => i + 1);
    setNumbers(shuffleArray(nums));
    setNextNumber(1);
    setScore(0);
    setTappedNumbers(new Set());
    setTimeLeft(60);
    setCombo(0);
    setWrongTap(null);
    startTimeRef.current = Date.now();
    setPhase('playing');
  }, []);

  useEffect(() => {
    if (phase !== 'playing') return;
    const interval = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(interval);
          setPhase('finished');
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [phase]);

  const handleTap = (num: number) => {
    if (phase !== 'playing') return;
    if (num === nextNumber) {
      const newTapped = new Set(tappedNumbers);
      newTapped.add(num);
      setTappedNumbers(newTapped);
      setNextNumber(num + 1);
      const newCombo = combo + 1;
      setCombo(newCombo);
      setShowCombo(true);
      setWrongTap(null);
      setTimeout(() => setShowCombo(false), 600);
      const comboBonus = Math.floor(newCombo / 3);
      setScore((s) => s + 10 + comboBonus * 5);
      if (num === gridSize) setPhase('finished');
    } else {
      setCombo(0);
      setWrongTap(num);
      setTimeout(() => setWrongTap(null), 300);
    }
  };

  const handleFinish = () => {
    const timeSeconds = Math.floor((Date.now() - startTimeRef.current) / 1000);
    const altReward = game?.altReward || 10;
    addTotalAlt(altReward);
    triggerEarnEffect(altReward);
    setLastResult({
      score,
      maxScore: gridSize * 15,
      timeSeconds,
      accuracy: tappedNumbers.size / gridSize,
      isBestScore: score > 100,
    });
    navigate('/result');
  };

  if (!game) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0b1128' }}>
        <div className="text-center">
          <p className="text-xl mb-4" style={{ color: '#ffd700' }}>ゲームが見つかりません</p>
          <button onClick={() => navigate('/games')} className="rpg-btn rpg-btn-gold">ゲーム一覧に戻る</button>
        </div>
      </div>
    );
  }

  // Start Screen
  if (phase === 'start') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6"
        style={{ background: 'linear-gradient(180deg, #0b1128 0%, #151d3b 50%, #0e1430 100%)' }}>
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-64 h-64 rounded-full blur-3xl"
          style={{ background: 'rgba(255,215,0,0.05)' }} />
        <div className="relative rounded-2xl p-6 w-full max-w-sm text-center overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, rgba(21,29,59,0.95), rgba(14,20,45,0.95))',
            border: '2px solid rgba(255,215,0,0.35)',
            boxShadow: 'inset 0 0 30px rgba(255,215,0,0.05), 0 8px 32px rgba(0,0,0,0.5)',
          }}>
          <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2" style={{ borderColor: 'rgba(255,215,0,0.6)' }} />
          <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2" style={{ borderColor: 'rgba(255,215,0,0.6)' }} />
          <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2" style={{ borderColor: 'rgba(255,215,0,0.6)' }} />
          <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2" style={{ borderColor: 'rgba(255,215,0,0.6)' }} />

          <span className="text-5xl block mb-3">{game.emoji}</span>
          <h1 className="text-xl font-bold mb-2" style={{ color: '#ffd700', textShadow: '0 0 15px rgba(255,215,0,0.3)' }}>
            {game.title}
          </h1>
          <p className="text-amber-200/50 text-sm mb-5">{game.description}</p>

          <div className="flex items-center justify-center gap-5 mb-6">
            <div className="text-center">
              <p className="text-[9px] text-amber-200/35 mb-1">難易度</p>
              <div className="flex gap-0.5">{Array.from({ length: 5 }).map((_, i) => (
                <span key={i} className="text-xs" style={{ color: i < game.difficulty ? '#ffd700' : 'rgba(255,255,255,0.12)' }}>★</span>
              ))}</div>
            </div>
            <div className="text-center">
              <p className="text-[9px] text-amber-200/35 mb-1">報酬</p>
              <span className="text-sm font-bold" style={{ color: '#ffd700' }}>+{game.altReward} ALT</span>
            </div>
            <div className="text-center">
              <p className="text-[9px] text-amber-200/35 mb-1">制限時間</p>
              <span className="text-sm font-bold text-amber-100">60秒</span>
            </div>
          </div>

          <button onClick={initGame} className="rpg-btn rpg-btn-green w-full text-lg py-3.5 mb-2">
            ⚔️ ゲームスタート！
          </button>
          <button onClick={() => navigate('/games')} className="text-amber-200/35 text-xs hover:text-amber-200/60 transition-colors py-2">
            ← ゲーム一覧に戻る
          </button>
        </div>
      </div>
    );
  }

  // Finished Screen
  if (phase === 'finished') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6"
        style={{ background: 'linear-gradient(180deg, #0b1128 0%, #151d3b 100%)' }}>
        <div className="rounded-2xl p-6 w-full max-w-sm text-center relative overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, rgba(21,29,59,0.95), rgba(14,20,45,0.95))',
            border: '2px solid rgba(255,215,0,0.35)',
            boxShadow: 'inset 0 0 30px rgba(255,215,0,0.05), 0 8px 32px rgba(0,0,0,0.5)',
          }}>
          <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2" style={{ borderColor: 'rgba(255,215,0,0.6)' }} />
          <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2" style={{ borderColor: 'rgba(255,215,0,0.6)' }} />
          <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2" style={{ borderColor: 'rgba(255,215,0,0.6)' }} />
          <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2" style={{ borderColor: 'rgba(255,215,0,0.6)' }} />

          <h2 className="text-2xl font-bold mb-3" style={{ color: '#ffd700', textShadow: '0 0 20px rgba(255,215,0,0.4)' }}>
            🎉 ゲーム終了！
          </h2>
          <div className="text-5xl font-bold font-[var(--font-orbitron)] my-4" style={{ color: '#ffd700', textShadow: '0 0 15px rgba(255,215,0,0.3)' }}>
            {String(score).padStart(6, '0')}
          </div>
          <p className="text-amber-200/50 text-sm mb-1">クリア数: {tappedNumbers.size}/{gridSize}</p>
          <p className="text-amber-200/50 text-sm mb-6">残り時間: {timeLeft}秒</p>

          <div className="flex gap-3">
            <button onClick={() => navigate('/')} className="rpg-btn rpg-btn-blue flex-1 py-3">ホームに戻る</button>
            <button onClick={handleFinish} className="rpg-btn rpg-btn-gold flex-1 py-3">リザルトへ</button>
          </div>
        </div>
      </div>
    );
  }

  // Playing Screen
  return (
    <div className="min-h-screen flex flex-col"
      style={{ background: 'linear-gradient(180deg, #0b1128 0%, #131b38 50%, #0e1430 100%)' }}>
      <div className="px-3 py-2.5 flex items-center justify-between relative"
        style={{
          background: 'linear-gradient(180deg, rgba(11,17,40,0.98), rgba(16,22,48,0.95))',
          borderBottom: '2px solid rgba(255,215,0,0.2)',
          boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
        }}>
        <button onClick={() => navigate('/games')} className="text-amber-200/35 text-sm hover:text-amber-200/60 transition-colors">✕</button>
        <div className="text-center">
          <p className="text-[9px] text-amber-200/35 mb-0.5">スコア</p>
          <p className="text-xl font-bold font-[var(--font-orbitron)]" style={{ color: '#ffd700', textShadow: '0 0 8px rgba(255,215,0,0.3)' }}>
            {String(score).padStart(6, '0')}
          </p>
        </div>
        <div className="text-center">
          <p className="text-[9px] text-amber-200/35 mb-0.5">⏱</p>
          <span className={`text-xl font-bold font-[var(--font-orbitron)] ${timeLeft <= 10 ? 'text-red-400' : 'text-amber-100'}`}
            style={timeLeft <= 10 ? { textShadow: '0 0 8px rgba(239,68,68,0.5)', animation: 'pulse-glow 0.5s ease-in-out infinite' } : {}}>
            {timeLeft}
          </span>
        </div>
      </div>

      {showCombo && combo >= 3 && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 animate-bounce-in pointer-events-none">
          <span className="text-3xl font-bold font-[var(--font-orbitron)]"
            style={{ color: '#ffd700', textShadow: '0 0 25px rgba(255,215,0,0.7), 0 0 50px rgba(255,215,0,0.3)' }}>
            ×{combo} COMBO!
          </span>
        </div>
      )}

      <div className="text-center py-3">
        <span className="text-amber-200/35 text-[10px]">次の数字</span>
        <div className="text-4xl font-bold font-[var(--font-orbitron)] mt-1"
          style={{ color: '#ffd700', textShadow: '0 0 20px rgba(255,215,0,0.4)' }}>
          {nextNumber > gridSize ? '✓' : nextNumber}
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-4 pb-4">
        <div className="p-3 rounded-2xl relative"
          style={{
            background: 'linear-gradient(135deg, rgba(21,29,59,0.8), rgba(14,20,45,0.8))',
            border: '2px solid rgba(255,215,0,0.2)',
            boxShadow: 'inset 0 0 30px rgba(0,0,0,0.3), 0 4px 20px rgba(0,0,0,0.4)',
          }}>
          <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2" style={{ borderColor: 'rgba(255,215,0,0.5)' }} />
          <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2" style={{ borderColor: 'rgba(255,215,0,0.5)' }} />
          <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2" style={{ borderColor: 'rgba(255,215,0,0.5)' }} />
          <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2" style={{ borderColor: 'rgba(255,215,0,0.5)' }} />

          <div className="grid grid-cols-4 gap-2 w-full max-w-[300px]">
            {numbers.map((num) => {
              const isTapped = tappedNumbers.has(num);
              const isWrong = wrongTap === num;
              const color = tileColors[(num - 1) % tileColors.length];
              return (
                <button
                  key={num}
                  onClick={() => handleTap(num)}
                  disabled={isTapped}
                  className="aspect-square rounded-xl text-xl font-bold font-[var(--font-orbitron)] transition-all duration-150 active:scale-90"
                  style={isTapped ? {
                    background: 'rgba(34,197,94,0.15)',
                    border: '2px solid rgba(34,197,94,0.25)',
                    color: 'rgba(34,197,94,0.4)',
                    boxShadow: 'inset 0 0 10px rgba(34,197,94,0.1)',
                  } : isWrong ? {
                    background: 'rgba(239,68,68,0.2)',
                    border: '2px solid rgba(239,68,68,0.5)',
                    color: '#ef4444',
                    animation: 'pulse-glow 0.3s ease-in-out',
                  } : {
                    background: `linear-gradient(135deg, ${color}cc, ${color}88)`,
                    border: `2px solid ${color}`,
                    color: 'white',
                    boxShadow: `0 3px 0 ${color}88, 0 4px 12px rgba(0,0,0,0.3)`,
                    textShadow: '0 1px 2px rgba(0,0,0,0.5)',
                  }}>
                  {isTapped ? '✓' : num}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="px-4 pb-4 flex items-center justify-between">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <span className="text-amber-200/35 text-[10px]">コンボ</span>
          <span className="text-sm font-bold font-[var(--font-orbitron)]" style={{ color: combo >= 3 ? '#ffd700' : 'rgba(255,255,255,0.4)' }}>
            ×{combo}
          </span>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg"
          style={{ background: 'rgba(255,215,0,0.08)', border: '1px solid rgba(255,215,0,0.15)' }}>
          <div className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold"
            style={{ background: 'linear-gradient(135deg, #ffd700, #d4a500)', color: '#0b1128' }}>A</div>
          <span className="text-xs font-bold" style={{ color: '#ffd700' }}>+{game.altReward} ALT</span>
        </div>
      </div>
    </div>
  );
}
