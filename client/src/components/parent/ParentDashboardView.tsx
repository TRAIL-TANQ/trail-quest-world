/**
 * ParentDashboardView — 保護者視点の週次レポート表示（Phase C）
 *
 * 自己完結設計:
 *   - 色/余白は inline style で固定（TQW の tqw-gold 等に依存しない）
 *   - 依存は wouter なし、recharts / sonner / supabase は許容
 *   - props: childId, emoji, name, className, showAdminControls
 *   - 将来 tqw-parent-dashboard リポジトリに丸ごとコピペで移動予定
 *
 * 見た目は保護者向けにやさしいトーン（ベージュ白背景 + teal アクセント）。
 * TQW 本体（ダークネイビー + ゴールド）と明確に異なるカラースキーム。
 */
import { useState } from 'react';
import { toast } from 'sonner';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import {
  getOrGenerateReport,
  generateReport,
  formatStudySeconds,
  formatMonthDay,
  type WeeklyReport,
} from '@/lib/weeklyReport';

export interface ParentDashboardViewProps {
  childId:   string;
  emoji:     string;
  name:      string;
  className: string;
  /** kk の強制再生成ボタンを表示するか。保護者画面では false。 */
  showAdminControls?: boolean;
}

const palette = {
  bg:         '#f8fafc',  // soft white
  card:       '#ffffff',
  border:     '#e2e8f0',
  accent:     '#0d9488',  // teal-600
  accentSoft: '#ccfbf1',  // teal-100
  text:       '#1e293b',  // slate-800
  subtext:    '#64748b',  // slate-500
  warm:       '#fef3c7',  // amber-100
  warmBorder: '#fcd34d',  // amber-300
};

export default function ParentDashboardView({
  childId,
  emoji,
  name,
  className,
  showAdminControls = false,
}: ParentDashboardViewProps) {
  const [report,  setReport]  = useState<WeeklyReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);

  async function handleLoad() {
    setLoading(true);
    setError(null);
    try {
      const r = await getOrGenerateReport(childId);
      setReport(r);
    } catch (e) {
      setError((e as Error).message);
      toast.error('レポートの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }

  async function handleForceRegenerate() {
    if (!confirm('このレポートを新しい内容で再生成しますか？（Claude API コストが発生）')) return;
    setRegenerating(true);
    setError(null);
    try {
      const r = await generateReport(childId);
      setReport(r);
      toast.success('再生成しました');
    } catch (e) {
      setError((e as Error).message);
      toast.error('再生成に失敗しました');
    } finally {
      setRegenerating(false);
    }
  }

  return (
    <div
      style={{
        background:  palette.bg,
        color:       palette.text,
        padding:     '20px 16px',
        borderRadius: 16,
        fontFamily:  'system-ui, -apple-system, "Hiragino Kaku Gothic ProN", "Yu Gothic UI", sans-serif',
        minHeight:   280,
      }}
    >
      {/* ===== ヘッダー: 子どもプロフィール ===== */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        <div
          style={{
            width: 48, height: 48, borderRadius: 12,
            background: palette.accentSoft,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 28,
          }}
        >
          {emoji}
        </div>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{name} さん</div>
          <div style={{ fontSize: 12, color: palette.subtext }}>{className}</div>
        </div>
      </div>

      {/* ===== 初回: レポート取得ボタン ===== */}
      {!report && !loading && !error && (
        <button
          type="button"
          onClick={handleLoad}
          style={{
            width: '100%',
            padding: '14px 16px',
            background: palette.accent,
            color: '#fff',
            border: 'none',
            borderRadius: 12,
            fontSize: 15,
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(13,148,136,0.25)',
          }}
        >
          🎓 今週のレポートを見る
        </button>
      )}

      {/* ===== ローディング ===== */}
      {loading && <LoadingCard name={name} />}

      {/* ===== エラー ===== */}
      {error && !loading && (
        <div style={{
          background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c',
          padding: 12, borderRadius: 8, fontSize: 13,
        }}>
          エラー: {error}
          <button
            type="button"
            onClick={handleLoad}
            style={{
              display: 'block', marginTop: 8, padding: '6px 12px',
              background: '#fff', border: '1px solid #fca5a5', color: '#b91c1c',
              borderRadius: 6, fontSize: 12, cursor: 'pointer',
            }}
          >
            もう一度試す
          </button>
        </div>
      )}

      {/* ===== レポート ===== */}
      {report && !loading && (
        <ReportCard report={report} name={name} />
      )}

      {/* ===== kk 専用: 強制再生成 ===== */}
      {showAdminControls && report && (
        <div style={{
          marginTop: 20, padding: 12, borderRadius: 10,
          background: palette.warm, border: `1px solid ${palette.warmBorder}`,
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 6, color: '#92400e' }}>
            👑 kk 専用コントロール
          </div>
          <button
            type="button"
            onClick={handleForceRegenerate}
            disabled={regenerating}
            style={{
              width: '100%', padding: '10px 12px',
              background: regenerating ? '#fbbf24' : '#f59e0b',
              color: '#fff', border: 'none', borderRadius: 8,
              fontSize: 13, fontWeight: 700,
              cursor: regenerating ? 'wait' : 'pointer',
            }}
          >
            {regenerating ? '🔄 再生成中...' : '🔄 強制再生成（キャッシュ無視）'}
          </button>
          {report.generation_model && (
            <div style={{ fontSize: 10, color: '#92400e', marginTop: 6 }}>
              model: {report.generation_model} /
              duration: {report.generation_duration_ms ?? '—'} ms /
              cost: ¥{report.api_cost_jpy ?? '—'} /
              source: {report.source}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ==================== Loading ====================

function LoadingCard({ name }: { name: string }) {
  return (
    <div style={{
      background: palette.card, border: `1px solid ${palette.border}`,
      padding: 20, borderRadius: 12, textAlign: 'center',
    }}>
      <div style={{ fontSize: 32, marginBottom: 8 }}>✨</div>
      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>
        {name}さんのレポートを作っています
      </div>
      <div style={{ fontSize: 12, color: palette.subtext }}>
        AI がコメントを書いています（10〜20秒ほど）
      </div>
      <div style={{
        marginTop: 14, height: 4, borderRadius: 2, overflow: 'hidden',
        background: palette.border,
      }}>
        <div style={{
          height: '100%', width: '40%',
          background: palette.accent,
          animation: 'parentDashLoading 1.4s ease-in-out infinite',
        }} />
      </div>
      <style>{`
        @keyframes parentDashLoading {
          0%   { margin-left: -40%; width: 40%; }
          50%  { margin-left: 30%;  width: 40%; }
          100% { margin-left: 100%; width: 40%; }
        }
      `}</style>
    </div>
  );
}

// ==================== Report card ====================

function ReportCard({ report, name }: { report: WeeklyReport; name: string }) {
  const c = report.content;
  const s = c.summary;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* 週の見出し */}
      <div style={{ fontSize: 12, color: palette.subtext }}>
        対象週: {report.week_start} 〜 {report.week_end}
        {c.light && (
          <span style={{
            marginLeft: 6, padding: '1px 6px', borderRadius: 4,
            background: palette.warm, color: '#92400e', fontSize: 10,
          }}>
            軽量レポート（活動少）
          </span>
        )}
      </div>

      {/* AI コメント */}
      <div style={{
        background: palette.card, border: `1px solid ${palette.border}`,
        padding: 14, borderRadius: 12, lineHeight: 1.75, fontSize: 14,
        whiteSpace: 'pre-wrap',
      }}>
        {c.ai_comment}
      </div>

      {/* ハイライト */}
      {c.highlights && c.highlights.length > 0 && (
        <div>
          <SectionTitle>✨ 今週のハイライト</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {c.highlights.map((h, i) => (
              <div key={i} style={{
                background: palette.accentSoft, padding: '8px 12px', borderRadius: 8,
                fontSize: 13, display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <span style={{ fontSize: 16 }}>{h.icon}</span>
                <span>{h.text}</span>
                <span style={{ marginLeft: 'auto', fontSize: 11, color: palette.subtext }}>
                  {formatMonthDay(h.date)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* サマリー */}
      <div>
        <SectionTitle>📊 今週のサマリー</SectionTitle>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <StatTile
            icon="⚔️" label="バトル"
            value={`${s.battle.wins}勝${s.battle.losses}敗`}
            sub={s.battle.wins + s.battle.losses > 0
              ? `勝率 ${Math.round(s.battle.win_rate * 100)}%`
              : undefined}
          />
          <StatTile
            icon="🌟" label="ALTゲーム"
            value={`${s.alt_game.count}回`}
            sub={`+${s.alt_game.total_alt_earned} ALT`}
          />
          <StatTile
            icon="📖" label="クイズ正答率"
            value={s.quiz.total_answered > 0 ? `${Math.round(s.quiz.accuracy * 100)}%` : '—'}
            sub={s.quiz.total_answered > 0 ? `${s.quiz.total_answered}問` : '記録なし'}
          />
          <StatTile
            icon="🏆" label="大会"
            value={s.tournament.participated > 0 ? `${s.tournament.participated}参加` : '—'}
            sub={s.tournament.wins > 0 ? `${s.tournament.wins}勝` : '—'}
          />
        </div>
        <div style={{
          marginTop: 8, fontSize: 12, color: palette.subtext,
          textAlign: 'center',
        }}>
          週の学習時間合計: {formatStudySeconds(report.study_seconds)}
        </div>
      </div>

      {/* 日別チャート */}
      {c.daily && c.daily.length > 0 && (
        <div>
          <SectionTitle>📅 日別の学習時間</SectionTitle>
          <div style={{
            background: palette.card, border: `1px solid ${palette.border}`,
            padding: 8, borderRadius: 12, height: 160,
          }}>
            <ResponsiveContainer>
              <BarChart data={c.daily.map((d) => ({ date: formatMonthDay(d.date), min: Math.round(d.seconds / 60) }))}>
                <CartesianGrid stroke={palette.border} strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fill: palette.subtext, fontSize: 10 }} stroke={palette.border} />
                <YAxis allowDecimals={false} tick={{ fill: palette.subtext, fontSize: 10 }} stroke={palette.border} unit="分" />
                <Tooltip
                  contentStyle={{ background: palette.card, border: `1px solid ${palette.border}`, fontSize: 11 }}
                  formatter={(v: number) => [`${v}分`, '学習時間']}
                />
                <Bar dataKey="min" fill={palette.accent} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div style={{ fontSize: 10, color: palette.subtext, textAlign: 'center', marginTop: 4 }}>
        {report.generated_by === 'ondemand' ? '🤖 自動生成レポート' : ''}
        {' · '}
        {name}さんの TRAIL QUEST World プレイ記録より
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 12, fontWeight: 700, color: palette.subtext, marginBottom: 6 }}>
      {children}
    </div>
  );
}

function StatTile({
  icon, label, value, sub,
}: {
  icon: string; label: string; value: string; sub?: string;
}) {
  return (
    <div style={{
      background: palette.card, border: `1px solid ${palette.border}`,
      padding: 10, borderRadius: 10,
    }}>
      <div style={{ fontSize: 11, color: palette.subtext, marginBottom: 2 }}>
        {icon} {label}
      </div>
      <div style={{ fontSize: 18, fontWeight: 700, color: palette.text }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: palette.subtext, marginTop: 1 }}>{sub}</div>}
    </div>
  );
}
