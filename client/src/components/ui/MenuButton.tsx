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
        borderRadius: 16,
        padding: '12px 16px',
        background: gradient,
        border: disabled ? '2px solid rgba(120,120,140,0.35)' : '2px solid #c5a03f',
        boxShadow: disabled
          ? '0 2px 8px rgba(0,0,0,0.3)'
          : '0 4px 15px rgba(0,0,0,0.5), inset 0 0 28px rgba(255,215,0,0.08)',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        opacity: disabled ? 0.55 : 1,
        transition: 'transform 0.15s ease, opacity 0.15s ease',
      }}
    >
      <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{
          background: 'rgba(0,0,0,0.35)',
          border: disabled ? '1.5px solid rgba(120,120,140,0.35)' : '1.5px solid rgba(255,215,0,0.5)',
          boxShadow: 'inset 0 0 10px rgba(0,0,0,0.5)',
        }}>
        <span className="text-2xl leading-none">{icon}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-lg font-black text-white" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.6)' }}>
          {title}
        </p>
        <p className="text-[11px] text-amber-100/85" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}>
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
