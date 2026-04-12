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
  sampleCardsWithSynergy,
  INITIAL_DECK_SIZE,
  MAX_DECK_SIZE,
  MIN_DECK_SIZE,
  MAX_SSR,
  MAX_SR,
  MAX_SAME_NAME,
  ALL_BATTLE_CARDS,
} from '@/lib/knowledgeCards';
import { CARD_RARITY_IMAGES } from '@/lib/constants';
import {
  type GameState,
  type GamePhase,
  type Side,
  type BenchBoostDetail,
  BENCH_MAX_SLOTS,
  TOTAL_ROUNDS,
  initGameState,
  startBattle,
  beginAttackLoop,
  revealNextAttackCard,
  hasAttackSucceeded,
  resolveSubBattleWin,
  continueAfterResolve,
  advanceToNextRound,
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
const RESOLVE_BANNER_MS   = 2200;  // "🏆 フラッグ奪取！" outcome banner (派手演出)
const TURN_TRANSITION_MS  = 1500;  // "🔄 相手のターン！" big banner between sub-battles
const FINAL_REVEAL_MS     = 1800;  // hold the final game_over overlay before going to result

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
    | 'turn_transition'
    | 'round_end'
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
  // Bench boost animation telop (shown during card reveal when bench aura fires)
  const [benchBoostTelop, setBenchBoostTelop] = useState<{ text: string; key: number } | null>(null);
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
    cards: BattleCard[];       // 5 cards offered this round
    blocked: Set<number>;      // indices the player failed the quiz on
    acquired: Set<number>;     // indices already added
    redrawsLeft: number;
    addedCardIds: string[];    // ids added to player.deck this offer (for redraw rollback)
  }
  const [deckOffer, setDeckOffer] = useState<DeckOffer | null>(null);
  // Round → max cards the player may keep this deck phase.
  // R5 is special: only 1 SR/SSR may be acquired. Other rounds: up to 2.
  const maxPicksForRound = (round: number): number => (round >= 5 ? 1 : 2);
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

  // ===== Bench glow auto-clear (1.5s) =====
  useEffect(() => {
    if (!gameState?.benchGlow) return;
    const id = window.setTimeout(() => {
      setGameState((prev) => (prev && prev.benchGlow ? { ...prev, benchGlow: null } : prev));
    }, 1500);
    return () => clearTimeout(id);
  }, [gameState?.benchGlow?.key]);

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

  // ===== Deck phase setup (fires at the start of each round) =====
  // 各ラウンド開始時にデッキフェイズ: 5枚提示→最大2枚取得でバトルへ。
  useEffect(() => {
    if (!gameState || gameState.phase !== 'deck_phase' || deckOffer) return;
    const offered = sampleCardsWithSynergy(5, 'offer', gameState.round, gameState.player.deck);
    setDeckOffer({
      cards: offered,
      blocked: new Set(),
      acquired: new Set(),
      redrawsLeft: 3,
      addedCardIds: [],
    });
  }, [gameState?.phase, deckOffer]);

  // Track unmount so the battle loop can exit without relying on effect
  // cleanup (which would fire on every phase change and kill the cinematic).
  useEffect(() => () => { unmountedRef.current = true; }, []);

  // Mirror gameState into a ref so the async battle loop can read the latest
  // state (e.g. flagHolder) without recreating the effect on every render.
  const gameStateRef = useRef<GameState | null>(null);
  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);

  // Waits until the player clicks the manual-reveal button, with a 30s safety timeout.
  // Used only when the PLAYER is the attacker (AI turns remain automatic).
  const waitForPlayerAction = useCallback((): Promise<void> => {
    if (unmountedRef.current) return Promise.resolve();
    return new Promise((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        playerActionLatchRef.current = null;
        resolve();
      };
      playerActionLatchRef.current = finish;
      // 30s safety timeout: auto-resolve if player doesn't act
      const safetyId = window.setTimeout(() => {
        if (!settled) {
          console.warn('[KC] waitForPlayerAction: 30s safety timeout fired');
          finish();
        }
      }, 30000);
      stepTimeoutsRef.current.push(safetyId);
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
      console.log('[KC] battle loop: START (round', gameState.round, ', flagHolder', gameState.flagHolder, ', unmounted:', unmountedRef.current, ')');
      try {
        // Step 1: turn banner
        console.log('[KC] → turn_banner (unmounted:', unmountedRef.current, ')');
        setCineStep('turn_banner');
        await waitStep(TURN_BANNER_MS);
        console.log('[KC] turn_banner waitStep resolved (unmounted:', unmountedRef.current, ')');
        if (unmountedRef.current) { console.log('[KC] BAIL: unmounted after turn_banner'); return; }

        // Step 2: defender shown
        console.log('[KC] → defender_show (unmounted:', unmountedRef.current, ')');
        setCineStep('defender_show');
        await waitStep(DEFENDER_SHOW_MS);
        console.log('[KC] defender_show waitStep resolved (unmounted:', unmountedRef.current, ')');
        if (unmountedRef.current) { console.log('[KC] BAIL: unmounted after defender_show'); return; }

        // ===== Defender bench boost animation =====
        {
          const gs = gameStateRef.current;
          if (gs && gs.benchBoostDetails && gs.benchBoostDetails.length > 0) {
            const details = gs.benchBoostDetails;
            const defSide = gs.flagHolder;
            const glowNames = details.map((d) => d.benchCardName.split('+')[0]);
            setGameState((prev) => prev ? {
              ...prev,
              benchGlow: { side: defSide, names: glowNames, key: Date.now() },
            } : prev);

            for (let i = 0; i < details.length; i++) {
              if (unmountedRef.current) return;
              const d = details[i];
              const parts: string[] = [];
              if (d.defBonus > 0) parts.push(`🛡️+${d.defBonus}`);
              if (d.atkBonus !== 0) parts.push(`⚔️${d.atkBonus > 0 ? '+' : ''}${d.atkBonus}`);
              setBenchBoostTelop({ text: `📋 ${d.benchCardName} → ${parts.join(' ')}！`, key: Date.now() + i });
              await waitStep(500);
              if (unmountedRef.current) return;
            }
            if (details.length > 1) {
              const totalDef = details.reduce((s, d) => s + d.defBonus, 0);
              const totalAtk = details.reduce((s, d) => s + d.atkBonus, 0);
              const comboParts: string[] = [];
              if (totalAtk !== 0) comboParts.push(`攻撃${totalAtk > 0 ? '+' : ''}${totalAtk}`);
              if (totalDef !== 0) comboParts.push(`防御${totalDef > 0 ? '+' : ''}${totalDef}`);
              setBenchBoostTelop({ text: `🔥 コンボ！合計 ${comboParts.join(' ')}！`, key: Date.now() + 999 });
              await waitStep(700);
              if (unmountedRef.current) return;
            }
            setBenchBoostTelop(null);
            setGameState((prev) => prev ? { ...prev, benchGlow: null, benchBoostDetails: null } : prev);
          }
        }

        // Step 3: attack reveal loop. Branch on who's attacking — player turns
        // wait for manual reveal clicks; AI turns auto-progress.
        // Use flagHolder from the closure (guaranteed correct) — NOT gameStateRef
        // which may lag behind after setGameState batching.
        const attackerSide: 'player' | 'ai' =
          gameState.flagHolder === 'player' ? 'ai' : 'player';
        const isPlayerAttacker = attackerSide === 'player';
        console.log('[KC] → attack_reveal (attacker:', attackerSide, ', isPlayerAttacker:', isPlayerAttacker, ')');
        setCineStep('attack_reveal');
        setGameState((prev) => (prev ? beginAttackLoop(prev) : prev));

        let loopGuard = 30;
        while (loopGuard-- > 0) {
          if (unmountedRef.current) return;
          if (isPlayerAttacker) {
            console.log('[KC] waiting for player reveal action...');
            setWaitingForPlayerReveal(true);
            await waitForPlayerAction();
            setWaitingForPlayerReveal(false);
          } else {
            console.log('[KC] AI auto-reveal: waiting', ATTACK_CARD_REVEAL_MS, 'ms');
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

          // ===== Bench boost power-up animation =====
          if (rs.benchBoostDetails && rs.benchBoostDetails.length > 0) {
            const details = rs.benchBoostDetails;
            const boostSide: 'player' | 'ai' = rs.flagHolder === 'player' ? 'ai' : 'player'; // attacker side
            // Glow the bench cards that contributed
            const glowNames = details.map((d) => d.benchCardName.split('+')[0]);
            setGameState((prev) => prev ? {
              ...prev,
              benchGlow: { side: boostSide, names: glowNames, key: Date.now() },
            } : prev);

            // Show each boost telop sequentially
            for (let i = 0; i < details.length; i++) {
              if (unmountedRef.current) return;
              const d = details[i];
              const parts: string[] = [];
              if (d.atkBonus > 0) parts.push(`⚔️+${d.atkBonus}`);
              if (d.atkBonus < 0) parts.push(`⚔️${d.atkBonus}`);
              if (d.defBonus > 0) parts.push(`🛡️+${d.defBonus}`);
              setBenchBoostTelop({ text: `📋 ${d.benchCardName} → ${parts.join(' ')}！`, key: Date.now() + i });
              await waitStep(500);
              if (unmountedRef.current) return;
            }
            // Combo telop if multiple boosts
            if (details.length > 1) {
              const totalAtk = details.reduce((s, d) => s + d.atkBonus, 0);
              const totalDef = details.reduce((s, d) => s + d.defBonus, 0);
              const comboParts: string[] = [];
              if (totalAtk !== 0) comboParts.push(`攻撃${totalAtk > 0 ? '+' : ''}${totalAtk}`);
              if (totalDef !== 0) comboParts.push(`防御${totalDef > 0 ? '+' : ''}${totalDef}`);
              setBenchBoostTelop({ text: `🔥 コンボ！合計 ${comboParts.join(' ')}！`, key: Date.now() + 999 });
              await waitStep(700);
              if (unmountedRef.current) return;
            }
            setBenchBoostTelop(null);
            // Clear bench glow
            setGameState((prev) => prev ? { ...prev, benchGlow: null, benchBoostDetails: null } : prev);
          }

          if (rs.phase === 'round_end') {
            // Deck-out → defender wins this round
            console.log('[KC] → round_end during reveal (deck-out): round', rs.round, 'winner:', rs.roundWinner);
            setCineStep('round_end');
            await waitStep(2000);
            if (unmountedRef.current) return;

            // Advance to next round (awards fans, resets bench, or game_over)
            setDeckOffer(null);
            let advanced: GameState | null = null;
            setGameState((prev) => {
              if (!prev) return prev;
              const next = advanceToNextRound(prev);
              advanced = next;
              return next;
            });
            await waitMs(16);
            if (unmountedRef.current || !advanced) return;

            const advs = advanced as GameState;
            if (advs.phase === 'game_over') {
              setCineStep('game_over');
              await waitStep(FINAL_REVEAL_MS);
              if (!unmountedRef.current) window.setTimeout(() => setScreen('result'), 900);
              return;
            }

            // Next round starts with deck_phase
            setCineStep('idle');
            battleRunningRef.current = false;
            return;
          }

          if (hasAttackSucceeded(rs)) {
            console.log('[KC] → attack succeeded, resolving');
            await waitStep(400);
            if (unmountedRef.current) return;

            // Capture defender's quarantine BEFORE resolution so we can show
            // a telop when it flushes into their bench.
            const defenderSideBefore: 'player' | 'ai' = rs.flagHolder;
            const quarantineBefore = rs.quarantine[defenderSideBefore].length;

            let resolved: GameState | null = null;
            setGameState((prev) => {
              if (!prev) return prev;
              const r = resolveSubBattleWin(prev);
              resolved = r;
              return r;
            });
            await waitMs(16);
            if (unmountedRef.current || !resolved) return;

            // Quarantine flush telop
            if (quarantineBefore > 0) {
              setGameState((prev) =>
                prev
                  ? {
                      ...prev,
                      effectTelop: {
                        text: `📦 隔離 ${quarantineBefore}枚 → ベンチへ流入！`,
                        color: '#22c55e',
                        key: Date.now() + Math.floor(Math.random() * 1000),
                      },
                    }
                  : prev,
              );
            }

            console.log('[KC] → resolve banner');
            setCineStep('resolve');
            const rzs = resolved as GameState;

            if (rzs.phase === 'round_end') {
              // Bench overflow → attacker wins this round
              console.log('[KC] → round_end after resolve: round', rzs.round, 'winner:', rzs.roundWinner);
              setCineStep('round_end');
              await waitStep(2000);
              if (unmountedRef.current) return;

              // Advance to next round
              setDeckOffer(null);
              let advanced: GameState | null = null;
              setGameState((prev) => {
                if (!prev) return prev;
                const next = advanceToNextRound(prev);
                advanced = next;
                return next;
              });
              await waitMs(16);
              if (unmountedRef.current || !advanced) return;

              const advs = advanced as GameState;
              if (advs.phase === 'game_over') {
                setCineStep('game_over');
                await waitStep(FINAL_REVEAL_MS);
                if (!unmountedRef.current) window.setTimeout(() => setScreen('result'), 900);
                return;
              }

              // Next round starts with deck_phase
              setCineStep('idle');
              battleRunningRef.current = false;
              return;
            }

            if (rzs.phase === 'game_over') {
              // Safety fallback (shouldn't happen from resolveSubBattleWin anymore)
              await waitStep(FINAL_REVEAL_MS);
              if (!unmountedRef.current) setCineStep('game_over');
              if (!unmountedRef.current) window.setTimeout(() => setScreen('result'), 900);
              return;
            }
            await waitStep(RESOLVE_BANNER_MS);
            if (unmountedRef.current) return;

            // Short pause after the resolve banner before kicking off the next sub-battle.
            await waitMs(300);
            if (unmountedRef.current) return;

            console.log('[KC] → continueAfterResolve (next sub-battle)');
            setGameState((prev) => (prev ? continueAfterResolve(prev) : prev));
            await waitMs(16);
            if (unmountedRef.current) return;

            // Turn transition banner — "🔄 相手のターン！" / "🔄 あなたのターン！"
            setCineStep('turn_transition');
            await waitStep(TURN_TRANSITION_MS);
            if (unmountedRef.current) return;

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
    // cineStep is in deps so the effect re-fires when run() ends with
    // setCineStep('idle') — that's how we kick off the NEXT sub-battle.
    // battleRunningRef gates re-entry mid-loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState?.phase, cineStep]);

  // ===== Manual advance: resolves whichever latch is currently active =====
  // Used by the skip button, the bottom "次へ" button, and "カードを出す ▶"
  // during the player-attacker reveal phase. Only touches a ref — no state
  // change, no risk of re-triggering the effect.
  const handleAdvance = useCallback(() => {
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
        ? { ...prev, phase: 'round_end' as GamePhase, roundWinner: 'ai' as Side, message: `第${prev.round}回戦: 攻撃を諦めた` }
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
    // Enforce per-round pick limit (R5 = 1, otherwise 2)
    const maxPicks = maxPicksForRound(gameState.round);
    if (deckOffer.acquired.size >= maxPicks) {
      toast.info(`このラウンドは${maxPicks}枚までです`);
      return;
    }
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
        // Add to deck (with swap UI if over max). Track id for redraw rollback.
        setDeckOffer((prev) => {
          if (!prev) return prev;
          const acquired = new Set(prev.acquired);
          acquired.add(idx);
          return { ...prev, acquired, addedCardIds: [...prev.addedCardIds, card.id] };
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
  // 獲得済みカードはデッキに残したまま、未選択カードだけ入れ替える。
  const handleRedraw = useCallback(() => {
    if (!deckOffer || deckOffer.redrawsLeft <= 0 || !gameState) return;
    const maxPicks = maxPicksForRound(gameState.round);
    if (deckOffer.acquired.size >= maxPicks) return; // もう選べないなら引き直し不要

    // 未選択カードの数だけ新しく引く
    const remainingPicks = maxPicks - deckOffer.acquired.size;
    const newCount = 5 - deckOffer.acquired.size;
    const newCards = sampleCardsWithSynergy(newCount, 'offer', gameState.round, gameState.player.deck);

    // 獲得済みカードを保持し、未選択分だけ差し替え
    const updatedCards: BattleCard[] = [];
    const updatedAcquired = new Set<number>();
    const updatedBlocked = new Set<number>();

    // 獲得済みカードを先頭に配置
    let newIdx = 0;
    for (const oldIdx of Array.from(deckOffer.acquired)) {
      updatedCards.push(deckOffer.cards[oldIdx]);
      updatedAcquired.add(newIdx);
      newIdx++;
    }
    // 新しいカードを追加
    for (const card of newCards) {
      updatedCards.push(card);
      newIdx++;
    }

    toast.info(`獲得済み${deckOffer.acquired.size}枚を保持して残り${newCount}枚を引き直し`);

    setDeckOffer({
      cards: updatedCards,
      blocked: updatedBlocked,
      acquired: updatedAcquired,
      redrawsLeft: deckOffer.redrawsLeft - 1,
      addedCardIds: deckOffer.addedCardIds, // 獲得済みカードのIDは保持
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

    if (next.phase === 'round_end') {
      // Deck was empty at battle start → handle round_end immediately
      setCineStep('round_end');
      window.setTimeout(() => {
        setDeckOffer(null);
        setGameState((prev) => {
          if (!prev) return prev;
          return advanceToNextRound(prev);
        });
        setCineStep('idle');
      }, 2000);
    } else {
      setCineStep('idle');
    }
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
    const rewardAlt = won ? 30 : 5;
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center px-6 relative"
        style={{ background: won
          ? 'radial-gradient(ellipse at center, rgba(255,215,0,0.12), #0b1128 60%, #151d3b)'
          : 'linear-gradient(180deg, #05060e 0%, #0b1128 100%)' }}
      >
        {/* Victory confetti on result page */}
        {won && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
            {Array.from({ length: 36 }).map((_, i) => (
              <span
                key={`res-confetti-${i}`}
                className="kc-confetti-piece kc-confetti-slow"
                style={{
                  left: `${(i * 2.9 + 2) % 100}%`,
                  background: ['#ffd700', '#ff6b6b', '#4ade80', '#60a5fa', '#f5d76e', '#ffffff'][i % 6],
                  animationDelay: `${(i % 10) * 0.12}s`,
                }}
              />
            ))}
          </div>
        )}
        <div
          className="rounded-2xl p-6 w-full max-w-sm text-center relative overflow-hidden z-10"
          style={{
            background: 'linear-gradient(135deg, rgba(21,29,59,0.95), rgba(14,20,45,0.95))',
            border: `2px solid ${won ? 'rgba(255,215,0,0.65)' : 'rgba(239,68,68,0.35)'}`,
            boxShadow: `inset 0 0 30px ${won ? 'rgba(255,215,0,0.12)' : 'rgba(239,68,68,0.05)'}, 0 8px 32px rgba(0,0,0,0.5)`,
          }}
        >
          <div className="kc-result-icon mb-2">
            <span className="text-6xl block">{won ? '🎉' : '💀'}</span>
          </div>
          <h2
            className="font-black mb-2"
            style={{
              fontSize: won ? '52px' : '42px',
              color: won ? '#ffd700' : '#9ca3af',
              textShadow: won
                ? '0 0 28px rgba(255,215,0,0.8), 0 0 56px rgba(255,215,0,0.4)'
                : '0 0 20px rgba(156,163,175,0.5)',
              lineHeight: 1.0,
            }}
          >
            {won ? '勝利！' : '敗北...'}
          </h2>

          {/* Fan totals */}
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="text-center px-4 py-2 rounded-lg" style={{ background: 'rgba(34,197,94,0.18)', border: '2px solid rgba(34,197,94,0.45)' }}>
              <p className="text-[9px] text-green-200/70 mb-0.5">あなた</p>
              <span className="text-3xl font-black text-green-300" style={{ textShadow: '0 0 12px rgba(34,197,94,0.6)' }}>🎐 {gameState.playerFans}</span>
            </div>
            <span className="text-lg font-black text-amber-200/50">VS</span>
            <div className="text-center px-4 py-2 rounded-lg" style={{ background: 'rgba(239,68,68,0.15)', border: '2px solid rgba(239,68,68,0.4)' }}>
              <p className="text-[9px] text-red-200/70 mb-0.5">相手</p>
              <span className="text-3xl font-black text-red-300" style={{ textShadow: '0 0 12px rgba(239,68,68,0.6)' }}>🎐 {gameState.aiFans}</span>
            </div>
          </div>
          <div
            className="rounded-lg px-3 py-1.5 mb-3 mx-auto"
            style={{
              background: won ? 'rgba(255,215,0,0.1)' : 'rgba(239,68,68,0.1)',
              border: `1px solid ${won ? 'rgba(255,215,0,0.25)' : 'rgba(239,68,68,0.25)'}`,
            }}
          >
            <p className="text-xs font-bold" style={{ color: won ? '#ffd700' : '#fca5a5' }}>
              {gameState.message}
            </p>
          </div>
          <div
            className="rounded-lg px-3 py-2 mb-4 mx-auto kc-reward-pop"
            style={{ background: 'rgba(255,215,0,0.1)', border: '1px solid rgba(255,215,0,0.3)' }}
          >
            <p className="text-[10px] text-amber-200/70">獲得ALT</p>
            <p className="text-2xl font-black" style={{ color: '#ffd700', textShadow: '0 0 10px rgba(255,215,0,0.6)' }}>
              +{rewardAlt}
            </p>
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

          {/* ===== ベンチ & 隔離スペース表示 ===== */}
          {([
            { label: 'あなたのベンチ', bench: gameState.player.bench, color: '#22c55e', quarantine: gameState.quarantine.player },
            { label: '相手のベンチ', bench: gameState.ai.bench, color: '#ef4444', quarantine: gameState.quarantine.ai },
          ] as const).map(({ label, bench, color, quarantine }) => (
            <div key={label} className="rounded-lg p-2 mb-3 text-left" style={{ background: 'rgba(0,0,0,0.25)', border: `1px solid ${color}22` }}>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-[10px] font-bold" style={{ color }}>{label}</p>
                <p className="text-[9px] text-amber-200/50">{bench.length}/6 スロット</p>
              </div>
              {bench.length === 0 ? (
                <p className="text-[10px] text-amber-200/30 text-center py-1">（なし）</p>
              ) : (
                <div className="grid grid-cols-3 gap-1.5">
                  {bench.map((slot) => {
                    const catInfo = CATEGORY_INFO[slot.card.category];
                    return (
                      <div key={slot.name} className="relative rounded-md overflow-hidden" style={{ aspectRatio: '3/4' }}>
                        {slot.card.imageUrl ? (
                          <img src={slot.card.imageUrl} alt={slot.name} className="w-full h-full object-cover" loading="lazy" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-lg" style={{ background: `${catInfo.color}15` }}>{catInfo.emoji}</div>
                        )}
                        <img src={CARD_RARITY_IMAGES[slot.card.rarity] || CARD_RARITY_IMAGES['N']} alt="" className="absolute inset-0 w-full h-full object-cover pointer-events-none" style={{ zIndex: 2 }} />
                        <span className="absolute left-0 right-0 text-center font-bold text-white truncate px-0.5" style={{ bottom: '10px', fontSize: '7px', textShadow: '0 1px 3px rgba(0,0,0,0.95)', zIndex: 3 }}>
                          {slot.name}
                        </span>
                        {slot.count > 1 && (
                          <div className="absolute top-0.5 right-0.5 rounded-full min-w-[14px] h-[14px] flex items-center justify-center px-0.5" style={{ background: '#ffd700', border: '1px solid rgba(0,0,0,0.5)', zIndex: 4 }}>
                            <span className="text-[8px] font-black text-black">×{slot.count}</span>
                          </div>
                        )}
                        <span className="absolute flex items-center gap-0.5 px-0.5 rounded font-black" style={{ bottom: '1px', left: '5%', background: 'rgba(239,68,68,0.85)', color: '#fff', fontSize: '7px', lineHeight: 1, zIndex: 3 }}>
                          ⚔️{slot.card.attackPower ?? slot.card.power}
                        </span>
                        <span className="absolute flex items-center gap-0.5 px-0.5 rounded font-black" style={{ bottom: '1px', right: '5%', background: 'rgba(59,130,246,0.85)', color: '#fff', fontSize: '7px', lineHeight: 1, zIndex: 3 }}>
                          🛡️{slot.card.defensePower ?? slot.card.power}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
              {quarantine.length > 0 && (
                <div className="mt-2 pt-1.5" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  <p className="text-[9px] text-amber-200/40 mb-1">🚫 隔離 ({quarantine.length}枚)</p>
                  <div className="flex flex-wrap gap-1">
                    {quarantine.map((c, i) => (
                      <span key={i} className="text-[8px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(156,163,175,0.15)', color: '#9ca3af', border: '1px solid rgba(156,163,175,0.2)' }}>
                        {c.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}

          <div className="flex flex-col gap-2">
            <button onClick={handleFinish} className="rpg-btn rpg-btn-gold w-full py-3 text-base">
              {won ? '🎯 次のステージへ' : '📋 ステージ選択に戻る'}
            </button>
            <div className="flex gap-2">
              <button
                onClick={() => { setScreen('title'); setGameState(null); }}
                className="rpg-btn rpg-btn-blue flex-1 py-2.5 text-sm"
              >
                🔄 リトライ
              </button>
              <button
                onClick={() => navigate('/games')}
                className="flex-1 py-2.5 text-sm rounded-lg font-bold"
                style={{ background: 'rgba(255,255,255,0.1)', border: '2px solid rgba(255,255,255,0.25)', color: 'rgba(255,255,255,0.85)' }}
              >
                ← ゲーム一覧
              </button>
            </div>
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
        <div className="flex items-center gap-2">
          <div className="text-center">
            <p className="text-[9px] font-bold text-amber-200/50">R</p>
            <p className="text-base font-black" style={{ color: '#ffd700', textShadow: '0 0 8px rgba(255,215,0,0.5)' }}>
              {gameState.round}/{TOTAL_ROUNDS}
            </p>
          </div>
          {/* Fan totals — primary win condition display */}
          <div className="text-center px-2 py-1 rounded-lg" style={{ background: 'rgba(34,197,94,0.14)', border: '1.5px solid rgba(34,197,94,0.5)' }}>
            <p className="text-[9px] font-bold text-green-200/80">あなた</p>
            <p className="text-base font-black" style={{ color: '#4ade80', textShadow: '0 0 8px rgba(34,197,94,0.6)' }}>
              🎐 {gameState.playerFans}
            </p>
          </div>
          <span className="text-[10px] font-black text-amber-200/60">vs</span>
          <div className="text-center px-2 py-1 rounded-lg" style={{ background: 'rgba(239,68,68,0.14)', border: '1.5px solid rgba(239,68,68,0.5)' }}>
            <p className="text-[9px] font-bold text-red-200/80">相手</p>
            <p className="text-base font-black" style={{ color: '#fca5a5', textShadow: '0 0 8px rgba(239,68,68,0.6)' }}>
              🎐 {gameState.aiFans}
            </p>
          </div>
          <div className="text-center px-2 py-1 rounded-lg" style={{ background: 'rgba(255,215,0,0.12)', border: '1.5px solid rgba(255,215,0,0.4)' }}>
            <p className="text-[9px] font-bold text-amber-200/70">🏆</p>
            <p className="text-xs font-black" style={{ color: gameState.flagHolder === 'player' ? '#22c55e' : '#ef4444' }}>
              {gameState.flagHolder === 'player' ? 'あなた' : '相手'}
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
      <BenchDisplay
        side="ai"
        bench={gameState.ai.bench}
        deckCount={gameState.ai.deck.length}
        quarantineCount={gameState.quarantine.ai.length}
        animKey={gameState.history.length}
        glowNames={gameState.benchGlow?.side === 'ai' ? gameState.benchGlow.names : undefined}
      />

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
        const defenderBasePower = defenderCard ? getBaseDefense(defenderCard) : 0;
        const defenderPower = Math.max(0, defenderBasePower + gameState.defenderBonus);
        const attackCards = gameState.attackRevealed;
        const attackPower = gameState.attackCurrentPower;

        const shouldShowAttackPile = cineStep === 'attack_reveal' || cineStep === 'resolve';
        const attackerWonSub = cineStep === 'resolve' && gameState.lastSubBattle?.winner === attackerSide;

        // 防御カードは defenderCard が存在する間、常に表面で表示する。
        // 裏面 (CardBack) は防御カードがまだ引かれていない (= 試合開始直後の
        // turn_banner 前) のごく短い時間だけ。攻撃側のカードバックは別ロジック。
        const renderDefenderSlot = () => {
          if (!defenderCard) {
            return <CardBack side={defenderSide} />;
          }
          const shatter = attackerWonSub;
          return (
            <div className={`relative ${shatter ? 'kc-card-shatter' : 'kc-defender-glow'}`}>
              {/* 防御パワーラベル: カードの上に常時表示。defender_show 中は強調アニメ */}
              <div
                className={`absolute left-1/2 -translate-x-1/2 -top-14 whitespace-nowrap z-20 ${cineStep === 'defender_show' ? 'kc-defense-label' : ''}`}
              >
                <p
                  style={{
                    fontSize: '30px',
                    fontWeight: 900,
                    color: '#60a5fa',
                    textShadow: '0 0 18px rgba(96,165,250,1), 0 0 28px rgba(96,165,250,0.7), 0 2px 6px rgba(0,0,0,0.95)',
                    background: 'linear-gradient(180deg, rgba(14,20,45,0.85), rgba(21,29,59,0.85))',
                    border: '2px solid rgba(96,165,250,0.65)',
                    borderRadius: '10px',
                    padding: '4px 14px',
                    boxShadow: '0 0 20px rgba(96,165,250,0.45), 0 4px 12px rgba(0,0,0,0.6)',
                  }}
                >
                  🛡️ 防御パワー {defenderPower}
                </p>
              </div>
              <CardDisplay card={defenderCard} size="battle" mode="defense" />
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
              {/* Earlier attack cards stacked behind (offset by a bit).
                  On sub-battle resolve they fade out toward the off-screen
                  quarantine area via kc-card-exile. */}
              {attackCards.slice(0, -1).map((c, i) => (
                <div key={`stack-${i}`} className={`absolute ${attackerWonSub ? 'kc-card-exile' : ''}`}
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
          <>
            <div className="absolute inset-0 pointer-events-none z-30 kc-gold-flash" />
            {/* Confetti particles */}
            <div className="absolute inset-0 pointer-events-none z-[35] overflow-hidden">
              {Array.from({ length: 24 }).map((_, i) => (
                <span
                  key={`confetti-${gameState.lastSubBattle?.idx}-${i}`}
                  className="kc-confetti-piece"
                  style={{
                    left: `${(i * 4.2 + 5) % 100}%`,
                    background: ['#ffd700', '#ff6b6b', '#4ade80', '#60a5fa', '#f5d76e'][i % 5],
                    animationDelay: `${(i % 6) * 0.08}s`,
                  }}
                />
              ))}
            </div>
          </>
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

        {/* ====== AI AREA (top half) ======
             Layout: [AI card center] [AI deck stack right] */}
        <div className="flex-1 flex items-center justify-center gap-4 relative px-4">
          {playerIsDefender ? renderAttackerSlot() : renderDefenderSlot()}
          <MiniDeckStack count={gameState.ai.deck.length} color="#ef4444" />
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

        {/* ====== PLAYER AREA (bottom half) ======
             Layout: [player deck stack left] [player card center]
             The deck stack is tappable while the player is the attacker
             and the loop is waiting on a manual reveal. */}
        <div className="flex-1 flex items-center justify-center gap-4 relative px-4">
          {(() => {
            const playerIsAttacker = gameState.flagHolder === 'ai';
            const tappable = playerIsAttacker && waitingForPlayerReveal && cineStep === 'attack_reveal';
            const defenderEffectiveDef = gameState.defenseCard
              ? Math.max(0, (gameState.defenseCard.defensePower ?? gameState.defenseCard.power) + gameState.defenderBonus)
              : 0;
            return (
              <div className="flex flex-col items-center gap-1.5">
                {tappable && (
                  <p className="font-black whitespace-nowrap" style={{ fontSize: '13px', color: '#ff6b6b', textShadow: '0 0 8px rgba(239,68,68,0.6)' }}>
                    ⚔️ {gameState.attackCurrentPower} / 🛡️ {defenderEffectiveDef}
                  </p>
                )}
                <MiniDeckStack
                  count={gameState.player.deck.length}
                  color="#22c55e"
                  interactive={tappable}
                  glow={tappable}
                  onTap={handleAdvance}
                />
                {tappable && (
                  <button
                    onClick={handleForfeitAttack}
                    className="text-center"
                    style={{ fontSize: '11px', color: 'rgba(255,255,255,0.55)', textDecoration: 'underline' }}
                  >
                    🏳️ 攻撃をやめる
                  </button>
                )}
                {!tappable && playerIsAttacker && (
                  <p className="text-[10px] font-bold text-amber-200/50">あなたの山札</p>
                )}
              </div>
            );
          })()}
          {playerIsDefender ? renderDefenderSlot() : renderAttackerSlot()}
        </div>


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

        {/* ====== Resolve Banner (flag capture) ====== */}
        {cineStep === 'resolve' && gameState.lastSubBattle && (() => {
          const playerWon = gameState.lastSubBattle.winner === 'player';
          const trophy = gameState.trophyFans[Math.min(gameState.round - 1, gameState.trophyFans.length - 1)] ?? 0;
          const playerLead = gameState.playerFans - gameState.aiFans;
          return (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-40">
              <div
                className="kc-outcome-banner"
                style={{
                  padding: '28px 44px',
                  borderRadius: '20px',
                  textAlign: 'center',
                  background: playerWon
                    ? 'radial-gradient(circle, rgba(255,215,0,0.55), rgba(245,151,0,0.18))'
                    : 'linear-gradient(135deg, rgba(239,68,68,0.55), rgba(185,28,28,0.18))',
                  border: `4px solid ${playerWon ? '#ffd700' : '#ef4444'}`,
                  boxShadow: `0 0 80px ${playerWon ? 'rgba(255,215,0,0.95)' : 'rgba(239,68,68,0.85)'}`,
                }}
              >
                <p
                  style={{
                    fontSize: '48px',
                    fontWeight: 900,
                    color: playerWon ? '#ffd700' : '#fca5a5',
                    textShadow: `0 0 30px ${playerWon ? 'rgba(255,215,0,1)' : 'rgba(239,68,68,0.95)'}, 0 4px 10px rgba(0,0,0,0.9)`,
                    margin: 0,
                    lineHeight: 1.0,
                  }}
                >
                  {playerWon ? '🏆 フラッグ奪取！' : '💥 フラッグを奪われた！'}
                </p>
                <p
                  className="mt-2 kc-fan-count"
                  style={{
                    fontSize: '28px',
                    fontWeight: 900,
                    color: playerWon ? '#fde047' : '#fecaca',
                    textShadow: '0 2px 8px rgba(0,0,0,0.85)',
                  }}
                >
                  🎐 +{trophy} ファン！
                </p>
                <p className="text-xs text-amber-200/70 mt-2">
                  攻撃 {gameState.lastSubBattle.attackPower} vs 防御 {getBaseDefense(gameState.lastSubBattle.defenderCard)}
                </p>
                {Math.abs(playerLead) > 0 && (
                  <p className="text-[13px] font-bold mt-1" style={{ color: playerLead >= 0 ? '#4ade80' : '#fca5a5' }}>
                    {playerLead >= 0
                      ? `あなたが ${playerLead} ファン リード！`
                      : `相手が ${-playerLead} ファン リード...`}
                  </p>
                )}
              </div>
            </div>
          );
        })()}

        {/* ====== Turn Transition Banner ====== */}
        {cineStep === 'turn_transition' && (() => {
          const playerDefends = gameState.flagHolder === 'player';
          return (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-40">
              <div
                className="kc-turn-transition"
                style={{
                  padding: '20px 44px',
                  borderRadius: '18px',
                  textAlign: 'center',
                  background: playerDefends
                    ? 'linear-gradient(135deg, rgba(59,130,246,0.55), rgba(37,99,235,0.2))'
                    : 'linear-gradient(135deg, rgba(239,68,68,0.55), rgba(185,28,28,0.2))',
                  border: `4px solid ${playerDefends ? '#3b82f6' : '#ef4444'}`,
                  boxShadow: `0 0 70px ${playerDefends ? 'rgba(59,130,246,0.85)' : 'rgba(239,68,68,0.85)'}`,
                }}
              >
                <p
                  style={{
                    fontSize: '32px',
                    fontWeight: 900,
                    color: playerDefends ? '#93c5fd' : '#fca5a5',
                    textShadow: `0 0 26px ${playerDefends ? 'rgba(59,130,246,1)' : 'rgba(239,68,68,1)'}, 0 2px 8px rgba(0,0,0,0.9)`,
                    margin: 0,
                    lineHeight: 1.1,
                  }}
                >
                  {playerDefends
                    ? '🛡️ 相手のターン！あなたは防御です'
                    : '⚔️ あなたのターン！攻撃せよ！'}
                </p>
              </div>
            </div>
          );
        })()}

        {/* ====== Round End Banner ====== */}
        {cineStep === 'round_end' && gameState.phase === 'round_end' && (() => {
          const playerWonRound = gameState.roundWinner === 'player';
          const trophy = gameState.trophyFans[gameState.round - 1] ?? 0;
          const cause = gameState.message.includes('デッキ') ? '💀 デッキ切れ！' : '💀 ベンチ満杯！';
          return (
            <>
              {/* Full-screen flash */}
              <div
                className="absolute inset-0 pointer-events-none z-30"
                style={{
                  background: playerWonRound ? 'rgba(255,215,0,0.25)' : 'rgba(239,68,68,0.15)',
                  animation: 'kcRedFlash 1s ease-out forwards',
                }}
              />
              {/* Confetti for wins */}
              {playerWonRound && (
                <div className="absolute inset-0 pointer-events-none overflow-hidden z-35">
                  {Array.from({ length: 24 }).map((_, i) => (
                    <span
                      key={`rend-conf-${i}`}
                      className="kc-confetti-piece"
                      style={{
                        left: `${(i * 4.2 + 1) % 100}%`,
                        background: ['#ffd700', '#ff6b6b', '#4ade80', '#60a5fa', '#f5d76e'][i % 5],
                        animationDelay: `${(i % 8) * 0.1}s`,
                      }}
                    />
                  ))}
                </div>
              )}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-40">
                <div
                  className="kc-turn-transition"
                  style={{
                    padding: '28px 40px',
                    borderRadius: '18px',
                    textAlign: 'center',
                    background: playerWonRound
                      ? 'linear-gradient(135deg, rgba(34,197,94,0.7), rgba(22,163,74,0.3))'
                      : 'linear-gradient(135deg, rgba(239,68,68,0.7), rgba(185,28,28,0.3))',
                    border: `4px solid ${playerWonRound ? '#22c55e' : '#ef4444'}`,
                    boxShadow: `0 0 70px ${playerWonRound ? 'rgba(34,197,94,0.85)' : 'rgba(239,68,68,0.85)'}`,
                  }}
                >
                  <p style={{ fontSize: '20px', fontWeight: 700, color: 'rgba(255,255,255,0.7)', margin: '0 0 4px', textShadow: '0 1px 4px rgba(0,0,0,0.9)' }}>
                    {cause}
                  </p>
                  <p style={{
                    fontSize: playerWonRound ? '36px' : '30px',
                    fontWeight: 900,
                    color: playerWonRound ? '#ffd700' : '#fca5a5',
                    textShadow: `0 0 26px ${playerWonRound ? 'rgba(255,215,0,0.8)' : 'rgba(239,68,68,0.8)'}, 0 2px 8px rgba(0,0,0,0.9)`,
                    margin: '0 0 8px',
                    lineHeight: 1.2,
                  }}>
                    {playerWonRound ? `🏆 第${gameState.round}回戦 勝利！` : `第${gameState.round}回戦 敗北...`}
                  </p>
                  <p style={{ fontSize: '18px', fontWeight: 800, color: playerWonRound ? '#4ade80' : '#ef4444', margin: 0, textShadow: '0 1px 3px rgba(0,0,0,0.9)' }}>
                    {playerWonRound ? `+${trophy} ファン！` : `相手に +${trophy} ファン`}
                  </p>
                </div>
              </div>
            </>
          );
        })()}

        {/* ====== game_over inline (派手な最終演出) ====== */}
        {gameState.phase === 'game_over' && (() => {
          const won = gameState.winner === 'player';
          return (
            <>
              {/* Full-screen brightness/darkness overlay */}
              <div
                className="absolute inset-0 pointer-events-none z-40 kc-final-overlay"
                style={{
                  background: won
                    ? 'radial-gradient(circle, rgba(255,215,0,0.45), rgba(0,0,0,0.35))'
                    : 'linear-gradient(180deg, rgba(0,0,0,0.75), rgba(10,5,15,0.88))',
                }}
              />
              {/* Final confetti for victory */}
              {won && (
                <div className="absolute inset-0 pointer-events-none z-[41] overflow-hidden">
                  {Array.from({ length: 40 }).map((_, i) => (
                    <span
                      key={`final-confetti-${i}`}
                      className="kc-confetti-piece kc-confetti-slow"
                      style={{
                        left: `${(i * 2.6 + 3) % 100}%`,
                        background: ['#ffd700', '#ff6b6b', '#4ade80', '#60a5fa', '#f5d76e', '#ffffff'][i % 6],
                        animationDelay: `${(i % 10) * 0.1}s`,
                      }}
                    />
                  ))}
                </div>
              )}
              <div className="absolute inset-0 flex items-center justify-center z-50 kc-final-reveal">
                <div className="text-center px-6">
                  <span className="text-7xl block mb-3 kc-final-icon">{won ? '🎉' : '💀'}</span>
                  <p
                    style={{
                      fontSize: won ? '64px' : '48px',
                      fontWeight: 900,
                      color: won ? '#ffd700' : '#9ca3af',
                      textShadow: won
                        ? '0 0 36px rgba(255,215,0,1), 0 0 72px rgba(255,215,0,0.6), 0 4px 12px rgba(0,0,0,0.9)'
                        : '0 0 28px rgba(156,163,175,0.7), 0 4px 12px rgba(0,0,0,0.9)',
                      margin: 0,
                      lineHeight: 1.0,
                    }}
                  >
                    {won ? '🎉 勝利！' : '敗北...'}
                  </p>
                  <p
                    className="mt-3 font-black"
                    style={{
                      fontSize: '22px',
                      color: won ? '#fde047' : '#d1d5db',
                      textShadow: '0 2px 8px rgba(0,0,0,0.85)',
                    }}
                  >
                    あなた 🎐 {gameState.playerFans} vs 相手 🎐 {gameState.aiFans}
                  </p>
                  <p className="text-[13px] font-bold text-amber-200/70 mt-2">
                    {gameState.message}
                  </p>
                </div>
              </div>
            </>
          );
        })()}
      </div>
        );
      })()}

      {/* Player Bench */}
      <BenchDisplay
        side="player"
        bench={gameState.player.bench}
        deckCount={gameState.player.deck.length}
        quarantineCount={gameState.quarantine.player.length}
        animKey={gameState.history.length}
        glowNames={gameState.benchGlow?.side === 'player' ? gameState.benchGlow.names : undefined}
      />

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

      {/* ===== Bench Boost Telop ===== */}
      {benchBoostTelop && (
        <div
          key={benchBoostTelop.key}
          className="fixed inset-0 z-[180] flex items-end justify-center pointer-events-none"
          style={{ paddingBottom: '25vh' }}
        >
          <div className="kc-bench-boost-telop px-5 py-3 rounded-xl text-center"
            style={{
              background: 'linear-gradient(180deg, rgba(0,10,40,0.9), rgba(0,5,20,0.9))',
              border: '2px solid rgba(96,165,250,0.8)',
              boxShadow: '0 0 24px rgba(96,165,250,0.5), 0 4px 20px rgba(0,0,0,0.7)',
              maxWidth: '90vw',
            }}
          >
            <p className="font-black" style={{
              fontSize: '24px',
              lineHeight: 1.3,
              color: benchBoostTelop.text.startsWith('🔥') ? '#ffd700' : '#60a5fa',
              textShadow: benchBoostTelop.text.startsWith('🔥')
                ? '0 0 16px rgba(255,215,0,0.8), 0 2px 8px rgba(0,0,0,0.9)'
                : '0 0 16px rgba(96,165,250,0.8), 0 2px 8px rgba(0,0,0,0.9)',
            }}>
              {benchBoostTelop.text}
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
                5 枚の中から{maxPicksForRound(gameState.round)}枚まで選べる。タップでクイズ出題、正解で追加。
                <br />
                獲得 {deckOffer.acquired.size}/{maxPicksForRound(gameState.round)} ・ デッキ {deckCount}/{MAX_DECK_SIZE} 枚
              </p>
            </div>

            {/* ===== 2-col (md+) / stacked (mobile) ===== */}
            <div className="flex-1 min-h-0 overflow-y-auto md:overflow-hidden px-4 md:grid md:grid-cols-2 md:gap-4">
              {/* 左: 提示カード */}
              <div className="mb-3 md:mb-0 md:flex md:flex-col md:min-h-0">
                <p className="text-[11px] font-bold text-amber-100 mb-1.5 md:mb-2">
                  🎴 提示カード（5枚 / 獲得 {deckOffer.acquired.size}/{maxPicksForRound(gameState.round)}）
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
              const maxPicks = maxPicksForRound(gameState.round);
              const deckOk = gameState.player.deck.length >= MIN_DECK_SIZE;
              // Battle can always start when deck >= MIN. Picks are optional (0/1/2).
              const startEnabled = deckOk;
              const isFullPicks = acquiredCount >= maxPicks;
              const isZeroPicks = acquiredCount === 0;
              const label = !deckOk
                ? `デッキ最低${MIN_DECK_SIZE}枚必要`
                : isZeroPicks
                  ? '🃏 カードを取らずにバトル ▶'
                  : isFullPicks
                    ? '⚔️ バトル開始 ▶'
                    : `あと${maxPicks - acquiredCount}枚選べます ⚔️ バトル開始 ▶`;
              // 0-pick start uses a grey button (subtle), 1+ pick uses green
              const isPositive = startEnabled && !isZeroPicks;
              const redrawDisabled = deckOffer.redrawsLeft <= 0;
              const redrawHidden = isFullPicks; // 全枚数獲得済みなら引き直し非表示
              return (
                <div
                  className="p-4 pt-3 shrink-0"
                  style={{ borderTop: '1px solid rgba(255,215,0,0.2)', background: 'rgba(10,14,30,0.6)' }}
                >
                  {!redrawHidden && (
                    <button
                      onClick={handleRedraw}
                      disabled={redrawDisabled}
                      className="rpg-btn rpg-btn-blue w-full py-2 text-xs mb-2"
                      style={{ opacity: redrawDisabled ? 0.5 : 1 }}
                    >
                      {redrawDisabled ? '🔄 引き直し済み' : `🔄 引き直す（残り${deckOffer.redrawsLeft}回）`}
                    </button>
                  )}
                  <button
                    onClick={handleStartBattle}
                    disabled={!startEnabled}
                    className="w-full rounded-xl font-black active:scale-[0.98] transition-all"
                    style={{
                      minHeight: '64px',
                      fontSize: '1.1rem',
                      color: '#fff',
                      background: !startEnabled
                        ? 'rgba(90,90,100,0.5)'
                        : isPositive
                          ? 'linear-gradient(180deg, #22c55e 0%, #16a34a 100%)'
                          : 'linear-gradient(180deg, #6b7280 0%, #4b5563 100%)',
                      border: !startEnabled
                        ? '3px solid rgba(255,255,255,0.15)'
                        : isPositive
                          ? '3px solid #4ade80'
                          : '3px solid rgba(180,180,190,0.6)',
                      boxShadow: isPositive
                        ? '0 6px 24px rgba(34,197,94,0.55), 0 0 24px rgba(74,222,128,0.35)'
                        : startEnabled
                          ? '0 4px 16px rgba(0,0,0,0.4)'
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
        @keyframes kcDeckStackPulse {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-3px); }
        }
        .kc-deck-stack { animation: kcDeckStackPulse 1.6s ease-in-out infinite; }
        .kc-deck-stack:active { animation: none; }
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
        /* Defender loses → red flash → slide down to bench + shrink + fade */
        @keyframes kcCardShatter {
          0%   { opacity: 1; transform: scale(1); filter: brightness(1) drop-shadow(0 0 0 rgba(239,68,68,0)); }
          15%  { opacity: 1; transform: scale(1.08); filter: brightness(1.5) saturate(1.6) drop-shadow(0 0 24px rgba(239,68,68,0.95)); }
          35%  { opacity: 1; transform: scale(1.05); filter: brightness(1.4) drop-shadow(0 0 18px rgba(239,68,68,0.85)); }
          100% { opacity: 0; transform: scale(0.35) translateY(220px); filter: brightness(0.6); }
        }
        .kc-card-shatter { animation: kcCardShatter 0.9s ease-in forwards; }
        /* Non-last attack cards → fade out toward off-screen (quarantine) */
        @keyframes kcCardExile {
          0%   { opacity: 1; transform: scale(1) translateY(0); }
          100% { opacity: 0; transform: scale(0.4) translateY(-80px) translateX(120px); }
        }
        .kc-card-exile { animation: kcCardExile 0.7s ease-out forwards; }
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

        /* ===== 2026-04 派手演出 ===== */
        /* Gold flash on flag capture (player win) */
        @keyframes kcGoldFlash {
          0%   { opacity: 0; background: rgba(255,215,0,0); }
          15%  { opacity: 1; background: rgba(255,215,0,0.65); }
          100% { opacity: 0; background: rgba(255,215,0,0); }
        }
        .kc-gold-flash { animation: kcGoldFlash 0.5s ease-out forwards; }

        /* Confetti particles */
        @keyframes kcConfettiFall {
          0%   { opacity: 1; transform: translateY(-20vh) rotate(0deg); }
          100% { opacity: 0; transform: translateY(120vh) rotate(720deg); }
        }
        .kc-confetti-piece {
          position: absolute;
          top: 0;
          width: 8px;
          height: 14px;
          opacity: 0;
          border-radius: 2px;
          animation: kcConfettiFall 1.1s ease-in forwards;
        }
        .kc-confetti-slow {
          animation-duration: 3s;
        }

        /* "+N ファン！" count pop */
        @keyframes kcFanCountPop {
          0%   { opacity: 0; transform: scale(0.4) translateY(12px); }
          35%  { opacity: 1; transform: scale(1.35) translateY(-4px); }
          60%  { transform: scale(0.92); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        .kc-fan-count { animation: kcFanCountPop 0.7s cubic-bezier(0.34, 1.56, 0.64, 1); display: inline-block; }

        /* Turn transition banner pop */
        @keyframes kcTurnTransitionPop {
          0%   { opacity: 0; transform: translateY(-40px) scale(0.6); }
          30%  { opacity: 1; transform: translateY(0) scale(1.12); }
          55%  { transform: scale(0.96); }
          80%  { opacity: 1; transform: scale(1); }
          100% { opacity: 0; transform: scale(0.95); }
        }
        .kc-turn-transition { animation: kcTurnTransitionPop 1.5s ease-out forwards; }

        /* Final reveal overlay + icon */
        @keyframes kcFinalOverlayFade {
          0%   { opacity: 0; }
          100% { opacity: 1; }
        }
        .kc-final-overlay { animation: kcFinalOverlayFade 0.6s ease-out forwards; }
        @keyframes kcFinalReveal {
          0%   { opacity: 0; transform: scale(0.7); }
          45%  { opacity: 1; transform: scale(1.08); }
          100% { opacity: 1; transform: scale(1); }
        }
        .kc-final-reveal { animation: kcFinalReveal 0.9s ease-out forwards; }
        @keyframes kcFinalIconBounce {
          0%   { transform: scale(0) rotate(-20deg); }
          50%  { transform: scale(1.4) rotate(10deg); }
          75%  { transform: scale(0.95) rotate(-3deg); }
          100% { transform: scale(1) rotate(0); }
        }
        .kc-final-icon { animation: kcFinalIconBounce 1s cubic-bezier(0.34, 1.56, 0.64, 1); display: inline-block; }

        /* ALT reward pop-in on result screen */
        @keyframes kcRewardPop {
          0%   { opacity: 0; transform: scale(0.6); }
          50%  { opacity: 1; transform: scale(1.15); }
          100% { opacity: 1; transform: scale(1); }
        }
        .kc-reward-pop { animation: kcRewardPop 0.8s ease-out 0.3s both; }

        /* Bench slot glow (when a bench effect fires) */
        @keyframes kcBenchGlow {
          0%   { box-shadow: 0 0 0 rgba(96,165,250,0); transform: scale(1); }
          40%  { box-shadow: 0 0 18px rgba(96,165,250,0.95), 0 0 32px rgba(96,165,250,0.65); transform: scale(1.08); }
          100% { box-shadow: 0 0 0 rgba(96,165,250,0); transform: scale(1); }
        }
        .kc-bench-glow { animation: kcBenchGlow 1.3s ease-out; border: 2px solid rgba(96,165,250,0.9) !important; }

        /* ===== Bench boost power-up telop ===== */
        @keyframes kcBenchBoostSlideIn {
          0%   { opacity: 0; transform: translateY(20px) scale(0.8); }
          30%  { opacity: 1; transform: translateY(-4px) scale(1.08); }
          50%  { transform: translateY(0) scale(1); }
          85%  { opacity: 1; }
          100% { opacity: 0.85; }
        }
        .kc-bench-boost-telop { animation: kcBenchBoostSlideIn 0.45s ease-out forwards; }
      `}</style>
    </div>
  );
}

// =====================================================================
// ===================== Sub-components ================================
// =====================================================================

type BenchSlotUI = { name: string; card: BattleCard; count: number };

function BenchDisplay({ side, bench, deckCount, quarantineCount, animKey, glowNames }: {
  side: 'player' | 'ai'; bench: BenchSlotUI[]; deckCount: number; quarantineCount?: number; animKey?: number; glowNames?: string[];
}) {
  const glowSet = glowNames ? new Set(glowNames) : null;
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
            const isGlowing = glowSet?.has(slot.name) ?? false;
            const slotKey = `${slot.name}-${animKey ?? 0}${isGlowing ? '-glow' : ''}`;
            return (
              <button
                key={slotKey}
                onClick={() => isPlayer && setDetailSlot(slot)}
                className={`flex-1 rounded-lg relative overflow-hidden transition-all active:scale-95 ${isNew ? 'kc-bench-pop' : ''} ${isGlowing ? 'kc-bench-glow' : ''}`}
                style={{ background: `${catInfo.color}1a`, border: `2px solid ${catInfo.color}77`, minHeight: '54px', cursor: isPlayer ? 'pointer' : 'default' }}
              >
                {slot.card.imageUrl ? (
                  <img src={slot.card.imageUrl} alt={slot.name} className="absolute inset-0 w-full h-full object-cover opacity-70" />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-2xl opacity-50">{catInfo.emoji}</div>
                )}
                {/* Frame overlay for bench cards */}
                <img
                  src={CARD_RARITY_IMAGES[slot.card.rarity] || CARD_RARITY_IMAGES['N']}
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                  style={{ zIndex: 1 }}
                />
                <div className="relative flex flex-col justify-end h-full p-1" style={{ zIndex: 2 }}>
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
  const [imgLoaded, setImgLoaded] = useState(false);
  const w = size === 'sm' ? 120 : size === 'battle' ? 180 : 200;
  const h = size === 'sm' ? 150 : size === 'battle' ? 250 : 260;
  const activeMode = mode ?? 'neutral';
  const atk = card.attackPower ?? card.power;
  const def = card.defensePower ?? card.power;
  const isBig = size !== 'sm';
  const fontPower = size === 'sm' ? '12px' : size === 'battle' ? '20px' : '18px';
  const frameImg = CARD_RARITY_IMAGES[card.rarity] || CARD_RARITY_IMAGES['N'];

  return (
    <div
      className={`inline-block rounded-xl p-0 relative overflow-hidden ${isWinner ? 'kc-win-glow' : ''}`}
      style={{
        background: '#0b1128',
        boxShadow: isWinner
          ? '0 0 24px rgba(255,215,0,0.55), 0 0 48px rgba(255,215,0,0.25), 0 6px 20px rgba(0,0,0,0.5)'
          : '0 6px 20px rgba(0,0,0,0.5)',
        width: `${w}px`, height: `${h}px`,
      }}
    >
      {/* Loading placeholder */}
      {!imgLoaded && (
        <div className="absolute inset-0 flex items-center justify-center animate-pulse" style={{ background: `linear-gradient(135deg, ${catInfo.color}15, rgba(14,20,45,0.95))` }}>
          <span className={`${isBig ? 'text-6xl' : 'text-4xl'} opacity-40`}>{catInfo.emoji}</span>
        </div>
      )}
      {/* Card illustration (bottom layer) */}
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
      {/* Frame overlay (top layer) */}
      <img
        src={frameImg}
        alt=""
        className="absolute inset-0 w-full h-full object-cover pointer-events-none"
        style={{ zIndex: 2 }}
      />
      {/* Card name (on top of frame) */}
      <span
        className="absolute left-0 right-0 text-center font-bold text-white truncate px-2"
        style={{
          bottom: isBig ? '30px' : '22px',
          fontSize: isBig ? '16px' : '11px',
          textShadow: '0 2px 6px rgba(0,0,0,0.95), 0 0 3px rgba(0,0,0,0.8)',
          zIndex: 3,
        }}
      >
        {card.name}
      </span>
      {/* ⚔️ Attack badge (left-bottom) */}
      <span
        className="absolute flex items-center gap-0.5 px-1.5 py-0.5 rounded-md font-black"
        style={{
          bottom: isBig ? '5px' : '3px',
          left: '15%',
          background: activeMode === 'attack' ? 'rgba(239,68,68,0.9)' : activeMode === 'defense' ? 'rgba(80,80,90,0.7)' : 'rgba(239,68,68,0.7)',
          color: activeMode === 'defense' ? 'rgba(255,255,255,0.45)' : '#fff',
          fontSize: fontPower,
          textShadow: activeMode === 'attack' ? '0 0 10px rgba(255,107,107,0.95)' : '0 1px 2px rgba(0,0,0,0.9)',
          boxShadow: activeMode === 'attack' ? '0 0 12px rgba(239,68,68,0.7)' : 'none',
          lineHeight: 1,
          zIndex: 3,
        }}
      >
        ⚔️{atk}
      </span>
      {/* 🛡️ Defense badge (right-bottom) */}
      <span
        className="absolute flex items-center gap-0.5 px-1.5 py-0.5 rounded-md font-black"
        style={{
          bottom: isBig ? '5px' : '3px',
          right: '15%',
          background: activeMode === 'defense' ? 'rgba(59,130,246,0.9)' : activeMode === 'attack' ? 'rgba(80,80,90,0.7)' : 'rgba(59,130,246,0.7)',
          color: activeMode === 'attack' ? 'rgba(255,255,255,0.45)' : '#fff',
          fontSize: fontPower,
          textShadow: activeMode === 'defense' ? '0 0 10px rgba(96,165,250,0.95)' : '0 1px 2px rgba(0,0,0,0.9)',
          boxShadow: activeMode === 'defense' ? '0 0 12px rgba(59,130,246,0.7)' : 'none',
          lineHeight: 1,
          zIndex: 3,
        }}
      >
        🛡️{def}
      </span>
      {isDefense && <div className="absolute top-1.5 left-1.5" style={{ zIndex: 3 }}><span className={isBig ? 'text-xl' : 'text-base'}>🛡️</span></div>}
      {isWinner && <div className="absolute top-1.5 right-1.5 kc-win-badge" style={{ zIndex: 3 }}><span className={`${isBig ? 'text-2xl' : 'text-lg'} drop-shadow-lg`}>👑</span></div>}
    </div>
  );
}

/**
 * Small (≈70×100) stacked card-back used as the per-side deck pile.
 * Tappable when `interactive` is true; pulses when `glow` is true.
 */
function MiniDeckStack({
  count,
  color,
  interactive = false,
  glow = false,
  onTap,
}: {
  count: number;
  color: string;
  interactive?: boolean;
  glow?: boolean;
  onTap?: () => void;
}) {
  const W = 70;
  const H = 100;
  return (
    <button
      onClick={interactive && count > 0 ? onTap : undefined}
      disabled={!interactive || count === 0}
      className={`relative ${glow && count > 0 ? 'kc-deck-stack' : ''} ${interactive ? 'active:scale-95' : ''} transition-transform`}
      style={{
        width: W + 6,
        height: H + 6,
        background: 'transparent',
        border: 'none',
        padding: 0,
        cursor: interactive && count > 0 ? 'pointer' : 'default',
        opacity: count === 0 ? 0.35 : 1,
      }}
      aria-label={interactive ? 'デッキをタップしてカードを出す' : 'デッキ'}
    >
      {[2, 1, 0].map((layer) => (
        <div
          key={layer}
          className="absolute rounded-md overflow-hidden"
          style={{
            top: 3,
            left: 3,
            width: W,
            height: H,
            transform: `translate(${layer * 2}px, ${layer * -2}px)`,
            border: `2px solid ${color}aa`,
            boxShadow: layer === 0
              ? `0 4px 12px rgba(0,0,0,0.55)${glow ? `, 0 0 16px ${color}90` : ''}`
              : '0 2px 6px rgba(0,0,0,0.4)',
          }}
        >
          <img
            src="/images/card-back.png"
            alt=""
            className="absolute inset-0 w-full h-full"
            style={{ objectFit: 'cover' }}
          />
        </div>
      ))}
      <div
        className="absolute -top-1 -right-1 z-30 rounded-full min-w-[22px] h-[22px] flex items-center justify-center px-1.5"
        style={{
          background: '#ffd700',
          border: '2px solid rgba(0,0,0,0.7)',
          color: '#000',
          fontSize: '11px',
          fontWeight: 900,
        }}
      >
        {count}
      </div>
    </button>
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
        border: `3px solid ${color}aa`,
        boxShadow: `0 6px 20px rgba(0,0,0,0.6), 0 0 22px ${color}55`,
        background: 'rgba(14,20,45,0.95)',
      }}
    >
      <img
        src="/images/card-back.png"
        alt="card back"
        className="absolute inset-0 w-full h-full"
        style={{ objectFit: 'cover' }}
      />
      <div
        className="absolute bottom-2 left-0 right-0 text-center font-black z-10"
        style={{ fontSize: '13px', color, textShadow: '0 1px 4px rgba(0,0,0,0.9), 0 0 6px rgba(0,0,0,0.95)' }}
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
