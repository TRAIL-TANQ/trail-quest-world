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
  const clearStepTimeouts = useCallback(() => {
    stepTimeoutsRef.current.forEach((id) => clearTimeout(id));
    stepTimeoutsRef.current = [];
  }, []);
  const scheduleStep = useCallback((delayMs: number, fn: () => void) => {
    const scale = fastModeRef.current ? 0.3 : 1;
    const id = window.setTimeout(fn, Math.max(100, delayMs * scale));
    stepTimeoutsRef.current.push(id);
  }, []);

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
    const playerDeck = createInitialDeck();
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
  }, [clearStepTimeouts]);

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
      scheduleStep(800, () => setBattleStep('compare'));
      scheduleStep(1700, () => {
        setBattleStep('outcome');
        setGameState(newState);
        triggerPowerEffect(newState.lastAddedPower);
        if (attackerWins) {
          triggerAttackSlide();
          triggerWinEffect('player');
        }
      });
      scheduleStep(3000, () => {
        setBattleStep('none');
        setBattleSeq(null);
        if (newState.phase === 'ai_turn') processAITurnRef.current?.(newState);
        else if (newState.phase === 'game_over') {
          setShowGameOverOverlay(true);
          setTimeout(() => setScreen('result'), 2500);
        }
      });
    },
    [scheduleStep],
  );

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
    setTimeout(() => {
      const newState = processQuizAnswer(gameState, false);
      setSelectedQuiz(null);
      setShowResult(false);
      runPlayerCinematic(newState, gameState);
    }, 1500);
  }, [gameState, userId, runPlayerCinematic]);

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

      setTimeout(() => {
        const newState = processQuizAnswer(gameState, correct);
        setSelectedQuiz(null);
        setShowResult(false);
        setSelectedAnswer(null);
        runPlayerCinematic(newState, gameState);
      }, 1800);
    },
    [gameState, selectedQuiz, selectedAnswer, consecutiveCorrect, userId, addTotalAlt, runPlayerCinematic],
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
    // Step 3: card_flip (0.5s)
    scheduleStep(1500, () => setBattleStep('card_flip'));
    // Step 4: card_reveal (0.5s)
    scheduleStep(2000, () => setBattleStep('card_reveal'));
    // Step 5: compare (0.7s)
    scheduleStep(2700, () => setBattleStep('compare'));
    // Step 6: outcome — apply state + effects
    scheduleStep(3700, () => {
      setBattleStep('outcome');
      setGameState(result);
      setAiPowerPopKey((k) => k + 1);
      if (attackerWins) {
        triggerAttackSlide();
        triggerWinEffect('ai');
      }
    });
    // Cleanup cinematic
    scheduleStep(5200, () => {
      setBattleStep('none');
      setBattleSeq(null);
      setAiAnimating(false);
      if (result.phase === 'game_over') {
        setShowGameOverOverlay(true);
        setTimeout(() => setScreen('result'), 2500);
      }
    });
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

          <div className="rounded-xl p-3 mb-4" style={{ background: 'rgba(255,215,0,0.05)', border: '1px solid rgba(255,215,0,0.15)' }}>
            <p className="text-amber-200/60 text-[11px] text-left leading-relaxed">
              <span className="text-amber-100 font-bold">ルール：</span>
              <br />
              ・山札からカードをめくって攻撃
              <br />
              ・4択クイズに正解でパワーアップ
              <br />
              ・防衛カードより大きいパワーでフラッグ奪取
              <br />
              ・ベンチが5種類埋まるかデッキ切れで敗北
            </p>
          </div>

          <div className="flex items-center justify-center gap-5 mb-5">
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
              <p className="text-[9px] text-amber-200/35 mb-1">初期デッキ</p>
              <span className="text-sm font-bold text-amber-100">6枚</span>
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
          <button onClick={startGame} className="rpg-btn rpg-btn-green w-full text-lg py-3.5 mb-2">
            {imagesPreloaded ? '⚔️ バトル開始！' : `⏳ 読み込み中... ${preloadProgress}%`}
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
  const playerBenchDanger = gameState.player.bench.length >= 4;
  const aiBenchDanger = gameState.ai.bench.length >= 4;
  const allCategories: Array<'great_person' | 'creature' | 'heritage' | 'invention' | 'discovery'> = ['great_person', 'creature', 'heritage', 'invention', 'discovery'];

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
          <button onClick={() => navigate('/games')} className="text-amber-200/35 text-sm hover:text-amber-200/60">
            ✕
          </button>
          <button
            onClick={() => setFastMode((v) => !v)}
            className="text-[10px] font-bold px-2 py-1 rounded-md transition-all"
            style={{
              background: fastMode ? 'rgba(255,215,0,0.2)' : 'rgba(255,255,255,0.05)',
              border: `1px solid ${fastMode ? 'rgba(255,215,0,0.5)' : 'rgba(255,255,255,0.15)'}`,
              color: fastMode ? '#ffd700' : 'rgba(255,255,255,0.5)',
            }}
            title="演出の速度切替"
          >
            {fastMode ? '⏩ 早送りON' : '⏩ 早送りOFF'}
          </button>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-center">
            <p className="text-[8px] text-amber-200/35">ラウンド</p>
            <p className="text-sm font-bold" style={{ color: '#ffd700' }}>{gameState.round}</p>
          </div>
          <div
            className="flex items-center gap-1 px-2 py-1 rounded-full"
            style={{
              background: gameState.flagHolder === 'player' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
              border: `1px solid ${gameState.flagHolder === 'player' ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.4)'}`,
            }}
          >
            <span className="text-sm">🚩</span>
            <span className="text-[10px] font-bold" style={{ color: gameState.flagHolder === 'player' ? '#22c55e' : '#ef4444' }}>
              {gameState.flagHolder === 'player' ? 'あなた' : 'AI'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-center">
            <p className="text-[8px] text-amber-200/35">山札</p>
            <p className={`text-sm font-bold ${gameState.player.deck.length === 0 ? 'kc-deck-empty' : 'text-amber-100'}`}>{gameState.player.deck.length}</p>
          </div>
          <div className="text-center relative">
            <p className="text-[8px] text-amber-200/35">ALT</p>
            <p className="text-sm font-bold" style={{ color: '#ffd700' }}>
              {altBalance !== null ? altBalance.toLocaleString() : '---'}
            </p>
            {altRewardPopup && (
              <div
                key={altRewardPopup.key}
                className="absolute -bottom-14 left-1/2 z-50 pointer-events-none whitespace-nowrap"
                style={{ animation: 'kcAltRewardFloat 2.5s ease-out forwards', transform: 'translateX(-50%)' }}
              >
                <div className="rounded-lg px-2.5 py-1.5" style={{
                  background: 'linear-gradient(135deg, rgba(255,215,0,0.25), rgba(255,170,0,0.2))',
                  border: '1px solid rgba(255,215,0,0.5)',
                  boxShadow: '0 0 16px rgba(255,215,0,0.3)',
                }}>
                  <span className="text-sm font-black" style={{ color: '#ffd700', textShadow: '0 0 8px rgba(255,215,0,0.5)' }}>
                    +{altRewardPopup.alt} ALT
                  </span>
                  {altRewardPopup.streak && <span className="text-[9px] ml-1 font-bold text-orange-300">連続ボーナス!</span>}
                  {altRewardPopup.rarity && <span className="text-[9px] ml-1 font-bold text-purple-300">高難度!</span>}
                </div>
                {altRewardPopup.xp > 0 && (
                  <p className="text-[9px] text-green-400 font-bold mt-0.5 text-center">+{altRewardPopup.xp} XP</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Turn Banner + Streak/XP */}
      <div
        className="px-3 py-1.5 flex items-center justify-between shrink-0"
        style={{
          background: isPlayerAttacking
            ? 'linear-gradient(90deg, rgba(34,197,94,0.08), rgba(0,0,0,0.25), rgba(34,197,94,0.08))'
            : aiAnimating
              ? 'linear-gradient(90deg, rgba(239,68,68,0.08), rgba(0,0,0,0.25), rgba(239,68,68,0.08))'
              : 'linear-gradient(90deg, rgba(100,180,255,0.08), rgba(0,0,0,0.25), rgba(100,180,255,0.08))',
          borderBottom: '1px solid rgba(255,215,0,0.08)',
        }}
      >
        <div className="flex items-center gap-2">
          {aiAnimating ? (
            <span className="text-[10px] font-bold text-red-400 kc-pulse-text">🤖 AI攻撃中...</span>
          ) : gameState.phase === 'quiz' ? (
            <span className="text-[10px] font-bold text-amber-200">❓ クイズ！</span>
          ) : isPlayerAttacking ? (
            <span className="text-[10px] font-bold text-green-400">🗡️ あなたの攻撃</span>
          ) : (
            <span className="text-[10px] font-bold text-blue-400">🛡️ あなたの防衛</span>
          )}
          {consecutiveCorrect >= 2 && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'rgba(255,170,0,0.2)', color: '#ffaa00', border: '1px solid rgba(255,170,0,0.3)' }}>
              🔥 {consecutiveCorrect}連続!
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[9px] text-amber-200/40">Lv.{xpLevel}</span>
          <span className="text-[9px] text-amber-200/40">XP: {xpTotal}</span>
        </div>
      </div>

      {/* AI Bench */}
      <BenchDisplay side="ai" bench={gameState.ai.bench} deckCount={gameState.ai.deck.length} isDanger={aiBenchDanger} allCategories={allCategories} />

      {/* Battle Field */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 gap-1 relative min-h-0 overflow-hidden">
        {/* AI Side */}
        <div className={`text-center relative ${attackSlide && gameState.winningCardSide === 'ai' ? 'kc-attack-slide-down' : ''}`}>
          {!isPlayerAttacking && gameState.aiAttackCards.length > 0 && (
            <div className="relative inline-block mb-1" style={{ height: `${Math.min(130, 90 + (gameState.aiAttackCards.length - 1) * 8)}px`, width: `${Math.min(150, 100 + (gameState.aiAttackCards.length - 1) * 5)}px` }}>
              {gameState.aiAttackCards.map((card, i) => (
                <div key={card.id + '-' + i} className="absolute" style={{ top: `${i * 8}px`, left: `${i * 4}px`, zIndex: i + 1, transform: `rotate(${(i - Math.floor(gameState.aiAttackCards.length / 2)) * 2}deg)`, transition: 'all 0.4s ease-out' }}>
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
            <p key={aiPowerPopKey} className="text-xs font-bold text-red-400 mt-0.5 kc-power-pop">攻撃力: {gameState.aiAttackTotal}</p>
          )}
        </div>

        {/* Center Flag & VS */}
        <div className="flex items-center gap-2 w-full max-w-xs relative">
          <div className="h-px flex-1" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,215,0,0.3))' }} />
          <div className={`kc-flag-center ${flagFlash ? 'kc-flag-pulse' : ''} ${flagMoveAnim === 'toPlayer' ? 'kc-flag-move-to-player' : flagMoveAnim === 'toAi' ? 'kc-flag-move-to-ai' : ''}`}>
            <span className={`text-lg inline-block ${flagMoveAnim ? 'kc-flag-wave' : ''}`}>🚩</span>
          </div>
          <div className="h-px flex-1" style={{ background: 'linear-gradient(90deg, rgba(255,215,0,0.3), transparent)' }} />
        </div>

        {/* Power Comparison Bar */}
        {(attackerPower > 0 || defenderPower > 0) && (
          <PowerBar attackerPower={attackerPower} defenderPower={defenderPower} isPlayerAttacking={isPlayerAttacking} percent={powerBarPercent} powerAddEffect={powerAddEffect} />
        )}

        {/* Player Side */}
        <div className={`text-center relative ${attackSlide && gameState.winningCardSide === 'player' ? 'kc-attack-slide-up' : ''}`}>
          {isPlayerAttacking && gameState.playerAttackCards.length > 0 && (
            <div className="relative inline-block mb-1" style={{ height: `${Math.min(130, 90 + (gameState.playerAttackCards.length - 1) * 10)}px`, width: `${Math.min(150, 100 + (gameState.playerAttackCards.length - 1) * 5)}px` }}>
              {gameState.playerAttackCards.map((card, i) => (
                <div key={card.id + '-stack-' + i} className="absolute" style={{ top: `${i * 10}px`, left: `${i * 5}px`, zIndex: i + 1, transform: `rotate(${(i - Math.floor(gameState.playerAttackCards.length / 2)) * 2.5}deg)`, transition: 'all 0.4s ease-out', animation: 'kcCardStackIn 0.4s ease-out' }}>
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
          <div className="w-full max-w-sm mt-1">
            {showCardReveal ? (
              <div className="text-center kc-card-reveal">
                <CardDisplay card={gameState.playerCard} />
              </div>
            ) : (
              <>
                <div className="flex items-center justify-center gap-2 mb-1.5">
                  <CardMini card={gameState.playerCard} />
                  <span className="text-[10px] text-amber-200/40">のクイズ！</span>
                </div>
                <div className="rounded-xl p-3" style={{ background: 'linear-gradient(135deg, rgba(21,29,59,0.95), rgba(14,20,45,0.95))', border: '1.5px solid rgba(255,215,0,0.25)' }}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] text-amber-200/40">制限時間</span>
                    <span className={`text-sm font-bold ${quizTimer <= 3 ? 'text-red-400' : 'text-amber-100'}`}>{quizTimer}秒</span>
                  </div>
                  <div className="h-1 rounded-full mb-3" style={{ background: 'rgba(255,255,255,0.05)' }}>
                    <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${(quizTimer / 10) * 100}%`, background: quizTimer <= 3 ? '#ef4444' : '#ffd700' }} />
                  </div>
                  <p className="text-amber-100 text-sm font-bold mb-3 leading-relaxed">{selectedQuiz.question}</p>
                  <div className="space-y-2">
                    {selectedQuiz.choices.map((choice, i) => {
                      let btnStyle: React.CSSProperties = { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' };
                      if (showResult) {
                        if (i === selectedQuiz.correctIndex) btnStyle = { background: 'rgba(34,197,94,0.2)', border: '1px solid rgba(34,197,94,0.5)' };
                        else if (i === selectedAnswer && i !== selectedQuiz.correctIndex) btnStyle = { background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.5)' };
                      }
                      return (
                        <button key={i} onClick={() => handleAnswer(i)} disabled={selectedAnswer !== null} className="w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all active:scale-[0.98]" style={{ ...btnStyle, color: showResult && i === selectedQuiz.correctIndex ? '#22c55e' : showResult && i === selectedAnswer ? '#ef4444' : 'rgba(255,255,255,0.8)' }}>
                          <span className="text-amber-200/30 mr-2 text-xs">{['A', 'B', 'C', 'D'][i]}</span>
                          {choice}
                        </button>
                      );
                    })}
                  </div>
                  {showResult && (
                    <div className="mt-2 text-center">
                      <span className={`text-sm font-bold ${selectedAnswer === selectedQuiz.correctIndex ? 'text-green-400' : 'text-red-400'}`}>
                        {selectedAnswer === selectedQuiz.correctIndex ? '正解！パワーアップ！' : selectedAnswer === -1 ? '時間切れ...' : '不正解...'}
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
      <BenchDisplay side="player" bench={gameState.player.bench} deckCount={gameState.player.deck.length} isDanger={playerBenchDanger} allCategories={allCategories} />

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
          background: rgba(0,0,0,0.55);
          backdrop-filter: blur(2px);
          animation: kcCineLayer 0.3s ease-out;
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
          font-size: 0.9rem; font-weight: 900;
          color: #ffd700; margin-bottom: 10px;
          text-shadow: 0 0 8px rgba(255,215,0,0.5);
        }
        .kc-cine-compare-row {
          display: flex; align-items: center; justify-content: center; gap: 18px;
        }
        .kc-cine-side {
          min-width: 80px;
          padding: 10px 14px;
          border-radius: 12px;
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
          font-size: 0.7rem; font-weight: 700;
          color: rgba(255,255,255,0.6);
          margin-bottom: 4px;
        }
        .kc-cine-num {
          font-size: 2.2rem; font-weight: 900;
          color: #ffd700;
          text-shadow: 0 0 12px rgba(255,215,0,0.6), 0 2px 0 rgba(0,0,0,0.5);
          line-height: 1;
          animation: kcCineNumPop 0.5s cubic-bezier(.17,.67,.35,1.4) both;
        }
        @keyframes kcCineNumPop {
          0%   { opacity: 0; transform: scale(0.3); }
          60%  { opacity: 1; transform: scale(1.3); }
          100% { opacity: 1; transform: scale(1); }
        }
        .kc-cine-vs {
          font-size: 1.2rem; font-weight: 900;
          color: #ff8c00;
          text-shadow: 0 0 10px rgba(255,140,0,0.7);
          animation: kcCineVsPulse 0.8s ease-in-out infinite;
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
function BenchDisplay({ side, bench, deckCount, isDanger, allCategories }: {
  side: 'player' | 'ai'; bench: Array<{ category: string; cards: BattleCard[] }>; deckCount: number; isDanger: boolean; allCategories: string[];
}) {
  const isPlayer = side === 'player';
  const label = isPlayer ? 'あなた' : 'AI';
  const labelColor = isPlayer ? '#22c55e' : '#ef4444';
  const emptySlots = 5 - bench.length;
  const isFull = bench.length >= 5;
  const benchMap = new Map(bench.map(s => [s.category, s]));
  return (
    <div className={`px-3 py-1.5 shrink-0 ${isFull ? 'kc-bench-full' : isDanger ? 'kc-bench-danger' : ''}`} style={{ borderTop: isPlayer ? '1px solid rgba(255,215,0,0.1)' : 'none', borderBottom: !isPlayer ? '1px solid rgba(255,215,0,0.1)' : 'none', background: isFull ? 'rgba(239,68,68,0.12)' : isDanger ? 'rgba(239,68,68,0.05)' : 'transparent' }}>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold" style={{ color: labelColor }}>{label}</span>
          <span className="text-[9px] text-amber-200/30">山札: {deckCount}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className={`text-[9px] font-bold ${isDanger ? 'text-red-400' : 'text-amber-200/40'}`}>ベンチ {bench.length}/5</span>
          {isDanger && <span className="text-[9px] text-red-400 font-bold">⚠️</span>}
          {emptySlots > 0 && <span className="text-[8px] text-amber-200/25">残り{emptySlots}枠</span>}
        </div>
      </div>
      <div className="flex gap-1">
        {allCategories.map((cat) => {
          const catInfo = CATEGORY_INFO[cat as keyof typeof CATEGORY_INFO];
          const slot = benchMap.get(cat);
          const filled = !!slot;
          return (
            <div key={cat} className="flex-1 rounded px-1 py-0.5 text-center" style={{ background: filled ? `${catInfo.color}18` : 'rgba(255,255,255,0.03)', border: `1px solid ${filled ? `${catInfo.color}44` : 'rgba(255,255,255,0.06)'}`, opacity: filled ? 1 : 0.5 }}>
              <span className="text-[10px] block">{catInfo.emoji}</span>
              {filled ? <span className="text-[8px] font-bold block" style={{ color: catInfo.color }}>{slot!.cards.length}枚</span> : <span className="text-[7px] text-amber-200/20 block">---</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ===================== Card Display Component =====================
function CardDisplay({ card, isDefense, isWinner, size }: { card: BattleCard; isDefense?: boolean; isWinner?: boolean; size?: 'sm' | 'md'; }) {
  const catInfo = CATEGORY_INFO[card.category];
  const rarInfo = RARITY_INFO[card.rarity];
  const [imgLoaded, setImgLoaded] = useState(false);
  const w = size === 'sm' ? 80 : 140;
  const h = size === 'sm' ? 100 : 175;
  return (
    <div className={`inline-block rounded-xl p-0 relative overflow-hidden ${isWinner ? 'kc-win-glow' : ''} ${card.rarity === 'SSR' ? 'kc-card-ssr' : ''}`} style={{ background: 'linear-gradient(135deg, rgba(21,29,59,0.95), rgba(14,20,45,0.95))', border: `2px solid ${isWinner ? 'rgba(255,215,0,0.8)' : card.rarity === 'SSR' ? 'transparent' : isDefense ? 'rgba(100,180,255,0.5)' : `${catInfo.color}55`}`, boxShadow: isWinner ? '0 0 20px rgba(255,215,0,0.5), 0 0 40px rgba(255,215,0,0.2), 0 4px 16px rgba(0,0,0,0.4)' : card.rarity === 'SSR' ? '0 0 18px rgba(255,215,0,0.45), 0 0 32px rgba(236,72,153,0.25), 0 4px 16px rgba(0,0,0,0.4)' : isDefense ? '0 0 12px rgba(100,180,255,0.2), 0 4px 16px rgba(0,0,0,0.4)' : `0 4px 16px rgba(0,0,0,0.4), inset 0 0 20px ${catInfo.color}08`, width: `${w}px`, height: `${h}px` }}>
      {!imgLoaded && (
        <div className="absolute inset-0 flex items-center justify-center animate-pulse" style={{ background: `linear-gradient(135deg, ${catInfo.color}15, rgba(14,20,45,0.95))` }}>
          <span className={`${size === 'sm' ? 'text-2xl' : 'text-4xl'} opacity-40`}>{catInfo.emoji}</span>
        </div>
      )}
      {card.imageUrl && (
        <img src={card.imageUrl} alt={card.name} className={`w-full h-full object-cover transition-opacity duration-300 ${imgLoaded ? 'opacity-100' : 'opacity-0'}`} loading="eager" decoding="async" onLoad={() => setImgLoaded(true)} onError={() => setImgLoaded(true)} />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex flex-col justify-between p-1.5">
        <div className="flex items-start justify-between">
          <div className={size === 'sm' ? 'text-xs' : 'text-lg'}>{catInfo.emoji}</div>
          {size !== 'sm' && <div className="px-1.5 py-0.5 rounded text-[8px] font-bold" style={{ background: rarInfo.bgColor, color: rarInfo.color }}>{rarInfo.label}</div>}
        </div>
        <div>
          <p className={`font-bold text-amber-100 ${size === 'sm' ? 'text-[8px] leading-tight' : 'text-xs mb-0.5'}`}>{card.name}</p>
          <div className="flex items-center justify-between">
            {size !== 'sm' && <p className="text-[9px]" style={{ color: catInfo.color }}>{catInfo.label}</p>}
            <div className="flex items-center gap-0.5">
              <span className={`font-bold ${size === 'sm' ? 'text-[10px]' : 'text-sm'}`} style={{ color: '#ffd700' }}>{card.power}</span>
              <span className={`text-amber-200/60 ${size === 'sm' ? 'text-[7px]' : 'text-[8px]'}`}>P</span>
            </div>
          </div>
        </div>
      </div>
      {isDefense && <div className="absolute top-1 left-1"><span className="text-[10px]">🛡️</span></div>}
      {isWinner && <div className="absolute top-1 right-1 kc-win-badge"><span className="text-sm drop-shadow-lg">👑</span></div>}
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
