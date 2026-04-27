/**
 * TimeAttackPage — ⚡ タイムアタック学習ゲーム
 * 制限時間内に何問正解できるかのスコアアタック。ALT稼ぎ用。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useRoute } from 'wouter';
import { getQuizPoolForMode, shuffleQuizChoices, type QuestQuiz } from '@/lib/questQuizData';
import { loadQuestProgress, isDeckUnlocked, isDeckAvailable, DECK_KEYS, type DeckKey, type QuestDifficulty } from '@/lib/questProgress';
import { useUserStore } from '@/lib/stores';
import { playSuccess, playError, playDefeat, playTap } from '@/lib/sfx';
import { supabase } from '@/lib/supabase';
import { fetchChildStatus } from '@/lib/quizService';

// ===== Config =====

type TADifficulty = 'easy' | 'normal' | 'hard' | 'legend';

const DIFFICULTY_CONFIG: Record<TADifficulty, {
  label: string; icon: string; color: string; timeSeconds: number;
  questDiff: QuestDifficulty; altPerCorrect: number;
  comboBonus5: number; comboBonus10: number;
  unlockLabel: string;
}> = {
  easy:   { label: 'かんたん',   icon: '🟢', color: '#22c55e', timeSeconds: 60, questDiff: 'beginner',   altPerCorrect: 1, comboBonus5: 3,  comboBonus10: 5,  unlockLabel: '' },
  normal: { label: 'ふつう',     icon: '🟡', color: '#eab308', timeSeconds: 60, questDiff: 'challenger', altPerCorrect: 2, comboBonus5: 5,  comboBonus10: 10, unlockLabel: 'かんたんで10問正解で解放' },
  hard:   { label: 'むずかしい', icon: '🔴', color: '#ef4444', timeSeconds: 45, questDiff: 'master',     altPerCorrect: 3, comboBonus5: 8,  comboBonus10: 15, unlockLabel: 'ふつうで15問正解で解放' },
  legend: { label: 'レジェンド', icon: '👑', color: '#ffd700', timeSeconds: 30, questDiff: 'legend',     altPerCorrect: 5, comboBonus5: 10, comboBonus10: 20, unlockLabel: 'むずかしいで15問正解で解放' },
};

const TA_DIFFICULTIES: TADifficulty[] = ['easy', 'normal', 'hard', 'legend'];
const DAILY_LIMIT = 3;

// ===== Helpers =====

function getTodayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function getDailyCount(childId: string, diff: TADifficulty): number {
  try {
    return parseInt(localStorage.getItem(`time_attack_${childId}_${diff}_${getTodayKey()}`) || '0', 10);
  } catch { return 0; }
}

function incrementDailyCount(childId: string, diff: TADifficulty): void {
  const key = `time_attack_${childId}_${diff}_${getTodayKey()}`;
  try {
    const cur = parseInt(localStorage.getItem(key) || '0', 10);
    localStorage.setItem(key, String(cur + 1));
  } catch { /* */ }
}

function getBestScore(childId: string, diff: TADifficulty): number {
  try {
    return parseInt(localStorage.getItem(`ta_best_${childId}_${diff}`) || '0', 10);
  } catch { return 0; }
}

function saveBestScore(childId: string, diff: TADifficulty, score: number): boolean {
  const prev = getBestScore(childId, diff);
  if (score > prev) {
    try { localStorage.setItem(`ta_best_${childId}_${diff}`, String(score)); } catch { /* */ }
    return true;
  }
  return false;
}

function isDiffUnlocked(childId: string, diff: TADifficulty): boolean {
  if (diff === 'easy') return true;
  const prev = diff === 'normal' ? 'easy' : diff === 'hard' ? 'normal' : 'hard';
  const threshold = diff === 'normal' ? 10 : 15;
  return getBestScore(childId, prev) >= threshold;
}

function buildQuizPool(questDiff: QuestDifficulty): QuestQuiz[] {
  const progress = loadQuestProgress();
  const pool: QuestQuiz[] = [];
  for (const dk of DECK_KEYS) {
    if (!isDeckAvailable(dk)) continue; // 準備中デッキからは出題しない
    if (!isDeckUnlocked(progress, dk)) continue;
    pool.push(...getQuizPoolForMode(dk, questDiff));
  }
  if (pool.length === 0) {
    for (const dk of DECK_KEYS) {
      if (!isDeckAvailable(dk)) continue;
      pool.push(...getQuizPoolForMode(dk, 'beginner'));
    }
  }
  return pool.map(shuffleQuizChoices);
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ===== Component =====

type Phase = 'select' | 'playing' | 'result';

export default function TimeAttackPage() {
  const [, navigate] = useLocation();
  const [, params] = useRoute('/games/time-attack/play/:difficulty');
  const urlDiff = params?.difficulty as TADifficulty | undefined;

  const userId = useUserStore((s) => s.user.id);
  const addTotalAlt = useUserStore((s) => s.addTotalAlt);

  const [phase, setPhase] = useState<Phase>(urlDiff ? 'playing' : 'select');
  const [difficulty, setDifficulty] = useState<TADifficulty>(urlDiff ?? 'easy');

  // Play state
  const [pool, setPool] = useState<QuestQuiz[]>([]);
  const [qIndex, setQIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [totalAttempted, setTotalAttempted] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [altEarned, setAltEarned] = useState(0);
  const [timeLeft, setTimeLeft] = useState(60);
  const [selected, setSelected] = useState<number | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [isNewBest, setIsNewBest] = useState(false);
  const [comboFlash, setComboFlash] = useState<string | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const earnAlt = useRef(true);
  const savedRef = useRef(false);

  const config = DIFFICULTY_CONFIG[difficulty];
  const q = pool[qIndex % Math.max(pool.length, 1)] ?? null;

  const startGame = useCallback((diff: TADifficulty) => {
    const cfg = DIFFICULTY_CONFIG[diff];
    const quizPool = shuffle(buildQuizPool(cfg.questDiff));
    const dailyCount = getDailyCount(userId, diff);
    setDifficulty(diff);
    setPool(quizPool);
    setQIndex(0);
    setScore(0);
    setTotalAttempted(0);
    setCombo(0);
    setMaxCombo(0);
    setAltEarned(0);
    setTimeLeft(cfg.timeSeconds);
    setSelected(null);
    setShowFeedback(false);
    setIsNewBest(false);
    setComboFlash(null);
    earnAlt.current = dailyCount < DAILY_LIMIT;
    savedRef.current = false;
    setPhase('playing');
  }, [userId]);

  // Auto-start if URL has difficulty
  useEffect(() => {
    if (urlDiff && TA_DIFFICULTIES.includes(urlDiff) && phase === 'playing' && pool.length === 0) {
      startGame(urlDiff);
    }
  }, [urlDiff, phase, pool.length, startGame]);

  // Timer
  useEffect(() => {
    if (phase !== 'playing') return;
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current!);
          timerRef.current = null;
          setPhase('result');
          playDefeat();
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [phase]);

  // Save result
  useEffect(() => {
    if (phase !== 'result' || savedRef.current) return;
    savedRef.current = true;

    if (earnAlt.current) {
      incrementDailyCount(userId, difficulty);
      if (altEarned > 0) {
        addTotalAlt(altEarned);
      }
    }

    const newBest = saveBestScore(userId, difficulty, score);
    setIsNewBest(newBest);

    // Supabase record
    if (userId && !userId.startsWith('user-') && userId !== 'guest') {
      void supabase.from('time_attack_scores').insert({
        child_id: userId,
        difficulty,
        score,
        max_combo: maxCombo,
        accuracy: totalAttempted > 0 ? score / totalAttempted : 0,
        alt_earned: earnAlt.current ? altEarned : 0,
      });
    }
  }, [phase, userId, difficulty, score, totalAttempted, maxCombo, altEarned, addTotalAlt]);

  const handleAnswer = useCallback((idx: number) => {
    if (selected !== null || !q || phase !== 'playing') return;
    setSelected(idx);
    setShowFeedback(true);
    setTotalAttempted((t) => t + 1);

    const isCorrect = idx === q.correctIndex;
    if (isCorrect) {
      playSuccess();
      setScore((s) => s + 1);
      const newCombo = combo + 1;
      setCombo(newCombo);
      setMaxCombo((m) => Math.max(m, newCombo));

      if (earnAlt.current) {
        let alt = config.altPerCorrect;
        if (newCombo === 5) { alt += config.comboBonus5; setComboFlash('🔥 5コンボ！'); }
        else if (newCombo === 10) { alt += config.comboBonus10; setComboFlash('🔥🔥 10コンボ！！'); }
        else if (newCombo > 0 && newCombo % 5 === 0) { alt += config.comboBonus5; setComboFlash(`🔥 ${newCombo}コンボ！`); }
        setAltEarned((a) => a + alt);
      }

      setTimeout(() => {
        setSelected(null);
        setShowFeedback(false);
        setComboFlash(null);
        setQIndex((i) => {
          const next = i + 1;
          if (next >= pool.length) { setPool(shuffle(pool)); return 0; }
          return next;
        });
      }, 300);
    } else {
      playError();
      setCombo(0);
      setTimeout(() => {
        setSelected(null);
        setShowFeedback(false);
        setQIndex((i) => {
          const next = i + 1;
          if (next >= pool.length) { setPool(shuffle(pool)); return 0; }
          return next;
        });
      }, 500);
    }
  }, [selected, q, phase, combo, config, pool, earnAlt]);

  // ===== RENDER: Difficulty Select =====
  if (phase === 'select') {
    return (
      <div className="min-h-screen px-4 py-6" style={{ background: 'linear-gradient(180deg, #0b1128 0%, #151d3b 50%, #0e1430 100%)' }}>
        <Link href="/">
          <a className="text-amber-200/40 text-sm mb-4 block">← ホーム</a>
        </Link>
        <div className="text-center mb-6">
          <p className="text-3xl mb-1">⚡</p>
          <h1 className="text-xl font-black" style={{ color: '#ffd700' }}>タイムアタック</h1>
          <p className="text-sm text-amber-200/60 mt-1">制限時間で何問解ける？</p>
        </div>

        <div className="max-w-md mx-auto space-y-3">
          {TA_DIFFICULTIES.map((diff) => {
            const cfg = DIFFICULTY_CONFIG[diff];
            const unlocked = isDiffUnlocked(userId, diff);
            const dailyCount = getDailyCount(userId, diff);
            const best = getBestScore(userId, diff);
            const altRemaining = Math.max(0, DAILY_LIMIT - dailyCount);
            return (
              <button
                key={diff}
                onClick={() => { if (unlocked) { playTap(); startGame(diff); } }}
                disabled={!unlocked}
                className="w-full rounded-xl p-4 text-left active:scale-[0.98] transition-transform"
                style={{
                  background: unlocked
                    ? `linear-gradient(135deg, ${cfg.color}18, ${cfg.color}08)`
                    : 'rgba(60,60,70,0.3)',
                  border: `1.5px solid ${unlocked ? cfg.color + '50' : 'rgba(100,100,110,0.3)'}`,
                  opacity: unlocked ? 1 : 0.6,
                }}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{cfg.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-black" style={{ color: unlocked ? cfg.color : '#888' }}>
                      {cfg.label}
                    </p>
                    <p className="text-[11px] text-amber-200/60">
                      {cfg.timeSeconds}秒 / 1問 +{cfg.altPerCorrect} ALT
                    </p>
                    {unlocked ? (
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-[10px] text-amber-200/50">
                          今日 残り{altRemaining}/{DAILY_LIMIT}回
                        </span>
                        {best > 0 && (
                          <span className="text-[10px] font-bold" style={{ color: '#ffd700' }}>
                            🏆 ベスト: {best}問
                          </span>
                        )}
                      </div>
                    ) : (
                      <p className="text-[10px] text-amber-200/40 mt-1">🔒 {cfg.unlockLabel}</p>
                    )}
                  </div>
                  {unlocked && <span className="text-amber-200/40 text-lg">›</span>}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ===== RENDER: Playing =====
  if (phase === 'playing' && q) {
    const ratio = timeLeft / config.timeSeconds;
    const urgent = timeLeft <= 10;
    const barColor = urgent ? '#ef4444' : config.color;

    return (
      <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(180deg, #0b1128 0%, #151d3b 50%, #0e1430 100%)' }}>
        {/* Header */}
        <div className="px-4 pt-4 pb-2 shrink-0">
          <div className="flex items-center justify-between mb-2">
            <span className="text-lg font-black" style={{ color: config.color }}>⚡ タイムアタック</span>
            <span className="text-xl font-black" style={{ color: urgent ? '#ef4444' : '#ffd700' }}>
              ⏱️ {timeLeft}秒
            </span>
          </div>
          <div className="flex items-center gap-3 mb-2">
            <span className="text-sm text-amber-100 font-bold">正解: {score}問</span>
            {combo >= 3 && (
              <span className="text-sm font-black" style={{ color: '#ff6b6b' }}>
                🔥 {combo}連続
              </span>
            )}
          </div>
          {/* Timer bar */}
          <div className="w-full rounded-full overflow-hidden" style={{ height: 8, background: 'rgba(255,255,255,0.1)' }}>
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${ratio * 100}%`,
                background: `linear-gradient(90deg, ${barColor}, ${barColor}cc)`,
                transition: 'width 1s linear',
              }}
            />
          </div>
        </div>

        {/* Combo flash */}
        {comboFlash && (
          <div className="text-center py-2">
            <span className="text-lg font-black animate-bounce" style={{ color: '#ffd700' }}>{comboFlash}</span>
          </div>
        )}

        {/* Question */}
        <div className="flex-1 flex flex-col justify-center px-4 pb-4 max-w-lg mx-auto w-full">
          <div className="rounded-xl px-4 py-3 mb-5"
            style={{ background: 'rgba(26,31,58,0.6)', borderRadius: 12, borderLeft: '3px solid #ffd700' }}>
            <p className="text-lg font-bold text-white leading-relaxed"
              dangerouslySetInnerHTML={{ __html: q.question }} />
          </div>

          <div className="space-y-3">
            {q.choices.map((choice, i) => {
              const label = ['A', 'B', 'C', 'D'][i];
              let bg = 'rgba(26,31,58,0.8)';
              let border = 'rgba(255,215,0,0.2)';
              let badgeBg = 'rgba(255,215,0,0.2)';
              let badgeColor = '#ffd700';
              let extra = '';

              if (showFeedback) {
                if (i === q.correctIndex) {
                  bg = 'rgba(34,197,94,0.3)'; border = '#22c55e';
                  badgeBg = '#22c55e'; badgeColor = '#fff'; extra = ' ✓';
                } else if (i === selected && i !== q.correctIndex) {
                  bg = 'rgba(239,68,68,0.3)'; border = '#ef4444';
                  badgeBg = '#ef4444'; badgeColor = '#fff'; extra = ' ✗';
                }
              }

              return (
                <button
                  key={i}
                  onClick={() => handleAnswer(i)}
                  disabled={selected !== null}
                  className="w-full flex items-center gap-3 text-left active:scale-[0.97] transition-all"
                  style={{
                    background: bg,
                    backdropFilter: 'blur(10px)',
                    border: `1px solid ${border}`,
                    borderRadius: 12,
                    padding: '14px 18px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                  }}
                >
                  <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shrink-0"
                    style={{ background: badgeBg, color: badgeColor }}>
                    {label}
                  </span>
                  <span className="text-base font-bold text-white flex-1"
                    dangerouslySetInnerHTML={{ __html: choice + extra }} />
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ===== RENDER: Result =====
  if (phase === 'result') {
    const accuracy = totalAttempted > 0 ? Math.round((score / totalAttempted) * 100) : 0;
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6"
        style={{ background: 'linear-gradient(180deg, #0b1128 0%, #151d3b 50%, #0e1430 100%)' }}>
        <div className="text-center max-w-sm w-full">
          <p className="text-3xl mb-2">⚡</p>
          <h1 className="text-xl font-black mb-4" style={{ color: '#ffd700' }}>タイムアップ！</h1>

          <div className="rounded-xl p-5 mb-5"
            style={{ background: 'rgba(26,31,58,0.8)', border: '1.5px solid rgba(255,215,0,0.3)' }}>
            <div className="space-y-3 text-left">
              <div className="flex justify-between">
                <span className="text-amber-200/70">正解</span>
                <span className="font-black text-white">{score}問 / {totalAttempted}問挑戦</span>
              </div>
              <div className="flex justify-between">
                <span className="text-amber-200/70">最高コンボ</span>
                <span className="font-black text-white">{maxCombo}連続 🔥</span>
              </div>
              <div className="flex justify-between">
                <span className="text-amber-200/70">正答率</span>
                <span className="font-black text-white">{accuracy}%</span>
              </div>
              <div className="flex justify-between pt-2" style={{ borderTop: '1px solid rgba(255,215,0,0.2)' }}>
                <span className="text-amber-200/70">獲得ALT</span>
                <span className="font-black text-lg" style={{ color: '#ffd700' }}>
                  {earnAlt.current ? `+${altEarned}` : '0 (制限超過)'}
                </span>
              </div>
            </div>
          </div>

          {isNewBest && (
            <div className="rounded-lg px-4 py-2 mb-4"
              style={{ background: 'rgba(255,215,0,0.15)', border: '1.5px solid rgba(255,215,0,0.5)' }}>
              <p className="text-sm font-black" style={{ color: '#ffd700' }}>🏆 自己ベスト更新！</p>
            </div>
          )}

          <div className="flex flex-col items-center gap-3">
            <button
              onClick={() => startGame(difficulty)}
              className="tappable pulse-btn rounded-xl font-black text-base active:scale-[0.97] transition-transform"
              style={{
                width: '80%', minHeight: 52,
                background: `linear-gradient(135deg, ${config.color}, ${config.color}cc)`,
                color: '#fff',
                boxShadow: `0 4px 16px ${config.color}55`,
              }}>
              ⚡ もう一度
            </button>
            <Link href="/games/time-attack">
              <a className="text-amber-200/50 text-sm">← 難易度選択に戻る</a>
            </Link>
            <Link href="/">
              <a className="text-amber-200/40 text-xs">ホームに戻る</a>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Fallback
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#0b1128' }}>
      <p className="text-amber-200/50">読み込み中...</p>
    </div>
  );
}
