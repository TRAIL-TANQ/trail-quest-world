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
  SYNERGY_MAP,
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
  removeOneFromBench,
} from '@/lib/knowledgeEngine';
import {
  processQuizResult,
  fetchChildStatus,
} from '@/lib/quizService';
import { getStage, createStageAIDeck, STARTER_DECKS, buildStarterDeck, npcDeckPhasePick, longSpecialRuleMessages } from '@/lib/stages';
import type { StarterDeck, StageRules } from '@/lib/stages';
import { useStageProgressStore } from '@/lib/stageProgressStore';
import { loadQuestProgress, isDeckUnlocked, isDeckAvailable, getUnlockedSSRCardNames, DECK_KEY_TO_STARTER_ID, QUEST_DIFFICULTIES, DIFFICULTY_INFO, isDifficultyUnlocked, DECK_QUEST_INFO, isFirstDeckClaimed, claimFirstDeck, type DeckKey } from '@/lib/questProgress';
import type { PvPSession } from '@/lib/pvpSession';
import { clearPvPSession } from '@/lib/pvpSession';
import { applyRatingChange, applyPvPRatingChange } from '@/lib/ratingService';
import { playBattleStart, playTap, playDefeat } from '@/lib/sfx';
import CardPreviewOverlay from '@/components/CardPreviewOverlay';
import { loadMyDecks, buildMyDeckCards, MY_DECK_MAX_DECKS, getStarterDeckCardNames } from '@/lib/myDecks';
import { COLLECTION_CARDS } from '@/lib/cardData';
import { saveHallOfFame } from '@/lib/hallOfFameService';
import { saveBattleHistory, savePvPBattleHistory, starterIdToDeckKey } from '@/lib/battleHistoryService';
import { toast } from 'sonner';
import { loadEquippedBg, getBg } from '@/lib/backgrounds';

type ScreenPhase = 'title' | 'deck_select' | 'playing' | 'result';

function findCardByName(name: string): BattleCard | undefined {
  return ALL_BATTLE_CARDS.find((c) => c.name === name);
}

// Timing constants (ms) for the battle cinematic. fast mode scales by 0.3.
// Tightened 2026-04-16: aggressive tempo cut — halved most waits for snappy feel.
const TURN_BANNER_MS      = 500;   // attacker-turn vignette (was 800)
const DEFENDER_SHOW_MS    = 200;   // near-instant defender auto-reveal (was 300)
const ATTACK_CARD_REVEAL_MS = 500; // (was 800)
const RESOLVE_BANNER_MS   = 900;   // outcome banner (was 1800)
const TURN_TRANSITION_MS  = 500;   // between sub-battles (was 800)
const FINAL_REVEAL_MS     = 1500;  // hold final game_over overlay (was 2000)
const POWER_ADD_PAUSE_MS  = 200;   // after reveal, before power-add animation (was 400)
const POWER_COMPARE_MS    = 300;   // pause for power comparison display (was 500)

export interface KnowledgeChallengerProps {
  /** When set, this component runs in 2-player local mode instead of vs-AI. */
  pvpSession?: PvPSession | null;
}

export default function KnowledgeChallenger({ pvpSession = null }: KnowledgeChallengerProps = {}) {
  const [, navigate] = useLocation();
  const [, stageMatch] = useRoute<{ id: string }>('/games/knowledge-challenger/stage/:id');
  const stageId = stageMatch ? parseInt(stageMatch.id, 10) : null;
  const currentStage = useMemo(() => (stageId ? getStage(stageId) : null), [stageId]);
  const isPvP = pvpSession != null;
  // PvP deck phase turn tracking. During deck_phase in PvP mode:
  //   'p1' → P1 picks cards (committed to gameState.player.deck)
  //   'p2' → P2 picks cards (committed to gameState.ai.deck)
  // Outside deck_phase this is ignored.
  const [pvpDeckTurn, setPvpDeckTurn] = useState<'p1' | 'p2'>('p1');
  // In PvP during P2's deck phase, card commits target `ai` instead of `player`.
  const pvpActiveSide: 'player' | 'ai' = isPvP && pvpDeckTurn === 'p2' ? 'ai' : 'player';

  const addTotalAlt = useUserStore((s) => s.addTotalAlt);
  const userStoreSet = useUserStore;  // 称号更新に直接触りたい
  const addCollectionCard = useCollectionStore((s) => s.addCard);
  const addCollectionCards = useCollectionStore((s) => s.addCards);
  const setLastResult = useGameStore((s) => s.setLastResult);
  const triggerEarnEffect = useAltStore((s) => s.triggerEarnEffect);

  // 変更9: ステージ進行
  const markStageCleared = useStageProgressStore((s) => s.markCleared);
  const markStageRewarded = useStageProgressStore((s) => s.markRewarded);
  const isStageRewarded = useStageProgressStore((s) => s.isRewarded);

  // Initial screen can be set via ?screen=deck_select (or other valid phase) in URL.
  // Used by ホーム「デッキクエスト」ボタン等からデッキ一覧へ直接ランディング。
  const initialScreen: ScreenPhase = (() => {
    if (typeof window === 'undefined') return 'title';
    try {
      const p = new URLSearchParams(window.location.search).get('screen');
      if (p === 'deck_select' || p === 'playing' || p === 'result' || p === 'title') {
        return p as ScreenPhase;
      }
    } catch { /* ignore */ }
    return 'title';
  })();
  const [screen, setScreen] = useState<ScreenPhase>(initialScreen);
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
  //   resolve       : "🚩 フラッグ奪取！" outcome banner 2s
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

  // NPC speed multiplier: 1 / 2 / 3. Applied only during NPC attacker sub-battles
  // (player's own turn remains at 1x, PvP always at 1x). Persisted in localStorage.
  type NpcSpeed = 1 | 2 | 3;
  const [npcSpeed, setNpcSpeed] = useState<NpcSpeed>(() => {
    try {
      const raw = localStorage.getItem('kc-npc-speed');
      const n = raw ? parseInt(raw, 10) : 1;
      return (n === 2 || n === 3 ? n : 1) as NpcSpeed;
    } catch { return 1; }
  });
  useEffect(() => {
    try { localStorage.setItem('kc-npc-speed', String(npcSpeed)); } catch { /* ignore */ }
  }, [npcSpeed]);
  // Per-sub-battle ref: set to npcSpeed when attacker is NPC (solo non-PvP),
  // else 1. waitStep/waitMs divide delay by this value.
  const npcScaleRef = useRef<number>(1);
  // NPC reveal anim (solo only): deck→flying→flip→placed 4-phase演出
  const [npcRevealAnim, setNpcRevealAnim] = useState<{
    phase: 'draw' | 'flip' | 'place';
    card: BattleCard;
  } | null>(null);
  // Bench-overflow defeat banner (2s)
  const [benchOverflowBanner, setBenchOverflowBanner] = useState<{ loserSide: 'player' | 'ai' } | null>(null);
  // Direct ref to current npcSpeed for the battle loop's per-sub-battle setup.
  const npcSpeedRef = useRef<NpcSpeed>(1);
  useEffect(() => { npcSpeedRef.current = npcSpeed; }, [npcSpeed]);
  // Manual / auto mode toggle — manual mode pauses at each step for player tap
  const [manualMode, setManualMode] = useState(false);
  const manualModeRef = useRef(false);
  useEffect(() => { manualModeRef.current = manualMode; }, [manualMode]);
  // Shown when manual mode wants player to advance (non-attacker steps)
  const [showManualAdvance, setShowManualAdvance] = useState(false);
  // Round victory celebration telop
  const [roundVictoryTelop, setRoundVictoryTelop] = useState<string | null>(null);
  // Card detail popup
  const [detailCard, setDetailCard] = useState<BattleCard | null>(null);
  // Exile zone overlay
  const [showExile, setShowExile] = useState(false);
  // Battle log (ring buffer, newest first, max 10)
  const [battleLog, setBattleLog] = useState<string[]>([]);
  const [showBattleLog, setShowBattleLog] = useState(false);
  const pushLog = useCallback((msg: string) => {
    setBattleLog((prev) => [msg, ...prev].slice(0, 10));
  }, []);
  // Turn-end 15s countdown (PvP only). null = inactive.
  const [turnEndTimer, setTurnEndTimer] = useState<number | null>(null);

  // Card preview before committing an attack reveal (step 2 of 3-step play).
  // null = no preview shown. Set just before revealNextAttackCard is called.
  const [attackPreview, setAttackPreview] = useState<
    | { card: BattleCard; optionalEffect: boolean }
    | null
  >(null);
  // Latch that resolves when the player clicks a preview action button.
  // `skipEffect=true` → call revealNextAttackCard with { skipEffect: true }
  // and also suppress the interactive-choice overlays later in the loop.
  const previewResolveRef = useRef<((v: { skipEffect: boolean }) => void) | null>(null);
  // Read inside interactive-effect blocks so the loop can honor "効果なしで出す".
  const skipNextEffectRef = useRef(false);
  // Card effect IDs that present choice UIs — these are the "任意発動" cards.
  const OPTIONAL_EFFECT_IDS = useMemo(
    () => new Set<string>([
      'photosynthesis', 'paper',
      'prayer_light', 'holy_banner', 'burning_stake', 'saint_jeanne',
      'imperial_decree', 'rainbow_nation', 'nobel_peace',
      'book_burning', 'anatomy', 'mirror_writing',
      'honnoji', 'moonlit_howl', 'mikka_tenka',
      'terracotta', 'banner',
      'genji', 'makura_no_soshi',
      'anaconda_hunter', 'pink_dolphin',
    ]),
    [],
  );
  // Effects that are only optional when a specific bench condition is met.
  // cannon/dynamite: optional only if bench has 火薬 (consumed for +2 attack).
  // cannon/dynamite: optional only if bench has 火薬 (consumed for +2 attack).
  const conditionalOptional = useCallback((card: BattleCard): boolean => {
    const effId = card.effect?.id;
    const gs = gameStateRef.current;
    if (!gs) return false;
    const atkSide: 'player' | 'ai' = gs.flagHolder === 'player' ? 'ai' : 'player';
    const sealed = gs.sealedBenchNames[atkSide];
    if (effId === 'cannon' || effId === 'dynamite') {
      return gs[atkSide].bench.some((b) => b.name === '火薬' && !sealed.includes(b.name));
    }
    if (effId === 'honnoji') {
      return gs[atkSide].bench.some((b) => b.name === '織田信長' && !sealed.includes(b.name));
    }
    return false;
  }, []);
  const waitAttackPreview = useCallback(
    (card: BattleCard): Promise<{ skipEffect: boolean }> => {
      if (unmountedRef.current) return Promise.resolve({ skipEffect: false });
      const optional =
        !!(card.effect && OPTIONAL_EFFECT_IDS.has(card.effect.id)) ||
        conditionalOptional(card);
      setAttackPreview({ card, optionalEffect: optional });
      return new Promise((resolve) => {
        previewResolveRef.current = (v) => {
          previewResolveRef.current = null;
          setAttackPreview(null);
          resolve(v);
        };
      });
    },
    [OPTIONAL_EFFECT_IDS, conditionalOptional],
  );
  const handlePreviewChoice = useCallback((skipEffect: boolean) => {
    previewResolveRef.current?.({ skipEffect });
  }, []);
  // Sound effect hook (future SE implementation)
  const playSound = useCallback((soundId: string) => {
    console.log('[SFX]', soundId);
  }, []);
  // Card selection overlay (used by 毒矢カエル, ピンクイルカ, 紙, 源氏物語, 枕草子 effects)
  const [cardSelectOverlay, setCardSelectOverlay] = useState<{
    title: string;
    cards: BattleCard[];
    onSelect: (card: BattleCard | null) => void;
  } | null>(null);
  // Effect cutin overlay (SR+ cards show cinematic cutin)
  const [cutinCard, setCutinCard] = useState<BattleCard | null>(null);
  // Evolution overlay
  const [evolutionOverlay, setEvolutionOverlay] = useState<{ from: BattleCard; to: BattleCard } | null>(null);
  // Combo name display
  const [comboName, setComboName] = useState<string | null>(null);
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
    cards: BattleCard[];       // 9 cards offered this round (3回戦仕様)
    blocked: Set<number>;      // indices the player failed the quiz on
    acquired: Set<number>;     // indices already added
    redrawsLeft: number;
    addedCardIds: string[];    // ids added to player.deck this offer (for redraw rollback)
  }
  const [deckOffer, setDeckOffer] = useState<DeckOffer | null>(null);
  // Round → max cards the player may keep this deck phase.
  const maxPicksForRound = (round: number, totalRounds: number = 3): number => {
    // 3回戦: 各デッキフェイズで最大2枚獲得可
    if (totalRounds === 3) return 2;
    // 7回戦: 最大3枚
    if (totalRounds === 7) return 3;
    // 5回戦 (PvP互換): 最終回戦は1枚、それ以外は2枚
    return round >= 5 ? 1 : 2;
  };
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
  // デッキフェイズ中のカード削除: アニメ用 state + 除外エリア
  const [pendingRemoveIdx, setPendingRemoveIdx] = useState<number | null>(null);
  const [fadingOutIdx, setFadingOutIdx] = useState<number | null>(null);
  const [removedCards, setRemovedCards] = useState<BattleCard[]>([]);
  // Deck panel is always expanded (no more collapse toggle).
  const [deckPanelCollapsed] = useState(false);

  // ALT/XP
  const userId = useUserStore((s) => s.user.id);
  const [altBalance, setAltBalance] = useState<number | null>(null);
  const [xpTotal, setXpTotal] = useState<number>(0);
  const [xpLevel, setXpLevel] = useState<number>(1);
  const [consecutiveCorrect, setConsecutiveCorrect] = useState(0);
  const [altRewardPopup, setAltRewardPopup] = useState<{ alt: number; xp: number; key: number } | null>(null);
  const altPopupKey = useRef(0);

  // Round banner
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

  // ===== Starter deck selection (stage mode) =====
  const [selectedStarter, setSelectedStarter] = useState<StarterDeck | null>(null);
  const [expandedStarterId, setExpandedStarterId] = useState<string | null>(null);
  const [giftConfirmDeck, setGiftConfirmDeck] = useState<{ deckKey: DeckKey; icon: string; name: string; strategy: string } | null>(null);

  // ===== Special rule banner (shown briefly at battle start) =====
  const [specialRuleBanner, setSpecialRuleBanner] = useState<string[] | null>(null);

  // ===== Start game =====
  const startGame = useCallback((starterOverride?: StarterDeck, myDeckCards?: BattleCard[]) => {
    clearStepTimeouts();
    let playerDeck: BattleCard[];
    let aiDeckCards: BattleCard[];
    if (isPvP && pvpSession) {
      // PvP: both decks come from starter selections. No AI deck builder.
      const p1Starter = STARTER_DECKS.find((d) => d.id === pvpSession.player1.starterDeckId);
      const p2Starter = STARTER_DECKS.find((d) => d.id === pvpSession.player2.starterDeckId);
      playerDeck = p1Starter ? buildStarterDeck(p1Starter) : createInitialDeck();
      aiDeckCards = p2Starter ? buildStarterDeck(p2Starter) : createInitialDeck();
      activeDeckKeyRef.current = null; // PvP は battle_history 対象外
      console.log('[KC] startGame path=PvP, p1Starter=', p1Starter?.id, 'p2Starter=', p2Starter?.id);
    } else if (myDeckCards && myDeckCards.length > 0) {
      playerDeck = myDeckCards;
      aiDeckCards = stageId !== null ? createStageAIDeck(stageId) : createAIDeck();
      activeDeckKeyRef.current = 'custom';
      console.log('[KC] startGame path=MyDeck, cards=', myDeckCards.length);
    } else if (starterOverride) {
      playerDeck = buildStarterDeck(starterOverride);
      aiDeckCards = stageId !== null ? createStageAIDeck(stageId) : createAIDeck();
      activeDeckKeyRef.current = starterIdToDeckKey(starterOverride.id);
      console.log('[KC] startGame path=Starter, id=', starterOverride.id);
    } else if (previewDeck && validateDeck(previewDeck).valid) {
      playerDeck = previewDeck;
      aiDeckCards = stageId !== null ? createStageAIDeck(stageId) : createAIDeck();
      activeDeckKeyRef.current = 'custom';
      console.log('[KC] startGame path=PreviewDeck (fallback), size=', previewDeck.length);
    } else {
      playerDeck = createInitialDeck();
      aiDeckCards = stageId !== null ? createStageAIDeck(stageId) : createAIDeck();
      activeDeckKeyRef.current = 'custom';
      console.log('[KC] startGame path=createInitialDeck (default fallback!)');
    }
    const stage = stageId !== null ? getStage(stageId) : null;
    const rules = stage?.rules ?? undefined;
    // PvP can override total rounds (3/5/7); NPC mode is always 5.
    const totalRounds = isPvP && pvpSession ? pvpSession.roundCount : TOTAL_ROUNDS;
    const state = initGameState(playerDeck, aiDeckCards, rules, totalRounds);
    // Special-rule banner (2s) at battle start
    const ruleMsgs = rules ? longSpecialRuleMessages(rules) : [];
    if (ruleMsgs.length > 0) {
      setSpecialRuleBanner(ruleMsgs);
      window.setTimeout(() => setSpecialRuleBanner(null), 1200);
    } else {
      setSpecialRuleBanner(null);
    }
    console.log('[KC] startGame: initial phase =', state.phase, 'round =', state.round, 'stageRules =', rules);
    console.log('[KC] playerDeck:', playerDeck.map(c => `${c.name}(${c.rarity},effect=${c.effect?.id ?? 'none'})`).join(', '));
    console.log('[KC] aiDeck:', aiDeckCards.map(c => `${c.name}(${c.rarity},effect=${c.effect?.id ?? 'none'})`).join(', '));
    setGameState(state);
    setScreen('playing');
    setCineStep('idle');
    advanceLatchRef.current = null;
    battleRunningRef.current = false;
    setDeckOffer(null);
    setActiveQuiz(null);
    setSwapState(null);
    setRemovedCards([]);
    setPvpDeckTurn('p1');
  }, [clearStepTimeouts, previewDeck, stageId, isPvP, pvpSession]);

  // ===== PvP auto-start =====
  // In PvP mode the title / deck-select screens are bypassed: both players have
  // already picked their starter decks in PvPSetupPage. Fire startGame once on
  // mount and skip straight to the deck phase.
  const pvpAutoStartedRef = useRef(false);
  useEffect(() => {
    if (!isPvP || pvpAutoStartedRef.current) return;
    pvpAutoStartedRef.current = true;
    startGame();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPvP]);

  // Tracks which round last initialized its PvP deck phase, so we can reset
  // pvpDeckTurn to 'p1' exactly once per deck_phase entry.
  const pvpLastDeckPhaseRoundRef = useRef<number>(-1);

  // ===== Phase transition tracking (debug) =====
  const lastLoggedPhaseRef = useRef<string | null>(null);
  useEffect(() => {
    const phase = gameState?.phase;
    if (phase && phase !== lastLoggedPhaseRef.current) {
      console.log('[KC] Current phase:', phase, '/ round:', gameState?.round, '/ cineStep:', cineStep);
      lastLoggedPhaseRef.current = phase;
    }
  }, [gameState?.phase, gameState?.round, cineStep]);

  // ===== Effect telop auto-clear (match animation duration) =====
  useEffect(() => {
    if (!gameState?.effectTelop) return;
    const id = window.setTimeout(() => {
      setGameState((prev) => (prev && prev.effectTelop ? { ...prev, effectTelop: null } : prev));
    }, 2800); // slightly longer than kc-top-banner-slide (2.5s)
    return () => clearTimeout(id);
  }, [gameState?.effectTelop?.key]);

  // ===== Battle log capture =====
  // 攻撃カードが公開された時
  const lastAttackRevealedLenRef = useRef(0);
  useEffect(() => {
    const arr = gameState?.attackRevealed;
    if (!arr) { lastAttackRevealedLenRef.current = 0; return; }
    if (arr.length > lastAttackRevealedLenRef.current) {
      const card = arr[arr.length - 1];
      const attackerSide = gameState?.flagHolder === 'player' ? 'ai' : 'player';
      const attackerName = isPvP && pvpSession
        ? (attackerSide === 'player' ? pvpSession.player1.childName : pvpSession.player2.childName)
        : (attackerSide === 'player' ? 'あなた' : '相手');
      pushLog(`⚔️ ${attackerName} が ${card.name} を出した`);
    }
    lastAttackRevealedLenRef.current = arr.length;
  }, [gameState?.attackRevealed, gameState?.flagHolder, isPvP, pvpSession, pushLog]);

  // エフェクトテロップが出た時
  const lastEffectTelopKeyRef = useRef<number | null>(null);
  useEffect(() => {
    const tel = gameState?.effectTelop;
    if (!tel) return;
    if (tel.key !== lastEffectTelopKeyRef.current) {
      lastEffectTelopKeyRef.current = tel.key;
      pushLog(`✨ ${tel.text}`);
    }
  }, [gameState?.effectTelop, pushLog]);

  // サブバトル決着 (フラッグ奪取)
  const lastSubBattleIdxRef = useRef(0);
  useEffect(() => {
    const sb = gameState?.lastSubBattle;
    if (!sb) return;
    if (sb.idx !== lastSubBattleIdxRef.current) {
      lastSubBattleIdxRef.current = sb.idx;
      const winnerName = isPvP && pvpSession
        ? (sb.winner === 'player' ? pvpSession.player1.childName : pvpSession.player2.childName)
        : (sb.winner === 'player' ? 'あなた' : '相手');
      pushLog(`🚩 ${winnerName} がフラッグ奪取`);
    }
  }, [gameState?.lastSubBattle, isPvP, pvpSession, pushLog]);

  // ラウンド決着
  const lastRoundRef = useRef(0);
  useEffect(() => {
    if (!gameState) return;
    if (gameState.round > lastRoundRef.current && lastRoundRef.current > 0) {
      pushLog(`🔔 第${lastRoundRef.current}回戦終了`);
    }
    lastRoundRef.current = gameState.round;
  }, [gameState?.round, pushLog, gameState]);

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
  // 各ラウンド開始時にデッキフェイズ: 9枚提示→最大2枚取得でバトルへ（3回戦仕様）。
  // NPC also auto-picks cards during this phase (skipped in PvP mode).
  useEffect(() => {
    if (!gameState || gameState.phase !== 'deck_phase' || deckOffer) return;

    // PvP: at the start of a new deck phase (new round), force P1's turn first.
    // We detect "new deck phase" by round number vs the last-processed round.
    if (isPvP && pvpLastDeckPhaseRoundRef.current !== gameState.round) {
      pvpLastDeckPhaseRoundRef.current = gameState.round;
      if (pvpDeckTurn !== 'p1') {
        setPvpDeckTurn('p1');
        return; // wait for re-render with turn='p1', then generate offer
      }
    }

    const rules = gameState.stageRules;

    if (!isPvP) {
      // NPC auto-pick cards (solo mode only)
      if (rules) {
        const npcPicks = npcDeckPhasePick(gameState.ai.deck, gameState.round, rules);
        if (npcPicks.length > 0) {
          setGameState((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              ai: { ...prev.ai, deck: [...prev.ai.deck, ...npcPicks] },
            };
          });
          console.log(`[KC] NPC auto-picked ${npcPicks.length} cards:`, npcPicks.map((c) => c.name));
        }
      }

      // Skip player deck phase if stage rules say so
      if (rules?.skipDeckPhase) {
        setGameState((prev) => prev ? startBattle(prev) : prev);
        return;
      }
    }

    const cardCount = rules?.deckPhaseCards ?? 9;
    // Use active player's unlocked SSRs in PvP mode
    const unlockedSSR = isPvP && pvpSession
      ? (pvpDeckTurn === 'p1' ? pvpSession.player1.unlockedSSRCardNames : pvpSession.player2.unlockedSSRCardNames)
      : getUnlockedSSRCardNames(loadQuestProgress());
    // Generate offer against the active side's existing deck (P1→player, P2→ai)
    const activeDeck = pvpActiveSide === 'ai' ? gameState.ai.deck : gameState.player.deck;
    const offered = sampleCardsWithSynergy(cardCount, 'offer', gameState.round, activeDeck, unlockedSSR, gameState.totalRounds);
    setDeckOffer({
      cards: offered,
      blocked: new Set(),
      acquired: new Set(),
      redrawsLeft: 1,
      addedCardIds: [],
    });
  }, [gameState?.phase, gameState?.round, deckOffer, isPvP, pvpSession, pvpDeckTurn, pvpActiveSide]);

  // Track unmount so the battle loop can exit without relying on effect
  // cleanup (which would fire on every phase change and kill the cinematic).
  // IMPORTANT: Reset to false on mount to handle remount scenarios (React StrictMode, etc.)
  useEffect(() => {
    unmountedRef.current = false;
    return () => { unmountedRef.current = true; };
  }, []);

  // Mirror gameState into a ref so the async battle loop can read the latest
  // state (e.g. flagHolder) without recreating the effect on every render.
  const gameStateRef = useRef<GameState | null>(null);
  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);

  // Track the last card the player played (attack or defense) for finisher display
  const lastPlayerCardRef = useRef<BattleCard | null>(null);

  // Track which deck the player entered battle with (for battle_history).
  // 'custom' for マイデッキ、'skip' は PvP で記録しない意図。
  const activeDeckKeyRef = useRef<string | null>(null);

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

  // ===== Manual advance wait: shows big button, resolves on player tap =====
  // Show card selection overlay and wait for player choice
  const waitCardSelect = useCallback((title: string, cards: BattleCard[]): Promise<BattleCard | null> => {
    if (unmountedRef.current || cards.length === 0) return Promise.resolve(null);
    return new Promise((resolve) => {
      setCardSelectOverlay({
        title,
        cards,
        onSelect: (card) => {
          setCardSelectOverlay(null);
          resolve(card);
        },
      });
    });
  }, []);

  const waitManualAdvance = useCallback((): Promise<void> => {
    if (unmountedRef.current) return Promise.resolve();
    setShowManualAdvance(true);
    return new Promise((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        playerActionLatchRef.current = null;
        setShowManualAdvance(false);
        resolve();
      };
      playerActionLatchRef.current = finish;
      const safetyId = window.setTimeout(() => { if (!settled) finish(); }, 30000);
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
    // fastMode legacy: 0.3. npcScaleRef: 1 / npcSpeed when NPC is attacker.
    // Final scale is the product (so fastMode further shortens NPC waits).
    const scale = (fastModeRef.current ? 0.3 : 1) / npcScaleRef.current;
    const delay = Math.max(60, Math.round(ms * scale));
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
    const scale = (fastModeRef.current ? 0.3 : 1) / npcScaleRef.current;
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
    // Reset unmounted flag in case of remount (React StrictMode / parent re-render)
    unmountedRef.current = false;
    battleRunningRef.current = true;

    const run = async () => {
      console.log('[KC] battle loop: START (round', gameState.round, ', subBattle', gameState.subBattleCount, ', flagHolder', gameState.flagHolder, ', unmounted:', unmountedRef.current, ')');
      // Safety: if we've had too many sub-battles in one round, bail
      if (gameState.subBattleCount > 50) {
        console.warn('[KC] SAFETY: too many sub-battles in round', gameState.round, '— forcing round end');
        battleRunningRef.current = false;
        return;
      }
      try {
        // Step 1: turn banner
        console.log('[KC] → turn_banner (unmounted:', unmountedRef.current, ')');
        setCineStep('turn_banner');
        if (manualModeRef.current) {
          await waitManualAdvance();
        } else {
          await waitStep(TURN_BANNER_MS);
        }
        console.log('[KC] turn_banner waitStep resolved (unmounted:', unmountedRef.current, ')');
        if (unmountedRef.current) { console.log('[KC] BAIL: unmounted after turn_banner'); return; }

        // Step 2: defender shown
        console.log('[KC] → defender_show (unmounted:', unmountedRef.current, ')');
        setCineStep('defender_show');
        if (manualModeRef.current) {
          await waitManualAdvance();
        } else {
          await waitStep(DEFENDER_SHOW_MS);
        }
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
              await waitStep(300);
              if (unmountedRef.current) return;
            }
            if (details.length > 1) {
              const totalDef = details.reduce((s, d) => s + d.defBonus, 0);
              const totalAtk = details.reduce((s, d) => s + d.atkBonus, 0);
              const comboParts: string[] = [];
              if (totalAtk !== 0) comboParts.push(`攻撃${totalAtk > 0 ? '+' : ''}${totalAtk}`);
              if (totalDef !== 0) comboParts.push(`防御${totalDef > 0 ? '+' : ''}${totalDef}`);
              setBenchBoostTelop({ text: `🔥 コンボ！合計 ${comboParts.join(' ')}！`, key: Date.now() + 999 });
              await waitStep(400);
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
        // NPC speed scaling: only active when NPC is attacker and not in PvP.
        const isNpcAttackerTurn = !isPvP && attackerSide === 'ai';
        npcScaleRef.current = isNpcAttackerTurn ? npcSpeedRef.current : 1;
        console.log('[KC] → attack_reveal (attacker:', attackerSide, ', isPlayerAttacker:', isPlayerAttacker, ', npcScale:', npcScaleRef.current, ')');
        setCineStep('attack_reveal');
        setGameState((prev) => (prev ? beginAttackLoop(prev) : prev));

        // In PvP both sides are human — always wait for manual reveal regardless
        // of which side is attacking.
        const needsManualReveal = isPvP || isPlayerAttacker;
        let loopGuard = 30;
        while (loopGuard-- > 0) {
          if (unmountedRef.current) return;
          if (needsManualReveal) {
            console.log('[KC] waiting for', isPvP ? `PvP ${attackerSide}` : 'player', 'reveal action...');
            setWaitingForPlayerReveal(true);
            await waitForPlayerAction();
            setWaitingForPlayerReveal(false);
          } else {
            if (manualModeRef.current) {
              // Manual mode: wait for player tap to proceed
              setWaitingForPlayerReveal(true);
              await waitForPlayerAction();
              setWaitingForPlayerReveal(false);
            } else {
              // Auto mode: NPC reveal with 4-phase animation (solo only, ~1.0s base ×1/2/3 speed)
              const gsNow = gameStateRef.current;
              const npcTopCard = gsNow && !isPvP && !isPlayerAttacker
                ? gsNow.ai.deck[0]
                : null;
              if (npcTopCard) {
                // phase 1: draw (card lifts off deck)
                setNpcRevealAnim({ phase: 'draw', card: npcTopCard });
                await waitStep(200);
                if (unmountedRef.current) { setNpcRevealAnim(null); return; }
                // phase 2: flip (back → face)
                setNpcRevealAnim({ phase: 'flip', card: npcTopCard });
                await waitStep(200);
                if (unmountedRef.current) { setNpcRevealAnim(null); return; }
                // phase 3: place (slide toward field)
                setNpcRevealAnim({ phase: 'place', card: npcTopCard });
                await waitStep(200);
                if (unmountedRef.current) { setNpcRevealAnim(null); return; }
                // phase 4: clear overlay; actual reveal happens in the setGameState below
                setNpcRevealAnim(null);
              } else {
                await waitStep(600);
              }
            }
          }
          if (unmountedRef.current) return;

          // ===== Preview step (新): before committing, show the top card to the
          // attacker and let them choose 発動する / 効果なしで出す.
          // Only for human-controlled attackers (solo player, or either PvP side).
          // AI-controlled attackers skip preview — revealNextAttackCard runs normally. =====
          const attackerIsHuman = isPvP || isPlayerAttacker;
          let skipEffectChoice = false;
          if (attackerIsHuman) {
            const gs = gameStateRef.current;
            const atkSideLocal: 'player' | 'ai' =
              gs && gs.flagHolder === 'player' ? 'ai' : 'player';
            const topCard = gs && (atkSideLocal === 'player' ? gs.player.deck[0] : gs.ai.deck[0]);
            if (topCard) {
              const choice = await waitAttackPreview(topCard);
              if (unmountedRef.current) return;
              skipEffectChoice = choice.skipEffect;
            }
          }
          skipNextEffectRef.current = skipEffectChoice;

          // Reveal one card atomically
          let resultState: GameState | null = null;
          playSound('card-flip');
          setGameState((prev) => {
            if (!prev) return prev;
            const next = revealNextAttackCard(prev, { skipEffect: skipEffectChoice });
            resultState = next;
            return next;
          });
          await waitMs(16);
          if (unmountedRef.current || !resultState) return;

          // Pause for power-add animation
          await waitMs(POWER_ADD_PAUSE_MS);
          if (unmountedRef.current) return;

          const rs = resultState as GameState;

          // Track finisher card: update when the player reveals an attack card
          {
            const attackerSide: Side = rs.flagHolder === 'player' ? 'ai' : 'player';
            if (attackerSide === 'player' || isPvP) {
              const lastRevealed = rs.attackRevealed[rs.attackRevealed.length - 1];
              if (lastRevealed) lastPlayerCardRef.current = lastRevealed;
            }
          }

          // ===== Effect cutin for SR+ cards =====
          {
            const lastRevealed = rs.attackRevealed[rs.attackRevealed.length - 1];
            if (lastRevealed?.effect && (lastRevealed.rarity === 'SR' || lastRevealed.rarity === 'SSR')) {
              setCutinCard(lastRevealed);
              await waitMs(600);
              if (unmountedRef.current) return;
              setCutinCard(null);
            } else if (lastRevealed?.effect && lastRevealed.rarity === 'R') {
              // R cards: brief glow (handled by effectTelop, no extra cutin)
            }
          }

          // ===== Interactive card effects =====
          // In solo mode only the player (attacker) shows choice UIs.
          // In PvP both sides are human, so the attacker-side (whoever they are)
          // gets the choice UI, targeting their own bench/deck/exile.
          // NOTE: if the attacker chose "効果なしで出す" in the preview step,
          // we suppress ALL interactive overlays for this reveal.
          const canShowChoice = (isPvP || isPlayerAttacker) && !skipNextEffectRef.current;
          const mySide = attackerSide;
          const oppSide: 'player' | 'ai' = attackerSide === 'player' ? 'ai' : 'player';
          if (canShowChoice) {
            const lastRevealed = rs.attackRevealed[rs.attackRevealed.length - 1];
            const effId = lastRevealed?.effect?.id;

            // 光合成: デッキから植物カード1枚をデッキトップに置く（現在対象なし、先行実装）
            // 将来の植物デッキ用 — 現在は対象カードが存在しないため実質no-op

            // ピンクイルカ: ベンチまたは除外の大蛇の巫師をデッキトップに戻す
            if (effId === 'pink_dolphin') {
              const gs = gameStateRef.current ?? rs;
              const sealed = gs.sealedBenchNames[mySide];
              const benchHunter = gs[mySide].bench.find((b) => b.name === '大蛇の巫師' && !sealed.includes(b.name));
              const exileHunter = gs.exile[mySide].find((c) => c.name === '大蛇の巫師');
              // Build selection candidates
              const candidates: BattleCard[] = [];
              if (benchHunter) candidates.push({ ...benchHunter.card, id: `bench-${benchHunter.card.id}` });
              if (exileHunter) candidates.push({ ...exileHunter, id: `exile-${exileHunter.id}` });
              if (candidates.length > 0) {
                const chosen = candidates.length === 1 ? candidates[0] : await waitCardSelect('🐬 回収する大蛇の巫師を選んでください', candidates);
                if (chosen && !unmountedRef.current) {
                  const fromBench = chosen.id.startsWith('bench-');
                  setGameState((prev) => {
                    if (!prev) return prev;
                    const hunterTemplate = fromBench
                      ? prev[mySide].bench.find((b) => b.name === '大蛇の巫師')?.card
                      : prev.exile[mySide].find((c) => c.name === '大蛇の巫師');
                    if (!hunterTemplate) return prev;
                    if (fromBench) {
                      const newBench = removeOneFromBench(prev[mySide].bench, '大蛇の巫師');
                      return {
                        ...prev,
                        [mySide]: { ...prev[mySide], bench: newBench, deck: [hunterTemplate, ...prev[mySide].deck] },
                        effectTelop: { text: '🐬 ピンクイルカ！大蛇の巫師をベンチからデッキトップへ！', color: '#ffd700', key: Date.now() },
                      };
                    } else {
                      const newExile = prev.exile[mySide].filter((c) => c.name !== '大蛇の巫師');
                      return {
                        ...prev,
                        [mySide]: { ...prev[mySide], deck: [hunterTemplate, ...prev[mySide].deck] },
                        exile: { ...prev.exile, [mySide]: newExile },
                        effectTelop: { text: '🐬 ピンクイルカ！大蛇の巫師を除外からデッキトップへ！', color: '#ffd700', key: Date.now() },
                      };
                    }
                  });
                }
              }
            }

            // 紙: select exiled card to return to deck top
            if (effId === 'paper') {
              const gs = gameStateRef.current ?? rs;
              const exiledCards = gs.exile[mySide];
              if (exiledCards.length > 0) {
                const chosen = await waitCardSelect('📜 デッキトップに戻す除外カードを選んでください', exiledCards);
                if (chosen && !unmountedRef.current) {
                  setGameState((prev) => {
                    if (!prev) return prev;
                    const newExile = prev.exile[mySide].filter((c) => c.id !== chosen.id);
                    return {
                      ...prev,
                      [mySide]: { ...prev[mySide], deck: [chosen, ...prev[mySide].deck] },
                      exile: { ...prev.exile, [mySide]: newExile },
                      effectTelop: { text: `📜 記録の復元！${chosen.name}をデッキトップへ！`, color: '#ffd700', key: Date.now() },
                    };
                  });
                }
              }
            }

            // 源氏物語: ベンチの和歌の枚数まで自分のベンチからデッキボトムに戻す
            if (effId === 'genji') {
              const gs = gameStateRef.current ?? rs;
              const sealed = gs.sealedBenchNames[mySide];
              const wakaSlot = gs[mySide].bench.find((b) => b.name === '和歌' && !sealed.includes(b.name));
              const wakaCount = wakaSlot?.count ?? 0;
              if (wakaCount > 0 && gs[mySide].bench.length > 0) {
                let remaining = wakaCount;
                while (remaining > 0) {
                  const currentGs = gameStateRef.current ?? gs;
                  const currentBench = currentGs[mySide].bench
                    .filter((b) => !sealed.includes(b.name))
                    .map((b) => b.card);
                  if (currentBench.length === 0) break;
                  const chosen = await waitCardSelect(
                    `📖 デッキに戻すカードを選んでください（残り${remaining}枚）`,
                    currentBench,
                  );
                  if (!chosen || unmountedRef.current) break;
                  setGameState((prev) => {
                    if (!prev) return prev;
                    const newBench = removeOneFromBench(prev[mySide].bench, chosen.name);
                    return {
                      ...prev,
                      [mySide]: { ...prev[mySide], bench: newBench, deck: [...prev[mySide].deck, chosen] },
                      effectTelop: { text: `📖 ${chosen.name}をデッキに戻した！`, color: '#ffd700', key: Date.now() },
                    };
                  });
                  remaining--;
                }
              }
            }

            // 枕草子: ベンチの筆の枚数まで相手ベンチから除外
            if (effId === 'makura_no_soshi') {
              const gs = gameStateRef.current ?? rs;
              const sealed = gs.sealedBenchNames[mySide];
              const fudeSlot = gs[mySide].bench.find((b) => b.name === '筆' && !sealed.includes(b.name));
              const fudeCount = fudeSlot?.count ?? 0;
              if (fudeCount > 0 && gs[oppSide].bench.length > 0) {
                let remaining = fudeCount;
                while (remaining > 0) {
                  const currentGs = gameStateRef.current ?? gs;
                  const oppSealed = currentGs.sealedBenchNames[oppSide];
                  const hasRobben = currentGs[oppSide].bench.some((b) => b.name === 'ロベン島' && !oppSealed.includes(b.name));
                  const oppBench = currentGs[oppSide].bench
                    .filter((b) => !(hasRobben && b.name === 'ネルソン・マンデラ'))
                    .map((b) => b.card);
                  if (oppBench.length === 0) break;
                  const chosen = await waitCardSelect(
                    `📝 除外する相手のカードを選んでください（残り${remaining}枚）`,
                    oppBench,
                  );
                  if (!chosen || unmountedRef.current) break;
                  setGameState((prev) => {
                    if (!prev) return prev;
                    const newBench = removeOneFromBench(prev[oppSide].bench, chosen.name);
                    return {
                      ...prev,
                      [oppSide]: { ...prev[oppSide], bench: newBench },
                      exile: { ...prev.exile, [oppSide]: [...prev.exile[oppSide], chosen] },
                      effectTelop: { text: `📝 枕草子！${chosen.name}を除外！`, color: '#a855f7', key: Date.now() },
                    };
                  });
                  remaining--;
                }
              }
            }
          }

          // ===== 祈りの光: 除外されたジャンヌ・ダルクを聖女ジャンヌとしてデッキトップに =====
          if (canShowChoice) {
            const lastRevealed = rs.attackRevealed[rs.attackRevealed.length - 1];
            if (lastRevealed?.effect?.id === 'prayer_light') {
              const gs = gameStateRef.current ?? rs;
              const exiledJeanne = gs.exile[mySide].filter((c) => c.name === 'ジャンヌ・ダルク');
              const benchNames = gs[mySide].bench.map((b) => b.name);
              const exileNames = gs.exile[mySide].map((c) => c.name);
              console.log(`[UI][prayer_light] mySide=${mySide} canActivate=${exiledJeanne.length > 0} exile=[${exileNames.join(',')}] bench=[${benchNames.join(',')}]`);
              if (exiledJeanne.length > 0) {
                console.log(`[UI][prayer_light] opening waitCardSelect with ${exiledJeanne.length} jeanne options`);
                const chosen = await waitCardSelect('✨ 聖女ジャンヌとして蘇らせるジャンヌを選んでください', exiledJeanne);
                if (chosen && !unmountedRef.current) {
                  setGameState((prev) => {
                    if (!prev) return prev;
                    const saintTemplate = ALL_BATTLE_CARDS.find((c) => c.name === '聖女ジャンヌ');
                    if (!saintTemplate) return prev;
                    const saintCard = { ...saintTemplate, id: `saint-jeanne-prayer-${Date.now()}` };
                    const newExile = prev.exile[mySide].filter((c) => c.id !== chosen.id);
                    return {
                      ...prev,
                      [mySide]: { ...prev[mySide], deck: [saintCard, ...prev[mySide].deck] },
                      exile: { ...prev.exile, [mySide]: newExile },
                      effectTelop: { text: '✨ 聖なる祈り！ジャンヌが聖女として蘇る！', color: '#ffd700', key: Date.now() },
                    };
                  });
                }
              }
            }
          }

          // ===== 聖女の旗印: デッキ内のジャンヌ・ダルクをデッキトップに移動 =====
          if (canShowChoice) {
            const lastRevealed = rs.attackRevealed[rs.attackRevealed.length - 1];
            if (lastRevealed?.effect?.id === 'holy_banner') {
              const gs = gameStateRef.current ?? rs;
              const jeanneInDeck = gs[mySide].deck.filter((c) => c.name === 'ジャンヌ・ダルク');
              if (jeanneInDeck.length > 0) {
                // Auto-apply: move first Jeanne to deck top (no selection needed)
                setGameState((prev) => {
                  if (!prev) return prev;
                  const idx = prev[mySide].deck.findIndex((c) => c.name === 'ジャンヌ・ダルク');
                  if (idx < 0) return prev;
                  const jeanneCard = prev[mySide].deck[idx];
                  const newDeck = [jeanneCard, ...prev[mySide].deck.slice(0, idx), ...prev[mySide].deck.slice(idx + 1)];
                  return {
                    ...prev,
                    [mySide]: { ...prev[mySide], deck: newDeck },
                    effectTelop: { text: '🏳️ 聖女の導き！ジャンヌ・ダルクをデッキトップへ！', color: '#ffd700', key: Date.now() },
                  };
                });
              }
            }
          }

          // ===== 軍旗: デッキ内のジャンヌ・ダルクをデッキトップに移動 =====
          if (canShowChoice) {
            const lastRevealed = rs.attackRevealed[rs.attackRevealed.length - 1];
            if (lastRevealed?.effect?.id === 'banner') {
              const gs = gameStateRef.current ?? rs;
              const jeanneInDeck = gs[mySide].deck.filter((c) => c.name === 'ジャンヌ・ダルク');
              if (jeanneInDeck.length > 0) {
                // Auto-apply: move first Jeanne to deck top (no selection needed)
                setGameState((prev) => {
                  if (!prev) return prev;
                  const idx = prev[mySide].deck.findIndex((c) => c.name === 'ジャンヌ・ダルク');
                  if (idx < 0) return prev;
                  const jeanneCard = prev[mySide].deck[idx];
                  const newDeck = [jeanneCard, ...prev[mySide].deck.slice(0, idx), ...prev[mySide].deck.slice(idx + 1)];
                  return {
                    ...prev,
                    [mySide]: { ...prev[mySide], deck: newDeck },
                    effectTelop: { text: '🚩 進軍の号令！ジャンヌ・ダルクをデッキトップへ！', color: '#ffd700', key: Date.now() },
                  };
                });
              }
            }
          }

          // ===== 兵馬俑 (spec v7): 「除外」の秦の兵士をデッキトップに戻す =====
          //   ※ UI 側の player 向け intercept は削除。engine の case 'terracotta'
          //     (knowledgeEngine.ts) が player/AI 両方に対して除外 → デッキトップ
          //     の処理を自動発動する。以前ここにあった「ベンチの秦の兵士を選ぶ」
          //     ロジックは spec v6 以前の仕様で、v7 では bench から拾うと誤動作。

          // ===== 始皇帝の勅令: デッキの紙または焚書坑儒を選んでデッキトップへ =====
          if (canShowChoice) {
            const lastRevealed = rs.attackRevealed[rs.attackRevealed.length - 1];
            if (lastRevealed?.effect?.id === 'imperial_decree') {
              const gs = gameStateRef.current ?? rs;
              const hasPaper = gs[mySide].deck.some((c) => c.name === '紙');
              const hasBurn = gs[mySide].deck.some((c) => c.name === '焚書坑儒');
              if (hasPaper || hasBurn) {
                // 候補カードを構築: 紙（代表1枚）と焚書坑儒
                const candidates: typeof rs.attackRevealed = [];
                const paperCard = gs[mySide].deck.find((c) => c.name === '紙');
                const burnCard = gs[mySide].deck.find((c) => c.name === '焚書坑儒');
                if (paperCard) candidates.push(paperCard);
                if (burnCard) candidates.push(burnCard);
                const chosen = await waitCardSelect('📜 デッキトップに置くカードを選んでください', candidates);
                if (chosen && !unmountedRef.current) {
                  setGameState((prev) => {
                    if (!prev) return prev;
                    let newDeck = [...prev[mySide].deck];
                    const idx = newDeck.findIndex((c) => c.name === chosen.name);
                    if (idx >= 0) {
                      const [card] = newDeck.splice(idx, 1);
                      newDeck.unshift(card);
                    }
                    return {
                      ...prev,
                      [mySide]: { ...prev[mySide], deck: newDeck },
                      effectTelop: { text: `📜 天子の命！${chosen.name}をデッキトップへ！`, color: '#ffd700', key: Date.now() },
                    };
                  });
                }
              }
            }
          }

          // ===== 虹の国: attacker returns all own exiled cards =====
          if (canShowChoice) {
            const lastRevealed = rs.attackRevealed[rs.attackRevealed.length - 1];
            if (lastRevealed?.effect?.id === 'rainbow_nation') {
              const gs = gameStateRef.current ?? rs;
              const exiledCards = gs.exile[mySide];
              console.log(`[UI][rainbow_nation] mySide=${mySide} exileCount=${exiledCards.length} exile=[${exiledCards.map(c => c.name).join(',')}]`);
              if (exiledCards.length > 0) {
                const chosen = await waitCardSelect(`🌈 除外カード${exiledCards.length}枚を全てデッキに戻しますか？`, exiledCards);
                if (chosen && !unmountedRef.current) {
                  setGameState((prev) => {
                    if (!prev) return prev;
                    const allExiled = prev.exile[mySide];
                    return {
                      ...prev,
                      [mySide]: { ...prev[mySide], deck: [...prev[mySide].deck, ...allExiled] },
                      exile: { ...prev.exile, [mySide]: [] },
                      effectTelop: { text: `🌈 希望の虹！除外カード${allExiled.length}枚が全てデッキに戻った！`, color: '#ffd700', key: Date.now() },
                    };
                  });
                }
              }
            }
          }

          // ===== ノーベル平和賞: attacker buffs own allies =====
          if (canShowChoice) {
            const lastRevealed = rs.attackRevealed[rs.attackRevealed.length - 1];
            if (lastRevealed?.effect?.id === 'nobel_peace') {
              const dummyCards = [lastRevealed];
              const chosen = await waitCardSelect('🏅 味方全カード攻防+1を発動しますか？', dummyCards);
              if (chosen && !unmountedRef.current) {
                setGameState((prev) => {
                  if (!prev) return prev;
                  // In PvP the attacker may be `ai` — buff attacker's round bonus, not hard-coded player.
                  // defenderBonus always represents the current defender, so it remains +1.
                  return {
                    ...prev,
                    roundAttackBonus: { ...prev.roundAttackBonus, [mySide]: prev.roundAttackBonus[mySide] + 1 },
                    defenderBonus: prev.defenderBonus + 1,
                    effectTelop: { text: '🏅 栄光の証！味方全カード攻防+1！', color: '#ffd700', key: Date.now() },
                  };
                });
              }
            }
          }

          // ===== Check for evolution (anaconda → giant snake) =====
          {
            const lastRevealed = rs.attackRevealed[rs.attackRevealed.length - 1];
            if (lastRevealed?.name === '大蛇' && lastRevealed.id.startsWith('evolved-')) {
              const anacondaTemplate = ALL_BATTLE_CARDS.find((c) => c.name === 'アナコンダ');
              if (anacondaTemplate) {
                playSound('evolve');
                setEvolutionOverlay({ from: anacondaTemplate, to: lastRevealed });
                await waitMs(1500);
                if (unmountedRef.current) return;
                setEvolutionOverlay(null);
              }
            }
          }

          // ===== Check for transformation (火刑 → 聖女ジャンヌ) =====
          {
            const lastRevealed = rs.attackRevealed[rs.attackRevealed.length - 1];
            if (lastRevealed?.name === '聖女ジャンヌ' && lastRevealed.id.startsWith('evolved-saint-jeanne-')) {
              const burningStakeTemplate = ALL_BATTLE_CARDS.find((c) => c.name === '火刑');
              if (burningStakeTemplate) {
                playSound('evolve');
                setEvolutionOverlay({ from: burningStakeTemplate, to: lastRevealed });
                await waitMs(1500);
                if (unmountedRef.current) return;
                setEvolutionOverlay(null);
              }
            }
          }

          // ===== Check for evolution (ダ・ヴィンチ → 万能の天才) =====
          {
            const lastRevealed = rs.attackRevealed[rs.attackRevealed.length - 1];
            if (lastRevealed?.name === '万能の天才' && lastRevealed.id.startsWith('evolved-genius-')) {
              const davinciTemplate = ALL_BATTLE_CARDS.find((c) => c.name === 'レオナルド・ダ・ヴィンチ');
              if (davinciTemplate) {
                playSound('evolve');
                setEvolutionOverlay({ from: davinciTemplate, to: lastRevealed });
                await waitMs(1500);
                if (unmountedRef.current) return;
                setEvolutionOverlay(null);
              }
            }
          }

          // ===== Check for combo names =====
          {
            const lastRevealed = rs.attackRevealed[rs.attackRevealed.length - 1];
            const attackerSideForCombo: 'player' | 'ai' = rs.flagHolder === 'player' ? 'ai' : 'player';
            const myBenchNames = new Set((attackerSideForCombo === 'player' ? rs.player : rs.ai).bench.map((b) => b.name));
            const comboMap: Record<string, { needs: string[]; name: string }[]> = {
              'ナポレオン': [
                { needs: ['大砲', 'ナポレオン法典'], name: 'ナポレオン・フルコンボ！' },
                { needs: ['大砲'], name: '皇帝の砲撃！' },
                { needs: ['ナポレオン法典'], name: '法の守護！' },
              ],
              'アナコンダ': [
                { needs: ['毒矢カエル', 'ピラニア'], name: '密林の包囲網！' },
              ],
              'ガリレオ': [
                { needs: ['望遠鏡', '地動説'], name: '科学の真理！' },
              ],
              '始皇帝': [
                { needs: ['兵馬俑', '万里の長城'], name: '古代帝国の威光！' },
              ],
            };
            if (lastRevealed) {
              const combos = comboMap[lastRevealed.name];
              if (combos) {
                for (const combo of combos) {
                  if (combo.needs.every((n) => myBenchNames.has(n))) {
                    playSound('combo');
                    setComboName(combo.name);
                    await waitMs(800);
                    if (unmountedRef.current) return;
                    setComboName(null);
                    break;
                  }
                }
              }
            }
          }

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
              await waitStep(300);
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
              await waitStep(400);
              if (unmountedRef.current) return;
            }
            setBenchBoostTelop(null);
            // Clear bench glow
            setGameState((prev) => prev ? { ...prev, benchGlow: null, benchBoostDetails: null } : prev);
          }

          if (rs.phase === 'round_end') {
            // Deck-out or bench-overflow or forfeit → defender wins this round
            console.log('[KC] → round_end during reveal (deck-out): round', rs.round, 'winner:', rs.roundWinner);
            const isPlayerRoundWin = rs.roundWinner === 'player';
            playSound(isPlayerRoundWin ? 'round-clear' : 'round-lost');
            const trophyFanBonus = rs.trophyFans[rs.round - 1] ?? 0;

            // Phase 0: Explicit reason banner — tells the player WHY the round ended.
            setCineStep('round_end');
            await waitMs(150);
            if (unmountedRef.current) return;
            const loserSide: 'player' | 'ai' = rs.roundWinner === 'player' ? 'ai' : 'player';
            const loserName = isPvP && pvpSession
              ? (loserSide === 'player' ? pvpSession.player1.childName : pvpSession.player2.childName)
              : (loserSide === 'player' ? 'あなた' : '相手');
            const msg = rs.message ?? '';
            let reasonIcon = '💀';
            let reasonText = '敗北';
            if (msg.includes('デッキ切れ')) { reasonIcon = '💀'; reasonText = 'デッキ切れ'; }
            else if (msg.includes('ベンチ満杯')) {
              reasonIcon = '💀';
              const m = msg.match(/ベンチ満杯「([^」]+)」/);
              reasonText = m ? `ベンチ満杯「${m[1]}」` : 'ベンチ満杯';
              // Distinct defeat演出 for bench overflow
              playDefeat();
              setBenchOverflowBanner({ loserSide });
              window.setTimeout(() => setBenchOverflowBanner(null), 1200);
            } else if (msg.includes('諦めた')) { reasonIcon = '🏳️'; reasonText = '攻撃を諦めた'; }
            else if (msg.includes('ブロック')) { reasonIcon = '🛡️'; reasonText = 'ブロック'; }
            setRoundVictoryTelop(`${reasonIcon} ${reasonText}！${loserName}の敗北`);
            pushLog(`${reasonIcon} ${reasonText}！${loserName}の敗北`);
            await waitStep(1200);
            if (unmountedRef.current) return;

            // Phase 1: Victory/defeat banner with fan info
            setRoundVictoryTelop(isPlayerRoundWin
              ? `🏆 トロフィー獲得！ +${trophyFanBonus}ファン！`
              : `💀 第${rs.round}回戦 敗北… 相手に+${trophyFanBonus}ファン`);
            await waitMs(250);
            if (unmountedRef.current) return;
            if (manualModeRef.current) {
              await waitManualAdvance();
            } else {
              await waitStep(1800);
            }
            if (unmountedRef.current) return;
            setRoundVictoryTelop(null);

            // Advance to next round (awards fans, resets bench, or game_over)
            setDeckOffer(null);
            setRemovedCards([]);
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
              // Final result: show 5-round summary
              if (isPvP && pvpSession) {
                const winnerName = advs.winner === 'player' ? pvpSession.player1.childName : pvpSession.player2.childName;
                setRoundVictoryTelop(`🏆 ${winnerName} の勝利！`);
              } else {
                setRoundVictoryTelop(advs.winner === 'player'
                  ? `🎉 VICTORY！ 🏆×${advs.playerTrophies} ⭐${advs.playerFans}ファン`
                  : `💀 敗北… 🏆×${advs.playerTrophies} ⭐${advs.playerFans}ファン`);
              }
              setCineStep('game_over');
              await waitStep(FINAL_REVEAL_MS + 500);
              if (unmountedRef.current) return;
              setRoundVictoryTelop(null);
              if (!unmountedRef.current) window.setTimeout(() => setScreen('result'), 300);
              return;
            }

            // Phase 2: Transition banner
            setRoundVictoryTelop(`第${rs.round}回戦 → 第${advs.round}回戦へ`);
            await waitStep(1200);
            if (unmountedRef.current) return;
            setRoundVictoryTelop(null);

            // Next round starts with deck_phase
            setCineStep('idle');
            battleRunningRef.current = false;
            return;
          }

          if (hasAttackSucceeded(rs)) {
            playSound('break');
            console.log('[KC] → attack succeeded, resolving');
            await waitStep(POWER_COMPARE_MS);
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

            // Card defeat fan telop
            {
              const defCard = rs.defenseCard;
              if (defCard) {
                const defFans = ({ N: 1, R: 2, SR: 3, SSR: 5 } as Record<string, number>)[defCard.rarity] ?? 1;
                const whoDefeated = rs.flagHolder === 'player' ? '相手' : 'あなた'; // attacker = otherSide(flagHolder)
                setBenchBoostTelop({ text: `+${defFans}ファン！（${defCard.rarity}撃破）`, key: Date.now() });
              }
            }

            console.log('[KC] → resolve banner');
            setCineStep('resolve');
            const rzs = resolved as GameState;

            if (rzs.phase === 'round_end') {
              // Bench overflow → attacker wins this round
              console.log('[KC] → round_end after resolve: round', rzs.round, 'winner:', rzs.roundWinner);
              const isPlayerRoundWin2 = rzs.roundWinner === 'player';
              const trophyFanBonus2 = rzs.trophyFans[rzs.round - 1] ?? 0;
              const loserSide2: 'player' | 'ai' = rzs.roundWinner === 'player' ? 'ai' : 'player';
              const loserName2 = isPvP && pvpSession
                ? (loserSide2 === 'player' ? pvpSession.player1.childName : pvpSession.player2.childName)
                : (loserSide2 === 'player' ? 'あなた' : '相手');
              const msg2 = rzs.message ?? '';
              const m2 = msg2.match(/ベンチ満杯「([^」]+)」/);
              const reasonText2 = m2 ? `ベンチ満杯「${m2[1]}」` : 'ベンチ崩壊';

              // Phase 0: Reason banner
              setCineStep('round_end');
              await waitMs(150);
              if (unmountedRef.current) return;
              setRoundVictoryTelop(`💀 ${reasonText2}！${loserName2}の敗北`);
              pushLog(`💀 ${reasonText2}！${loserName2}の敗北`);
              await waitStep(1200);
              if (unmountedRef.current) return;

              // Phase 1: Victory/defeat banner
              setRoundVictoryTelop(isPlayerRoundWin2
                ? `🏆 トロフィー獲得！ +${trophyFanBonus2}ファン！`
                : `💀 第${rzs.round}回戦 敗北… 相手に+${trophyFanBonus2}ファン`);
              await waitMs(250);
              if (unmountedRef.current) return;
              if (manualModeRef.current) {
                await waitManualAdvance();
              } else {
                await waitStep(1800);
              }
              if (unmountedRef.current) return;
              setRoundVictoryTelop(null);

              // Advance to next round
              setDeckOffer(null);
              setRemovedCards([]);
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
                if (isPvP && pvpSession) {
                  const winnerName = advs.winner === 'player' ? pvpSession.player1.childName : pvpSession.player2.childName;
                  setRoundVictoryTelop(`🏆 ${winnerName} の勝利！`);
                } else {
                  setRoundVictoryTelop(advs.winner === 'player'
                    ? `🎉 VICTORY！ 🏆×${advs.playerTrophies} ⭐${advs.playerFans}ファン`
                    : `💀 敗北… 🏆×${advs.playerTrophies} ⭐${advs.playerFans}ファン`);
                }
                setCineStep('game_over');
                await waitStep(FINAL_REVEAL_MS + 500);
                if (unmountedRef.current) return;
                setRoundVictoryTelop(null);
                if (!unmountedRef.current) window.setTimeout(() => setScreen('result'), 300);
                return;
              }

              // Phase 2: Transition banner
              setRoundVictoryTelop(`第${rzs.round}回戦 → 第${advs.round}回戦へ`);
              await waitStep(1200);
              if (unmountedRef.current) return;
              setRoundVictoryTelop(null);

              // Next round starts with deck_phase
              setCineStep('idle');
              battleRunningRef.current = false;
              return;
            }

            if (rzs.phase === 'game_over') {
              // Safety fallback (shouldn't happen from resolveSubBattleWin anymore)
              await waitStep(FINAL_REVEAL_MS);
              if (!unmountedRef.current) setCineStep('game_over');
              if (!unmountedRef.current) window.setTimeout(() => setScreen('result'), 300);
              return;
            }
            if (manualModeRef.current) {
              await waitManualAdvance();
            } else {
              await waitStep(RESOLVE_BANNER_MS);
            }
            if (unmountedRef.current) return;

            // Brief pause after the resolve banner before kicking off the next sub-battle.
            await waitMs(150);
            if (unmountedRef.current) return;

            console.log('[KC] → continueAfterResolve (next sub-battle)');
            setGameState((prev) => (prev ? continueAfterResolve(prev) : prev));
            await waitMs(16);
            if (unmountedRef.current) return;

            // Track finisher card: defense card when player is defending (sub-battle continuation)
            {
              const gs = gameStateRef.current;
              if (gs && gs.flagHolder === 'player' && gs.defenseCard) {
                lastPlayerCardRef.current = gs.defenseCard;
              }
            }

            // 毒矢カエル: 防御時のみ任意発動（continueAfterResolve後の新防御カード）
            {
              const gs = gameStateRef.current;
              if (gs && gs.flagHolder === 'player' && gs.defenseCard?.effect?.id === 'poison_frog') {
                const oppSide: 'player' | 'ai' = 'ai';
                const oppSealed = gs.sealedBenchNames[oppSide];
                const hasRobben = gs[oppSide].bench.some((b) => b.name === 'ロベン島' && !oppSealed.includes(b.name));
                const oppBench = gs[oppSide].bench
                  .filter((b) => !(hasRobben && b.name === 'ネルソン・マンデラ'))
                  .map((b) => b.card);
                if (oppBench.length > 0) {
                  const chosen = await waitCardSelect('🐸 除外する相手のカードを選んでください', oppBench);
                  if (chosen && !unmountedRef.current) {
                    setGameState((prev) => {
                      if (!prev) return prev;
                      const newBench = removeOneFromBench(prev[oppSide].bench, chosen.name);
                      return {
                        ...prev,
                        [oppSide]: { ...prev[oppSide], bench: newBench },
                        exile: { ...prev.exile, [oppSide]: [...prev.exile[oppSide], chosen] },
                        effectTelop: { text: `🐸 猛毒！相手の${chosen.name}を除外！`, color: '#a855f7', key: Date.now() },
                      };
                    });
                  }
                }
              }
            }

            // Turn transition banner — "🔄 相手のターン！" / "🔄 あなたのターン！"
            setCineStep('turn_transition');
            if (manualModeRef.current) {
              await waitManualAdvance();
            } else {
              await waitStep(TURN_TRANSITION_MS);
            }
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
    setGameState((prev) => {
      if (!prev) return prev;
      // The attacker is the non-flagHolder; forfeit → the flagHolder (defender) wins.
      const defender: Side = prev.flagHolder;
      const attacker: Side = defender === 'player' ? 'ai' : 'player';
      // Spec (2026-04): forfeit 時も attackRevealed を攻撃側の隔離へ移す。
      const failedAttackCards = prev.attackRevealed;
      const updatedAttackerQuarantine = [...prev.quarantine[attacker], ...failedAttackCards];
      if (failedAttackCards.length > 0) {
        console.log(`[隔離] 攻撃失敗(forfeit): ${failedAttackCards.map((c) => c.name).join(', ')} → 隔離へ（現在隔離${updatedAttackerQuarantine.length}枚）`);
      }
      return {
        ...prev,
        phase: 'round_end' as GamePhase,
        roundWinner: defender,
        message: `第${prev.round}回戦: 攻撃を諦めた`,
        quarantine: {
          ...prev.quarantine,
          [attacker]: updatedAttackerQuarantine,
        },
        attackRevealed: [],
        attackCurrentPower: 0,
      };
    });
    playerActionLatchRef.current?.();
  }, []);

  // ===== 15s turn-end countdown (PvP only) =====
  // Starts on each attacker reveal wait, expires → auto-forfeit.
  useEffect(() => {
    if (!isPvP) { setTurnEndTimer(null); return; }
    if (!waitingForPlayerReveal || cineStep !== 'attack_reveal') {
      setTurnEndTimer(null);
      return;
    }
    setTurnEndTimer(15);
    const interval = window.setInterval(() => {
      setTurnEndTimer((prev) => {
        if (prev === null) return prev;
        if (prev <= 1) {
          window.clearInterval(interval);
          // Defer forfeit until after state commit
          window.setTimeout(() => handleForfeitAttack(), 0);
          return null;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [isPvP, waitingForPlayerReveal, cineStep, handleForfeitAttack]);

  // ===== Deck phase: tap card → show quiz =====
  // NOTE: クイズ出題は deck_phase 限定。バトル中は絶対に走らない。
  const handleCardTap = useCallback((index: number) => {
    if (!deckOffer || !gameState) return;
    if (gameState.phase !== 'deck_phase') return;  // hard gate against battle-phase leaks
    if (deckOffer.blocked.has(index) || deckOffer.acquired.has(index)) return;
    // Enforce per-round pick limit (mode-aware: 5回戦は R5=1 else 2 / 3回戦・7回戦は3)
    const maxPicks = maxPicksForRound(gameState.round, gameState.totalRounds);
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
          setTimeout(() => setAltRewardPopup(null), 1500);
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
          // In PvP, P2's picks go to `ai.deck`; otherwise to `player.deck`.
          const targetSide = pvpActiveSide;
          const targetDeck = targetSide === 'ai' ? prev.ai.deck : prev.player.deck;
          const nextDeckLen = targetDeck.length + 1;
          if (nextDeckLen > MAX_DECK_SIZE) {
            // Trigger swap UI; don't add yet
            setSwapState({ incoming: card });
            return prev;
          }
          if (targetSide === 'ai') {
            return { ...prev, ai: { ...prev.ai, deck: [...prev.ai.deck, card] } };
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
  }, [activeQuiz, deckOffer, gameState, selectedAnswer, consecutiveCorrect, userId, addTotalAlt, pvpActiveSide]);

  // ===== Redraw offer =====
  // 獲得済みカードはデッキに残したまま、未選択カードだけ入れ替える。
  const handleRedraw = useCallback(() => {
    if (!deckOffer || deckOffer.redrawsLeft <= 0 || !gameState) return;
    const maxPicks = maxPicksForRound(gameState.round, gameState.totalRounds);
    if (deckOffer.acquired.size >= maxPicks) return; // もう選べないなら引き直し不要

    // 未選択カードの数だけ新しく引く（提示枚数を維持）
    const remainingPicks = maxPicks - deckOffer.acquired.size;
    const cardCount = gameState.stageRules?.deckPhaseCards ?? 9;
    const newCount = cardCount - deckOffer.acquired.size;
    const unlockedSSR2 = isPvP && pvpSession
      ? (pvpDeckTurn === 'p1' ? pvpSession.player1.unlockedSSRCardNames : pvpSession.player2.unlockedSSRCardNames)
      : getUnlockedSSRCardNames(loadQuestProgress());
    const activeDeckForRedraw = pvpActiveSide === 'ai' ? gameState.ai.deck : gameState.player.deck;
    const newCards = sampleCardsWithSynergy(newCount, 'offer', gameState.round, activeDeckForRedraw, unlockedSSR2, gameState.totalRounds);

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
  }, [deckOffer, gameState, isPvP, pvpSession, pvpDeckTurn, pvpActiveSide]);

  // ===== Deck phase → start battle =====
  // デッキフェイズ終了（「バトル開始」ボタン）で battle_intro へ遷移
  // startBattle は flagHolder のデッキトップから最初の defender カードを引く
  // ===== Deck phase: remove card from current deck =====
  const handleRequestRemoveCard = useCallback((index: number) => {
    if (!gameState) return;
    const activeDeck = pvpActiveSide === 'ai' ? gameState.ai.deck : gameState.player.deck;
    if (activeDeck.length <= MIN_DECK_SIZE) {
      toast.error(`最低${MIN_DECK_SIZE}枚必要です`);
      return;
    }
    // Instant remove (no confirmation dialog) — card goes to removed area
    const card = activeDeck[index];
    setFadingOutIdx(index);
    window.setTimeout(() => {
      setGameState((prev) => {
        if (!prev) return prev;
        if (pvpActiveSide === 'ai') {
          const deck = [...prev.ai.deck];
          deck.splice(index, 1);
          return { ...prev, ai: { ...prev.ai, deck } };
        }
        return removeCardFromDeck(prev, index);
      });
      if (card) setRemovedCards((prev) => [...prev, card]);
      setFadingOutIdx(null);
    }, 280);
  }, [gameState, pvpActiveSide]);

  const handleRestoreRemovedCard = useCallback((cardIndex: number) => {
    if (!gameState) return;
    const card = removedCards[cardIndex];
    if (!card) return;
    setGameState((prev) => {
      if (!prev) return prev;
      if (pvpActiveSide === 'ai') {
        return { ...prev, ai: { ...prev.ai, deck: [...prev.ai.deck, card] } };
      }
      return addCardToDeck(prev, card);
    });
    setRemovedCards((prev) => prev.filter((_, i) => i !== cardIndex));
  }, [gameState, removedCards, pvpActiveSide]);

  // Legacy — still referenced by pendingRemoveIdx confirm dialog (now unused)
  const handleConfirmRemoveCard = useCallback(() => {}, []);
  const handleCancelRemoveCard = useCallback(() => setPendingRemoveIdx(null), []);

  const handleStartBattle = useCallback(async () => {
    if (!gameState || gameState.phase !== 'deck_phase') return;
    playBattleStart();
    // In PvP, validate against the active side's deck.
    const activeDeckLen = pvpActiveSide === 'ai' ? gameState.ai.deck.length : gameState.player.deck.length;
    if (activeDeckLen < MIN_DECK_SIZE) {
      toast.error(`デッキは最低${MIN_DECK_SIZE}枚必要です`);
      return;
    }
    // PvP: P1 finished → hand off to P2's deck phase instead of starting battle.
    if (isPvP && pvpDeckTurn === 'p1') {
      setDeckOffer(null);
      setActiveQuiz(null);
      setSwapState(null);
      setSelectedAnswer(null);
      setShowQuizResult(false);
      setPvpDeckTurn('p2');
      return;
    }
    setDeckOffer(null);
    setActiveQuiz(null);
    setSwapState(null);
    const next = startBattle(gameState);
    console.log('[KC] handleStartBattle: phase =', next.phase, 'defenseCard =', next.defenseCard?.name);
    setGameState(next);

    // Track finisher card: defense card when player is defending
    if (next.flagHolder === 'player' && next.defenseCard) {
      lastPlayerCardRef.current = next.defenseCard;
    }

    // 毒矢カエル: 防御時のみ任意発動 — プレイヤーが防御中で毒矢カエルが防御カードの場合
    if (next.phase === 'battle_intro' && next.flagHolder === 'player' && next.defenseCard?.effect?.id === 'poison_frog') {
      const oppSide: 'player' | 'ai' = 'ai';
      const oppSealed = next.sealedBenchNames[oppSide];
      const hasRobben = next[oppSide].bench.some((b) => b.name === 'ロベン島' && !oppSealed.includes(b.name));
      const oppBench = next[oppSide].bench
        .filter((b) => !(hasRobben && b.name === 'ネルソン・マンデラ'))
        .map((b) => b.card);
      if (oppBench.length > 0) {
        const chosen = await waitCardSelect('🐸 除外する相手のカードを選んでください', oppBench);
        if (chosen && !unmountedRef.current) {
          setGameState((prev) => {
            if (!prev) return prev;
            const newBench = removeOneFromBench(prev[oppSide].bench, chosen.name);
            return {
              ...prev,
              [oppSide]: { ...prev[oppSide], bench: newBench },
              exile: { ...prev.exile, [oppSide]: [...prev.exile[oppSide], chosen] },
              effectTelop: { text: `🐸 猛毒！相手の${chosen.name}を除外！`, color: '#a855f7', key: Date.now() },
            };
          });
        }
      }
    }

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
      }, 1200);
    } else {
      setCineStep('idle');
    }
    advanceLatchRef.current = null;
  }, [gameState, isPvP, pvpDeckTurn, pvpActiveSide, waitCardSelect]);

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

    // ---------- PvP branch ----------
    // 両プレイヤーの wins/losses/Elo を反映して結果画面へ遷移。
    // ステージ報酬・称号・殿堂入り・ALT加算は PvP ではスキップ。
    if (isPvP && pvpSession) {
      const p1 = pvpSession.player1;
      const p2 = pvpSession.player2;
      const p1Won = gameState.winner === 'player';
      void applyPvPRatingChange({
        p1Id: p1.childId, p1IsAdmin: p1.isAdmin,
        p2Id: p2.childId, p2IsAdmin: p2.isAdmin,
        p1Won,
      }).then((res) => {
        const fmt = (d: number) => `${d >= 0 ? '+' : ''}${d}`;
        toast.info(`🔴 ${p1.childName} レート ${fmt(res.p1.delta)} (${res.p1.newRating})`);
        toast.info(`🔵 ${p2.childName} レート ${fmt(res.p2.delta)} (${res.p2.newRating})`);
      });
      const winnerName = p1Won ? p1.childName : p2.childName;
      setLastResult({ score: 100, maxScore: 100, timeSeconds: 0, accuracy: 1, isBestScore: false });
      toast.success(`🏆 勝者: ${winnerName}`);

      // battle_history に対人戦として2件記録（管理者/モニターは service 側でスキップ）
      const winnerId = p1Won ? p1.childId : p2.childId;
      const loserId = p1Won ? p2.childId : p1.childId;
      const winnerDeck = starterIdToDeckKey(p1Won ? p1.starterDeckId : p2.starterDeckId);
      const loserDeck = starterIdToDeckKey(p1Won ? p2.starterDeckId : p1.starterDeckId);
      const finisher = p1Won ? lastPlayerCardRef.current : null;
      void savePvPBattleHistory({
        winnerId, loserId, winnerDeckKey: winnerDeck, loserDeckKey: loserDeck,
        winnerFinisherId: finisher?.id ?? null,
        winnerFinisherName: finisher?.name ?? null,
        winnerFans: p1Won ? gameState.playerFans : gameState.aiFans,
        loserFans:  p1Won ? gameState.aiFans   : gameState.playerFans,
        roundsPlayed: gameState.history.length,
      });

      clearPvPSession();
      // Defensive cleanup: clear all in-component battle state so a new battle starts fresh.
      // Engine-level (initGameState) already resets exile/quarantine/sealed, but this guards
      // against any race where stale gameState lingers across remount.
      clearStepTimeouts();
      setGameState(null);
      setRemovedCards([]);
      setDeckOffer(null);
      setActiveQuiz(null);
      setSwapState(null);
      navigate('/');
      return;
    }

    // 基本報酬: フリープレイなら won?30:5
    let altReward = won ? 30 : 5;

    // ステージクリア報酬を加算 & 状態更新
    if (won && currentStage) {
      markStageCleared(currentStage.id);
      if (!isStageRewarded(currentStage.id)) {
        altReward += currentStage.altReward;
        if (currentStage.cardRewardId) {
          addCollectionCard(currentStage.cardRewardId);
          toast.success(`カード「${currentStage.cardRewardId}」を獲得！`);
        }
        if (currentStage.specialCard) {
          addCollectionCard(currentStage.specialCard.id);
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

    // battle_history に保存（PvP / 管理者 / モニター / ゲスト はサービス内でスキップ）
    if (activeDeckKeyRef.current !== null) {
      const finisher = won ? lastPlayerCardRef.current : null;
      void saveBattleHistory({
        childId: userId,
        deckKey: activeDeckKeyRef.current,
        opponentType: 'npc',
        stage: currentStage?.id ?? null,
        result: won ? 'win' : 'lose',
        totalFans: gameState.playerFans ?? null,
        opponentFans: gameState.aiFans ?? null,
        finisherCardId: finisher?.id ?? null,
        finisherCardName: finisher?.name ?? null,
        roundsPlayed: gameState.history.length,
      });
    }

    // Defensive cleanup before leaving: ensure next battle starts with fresh state.
    clearStepTimeouts();
    setGameState(null);
    setRemovedCards([]);
    setDeckOffer(null);
    setActiveQuiz(null);
    setSwapState(null);
    navigate('/result');
  }, [gameState, currentStage, userId, addTotalAlt, triggerEarnEffect, setLastResult, navigate, markStageCleared, markStageRewarded, isStageRewarded, addCollectionCard, userStoreSet, isPvP, pvpSession, clearStepTimeouts]);

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
            onClick={() => {
              playTap();
              if (stageId !== null) {
                // Stage mode: go to deck selection
                setScreen('deck_select');
              } else {
                playBattleStart();
                startGame();
              }
            }}
            disabled={!imagesPreloaded || (stageId === null && !(previewValidation?.valid))}
            className="tqw-btn-battle tappable pulse-btn w-full text-lg font-black py-3.5 mb-2 rounded-xl tracking-widest"
            style={{ opacity: (!imagesPreloaded || (stageId === null && !(previewValidation?.valid))) ? 0.5 : 1 }}
          >
            {!imagesPreloaded
              ? `⏳ 読み込み中... ${preloadProgress}%`
              : stageId !== null
                ? '⚔️ デッキ選択へ'
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
  // =================== DECK SELECT SCREEN =====================
  // =============================================================
  if (screen === 'deck_select') {
    const questProgress = loadQuestProgress();
    const myDecks = loadMyDecks();

    const difficultyIcon = (d: typeof QUEST_DIFFICULTIES[number], deckKey: DeckKey): string => {
      const dp = questProgress[deckKey][d];
      const unlocked = isDifficultyUnlocked(questProgress, deckKey, d);
      if (dp.cleared) return '✅';
      if (!unlocked) return '🔒';
      if (dp.correctCount > 0) return '▶️';
      return '⭐';
    };

    // カード一覧ポップアップ用
    const popupDeck = expandedStarterId ? STARTER_DECKS.find((d) => d.id === expandedStarterId) : null;
    const popupCards = popupDeck && popupDeck.id !== 'starter-random' ? (() => {
      const allNames = [popupDeck.trumpCard, ...popupDeck.themeCards, ...popupDeck.noiseCards];
      return allNames.map((n) => findCardByName(n)).filter(Boolean) as BattleCard[];
    })() : null;

    // デッキ戦略説明
    const DECK_STRATEGY: Record<string, string> = {
      'starter-napoleon': '大砲と法典でナポレオンを強化。アウステルリッツで効果2倍',
      'starter-amazon': '巫師で大蛇を召喚し、イルカで巫師を回収するループデッキ',
      'starter-heritage': '紙を集めて焚書坑儒で大量除外。勅令でセットアップ',
      'starter-nobunaga': '鉄砲と足軽の物量。本能寺の変で明智ルートへ',
      'starter-jeanne': '聖剣+軍旗でフルバフ。火刑で聖女ジャンヌに変身',
      'starter-murasaki': '和歌と筆で堅実に強化。十二単で除外耐性',
      'starter-mandela': '自由憲章を積んで攻撃力UP。虹の国で除外全回収',
      'starter-wolf': '群れの掟で防御鉄壁。遠吠えでサーチ。一匹狼で奇襲',
      'starter-galileo': '望遠鏡+地動説でバフ。地球は動いているで相手無効化',
      'starter-davinci': 'モナリザ+最後の晩餐をベンチに揃えて万能の天才に進化',
    };

    // 初回デッキプレゼント判定
    const showGift = !isFirstDeckClaimed();

    // Gift overlay: 初回プレゼント画面
    if (showGift) {
      const themedDecks = STARTER_DECKS.filter((d) => d.id !== 'starter-random').filter((d) => {
        // 準備中のデッキはプレゼント対象から除外
        const entry = Object.entries(DECK_KEY_TO_STARTER_ID).find(([, sid]) => sid === d.id);
        const dk = entry?.[0] as DeckKey | undefined;
        return !dk || isDeckAvailable(dk);
      });
      return (
        <div className="min-h-screen px-4 py-6 flex flex-col" style={{ background: 'linear-gradient(180deg, #0b1128 0%, #151d3b 50%, #0e1430 100%)' }}>
          <div className="text-center mb-4">
            <p className="text-3xl mb-2">🎁</p>
            <h1 className="text-xl font-black" style={{ color: '#ffd700' }}>デッキプレゼント！</h1>
            <p className="text-sm text-amber-200/70 mt-1">好きなデッキを1つ選ぼう</p>
          </div>
          <div className="flex-1 overflow-y-auto space-y-2 max-w-md mx-auto w-full">
            {themedDecks.map((deck) => {
              const deckKeyEntry = Object.entries(DECK_KEY_TO_STARTER_ID).find(([, sid]) => sid === deck.id);
              const deckKey = deckKeyEntry?.[0] as DeckKey | undefined;
              const info = deckKey ? DECK_QUEST_INFO[deckKey] : null;
              return (
                <button
                  key={deck.id}
                  onClick={() => {
                    if (!deckKey) return;
                    setGiftConfirmDeck({
                      deckKey,
                      icon: deck.icon,
                      name: deck.name,
                      strategy: DECK_STRATEGY[deck.id] ?? deck.description,
                    });
                  }}
                  className="w-full rounded-xl p-3 flex items-center gap-3 active:scale-[0.98] transition-transform text-left"
                  style={{
                    background: 'linear-gradient(135deg, rgba(21,29,59,0.95), rgba(14,20,45,0.95))',
                    border: `1.5px solid ${info?.color ?? 'rgba(255,215,0,0.25)'}50`,
                    boxShadow: '0 2px 10px rgba(0,0,0,0.3)',
                  }}
                >
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0"
                    style={{ background: `${info?.color ?? '#ffd700'}22`, border: `1px solid ${info?.color ?? '#ffd700'}44` }}>
                    {deck.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-amber-100">{deck.name}</p>
                    <p className="text-[11px] text-amber-200/60 truncate">{DECK_STRATEGY[deck.id] ?? deck.description}</p>
                  </div>
                  <span className="text-amber-200/40 text-lg">›</span>
                </button>
              );
            })}
          </div>

          {/* Gift confirm modal with card list */}
          {giftConfirmDeck && (() => {
            const starterId = DECK_KEY_TO_STARTER_ID[giftConfirmDeck.deckKey];
            const starter = STARTER_DECKS.find((d) => d.id === starterId);
            const allNames = starter ? [starter.trumpCard, ...starter.themeCards, ...starter.noiseCards] : [];
            const allCards = allNames.map((n) => findCardByName(n)).filter(Boolean) as BattleCard[];
            const grouped = new Map<string, { card: BattleCard; count: number }>();
            for (const c of allCards) {
              const e = grouped.get(c.name);
              if (e) e.count++; else grouped.set(c.name, { card: c, count: 1 });
            }
            const rarityOrder: Record<string, number> = { SSR: 0, SR: 1, R: 2, N: 3 };
            const entries = Array.from(grouped.values()).sort((a, b) =>
              (rarityOrder[a.card.rarity] ?? 9) - (rarityOrder[b.card.rarity] ?? 9)
            );
            return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
              style={{ background: 'rgba(0,0,0,0.8)' }}
              onClick={() => setGiftConfirmDeck(null)}>
              <div
                className="w-full flex flex-col"
                style={{
                  maxWidth: 500,
                  maxHeight: '90vh',
                  background: 'rgba(26,31,58,0.95)',
                  backdropFilter: 'blur(20px)',
                  border: '2px solid #ffd700',
                  borderRadius: 20,
                  boxShadow: '0 16px 48px rgba(0,0,0,0.7), 0 0 40px rgba(255,215,0,0.15)',
                }}
                onClick={(e) => e.stopPropagation()}>
                {/* Header: icon + name + strategy */}
                <div className="text-center px-6 pt-6 pb-3 shrink-0">
                  <p className="text-5xl mb-2">{giftConfirmDeck.icon}</p>
                  <h2 className="text-xl font-black text-amber-100 mb-1">{giftConfirmDeck.name}</h2>
                  <p className="text-sm text-amber-200/70 leading-relaxed">{giftConfirmDeck.strategy}</p>
                </div>

                {/* Card grid (5×3, same style as deck phase) */}
                <div className="px-4 shrink-0">
                  <p className="text-[11px] font-bold text-amber-200/50 mb-1">📋 カード一覧（{allCards.length}枚）</p>
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto px-4" style={{ maxHeight: '50vh' }}>
                  <div className="grid grid-cols-5 gap-1 p-2 rounded-xl" style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,215,0,0.15)' }}>
                    {allCards.map((c, ci) => {
                      const rc = c.rarity === 'SSR' ? '#ffd700' : c.rarity === 'SR' ? '#a855f7' : c.rarity === 'R' ? '#3b82f6' : '#9ca3af';
                      return (
                        <button key={`${c.name}-${ci}`} onClick={() => setDetailCard(c)}
                          className="relative rounded-lg overflow-hidden active:scale-95 transition-transform"
                          style={{ aspectRatio: '360/500', border: `1.5px solid ${rc}88`, background: '#0b1128' }}>
                          {c.imageUrl && <img src={c.imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />}
                          <div className="absolute inset-x-0 bottom-0 px-0.5 py-0.5" style={{ background: 'linear-gradient(transparent, rgba(0,0,0,0.85))' }}>
                            <p className="text-[7px] font-bold text-white text-center truncate leading-tight" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.9)' }}>
                              {c.name}
                            </p>
                          </div>
                          <span className="absolute top-0 left-0 text-[6px] font-black px-0.5 rounded-br"
                            style={{ background: rc, color: c.rarity === 'N' ? '#e5e7eb' : '#fff' }}>
                            {c.rarity}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Buttons */}
                <div className="flex flex-col items-center gap-3 px-6 py-5 shrink-0">
                  <button
                    onClick={() => {
                      claimFirstDeck(giftConfirmDeck.deckKey);
                      // デッキのカードをコレクションに追加
                      const deckCardNames = getStarterDeckCardNames(giftConfirmDeck.deckKey);
                      const deckCardIds = COLLECTION_CARDS
                        .filter((c) => deckCardNames.includes(c.name))
                        .map((c) => c.id);
                      addCollectionCards(deckCardIds);
                      setGiftConfirmDeck(null);
                      window.location.reload();
                    }}
                    className="tappable pulse-btn rounded-xl font-black text-base active:scale-[0.97] transition-transform"
                    style={{
                      width: '75%',
                      minHeight: 52,
                      background: 'linear-gradient(135deg, #ffd700, #c5a03f)',
                      color: '#0b1128',
                      boxShadow: '0 4px 16px rgba(255,215,0,0.45)',
                    }}>
                    🎁 もらう！
                  </button>
                  <button
                    onClick={() => setGiftConfirmDeck(null)}
                    className="rounded-lg font-bold text-sm active:scale-[0.97] transition-transform"
                    style={{
                      width: '55%',
                      minHeight: 40,
                      background: 'rgba(255,255,255,0.08)',
                      border: '1px solid rgba(255,255,255,0.2)',
                      color: 'rgba(255,255,255,0.6)',
                    }}>
                    キャンセル
                  </button>
                </div>
              </div>
            </div>
            );
          })()}
        </div>
      );
    }

    // 解放済みデッキが0個（ランダム除く）ならプレゼントバナー表示
    const unlockedCount = STARTER_DECKS.filter((d) => {
      if (d.id === 'starter-random') return false;
      const dke = Object.entries(DECK_KEY_TO_STARTER_ID).find(([, sid]) => sid === d.id);
      const dk = dke?.[0] as DeckKey | undefined;
      return dk && isDeckUnlocked(questProgress, dk);
    }).length;
    const showGiftBanner = !isFirstDeckClaimed() || unlockedCount === 0;

    return (
      <div className="min-h-screen px-4 py-6" style={{ background: 'linear-gradient(180deg, #0b1128 0%, #151d3b 50%, #0e1430 100%)' }}>
        <h1 className="text-xl font-bold text-center mb-1" style={{ color: '#ffd700', textShadow: '0 0 15px rgba(255,215,0,0.3)' }}>
          デッキ選択
        </h1>
        <p className="text-center text-amber-200/50 text-xs mb-4">解放済みデッキで出撃、未解放はクエストで解放しよう！</p>

        {/* ===== 初回プレゼントバナー ===== */}
        {showGiftBanner && (
          <div className="max-w-md mx-auto mb-4">
            <button
              onClick={() => {
                // showGift を強制的にトリガー: first_deck_claimed を消してリロード
                try { localStorage.removeItem('first_deck_claimed'); } catch { /* */ }
                window.location.reload();
              }}
              className="w-full rounded-xl p-3 flex items-center gap-3 active:scale-[0.98] transition-transform"
              style={{
                background: 'linear-gradient(135deg, rgba(255,215,0,0.15), rgba(255,215,0,0.05))',
                border: '2px solid rgba(255,215,0,0.5)',
                boxShadow: '0 0 20px rgba(255,215,0,0.12)',
              }}
            >
              <span className="text-3xl">🎁</span>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-black" style={{ color: '#ffd700' }}>初回デッキプレゼント</p>
                <p className="text-[11px] text-amber-200/70">好きなデッキを1つ無料でもらえます！</p>
              </div>
              <span className="text-sm font-bold" style={{ color: '#ffd700' }}>選ぶ →</span>
            </button>
          </div>
        )}

        {/* ===== My Decks セクション ===== */}
        <div className="max-w-md mx-auto mb-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm">🔨</span>
            <h2 className="text-xs font-bold text-amber-100">マイデッキ</h2>
            <span className="text-[10px] text-amber-200/40">({myDecks.length}/{MY_DECK_MAX_DECKS})</span>
            <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, rgba(255,215,0,0.3), transparent)' }} />
          </div>
          <div className="space-y-2">
            {myDecks.map((md) => {
              const total = md.cards.reduce((s, e) => s + e.count, 0);
              return (
                <div key={md.id}
                  className="rounded-xl p-2.5 flex items-center gap-2"
                  style={{
                    background: 'linear-gradient(135deg, rgba(139,92,246,0.15), rgba(59,130,246,0.1))',
                    border: '1.5px solid rgba(139,92,246,0.4)',
                  }}>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-bold text-amber-100 truncate">🔨 {md.deck_name}</p>
                    <p className="text-[10px] text-amber-200/60">{total}枚</p>
                  </div>
                  <button
                    onClick={() => navigate(`/deck-builder?id=${md.id}`)}
                    className="shrink-0 px-2.5 py-1 rounded-md text-[11px] font-bold active:scale-95 transition-transform"
                    style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.8)' }}>
                    ✏️ 編集
                  </button>
                  <button
                    onClick={() => {
                      const cards = buildMyDeckCards(md);
                      if (cards.length === 0) { return; }
                      startGame(undefined, cards);
                    }}
                    disabled={total !== 15}
                    className="shrink-0 px-3 py-1.5 rounded-md text-[12px] font-black active:scale-95 transition-transform"
                    style={{
                      background: total === 15 ? 'linear-gradient(135deg, #ef4444, #b91c1c)' : 'rgba(90,90,100,0.4)',
                      color: '#fff',
                      boxShadow: total === 15 ? '0 2px 10px rgba(239,68,68,0.4)' : 'none',
                      opacity: total === 15 ? 1 : 0.5,
                    }}>
                    ⚔️ 出撃
                  </button>
                </div>
              );
            })}
            {myDecks.length < MY_DECK_MAX_DECKS && (
              <button
                onClick={() => navigate('/deck-builder')}
                className="w-full rounded-xl py-2.5 text-[12px] font-bold active:scale-[0.98] transition-transform flex items-center justify-center gap-1.5"
                style={{
                  background: 'rgba(139,92,246,0.12)',
                  border: '1.5px dashed rgba(139,92,246,0.5)',
                  color: '#a78bfa',
                }}>
                ＋ 新規デッキを作る
              </button>
            )}
          </div>
        </div>

        {/* ===== Theme decks セクション ===== */}
        <div className="flex items-center gap-2 mb-2 max-w-md mx-auto">
          <span className="text-sm">📦</span>
          <h2 className="text-xs font-bold text-amber-100">テーマデッキ</h2>
          <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, rgba(255,215,0,0.3), transparent)' }} />
        </div>

        <div className="space-y-2.5 max-w-md mx-auto">
          {STARTER_DECKS.map((deck) => {
            const isSelected = selectedStarter?.id === deck.id;
            const trumpCard = deck.trumpCard ? findCardByName(deck.trumpCard) : null;
            const deckKeyEntry = Object.entries(DECK_KEY_TO_STARTER_ID).find(([, sid]) => sid === deck.id);
            const deckKey = deckKeyEntry?.[0] as DeckKey | undefined;
            const isRandom = deck.id === 'starter-random';
            const isAvailable = isRandom || !deckKey || isDeckAvailable(deckKey);
            const isUnlocked = isAvailable && (isRandom || !deckKey || isDeckUnlocked(questProgress, deckKey));
            if (deckKey) console.log('[デッキ選択] 解放済み判定:', deckKey, isUnlocked, 'available=', isAvailable);

            return (
              <div
                key={deck.id}
                className="rounded-xl overflow-hidden relative transition-all"
                style={{
                  background: isSelected
                    ? 'linear-gradient(135deg, rgba(255,215,0,0.18), rgba(255,215,0,0.03))'
                    : 'linear-gradient(135deg, rgba(21,29,59,0.95), rgba(14,20,45,0.95))',
                  border: isSelected
                    ? '2px solid rgba(255,215,0,0.7)'
                    : isUnlocked
                      ? '1.5px solid rgba(255,215,0,0.25)'
                      : '1.5px solid rgba(120,120,140,0.25)',
                  boxShadow: isSelected ? '0 0 18px rgba(255,215,0,0.3)' : '0 2px 10px rgba(0,0,0,0.3)',
                }}
              >
                <div className="px-3 pt-2.5 pb-2 flex items-center gap-3">
                  {/* Trump thumbnail or icon */}
                  {trumpCard ? (
                    <div className="w-11 h-14 rounded-md overflow-hidden shrink-0"
                      style={{ border: `1px solid ${isUnlocked ? 'rgba(255,215,0,0.3)' : 'rgba(120,120,140,0.25)'}`, filter: isUnlocked ? 'none' : 'grayscale(0.6)' }}>
                      <img src={trumpCard.imageUrl} alt={trumpCard.name} className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="w-11 h-14 rounded-md flex items-center justify-center text-2xl shrink-0"
                      style={{ background: 'rgba(255,215,0,0.08)', border: '1px solid rgba(255,215,0,0.3)' }}>
                      {deck.icon}
                    </div>
                  )}

                  {/* Title + badges + progress row */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[13px] font-bold text-amber-100 truncate">
                        {deck.icon} {deck.name.replace('デッキ', '').replace('🎨 ', '')}
                      </span>
                      {isRandom ? null : !isAvailable ? (
                        <span className="text-[9px] px-1.5 py-0.5 rounded font-bold shrink-0"
                          style={{ background: 'rgba(255,215,0,0.15)', color: 'var(--tqw-gold, #ffd700)', border: '1px solid rgba(255,215,0,0.4)' }}>🔨 準備中</span>
                      ) : isUnlocked ? (
                        <span className="text-[9px] px-1.5 py-0.5 rounded font-bold shrink-0"
                          style={{ background: 'rgba(34,197,94,0.18)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.35)' }}>✅ 解放済</span>
                      ) : (
                        <span className="text-[9px] px-1.5 py-0.5 rounded font-bold shrink-0"
                          style={{ background: 'rgba(120,120,140,0.15)', color: 'rgba(220,220,230,0.65)', border: '1px solid rgba(120,120,140,0.3)' }}>🔒 未解放</span>
                      )}
                    </div>
                    {/* Difficulty progress */}
                    {deckKey && (
                      <div className="flex items-center gap-1 text-[10px] text-amber-200/70">
                        {QUEST_DIFFICULTIES.map((d) => {
                          const di = DIFFICULTY_INFO[d];
                          const label = d === 'legend' ? '👑' : '⭐'.repeat(di.stars);
                          return (
                            <span key={d} className="flex items-center">
                              <span className="text-[9px]">{label}</span>
                              <span className="text-[11px] ml-0.5">{difficultyIcon(d, deckKey)}</span>
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Info button (opens popup) */}
                  {!isRandom && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setExpandedStarterId(deck.id); }}
                      className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[11px] active:scale-90 transition-transform"
                      style={{
                        background: 'rgba(0,0,0,0.45)',
                        color: '#ffd700',
                        border: '1px solid rgba(255,215,0,0.35)',
                      }}
                      aria-label="カード一覧"
                    >
                      ℹ
                    </button>
                  )}
                </div>

                {/* Action row */}
                <div className="px-3 pb-2.5">
                  {!isAvailable ? (
                    <button
                      onClick={() => toast.info('🔨 もうすこしまってね！', { duration: 1800 })}
                      className="w-full rounded-lg py-2 font-black text-[13px]"
                      style={{
                        background: 'rgba(255,215,0,0.08)',
                        color: 'var(--tqw-gold, #ffd700)',
                        border: '1px solid rgba(255,215,0,0.25)',
                        opacity: 0.75,
                      }}
                    >
                      🔨 準備中
                    </button>
                  ) : isUnlocked ? (
                    isSelected ? (
                      <button
                        onClick={() => startGame(deck)}
                        className="w-full rounded-lg py-2 font-black text-[13px] active:scale-[0.98] transition-transform"
                        style={{
                          background: 'linear-gradient(135deg, #ef4444, #b91c1c)',
                          color: '#fff',
                          boxShadow: '0 2px 10px rgba(239,68,68,0.4)',
                        }}
                      >
                        ⚔️ 出撃する
                      </button>
                    ) : (
                      <button
                        onClick={() => setSelectedStarter(deck)}
                        className="w-full rounded-lg py-1.5 font-bold text-[11px] active:scale-[0.98] transition-transform"
                        style={{
                          background: 'rgba(255,215,0,0.08)',
                          color: '#ffd700',
                          border: '1px solid rgba(255,215,0,0.25)',
                        }}
                      >
                        タップで選択
                      </button>
                    )
                  ) : (
                    <button
                      onClick={() => deckKey && navigate(`/quest/${deckKey}`)}
                      className="w-full rounded-lg py-2 font-black text-[13px] active:scale-[0.98] transition-transform"
                      style={{
                        background: 'linear-gradient(135deg, #8b5cf6, #3b82f6)',
                        color: '#fff',
                        boxShadow: '0 2px 10px rgba(139,92,246,0.4)',
                      }}
                    >
                      📖 クエストに挑戦 →
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="max-w-md mx-auto mt-5">
          <button
            onClick={() => setScreen('title')}
            className="text-amber-200/35 text-xs hover:text-amber-200/60 transition-colors py-2 w-full text-center"
          >
            ← 戻る
          </button>
        </div>

        {/* カード一覧ポップアップ（グループ表示+戦略説明） */}
        {popupDeck && popupCards && (() => {
          const grouped = new Map<string, { card: BattleCard; count: number }>();
          for (const c of popupCards) {
            const e = grouped.get(c.name);
            if (e) e.count++;
            else grouped.set(c.name, { card: c, count: 1 });
          }
          const rarityOrder: Record<string, number> = { SSR: 0, SR: 1, R: 2, N: 3 };
          const entries = Array.from(grouped.values()).sort((a, b) =>
            (rarityOrder[a.card.rarity] ?? 9) - (rarityOrder[b.card.rarity] ?? 9)
          );
          const strategy = DECK_STRATEGY[popupDeck.id] ?? popupDeck.description;
          return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.78)' }}
            onClick={() => setExpandedStarterId(null)}
          >
            <div
              className="w-full max-w-sm rounded-2xl overflow-hidden flex flex-col max-h-[85vh]"
              style={{
                background: 'linear-gradient(135deg, rgba(21,29,59,0.98), rgba(14,20,45,0.98))',
                border: '2px solid rgba(255,215,0,0.5)',
                boxShadow: '0 10px 40px rgba(0,0,0,0.6)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-4 py-3 flex items-center justify-between shrink-0"
                style={{ background: 'rgba(255,215,0,0.15)', borderBottom: '1.5px solid rgba(255,215,0,0.35)' }}>
                <div className="flex items-center gap-2">
                  <span className="text-xl">{popupDeck.icon}</span>
                  <h3 className="text-base font-black text-amber-100">{popupDeck.name}</h3>
                  <span className="text-[11px] text-amber-200/50">{popupCards.length}枚</span>
                </div>
                <button onClick={() => setExpandedStarterId(null)} className="text-white/70 text-base">✕</button>
              </div>
              <div className="flex-1 overflow-auto">
                <div className="divide-y divide-white/5">
                  {entries.map(({ card: c, count }) => {
                    const rc = c.rarity === 'SSR' ? '#ffd700' : c.rarity === 'SR' ? '#a855f7' : c.rarity === 'R' ? '#3b82f6' : '#9ca3af';
                    return (
                      <button key={c.name} onClick={() => setDetailCard(c)}
                        className="w-full flex items-center gap-2.5 px-3 py-2 active:bg-white/5 transition-colors text-left">
                        <div className="w-9 h-12 rounded-md overflow-hidden shrink-0"
                          style={{ border: `1.5px solid ${rc}80` }}>
                          <img src={c.imageUrl} alt="" className="w-full h-full object-cover" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[12px] font-bold text-amber-100 truncate">
                              {c.name}{count > 1 ? ` ×${count}` : ''}
                            </span>
                            <span className="text-[9px] font-black px-1 rounded shrink-0" style={{ background: rc, color: '#fff' }}>
                              {c.rarity}
                            </span>
                          </div>
                          <p className="text-[10px] text-amber-200/50 truncate">{c.effect?.name ?? c.effectDescription}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-[10px] font-bold" style={{ color: '#ff6b6b' }}>⚔️{c.attackPower ?? c.power}</p>
                          <p className="text-[10px] font-bold" style={{ color: '#60a5fa' }}>🛡️{c.defensePower ?? c.power}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="px-3 py-2.5 shrink-0" style={{ borderTop: '1px solid rgba(255,215,0,0.2)', background: 'rgba(0,0,0,0.3)' }}>
                <p className="text-[11px] text-amber-200/70 text-center leading-snug">💡 {strategy}</p>
              </div>
            </div>
          </div>
          );
        })()}
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
            <span className="text-6xl block">{isPvP ? '🏆' : won ? '🎉' : '💀'}</span>
          </div>
          <h2
            className="font-black mb-2"
            style={{
              fontSize: '42px',
              color: '#ffd700',
              textShadow: '0 0 28px rgba(255,215,0,0.8), 0 0 56px rgba(255,215,0,0.4)',
              lineHeight: 1.0,
            }}
          >
            {isPvP && pvpSession
              ? `${won ? pvpSession.player1.childName : pvpSession.player2.childName} の勝利！`
              : (won ? '勝利！' : '敗北...')}
          </h2>

          {/* Trophy + Fan totals */}
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="text-center px-4 py-2 rounded-lg" style={{ background: 'rgba(34,197,94,0.18)', border: '2px solid rgba(34,197,94,0.45)', boxShadow: gameState.playerFans > gameState.aiFans ? '0 0 12px rgba(255,215,0,0.3)' : 'none' }}>
              <p className="text-[9px] text-green-200/70 mb-0.5">
                {isPvP && pvpSession ? `🔴 ${pvpSession.player1.childName}` : 'あなた'}
              </p>
              <p className="text-sm font-bold text-amber-300 mb-0.5">{'🏆'.repeat(gameState.playerTrophies)}{gameState.playerTrophies === 0 ? '-' : ''}</p>
              <span key={`pfan-${gameState.playerFans}`} className="text-3xl font-black kc-power-bounce" style={{ color: gameState.playerFans >= gameState.aiFans ? '#ffd700' : '#22c55e', textShadow: `0 0 12px ${gameState.playerFans >= gameState.aiFans ? 'rgba(255,215,0,0.6)' : 'rgba(34,197,94,0.6)'}` }}>⭐ {gameState.playerFans}</span>
            </div>
            <span className="text-lg font-black text-amber-200/50">VS</span>
            <div className="text-center px-4 py-2 rounded-lg" style={{ background: 'rgba(239,68,68,0.15)', border: '2px solid rgba(239,68,68,0.4)', boxShadow: gameState.aiFans > gameState.playerFans ? '0 0 12px rgba(255,215,0,0.3)' : 'none' }}>
              <p className="text-[9px] text-red-200/70 mb-0.5">
                {isPvP && pvpSession ? `🔵 ${pvpSession.player2.childName}` : '相手'}
              </p>
              <p className="text-sm font-bold text-amber-300 mb-0.5">{'🏆'.repeat(gameState.aiTrophies)}{gameState.aiTrophies === 0 ? '-' : ''}</p>
              <span key={`afan-${gameState.aiFans}`} className="text-3xl font-black kc-power-bounce" style={{ color: gameState.aiFans > gameState.playerFans ? '#ffd700' : '#ef4444', textShadow: `0 0 12px ${gameState.aiFans > gameState.playerFans ? 'rgba(255,215,0,0.6)' : 'rgba(239,68,68,0.6)'}` }}>⭐ {gameState.aiFans}</span>
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
          {!isPvP && (
          <div
            className="rounded-lg px-3 py-2 mb-4 mx-auto kc-reward-pop"
            style={{ background: 'rgba(255,215,0,0.1)', border: '1px solid rgba(255,215,0,0.3)' }}
          >
            <p className="text-[10px] text-amber-200/70">獲得ALT</p>
            <p className="text-2xl font-black" style={{ color: '#ffd700', textShadow: '0 0 10px rgba(255,215,0,0.6)' }}>
              +{rewardAlt}
            </p>
          </div>
          )}

          {/* Stage clear reward */}
          {won && currentStage && (
            <div className="mb-4">
              <p className="text-2xl font-black mb-2 kc-result-icon" style={{ color: '#ffd700', textShadow: '0 0 20px rgba(255,215,0,0.6)' }}>
                {currentStage.isBoss ? '🎉 ボスステージクリア！' : '🎉 ステージクリア！'}
              </p>
              {currentStage.specialCard && (
                <div className="kc-reward-pop">
                  <div className="w-24 h-32 mx-auto rounded-xl overflow-hidden mb-2"
                    style={{ border: '3px solid #ffd700', boxShadow: '0 0 24px rgba(255,215,0,0.4)' }}>
                    <img src={currentStage.specialCard.imageUrl} alt={currentStage.specialCard.name}
                      className="w-full h-full object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  </div>
                  <p className="text-sm font-bold text-amber-100">🃏 {currentStage.specialCard.name} を獲得！</p>
                </div>
              )}
              {currentStage.title && (
                <p className="text-sm font-bold text-amber-200 mt-1 kc-reward-pop">🏆 称号「{currentStage.title.name}」獲得！</p>
              )}
              <p className="text-lg font-black mt-2 kc-fan-count" style={{ color: '#ffd700' }}>
                +{currentStage.altReward} ALT
              </p>
            </div>
          )}

          {/* Sub-battle history */}
          <div className="rounded-lg p-2 mb-4 text-left max-h-40 overflow-y-auto" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)' }}>
            {gameState.history.length === 0 ? (
              <p className="text-[11px] text-amber-200/40 text-center py-2">（サブバトルなし）</p>
            ) : gameState.history.map((r) => (
              <div key={r.idx} className="flex items-center justify-between text-[11px] py-0.5">
                <span className="text-amber-200/60">#{r.idx}</span>
                <span className="text-amber-100 truncate mx-2">
                  {isPvP && pvpSession
                    ? (r.attackerSide === 'player' ? pvpSession.player1.childName : pvpSession.player2.childName)
                    : (r.attackerSide === 'player' ? 'あなた' : '相手')} → {r.defenderCard.name}
                </span>
                <span className={`font-black ${r.winner === 'player' ? 'text-green-400' : 'text-red-400'}`}>
                  ⚔️{r.attackPower}
                </span>
              </div>
            ))}
          </div>

          {/* ===== ベンチ & 隔離スペース表示 ===== */}
          {([
            {
              label: isPvP && pvpSession ? `🔴 ${pvpSession.player1.childName}のベンチ` : 'あなたのベンチ',
              bench: gameState.player.bench,
              color: isPvP ? '#ef4444' : '#22c55e',
              quarantine: gameState.quarantine.player,
              maxSlots: gameState.stageRules?.benchLimit ?? BENCH_MAX_SLOTS,
            },
            {
              label: isPvP && pvpSession ? `🔵 ${pvpSession.player2.childName}のベンチ` : '相手のベンチ',
              bench: gameState.ai.bench,
              color: isPvP ? '#3b82f6' : '#ef4444',
              quarantine: gameState.quarantine.ai,
              maxSlots: gameState.stageRules?.npcBenchSlots ?? BENCH_MAX_SLOTS,
            },
          ] as const).map(({ label, bench, color, quarantine, maxSlots }) => (
            <div key={label} className="rounded-lg p-2 mb-3 text-left" style={{ background: 'rgba(0,0,0,0.25)', border: `1px solid ${color}22` }}>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-[10px] font-bold" style={{ color }}>{label}</p>
                <p className="text-[9px] text-amber-200/50">{bench.length}/{maxSlots} スロット</p>
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
              {isPvP ? '🏠 ホームに戻る' : (won ? '🎯 次のステージへ' : '📋 ステージ選択に戻る')}
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

  // ===== Turn indicator (self attack/defense/opponent attack) =====
  const turnKind: 'self_attack' | 'self_defense' | 'enemy_attack' | null = (() => {
    if (!gameState || gameState.phase === 'deck_phase' || gameState.phase === 'game_over' || gameState.phase === 'round_end') return null;
    const playerIsDefender = gameState.flagHolder === 'player';
    // In PvP, "self" vs "enemy" is ambiguous — only show for solo.
    if (isPvP) return null;
    if (playerIsDefender) return 'self_defense';
    return 'enemy_attack'; // flagHolder = ai → player attacks, or ai attacks? flagHolder=ai means player attacks next (player takes AI flag). Actually flagHolder is the defender.
  })();
  // Correction: flagHolder holds the defender slot.
  // playerIsDefender = flagHolder === 'player' → player defends, ai attacks.
  // else → player attacks.
  const turnKindCorrected: 'self_attack' | 'self_defense' | 'enemy_attack' | null = (() => {
    if (!gameState || gameState.phase === 'deck_phase' || gameState.phase === 'game_over' || gameState.phase === 'round_end') return null;
    if (isPvP) return null;
    const playerIsDefender = gameState.flagHolder === 'player';
    if (playerIsDefender) return 'self_defense';
    return 'self_attack';
  })();
  // If waiting for AI to reveal attack (= we defend AND waiting), show "enemy attack"
  const finalTurnKind: 'self_attack' | 'self_defense' | 'enemy_attack' | null = (() => {
    if (turnKindCorrected === 'self_defense' && cineStep === 'attack_reveal') return 'enemy_attack';
    return turnKindCorrected;
  })();
  void turnKind; // suppress unused var; kept for readability

  const turnGlowClass = finalTurnKind === 'self_attack' ? 'turn-glow-self-attack'
    : finalTurnKind === 'self_defense' ? 'turn-glow-self-defense'
    : finalTurnKind === 'enemy_attack' ? 'turn-glow-enemy-attack'
    : '';

  const turnLabel = finalTurnKind === 'self_attack' ? '⚔️ あなたの攻撃'
    : finalTurnKind === 'self_defense' ? '🛡️ 防御中'
    : finalTurnKind === 'enemy_attack' ? '⚠️ 相手の攻撃'
    : '';
  const turnLabelColor = finalTurnKind === 'self_attack' ? '#22c55e'
    : finalTurnKind === 'self_defense' ? '#3b82f6'
    : finalTurnKind === 'enemy_attack' ? '#ef4444'
    : '#ffd700';

  // Mount-keyed banner: re-fires on turnKind change
  const bannerKey = `${finalTurnKind}-${gameState?.round ?? 0}-${gameState?.attackRevealed.length ?? 0}`;

  return (
    <div className={`min-h-screen flex flex-col relative ${turnGlowClass}`} style={{
      background: 'linear-gradient(180deg, #0a0e1a 0%, #1a1f3a 50%, #0a0e1a 100%)',
    }}>
      {/* Battle bg + overlay (Manus mock battle.html) — uses equipped shop background if available */}
      {(() => {
        const equipped = getBg(loadEquippedBg());
        const bgUrl = equipped?.image ?? '/images/ui/bg-battle.png';
        const fallback = equipped?.fallbackGradient;
        return (
          <>
            <div
              aria-hidden
              className="tqw-battle-bg"
              style={{
                backgroundImage: `url(${bgUrl})${fallback ? `, ${fallback}` : ''}`,
              }}
            />
            <div aria-hidden className="tqw-battle-bg-overlay" />
          </>
        );
      })()}
      {/* ===== Turn Banner (fades in/out on change) ===== */}
      {turnLabel && (
        <div
          key={bannerKey}
          className="turn-banner fixed top-0 left-0 right-0 z-[180] flex justify-center pt-2 pointer-events-none"
        >
          <div
            className="px-3 py-1 rounded-b-lg text-[12px] font-black"
            style={{
              background: 'rgba(11,17,40,0.88)',
              border: `1.5px solid ${turnLabelColor}`,
              color: turnLabelColor,
              textShadow: `0 0 8px ${turnLabelColor}66`,
              boxShadow: `0 2px 10px ${turnLabelColor}33`,
            }}
          >
            {turnLabel}
          </div>
        </div>
      )}

      {/* ===== Special Rule Banner (2s on battle start) ===== */}
      {specialRuleBanner && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center px-6 pointer-events-none"
        >
          <div
            className="rounded-2xl px-6 py-5 max-w-md w-full text-center"
            style={{
              background: 'linear-gradient(135deg, rgba(30,25,10,0.96), rgba(45,35,12,0.96))',
              border: '2.5px solid rgba(255,215,0,0.7)',
              boxShadow: '0 0 30px rgba(255,215,0,0.45), 0 10px 40px rgba(0,0,0,0.7)',
            }}
          >
            <p className="text-[11px] font-bold mb-2" style={{ color: '#ffd700', letterSpacing: '0.15em' }}>
              ⚠️ 特殊ルール ⚠️
            </p>
            <div className="space-y-1.5">
              {specialRuleBanner.map((m, i) => (
                <p key={i} className="text-sm font-bold text-amber-100 leading-snug">{m}</p>
              ))}
            </div>
          </div>
        </div>
      )}
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
          {/* NPC speed cycle (solo only — hidden in PvP since both sides are human) */}
          {!isPvP && (
            <button
              onClick={() => setNpcSpeed((s) => (s === 1 ? 2 : s === 2 ? 3 : 1))}
              aria-label={`NPC速度 ×${npcSpeed}`}
              title="NPCのスピード (タップで切替)"
              className="font-black rounded-lg transition-all active:scale-90"
              style={{
                width: 34,
                height: 34,
                background: npcSpeed === 1 ? 'rgba(255,255,255,0.08)' : npcSpeed === 2 ? 'rgba(59,130,246,0.25)' : 'rgba(255,215,0,0.25)',
                border: `2px solid ${npcSpeed === 1 ? 'rgba(255,255,255,0.2)' : npcSpeed === 2 ? 'rgba(59,130,246,0.6)' : 'rgba(255,215,0,0.6)'}`,
                color: npcSpeed === 1 ? 'rgba(255,255,255,0.75)' : npcSpeed === 2 ? '#60a5fa' : '#ffd700',
                fontSize: '12px',
              }}
            >
              ×{npcSpeed}
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="text-center">
            <p className="text-[9px] font-bold text-amber-200/50">R</p>
            <p className="text-base font-black" style={{ color: '#ffd700', textShadow: '0 0 8px rgba(255,215,0,0.5)' }}>
              {gameState.round}/{gameState.totalRounds}
            </p>
          </div>
          {/* Trophy + Fan totals per side */}
          <div className="text-center px-2 py-1 rounded-lg" style={{ background: 'rgba(34,197,94,0.14)', border: '1.5px solid rgba(34,197,94,0.5)', boxShadow: gameState.playerFans > gameState.aiFans ? '0 0 12px rgba(255,215,0,0.3)' : 'none' }}>
            <p className="text-[9px] font-bold text-green-200/80">あなた</p>
            <p className="text-[10px] font-bold text-amber-300">{'🏆'.repeat(gameState.playerTrophies)}{gameState.playerTrophies === 0 ? '-' : ''}</p>
            <p key={`pfan-${gameState.playerFans}`} className="text-sm font-black kc-power-bounce" style={{ color: gameState.playerFans >= gameState.aiFans ? '#ffd700' : '#4ade80', textShadow: `0 0 8px ${gameState.playerFans >= gameState.aiFans ? 'rgba(255,215,0,0.6)' : 'rgba(34,197,94,0.6)'}` }}>
              ⭐{gameState.playerFans}
            </p>
          </div>
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-[10px] font-black text-amber-200/60">vs</span>
            <span className="text-[10px]" style={{ color: gameState.flagHolder === 'player' ? '#4ade80' : '#fca5a5' }}>
              🚩{gameState.flagHolder === 'player' ? '←' : '→'}
            </span>
          </div>
          <div className="text-center px-2 py-1 rounded-lg" style={{ background: 'rgba(239,68,68,0.14)', border: '1.5px solid rgba(239,68,68,0.5)', boxShadow: gameState.aiFans > gameState.playerFans ? '0 0 12px rgba(255,215,0,0.3)' : 'none' }}>
            <p className="text-[9px] font-bold text-red-200/80">相手</p>
            <p className="text-[10px] font-bold text-amber-300">{'🏆'.repeat(gameState.aiTrophies)}{gameState.aiTrophies === 0 ? '-' : ''}</p>
            <p key={`afan-${gameState.aiFans}`} className="text-sm font-black kc-power-bounce" style={{ color: gameState.aiFans > gameState.playerFans ? '#ffd700' : '#fca5a5', textShadow: `0 0 8px ${gameState.aiFans > gameState.playerFans ? 'rgba(255,215,0,0.6)' : 'rgba(239,68,68,0.6)'}` }}>
              ⭐{gameState.aiFans}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="tqw-hud-pill text-[10px]" title="あなたの山札">
            <span className="hud-label">山札</span>
            <span className="hud-value" style={{ color: '#86efac' }}>{gameState.player.deck.length}</span>
          </span>
          <span className="tqw-hud-pill text-[10px]" title="相手の山札">
            <span className="hud-label">敵</span>
            <span className="hud-value" style={{ color: '#fca5a5' }}>{gameState.ai.deck.length}</span>
          </span>
          <div className="relative">
            <span className="tqw-hud-pill tqw-hud-pill--gold text-[10px]">
              <span className="hud-label">ALT</span>
              <span className="hud-value">{altBalance !== null ? altBalance.toLocaleString() : '---'}</span>
            </span>
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
        maxSlots={gameState.stageRules?.npcBenchSlots ?? BENCH_MAX_SLOTS}
        onCardTap={setDetailCard}
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
              {/* 防御パワー数値: カード上に表示（ボックスなし） */}
              <div className={`absolute left-1/2 -translate-x-1/2 -top-10 whitespace-nowrap z-20 ${cineStep === 'defender_show' ? 'kc-defense-label' : ''}`}>
                <p style={{
                  fontSize: '20px',
                  fontWeight: 900,
                  color: gameState.defenderBonus > 0 ? '#4ade80' : gameState.defenderBonus < 0 ? '#ef4444' : '#60a5fa',
                  textShadow: '0 0 14px rgba(96,165,250,0.8), 0 2px 4px rgba(0,0,0,0.9)',
                }}>
                  🛡️ {defenderPower}
                  {gameState.defenderBonus > 0 && <span className="kc-power-bounce" style={{ color: '#4ade80' }}> +{gameState.defenderBonus}</span>}
                  {gameState.defenderBonus < 0 && <span className="kc-power-bounce" style={{ color: '#ef4444' }}> {gameState.defenderBonus}</span>}
                </p>
              </div>
              <CardDisplay card={defenderCard} size="battle" mode="defense" onTap={() => setDetailCard(defenderCard)} defBonus={gameState.defenderBonus} />
            </div>
          );
        };

        const renderAttackerSlot = () => {
          if (!shouldShowAttackPile || attackCards.length === 0) {
            // Before any reveals, show the attacker's deck top as a card back.
            return <CardBack side={attackerSide} />;
          }
          // Staircase stack: each successive card offset right + up so edges are all visible.
          const lastCard = attackCards[attackCards.length - 1];
          const lastIdx = attackCards.length - 1;
          const enterClass = attackerSide === 'ai' ? 'kc-ai-card-enter' : 'kc-player-card-enter';
          const STEP_X = 15;
          const STEP_Y = 5;
          // Extend width/height to fit the staircase spread
          const extraW = lastIdx * STEP_X;
          const extraH = lastIdx * STEP_Y;
          return (
            <div className="relative" style={{
              width: `calc(clamp(110px, 30vw, 180px) + ${extraW}px)`,
              height: `calc(clamp(154px, 42vw, 250px) + ${extraH}px)`,
            }}>
              {/* Prior cards at staircase positions (no rotation, full opacity so edges are visible).
                  On sub-battle resolve: stagger fly-out 0.2s per card, topmost first. */}
              {attackCards.slice(0, -1).map((c, i) => {
                // Stagger: topmost (highest i in slice = length-2) flies first.
                // Delay = (priorCount - 1 - i) * 0.2s
                const priorCount = attackCards.length - 1;
                const delay = attackerWonSub ? (priorCount - 1 - i) * 0.2 : 0;
                return (
                  <div key={`stack-${i}`} className={`absolute ${attackerWonSub ? 'kc-card-exile' : ''}`}
                    style={{
                      left: i * STEP_X,
                      bottom: i * STEP_Y,
                      zIndex: i + 1,
                      width: 'clamp(110px, 30vw, 180px)',
                      height: 'clamp(154px, 42vw, 250px)',
                      animationDelay: `${delay}s`,
                    }}
                  >
                    <CardDisplay card={c} size="battle" mode="attack" onTap={() => setDetailCard(c)} />
                  </div>
                );
              })}
              {/* Latest card on top with kcCardFlip animation on mount; card-hit on win */}
              <div key={`latest-${attackCards.length}`} className={`absolute ${enterClass} kc-card-float ${attackerWonSub ? 'card-hit' : ''}`} style={{
                left: lastIdx * STEP_X,
                bottom: lastIdx * STEP_Y,
                zIndex: 100,
                width: 'clamp(110px, 30vw, 180px)',
                height: 'clamp(154px, 42vw, 250px)',
              }}>
                <CardDisplay card={lastCard} size="battle" mode="attack" onTap={() => setDetailCard(lastCard)} />
                {/* Light ripple on reveal */}
                <div key={`ripple-${attackCards.length}`} className="absolute inset-0 pointer-events-none z-[105]">
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[180px] h-[180px] rounded-full"
                    style={{ border: '2px solid rgba(255,215,0,0.5)', animation: 'kcRipple 0.6s ease-out forwards' }} />
                </div>
                {/* Bonus badge: shows when effects/auras added extra power beyond base */}
                {(() => {
                  const baseAtk = lastCard.attackPower ?? lastCard.power;
                  const bonus = gameState.lastRevealPowerAdded - baseAtk;
                  if (bonus > 0) {
                    const scale = bonus >= 5 ? 1.5 : bonus >= 3 ? 1.3 : 1.2;
                    const isGold = bonus >= 5;
                    return (
                      <div key={`bonus-${attackCards.length}`} className="absolute -top-3 -right-3 z-[110] kc-power-bounce">
                        <span className="px-2 py-0.5 rounded-full font-black"
                          style={{
                            fontSize: `${12 + bonus}px`,
                            background: isGold ? 'rgba(255,215,0,0.9)' : 'rgba(34,197,94,0.9)',
                            color: '#fff',
                            boxShadow: isGold ? '0 0 12px rgba(255,215,0,0.7)' : '0 0 8px rgba(34,197,94,0.6)',
                            textShadow: '0 1px 2px rgba(0,0,0,0.5)',
                            transform: `scale(${scale})`,
                          }}>
                          +{bonus} ↑
                        </span>
                      </div>
                    );
                  } else if (bonus < 0) {
                    return (
                      <div key={`debuff-${attackCards.length}`} className="absolute -top-3 -right-3 z-[110] kc-power-bounce">
                        <span className="px-2 py-0.5 rounded-full text-sm font-black"
                          style={{ background: 'rgba(239,68,68,0.9)', color: '#fff', boxShadow: '0 0 8px rgba(239,68,68,0.6)' }}>
                          {bonus} ↓
                        </span>
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>
              {/* Cumulative attack power (number only) */}
              {(() => {
                const ratio = defenderPower > 0 ? attackPower / defenderPower : 0;
                const exceeded = defenderCard && attackPower >= defenderPower;
                const powerColor = exceeded ? '#ffd700' : ratio > 0.7 ? '#ff4444' : ratio > 0.4 ? '#ffaa00' : '#ff6b6b';
                return (
                  <div className="absolute left-1/2 -translate-x-1/2 -bottom-10 whitespace-nowrap z-[120]">
                    <p
                      key={`pow-${attackPower}`}
                      className="kc-power-bounce"
                      style={{
                        fontSize: exceeded ? '1.75rem' : '1.5rem',
                        fontWeight: 900,
                        color: powerColor,
                        textShadow: `0 0 14px ${powerColor}cc, 0 2px 4px rgba(0,0,0,0.9)`,
                      }}
                    >
                      ⚔️ {attackPower}
                    </p>
                  </div>
                );
              })()}
            </div>
          );
        };

        return (
      <div
        className={`flex-1 flex flex-col px-2 py-2 relative min-h-0 overflow-hidden ${cineStep === 'resolve' ? 'kc-screen-shake' : ''}`}
        data-stage={stageId ?? 0}
        style={{
          background: (() => {
            switch (stageId) {
              case 2: return 'linear-gradient(180deg, #0a1a0a 0%, #1a3a1a 100%)';
              case 3: return 'linear-gradient(180deg, #1a1510 0%, #2a2520 100%)';
              case 4: return 'linear-gradient(180deg, #0a0a1e 0%, #1a1a3e 100%)';
              case 5: return 'linear-gradient(180deg, #0a0a0a 0%, #1a0a1a 100%)';
              case 6: return 'linear-gradient(180deg, #0a1520 0%, #103050 100%)';
              case 7: return 'linear-gradient(180deg, #10081a 0%, #201030 100%)';
              case 8: return 'linear-gradient(180deg, #1a0a0a 0%, #3a1010 100%)';
              case 9: return 'linear-gradient(180deg, #1a1028 0%, #281840 100%)';
              case 10: return 'linear-gradient(180deg, #0a0a0a 0%, #1a1a00 100%)';
              default: return 'linear-gradient(180deg, #0a1628 0%, #162a4a 100%)';
            }
          })(),
        }}
      >
        {/* Persistent vignette: red for attack turn, blue for defense */}
        <div className={`absolute inset-0 pointer-events-none z-[1] ${playerIsDefender ? 'kc-vignette-defense' : 'kc-vignette-attack'}`} />
        {/* Stage background particles */}
        <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={`bg-p-${i}`} className="kc-bg-particle absolute rounded-full"
              style={{
                width: `${3 + (i % 3)}px`,
                height: `${3 + (i % 3)}px`,
                left: `${(i * 10.3 + 5) % 100}%`,
                top: `${(i * 13.7 + 10) % 100}%`,
                opacity: 0.3 + (i % 5) * 0.1,
                background: stageId === 10 ? '#ff4444' : stageId === 2 ? '#22c55e' : stageId === 8 ? '#ef4444' : stageId === 9 ? `hsl(${i * 36}, 80%, 60%)` : '#ffffff',
                animationDelay: `${i * 0.7}s`,
                animationDuration: `${4 + (i % 3) * 2}s`,
              }}
            />
          ))}
        </div>
        {/* Flash overlays on resolve */}
        {cineStep === 'resolve' && gameState.lastSubBattle?.winner === 'ai' && (
          <div className="absolute inset-0 pointer-events-none z-30 kc-red-flash" />
        )}
        {cineStep === 'resolve' && gameState.lastSubBattle?.winner === 'player' && (
          <>
            <div className="absolute inset-0 pointer-events-none z-30 kc-gold-flash" />
            {/* Shockwave */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[32]">
              <div className="kc-shockwave" style={{ width: 100, height: 100 }} />
            </div>
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

        {/* Manual/Auto toggle + Skip button + Exile indicator */}
        {gameState.phase !== 'deck_phase' && gameState.phase !== 'game_over' && (
          <div
            className="absolute top-1 right-2 z-50 flex flex-wrap justify-end gap-1.5"
            style={{ maxWidth: 'calc(100vw - 16px)' }}
          >
            <button
              onClick={() => setManualMode((p) => !p)}
              className="text-[11px] font-black px-3 py-1.5 rounded-lg"
              style={{
                background: manualMode ? 'rgba(34,197,94,0.2)' : 'rgba(59,130,246,0.2)',
                border: `1.5px solid ${manualMode ? 'rgba(34,197,94,0.5)' : 'rgba(59,130,246,0.5)'}`,
                color: manualMode ? 'rgba(34,197,94,0.9)' : 'rgba(59,130,246,0.9)',
              }}
            >
              {manualMode ? '\uD83D\uDD90\uFE0F \u624B\u52D5' : '\u25B6\uFE0F \u81EA\u52D5'}
            </button>
            <button
              onClick={handleSkipReveal}
              className="text-[11px] font-black px-3 py-1.5 rounded-lg"
              style={{
                background: 'rgba(255,255,255,0.12)',
                border: '1.5px solid rgba(255,255,255,0.3)',
                color: 'rgba(255,255,255,0.85)',
              }}
            >
              ⏭ スキップ
            </button>
            {/* Exile zone indicator — always visible during battle
                spec v7: 自/敵の除外数を色分けで常時表示。タップでモーダル展開。 */}
            <button
              onClick={() => setShowExile(true)}
              className="text-[11px] font-black px-2.5 py-1.5 rounded-lg flex items-center gap-1"
              style={{ background: 'rgba(168,85,247,0.22)', border: '1.5px solid rgba(168,85,247,0.55)' }}
              title="除外ゾーン（タップで内容を確認）"
            >
              <span>🚫</span>
              <span style={{ color: '#4ade80' }}>自{gameState.exile.player.length}</span>
              <span style={{ color: 'rgba(168,85,247,0.5)' }}>/</span>
              <span style={{ color: '#f87171' }}>敵{gameState.exile.ai.length}</span>
            </button>
          </div>
        )}

        {/* ====== Field Info HUD (top-left, always visible during battle) ====== */}
        {gameState.phase !== 'deck_phase' && gameState.phase !== 'game_over' && (() => {
          const benchMax = gameState.stageRules?.benchLimit ?? BENCH_MAX_SLOTS;
          const aiBenchMax = gameState.stageRules?.npcBenchSlots ?? BENCH_MAX_SLOTS;
          const p1Label = isPvP && pvpSession ? pvpSession.player1.childName : '自';
          const p2Label = isPvP && pvpSession ? pvpSession.player2.childName : '敵';
          const p1Color = isPvP ? '#ef4444' : '#22c55e';
          const p2Color = isPvP ? '#3b82f6' : '#ef4444';
          // Warning thresholds
          const deckDangerous = (n: number) => n <= 3;
          const deckCritical = (n: number) => n <= 1;
          const benchNearFull = (n: number, max: number) => n >= max - 1 && n < max;
          const p1DeckN = gameState.player.deck.length;
          const p2DeckN = gameState.ai.deck.length;
          const p1BenchN = gameState.player.bench.length;
          const p2BenchN = gameState.ai.bench.length;
          const hudPill = (label: string, content: string, color: string, warn?: 'red' | 'yellow') => (
            <div
              className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md ${warn ? 'kc-hud-pulse' : ''}`}
              style={{
                background: warn === 'red' ? 'rgba(239,68,68,0.25)' : warn === 'yellow' ? 'rgba(234,179,8,0.25)' : `${color}22`,
                border: warn === 'red' ? '1.5px solid rgba(239,68,68,0.7)' : warn === 'yellow' ? '1.5px solid rgba(234,179,8,0.7)' : `1px solid ${color}55`,
                fontSize: '9px',
              }}
            >
              <span className="font-bold" style={{ color: warn === 'red' ? '#fca5a5' : warn === 'yellow' ? '#fde047' : color }}>{label}</span>
              <span className="font-black text-amber-100">{content}</span>
            </div>
          );
          const flagHolderName = isPvP && pvpSession
            ? (gameState.flagHolder === 'player' ? pvpSession.player1.childName : pvpSession.player2.childName)
            : (gameState.flagHolder === 'player' ? 'あなた' : '相手');
          const flagColor = isPvP
            ? (gameState.flagHolder === 'player' ? '#ef4444' : '#3b82f6')
            : (gameState.flagHolder === 'player' ? '#22c55e' : '#ef4444');
          return (
            <div className="absolute top-1 left-2 z-50 flex flex-col gap-1">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setShowBattleLog(true)}
                  aria-label="バトルログ"
                  className="w-8 h-8 rounded-lg flex items-center justify-center active:scale-90 transition-transform"
                  style={{ background: 'rgba(255,215,0,0.15)', border: '1.5px solid rgba(255,215,0,0.4)', fontSize: '16px' }}
                >
                  📋
                </button>
                {/* Flag holder pill — flashes briefly on takeover via `kc-flag-flash` */}
                <div
                  key={`flag-${gameState.flagHolder}`}
                  className="kc-flag-flash flex items-center gap-1 px-2 py-1 rounded-lg"
                  style={{
                    background: `${flagColor}33`,
                    border: `1.5px solid ${flagColor}aa`,
                    fontSize: '11px',
                    fontWeight: 900,
                    color: flagColor,
                    whiteSpace: 'nowrap',
                  }}
                >
                  <span>🏆</span>
                  <span>{flagHolderName}</span>
                </div>
              </div>
              <div className="flex flex-col gap-0.5">
                {/* P2 (opponent) row */}
                <div className="flex items-center gap-1">
                  {hudPill(p2Label, `🂠${p2DeckN}`, p2Color, deckCritical(p2DeckN) ? 'red' : deckDangerous(p2DeckN) ? 'yellow' : undefined)}
                  {hudPill('', `🎴${p2BenchN}/${aiBenchMax}`, p2Color, benchNearFull(p2BenchN, aiBenchMax) ? 'yellow' : undefined)}
                  {/* 除外数（相手）— 右上ボタンが overflow した時の冗長表示 */}
                  <button
                    onClick={() => setShowExile(true)}
                    className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md active:scale-95 transition-transform"
                    style={{ background: 'rgba(168,85,247,0.22)', border: '1px solid rgba(168,85,247,0.55)', fontSize: 9 }}
                    aria-label="敵の除外ゾーン"
                  >
                    <span className="font-bold" style={{ color: '#c4b5fd' }}>🚫</span>
                    <span className="font-black" style={{ color: '#f87171' }}>{gameState.exile.ai.length}</span>
                  </button>
                </div>
                {/* P1 (self) row */}
                <div className="flex items-center gap-1">
                  {hudPill(p1Label, `🂠${p1DeckN}`, p1Color, deckCritical(p1DeckN) ? 'red' : deckDangerous(p1DeckN) ? 'yellow' : undefined)}
                  {hudPill('', `🎴${p1BenchN}/${benchMax}`, p1Color, benchNearFull(p1BenchN, benchMax) ? 'yellow' : undefined)}
                  {/* 除外数（自分）— タップでモーダル展開、バトル中常時表示 */}
                  <button
                    onClick={() => setShowExile(true)}
                    className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md active:scale-95 transition-transform"
                    style={{ background: 'rgba(168,85,247,0.22)', border: '1px solid rgba(168,85,247,0.55)', fontSize: 9 }}
                    aria-label="自分の除外ゾーン"
                  >
                    <span className="font-bold" style={{ color: '#c4b5fd' }}>🚫</span>
                    <span className="font-black" style={{ color: '#4ade80' }}>{gameState.exile.player.length}</span>
                  </button>
                </div>
              </div>
              {/* Last-card big warning for whichever side is attacker */}
              {(() => {
                const atkSide: 'player' | 'ai' = gameState.flagHolder === 'player' ? 'ai' : 'player';
                const atkDeck = atkSide === 'player' ? p1DeckN : p2DeckN;
                if (atkDeck !== 1) return null;
                const name = isPvP && pvpSession
                  ? (atkSide === 'player' ? pvpSession.player1.childName : pvpSession.player2.childName)
                  : (atkSide === 'player' ? '自' : '相手');
                return (
                  <div
                    className="kc-hud-pulse px-2 py-0.5 rounded-md mt-0.5 self-start"
                    style={{
                      background: 'rgba(239,68,68,0.3)',
                      border: '1.5px solid #ef4444',
                      color: '#fca5a5',
                      fontSize: '10px',
                      fontWeight: 900,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    ⚠️ {name}ラストカード
                  </div>
                );
              })()}
            </div>
          );
        })()}

        {/* ====== Turn-End Button (big, right-edge)
             Visible throughout the human attacker's turn (cineStep=attack_reveal),
             EXCEPT while the card preview is open — then only the preview
             buttons ('出す' / '発動する') are shown. Works both:
             - During deck-tap wait (player deciding to draw next card)
             - Between reveals (after commit, before next draw)
             z-[180] sits above transient overlays (vignettes, small telops) but
             below modal overlays (preview z-250, log z-300, exile z-250). */}
        {(() => {
          const showTurnEnd =
            cineStep === 'attack_reveal' &&
            (isPvP || gameState.flagHolder === 'ai') &&
            !attackPreview;
          if (!showTurnEnd) return null;
          const timerOn = isPvP && turnEndTimer !== null;
          const ratio = timerOn ? (turnEndTimer! / 15) : 1;
          const R = 34;
          const C = 2 * Math.PI * R;
          const offset = C * (1 - ratio);
          const urgent = timerOn && turnEndTimer! <= 5;
          return (
            <div
              // z-[1200] sits above CardSelectOverlay (1100), cutinCard (1000),
              // and comboName (175) so the button stays tappable throughout
              // the entire attack_reveal phase, including effect演出.
              className="fixed z-[1200] flex items-center justify-center"
              style={{ right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'auto' }}
            >
              <div className="relative flex items-center justify-center" style={{ width: 80, height: 80 }}>
                {/* Countdown ring (PvP only) */}
                {timerOn && (
                  <svg
                    className="absolute inset-0"
                    width={80}
                    height={80}
                    style={{ transform: 'rotate(-90deg)' }}
                  >
                    <circle cx={40} cy={40} r={R} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth={4} />
                    <circle
                      cx={40}
                      cy={40}
                      r={R}
                      fill="none"
                      stroke={urgent ? '#ef4444' : '#ffd700'}
                      strokeWidth={4}
                      strokeLinecap="round"
                      strokeDasharray={C}
                      strokeDashoffset={offset}
                      style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.2s' }}
                    />
                  </svg>
                )}
                <button
                  onClick={handleForfeitAttack}
                  aria-label="ターン終了"
                  className="rounded-full flex flex-col items-center justify-center active:scale-90 transition-transform"
                  style={{
                    width: 66,
                    height: 66,
                    background: urgent
                      ? 'linear-gradient(135deg, #ef4444, #b91c1c)'
                      : 'linear-gradient(135deg, rgba(239,68,68,0.85), rgba(185,28,28,0.85))',
                    border: '2px solid rgba(255,255,255,0.35)',
                    boxShadow: urgent
                      ? '0 0 18px rgba(239,68,68,0.8), 0 4px 12px rgba(0,0,0,0.5)'
                      : '0 0 12px rgba(239,68,68,0.4), 0 4px 12px rgba(0,0,0,0.5)',
                    color: '#fff',
                  }}
                >
                  <span style={{ fontSize: 18, lineHeight: 1 }}>🏁</span>
                  <span style={{ fontSize: 10, fontWeight: 900, marginTop: 2, lineHeight: 1 }}>ターン</span>
                  <span style={{ fontSize: 10, fontWeight: 900, lineHeight: 1 }}>終了</span>
                  {timerOn && (
                    <span style={{ fontSize: 9, marginTop: 1, opacity: 0.9, lineHeight: 1 }}>
                      {turnEndTimer}s
                    </span>
                  )}
                </button>
              </div>
            </div>
          );
        })()}

        {/* ====== Attack Preview Overlay — 3D tilt + swipe-up to play ====== */}
        {attackPreview && (() => {
          const card = attackPreview.card;
          const hasAutoEffect = !!card.effect && !attackPreview.optionalEffect;
          const effectText = card.effect?.description ?? null;
          const effectName = card.effect?.name ?? null;
          const optional = attackPreview.optionalEffect;
          const playLabel = optional
            ? '⬆️ 上にスワイプで発動'
            : '⬆️ 上にスワイプで出す';
          const playButtonLabel = optional ? '✨ 発動する' : '⚔️ 出す';

          const subActions = (
            <div className="flex flex-col items-center gap-2 mt-2" style={{ width: 'min(80vw, 340px)' }}>
              {effectText && (
                <div
                  className="rounded-xl px-3 py-2.5 text-center w-full"
                  style={{
                    background: 'rgba(0,0,0,0.65)',
                    border: `1.5px solid ${optional ? 'rgba(255,215,0,0.55)' : 'rgba(255,215,0,0.35)'}`,
                    boxShadow: optional ? '0 0 14px rgba(255,215,0,0.18)' : 'none',
                  }}
                >
                  <p className="font-black mb-1" style={{ color: '#ffd700', fontSize: 13, letterSpacing: 0.5 }}>
                    ✨ 効果{effectName ? `: ${effectName}` : ''}
                    {!optional && hasAutoEffect ? ' (自動)' : ''}
                  </p>
                  <p className="font-medium leading-snug" style={{ color: '#ffffff', fontSize: 14 }}>
                    {effectText}
                  </p>
                </div>
              )}
              {optional && (
                <button
                  onClick={(e) => { e.stopPropagation(); playTap(); handlePreviewChoice(true); }}
                  className="tappable rounded-lg font-bold"
                  style={{
                    width: '55%',
                    minHeight: 36,
                    background: 'rgba(255,255,255,0.1)',
                    border: '1px solid rgba(255,255,255,0.22)',
                    color: 'rgba(255,255,255,0.75)',
                    fontSize: 12,
                  }}
                >
                  そのまま出す
                </button>
              )}
            </div>
          );

          return (
            <CardPreviewOverlay
              onPlay={() => handlePreviewChoice(false)}
              playLabel={playLabel}
              playButtonLabel={playButtonLabel}
              subActions={subActions}
            >
              {/* Full-aspect 360x500 preview — no cropping */}
              <div className="w-full h-full relative rounded-xl overflow-hidden"
                style={{ background: '#0b1128', boxShadow: '0 6px 22px rgba(0,0,0,0.5)' }}>
                {card.imageUrl && (
                  <img
                    src={card.imageUrl}
                    alt={card.name}
                    className="absolute inset-0 w-full h-full"
                    style={{ objectFit: 'cover', objectPosition: 'center center' }}
                    draggable={false}
                  />
                )}
                <img
                  src={CARD_RARITY_IMAGES[card.rarity] || CARD_RARITY_IMAGES['N']}
                  alt=""
                  className="absolute inset-0 w-full h-full pointer-events-none"
                  style={{ objectFit: 'fill' }}
                />
                {/* Card name */}
                <div className="absolute left-0 right-0 bottom-[14%] px-3 text-center pointer-events-none">
                  <span className="font-bold text-white text-sm truncate block"
                    style={{ textShadow: '0 1px 3px rgba(0,0,0,0.9)' }}>
                    {card.name}
                  </span>
                </div>
                {/* ATK / DEF badges */}
                <div className="absolute left-2 bottom-2 px-2 py-0.5 rounded font-black text-white text-xs pointer-events-none"
                  style={{ background: 'rgba(239,68,68,0.85)' }}>
                  ⚔️ {card.attackPower ?? card.power}
                </div>
                <div className="absolute right-2 bottom-2 px-2 py-0.5 rounded font-black text-white text-xs pointer-events-none"
                  style={{ background: 'rgba(59,130,246,0.85)' }}>
                  🛡️ {card.defensePower ?? card.power}
                </div>
                {/* Rarity badge */}
                <div className="absolute left-2 top-2 px-1.5 py-0.5 rounded font-black text-[10px] pointer-events-none"
                  style={{
                    background: card.rarity === 'SSR' ? '#ffd700' : card.rarity === 'SR' ? '#a855f7' : card.rarity === 'R' ? '#3b82f6' : '#9ca3af',
                    color: '#0b1128',
                  }}>
                  {card.rarity}
                </div>
              </div>
            </CardPreviewOverlay>
          );
        })()}

        {/* ====== Battle Log Overlay ====== */}
        {showBattleLog && (
          <div
            className="fixed inset-0 z-[300] flex items-end justify-start p-4"
            style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)' }}
            onClick={() => setShowBattleLog(false)}
          >
            <div
              className="rounded-2xl p-4 w-full max-w-xs"
              style={{
                background: 'linear-gradient(135deg, rgba(21,29,59,0.98), rgba(14,20,45,0.98))',
                border: '2px solid rgba(255,215,0,0.5)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
                maxHeight: '70vh',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-bold" style={{ color: '#ffd700' }}>📋 バトルログ</p>
                <button
                  onClick={() => setShowBattleLog(false)}
                  className="w-6 h-6 rounded-full flex items-center justify-center active:scale-90"
                  style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)', fontSize: '12px' }}
                >
                  ✕
                </button>
              </div>
              <div className="space-y-1.5 overflow-y-auto" style={{ maxHeight: 'calc(70vh - 60px)' }}>
                {battleLog.length === 0 ? (
                  <p className="text-[11px] text-amber-200/40 text-center py-4">（ログなし）</p>
                ) : (
                  battleLog.map((entry, i) => (
                    <div
                      key={i}
                      className="text-[11px] px-2 py-1.5 rounded-md text-amber-100/90"
                      style={{
                        background: i === 0 ? 'rgba(255,215,0,0.08)' : 'rgba(255,255,255,0.04)',
                        border: i === 0 ? '1px solid rgba(255,215,0,0.3)' : '1px solid rgba(255,255,255,0.06)',
                      }}
                    >
                      {entry}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* ====== AI AREA (top half) ======
             Layout: [AI card center] [AI deck stack right]
             In PvP the top side is P2 — tappable when P2 is the attacker. */}
        <div className="flex-1 flex items-center justify-center gap-4 relative px-4">
          {playerIsDefender ? renderAttackerSlot() : renderDefenderSlot()}
          {(() => {
            const aiDeckTappable = (isPvP || manualMode) && waitingForPlayerReveal && playerIsDefender && cineStep === 'attack_reveal';
            // P2 is blue in PvP; keep red for solo NPC.
            const aiColor = isPvP ? '#3b82f6' : '#ef4444';
            const tapHint = isPvP && pvpSession
              ? `${pvpSession.player2.childName} タップでめくる`
              : 'タップでめくる';
            return (
              <div id="kc-ai-deck-anchor" className="flex flex-col items-center gap-1 relative">
                {aiDeckTappable && (
                  <div className="kc-tap-hint absolute -top-5 left-1/2 -translate-x-1/2 z-10" style={{ fontSize: '20px' }}>
                    👆
                  </div>
                )}
                <MiniDeckStack
                  count={gameState.ai.deck.length}
                  color={aiColor}
                  interactive={aiDeckTappable}
                  glow={aiDeckTappable}
                  onTap={handleAdvance}
                />
              </div>
            );
          })()}
        </div>

        {/* ====== POWER GAUGE BAR ====== */}
        {shouldShowAttackPile && attackCards.length > 0 && defenderCard && (
          <div className="px-4 py-1 relative">
            <div className="relative h-6 rounded-full overflow-hidden"
              style={{
                background: 'rgba(10, 10, 30, 0.7)',
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              {/* Gauge fill */}
              <div
                className={`absolute inset-y-0 left-0 rounded-full transition-all duration-400 ease-out ${
                  defenderPower > 0 && attackPower / defenderPower >= 0.8 ? 'kc-gauge-shake' : ''
                }`}
                style={{
                  width: `${Math.min(100, defenderPower > 0 ? (attackPower / defenderPower) * 100 : 0)}%`,
                  background: (() => {
                    const ratio = defenderPower > 0 ? attackPower / defenderPower : 0;
                    if (ratio >= 1) return 'linear-gradient(90deg, #ffd700, #ffaa00)';
                    if (ratio >= 0.8) return 'linear-gradient(90deg, #ef4444, #ff6b6b)';
                    if (ratio >= 0.6) return 'linear-gradient(90deg, #eab308, #fbbf24)';
                    return 'linear-gradient(90deg, #3b82f6, #60a5fa)';
                  })(),
                  boxShadow: (() => {
                    const ratio = defenderPower > 0 ? attackPower / defenderPower : 0;
                    if (ratio >= 1) return '0 0 16px rgba(255,215,0,0.6)';
                    if (ratio >= 0.8) return '0 0 12px rgba(239,68,68,0.5)';
                    return 'none';
                  })(),
                  transition: 'width 0.4s ease-out, background 0.3s',
                }}
              />
              {/* Labels */}
              <div className="absolute inset-0 flex items-center justify-between px-3 z-10">
                <span className="text-xs font-black text-white" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.9)' }}>
                  ⚔️ {attackPower}
                </span>
                <span className="text-xs font-black text-white" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.9)' }}>
                  🛡️ {defenderPower}
                </span>
              </div>
            </div>
            {/* BREAK flash when attack exceeds defense */}
            {attackPower >= defenderPower && attackPower > 0 && (
              <div key={`break-${attackCards.length}`} className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                <span className="kc-stamp-in font-black" style={{
                  fontSize: '28px',
                  color: '#ffd700',
                  textShadow: '0 0 20px rgba(255,215,0,0.8), 0 2px 4px rgba(0,0,0,0.9)',
                  letterSpacing: '4px',
                }}>
                  BREAK!
                </span>
              </div>
            )}
          </div>
        )}

        {/* ====== CENTER BAND (slim divider; flag moved to HUD) ====== */}
        <div className="flex items-center justify-center gap-2 py-1 relative min-h-[16px]">
          <div className="h-0.5 flex-1" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,215,0,0.35))' }} />
          <div className="h-0.5 flex-1" style={{ background: 'linear-gradient(90deg, rgba(255,215,0,0.35), transparent)' }} />
          {showManualAdvance && (
            <p className="absolute -bottom-4 left-1/2 -translate-x-1/2 whitespace-nowrap text-[9px] font-bold text-amber-200/70 animate-pulse z-50">
              タップで続ける
            </p>
          )}
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
                <div className="relative flex flex-col items-center">
                  {tappable && (
                    <div className="kc-tap-hint absolute -top-5 left-1/2 -translate-x-1/2 z-10" style={{ fontSize: '20px' }}>
                      👆
                    </div>
                  )}
                  <MiniDeckStack
                    count={gameState.player.deck.length}
                    color={isPvP ? '#ef4444' : '#22c55e'}
                    interactive={tappable}
                    glow={tappable}
                    onTap={handleAdvance}
                  />
                </div>
                {/* Inline forfeit removed — replaced by the big right-edge "ターン終了" button */}
                {!tappable && playerIsAttacker && (
                  <p className="text-[10px] font-bold text-amber-200/50">
                    {isPvP && pvpSession ? `${pvpSession.player1.childName}の山札` : 'あなたの山札'}
                  </p>
                )}
              </div>
            );
          })()}
          {playerIsDefender ? renderDefenderSlot() : renderAttackerSlot()}
        </div>


        {/* ====== Turn Vignette (replaces text banner) ====== */}
        {cineStep === 'turn_banner' && (
          <div className="absolute inset-0 pointer-events-none z-40 kc-vignette-in" style={{
            boxShadow: playerIsDefender
              ? 'inset 0 0 120px 40px rgba(59,130,246,0.35)'
              : 'inset 0 0 120px 40px rgba(239,68,68,0.35)',
          }} />
        )}

        {/* ====== Resolve: fan count popup only (no text box) ====== */}
        {cineStep === 'resolve' && gameState.lastSubBattle && (() => {
          const playerWon = gameState.lastSubBattle.winner === 'player';
          const earnedFans = gameState.lastSubBattle.defeatFans ?? 0;
          // Spec (8): no large central banners. Show fan delta as a small tag
          // near the flag, not a full-screen popup.
          return (
            <div className="absolute left-0 right-0 top-[50%] -translate-y-1/2 flex items-center justify-center pointer-events-none z-40 kc-effect-micro">
              <p className="font-black" style={{
                fontSize: '16px',
                color: playerWon ? '#ffd700' : '#ef4444',
                textShadow: `0 0 12px ${playerWon ? 'rgba(255,215,0,0.7)' : 'rgba(239,68,68,0.7)'}, 0 1px 4px rgba(0,0,0,0.9)`,
              }}>
                {playerWon ? `⭐ +${earnedFans}` : `⭐ -${earnedFans}`}
              </p>
            </div>
          );
        })()}

        {/* ====== Turn Transition: vignette color shift (no text) ====== */}
        {cineStep === 'turn_transition' && (
          <div className="absolute inset-0 pointer-events-none z-40 kc-vignette-in" style={{
            boxShadow: playerIsDefender
              ? 'inset 0 0 100px 30px rgba(239,68,68,0.25)'
              : 'inset 0 0 100px 30px rgba(34,197,94,0.25)',
          }} />
        )}

        {/* ====== Round End: ROUND CLEAR stamp + confetti (no text box) ====== */}
        {cineStep === 'round_end' && gameState.phase === 'round_end' && (() => {
          const playerWonRound = gameState.roundWinner === 'player';
          const trophyFanBonus = gameState.trophyFans[gameState.round - 1] ?? 0;
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
              {/* Stamp-in: ROUND CLEAR or defeat icon */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-40">
                <div className="text-center">
                  <p className="kc-stamp-in" style={{
                    fontSize: playerWonRound ? '42px' : '36px',
                    fontWeight: 900,
                    color: playerWonRound ? '#ffd700' : '#ef4444',
                    textShadow: `0 0 30px ${playerWonRound ? 'rgba(255,215,0,0.8)' : 'rgba(239,68,68,0.8)'}, 0 4px 8px rgba(0,0,0,0.9)`,
                    letterSpacing: '4px',
                  }}>
                    {playerWonRound ? 'ROUND CLEAR!' : 'ROUND LOST'}
                  </p>
                  <p className="kc-fan-count mt-2" style={{
                    fontSize: '24px',
                    fontWeight: 900,
                    color: playerWonRound ? '#4ade80' : '#fca5a5',
                    textShadow: '0 2px 6px rgba(0,0,0,0.9)',
                  }}>
                    {playerWonRound ? `⭐ +${trophyFanBonus}` : `⭐ -${trophyFanBonus}`}
                  </p>
                </div>
              </div>
            </>
          );
        })()}

        {/* ====== game_over: stamp + confetti + finisher card ====== */}
        {gameState.phase === 'game_over' && (() => {
          const won = gameState.winner === 'player';
          const finisher = won ? lastPlayerCardRef.current : null;
          return (
            <>
              <div
                className="absolute inset-0 pointer-events-none z-40 kc-final-overlay"
                style={{
                  background: won
                    ? 'radial-gradient(circle, rgba(255,215,0,0.45), rgba(0,0,0,0.35))'
                    : 'linear-gradient(180deg, rgba(0,0,0,0.75), rgba(10,5,15,0.88))',
                }}
              />
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
                <div className="text-center px-4">
                  {/* YOU WIN / DEFEAT title */}
                  <p className="kc-stamp-in" style={{
                    fontSize: won ? '48px' : '42px',
                    fontWeight: 900,
                    color: won ? '#ffd700' : '#9ca3af',
                    textShadow: won
                      ? '0 0 36px rgba(255,215,0,1), 0 0 72px rgba(255,215,0,0.6), 0 4px 12px rgba(0,0,0,0.9)'
                      : '0 0 28px rgba(156,163,175,0.7), 0 4px 12px rgba(0,0,0,0.9)',
                    letterSpacing: '6px',
                  }}>
                    {won ? 'YOU WIN!' : 'DEFEAT'}
                  </p>

                  {/* Finisher card (victory only) */}
                  {won && finisher && (
                    <div className="mt-3 flex flex-col items-center">
                      <div
                        className="relative holo-sheen"
                        style={{
                          width: '150px',
                          height: '200px',
                          perspective: '700px',
                          animation: 'finisherEntrance 0.6s ease-out both',
                        }}
                      >
                        <div
                          style={{
                            width: '100%',
                            height: '100%',
                            borderRadius: '12px',
                            overflow: 'hidden',
                            position: 'relative',
                            transform: 'rotateY(-4deg) rotateX(2deg)',
                            boxShadow: '0 0 40px rgba(255,215,0,0.5), 0 8px 32px rgba(0,0,0,0.6)',
                          }}
                        >
                          {/* Card image (always face up) */}
                          {finisher.imageUrl ? (
                            <img
                              src={finisher.imageUrl}
                              alt={finisher.name}
                              className="absolute inset-0 w-full h-full object-cover"
                              style={{ zIndex: 1 }}
                            />
                          ) : (
                            <div className="absolute inset-0 bg-gray-800" style={{ zIndex: 1 }} />
                          )}
                          {/* Rarity frame overlay */}
                          <img
                            src={CARD_RARITY_IMAGES[finisher.rarity] || CARD_RARITY_IMAGES['N']}
                            alt=""
                            className="absolute inset-0 w-full h-full pointer-events-none"
                            style={{ objectFit: 'fill', zIndex: 2 }}
                          />
                          {/* Card name */}
                          <span
                            className="absolute left-0 right-0 text-center font-bold text-white truncate px-1"
                            style={{ bottom: '12px', fontSize: '11px', textShadow: '0 1px 4px rgba(0,0,0,0.95)', zIndex: 3 }}
                          >
                            {finisher.name}
                          </span>
                          {/* Stats */}
                          <span
                            className="absolute font-bold text-white"
                            style={{ bottom: '28px', left: '8px', fontSize: '10px', textShadow: '0 1px 3px rgba(0,0,0,0.9)', zIndex: 3 }}
                          >
                            {'⚔️'}{finisher.attackPower ?? finisher.power}
                          </span>
                          <span
                            className="absolute font-bold text-white"
                            style={{ bottom: '28px', right: '8px', fontSize: '10px', textShadow: '0 1px 3px rgba(0,0,0,0.9)', zIndex: 3 }}
                          >
                            {'🛡️'}{finisher.defensePower ?? finisher.power}
                          </span>
                        </div>
                      </div>

                      {/* "フィニッシャー!" telop */}
                      <p style={{
                        marginTop: '10px',
                        fontSize: '22px',
                        fontWeight: 900,
                        background: 'linear-gradient(90deg, #ffd700, #fff4a3, #ffd700)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        textShadow: 'none',
                        filter: 'drop-shadow(0 2px 6px rgba(255,215,0,0.6))',
                        letterSpacing: '4px',
                        animation: 'finisherTextFadeIn 0.8s 0.4s ease-out both',
                      }}>
                        {'フィニッシャー!'}
                      </p>
                    </div>
                  )}

                  {/* Defeat icon */}
                  {!won && <span className="text-7xl block mt-3 kc-final-icon">{'💀'}</span>}

                  {/* Trophy + Fan display */}
                  <p className="mt-2 font-black" style={{
                    fontSize: '16px',
                    color: won ? '#fde047' : '#d1d5db',
                    textShadow: '0 2px 8px rgba(0,0,0,0.85)',
                  }}>
                    {'🏆'.repeat(gameState.playerTrophies)} ⭐{gameState.playerFans} vs {'🏆'.repeat(gameState.aiTrophies)} ⭐{gameState.aiFans}
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
        maxSlots={gameState.stageRules?.benchLimit ?? BENCH_MAX_SLOTS}
        onCardTap={setDetailCard}
      />

      {/* Full-screen tap overlay for manual advance */}
      {showManualAdvance && (cineStep === 'turn_banner' || cineStep === 'turn_transition' || cineStep === 'resolve' || cineStep === 'defender_show') && (
        <div
          className="fixed inset-0 z-[55] cursor-pointer"
          onClick={handleAdvance}
        />
      )}

      {/* ===== Round victory celebration ===== */}
      {roundVictoryTelop && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center pointer-events-none">
          <div className="absolute inset-0 kc-gold-flash" />
          {/* Confetti */}
          <div className="absolute inset-0 overflow-hidden">
            {Array.from({ length: 30 }).map((_, i) => (
              <span
                key={`rv-confetti-${i}`}
                className="kc-confetti-piece"
                style={{
                  left: `${(i * 3.3 + 2) % 100}%`,
                  background: ['#ffd700', '#ff6b6b', '#4ade80', '#60a5fa', '#f5d76e'][i % 5],
                  animationDelay: `${(i % 8) * 0.1}s`,
                  animationDuration: '2s',
                }}
              />
            ))}
          </div>
          {/* Big telop */}
          <div className="kc-round-victory-telop">
            <p className="kc-stamp-in" style={{
              fontSize: '48px',
              fontWeight: 900,
              color: '#ffd700',
              textShadow: '0 0 30px rgba(255,215,0,0.8), 0 0 60px rgba(255,215,0,0.4), 0 4px 8px rgba(0,0,0,0.9)',
              letterSpacing: '4px',
            }}>
              {roundVictoryTelop}
            </p>
          </div>
        </div>
      )}

      {/* ===== Exile Zone Overlay ===== */}
      {showExile && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.8)' }} onClick={() => setShowExile(false)}>
          <div className="rounded-2xl p-4 w-full max-w-sm max-h-[70vh] overflow-y-auto" style={{
            background: 'linear-gradient(135deg, rgba(30,10,50,0.98), rgba(15,5,25,0.98))',
            border: '2px solid rgba(168,85,247,0.5)',
          }} onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-black mb-3" style={{ color: '#a855f7' }}>🚫 除外されたカード</h3>
            {(['player', 'ai'] as const).map((side) => {
              const cards = gameState.exile[side];
              if (cards.length === 0) return null;
              return (
                <div key={side} className="mb-3">
                  <p className="text-xs font-bold mb-1" style={{ color: side === 'player' ? '#22c55e' : '#ef4444' }}>
                    {side === 'player' ? 'あなた' : '相手'} ({cards.length}枚)
                  </p>
                  <div className="grid grid-cols-4 gap-1.5">
                    {cards.map((c, i) => (
                      <div key={i} className="text-center" style={{ opacity: 0.5, filter: 'grayscale(0.7)' }}>
                        <div className="rounded-md overflow-hidden" style={{ border: '1px solid rgba(168,85,247,0.3)' }}>
                          {c.imageUrl ? <img src={c.imageUrl} alt={c.name} className="w-full aspect-[3/4] object-cover" /> : <div className="w-full aspect-[3/4] bg-purple-900/30" />}
                        </div>
                        <p className="text-[8px] text-purple-200/60 truncate mt-0.5">{c.name}</p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
            <button onClick={() => setShowExile(false)} className="w-full py-2 rounded-lg text-sm font-bold mt-2"
              style={{ background: 'rgba(168,85,247,0.15)', border: '1px solid rgba(168,85,247,0.3)', color: 'rgba(168,85,247,0.8)' }}>
              閉じる
            </button>
          </div>
        </div>
      )}

      {/* ===== Card Select Overlay (shared by multiple effects) ===== */}
      {cardSelectOverlay && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.85)' }}>
          <div className="rounded-2xl p-4 md:p-8 w-full max-w-sm md:max-w-3xl" style={{
            background: 'linear-gradient(135deg, rgba(21,29,59,0.98), rgba(14,20,45,0.98))',
            border: '2px solid rgba(255,215,0,0.4)',
            boxShadow: '0 0 24px rgba(255,215,0,0.2)',
          }}>
            <h3 className="text-base md:text-2xl font-black text-amber-100 mb-3 md:mb-6 text-center">{cardSelectOverlay.title}</h3>
            <div className="grid grid-cols-3 gap-2 md:gap-5 mb-3 md:mb-6">
              {cardSelectOverlay.cards.map((c, i) => (
                <button key={i} onClick={() => cardSelectOverlay.onSelect(c)}
                  className="rounded-lg p-1 md:p-3 active:scale-95 transition-transform"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1.5px solid rgba(255,215,0,0.3)' }}>
                  <div className="rounded-md overflow-hidden mb-0.5 md:mb-2" style={{ aspectRatio: '3/4' }}>
                    {c.imageUrl ? <img src={c.imageUrl} alt={c.name} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-gray-800" />}
                  </div>
                  <p className="text-[9px] md:text-base font-bold text-amber-100 truncate">{c.name}</p>
                  <p className="text-[8px] md:text-sm text-amber-200/50">⚔️{c.attackPower ?? c.power} 🛡️{c.defensePower ?? c.power}</p>
                </button>
              ))}
            </div>
            <button onClick={() => cardSelectOverlay.onSelect(null)}
              className="w-full py-3 md:py-5 rounded-lg text-sm md:text-lg font-bold"
              style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.6)', minHeight: '48px' }}>
              使わない
            </button>
          </div>
        </div>
      )}

      {/* ===== Bench Overflow Defeat ===== */}
      {benchOverflowBanner && (
        <>
          {/* Red screen flash */}
          <div
            className="fixed inset-0 z-[900] pointer-events-none"
            style={{ animation: 'kcDefeatFlash 0.5s ease-out forwards' }}
          />
          {/* Defeat banner */}
          <div className="fixed inset-0 z-[950] flex items-center justify-center pointer-events-none px-4">
            <div
              className="rounded-2xl px-6 py-5 text-center"
              style={{
                background: 'linear-gradient(135deg, rgba(127,29,29,0.95), rgba(69,10,10,0.95))',
                border: '3px solid rgba(239,68,68,0.8)',
                boxShadow: '0 0 40px rgba(239,68,68,0.6), 0 10px 30px rgba(0,0,0,0.7)',
                animation: 'kcDefeatBanner 2s ease-out forwards',
              }}
            >
              <p className="text-4xl mb-2">💀</p>
              <p className="text-xl font-black mb-1" style={{ color: '#ef4444', textShadow: '0 0 12px rgba(239,68,68,0.8)' }}>
                ベンチ満杯！
              </p>
              <p className="text-sm font-bold text-amber-100">
                {benchOverflowBanner.loserSide === 'player' ? 'あなたの敗北' : '相手の敗北'}
              </p>
            </div>
          </div>
          <style>{`
            @keyframes kcDefeatFlash {
              0%   { background: rgba(239,68,68,0); }
              20%  { background: rgba(239,68,68,0.55); }
              100% { background: rgba(239,68,68,0); }
            }
            @keyframes kcDefeatBanner {
              0%   { opacity: 0; transform: scale(0.4); }
              15%  { opacity: 1; transform: scale(1.1); }
              25%  { transform: scale(1); }
              85%  { opacity: 1; transform: scale(1); }
              100% { opacity: 0; transform: scale(0.9); }
            }
          `}</style>
        </>
      )}

      {/* ===== Effect Activation: flash + name popup ===== */}
      {gameState?.effectTelop && (
        <div key={`eff-${gameState.effectTelop.key}`} className="fixed inset-0 pointer-events-none z-[190]">
          {/* White flash (brief) */}
          <div style={{ position: 'absolute', inset: 0, animation: 'kcEffectFlash 0.35s ease-out forwards' }} />
          {/* Floating effect name (center-top) */}
          <div className="absolute left-0 right-0 top-[32%] text-center kc-effect-telop">
            <p
              className="inline-block px-4 py-1.5 rounded-lg text-sm font-black"
              style={{
                background: 'rgba(11,17,40,0.75)',
                color: gameState.effectTelop.color,
                textShadow: `0 0 10px ${gameState.effectTelop.color}88, 0 2px 4px rgba(0,0,0,0.9)`,
                border: `1.5px solid ${gameState.effectTelop.color}66`,
                boxShadow: `0 3px 14px ${gameState.effectTelop.color}55`,
                backdropFilter: 'blur(4px)',
              }}
            >
              {gameState.effectTelop.text}
            </p>
          </div>
          <style>{`
            @keyframes kcEffectFlash {
              0%   { background: rgba(255,255,255,0); }
              30%  { background: rgba(255,255,255,0.25); }
              100% { background: rgba(255,255,255,0); }
            }
          `}</style>
        </div>
      )}

      {/* ===== NPC Reveal Animation (solo only, 4 phases) ===== */}
      {npcRevealAnim && (() => {
        const { phase, card } = npcRevealAnim;
        // Compute origin from real AI deck position (fallback to top-right area)
        const anchor = typeof document !== 'undefined' ? document.getElementById('kc-ai-deck-anchor') : null;
        let originX = '30vw';
        let originY = '-28vh';
        if (anchor) {
          const rect = anchor.getBoundingClientRect();
          const viewportCenterX = window.innerWidth / 2;
          const viewportCenterY = window.innerHeight / 2;
          const deckCenterX = rect.left + rect.width / 2;
          const deckCenterY = rect.top + rect.height / 2;
          // Delta from viewport center (since overlay card is centered by flex)
          originX = `${deckCenterX - viewportCenterX}px`;
          originY = `${deckCenterY - viewportCenterY}px`;
        }
        const containerStyle: React.CSSProperties = {
          position: 'fixed',
          inset: 0,
          zIndex: 200,
          pointerEvents: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        };
        let cardTransform: string;
        let opacity = 1;
        const transition = 'transform 0.3s cubic-bezier(0.22, 0.61, 0.36, 1), opacity 0.2s linear';
        if (phase === 'draw') {
          // Start from actual AI deck position, slight lift
          cardTransform = `translate(${originX}, calc(${originY} - 10px)) scale(0.6)`;
        } else if (phase === 'flip') {
          // Slide to center, scale up, flipping (handled by .card-flip class)
          cardTransform = 'translate(0, 0) scale(1) rotateY(0deg)';
        } else {
          // Slide up toward AI field zone
          cardTransform = 'translate(0, -22vh) scale(0.85)';
          opacity = 0.95;
        }
        return (
          <div style={containerStyle}>
            <div
              key={`npc-anim-${card.id}-${phase}`}
              className={phase === 'flip' ? 'card-flip' : ''}
              style={{
                width: 'min(44vw, 180px)',
                aspectRatio: '360 / 500',
                transform: cardTransform,
                transition,
                opacity,
                perspective: 800,
                transformStyle: 'preserve-3d',
                filter: 'drop-shadow(0 10px 20px rgba(0,0,0,0.6))',
              }}
            >
              {phase === 'draw' ? (
                // Back face (still hidden)
                <div
                  className="w-full h-full rounded-xl"
                  style={{
                    background: 'linear-gradient(135deg, #7f1d1d, #b91c1c)',
                    border: '2px solid rgba(255,215,0,0.4)',
                    boxShadow: 'inset 0 0 20px rgba(0,0,0,0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <span className="text-3xl opacity-60">🂠</span>
                </div>
              ) : (
                // flip + place: show front face
                <div className="relative w-full h-full rounded-xl overflow-hidden"
                  style={{ background: '#0b1128', border: `2px solid ${card.rarity === 'SSR' ? '#ffd700' : card.rarity === 'SR' ? '#a855f7' : '#3b82f6'}` }}>
                  {card.imageUrl && (
                    <img src={card.imageUrl} alt={card.name}
                      className="absolute inset-0 w-full h-full"
                      style={{ objectFit: 'cover', objectPosition: 'center' }} />
                  )}
                  <div className="absolute left-0 right-0 bottom-2 text-center pointer-events-none">
                    <span className="text-xs font-black text-white"
                      style={{ textShadow: '0 2px 6px rgba(0,0,0,0.9)' }}>
                      {card.name}
                    </span>
                  </div>
                  <div className="absolute left-1 bottom-1 px-1.5 py-0.5 rounded text-[10px] font-black text-white"
                    style={{ background: 'rgba(239,68,68,0.85)' }}>
                    ⚔️ {card.attackPower ?? card.power}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* ===== Effect Cutin (SR+ cards) ===== */}
      {cutinCard && (
        <div className="fixed inset-0 z-[1000] pointer-events-none">
          {/* Letterbox bars */}
          <div className="absolute top-0 left-0 right-0 kc-letterbox-in" style={{ height: '12vh', background: 'black' }} />
          <div className="absolute bottom-0 left-0 right-0 kc-letterbox-in" style={{ height: '12vh', background: 'black' }} />
          {/* Card illustration */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="kc-cutin-card" style={{ opacity: 0.85 }}>
              <img src={cutinCard.imageUrl} alt={cutinCard.name}
                className="rounded-xl"
                style={{ width: 200, height: 280, objectFit: 'cover', boxShadow: '0 0 40px rgba(255,215,0,0.4)' }} />
            </div>
          </div>
          {/* Effect name (small, no description) */}
          <div className="absolute bottom-[15vh] left-0 right-0 text-center kc-cutin-text">
            <p className="text-xl font-black" style={{ color: '#ffd700', textShadow: '0 0 20px rgba(255,215,0,0.8), 0 2px 8px rgba(0,0,0,0.9)' }}>
              {cutinCard.effect?.name ?? cutinCard.name}
            </p>
          </div>
        </div>
      )}

      {/* ===== Combo Name: small inline tag (spec: no central banners) ===== */}
      {comboName && (
        <div className="fixed bottom-[30%] left-0 right-0 z-[175] pointer-events-none kc-effect-micro">
          <p className="text-center font-bold" style={{
            fontSize: '12px',
            lineHeight: 1.3,
            color: '#ffd700',
            textShadow: '0 1px 6px rgba(0,0,0,0.9)',
          }}>
            ✨ {comboName}
          </p>
        </div>
      )}

      {/* ===== Evolution Overlay ===== */}
      {evolutionOverlay && (() => {
        const isSaint = evolutionOverlay.to.name === '聖女ジャンヌ';
        const isGenius = evolutionOverlay.to.name === '万能の天才';
        const accentColor = isSaint || isGenius ? '#ffffff' : '#ffd700';
        const particleColors = isSaint || isGenius ? ['#ffffff', '#ffd700', '#fff7cc'] : ['#ffd700'];
        const label = isSaint ? 'SAINT!' : isGenius ? 'GENIUS!' : 'EVOLVE!';
        return (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.85)' }}>
          {/* Phase 1: From card glowing */}
          <div className="kc-evolve-sequence">
            <div className="kc-evolve-from-card" style={{ position: 'absolute' }}>
              <img src={evolutionOverlay.from.imageUrl} alt={evolutionOverlay.from.name}
                className="rounded-xl"
                style={{ width: 180, height: 250, objectFit: 'cover', boxShadow: `inset 0 0 30px ${accentColor}, 0 0 40px ${isSaint || isGenius ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.5)'}` }} />
            </div>
            {/* Phase 2: To card appearing */}
            <div className="kc-evolve-to-card" style={{ position: 'absolute' }}>
              <img src={evolutionOverlay.to.imageUrl} alt={evolutionOverlay.to.name}
                className="rounded-xl"
                style={{ width: 200, height: 280, objectFit: 'cover', boxShadow: `0 0 40px ${isSaint || isGenius ? 'rgba(255,255,255,0.8)' : 'rgba(255,215,0,0.6)'}, 0 0 80px ${isSaint || isGenius ? 'rgba(255,215,0,0.35)' : 'transparent'}` }} />
            </div>
          </div>
          {/* EVOLVE / SAINT text */}
          <div className="absolute bottom-[20vh] left-0 right-0 text-center">
            <p className="kc-evolve-text font-black" style={{
              fontSize: '48px', color: accentColor,
              textShadow: isSaint || isGenius
                ? '0 0 30px rgba(255,255,255,0.9), 0 0 60px rgba(255,215,0,0.5)'
                : '0 0 30px rgba(255,215,0,0.8), 0 0 60px rgba(255,215,0,0.4)',
              letterSpacing: '8px',
            }}>
              {label}
            </p>
            <p className="text-lg text-amber-200/80 mt-2">
              {evolutionOverlay.from.name} → {evolutionOverlay.to.name}
            </p>
          </div>
          {/* Particles */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {Array.from({ length: 15 }).map((_, i) => (
              <span key={`evo-p-${i}`} className="kc-confetti-piece"
                style={{
                  left: `${30 + (i * 2.8) % 40}%`, top: `${30 + (i * 3.2) % 40}%`,
                  background: particleColors[i % particleColors.length],
                  animationDelay: `${i * 0.05}s`, animationDuration: '1.5s',
                }} />
            ))}
          </div>
        </div>
        );
      })()}

      {/* ===== Card Detail Modal ===== */}
      {detailCard && <CardDetailModal card={detailCard} onClose={() => setDetailCard(null)} />}

      {/* ===== Deck Phase Overlay (レスポンシブ: PC 2-col / モバイル 縦) ===== */}
      {gameState.phase === 'deck_phase' && deckOffer && !activeQuiz && !swapState && (() => {
        // In PvP P2's deck phase, show P2's deck (gameState.ai.deck) instead.
        const deckCards = pvpActiveSide === 'ai' ? gameState.ai.deck : gameState.player.deck;
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
                <div key={i} className="relative">
                  <button
                    onClick={() => handleCardTap(i)}
                    disabled={blocked || acquired}
                    className="rounded-xl p-2 relative overflow-hidden transition-all active:scale-95 w-full"
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
                  {/* Info button */}
                  <button
                    onClick={(e) => { e.stopPropagation(); setDetailCard(card); }}
                    className="absolute bottom-1 right-1 w-5 h-5 rounded-full flex items-center justify-center z-10 active:scale-90 transition-transform"
                    style={{
                      background: 'rgba(255,215,0,0.85)',
                      color: '#0b1128',
                      fontSize: '11px',
                      fontWeight: 900,
                      boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
                    }}
                  >
                    i
                  </button>
                </div>
              );
            })}
          </div>
        );

        const DeckPanelHeader = (
          <div className="w-full flex items-center justify-between mb-1.5">
            <span className="text-[13px] font-bold text-amber-100 flex items-center gap-1.5">
              📋 現在のデッキ {deckCount}/{MAX_DECK_SIZE}枚
            </span>
            <span
              className="text-[10px] font-bold shrink-0"
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

        // Flatten deck cards sorted by name for clean 5×3 grid (no stacking)
        const sortedDeckEntries = deckCards
          .map((c, i) => ({ card: c, origIdx: i }))
          .sort((a, b) => a.card.name.localeCompare(b.card.name, 'ja'));

        const rarityBorderColor = (r: string) =>
          r === 'SSR' ? 'rgba(255,215,0,0.7)' : r === 'SR' ? 'rgba(168,85,247,0.6)' : r === 'R' ? 'rgba(59,130,246,0.6)' : 'rgba(156,163,175,0.4)';

        const DeckGrid = (
          <div className="grid grid-cols-5 gap-1">
            {sortedDeckEntries.map((entry) => {
              const { card: c, origIdx } = entry;
              const isFading = fadingOutIdx === origIdx;
              return (
                <button
                  key={c.id + '-' + origIdx}
                  onClick={() => handleRequestRemoveCard(origIdx)}
                  className="relative rounded-lg overflow-hidden active:scale-95 transition-all"
                  style={{
                    aspectRatio: '3/4',
                    border: `1.5px solid ${rarityBorderColor(c.rarity)}`,
                    background: 'rgba(11,17,40,0.8)',
                    opacity: isFading ? 0 : 1,
                    transform: isFading ? 'scale(0.85)' : undefined,
                    transition: 'opacity 0.28s ease, transform 0.28s ease',
                  }}
                >
                  {c.imageUrl && (
                    <img src={c.imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
                  )}
                  <div className="absolute inset-x-0 bottom-0 px-0.5 py-0.5" style={{ background: 'linear-gradient(transparent, rgba(0,0,0,0.85))' }}>
                    <p className="text-[7px] font-bold text-white text-center truncate leading-tight" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.9)' }}>
                      {c.name}
                    </p>
                  </div>
                  <span
                    className="absolute top-0 left-0 text-[6px] font-black px-0.5 rounded-br"
                    style={{
                      background: c.rarity === 'SSR' ? '#ffd700' : c.rarity === 'SR' ? '#a855f7' : c.rarity === 'R' ? '#3b82f6' : '#6b7280',
                      color: c.rarity === 'SSR' || c.rarity === 'SR' ? '#fff' : '#e5e7eb',
                    }}
                  >
                    {c.rarity}
                  </span>
                </button>
              );
            })}
          </div>
        );

        return (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-3" style={{ background: 'rgba(0,0,0,0.85)' }}>
          <div
            className="rounded-2xl w-full max-w-md md:max-w-5xl flex flex-col"
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
              {isPvP && pvpSession && (() => {
                const activeName = pvpDeckTurn === 'p1' ? pvpSession.player1.childName : pvpSession.player2.childName;
                const color = pvpDeckTurn === 'p1' ? '#ef4444' : '#3b82f6';
                const label = pvpDeckTurn === 'p1' ? '🔴 P1' : '🔵 P2';
                return (
                  <div
                    className="mx-auto my-2 px-3 py-2 rounded-xl text-center"
                    style={{
                      background: `linear-gradient(135deg, ${color}33, ${color}11)`,
                      border: `2px solid ${color}88`,
                      maxWidth: '320px',
                    }}
                  >
                    <p className="text-[11px] font-bold" style={{ color }}>
                      {label} {activeName} のターン
                    </p>
                    <p className="text-[9px] text-amber-200/60 mt-0.5">
                      カードを選んで「バトル開始」をタップ → {pvpDeckTurn === 'p1' ? 'P2に交代' : 'バトル突入'}
                    </p>
                  </div>
                );
              })()}
              <p className="text-xs text-amber-200/70 text-center">
                {deckOffer.cards.length} 枚の中から{maxPicksForRound(gameState.round, gameState.totalRounds)}枚まで選べる。タップでクイズ出題、正解で追加。
                <br />
                獲得 {deckOffer.acquired.size}/{maxPicksForRound(gameState.round, gameState.totalRounds)} ・ デッキ {deckCount}/{MAX_DECK_SIZE} 枚
              </p>
            </div>

            {/* ===== レイアウト: モバイル縦積み / PC(md+)横並び ===== */}
            <div className="flex-1 min-h-0 overflow-y-auto px-4">
              <div className="flex flex-col md:flex-row gap-4 max-w-5xl mx-auto">
                {/* 提示カード（左 / 上） */}
                <div className="md:flex-[3] min-w-0">
                  <p className="text-[12px] font-bold text-amber-100 mb-2">
                    🎴 提示カード（{deckOffer.cards.length}枚 / 獲得 {deckOffer.acquired.size}/{maxPicksForRound(gameState.round, gameState.totalRounds)}）
                  </p>
                  {OfferGrid}
                </div>

                {/* 現在のデッキ（右 / 下） — md+ では常時展開 */}
                <div
                  className="md:flex-[2] min-w-0 rounded-xl p-2.5 self-start w-full"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,215,0,0.2)' }}
                >
                  {DeckPanelHeader}
                  {(true) && (
                    <div className="mt-2">
                      {DeckStatsLine}
                      {DeckGrid}
                      {removedCards.length > 0 && (
                        <div className="mt-2 rounded-lg p-2" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                          <p className="text-[10px] font-bold text-red-300/70 mb-1">🚫 除外したカード（タップで戻す）</p>
                          <div className="flex gap-1.5 flex-wrap">
                            {removedCards.map((c, i) => (
                              <button
                                key={`removed-${i}`}
                                onClick={() => handleRestoreRemovedCard(i)}
                                className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold active:scale-95 transition-transform"
                                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.5)' }}
                              >
                                ↩ {c.name}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      <p className="text-[10px] text-amber-200/50 mt-1.5 text-center">
                        💡 デッキ整理のコツ: 攻撃と防御のバランスを考えよう
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ===== Sticky footer: 引き直し + バトル開始 ===== */}
            {(() => {
              const acquiredCount = deckOffer.acquired.size;
              const maxPicks = maxPicksForRound(gameState.round, gameState.totalRounds);
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
                    className={`tappable w-full rounded-xl font-black active:scale-[0.98] transition-all ${isPositive ? 'pulse-btn' : ''}`}
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
        @keyframes kcHudPulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.6; transform: scale(1.05); } }
        .kc-hud-pulse { animation: kcHudPulse 0.9s ease-in-out infinite; }
        @keyframes kcSortieSlide {
          0% { opacity: 0; transform: translateY(-10px); max-height: 0; }
          100% { opacity: 1; transform: translateY(0); max-height: 56px; }
        }
        .kc-sortie-slide { animation: kcSortieSlide 0.25s ease-out; }
        @keyframes kcFlagFlash {
          0%   { box-shadow: 0 0 0 0 rgba(255,215,0,0.9); transform: scale(1); }
          20%  { box-shadow: 0 0 0 6px rgba(255,215,0,0.4); transform: scale(1.15); }
          100% { box-shadow: 0 0 0 0 rgba(255,215,0,0); transform: scale(1); }
        }
        .kc-flag-flash { animation: kcFlagFlash 0.6s ease-out; }
        @keyframes kcTapHint {
          0%, 100% { transform: translateY(0); opacity: 0.85; }
          50%      { transform: translateY(-6px); opacity: 1; }
        }
        .kc-tap-hint { animation: kcTapHint 0.7s ease-in-out infinite; }
        @keyframes kcRoundReasonIn { 0% { opacity: 0; transform: translateY(-12px) scale(0.9); } 100% { opacity: 1; transform: translateY(0) scale(1); } }
        .kc-round-reason { animation: kcRoundReasonIn 0.4s cubic-bezier(0.34,1.56,0.64,1); }
        @keyframes kcFlagPulse { 0% { transform: scale(1); } 50% { transform: scale(1.4); } 100% { transform: scale(1); } }
        .kc-flag-pulse { animation: kcFlagPulse 0.9s ease-out; }
        .kc-flag {
          width: 80px; height: 80px; border-radius: 50%;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          transition: background 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease;
        }
        .kc-card-reveal { animation: kcCardReveal 0.3s ease-out; }
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
          0%   { opacity: 0; transform: translateY(-80px) scale(0.5) rotateY(180deg); }
          40%  { opacity: 1; transform: translateY(-10px) scale(1.05) rotateY(90deg); }
          70%  { transform: translateY(5px) scale(0.98) rotateY(0deg); }
          100% { opacity: 1; transform: translateY(0) scale(1) rotateY(0deg); }
        }
        .kc-ai-card-enter { animation: kcAiCardEnter 0.45s cubic-bezier(0.34, 1.56, 0.64, 1); }
        @keyframes kcPlayerCardEnter {
          0%   { opacity: 0; transform: translateY(80px) scale(0.5) rotateY(180deg); }
          40%  { opacity: 1; transform: translateY(10px) scale(1.05) rotateY(90deg); }
          70%  { transform: translateY(-5px) scale(0.98) rotateY(0deg); }
          100% { opacity: 1; transform: translateY(0) scale(1) rotateY(0deg); }
        }
        .kc-player-card-enter { animation: kcPlayerCardEnter 0.45s cubic-bezier(0.34, 1.56, 0.64, 1); }
        /* Light ripple on card reveal */
        @keyframes kcRipple {
          0%   { transform: scale(0); opacity: 0.6; }
          100% { transform: scale(2.5); opacity: 0; }
        }
        /* Card idle floating */
        @keyframes kcCardFloat {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-3px); }
        }
        .kc-card-float { animation: kcCardFloat 2.5s ease-in-out infinite; }
        /* Card shine sweep */
        @keyframes kcCardShine {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
        @keyframes kcCardFlip {
          0%   { transform: rotateY(180deg) scale(0.92); }
          60%  { transform: rotateY(0deg) scale(1.06); }
          100% { transform: rotateY(0deg) scale(1); }
        }
        .kc-flipping { animation: kcCardFlip 0.6s ease-out; }
        /* Power gauge near-break shake */
        @keyframes kcGaugeShake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-2px); }
          40% { transform: translateX(2px); }
          60% { transform: translateX(-1px); }
          80% { transform: translateX(1px); }
        }
        .kc-gauge-shake { animation: kcGaugeShake 0.5s ease-in-out infinite; }
        /* BREAK stamp-in */
        @keyframes kcStampIn {
          0%   { transform: scale(3) rotate(-10deg); opacity: 0; }
          50%  { transform: scale(0.9) rotate(2deg); opacity: 1; }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
        .kc-stamp-in { animation: kcStampIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1); }
        /* Finisher card entrance */
        @keyframes finisherEntrance {
          0%   { opacity: 0; transform: scale(0.4) rotateY(-20deg) translateY(40px); }
          60%  { opacity: 1; transform: scale(1.08) rotateY(2deg) translateY(-5px); }
          100% { opacity: 1; transform: scale(1) rotateY(-4deg) rotateX(2deg) translateY(0); }
        }
        @keyframes finisherTextFadeIn {
          0%   { opacity: 0; transform: translateY(12px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        /* Shockwave on break */
        @keyframes kcShockwave {
          0%   { transform: scale(0); opacity: 0.8; border: 3px solid rgba(255,215,0,0.9); }
          100% { transform: scale(4); opacity: 0; border: 1px solid rgba(255,215,0,0.3); }
        }
        .kc-shockwave { border-radius: 50%; animation: kcShockwave 0.6s ease-out forwards; }
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

        /* Round victory celebration telop */
        @keyframes kcRoundVictoryZoom {
          0%   { opacity: 0; transform: scale(0.3) rotate(-5deg); }
          30%  { opacity: 1; transform: scale(1.2) rotate(3deg); }
          50%  { transform: scale(0.95) rotate(-1deg); }
          70%  { transform: scale(1.05) rotate(1deg); }
          100% { opacity: 1; transform: scale(1) rotate(0); }
        }
        .kc-round-victory-telop { animation: kcRoundVictoryZoom 0.8s cubic-bezier(0.34, 1.56, 0.64, 1); }

        /* Card detail popup */
        @keyframes kcCardDetailPop {
          0%   { opacity: 0; transform: scale(0.8); }
          50%  { transform: scale(1.03); }
          100% { opacity: 1; transform: scale(1); }
        }
        .kc-card-detail-pop { animation: kcCardDetailPop 0.25s ease-out; }

        /* Tablet (iPad mini portrait/landscape and up): enlarge card detail image */
        @media (min-width: 768px) {
          .card-detail-img { width: 360px !important; height: 504px !important; }
        }
        @media (min-width: 1024px) {
          .card-detail-img { width: 420px !important; height: 588px !important; }
        }

        /* Top banner slide-in for effect/bench telop */
        @keyframes kcTopBannerSlide {
          0%   { opacity: 0; transform: translateY(-100%); }
          10%  { opacity: 1; transform: translateY(0); }
          80%  { opacity: 1; transform: translateY(0); }
          100% { opacity: 0; transform: translateY(-100%); }
        }
        .kc-top-banner-slide { animation: kcTopBannerSlide 2.5s ease-out forwards; }

        /* Power bounce on update */
        @keyframes kcPowerBounce {
          0%   { transform: scale(1); }
          30%  { transform: scale(1.3); }
          60%  { transform: scale(0.95); }
          100% { transform: scale(1); }
        }
        .kc-power-bounce { animation: kcPowerBounce 0.35s ease-out; }

        /* Buff pulse on card power badge */
        @keyframes kcBuffPulse {
          0%, 100% { filter: brightness(1); }
          50%      { filter: brightness(1.3); }
        }
        .kc-buff-pulse { animation: kcBuffPulse 1.5s ease-in-out infinite; }

        /* ===== Phase 2: Effect Cutin ===== */
        @keyframes kcLetterboxIn {
          0%   { transform: scaleY(0); }
          100% { transform: scaleY(1); }
        }
        .kc-letterbox-in { transform-origin: top; animation: kcLetterboxIn 0.2s ease-out forwards; }
        .kc-letterbox-in:last-of-type { transform-origin: bottom; }
        @keyframes kcCutinCard {
          0%   { opacity: 0; transform: scale(0.5); }
          60%  { opacity: 0.85; transform: scale(1.05); }
          100% { opacity: 0.85; transform: scale(1); }
        }
        .kc-cutin-card { animation: kcCutinCard 0.4s ease-out forwards; }
        @keyframes kcCutinText {
          0%   { opacity: 0; transform: translateX(60px) rotate(-3deg); }
          100% { opacity: 1; transform: translateX(0) rotate(0deg); }
        }
        .kc-cutin-text { animation: kcCutinText 0.3s ease-out 0.3s both; }

        /* ===== Phase 2: Combo ===== */
        @keyframes kcComboAppear {
          0%   { transform: scale(0) rotate(-180deg); opacity: 0; }
          60%  { transform: scale(1.2) rotate(10deg); opacity: 1; }
          100% { transform: scale(1) rotate(0deg); }
        }
        .kc-combo-appear { animation: kcComboAppear 0.6s cubic-bezier(0.34, 1.56, 0.64, 1); }

        /* ===== Phase 2: Evolution ===== */
        @keyframes kcEvolveFrom {
          0%   { opacity: 1; transform: scale(1); box-shadow: 0 0 0 transparent; }
          50%  { opacity: 1; transform: scale(1.3); box-shadow: inset 0 0 30px white, 0 0 40px white; }
          80%  { opacity: 0; transform: scale(1.5); }
          100% { opacity: 0; transform: scale(2); }
        }
        .kc-evolve-from-card { animation: kcEvolveFrom 1.2s ease-out forwards; }
        @keyframes kcEvolveTo {
          0%   { opacity: 0; transform: scale(1.5); }
          60%  { opacity: 0; transform: scale(1.5); }
          80%  { opacity: 1; transform: scale(1.05); }
          100% { opacity: 1; transform: scale(1); }
        }
        .kc-evolve-to-card { animation: kcEvolveTo 2s ease-out forwards; }
        @keyframes kcEvolveText {
          0%   { transform: scale(0) rotate(-20deg); opacity: 0; }
          50%  { transform: scale(1.3) rotate(5deg); opacity: 1; text-shadow: 0 0 40px rgba(255,215,0,0.9); }
          100% { transform: scale(1) rotate(0deg); text-shadow: 0 0 20px rgba(255,215,0,0.6); }
        }
        .kc-evolve-text { animation: kcEvolveText 0.8s ease-out 1.5s both; }

        /* Character-by-character fade-in for turn transition */
        @keyframes kcCharFadeIn {
          0%   { opacity: 0; transform: translateY(12px) scale(0.8); }
          25%  { opacity: 1; transform: translateY(0) scale(1.05); }
          35%  { transform: translateY(0) scale(1); }
          75%  { opacity: 1; }
          100% { opacity: 0; }
        }
        .kc-char-fadein { animation: kcCharFadeIn 2s ease-out forwards; opacity: 0; display: inline-block; }

        /* Phase 3: Background particles */
        @keyframes kcBgParticle {
          0%   { transform: translateY(0) translateX(0); opacity: 0.3; }
          50%  { transform: translateY(-30px) translateX(10px); opacity: 0.6; }
          100% { transform: translateY(-60px) translateX(-5px); opacity: 0; }
        }
        .kc-bg-particle { animation: kcBgParticle 5s ease-in-out infinite; }

        /* Phase 3: Deck danger pulse */
        @keyframes kcDangerPulse {
          0%, 100% { box-shadow: 0 0 0 rgba(239,68,68,0); }
          50%      { box-shadow: 0 0 12px rgba(239,68,68,0.5); }
        }
        .kc-danger-pulse { animation: kcDangerPulse 1s ease-in-out infinite; }

        /* ===== Phase 4: Card Shine ===== */
        @keyframes kcCardShine {
          0%, 100% { transform: translateX(-150%); }
          50%      { transform: translateX(150%); }
        }
        .kc-card-shine {
          overflow: hidden;
        }
        .kc-card-shine::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(105deg, transparent 35%, rgba(255,255,255,0.12) 42%, rgba(255,255,255,0.06) 48%, transparent 55%);
          animation: kcCardShine 5s ease-in-out infinite;
          pointer-events: none;
        }
        .kc-card-shine-ssr {
          overflow: hidden;
        }
        .kc-card-shine-ssr::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(105deg, transparent 30%, rgba(255,50,50,0.1) 36%, rgba(255,200,50,0.15) 42%, rgba(50,255,50,0.1) 48%, rgba(50,50,255,0.1) 54%, transparent 60%);
          animation: kcCardShine 4s ease-in-out infinite;
          pointer-events: none;
        }

        /* ===== Shadowverse-style vignette ===== */
        @keyframes kcVignetteIn {
          0%   { opacity: 0; }
          30%  { opacity: 1; }
          70%  { opacity: 1; }
          100% { opacity: 0; }
        }
        .kc-vignette-in { animation: kcVignetteIn 1.2s ease-out forwards; }

        /* Attack vignette (persistent during attack phase) */
        .kc-vignette-attack { box-shadow: inset 0 0 80px 20px rgba(239,68,68,0.15); transition: box-shadow 0.5s ease; }
        .kc-vignette-defense { box-shadow: inset 0 0 80px 20px rgba(59,130,246,0.15); transition: box-shadow 0.5s ease; }

        /* Micro effect telop (small text, fast fade) */
        @keyframes kcEffectMicro {
          0%   { opacity: 0; transform: translateY(4px); }
          15%  { opacity: 1; transform: translateY(0); }
          75%  { opacity: 1; }
          100% { opacity: 0; }
        }
        .kc-effect-micro { animation: kcEffectMicro 0.8s ease-out forwards; }

        /* ===== Reduced Motion ===== */
        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after {
            animation-duration: 0.01s !important;
            transition-duration: 0.01s !important;
          }
          .kc-bg-particle, .kc-confetti-piece { display: none !important; }
        }

        /* ===== Mobile Responsive ===== */
        @media (max-width: 768px) {
          /* Touch highlights */
          * { -webkit-tap-highlight-color: transparent; }

          /* Confetti & particles reduced */
          .kc-confetti-piece:nth-child(n+16) { display: none; }
          .kc-bg-particle:nth-child(n+6) { display: none; }

          /* Effect cutin: smaller letterbox */
          .kc-letterbox-in { height: 8vh !important; }

          /* Stamp text smaller */
          .kc-stamp-in { font-size: 80% !important; }

          /* Combo text smaller */
          .kc-combo-appear { font-size: 80% !important; }
        }

        @media (max-width: 480px) {
          /* Very small screens: further reduce */
          .kc-letterbox-in { height: 6vh !important; }
          .kc-confetti-piece:nth-child(n+10) { display: none; }
        }

        /* Hover effects only for mouse devices */
        @media (hover: none) {
          .active\:scale-95:active { transform: scale(0.95); }
        }
      `}</style>
    </div>
  );
}

// =====================================================================
// ===================== Sub-components ================================
// =====================================================================

type BenchSlotUI = { name: string; card: BattleCard; count: number };

function BenchDisplay({ side, bench, deckCount, quarantineCount, animKey, glowNames, maxSlots = BENCH_MAX_SLOTS, onCardTap }: {
  side: 'player' | 'ai'; bench: BenchSlotUI[]; deckCount: number; quarantineCount?: number; animKey?: number; glowNames?: string[]; maxSlots?: number; onCardTap?: (card: BattleCard) => void;
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
  const emptySlots = maxSlots - bench.length;
  const isFull = bench.length >= maxSlots;
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
            <span
              className={`text-sm font-black ${isWarning || isFull ? 'text-red-400' : maxSlots !== BENCH_MAX_SLOTS ? '' : 'text-amber-100'}`}
              style={maxSlots !== BENCH_MAX_SLOTS && !(isWarning || isFull) ? { color: '#facc15' } : undefined}
              title={maxSlots !== BENCH_MAX_SLOTS ? `特殊ルール: 通常${BENCH_MAX_SLOTS}枠のところ${maxSlots}枠` : undefined}
            >
              ベンチ {bench.length}/{maxSlots}{maxSlots !== BENCH_MAX_SLOTS ? ' ⚠️' : ''}
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
          {Array.from({ length: maxSlots }).map((_, i) => {
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
                onClick={() => onCardTap ? onCardTap(slot.card) : (isPlayer && setDetailSlot(slot))}
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
 * CardDetailModal — shows card details (image, stats, effect, synergies, quiz)
 */
function CardDetailModal({ card, onClose }: { card: BattleCard; onClose: () => void }) {
  const catInfo = CATEGORY_INFO[card.category];
  const rarityInfo = RARITY_INFO[card.rarity];
  const atk = card.attackPower ?? card.power;
  const def = card.defensePower ?? card.power;
  const synergies = SYNERGY_MAP[card.name] ?? [];
  const quiz = card.quizzes?.[0];
  const frameImg = CARD_RARITY_IMAGES[card.rarity] || CARD_RARITY_IMAGES['N'];

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="rounded-2xl p-4 md:p-8 w-full max-w-xs md:max-w-2xl overflow-y-auto max-h-[90vh] kc-card-detail-pop"
        style={{
          background: 'linear-gradient(135deg, rgba(21,29,59,0.98), rgba(14,20,45,0.98))',
          border: `2px solid ${rarityInfo.color}60`,
          boxShadow: `0 0 24px ${rarityInfo.color}33, 0 8px 32px rgba(0,0,0,0.6)`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Card image (tablet: 280x392, phone: 200x280) */}
        <div
          className="mx-auto mb-3 md:mb-4 rounded-xl overflow-hidden relative card-detail-img"
          style={{ width: 200, height: 280 }}
        >
          {card.imageUrl && (
            <img src={card.imageUrl} alt={card.name} className="w-full h-full object-cover" />
          )}
          <img src={frameImg} alt="" className="absolute inset-0 w-full h-full object-cover pointer-events-none" />
        </div>

        {/* Name + rarity + category */}
        <div className="flex items-center justify-between mb-2 md:mb-4">
          <h3 className="text-lg md:text-3xl font-black text-amber-100">{card.name}</h3>
          <div className="flex items-center gap-1.5 md:gap-2">
            <span className="text-[11px] md:text-base font-bold px-1.5 md:px-3 py-0.5 md:py-1.5 rounded" style={{ background: rarityInfo.bgColor, color: rarityInfo.color, border: `1px solid ${rarityInfo.color}40` }}>
              {rarityInfo.label}
            </span>
            <span className="text-[11px] md:text-base font-bold px-1.5 md:px-3 py-0.5 md:py-1.5 rounded" style={{ background: `${catInfo.color}15`, color: catInfo.color }}>
              {catInfo.emoji}{catInfo.label}
            </span>
          </div>
        </div>

        {/* Attack / Defense */}
        <div className="flex items-center gap-4 md:gap-8 mb-3 md:mb-5">
          <span className="text-base md:text-2xl font-black" style={{ color: '#ff6b6b' }}>⚔️ 攻撃: {atk}</span>
          <span className="text-base md:text-2xl font-black" style={{ color: '#60a5fa' }}>🛡️ 防御: {def}</span>
        </div>

        {/* Effect */}
        <div className="rounded-lg p-2.5 md:p-5 mb-3 md:mb-5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <p className="text-[10px] md:text-sm font-bold text-amber-200/50 mb-1 md:mb-2">── 効果 ──</p>
          {card.effect ? (
            <>
              <p className="text-sm md:text-xl font-bold text-amber-100 mb-0.5 md:mb-2">「{card.effect.name}」</p>
              <p className="text-xs md:text-lg text-amber-200/70 leading-relaxed">{card.effect.description}</p>
            </>
          ) : card.category === 'heritage' ? (
            <p className="text-xs md:text-lg text-amber-200/50">効果なし（防御特化）</p>
          ) : (
            <p className="text-xs md:text-lg text-amber-200/50">{card.effectDescription}</p>
          )}
        </div>

        {/* Synergies */}
        {synergies.length > 0 && (
          <div className="rounded-lg p-2.5 md:p-5 mb-3 md:mb-5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <p className="text-[10px] md:text-sm font-bold text-amber-200/50 mb-1 md:mb-2">── コンボ ──</p>
            {synergies.map((s) => (
              <p key={s} className="text-xs md:text-lg text-amber-200/70 mb-0.5 md:mb-1">🔗 {s}</p>
            ))}
          </div>
        )}

        {/* Quiz preview */}
        {quiz && (
          <div className="rounded-lg p-2.5 md:p-5 mb-3 md:mb-5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <p className="text-[10px] md:text-sm font-bold text-amber-200/50 mb-1 md:mb-2">── クイズ ──</p>
            <p className="text-xs md:text-lg text-amber-200/70">Q: {quiz.question}</p>
          </div>
        )}

        {/* Close button */}
        <button
          onClick={onClose}
          className="w-full py-2.5 md:py-4 rounded-lg text-sm md:text-lg font-bold"
          style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.7)' }}
        >
          ✕ 閉じる
        </button>
      </div>
    </div>
  );
}

/**
 * CardDisplay
 *  - Always shows both ⚔️ attackPower (left-bottom, red) and 🛡️ defensePower (right-bottom, blue)
 *  - mode='attack'   : ⚔️ glows red, 🛡️ greyed out
 *  - mode='defense'  : 🛡️ glows blue, ⚔️ greyed out
 *  - mode='neutral'  : both at normal brightness
 */
function CardDisplay({ card, isDefense, isWinner, size, mode, onTap, atkBonus = 0, defBonus = 0 }: {
  card: BattleCard;
  isDefense?: boolean;
  isWinner?: boolean;
  size?: 'sm' | 'md' | 'battle';
  mode?: 'attack' | 'defense' | 'neutral';
  onTap?: () => void;
  atkBonus?: number;
  defBonus?: number;
}) {
  const catInfo = CATEGORY_INFO[card.category];
  const [imgLoaded, setImgLoaded] = useState(false);
  // Viewport-aware card sizes: phone (<480) / desktop (480-767) / tablet (>=768, e.g., iPad mini)
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1024;
  const isMobile = vw < 480;
  const isTablet = vw >= 768;
  const w = size === 'sm'
    ? (isMobile ? 80 : isTablet ? 180 : 120)
    : size === 'battle'
      ? (isMobile ? 110 : isTablet ? 280 : 180)
      : (isTablet ? 340 : 200);
  const h = size === 'sm'
    ? (isMobile ? 112 : isTablet ? 240 : 150)
    : size === 'battle'
      ? (isMobile ? 154 : isTablet ? 392 : 250)
      : (isTablet ? 476 : 260);
  const activeMode = mode ?? 'neutral';
  const atk = (card.attackPower ?? card.power) + atkBonus;
  const def = (card.defensePower ?? card.power) + defBonus;
  const isBig = size !== 'sm';
  const fontPower = size === 'sm'
    ? (isMobile ? '10px' : isTablet ? '16px' : '12px')
    : size === 'battle'
      ? (isMobile ? '14px' : isTablet ? '28px' : '20px')
      : (isTablet ? '26px' : '18px');
  const frameImg = CARD_RARITY_IMAGES[card.rarity] || CARD_RARITY_IMAGES['N'];

  return (
    <div
      className={`inline-block rounded-xl p-0 relative overflow-hidden ${isWinner ? 'kc-win-glow' : ''} ${onTap ? 'tappable cursor-pointer' : ''}`}
      onClick={onTap}
      style={{
        background: '#0b1128',
        boxShadow: isWinner
          ? '0 0 24px rgba(255,215,0,0.55), 0 0 48px rgba(255,215,0,0.25), 0 6px 20px rgba(0,0,0,0.5)'
          : card.rarity === 'SSR' ? '0 0 12px rgba(255,215,0,0.5), 0 0 24px rgba(255,215,0,0.2), 0 6px 20px rgba(0,0,0,0.5)'
          : card.rarity === 'SR' ? '0 0 8px rgba(255,215,0,0.3), 0 6px 20px rgba(0,0,0,0.5)'
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
      {/* Card shine effect (R and above) */}
      {card.rarity !== 'N' && (
        <div className={`absolute inset-0 pointer-events-none ${card.rarity === 'SSR' ? 'kc-card-shine-ssr' : 'kc-card-shine'}`} style={{ zIndex: 2 }} />
      )}
      {/* Card name (on top of frame) */}
      <span
        className="absolute left-0 right-0 text-center font-bold text-white truncate px-2"
        style={{
          bottom: isBig ? (isTablet ? '48px' : '30px') : (isTablet ? '34px' : '22px'),
          fontSize: isBig ? (isTablet ? '24px' : '16px') : (isTablet ? '16px' : '11px'),
          textShadow: '0 2px 6px rgba(0,0,0,0.95), 0 0 3px rgba(0,0,0,0.8)',
          zIndex: 3,
        }}
      >
        {card.name}
      </span>
      {/* ⚔️ Attack badge (left-bottom, aligned with frame icon) */}
      {(() => {
        const hasBuff = atkBonus > 0;
        const hasDebuff = atkBonus < 0;
        const buffScale = hasBuff ? (atkBonus >= 5 ? 1.5 : atkBonus >= 3 ? 1.3 : 1.2) : hasDebuff ? 0.9 : 1;
        const bg = hasBuff ? 'rgba(34,197,94,0.9)'
          : hasDebuff ? 'rgba(100,30,30,0.9)'
          : activeMode === 'attack' ? 'rgba(239,68,68,0.9)' : activeMode === 'defense' ? 'rgba(80,80,90,0.7)' : 'rgba(239,68,68,0.7)';
        const glow = hasBuff ? '0 0 12px rgba(34,197,94,0.7)' : activeMode === 'attack' ? '0 0 12px rgba(239,68,68,0.7)' : 'none';
        return (
          <span
            className={`absolute flex items-center gap-0.5 px-1.5 py-0.5 rounded-md font-black ${hasBuff ? 'kc-buff-pulse' : ''}`}
            style={{
              bottom: isBig ? '8px' : '4px', left: isBig ? '8%' : '10%',
              background: bg, color: activeMode === 'defense' && !hasBuff ? 'rgba(255,255,255,0.45)' : '#fff',
              fontSize: fontPower, lineHeight: 1, zIndex: 3,
              textShadow: hasBuff ? '0 0 10px rgba(34,197,94,0.95)' : activeMode === 'attack' ? '0 0 10px rgba(255,107,107,0.95)' : '0 1px 2px rgba(0,0,0,0.9)',
              boxShadow: glow, transform: `scale(${buffScale})`, transition: 'transform 0.3s, background 0.3s, box-shadow 0.3s',
            }}
          >
            ⚔️{atk}{hasBuff && ` (+${atkBonus})`}{hasDebuff && ` (${atkBonus})`}
          </span>
        );
      })()}
      {/* 🛡️ Defense badge (right-bottom, aligned with frame icon) */}
      {(() => {
        const hasBuff = defBonus > 0;
        const hasDebuff = defBonus < 0;
        const buffScale = hasBuff ? (defBonus >= 5 ? 1.5 : defBonus >= 3 ? 1.3 : 1.2) : hasDebuff ? 0.9 : 1;
        const bg = hasBuff ? 'rgba(20,184,166,0.9)'
          : hasDebuff ? 'rgba(100,30,30,0.9)'
          : activeMode === 'defense' ? 'rgba(59,130,246,0.9)' : activeMode === 'attack' ? 'rgba(80,80,90,0.7)' : 'rgba(59,130,246,0.7)';
        const glow = hasBuff ? '0 0 12px rgba(20,184,166,0.7)' : activeMode === 'defense' ? '0 0 12px rgba(59,130,246,0.7)' : 'none';
        return (
          <span
            className={`absolute flex items-center gap-0.5 px-1.5 py-0.5 rounded-md font-black ${hasBuff ? 'kc-buff-pulse' : ''}`}
            style={{
              bottom: isBig ? '8px' : '4px', right: isBig ? '8%' : '10%',
              background: bg, color: activeMode === 'attack' && !hasBuff ? 'rgba(255,255,255,0.45)' : '#fff',
              fontSize: fontPower, lineHeight: 1, zIndex: 3,
              textShadow: hasBuff ? '0 0 10px rgba(20,184,166,0.95)' : activeMode === 'defense' ? '0 0 10px rgba(96,165,250,0.95)' : '0 1px 2px rgba(0,0,0,0.9)',
              boxShadow: glow, transform: `scale(${buffScale})`, transition: 'transform 0.3s, background 0.3s, box-shadow 0.3s',
            }}
          >
            🛡️{def}{hasBuff && ` (+${defBonus})`}{hasDebuff && ` (${defBonus})`}
          </span>
        );
      })()}
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
  const isMobileDeck = typeof window !== 'undefined' && window.innerWidth < 480;
  const W = isMobileDeck ? 50 : 70;
  const H = isMobileDeck ? 70 : 100;
  const thickness = count >= 10 ? 3 : count >= 5 ? 2 : count >= 2 ? 1 : 0;
  const isDanger = count > 0 && count <= 3;
  return (
    <button
      onClick={interactive && count > 0 ? onTap : undefined}
      disabled={!interactive || count === 0}
      className={`relative ${glow && count > 0 ? 'kc-deck-stack' : ''} ${interactive && count > 0 ? 'deck-invite' : ''} ${interactive ? 'active:scale-95' : ''} transition-transform`}
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
      {isDanger && count > 0 && (
        <div className="absolute inset-0 rounded-md kc-danger-pulse z-10 pointer-events-none"
          style={{ border: '2px solid rgba(239,68,68,0.6)' }} />
      )}
      {[2, 1, 0].filter(l => l <= thickness).map((layer) => (
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
      {isDanger && count > 0 && (
        <p className="absolute -bottom-4 left-0 right-0 text-center text-[9px] font-black text-red-400 animate-pulse">
          残り{count}枚！
        </p>
      )}
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
