/**
 * QuestBoardPage - デッキ別クエストボード
 * 6デッキ × 4難易度のクエスト進捗を表示
 * 難易度3クリアでデッキ解放、難易度4クリアでSSR解放
 */
import { useState, useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import {
  type DeckKey,
  type QuestDifficulty,
  DECK_KEYS,
  QUEST_DIFFICULTIES,
  DECK_QUEST_INFO,
  DIFFICULTY_INFO,
  CLEAR_THRESHOLD,
  isDifficultyUnlocked,
  isDeckUnlocked,
  isSSRUnlocked,
  loadQuestProgress,
  type QuestProgressData,
} from '@/lib/questProgress';

export default function QuestBoardPage() {
  const [, navigate] = useLocation();
  const [progress, setProgress] = useState<QuestProgressData>(loadQuestProgress);

  // Reload on focus (in case quiz was completed in another tab)
  useEffect(() => {
    const onFocus = () => setProgress(loadQuestProgress());
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  // Scroll into view when arriving from deck-select unlock button
  useEffect(() => {
    let id: string | null = null;
    try {
      id = sessionStorage.getItem('questBoardFocus');
      if (id) sessionStorage.removeItem('questBoardFocus');
    } catch { /* ignore */ }
    if (!id) return;
    // Defer to let the list render
    requestAnimationFrame(() => {
      const el = document.getElementById(id!);
      if (!el) return;
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.animate(
        [
          { boxShadow: '0 0 0 0 rgba(255,215,0,0)' },
          { boxShadow: '0 0 20px 4px rgba(255,215,0,0.55)' },
          { boxShadow: '0 0 0 0 rgba(255,215,0,0)' },
        ],
        { duration: 1800, iterations: 2 },
      );
    });
  }, []);

  return (
    <div className="relative min-h-full px-3 pt-5 pb-24" style={{ background: 'linear-gradient(180deg, #0b1128 0%, #151d3b 50%, #0e1430 100%)' }}>
      <div className="text-center mb-5">
        <span className="text-3xl block mb-1.5">📋</span>
        <h1 className="text-lg font-bold mb-0.5" style={{ color: '#ffd700', textShadow: '0 0 15px rgba(255,215,0,0.3)' }}>
          クエストボード
        </h1>
        <p className="text-amber-200/50 text-[11px]">クイズをクリアしてデッキとSSRカードを解放しよう！</p>
      </div>

      <div className="space-y-2.5 max-w-md mx-auto">
        {DECK_KEYS.map((deckKey) => {
          const info = DECK_QUEST_INFO[deckKey];
          const deckProgress = progress[deckKey];
          const deckUnlocked = isDeckUnlocked(progress, deckKey);
          const ssrUnlocked = isSSRUnlocked(progress, deckKey);

          return (
            <div
              key={deckKey}
              id={`deck-${deckKey}`}
              className="rounded-xl overflow-hidden scroll-mt-6"
              style={{
                background: 'linear-gradient(135deg, rgba(21,29,59,0.95), rgba(14,20,45,0.95))',
                border: `1.5px solid ${info.color}30`,
                boxShadow: `0 3px 12px rgba(0,0,0,0.3), inset 0 0 20px ${info.color}06`,
              }}
            >
              {/* Deck Header */}
              <div className="px-3.5 pt-3 pb-1.5 flex items-center gap-3">
                <span className="text-xl">{info.icon}</span>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold text-amber-100">{info.name}</h3>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {deckUnlocked && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded font-bold" style={{ background: 'rgba(34,197,94,0.2)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)' }}>
                        デッキ解放済
                      </span>
                    )}
                    {ssrUnlocked && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded font-bold" style={{ background: 'rgba(255,215,0,0.15)', color: '#ffd700', border: '1px solid rgba(255,215,0,0.3)' }}>
                        SSR解放済
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Difficulty Row */}
              <div className="px-3 pb-3 flex gap-1.5">
                {QUEST_DIFFICULTIES.map((diff) => {
                  const diffInfo = DIFFICULTY_INFO[diff];
                  const dp = deckProgress[diff];
                  const unlocked = isDifficultyUnlocked(progress, deckKey, diff);
                  const cleared = dp.cleared;
                  const progressPct = Math.min(100, (dp.correctCount / CLEAR_THRESHOLD) * 100);

                  // Status icon
                  let statusIcon = '🔒';
                  let statusLabel = '';
                  if (!unlocked) {
                    statusIcon = '🔒';
                  } else if (cleared) {
                    statusIcon = '✅';
                  } else if (dp.correctCount > 0) {
                    statusIcon = '▶️';
                    statusLabel = `${dp.correctCount}/${CLEAR_THRESHOLD}`;
                  } else {
                    statusIcon = '▶️';
                  }

                  // Special labels for master/legend
                  const isRewardDiff = diff === 'master' || diff === 'legend';
                  const rewardLabel = diff === 'master' ? 'デッキ解放' : diff === 'legend' ? 'SSR解放' : '';

                  return (
                    <button
                      key={diff}
                      disabled={!unlocked}
                      onClick={() => unlocked && navigate(`/games/quiz/${deckKey}/${diff}`)}
                      className="flex-1 rounded-lg p-1.5 text-center transition-all active:scale-95"
                      style={{
                        background: cleared
                          ? `${diffInfo.color}15`
                          : unlocked
                          ? 'rgba(255,255,255,0.04)'
                          : 'rgba(0,0,0,0.2)',
                        border: cleared
                          ? `1.5px solid ${diffInfo.color}50`
                          : unlocked
                          ? `1px solid ${diffInfo.color}30`
                          : '1px solid rgba(255,255,255,0.05)',
                        opacity: unlocked ? 1 : 0.4,
                        cursor: unlocked ? 'pointer' : 'not-allowed',
                      }}
                    >
                      {/* Stars */}
                      <div className="flex justify-center gap-0 mb-0.5">
                        {diff === 'legend' ? (
                          <span className="text-xs">👑</span>
                        ) : (
                          Array.from({ length: diffInfo.stars }).map((_, si) => (
                            <span key={si} className="text-[10px]" style={{ color: cleared ? diffInfo.color : 'rgba(255,255,255,0.3)' }}>⭐</span>
                          ))
                        )}
                      </div>

                      {/* Status */}
                      <div className="text-xs mb-0.5">{statusIcon}</div>

                      {/* Progress count */}
                      {unlocked && !cleared && dp.correctCount > 0 && (
                        <div className="text-[8px] font-bold" style={{ color: diffInfo.color }}>{statusLabel}</div>
                      )}

                      {/* Progress bar */}
                      {unlocked && !cleared && (
                        <div className="h-1 rounded-full mt-0.5 mx-1" style={{ background: 'rgba(255,255,255,0.08)' }}>
                          <div className="h-full rounded-full transition-all" style={{ width: `${progressPct}%`, background: diffInfo.color }} />
                        </div>
                      )}

                      {/* Reward label */}
                      {isRewardDiff && (
                        <div className="text-[7px] mt-0.5 font-bold" style={{ color: cleared ? diffInfo.color : 'rgba(255,255,255,0.2)' }}>
                          {rewardLabel}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Progress subtitle */}
              {(() => {
                const masterDp = deckProgress.master;
                const challengerDp = deckProgress.challenger;
                const beginnerDp = deckProgress.beginner;
                let subtitle = '';
                if (!masterDp.cleared && isDifficultyUnlocked(progress, deckKey, 'master')) {
                  const remain = CLEAR_THRESHOLD - masterDp.correctCount;
                  subtitle = `デッキ解放まであと${remain}問！`;
                } else if (!challengerDp.cleared && isDifficultyUnlocked(progress, deckKey, 'challenger')) {
                  subtitle = 'チャレンジャー挑戦中';
                } else if (!beginnerDp.cleared) {
                  subtitle = 'ビギナーに挑戦しよう！';
                } else if (masterDp.cleared && !deckProgress.legend.cleared) {
                  const remain = CLEAR_THRESHOLD - deckProgress.legend.correctCount;
                  subtitle = `SSR解放まであと${remain}問！`;
                }
                if (!subtitle) return null;
                return (
                  <div className="px-3.5 pb-2.5 -mt-1">
                    <p className="text-[10px] text-amber-200/40">{subtitle}</p>
                  </div>
                );
              })()}
            </div>
          );
        })}
      </div>

      <div className="mt-5 max-w-md mx-auto">
        <Link href="/games">
          <button className="text-amber-200/35 text-xs hover:text-amber-200/60 transition-colors py-2 block w-full text-center">
            ← ゲーム一覧へ戻る
          </button>
        </Link>
      </div>
    </div>
  );
}
