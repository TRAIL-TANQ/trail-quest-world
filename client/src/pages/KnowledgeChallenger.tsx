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
  MIN_DECK_SIZE,
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
  startBattle,
  beginAttackLoop,
  revealNextAttackCard,
  hasAttackSucceeded,
  resolveSubBattleWin,
  continueAfterResolve,
  getBaseAttack,
  getBaseDefense,
  addCardToDeck,
  removeCardFromDeck,
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
import { saveHallOfFame } from '@/lib/hallOfFameService';
import { toast } from 'sonner';

type ScreenPhase = 'title' | 'playing' | 'result';

// Timing constants (ms) for the battle cinematic. fast mode scales by 0.3.
const TURN_BANNER_MS      = 1000;  // "あなたの攻撃！" / "あなたが防御中！"
const DEFENDER_SHOW_MS    = 800;   // defender's card with power label
const ATTACK_CARD_REVEAL_MS = 800; // each attacker card back → flip → power label
const RESOLVE_BANNER_MS   = 2000;  // "🏆 フラッグ奪取！" outcome banner

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
  // CinematicStep drives the battle animation lifecycle:
  //   idle          : no animation (deck phase etc.)
  //   turn_banner   : "あなたの攻撃！" / "あなたが防御中！" 1s
  //   defender_show : defender card on field, "🛡️ 防御パワー X" 0.8s
  //   attack_reveal : one attacker card animating in (back → flip → settled)
  //   resolve       : "🏆 フラッグ奪取！" outcome banner 2s
  //   game_over     : end banner
  type CinematicStep =
    | 'idle'
    | 'turn_banner'
    | 'defender_show'
    | 'attack_reveal'
    | 'resolve'
    | 'game_over';
  const [cineStep, setCineStep] = useState<CinematicStep>('idle');
  // Skip / manual advance via a latch: the battle loop creates an
  // `advanceLatchRef` per wait, and clicking "次へ" resolves it early so the
  // loop jumps straight to the next step. Using a latch (instead of deps-based
  // cancellation) means the loop is never prematurely killed by state changes.
  const advanceLatchRef = useRef<(() => void) | null>(null);
  // Set to true only when the component unmounts, so the long-lived battle
  // loop can bail out cleanly without being cancelled mid-way by phase changes.
  const unmountedRef = useRef(false);
  // Prevents multiple concurrent battle loops. `false` → no loop running,
  // `true` → loop in progress and the phase-change useEffect should skip.
  const battleRunningRef = useRef(false);
  // Player-action latch for manual attacker reveals (no auto-timeout).
  const playerActionLatchRef = useRef<(() => void) | null>(null);
  // True while the loop is waiting for the player to click "カードを出す".
  const [waitingForPlayerReveal, setWaitingForPlayerReveal] = useState(false);
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
  // デッキフェイズ中のカード削除: 確認ダイアログと削除アニメ用 state
  const [pendingRemoveIdx, setPendingRemoveIdx] = useState<number | null>(null);
  const [fadingOutIdx, setFadingOutIdx] = useState<number | null>(null);
  // Mobile-only collapse toggle for the "current deck" panel in the deck phase.
  // PC (md+) always shows it expanded.
  const [deckPanelCollapsed, setDeckPanelCollapsed] = useState(false);

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
    console.log('[KC] startGame: initial phase =', state.phase, 'round =', state.round);
    setGameState(state);
    setScreen('playing');
    setCineStep('idle');
    advanceLatchRef.current = null;
    battleRunningRef.current = false;
    setDeckOffer(null);
    setActiveQuiz(null);
    setSwapState(null);
  }, [clearStepTimeouts, previewDeck, stageId]);

  // ===== Phase transition tracking (debug) =====
  const lastLoggedPhaseRef = useRef<string | null>(null);
  useEffect(() => {
    const phase = gameState?.phase;
    if (phase && phase !== lastLoggedPhaseRef.current) {
      console.log('[KC] Current phase:', phase, '/ round:', gameState?.round, '/ cineStep:', cineStep);
      lastLoggedPhaseRef.current = phase;
    }
  }, [gameState?.phase, gameState?.round, cineStep]);

  // ===== Effect telop auto-clear (1.5s) =====
  useEffect(() => {
    if (!gameState?.effectTelop) return;
    const id = window.setTimeout(() => {
      setGameState((prev) => (prev && prev.effectTelop ? { ...prev, effectTelop: null } : prev));
    }, 1500);
    return () => clearTimeout(id);
  }, [gameState?.effectTelop?.key]);

  // ===== Bug 2 safety: clear activeQuiz when phase leaves deck_phase =====
  useEffect(() => {
    if (gameState?.phase && gameState.phase !== 'deck_phase') {
      setActiveQuiz((prev) => {
        if (prev) console.log('[KC] clearing activeQuiz on phase change to', gameState.phase);
        return null;
      });
      setShowQuizResult(false);
      setSelectedAnswer(null);
    }
  }, [gameState?.phase]);

  // ===== Deck phase setup (ONE-TIME at round 1) =====
  // 新しいバトルモデル: デッキフェイズは開始時の1回のみ。5枚提示→2枚取得でバトルへ。
  useEffect(() => {
    if (!gameState || gameState.phase !== 'deck_phase' || deckOffer) return;
    const offered = sampleCards(5, 'offer', gameState.round);
    setDeckOffer({
      cards: offered,
      blocked: new Set(),
      acquired: new Set(),
      redrawsLeft: 1,
    });
  }, [gameState?.phase, deckOffer]);

  // Track unmount so the battle loop can exit without relying on effect
  // cleanup (which would fire on every phase change and kill the cinematic).
  useEffect(() => () => { unmountedRef.current = true; }, []);

  // Mirror gameState into a ref so the async battle loop can read the latest
  // state (e.g. flagHolder) without recreating the effect on every render.
  const gameStateRef = useRef<GameState | null>(null);
  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);

  // Waits indefinitely until the player clicks the manual-reveal button.
  // Used only when the PLAYER is the attacker (AI turns remain automatic).
  const waitForPlayerAction = useCallback((): Promise<void> => {
    if (unmountedRef.current) return Promise.resolve();
    return new Promise((resolve) => {
      playerActionLatchRef.current = () => {
        playerActionLatchRef.current = null;
        resolve();
      };
    });
  }, []);

  // ===== Step wait with interruptible latch + 3s fallback =====
  // Returns a promise that resolves when EITHER:
  //   - the natural scaled delay elapses
  //   - a 3000ms hard fallback elapses (safety net per spec)
  //   - the user clicks the manual advance button (advanceLatchRef)
  //   - the component unmounts
  const waitStep = useCallback((ms: number): Promise<void> => {
    if (unmountedRef.current) return Promise.resolve();
    const scale = fastModeRef.current ? 0.3 : 1;
    const delay = Math.max(80, Math.round(ms * scale));
    return new Promise((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        advanceLatchRef.current = null;
        resolve();
      };
      const naturalId = window.setTimeout(finish, delay);
      // 3s hard fallback (spec: 各ステップに最大3秒のタイムアウト)
      const fallbackId = window.setTimeout(() => {
        if (!settled) console.warn('[KC] step fallback fired after 3s');
        finish();
      }, 3000);
      stepTimeoutsRef.current.push(naturalId, fallbackId);
      advanceLatchRef.current = finish;
    });
  }, []);

  // Legacy short wait used for tiny state-flush pauses.
  const waitMs = useCallback((ms: number): Promise<void> => {
    if (unmountedRef.current) return Promise.resolve();
    const scale = fastModeRef.current ? 0.3 : 1;
    const delay = Math.max(16, Math.round(ms * scale));
    return new Promise((resolve) => {
      const id = window.setTimeout(resolve, delay);
      stepTimeoutsRef.current.push(id);
    });
  }, []);

  // ===== Battle auto-play loop =====
  // Entry condition: phase becomes 'battle_intro' AND no loop currently running.
  // The loop runs through: turn_banner → defender_show → attack_reveal (many)
  // → resolve → continueAfterResolve (which sets phase back to battle_intro
  // for the next sub-battle, triggering this effect again).
  //
  // Key fix (2026-04): phase transitions inside the loop (battle_intro → battle
  // → battle_resolve) no longer cancel the loop, because we use a persistent
  // `battleRunningRef` + `unmountedRef` pair instead of effect cleanup. Earlier
  // versions put `cancelled = true` in the effect cleanup, which fired every
  // time phase changed and killed the cinematic mid-flight.
  useEffect(() => {
    if (!gameState) return;
    if (gameState.phase !== 'battle_intro') return;
    if (battleRunningRef.current) return;
    battleRunningRef.current = true;

    const run = async () => {
      console.log('[KC] battle loop: START (round', gameState.round, ')');
      try {
        // Step 1: turn banner
        console.log('[KC] → turn_banner');
        setCineStep('turn_banner');
        await waitStep(TURN_BANNER_MS);
        if (unmountedRef.current) return;

        // Step 2: defender shown
        console.log('[KC] → defender_show');
        setCineStep('defender_show');
        await waitStep(DEFENDER_SHOW_MS);
        if (unmountedRef.current) return;

        // Step 3: attack reveal loop. Branch on who's attacking — player turns
        // wait for manual reveal clicks; AI turns auto-progress.
        console.log('[KC] → attack_reveal');
        setCineStep('attack_reveal');
        setGameState((prev) => (prev ? beginAttackLoop(prev) : prev));

        const attackerSide: 'player' | 'ai' =
          gameStateRef.current?.flagHolder === 'player' ? 'ai' : 'player';
        const isPlayerAttacker = attackerSide === 'player';
        console.log('[KC] reveal loop: attacker =', attackerSide);

        let loopGuard = 30;
        while (loopGuard-- > 0) {
          if (unmountedRef.current) return;
          if (isPlayerAttacker) {
            // Wait for the player to click "カードを出す ▶"
            setWaitingForPlayerReveal(true);
            await waitForPlayerAction();
            setWaitingForPlayerReveal(false);
          } else {
            await waitStep(ATTACK_CARD_REVEAL_MS);
          }
          if (unmountedRef.current) return;

          // Reveal one card atomically
          let resultState: GameState | null = null;
          setGameState((prev) => {
            if (!prev) return prev;
            const next = revealNextAttackCard(prev);
            resultState = next;
            return next;
          });
          await waitMs(16);
          if (unmountedRef.current || !resultState) return;

          const rs = resultState as GameState;
          if (rs.phase === 'game_over') {
            console.log('[KC] → game_over during reveal');
            setCineStep('game_over');
            await waitStep(RESOLVE_BANNER_MS);
            if (!unmountedRef.current) window.setTimeout(() => setScreen('result'), 600);
            return;
          }

          if (hasAttackSucceeded(rs)) {
            console.log('[KC] → attack succeeded, resolving');
            await waitStep(400);
            if (unmountedRef.current) return;

            let resolved: GameState | null = null;
            setGameState((prev) => {
              if (!prev) return prev;
              const r = resolveSubBattleWin(prev);
              resolved = r;
              return r;
            });
            await waitMs(16);
            if (unmountedRef.current || !resolved) return;

            console.log('[KC] → resolve banner');
            setCineStep('resolve');
            const rzs = resolved as GameState;
            if (rzs.phase === 'game_over') {
              await waitStep(RESOLVE_BANNER_MS);
              if (!unmountedRef.current) setCineStep('game_over');
              if (!unmountedRef.current) window.setTimeout(() => setScreen('result'), 600);
              return;
            }
            await waitStep(RESOLVE_BANNER_MS);
            if (unmountedRef.current) return;

            // 攻守交代テロップ: 旧フルスクリーンサマリーを廃止し、中央に
            // 一瞬だけ「攻守交代！～」とテロップを流す。
            console.log('[KC] → continueAfterResolve (next sub-battle)');
            const continued: GameState | null = (() => {
              let captured: GameState | null = null;
              setGameState((prev) => {
                if (!prev) return prev;
                const c = continueAfterResolve(prev);
                captured = c;
                return c;
              });
              return captured;
            })();
            await waitMs(16);
            if (unmountedRef.current) return;
            if (continued) {
              const c = continued as GameState;
              const nextAttackerIsPlayer = c.flagHolder === 'ai';
              const telopText = nextAttackerIsPlayer
                ? '⚔️ 攻守交代！あなたの攻撃！'
                : '🛡️ 攻守交代！あなたが防御！';
              setGameState((prev) =>
                prev
                  ? {
                      ...prev,
                      effectTelop: {
                        text: telopText,
                        color: nextAttackerIsPlayer ? '#ff6b6b' : '#60a5fa',
                        key: Date.now() + Math.floor(Math.random() * 1000),
                      },
                    }
                  : prev,
              );
            }
            setCineStep('idle');
            return;
          }
        }
        console.warn('[KC] battle loop safety break reached');
      } finally {
        battleRunningRef.current = false;
        console.log('[KC] battle loop: END');
      }
    };

    run();
    // No cleanup: loop is guarded by battleRunningRef + unmountedRef.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState?.phase]);

  // ===== Manual advance: resolves whichever latch is currently active =====
  // Used by the skip button, the bottom "次へ" button, and "カードを出す ▶"
  // during the player-attacker reveal phase. Only touches a ref — no state
  // change, no risk of re-triggering the effect.
  const handleAdvance = useCallback(() => {
    console.log('[KC] manual advance');
    if (playerActionLatchRef.current) {
      playerActionLatchRef.current();
      return;
    }
    advanceLatchRef.current?.();
  }, []);
  const handleSkipReveal = handleAdvance;

  // Player resigns the current attack: revealed cards stay in flight, but the
  // game ends as a loss. Resolves the player-action latch so the run loop can
  // detect game_over on the next iteration.
  const handleForfeitAttack = useCallback(() => {
    console.log('[KC] forfeit attack');
    setGameState((prev) =>
      prev
        ? { ...prev, phase: 'game_over', winner: 'ai', message: '攻撃を諦めた' }
        : prev,
    );
    playerActionLatchRef.current?.();
  }, []);

  // ===== Deck phase: tap card → show quiz =====
  // NOTE: クイズ出題は deck_phase 限定。バトル中は絶対に走らない。
  const handleCardTap = useCallback((index: number) => {
    if (!deckOffer || !gameState) return;
    if (gameState.phase !== 'deck_phase') return;  // hard gate against battle-phase leaks
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
    // 現在のラウンド番号に合わせて 5 枚再抽選
    const offered = sampleCards(5, 'offer', gameState.round);
    setDeckOffer({
      cards: offered,
      blocked: new Set(),
      acquired: new Set(),
      redrawsLeft: deckOffer.redrawsLeft - 1,
    });
  }, [deckOffer, gameState]);

  // ===== Deck phase → start battle =====
  // デッキフェイズ終了（「バトル開始」ボタン）で battle_intro へ遷移
  // startBattle は flagHolder のデッキトップから最初の defender カードを引く
  // ===== Deck phase: remove card from current deck =====
  const handleRequestRemoveCard = useCallback((index: number) => {
    if (!gameState) return;
    if (gameState.player.deck.length <= MIN_DECK_SIZE) {
      toast.error(`最低${MIN_DECK_SIZE}枚必要です`);
      return;
    }
    setPendingRemoveIdx(index);
  }, [gameState]);

  const handleConfirmRemoveCard = useCallback(() => {
    if (pendingRemoveIdx === null || !gameState) return;
    const idx = pendingRemoveIdx;
    setPendingRemoveIdx(null);
    setFadingOutIdx(idx);
    window.setTimeout(() => {
      setGameState((prev) => (prev ? removeCardFromDeck(prev, idx) : prev));
      setFadingOutIdx(null);
    }, 280);
  }, [pendingRemoveIdx, gameState]);

  const handleCancelRemoveCard = useCallback(() => setPendingRemoveIdx(null), []);

  const handleStartBattle = useCallback(() => {
    if (!gameState || gameState.phase !== 'deck_phase') return;
    if (gameState.player.deck.length < MIN_DECK_SIZE) {
      toast.error(`デッキは最低${MIN_DECK_SIZE}枚必要です`);
      return;
    }
    setDeckOffer(null);
    setActiveQuiz(null);
    setSwapState(null);
    const next = startBattle(gameState);
    console.log('[KC] handleStartBattle: phase =', next.phase, 'defenseCard =', next.defenseCard?.name);
    setGameState(next);
    setCineStep('idle');
    advanceLatchRef.current = null;
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

    // 変更11: パーフェクトクリアなら殿堂入りデッキを保存。
    // 新モデルでの「パーフェクト」= 勝利 かつ 1度もフラッグを奪われていない（history 全て player 勝利）
    if (won && gameState.history.length > 0 && gameState.history.every((r) => r.winner === 'player')) {
      const subBattleCount = gameState.history.length;
      const deckSnapshot = [
        ...gameState.player.deck,
        ...gameState.player.bench.flatMap((slot) => Array.from({ length: slot.count }, () => slot.card)),
      ];
      void saveHallOfFame({
        childId: userId,
        deck: deckSnapshot,
        totalFans: subBattleCount,
        stageId: currentStage?.id ?? null,
      }).then((ok) => {
        if (ok) toast.success(`🏆 殿堂入り！ ${subBattleCount}連続フラッグ奪取 パーフェクトクリア！`);
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
          <p className="text-amber-200/50 text-xs mb-5">攻守交代フラッグバトル</p>

          <div className="rounded-xl p-3 mb-3" style={{ background: 'rgba(255,215,0,0.05)', border: '1px solid rgba(255,215,0,0.15)' }}>
            <p className="text-amber-200/60 text-[11px] text-left leading-relaxed">
              <span className="text-amber-100 font-bold">ルール：</span>
              <br />
              ・初期デッキ{INITIAL_DECK_SIZE}枚 / 最大{MAX_DECK_SIZE}枚
              <br />
              ・バトル中は自動進行（プレイヤー操作はスキップのみ）
              <br />
              ・フラッグ保持者の top カード = 防御。攻撃側が top から 1 枚ずつ公開しパワー合計が防御を超えたら奪取
              <br />
              ・奪取後は攻守交代、最後の攻撃カードが新防御に
              <br />
              ・デッキ切れ or ベンチ{BENCH_MAX_SLOTS}種類目で決着
              <br />
              ・プレイヤーがカードを選ぶのはゲーム開始時のデッキフェイズのみ
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
              <p className="text-[9px] text-green-200/60 mb-0.5">奪取した数</p>
              <span className="text-2xl font-black text-green-300">{gameState.history.filter(h => h.winner === 'player').length}</span>
            </div>
            <span className="text-xl font-black text-amber-200/50">VS</span>
            <div className="text-center px-3 py-2 rounded-lg" style={{ background: 'rgba(239,68,68,0.12)' }}>
              <p className="text-[9px] text-red-200/60 mb-0.5">奪われた数</p>
              <span className="text-2xl font-black text-red-300">{gameState.history.filter(h => h.winner === 'ai').length}</span>
            </div>
          </div>

          {/* Sub-battle history */}
          <div className="rounded-lg p-2 mb-4 text-left max-h-40 overflow-y-auto" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)' }}>
            {gameState.history.length === 0 ? (
              <p className="text-[11px] text-amber-200/40 text-center py-2">（サブバトルなし）</p>
            ) : gameState.history.map((r) => (
              <div key={r.idx} className="flex items-center justify-between text-[11px] py-0.5">
                <span className="text-amber-200/60">#{r.idx}</span>
                <span className="text-amber-100 truncate mx-2">
                  {r.attackerSide === 'player' ? 'あなた' : '相手'} → {r.defenderCard.name}
                </span>
                <span className={`font-black ${r.winner === 'player' ? 'text-green-400' : 'text-red-400'}`}>
                  ⚔️{r.attackPower}
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
            <p className="text-[10px] font-bold text-amber-200/50">SB</p>
            <p className="text-xl font-black" style={{ color: '#ffd700', textShadow: '0 0 8px rgba(255,215,0,0.5)' }}>
              {gameState.history.length + (gameState.phase === 'game_over' ? 0 : 1)}
            </p>
          </div>
          <div className="text-center px-2 py-1 rounded-lg" style={{ background: 'rgba(255,215,0,0.12)', border: '1.5px solid rgba(255,215,0,0.4)' }}>
            <p className="text-[9px] font-bold text-amber-200/70">フラッグ</p>
            <p className="text-sm font-black" style={{ color: gameState.flagHolder === 'player' ? '#22c55e' : '#ef4444' }}>
              🏆 {gameState.flagHolder === 'player' ? 'あなた' : '相手'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-center">
            <p className="text-[10px] font-bold text-green-200/60">山札</p>
            <p className="text-lg font-black text-green-300">{gameState.player.deck.length}</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] font-bold text-red-200/60">相手山札</p>
            <p className="text-lg font-black text-red-300">{gameState.ai.deck.length}</p>
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
      <BenchDisplay side="ai" bench={gameState.ai.bench} deckCount={gameState.ai.deck.length} quarantineCount={gameState.quarantine.ai.length} animKey={gameState.history.length} />

      {/* ===== Battle Field =====
          Layout:
            AI bench (already rendered above)
            Top:    defender card OR attacker reveal pile, depending on who is flag holder
            Center: flag + trophy count
            Bottom: opposite side
            Player bench (rendered below)

          playerIsDefender = (gameState.flagHolder === 'player')
          When player defends: defender card at bottom (player side), attacker reveals at top (AI side)
          When player attacks: defender card at top (AI side), attacker reveals at bottom (player side) */}
      {(() => {
        const playerIsDefender = gameState.flagHolder === 'player';
        const defenderCard = gameState.defenseCard;
        const defenderSide: 'player' | 'ai' = playerIsDefender ? 'player' : 'ai';
        const attackerSide: 'player' | 'ai' = playerIsDefender ? 'ai' : 'player';
        const defenderPower = defenderCard ? getBaseDefense(defenderCard) : 0;
        const attackCards = gameState.attackRevealed;
        const attackPower = gameState.attackCurrentPower;

        const shouldShowDefender = cineStep === 'defender_show' || cineStep === 'attack_reveal' || cineStep === 'resolve';
        const shouldShowAttackPile = cineStep === 'attack_reveal' || cineStep === 'resolve';
        const attackerWonSub = cineStep === 'resolve' && gameState.lastSubBattle?.winner === attackerSide;

        const renderDefenderSlot = () => {
          if (!shouldShowDefender || !defenderCard) {
            return <CardBack side={defenderSide} />;
          }
          const shatter = attackerWonSub;
          return (
            <div className={`relative ${shatter ? 'kc-card-shatter' : 'kc-defender-glow'}`}>
              <CardDisplay card={defenderCard} size="battle" mode="defense" />
              {cineStep === 'defender_show' && (
                <div className="absolute left-1/2 -translate-x-1/2 -bottom-12 whitespace-nowrap kc-defense-label z-20">
                  <p style={{ fontSize: '1.5rem', fontWeight: 900, color: '#60a5fa', textShadow: '0 0 16px rgba(96,165,250,0.95), 0 2px 4px rgba(0,0,0,0.9)' }}>
                    🛡️ 防御パワー {defenderPower}
                  </p>
                </div>
              )}
            </div>
          );
        };

        const renderAttackerSlot = () => {
          if (!shouldShowAttackPile || attackCards.length === 0) {
            // Before any reveals, show the attacker's deck top as a card back.
            return <CardBack side={attackerSide} />;
          }
          // Show the attack pile as a stacked fan of cards. Most recent on top.
          const lastCard = attackCards[attackCards.length - 1];
          const priorCount = attackCards.length - 1;
          const enterClass = attackerSide === 'ai' ? 'kc-ai-card-enter' : 'kc-player-card-enter';
          return (
            <div className="relative" style={{ width: 180, height: 250 }}>
              {/* Earlier attack cards stacked behind (offset by a bit) */}
              {attackCards.slice(0, -1).map((c, i) => (
                <div key={`stack-${i}`} className="absolute"
                  style={{
                    top: 0,
                    left: 0,
                    transform: `translate(${(i - priorCount / 2) * 12}px, ${(i - priorCount / 2) * 6}px) rotate(${(i - priorCount / 2) * 3}deg)`,
                    opacity: 0.5,
                    zIndex: i,
                  }}
                >
                  <CardDisplay card={c} size="battle" mode="attack" />
                </div>
              ))}
              {/* Latest card on top with kcCardFlip animation on mount */}
              <div key={`latest-${attackCards.length}`} className={`absolute inset-0 ${enterClass}`} style={{ zIndex: 100 }}>
                <CardDisplay card={lastCard} size="battle" mode="attack" />
              </div>
              {/* Cumulative power label below */}
              <div className="absolute left-1/2 -translate-x-1/2 -bottom-12 whitespace-nowrap z-[120] kc-attack-label">
                <p style={{ fontSize: '1.75rem', fontWeight: 900, color: '#ff6b6b', textShadow: '0 0 16px rgba(239,68,68,0.95), 0 2px 4px rgba(0,0,0,0.9)' }}>
                  ⚔️ 攻撃パワー {attackPower}{defenderCard ? ` / ${defenderPower}` : ''}
                </p>
              </div>
            </div>
          );
        };

        return (
      <div
        className={`flex-1 flex flex-col px-2 py-2 relative min-h-0 overflow-hidden ${cineStep === 'resolve' && gameState.lastSubBattle?.winner === 'ai' ? 'kc-screen-shake' : ''}`}
      >
        {/* Flash overlays on resolve */}
        {cineStep === 'resolve' && gameState.lastSubBattle?.winner === 'ai' && (
          <div className="absolute inset-0 pointer-events-none z-30 kc-red-flash" />
        )}
        {cineStep === 'resolve' && gameState.lastSubBattle?.winner === 'player' && (
          <div className="absolute inset-0 pointer-events-none z-30 kc-green-flash" />
        )}

        {/* Skip button */}
        {gameState.phase !== 'deck_phase' && gameState.phase !== 'game_over' && (
          <button
            onClick={handleSkipReveal}
            className="absolute top-1 right-2 z-50 text-[11px] font-black px-3 py-1.5 rounded-lg"
            style={{
              background: 'rgba(255,255,255,0.12)',
              border: '1.5px solid rgba(255,255,255,0.3)',
              color: 'rgba(255,255,255,0.85)',
            }}
          >
            ⏭ スキップ
          </button>
        )}

        {/* ====== AI AREA (top half) ====== */}
        <div className="flex-1 flex items-center justify-center relative">
          {playerIsDefender ? renderAttackerSlot() : renderDefenderSlot()}
        </div>

        {/* ====== CENTER BAND (flag) ====== */}
        <div className="flex items-center justify-center gap-3 py-2 relative min-h-[90px]">
          <div className="h-0.5 flex-1" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,215,0,0.5))' }} />
          <div
            className={`kc-flag ${cineStep === 'resolve' ? 'kc-flag-pulse' : ''}`}
            style={{
              background: gameState.flagHolder === 'player'
                ? 'radial-gradient(circle, rgba(34,197,94,0.55), rgba(34,197,94,0.1))'
                : 'radial-gradient(circle, rgba(239,68,68,0.55), rgba(239,68,68,0.1))',
              border: `4px solid ${gameState.flagHolder === 'player' ? '#22c55e' : '#ef4444'}`,
              boxShadow: gameState.flagHolder === 'player'
                ? '0 0 24px rgba(34,197,94,0.7)'
                : '0 0 24px rgba(239,68,68,0.7)',
            }}
          >
            <span style={{ fontSize: '2.25rem' }}>🏆</span>
            <p className="text-[9px] font-black mt-0.5" style={{ color: '#ffd700' }}>
              {gameState.flagHolder === 'player' ? 'あなた' : '相手'}
            </p>
          </div>
          <div className="h-0.5 flex-1" style={{ background: 'linear-gradient(90deg, rgba(255,215,0,0.5), transparent)' }} />
        </div>

        {/* ====== PLAYER AREA (bottom half) ====== */}
        <div className="flex-1 flex items-center justify-center relative">
          {playerIsDefender ? renderDefenderSlot() : renderAttackerSlot()}
        </div>

        {/* ====== Manual advance button (always visible during battle) ====== */}
        {gameState.phase !== 'deck_phase' && gameState.phase !== 'game_over' && (() => {
          const labelByStep: Record<string, string> = {
            idle: 'バトル開始 ▶',
            turn_banner: 'バトル開始 ▶',
            defender_show: '攻撃を見る ▶',
            attack_reveal: '比較する ▶',
            resolve: '次のサブバトルへ ▶',
            game_over: '結果を見る ▶',
          };
          const label = waitingForPlayerReveal
            ? '🎴 カードを出す ▶'
            : (labelByStep[cineStep] ?? '次へ ▶');
          return (
            <div className="shrink-0 px-3 pb-2 pt-1 z-40 relative">
              <button
                onClick={handleAdvance}
                className="w-full rounded-xl font-black active:scale-[0.98] transition-all"
                style={{
                  minHeight: '48px',
                  fontSize: '16px',
                  color: '#fff',
                  background: 'linear-gradient(180deg, #ffd700 0%, #daa520 100%)',
                  border: '2.5px solid #ffe066',
                  boxShadow: '0 4px 16px rgba(255,215,0,0.45), 0 0 20px rgba(255,215,0,0.25)',
                  textShadow: '0 1px 3px rgba(0,0,0,0.6)',
                }}
              >
                {label}
              </button>
            </div>
          );
        })()}

        {/* ====== Turn Banner ====== */}
        {cineStep === 'turn_banner' && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-40">
            <div className="kc-turn-banner" style={{
              background: playerIsDefender
                ? 'linear-gradient(135deg, rgba(59,130,246,0.45), rgba(37,99,235,0.15))'
                : 'linear-gradient(135deg, rgba(239,68,68,0.45), rgba(185,28,28,0.15))',
              border: `4px solid ${playerIsDefender ? '#3b82f6' : '#ef4444'}`,
              padding: '16px 32px',
              borderRadius: '16px',
              textAlign: 'center',
              boxShadow: `0 0 50px ${playerIsDefender ? 'rgba(59,130,246,0.7)' : 'rgba(239,68,68,0.7)'}`,
            }}>
              <p style={{
                fontSize: '2.25rem',
                fontWeight: 900,
                color: playerIsDefender ? '#93c5fd' : '#fca5a5',
                textShadow: `0 0 30px ${playerIsDefender ? 'rgba(59,130,246,0.95)' : 'rgba(239,68,68,0.95)'}, 0 2px 6px rgba(0,0,0,0.85)`,
                margin: 0,
              }}>
                {playerIsDefender ? '🛡️ あなたが防御中！' : '⚔️ あなたの攻撃！'}
              </p>
              <p style={{ fontSize: '0.9rem', fontWeight: 700, color: '#fff', marginTop: 6 }}>
                サブバトル {gameState.round}
              </p>
            </div>
          </div>
        )}

        {/* ====== Resolve Banner ====== */}
        {cineStep === 'resolve' && gameState.lastSubBattle && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-40">
            <div className="kc-outcome-banner" style={{
              padding: '18px 36px',
              borderRadius: '16px',
              textAlign: 'center',
              background: gameState.lastSubBattle.winner === 'player'
                ? 'linear-gradient(135deg, rgba(34,197,94,0.45), rgba(22,163,74,0.15))'
                : 'linear-gradient(135deg, rgba(239,68,68,0.45), rgba(185,28,28,0.15))',
              border: `4px solid ${gameState.lastSubBattle.winner === 'player' ? '#22c55e' : '#ef4444'}`,
              boxShadow: `0 0 60px ${gameState.lastSubBattle.winner === 'player' ? 'rgba(34,197,94,0.8)' : 'rgba(239,68,68,0.8)'}`,
            }}>
              <p style={{
                fontSize: '2rem',
                fontWeight: 900,
                color: gameState.lastSubBattle.winner === 'player' ? '#4ade80' : '#fca5a5',
                textShadow: `0 0 24px ${gameState.lastSubBattle.winner === 'player' ? 'rgba(34,197,94,0.95)' : 'rgba(239,68,68,0.95)'}, 0 2px 6px rgba(0,0,0,0.85)`,
                margin: 0,
              }}>
                {gameState.lastSubBattle.winner === 'player'
                  ? '🏆 フラッグ奪取！'
                  : '💥 フラッグを奪われた！'}
              </p>
              <p className="text-xs text-amber-200/70 mt-1">
                攻撃 {gameState.lastSubBattle.attackPower} vs 防御 {getBaseDefense(gameState.lastSubBattle.defenderCard)}
              </p>
            </div>
          </div>
        )}

        {/* ====== game_over inline ====== */}
        {gameState.phase === 'game_over' && (
          <div className="absolute inset-0 flex items-center justify-center z-50 kc-card-reveal">
            <div className="text-center">
              <span className="text-6xl block mb-2">{gameState.winner === 'player' ? '🎉' : '💀'}</span>
              <p style={{ fontSize: '2.5rem', fontWeight: 900, color: gameState.winner === 'player' ? '#ffd700' : '#ef4444', textShadow: `0 0 24px ${gameState.winner === 'player' ? 'rgba(255,215,0,0.8)' : 'rgba(239,68,68,0.8)'}` }}>
                {gameState.winner === 'player' ? '勝利！' : '敗北...'}
              </p>
              <p className="text-sm text-amber-200/70 mt-2">
                {gameState.player.bench.length >= BENCH_MAX_SLOTS ? 'あなたのベンチが満杯！' :
                 gameState.ai.bench.length >= BENCH_MAX_SLOTS ? '相手のベンチが満杯！' :
                 'デッキ切れ！'}
              </p>
            </div>
          </div>
        )}
      </div>
        );
      })()}

      {/* Player Bench */}
      <BenchDisplay side="player" bench={gameState.player.bench} deckCount={gameState.player.deck.length} quarantineCount={gameState.quarantine.player.length} animKey={gameState.history.length} />

      {/* ===== Player Attack Reveal Modal =====
           Shown when the player is the attacker, the loop is waiting on a
           reveal click, and there's at least one revealed card so the
           comparison is meaningful. */}
      {waitingForPlayerReveal &&
       gameState.flagHolder === 'ai' &&
       gameState.defenseCard &&
       gameState.attackRevealed.length > 0 && (() => {
        const atk = gameState.attackCurrentPower;
        const def = Math.max(0, (gameState.defenseCard.defensePower ?? gameState.defenseCard.power) + gameState.defenderBonus);
        const gap = def - atk;
        return (
          <div className="fixed inset-0 z-[160] flex items-end justify-center pointer-events-none">
            <div
              className="rounded-2xl mb-24 mx-4 p-5 max-w-sm w-full pointer-events-auto kc-summary-pop"
              style={{
                background: 'linear-gradient(135deg, rgba(21,29,59,0.97), rgba(14,20,45,0.97))',
                border: '3px solid rgba(255,200,0,0.6)',
                boxShadow: '0 12px 40px rgba(0,0,0,0.85), 0 0 32px rgba(255,200,0,0.35)',
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-black" style={{ fontSize: '18px', color: '#ff6b6b' }}>
                  ⚔️ あなたの攻撃: {atk}
                </span>
                <span className="font-black" style={{ fontSize: '18px', color: '#60a5fa' }}>
                  🛡️ 相手の防御: {def}
                </span>
              </div>
              <p className="text-center font-black mb-3" style={{ fontSize: '17px', color: '#ffd700', textShadow: '0 0 12px rgba(255,200,0,0.5)' }}>
                あと{gap}パワー足りない！
              </p>
              <button
                onClick={handleAdvance}
                className="w-full rounded-xl font-black active:scale-[0.98] mb-2"
                style={{
                  minHeight: '60px',
                  fontSize: '18px',
                  color: '#fff',
                  background: 'linear-gradient(180deg, #22c55e 0%, #16a34a 100%)',
                  border: '3px solid #4ade80',
                  boxShadow: '0 6px 24px rgba(34,197,94,0.6), 0 0 24px rgba(74,222,128,0.4)',
                  textShadow: '0 1px 3px rgba(0,0,0,0.6)',
                }}
              >
                🎴 もう1枚出す ▶
              </button>
              <button
                onClick={handleForfeitAttack}
                className="w-full text-center py-1.5"
                style={{
                  fontSize: '12px',
                  color: 'rgba(255,255,255,0.5)',
                  background: 'transparent',
                  textDecoration: 'underline',
                }}
              >
                🏳️ 攻撃をやめる
              </button>
            </div>
          </div>
        );
      })()}

      {/* ===== Effect Telop (card on-reveal effect) ===== */}
      {gameState.effectTelop && (
        <div
          key={gameState.effectTelop.key}
          className="fixed inset-0 z-[175] flex items-center justify-center pointer-events-none"
        >
          <div
            className="kc-effect-telop px-6 py-4 rounded-2xl text-center"
            style={{
              background: 'linear-gradient(180deg, rgba(0,0,0,0.85), rgba(10,10,25,0.85))',
              border: `3px solid ${gameState.effectTelop.color}`,
              boxShadow: `0 0 32px ${gameState.effectTelop.color}aa, 0 8px 32px rgba(0,0,0,0.7)`,
              maxWidth: '90vw',
            }}
          >
            <p
              className="font-black"
              style={{
                fontSize: '30px',
                lineHeight: 1.25,
                color: gameState.effectTelop.color,
                textShadow: '0 2px 10px rgba(0,0,0,0.9), 0 0 20px rgba(0,0,0,0.6)',
              }}
            >
              {gameState.effectTelop.text}
            </p>
          </div>
        </div>
      )}

      {/* ===== Deck Phase Overlay (レスポンシブ: PC 2-col / モバイル 縦) ===== */}
      {gameState.phase === 'deck_phase' && deckOffer && !activeQuiz && !swapState && (() => {
        const deckCards = gameState.player.deck;
        const deckCount = deckCards.length;
        const avgAtk = deckCount > 0
          ? deckCards.reduce((s, c) => s + (c.attackPower ?? c.power), 0) / deckCount
          : 0;
        const avgDef = deckCount > 0
          ? deckCards.reduce((s, c) => s + (c.defensePower ?? c.power), 0) / deckCount
          : 0;

        const OfferGrid = (
          <div className="grid grid-cols-3 gap-2">
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
        );

        const DeckPanelHeader = (
          <div className="flex items-center justify-between mb-1.5">
            <button
              type="button"
              onClick={() => setDeckPanelCollapsed((v) => !v)}
              className="text-[12px] font-bold text-amber-100 flex items-center gap-1 md:cursor-default"
              // md 以上ではクリック無効化 (常に展開)
              style={{ pointerEvents: 'auto' }}
            >
              🃏 現在のデッキ {deckCount}/{MAX_DECK_SIZE}枚
              <span className="md:hidden text-amber-200/60">
                {deckPanelCollapsed ? '▶' : '▼'}
              </span>
            </button>
            <span
              className="text-[10px] font-bold"
              style={{ color: deckCount < MIN_DECK_SIZE ? '#ff6b6b' : '#4ade80' }}
            >
              最低{MIN_DECK_SIZE}枚
            </span>
          </div>
        );

        const DeckStatsLine = deckCount > 0 && (
          <div className="text-[10px] text-amber-200/70 text-center mb-1.5">
            平均 <span style={{ color: '#ff6b6b' }}>⚔️{avgAtk.toFixed(1)}</span>
            {' / '}
            <span style={{ color: '#60a5fa' }}>🛡️{avgDef.toFixed(1)}</span>
          </div>
        );

        const DeckGrid = (
          <div className="grid grid-cols-5 md:grid-cols-4 gap-1 overflow-y-auto" style={{ maxHeight: '100%' }}>
            {deckCards.map((c, i) => {
              const canRemove = deckCount > MIN_DECK_SIZE;
              const isFading = fadingOutIdx === i;
              return (
                <div
                  key={c.id + '-' + i}
                  className="relative rounded-md p-0.5"
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    opacity: isFading ? 0 : 1,
                    transform: isFading ? 'scale(0.85)' : 'scale(1)',
                    transition: 'opacity 0.28s ease, transform 0.28s ease',
                  }}
                >
                  <CardDisplay card={c} size="sm" />
                  {canRemove && !isFading && (
                    <button
                      onClick={() => handleRequestRemoveCard(i)}
                      aria-label="このカードを外す"
                      className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center active:scale-90 transition-transform"
                      style={{
                        background: '#ef4444',
                        color: '#fff',
                        fontSize: '11px',
                        fontWeight: 900,
                        boxShadow: '0 2px 6px rgba(0,0,0,0.6)',
                        border: '1.5px solid rgba(255,255,255,0.85)',
                      }}
                    >
                      ✕
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        );

        return (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-3" style={{ background: 'rgba(0,0,0,0.85)' }}>
          <div
            className="rounded-2xl w-full max-w-md md:max-w-4xl flex flex-col"
            style={{
              background: 'linear-gradient(135deg, rgba(21,29,59,0.98), rgba(14,20,45,0.98))',
              border: '3px solid rgba(255,215,0,0.5)',
              boxShadow: '0 12px 40px rgba(0,0,0,0.7), 0 0 32px rgba(255,215,0,0.2)',
              maxHeight: '92vh',
            }}
          >
            <div className="p-4 pb-2 shrink-0">
              <h3 className="text-xl font-black text-center mb-1" style={{ color: '#ffd700' }}>
                📚 ラウンド{gameState.round} デッキフェイズ
              </h3>
              <p className="text-xs text-amber-200/70 text-center">
                5 枚の中から 2 枚選ぼう。タップでクイズ出題、正解で追加。
                <br />
                獲得 {deckOffer.acquired.size}/2 ・ デッキ {deckCount}/{MAX_DECK_SIZE} 枚
              </p>
            </div>

            {/* ===== 2-col (md+) / stacked (mobile) ===== */}
            <div className="flex-1 min-h-0 overflow-y-auto md:overflow-hidden px-4 md:grid md:grid-cols-2 md:gap-4">
              {/* 左: 提示カード */}
              <div className="mb-3 md:mb-0 md:flex md:flex-col md:min-h-0">
                <p className="text-[11px] font-bold text-amber-100 mb-1.5 md:mb-2">
                  🎴 提示カード（5枚 / 獲得 {deckOffer.acquired.size}/2）
                </p>
                <div className="md:flex-1 md:overflow-y-auto md:min-h-0">
                  {OfferGrid}
                </div>
              </div>

              {/* 右 (md+) / 下 (mobile): 現在のデッキ */}
              <div
                className="rounded-xl p-2 md:p-3 md:flex md:flex-col md:min-h-0"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,215,0,0.2)' }}
              >
                {DeckPanelHeader}
                {/* モバイル折りたたみ: md+ では常に展開 */}
                <div className={`${deckPanelCollapsed ? 'hidden' : 'block'} md:block md:flex-1 md:min-h-0 md:flex md:flex-col`}>
                  {DeckStatsLine}
                  <div className="md:flex-1 md:min-h-0 md:overflow-y-auto">
                    {DeckGrid}
                  </div>
                  <p className="text-[10px] text-amber-200/50 mt-1.5 text-center">
                    💡 デッキ整理のコツ: 攻撃と防御のバランスを考えよう
                  </p>
                </div>
              </div>
            </div>

            {/* ===== Sticky footer: 引き直し + バトル開始 ===== */}
            {(() => {
              const acquiredCount = deckOffer.acquired.size;
              const deckOk = gameState.player.deck.length >= MIN_DECK_SIZE;
              const startEnabled = acquiredCount >= 2 && deckOk;
              const label =
                !deckOk
                  ? `デッキ最低${MIN_DECK_SIZE}枚必要`
                  : acquiredCount < 2
                    ? `あと${2 - acquiredCount}枚選んでください`
                    : '⚔️ バトル開始 ▶';
              return (
                <div
                  className="p-4 pt-3 shrink-0"
                  style={{ borderTop: '1px solid rgba(255,215,0,0.2)', background: 'rgba(10,14,30,0.6)' }}
                >
                  <button
                    onClick={handleRedraw}
                    disabled={deckOffer.redrawsLeft <= 0 || deckOffer.acquired.size > 0}
                    className="rpg-btn rpg-btn-blue w-full py-2 text-xs mb-2"
                    style={{ opacity: (deckOffer.redrawsLeft <= 0 || deckOffer.acquired.size > 0) ? 0.5 : 1 }}
                  >
                    🔄 引き直し ({deckOffer.redrawsLeft})
                  </button>
                  <button
                    onClick={handleStartBattle}
                    disabled={!startEnabled}
                    className="w-full rounded-xl font-black active:scale-[0.98] transition-all"
                    style={{
                      minHeight: '64px',
                      fontSize: '1.15rem',
                      color: '#fff',
                      background: startEnabled
                        ? 'linear-gradient(180deg, #22c55e 0%, #16a34a 100%)'
                        : 'rgba(90,90,100,0.5)',
                      border: startEnabled ? '3px solid #4ade80' : '3px solid rgba(255,255,255,0.15)',
                      boxShadow: startEnabled
                        ? '0 6px 24px rgba(34,197,94,0.55), 0 0 24px rgba(74,222,128,0.35)'
                        : 'none',
                      textShadow: startEnabled ? '0 2px 6px rgba(0,0,0,0.5)' : 'none',
                      cursor: startEnabled ? 'pointer' : 'not-allowed',
                    }}
                  >
                    {label}
                  </button>
                </div>
              );
            })()}
          </div>
        </div>
        );
      })()}

      {/* ===== Confirm remove card dialog ===== */}
      {pendingRemoveIdx !== null && gameState && gameState.player.deck[pendingRemoveIdx] && (
        <div className="fixed inset-0 z-[180] flex items-center justify-center p-5" style={{ background: 'rgba(0,0,0,0.85)' }}>
          <div
            className="rounded-2xl p-5 w-full max-w-xs"
            style={{
              background: 'linear-gradient(135deg, rgba(21,29,59,0.98), rgba(14,20,45,0.98))',
              border: '3px solid rgba(239,68,68,0.6)',
              boxShadow: '0 12px 40px rgba(0,0,0,0.8)',
            }}
          >
            <h3 className="text-base font-black text-center mb-3" style={{ color: '#ff9b9b' }}>
              このカードをデッキから外しますか？
            </h3>
            <div className="flex justify-center mb-4">
              <CardDisplay card={gameState.player.deck[pendingRemoveIdx]} size="sm" />
            </div>
            <div className="flex gap-2">
              <button onClick={handleCancelRemoveCard} className="rpg-btn flex-1 py-2 text-sm" style={{ background: 'rgba(255,255,255,0.1)' }}>
                やめる
              </button>
              <button onClick={handleConfirmRemoveCard} className="rpg-btn flex-1 py-2 text-sm" style={{ background: '#ef4444', color: '#fff' }}>
                外す
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Deck Phase Quiz Overlay =====
           Bug 2 fix: hard-gate by phase === 'deck_phase'. Quiz cannot appear in battle. */}
      {gameState.phase === 'deck_phase' && activeQuiz && (
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
        @keyframes kcFlagPulse { 0% { transform: scale(1); } 50% { transform: scale(1.4); } 100% { transform: scale(1); } }
        .kc-flag-pulse { animation: kcFlagPulse 0.9s ease-out; }
        .kc-flag {
          width: 80px; height: 80px; border-radius: 50%;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          transition: background 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease;
        }
        .kc-card-reveal { animation: kcCardReveal 0.5s ease-out; }
        @keyframes kcCardReveal { 0% { opacity: 0; transform: scale(0.7); } 100% { opacity: 1; transform: scale(1); } }
        .kc-pulse-text { animation: kcPulseText 1s ease-in-out infinite; }
        @keyframes kcPulseText { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        .kc-win-glow { animation: kcWinGlow 1s ease-in-out infinite; border-color: rgba(255,215,0,0.8) !important; }
        @keyframes kcWinGlow {
          0%, 100% { box-shadow: 0 0 12px rgba(255,215,0,0.4), 0 0 24px rgba(255,215,0,0.2); }
          50%      { box-shadow: 0 0 30px rgba(255,215,0,0.85), 0 0 60px rgba(255,215,0,0.45); }
        }
        /* Phase 3 battle animations ------------------------------------------ */
        @keyframes kcAiCardEnter {
          0%   { opacity: 0; transform: translateY(-60px) scale(0.7); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        .kc-ai-card-enter { animation: kcAiCardEnter 0.5s ease-out; }
        @keyframes kcPlayerCardEnter {
          0%   { opacity: 0; transform: translateY(60px) scale(0.7); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        .kc-player-card-enter { animation: kcPlayerCardEnter 0.5s ease-out; }
        @keyframes kcCardFlip {
          0%   { transform: rotateY(180deg) scale(0.92); }
          60%  { transform: rotateY(0deg) scale(1.06); }
          100% { transform: rotateY(0deg) scale(1); }
        }
        .kc-flipping { animation: kcCardFlip 0.6s ease-out; }
        @keyframes kcPowerPop {
          0%   { opacity: 0; transform: scale(0.6) translateY(6px); }
          50%  { opacity: 1; transform: scale(1.2) translateY(-3px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        .kc-power-pop { animation: kcPowerPop 0.55s ease-out; display: inline-block; }
        @keyframes kcComparePop {
          0%   { opacity: 0; transform: scale(0.5); }
          40%  { opacity: 1; transform: scale(1.1); }
          100% { opacity: 1; transform: scale(1); }
        }
        .kc-compare-pop > div { animation: kcComparePop 0.5s ease-out; }
        @keyframes kcOutcomePop {
          0%   { opacity: 0; transform: scale(0.4) rotate(-3deg); }
          40%  { opacity: 1; transform: scale(1.15) rotate(1deg); }
          100% { opacity: 1; transform: scale(1) rotate(0); }
        }
        .kc-outcome-banner { animation: kcOutcomePop 0.6s ease-out; }
        @keyframes kcEffectTelop {
          0%   { opacity: 0; transform: scale(0.6) translateY(-12px); }
          20%  { opacity: 1; transform: scale(1.12) translateY(0); }
          35%  { transform: scale(1) translateY(0); }
          85%  { opacity: 1; transform: scale(1); }
          100% { opacity: 0; transform: scale(0.95); }
        }
        .kc-effect-telop { animation: kcEffectTelop 1.5s ease-out forwards; }
        @keyframes kcSummaryPop {
          0%   { opacity: 0; transform: scale(0.8) translateY(12px); }
          60%  { opacity: 1; transform: scale(1.04) translateY(0); }
          100% { opacity: 1; transform: scale(1); }
        }
        .kc-summary-pop { animation: kcSummaryPop 0.45s ease-out; }
        @keyframes kcBenchPop {
          0%   { transform: scale(0.4) translateY(-40px); opacity: 0; }
          55%  { transform: scale(1.18) translateY(0); opacity: 1; }
          75%  { transform: scale(0.95); }
          100% { transform: scale(1); }
        }
        .kc-bench-pop { animation: kcBenchPop 0.55s cubic-bezier(0.34, 1.56, 0.64, 1); }
        @keyframes kcCountBump {
          0%   { transform: scale(1); }
          40%  { transform: scale(1.5); background: #ff6b6b !important; }
          100% { transform: scale(1); }
        }
        .kc-count-bump { animation: kcCountBump 0.45s ease-out; }
        @keyframes kcTurnBannerPop {
          0%   { opacity: 0; transform: translateY(-30px) scale(0.7); }
          40%  { opacity: 1; transform: translateY(0) scale(1.1); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        .kc-turn-banner { animation: kcTurnBannerPop 0.5s ease-out; }
        @keyframes kcCardShatter {
          0%   { opacity: 1; transform: scale(1) rotate(0); filter: brightness(1); }
          40%  { opacity: 1; transform: scale(1.15) rotate(4deg); filter: brightness(2) saturate(2); }
          100% { opacity: 0; transform: scale(0.3) rotate(-18deg) translateX(-40px); filter: brightness(0.4); }
        }
        .kc-card-shatter { animation: kcCardShatter 1.2s ease-out forwards; }
        @keyframes kcScreenShake {
          0%, 100% { transform: translate(0, 0); }
          10%      { transform: translate(-6px, 4px); }
          20%      { transform: translate(6px, -4px); }
          30%      { transform: translate(-5px, -4px); }
          40%      { transform: translate(5px, 4px); }
          50%      { transform: translate(-4px, 3px); }
          60%      { transform: translate(4px, -3px); }
          70%      { transform: translate(-3px, 2px); }
          80%      { transform: translate(3px, -2px); }
          90%      { transform: translate(-1px, 1px); }
        }
        .kc-screen-shake { animation: kcScreenShake 0.7s ease-out; }
        @keyframes kcRedFlash {
          0%   { opacity: 0; background: rgba(239,68,68,0); }
          20%  { opacity: 1; background: rgba(239,68,68,0.55); }
          100% { opacity: 0; background: rgba(239,68,68,0); }
        }
        .kc-red-flash { animation: kcRedFlash 0.7s ease-out forwards; }
        @keyframes kcGreenFlash {
          0%   { opacity: 0; background: rgba(34,197,94,0); }
          20%  { opacity: 1; background: rgba(34,197,94,0.4); }
          100% { opacity: 0; background: rgba(34,197,94,0); }
        }
        .kc-green-flash { animation: kcGreenFlash 0.7s ease-out forwards; }
        @keyframes kcBlueFlash {
          0%   { opacity: 0; background: rgba(59,130,246,0); }
          20%  { opacity: 1; background: rgba(59,130,246,0.45); }
          100% { opacity: 0; background: rgba(59,130,246,0); }
        }
        .kc-blue-flash { animation: kcBlueFlash 0.8s ease-out forwards; }
        /* Defender glow: blue shield aura on the defender card */
        @keyframes kcDefenderGlow {
          0%, 100% { box-shadow: 0 0 16px rgba(59,130,246,0.6), 0 0 32px rgba(59,130,246,0.3); }
          50%      { box-shadow: 0 0 32px rgba(59,130,246,0.9), 0 0 64px rgba(59,130,246,0.5); }
        }
        .kc-defender-glow > div:first-child {
          animation: kcDefenderGlow 1.2s ease-in-out infinite;
          border-radius: 12px;
        }
        @keyframes kcLabelPop {
          0%   { opacity: 0; transform: translateX(-50%) translateY(10px) scale(0.6); }
          50%  { opacity: 1; transform: translateX(-50%) translateY(0) scale(1.1); }
          100% { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
        }
        .kc-defense-label { animation: kcLabelPop 0.5s ease-out; }
        .kc-attack-label  { animation: kcLabelPop 0.3s ease-out; }
        /* Card bounce: attacker's attack bounces off defender (attack failed) */
        @keyframes kcCardBounce {
          0%   { transform: translateY(0) rotate(0); }
          30%  { transform: translateY(-40px) rotate(-10deg); }
          60%  { transform: translateY(30px) rotate(8deg); }
          100% { transform: translateY(0) rotate(0); }
        }
        .kc-card-bounce { animation: kcCardBounce 0.8s ease-out; }
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

function BenchDisplay({ side, bench, deckCount, quarantineCount, animKey }: {
  side: 'player' | 'ai'; bench: BenchSlotUI[]; deckCount: number; quarantineCount?: number; animKey?: number;
}) {
  // Track which slot names existed last render → newly added (or count-bumped)
  // slots get the kc-bench-pop animation. Reset whenever animKey changes
  // (i.e. on each new sub-battle resolve).
  const prevBenchRef = useRef<Map<string, number>>(new Map());
  useEffect(() => {
    const m = new Map<string, number>();
    bench.forEach((s) => m.set(s.name, s.count));
    prevBenchRef.current = m;
  }, [animKey]); // eslint-disable-line react-hooks/exhaustive-deps
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
            {quarantineCount !== undefined && quarantineCount > 0 && (
              <span className="text-xs font-bold text-amber-200/70" title="隔離スペース — 防御で負けるとベンチに流入">
                📦 隔離: <span className="text-amber-100">{quarantineCount}</span>
              </span>
            )}
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
            const prevCount = prevBenchRef.current.get(slot.name) ?? 0;
            const isNew = prevCount === 0;
            const isCountBumped = prevCount > 0 && prevCount < slot.count;
            // Re-mounting via key forces the slot animation to replay each time
            // animKey changes (i.e. each new sub-battle resolution).
            const slotKey = `${slot.name}-${animKey ?? 0}`;
            return (
              <button
                key={slotKey}
                onClick={() => isPlayer && setDetailSlot(slot)}
                className={`flex-1 rounded-lg relative overflow-hidden transition-all active:scale-95 ${isNew ? 'kc-bench-pop' : ''}`}
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
                  <div className={`absolute top-0.5 right-0.5 z-20 rounded-full min-w-[16px] h-[16px] flex items-center justify-center px-1 ${isCountBumped ? 'kc-count-bump' : ''}`} style={{ background: '#ffd700', border: '1.5px solid rgba(0,0,0,0.6)' }}>
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

/**
 * CardDisplay
 *  - Always shows both ⚔️ attackPower (left-bottom, red) and 🛡️ defensePower (right-bottom, blue)
 *  - mode='attack'   : ⚔️ glows red, 🛡️ greyed out
 *  - mode='defense'  : 🛡️ glows blue, ⚔️ greyed out
 *  - mode='neutral'  : both at normal brightness
 */
function CardDisplay({ card, isDefense, isWinner, size, mode }: {
  card: BattleCard;
  isDefense?: boolean;
  isWinner?: boolean;
  size?: 'sm' | 'md' | 'battle';
  mode?: 'attack' | 'defense' | 'neutral';
}) {
  const catInfo = CATEGORY_INFO[card.category];
  const rarInfo = RARITY_INFO[card.rarity];
  const [imgLoaded, setImgLoaded] = useState(false);
  // 2026-04 バトル用に "battle" サイズを追加: 防御/攻撃スロットで使用。
  // sm は overlay (deck phase, モーダル) 用。
  const w = size === 'sm' ? 120 : size === 'battle' ? 180 : 200;
  const h = size === 'sm' ? 150 : size === 'battle' ? 250 : 260;
  const activeMode = mode ?? 'neutral';
  const atk = card.attackPower ?? card.power;
  const def = card.defensePower ?? card.power;
  const fontAtk = size === 'sm' ? '14px' : size === 'battle' ? '26px' : '24px';
  const fontDef = size === 'sm' ? '14px' : size === 'battle' ? '26px' : '24px';
  const isBig = size !== 'sm';

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
          <span className={`${isBig ? 'text-6xl' : 'text-4xl'} opacity-40`}>{catInfo.emoji}</span>
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
          <div className={isBig ? 'text-3xl' : 'text-xl'}>{catInfo.emoji}</div>
          <div className={`px-${isBig ? '2' : '1.5'} py-0.5 rounded font-black`} style={{ background: rarInfo.bgColor, color: rarInfo.color, fontSize: isBig ? '13px' : '10px' }}>
            {rarInfo.label}
          </div>
        </div>
        <div>
          <p
            className="font-black text-white drop-shadow-lg leading-tight mb-1"
            style={{ fontSize: isBig ? '20px' : '14px', textShadow: '0 2px 6px rgba(0,0,0,0.95)' }}
          >
            {card.name}
          </p>
          {/* Attack / Defense power badges — always visible */}
          <div className="flex items-end justify-between gap-1">
            {/* ⚔️ Attack badge (left-bottom) */}
            <div
              className="flex items-center gap-1 px-1.5 py-0.5 rounded-md font-black"
              style={{
                background: activeMode === 'attack'
                  ? 'rgba(239,68,68,0.85)'
                  : activeMode === 'defense'
                    ? 'rgba(80,80,90,0.6)'
                    : 'rgba(239,68,68,0.55)',
                border: `1.5px solid ${activeMode === 'attack' ? '#ff6b6b' : activeMode === 'defense' ? 'rgba(120,120,130,0.6)' : 'rgba(239,68,68,0.7)'}`,
                color: activeMode === 'defense' ? 'rgba(255,255,255,0.45)' : '#fff',
                fontSize: fontAtk,
                textShadow: activeMode === 'attack' ? '0 0 10px rgba(255,107,107,0.95), 0 1px 2px rgba(0,0,0,0.9)' : '0 1px 2px rgba(0,0,0,0.9)',
                boxShadow: activeMode === 'attack' ? '0 0 14px rgba(239,68,68,0.7)' : 'none',
                lineHeight: 1,
              }}
            >
              ⚔️<span>{atk}</span>
            </div>
            {/* 🛡️ Defense badge (right-bottom) */}
            <div
              className="flex items-center gap-1 px-1.5 py-0.5 rounded-md font-black"
              style={{
                background: activeMode === 'defense'
                  ? 'rgba(59,130,246,0.85)'
                  : activeMode === 'attack'
                    ? 'rgba(80,80,90,0.6)'
                    : 'rgba(59,130,246,0.55)',
                border: `1.5px solid ${activeMode === 'defense' ? '#60a5fa' : activeMode === 'attack' ? 'rgba(120,120,130,0.6)' : 'rgba(59,130,246,0.7)'}`,
                color: activeMode === 'attack' ? 'rgba(255,255,255,0.45)' : '#fff',
                fontSize: fontDef,
                textShadow: activeMode === 'defense' ? '0 0 10px rgba(96,165,250,0.95), 0 1px 2px rgba(0,0,0,0.9)' : '0 1px 2px rgba(0,0,0,0.9)',
                boxShadow: activeMode === 'defense' ? '0 0 14px rgba(59,130,246,0.7)' : 'none',
                lineHeight: 1,
              }}
            >
              🛡️<span>{def}</span>
            </div>
          </div>
        </div>
      </div>
      {isDefense && <div className="absolute top-1.5 left-1.5"><span className={isBig ? 'text-xl' : 'text-base'}>🛡️</span></div>}
      {isWinner && <div className="absolute top-1.5 right-1.5 kc-win-badge"><span className={`${isBig ? 'text-2xl' : 'text-lg'} drop-shadow-lg`}>👑</span></div>}
    </div>
  );
}

function CardBack({ side }: { side: 'player' | 'ai' }) {
  const isPlayer = side === 'player';
  const color = isPlayer ? '#22c55e' : '#ef4444';
  return (
    <div
      className="inline-block rounded-xl relative overflow-hidden"
      style={{
        width: 180,
        height: 250,
        background: `linear-gradient(135deg, rgba(21,29,59,0.98) 0%, rgba(14,20,45,0.98) 50%, ${color}22 100%)`,
        border: `3px solid ${color}aa`,
        boxShadow: `0 6px 20px rgba(0,0,0,0.6), 0 0 22px ${color}55, inset 0 0 30px ${color}22`,
      }}
    >
      <div
        className="absolute inset-3 rounded-lg flex items-center justify-center"
        style={{ border: `2px dashed ${color}99`, background: `radial-gradient(circle, ${color}18, transparent 70%)` }}
      >
        <span
          className="font-black"
          style={{
            fontSize: '88px',
            lineHeight: 1,
            color,
            textShadow: `0 0 24px ${color}cc, 0 4px 10px rgba(0,0,0,0.85)`,
          }}
        >
          ?
        </span>
      </div>
      <div
        className="absolute bottom-2 left-0 right-0 text-center font-black"
        style={{ fontSize: '13px', color, textShadow: '0 1px 4px rgba(0,0,0,0.9)' }}
      >
        {isPlayer ? 'あなた' : '相手'}
      </div>
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
