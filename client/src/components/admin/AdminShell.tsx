/**
 * AdminShell — 管理者ダッシュボード共通のヘッダー+スクロールコンテナ。
 * 各 AdminXxxPage は <AdminShell title="…">{中身}</AdminShell> で囲む。
 */
import { Link } from 'wouter';
import type { ReactNode } from 'react';

export interface AdminShellProps {
  title: string;
  subtitle?: string;
  backHref?: string;          // もどるリンク先（デフォルト /admin）
  backLabel?: string;
  children: ReactNode;
}

export default function AdminShell({
  title, subtitle, backHref = '/admin', backLabel = 'ダッシュボード', children,
}: AdminShellProps) {
  const isTop = backHref === '/admin' && title === '管理者ダッシュボード';
  return (
    <div className="px-4 pt-4 pb-8">
      <div className="flex items-center gap-2 mb-4">
        {!isTop && (
          <Link href={backHref}>
            <button className="text-[11px] px-2 py-1 rounded shrink-0"
              style={{
                background: 'rgba(255,215,0,0.08)',
                color: 'var(--tqw-gold, #ffd700)',
                border: '1px solid rgba(255,215,0,0.25)',
              }}>
              ← {backLabel}
            </button>
          </Link>
        )}
        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: 'linear-gradient(135deg, #ffd700, #f0a500)', boxShadow: '0 0 10px rgba(255,215,0,0.3)' }}>
          <span className="text-lg">👑</span>
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold leading-tight truncate"
            style={{ color: 'var(--tqw-gold, #ffd700)', textShadow: '0 0 10px rgba(255,215,0,0.2)' }}>
            {title}
          </h1>
          {subtitle && (
            <p className="text-[10px] truncate" style={{ color: 'rgba(255,215,0,0.55)' }}>
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}

/** 汎用: カードパネル */
export function AdminCard({
  children, className = '', tone = 'default',
}: { children: ReactNode; className?: string; tone?: 'default' | 'gold' | 'blue' | 'red' | 'green' | 'purple' }) {
  const toneBorder: Record<typeof tone, string> = {
    default: 'rgba(197,160,63,0.25)',
    gold:    'rgba(255,215,0,0.35)',
    blue:    'rgba(59,130,246,0.35)',
    red:     'rgba(239,68,68,0.35)',
    green:   'rgba(34,197,94,0.35)',
    purple:  'rgba(168,85,247,0.35)',
  } as const;
  return (
    <div
      className={`rounded-2xl ${className}`}
      style={{
        background: 'linear-gradient(135deg, rgba(26,31,58,0.9), rgba(15,20,40,0.95))',
        border: `1.5px solid ${toneBorder[tone]}`,
        boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
        backdropFilter: 'blur(8px)',
      }}
    >
      {children}
    </div>
  );
}

/** 汎用: 数値＋ラベルの小さなKPIタイル */
export function KpiTile({
  icon, label, value, sub,
}: { icon: string; label: string; value: string | number; sub?: string }) {
  return (
    <AdminCard className="p-3">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-base">{icon}</span>
        <p className="text-[10px] font-bold" style={{ color: 'rgba(255,215,0,0.7)' }}>{label}</p>
      </div>
      <p className="text-xl font-black" style={{ color: '#ffd700' }}>{value}</p>
      {sub && <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.45)' }}>{sub}</p>}
    </AdminCard>
  );
}
