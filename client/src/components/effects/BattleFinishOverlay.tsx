import { useEffect, useRef, useState } from 'react';

/**
 * BattleFinishOverlay
 * kk 2026-04-21: バトル最終勝敗確定 + 各ラウンド終了時の映画風 FINISH 演出。
 * Manus 納品の finish_01_classic_elegant.svg を使用。
 *
 * フロー（総尺 1.8 秒、タップでスキップ可）:
 *   flash   (0-150ms)    → 白フラッシュ
 *   finish  (150-900ms)  → FINISH 画像フェードイン + 拡大、ホールド
 *   result  (900-1550ms) → WIN! / LOSE テキスト
 *   fadeout (1550-1800ms) → 全体透過 → onComplete
 *
 * 実装上の注意（kk 2026-04-21 バグ修正）:
 *   - onComplete は親側で毎レンダリング新しい関数参照になるため、ref に保持して
 *     useEffect の deps から除外する。これがないと親の再レンダリング毎に timer が
 *     リセットされ、overlay が次ラウンドまで残り続けるバグを引き起こす。
 *
 * 既存の cineStep='round_end' 保持時間 (約 3400ms) / 'game_over' (約 2300ms) 内に完了する。
 *
 * z-index は 80（TrophyBonus 等より上、モーダル 100 より下）。
 */
interface BattleFinishOverlayProps {
  active: boolean;
  winner: 'player' | 'ai';
  onComplete?: () => void;
}

type Stage = 'flash' | 'finish' | 'result' | 'fadeout' | 'done';

const FINISH_IMG_URL = '/images/effects/finish/finish_01_classic_elegant.svg';

export function BattleFinishOverlay({ active, winner, onComplete }: BattleFinishOverlayProps) {
  const [stage, setStage] = useState<Stage>('flash');

  // onComplete を ref に保持し、useEffect の deps から除外する（再レンダリング耐性）
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    if (!active) {
      setStage('flash');
      return;
    }
    setStage('flash');
    const timers: number[] = [];
    timers.push(window.setTimeout(() => setStage('finish'), 150));
    timers.push(window.setTimeout(() => setStage('result'), 900));
    timers.push(window.setTimeout(() => setStage('fadeout'), 1550));
    timers.push(window.setTimeout(() => {
      setStage('done');
      onCompleteRef.current?.();
    }, 1800));
    return () => {
      for (const t of timers) clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  if (!active || stage === 'done') return null;

  const won = winner === 'player';
  const bgOpacity = stage === 'flash' ? 0 : stage === 'fadeout' ? 0 : 0.78;
  const flashOpacity = stage === 'flash' ? 0.9 : 0;
  const fadeoutOpacity = stage === 'fadeout' ? 0 : 1;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center cursor-pointer overflow-hidden"
      style={{
        background: `rgba(5, 5, 15, ${bgOpacity})`,
        opacity: fadeoutOpacity,
        transition: 'opacity 300ms ease-out, background 250ms ease-out',
      }}
      onClick={() => {
        setStage('done');
        onComplete?.();
      }}
      role="presentation"
    >
      {/* White flash */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: '#ffffff',
          opacity: flashOpacity,
          transition: 'opacity 200ms ease-out',
        }}
      />

      {/* FINISH image */}
      {(stage === 'finish' || stage === 'result') && (
        <img
          src={FINISH_IMG_URL}
          alt="FINISH"
          className={`kc-finish-image absolute select-none pointer-events-none ${stage === 'result' ? 'kc-finish-image-out' : 'kc-finish-image-in'}`}
          style={{
            width: 'min(92vw, 900px)',
            height: 'auto',
            filter: 'drop-shadow(0 0 48px rgba(255,215,0,0.75)) drop-shadow(0 6px 20px rgba(0,0,0,0.7))',
          }}
          draggable={false}
        />
      )}

      {/* WIN! / LOSE */}
      {stage === 'result' && (
        <h2
          className="kc-finish-winlose absolute select-none pointer-events-none"
          style={{
            fontFamily: 'Georgia, "Times New Roman", serif',
            fontSize: 'clamp(72px, 20vw, 200px)',
            fontWeight: 900,
            color: won ? '#ffd700' : '#94a3b8',
            letterSpacing: '10px',
            textShadow: won
              ? '0 0 60px rgba(255,215,0,1), 0 0 120px rgba(255,215,0,0.55), 0 6px 16px rgba(0,0,0,0.9)'
              : '0 0 40px rgba(148,163,184,0.7), 0 6px 16px rgba(0,0,0,0.9)',
          }}
        >
          {won ? 'WIN!' : 'LOSE'}
        </h2>
      )}

      <style>{`
        @keyframes kcFinishImgIn {
          0%   { opacity: 0; transform: scale(0.6); }
          60%  { opacity: 1; transform: scale(1.05); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes kcFinishImgOut {
          0%   { opacity: 1; transform: scale(1); }
          100% { opacity: 0; transform: scale(1.15) translateY(-8%); }
        }
        @keyframes kcFinishWinIn {
          0%   { opacity: 0; transform: scale(0.4); letter-spacing: 40px; }
          50%  { opacity: 1; transform: scale(1.15); letter-spacing: 14px; }
          100% { opacity: 1; transform: scale(1); letter-spacing: 10px; }
        }
        .kc-finish-image-in  { animation: kcFinishImgIn 700ms cubic-bezier(0.2, 0.8, 0.2, 1) forwards; }
        .kc-finish-image-out { animation: kcFinishImgOut 400ms ease-out forwards; }
        .kc-finish-winlose   { animation: kcFinishWinIn 500ms cubic-bezier(0.2, 0.9, 0.3, 1.1) forwards; }
      `}</style>
    </div>
  );
}
