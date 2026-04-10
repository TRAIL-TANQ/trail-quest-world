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
  const [aiAttackIntro, setAiAttackIntro] = useState(false);
  const [battleOutcome, setBattleOutcome] = useState<'victory' | 'defeat' | null>(null);
  const [screenShake, setScreenShake] = useState(false);
  const [sideBurst, setSideBurst] = useState<'player' | 'ai' | null>(null);
  const [flagMoveAnim, setFlagMoveAnim] = useState<'toPlayer' | 'toAi' | null>(null);
  const [aiPowerPopKey, setAiPowerPopKey] = useState(0);

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
  }, []);

  /* ---------- Draw card ---------- */
  const handleDraw = useCallback(() => {
    if (!gameState || gameState.phase !== 'player_draw') return;
    const newState = playerDrawCard(gameState);
    setGameState(newState);
    if (newState.phase === 'quiz' && newState.playerCard) {
      const quizzes = newState.playerCard.quizzes;
      const quiz = quizzes[Math.floor(Math.random() * quizzes.length)];
      setSelectedQuiz(quiz);
      setQuizTimer(10);
      setSelectedAnswer(null);
      setShowResult(false);
      setShowCardReveal(true);
      setTimeout(() => setShowCardReveal(false), 800);
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
      setGameState(newState);
      triggerPowerEffect(newState.lastAddedPower);
      if (newState.winningCard && newState.winningCardSide === 'player') {
        triggerAttackSlide();
        triggerWinEffect('player');
      }
      setSelectedQuiz(null);
      setShowResult(false);
      if (newState.phase === 'ai_turn') processAITurn(newState);
      else if (newState.phase === 'game_over') {
        setShowGameOverOverlay(true);
        setTimeout(() => setScreen('result'), 2500);
      }
    }, 1500);
  }, [gameState, userId]);

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
        setGameState(newState);
        triggerPowerEffect(newState.lastAddedPower);
        if (newState.winningCard && newState.winningCardSide === 'player') {
          triggerAttackSlide();
          triggerWinEffect('player');
        }
        setSelectedQuiz(null);
        setShowResult(false);
        setSelectedAnswer(null);
        if (newState.phase === 'ai_turn') processAITurn(newState);
        else if (newState.phase === 'game_over') {
          setShowGameOverOverlay(true);
          setTimeout(() => setScreen('result'), 2500);
        }
      }, 1800);
    },
    [gameState, selectedQuiz, selectedAnswer, consecutiveCorrect, userId, addTotalAlt],
  );

  /* ---------- AI turn ---------- */
  const processAITurn = useCallback((state: GameState) => {
    setAiAnimating(true);
    setAiAttackIntro(true);
    setTimeout(() => setAiAttackIntro(false), 1300);
    setTimeout(() => {
      const newState = aiTurn(state);
      setGameState(newState);
      setAiAnimating(false);
      // Pop the AI attack power number
      setAiPowerPopKey((k) => k + 1);
      if (newState.winningCard && newState.winningCardSide === 'ai') {
        triggerAttackSlide();
        triggerWinEffect('ai');
      }
      if (newState.phase === 'game_over') {
        setShowGameOverOverlay(true);
        setTimeout(() => setScreen('result'), 2500);
      }
    }, 2000);
  }, []);

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

      {/* AI Attack Intro */}
      {aiAttackIntro && (
        <div className="kc-ai-attack-intro">
          <span className="kc-ai-attack-intro-text">⚔️ 相手の攻撃！</span>
        </div>
      )}

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
        <button onClick={() => navigate('/games')} className="text-amber-200/35 text-sm hover:text-amber-200/60">
          ✕
        </button>
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
    <div className={`inline-block rounded-xl p-0 relative overflow-hidden ${isWinner ? 'kc-win-glow' : ''}`} style={{ background: 'linear-gradient(135deg, rgba(21,29,59,0.95), rgba(14,20,45,0.95))', border: `2px solid ${isWinner ? 'rgba(255,215,0,0.8)' : isDefense ? 'rgba(100,180,255,0.5)' : `${catInfo.color}55`}`, boxShadow: isWinner ? '0 0 20px rgba(255,215,0,0.5), 0 0 40px rgba(255,215,0,0.2), 0 4px 16px rgba(0,0,0,0.4)' : isDefense ? '0 0 12px rgba(100,180,255,0.2), 0 4px 16px rgba(0,0,0,0.4)' : `0 4px 16px rgba(0,0,0,0.4), inset 0 0 20px ${catInfo.color}08`, width: `${w}px`, height: `${h}px` }}>
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
