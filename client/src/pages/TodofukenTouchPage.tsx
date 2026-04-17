/**
 * TodofukenTouchPage — 🗾 都道府県タッチ
 *
 * 日本地図に対してタップで都道府県を回答。
 * ★1-★4 は「○○県をタップ！」、★5 は県がハイライトされて4択で県名を答える。
 *
 * 難易度別:
 *   ★1 プール=有名10 / 10問 / 3ミスで終了 / ラベル表示
 *   ★2 プール=主要20+ / 15問 / 2ミスで終了 / ラベル表示
 *   ★3 プール=47 / 20問 / 即死 / ラベル表示
 *   ★4 プール=47（間違えやすい重点） / 20問 / 45秒 / 即死 / ラベル非表示
 *   ★5 プール=47 / 15問 / 30秒 / 即死 / 逆引き（ハイライト→4択）
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'wouter';
import { useUserStore } from '@/lib/stores';
import { playSuccess, playError, playTap, playDefeat, playBattleStart } from '@/lib/sfx';
import { finalizeAltGame, getGameDailyRemaining } from '@/lib/altGameService';
import JapanMap from '@/components/game/JapanMap';
import { PREFECTURES, getPrefecturesByDifficulty, type Prefecture } from '@/data/prefectureData';

type Phase = 'start' | 'playing' | 'result';
type DiffId = 1 | 2 | 3 | 4 | 5;

interface ComboTier { threshold: number; multiplier: number; label: string; }
interface DiffConfig {
  id: DiffId;
  label: string;
  timeSeconds: number;
  missAllowed: number;
  totalQuestions: number;
  altPerCorrect: number;
  comboTiers: ComboTier[];
  showLabels: boolean;
  reverseMode: boolean; // ★5: ハイライト→県名4択
}

const GAME_TYPE = 'todofuken_touch' as const;
const BEST_KEY_PREFIX = 'todofuken_best_';

// ★4で重点的に出題される間違えやすいペア（どちらかをランダム出題）
const TRICKY_IDS = new Set<string>(['saga', 'nagasaki', 'tottori', 'shimane', 'gunma', 'tochigi', 'shiga', 'mie', 'ehime', 'kagawa', 'tokushima', 'kochi']);

const DIFF_CONFIGS: Record<DiffId, DiffConfig> = {
  1: { id: 1, label: 'かんたん',   timeSeconds: 90, missAllowed: 3, totalQuestions: 10, altPerCorrect: 1, showLabels: true,  reverseMode: false, comboTiers: [] },
  2: { id: 2, label: 'ふつう',     timeSeconds: 90, missAllowed: 2, totalQuestions: 15, altPerCorrect: 1, showLabels: true,  reverseMode: false, comboTiers: [
    { threshold: 5, multiplier: 2, label: '🔥 コンボ ×2' },
  ] },
  3: { id: 3, label: 'むずかしい', timeSeconds: 90, missAllowed: 1, totalQuestions: 20, altPerCorrect: 2, showLabels: true,  reverseMode: false, comboTiers: [
    { threshold: 5, multiplier: 2, label: '🔥 コンボ ×2' },
    { threshold: 10, multiplier: 3, label: '⚡ スーパーコンボ ×3' },
  ] },
  4: { id: 4, label: 'ゲキむず',   timeSeconds: 60, missAllowed: 1, totalQuestions: 20, altPerCorrect: 3, showLabels: false, reverseMode: false, comboTiers: [
    { threshold: 5, multiplier: 2, label: '🔥 コンボ ×2' },
    { threshold: 10, multiplier: 3, label: '⚡ スーパーコンボ ×3' },
  ] },
  5: { id: 5, label: '鬼',         timeSeconds: 45, missAllowed: 1, totalQuestions: 15, altPerCorrect: 5, showLabels: false, reverseMode: true, comboTiers: [
    { threshold: 5, multiplier: 2, label: '🔥 コンボ ×2' },
    { threshold: 10, multiplier: 3, label: '⚡ スーパーコンボ ×3' },
    { threshold: 15, multiplier: 5, label: '✨ 伝説コンボ ×5' },
  ] },
};

const DIFF_ORDER: DiffId[] = [1, 2, 3, 4, 5];

function shuffle<T>(a: T[]): T[] {
  const o = a.slice();
  for (let i = o.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [o[i], o[j]] = [o[j], o[i]];
  }
  return o;
}

function pickTarget(pool: Prefecture[], prev: Prefecture | null, diff: DiffId): Prefecture {
  // ★4 ではTRICKY_IDS 優先で30%
  const useTricky = diff === 4 && Math.random() < 0.4;
  let candidates = pool;
  if (useTricky) {
    const t = pool.filter((p) => TRICKY_IDS.has(p.id));
    if (t.length > 0) candidates = t;
  }
  let target = candidates[Math.floor(Math.random() * candidates.length)];
  if (prev && candidates.length > 1) {
    for (let i = 0; i < 10 && target.id === prev.id; i++) {
      target = candidates[Math.floor(Math.random() * candidates.length)];
    }
  }
  return target;
}

function makeReverseChoices(target: Prefecture, pool: Prefecture[]): string[] {
  const others = shuffle(pool.filter((p) => p.id !== target.id)).slice(0, 3);
  return shuffle([target.name, ...others.map((p) => p.name)]);
}

function comboMult(combo: number, tiers: ComboTier[]): number {
  let m = 1;
  for (const t of tiers) if (combo >= t.threshold) m = t.multiplier;
  return m;
}
function tierFor(combo: number, tiers: ComboTier[]): ComboTier | null {
  for (let i = tiers.length - 1; i >= 0; i--) if (combo === tiers[i].threshold) return tiers[i];
  return null;
}
function bestKey(childId: string, diff: DiffId): string { return `${BEST_KEY_PREFIX}${childId}_d${diff}`; }
function getBest(childId: string, diff: DiffId): number {
  try { return parseInt(localStorage.getItem(bestKey(childId, diff)) || '0', 10); } catch { return 0; }
}
function saveBest(childId: string, diff: DiffId, score: number): boolean {
  const prev = getBest(childId, diff);
  if (score > prev) { try { localStorage.setItem(bestKey(childId, diff), String(score)); } catch { /* */ } return true; }
  return false;
}

export default function TodofukenTouchPage() {
  const userId = useUserStore((s) => s.user.id);
  const addTotalAlt = useUserStore((s) => s.addTotalAlt);

  const [phase, setPhase] = useState<Phase>('start');
  const [selectedDiff, setSelectedDiff] = useState<DiffId>(1);
  const [activeDiff, setActiveDiff] = useState<DiffId>(1);
  const [target, setTarget] = useState<Prefecture | null>(null);
  const [reverseChoices, setReverseChoices] = useState<string[]>([]);
  const [score, setScore] = useState(0);
  const [qIndex, setQIndex] = useState(0);
  const [missCount, setMissCount] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [altEarned, setAltEarned] = useState(0);
  const [limited, setLimited] = useState(false);
  const [timeLeft, setTimeLeft] = useState(90);
  const [feedback, setFeedback] = useState<{ id: string; ok: boolean; correctId?: string } | null>(null);
  const [comboFlash, setComboFlash] = useState<string | null>(null);
  const [isNewBest, setIsNewBest] = useState(false);
  const [endReason, setEndReason] = useState<'time' | 'miss' | 'clear' | null>(null);

  const activeCfg = DIFF_CONFIGS[activeDiff];
  const selectedCfg = DIFF_CONFIGS[selectedDiff];
  const pool = useMemo(() => getPrefecturesByDifficulty(activeDiff), [activeDiff]);

  const bestScore = useMemo(() => getBest(userId, selectedDiff), [userId, selectedDiff, phase]);
  const remaining = useMemo(() => getGameDailyRemaining(userId, GAME_TYPE), [userId, phase]);

  const altAccumRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const feedbackTimerRef = useRef<number | null>(null);
  const savedRef = useRef(false);

  const advance = useCallback((prevTarget: Prefecture | null, diff: DiffId) => {
    const nextT = pickTarget(getPrefecturesByDifficulty(diff), prevTarget, diff);
    setTarget(nextT);
    if (DIFF_CONFIGS[diff].reverseMode) {
      setReverseChoices(makeReverseChoices(nextT, PREFECTURES));
    } else {
      setReverseChoices([]);
    }
  }, []);

  const startGame = useCallback(() => {
    playBattleStart();
    const cfg = DIFF_CONFIGS[selectedDiff];
    altAccumRef.current = 0;
    savedRef.current = false;
    setActiveDiff(selectedDiff);
    setScore(0); setQIndex(0); setMissCount(0);
    setCombo(0); setMaxCombo(0);
    setAltEarned(0); setLimited(false);
    setTimeLeft(cfg.timeSeconds);
    setFeedback(null); setComboFlash(null);
    setIsNewBest(false); setEndReason(null);
    advance(null, selectedDiff);
    setPhase('playing');
  }, [selectedDiff, advance]);

  useEffect(() => {
    if (phase !== 'playing') return;
    timerRef.current = window.setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          if (timerRef.current) window.clearInterval(timerRef.current);
          playDefeat();
          setEndReason('time');
          setPhase('result');
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) window.clearInterval(timerRef.current); };
  }, [phase]);

  useEffect(() => {
    if (phase !== 'result' || savedRef.current) return;
    savedRef.current = true;
    const newBest = saveBest(userId, activeDiff, score);
    setIsNewBest(newBest);
    void finalizeAltGame({
      childId: userId,
      gameType: GAME_TYPE,
      difficulty: activeDiff,
      rawAltEarned: altAccumRef.current,
      score,
      maxCombo,
    }).then(({ altEarned: granted, limited: wasLimited }) => {
      if (granted > 0) addTotalAlt(granted);
      setAltEarned(granted);
      setLimited(wasLimited);
    });
  }, [phase, score, userId, activeDiff, maxCombo, addTotalAlt]);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      if (feedbackTimerRef.current) window.clearTimeout(feedbackTimerRef.current);
    };
  }, []);

  const nextQuestion = useCallback((wasCorrect: boolean) => {
    const newScore = wasCorrect ? score + 1 : score;
    const newQIndex = qIndex + 1;
    if (newQIndex >= activeCfg.totalQuestions) {
      setEndReason('clear');
      setPhase('result');
      return;
    }
    setQIndex(newQIndex);
    advance(target, activeDiff);
  }, [score, qIndex, activeCfg, activeDiff, target, advance]);

  const handleCorrect = useCallback(() => {
    playSuccess();
    const cfg = activeCfg;
    const newCombo = combo + 1;
    const mult = comboMult(newCombo, cfg.comboTiers);
    altAccumRef.current += cfg.altPerCorrect * mult;
    setCombo(newCombo);
    setMaxCombo((m) => Math.max(m, newCombo));
    setScore((s) => s + 1);
    const tier = tierFor(newCombo, cfg.comboTiers);
    if (tier) setComboFlash(tier.label);
  }, [combo, activeCfg]);

  const handleIncorrect = useCallback(() => {
    playError();
    setCombo(0);
    setMissCount((m) => m + 1);
  }, []);

  const handleMapTap = useCallback((p: Prefecture) => {
    if (phase !== 'playing' || !target || feedback || activeCfg.reverseMode) return;
    const correct = p.id === target.id;
    if (correct) {
      handleCorrect();
      setFeedback({ id: p.id, ok: true });
      feedbackTimerRef.current = window.setTimeout(() => {
        setFeedback(null);
        setComboFlash(null);
        nextQuestion(true);
      }, 450);
    } else {
      handleIncorrect();
      setFeedback({ id: p.id, ok: false, correctId: target.id });
      const overMiss = missCount + 1 >= activeCfg.missAllowed;
      feedbackTimerRef.current = window.setTimeout(() => {
        setFeedback(null);
        if (overMiss) {
          setEndReason('miss');
          setPhase('result');
        } else {
          nextQuestion(false);
        }
      }, 900);
    }
  }, [phase, target, feedback, activeCfg, handleCorrect, handleIncorrect, missCount, nextQuestion]);

  const handleReverseChoice = useCallback((name: string) => {
    if (phase !== 'playing' || !target || feedback) return;
    const correct = name === target.name;
    if (correct) {
      handleCorrect();
      setFeedback({ id: target.id, ok: true });
      feedbackTimerRef.current = window.setTimeout(() => {
        setFeedback(null);
        setComboFlash(null);
        nextQuestion(true);
      }, 450);
    } else {
      handleIncorrect();
      setFeedback({ id: target.id, ok: false, correctId: target.id });
      const overMiss = missCount + 1 >= activeCfg.missAllowed;
      feedbackTimerRef.current = window.setTimeout(() => {
        setFeedback(null);
        if (overMiss) {
          setEndReason('miss');
          setPhase('result');
        } else {
          nextQuestion(false);
        }
      }, 900);
    }
  }, [phase, target, feedback, handleCorrect, handleIncorrect, missCount, activeCfg, nextQuestion]);

  // ===== Render =====
  if (phase === 'start') {
    return (
      <div className="px-4 pt-6 pb-6 tqw-animate-fadeIn">
        <div className="flex items-center gap-2 mb-4">
          <Link href="/alt-games">
            <button className="text-[12px] px-2 py-1 rounded"
              style={{ background: 'rgba(255,215,0,0.1)', color: 'var(--tqw-gold)', border: '1px solid rgba(255,215,0,0.25)' }}>
              ← もどる
            </button>
          </Link>
        </div>
        <div className="tqw-card-panel rounded-2xl p-6 text-center">
          <div className="text-6xl mb-3">🗾</div>
          <h1 className="text-2xl font-black mb-2 tqw-title-game">都道府県タッチ</h1>
          <p className="text-sm mb-4" style={{ color: 'var(--tqw-text-gray)' }}>
            日本地図で正しい県をタップ！<br />★5 は地図の形から答えるよ
          </p>

          <div className="grid grid-cols-5 gap-1 mb-4">
            {DIFF_ORDER.map((d) => {
              const cfg = DIFF_CONFIGS[d];
              const sel = d === selectedDiff;
              return (
                <button
                  key={d}
                  onClick={() => { playTap(); setSelectedDiff(d); }}
                  className={`rounded-xl py-2 px-1 transition-all active:scale-95 ${sel ? 'tqw-btn-gold' : ''}`}
                  style={sel ? { minHeight: 56 } : {
                    minHeight: 56, background: 'rgba(255,255,255,0.04)',
                    border: '1.5px solid rgba(255,215,0,0.15)', color: 'rgba(255,255,255,0.45)',
                  }}
                >
                  <div className="text-[11px] font-black leading-none mb-0.5">{'★'.repeat(d)}</div>
                  <div className="text-[9px] font-bold leading-tight">{cfg.label}</div>
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-2 gap-1.5 mb-4 text-[10px]">
            <div className="rounded-lg py-1.5" style={{ background: 'rgba(255,215,0,0.06)', border: '1px solid rgba(255,215,0,0.15)' }}>
              <div style={{ color: 'var(--tqw-text-gray)' }}>時間/出題数</div>
              <div className="text-sm font-black" style={{ color: 'var(--tqw-gold)' }}>{selectedCfg.timeSeconds}秒 / {selectedCfg.totalQuestions}問</div>
            </div>
            <div className="rounded-lg py-1.5" style={{ background: 'rgba(255,215,0,0.06)', border: '1px solid rgba(255,215,0,0.15)' }}>
              <div style={{ color: 'var(--tqw-text-gray)' }}>ミス許容</div>
              <div className="text-sm font-black" style={{ color: 'var(--tqw-gold)' }}>{selectedCfg.missAllowed === 1 ? '即死' : `${selectedCfg.missAllowed}回`}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 mb-5 text-[12px]">
            <div className="rounded-lg p-3" style={{ background: 'rgba(255,215,0,0.08)', border: '1px solid rgba(255,215,0,0.2)' }}>
              <div style={{ color: 'var(--tqw-text-gray)' }}>ハイスコア</div>
              <div className="text-lg font-black" style={{ color: 'var(--tqw-gold)' }}>{bestScore} 問</div>
            </div>
            <div className="rounded-lg p-3" style={{ background: 'rgba(255,215,0,0.08)', border: '1px solid rgba(255,215,0,0.2)' }}>
              <div style={{ color: 'var(--tqw-text-gray)' }}>今日の残り</div>
              <div className="text-lg font-black" style={{ color: remaining > 0 ? 'var(--tqw-gold)' : '#ef4444' }}>
                {remaining}/5 回
              </div>
            </div>
          </div>
          {remaining === 0 && (
            <div className="text-[11px] mb-3 rounded-lg p-2" style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>
              今日のALT獲得は終了。練習プレイは可能！
            </div>
          )}
          <button
            onClick={startGame}
            className="tqw-btn-battle w-full py-4 rounded-xl text-lg font-black"
            style={{ minHeight: 56 }}
          >
            スタート！
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'playing' && target) {
    const timePct = (timeLeft / activeCfg.timeSeconds) * 100;
    const timeColor = timeLeft > activeCfg.timeSeconds * 0.5 ? '#22c55e' : timeLeft > activeCfg.timeSeconds * 0.2 ? '#eab308' : '#ef4444';
    const lives = activeCfg.missAllowed - missCount;
    return (
      <div className="px-3 pt-3 pb-3 min-h-[calc(100vh-140px)]">
        <div className="flex items-center justify-between mb-2 text-[11px]">
          <div className="tqw-hud-pill"><span className="hud-label">{'★'.repeat(activeDiff)}</span></div>
          <div className="tqw-hud-pill"><span className="hud-label">{qIndex + 1}/{activeCfg.totalQuestions}</span></div>
          <div className="tqw-hud-pill"><span className="hud-label">正解</span><span className="hud-value">{score}</span></div>
          <div className="tqw-hud-pill">
            <span className="hud-label">ライフ</span>
            <span className="hud-value" style={{ color: lives <= 1 ? '#ef4444' : 'var(--tqw-gold)' }}>
              {activeCfg.missAllowed === 1 ? '一撃' : `${'♥'.repeat(Math.max(0, lives))}`}
            </span>
          </div>
        </div>

        <div className="w-full h-2 rounded-full overflow-hidden mb-2"
          style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,215,0,0.15)' }}
        >
          <div className="h-full rounded-full transition-all duration-300"
            style={{ width: `${timePct}%`, background: `linear-gradient(90deg, ${timeColor}, ${timeColor}cc)` }}
          />
        </div>

        <div className="text-center mb-2 font-black text-xl" style={{ color: 'var(--tqw-gold)', textShadow: '0 0 10px rgba(255,215,0,0.3)' }}>
          {activeCfg.reverseMode ? 'この県はどこ？' : `${target.name} をタップ！`}
        </div>

        {comboFlash && (
          <div className="fixed left-1/2 -translate-x-1/2 top-1/3 z-40 pointer-events-none animate-pulse">
            <div className="text-2xl font-black px-4 py-2 rounded-2xl"
              style={{
                background: 'linear-gradient(135deg, rgba(255,215,0,0.25), rgba(255,100,0,0.25))',
                color: 'var(--tqw-gold)', border: '2px solid rgba(255,215,0,0.5)',
                boxShadow: '0 0 30px rgba(255,215,0,0.6)', textShadow: '0 0 10px rgba(255,215,0,0.8)',
              }}
            >{comboFlash}</div>
          </div>
        )}

        <JapanMap
          highlightId={activeCfg.reverseMode ? target.id : undefined}
          feedbackId={feedback?.id}
          feedbackState={feedback?.ok ? 'correct' : feedback ? 'wrong' : undefined}
          correctId={feedback?.ok === false ? feedback.correctId : undefined}
          showLabels={activeCfg.showLabels}
          onTap={activeCfg.reverseMode ? undefined : handleMapTap}
          disabled={!!feedback || activeCfg.reverseMode}
        />

        {activeCfg.reverseMode && (
          <div className="grid grid-cols-2 gap-2 mt-3">
            {reverseChoices.map((name) => {
              const isCorrectChoice = feedback?.ok && name === target.name;
              const isWrongChoice = feedback && !feedback.ok && name === target.name;
              return (
                <button
                  key={name}
                  onClick={() => handleReverseChoice(name)}
                  disabled={!!feedback}
                  className="rounded-xl py-3 px-3 text-sm font-black transition-all active:scale-95"
                  style={{
                    background: isCorrectChoice ? 'rgba(34,197,94,0.3)' : isWrongChoice ? 'rgba(34,197,94,0.3)' : 'linear-gradient(180deg, rgba(30,40,70,0.9), rgba(15,20,40,0.95))',
                    color: '#fff',
                    border: isCorrectChoice ? '2px solid #22c55e' : '1.5px solid rgba(255,215,0,0.25)',
                    minHeight: 48,
                  }}
                >
                  {name}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // Result
  return (
    <div className="px-4 pt-6 pb-6 tqw-animate-fadeIn">
      <div className="tqw-card-panel rounded-2xl p-6 text-center">
        <div className="text-5xl mb-2">{endReason === 'miss' ? '💥' : endReason === 'clear' ? '🎉' : '🏁'}</div>
        <h1 className="text-xl font-black mb-1 tqw-title-game">
          {endReason === 'miss' ? 'ゲームオーバー' : endReason === 'clear' ? 'クリア！' : 'タイムアップ'}
        </h1>
        <div className="text-[12px] mb-4" style={{ color: 'var(--tqw-gold)' }}>
          {'★'.repeat(activeDiff)} {activeCfg.label}
        </div>

        <div className="grid grid-cols-2 gap-2 mb-4 text-[12px]">
          <div className="rounded-lg p-3" style={{ background: 'rgba(255,215,0,0.08)', border: '1px solid rgba(255,215,0,0.2)' }}>
            <div style={{ color: 'var(--tqw-text-gray)' }}>正解</div>
            <div className="text-2xl font-black" style={{ color: 'var(--tqw-gold)' }}>{score} / {activeCfg.totalQuestions}</div>
          </div>
          <div className="rounded-lg p-3" style={{ background: 'rgba(255,215,0,0.08)', border: '1px solid rgba(255,215,0,0.2)' }}>
            <div style={{ color: 'var(--tqw-text-gray)' }}>最大コンボ</div>
            <div className="text-2xl font-black" style={{ color: 'var(--tqw-gold)' }}>{maxCombo}</div>
          </div>
          <div className="rounded-lg p-3 col-span-2" style={{ background: 'rgba(255,215,0,0.08)', border: '1px solid rgba(255,215,0,0.2)' }}>
            <div style={{ color: 'var(--tqw-text-gray)' }}>獲得ALT</div>
            <div className="text-2xl font-black" style={{ color: altEarned > 0 ? 'var(--tqw-gold)' : '#888' }}>+{altEarned}</div>
          </div>
        </div>

        {isNewBest && (
          <div className="text-sm font-black mb-3" style={{ color: '#ffe066', textShadow: '0 0 8px rgba(255,215,0,0.5)' }}>
            ✨ {'★'.repeat(activeDiff)} のハイスコア更新！
          </div>
        )}
        {limited && (
          <div className="text-[11px] mb-3 rounded-lg p-2" style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>
            今日のALT獲得上限に達しているよ（練習プレイ）
          </div>
        )}

        <div className="flex gap-2">
          <button onClick={startGame} className="tqw-btn-battle flex-1 py-3 rounded-xl text-base font-black" style={{ minHeight: 48 }}>
            もう一回
          </button>
          <Link href="/alt-games" className="flex-1">
            <button className="tqw-btn-quest w-full py-3 rounded-xl text-base font-black" style={{ minHeight: 48 }}>
              もどる
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}
