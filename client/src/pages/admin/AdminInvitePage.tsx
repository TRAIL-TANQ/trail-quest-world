/**
 * AdminInvitePage — 保護者招待コードの発行・管理画面（Phase B1）。
 *
 * 画面構成:
 *   上半分 = 発行フォーム（対象の子モーダル + 保護者名/続柄/メモ）
 *   下半分 = 一覧（Step 5 で実装予定、今は占位）
 *
 * 発行成功時は暫定でトーストにコード表示。発行完了モーダル（QR + LINE 共有）は
 * Step 4 で差し替える。
 *
 * クエリ ?child=スターター_はるか を初期選択に反映（生徒詳細からの遷移対応）。
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearch } from 'wouter';
import { toast } from 'sonner';
import AdminGuard from '@/components/admin/AdminGuard';
import AdminShell, { AdminCard } from '@/components/admin/AdminShell';
import InviteSuccessModal from '@/components/admin/InviteSuccessModal';
import InviteDetailModal from '@/components/admin/InviteDetailModal';
import {
  STUDENTS,
  buildStudentChildId,
  findStudentByChildId,
  type StudentRecord,
} from '@/data/students';
import {
  buildLineShareUrl,
  createInviteCode,
  deleteInviteCode,
  formatRemaining,
  listInviteCodes,
  regenerateInviteCode,
  RELATIONSHIP_LABELS,
  type InviteCode,
  type InviteCodeStatusFilter,
  type Relationship,
} from '@/lib/inviteCode';

// ===== クラス別グループ定義 =====

const CLASS_ORDER: ReadonlyArray<{ abbr: StudentRecord['classAbbr']; label: string; emoji: string }> = [
  { abbr: 'スターター',    label: '探究スターター',     emoji: '⭐' },
  { abbr: 'ベーシック',    label: '探究ベーシック',     emoji: '🔷' },
  { abbr: 'アドバンス',    label: '探究アドバンス',     emoji: '🔶' },
  { abbr: 'リミットレス',  label: '探究リミットレス',   emoji: '🚀' },
  { abbr: '個別',          label: '探究個別',           emoji: '💎' },
];

const RELATIONSHIP_OPTIONS: ReadonlyArray<{ value: Relationship; label: string }> = [
  { value: 'mother',      label: RELATIONSHIP_LABELS.mother },
  { value: 'father',      label: RELATIONSHIP_LABELS.father },
  { value: 'grandparent', label: RELATIONSHIP_LABELS.grandparent },
  { value: 'other',       label: RELATIONSHIP_LABELS.other },
];

const MAX_PARENT_NAME = 50;
const MAX_MEMO = 200;

const STATUS_TABS: ReadonlyArray<{
  id: InviteCodeStatusFilter; label: string; icon: string;
}> = [
  { id: 'active',  label: '未使用',   icon: '🟢' },
  { id: 'used',    label: '使用済',   icon: '🔵' },
  { id: 'expired', label: '期限切れ', icon: '⚪' },
  { id: 'all',     label: '全て',     icon: '📋' },
];

const STATUS_THEME: Record<InviteCode['status'], {
  icon: string; label: string; bg: string; fg: string; border: string;
}> = {
  active:  { icon: '🟢', label: '未使用',   bg: 'rgba(16,185,129,0.14)',  fg: '#34d399', border: 'rgba(16,185,129,0.45)' },
  used:    { icon: '🔵', label: '使用済',   bg: 'rgba(59,130,246,0.14)',  fg: '#60a5fa', border: 'rgba(59,130,246,0.45)' },
  expired: { icon: '⚪', label: '期限切れ', bg: 'rgba(148,163,184,0.14)', fg: '#cbd5e1', border: 'rgba(148,163,184,0.35)' },
};

function formatShortDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${d.getFullYear()}-${mo}-${da} ${hh}:${mi}`;
}

/**
 * 相対表記（「たった今 / 5分前 / 2時間前 / 昨日 14:32 / 04/15 09:12」）。
 * 1 日以内は分/時間前、昨日はラベル + 時刻、それ以上は MM/DD HH:MM。
 */
function formatRelativeDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const diffMs = Date.now() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1)  return 'たった今';
  if (diffMin < 60) return `${diffMin}分前`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24)  return `${diffHr}時間前`;

  const pad = (n: number) => String(n).padStart(2, '0');
  const hhmm = `${pad(d.getHours())}:${pad(d.getMinutes())}`;

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth()    === yesterday.getMonth() &&
    d.getDate()     === yesterday.getDate()
  ) return `昨日 ${hhmm}`;

  return `${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${hhmm}`;
}

// ===== ページ本体 =====

export default function AdminInvitePage() {
  return <AdminGuard><Inner /></AdminGuard>;
}

function Inner() {
  // ?child=スターター_はるか を初期選択に反映
  const searchStr = useSearch();
  const initialChildren = useMemo(() => {
    const params = new URLSearchParams(searchStr);
    const child = params.get('child');
    if (!child) return [];
    // 有効な childId のみ採用（存在しない値は弾く）
    return findStudentByChildId(child) ? [child] : [];
  }, [searchStr]);

  const [selectedChildren, setSelectedChildren] = useState<string[]>(initialChildren);
  const [parentName, setParentName]   = useState('');
  const [relationship, setRelationship] = useState<Relationship | ''>('');
  const [memo, setMemo]               = useState('');
  const [isPickerOpen, setPickerOpen] = useState(false);
  const [isSubmitting, setSubmitting] = useState(false);

  // 発行完了モーダル用: 直前に発行したコードのメタ情報を保持
  const [successInvite, setSuccessInvite] = useState<
    | { code: string; expiresAt: string; targetChildren: string[] }
    | null
  >(null);

  // 一覧用ステート
  const [tabStatus, setTabStatus] = useState<InviteCodeStatusFilter>('active');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [items, setItems] = useState<InviteCode[] | null>(null);
  const [detailTarget, setDetailTarget] = useState<InviteCode | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<InviteCode | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // 検索 debounce 300ms（入力ごとの再描画を抑制）
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // 一覧再取得（タブ切り替え時 / 発行・削除・再発行後に呼ぶ）
  const loadItems = useCallback(async () => {
    const data = await listInviteCodes({ status: tabStatus });
    setItems(data);
  }, [tabStatus]);

  useEffect(() => {
    setItems(null);
    loadItems();
  }, [loadItems]);

  // 検索はクライアント側で useMemo（debouncedSearch を watch）
  const filteredItems = useMemo(() => {
    if (!items) return null;
    const q = debouncedSearch.trim().toLowerCase();
    if (!q) return items;
    return items.filter((r) =>
      r.targetChildren.some((c) => c.toLowerCase().includes(q)) ||
      (r.memo ?? '').toLowerCase().includes(q) ||
      (r.parentName ?? '').toLowerCase().includes(q) ||
      r.code.toLowerCase().includes(q),
    );
  }, [items, debouncedSearch]);

  // ?child 変化時にも追従
  useEffect(() => {
    if (initialChildren.length && selectedChildren.length === 0) {
      setSelectedChildren(initialChildren);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialChildren.join(',')]);

  const canSubmit = selectedChildren.length >= 1 && !isSubmitting;

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const result = await createInviteCode({
        targetChildren: selectedChildren,
        parentName:     parentName.trim() || null,
        relationship:   relationship || null,
        memo:           memo.trim() || null,
      });
      if (!result.success || !result.code || !result.expiresAt) {
        toast.error(`発行に失敗しました: ${result.error ?? 'unknown'}`);
        return;
      }
      // 発行完了モーダルを開く（フォームリセットはモーダル閉じる時に実施）
      setSuccessInvite({
        code:           result.code,
        expiresAt:      result.expiresAt,
        targetChildren: selectedChildren,
      });
    } catch (e) {
      console.error(e);
      toast.error('発行中にエラーが発生しました');
    } finally {
      setSubmitting(false);
    }
  }

  function resetForm() {
    setSelectedChildren([]);
    setParentName('');
    setRelationship('');
    setMemo('');
  }

  function handleCancel() {
    resetForm();
  }

  function handleSuccessClose() {
    setSuccessInvite(null);
    resetForm();
    loadItems();
  }

  // ===== 行アクション =====

  async function handleCopyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      toast.success('コードをコピーしました');
    } catch (e) {
      console.error(e);
      toast.error('コピーに失敗しました');
    }
  }

  function handleRowLineShare(code: string) {
    window.open(buildLineShareUrl(code), '_blank', 'noopener,noreferrer');
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const result = await deleteInviteCode(deleteTarget.id);
      if (!result.success) {
        toast.error(`削除に失敗しました: ${result.error ?? 'unknown'}`);
        return;
      }
      toast.success(`${deleteTarget.code} を削除しました`);
      setDetailTarget(null);
      setDeleteTarget(null);
      await loadItems();
    } catch (e) {
      console.error(e);
      toast.error('削除中にエラーが発生しました');
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleRegenerate(invite: InviteCode) {
    try {
      const result = await regenerateInviteCode(invite.id);
      if (!result.success || !result.code || !result.expiresAt) {
        toast.error(`再発行に失敗しました: ${result.error ?? 'unknown'}`);
        return;
      }
      // 詳細モーダルを閉じ、新コードを成功モーダルで表示
      setDetailTarget(null);
      setSuccessInvite({
        code:           result.code,
        expiresAt:      result.expiresAt,
        targetChildren: invite.targetChildren,
      });
      await loadItems();
    } catch (e) {
      console.error(e);
      toast.error('再発行中にエラーが発生しました');
    }
  }

  return (
    <AdminShell title="招待コード発行" subtitle="保護者ダッシュボード連携">
      {/* ===== 発行フォーム ===== */}
      <AdminCard className="p-4 mb-4" tone="gold">
        <h2 className="text-sm font-bold mb-3" style={{ color: '#ffd700' }}>🎫 新規発行</h2>

        {/* 対象の子 */}
        <div className="mb-3">
          <label className="block text-[11px] font-bold mb-1.5" style={{ color: 'rgba(255,215,0,0.7)' }}>
            対象の子 <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="w-full rounded-lg px-3 py-2.5 text-left text-sm transition-all active:scale-[0.99]"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: selectedChildren.length ? '1.5px solid rgba(255,215,0,0.5)' : '1.5px solid rgba(255,215,0,0.2)',
              color: selectedChildren.length ? '#ffd700' : 'rgba(255,215,0,0.45)',
            }}
          >
            {selectedChildren.length === 0
              ? 'タップして選択（複数可）'
              : <SelectedChildrenSummary childIds={selectedChildren} />}
          </button>
        </div>

        {/* 保護者名 */}
        <div className="mb-3">
          <label className="block text-[11px] font-bold mb-1.5" style={{ color: 'rgba(255,215,0,0.7)' }}>
            保護者名（任意）
          </label>
          <input
            type="text"
            value={parentName}
            onChange={(e) => setParentName(e.target.value.slice(0, MAX_PARENT_NAME))}
            maxLength={MAX_PARENT_NAME}
            placeholder="例: 清山"
            className="w-full rounded-lg px-3 py-2 text-sm bg-transparent"
            style={{
              border: '1px solid rgba(255,215,0,0.2)',
              color: '#ffd700',
            }}
          />
          <p className="text-[10px] mt-1" style={{ color: 'rgba(255,215,0,0.4)' }}>
            {parentName.length}/{MAX_PARENT_NAME}
          </p>
        </div>

        {/* 続柄 */}
        <div className="mb-3">
          <label className="block text-[11px] font-bold mb-1.5" style={{ color: 'rgba(255,215,0,0.7)' }}>
            続柄（任意）
          </label>
          <div className="flex gap-1 flex-wrap">
            {RELATIONSHIP_OPTIONS.map((o) => {
              const active = relationship === o.value;
              return (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => setRelationship(active ? '' : o.value)}
                  className="rounded-md px-3 py-1.5 text-[11px] font-bold transition-all"
                  style={{
                    background: active ? 'rgba(255,215,0,0.18)' : 'rgba(255,255,255,0.04)',
                    color: active ? '#ffd700' : 'rgba(255,215,0,0.5)',
                    border: active ? '1.5px solid rgba(255,215,0,0.5)' : '1px solid rgba(255,215,0,0.15)',
                  }}
                >
                  {o.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* 管理メモ */}
        <div className="mb-3">
          <label className="block text-[11px] font-bold mb-1.5" style={{ color: 'rgba(255,215,0,0.7)' }}>
            管理メモ（任意）
          </label>
          <textarea
            value={memo}
            onChange={(e) => setMemo(e.target.value.slice(0, MAX_MEMO))}
            maxLength={MAX_MEMO}
            rows={3}
            placeholder="例: 二学期面談時に手渡し"
            className="w-full rounded-lg px-3 py-2 text-sm bg-transparent resize-none"
            style={{
              border: '1px solid rgba(255,215,0,0.2)',
              color: '#ffd700',
            }}
          />
          <p className="text-[10px] mt-1" style={{ color: 'rgba(255,215,0,0.4)' }}>
            {memo.length}/{MAX_MEMO}
          </p>
        </div>

        {/* 有効期限注釈 */}
        <p className="text-[10px] mb-3" style={{ color: 'rgba(255,215,0,0.55)' }}>
          ⏱ 有効期限は<strong>72時間（発行時点から）</strong>です。
        </p>

        {/* アクション */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleCancel}
            disabled={isSubmitting}
            className="flex-1 rounded-lg px-3 py-2.5 text-sm font-bold"
            style={{
              background: 'rgba(255,255,255,0.04)',
              color: 'rgba(255,215,0,0.6)',
              border: '1px solid rgba(255,215,0,0.15)',
            }}
          >
            クリア
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="flex-[2] rounded-lg px-3 py-2.5 text-sm font-black transition-all active:scale-[0.98]"
            style={{
              background: canSubmit
                ? 'linear-gradient(135deg, #ffd700, #f0a500)'
                : 'rgba(255,215,0,0.1)',
              color: canSubmit ? '#0b1128' : 'rgba(255,215,0,0.35)',
              border: canSubmit ? 'none' : '1px solid rgba(255,215,0,0.15)',
              boxShadow: canSubmit ? '0 0 16px rgba(255,215,0,0.35)' : 'none',
              cursor: canSubmit ? 'pointer' : 'not-allowed',
            }}
          >
            {isSubmitting ? '発行中…' : '🎫 発行する'}
          </button>
        </div>
      </AdminCard>

      {/* ===== 発行済み一覧 ===== */}
      <AdminCard className="p-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-bold" style={{ color: '#ffd700' }}>
            📋 発行済み一覧 {items && <span className="text-[11px]" style={{ color: 'rgba(255,215,0,0.5)' }}>（{items.length}件）</span>}
          </h2>
          <button
            type="button"
            onClick={() => loadItems()}
            className="text-[10px] px-2 py-0.5 rounded"
            style={{
              background: 'rgba(255,215,0,0.08)',
              color: 'rgba(255,215,0,0.7)',
              border: '1px solid rgba(255,215,0,0.2)',
            }}
          >
            ↻ 更新
          </button>
        </div>

        {/* 状態タブ */}
        <div className="flex gap-1 mb-2 overflow-x-auto -mx-1 px-1">
          {STATUS_TABS.map((t) => {
            const active = tabStatus === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTabStatus(t.id)}
                className="shrink-0 rounded-lg px-2.5 py-1.5 text-[11px] font-bold"
                style={{
                  background: active ? 'rgba(255,215,0,0.18)' : 'rgba(255,255,255,0.04)',
                  color: active ? '#ffd700' : 'rgba(255,215,0,0.5)',
                  border: active ? '1.5px solid rgba(255,215,0,0.5)' : '1px solid rgba(255,215,0,0.15)',
                }}
              >
                {t.icon} {t.label}
              </button>
            );
          })}
        </div>

        {/* 検索 */}
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="🔍 子の名前・保護者名・メモ・コードで検索"
          className="w-full rounded-lg px-3 py-2 text-sm bg-transparent mb-3"
          style={{
            border: '1px solid rgba(255,215,0,0.2)',
            color: '#ffd700',
          }}
        />

        {/* リスト */}
        {items === null && (
          <p className="text-center text-sm py-4" style={{ color: 'rgba(255,215,0,0.5)' }}>
            読み込み中...
          </p>
        )}
        {items && filteredItems && filteredItems.length === 0 && (
          <EmptyState
            hasFilter={Boolean(debouncedSearch.trim()) || tabStatus !== 'all'}
            totalItems={items.length}
          />
        )}
        <div className="flex flex-col gap-2">
          {filteredItems?.map((invite) => (
            <InviteRow
              key={invite.id}
              invite={invite}
              onDetail={() => setDetailTarget(invite)}
              onCopy={() => handleCopyCode(invite.code)}
              onLineShare={() => handleRowLineShare(invite.code)}
              onDelete={() => setDeleteTarget(invite)}
              onRegenerate={() => handleRegenerate(invite)}
            />
          ))}
        </div>
      </AdminCard>

      {/* 対象の子ピッカー（モーダル） */}
      {isPickerOpen && (
        <ChildrenPickerModal
          initial={selectedChildren}
          onClose={() => setPickerOpen(false)}
          onApply={(next) => {
            setSelectedChildren(next);
            setPickerOpen(false);
          }}
        />
      )}

      {/* 発行完了モーダル */}
      {successInvite && (
        <InviteSuccessModal
          code={successInvite.code}
          expiresAt={successInvite.expiresAt}
          targetChildren={successInvite.targetChildren}
          onClose={handleSuccessClose}
        />
      )}

      {/* 詳細モーダル */}
      {detailTarget && (
        <InviteDetailModal
          invite={detailTarget}
          onClose={() => setDetailTarget(null)}
          onDelete={detailTarget.status === 'active' ? setDeleteTarget : undefined}
          onRegenerate={detailTarget.status === 'expired' ? handleRegenerate : undefined}
        />
      )}

      {/* 削除確認モーダル */}
      {deleteTarget && (
        <DeleteConfirmModal
          code={deleteTarget.code}
          isDeleting={isDeleting}
          onCancel={() => { if (!isDeleting) setDeleteTarget(null); }}
          onConfirm={confirmDelete}
        />
      )}
    </AdminShell>
  );
}

// ===== 選択中のサマリ表示 =====

function SelectedChildrenSummary({ childIds }: { childIds: string[] }) {
  const students = childIds
    .map(findStudentByChildId)
    .filter((s): s is StudentRecord => s !== null);
  if (students.length === 0) {
    return <span>タップして選択（複数可）</span>;
  }
  if (students.length <= 3) {
    return (
      <span>
        {students.map((s) => `${s.emoji} ${s.name}`).join('、')}
      </span>
    );
  }
  return (
    <span>
      {students.slice(0, 2).map((s) => `${s.emoji} ${s.name}`).join('、')}
      {' '}ほか {students.length - 2} 名
    </span>
  );
}

// ===== 対象の子ピッカー =====

interface ChildrenPickerModalProps {
  initial: string[];
  onClose: () => void;
  onApply: (next: string[]) => void;
}

function ChildrenPickerModal({ initial, onClose, onApply }: ChildrenPickerModalProps) {
  const [picked, setPicked] = useState<Set<string>>(new Set(initial));

  function toggle(childId: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(childId)) next.delete(childId);
      else next.add(childId);
      return next;
    });
  }

  function toggleClass(abbr: StudentRecord['classAbbr']) {
    const classmates = STUDENTS.filter((s) => s.classAbbr === abbr).map(buildStudentChildId);
    const allPicked = classmates.every((id) => picked.has(id));
    setPicked((prev) => {
      const next = new Set(prev);
      if (allPicked) classmates.forEach((id) => next.delete(id));
      else           classmates.forEach((id) => next.add(id));
      return next;
    });
  }

  const total = picked.size;

  // z-[9999]: BottomNav (z-50) より必ず上に重ねて overlay が viewport 全体を覆うように。
  // pb-24 sm:pb-3: モバイルでは下部ナビ約 64px+safe-area を避けて card フッターを持ち上げる。
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
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 py-3 border-b" style={{ borderColor: 'rgba(255,215,0,0.2)' }}>
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold" style={{ color: '#ffd700' }}>対象の子を選択</h3>
            <button
              type="button"
              onClick={onClose}
              className="text-lg leading-none px-2"
              style={{ color: 'rgba(255,215,0,0.6)' }}
            >
              ✕
            </button>
          </div>
          <p className="text-[11px] mt-0.5" style={{ color: 'rgba(255,215,0,0.55)' }}>
            選択中: {total} 名（複数可）
          </p>
        </div>

        {/* Class groups */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {CLASS_ORDER.map((cls) => {
            const members = STUDENTS.filter((s) => s.classAbbr === cls.abbr);
            if (members.length === 0) return null;
            const memberIds = members.map(buildStudentChildId);
            const classAllPicked = memberIds.every((id) => picked.has(id));
            const classSomePicked = !classAllPicked && memberIds.some((id) => picked.has(id));

            return (
              <div key={cls.abbr}>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-[11px] font-bold" style={{ color: 'rgba(255,215,0,0.7)' }}>
                    {cls.emoji} {cls.label}
                  </p>
                  <button
                    type="button"
                    onClick={() => toggleClass(cls.abbr)}
                    className="text-[10px] px-2 py-0.5 rounded"
                    style={{
                      background: classAllPicked ? 'rgba(255,215,0,0.2)' : 'rgba(255,255,255,0.04)',
                      color: classAllPicked ? '#ffd700' : 'rgba(255,215,0,0.55)',
                      border: '1px solid rgba(255,215,0,0.2)',
                    }}
                  >
                    {classAllPicked ? '全解除' : classSomePicked ? '一部選択中' : 'クラス全員'}
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {members.map((s) => {
                    const id = buildStudentChildId(s);
                    const on = picked.has(id);
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => toggle(id)}
                        className="rounded-lg px-2 py-1.5 text-[11px] font-bold transition-all active:scale-[0.97]"
                        style={{
                          background: on ? 'rgba(255,215,0,0.18)' : 'rgba(255,255,255,0.03)',
                          color: on ? '#ffd700' : 'rgba(255,215,0,0.6)',
                          border: on ? '1.5px solid rgba(255,215,0,0.55)' : '1px solid rgba(255,215,0,0.12)',
                        }}
                      >
                        {s.emoji} {s.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-3 py-3 border-t flex gap-2" style={{ borderColor: 'rgba(255,215,0,0.2)' }}>
          <button
            type="button"
            onClick={() => setPicked(new Set())}
            className="rounded-lg px-3 py-2 text-[12px] font-bold"
            style={{
              background: 'rgba(255,255,255,0.04)',
              color: 'rgba(255,215,0,0.55)',
              border: '1px solid rgba(255,215,0,0.15)',
            }}
          >
            全クリア
          </button>
          <button
            type="button"
            onClick={() => onApply(Array.from(picked))}
            className="flex-1 rounded-lg px-3 py-2 text-sm font-black active:scale-[0.98]"
            style={{
              background: 'linear-gradient(135deg, #ffd700, #f0a500)',
              color: '#0b1128',
              boxShadow: '0 0 12px rgba(255,215,0,0.3)',
            }}
          >
            {total} 名を適用
          </button>
        </div>
      </div>
    </div>
  );
}

// ===== 空状態表示 =====

function EmptyState({ hasFilter, totalItems }: { hasFilter: boolean; totalItems: number }) {
  // hasFilter: 検索 or タブ絞り込み中 / totalItems: 現タブの全件数
  // 現タブの全件が 0 かつフィルタが無い（= タブ=all & 検索なし）時だけ全体ゼロ文言
  const isAllEmpty = totalItems === 0 && !hasFilter;
  if (isAllEmpty) {
    return (
      <div className="text-center py-6 px-4">
        <p className="text-sm mb-1" style={{ color: 'rgba(255,215,0,0.7)' }}>
          まだ招待コードが発行されていません
        </p>
        <p className="text-[11px]" style={{ color: 'rgba(255,215,0,0.45)' }}>
          上のフォームから発行してください
        </p>
      </div>
    );
  }
  return (
    <p className="text-center text-sm py-4" style={{ color: 'rgba(255,255,255,0.45)' }}>
      該当する招待コードはありません
    </p>
  );
}

// ===== 一覧行 =====

interface InviteRowProps {
  invite: InviteCode;
  onDetail: () => void;
  onCopy: () => void;
  onLineShare: () => void;
  onDelete: () => void;
  onRegenerate: () => void;
}

function InviteRow({ invite, onDetail, onCopy, onLineShare, onDelete, onRegenerate }: InviteRowProps) {
  const theme = STATUS_THEME[invite.status];
  const students = invite.targetChildren
    .map(findStudentByChildId)
    .filter((s): s is StudentRecord => s !== null);

  return (
    <AdminCard className="p-3">
      {/* Line 1: badge + code + created */}
      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
        <span
          className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold"
          style={{ background: theme.bg, color: theme.fg, border: `1px solid ${theme.border}` }}
        >
          {theme.icon} {theme.label}
        </span>
        <p
          className="text-sm font-black tracking-[0.1em]"
          style={{
            color: '#ffd700',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
          }}
        >
          {invite.code}
        </p>
        <span
          className="text-[10px] ml-auto"
          style={{ color: 'rgba(255,215,0,0.5)' }}
          title={formatShortDateTime(invite.createdAt)}
        >
          {formatRelativeDateTime(invite.createdAt)}
        </span>
      </div>

      {/* Line 2: target children */}
      <div className="flex flex-wrap gap-1 mb-1">
        {students.length === 0 && (
          <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.45)' }}>—</span>
        )}
        {students.map((s) => (
          <span
            key={`${s.classAbbr}_${s.name}`}
            className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-bold"
            style={{
              background: 'rgba(255,215,0,0.08)',
              color: 'rgba(255,215,0,0.85)',
              border: '1px solid rgba(255,215,0,0.2)',
            }}
          >
            {s.emoji} {s.name}
          </span>
        ))}
      </div>

      {/* Line 3: parent + memo */}
      {(invite.parentName || invite.memo) && (
        <div className="mb-1 text-[11px]" style={{ color: 'rgba(255,215,0,0.7)' }}>
          {invite.parentName && (
            <span>
              {invite.parentName}
              {invite.relationship && `（${RELATIONSHIP_LABELS[invite.relationship]}）`}
            </span>
          )}
          {invite.parentName && invite.memo && <span className="mx-1">・</span>}
          {invite.memo && (
            <span style={{ color: 'rgba(255,255,255,0.55)' }}>
              {invite.memo.length > 40 ? invite.memo.slice(0, 40) + '…' : invite.memo}
            </span>
          )}
        </div>
      )}

      {/* Line 4: time info */}
      <div className="text-[10px] mb-2" style={{ color: 'rgba(255,215,0,0.55)' }}>
        {invite.status === 'active' && <>⏱ {formatRemaining(invite)}</>}
        {invite.status === 'used' && invite.usedAt && <>✔ {formatShortDateTime(invite.usedAt)} に使用</>}
        {invite.status === 'expired' && <>⌛ {formatShortDateTime(invite.expiresAt)} に失効</>}
      </div>

      {/* Actions
           spec: active = [詳細][コピー][LINE共有][削除]
                 used   = [詳細] のみ
                 expired = [詳細][再発行] */}
      <div className="flex gap-1 flex-wrap">
        <RowActionButton onClick={onDetail} tone="default">詳細</RowActionButton>
        {invite.status === 'active' && (
          <>
            <RowActionButton onClick={onCopy} tone="gold">📋 コピー</RowActionButton>
            <RowActionButton onClick={onLineShare} tone="green">📱 LINE</RowActionButton>
            <RowActionButton onClick={onDelete} tone="red">⚠️ 削除</RowActionButton>
          </>
        )}
        {invite.status === 'expired' && (
          <RowActionButton onClick={onRegenerate} tone="gold">🔄 再発行</RowActionButton>
        )}
      </div>
    </AdminCard>
  );
}

function RowActionButton({
  children, onClick, tone,
}: {
  children: React.ReactNode;
  onClick: () => void;
  tone: 'default' | 'gold' | 'green' | 'red';
}) {
  const TONES = {
    default: { bg: 'rgba(255,255,255,0.05)', fg: 'rgba(255,215,0,0.7)',  bd: 'rgba(255,215,0,0.2)' },
    gold:    { bg: 'rgba(255,215,0,0.12)',   fg: '#ffd700',              bd: 'rgba(255,215,0,0.4)' },
    green:   { bg: 'rgba(6,199,85,0.14)',    fg: '#06c755',              bd: 'rgba(6,199,85,0.45)' },
    red:     { bg: 'rgba(239,68,68,0.12)',   fg: '#f87171',              bd: 'rgba(239,68,68,0.4)' },
  } as const;
  const t = TONES[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md px-2 py-1 text-[11px] font-bold active:scale-[0.97] transition-transform"
      style={{ background: t.bg, color: t.fg, border: `1px solid ${t.bd}` }}
    >
      {children}
    </button>
  );
}

// ===== 削除確認モーダル =====

interface DeleteConfirmModalProps {
  code: string;
  isDeleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

function DeleteConfirmModal({ code, isDeleting, onCancel, onConfirm }: DeleteConfirmModalProps) {
  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-3 pb-24 sm:pb-3"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-2xl overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, rgba(26,31,58,0.98), rgba(15,20,40,0.98))',
          border: '1.5px solid rgba(239,68,68,0.45)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4">
          <h3 className="text-base font-bold mb-2" style={{ color: '#f87171' }}>
            🗑 コードを削除しますか？
          </h3>
          <p className="text-sm mb-2" style={{ color: 'rgba(255,255,255,0.8)' }}>
            <span
              className="font-black"
              style={{
                color: '#ffd700',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
              }}
            >
              {code}
            </span>
          </p>
          <p className="text-[11px]" style={{ color: 'rgba(239,68,68,0.8)' }}>
            ⚠ 削除後は復元できません。
          </p>
        </div>
        <div className="px-3 py-3 border-t flex gap-2" style={{ borderColor: 'rgba(239,68,68,0.25)' }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={isDeleting}
            className="flex-1 rounded-lg px-3 py-2 text-sm font-bold"
            style={{
              background: 'rgba(255,255,255,0.05)',
              color: 'rgba(255,215,0,0.7)',
              border: '1px solid rgba(255,215,0,0.2)',
              cursor: isDeleting ? 'not-allowed' : 'pointer',
            }}
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="flex-1 rounded-lg px-3 py-2 text-sm font-black active:scale-[0.98] transition-transform"
            style={{
              background: 'linear-gradient(135deg, #ef4444, #b91c1c)',
              color: '#fff',
              boxShadow: '0 0 12px rgba(239,68,68,0.35)',
              cursor: isDeleting ? 'wait' : 'pointer',
            }}
          >
            {isDeleting ? '削除中…' : '削除する'}
          </button>
        </div>
      </div>
    </div>
  );
}
