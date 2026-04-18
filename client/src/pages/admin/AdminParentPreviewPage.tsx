/**
 * AdminParentPreviewPage — 保護者ダッシュボードの kk プレビュー（Phase C）
 *
 * kk が「保護者にはどう見えるか」を確認するための画面。
 * 生徒を選んで保護者視点の ParentDashboardView を表示する。
 *
 * 本画面は TQW 本体に暫定配置。Phase B2 で tqw-parent-dashboard を
 * 本格実装する際に ParentDashboardView コンポーネントを移植する。
 */
import { useMemo, useState } from 'react';
import AdminGuard from '@/components/admin/AdminGuard';
import AdminShell, { AdminCard } from '@/components/admin/AdminShell';
import ParentDashboardView from '@/components/parent/ParentDashboardView';
import { STUDENTS, buildStudentChildId, type StudentRecord } from '@/data/students';

const CLASS_ORDER: ReadonlyArray<{ abbr: StudentRecord['classAbbr']; label: string; emoji: string }> = [
  { abbr: 'スターター',   label: '探究スターター',   emoji: '⭐' },
  { abbr: 'ベーシック',   label: '探究ベーシック',   emoji: '🔷' },
  { abbr: 'アドバンス',   label: '探究アドバンス',   emoji: '🔶' },
  { abbr: 'リミットレス', label: '探究リミットレス', emoji: '🚀' },
  { abbr: '個別',         label: '探究個別',         emoji: '💎' },
];

export default function AdminParentPreviewPage() {
  return <AdminGuard><Inner /></AdminGuard>;
}

function Inner() {
  const [selectedChildId, setSelectedChildId] = useState<string>('');
  const [previewKey, setPreviewKey] = useState(0);  // 生徒変更時の再マウント用

  const selected = useMemo(() => {
    if (!selectedChildId) return null;
    const parts = selectedChildId.split('_', 2);
    return STUDENTS.find((s) => s.classAbbr === parts[0] && s.name === parts[1]) ?? null;
  }, [selectedChildId]);

  function selectChild(id: string) {
    setSelectedChildId(id);
    setPreviewKey((k) => k + 1);
  }

  return (
    <AdminShell
      title="保護者プレビュー"
      subtitle="保護者視点の週次レポート画面を確認"
    >
      {/* ===== 生徒セレクター ===== */}
      <AdminCard className="p-3 mb-4">
        <p className="text-[11px] font-bold mb-2" style={{ color: 'rgba(255,215,0,0.7)' }}>
          👥 表示する生徒を選択
        </p>
        <div className="flex flex-col gap-2">
          {CLASS_ORDER.map((cls) => {
            const members = STUDENTS.filter((s) => s.classAbbr === cls.abbr);
            if (members.length === 0) return null;
            return (
              <div key={cls.abbr}>
                <p className="text-[10px] mb-1" style={{ color: 'rgba(255,215,0,0.55)' }}>
                  {cls.emoji} {cls.label}
                </p>
                <div className="grid grid-cols-3 gap-1.5">
                  {members.map((s) => {
                    const id = buildStudentChildId(s);
                    const active = selectedChildId === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => selectChild(id)}
                        className="rounded-lg px-2 py-1.5 text-[11px] font-bold transition-all active:scale-[0.97]"
                        style={{
                          background: active ? 'rgba(45,212,191,0.22)' : 'rgba(255,255,255,0.04)',
                          color: active ? '#5eead4' : 'rgba(255,215,0,0.6)',
                          border: active
                            ? '1.5px solid rgba(45,212,191,0.55)'
                            : '1px solid rgba(255,215,0,0.12)',
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
      </AdminCard>

      {/* ===== プレビュー本体 ===== */}
      {!selected && (
        <AdminCard className="p-6 text-center">
          <p className="text-sm" style={{ color: 'rgba(255,215,0,0.5)' }}>
            上から生徒を選ぶと、保護者ダッシュボード相当の画面が表示されます
          </p>
        </AdminCard>
      )}

      {selected && (
        <div className="mb-4">
          <p className="text-[10px] mb-2" style={{ color: 'rgba(45,212,191,0.7)' }}>
            ↓ 保護者視点 (TQW カラーに依存しない self-contained UI)
          </p>
          <ParentDashboardView
            key={`${selectedChildId}-${previewKey}`}
            childId={buildStudentChildId(selected)}
            emoji={selected.emoji}
            name={selected.name}
            className={selected.className}
            showAdminControls={true}
          />
        </div>
      )}
    </AdminShell>
  );
}
