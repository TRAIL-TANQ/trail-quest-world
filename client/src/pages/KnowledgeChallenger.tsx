/**
 * Knowledge Challenger - Card Battle Game UI
 * フラッグ奪い合い方式のカードバトルゲーム
 * Dark Navy + Gold RPG aesthetic
 *
 * UI/UX大幅改善:
 * 1. バトルフィールド可視化（フラッグアイコン、攻撃スライド、防御シールド）
 * 2. パワーバー（攻撃vs防御リアルタイム比較、フラッグ奪取フラッシュ）
 * 3. ベンチ常時表示（5スロット、カード名・枚数、警告表示）
 * 4. 勝敗演出（大きな理由表示、トロフィー/暗転、再挑戦ボタン）
 * 5. ターン表示（バナー型ターンインジケーター）
 * 6. バトルログ（スクロール式、展開/折りたたみ）
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'wouter';
import { useUserStore, useGameStore, useAltStore } from '@/lib/stores';
import {
  type BattleCard,
  type Quiz,
  CATEGORY_INFO,
  RARITY_INFO,
  createInitialDeck,
  createAIDeck,
  validateDeck,
  DECK_SIZE,
  MAX_SSR,
  MAX_SR,
  MAX_SAME_NAME,
  ALL_BATTLE_CARDS,
} from '@/lib/knowledgeCards';
import {
  type GameState,
  initGameState,
  playerDrawCard,
  processQuizAnswer,
  aiTurn,
} from '@/lib/knowledgeEngine';
import {
  processQuizResult,
  fetchChildStatus,
  type QuizRewardResult,
  type ChildStatus,
} from '@/lib/quizService';

type ScreenPhase = 'title' | 'playing' | 'result';

export default function KnowledgeChallenger() {
  const [, navigate] = useLocation();
  const addTotalAlt = useUserStore((s) => s.addTotalAlt);
  const setLastResult = useGameStore((s) => s.setLastResult);
  const triggerEarnEffect = useAltStore((s) => s.triggerEarnEffect);

  const [screen, setScreen] = useState<ScreenPhase>('title');
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [imagesPreloaded, setImagesPreloaded] = useState(false);
  const [preloadProgress, setPreloadProgress] = useState(0);
  const imageCache = useRef<Map<string, HTMLImageElement>>(new Map());
  const [selectedQuiz, setSelectedQuiz] = useState<Quiz | null>(null);
  const [quizTimer, setQuizTimer] = useState(10);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [aiAnimating, setAiAnimating] = useState(false);
  const [showCardReveal, setShowCardReveal] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef(0);

  // Power add effect state
  const [powerAddEffect, setPowerAddEffect] = useState<{ value: number; key: number } | null>(null);
  const powerEffectKey = useRef(0);

  // Winning card glow effect
  const [showWinGlow, setShowWinGlow] = useState(false);

  // Supabase ALT/XP tracking
  const userId = useUserStore((s) => s.user.id);
  const [altBalance, setAltBalance] = useState<number | null>(null);
  const [xpTotal, setXpTotal] = useState<number>(0);
  const [xpLevel, setXpLevel] = useState<number>(1);
  const [consecutiveCorrect, setConsecutiveCorrect] = useState(0);
  const [altRewardPopup, setAltRewardPopup] = useState<{ alt: number; xp: number; streak: boolean; rarity: boolean; key: number } | null>(null);
  const altPopupKey = useRef(0);

  // Flag capture flash
  const [flagFlash, setFlagFlash] = useState(false);

  // Attack animation state
  const [attackSlide, setAttackSlide] = useState(false);

  // Game over overlay
  const [showGameOverOverlay, setShowGameOverOverlay] = useState(false);

  // Enhanced battle cinematics
  const [battleOutcome, setBattleOutcome] = useState<'victory' | 'defeat' | null>(null);
  const [screenShake, setScreenShake] = useState(false);
  const [sideBurst, setSideBurst] = useState<'player' | 'ai' | null>(null);
  const [flagMoveAnim, setFlagMoveAnim] = useState<'toPlayer' | 'toAi' | null>(null);
  const [aiPowerPopKey, setAiPowerPopKey] = useState(0);

  // Nuke / SSR cinematics
  const [showNukeFlash, setShowNukeFlash] = useState(false);
  const [showNukeFailed, setShowNukeFailed] = useState(false);
  const [showSSRReveal, setShowSSRReveal] = useState(false);

  // Quiz effect telop
  type QuizTelopType = 'attack' | 'defense' | 'bench' | 'special' | 'ssr' | 'fail';
  interface QuizTelop {
    step: 'flash' | 'effect';
    correct: boolean;
    label: string;
    type: QuizTelopType;
    bonusPower: number;
  }
  const [quizTelop, setQuizTelop] = useState<QuizTelop | null>(null);

  // Preview deck (built on mount for title screen)
  const [previewDeck, setPreviewDeck] = useState<BattleCard[] | null>(null);
  useEffect(() => {
    if (!previewDeck) setPreviewDeck(createInitialDeck());
  }, [previewDeck]);
  const previewValidation = previewDeck ? validateDeck(previewDeck) : null;
  const rebuildPreviewDeck = useCallback(() => { setPreviewDeck(createInitialDeck()); }, []);

  // ===== Battle Cinematic State Machine =====
  type BattleStep =
    | 'none'
    | 'intro'        // "相手の攻撃！" / "あなたの攻撃！"
    | 'card_back'    // face-down card (AI only)
    | 'card_flip'    // flip animation
    | 'card_reveal'  // name + power big display
    | 'compare'      // "自分:X vs 相手:Y"
    | 'outcome';     // win/lose flourish
  interface BattleSeq {
    attackerSide: 'player' | 'ai';
    attackerName: string;
    attackerPower: number;
    attackerImage?: string;
    defenderName: string;
    defenderPower: number;
    attackerWins: boolean;
    decisive: boolean;
  }
  const [battleStep, setBattleStep] = useState<BattleStep>('none');
  const [battleSeq, setBattleSeq] = useState<BattleSeq | null>(null);
  const [fastMode, setFastMode] = useState(false);
  const fastModeRef = useRef(false);
  useEffect(() => { fastModeRef.current = fastMode; }, [fastMode]);
  const stepTimeoutsRef = useRef<number[]>([]);
  const pendingSkipRef = useRef<(() => void) | null>(null);
  const clearStepTimeouts = useCallback(() => {
    stepTimeoutsRef.current.forEach((id) => clearTimeout(id));
    stepTimeoutsRef.current = [];
  }, []);
  const scheduleStep = useCallback((delayMs: number, fn: () => void) => {
    const scale = fastModeRef.current ? 0.3 : 1;
    const id = window.setTimeout(fn, Math.max(100, delayMs * scale));
    stepTimeoutsRef.current.push(id);
  }, []);
  const skipCinematic = useCallback(() => {
    const action = pendingSkipRef.current;
    if (!action) return;
    clearStepTimeouts();
    action();
    pendingSkipRef.current = null;
  }, [clearStepTimeouts]);

  // Battle log expanded
  const [logExpanded, setLogExpanded] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  // Fetch ALT balance from Supabase on mount
  useEffect(() => {
    fetchChildStatus(userId).then((status) => {
      if (status) {
        setAltBalance(status.alt_points);
        setXpTotal(status.xp);
        setXpLevel(status.level);
      }
    });
  }, [userId]);

  // Preload all card images on mount
  useEffect(() => {
    const urls = ALL_BATTLE_CARDS.map((c) => c.imageUrl).filter(Boolean);
    let loaded = 0;
    const total = urls.length;
    if (total === 0) {
      setImagesPreloaded(true);
      return;
    }
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

  // Auto-scroll battle log
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [gameState?.log.length, logExpanded]);

  /* ---------- Start game ---------- */
  const startGame = useCallback(() => {
    clearStepTimeouts();
    const playerDeck = previewDeck && validateDeck(previewDeck).valid ? previewDeck : createInitialDeck();
    const aiDeck = createAIDeck();
    const state = initGameState(playerDeck, aiDeck);
    setGameState(state);
    setScreen('playing');
    startTimeRef.current = Date.now();
    setShowWinGlow(false);
    setPowerAddEffect(null);
    setFlagFlash(false);
    setAttackSlide(false);
    setShowGameOverOverlay(false);
    setLogExpanded(false);
    setBattleStep('none');
    setBattleSeq(null);
  }, [clearStepTimeouts, previewDeck]);

  /* ---------- Draw card ---------- */
  const handleDraw = useCallback(() => {
    if (!gameState || gameState.phase !== 'player_draw') return;
    const newState = playerDrawCard(gameState);
    setGameState(newState);

    // SSR reveal effect
    if (newState.ssrRevealSide === 'player') {
      setShowSSRReveal(true);
      setTimeout(() => setShowSSRReveal(false), 1500);
    }

    // Nuke combo effects
    if (newState.nukeAnimation === 'triggered') {
      setShowNukeFlash(true);
      setTimeout(() => setShowNukeFlash(false), 2800);
      triggerWinEffect('player');
      triggerAttackSlide();
      // After nuke animation, continue to AI turn or game over
      if (newState.phase === 'ai_turn') {
        setTimeout(() => processAITurn(newState), 3000);
      } else if (newState.phase === 'game_over') {
        setTimeout(() => {
          setShowGameOverOverlay(true);
          setTimeout(() => setScreen('result'), 2500);
        }, 2800);
      }
      return;
    }
    if (newState.nukeAnimation === 'failed') {
      setShowNukeFailed(true);
      setTimeout(() => setShowNukeFailed(false), 1500);
    }

    if (newState.phase === 'quiz' && newState.playerCard) {
      const quizStartDelay = newState.nukeAnimation === 'failed' ? 1500 : 0;
      setTimeout(() => {
        const quizzes = newState.playerCard!.quizzes;
        const quiz = quizzes[Math.floor(Math.random() * quizzes.length)];
        setSelectedQuiz(quiz);
        setQuizTimer(10);
        setSelectedAnswer(null);
        setShowResult(false);
        setShowCardReveal(true);
        setTimeout(() => setShowCardReveal(false), 800);
      }, quizStartDelay);
    }
    if (newState.phase === 'game_over') {
      setShowGameOverOverlay(true);
      setTimeout(() => setScreen('result'), 2500);
    }
  }, [gameState]);

  /* ---------- Quiz timer ---------- */
  useEffect(() => {
    if (!gameState || gameState.phase !== 'quiz' || showCardReveal) return;
    timerRef.current = setInterval(() => {
      setQuizTimer((t) => {
        if (t <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          handleQuizTimeout();
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [gameState?.phase, showCardReveal]);

  const triggerPowerEffect = useCallback((power: number) => {
    if (power > 0) {
      powerEffectKey.current++;
      setPowerAddEffect({ value: power, key: powerEffectKey.current });
      setTimeout(() => setPowerAddEffect(null), 1200);
    }
  }, []);

  const triggerFlagFlash = useCallback(() => {
    setFlagFlash(true);
    setTimeout(() => setFlagFlash(false), 1500);
  }, []);

  const triggerAttackSlide = useCallback(() => {
    setAttackSlide(true);
    setTimeout(() => setAttackSlide(false), 600);
  }, []);

  const triggerWinEffect = useCallback((side: 'player' | 'ai') => {
    setShowWinGlow(true);
    triggerFlagFlash();
    // Screen shake (defeat shakes harder feel, but use same effect)
    setScreenShake(true);
    setTimeout(() => setScreenShake(false), 700);
    // Burst on loser side
    setSideBurst(side === 'player' ? 'ai' : 'player');
    setTimeout(() => setSideBurst(null), 900);
    // Battle outcome overlay
    setBattleOutcome(side === 'player' ? 'victory' : 'defeat');
    setTimeout(() => setBattleOutcome(null), 1800);
    // Flag move to winner
    setFlagMoveAnim(side === 'player' ? 'toPlayer' : 'toAi');
    setTimeout(() => setFlagMoveAnim(null), 1500);
    setTimeout(() => setShowWinGlow(false), 2500);
  }, []);

  // Forward ref for processAITurn (defined below, referenced here to avoid ordering issues)
  const processAITurnRef = useRef<((state: GameState) => void) | null>(null);

  /* ---------- Player attack cinematic ---------- */
  const runPlayerCinematic = useCallback(
    (newState: GameState, priorState: GameState) => {
      const attackerCard = priorState.playerCard;
      const defenderCard = priorState.aiCard;
      const attackerWins = newState.winningCardSide === 'player';
      const decisive = attackerWins;
      const attackerPower = newState.playerPowerTotal > 0 ? newState.playerPowerTotal : (priorState.playerPowerTotal + newState.lastAddedPower);
      if (!attackerCard || !defenderCard) {
        setGameState(newState);
        if (newState.phase === 'ai_turn') processAITurnRef.current?.(newState);
        else if (newState.phase === 'game_over') {
          setShowGameOverOverlay(true);
          setTimeout(() => setScreen('result'), 2500);
        }
        return;
      }
      setBattleSeq({
        attackerSide: 'player',
        attackerName: attackerCard.name,
        attackerPower,
        attackerImage: attackerCard.imageUrl,
        defenderName: defenderCard.name,
        defenderPower: defenderCard.power,
        attackerWins,
        decisive,
      });
      // Player card already revealed → skip card_back / card_flip / card_reveal, jump to compare
      setBattleStep('intro');
      scheduleStep(1000, () => setBattleStep('compare'));
      scheduleStep(2200, () => {
        setBattleStep('outcome');
        setGameState(newState);
        triggerPowerEffect(newState.lastAddedPower);
        if (attackerWins) {
          triggerAttackSlide();
          triggerWinEffect('player');
        }
      });
      scheduleStep(3800, () => {
        setBattleStep('none');
        setBattleSeq(null);
        pendingSkipRef.current = null;
        if (newState.phase === 'ai_turn') processAITurnRef.current?.(newState);
        else if (newState.phase === 'game_over') {
          setShowGameOverOverlay(true);
          setTimeout(() => setScreen('result'), 2500);
        }
      });
      // Skip action: finalize immediately
      pendingSkipRef.current = () => {
        setBattleStep('none');
        setBattleSeq(null);
        setGameState(newState);
        triggerPowerEffect(newState.lastAddedPower);
        if (attackerWins) {
          triggerAttackSlide();
          triggerWinEffect('player');
        }
        pendingSkipRef.current = null;
        if (newState.phase === 'ai_turn') {
          window.setTimeout(() => processAITurnRef.current?.(newState), 200);
        } else if (newState.phase === 'game_over') {
          setShowGameOverOverlay(true);
          window.setTimeout(() => setScreen('result'), 2500);
        }
      };
    },
    [scheduleStep],
  );

  // Play quiz effect telop, then run the player cinematic
  const playQuizTelop = useCallback((correct: boolean, newState: GameState, priorState: GameState) => {
    const card = priorState.playerCard;
    const bonusPower = Math.max(0, newState.lastAddedPower - (card?.power ?? 0));
    let type: QuizTelopType = 'fail';
    let label = '効果は発動しなかった...';
    if (correct && card) {
      if (card.rarity === 'SSR') { type = 'ssr'; label = '✨ SSR効果 発動！ ✨'; }
      else if (card.specialEffect) { type = 'special'; label = '✨ 特殊効果 発動！'; }
      else if (card.category === 'heritage' || (card.category === 'invention' && card.rarity === 'R')) {
        type = 'defense';
        label = bonusPower > 0 ? `🛡️ 防御パワー +${bonusPower}！` : '🛡️ 防御効果 発動！';
      }
      else if (card.category === 'great_person' && priorState.player.bench.length > 0) {
        type = 'bench'; label = `📋 ベンチ効果 発動！ +${bonusPower}`;
      }
      else {
        type = 'attack';
        label = bonusPower > 0 ? `⚔️ 攻撃パワー +${bonusPower}！` : `⚔️ パワー +${card.correctBonus}！`;
      }
    }
    // Step 1: flash (1s)
    setQuizTelop({ step: 'flash', correct, label, type, bonusPower });
    const telopScale = fastModeRef.current ? 0.35 : 1;
    window.setTimeout(() => {
      // Step 2: effect text (1.5s for correct, 1s for wrong)
      setQuizTelop({ step: 'effect', correct, label, type, bonusPower });
    }, 1000 * telopScale);
    window.setTimeout(() => {
      setQuizTelop(null);
      setSelectedQuiz(null);
      setShowResult(false);
      setSelectedAnswer(null);
      runPlayerCinematic(newState, priorState);
    }, (correct ? 2500 : 2000) * telopScale);
  }, [runPlayerCinematic]);

  const handleQuizTimeout = useCallback(() => {
    if (!gameState) return;
    setSelectedAnswer(-1);
    setShowResult(true);
    // 不正解: 連続正解リセット
    setConsecutiveCorrect(0);
    // Supabase保存（タイムアウト = 不正解）
    if (gameState.playerCard) {
      processQuizResult({
        childId: userId,
        quizId: `${gameState.playerCard.id}-timeout`,
        selectedIndex: -1,
        isCorrect: false,
        consecutiveCorrect: 0,
        cardRarity: gameState.playerCard.rarity,
      });
    }
    window.setTimeout(() => {
      const newState = processQuizAnswer(gameState, false);
      playQuizTelop(false, newState, gameState);
    }, 900);
  }, [gameState, userId, playQuizTelop]);

  /* ---------- Answer quiz ---------- */
  const handleAnswer = useCallback(
    (answerIndex: number) => {
      if (!gameState || !selectedQuiz || selectedAnswer !== null) return;
      if (timerRef.current) clearInterval(timerRef.current);
      setSelectedAnswer(answerIndex);
      setShowResult(true);
      const correct = answerIndex === selectedQuiz.correctIndex;

      // 連続正解トラッキング
      const newConsecutive = correct ? consecutiveCorrect + 1 : 0;
      setConsecutiveCorrect(newConsecutive);

      // Supabase保存（非同期、UIはブロックしない）
      if (gameState.playerCard) {
        processQuizResult({
          childId: userId,
          quizId: `${gameState.playerCard.id}-q${Math.floor(Math.random() * 1000)}`,
          selectedIndex: answerIndex,
          isCorrect: correct,
          consecutiveCorrect: newConsecutive,
          cardRarity: gameState.playerCard.rarity,
        }).then((reward) => {
          if (reward) {
            setAltBalance(reward.newAltTotal);
            setXpTotal(reward.newXpTotal);
            setXpLevel(reward.newLevel);
            if (reward.altEarned > 0) {
              addTotalAlt(reward.altEarned);
            }
            if (reward.altEarned > 0) {
              altPopupKey.current++;
              setAltRewardPopup({
                alt: reward.altEarned,
                xp: reward.xpEarned,
                streak: reward.streakBonus,
                rarity: reward.rarityBonus,
                key: altPopupKey.current,
              });
              setTimeout(() => setAltRewardPopup(null), 2500);
            }
          }
        });
      }

      window.setTimeout(() => {
        const newState = processQuizAnswer(gameState, correct);
        playQuizTelop(correct, newState, gameState);
      }, 1100);
    },
    [gameState, selectedQuiz, selectedAnswer, consecutiveCorrect, userId, addTotalAlt, playQuizTelop],
  );

  /* ---------- AI turn (step-by-step cinematic) ---------- */
  const processAITurn = useCallback((state: GameState) => {
    setAiAnimating(true);
    // Pre-compute the AI turn outcome
    const result = aiTurn(state);

    // Defender = player's card at the start of AI turn
    const defender = state.playerCard;
    // Decisive card = AI's decisive card (the one that settled the battle)
    // If aiAttackCards is non-empty, use the last card; else fall back to result.aiCard
    const decisiveCard =
      result.aiAttackCards && result.aiAttackCards.length > 0
        ? result.aiAttackCards[result.aiAttackCards.length - 1]
        : result.aiCard ?? null;
    const attackerPower = result.aiAttackTotal;
    const defenderPower = defender?.power ?? 0;
    const attackerWins = result.winningCardSide === 'ai';

    // If there's no meaningful card (edge case: empty deck → game_over), just apply immediately
    if (!decisiveCard) {
      setGameState(result);
      setAiAnimating(false);
      if (result.phase === 'game_over') {
        setShowGameOverOverlay(true);
        setTimeout(() => setScreen('result'), 2500);
      }
      return;
    }

    setBattleSeq({
      attackerSide: 'ai',
      attackerName: decisiveCard.name,
      attackerPower,
      attackerImage: decisiveCard.imageUrl,
      defenderName: defender?.name ?? '???',
      defenderPower,
      attackerWins,
      decisive: true,
    });

    // Step 1: intro (1s)
    setBattleStep('intro');
    // Step 2: card_back (0.5s after intro)
    scheduleStep(1000, () => setBattleStep('card_back'));
    // Step 3: card_flip (0.6s)
    scheduleStep(1600, () => setBattleStep('card_flip'));
    // Step 4: card_reveal (0.6s)
    scheduleStep(2200, () => setBattleStep('card_reveal'));
    // Step 5: compare (1.5s)
    scheduleStep(3000, () => setBattleStep('compare'));
    // Step 6: outcome — apply state + effects (2s)
    scheduleStep(4500, () => {
      setBattleStep('outcome');
      setGameState(result);
      setAiPowerPopKey((k) => k + 1);
      if (attackerWins) {
        triggerAttackSlide();
        triggerWinEffect('ai');
      }
    });
    // Cleanup cinematic
    scheduleStep(6500, () => {
      setBattleStep('none');
      setBattleSeq(null);
      setAiAnimating(false);
      pendingSkipRef.current = null;
      if (result.phase === 'game_over') {
        setShowGameOverOverlay(true);
        setTimeout(() => setScreen('result'), 2500);
      }
    });
    // Skip action: jump straight to outcome
    pendingSkipRef.current = () => {
      setBattleStep('none');
      setBattleSeq(null);
      setGameState(result);
      setAiPowerPopKey((k) => k + 1);
      if (attackerWins) {
        triggerAttackSlide();
        triggerWinEffect('ai');
      }
      setAiAnimating(false);
      pendingSkipRef.current = null;
      if (result.phase === 'game_over') {
        setShowGameOverOverlay(true);
        window.setTimeout(() => setScreen('result'), 2500);
      }
    };
  }, [scheduleStep]);

  // Keep the ref in sync so runPlayerCinematic can call it without circular deps
  useEffect(() => { processAITurnRef.current = processAITurn; }, [processAITurn]);

  /* ---------- Finish ---------- */
  const handleFinish = useCallback(() => {
    if (!gameState) return;
    const timeSeconds = Math.floor((Date.now() - startTimeRef.current) / 1000);
    const won = gameState.winner === 'player';
    const altReward = won ? 30 : 5;
    addTotalAlt(altReward);
    triggerEarnEffect(altReward);
    setLastResult({ score: won ? 100 : 30, maxScore: 100, timeSeconds, accuracy: won ? 1 : 0.3, isBestScore: won });
    navigate('/result');
  }, [gameState, addTotalAlt, triggerEarnEffect, setLastResult, navigate]);

  // ===================== TITLE SCREEN =====================
  if (screen === 'title') {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center px-6"
        style={{ background: 'linear-gradient(180deg, #0b1128 0%, #151d3b 50%, #0e1430 100%)' }}
      >
        <div
          className="absolute top-1/4 left-1/2 -translate-x-1/2 w-64 h-64 rounded-full blur-3xl"
          style={{ background: 'rgba(255,215,0,0.05)' }}
        />
        <div
          className="relative rounded-2xl p-6 w-full max-w-sm text-center overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, rgba(21,29,59,0.95), rgba(14,20,45,0.95))',
            border: '2px solid rgba(255,215,0,0.35)',
            boxShadow: 'inset 0 0 30px rgba(255,215,0,0.05), 0 8px 32px rgba(0,0,0,0.5)',
          }}
        >
          <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2" style={{ borderColor: 'rgba(255,215,0,0.6)' }} />
          <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2" style={{ borderColor: 'rgba(255,215,0,0.6)' }} />
          <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2" style={{ borderColor: 'rgba(255,215,0,0.6)' }} />
          <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2" style={{ borderColor: 'rgba(255,215,0,0.6)' }} />

          <span className="text-5xl block mb-3">⚔️</span>
          <h1 className="text-xl font-bold mb-1" style={{ color: '#ffd700', textShadow: '0 0 15px rgba(255,215,0,0.3)' }}>
            ナレッジ・チャレンジャー
          </h1>
          <p className="text-amber-200/50 text-xs mb-5">知識の力でフラッグを奪え！カードバトル</p>

          <div className="rounded-xl p-3 mb-3" style={{ background: 'rgba(255,215,0,0.05)', border: '1px solid rgba(255,215,0,0.15)' }}>
            <p className="text-amber-200/60 text-[11px] text-left leading-relaxed">
              <span className="text-amber-100 font-bold">ルール：</span>
              <br />
              ・デッキ: {DECK_SIZE}枚 / 同名{MAX_SAME_NAME}枚まで / SSR:{MAX_SSR}、SR:{MAX_SR}
              <br />
              ・4択クイズに正解でパワーアップ
              <br />
              ・攻撃側 ≥ 防御側 でフラッグ奪取
              <br />
              ・ベンチ5種類埋まるかデッキ切れで敗北
            </p>
          </div>

          {/* Deck Validation Panel */}
          {previewValidation && (
            <div
              className="rounded-xl p-3 mb-3 text-left"
              style={{
                background: previewValidation.valid ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
                border: `2px solid ${previewValidation.valid ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.5)'}`,
              }}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-black text-amber-100">🃏 デッキ</span>
                <span
                  className="text-lg font-black"
                  style={{
                    color: previewValidation.valid ? '#4ade80' : '#ff6b6b',
                    textShadow: '0 1px 3px rgba(0,0,0,0.8)',
                  }}
                >
                  {previewValidation.totalCount}/{DECK_SIZE}枚
                  {!previewValidation.valid && previewValidation.totalCount < DECK_SIZE && (
                    <span className="text-xs ml-1">あと{DECK_SIZE - previewValidation.totalCount}枚</span>
                  )}
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
              <p className="text-[9px] text-amber-200/35 mb-1">難易度</p>
              <div className="flex gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <span key={i} className="text-xs" style={{ color: i < 2 ? '#ffd700' : 'rgba(255,255,255,0.12)' }}>
                    ★
                  </span>
                ))}
              </div>
            </div>
            <div className="text-center">
              <p className="text-[9px] text-amber-200/35 mb-1">報酬</p>
              <span className="text-sm font-bold" style={{ color: '#ffd700' }}>
                +30 ALT
              </span>
            </div>
            <div className="text-center">
              <p className="text-[9px] text-amber-200/35 mb-1">ベンチ</p>
              <span className="text-sm font-bold text-amber-100">5枠</span>
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

  // ===================== RESULT SCREEN =====================
  if (screen === 'result' && gameState) {
    const won = gameState.winner === 'player';
    const lossReason = gameState.message;
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center px-6 relative"
        style={{ background: 'linear-gradient(180deg, #0b1128 0%, #151d3b 100%)' }}
      >
        {!won && (
          <div className="absolute inset-0 z-0" style={{ background: 'rgba(0,0,0,0.4)' }} />
        )}

        <div
          className="rounded-2xl p-6 w-full max-w-sm text-center relative overflow-hidden z-10"
          style={{
            background: 'linear-gradient(135deg, rgba(21,29,59,0.95), rgba(14,20,45,0.95))',
            border: `2px solid ${won ? 'rgba(255,215,0,0.5)' : 'rgba(239,68,68,0.3)'}`,
            boxShadow: `inset 0 0 30px ${won ? 'rgba(255,215,0,0.08)' : 'rgba(239,68,68,0.05)'}, 0 8px 32px rgba(0,0,0,0.5)`,
          }}
        >
          <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2" style={{ borderColor: won ? 'rgba(255,215,0,0.6)' : 'rgba(239,68,68,0.4)' }} />
          <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2" style={{ borderColor: won ? 'rgba(255,215,0,0.6)' : 'rgba(239,68,68,0.4)' }} />
          <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2" style={{ borderColor: won ? 'rgba(255,215,0,0.6)' : 'rgba(239,68,68,0.4)' }} />
          <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2" style={{ borderColor: won ? 'rgba(255,215,0,0.6)' : 'rgba(239,68,68,0.4)' }} />

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
              {lossReason}
            </p>
          </div>

          <div className="flex items-center justify-center gap-4 mb-4">
            <div className="text-center px-3 py-2 rounded-lg" style={{ background: 'rgba(255,215,0,0.08)' }}>
              <p className="text-[9px] text-amber-200/35 mb-0.5">ラウンド</p>
              <span className="text-lg font-bold text-amber-100">{gameState.round}</span>
            </div>
            <div className="text-center px-3 py-2 rounded-lg" style={{ background: 'rgba(255,215,0,0.08)' }}>
              <p className="text-[9px] text-amber-200/35 mb-0.5">報酬</p>
              <span className="text-lg font-bold" style={{ color: '#ffd700' }}>
                +{won ? 30 : 5} ALT
              </span>
            </div>
          </div>

          <div
            className="rounded-lg p-2 mb-4 max-h-32 overflow-y-auto text-left"
            style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)' }}
          >
            {gameState.log.slice(-8).map((entry, i) => (
              <p key={i} className="text-[10px] text-amber-200/40 leading-relaxed">
                {entry}
              </p>
            ))}
          </div>

          <div className="flex gap-3">
            <button onClick={() => { setScreen('title'); setGameState(null); setShowGameOverOverlay(false); }} className="rpg-btn rpg-btn-blue flex-1 py-3">
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

  // ===================== PLAYING SCREEN =====================
  if (!gameState) return null;

  const isPlayerAttacking = gameState.flagHolder === 'ai';

  const defenderPower = isPlayerAttacking
    ? (gameState.aiCard?.power ?? 0)
    : (gameState.playerCard?.power ?? 0);
  const attackerPower = isPlayerAttacking
    ? gameState.playerPowerTotal
    : gameState.aiAttackTotal;
  const powerBarPercent = defenderPower > 0
    ? Math.min(100, Math.round((attackerPower / defenderPower) * 100))
    : 0;

  return (
    <div className={`min-h-screen flex flex-col relative ${screenShake ? 'kc-screen-shake' : ''}`} style={{ background: 'linear-gradient(180deg, #0b1128 0%, #131b38 50%, #0e1430 100%)' }}>
      {flagFlash && <div className="kc-flag-flash" />}
      {battleOutcome === 'defeat' && <div className="kc-defeat-flash" />}
      {battleOutcome === 'victory' && <div className="kc-victory-flash" />}

      {/* Battle Outcome Overlay */}
      {battleOutcome && (
        <div className="kc-battle-outcome">
          <span
            className="kc-battle-outcome-text"
            style={{
              color: battleOutcome === 'victory' ? '#22c55e' : '#ef4444',
              textShadow: battleOutcome === 'victory'
                ? '0 0 30px rgba(34,197,94,0.9), 0 0 60px rgba(34,197,94,0.4)'
                : '0 0 30px rgba(239,68,68,0.9), 0 0 60px rgba(239,68,68,0.4)',
            }}
          >
            {battleOutcome === 'victory' ? '🚩 フラッグ奪取！' : '💥 フラッグを奪われた！'}
          </span>
        </div>
      )}

      {/* Side Burst */}
      {sideBurst && <div className={`kc-side-burst kc-side-burst-${sideBurst}`} />}

      {/* ===== Nuke Trigger Cinematic ===== */}
      {showNukeFlash && (
        <>
          <div className="kc-nuke-whiteflash" />
          <div className="kc-nuke-shockwave" />
          <div className="kc-nuke-overlay">
            <div className="kc-nuke-cloud">☁️</div>
            <div className="kc-nuke-mushroom">💥</div>
            <div className="kc-nuke-title">☢️ 原子爆弾 発動！</div>
            <div className="kc-nuke-sub">マンハッタン計画 + トリニティ実験</div>
          </div>
        </>
      )}

      {/* ===== Nuke Failed (不発) ===== */}
      {showNukeFailed && (
        <div className="kc-nuke-failed">
          <span className="kc-nuke-failed-text">💨 不発...条件カードが揃っていない</span>
        </div>
      )}

      {/* ===== Quiz Effect Telop ===== */}
      {quizTelop && (
        <div className={`kc-quiz-telop ${quizTelop.correct ? 'kc-quiz-telop-correct' : 'kc-quiz-telop-wrong'}`}>
          {quizTelop.step === 'flash' ? (
            <div className="kc-quiz-telop-flash-text" style={{ color: quizTelop.correct ? '#22c55e' : '#ef4444' }}>
              {quizTelop.correct ? '✨ 正解！ ✨' : '❌ 不正解...'}
            </div>
          ) : (
            <div className={`kc-quiz-telop-effect kc-telop-${quizTelop.type}`}>
              {quizTelop.label}
            </div>
          )}
        </div>
      )}

      {/* ===== SSR Reveal Cinematic ===== */}
      {showSSRReveal && (
        <div className="kc-ssr-reveal">
          <div className="kc-ssr-lightning-l">⚡</div>
          <div className="kc-ssr-lightning-r">⚡</div>
          <div className="kc-ssr-halo" />
          <div className="kc-ssr-text">✨ SSR ✨</div>
        </div>
      )}

      {/* ===== Step-by-step Battle Cinematic ===== */}
      {battleStep !== 'none' && battleSeq && (
        <div className="kc-cinematic-layer">
          <button
            onClick={skipCinematic}
            className="kc-cinematic-skip"
            style={{ pointerEvents: 'auto' }}
          >
            ⏭ スキップ
          </button>
          <div className={`kc-cinematic-box kc-cinematic-${battleSeq.attackerSide}`}>
            {battleStep === 'intro' && (
              <div className="kc-cine-intro">
                <span className="kc-cine-intro-icon">{battleSeq.attackerSide === 'ai' ? '🤖' : '🗡️'}</span>
                <span
                  className="kc-cine-intro-text"
                  style={{ color: battleSeq.attackerSide === 'ai' ? '#ef4444' : '#22c55e' }}
                >
                  {battleSeq.attackerSide === 'ai' ? '相手の攻撃！' : 'あなたの攻撃！'}
                </span>
              </div>
            )}

            {battleStep === 'card_back' && (
              <div className="kc-cine-card-back">
                <div className="kc-card-back-face">
                  <span className="text-3xl">🎴</span>
                  <p className="text-[10px] text-amber-200/60 mt-1">AIのカード</p>
                </div>
              </div>
            )}

            {battleStep === 'card_flip' && (
              <div className="kc-cine-card-flip">
                <div className="kc-flipper">
                  <div className="kc-flipper-front">
                    <span className="text-3xl">🎴</span>
                  </div>
                  <div className="kc-flipper-back">
                    {battleSeq.attackerImage ? (
                      <img src={battleSeq.attackerImage} alt={battleSeq.attackerName} className="w-full h-full object-cover rounded-lg" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-4xl bg-gradient-to-br from-red-900/40 to-red-700/20 rounded-lg">
                        ⚔️
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {battleStep === 'card_reveal' && (
              <div className="kc-cine-reveal">
                <div className="kc-cine-reveal-card">
                  {battleSeq.attackerImage ? (
                    <img src={battleSeq.attackerImage} alt={battleSeq.attackerName} className="w-full h-full object-cover rounded-lg" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-4xl bg-gradient-to-br from-red-900/40 to-red-700/20 rounded-lg">⚔️</div>
                  )}
                </div>
                <div className="kc-cine-reveal-name">{battleSeq.attackerName}</div>
                <div className="kc-cine-reveal-power">
                  パワー <span className="kc-cine-reveal-power-num">{battleSeq.attackerPower}</span>
                </div>
              </div>
            )}

            {battleStep === 'compare' && (
              <div className="kc-cine-compare">
                <p className="kc-cine-compare-title">⚖️ パワー比較</p>
                <div className="kc-cine-compare-row">
                  <div className="kc-cine-side kc-cine-side-player">
                    <p className="kc-cine-label">自分</p>
                    <p className="kc-cine-num">
                      {battleSeq.attackerSide === 'player' ? battleSeq.attackerPower : battleSeq.defenderPower}
                    </p>
                  </div>
                  <span className="kc-cine-vs">VS</span>
                  <div className="kc-cine-side kc-cine-side-ai">
                    <p className="kc-cine-label">相手</p>
                    <p className="kc-cine-num">
                      {battleSeq.attackerSide === 'ai' ? battleSeq.attackerPower : battleSeq.defenderPower}
                    </p>
                  </div>
                </div>
                <p className="kc-cine-compare-hint">
                  {battleSeq.attackerWins
                    ? (battleSeq.attackerSide === 'ai' ? '相手の勝ち...' : '攻撃成功！')
                    : '攻撃側が足りない！'}
                </p>
              </div>
            )}

            {battleStep === 'outcome' && (
              <div className="kc-cine-outcome">
                {battleSeq.attackerSide === 'ai' ? (
                  battleSeq.attackerWins ? (
                    <>
                      <span className="kc-cine-outcome-icon">💥</span>
                      <span className="kc-cine-outcome-text" style={{ color: '#ef4444' }}>フラッグを奪われた！</span>
                    </>
                  ) : (
                    <>
                      <span className="kc-cine-outcome-icon">🛡️</span>
                      <span className="kc-cine-outcome-text" style={{ color: '#22c55e' }}>防御成功！</span>
                    </>
                  )
                ) : battleSeq.attackerWins ? (
                  <>
                    <span className="kc-cine-outcome-icon">🚩</span>
                    <span className="kc-cine-outcome-text" style={{ color: '#22c55e' }}>フラッグ奪取！</span>
                  </>
                ) : (
                  <>
                    <span className="kc-cine-outcome-icon">💪</span>
                    <span className="kc-cine-outcome-text" style={{ color: '#ffd700' }}>もう一枚重ねる！</span>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {showGameOverOverlay && (
        <div className="kc-game-over-overlay">
          <div className="kc-game-over-content">
            <span className="text-6xl block mb-3 kc-result-icon">
              {gameState.winner === 'player' ? '🏆' : '💀'}
            </span>
            <p
              className="text-2xl font-black"
              style={{
                color: gameState.winner === 'player' ? '#ffd700' : '#ef4444',
                textShadow: `0 0 30px ${gameState.winner === 'player' ? 'rgba(255,215,0,0.5)' : 'rgba(239,68,68,0.5)'}`,
              }}
            >
              {gameState.winner === 'player' ? '勝利！' : '敗北...'}
            </p>
            <p className="text-sm mt-2" style={{ color: 'rgba(255,255,255,0.7)' }}>
              {gameState.message}
            </p>
          </div>
        </div>
      )}

      {/* Header Bar */}
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
            title="演出の速度切替"
          >
            {fastMode ? '⏩ 早送りON' : '⏩ 早送りOFF'}
          </button>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-center">
            <p className="text-[10px] font-bold text-amber-200/50">ラウンド</p>
            <p className="text-xl font-black" style={{ color: '#ffd700', textShadow: '0 0 8px rgba(255,215,0,0.5), 0 1px 2px rgba(0,0,0,0.9)' }}>{gameState.round}</p>
          </div>
          <div
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
            style={{
              background: gameState.flagHolder === 'player' ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)',
              border: `2px solid ${gameState.flagHolder === 'player' ? 'rgba(34,197,94,0.6)' : 'rgba(239,68,68,0.6)'}`,
              boxShadow: `0 0 12px ${gameState.flagHolder === 'player' ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.4)'}`,
            }}
          >
            <span className="text-lg">🚩</span>
            <span className="text-sm font-black" style={{ color: gameState.flagHolder === 'player' ? '#4ade80' : '#ff6b6b', textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}>
              {gameState.flagHolder === 'player' ? 'あなた' : 'AI'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-center">
            <p className="text-[10px] font-bold text-amber-200/50">山札</p>
            <p className={`text-xl font-black ${gameState.player.deck.length === 0 ? 'kc-deck-empty' : 'text-amber-100'}`} style={{ textShadow: '0 1px 2px rgba(0,0,0,0.9)' }}>{gameState.player.deck.length}</p>
          </div>
          <div className="text-center relative">
            <p className="text-[10px] font-bold text-amber-200/50">ALT</p>
            <p className="text-lg font-black" style={{ color: '#ffd700', textShadow: '0 0 6px rgba(255,215,0,0.4), 0 1px 2px rgba(0,0,0,0.9)' }}>
              {altBalance !== null ? altBalance.toLocaleString() : '---'}
            </p>
            {altRewardPopup && (
              <div
                key={altRewardPopup.key}
                className="absolute -bottom-14 left-1/2 z-50 pointer-events-none whitespace-nowrap"
                style={{ animation: 'kcAltRewardFloat 2.5s ease-out forwards', transform: 'translateX(-50%)' }}
              >
                <div className="rounded-lg px-2.5 py-1.5" style={{
                  background: 'linear-gradient(135deg, rgba(255,215,0,0.3), rgba(255,170,0,0.25))',
                  border: '1.5px solid rgba(255,215,0,0.6)',
                  boxShadow: '0 0 20px rgba(255,215,0,0.4)',
                }}>
                  <span className="text-base font-black" style={{ color: '#ffd700', textShadow: '0 0 10px rgba(255,215,0,0.6)' }}>
                    +{altRewardPopup.alt} ALT
                  </span>
                  {altRewardPopup.streak && <span className="text-xs ml-1 font-black text-orange-300">連続ボーナス!</span>}
                  {altRewardPopup.rarity && <span className="text-xs ml-1 font-black text-purple-300">高難度!</span>}
                </div>
                {altRewardPopup.xp > 0 && (
                  <p className="text-xs text-green-400 font-bold mt-0.5 text-center">+{altRewardPopup.xp} XP</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ===== Big Turn Banner ===== */}
      {(() => {
        const isQuiz = gameState.phase === 'quiz';
        const turnType: 'ai' | 'attack' | 'defense' | 'quiz' = aiAnimating ? 'ai' : isQuiz ? 'quiz' : isPlayerAttacking ? 'attack' : 'defense';
        const bannerBg = turnType === 'ai'
          ? 'linear-gradient(90deg, rgba(239,68,68,0.35), rgba(180,30,30,0.55), rgba(239,68,68,0.35))'
          : turnType === 'attack'
            ? 'linear-gradient(90deg, rgba(34,197,94,0.35), rgba(20,140,60,0.55), rgba(34,197,94,0.35))'
            : turnType === 'quiz'
              ? 'linear-gradient(90deg, rgba(255,170,0,0.3), rgba(255,140,0,0.5), rgba(255,170,0,0.3))'
              : 'linear-gradient(90deg, rgba(100,180,255,0.3), rgba(40,100,200,0.55), rgba(100,180,255,0.3))';
        const borderCol = turnType === 'ai' ? 'rgba(239,68,68,0.7)' : turnType === 'attack' ? 'rgba(34,197,94,0.7)' : turnType === 'quiz' ? 'rgba(255,170,0,0.7)' : 'rgba(100,180,255,0.7)';
        const label = turnType === 'ai' ? '🤖 相手の攻撃！' : turnType === 'quiz' ? '❓ クイズ出題中！' : turnType === 'attack' ? '🗡️ あなたの攻撃！' : '🛡️ あなたの防衛！';
        const textColor = turnType === 'ai' ? '#ff6b6b' : turnType === 'attack' ? '#4ade80' : turnType === 'quiz' ? '#ffcc44' : '#5fb8ff';
        return (
          <div
            className="px-4 py-3 flex items-center justify-between shrink-0 relative"
            style={{
              background: bannerBg,
              borderTop: `2px solid ${borderCol}`,
              borderBottom: `2px solid ${borderCol}`,
              boxShadow: `inset 0 0 20px ${borderCol}33`,
            }}
          >
            <div className="flex items-center gap-3 flex-1 justify-center">
              <span
                className={`font-black tracking-wider ${turnType === 'ai' ? 'kc-pulse-text' : ''}`}
                style={{
                  fontSize: '1.75rem',
                  color: textColor,
                  textShadow: `0 0 20px ${textColor}88, 0 3px 0 rgba(0,0,0,0.8), 0 0 8px ${textColor}`,
                  letterSpacing: '0.05em',
                }}
              >
                {label}
              </span>
              {consecutiveCorrect >= 2 && (
                <span className="font-black px-2.5 py-1 rounded-lg" style={{ fontSize: '0.9rem', background: 'rgba(255,170,0,0.3)', color: '#ffaa00', border: '2px solid rgba(255,170,0,0.6)', textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}>
                  🔥 {consecutiveCorrect}連続!
                </span>
              )}
            </div>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex flex-col items-end gap-0.5">
              <span className="text-xs font-bold text-amber-200/70">Lv.{xpLevel}</span>
              <span className="text-[10px] text-amber-200/50">XP:{xpTotal}</span>
            </div>
          </div>
        );
      })()}

      {/* AI Bench */}
      <BenchDisplay side="ai" bench={gameState.ai.bench} deckCount={gameState.ai.deck.length} />

      {/* Battle Field */}
      <div className="flex-1 flex flex-col items-center justify-center px-3 gap-2 relative min-h-0 overflow-hidden py-2">
        {/* AI Side */}
        <div className={`text-center relative ${attackSlide && gameState.winningCardSide === 'ai' ? 'kc-attack-slide-down' : ''}`}>
          {!isPlayerAttacking && gameState.aiAttackCards.length > 0 && (
            <div className="relative inline-block mb-2" style={{ height: `${Math.min(200, 150 + (gameState.aiAttackCards.length - 1) * 12)}px`, width: `${Math.min(220, 140 + (gameState.aiAttackCards.length - 1) * 8)}px` }}>
              {gameState.aiAttackCards.map((card, i) => (
                <div key={card.id + '-' + i} className="absolute" style={{ top: `${i * 12}px`, left: `${i * 6}px`, zIndex: i + 1, transform: `rotate(${(i - Math.floor(gameState.aiAttackCards.length / 2)) * 2}deg)`, transition: 'all 0.4s ease-out' }}>
                  <CardDisplay card={card} size="sm" />
                </div>
              ))}
            </div>
          )}
          {gameState.aiCard && isPlayerAttacking && (
            <div className="relative inline-block">
              <CardDisplay card={gameState.aiCard} isDefense isWinner={showWinGlow && gameState.winningCardSide === 'ai'} />
              <div className="kc-shield-effect" />
            </div>
          )}
          {gameState.aiAttackTotal > 0 && !isPlayerAttacking && (
            <p key={aiPowerPopKey} className="font-black text-red-400 mt-1 kc-power-pop" style={{ fontSize: '1.1rem', textShadow: '0 0 10px rgba(239,68,68,0.6), 0 1px 2px rgba(0,0,0,0.9)' }}>攻撃力: {gameState.aiAttackTotal}</p>
          )}
        </div>

        {/* Center Flag & VS */}
        <div className="flex items-center gap-3 w-full max-w-sm relative">
          <div className="h-0.5 flex-1" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,215,0,0.5))' }} />
          <div className={`kc-flag-big ${gameState.flagHolder === 'player' ? 'kc-flag-big-player' : 'kc-flag-big-ai'} ${flagFlash ? 'kc-flag-pulse' : ''} ${flagMoveAnim === 'toPlayer' ? 'kc-flag-move-to-player' : flagMoveAnim === 'toAi' ? 'kc-flag-move-to-ai' : ''}`}>
            <span className={`text-4xl inline-block ${flagMoveAnim ? 'kc-flag-wave' : ''}`}>🚩</span>
          </div>
          <div className="h-0.5 flex-1" style={{ background: 'linear-gradient(90deg, rgba(255,215,0,0.5), transparent)' }} />
        </div>

        {/* Power Comparison Bar */}
        {(attackerPower > 0 || defenderPower > 0) && (
          <PowerBar attackerPower={attackerPower} defenderPower={defenderPower} isPlayerAttacking={isPlayerAttacking} percent={powerBarPercent} powerAddEffect={powerAddEffect} />
        )}

        {/* Player Side */}
        <div className={`text-center relative ${attackSlide && gameState.winningCardSide === 'player' ? 'kc-attack-slide-up' : ''}`}>
          {isPlayerAttacking && gameState.playerAttackCards.length > 0 && (
            <div className="relative inline-block mb-2" style={{ height: `${Math.min(200, 150 + (gameState.playerAttackCards.length - 1) * 14)}px`, width: `${Math.min(220, 140 + (gameState.playerAttackCards.length - 1) * 8)}px` }}>
              {gameState.playerAttackCards.map((card, i) => (
                <div key={card.id + '-stack-' + i} className="absolute" style={{ top: `${i * 14}px`, left: `${i * 8}px`, zIndex: i + 1, transform: `rotate(${(i - Math.floor(gameState.playerAttackCards.length / 2)) * 2.5}deg)`, transition: 'all 0.4s ease-out', animation: 'kcCardStackIn 0.4s ease-out' }}>
                  <CardDisplay card={card} size="sm" />
                </div>
              ))}
            </div>
          )}
          {gameState.playerCard && (
            <div className="relative inline-block">
              <CardDisplay card={gameState.playerCard} isDefense={!isPlayerAttacking} isWinner={showWinGlow && gameState.winningCardSide === 'player'} />
              {!isPlayerAttacking && <div className="kc-shield-effect" />}
            </div>
          )}
        </div>

        {/* Draw Button */}
        {gameState.phase === 'player_draw' && !aiAnimating && (
          <button onClick={handleDraw} className="rpg-btn rpg-btn-gold px-8 py-3 text-base kc-draw-btn mt-1">
            🃏 カードをめくる！
          </button>
        )}

        {/* AI Animating */}
        {aiAnimating && (
          <div className="text-center mt-1">
            <span className="text-3xl block mb-1 kc-ai-spin">🤖</span>
            <p className="text-amber-200/60 text-xs">AIがカードをめくっています...</p>
          </div>
        )}

        {/* Quiz Phase */}
        {gameState.phase === 'quiz' && gameState.playerCard && selectedQuiz && (
          <div className="w-full max-w-md mt-2">
            {showCardReveal ? (
              <div className="text-center kc-card-reveal">
                <CardDisplay card={gameState.playerCard} />
              </div>
            ) : (
              <>
                <div className="flex items-center justify-center gap-2 mb-2">
                  <CardMini card={gameState.playerCard} />
                  <span className="text-sm font-bold text-amber-200/70">のクイズ！</span>
                </div>
                <div className="rounded-2xl p-4" style={{ background: 'linear-gradient(135deg, rgba(21,29,59,0.98), rgba(14,20,45,0.98))', border: '2px solid rgba(255,215,0,0.4)', boxShadow: '0 8px 32px rgba(0,0,0,0.6), 0 0 24px rgba(255,215,0,0.15)' }}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-bold text-amber-200/70">⏱ 制限時間</span>
                    <span className={`text-2xl font-black ${quizTimer <= 3 ? 'text-red-400 kc-pulse-text' : 'text-amber-100'}`} style={{ textShadow: '0 2px 4px rgba(0,0,0,0.9)' }}>{quizTimer}秒</span>
                  </div>
                  <div className="h-2 rounded-full mb-4" style={{ background: 'rgba(255,255,255,0.08)' }}>
                    <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${(quizTimer / 10) * 100}%`, background: quizTimer <= 3 ? '#ef4444' : '#ffd700', boxShadow: quizTimer <= 3 ? '0 0 10px rgba(239,68,68,0.6)' : '0 0 10px rgba(255,215,0,0.5)' }} />
                  </div>
                  <p className="text-white font-black mb-4 leading-relaxed text-center" style={{ fontSize: '1.3rem', textShadow: '0 2px 6px rgba(0,0,0,0.9)' }}>{selectedQuiz.question}</p>
                  <div className="space-y-2.5">
                    {selectedQuiz.choices.map((choice, i) => {
                      let btnStyle: React.CSSProperties = { background: 'rgba(255,255,255,0.06)', border: '2px solid rgba(255,255,255,0.15)' };
                      if (showResult) {
                        if (i === selectedQuiz.correctIndex) btnStyle = { background: 'rgba(34,197,94,0.3)', border: '2px solid rgba(34,197,94,0.8)' };
                        else if (i === selectedAnswer && i !== selectedQuiz.correctIndex) btnStyle = { background: 'rgba(239,68,68,0.3)', border: '2px solid rgba(239,68,68,0.8)' };
                      }
                      return (
                        <button
                          key={i}
                          onClick={() => handleAnswer(i)}
                          disabled={selectedAnswer !== null}
                          className="w-full text-left px-4 rounded-xl font-bold transition-all active:scale-[0.97] flex items-center gap-3"
                          style={{
                            ...btnStyle,
                            minHeight: '62px',
                            fontSize: '1.05rem',
                            color: showResult && i === selectedQuiz.correctIndex ? '#4ade80' : showResult && i === selectedAnswer ? '#ff6b6b' : 'rgba(255,255,255,0.95)',
                            textShadow: '0 1px 3px rgba(0,0,0,0.8)',
                          }}
                        >
                          <span className="font-black px-2.5 py-1 rounded-lg shrink-0" style={{ background: 'rgba(255,215,0,0.2)', color: '#ffd700', fontSize: '1rem' }}>{['A', 'B', 'C', 'D'][i]}</span>
                          <span className="flex-1">{choice}</span>
                        </button>
                      );
                    })}
                  </div>
                  {showResult && (
                    <div className="mt-3 text-center kc-quiz-result-pop">
                      <span className={`font-black ${selectedAnswer === selectedQuiz.correctIndex ? 'text-green-400' : 'text-red-400'}`} style={{ fontSize: '1.5rem', textShadow: '0 0 16px currentColor, 0 2px 4px rgba(0,0,0,0.9)' }}>
                        {selectedAnswer === selectedQuiz.correctIndex ? '✨ 正解！パワーアップ！ ✨' : selectedAnswer === -1 ? '⏱ 時間切れ...' : '❌ 不正解...'}
                      </span>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {gameState.phase === 'game_over' && !showGameOverOverlay && (
          <div className="text-center kc-card-reveal">
            <span className="text-5xl block mb-2">{gameState.winner === 'player' ? '🎉' : '💀'}</span>
            <p className="text-lg font-bold" style={{ color: gameState.winner === 'player' ? '#ffd700' : '#ef4444' }}>{gameState.message}</p>
          </div>
        )}
      </div>

      {/* Player Bench */}
      <BenchDisplay side="player" bench={gameState.player.bench} deckCount={gameState.player.deck.length} />

      {/* Battle Log */}
      <div className="shrink-0" style={{ borderTop: '1px solid rgba(255,215,0,0.1)' }}>
        <button onClick={() => setLogExpanded(!logExpanded)} className="w-full flex items-center justify-between px-3 py-1.5" style={{ background: 'rgba(0,0,0,0.2)' }}>
          <span className="text-[10px] text-amber-200/40 font-bold">📜 バトルログ</span>
          <span className="text-[10px] text-amber-200/30">{logExpanded ? '▼' : '▲'}</span>
        </button>
        {logExpanded && (
          <div ref={logRef} className="px-3 py-2 max-h-28 overflow-y-auto" style={{ background: 'rgba(0,0,0,0.3)' }}>
            {gameState.log.map((entry, i) => (
              <p key={i} className="text-[10px] text-amber-200/40 leading-relaxed py-0.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                <span className="text-amber-200/20 mr-1">{i + 1}.</span>{entry}
              </p>
            ))}
          </div>
        )}
        {!logExpanded && (
          <div className="px-3 py-1.5" style={{ background: 'rgba(0,0,0,0.2)' }}>
            <p className="text-[10px] text-amber-200/50 truncate">
              {gameState.log.length > 0 ? gameState.log[gameState.log.length - 1] : gameState.message}
            </p>
          </div>
        )}
      </div>

      <style>{`
        @keyframes kcPowerAdd {
          0%   { opacity: 1; transform: translateY(0) scale(1); }
          50%  { opacity: 1; transform: translateY(-14px) scale(1.3); }
          100% { opacity: 0; transform: translateY(-28px) scale(0.8); }
        }
        @keyframes kcCardStackIn {
          0%   { opacity: 0; transform: translateY(-20px) scale(0.8); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes kcWinGlow {
          0%, 100% { box-shadow: 0 0 8px rgba(255,215,0,0.3), 0 0 16px rgba(255,215,0,0.1); }
          50%      { box-shadow: 0 0 20px rgba(255,215,0,0.6), 0 0 40px rgba(255,215,0,0.3), 0 0 60px rgba(255,215,0,0.1); }
        }
        .kc-win-glow { animation: kcWinGlow 1s ease-in-out infinite; border-color: rgba(255,215,0,0.8) !important; }
        @keyframes kcWinBadgePulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.15); } }
        .kc-win-badge { animation: kcWinBadgePulse 0.8s ease-in-out infinite; }
        .kc-flag-flash { position: absolute; inset: 0; z-index: 50; pointer-events: none; animation: kcFlagFlash 1.5s ease-out forwards; }
        @keyframes kcFlagFlash { 0% { background: rgba(255,215,0,0.3); } 30% { background: rgba(255,215,0,0.15); } 100% { background: transparent; } }
        .kc-flag-center { width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; border-radius: 50%; background: rgba(255,215,0,0.1); border: 2px solid rgba(255,215,0,0.3); flex-shrink: 0; }
        .kc-flag-big {
          width: 80px; height: 80px;
          display: flex; align-items: center; justify-content: center;
          border-radius: 50%;
          border: 4px solid;
          flex-shrink: 0;
          transition: background 0.4s, border-color 0.4s, box-shadow 0.4s;
        }
        .kc-flag-big-player {
          background: radial-gradient(circle, rgba(34,197,94,0.3), rgba(34,197,94,0.08));
          border-color: rgba(34,197,94,0.8);
          box-shadow: 0 0 24px rgba(34,197,94,0.5), inset 0 0 16px rgba(34,197,94,0.2);
        }
        .kc-flag-big-ai {
          background: radial-gradient(circle, rgba(239,68,68,0.3), rgba(239,68,68,0.08));
          border-color: rgba(239,68,68,0.8);
          box-shadow: 0 0 24px rgba(239,68,68,0.5), inset 0 0 16px rgba(239,68,68,0.2);
        }
        .kc-flag-pulse { animation: kcFlagPulse 1s ease-out; }
        @keyframes kcFlagPulse { 0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(255,215,0,0.5); } 50% { transform: scale(1.3); box-shadow: 0 0 20px 10px rgba(255,215,0,0.3); } 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(255,215,0,0); } }
        .kc-attack-slide-up { animation: kcSlideUp 0.5s ease-out; }
        @keyframes kcSlideUp { 0% { transform: translateY(0); } 40% { transform: translateY(-24px); } 100% { transform: translateY(0); } }
        .kc-attack-slide-down { animation: kcSlideDown 0.5s ease-out; }
        @keyframes kcSlideDown { 0% { transform: translateY(0); } 40% { transform: translateY(24px); } 100% { transform: translateY(0); } }
        .kc-shield-effect { position: absolute; inset: -4px; border-radius: 16px; border: 2px solid rgba(100,180,255,0.25); pointer-events: none; animation: kcShieldPulse 2s ease-in-out infinite; }
        @keyframes kcShieldPulse { 0%, 100% { opacity: 0.4; box-shadow: 0 0 8px rgba(100,180,255,0.15); } 50% { opacity: 0.8; box-shadow: 0 0 16px rgba(100,180,255,0.3), inset 0 0 8px rgba(100,180,255,0.1); } }
        .kc-draw-btn { animation: kcDrawPulse 2s ease-in-out infinite; }
        @keyframes kcDrawPulse { 0%, 100% { box-shadow: 0 4px 0 rgba(180,140,0,1), 0 6px 12px rgba(0,0,0,0.3), 0 0 15px rgba(255,215,0,0.2); } 50% { box-shadow: 0 4px 0 rgba(180,140,0,1), 0 6px 12px rgba(0,0,0,0.3), 0 0 30px rgba(255,215,0,0.4); } }
        .kc-ai-spin { animation: kcAiSpin 1.5s ease-in-out infinite; }
        @keyframes kcAiSpin { 0%, 100% { transform: scale(1) rotate(0deg); } 25% { transform: scale(1.05) rotate(-3deg); } 75% { transform: scale(1.05) rotate(3deg); } }
        .kc-card-reveal { animation: kcCardReveal 0.5s ease-out; }
        @keyframes kcCardReveal { 0% { opacity: 0; transform: scale(0.7) rotateY(90deg); } 50% { opacity: 1; transform: scale(1.05) rotateY(0deg); } 100% { opacity: 1; transform: scale(1) rotateY(0deg); } }
        .kc-pulse-text { animation: kcPulseText 1s ease-in-out infinite; }
        @keyframes kcPulseText { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        .kc-game-over-overlay { position: absolute; inset: 0; z-index: 100; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.75); animation: kcOverlayIn 0.5s ease-out; }
        @keyframes kcOverlayIn { 0% { background: transparent; } 100% { background: rgba(0,0,0,0.75); } }
        .kc-game-over-content { text-align: center; animation: kcGameOverContent 0.6s ease-out 0.2s both; }
        @keyframes kcGameOverContent { 0% { opacity: 0; transform: scale(0.5); } 60% { opacity: 1; transform: scale(1.1); } 100% { opacity: 1; transform: scale(1); } }
        .kc-result-icon { animation: kcResultBounce 0.8s ease-out; }
        @keyframes kcResultBounce { 0% { transform: scale(0); } 50% { transform: scale(1.3); } 70% { transform: scale(0.9); } 100% { transform: scale(1); } }
        .kc-power-bar-fill { transition: width 0.5s ease-out; }
        .kc-power-bar-overflow { animation: kcPowerOverflow 0.8s ease-in-out infinite; }
        @keyframes kcPowerOverflow { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }
        .kc-bench-danger { animation: kcBenchDanger 1s ease-in-out infinite; }
        @keyframes kcBenchDanger { 0%, 100% { border-color: rgba(239,68,68,0.3); } 50% { border-color: rgba(239,68,68,0.7); } }
        @keyframes kcAltRewardFloat { 0% { opacity: 0; transform: translateX(-50%) translateY(0) scale(0.7); } 15% { opacity: 1; transform: translateX(-50%) translateY(-4px) scale(1.1); } 30% { opacity: 1; transform: translateX(-50%) translateY(-8px) scale(1); } 80% { opacity: 1; transform: translateX(-50%) translateY(-12px) scale(1); } 100% { opacity: 0; transform: translateX(-50%) translateY(-20px) scale(0.9); } }

        /* ===== Enhanced Battle Cinematics ===== */
        .kc-screen-shake { animation: kcShake 0.6s cubic-bezier(.36,.07,.19,.97) both; }
        @keyframes kcShake {
          0%, 100% { transform: translateX(0) translateY(0); }
          10% { transform: translateX(-6px) translateY(-2px); }
          20% { transform: translateX(7px) translateY(3px); }
          30% { transform: translateX(-8px) translateY(-1px); }
          40% { transform: translateX(8px) translateY(2px); }
          50% { transform: translateX(-5px) translateY(-3px); }
          60% { transform: translateX(5px) translateY(2px); }
          70% { transform: translateX(-4px) translateY(-1px); }
          80% { transform: translateX(3px) translateY(1px); }
          90% { transform: translateX(-2px) translateY(0); }
        }

        .kc-defeat-flash { position: absolute; inset: 0; z-index: 55; pointer-events: none; animation: kcDefeatFlash 1.2s ease-out forwards; }
        @keyframes kcDefeatFlash {
          0% { background: rgba(239,68,68,0); }
          15% { background: rgba(239,68,68,0.45); }
          45% { background: rgba(239,68,68,0.2); }
          100% { background: transparent; }
        }
        .kc-victory-flash { position: absolute; inset: 0; z-index: 55; pointer-events: none; animation: kcVictoryFlash 1.2s ease-out forwards; }
        @keyframes kcVictoryFlash {
          0% { background: rgba(34,197,94,0); }
          15% { background: rgba(34,197,94,0.4); }
          45% { background: rgba(34,197,94,0.18); }
          100% { background: transparent; }
        }

        .kc-ai-attack-intro {
          position: absolute; inset: 0; z-index: 60;
          display: flex; align-items: center; justify-content: center;
          pointer-events: none;
          background: radial-gradient(ellipse at center, rgba(239,68,68,0.22), transparent 65%);
          animation: kcAiIntroFade 1.3s ease-out forwards;
        }
        @keyframes kcAiIntroFade {
          0% { opacity: 0; }
          15% { opacity: 1; }
          75% { opacity: 1; }
          100% { opacity: 0; }
        }
        .kc-ai-attack-intro-text {
          font-size: 2rem;
          font-weight: 900;
          color: #ef4444;
          letter-spacing: 0.05em;
          text-shadow: 0 0 20px rgba(239,68,68,0.9), 0 0 40px rgba(239,68,68,0.5), 0 4px 0 rgba(0,0,0,0.6);
          animation: kcAiIntroPop 1.3s cubic-bezier(.17,.67,.35,1.4) both;
        }
        @keyframes kcAiIntroPop {
          0% { opacity: 0; transform: scale(0.3) translateX(-300px) rotate(-15deg); }
          30% { opacity: 1; transform: scale(1.25) translateX(0) rotate(0); }
          50% { transform: scale(1) translateX(0); }
          80% { opacity: 1; transform: scale(1.02); }
          100% { opacity: 0; transform: scale(1.3); }
        }

        .kc-battle-outcome {
          position: absolute; inset: 0; z-index: 70;
          display: flex; align-items: center; justify-content: center;
          pointer-events: none;
        }
        .kc-battle-outcome-text {
          font-size: 2.2rem;
          font-weight: 900;
          letter-spacing: 0.04em;
          animation: kcOutcomePop 1.8s cubic-bezier(.17,.67,.35,1.4) both;
        }
        @keyframes kcOutcomePop {
          0% { opacity: 0; transform: scale(0.2) rotate(-8deg); }
          20% { opacity: 1; transform: scale(1.35) rotate(2deg); }
          35% { transform: scale(1) rotate(0); }
          80% { opacity: 1; transform: scale(1.02); }
          100% { opacity: 0; transform: scale(0.9) translateY(-24px); }
        }

        .kc-side-burst {
          position: absolute; left: 50%;
          width: 260px; height: 260px;
          border-radius: 50%;
          pointer-events: none;
          z-index: 45;
        }
        .kc-side-burst-ai {
          top: 22%;
          transform: translate(-50%, -50%);
          background: radial-gradient(circle, rgba(255,215,0,0.55) 0%, rgba(239,68,68,0.4) 40%, transparent 70%);
          animation: kcBurstAi 0.9s ease-out forwards;
        }
        .kc-side-burst-player {
          bottom: 28%;
          transform: translate(-50%, 50%);
          background: radial-gradient(circle, rgba(255,215,0,0.55) 0%, rgba(239,68,68,0.4) 40%, transparent 70%);
          animation: kcBurstPlayer 0.9s ease-out forwards;
        }
        @keyframes kcBurstAi {
          0% { opacity: 0; transform: translate(-50%, -50%) scale(0.15); }
          30% { opacity: 1; transform: translate(-50%, -50%) scale(1.15); }
          100% { opacity: 0; transform: translate(-50%, -50%) scale(2.1); }
        }
        @keyframes kcBurstPlayer {
          0% { opacity: 0; transform: translate(-50%, 50%) scale(0.15); }
          30% { opacity: 1; transform: translate(-50%, 50%) scale(1.15); }
          100% { opacity: 0; transform: translate(-50%, 50%) scale(2.1); }
        }

        .kc-flag-move-to-player { animation: kcFlagMovePlayer 1.5s ease-out; }
        @keyframes kcFlagMovePlayer {
          0%   { transform: translateY(-40px) scale(1); background: rgba(239,68,68,0.15); border-color: rgba(239,68,68,0.4); }
          35%  { transform: translateY(12px) scale(1.7); background: rgba(255,215,0,0.3); border-color: rgba(255,215,0,0.8); box-shadow: 0 0 24px rgba(255,215,0,0.6); }
          70%  { transform: translateY(22px) scale(1.5) rotate(-8deg); background: rgba(34,197,94,0.25); border-color: rgba(34,197,94,0.7); }
          100% { transform: translateY(0) scale(1) rotate(0); }
        }
        .kc-flag-move-to-ai { animation: kcFlagMoveAi 1.5s ease-out; }
        @keyframes kcFlagMoveAi {
          0%   { transform: translateY(40px) scale(1); background: rgba(34,197,94,0.15); border-color: rgba(34,197,94,0.4); }
          35%  { transform: translateY(-12px) scale(1.7); background: rgba(255,215,0,0.3); border-color: rgba(255,215,0,0.8); box-shadow: 0 0 24px rgba(255,215,0,0.6); }
          70%  { transform: translateY(-22px) scale(1.5) rotate(8deg); background: rgba(239,68,68,0.25); border-color: rgba(239,68,68,0.7); }
          100% { transform: translateY(0) scale(1) rotate(0); }
        }
        .kc-flag-wave { animation: kcFlagWave 0.4s ease-in-out infinite; }
        @keyframes kcFlagWave {
          0%, 100% { transform: rotate(-8deg); }
          50% { transform: rotate(8deg); }
        }

        .kc-deck-empty { animation: kcDeckEmpty 0.9s ease-in-out infinite; color: #ef4444; text-shadow: 0 0 10px rgba(239,68,68,0.8); }
        @keyframes kcDeckEmpty {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.9); }
        }

        .kc-bench-full { animation: kcBenchFullPulse 0.5s ease-in-out infinite; }
        @keyframes kcBenchFullPulse {
          0%, 100% { background: rgba(239,68,68,0.08); box-shadow: inset 0 0 0 1px rgba(239,68,68,0.3); }
          50%      { background: rgba(239,68,68,0.22); box-shadow: inset 0 0 20px rgba(239,68,68,0.4), inset 0 0 0 2px rgba(239,68,68,0.8); }
        }

        .kc-power-pop { animation: kcPowerPop 0.5s ease-out; }
        @keyframes kcPowerPop {
          0% { opacity: 0; transform: scale(0.4); }
          50% { opacity: 1; transform: scale(1.4); color: #ffd700; text-shadow: 0 0 12px rgba(255,215,0,0.8); }
          100% { opacity: 1; transform: scale(1); }
        }

        /* ===== Nuke Cinematic ===== */
        .kc-nuke-whiteflash {
          position: absolute; inset: 0; z-index: 200;
          background: #fff;
          pointer-events: none;
          animation: kcNukeWhite 2.8s ease-out forwards;
        }
        @keyframes kcNukeWhite {
          0%   { opacity: 0; }
          5%   { opacity: 1; }
          20%  { opacity: 1; }
          40%  { opacity: 0.5; }
          100% { opacity: 0; }
        }
        .kc-nuke-shockwave {
          position: absolute; top: 50%; left: 50%; z-index: 201;
          width: 20px; height: 20px; border-radius: 50%;
          border: 4px solid rgba(255,220,50,0.9);
          transform: translate(-50%, -50%);
          pointer-events: none;
          animation: kcNukeShock 2.5s cubic-bezier(.2,.6,.3,1) forwards;
        }
        @keyframes kcNukeShock {
          0%   { opacity: 0; width: 20px; height: 20px; border-width: 4px; }
          10%  { opacity: 1; }
          80%  { opacity: 0.5; }
          100% { opacity: 0; width: 1200px; height: 1200px; border-width: 1px; border-color: rgba(255,100,0,0.1); }
        }
        .kc-nuke-overlay {
          position: absolute; inset: 0; z-index: 202;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          pointer-events: none;
          animation: kcNukeFade 2.8s ease-out forwards;
        }
        @keyframes kcNukeFade {
          0%   { opacity: 0; }
          25%  { opacity: 1; }
          85%  { opacity: 1; }
          100% { opacity: 0; }
        }
        .kc-nuke-cloud {
          font-size: 3rem;
          animation: kcNukeCloud 2.8s ease-out forwards;
        }
        @keyframes kcNukeCloud {
          0%   { opacity: 0; transform: translateY(80px) scale(0.4); }
          30%  { opacity: 1; transform: translateY(0) scale(1.8); }
          100% { opacity: 0.7; transform: translateY(-40px) scale(2.5); }
        }
        .kc-nuke-mushroom {
          font-size: 5rem;
          margin-top: -20px;
          animation: kcNukeMushroom 2.8s ease-out forwards;
        }
        @keyframes kcNukeMushroom {
          0%   { opacity: 0; transform: scale(0.2) rotate(-8deg); filter: brightness(3) hue-rotate(20deg); }
          20%  { opacity: 1; transform: scale(1.8) rotate(3deg); filter: brightness(2) hue-rotate(-15deg); }
          60%  { transform: scale(1.6) rotate(0); filter: brightness(1.4); }
          100% { opacity: 0.8; transform: scale(1.4); filter: brightness(1); }
        }
        .kc-nuke-title {
          font-size: 2.2rem;
          font-weight: 900;
          color: #ff3300;
          text-shadow: 0 0 20px rgba(255,50,0,0.9), 0 0 40px rgba(255,100,0,0.6), 0 4px 0 rgba(0,0,0,0.7);
          margin-top: 12px;
          letter-spacing: 0.08em;
          animation: kcNukeTitle 2.8s cubic-bezier(.17,.67,.35,1.4) both;
        }
        @keyframes kcNukeTitle {
          0%   { opacity: 0; transform: scale(0.1) rotate(-5deg); }
          30%  { opacity: 1; transform: scale(1.4) rotate(2deg); }
          50%  { transform: scale(1.05) rotate(0); }
          80%  { opacity: 1; transform: scale(1.1); }
          100% { opacity: 0; transform: scale(1.3); }
        }
        .kc-nuke-sub {
          font-size: 0.85rem;
          font-weight: 700;
          color: #ffd700;
          text-shadow: 0 0 10px rgba(255,215,0,0.8);
          margin-top: 6px;
          animation: kcNukeSub 2.8s ease-out both;
        }
        @keyframes kcNukeSub {
          0%, 30% { opacity: 0; transform: translateY(10px); }
          45%     { opacity: 1; transform: translateY(0); }
          80%     { opacity: 1; }
          100%    { opacity: 0; }
        }

        /* ===== Nuke Failed ===== */
        .kc-nuke-failed {
          position: absolute; inset: 0; z-index: 65;
          display: flex; align-items: center; justify-content: center;
          pointer-events: none;
          background: radial-gradient(ellipse at center, rgba(100,100,100,0.25), transparent 60%);
          animation: kcNukeFailedFade 1.5s ease-out forwards;
        }
        @keyframes kcNukeFailedFade {
          0%, 80% { opacity: 1; }
          100%    { opacity: 0; }
        }
        .kc-nuke-failed-text {
          font-size: 1.2rem;
          font-weight: 900;
          color: #9ca3af;
          text-shadow: 0 2px 8px rgba(0,0,0,0.8);
          animation: kcNukeFailedText 1.5s ease-out;
        }
        @keyframes kcNukeFailedText {
          0%   { opacity: 0; transform: scale(0.8); }
          20%  { opacity: 1; transform: scale(1.1); }
          40%  { transform: scale(1); }
          100% { opacity: 0.6; transform: scale(1); }
        }

        /* ===== SSR Reveal ===== */
        .kc-ssr-reveal {
          position: absolute; inset: 0; z-index: 80;
          display: flex; align-items: center; justify-content: center;
          pointer-events: none;
          animation: kcSsrFade 1.5s ease-out forwards;
        }
        @keyframes kcSsrFade {
          0%   { opacity: 0; background: rgba(255,215,0,0); }
          20%  { opacity: 1; background: rgba(255,215,0,0.15); }
          70%  { opacity: 1; background: rgba(255,215,0,0.08); }
          100% { opacity: 0; background: transparent; }
        }
        .kc-ssr-lightning-l, .kc-ssr-lightning-r {
          position: absolute;
          font-size: 5rem;
          color: #ffd700;
          text-shadow: 0 0 20px rgba(255,215,0,0.9), 0 0 40px rgba(255,255,255,0.7);
          filter: drop-shadow(0 0 12px rgba(255,215,0,0.9));
        }
        .kc-ssr-lightning-l { left: 20%; top: 20%; animation: kcSsrLightningL 1.5s ease-out; }
        .kc-ssr-lightning-r { right: 20%; top: 20%; animation: kcSsrLightningR 1.5s ease-out; }
        @keyframes kcSsrLightningL {
          0%   { opacity: 0; transform: translate(-40px, -40px) scale(0.5) rotate(-20deg); }
          20%  { opacity: 1; transform: translate(0, 0) scale(1.3) rotate(-10deg); }
          40%  { transform: translate(4px, 4px) scale(1) rotate(0deg); }
          60%  { opacity: 1; }
          100% { opacity: 0; transform: scale(1.2); }
        }
        @keyframes kcSsrLightningR {
          0%   { opacity: 0; transform: translate(40px, -40px) scale(0.5) rotate(20deg); }
          20%  { opacity: 1; transform: translate(0, 0) scale(1.3) rotate(10deg); }
          40%  { transform: translate(-4px, 4px) scale(1) rotate(0deg); }
          60%  { opacity: 1; }
          100% { opacity: 0; transform: scale(1.2); }
        }
        .kc-ssr-halo {
          position: absolute; top: 50%; left: 50%;
          width: 200px; height: 200px; border-radius: 50%;
          background: radial-gradient(circle, rgba(255,255,255,0.6) 0%, rgba(255,215,0,0.4) 40%, transparent 70%);
          transform: translate(-50%, -50%);
          animation: kcSsrHalo 1.5s ease-out;
        }
        @keyframes kcSsrHalo {
          0%   { opacity: 0; transform: translate(-50%, -50%) scale(0.3); }
          30%  { opacity: 1; transform: translate(-50%, -50%) scale(1.4); }
          100% { opacity: 0; transform: translate(-50%, -50%) scale(2.2); }
        }
        .kc-ssr-text {
          position: relative; z-index: 2;
          font-size: 2.5rem;
          font-weight: 900;
          background: linear-gradient(135deg, #ffd700, #fff, #ffd700, #ec4899, #a855f7);
          background-size: 300% 300%;
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          text-shadow: 0 0 30px rgba(255,215,0,0.6);
          letter-spacing: 0.1em;
          animation: kcSsrText 1.5s cubic-bezier(.17,.67,.35,1.4) both, kcSsrGradient 1.5s linear infinite;
        }
        @keyframes kcSsrText {
          0%   { opacity: 0; transform: scale(0.2) rotate(-10deg); }
          25%  { opacity: 1; transform: scale(1.5) rotate(3deg); }
          45%  { transform: scale(1.1) rotate(0); }
          80%  { opacity: 1; transform: scale(1.15); }
          100% { opacity: 0; transform: scale(1.3) translateY(-10px); }
        }
        @keyframes kcSsrGradient {
          0%   { background-position: 0% 50%; }
          100% { background-position: 100% 50%; }
        }

        /* ===== Step-by-step Battle Cinematic ===== */
        .kc-cinematic-layer {
          position: absolute; inset: 0; z-index: 90;
          display: flex; align-items: center; justify-content: center;
          pointer-events: none;
          background: rgba(0,0,0,0.7);
          backdrop-filter: blur(3px);
          animation: kcCineLayer 0.3s ease-out;
        }
        .kc-cinematic-skip {
          position: absolute; top: 16px; right: 16px;
          padding: 10px 18px;
          border-radius: 12px;
          background: rgba(255,215,0,0.2);
          border: 2px solid rgba(255,215,0,0.6);
          color: #ffd700;
          font-size: 0.95rem; font-weight: 900;
          text-shadow: 0 1px 3px rgba(0,0,0,0.8);
          box-shadow: 0 4px 14px rgba(0,0,0,0.6), 0 0 16px rgba(255,215,0,0.25);
          cursor: pointer;
          transition: all 0.15s ease-out;
          z-index: 95;
        }
        .kc-cinematic-skip:hover { background: rgba(255,215,0,0.35); transform: scale(1.05); }
        .kc-cinematic-skip:active { transform: scale(0.96); }
        .kc-warn-pulse { animation: kcWarnPulse 0.9s ease-in-out infinite; }
        @keyframes kcWarnPulse {
          0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239,68,68,0.5); }
          50%      { transform: scale(1.06); box-shadow: 0 0 0 4px rgba(239,68,68,0); }
        }
        .kc-bench-warning { animation: kcBenchWarn 1s ease-in-out infinite; }
        @keyframes kcBenchWarn {
          0%, 100% { background: rgba(239,68,68,0.08); }
          50%      { background: rgba(239,68,68,0.18); }
        }
        .kc-quiz-result-pop { animation: kcQuizResultPop 0.5s cubic-bezier(.17,.67,.35,1.4) both; }
        @keyframes kcQuizResultPop {
          0%   { opacity: 0; transform: scale(0.4); }
          55%  { opacity: 1; transform: scale(1.2); }
          100% { opacity: 1; transform: scale(1); }
        }

        /* ===== Quiz Effect Telop ===== */
        .kc-quiz-telop {
          position: absolute; inset: 0; z-index: 85;
          display: flex; align-items: center; justify-content: center;
          pointer-events: none;
        }
        .kc-quiz-telop-correct {
          background: radial-gradient(ellipse at center, rgba(34,197,94,0.35), rgba(0,0,0,0.55) 60%);
          animation: kcTelopBg 0.4s ease-out;
        }
        .kc-quiz-telop-wrong {
          background: radial-gradient(ellipse at center, rgba(239,68,68,0.3), rgba(0,0,0,0.55) 60%);
          animation: kcTelopBg 0.4s ease-out;
        }
        @keyframes kcTelopBg { 0% { opacity: 0; } 100% { opacity: 1; } }

        .kc-quiz-telop-flash-text {
          font-size: 3.5rem; font-weight: 900;
          letter-spacing: 0.05em;
          text-shadow: 0 0 30px currentColor, 0 4px 0 rgba(0,0,0,0.8), 0 0 12px currentColor;
          animation: kcTelopFlash 1s cubic-bezier(.17,.67,.35,1.4);
        }
        @keyframes kcTelopFlash {
          0%   { opacity: 0; transform: scale(0.3) rotate(-8deg); }
          25%  { opacity: 1; transform: scale(1.4) rotate(4deg); }
          45%  { transform: scale(1) rotate(0); }
          85%  { opacity: 1; transform: scale(1.05); }
          100% { opacity: 0.8; transform: scale(1); }
        }

        .kc-quiz-telop-effect {
          font-size: 2.5rem;
          font-weight: 900;
          letter-spacing: 0.04em;
          padding: 22px 40px;
          border-radius: 20px;
          text-shadow: 0 0 20px currentColor, 0 4px 0 rgba(0,0,0,0.85), 0 0 10px currentColor;
          animation: kcTelopEffect 1.5s cubic-bezier(.17,.67,.35,1.4);
          max-width: 92%;
          text-align: center;
        }
        @keyframes kcTelopEffect {
          0%   { opacity: 0; transform: scale(0.2) rotate(-10deg); }
          25%  { opacity: 1; transform: scale(1.35) rotate(3deg); }
          40%  { transform: scale(1) rotate(0); }
          85%  { opacity: 1; transform: scale(1.05); }
          100% { opacity: 0; transform: scale(1.2) translateY(-20px); }
        }
        .kc-telop-attack  { color: #ff5555; background: rgba(239,68,68,0.18); border: 3px solid rgba(239,68,68,0.7); box-shadow: 0 0 40px rgba(239,68,68,0.45), inset 0 0 24px rgba(239,68,68,0.2); }
        .kc-telop-defense { color: #5fb8ff; background: rgba(100,180,255,0.18); border: 3px solid rgba(100,180,255,0.7); box-shadow: 0 0 40px rgba(100,180,255,0.45), inset 0 0 24px rgba(100,180,255,0.2); }
        .kc-telop-bench   { color: #c084fc; background: rgba(168,85,247,0.18); border: 3px solid rgba(168,85,247,0.7); box-shadow: 0 0 40px rgba(168,85,247,0.45), inset 0 0 24px rgba(168,85,247,0.2); }
        .kc-telop-special { color: #ffd700; background: rgba(255,215,0,0.18); border: 3px solid rgba(255,215,0,0.8); box-shadow: 0 0 40px rgba(255,215,0,0.55), inset 0 0 24px rgba(255,215,0,0.25); }
        .kc-telop-fail    { color: #9ca3af; background: rgba(80,80,80,0.18); border: 3px solid rgba(156,163,175,0.6); box-shadow: 0 0 40px rgba(0,0,0,0.4); }
        .kc-telop-ssr {
          background: rgba(0,0,0,0.35);
          border: 3px solid transparent;
          background-clip: padding-box;
          background-image: linear-gradient(135deg, #ffd700, #ec4899, #a855f7, #3b82f6, #22c55e, #ffd700);
          background-size: 300% 300%;
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          box-shadow: 0 0 60px rgba(255,215,0,0.6), 0 0 100px rgba(236,72,153,0.4);
          animation: kcTelopEffect 1.5s cubic-bezier(.17,.67,.35,1.4), kcSsrGradient 1.5s linear infinite;
        }
        .kc-bench-last-slot { animation: kcBenchLastSlot 1s ease-in-out infinite; }
        @keyframes kcBenchLastSlot {
          0%, 100% { background: rgba(255,200,0,0.08); }
          50%      { background: rgba(255,200,0,0.2); }
        }
        @keyframes kcCineLayer { 0% { opacity: 0; } 100% { opacity: 1; } }
        .kc-cinematic-box {
          min-width: 260px; max-width: 85%;
          padding: 20px 24px;
          border-radius: 18px;
          background: linear-gradient(135deg, rgba(21,29,59,0.98), rgba(14,20,45,0.98));
          box-shadow: 0 16px 48px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.08);
          text-align: center;
          animation: kcCineBoxIn 0.35s cubic-bezier(.17,.67,.35,1.4);
        }
        .kc-cinematic-ai { border: 2px solid rgba(239,68,68,0.55); box-shadow: 0 16px 48px rgba(0,0,0,0.7), 0 0 24px rgba(239,68,68,0.3); }
        .kc-cinematic-player { border: 2px solid rgba(34,197,94,0.55); box-shadow: 0 16px 48px rgba(0,0,0,0.7), 0 0 24px rgba(34,197,94,0.3); }
        @keyframes kcCineBoxIn {
          0%   { opacity: 0; transform: scale(0.7) translateY(20px); }
          60%  { opacity: 1; transform: scale(1.04) translateY(0); }
          100% { opacity: 1; transform: scale(1); }
        }

        /* Step: intro */
        .kc-cine-intro { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 8px 0; }
        .kc-cine-intro-icon { font-size: 3rem; animation: kcCineIconBounce 0.6s ease-out; }
        @keyframes kcCineIconBounce {
          0%   { opacity: 0; transform: scale(0.3) rotate(-15deg); }
          60%  { opacity: 1; transform: scale(1.3) rotate(5deg); }
          100% { opacity: 1; transform: scale(1) rotate(0); }
        }
        .kc-cine-intro-text {
          font-size: 1.8rem; font-weight: 900;
          letter-spacing: 0.06em;
          text-shadow: 0 0 20px currentColor, 0 3px 0 rgba(0,0,0,0.6);
          animation: kcCineIntroText 0.6s cubic-bezier(.17,.67,.35,1.4);
        }
        @keyframes kcCineIntroText {
          0%   { opacity: 0; transform: scale(0.3) translateX(-40px); }
          60%  { opacity: 1; transform: scale(1.15) translateX(0); }
          100% { opacity: 1; transform: scale(1); }
        }

        /* Step: card_back */
        .kc-cine-card-back { display: flex; justify-content: center; padding: 8px 0; }
        .kc-card-back-face {
          width: 120px; height: 160px; border-radius: 12px;
          background: linear-gradient(135deg, #1a1a3e, #0a0a1e);
          border: 2px solid rgba(255,215,0,0.4);
          box-shadow: 0 8px 24px rgba(0,0,0,0.6), inset 0 0 20px rgba(255,215,0,0.1);
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          animation: kcCineCardBackIn 0.5s cubic-bezier(.17,.67,.35,1.4);
        }
        @keyframes kcCineCardBackIn {
          0%   { opacity: 0; transform: translateY(-80px) rotate(-20deg); }
          60%  { opacity: 1; transform: translateY(0) rotate(5deg); }
          100% { opacity: 1; transform: translateY(0) rotate(0); }
        }

        /* Step: card_flip */
        .kc-cine-card-flip {
          display: flex; justify-content: center; padding: 8px 0;
          perspective: 800px;
        }
        .kc-flipper {
          position: relative;
          width: 120px; height: 160px;
          transform-style: preserve-3d;
          animation: kcCineFlip 0.6s ease-in-out forwards;
        }
        @keyframes kcCineFlip {
          0%   { transform: rotateY(0deg); }
          100% { transform: rotateY(180deg); }
        }
        .kc-flipper-front, .kc-flipper-back {
          position: absolute; inset: 0;
          backface-visibility: hidden;
          border-radius: 12px;
          display: flex; align-items: center; justify-content: center;
        }
        .kc-flipper-front {
          background: linear-gradient(135deg, #1a1a3e, #0a0a1e);
          border: 2px solid rgba(255,215,0,0.4);
        }
        .kc-flipper-back {
          background: linear-gradient(135deg, rgba(239,68,68,0.2), rgba(21,29,59,0.95));
          border: 2px solid rgba(239,68,68,0.6);
          transform: rotateY(180deg);
          overflow: hidden;
        }

        /* Step: card_reveal */
        .kc-cine-reveal { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 4px 0; animation: kcCineRevealFade 0.5s ease-out; }
        @keyframes kcCineRevealFade {
          0%   { opacity: 0; transform: scale(0.85); }
          100% { opacity: 1; transform: scale(1); }
        }
        .kc-cine-reveal-card {
          width: 120px; height: 160px;
          border-radius: 12px;
          border: 2px solid rgba(255,215,0,0.5);
          box-shadow: 0 0 18px rgba(255,215,0,0.35);
          overflow: hidden;
          background: linear-gradient(135deg, rgba(21,29,59,0.95), rgba(14,20,45,0.95));
        }
        .kc-cine-reveal-name {
          font-size: 1.3rem; font-weight: 900;
          color: #ffd700;
          text-shadow: 0 0 12px rgba(255,215,0,0.7), 0 2px 0 rgba(0,0,0,0.6);
        }
        .kc-cine-reveal-power { font-size: 1rem; color: rgba(255,255,255,0.7); font-weight: 700; }
        .kc-cine-reveal-power-num {
          font-size: 2rem; font-weight: 900; color: #ff8c00;
          text-shadow: 0 0 14px rgba(255,140,0,0.8);
          margin-left: 6px;
          display: inline-block;
          animation: kcCinePowerPop 0.5s cubic-bezier(.17,.67,.35,1.4) 0.15s both;
        }
        @keyframes kcCinePowerPop {
          0%   { transform: scale(0.3); opacity: 0; }
          60%  { transform: scale(1.4); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }

        /* Step: compare */
        .kc-cine-compare { padding: 8px 0; animation: kcCineCompareIn 0.4s ease-out; }
        @keyframes kcCineCompareIn {
          0%   { opacity: 0; transform: translateY(10px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .kc-cine-compare-title {
          font-size: 1.3rem; font-weight: 900;
          color: #ffd700; margin-bottom: 16px;
          text-shadow: 0 0 10px rgba(255,215,0,0.6), 0 2px 0 rgba(0,0,0,0.5);
          letter-spacing: 0.04em;
        }
        .kc-cine-compare-row {
          display: flex; align-items: center; justify-content: center; gap: 22px;
        }
        .kc-cine-side {
          min-width: 110px;
          padding: 14px 18px;
          border-radius: 16px;
        }
        .kc-cine-side-player {
          background: rgba(34,197,94,0.12);
          border: 2px solid rgba(34,197,94,0.4);
        }
        .kc-cine-side-ai {
          background: rgba(239,68,68,0.12);
          border: 2px solid rgba(239,68,68,0.4);
        }
        .kc-cine-label {
          font-size: 1rem; font-weight: 900;
          color: rgba(255,255,255,0.85);
          margin-bottom: 6px;
          text-shadow: 0 1px 3px rgba(0,0,0,0.8);
          letter-spacing: 0.05em;
        }
        .kc-cine-num {
          font-size: 3.5rem; font-weight: 900;
          color: #ffd700;
          text-shadow: 0 0 18px rgba(255,215,0,0.7), 0 3px 0 rgba(0,0,0,0.6);
          line-height: 1;
          animation: kcCineNumPop 0.5s cubic-bezier(.17,.67,.35,1.4) both;
        }
        @keyframes kcCineNumPop {
          0%   { opacity: 0; transform: scale(0.3); }
          60%  { opacity: 1; transform: scale(1.3); }
          100% { opacity: 1; transform: scale(1); }
        }
        .kc-cine-vs {
          font-size: 2rem; font-weight: 900;
          color: #ff8c00;
          text-shadow: 0 0 14px rgba(255,140,0,0.9), 0 3px 0 rgba(0,0,0,0.6);
          animation: kcCineVsPulse 0.8s ease-in-out infinite;
          letter-spacing: 0.04em;
        }
        @keyframes kcCineVsPulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50%      { transform: scale(1.15); opacity: 0.8; }
        }
        .kc-cine-compare-hint {
          margin-top: 10px;
          font-size: 0.85rem; font-weight: 700;
          color: rgba(255,215,0,0.8);
        }

        /* Step: outcome */
        .kc-cine-outcome {
          display: flex; flex-direction: column; align-items: center; gap: 10px;
          padding: 10px 0;
          animation: kcCineOutcomeIn 0.4s cubic-bezier(.17,.67,.35,1.4);
        }
        @keyframes kcCineOutcomeIn {
          0%   { opacity: 0; transform: scale(0.4); }
          60%  { opacity: 1; transform: scale(1.2); }
          100% { opacity: 1; transform: scale(1); }
        }
        .kc-cine-outcome-icon {
          font-size: 4rem;
          animation: kcCineOutcomeIcon 0.8s ease-out;
        }
        @keyframes kcCineOutcomeIcon {
          0%   { transform: scale(0.2) rotate(-15deg); opacity: 0; }
          50%  { transform: scale(1.4) rotate(5deg); opacity: 1; }
          100% { transform: scale(1.2) rotate(0); opacity: 1; }
        }
        .kc-cine-outcome-text {
          font-size: 1.6rem; font-weight: 900;
          letter-spacing: 0.04em;
          text-shadow: 0 0 20px currentColor, 0 3px 0 rgba(0,0,0,0.6);
        }

        /* ===== SSR Rainbow Card Border ===== */
        .kc-card-ssr {
          position: relative;
        }
        .kc-card-ssr::before {
          content: '';
          position: absolute; inset: -3px;
          border-radius: 14px;
          background: linear-gradient(135deg, #ffd700, #ec4899, #a855f7, #3b82f6, #22c55e, #ffd700);
          background-size: 300% 300%;
          z-index: -1;
          animation: kcSsrBorder 3s linear infinite;
        }
        @keyframes kcSsrBorder {
          0%   { background-position: 0% 50%; }
          100% { background-position: 300% 50%; }
        }
      `}</style>
    </div>
  );
}

// ===================== Power Bar Component =====================
function PowerBar({ attackerPower, defenderPower, isPlayerAttacking, percent, powerAddEffect }: {
  attackerPower: number; defenderPower: number; isPlayerAttacking: boolean; percent: number;
  powerAddEffect: { value: number; key: number } | null;
}) {
  const attackColor = isPlayerAttacking ? '#22c55e' : '#ef4444';
  const isOverpower = attackerPower > defenderPower;
  return (
    <div className="w-full max-w-xs px-2 my-1">
      <div className="flex items-center justify-between mb-0.5">
        <div className="flex items-center gap-1 relative">
          <span className="text-[9px] font-bold" style={{ color: attackColor }}>🗡️ {attackerPower}</span>
          {powerAddEffect && isPlayerAttacking && (
            <span key={powerAddEffect.key} className="absolute -top-4 left-6 text-sm font-black pointer-events-none" style={{ color: '#22c55e', textShadow: '0 0 10px rgba(34,197,94,0.6)', animation: 'kcPowerAdd 1.2s ease-out forwards' }}>
              +{powerAddEffect.value}
            </span>
          )}
        </div>
        <span className="text-[9px] font-bold text-blue-400">🛡️ {defenderPower}</span>
      </div>
      <div className="relative h-3 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)' }}>
        <div className={`h-full rounded-full kc-power-bar-fill ${isOverpower ? 'kc-power-bar-overflow' : ''}`} style={{ width: `${Math.min(100, percent)}%`, background: isOverpower ? `linear-gradient(90deg, ${attackColor}, #ffd700)` : `linear-gradient(90deg, ${attackColor}88, ${attackColor})` }} />
        <div className="absolute top-0 bottom-0 w-0.5" style={{ left: '100%', transform: 'translateX(-2px)', background: 'rgba(100,180,255,0.6)' }} />
      </div>
      {isOverpower && (
        <p className="text-center text-[10px] font-black mt-0.5" style={{ color: '#ffd700', textShadow: '0 0 8px rgba(255,215,0,0.5)' }}>🚩 フラッグ奪取！</p>
      )}
    </div>
  );
}

// ===================== Bench Display Component =====================
type BenchSlotUI = { name: string; card: BattleCard; count: number };
const BENCH_SLOT_COUNT = 5;

function BenchDisplay({ side, bench, deckCount }: {
  side: 'player' | 'ai'; bench: BenchSlotUI[]; deckCount: number;
}) {
  const isPlayer = side === 'player';
  const label = isPlayer ? 'あなた' : 'AI';
  const labelColor = isPlayer ? '#22c55e' : '#ef4444';
  const emptySlots = BENCH_SLOT_COUNT - bench.length;
  const isFull = bench.length >= BENCH_SLOT_COUNT;
  const isLastSlot = emptySlots === 1;
  const isWarning = emptySlots <= 2 && emptySlots > 0;
  const [detailSlot, setDetailSlot] = useState<BenchSlotUI | null>(null);

  return (
    <>
      <div className={`px-3 py-2 shrink-0 ${isFull ? 'kc-bench-full' : isLastSlot ? 'kc-bench-last-slot' : isWarning ? 'kc-bench-warning' : ''}`} style={{ borderTop: isPlayer ? '2px solid rgba(255,215,0,0.15)' : 'none', borderBottom: !isPlayer ? '2px solid rgba(255,215,0,0.15)' : 'none', background: isFull ? 'rgba(239,68,68,0.18)' : isLastSlot ? 'rgba(255,200,0,0.1)' : isWarning ? 'rgba(239,68,68,0.08)' : 'rgba(0,0,0,0.25)' }}>
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2">
            <span className="text-base font-black" style={{ color: labelColor, textShadow: `0 0 8px ${labelColor}66, 0 1px 2px rgba(0,0,0,0.8)` }}>{label}</span>
            <span className="text-sm font-bold text-amber-200/70">山札: <span className="text-amber-100">{deckCount}</span></span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-base font-black ${isWarning || isFull ? 'text-red-400' : 'text-amber-100'}`} style={{ textShadow: '0 1px 2px rgba(0,0,0,0.9)' }}>
              ベンチ {bench.length}/{BENCH_SLOT_COUNT}
            </span>
            {isFull ? (
              <span className="text-sm font-black px-2 py-0.5 rounded kc-warn-pulse" style={{ background: 'rgba(239,68,68,0.5)', color: '#fff', border: '2px solid rgba(239,68,68,0.9)' }}>
                満杯！
              </span>
            ) : isLastSlot ? (
              <span className="text-sm font-black px-2 py-0.5 rounded kc-warn-pulse" style={{ background: 'rgba(255,200,0,0.3)', color: '#ffd700', border: '2px solid rgba(255,200,0,0.7)', textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}>
                ⚠️ 残り1枠！
              </span>
            ) : (
              <span className="text-sm font-black px-2 py-0.5 rounded" style={{ background: isWarning ? 'rgba(239,68,68,0.3)' : 'rgba(255,215,0,0.15)', color: isWarning ? '#ff6666' : '#ffd700', border: `1.5px solid ${isWarning ? 'rgba(239,68,68,0.6)' : 'rgba(255,215,0,0.3)'}`, textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}>
                残り{emptySlots}枠
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-1.5">
          {Array.from({ length: BENCH_SLOT_COUNT }).map((_, i) => {
            const slot = bench[i];
            if (!slot) {
              return (
                <div key={`empty-${i}`} className="flex-1 rounded-lg text-center relative" style={{ background: 'rgba(255,255,255,0.04)', border: '1.5px dashed rgba(255,255,255,0.1)', minHeight: '62px' }}>
                  <span className="text-[10px] font-bold text-amber-200/30 block mt-5">空</span>
                </div>
              );
            }
            const catInfo = CATEGORY_INFO[slot.card.category];
            return (
              <button
                key={slot.name}
                onClick={() => isPlayer && setDetailSlot(slot)}
                className="flex-1 rounded-lg relative overflow-hidden transition-all active:scale-95"
                style={{ background: `${catInfo.color}1a`, border: `2px solid ${catInfo.color}77`, minHeight: '62px', cursor: isPlayer ? 'pointer' : 'default' }}
              >
                {slot.card.imageUrl ? (
                  <img src={slot.card.imageUrl} alt={slot.name} className="absolute inset-0 w-full h-full object-cover opacity-70" />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-2xl opacity-50">
                    {catInfo.emoji}
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
                <div className="relative z-10 flex flex-col justify-end h-full p-1">
                  <p className="text-[9px] font-black text-white leading-tight truncate" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.95)' }}>{slot.name}</p>
                </div>
                {slot.count > 1 && (
                  <div className="absolute top-0.5 right-0.5 z-20 rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1" style={{ background: '#ffd700', border: '1.5px solid rgba(0,0,0,0.6)' }}>
                    <span className="text-[10px] font-black text-black">×{slot.count}</span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Slot Detail Popup */}
      {detailSlot && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6" style={{ background: 'rgba(0,0,0,0.75)' }} onClick={() => setDetailSlot(null)}>
          <div
            className="rounded-2xl p-5 max-w-xs w-full relative"
            style={{
              background: 'linear-gradient(135deg, rgba(21,29,59,0.98), rgba(14,20,45,0.98))',
              border: `3px solid ${CATEGORY_INFO[detailSlot.card.category].color}`,
              boxShadow: `0 12px 40px rgba(0,0,0,0.7), 0 0 24px ${CATEGORY_INFO[detailSlot.card.category].color}66`,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button onClick={() => setDetailSlot(null)} className="absolute top-2 right-3 text-amber-200/60 text-2xl font-black hover:text-white">✕</button>
            <div className="flex justify-center mb-3">
              <CardDisplay card={detailSlot.card} />
            </div>
            <div className="text-center">
              <p className="text-xl font-black text-amber-100 mb-1" style={{ textShadow: '0 2px 4px rgba(0,0,0,0.9)' }}>{detailSlot.name}</p>
              <p className="text-sm font-bold mb-2" style={{ color: CATEGORY_INFO[detailSlot.card.category].color }}>
                {CATEGORY_INFO[detailSlot.card.category].label} / {RARITY_INFO[detailSlot.card.rarity].label} / パワー {detailSlot.card.power}
              </p>
              <p className="text-xs text-amber-200/80 leading-relaxed mb-3">{detailSlot.card.effectDescription}</p>
              <div className="rounded-lg p-2" style={{ background: 'rgba(255,215,0,0.1)', border: '1px solid rgba(255,215,0,0.3)' }}>
                <p className="text-xs font-bold text-amber-200/70">ベンチ内枚数</p>
                <p className="text-2xl font-black" style={{ color: '#ffd700', textShadow: '0 0 10px rgba(255,215,0,0.5)' }}>×{detailSlot.count}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ===================== Card Display Component =====================
function CardDisplay({ card, isDefense, isWinner, size }: { card: BattleCard; isDefense?: boolean; isWinner?: boolean; size?: 'sm' | 'md'; }) {
  const catInfo = CATEGORY_INFO[card.category];
  const rarInfo = RARITY_INFO[card.rarity];
  const [imgLoaded, setImgLoaded] = useState(false);
  // 1.5x size upgrade
  const w = size === 'sm' ? 120 : 200;
  const h = size === 'sm' ? 150 : 260;
  return (
    <div className={`inline-block rounded-xl p-0 relative overflow-hidden ${isWinner ? 'kc-win-glow' : ''} ${card.rarity === 'SSR' ? 'kc-card-ssr' : ''}`} style={{ background: 'linear-gradient(135deg, rgba(21,29,59,0.95), rgba(14,20,45,0.95))', border: `3px solid ${isWinner ? 'rgba(255,215,0,0.8)' : card.rarity === 'SSR' ? 'transparent' : isDefense ? 'rgba(100,180,255,0.5)' : `${catInfo.color}55`}`, boxShadow: isWinner ? '0 0 24px rgba(255,215,0,0.55), 0 0 48px rgba(255,215,0,0.25), 0 6px 20px rgba(0,0,0,0.5)' : card.rarity === 'SSR' ? '0 0 22px rgba(255,215,0,0.5), 0 0 38px rgba(236,72,153,0.3), 0 6px 20px rgba(0,0,0,0.5)' : isDefense ? '0 0 16px rgba(100,180,255,0.3), 0 6px 20px rgba(0,0,0,0.5)' : `0 6px 20px rgba(0,0,0,0.5), inset 0 0 24px ${catInfo.color}10`, width: `${w}px`, height: `${h}px` }}>
      {!imgLoaded && (
        <div className="absolute inset-0 flex items-center justify-center animate-pulse" style={{ background: `linear-gradient(135deg, ${catInfo.color}15, rgba(14,20,45,0.95))` }}>
          <span className={`${size === 'sm' ? 'text-4xl' : 'text-6xl'} opacity-40`}>{catInfo.emoji}</span>
        </div>
      )}
      {card.imageUrl && (
        <img src={card.imageUrl} alt={card.name} className={`w-full h-full object-cover transition-opacity duration-300 ${imgLoaded ? 'opacity-100' : 'opacity-0'}`} loading="eager" decoding="async" onLoad={() => setImgLoaded(true)} onError={() => setImgLoaded(true)} />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent flex flex-col justify-between p-2">
        <div className="flex items-start justify-between">
          <div className={size === 'sm' ? 'text-xl' : 'text-3xl'}>{catInfo.emoji}</div>
          {size !== 'sm' && <div className="px-2 py-0.5 rounded text-xs font-black" style={{ background: rarInfo.bgColor, color: rarInfo.color }}>{rarInfo.label}</div>}
          {size === 'sm' && <div className="px-1.5 py-0.5 rounded text-[10px] font-black" style={{ background: rarInfo.bgColor, color: rarInfo.color }}>{rarInfo.label}</div>}
        </div>
        <div>
          <p className={`font-black text-white drop-shadow-lg ${size === 'sm' ? 'text-sm leading-tight mb-0.5' : 'text-lg leading-tight mb-1'}`} style={{ textShadow: '0 2px 6px rgba(0,0,0,0.95), 0 0 3px rgba(0,0,0,0.8)' }}>{card.name}</p>
          <div className="flex items-center justify-between">
            {size !== 'sm' && <p className="text-sm font-bold" style={{ color: catInfo.color, textShadow: '0 1px 3px rgba(0,0,0,0.9)' }}>{catInfo.label}</p>}
            <div className="flex items-baseline gap-0.5 ml-auto">
              <span className={`font-black ${size === 'sm' ? 'text-xl' : 'text-3xl'}`} style={{ color: '#ffd700', textShadow: '0 0 10px rgba(255,215,0,0.7), 0 2px 4px rgba(0,0,0,0.95)' }}>{card.power}</span>
              <span className={`font-bold ${size === 'sm' ? 'text-xs' : 'text-sm'}`} style={{ color: '#ffd700', textShadow: '0 1px 3px rgba(0,0,0,0.9)' }}>P</span>
            </div>
          </div>
        </div>
      </div>
      {isDefense && <div className="absolute top-1.5 left-1.5"><span className={size === 'sm' ? 'text-base' : 'text-xl'}>🛡️</span></div>}
      {isWinner && <div className="absolute top-1.5 right-1.5 kc-win-badge"><span className={`${size === 'sm' ? 'text-lg' : 'text-2xl'} drop-shadow-lg`}>👑</span></div>}
    </div>
  );
}

// ===================== Card Mini Component =====================
function CardMini({ card }: { card: BattleCard }) {
  const catInfo = CATEGORY_INFO[card.category];
  const rarInfo = RARITY_INFO[card.rarity];
  return (
    <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg overflow-hidden" style={{ background: `${catInfo.color}15`, border: `1px solid ${catInfo.color}33` }}>
      {card.imageUrl && <img src={card.imageUrl} alt={card.name} className="w-6 h-6 rounded object-cover" />}
      {!card.imageUrl && <span className="text-sm">{catInfo.emoji}</span>}
      <span className="text-[10px] font-bold text-amber-100">{card.name}</span>
      <span className="text-[9px] font-bold" style={{ color: rarInfo.color }}>{rarInfo.label}</span>
      <span className="text-[10px] font-bold" style={{ color: '#ffd700' }}>P{card.power}</span>
    </div>
  );
}
