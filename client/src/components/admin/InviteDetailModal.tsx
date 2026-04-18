/**
 * InviteDetailModal — 招待コード詳細モーダル（Phase B1 / Step 5）
 *
 * 一覧行の「詳細」からひらく。状態（active/used/expired）に応じて
 * アクション（LINE共有 / 削除 / 再発行）を出し分ける。
 *
 * 使用済みコードの場合は登録日時と保護者 LINE UID（キャッシュがあれば表示名）
 * を追加表示する。
 */
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  buildLineShareMessage,
  buildLineShareUrl,
  formatRemaining,
  generateInviteQrDataUrl,
  RELATIONSHIP_LABELS,
  type InviteCode,
} from '@/lib/inviteCode';
import { findStudentByChildId, type StudentRecord } from '@/data/students';

export interface InviteDetailModalProps {
  invite: InviteCode;
  onClose: () => void;
  /** active 状態で表示する削除ボタン。未渡しなら非表示。 */
  onDelete?: (invite: InviteCode) => void;
  /** expired 状態で表示する再発行ボタン。未渡しなら非表示。 */
  onRegenerate?: (invite: InviteCode) => void;
}

export default function InviteDetailModal({
  invite,
  onClose,
  onDelete,
  onRegenerate,
}: InviteDetailModalProps) {
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [qrError, setQrError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setQrUrl(null);
    setQrError(false);
    generateInviteQrDataUrl(invite.code, { size: 260 })
      .then((url) => { if (!cancelled) setQrUrl(url); })
      .catch((e) => {
        console.error('[InviteDetailModal] QR failed', e);
        if (!cancelled) setQrError(true);
      });
    return () => { cancelled = true; };
  }, [invite.code]);

  async function handleCopyCode() {
    try {
      await navigator.clipboard.writeText(invite.code);
      toast.success('コードをコピーしました');
    } catch (e) {
      console.error(e);
      toast.error('コピーに失敗しました');
    }
  }

  async function handleCopyMessage() {
    try {
      await navigator.clipboard.writeText(buildLineShareMessage(invite.code));
      toast.success('メッセージをコピーしました');
    } catch (e) {
      console.error(e);
      toast.error('コピーに失敗しました');
    }
  }

  function handleLineShare() {
    window.open(buildLineShareUrl(invite.code), '_blank', 'noopener,noreferrer');
  }

  const theme = STATUS_THEME[invite.status];
  const students = invite.targetChildren
    .map(findStudentByChildId)
    .filter((s): s is StudentRecord => s !== null);

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-3 pb-24 sm:pb-3"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl overflow-hidden flex flex-col"
        style={{
          maxHeight: '80vh',
          background: 'linear-gradient(135deg, rgba(26,31,58,0.98), rgba(15,20,40,0.98))',
          border: '1.5px solid rgba(255,215,0,0.35)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header: 🎫 TRAIL-XXXXXX + 状態バッジ */}
        <div className="px-4 py-3 border-b" style={{ borderColor: 'rgba(255,215,0,0.2)' }}>
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <h3
                className="text-base font-black tracking-[0.08em] truncate"
                style={{
                  color: '#ffd700',
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
                }}
              >
                🎫 {invite.code}
              </h3>
              <span
                className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold mt-1"
                style={{
                  background: theme.bg,
                  color: theme.fg,
                  border: `1px solid ${theme.border}`,
                }}
              >
                {theme.icon} {theme.label}
              </span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-lg leading-none px-2 shrink-0"
              style={{ color: 'rgba(255,215,0,0.6)' }}
              aria-label="閉じる"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* QR */}
          <div className="flex flex-col items-center mb-4">
            <div
              className="rounded-xl p-2 flex items-center justify-center"
              style={{
                background: '#0f1428',
                border: '1.5px solid rgba(255,215,0,0.3)',
                width: 260 + 16,
                height: 260 + 16,
              }}
            >
              {qrUrl ? (
                <img src={qrUrl} alt={`QR: ${invite.code}`} width={260} height={260} style={{ display: 'block' }} />
              ) : qrError ? (
                <p className="text-xs" style={{ color: '#ef4444' }}>QR 生成に失敗</p>
              ) : (
                <p className="text-xs" style={{ color: 'rgba(255,215,0,0.5)' }}>QR 生成中...</p>
              )}
            </div>
          </div>

          {/* Code */}
          <button
            type="button"
            onClick={handleCopyCode}
            className="w-full rounded-xl px-4 py-3 mb-4 active:scale-[0.99] transition-transform"
            style={{
              background: 'rgba(255,215,0,0.1)',
              border: '1.5px solid rgba(255,215,0,0.4)',
              cursor: 'pointer',
            }}
          >
            <p className="text-[10px] font-bold mb-1" style={{ color: 'rgba(255,215,0,0.6)' }}>
              招待コード（タップでコピー）
            </p>
            <p
              className="text-xl font-black tracking-[0.15em] text-center"
              style={{
                color: '#ffd700',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
              }}
            >
              {invite.code}
            </p>
          </button>

          {/* Metadata */}
          <div className="space-y-2.5">
            <MetaRow label="対象の子">
              {students.length === 0 ? (
                <span style={{ color: 'rgba(255,255,255,0.45)' }}>—</span>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {students.map((s) => (
                    <span
                      key={`${s.classAbbr}_${s.name}`}
                      className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-bold"
                      style={{
                        background: 'rgba(255,215,0,0.12)',
                        color: '#ffd700',
                        border: '1px solid rgba(255,215,0,0.3)',
                      }}
                    >
                      {s.emoji} {s.name}
                    </span>
                  ))}
                </div>
              )}
            </MetaRow>

            <MetaRow label="保護者名">
              <span style={{ color: invite.parentName ? '#ffd700' : 'rgba(255,255,255,0.45)' }}>
                {invite.parentName ?? '—'}
              </span>
            </MetaRow>

            <MetaRow label="続柄">
              <span style={{ color: invite.relationship ? '#ffd700' : 'rgba(255,255,255,0.45)' }}>
                {invite.relationship ? RELATIONSHIP_LABELS[invite.relationship] : '—'}
              </span>
            </MetaRow>

            <MetaRow label="メモ">
              <span
                style={{
                  color: invite.memo ? '#ffd700' : 'rgba(255,255,255,0.45)',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {invite.memo ?? '—'}
              </span>
            </MetaRow>

            <MetaRow label="発行日時">
              <span style={{ color: '#ffd700' }}>{formatDateTime(invite.createdAt)}</span>
            </MetaRow>

            <MetaRow label="発行者">
              <span style={{ color: 'rgba(255,215,0,0.8)', fontFamily: 'ui-monospace, monospace', fontSize: '12px' }}>
                {invite.createdBy}
              </span>
            </MetaRow>

            <MetaRow label="有効期限">
              <span style={{ color: invite.status === 'expired' ? 'rgba(255,255,255,0.55)' : '#ffd700' }}>
                {formatDateTime(invite.expiresAt)}
                {invite.status === 'active' && (
                  <span className="ml-2 text-[11px]" style={{ color: 'rgba(255,215,0,0.55)' }}>
                    （{formatRemaining(invite)}）
                  </span>
                )}
                {invite.status === 'expired' && (
                  <span className="ml-2 text-[11px]" style={{ color: 'rgba(239,68,68,0.8)' }}>
                    （期限切れ）
                  </span>
                )}
              </span>
            </MetaRow>

            {invite.status === 'used' && (
              <>
                <MetaRow label="使用日時">
                  <span style={{ color: '#60a5fa' }}>
                    {invite.usedAt ? formatDateTime(invite.usedAt) : '—'}
                  </span>
                </MetaRow>
                <MetaRow label="保護者 LINE UID">
                  <span
                    style={{
                      color: invite.usedByLineUid ? '#60a5fa' : 'rgba(255,255,255,0.45)',
                      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
                      fontSize: '11px',
                      wordBreak: 'break-all',
                    }}
                  >
                    {invite.usedByLineUid ?? '—'}
                  </span>
                </MetaRow>
              </>
            )}
          </div>
        </div>

        {/* Footer（状態により出し分け）
             spec: active  = [📋 コピー][📝 メッセージコピー][📱 LINE][⚠️ 削除][閉じる]
                   used    = [閉じる] のみ
                   expired = [🔄 再発行][閉じる] のみ */}
        <div
          className="px-3 py-3 border-t grid grid-cols-2 gap-2"
          style={{ borderColor: 'rgba(255,215,0,0.2)' }}
        >
          {invite.status === 'active' && (
            <>
              <button
                type="button"
                onClick={handleCopyCode}
                className="rounded-lg px-2 py-2 text-[12px] font-bold active:scale-[0.98] transition-transform"
                style={{
                  background: 'rgba(255,215,0,0.14)',
                  color: '#ffd700',
                  border: '1px solid rgba(255,215,0,0.4)',
                }}
              >
                📋 コードをコピー
              </button>
              <button
                type="button"
                onClick={handleCopyMessage}
                className="rounded-lg px-2 py-2 text-[12px] font-bold active:scale-[0.98] transition-transform"
                style={{
                  background: 'rgba(59,130,246,0.14)',
                  color: '#60a5fa',
                  border: '1px solid rgba(59,130,246,0.45)',
                }}
              >
                📝 メッセージをコピー
              </button>
              <button
                type="button"
                onClick={handleLineShare}
                className="rounded-lg px-2 py-2 text-[12px] font-bold active:scale-[0.98] transition-transform"
                style={{
                  background: 'rgba(6,199,85,0.15)',
                  color: '#06c755',
                  border: '1px solid rgba(6,199,85,0.5)',
                }}
              >
                📱 LINEで共有
              </button>
              {onDelete && (
                <button
                  type="button"
                  onClick={() => onDelete(invite)}
                  className="rounded-lg px-2 py-2 text-[12px] font-bold active:scale-[0.98] transition-transform"
                  style={{
                    background: 'rgba(239,68,68,0.14)',
                    color: '#f87171',
                    border: '1px solid rgba(239,68,68,0.45)',
                  }}
                >
                  ⚠️ 削除
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg px-2 py-2 text-[12px] font-bold active:scale-[0.98] transition-transform col-span-2"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  color: 'rgba(255,215,0,0.6)',
                  border: '1px solid rgba(255,215,0,0.2)',
                }}
              >
                閉じる
              </button>
            </>
          )}

          {invite.status === 'expired' && (
            <>
              {onRegenerate && (
                <button
                  type="button"
                  onClick={() => onRegenerate(invite)}
                  className="rounded-lg px-2 py-2 text-[12px] font-bold active:scale-[0.98] transition-transform col-span-2"
                  style={{
                    background: 'rgba(255,215,0,0.2)',
                    color: '#ffd700',
                    border: '1.5px solid rgba(255,215,0,0.55)',
                  }}
                >
                  🔄 再発行する（新しいコードを生成）
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg px-2 py-2 text-[12px] font-bold active:scale-[0.98] transition-transform col-span-2"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  color: 'rgba(255,215,0,0.6)',
                  border: '1px solid rgba(255,215,0,0.2)',
                }}
              >
                閉じる
              </button>
            </>
          )}

          {invite.status === 'used' && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-2 py-2 text-[12px] font-bold active:scale-[0.98] transition-transform col-span-2"
              style={{
                background: 'rgba(255,255,255,0.04)',
                color: 'rgba(255,215,0,0.6)',
                border: '1px solid rgba(255,215,0,0.2)',
              }}
            >
              閉じる
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ===== Helpers =====

function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[80px_1fr] gap-2 items-start text-sm">
      <span className="text-[11px] font-bold pt-0.5" style={{ color: 'rgba(255,215,0,0.6)' }}>
        {label}
      </span>
      <div>{children}</div>
    </div>
  );
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const y  = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${mo}-${da} ${hh}:${mi}`;
}

const STATUS_THEME: Record<InviteCode['status'], {
  icon: string; label: string; bg: string; fg: string; border: string;
}> = {
  active:  { icon: '🟢', label: '未使用',   bg: 'rgba(16,185,129,0.14)', fg: '#34d399', border: 'rgba(16,185,129,0.45)' },
  used:    { icon: '🔵', label: '使用済',   bg: 'rgba(59,130,246,0.14)', fg: '#60a5fa', border: 'rgba(59,130,246,0.45)' },
  expired: { icon: '⚪', label: '期限切れ', bg: 'rgba(148,163,184,0.14)', fg: '#cbd5e1', border: 'rgba(148,163,184,0.35)' },
};
