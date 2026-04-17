/**
 * AdminStudentsPage — 生徒一覧。
 * クラスフィルター + ソート機能付き。行タップで詳細へ遷移。
 */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'wouter';
import AdminGuard from '@/components/admin/AdminGuard';
import AdminShell, { AdminCard } from '@/components/admin/AdminShell';
import { fetchAllChildStatuses, type StudentStatus } from '@/lib/adminDashboardService';

type ClassFilter = 'all' | 'スターター' | 'ベーシック' | 'アドバンス' | 'リミットレス' | '個別';
type SortKey = 'name' | 'level' | 'alt' | 'rating' | 'winRate' | 'lastActive';

const CLASS_TABS: Array<{ id: ClassFilter; label: string; emoji: string }> = [
  { id: 'all',           label: '全員',       emoji: '👥' },
  { id: 'スターター',    label: 'スターター', emoji: '⭐' },
  { id: 'ベーシック',    label: 'ベーシック', emoji: '🔷' },
  { id: 'アドバンス',    label: 'アドバンス', emoji: '🔶' },
  { id: 'リミットレス',  label: 'リミ',       emoji: '🚀' },
  { id: '個別',          label: '個別',       emoji: '💎' },
];

const SORT_OPTIONS: Array<{ id: SortKey; label: string }> = [
  { id: 'name',       label: '名前順' },
  { id: 'level',      label: 'Lv順' },
  { id: 'alt',        label: 'ALT順' },
  { id: 'rating',     label: 'レート順' },
  { id: 'winRate',    label: '勝率順' },
  { id: 'lastActive', label: '最終ログイン順' },
];

function formatRelative(iso: string | null): string {
  if (!iso) return '—';
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 60) return `${min}分前`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}時間前`;
  const d = Math.floor(h / 24);
  return `${d}日前`;
}

export default function AdminStudentsPage() {
  return <AdminGuard><Inner /></AdminGuard>;
}

function Inner() {
  const [students, setStudents] = useState<StudentStatus[] | null>(null);
  const [classFilter, setClassFilter] = useState<ClassFilter>('all');
  const [sortKey, setSortKey] = useState<SortKey>('name');

  useEffect(() => {
    let cancelled = false;
    fetchAllChildStatuses().then((s) => { if (!cancelled) setStudents(s); });
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    if (!students) return [];
    const base = classFilter === 'all' ? students : students.filter((s) => s.classAbbr === classFilter);
    const sorted = [...base];
    switch (sortKey) {
      case 'name':
        sorted.sort((a, b) => a.name.localeCompare(b.name, 'ja'));
        break;
      case 'level':
        sorted.sort((a, b) => b.level - a.level);
        break;
      case 'alt':
        sorted.sort((a, b) => b.altPoints - a.altPoints);
        break;
      case 'rating':
        sorted.sort((a, b) => b.rating - a.rating);
        break;
      case 'winRate':
        sorted.sort((a, b) => b.winRate - a.winRate);
        break;
      case 'lastActive':
        sorted.sort((a, b) => (b.lastActiveAt ?? '').localeCompare(a.lastActiveAt ?? ''));
        break;
    }
    return sorted;
  }, [students, classFilter, sortKey]);

  return (
    <AdminShell title="生徒一覧" subtitle={`登録 ${students?.length ?? 0}名`}>
      {/* Class filter tabs */}
      <div className="flex gap-1 mb-2 overflow-x-auto -mx-1 px-1">
        {CLASS_TABS.map((t) => {
          const active = classFilter === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setClassFilter(t.id)}
              className="shrink-0 rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition-all"
              style={{
                background: active ? 'rgba(255,215,0,0.18)' : 'rgba(255,255,255,0.04)',
                color: active ? '#ffd700' : 'rgba(255,215,0,0.5)',
                border: active ? '1.5px solid rgba(255,215,0,0.5)' : '1px solid rgba(255,215,0,0.15)',
              }}
            >
              {t.emoji} {t.label}
            </button>
          );
        })}
      </div>

      {/* Sort */}
      <div className="flex gap-1 mb-3 overflow-x-auto -mx-1 px-1">
        {SORT_OPTIONS.map((o) => {
          const active = sortKey === o.id;
          return (
            <button
              key={o.id}
              onClick={() => setSortKey(o.id)}
              className="shrink-0 rounded-md px-2 py-1 text-[10px] font-bold"
              style={{
                background: active ? 'rgba(59,130,246,0.22)' : 'rgba(255,255,255,0.04)',
                color: active ? '#60a5fa' : 'rgba(255,255,255,0.45)',
                border: active ? '1px solid rgba(59,130,246,0.5)' : '1px solid rgba(255,255,255,0.12)',
              }}
            >
              {o.label}
            </button>
          );
        })}
      </div>

      {/* Rows */}
      {!students && (
        <p className="text-center text-sm mt-6" style={{ color: 'rgba(255,215,0,0.5)' }}>読み込み中...</p>
      )}
      {students && filtered.length === 0 && (
        <p className="text-center text-sm mt-6" style={{ color: 'rgba(255,255,255,0.45)' }}>該当なし</p>
      )}
      <div className="flex flex-col gap-2">
        {filtered.map((s) => (
          <Link key={s.childId} href={`/admin/students/${encodeURIComponent(s.childId)}`}>
            <div>
              <AdminCard className="p-3 active:scale-[0.99] transition-transform cursor-pointer">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-2xl shrink-0"
                    style={{ background: 'rgba(255,215,0,0.1)', border: '1.5px solid rgba(255,215,0,0.3)' }}>
                    {s.emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-bold text-amber-100 truncate">{s.name}</p>
                      <span className="text-[9px] px-1.5 py-0.5 rounded"
                        style={{ background: 'rgba(255,215,0,0.08)', color: 'rgba(255,215,0,0.7)', border: '1px solid rgba(255,215,0,0.2)' }}>
                        {s.className}
                      </span>
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-[10px]">
                      <div>
                        <span className="text-amber-200/50">Lv</span>
                        <span className="font-bold ml-1" style={{ color: '#ffd700' }}>{s.level}</span>
                      </div>
                      <div>
                        <span className="text-amber-200/50">ALT</span>
                        <span className="font-bold ml-1" style={{ color: '#ffd700' }}>{s.altPoints}</span>
                      </div>
                      <div>
                        <span className="text-amber-200/50">R</span>
                        <span className="font-bold ml-1" style={{ color: '#60a5fa' }}>{s.rating}</span>
                      </div>
                      <div>
                        <span className="text-amber-200/50">勝率</span>
                        <span className="font-bold ml-1" style={{ color: '#22c55e' }}>
                          {(s.wins + s.losses) > 0 ? `${Math.round(s.winRate * 100)}%` : '—'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[9px] text-amber-200/40">最終</p>
                    <p className="text-[10px]" style={{ color: 'rgba(255,215,0,0.6)' }}>{formatRelative(s.lastActiveAt)}</p>
                    <p className="text-[9px] text-amber-200/40 mt-0.5">解放{s.deckUnlockedCount}/5</p>
                  </div>
                  <span className="text-amber-200/40 text-lg shrink-0">›</span>
                </div>
              </AdminCard>
            </div>
          </Link>
        ))}
      </div>
    </AdminShell>
  );
}
