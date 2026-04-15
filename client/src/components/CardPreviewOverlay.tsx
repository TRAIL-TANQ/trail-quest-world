/**
 * CardPreviewOverlay — ポケポケ風カードプレビュー
 * - 中央にカードを大きく表示
 * - タッチ位置に応じた 3D チルト + ホログラム光沢
 * - 上方向スワイプ（50px以上）で onPlay 発火
 * - 途中で離すとバウンスで元位置に戻る
 * - タップ時のリップル演出
 * - 「出す / キャンセル」ボタンもフォールバックとして提供
 */
import { useCallback, useRef, useState, type ReactNode } from 'react';
import { playCardFlip, playCardLand, playTap } from '@/lib/sfx';

interface Props {
  children: ReactNode;           // カード本体（画像+装飾）
  onPlay: () => void;            // 「出す」時に発火
  onCancel?: () => void;         // 背景タップ or キャンセル
  playLabel?: string;            // スワイプ案内文
  playButtonLabel?: string;      // メインボタンの文言（デフォルト: ⚔️ 出す）
  disabled?: boolean;            // プレイ不可の場合
  subActions?: ReactNode;        // 追加のアクションボタン（効果なしで出す 等）
}

const SWIPE_THRESHOLD = 50;

export default function CardPreviewOverlay({
  children,
  onPlay,
  onCancel,
  playLabel = '⬆️ 上にスワイプで出す',
  playButtonLabel = '⚔️ 出す',
  disabled = false,
  subActions,
}: Props) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [tilt, setTilt] = useState({ rx: 0, ry: 0, holo: 50 });
  const [drag, setDrag] = useState({ dx: 0, dy: 0, active: false });
  const [played, setPlayed] = useState(false);
  const [ripple, setRipple] = useState<{ x: number; y: number; key: number } | null>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);

  const mountedRef = useRef(true);
  // Fire onPlay only once
  const fireOnPlay = useCallback(() => {
    if (played || disabled) return;
    setPlayed(true);
    playCardLand();
    // small delay so the slide-out animation can start before parent unmounts
    setTimeout(() => {
      if (mountedRef.current) onPlay();
    }, 180);
  }, [played, disabled, onPlay]);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (disabled || played) return;
    const t = e.touches[0];
    startRef.current = { x: t.clientX, y: t.clientY };
    playCardFlip();
    // ripple
    const rect = cardRef.current?.getBoundingClientRect();
    if (rect) {
      setRipple({
        x: t.clientX - rect.left,
        y: t.clientY - rect.top,
        key: Date.now(),
      });
      window.setTimeout(() => setRipple(null), 320);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!startRef.current || played) return;
    const t = e.touches[0];
    const dx = t.clientX - startRef.current.x;
    const dy = t.clientY - startRef.current.y;
    setDrag({ dx: dx * 0.5, dy: Math.min(20, dy), active: true });

    // tilt based on drag direction (up-ish = more tilt back)
    const rect = cardRef.current?.getBoundingClientRect();
    if (rect) {
      const cx = t.clientX - rect.left - rect.width / 2;
      const cy = t.clientY - rect.top - rect.height / 2;
      setTilt({
        rx: -(cy / rect.height) * 18,
        ry: (cx / rect.width) * 18,
        holo: ((t.clientX - rect.left) / rect.width) * 100,
      });
    }

    if (dy < -SWIPE_THRESHOLD) {
      // commit swipe
      fireOnPlay();
    }
  };

  const handleTouchEnd = () => {
    if (played) return;
    // bounce back
    setDrag({ dx: 0, dy: 0, active: false });
    setTilt({ rx: 0, ry: 0, holo: 50 });
    startRef.current = null;
  };

  // pointer fallback for desktop mouse
  const handleMouseMove = (e: React.MouseEvent) => {
    if (played) return;
    const rect = cardRef.current?.getBoundingClientRect();
    if (!rect) return;
    const cx = e.clientX - rect.left - rect.width / 2;
    const cy = e.clientY - rect.top - rect.height / 2;
    setTilt({
      rx: -(cy / rect.height) * 14,
      ry: (cx / rect.width) * 14,
      holo: ((e.clientX - rect.left) / rect.width) * 100,
    });
  };
  const handleMouseLeave = () => setTilt({ rx: 0, ry: 0, holo: 50 });

  const backdropClick = (e: React.MouseEvent) => {
    if (played || disabled) return;
    if (e.target === e.currentTarget) {
      playTap();
      onCancel?.();
    }
  };

  // Apply slide-out on play
  const transform = played
    ? 'translateY(-120vh) scale(0.85) rotate(-4deg)'
    : `translate(${drag.dx}px, ${drag.dy}px) perspective(700px) rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`;

  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center p-4"
      style={{
        zIndex: 300,
        background: 'radial-gradient(circle at 50% 50%, rgba(0,0,0,0.55), rgba(0,0,0,0.85))',
      }}
      onClick={backdropClick}
    >
      <div
        ref={cardRef}
        className="relative holo-sheen ripple-host"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{
          width: 'min(72vw, 300px)',
          aspectRatio: '360 / 500',
          transform,
          transition: drag.active && !played
            ? 'none'
            : 'transform 0.32s cubic-bezier(0.34, 1.56, 0.64, 1)',
          transformStyle: 'preserve-3d',
          filter: 'drop-shadow(0 10px 30px rgba(0,0,0,0.5))',
          touchAction: 'none',
          '--holo-x': `${tilt.holo}%`,
        } as React.CSSProperties}
      >
        {children}
        {ripple && (
          <span
            key={ripple.key}
            className="absolute pointer-events-none"
            style={{
              left: ripple.x,
              top: ripple.y,
              width: 10,
              height: 10,
              marginLeft: -5,
              marginTop: -5,
              borderRadius: 9999,
              background: 'conic-gradient(from 0deg, #ff6b6b, #ffd93d, #6bcb77, #4d96ff, #9b5de5, #ff6b6b)',
              opacity: 0.6,
              animation: 'rippleBurst 0.3s ease-out forwards',
              mixBlendMode: 'screen',
            }}
          />
        )}
      </div>

      {/* Swipe hint / fallback buttons — high z-index, explicit pointer-events */}
      {!played && (
        <div
          className="mt-4 flex flex-col items-center gap-2 relative"
          style={{ zIndex: 320, pointerEvents: 'auto', touchAction: 'manipulation' }}
          onTouchStart={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
          onTouchEnd={(e) => e.stopPropagation()}
        >
          <p className="text-amber-200/70 text-xs">{playLabel}</p>
          <div className="flex items-center gap-2">
            {onCancel && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); playTap(); onCancel(); }}
                className="tappable px-4 rounded-lg text-xs font-bold"
                style={{
                  minHeight: 48,
                  minWidth: 80,
                  background: 'rgba(255,255,255,0.08)',
                  color: 'rgba(255,255,255,0.85)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  touchAction: 'manipulation',
                  pointerEvents: 'auto',
                }}
              >
                キャンセル
              </button>
            )}
            <button
              type="button"
              disabled={disabled}
              onClick={(e) => { e.stopPropagation(); fireOnPlay(); }}
              className="tappable pulse-btn px-6 rounded-lg text-sm font-black"
              style={{
                minHeight: 48,
                minWidth: 160,
                background: 'linear-gradient(135deg, #ffd700, #f59e0b)',
                color: '#0b1128',
                boxShadow: '0 3px 14px rgba(255,215,0,0.55)',
                opacity: disabled ? 0.5 : 1,
                touchAction: 'manipulation',
                pointerEvents: 'auto',
              }}
            >
              {playButtonLabel}
            </button>
          </div>
          {subActions}
        </div>
      )}
    </div>
  );
}
