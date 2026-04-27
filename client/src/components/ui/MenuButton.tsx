/**
 * MenuButton — HomePage のメインエントリと同じリッチなメニューボタン
 *
 * 使い方:
 *   <MenuButton href="/collection" icon="🃏" title="カードコレクション"
 *               subtitle="集めたカードを見よう"
 *               gradient="linear-gradient(135deg, #4c1d95, #7c3aed, #a855f7)" />
 *
 * disabled=true の場合はリンクを張らずグレーアウト表示（例: 設定 Coming Soon）。
 */
import { Link } from 'wouter';
import type { ReactNode } from 'react';

export interface MenuButtonProps {
  href?: string;
  onClick?: () => void;
  icon: ReactNode;           // 絵文字 or SVG
  title: string;
  subtitle: string;
  gradient: string;          // CSS background
  disabled?: boolean;
  /** 下部バッジ表示（Coming Soon など） */
  badge?: string;
}

function ButtonBody({
  icon, title, subtitle, gradient, disabled = false, badge,
}: Omit<MenuButtonProps, 'href' | 'onClick'>) {
  return (
    <div
      className={`tappable relative overflow-hidden ${disabled ? '' : 'cursor-pointer'}`}
      style={{
        borderRadius: 14,
        padding: '11px 14px',
        background: gradient,
        // v12: 高級カードショップ風トーン。彩度を抑え、影を柔らかく。
        filter: disabled ? 'none' : 'brightness(0.88) saturate(0.85)',
        border: disabled ? '1.5px solid rgba(120,120,140,0.3)' : '1.5px solid rgba(165,136,48,0.55)',
        boxShadow: disabled
          ? '0 2px 10px rgba(0,0,0,0.35)'
          : '0 6px 22px rgba(0,0,0,0.38), inset 0 0 24px rgba(255,215,0,0.04)',
        display: 'flex',
        alignItems: 'center',
        gap: 13,
        opacity: disabled ? 0.5 : 1,
        transition: 'transform 0.15s ease, opacity 0.15s ease, filter 0.15s ease',
        letterSpacing: '0.02em',
      }}
    >
      <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{
          background: 'rgba(0,0,0,0.4)',
          border: disabled ? '1.5px solid rgba(120,120,140,0.3)' : '1.5px solid rgba(165,136,48,0.45)',
          boxShadow: 'inset 0 0 10px rgba(0,0,0,0.55)',
        }}>
        <span className="text-2xl leading-none">{icon}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[17px] font-black text-white leading-tight" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>
          {title}
        </p>
        <p className="text-[10.5px] text-amber-100/75 mt-0.5 leading-snug" style={{ textShadow: '0 1px 1px rgba(0,0,0,0.5)' }}>
          {badge ?? subtitle}
        </p>
      </div>
      {disabled ? (
        <span className="text-[10px] font-bold px-2 py-0.5 rounded"
          style={{
            background: 'rgba(255,255,255,0.08)',
            color: 'rgba(255,255,255,0.55)',
            border: '1px solid rgba(255,255,255,0.15)',
          }}>
          {badge ?? 'Coming Soon'}
        </span>
      ) : (
        <span className="text-amber-100 text-xl">›</span>
      )}
    </div>
  );
}

export default function MenuButton(props: MenuButtonProps) {
  const { href, onClick, disabled, ...rest } = props;
  const body = <ButtonBody {...rest} disabled={disabled} />;

  if (disabled) {
    return <div aria-disabled>{body}</div>;
  }
  if (href) {
    return (
      <Link href={href}>
        <div className="active:scale-[0.98] transition-transform">{body}</div>
      </Link>
    );
  }
  if (onClick) {
    return (
      <button onClick={onClick} className="w-full text-left active:scale-[0.98] transition-transform">
        {body}
      </button>
    );
  }
  return <div>{body}</div>;
}
