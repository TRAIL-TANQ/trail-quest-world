/*
 * StageSelectPage (変更9): ソロモード ステージ選択画面
 *
 * 10ステージのグリッド表示。クリア済み/解放中/ロック状態を区別し、
 * 報酬と AI レーティングを表示する。一番左上にフリープレイ枠を置く。
 */
import { Link } from 'wouter';
import { STAGES } from '@/lib/stages';
import { useStageProgressStore } from '@/lib/stageProgressStore';
import { IMAGES } from '@/lib/constants';

const themeBadge: Record<string, { label: string; color: string }> = {
  balanced:       { label: 'バランス',     color: '#94a3b8' },
  heritage_heavy: { label: '🏛️ 遺産型',     color: '#22c55e' },
  ssr_powered:    { label: '💎 SSR',        color: '#a855f7' },
  nuke_combo:     { label: '☢️ 原爆コンボ', color: '#ef4444' },
};

export default function StageSelectPage() {
  const cleared = useStageProgressStore((s) => s.clearedIds);
  const highest = useStageProgressStore((s) => s.highestClearedStage());

  // ステージ解放: clearedの最大値+1 まで解放
  const isUnlocked = (stageId: number) => stageId <= highest + 1;

  return (
    <div className="relative min-h-full">
      <div className="absolute inset-0 z-0">
        <img src={IMAGES.GAME_CARDS_BG} alt="" className="w-full h-full object-cover" style={{ filter: 'brightness(0.2) saturate(0.6)' }} />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(11,17,40,0.7) 0%, rgba(11,17,40,0.95) 100%)' }} />
      </div>

      <div className="relative z-10 px-4 pt-4 pb-4">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #ffd700, #f0a500)', boxShadow: '0 0 10px rgba(255,215,0,0.3)' }}>
            <span className="text-lg">⚔️</span>
          </div>
          <h1 className="text-lg font-bold" style={{ color: '#ffd700', textShadow: '0 0 10px rgba(255,215,0,0.2)' }}>ソロモード</h1>
          <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, rgba(255,215,0,0.3), transparent)' }} />
          <span className="text-[11px] text-amber-200/50">クリア {cleared.size}/10</span>
        </div>

        {/* Free play */}
        <Link href="/games/knowledge-challenger">
          <div className="mb-4 rounded-xl p-3 flex items-center gap-3 transition-all hover:scale-[1.01] active:scale-[0.99]"
            style={{
              background: 'linear-gradient(135deg, rgba(59,130,246,0.15), rgba(59,130,246,0.05))',
              border: '1.5px solid rgba(59,130,246,0.35)',
            }}>
            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
              style={{ background: 'rgba(59,130,246,0.2)', border: '1.5px solid rgba(59,130,246,0.5)' }}>🎮</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-blue-200">フリープレイ</p>
              <p className="text-[10px] text-blue-200/60">報酬なし・練習用・ランクに影響しない</p>
            </div>
            <span className="text-blue-200/40 text-sm">→</span>
          </div>
        </Link>

        {/* Stage grid */}
        <div className="grid grid-cols-2 gap-2.5">
          {STAGES.map((stage, i) => {
            const isCleared = cleared.has(stage.id);
            const unlocked = isUnlocked(stage.id);
            const theme = themeBadge[stage.theme];

            const card = (
              <div className="rounded-xl overflow-hidden p-3 relative h-full"
                style={{
                  background: isCleared
                    ? 'linear-gradient(135deg, rgba(255,215,0,0.12), rgba(255,215,0,0.03))'
                    : unlocked
                      ? 'linear-gradient(135deg, rgba(21,29,59,0.95), rgba(14,20,45,0.95))'
                      : 'rgba(11,17,40,0.6)',
                  border: isCleared
                    ? '1.5px solid rgba(255,215,0,0.5)'
                    : unlocked
                      ? '1.5px solid rgba(255,215,0,0.2)'
                      : '1.5px solid rgba(120,120,140,0.15)',
                  boxShadow: isCleared ? '0 0 12px rgba(255,215,0,0.15)' : '0 2px 12px rgba(0,0,0,0.3)',
                  animationDelay: `${i * 50}ms`,
                  opacity: unlocked ? 1 : 0.55,
                }}>
                {isCleared && (
                  <div className="absolute top-1.5 right-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded"
                    style={{ background: 'rgba(34,197,94,0.2)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.4)' }}>
                    ✓ クリア
                  </div>
                )}
                {!unlocked && (
                  <div className="absolute top-1.5 right-1.5 text-base">🔒</div>
                )}
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-xl font-black" style={{ color: unlocked ? '#ffd700' : 'rgba(255,215,0,0.3)' }}>
                    {stage.id}
                  </span>
                  <div className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                    style={{ background: `${theme.color}20`, color: theme.color, border: `1px solid ${theme.color}40` }}>
                    {theme.label}
                  </div>
                </div>
                <p className="text-[11px] font-bold text-amber-100 leading-snug mb-1">{stage.description}</p>
                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center gap-0.5">
                    <div className="w-3 h-3 rounded-full flex items-center justify-center text-[6px] font-bold"
                      style={{ background: 'linear-gradient(135deg, #ffd700, #f0a500)', color: '#0b1128' }}>A</div>
                    <span className="text-[10px] font-bold" style={{ color: '#ffd700' }}>+{stage.altReward}</span>
                  </div>
                  {stage.title && (
                    <span className="text-[8px] text-amber-200/60">🏆 {stage.title.name}</span>
                  )}
                </div>
                <div className="text-[8px] text-amber-200/30 mt-1">NPC Lv {Math.round(stage.aiRating / 100) * 10}</div>
              </div>
            );

            if (!unlocked) return <div key={stage.id}>{card}</div>;
            return (
              <Link key={stage.id} href={`/games/knowledge-challenger/stage/${stage.id}`}>
                <div className="cursor-pointer active:scale-[0.97] transition-transform h-full">{card}</div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
