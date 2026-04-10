/**
 * Knowledge Challenger - Card Battle Game UI
 * フラッグ奪い合い方式のカードバトルゲーム
 * Dark Navy + Gold RPG aesthetic
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
} from '@/lib/knowledgeCards';
import {
  type GameState,
  initGameState,
  playerDrawCard,
  processQuizAnswer,
  aiTurn,
} from '@/lib/knowledgeEngine';

type ScreenPhase = 'title' | 'playing' | 'result';

export default function KnowledgeChallenger() {
  const [, navigate] = useLocation();
  const addTotalAlt = useUserStore((s) => s.addTotalAlt);
  const setLastResult = useGameStore((s) => s.setLastResult);
  const triggerEarnEffect = useAltStore((s) => s.triggerEarnEffect);

  const [screen, setScreen] = useState<ScreenPhase>('title');
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [selectedQuiz, setSelectedQuiz] = useState<Quiz | null>(null);
  const [quizTimer, setQuizTimer] = useState(10);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [aiAnimating, setAiAnimating] = useState(false);
  const [showCardReveal, setShowCardReveal] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef(0);

  // Start game
  const startGame = useCallback(() => {
    const playerDeck = createInitialDeck();
    const aiDeck = createAIDeck();
    const state = initGameState(playerDeck, aiDeck);
    setGameState(state);
    setScreen('playing');
    startTimeRef.current = Date.now();
  }, []);

  // Draw card
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
      setTimeout(() => setScreen('result'), 1500);
    }
  }, [gameState]);

  // Quiz timer
  useEffect(() => {
    if (!gameState || gameState.phase !== 'quiz' || showCardReveal) return;

    timerRef.current = setInterval(() => {
      setQuizTimer((t) => {
        if (t <= 1) {
          // Time's up - treat as incorrect
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

  const handleQuizTimeout = useCallback(() => {
    if (!gameState) return;
    setSelectedAnswer(-1);
    setShowResult(true);
    setTimeout(() => {
      const newState = processQuizAnswer(gameState, false);
      setGameState(newState);
      setSelectedQuiz(null);
      setShowResult(false);

      if (newState.phase === 'ai_turn') {
        processAITurn(newState);
      } else if (newState.phase === 'game_over') {
        setTimeout(() => setScreen('result'), 1500);
      }
    }, 1500);
  }, [gameState]);

  // Answer quiz
  const handleAnswer = useCallback((answerIndex: number) => {
    if (!gameState || !selectedQuiz || selectedAnswer !== null) return;
    if (timerRef.current) clearInterval(timerRef.current);

    setSelectedAnswer(answerIndex);
    setShowResult(true);
    const correct = answerIndex === selectedQuiz.correctIndex;

    setTimeout(() => {
      const newState = processQuizAnswer(gameState, correct);
      setGameState(newState);
      setSelectedQuiz(null);
      setShowResult(false);
      setSelectedAnswer(null);

      if (newState.phase === 'ai_turn') {
        processAITurn(newState);
      } else if (newState.phase === 'game_over') {
        setTimeout(() => setScreen('result'), 1500);
      }
    }, 1800);
  }, [gameState, selectedQuiz, selectedAnswer]);

  // AI turn processing
  const processAITurn = useCallback((state: GameState) => {
    setAiAnimating(true);
    setTimeout(() => {
      const newState = aiTurn(state);
      setGameState(newState);
      setAiAnimating(false);

      if (newState.phase === 'game_over') {
        setTimeout(() => setScreen('result'), 1500);
      }
    }, 2000);
  }, []);

  // Handle game end
  const handleFinish = useCallback(() => {
    if (!gameState) return;
    const timeSeconds = Math.floor((Date.now() - startTimeRef.current) / 1000);
    const won = gameState.winner === 'player';
    const altReward = won ? 30 : 5;
    addTotalAlt(altReward);
    triggerEarnEffect(altReward);
    setLastResult({
      score: won ? 100 : 30,
      maxScore: 100,
      timeSeconds,
      accuracy: won ? 1 : 0.3,
      isBestScore: won,
    });
    navigate('/result');
  }, [gameState, addTotalAlt, triggerEarnEffect, setLastResult, navigate]);

  // ===== TITLE SCREEN =====
  if (screen === 'title') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6"
        style={{ background: 'linear-gradient(180deg, #0b1128 0%, #151d3b 50%, #0e1430 100%)' }}>
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-64 h-64 rounded-full blur-3xl"
          style={{ background: 'rgba(255,215,0,0.05)' }} />
        <div className="relative rounded-2xl p-6 w-full max-w-sm text-center overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, rgba(21,29,59,0.95), rgba(14,20,45,0.95))',
            border: '2px solid rgba(255,215,0,0.35)',
            boxShadow: 'inset 0 0 30px rgba(255,215,0,0.05), 0 8px 32px rgba(0,0,0,0.5)',
          }}>
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
              <span className="text-amber-100 font-bold">ルール：</span><br />
              ・山札からカードをめくって攻撃<br />
              ・4択クイズに正解でパワーアップ<br />
              ・防衛カードより大きいパワーでフラッグ奪取<br />
              ・ベンチが6種類埋まるかデッキ切れで敗北
            </p>
          </div>

          <div className="flex items-center justify-center gap-5 mb-5">
            <div className="text-center">
              <p className="text-[9px] text-amber-200/35 mb-1">難易度</p>
              <div className="flex gap-0.5">{Array.from({ length: 5 }).map((_, i) => (
                <span key={i} className="text-xs" style={{ color: i < 2 ? '#ffd700' : 'rgba(255,255,255,0.12)' }}>★</span>
              ))}</div>
            </div>
            <div className="text-center">
              <p className="text-[9px] text-amber-200/35 mb-1">報酬</p>
              <span className="text-sm font-bold" style={{ color: '#ffd700' }}>+30 ALT</span>
            </div>
            <div className="text-center">
              <p className="text-[9px] text-amber-200/35 mb-1">初期デッキ</p>
              <span className="text-sm font-bold text-amber-100">6枚</span>
            </div>
          </div>

          <button onClick={startGame} className="rpg-btn rpg-btn-green w-full text-lg py-3.5 mb-2">
            ⚔️ バトル開始！
          </button>
          <button onClick={() => navigate('/games')} className="text-amber-200/35 text-xs hover:text-amber-200/60 transition-colors py-2">
            ← ゲーム一覧に戻る
          </button>
        </div>
      </div>
    );
  }

  // ===== RESULT SCREEN =====
  if (screen === 'result' && gameState) {
    const won = gameState.winner === 'player';
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6"
        style={{ background: 'linear-gradient(180deg, #0b1128 0%, #151d3b 100%)' }}>
        <div className="rounded-2xl p-6 w-full max-w-sm text-center relative overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, rgba(21,29,59,0.95), rgba(14,20,45,0.95))',
            border: `2px solid ${won ? 'rgba(255,215,0,0.5)' : 'rgba(239,68,68,0.3)'}`,
            boxShadow: `inset 0 0 30px ${won ? 'rgba(255,215,0,0.08)' : 'rgba(239,68,68,0.05)'}, 0 8px 32px rgba(0,0,0,0.5)`,
          }}>
          <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2" style={{ borderColor: won ? 'rgba(255,215,0,0.6)' : 'rgba(239,68,68,0.4)' }} />
          <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2" style={{ borderColor: won ? 'rgba(255,215,0,0.6)' : 'rgba(239,68,68,0.4)' }} />
          <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2" style={{ borderColor: won ? 'rgba(255,215,0,0.6)' : 'rgba(239,68,68,0.4)' }} />
          <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2" style={{ borderColor: won ? 'rgba(255,215,0,0.6)' : 'rgba(239,68,68,0.4)' }} />

          <h2 className="text-3xl font-bold mb-2" style={{
            color: won ? '#ffd700' : '#ef4444',
            textShadow: `0 0 20px ${won ? 'rgba(255,215,0,0.4)' : 'rgba(239,68,68,0.4)'}`,
          }}>
            {won ? '🎉 勝利！' : '💀 敗北...'}
          </h2>
          <p className="text-amber-200/50 text-sm mb-4">{gameState.message}</p>

          <div className="flex items-center justify-center gap-4 mb-4">
            <div className="text-center px-3 py-2 rounded-lg" style={{ background: 'rgba(255,215,0,0.08)' }}>
              <p className="text-[9px] text-amber-200/35 mb-0.5">ラウンド</p>
              <span className="text-lg font-bold text-amber-100">{gameState.round}</span>
            </div>
            <div className="text-center px-3 py-2 rounded-lg" style={{ background: 'rgba(255,215,0,0.08)' }}>
              <p className="text-[9px] text-amber-200/35 mb-0.5">報酬</p>
              <span className="text-lg font-bold" style={{ color: '#ffd700' }}>+{won ? 30 : 5} ALT</span>
            </div>
          </div>

          {/* Battle Log */}
          <div className="rounded-lg p-2 mb-4 max-h-32 overflow-y-auto text-left"
            style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)' }}>
            {gameState.log.slice(-8).map((entry, i) => (
              <p key={i} className="text-[10px] text-amber-200/40 leading-relaxed">{entry}</p>
            ))}
          </div>

          <div className="flex gap-3">
            <button onClick={() => { setScreen('title'); setGameState(null); }} className="rpg-btn rpg-btn-blue flex-1 py-3">
              もう一度
            </button>
            <button onClick={handleFinish} className="rpg-btn rpg-btn-gold flex-1 py-3">
              リザルトへ
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ===== PLAYING SCREEN =====
  if (!gameState) return null;

  return (
    <div className="min-h-screen flex flex-col"
      style={{ background: 'linear-gradient(180deg, #0b1128 0%, #131b38 50%, #0e1430 100%)' }}>

      {/* Header Bar */}
      <div className="px-3 py-2 flex items-center justify-between"
        style={{
          background: 'linear-gradient(180deg, rgba(11,17,40,0.98), rgba(16,22,48,0.95))',
          borderBottom: '2px solid rgba(255,215,0,0.2)',
          boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
        }}>
        <button onClick={() => navigate('/games')} className="text-amber-200/35 text-sm hover:text-amber-200/60">✕</button>
        <div className="text-center">
          <p className="text-[8px] text-amber-200/35">ラウンド</p>
          <p className="text-sm font-bold" style={{ color: '#ffd700' }}>{gameState.round}</p>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[10px]">🏴</span>
          <span className="text-[10px] font-bold" style={{ color: gameState.flagHolder === 'player' ? '#22c55e' : '#ef4444' }}>
            {gameState.flagHolder === 'player' ? 'あなた' : 'AI'}
          </span>
        </div>
        <div className="text-center">
          <p className="text-[8px] text-amber-200/35">山札</p>
          <p className="text-sm font-bold text-amber-100">{gameState.player.deck.length}</p>
        </div>
      </div>

      {/* AI Area */}
      <div className="px-3 py-2">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-[10px] text-red-400 font-bold">AI</span>
          <span className="text-[9px] text-amber-200/30">山札: {gameState.ai.deck.length}</span>
          <span className="text-[9px] text-amber-200/30">ベンチ: {gameState.ai.bench.length}/6</span>
        </div>
        <div className="flex gap-1 flex-wrap">
          {gameState.ai.bench.map((slot, i) => (
            <div key={i} className="px-1.5 py-0.5 rounded text-[9px] flex items-center gap-0.5"
              style={{ background: `${CATEGORY_INFO[slot.category].color}22`, border: `1px solid ${CATEGORY_INFO[slot.category].color}44` }}>
              <span>{CATEGORY_INFO[slot.category].emoji}</span>
              <span style={{ color: CATEGORY_INFO[slot.category].color }}>{slot.cards.length}</span>
            </div>
          ))}
          {gameState.ai.bench.length === 0 && (
            <span className="text-[9px] text-amber-200/20">ベンチ空</span>
          )}
        </div>
      </div>

      {/* Battle Field */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 gap-2">
        {/* AI Card - Top */}
        <div className="text-center">
          <p className="text-[9px] text-red-400/60 mb-1">AI</p>
          {gameState.aiCard && (
            <CardDisplay card={gameState.aiCard} isDefense />
          )}
          {gameState.aiPowerTotal > 0 && (
            <p className="text-sm font-bold text-red-400 mt-1">攻撃力: {gameState.aiPowerTotal}</p>
          )}
        </div>

        {/* VS Indicator */}
        <div className="flex items-center gap-2 my-1">
          <div className="h-px flex-1" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,215,0,0.3))' }} />
          <span className="text-xs font-bold" style={{ color: '#ffd700' }}>VS</span>
          <div className="h-px flex-1" style={{ background: 'linear-gradient(90deg, rgba(255,215,0,0.3), transparent)' }} />
        </div>

        {/* Player Card - Bottom */}
        <div className="text-center">
          <p className="text-[9px] text-green-400/60 mb-1">あなた</p>
          {gameState.playerCard && (
            <CardDisplay card={gameState.playerCard} />
          )}
          {gameState.playerPowerTotal > 0 && (
            <p className="text-sm font-bold text-green-400 mt-1">攻撃力: {gameState.playerPowerTotal}</p>
          )}
        </div>

        {/* Current Card / Draw Button */}
        {gameState.phase === 'player_draw' && !aiAnimating && (
          <button onClick={handleDraw}
            className="rpg-btn rpg-btn-gold px-8 py-3 text-base animate-pulse">
            🃏 カードをめくる！
          </button>
        )}

        {aiAnimating && (
          <div className="text-center animate-pulse">
            <span className="text-4xl block mb-2">🤖</span>
            <p className="text-amber-200/60 text-sm">AIのターン...</p>
          </div>
        )}

        {gameState.phase === 'quiz' && gameState.playerCard && selectedQuiz && (
          <div className="w-full max-w-sm">
            {/* Card reveal */}
            {showCardReveal ? (
              <div className="text-center animate-bounce-in">
                <CardDisplay card={gameState.playerCard} />
              </div>
            ) : (
              <>
                {/* Small card indicator */}
                <div className="flex items-center justify-center gap-2 mb-2">
                  <CardMini card={gameState.playerCard} />
                  <span className="text-[10px] text-amber-200/40">のクイズ！</span>
                </div>

                {/* Quiz */}
                <div className="rounded-xl p-3" style={{
                  background: 'linear-gradient(135deg, rgba(21,29,59,0.95), rgba(14,20,45,0.95))',
                  border: '1.5px solid rgba(255,215,0,0.25)',
                }}>
                  {/* Timer */}
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] text-amber-200/40">制限時間</span>
                    <span className={`text-sm font-bold ${quizTimer <= 3 ? 'text-red-400' : 'text-amber-100'}`}>
                      {quizTimer}秒
                    </span>
                  </div>
                  <div className="h-1 rounded-full mb-3" style={{ background: 'rgba(255,255,255,0.05)' }}>
                    <div className="h-full rounded-full transition-all duration-1000"
                      style={{
                        width: `${(quizTimer / 10) * 100}%`,
                        background: quizTimer <= 3 ? '#ef4444' : '#ffd700',
                      }} />
                  </div>

                  {/* Question */}
                  <p className="text-amber-100 text-sm font-bold mb-3 leading-relaxed">{selectedQuiz.question}</p>

                  {/* Choices */}
                  <div className="space-y-2">
                    {selectedQuiz.choices.map((choice, i) => {
                      let btnStyle: React.CSSProperties = {
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.1)',
                      };
                      if (showResult) {
                        if (i === selectedQuiz.correctIndex) {
                          btnStyle = {
                            background: 'rgba(34,197,94,0.2)',
                            border: '1px solid rgba(34,197,94,0.5)',
                          };
                        } else if (i === selectedAnswer && i !== selectedQuiz.correctIndex) {
                          btnStyle = {
                            background: 'rgba(239,68,68,0.2)',
                            border: '1px solid rgba(239,68,68,0.5)',
                          };
                        }
                      }
                      return (
                        <button key={i} onClick={() => handleAnswer(i)}
                          disabled={selectedAnswer !== null}
                          className="w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all active:scale-[0.98]"
                          style={{
                            ...btnStyle,
                            color: showResult && i === selectedQuiz.correctIndex ? '#22c55e' :
                              showResult && i === selectedAnswer ? '#ef4444' : 'rgba(255,255,255,0.8)',
                          }}>
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

        {gameState.phase === 'game_over' && (
          <div className="text-center animate-bounce-in">
            <span className="text-5xl block mb-2">{gameState.winner === 'player' ? '🎉' : '💀'}</span>
            <p className="text-lg font-bold" style={{ color: gameState.winner === 'player' ? '#ffd700' : '#ef4444' }}>
              {gameState.message}
            </p>
          </div>
        )}
      </div>

      {/* Player Area */}
      <div className="px-3 py-2" style={{ borderTop: '1px solid rgba(255,215,0,0.1)' }}>
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-[10px] text-green-400 font-bold">あなた</span>
          <span className="text-[9px] text-amber-200/30">山札: {gameState.player.deck.length}</span>
          <span className="text-[9px] text-amber-200/30">ベンチ: {gameState.player.bench.length}/6</span>
        </div>
        <div className="flex gap-1 flex-wrap">
          {gameState.player.bench.map((slot, i) => (
            <div key={i} className="px-1.5 py-0.5 rounded text-[9px] flex items-center gap-0.5"
              style={{ background: `${CATEGORY_INFO[slot.category].color}22`, border: `1px solid ${CATEGORY_INFO[slot.category].color}44` }}>
              <span>{CATEGORY_INFO[slot.category].emoji}</span>
              <span style={{ color: CATEGORY_INFO[slot.category].color }}>{slot.cards.length}</span>
            </div>
          ))}
          {gameState.player.bench.length === 0 && (
            <span className="text-[9px] text-amber-200/20">ベンチ空</span>
          )}
        </div>
      </div>

      {/* Message Bar */}
      <div className="px-3 py-2 text-center" style={{
        background: 'rgba(0,0,0,0.3)',
        borderTop: '1px solid rgba(255,215,0,0.1)',
      }}>
        <p className="text-[11px] text-amber-200/50">{gameState.message}</p>
      </div>
    </div>
  );
}

// ===== Card Display Component =====
function CardDisplay({ card, isDefense }: { card: BattleCard; isDefense?: boolean }) {
  const catInfo = CATEGORY_INFO[card.category];
  const rarInfo = RARITY_INFO[card.rarity];

  return (
    <div className="inline-block rounded-xl p-0 relative overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, rgba(21,29,59,0.95), rgba(14,20,45,0.95))',
        border: `2px solid ${isDefense ? 'rgba(255,215,0,0.4)' : `${catInfo.color}55`}`,
        boxShadow: `0 4px 16px rgba(0,0,0,0.4), inset 0 0 20px ${catInfo.color}08`,
        width: '160px',
        height: '200px',
      }}>
      {/* Card Image */}
      {card.imageUrl && (
        <img src={card.imageUrl} alt={card.name} className="w-full h-full object-cover" />
      )}
      
      {/* Overlay Info */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex flex-col justify-between p-2">
        <div className="flex items-start justify-between">
          <div className="text-lg">{catInfo.emoji}</div>
          <div className="px-1.5 py-0.5 rounded text-[8px] font-bold"
            style={{ background: rarInfo.bgColor, color: rarInfo.color }}>
            {rarInfo.label}
          </div>
        </div>
        
        <div>
          <p className="text-xs font-bold text-amber-100 mb-0.5">{card.name}</p>
          <div className="flex items-center justify-between">
            <p className="text-[9px]" style={{ color: catInfo.color }}>{catInfo.label}</p>
            <div className="flex items-center gap-1">
              <span className="text-sm font-bold" style={{ color: '#ffd700' }}>{card.power}</span>
              <span className="text-[8px] text-amber-200/60">P</span>
            </div>
          </div>
        </div>
      </div>
      
      {isDefense && (
        <div className="absolute top-1 left-1">
          <span className="text-[10px]">🏴</span>
        </div>
      )}
    </div>
  );
}

// ===== Card Mini Component =====
function CardMini({ card }: { card: BattleCard }) {
  const catInfo = CATEGORY_INFO[card.category];
  const rarInfo = RARITY_INFO[card.rarity];

  return (
    <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg overflow-hidden"
      style={{ background: `${catInfo.color}15`, border: `1px solid ${catInfo.color}33` }}>
      {card.imageUrl && (
        <img src={card.imageUrl} alt={card.name} className="w-6 h-6 rounded object-cover" />
      )}
      {!card.imageUrl && <span className="text-sm">{catInfo.emoji}</span>}
      <span className="text-[10px] font-bold text-amber-100">{card.name}</span>
      <span className="text-[9px] font-bold" style={{ color: rarInfo.color }}>{rarInfo.label}</span>
      <span className="text-[10px] font-bold" style={{ color: '#ffd700' }}>P{card.power}</span>
    </div>
  );
}
