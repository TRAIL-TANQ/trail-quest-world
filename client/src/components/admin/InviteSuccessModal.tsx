/**
 * InviteSuccessModal — 招待コード発行完了モーダル（Phase B1 / Step 4）
 *
 * AdminInvitePage で発行成功時に開く。QR コード + TRAIL-XXXXXX + 対象の子 +
 * 有効期限を表示し、コピー / LINE 共有 / 閉じる のアクションを提供する。
 *
 * 動作:
 *   - mount 時に QR コードを data URL で非同期生成
 *   - コピー: navigator.clipboard.writeText + toast.success
 *   - LINE 共有: buildLineShareUrl を新規タブで開く
 *   - 閉じる: onClose コールバック（親がフォームリセット + 一覧再取得を担当）
 *
 * スタイル: ChildrenPickerModal と同じ z-[9999] / pb-24 sm:pb-3 で BottomNav を回避。
 */
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { buildLineShareMessage, buildLineShareUrl, generateInviteQrDataUrl } from '@/lib/inviteCode';
import { findStudentByChildId, type StudentRecord } from '@/data/students';

export interface InviteSuccessModalProps {
  code: string;              // 'TRAIL-XXXXXX'
  expiresAt: string;         // ISO 8601
  targetChildren: string[];  // child_id[] （発行時の選択内容）
  onClose: () => void;
}

export default function InviteSuccessModal({
  code,
  expiresAt,
  targetChildren,
  onClose,
}: InviteSuccessModalProps) {
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [qrError, setQrError] = useState(false);

  // QR コードを非同期生成
  useEffect(() => {
    let cancelled = false;
    setQrUrl(null);
    setQrError(false);
    generateInviteQrDataUrl(code, { size: 300 })
      .then((url) => {
        if (!cancelled) setQrUrl(url);
      })
      .catch((e) => {
        console.error('[InviteSuccessModal] QR generate failed', e);
        if (!cancelled) setQrError(true);
      });
    return () => { cancelled = true; };
  }, [code]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code);
      toast.success('コードをコピーしました');
    } catch (e) {
      console.error('[InviteSuccessModal] clipboard failed', e);
      toast.error('コピーに失敗しました');
    }
  }

  async function handleCopyMessage() {
    try {
      await navigator.clipboard.writeText(buildLineShareMessage(code));
      toast.success('メッセージをコピーしました', {
        description: 'LINEや他のアプリに貼り付けて送信できます',
      });
    } catch (e) {
      console.error('[InviteSuccessModal] clipboard (message) failed', e);
      toast.error('コピーに失敗しました');
    }
  }

  function handleLineShare() {
    const url = buildLineShareUrl(code);
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  const students = targetChildren
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
          border: '1.5px solid rgba(255,215,0,0.45)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.6), 0 0 30px rgba(255,215,0,0.15)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 py-3 border-b" style={{ borderColor: 'rgba(255,215,0,0.2)' }}>
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold" style={{ color: '#ffd700' }}>
              ✅ 招待コードを発行しました
            </h3>
            <button
              type="button"
              onClick={onClose}
              className="text-lg leading-none px-2"
              style={{ color: 'rgba(255,215,0,0.6)' }}
              aria-label="閉じる"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Body (scrollable) */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* QR Code */}
          <div className="flex flex-col items-center mb-4">
            <div
              className="rounded-xl p-2 flex items-center justify-center"
              style={{
                background: '#0f1428',
                border: '1.5px solid rgba(255,215,0,0.35)',
                width: 300 + 16,
                height: 300 + 16,
              }}
            >
              {qrUrl ? (
                <img
                  src={qrUrl}
                  alt={`QR: ${code}`}
                  width={300}
                  height={300}
                  style={{ display: 'block' }}
                />
              ) : qrError ? (
                <p className="text-xs text-center" style={{ color: '#ef4444' }}>
                  QR 生成に失敗しました
                </p>
              ) : (
                <p className="text-xs" style={{ color: 'rgba(255,215,0,0.5)' }}>
                  QR 生成中...
                </p>
              )}
            </div>
            <p className="text-[10px] mt-2" style={{ color: 'rgba(255,215,0,0.5)' }}>
              LINE でこの QR を読み取ると登録画面に進みます
            </p>
          </div>

          {/* Code (tap to copy) */}
          <button
            type="button"
            onClick={handleCopy}
            className="w-full rounded-xl px-4 py-3 mb-4 transition-all active:scale-[0.99]"
            style={{
              background: 'rgba(255,215,0,0.1)',
              border: '1.5px solid rgba(255,215,0,0.4)',
              cursor: 'pointer',
            }}
            aria-label="招待コードをコピー"
          >
            <p className="text-[10px] font-bold mb-1" style={{ color: 'rgba(255,215,0,0.6)' }}>
              招待コード（タップでコピー）
            </p>
            <p
              className="text-2xl font-black tracking-[0.15em] text-center"
              style={{
                color: '#ffd700',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
                textShadow: '0 0 12px rgba(255,215,0,0.3)',
              }}
            >
              {code}
            </p>
          </button>

          {/* Target children */}
          <div className="mb-4">
            <p className="text-[11px] font-bold mb-1.5" style={{ color: 'rgba(255,215,0,0.7)' }}>
              対象の子（{students.length} 名）
            </p>
            <div className="flex flex-wrap gap-1.5">
              {students.length === 0 && (
                <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.45)' }}>—</span>
              )}
              {students.map((s) => (
                <span
                  key={`${s.classAbbr}_${s.name}`}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-bold"
                  style={{
                    background: 'rgba(255,215,0,0.12)',
                    color: '#ffd700',
                    border: '1px solid rgba(255,215,0,0.3)',
                  }}
                >
                  <span>{s.emoji}</span>
                  <span>{s.name}</span>
                </span>
              ))}
            </div>
          </div>

          {/* Expiry */}
          <div className="rounded-lg px-3 py-2"
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,215,0,0.15)',
            }}
          >
            <p className="text-[10px] font-bold" style={{ color: 'rgba(255,215,0,0.6)' }}>
              有効期限
            </p>
            <p className="text-sm font-bold" style={{ color: '#ffd700' }}>
              {formatExpiresAt(expiresAt)} まで有効
            </p>
            <p className="text-[10px] mt-0.5" style={{ color: 'rgba(255,215,0,0.45)' }}>
              （発行から 72 時間）
            </p>
          </div>
        </div>

        {/* Footer: 2x2 grid
             Row 1 = コード系コピー（コード / メッセージ全文）
             Row 2 = 共有 / 閉じる
             LINE PC 版未インストール環境では LINE公式が line.me/ja/ に
             フォールバックする LINE 側仕様のため、「メッセージをコピー」
             で手動貼付けの経路を提供する。 */}
        <div
          className="px-3 py-3 border-t grid grid-cols-2 gap-2"
          style={{ borderColor: 'rgba(255,215,0,0.2)' }}
        >
          <button
            type="button"
            onClick={handleCopy}
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
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-2 text-[12px] font-bold active:scale-[0.98] transition-transform"
            style={{
              background: 'rgba(255,255,255,0.04)',
              color: 'rgba(255,215,0,0.6)',
              border: '1px solid rgba(255,215,0,0.2)',
            }}
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}

function formatExpiresAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const y  = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${mo}-${da} ${hh}:${mi}`;
}
