/**
 * JapanMap — 47都道府県の簡易SVGマップ
 *
 * 地理的に正確ではないがタップ可能な47の長方形で構成した日本地図。
 * prefectureData の (x,y,w,h) を基に viewBox 400×560 内に配置する。
 *
 * Props:
 *   highlightId: ハイライト（ゲーム★5用）する県のid
 *   feedbackId / feedbackState: 正誤フィードバックを描画する県
 *   showLabels: 県名ラベルを表示するか（★1-4用）
 *   onTap: 県タップ時のコールバック
 *   disabled: 入力受付を停止
 */
import type { Prefecture, Region } from '@/data/prefectureData';
import { PREFECTURES, REGION_COLORS } from '@/data/prefectureData';

export interface JapanMapProps {
  highlightId?: string;
  feedbackId?: string;
  feedbackState?: 'correct' | 'wrong';
  correctId?: string; // 不正解時に正解を緑で光らせる
  showLabels?: boolean;
  onTap?: (pref: Prefecture) => void;
  disabled?: boolean;
}

export function regionBaseColor(region: Region, dim = false): string {
  const base = REGION_COLORS[region];
  return dim ? base + '55' : base + 'AA'; // ベース 33% / 66% 透明度
}

export default function JapanMap({
  highlightId,
  feedbackId,
  feedbackState,
  correctId,
  showLabels = true,
  onTap,
  disabled = false,
}: JapanMapProps) {
  const fillFor = (p: Prefecture): string => {
    if (feedbackState === 'correct' && feedbackId === p.id) return '#22c55e';
    if (feedbackState === 'wrong' && feedbackId === p.id) return '#ef4444';
    if (correctId === p.id) return '#22c55e';
    if (highlightId === p.id) return '#ffd700';
    return regionBaseColor(p.region);
  };

  const strokeFor = (p: Prefecture): string => {
    if (feedbackState === 'correct' && feedbackId === p.id) return '#16a34a';
    if (feedbackState === 'wrong' && feedbackId === p.id) return '#dc2626';
    if (correctId === p.id) return '#16a34a';
    if (highlightId === p.id) return '#ffe066';
    return 'rgba(255,215,0,0.4)';
  };

  return (
    <svg
      viewBox="0 0 400 560"
      xmlns="http://www.w3.org/2000/svg"
      style={{
        width: '100%',
        height: 'auto',
        maxHeight: '60vh',
        background: 'linear-gradient(180deg, rgba(10,14,26,0.9), rgba(14,20,40,0.9))',
        borderRadius: 16,
        border: '1px solid rgba(255,215,0,0.2)',
        touchAction: 'manipulation',
        userSelect: 'none',
      }}
    >
      {/* 海の背景装飾 */}
      <rect x={0} y={0} width={400} height={560} fill="url(#oceanGrad)" />
      <defs>
        <linearGradient id="oceanGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="rgba(30, 50, 90, 0.3)" />
          <stop offset="1" stopColor="rgba(10, 20, 40, 0.5)" />
        </linearGradient>
      </defs>

      {PREFECTURES.map((p) => {
        const fill = fillFor(p);
        const stroke = strokeFor(p);
        const isHighlight = highlightId === p.id || correctId === p.id || feedbackId === p.id;
        return (
          <g key={p.id}>
            <rect
              x={p.x}
              y={p.y}
              width={p.w}
              height={p.h}
              fill={fill}
              stroke={stroke}
              strokeWidth={isHighlight ? 2 : 1}
              rx={3}
              onClick={() => { if (!disabled && onTap) onTap(p); }}
              style={{
                cursor: disabled ? 'default' : 'pointer',
                transition: 'fill 0.15s, stroke 0.15s',
                filter: isHighlight ? `drop-shadow(0 0 8px ${fill})` : undefined,
              }}
            />
            {showLabels && p.w >= 30 && p.h >= 22 && (
              <text
                x={p.x + p.w / 2}
                y={p.y + p.h / 2 + 3}
                textAnchor="middle"
                fontSize={p.w < 45 ? 8 : 10}
                fill="rgba(255,255,255,0.85)"
                pointerEvents="none"
                fontWeight="bold"
              >
                {p.name.replace(/県$|府$|都$|道$/, '')}
              </text>
            )}
          </g>
        );
      })}

      {/* 凡例（小さく） */}
      {showLabels && (
        <g transform="translate(8, 8)" pointerEvents="none" opacity={0.7}>
          <text x={0} y={10} fontSize={9} fill="#ffd700">日本地図</text>
        </g>
      )}
    </svg>
  );
}
