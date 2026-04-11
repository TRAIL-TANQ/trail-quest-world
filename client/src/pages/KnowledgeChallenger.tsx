/**
 * Knowledge Challenger - Card Battle Game UI (Phase 1 rewrite)
 *
 * New flow: 5-round trophy match, 1v1 vs NPC.
 *   title → [round_intro → reveal → round_end → deck_phase] × 5 → result
 * - No in-battle quiz. Effects trigger automatically on card reveal.
 * - Deck phase: 2 cards offered, per-card quiz gate, 1 redraw allowed. Correct = add to deck (+10 ALT).
 * - Bench: 6 distinct-name slots, same-name cards stack, 6th distinct name = instant loss.
 */
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useLocation, useRoute } from 'wouter';
import { useUserStore, useGameStore, useAltStore, useCollectionStore } from '@/lib/stores';
import {
  type BattleCard,
  type Quiz,
  CATEGORY_INFO,
  RARITY_INFO,
  createInitialDeck,
  createAIDeck,
  validateDeck,
  canAddCardToDeck,
  sampleCards,
  INITIAL_DECK_SIZE,
  MAX_DECK_SIZE,
  MAX_SSR,
  MAX_SR,
  MAX_SAME_NAME,
  ALL_BATTLE_CARDS,
} from '@/lib/knowledgeCards';
import {
  type GameState,
  BENCH_MAX_SLOTS,
  TOTAL_ROUNDS,
  initGameState,
  revealRound,
  endRound,
  startDeckPhase,
  advanceToNextRound,
  addCardToDeck,
  swapCardInDeck,
  aiDeckGrowth,
} from '@/lib/knowledgeEngine';
import {
  processQuizResult,
  fetchChildStatus,
} from '@/lib/quizService';
import { getStage, createStageAIDeck } from '@/lib/stages';
import { useStageProgressStore } from '@/lib/stageProgressStore';
import { applyRatingChange } from '@/lib/ratingService';
import { toast } from 'sonner';

type ScreenPhase = 'title' | 'playing' | 'result';

// Timing constants (ms) for the reveal cinematic.
const REVEAL_INTRO_MS = 1100;
const REVEAL_COMPARE_MS = 1600;
const REVEAL_OUTCOME_MS = 1400;

export default function KnowledgeChallenger() {
  const [, navigate] = useLocation();
  const [, stageMatch] = useRoute<{ id: string }>('/games/knowledge-challenger/stage/:id');
  const stageId = stageMatch ? parseInt(stageMatch.id, 10) : null;
  const currentStage = useMemo(() => (stageId ? getStage(stageId) : null), [stageId]);

  const addTotalAlt = useUserStore((s) => s.addTotalAlt);
  const userStoreSet = useUserStore;  // 称号更新に直接触りたい
  const addCollectionCard = useCollectionStore((s) => s.addCard);
  const setLastResult = useGameStore((s) => s.setLastResult);
  const triggerEarnEffect = useAltStore((s) => s.triggerEarnEffect);

  // 変更9: ステージ進行
  const markStageCleared = useStageProgressStore((s) => s.markCleared);
  const markStageRewarded = useStageProgressStore((s) => s.markRewarded);
  const isStageRewarded = useStageProgressStore((s) => s.isRewarded);

  const [screen, setScreen] = useState<ScreenPhase>('title');
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [imagesPreloaded, setImagesPreloaded] = useState(false);
  const [preloadProgress, setPreloadProgress] = useState(0);
  const imageCache = useRef<Map<string, HTMLImageElement>>(new Map());

  // ===== Cinematic state =====
  type RevealStep = 'intro' | 'cards' | 'compare' | 'outcome' | 'done';
  const [revealStep, setRevealStep] = useState<RevealStep>('done');
  const [fastMode, setFastMode] = useState(false);
  const fastModeRef = useRef(false);
  useEffect(() => { fastModeRef.current = fastMode; }, [fastMode]);
  const stepTimeoutsRef = useRef<number[]>([]);
  const clearStepTimeouts = useCallback(() => {
    stepTimeoutsRef.current.forEach((id) => clearTimeout(id));
    stepTimeoutsRef.current = [];
  }, []);
  const scheduleStep = useCallback((delayMs: number, fn: () => void) => {
    const scale = fastModeRef.current ? 0.3 : 1;
    const id = window.setTimeout(fn, Math.max(100, delayMs * scale));
    stepTimeoutsRef.current.push(id);
  }, []);

  // ===== Deck phase state =====
  interface DeckOffer {
    cards: BattleCard[];       // 2 cards offered this round
    blocked: Set<number>;      // indices of cards the player failed the quiz on
    acquired: Set<number>;     // indices already added
    redrawsLeft: number;
  }
  const [deckOffer, setDeckOffer] = useState<DeckOffer | null>(null);
  const [activeQuiz, setActiveQuiz] = useState<{
    quiz: Quiz;
    cardIndex: number;
    card: BattleCard;
  } | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showQuizResult, setShowQuizResult] = useState(false);
  const [quizTimer, setQuizTimer] = useState(10);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [swapState, setSwapState] = useState<{ incoming: BattleCard } | null>(null);

  // ALT/XP
  const userId = useUserStore((s) => s.user.id);
  const [altBalance, setAltBalance] = useState<number | null>(null);
  const [xpTotal, setXpTotal] = useState<number>(0);
  const [xpLevel, setXpLevel] = useState<number>(1);
  const [consecutiveCorrect, setConsecutiveCorrect] = useState(0);
  const [altRewardPopup, setAltRewardPopup] = useState<{ alt: number; xp: number; key: number } | null>(null);
  const altPopupKey = useRef(0);

  // Trophy / round banner
  const [trophyFlash, setTrophyFlash] = useState<'player' | 'ai' | null>(null);
  const [roundWinGlow, setRoundWinGlow] = useState(false);

  // Preview deck for title screen (starter deck validation)
  const [previewDeck, setPreviewDeck] = useState<BattleCard[] | null>(null);
  useEffect(() => { if (!previewDeck) setPreviewDeck(createInitialDeck()); }, [previewDeck]);
  const previewValidation = previewDeck ? validateDeck(previewDeck) : null;
  const rebuildPreviewDeck = useCallback(() => { setPreviewDeck(createInitialDeck()); }, []);

  useEffect(() => {
    fetchChildStatus(userId).then((status) => {
      if (status) {
        setAltBalance(status.alt_points);
        setXpTotal(status.xp);
        setXpLevel(status.level);
      }
    });
  }, [userId]);

  // Preload images
  useEffect(() => {
    const urls = ALL_BATTLE_CARDS.map((c) => c.imageUrl).filter(Boolean);
    let loaded = 0;
    const total = urls.length;
    if (total === 0) { setImagesPreloaded(true); return; }
    urls.forEach((url) => {
      if (imageCache.current.has(url)) {
        loaded++;
        setPreloadProgress(Math.round((loaded / total) * 100));
        if (loaded >= total) setImagesPreloaded(true);
        return;
      }
      const img = new Image();
      img.onload = img.onerror = () => {
        loaded++;
        setPreloadProgress(Math.round((loaded / total) * 100));
        if (loaded >= total) setImagesPreloaded(true);
      };
      img.src = url;
      imageCache.current.set(url, img);
    });
  }, []);

  // ===== Start game =====
  const startGame = useCallback(() => {
    clearStepTimeouts();
    const playerDeck = previewDeck && validateDeck(previewDeck).valid ? previewDeck : createInitialDeck();
    // 変更9: ステージ指定があればそのテーマに沿った AI デッキを使う
    const aiDeckCards = stageId !== null ? createStageAIDeck(stageId) : createAIDeck();
    const state = initGameState(playerDeck, aiDeckCards);
    setGameState(state);
    setScreen('playing');
    setRevealStep('done');
    setDeckOffer(null);
    setActiveQuiz(null);
    setSwapState(null);
  }, [clearStepTimeouts, previewDeck, stageId]);

  // ===== Round reveal cinematic =====
  const beginRoundReveal = useCallback(() => {
    if (!gameState || gameState.phase !== 'round_intro') return;
    const afterIntro = revealRound(gameState);
    setGameState(afterIntro);
    setRevealStep('intro');
    scheduleStep(REVEAL_INTRO_MS, () => setRevealStep('cards'));
    scheduleStep(REVEAL_INTRO_MS + 900, () => setRevealStep('compare'));
    scheduleStep(REVEAL_INTRO_MS + 900 + REVEAL_COMPARE_MS, () => {
      setRevealStep('outcome');
      if (afterIntro.roundWinner === 'player') {
        setTrophyFlash('player');
        setRoundWinGlow(true);
      } else if (afterIntro.roundWinner === 'ai') {
        setTrophyFlash('ai');
      }
    });
    scheduleStep(REVEAL_INTRO_MS + 900 + REVEAL_COMPARE_MS + REVEAL_OUTCOME_MS, () => {
      setRevealStep('done');
      setTrophyFlash(null);
      setRoundWinGlow(false);
      // Advance engine state to round_end / game_over
      const after = endRound(afterIntro);
      setGameState(after);
      if (after.phase === 'game_over') {
        window.setTimeout(() => setScreen('result'), 1600);
      }
    });
  }, [gameState, scheduleStep]);

  // Kick off round reveal automatically on entering round_intro
  useEffect(() => {
    if (gameState?.phase === 'round_intro' && revealStep === 'done') {
      const id = window.setTimeout(beginRoundReveal, 600);
      return () => clearTimeout(id);
    }
  }, [gameState?.phase, revealStep, beginRoundReveal]);

  // ===== Enter deck phase =====
  const enterDeckPhase = useCallback(() => {
    if (!gameState || gameState.phase !== 'round_end') return;
    // 変更8: round 引数で現在ラウンドのレア度分布に従って抽選。
    // 次のラウンド向けのデッキ補充なので round+1 を渡す。
    // ただし最終ラウンド終了時は deck_phase に入らない（既に game_over 遷移済み）ので安全。
    const nextRound = gameState.round + 1;
    const aiNew = sampleCards(2, 'ai-grow', nextRound);
    const state1 = aiDeckGrowth(gameState, aiNew);
    const state2 = startDeckPhase(state1);
    setGameState(state2);
    const offered = sampleCards(2, 'offer', nextRound);
    setDeckOffer({
      cards: offered,
      blocked: new Set(),
      acquired: new Set(),
      redrawsLeft: 1,
    });
  }, [gameState]);

  // ===== Deck phase: tap card → show quiz =====
  const handleCardTap = useCallback((index: number) => {
    if (!deckOffer || !gameState) return;
    if (deckOffer.blocked.has(index) || deckOffer.acquired.has(index)) return;
    const card = deckOffer.cards[index];
    const quiz = card.quizzes[Math.floor(Math.random() * card.quizzes.length)];
    setActiveQuiz({ quiz, cardIndex: index, card });
    setSelectedAnswer(null);
    setShowQuizResult(false);
    setQuizTimer(10);
  }, [deckOffer, gameState]);

  // Quiz timer
  useEffect(() => {
    if (!activeQuiz || showQuizResult) return;
    timerRef.current = setInterval(() => {
      setQuizTimer((t) => {
        if (t <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          // timeout = wrong
          handleQuizAnswer(-1);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeQuiz, showQuizResult]);

  const handleQuizAnswer = useCallback((answerIndex: number) => {
    if (!activeQuiz || !deckOffer || !gameState) return;
    if (selectedAnswer !== null) return;
    if (timerRef.current) clearInterval(timerRef.current);
    setSelectedAnswer(answerIndex);
    setShowQuizResult(true);
    const correct = answerIndex === activeQuiz.quiz.correctIndex;
    const newConsecutive = correct ? consecutiveCorrect + 1 : 0;
    setConsecutiveCorrect(newConsecutive);

    // Supabase save (quiz_attempts) + ALT reward
    processQuizResult({
      childId: userId,
      quizId: `${activeQuiz.card.id}-q${Math.floor(Math.random() * 1000)}`,
      selectedIndex: answerIndex,
      isCorrect: correct,
      consecutiveCorrect: newConsecutive,
      cardRarity: activeQuiz.card.rarity,
    }).then((reward) => {
      if (reward) {
        setAltBalance(reward.newAltTotal);
        setXpTotal(reward.newXpTotal);
        setXpLevel(reward.newLevel);
        if (reward.altEarned > 0) {
          addTotalAlt(reward.altEarned);
          altPopupKey.current++;
          setAltRewardPopup({ alt: reward.altEarned, xp: reward.xpEarned, key: altPopupKey.current });
          setTimeout(() => setAltRewardPopup(null), 2500);
        }
      }
    });

    // Apply result after a short reveal delay
    window.setTimeout(() => {
      const idx = activeQuiz.cardIndex;
      const card = activeQuiz.card;
      setActiveQuiz(null);
      setShowQuizResult(false);
      setSelectedAnswer(null);
      if (correct) {
        // Add to deck (with swap UI if over max)
        setDeckOffer((prev) => {
          if (!prev) return prev;
          const acquired = new Set(prev.acquired);
          acquired.add(idx);
          return { ...prev, acquired };
        });
        setGameState((prev) => {
          if (!prev) return prev;
          const nextDeckLen = prev.player.deck.length + 1;
          if (nextDeckLen > MAX_DECK_SIZE) {
            // Trigger swap UI; don't add yet
            setSwapState({ incoming: card });
            return prev;
          }
          return addCardToDeck(prev, card);
        });
      } else {
        setDeckOffer((prev) => {
          if (!prev) return prev;
          const blocked = new Set(prev.blocked);
          blocked.add(idx);
          return { ...prev, blocked };
        });
      }
    }, 1200);
  }, [activeQuiz, deckOffer, gameState, selectedAnswer, consecutiveCorrect, userId, addTotalAlt]);

  // ===== Redraw offer =====
  const handleRedraw = useCallback(() => {
    if (!deckOffer || deckOffer.redrawsLeft <= 0 || !gameState) return;
    // 変更8: deck_phase 中のラウンド番号に合わせて抽選
    const offered = sampleCards(2, 'offer', gameState.round + 1);
    setDeckOffer({
      cards: offered,
      blocked: new Set(),
      acquired: new Set(),
      redrawsLeft: deckOffer.redrawsLeft - 1,
    });
  }, [deckOffer, gameState]);

  // ===== Continue to next round =====
  const handleContinueNextRound = useCallback(() => {
    if (!gameState) return;
    setDeckOffer(null);
    setActiveQuiz(null);
    setSwapState(null);
    const next = advanceToNextRound(gameState);
    setGameState(next);
    setRevealStep('done');
  }, [gameState]);

  // ===== Swap resolution =====
  const handleSwapPick = useCallback((removeIndex: number) => {
    if (!swapState || !gameState) return;
    setGameState(swapCardInDeck(gameState, removeIndex, swapState.incoming));
    setSwapState(null);
  }, [swapState, gameState]);

  // ===== Finish (after game_over) =====
  const handleFinish = useCallback(() => {
    if (!gameState) return;
    const won = gameState.winner === 'player';

    // 基本報酬: フリープレイなら won?30:5
    let altReward = won ? 30 : 5;

    // 変更9: ステージクリア報酬を加算 & 状態更新
    if (won && currentStage) {
      markStageCleared(currentStage.id);
      if (!isStageRewarded(currentStage.id)) {
        altReward += currentStage.altReward;
        if (currentStage.cardRewardId) {
          addCollectionCard(currentStage.cardRewardId);
          toast.success(`カード「${currentStage.cardRewardId}」を獲得！`);
        }
        if (currentStage.title) {
          userStoreSet.setState((s) => ({ user: { ...s.user, titleId: currentStage.title!.id } }));
          toast.success(`称号「${currentStage.title.name}」を獲得！`);
        }
        markStageRewarded(currentStage.id);
      }
    }

    // 変更10: Elo レーティング更新（ステージ mode のみ。フリープレイはスキップ）
    if (currentStage) {
      void applyRatingChange(userId, currentStage.aiRating, won).then((res) => {
        if (res) {
          toast.info(`レート ${res.delta >= 0 ? '+' : ''}${res.delta} (${res.newRating})`);
        }
      });
    }

    addTotalAlt(altReward);
    triggerEarnEffect(altReward);
    setLastResult({ score: won ? 100 : 30, maxScore: 100, timeSeconds: 0, accuracy: won ? 1 : 0.3, isBestScore: won });
    navigate('/result');
  }, [gameState, currentStage, userId, addTotalAlt, triggerEarnEffect, setLastResult, navigate, markStageCleared, markStageRewarded, isStageRewarded, addCollectionCard, userStoreSet]);

  // =============================================================
  // ===================== TITLE SCREEN =========================
  // =============================================================
  if (screen === 'title') {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center px-6"
        style={{ background: 'linear-gradient(180deg, #0b1128 0%, #151d3b 50%, #0e1430 100%)' }}
      >
        <div
          className="relative rounded-2xl p-6 w-full max-w-sm text-center overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, rgba(21,29,59,0.95), rgba(14,20,45,0.95))',
            border: '2px solid rgba(255,215,0,0.35)',
            boxShadow: 'inset 0 0 30px rgba(255,215,0,0.05), 0 8px 32px rgba(0,0,0,0.5)',
          }}
        >
          <span className="text-5xl block mb-3">⚔️</span>
          <h1 className="text-xl font-bold mb-1" style={{ color: '#ffd700', textShadow: '0 0 15px rgba(255,215,0,0.3)' }}>
            ナレッジ・チャレンジャー
          </h1>
          <p className="text-amber-200/50 text-xs mb-5">5ラウンド・トロフィー争奪カードバトル</p>

          <div className="rounded-xl p-3 mb-3" style={{ background: 'rgba(255,215,0,0.05)', border: '1px solid rgba(255,215,0,0.15)' }}>
            <p className="text-amber-200/60 text-[11px] text-left leading-relaxed">
              <span className="text-amber-100 font-bold">ルール：</span>
              <br />
              ・初期デッキ{INITIAL_DECK_SIZE}枚 / 最大{MAX_DECK_SIZE}枚
              <br />
              ・5ラウンド制（トロフィー: 各ラウンドでファン数獲得）
              <br />
              ・各ラウンド、カード公開 → 効果自動発動 → パワー比較
              <br />
              ・ベンチ{BENCH_MAX_SLOTS}種類目で敗北、同名カードは重ねられる
              <br />
              ・ラウンド間のデッキフェイズでクイズに正解するとカード獲得
            </p>
          </div>

          {previewValidation && (
            <div
              className="rounded-xl p-3 mb-3 text-left"
              style={{
                background: previewValidation.valid ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
                border: `2px solid ${previewValidation.valid ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.5)'}`,
              }}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-black text-amber-100">🃏 スターターデッキ</span>
                <span
                  className="text-lg font-black"
                  style={{ color: previewValidation.valid ? '#4ade80' : '#ff6b6b' }}
                >
                  {previewValidation.totalCount}/{INITIAL_DECK_SIZE}枚
                </span>
              </div>
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${previewValidation.ssrCount > MAX_SSR ? 'bg-red-900/40 text-red-300' : 'bg-amber-900/30 text-amber-200'}`}>
                  SSR: {previewValidation.ssrCount}/{MAX_SSR}
                </span>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${previewValidation.srCount > MAX_SR ? 'bg-red-900/40 text-red-300' : 'bg-purple-900/30 text-purple-200'}`}>
                  SR: {previewValidation.srCount}/{MAX_SR}
                </span>
                <button
                  onClick={rebuildPreviewDeck}
                  className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded"
                  style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.8)' }}
                >
                  🔄 再構築
                </button>
              </div>
              {previewValidation.errors.length > 0 && (
                <div className="mt-1.5 space-y-0.5">
                  {previewValidation.errors.map((err, i) => (
                    <p key={i} className="text-[10px] font-bold text-red-300">⚠️ {err}</p>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-center gap-5 mb-4">
            <div className="text-center">
              <p className="text-[9px] text-amber-200/35 mb-1">ラウンド</p>
              <span className="text-sm font-bold text-amber-100">{TOTAL_ROUNDS}</span>
            </div>
            <div className="text-center">
              <p className="text-[9px] text-amber-200/35 mb-1">報酬</p>
              <span className="text-sm font-bold" style={{ color: '#ffd700' }}>+30 ALT</span>
            </div>
            <div className="text-center">
              <p className="text-[9px] text-amber-200/35 mb-1">ベンチ</p>
              <span className="text-sm font-bold text-amber-100">{BENCH_MAX_SLOTS}枠</span>
            </div>
          </div>

          {!imagesPreloaded && (
            <div className="mb-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-amber-200/50">カード画像を読み込み中...</span>
                <span className="text-[10px] text-amber-200/50">{preloadProgress}%</span>
              </div>
              <div className="h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }}>
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${preloadProgress}%`, background: 'linear-gradient(90deg, #ffd700, #ffaa00)' }}
                />
              </div>
            </div>
          )}
          <button
            onClick={startGame}
            disabled={!imagesPreloaded || !(previewValidation?.valid)}
            className="rpg-btn rpg-btn-green w-full text-lg py-3.5 mb-2"
            style={{ opacity: (!imagesPreloaded || !(previewValidation?.valid)) ? 0.5 : 1 }}
          >
            {!imagesPreloaded
              ? `⏳ 読み込み中... ${preloadProgress}%`
              : !previewValidation?.valid
                ? '❌ デッキ条件未達'
                : '⚔️ バトル開始！'}
          </button>
          <button
            onClick={() => navigate('/games')}
            className="text-amber-200/35 text-xs hover:text-amber-200/60 transition-colors py-2"
          >
            ← ゲーム一覧に戻る
          </button>
        </div>
      </div>
    );
  }

  // =============================================================
  // ===================== RESULT SCREEN ========================
  // =============================================================
  if (screen === 'result' && gameState) {
    const won = gameState.winner === 'player';
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center px-6 relative"
        style={{ background: 'linear-gradient(180deg, #0b1128 0%, #151d3b 100%)' }}
      >
        <div
          className="rounded-2xl p-6 w-full max-w-sm text-center relative overflow-hidden z-10"
          style={{
            background: 'linear-gradient(135deg, rgba(21,29,59,0.95), rgba(14,20,45,0.95))',
            border: `2px solid ${won ? 'rgba(255,215,0,0.5)' : 'rgba(239,68,68,0.3)'}`,
            boxShadow: `inset 0 0 30px ${won ? 'rgba(255,215,0,0.08)' : 'rgba(239,68,68,0.05)'}, 0 8px 32px rgba(0,0,0,0.5)`,
          }}
        >
          <div className="kc-result-icon mb-2">
            <span className="text-5xl block">{won ? '🏆' : '💀'}</span>
          </div>
          <h2
            className="text-3xl font-bold mb-1"
            style={{
              color: won ? '#ffd700' : '#ef4444',
              textShadow: `0 0 20px ${won ? 'rgba(255,215,0,0.4)' : 'rgba(239,68,68,0.4)'}`,
            }}
          >
            {won ? '勝利！' : '敗北...'}
          </h2>
          <div
            className="rounded-lg px-4 py-2 mb-4 mx-auto"
            style={{
              background: won ? 'rgba(255,215,0,0.08)' : 'rgba(239,68,68,0.1)',
              border: `1px solid ${won ? 'rgba(255,215,0,0.2)' : 'rgba(239,68,68,0.2)'}`,
            }}
          >
            <p className="text-sm font-bold" style={{ color: won ? '#ffd700' : '#fca5a5' }}>
              {gameState.message}
            </p>
          </div>

          <div className="flex items-center justify-center gap-4 mb-4">
            <div className="text-center px-3 py-2 rounded-lg" style={{ background: 'rgba(34,197,94,0.12)' }}>
              <p className="text-[9px] text-green-200/60 mb-0.5">あなたのファン</p>
              <span className="text-2xl font-black text-green-300">{gameState.playerFans}</span>
            </div>
            <span className="text-xl font-black text-amber-200/50">VS</span>
            <div className="text-center px-3 py-2 rounded-lg" style={{ background: 'rgba(239,68,68,0.12)' }}>
              <p className="text-[9px] text-red-200/60 mb-0.5">相手のファン</p>
              <span className="text-2xl font-black text-red-300">{gameState.aiFans}</span>
            </div>
          </div>

          {/* Round history */}
          <div className="rounded-lg p-2 mb-4 text-left" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)' }}>
            {gameState.history.map((r) => (
              <div key={r.round} className="flex items-center justify-between text-[11px] py-0.5">
                <span className="text-amber-200/60">R{r.round}</span>
                <span className="text-amber-100 truncate mx-2">{r.playerCard.name} vs {r.aiCard.name}</span>
                <span className={`font-black ${r.winner === 'player' ? 'text-green-400' : r.winner === 'ai' ? 'text-red-400' : 'text-amber-300'}`}>
                  {r.winner === 'player' ? `+${r.trophyFans}` : r.winner === 'ai' ? `-${r.trophyFans}` : '—'}
                </span>
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => { setScreen('title'); setGameState(null); }}
              className="rpg-btn rpg-btn-blue flex-1 py-3"
            >
              再挑戦
            </button>
            <button onClick={handleFinish} className="rpg-btn rpg-btn-gold flex-1 py-3">
              リザルトへ
            </button>
          </div>
        </div>
      </div>
    );
  }

  // =============================================================
  // ===================== PLAYING SCREEN =======================
  // =============================================================
  if (!gameState) return null;

  const currentTrophy = gameState.trophyFans[gameState.round - 1] ?? 0;

  return (
    <div className="min-h-screen flex flex-col relative" style={{ background: 'linear-gradient(180deg, #0b1128 0%, #131b38 50%, #0e1430 100%)' }}>
      {/* ===== Header ===== */}
      <div
        className="px-3 py-2 flex items-center justify-between shrink-0"
        style={{
          background: 'linear-gradient(180deg, rgba(11,17,40,0.98), rgba(16,22,48,0.95))',
          borderBottom: '2px solid rgba(255,215,0,0.2)',
          boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
        }}
      >
        <div className="flex items-center gap-2">
          <button onClick={() => navigate('/games')} className="text-amber-200/60 text-xl font-black hover:text-amber-200 px-2">
            ✕
          </button>
          <button
            onClick={() => setFastMode((v) => !v)}
            className="text-xs font-black px-2.5 py-1.5 rounded-lg transition-all"
            style={{
              background: fastMode ? 'rgba(255,215,0,0.25)' : 'rgba(255,255,255,0.08)',
              border: `2px solid ${fastMode ? 'rgba(255,215,0,0.6)' : 'rgba(255,255,255,0.2)'}`,
              color: fastMode ? '#ffd700' : 'rgba(255,255,255,0.7)',
            }}
          >
            {fastMode ? '⏩ 早送りON' : '⏩ 早送りOFF'}
          </button>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-center">
            <p className="text-[10px] font-bold text-amber-200/50">R</p>
            <p className="text-xl font-black" style={{ color: '#ffd700', textShadow: '0 0 8px rgba(255,215,0,0.5)' }}>
              {gameState.round}/{TOTAL_ROUNDS}
            </p>
          </div>
          <div className="text-center px-2 py-1 rounded-lg" style={{ background: 'rgba(255,215,0,0.12)', border: '1.5px solid rgba(255,215,0,0.4)' }}>
            <p className="text-[9px] font-bold text-amber-200/70">トロフィー</p>
            <p className="text-sm font-black" style={{ color: '#ffd700' }}>🏆 {currentTrophy}ファン</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-center">
            <p className="text-[10px] font-bold text-green-200/60">あなた</p>
            <p className="text-lg font-black text-green-300">{gameState.playerFans}</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] font-bold text-red-200/60">相手</p>
            <p className="text-lg font-black text-red-300">{gameState.aiFans}</p>
          </div>
          <div className="text-center relative">
            <p className="text-[10px] font-bold text-amber-200/50">ALT</p>
            <p className="text-sm font-black" style={{ color: '#ffd700' }}>
              {altBalance !== null ? altBalance.toLocaleString() : '---'}
            </p>
            {altRewardPopup && (
              <div
                key={altRewardPopup.key}
                className="absolute -bottom-10 left-1/2 z-50 pointer-events-none whitespace-nowrap"
                style={{ animation: 'kcAltRewardFloat 2.5s ease-out forwards', transform: 'translateX(-50%)' }}
              >
                <div className="rounded-lg px-2 py-1" style={{ background: 'rgba(255,215,0,0.3)', border: '1.5px solid rgba(255,215,0,0.6)' }}>
                  <span className="text-xs font-black" style={{ color: '#ffd700' }}>+{altRewardPopup.alt} ALT</span>
                </div>
                {altRewardPopup.xp > 0 && (
                  <p className="text-[10px] text-green-400 font-bold mt-0.5 text-center">+{altRewardPopup.xp} XP</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* AI Bench */}
      <BenchDisplay side="ai" bench={gameState.ai.bench} deckCount={gameState.ai.deck.length} />

      {/* ===== Battle Field ===== */}
      <div className="flex-1 flex flex-col items-center justify-center px-3 py-3 gap-3 relative min-h-0 overflow-hidden">
        {/* AI Card */}
        <div className="text-center">
          {gameState.aiCard && revealStep !== 'intro' ? (
            <div className="relative inline-block">
              <CardDisplay card={gameState.aiCard} isWinner={revealStep === 'outcome' && gameState.roundWinner === 'ai'} size="sm" />
              {revealStep === 'compare' || revealStep === 'outcome' ? (
                <p className="mt-1 text-lg font-black text-red-400" style={{ textShadow: '0 0 10px rgba(239,68,68,0.6)' }}>
                  ⚔️ {gameState.aiPower}
                </p>
              ) : null}
            </div>
          ) : (
            <div className="inline-block rounded-xl" style={{ width: 120, height: 150, background: 'rgba(239,68,68,0.1)', border: '2px dashed rgba(239,68,68,0.35)' }}>
              <div className="flex items-center justify-center h-full text-3xl opacity-50">🎴</div>
            </div>
          )}
        </div>

        {/* Center trophy banner */}
        <div className="flex items-center gap-3 w-full max-w-sm justify-center">
          <div className="h-0.5 flex-1" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,215,0,0.5))' }} />
          <div
            className={`px-4 py-2 rounded-full ${trophyFlash ? 'kc-flag-pulse' : ''}`}
            style={{
              background: trophyFlash === 'player' ? 'radial-gradient(circle, rgba(34,197,94,0.4), rgba(34,197,94,0.1))'
                : trophyFlash === 'ai' ? 'radial-gradient(circle, rgba(239,68,68,0.4), rgba(239,68,68,0.1))'
                : 'radial-gradient(circle, rgba(255,215,0,0.3), rgba(255,215,0,0.08))',
              border: `3px solid ${trophyFlash === 'player' ? 'rgba(34,197,94,0.8)' : trophyFlash === 'ai' ? 'rgba(239,68,68,0.8)' : 'rgba(255,215,0,0.7)'}`,
              boxShadow: '0 0 20px rgba(255,215,0,0.35)',
            }}
          >
            <span className="text-3xl">🏆</span>
            <p className="text-xs font-black mt-0.5" style={{ color: '#ffd700' }}>{currentTrophy} ファン</p>
          </div>
          <div className="h-0.5 flex-1" style={{ background: 'linear-gradient(90deg, rgba(255,215,0,0.5), transparent)' }} />
        </div>

        {/* Player Card */}
        <div className="text-center">
          {gameState.playerCard && revealStep !== 'intro' ? (
            <div className="relative inline-block">
              <CardDisplay card={gameState.playerCard} isWinner={(revealStep === 'outcome' && gameState.roundWinner === 'player') || roundWinGlow} size="sm" />
              {revealStep === 'compare' || revealStep === 'outcome' ? (
                <p className="mt-1 text-lg font-black text-green-400" style={{ textShadow: '0 0 10px rgba(34,197,94,0.6)' }}>
                  ⚔️ {gameState.playerPower}
                </p>
              ) : null}
            </div>
          ) : (
            <div className="inline-block rounded-xl" style={{ width: 120, height: 150, background: 'rgba(34,197,94,0.1)', border: '2px dashed rgba(34,197,94,0.35)' }}>
              <div className="flex items-center justify-center h-full text-3xl opacity-50">🎴</div>
            </div>
          )}
        </div>

        {/* Round intro banner */}
        {gameState.phase === 'round_intro' && revealStep === 'done' && (
          <div className="kc-round-intro-banner">
            <p className="text-4xl font-black" style={{ color: '#ffd700', textShadow: '0 0 30px rgba(255,215,0,0.8)' }}>
              ラウンド {gameState.round}
            </p>
            <p className="text-sm font-bold text-amber-200/80 mt-1">🏆 トロフィー: {currentTrophy}ファン</p>
          </div>
        )}
        {revealStep === 'intro' && (
          <div className="kc-round-intro-banner">
            <p className="text-3xl font-black" style={{ color: '#ffd700', textShadow: '0 0 30px rgba(255,215,0,0.8)' }}>
              ⚔️ カード公開！ ⚔️
            </p>
          </div>
        )}

        {/* Round end / proceed button */}
        {gameState.phase === 'round_end' && revealStep === 'done' && (
          <div className="text-center">
            <p className="text-2xl font-black mb-2" style={{ color: gameState.roundWinner === 'player' ? '#4ade80' : '#ff6b6b', textShadow: '0 0 20px currentColor' }}>
              {gameState.roundWinner === 'player'
                ? `🏆 +${currentTrophy}ファン 獲得！`
                : `💥 -${currentTrophy}ファン 奪われた`}
            </p>
            <button onClick={enterDeckPhase} className="rpg-btn rpg-btn-gold px-8 py-3 text-base kc-draw-btn">
              🃏 デッキフェイズへ
            </button>
          </div>
        )}

        {/* Game over inline message */}
        {gameState.phase === 'game_over' && (
          <div className="text-center kc-card-reveal">
            <span className="text-5xl block mb-2">{gameState.winner === 'player' ? '🎉' : '💀'}</span>
            <p className="text-lg font-bold" style={{ color: gameState.winner === 'player' ? '#ffd700' : '#ef4444' }}>
              {gameState.message}
            </p>
          </div>
        )}
      </div>

      {/* Player Bench */}
      <BenchDisplay side="player" bench={gameState.player.bench} deckCount={gameState.player.deck.length} />

      {/* ===== Deck Phase Overlay ===== */}
      {gameState.phase === 'deck_phase' && deckOffer && !activeQuiz && !swapState && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-5" style={{ background: 'rgba(0,0,0,0.85)' }}>
          <div
            className="rounded-2xl p-5 w-full max-w-md"
            style={{
              background: 'linear-gradient(135deg, rgba(21,29,59,0.98), rgba(14,20,45,0.98))',
              border: '3px solid rgba(255,215,0,0.5)',
              boxShadow: '0 12px 40px rgba(0,0,0,0.7), 0 0 32px rgba(255,215,0,0.2)',
            }}
          >
            <h3 className="text-xl font-black text-center mb-1" style={{ color: '#ffd700' }}>
              📚 デッキフェイズ
            </h3>
            <p className="text-xs text-amber-200/70 text-center mb-4">
              カードをタップしてクイズに挑戦！正解でデッキに追加
              <br />
              （現在 {gameState.player.deck.length}/{MAX_DECK_SIZE} 枚）
            </p>
            <div className="grid grid-cols-2 gap-3 mb-4">
              {deckOffer.cards.map((card, i) => {
                const blocked = deckOffer.blocked.has(i);
                const acquired = deckOffer.acquired.has(i);
                return (
                  <button
                    key={i}
                    onClick={() => handleCardTap(i)}
                    disabled={blocked || acquired}
                    className="rounded-xl p-2 relative overflow-hidden transition-all active:scale-95"
                    style={{
                      background: acquired ? 'rgba(34,197,94,0.15)' : blocked ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.04)',
                      border: acquired ? '2px solid rgba(34,197,94,0.6)' : blocked ? '2px solid rgba(239,68,68,0.5)' : '2px solid rgba(255,215,0,0.4)',
                      opacity: blocked ? 0.5 : 1,
                    }}
                  >
                    <div className="flex justify-center">
                      <CardDisplay card={card} size="sm" />
                    </div>
                    {acquired && (
                      <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
                        <span className="text-3xl">✅</span>
                      </div>
                    )}
                    {blocked && (
                      <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
                        <span className="text-3xl">❌</span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleRedraw}
                disabled={deckOffer.redrawsLeft <= 0 || deckOffer.acquired.size > 0}
                className="rpg-btn rpg-btn-blue flex-1 py-2.5 text-sm"
                style={{ opacity: (deckOffer.redrawsLeft <= 0 || deckOffer.acquired.size > 0) ? 0.5 : 1 }}
              >
                🔄 引き直し ({deckOffer.redrawsLeft})
              </button>
              <button onClick={handleContinueNextRound} className="rpg-btn rpg-btn-gold flex-1 py-2.5 text-sm">
                次のラウンドへ ▶
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Deck Phase Quiz Overlay ===== */}
      {activeQuiz && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center p-5" style={{ background: 'rgba(0,0,0,0.9)' }}>
          <div
            className="rounded-2xl p-5 w-full max-w-md"
            style={{
              background: 'linear-gradient(135deg, rgba(21,29,59,0.98), rgba(14,20,45,0.98))',
              border: '3px solid rgba(255,215,0,0.6)',
              boxShadow: '0 12px 40px rgba(0,0,0,0.8), 0 0 32px rgba(255,215,0,0.3)',
            }}
          >
            <div className="flex items-center justify-center gap-2 mb-3">
              <CardMini card={activeQuiz.card} />
              <span className="text-sm font-bold text-amber-200/70">のクイズ！</span>
            </div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold text-amber-200/70">⏱ 制限時間</span>
              <span className={`text-2xl font-black ${quizTimer <= 3 ? 'text-red-400 kc-pulse-text' : 'text-amber-100'}`}>
                {quizTimer}秒
              </span>
            </div>
            <div className="h-2 rounded-full mb-4" style={{ background: 'rgba(255,255,255,0.08)' }}>
              <div
                className="h-full rounded-full transition-all duration-1000"
                style={{ width: `${(quizTimer / 10) * 100}%`, background: quizTimer <= 3 ? '#ef4444' : '#ffd700' }}
              />
            </div>
            <p className="text-white font-black mb-4 leading-relaxed text-center" style={{ fontSize: '1.2rem', textShadow: '0 2px 6px rgba(0,0,0,0.9)' }}>
              {activeQuiz.quiz.question}
            </p>
            <div className="space-y-2.5">
              {activeQuiz.quiz.choices.map((choice, i) => {
                let btnStyle: React.CSSProperties = { background: 'rgba(255,255,255,0.06)', border: '2px solid rgba(255,255,255,0.15)' };
                if (showQuizResult) {
                  if (i === activeQuiz.quiz.correctIndex) btnStyle = { background: 'rgba(34,197,94,0.3)', border: '2px solid rgba(34,197,94,0.8)' };
                  else if (i === selectedAnswer && i !== activeQuiz.quiz.correctIndex) btnStyle = { background: 'rgba(239,68,68,0.3)', border: '2px solid rgba(239,68,68,0.8)' };
                }
                return (
                  <button
                    key={i}
                    onClick={() => handleQuizAnswer(i)}
                    disabled={selectedAnswer !== null}
                    className="w-full text-left px-4 rounded-xl font-bold transition-all active:scale-[0.97] flex items-center gap-3"
                    style={{
                      ...btnStyle,
                      minHeight: '58px',
                      fontSize: '1rem',
                      color: showQuizResult && i === activeQuiz.quiz.correctIndex ? '#4ade80' : showQuizResult && i === selectedAnswer ? '#ff6b6b' : 'rgba(255,255,255,0.95)',
                    }}
                  >
                    <span className="font-black px-2 py-1 rounded-lg shrink-0" style={{ background: 'rgba(255,215,0,0.2)', color: '#ffd700' }}>
                      {['A', 'B', 'C', 'D'][i]}
                    </span>
                    <span className="flex-1">{choice}</span>
                  </button>
                );
              })}
            </div>
            {showQuizResult && (
              <div className="mt-3 text-center kc-quiz-result-pop">
                <span className={`font-black ${selectedAnswer === activeQuiz.quiz.correctIndex ? 'text-green-400' : 'text-red-400'}`} style={{ fontSize: '1.4rem' }}>
                  {selectedAnswer === activeQuiz.quiz.correctIndex
                    ? '✨ 正解！カード獲得！ ✨'
                    : selectedAnswer === -1
                      ? '⏱ 時間切れ...このカードは選べない'
                      : '❌ 不正解...このカードは選べない'}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== Swap Overlay (deck over MAX) ===== */}
      {swapState && (
        <div className="fixed inset-0 z-[170] flex items-center justify-center p-5" style={{ background: 'rgba(0,0,0,0.9)' }}>
          <div
            className="rounded-2xl p-5 w-full max-w-md"
            style={{
              background: 'linear-gradient(135deg, rgba(21,29,59,0.98), rgba(14,20,45,0.98))',
              border: '3px solid rgba(255,170,0,0.7)',
            }}
          >
            <h3 className="text-lg font-black text-center mb-2" style={{ color: '#ffaa00' }}>
              デッキ満杯！入れ替えるカードを選んで
            </h3>
            <p className="text-xs text-amber-200/70 text-center mb-3">
              新カード: <span className="font-black text-amber-100">{swapState.incoming.name}</span>
            </p>
            <div className="grid grid-cols-3 gap-2 max-h-96 overflow-y-auto">
              {gameState.player.deck.map((c, i) => (
                <button
                  key={c.id + '-' + i}
                  onClick={() => handleSwapPick(i)}
                  className="rounded-lg p-1 active:scale-95"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1.5px solid rgba(255,255,255,0.2)' }}
                >
                  <CardDisplay card={c} size="sm" />
                </button>
              ))}
            </div>
            <button
              onClick={() => setSwapState(null)}
              className="w-full mt-3 text-xs text-amber-200/60 py-2"
            >
              キャンセル（このカードは捨てる）
            </button>
          </div>
        </div>
      )}

      {/* ===== Styles ===== */}
      <style>{`
        @keyframes kcFlagPulse { 0% { transform: scale(1); } 50% { transform: scale(1.25); } 100% { transform: scale(1); } }
        .kc-flag-pulse { animation: kcFlagPulse 0.9s ease-out; }
        .kc-card-reveal { animation: kcCardReveal 0.5s ease-out; }
        @keyframes kcCardReveal { 0% { opacity: 0; transform: scale(0.7); } 100% { opacity: 1; transform: scale(1); } }
        .kc-pulse-text { animation: kcPulseText 1s ease-in-out infinite; }
        @keyframes kcPulseText { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        .kc-win-glow { animation: kcWinGlow 1s ease-in-out infinite; border-color: rgba(255,215,0,0.8) !important; }
        @keyframes kcWinGlow {
          0%, 100% { box-shadow: 0 0 8px rgba(255,215,0,0.3), 0 0 16px rgba(255,215,0,0.1); }
          50%      { box-shadow: 0 0 20px rgba(255,215,0,0.6), 0 0 40px rgba(255,215,0,0.3); }
        }
        .kc-win-badge { animation: kcWinBadgePulse 0.8s ease-in-out infinite; }
        @keyframes kcWinBadgePulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.15); } }
        .kc-draw-btn { animation: kcDrawPulse 2s ease-in-out infinite; }
        @keyframes kcDrawPulse {
          0%, 100% { box-shadow: 0 4px 0 rgba(180,140,0,1), 0 6px 12px rgba(0,0,0,0.3), 0 0 15px rgba(255,215,0,0.2); }
          50%      { box-shadow: 0 4px 0 rgba(180,140,0,1), 0 6px 12px rgba(0,0,0,0.3), 0 0 30px rgba(255,215,0,0.4); }
        }
        .kc-result-icon { animation: kcResultBounce 0.8s ease-out; }
        @keyframes kcResultBounce { 0% { transform: scale(0); } 50% { transform: scale(1.3); } 100% { transform: scale(1); } }
        .kc-round-intro-banner {
          position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center;
          pointer-events: none; z-index: 40;
          animation: kcBannerFade 1s ease-out forwards;
        }
        @keyframes kcBannerFade {
          0%   { opacity: 0; transform: translateY(-14px) scale(0.95); }
          25%  { opacity: 1; transform: translateY(0) scale(1); }
          75%  { opacity: 1; transform: translateY(0) scale(1); }
          100% { opacity: 0; transform: translateY(14px) scale(0.95); }
        }
        .kc-quiz-result-pop { animation: kcQuizResultPop 0.5s ease-out; }
        @keyframes kcQuizResultPop { 0% { opacity: 0; transform: scale(0.7); } 60% { opacity: 1; transform: scale(1.15); } 100% { opacity: 1; transform: scale(1); } }
        @keyframes kcAltRewardFloat {
          0%   { opacity: 0; transform: translateX(-50%) translateY(0) scale(0.7); }
          15%  { opacity: 1; transform: translateX(-50%) translateY(-4px) scale(1.1); }
          30%  { opacity: 1; transform: translateX(-50%) translateY(-8px) scale(1); }
          80%  { opacity: 1; transform: translateX(-50%) translateY(-12px) scale(1); }
          100% { opacity: 0; transform: translateX(-50%) translateY(-20px) scale(0.9); }
        }
        .kc-bench-full { background: rgba(239,68,68,0.18) !important; }
        .kc-bench-last-slot { background: rgba(255,200,0,0.1) !important; }
        .kc-warn-pulse { animation: kcWarnPulse 0.8s ease-in-out infinite; }
        @keyframes kcWarnPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }
      `}</style>
    </div>
  );
}

// =====================================================================
// ===================== Sub-components ================================
// =====================================================================

type BenchSlotUI = { name: string; card: BattleCard; count: number };

function BenchDisplay({ side, bench, deckCount }: {
  side: 'player' | 'ai'; bench: BenchSlotUI[]; deckCount: number;
}) {
  const isPlayer = side === 'player';
  const label = isPlayer ? 'あなた' : 'AI';
  const labelColor = isPlayer ? '#22c55e' : '#ef4444';
  const emptySlots = BENCH_MAX_SLOTS - bench.length;
  const isFull = bench.length >= BENCH_MAX_SLOTS;
  const isLastSlot = emptySlots === 1;
  const isWarning = emptySlots <= 2 && emptySlots > 0;
  const [detailSlot, setDetailSlot] = useState<BenchSlotUI | null>(null);

  return (
    <>
      <div
        className={`px-3 py-2 shrink-0 ${isFull ? 'kc-bench-full' : isLastSlot ? 'kc-bench-last-slot' : ''}`}
        style={{
          borderTop: isPlayer ? '2px solid rgba(255,215,0,0.15)' : 'none',
          borderBottom: !isPlayer ? '2px solid rgba(255,215,0,0.15)' : 'none',
          background: isFull ? 'rgba(239,68,68,0.18)' : isLastSlot ? 'rgba(255,200,0,0.1)' : isWarning ? 'rgba(239,68,68,0.08)' : 'rgba(0,0,0,0.25)',
        }}
      >
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2">
            <span className="text-sm font-black" style={{ color: labelColor, textShadow: `0 0 8px ${labelColor}66` }}>{label}</span>
            <span className="text-xs font-bold text-amber-200/70">山札: <span className="text-amber-100">{deckCount}</span></span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-sm font-black ${isWarning || isFull ? 'text-red-400' : 'text-amber-100'}`}>
              ベンチ {bench.length}/{BENCH_MAX_SLOTS}
            </span>
            {isFull ? (
              <span className="text-xs font-black px-2 py-0.5 rounded kc-warn-pulse" style={{ background: 'rgba(239,68,68,0.5)', color: '#fff', border: '2px solid rgba(239,68,68,0.9)' }}>
                満杯！
              </span>
            ) : isLastSlot ? (
              <span className="text-xs font-black px-2 py-0.5 rounded kc-warn-pulse" style={{ background: 'rgba(255,200,0,0.3)', color: '#ffd700', border: '2px solid rgba(255,200,0,0.7)' }}>
                ⚠️ 残り1枠！
              </span>
            ) : (
              <span className="text-xs font-black px-2 py-0.5 rounded" style={{ background: 'rgba(255,215,0,0.15)', color: '#ffd700', border: '1.5px solid rgba(255,215,0,0.3)' }}>
                残り{emptySlots}枠
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-1.5">
          {Array.from({ length: BENCH_MAX_SLOTS }).map((_, i) => {
            const slot = bench[i];
            if (!slot) {
              return (
                <div key={`empty-${i}`} className="flex-1 rounded-lg text-center relative" style={{ background: 'rgba(255,255,255,0.04)', border: '1.5px dashed rgba(255,255,255,0.1)', minHeight: '54px' }}>
                  <span className="text-[10px] font-bold text-amber-200/30 block mt-4">空</span>
                </div>
              );
            }
            const catInfo = CATEGORY_INFO[slot.card.category];
            return (
              <button
                key={slot.name}
                onClick={() => isPlayer && setDetailSlot(slot)}
                className="flex-1 rounded-lg relative overflow-hidden transition-all active:scale-95"
                style={{ background: `${catInfo.color}1a`, border: `2px solid ${catInfo.color}77`, minHeight: '54px', cursor: isPlayer ? 'pointer' : 'default' }}
              >
                {slot.card.imageUrl ? (
                  <img src={slot.card.imageUrl} alt={slot.name} className="absolute inset-0 w-full h-full object-cover opacity-70" />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-2xl opacity-50">{catInfo.emoji}</div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
                <div className="relative z-10 flex flex-col justify-end h-full p-1">
                  <p className="text-[9px] font-black text-white leading-tight truncate" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.95)' }}>{slot.name}</p>
                </div>
                {slot.count > 1 && (
                  <div className="absolute top-0.5 right-0.5 z-20 rounded-full min-w-[16px] h-[16px] flex items-center justify-center px-1" style={{ background: '#ffd700', border: '1.5px solid rgba(0,0,0,0.6)' }}>
                    <span className="text-[9px] font-black text-black">×{slot.count}</span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {detailSlot && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6" style={{ background: 'rgba(0,0,0,0.75)' }} onClick={() => setDetailSlot(null)}>
          <div
            className="rounded-2xl p-5 max-w-xs w-full relative"
            style={{
              background: 'linear-gradient(135deg, rgba(21,29,59,0.98), rgba(14,20,45,0.98))',
              border: `3px solid ${CATEGORY_INFO[detailSlot.card.category].color}`,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button onClick={() => setDetailSlot(null)} className="absolute top-2 right-3 text-amber-200/60 text-2xl font-black hover:text-white">✕</button>
            <div className="flex justify-center mb-3">
              <CardDisplay card={detailSlot.card} />
            </div>
            <div className="text-center">
              <p className="text-xl font-black text-amber-100 mb-1">{detailSlot.name}</p>
              <p className="text-sm font-bold mb-2" style={{ color: CATEGORY_INFO[detailSlot.card.category].color }}>
                {CATEGORY_INFO[detailSlot.card.category].label} / {RARITY_INFO[detailSlot.card.rarity].label}
                {detailSlot.card.attackPower !== undefined && detailSlot.card.defensePower !== undefined
                  ? <> / ⚔️{detailSlot.card.attackPower} / 🛡️{detailSlot.card.defensePower}</>
                  : <> / パワー {detailSlot.card.power}</>}
              </p>
              <p className="text-xs text-amber-200/80 leading-relaxed mb-3">{detailSlot.card.effectDescription}</p>
              <div className="rounded-lg p-2" style={{ background: 'rgba(255,215,0,0.1)', border: '1px solid rgba(255,215,0,0.3)' }}>
                <p className="text-xs font-bold text-amber-200/70">ベンチ内枚数</p>
                <p className="text-2xl font-black" style={{ color: '#ffd700' }}>×{detailSlot.count}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function CardDisplay({ card, isDefense, isWinner, size }: { card: BattleCard; isDefense?: boolean; isWinner?: boolean; size?: 'sm' | 'md'; }) {
  const catInfo = CATEGORY_INFO[card.category];
  const rarInfo = RARITY_INFO[card.rarity];
  const [imgLoaded, setImgLoaded] = useState(false);
  const w = size === 'sm' ? 120 : 200;
  const h = size === 'sm' ? 150 : 260;
  return (
    <div
      className={`inline-block rounded-xl p-0 relative overflow-hidden ${isWinner ? 'kc-win-glow' : ''}`}
      style={{
        background: 'linear-gradient(135deg, rgba(21,29,59,0.95), rgba(14,20,45,0.95))',
        border: `3px solid ${isWinner ? 'rgba(255,215,0,0.8)' : isDefense ? 'rgba(100,180,255,0.5)' : `${catInfo.color}55`}`,
        boxShadow: isWinner
          ? '0 0 24px rgba(255,215,0,0.55), 0 0 48px rgba(255,215,0,0.25), 0 6px 20px rgba(0,0,0,0.5)'
          : '0 6px 20px rgba(0,0,0,0.5)',
        width: `${w}px`, height: `${h}px`,
      }}
    >
      {!imgLoaded && (
        <div className="absolute inset-0 flex items-center justify-center animate-pulse" style={{ background: `linear-gradient(135deg, ${catInfo.color}15, rgba(14,20,45,0.95))` }}>
          <span className={`${size === 'sm' ? 'text-4xl' : 'text-6xl'} opacity-40`}>{catInfo.emoji}</span>
        </div>
      )}
      {card.imageUrl && (
        <img
          src={card.imageUrl}
          alt={card.name}
          className={`w-full h-full object-cover transition-opacity duration-300 ${imgLoaded ? 'opacity-100' : 'opacity-0'}`}
          loading="eager"
          decoding="async"
          onLoad={() => setImgLoaded(true)}
          onError={() => setImgLoaded(true)}
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent flex flex-col justify-between p-2">
        <div className="flex items-start justify-between">
          <div className={size === 'sm' ? 'text-xl' : 'text-3xl'}>{catInfo.emoji}</div>
          <div className={`px-${size === 'sm' ? '1.5' : '2'} py-0.5 rounded text-[${size === 'sm' ? '10px' : '12px'}] font-black`} style={{ background: rarInfo.bgColor, color: rarInfo.color }}>
            {rarInfo.label}
          </div>
        </div>
        <div>
          <p className={`font-black text-white drop-shadow-lg ${size === 'sm' ? 'text-sm leading-tight mb-0.5' : 'text-lg leading-tight mb-1'}`} style={{ textShadow: '0 2px 6px rgba(0,0,0,0.95)' }}>
            {card.name}
          </p>
          <div className="flex items-center justify-between">
            {card.attackPower !== undefined && card.defensePower !== undefined ? (
              <div className="flex flex-col items-end gap-0 ml-auto leading-none">
                <span className={`font-black ${size === 'sm' ? 'text-xs' : 'text-sm'}`} style={{ color: '#ff6b6b' }}>⚔️{card.attackPower}</span>
                <span className={`font-black ${size === 'sm' ? 'text-xs' : 'text-sm'}`} style={{ color: '#64b5ff' }}>🛡️{card.defensePower}</span>
              </div>
            ) : (
              <div className="flex items-baseline gap-0.5 ml-auto">
                <span className={`font-black ${size === 'sm' ? 'text-xl' : 'text-3xl'}`} style={{ color: '#ffd700' }}>{card.power}</span>
                <span className={`font-bold ${size === 'sm' ? 'text-xs' : 'text-sm'}`} style={{ color: '#ffd700' }}>P</span>
              </div>
            )}
          </div>
        </div>
      </div>
      {isDefense && <div className="absolute top-1.5 left-1.5"><span className={size === 'sm' ? 'text-base' : 'text-xl'}>🛡️</span></div>}
      {isWinner && <div className="absolute top-1.5 right-1.5 kc-win-badge"><span className={`${size === 'sm' ? 'text-lg' : 'text-2xl'} drop-shadow-lg`}>👑</span></div>}
    </div>
  );
}

function CardMini({ card }: { card: BattleCard }) {
  const catInfo = CATEGORY_INFO[card.category];
  const rarInfo = RARITY_INFO[card.rarity];
  return (
    <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg overflow-hidden" style={{ background: `${catInfo.color}15`, border: `1px solid ${catInfo.color}33` }}>
      {card.imageUrl && <img src={card.imageUrl} alt={card.name} className="w-6 h-6 rounded object-cover" />}
      {!card.imageUrl && <span className="text-sm">{catInfo.emoji}</span>}
      <span className="text-[10px] font-bold text-amber-100">{card.name}</span>
      <span className="text-[9px] font-bold" style={{ color: rarInfo.color }}>{rarInfo.label}</span>
    </div>
  );
}
