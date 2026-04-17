/**
 * QuestLearningUnitPage — /quest/:deckKey
 * 上: 難易度タブ + 進捗
 * 中: 学習カードカルーセル（50vh、1枚ずつスナップスクロール、左右ボタン+ドット）
 * 下: クイズ（4択、5問正解でデッキ解放演出）
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useRoute } from 'wouter';
import { getQuestUnit, getLearningCards, type LearningCard } from '@/lib/questUnits';
import {
  loadQuestProgress,
  saveQuestProgress,
  recordQuizResult,
  isDeckUnlocked,
  isSSRUnlocked,
  isDifficultyUnlocked,
  DECK_QUEST_INFO,
  isDeckAvailable,
  DIFFICULTY_INFO,
  DECK_SSR_CARDS,
  QUEST_DIFFICULTIES,
  CLEAR_THRESHOLD,
  type DeckKey,
  type QuestDifficulty,
  type QuestProgressData,
} from '@/lib/questProgress';
import { QUEST_QUIZ_DATA, type QuestQuiz } from '@/lib/questQuizData';
import { processQuizResult, fetchChildStatus } from '@/lib/quizService';
import { useUserStore, useCollectionStore } from '@/lib/stores';
import { getStarterDeckCardNames } from '@/lib/myDecks';
import { COLLECTION_CARDS } from '@/lib/cardData';
import { supabase } from '@/lib/supabase';

const DIFFICULTY_INT: Record<QuestDifficulty, number> = {
  beginner: 1, challenger: 2, master: 3, legend: 4,
};

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, '');
}

/** Fire-and-forget quiz_history insert (skip guest/admin) */
async function logQuizHistory(params: {
  childId: string;
  deckKey: string;
  difficulty: QuestDifficulty;
  questionText: string;
  selectedAnswer: string;
  correctAnswer: string;
  correct: boolean;
}): Promise<void> {
  const { childId } = params;
  if (!childId || childId.startsWith('user-') || childId === 'admin' || childId === 'guest') return;
  try {
    await supabase.from('quiz_history').insert({
      child_id: childId,
      deck_key: params.deckKey,
      difficulty: DIFFICULTY_INT[params.difficulty],
      question_text: params.questionText,
      selected_answer: params.selectedAnswer,
      correct_answer: params.correctAnswer,
      correct: params.correct,
    });
  } catch { /* offline / table missing — ignore */ }
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function QuestLearningUnitPage() {
  const [, navigate] = useLocation();
  const [, params] = useRoute('/quest/:deckKey');
  const deckKey = (params?.deckKey ?? '') as DeckKey;
  const unit = getQuestUnit(deckKey);
  const info = unit ? DECK_QUEST_INFO[deckKey] : null;

  const userId = useUserStore((s) => s.user.id);
  const addTotalAlt = useUserStore((s) => s.addTotalAlt);
  const addCollectionCards = useCollectionStore((s) => s.addCards);

  const [progress, setProgress] = useState<QuestProgressData>(loadQuestProgress);
  const [difficulty, setDifficulty] = useState<QuestDifficulty>('beginner');

  useEffect(() => {
    if (!unit) return;
    const p = loadQuestProgress();
    setProgress(p);
    for (const d of QUEST_DIFFICULTIES) {
      if (isDifficultyUnlocked(p, deckKey, d) && !p[deckKey][d].cleared) {
        setDifficulty(d);
        return;
      }
    }
    setDifficulty('beginner');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deckKey]);

  // Quiz state
  const [pool, setPool] = useState<QuestQuiz[]>([]);
  const [qIndex, setQIndex] = useState(0);
  const [sessionCorrect, setSessionCorrect] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [timer, setTimer] = useState<number>(999);
  const [correctFlash, setCorrectFlash] = useState(false);
  const [wrongFlash, setWrongFlash] = useState(false);
  const [deckJustUnlocked, setDeckJustUnlocked] = useState(false);
  const [ssrJustUnlocked, setSsrJustUnlocked] = useState(false);
  const [altBalance, setAltBalance] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const savedRef = useRef(false);
  const quizRef = useRef<HTMLDivElement | null>(null);

  const diffInfo = DIFFICULTY_INFO[difficulty];
  const timeLimit = diffInfo.timeLimit;

  useEffect(() => {
    if (!unit) return;
    const raw = QUEST_QUIZ_DATA[deckKey]?.[difficulty] || [];
    setPool(shuffle(raw));
    setQIndex(0);
    setSessionCorrect(0);
    setSelected(null);
    setShowFeedback(false);
    setTimer(timeLimit ?? 999);
    setDeckJustUnlocked(false);
    setSsrJustUnlocked(false);
    savedRef.current = false;
  }, [deckKey, difficulty, unit, timeLimit]);

  useEffect(() => {
    fetchChildStatus(userId).then((s) => { if (s) setAltBalance(s.alt_points); });
  }, [userId]);

  const cleared = sessionCorrect >= CLEAR_THRESHOLD;

  useEffect(() => {
    if (!cleared || savedRef.current || !unit) return;
    savedRef.current = true;
    const old = loadQuestProgress();
    const wasDeck = isDeckUnlocked(old, deckKey);
    const wasSSR = isSSRUnlocked(old, deckKey);
    const next = recordQuizResult(old, deckKey, difficulty, CLEAR_THRESHOLD);
    saveQuestProgress(next);
    setProgress(next);
    if (!wasDeck && isDeckUnlocked(next, deckKey)) {
      setDeckJustUnlocked(true);
      // デッキ解放時: そのデッキのカードをコレクションに追加
      const deckCardNames = getStarterDeckCardNames(deckKey);
      const deckCardIds = COLLECTION_CARDS
        .filter((c) => deckCardNames.includes(c.name))
        .map((c) => c.id);
      addCollectionCards(deckCardIds);
    }
    if (!wasSSR && isSSRUnlocked(next, deckKey)) setSsrJustUnlocked(true);
  }, [cleared, deckKey, difficulty, unit]);

  const advance = useCallback(() => {
    setSelected(null);
    setShowFeedback(false);
    setQIndex((i) => {
      const next = i + 1;
      if (next >= pool.length) {
        setPool(shuffle(QUEST_QUIZ_DATA[deckKey]?.[difficulty] || []));
        return 0;
      }
      return next;
    });
    setTimer(timeLimit ?? 999);
  }, [pool.length, deckKey, difficulty, timeLimit]);

  const handleAnswer = useCallback((idx: number, timedOut = false) => {
    if (selected !== null || cleared) return;
    if (timerRef.current) clearInterval(timerRef.current);
    const q = pool[qIndex];
    if (!q) return;
    const isCorrect = !timedOut && idx === q.correctIndex;
    setSelected(timedOut ? -1 : idx);
    setShowFeedback(true);

    // quiz_history へログ記録（正解/不正解の両方、ゲスト/admin除外）
    void logQuizHistory({
      childId: userId,
      deckKey,
      difficulty,
      questionText: stripHtml(q.question),
      selectedAnswer: idx >= 0 ? stripHtml(q.choices[idx]) : '(時間切れ)',
      correctAnswer: stripHtml(q.choices[q.correctIndex]),
      correct: isCorrect,
    });

    if (isCorrect) {
      setSessionCorrect((c) => c + 1);
      setCorrectFlash(true);
      setTimeout(() => setCorrectFlash(false), 400);
      addTotalAlt(diffInfo.altPerCorrect);
      processQuizResult({
        childId: userId,
        quizId: `quest-${deckKey}-${difficulty}-${qIndex}`,
        selectedIndex: idx,
        isCorrect: true,
        consecutiveCorrect: 1,
        cardRarity: difficulty === 'legend' ? 'SSR' : difficulty === 'master' ? 'SR' : difficulty === 'challenger' ? 'R' : 'N',
      }).then((r) => { if (r) setAltBalance(r.newAltTotal); });
      setTimeout(() => advance(), 500);
    } else {
      setWrongFlash(true);
      setTimeout(() => setWrongFlash(false), 500);
      setTimeout(() => advance(), 1000);
    }
  }, [selected, cleared, pool, qIndex, diffInfo, userId, deckKey, difficulty, addTotalAlt, advance]);

  useEffect(() => {
    if (cleared || showFeedback || timeLimit === null || !pool[qIndex]) return;
    timerRef.current = setInterval(() => {
      setTimer((t) => {
        if (t <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          handleAnswer(-1, true);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [cleared, showFeedback, timeLimit, qIndex, pool, handleAnswer]);

  const learningCards = useMemo(() => getLearningCards(deckKey), [deckKey]);

  // Carousel state
  const carouselRef = useRef<HTMLDivElement | null>(null);
  const [slideIndex, setSlideIndex] = useState(0);
  const [detailIndex, setDetailIndex] = useState<number | null>(null);
  // Lock carousel height in px once at mount (prevents iOS Safari URL-bar vh wobble)
  const [carouselHeightPx] = useState<number>(() =>
    typeof window !== 'undefined' ? Math.round(window.innerHeight * 0.5) : 320
  );

  useEffect(() => { setSlideIndex(0); carouselRef.current?.scrollTo({ left: 0 }); }, [deckKey]);

  const scrollToSlide = useCallback((idx: number) => {
    const el = carouselRef.current;
    if (!el) return;
    const slideWidth = el.clientWidth;
    el.scrollTo({ left: slideWidth * idx, behavior: 'smooth' });
  }, []);

  const handleCarouselScroll = useCallback(() => {
    const el = carouselRef.current;
    if (!el) return;
    const idx = Math.round(el.scrollLeft / el.clientWidth);
    setSlideIndex(idx);
  }, []);

  const goToQuiz = useCallback(() => {
    quizRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  if (!unit || !info) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center"
        style={{ background: 'linear-gradient(180deg, #0b1128, #151d3b)' }}>
        <div className="text-5xl mb-3">🔍</div>
        <h2 className="text-amber-100 text-base font-bold mb-2">デッキが見つかりません</h2>
        <Link href="/games/knowledge-challenger?screen=deck_select"><a style={{ color: '#ffd700' }} className="text-sm">← デッキ選択に戻る</a></Link>
      </div>
    );
  }

  // 準備中デッキは管理者以外アクセス不可
  if (!isDeckAvailable(deckKey)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center"
        style={{ background: 'linear-gradient(180deg, #0b1128, #151d3b)' }}>
        <div className="text-6xl mb-4">🔨</div>
        <h2 className="text-lg font-black mb-2" style={{ color: 'var(--tqw-gold, #ffd700)' }}>
          もうすこしまってね！
        </h2>
        <p className="text-sm text-amber-200/70 mb-6">
          「{info.name}」デッキは準備中だよ
        </p>
        <Link href="/games/knowledge-challenger?screen=deck_select">
          <a className="inline-block px-4 py-2 rounded-lg text-sm font-bold"
            style={{ background: 'rgba(255,215,0,0.1)', color: '#ffd700', border: '1px solid rgba(255,215,0,0.3)' }}>
            ← デッキ選択に戻る
          </a>
        </Link>
      </div>
    );
  }

  const q = pool[qIndex];
  const progressPct = Math.min(100, (sessionCorrect / CLEAR_THRESHOLD) * 100);
  const deckUnlocked = isDeckUnlocked(progress, deckKey);
  const ssrUnlocked = isSSRUnlocked(progress, deckKey);
  const isLastSlide = slideIndex >= learningCards.length - 1;
  const isFirstSlide = slideIndex <= 0;

  return (
    <div className="min-h-screen flex flex-col relative"
      style={{ background: 'linear-gradient(180deg, #0b1128 0%, #131b38 50%, #0e1430 100%)' }}>
      {correctFlash && <div className="qp-correct-flash" />}
      {wrongFlash && <div className="qp-wrong-flash" />}

      {/* Header */}
      <div className="px-3 py-2 flex items-center justify-between shrink-0 gap-2"
        style={{ background: 'linear-gradient(180deg, rgba(11,17,40,0.98), rgba(16,22,48,0.95))', borderBottom: `2px solid ${info.color}30` }}>
        <button
          onClick={() => navigate('/games/knowledge-challenger?screen=deck_select')}
          className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-bold active:scale-95 transition-transform shrink-0"
          style={{ background: 'rgba(255,215,0,0.08)', border: '1px solid rgba(255,215,0,0.2)', color: '#ffd700' }}
          aria-label="デッキ選択へ戻る"
        >
          ← デッキ選択
        </button>
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-base">{info.icon}</span>
          <span className="text-sm font-bold truncate" style={{ color: info.color }}>{info.name}</span>
        </div>
        <div className="text-right shrink-0">
          <span className="text-[9px] text-amber-200/40">ALT </span>
          <span className="text-xs font-bold" style={{ color: '#ffd700' }}>{altBalance !== null ? altBalance.toLocaleString() : '---'}</span>
        </div>
      </div>

      {/* Difficulty Tabs + Progress */}
      <div className="px-3 py-2 shrink-0" style={{ background: 'rgba(0,0,0,0.25)' }}>
        <div className="flex gap-1.5 mb-1.5">
          {QUEST_DIFFICULTIES.map((d) => {
            const di = DIFFICULTY_INFO[d];
            const unlocked = isDifficultyUnlocked(progress, deckKey, d);
            const dCleared = progress[deckKey][d].cleared;
            const isCurrent = d === difficulty;
            return (
              <button
                key={d}
                disabled={!unlocked}
                onClick={() => unlocked && setDifficulty(d)}
                className="flex-1 rounded-md px-1 py-1 text-center transition-all active:scale-95"
                style={{
                  background: isCurrent ? `${di.color}25` : dCleared ? `${di.color}10` : 'rgba(255,255,255,0.04)',
                  border: isCurrent ? `1.5px solid ${di.color}` : dCleared ? `1px solid ${di.color}50` : `1px solid ${di.color}25`,
                  opacity: unlocked ? 1 : 0.35,
                  cursor: unlocked ? 'pointer' : 'not-allowed',
                }}
              >
                <div className="flex justify-center items-center gap-0 leading-none mb-0.5">
                  {d === 'legend' ? (
                    <span className="text-[11px]">👑</span>
                  ) : (
                    Array.from({ length: di.stars }).map((_, i) => (
                      <span key={i} className="text-[9px]" style={{ color: dCleared || isCurrent ? di.color : 'rgba(255,255,255,0.4)' }}>⭐</span>
                    ))
                  )}
                </div>
                <div className="text-[8px] font-bold leading-none" style={{ color: isCurrent ? di.color : 'rgba(255,255,255,0.55)' }}>
                  {di.label}
                </div>
                {dCleared && <div className="text-[8px] mt-0.5" style={{ color: di.color }}>✓</div>}
                {!unlocked && <div className="text-[8px] mt-0.5 text-white/40">🔒</div>}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-amber-100 shrink-0">
            正解 {sessionCorrect}/{CLEAR_THRESHOLD}
            {!cleared && sessionCorrect > 0 && (
              <span className="text-amber-200/60 font-normal ml-1">あと{CLEAR_THRESHOLD - sessionCorrect}問！</span>
            )}
          </span>
          <div className="flex-1 h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }}>
            <div className="h-full rounded-full transition-all duration-500"
              style={{ width: `${progressPct}%`, background: `linear-gradient(90deg, ${diffInfo.color}, ${diffInfo.color}aa)` }} />
          </div>
          {timeLimit !== null && !cleared && (
            <span className={`text-[10px] font-bold shrink-0 ${timer <= 5 ? 'text-red-400 qp-timer-pulse' : timer <= 10 ? 'text-orange-400' : 'text-amber-100'}`}>
              ⏱️{timer}s
            </span>
          )}
        </div>
      </div>

      {/* ===== Learning Carousel (fixed px height) ===== */}
      <div className="shrink-0 relative" style={{ height: carouselHeightPx }}>
        {learningCards.length === 0 ? (
          <div className="h-full flex items-center justify-center px-4">
            <div className="text-center">
              <div className="text-4xl mb-1">{info.icon}</div>
              <p className="text-amber-200/50 text-xs">学習カードは準備中です</p>
            </div>
          </div>
        ) : (
          <>
            <div
              ref={carouselRef}
              onScroll={handleCarouselScroll}
              className="qp-carousel flex"
              style={{
                height: carouselHeightPx,
                overflowX: 'auto',
                overflowY: 'hidden',
                scrollSnapType: 'x mandatory',
                touchAction: 'pan-x',
                overscrollBehavior: 'contain',
                WebkitOverflowScrolling: 'touch',
                scrollbarWidth: 'none',
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
              }}
            >
              {learningCards.map((card, i) => {
                const cardInnerHeight = carouselHeightPx - 14;
                return (
                  <div
                    key={card.id}
                    style={{
                      scrollSnapAlign: 'center',
                      flexShrink: 0,
                      minWidth: '100%',
                      height: carouselHeightPx,
                      paddingTop: 7,
                      paddingBottom: 7,
                      paddingLeft: '7.5vw',
                      paddingRight: '7.5vw',
                      boxSizing: 'border-box',
                    }}
                  >
                    <div
                      className="w-full cursor-pointer mx-auto"
                      style={{ maxWidth: 420, height: cardInnerHeight }}
                      onClick={() => setDetailIndex(i)}
                    >
                      <LearningCardBig
                        card={card}
                        deckColor={info.color}
                        index={i + 1}
                        total={learningCards.length}
                        cardHeight={cardInnerHeight}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Prev button */}
            {!isFirstSlide && (
              <button
                onClick={() => scrollToSlide(slideIndex - 1)}
                className="qp-nav-btn absolute left-1 top-1/2 -translate-y-1/2 z-10 active:scale-90"
                aria-label="前へ"
              >
                ‹
              </button>
            )}

            {/* Next / Quiz button */}
            {!isLastSlide ? (
              <button
                onClick={() => scrollToSlide(slideIndex + 1)}
                className="qp-nav-btn absolute right-1 top-1/2 -translate-y-1/2 z-10 active:scale-90"
                aria-label="次へ"
              >
                ›
              </button>
            ) : (
              <button
                onClick={goToQuiz}
                className="absolute right-1 top-1/2 -translate-y-1/2 z-10 rounded-full px-3 py-2 text-[11px] font-black active:scale-95 transition-transform"
                style={{
                  background: `linear-gradient(135deg, ${info.color}, ${info.color}cc)`,
                  color: '#0b1128',
                  boxShadow: `0 2px 10px ${info.color}66`,
                  border: `1.5px solid ${info.color}`,
                }}
                aria-label="クイズに挑戦"
              >
                クイズに挑戦 →
              </button>
            )}

            {/* Dot indicator */}
            <div className="absolute bottom-1 left-0 right-0 flex justify-center gap-1.5 pointer-events-none">
              {learningCards.map((_, i) => (
                <span
                  key={i}
                  className="rounded-full transition-all"
                  style={{
                    width: i === slideIndex ? 8 : 5,
                    height: 5,
                    background: i === slideIndex ? info.color : 'rgba(255,255,255,0.3)',
                  }}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* ===== Quiz / Clear Banner ===== */}
      <div ref={quizRef} className="flex-1 min-h-0 px-3 py-2 flex flex-col overflow-auto">
        {cleared ? (
          <div className="flex-1 flex flex-col items-center justify-center px-2">
            <div className="w-full rounded-2xl p-5 text-center relative overflow-hidden qp-result-bounce"
              style={{
                background: 'linear-gradient(135deg, rgba(21,29,59,0.95), rgba(14,20,45,0.95))',
                border: `2px solid ${diffInfo.color}80`,
                boxShadow: `inset 0 0 30px ${diffInfo.color}15, 0 6px 28px rgba(0,0,0,0.5)`,
              }}>
              <div className="qp-confetti-inner" />
              <div className="text-4xl mb-1">🎉</div>
              <h2 className="text-lg font-black mb-1" style={{ color: diffInfo.color, textShadow: `0 0 16px ${diffInfo.color}40` }}>
                {diffInfo.label} クリア！
              </h2>
              {deckJustUnlocked && (
                <div className="rounded-lg px-3 py-2 my-2" style={{ background: 'rgba(34,197,94,0.18)', border: '1.5px solid rgba(34,197,94,0.5)' }}>
                  <p className="text-sm font-bold text-green-400">🧪 {info.name}デッキ解放！</p>
                  <p className="text-[10px] text-green-300/70 mt-0.5">バトルで使用可能になりました</p>
                </div>
              )}
              {ssrJustUnlocked && (
                <div className="rounded-lg px-3 py-2 my-2" style={{ background: 'rgba(255,215,0,0.15)', border: '1.5px solid rgba(255,215,0,0.5)' }}>
                  <p className="text-sm font-bold" style={{ color: '#ffd700' }}>👑 SSRカード解放！</p>
                  {DECK_SSR_CARDS[deckKey].length > 0 && (
                    <p className="text-[10px] text-amber-200/70 mt-0.5">{DECK_SSR_CARDS[deckKey].join('・')}</p>
                  )}
                </div>
              )}
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => navigate('/games/knowledge-challenger?screen=deck_select')}
                  className="flex-1 rounded-lg py-2.5 font-black text-sm active:scale-[0.98] transition-transform"
                  style={{ background: 'linear-gradient(135deg, #ef4444, #b91c1c)', color: '#fff', boxShadow: '0 2px 12px rgba(239,68,68,0.35)' }}>
                  ⚔️ バトルに行く
                </button>
                {(() => {
                  const curIdx = QUEST_DIFFICULTIES.indexOf(difficulty);
                  const nextDiff = QUEST_DIFFICULTIES[curIdx + 1];
                  if (!nextDiff) return null;
                  const nextUnlocked = isDifficultyUnlocked(progress, deckKey, nextDiff);
                  if (!nextUnlocked) return null;
                  return (
                    <button
                      onClick={() => setDifficulty(nextDiff)}
                      className="flex-1 rounded-lg py-2.5 font-black text-sm active:scale-[0.98] transition-transform"
                      style={{
                        background: `linear-gradient(135deg, ${DIFFICULTY_INFO[nextDiff].color}, ${DIFFICULTY_INFO[nextDiff].color}cc)`,
                        color: '#0b1128',
                        boxShadow: `0 2px 12px ${DIFFICULTY_INFO[nextDiff].color}55`,
                      }}>
                      次は{DIFFICULTY_INFO[nextDiff].label} →
                    </button>
                  );
                })()}
              </div>
            </div>
          </div>
        ) : q ? (
          <div className="rounded-xl p-3"
            style={{ background: 'linear-gradient(135deg, rgba(21,29,59,0.95), rgba(14,20,45,0.95))', border: `1.5px solid ${info.color}30` }}>
            <p className="text-amber-100 text-[13px] font-bold mb-2.5 leading-relaxed"
              dangerouslySetInnerHTML={{ __html: q.question }} />
            <div className="space-y-1.5">
              {q.choices.map((choice, i) => {
                let bg = 'rgba(255,255,255,0.05)';
                let border = 'rgba(255,255,255,0.1)';
                let color = 'rgba(255,255,255,0.85)';
                if (showFeedback) {
                  if (i === q.correctIndex) { bg = 'rgba(34,197,94,0.25)'; border = 'rgba(34,197,94,0.6)'; color = '#22c55e'; }
                  else if (i === selected && i !== q.correctIndex) { bg = 'rgba(239,68,68,0.25)'; border = 'rgba(239,68,68,0.6)'; color = '#ef4444'; }
                }
                return (
                  <button
                    key={i}
                    onClick={() => handleAnswer(i)}
                    disabled={selected !== null}
                    className="w-full text-left px-3 py-2 rounded-lg text-[12px] transition-all active:scale-[0.98]"
                    style={{ background: bg, border: `1.5px solid ${border}`, color }}
                  >
                    <span className="text-amber-200/30 mr-2 font-bold">{['A','B','C','D'][i]}</span>
                    <span dangerouslySetInnerHTML={{ __html: choice }} />
                    {showFeedback && i === q.correctIndex && <span className="ml-2">✅</span>}
                    {showFeedback && i === selected && i !== q.correctIndex && <span className="ml-2">❌</span>}
                  </button>
                );
              })}
            </div>
            {showFeedback && (
              <div className="mt-2 text-center">
                {selected === q.correctIndex ? (
                  <span className="text-xs font-bold text-green-400">🎉 正解！ <span style={{ color: '#ffd700' }}>+{diffInfo.altPerCorrect} ALT</span></span>
                ) : (
                  <span className="text-xs font-bold text-red-400">{selected === -1 ? '⏰ 時間切れ' : '😢 不正解'}</span>
                )}
              </div>
            )}
          </div>
        ) : null}
      </div>

      {/* Footer: unlock hints + other decks link */}
      {!cleared && (
        <div className="shrink-0 px-3 pb-2 space-y-1.5">
          <div className="rounded-md px-2.5 py-1.5 text-center text-[10px]"
            style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,215,0,0.15)' }}>
            {!deckUnlocked ? (
              <span className="text-amber-200/70">⭐ ビギナーで{CLEAR_THRESHOLD}問正解でデッキ解放！</span>
            ) : !ssrUnlocked ? (
              <span className="text-amber-200/70">👑 レジェンドをクリアでSSR解放！</span>
            ) : (
              <span className="text-green-400/80">✅ すべて解放済み！他のデッキも挑戦しよう</span>
            )}
          </div>
          <button
            onClick={() => navigate('/games/knowledge-challenger?screen=deck_select')}
            className="w-full rounded-md py-1.5 text-[11px] font-bold active:scale-95 transition-transform"
            style={{ background: 'rgba(255,215,0,0.08)', border: '1px solid rgba(255,215,0,0.25)', color: '#ffd700' }}
          >
            📋 デッキ選択に戻る
          </button>
        </div>
      )}

      {detailIndex !== null && learningCards[detailIndex] && (
        <DetailPopup
          cards={learningCards}
          index={detailIndex}
          deckColor={info.color}
          onClose={() => setDetailIndex(null)}
          onIndexChange={setDetailIndex}
        />
      )}

      <style>{`
        .qp-carousel::-webkit-scrollbar { display: none; }
        .qp-nav-btn {
          width: 32px; height: 32px; border-radius: 9999px;
          background: rgba(11,17,40,0.65); color: #fff;
          font-size: 22px; line-height: 1; font-weight: 900;
          display: flex; align-items: center; justify-content: center;
          border: 1.5px solid rgba(255,255,255,0.25);
          backdrop-filter: blur(6px);
          box-shadow: 0 2px 10px rgba(0,0,0,0.35);
          transition: transform 0.12s;
        }
        @media (min-width: 640px) {
          .qp-nav-btn { width: 40px; height: 40px; font-size: 26px; }
        }
        .qp-correct-flash { position: fixed; inset: 0; z-index: 50; pointer-events: none; animation: qpFlashGreen 0.4s ease-out forwards; }
        @keyframes qpFlashGreen { 0% { background: rgba(34,197,94,0.32); } 100% { background: transparent; } }
        .qp-wrong-flash { position: fixed; inset: 0; z-index: 50; pointer-events: none; animation: qpFlashRed 0.5s ease-out forwards; }
        @keyframes qpFlashRed { 0% { background: rgba(239,68,68,0.28); } 100% { background: transparent; } }
        .qp-timer-pulse { animation: qpTimerPulse 1s ease-in-out infinite; }
        @keyframes qpTimerPulse { 0%,100%{opacity:1;} 50%{opacity:0.4;} }
        .qp-result-bounce { animation: qpBounce 0.7s ease-out; }
        @keyframes qpBounce { 0%{transform:scale(0.3);} 60%{transform:scale(1.08);} 100%{transform:scale(1);} }
        .qp-confetti-inner { position:absolute; inset:0; pointer-events:none; background-image:
          radial-gradient(circle, #ffd700 1.5px, transparent 1.5px),
          radial-gradient(circle, #22c55e 1.5px, transparent 1.5px),
          radial-gradient(circle, #ef4444 1.5px, transparent 1.5px);
          background-size: 28px 28px, 36px 36px, 32px 32px;
          background-position: 0 0, 14px 14px, 8px 22px;
          animation: qpConfettiFall 2.5s ease-out forwards; opacity: 0.55; }
        @keyframes qpConfettiFall { 0% { transform: translateY(-80%); opacity:0.8; } 100% { transform: translateY(100%); opacity:0; } }
      `}</style>
    </div>
  );
}

// ===================== Learning Card (Big) =====================

function LearningCardBig({
  card,
  deckColor,
  index,
  total,
  cardHeight,
}: {
  card: LearningCard;
  deckColor: string;
  index: number;
  total: number;
  cardHeight: number;
}) {
  const [imgFailed, setImgFailed] = useState(false);

  // Locked internal section heights; image uses aspect-ratio (720/400)
  const TITLE_H = 30;
  const FUNFACT_H = 40;

  // Debug (remove after verification)
  const cardRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (cardRef.current) {
      // eslint-disable-next-line no-console
      console.log(`[learn-card ${index}/${total}] "${card.title.replace(/<[^>]+>/g, '')}" clientHeight=${cardRef.current.clientHeight}`);
    }
  }, [card.id, index, total, card.title]);

  return (
    <div ref={cardRef} className="w-full rounded-2xl overflow-hidden flex flex-col relative"
      style={{
        height: cardHeight,
        background: `linear-gradient(160deg, ${deckColor}28 0%, ${deckColor}10 50%, rgba(11,17,40,0.92) 100%)`,
        border: `2px solid ${deckColor}60`,
        boxShadow: `0 6px 22px ${deckColor}30, 0 2px 12px rgba(0,0,0,0.35)`,
      }}>
      {/* Image (aspect-ratio based — matches 720x400 artwork) */}
      <div
        className="relative shrink-0"
        style={{
          padding: 6,
          background: `linear-gradient(135deg, ${deckColor}50, ${deckColor}20)`,
        }}
      >
        <div
          className="w-full overflow-hidden"
          style={{ borderRadius: 8, background: '#1a1a2e', aspectRatio: '720 / 400' }}
        >
          {card.image && !imgFailed ? (
            <img
              src={card.image}
              alt=""
              className="block"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                objectPosition: 'center center',
              }}
              onError={() => setImgFailed(true)}
              draggable={false}
              decoding="async"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-5xl opacity-60">🎨</span>
            </div>
          )}
        </div>
        <div className="absolute top-3 right-3 text-[10px] font-bold px-2 py-0.5 rounded-full"
          style={{ background: 'rgba(0,0,0,0.6)', color: '#fff', backdropFilter: 'blur(4px)' }}>
          {index}/{total}
        </div>
      </div>

      {/* Title (1 line) */}
      <div
        className="shrink-0 flex items-center"
        style={{ height: TITLE_H, paddingLeft: 10, paddingRight: 10, background: 'rgba(11,17,40,0.55)' }}
      >
        <h3
          className="font-black text-white leading-tight"
          style={{
            fontSize: 14,
            display: '-webkit-box',
            WebkitLineClamp: 1,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            width: '100%',
          }}
          dangerouslySetInnerHTML={{ __html: card.title }}
        />
      </div>

      {/* Content (flex-1, 3-line clamp) */}
      <div
        className="flex-1 min-h-0"
        style={{ overflow: 'hidden', paddingLeft: 10, paddingRight: 10, paddingTop: 4, paddingBottom: 4, background: 'rgba(11,17,40,0.65)' }}
      >
        <p
          className="text-white leading-snug"
          style={{
            fontSize: 12,
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
          dangerouslySetInnerHTML={{ __html: card.content }}
        />
      </div>

      {/* funFact (2 lines) */}
      <div
        className="shrink-0 flex items-center"
        style={{ height: FUNFACT_H, paddingLeft: 10, paddingRight: 10, background: 'rgba(0,0,0,0.38)', borderTop: `1px solid ${deckColor}40` }}
      >
        <p
          className="leading-snug"
          style={{
            fontSize: 11,
            color: '#ffd700',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            width: '100%',
          }}
        >
          💡 <span dangerouslySetInnerHTML={{ __html: card.funFact }} />
        </p>
      </div>
    </div>
  );
}

// ===================== Detail Popup (swipeable) =====================

interface DetailPopupProps {
  cards: LearningCard[];
  index: number;
  deckColor: string;
  onClose: () => void;
  onIndexChange: (idx: number) => void;
}

function DetailPopup({ cards, index, deckColor, onClose, onIndexChange }: DetailPopupProps) {
  const [dragX, setDragX] = useState(0);
  const [transition, setTransition] = useState<{ dir: 'next' | 'prev'; fromIndex: number; toIndex: number } | null>(null);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const isHorizontalGesture = useRef(false);
  const isDragging = useRef(false);

  const total = cards.length;
  const isFirst = index <= 0;
  const isLast = index >= total - 1;

  const startTransition = useCallback((dir: 'next' | 'prev') => {
    if (transition) return;
    const toIndex = dir === 'next' ? index + 1 : index - 1;
    if (toIndex < 0 || toIndex >= total) return;
    setDragX(0);
    setTransition({ dir, fromIndex: index, toIndex });
    window.setTimeout(() => {
      onIndexChange(toIndex);
      setTransition(null);
    }, 300);
  }, [transition, index, total, onIndexChange]);

  const goPrev = useCallback(() => { if (!isFirst) startTransition('prev'); }, [isFirst, startTransition]);
  const goNext = useCallback(() => { if (!isLast) startTransition('next'); }, [isLast, startTransition]);

  const onTouchStart = (e: React.TouchEvent) => {
    if (transition) return;
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    isHorizontalGesture.current = false;
    isDragging.current = true;
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null || transition) return;
    const dx = e.touches[0].clientX - touchStartX.current;
    const dy = e.touches[0].clientY - touchStartY.current;
    if (!isHorizontalGesture.current) {
      if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) {
        isHorizontalGesture.current = true;
      } else if (Math.abs(dy) > 10) {
        touchStartX.current = null;
        isDragging.current = false;
        return;
      }
    }
    if (isHorizontalGesture.current) {
      let v = dx;
      if ((dx > 0 && isFirst) || (dx < 0 && isLast)) v = dx * 0.25;
      setDragX(v);
    }
  };

  const onTouchEnd = () => {
    isDragging.current = false;
    if (touchStartX.current === null || transition) {
      touchStartX.current = null;
      setDragX(0);
      return;
    }
    const threshold = 50;
    if (dragX > threshold && !isFirst) {
      startTransition('prev');
    } else if (dragX < -threshold && !isLast) {
      startTransition('next');
    } else {
      setDragX(0);
    }
    touchStartX.current = null;
    touchStartY.current = null;
    isHorizontalGesture.current = false;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.75)', padding: '5vw' }}
      onClick={onClose}>
      <div
        className="relative w-full"
        style={{ maxWidth: 480 }}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* Sliding card stage */}
        <div className="relative overflow-hidden rounded-2xl">
          {transition ? (
            <>
              {/* Outgoing card (stays in flow to size the container) */}
              <div className={`qp-slide-out-${transition.dir}`}>
                <PopupCard card={cards[transition.fromIndex]} deckColor={deckColor} onClose={onClose} />
              </div>
              {/* Incoming card (absolute, enters from opposite side) */}
              <div className={`absolute inset-0 qp-slide-in-${transition.dir}`}>
                <PopupCard card={cards[transition.toIndex]} deckColor={deckColor} onClose={onClose} />
              </div>
            </>
          ) : (
            <div
              style={{
                transform: `translateX(${dragX}px)`,
                transition: isDragging.current ? 'none' : 'transform 0.25s ease-out',
              }}
            >
              <PopupCard card={cards[index]} deckColor={deckColor} onClose={onClose} />
            </div>
          )}
        </div>

        {/* Prev arrow */}
        {!isFirst && !transition && (
          <button
            onClick={goPrev}
            className="qp-popup-nav absolute left-1 top-1/2 -translate-y-1/2 z-10 active:scale-90"
            aria-label="前へ"
          >
            ‹
          </button>
        )}

        {/* Next arrow */}
        {!isLast && !transition && (
          <button
            onClick={goNext}
            className="qp-popup-nav absolute right-1 top-1/2 -translate-y-1/2 z-10 active:scale-90"
            aria-label="次へ"
          >
            ›
          </button>
        )}

        {/* Dot indicator */}
        <div className="mt-3 flex justify-center gap-1.5">
          {cards.map((_, i) => (
            <span
              key={i}
              className="rounded-full transition-all"
              style={{
                width: i === (transition?.toIndex ?? index) ? 10 : 6,
                height: 6,
                background: i === (transition?.toIndex ?? index) ? deckColor : 'rgba(255,255,255,0.35)',
              }}
            />
          ))}
        </div>
      </div>

      <style>{`
        .qp-popup-nav {
          width: 36px; height: 36px; border-radius: 9999px;
          background: rgba(11,17,40,0.65); color: #fff;
          font-size: 24px; line-height: 1; font-weight: 900;
          display: flex; align-items: center; justify-content: center;
          border: 1.5px solid rgba(255,255,255,0.25);
          backdrop-filter: blur(6px);
          box-shadow: 0 2px 10px rgba(0,0,0,0.35);
          transition: transform 0.12s;
        }
        @media (min-width: 640px) {
          .qp-popup-nav { width: 44px; height: 44px; font-size: 28px; }
        }
        @keyframes qpSlideOutLeft { from { transform: translateX(0); } to { transform: translateX(-100%); } }
        @keyframes qpSlideOutRight { from { transform: translateX(0); } to { transform: translateX(100%); } }
        @keyframes qpSlideInFromRight { from { transform: translateX(100%); } to { transform: translateX(0); } }
        @keyframes qpSlideInFromLeft { from { transform: translateX(-100%); } to { transform: translateX(0); } }
        .qp-slide-out-next { animation: qpSlideOutLeft 0.3s ease-out forwards; }
        .qp-slide-in-next  { animation: qpSlideInFromRight 0.3s ease-out forwards; }
        .qp-slide-out-prev { animation: qpSlideOutRight 0.3s ease-out forwards; }
        .qp-slide-in-prev  { animation: qpSlideInFromLeft 0.3s ease-out forwards; }
      `}</style>
    </div>
  );
}

function PopupCard({ card, deckColor, onClose }: { card: LearningCard; deckColor: string; onClose: () => void }) {
  const [imgFailed, setImgFailed] = useState(false);
  useEffect(() => { setImgFailed(false); }, [card.id]);
  return (
    <div className="rounded-2xl overflow-hidden flex flex-col"
      style={{
        background: 'linear-gradient(135deg, rgba(21,29,59,0.98), rgba(14,20,45,0.98))',
        border: `2px solid ${deckColor}70`,
        boxShadow: `0 10px 40px rgba(0,0,0,0.6), inset 0 0 30px ${deckColor}10`,
      }}>
      <div className="px-4 py-3 flex items-center justify-between shrink-0"
        style={{ background: `${deckColor}35`, borderBottom: `1.5px solid ${deckColor}50` }}>
        <h3 className="text-base font-black text-white" dangerouslySetInnerHTML={{ __html: card.title }} />
        <button onClick={onClose} className="text-white/70 text-base ml-2 shrink-0">✕</button>
      </div>
      <div
        className="shrink-0 relative"
        style={{ padding: 10, background: `linear-gradient(135deg, ${deckColor}50, ${deckColor}20)` }}
      >
        {card.image && !imgFailed ? (
          <img
            src={card.image}
            alt=""
            className="block"
            style={{
              display: 'block',
              width: '100%',
              aspectRatio: '720 / 400',
              height: 'auto',
              objectFit: 'cover',
              objectPosition: 'center center',
              borderRadius: 8,
              background: '#1a1a2e',
            }}
            onError={() => setImgFailed(true)}
            draggable={false}
          />
        ) : (
          <div
            className="flex items-center justify-center"
            style={{
              width: '100%',
              aspectRatio: '720 / 400',
              background: '#1a1a2e',
              borderRadius: 8,
            }}
          >
            <span className="text-6xl opacity-60">🎨</span>
          </div>
        )}
      </div>
      <div className="flex-1 min-h-0 overflow-auto p-4">
        <p className="text-sm text-white leading-relaxed"
          dangerouslySetInnerHTML={{ __html: card.content }} />
      </div>
      <div className="shrink-0 px-4 py-3" style={{ background: 'rgba(0,0,0,0.35)', borderTop: `1px solid ${deckColor}30` }}>
        <p className="text-xs leading-relaxed" style={{ color: '#ffd700' }}>
          💡 <span dangerouslySetInnerHTML={{ __html: card.funFact }} />
        </p>
      </div>
    </div>
  );
}
