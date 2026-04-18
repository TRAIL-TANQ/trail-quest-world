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
import { useEffect, useMemo, useState } from 'react';
import { useSearch } from 'wouter';
import { toast } from 'sonner';
import AdminGuard from '@/components/admin/AdminGuard';
import AdminShell, { AdminCard } from '@/components/admin/AdminShell';
import InviteSuccessModal from '@/components/admin/InviteSuccessModal';
import {
  STUDENTS,
  buildStudentChildId,
  findStudentByChildId,
  type StudentRecord,
} from '@/data/students';
import {
  createInviteCode,
  type Relationship,
  RELATIONSHIP_LABELS,
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
    // TODO(Step 5): 一覧の再取得をここで発火する
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

      {/* ===== 一覧プレースホルダー（Step 5 で本実装） ===== */}
      <AdminCard className="p-4">
        <h2 className="text-sm font-bold mb-2" style={{ color: '#ffd700' }}>📋 発行済み一覧</h2>
        <p className="text-[11px]" style={{ color: 'rgba(255,215,0,0.5)' }}>
          Step 5 で本実装予定（状態タブ、検索、コピー/共有/削除/再発行アクション）
        </p>
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
