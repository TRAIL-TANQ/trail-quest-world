/*
 * StageSelectPage: ソロモード ステージ選択画面
 *
 * 10ステージ。クリア済み/挑戦可能/ロック状態を区別。
 * ★ボスステージ（5,10）は背景を赤く。各ステージにNPCテーマアイコン表示。
 */
import { Link } from 'wouter';
import { STAGES, shortSpecialRuleTags } from '@/lib/stages';
import { useStageProgressStore } from '@/lib/stageProgressStore';
import { IMAGES } from '@/lib/constants';

export default function StageSelectPage() {
  const cleared = useStageProgressStore((s) => s.clearedIds);
  const highest = useStageProgressStore((s) => s.highestClearedStage());

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
            const isBoss = stage.isBoss;

            // Determine special rule display text
            const ruleText = unlocked ? stage.description : '???';

            const card = (
              <div className="rounded-xl overflow-hidden p-3 relative h-full"
                style={{
                  background: isCleared
                    ? 'linear-gradient(135deg, rgba(255,215,0,0.12), rgba(255,215,0,0.03))'
                    : isBoss && unlocked
                      ? 'linear-gradient(135deg, rgba(239,68,68,0.18), rgba(139,0,0,0.12))'
                      : unlocked
                        ? 'linear-gradient(135deg, rgba(21,29,59,0.95), rgba(14,20,45,0.95))'
                        : 'rgba(11,17,40,0.6)',
                  border: isCleared
                    ? '1.5px solid rgba(255,215,0,0.5)'
                    : isBoss && unlocked
                      ? '2px solid rgba(239,68,68,0.6)'
                      : unlocked
                        ? '1.5px solid rgba(255,215,0,0.2)'
                        : '1.5px solid rgba(120,120,140,0.15)',
                  boxShadow: isCleared
                    ? '0 0 12px rgba(255,215,0,0.15)'
                    : isBoss && unlocked
                      ? '0 0 16px rgba(239,68,68,0.2)'
                      : '0 2px 12px rgba(0,0,0,0.3)',
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
                  <span className="text-lg">{stage.npcThemeIcon}</span>
                  {isBoss && unlocked && (
                    <span className="text-[8px] font-bold px-1 py-0.5 rounded" style={{ background: 'rgba(239,68,68,0.3)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.5)' }}>
                      ★BOSS
                    </span>
                  )}
                </div>
                <p className="text-[12px] font-bold text-amber-100 leading-snug mb-0.5">{stage.name}</p>
                <p className="text-[10px] text-amber-200/60 leading-snug mb-1">{ruleText}</p>
                {unlocked && (() => {
                  const tags = shortSpecialRuleTags(stage.rules);
                  if (tags.length === 0) return null;
                  return (
                    <div className="flex flex-wrap gap-1 mb-1.5">
                      {tags.map((t, ti) => (
                        <span
                          key={ti}
                          className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                          style={{ background: 'rgba(250,204,21,0.12)', color: '#facc15', border: '1px solid rgba(250,204,21,0.35)' }}
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  );
                })()}
                <div className="flex items-center justify-between mt-auto">
                  <div className="flex items-center gap-0.5">
                    <div className="w-3 h-3 rounded-full flex items-center justify-center text-[6px] font-bold"
                      style={{ background: 'linear-gradient(135deg, #ffd700, #f0a500)', color: '#0b1128' }}>A</div>
                    <span className="text-[10px] font-bold" style={{ color: '#ffd700' }}>
                      {unlocked ? `+${stage.altReward}` : '???'}
                    </span>
                  </div>
                  {stage.title && unlocked && (
                    <span className="text-[8px] text-amber-200/60">🏆 {stage.title.name}</span>
                  )}
                  {!unlocked && stage.specialCard && (
                    <span className="text-[8px] text-amber-200/30">🃏 ???</span>
                  )}
                  {unlocked && stage.specialCard && (
                    <span className="text-[8px] text-amber-200/50">🃏 {stage.specialCard.name}</span>
                  )}
                </div>
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
