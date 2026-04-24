/**
 * BattlePage — 🎴 カードバトル v2 本体
 *
 * v2.0-launch: 最小完走版。AI は Easy 固定。マリガン自動 keep。
 *
 * D4 段階の実装スコープ:
 *   - URL params から leaderId / deckId を読み取り、startBattle を呼ぶ
 *   - 初期 state を refresh→draw→cost→main まで自動進行
 *   - 手札 / 自分ボード / 相手ボード / ライフ / コストの可視化
 *   - エンドターン (end_turn) + AI ターン (runAITurn) 自動進行
 *   - 手札タップで play_card (コスト判定 OK なら即発動)
 *   - 自分キャラ/リーダータップでアタッカー選択 (視覚ハイライト)
 *   - 敵キャラ (レスト中) / 敵リーダータップで attack
 *   - 降参ボタン (確認ダイアログ → surrender)
 *   - state.winner 確定で BattleResultModal 表示
 *     - 勝利: 「やったね!」+ ALT +10 表示
 *     - 敗北: 「つぎはがんばろう」+ ALT +2 表示
 *     - [もう一度] /battle/select / [ホームへ] /
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { getChildId } from '@/lib/auth';
import { applyAction } from '@/lib/battle/battleActions';
import { runAITurn } from '@/lib/battle/battleAI';
import { advancePhase, BOARD_MAX_SLOTS } from '@/lib/battle/battleEngine';
import {
  fetchLeaders,
  fetchPresetDecks,
  resolveCardImage,
  startBattle,
  type PresetDeck,
} from '@/lib/battleService';
import type {
  BattleCardInstance,
  BattleState,
  BattleWinner,
  BoardSlot,
  LeaderState,
} from '@/lib/battle/battleTypes';

// アタッカー選択 ID の型: null=未選択 / 'leader'=リーダー / それ以外=character.instanceId
type SelectedAttacker = null | 'leader' | string;

// v2.0-launch 固定の ALT 報酬 (D5 で altGameService.processBattleResult に統合予定)
const ALT_REWARD_WIN = 10;
const ALT_REWARD_LOSE = 2;

// ---- CardImage: 404 時に placeholder にフォールバックする <img> ラッパ -----

function CardImage({
  cardId,
  alt,
  className,
}: {
  cardId: string;
  alt: string;
  className?: string;
}) {
  const [errored, setErrored] = useState(false);
  const src = resolveCardImage(cardId);
  if (errored || !src) {
    return (
      <div
        className={`${className ?? ''} flex items-center justify-center text-[8px] leading-tight text-white/70 text-center p-1`}
        style={{
          background:
            'linear-gradient(135deg, rgba(60,60,80,0.9), rgba(30,30,50,0.9))',
        }}
      >
        {alt}
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      draggable={false}
      onError={() => setErrored(true)}
    />
  );
}

function LeaderImage({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  const [errored, setErrored] = useState(false);
  if (errored || !src) {
    return (
      <div
        className={`${className ?? ''} flex items-center justify-center text-[9px] text-white/60 text-center`}
        style={{
          background:
            'linear-gradient(135deg, rgba(60,60,80,0.9), rgba(30,30,50,0.9))',
        }}
      >
        {alt}
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      draggable={false}
      onError={() => setErrored(true)}
    />
  );
}

// ---- component ------------------------------------------------------------

export default function BattlePage() {
  const [, navigate] = useLocation();

  const [state, setState] = useState<BattleState | null>(null);
  const [, setSessionId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAIThinking, setIsAIThinking] = useState(false);
  const [leaderImageMap, setLeaderImageMap] = useState<Map<string, string>>(
    new Map(),
  );
  const [selectedAttacker, setSelectedAttacker] =
    useState<SelectedAttacker>(null);

  // URL params
  const params = useMemo(() => {
    const sp = new URLSearchParams(window.location.search);
    return {
      leaderId: sp.get('leaderId') ?? '',
      deckId: Number(sp.get('deckId') ?? 0),
    };
  }, []);

  // Setup battle on mount
  useEffect(() => {
    if (!params.leaderId || !params.deckId) {
      setError('リーダーまたはデッキが指定されていません');
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        // リーダー一覧を先に取得し、UI 用の imageUrl Map を構築
        const leadersList = await fetchLeaders();
        const lMap = new Map<string, string>();
        for (const l of leadersList) {
          lMap.set(l.id, l.image_url ?? '');
        }
        if (!cancelled) setLeaderImageMap(lMap);

        // Pick AI opponent: any preset deck whose leader !== my leader, random choice.
        const presets = await fetchPresetDecks();
        const candidates = presets.filter(
          (p: PresetDeck) => p.deck.leader_id !== params.leaderId,
        );
        if (candidates.length === 0) {
          throw new Error('対戦相手のデッキが見つかりません');
        }
        const aiDeck = candidates[Math.floor(Math.random() * candidates.length)];

        const childId = getChildId();
        const { sessionId: sid, initialState } = await startBattle({
          childId,
          p1LeaderId: params.leaderId,
          p1DeckId: params.deckId,
          p2LeaderId: aiDeck.deck.leader_id,
          p2DeckId: aiDeck.deck.id,
          difficulty: 'easy',
        });
        if (cancelled) return;

        // refresh → draw → cost → main まで自動進行
        let s = initialState;
        let guard = 0;
        while (s.phase !== 'main' && !s.winner && guard++ < 10) {
          s = advancePhase(s);
        }

        setSessionId(sid);
        setState(s);
        setLoading(false);
      } catch (e) {
        if (!cancelled) {
          setError((e as Error).message);
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params.leaderId, params.deckId]);

  // AI turn trigger: activePlayer=='p2' になったら少し遅らせて runAITurn
  useEffect(() => {
    if (!state) return;
    if (state.winner) return;
    if (state.activePlayer !== 'p2') return;
    if (isAIThinking) return;

    console.log('[BattlePage] AI turn start trigger', {
      turn: state.turn,
      phase: state.phase,
      p2Hand: state.players.p2.hand.length,
      p2Board: state.players.p2.board.length,
    });

    setIsAIThinking(true);

    // メインタイマー: 600ms 後に runAITurn 実行
    const mainTimer = setTimeout(() => {
      console.log('[BattlePage] AI main timer fired, invoking runAITurn');
      const before = state;
      const { finalState, events } = runAITurn(before, 'p2');
      console.log('[BattlePage] runAITurn returned', {
        sameRef: finalState === before,
        activePlayer: finalState.activePlayer,
        winner: finalState.winner,
        eventsCount: events.length,
      });

      // state が変化していない (同一参照) 場合、React は再レンダーしない
      // → 強制的に新しい参照で setState して useEffect を回す
      if (finalState === before) {
        console.warn('[BattlePage] AI returned same state — forcing new ref');
        setState({ ...before });
      } else {
        setState(finalState);
      }
      setIsAIThinking(false);
    }, 600);

    // 保険タイマー (watchdog): 30 秒経っても進行しなければ強制 end_turn
    const watchdog = setTimeout(() => {
      console.error(
        '[BattlePage] AI WATCHDOG TRIGGERED — AI did not finish in 30s, forcing end_turn',
      );
      const forced = applyAction(state, {
        type: 'end_turn',
        player: 'p2',
        timestamp: new Date().toISOString(),
      });
      if (forced.ok) {
        setState(forced.newState);
      } else {
        console.error(
          '[BattlePage] watchdog force end_turn ALSO failed',
          forced.code,
          forced.reason,
        );
      }
      setIsAIThinking(false);
    }, 30_000);

    return () => {
      clearTimeout(mainTimer);
      clearTimeout(watchdog);
      setIsAIThinking(false);
    };
    // state は依存に含めるが、isAIThinking は含めない (ループ防止)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  // --- プレイヤー操作可能かの判定 -------------------------------------------

  function isPlayerActing(): boolean {
    return Boolean(
      state &&
        !state.winner &&
        state.activePlayer === 'p1' &&
        state.phase === 'main' &&
        !isAIThinking,
    );
  }

  // --- 手札タップ: play_card --------------------------------------------------

  function handlePlayCard(card: BattleCardInstance) {
    if (!state || !isPlayerActing()) return;
    if (state.players.p1.currentCost < card.cost) return;
    if (state.players.p1.board.length >= BOARD_MAX_SLOTS) return;

    const result = applyAction(state, {
      type: 'play_card',
      player: 'p1',
      timestamp: new Date().toISOString(),
      cardInstanceId: card.instanceId,
    });
    if (!result.ok) {
      console.warn('[BattlePage] play_card failed:', result.code, result.reason);
      return;
    }
    setState(result.newState);
    setSelectedAttacker(null);
  }

  // --- 自キャラ/リーダータップ: アタッカー選択トグル -------------------------

  function handleSelectAttacker(id: SelectedAttacker) {
    console.log('[UI] handleSelectAttacker called', {
      id,
      currentSelection: selectedAttacker,
      canAct: isPlayerActing(),
      active: state?.activePlayer,
      phase: state?.phase,
      isAIThinking,
      winner: state?.winner,
    });

    if (!state || !isPlayerActing()) {
      console.log('[UI] handleSelectAttacker: blocked by isPlayerActing gate');
      return;
    }

    // 選択可能か (レスト/サモニング病チェック)
    if (id === 'leader') {
      if (state.players.p1.leader.isRested) {
        console.log('[UI] handleSelectAttacker: leader rested, abort');
        return;
      }
    } else if (id !== null) {
      const slot = state.players.p1.board.find(
        (s) => s.card.instanceId === id,
      );
      if (!slot || slot.isRested || !slot.canAttackThisTurn) {
        console.log('[UI] handleSelectAttacker: char invalid', {
          found: !!slot,
          rested: slot?.isRested,
          canAttack: slot?.canAttackThisTurn,
        });
        return;
      }
    }

    setSelectedAttacker((prev) => {
      const next = prev === id ? null : id;
      console.log('[UI] handleSelectAttacker: selection change', {
        from: prev,
        to: next,
      });
      return next;
    });
  }

  // --- 敵タップ: attack 実行 --------------------------------------------------

  function handleAttackTarget(
    target: { kind: 'leader' } | { kind: 'character'; instanceId: string },
  ) {
    console.log('[UI] handleAttackTarget called', {
      target,
      selectedAttacker,
      canAct: isPlayerActing(),
      active: state?.activePlayer,
      phase: state?.phase,
      isAIThinking,
      winner: state?.winner,
    });

    if (!state || !isPlayerActing()) {
      console.log('[UI] handleAttackTarget: blocked by isPlayerActing gate');
      return;
    }
    if (selectedAttacker === null) {
      console.log('[UI] handleAttackTarget: no attacker selected, abort');
      return;
    }

    const attackerSource =
      selectedAttacker === 'leader'
        ? ({ kind: 'leader' } as const)
        : ({ kind: 'character', instanceId: selectedAttacker } as const);

    console.log('[UI] handleAttackTarget: calling applyAction', {
      attackerSource,
      targetSource: target,
    });

    const result = applyAction(state, {
      type: 'attack',
      player: 'p1',
      timestamp: new Date().toISOString(),
      attackerSource,
      targetSource: target,
    });

    console.log('[UI] handleAttackTarget: applyAction result', {
      ok: result.ok,
      code: !result.ok ? result.code : undefined,
      reason: !result.ok ? result.reason : undefined,
      eventsCount: result.ok ? result.events.length : 0,
    });

    // 成否を問わず、選択状態はクリア
    setSelectedAttacker(null);

    if (!result.ok) {
      console.warn('[BattlePage] attack failed:', result.code, result.reason);
      return;
    }
    setState(result.newState);
  }

  // --- エンドターン ------------------------------------------------------------

  function handleEndTurn() {
    if (!state || state.winner) return;
    if (state.activePlayer !== 'p1' || state.phase !== 'main') return;
    const result = applyAction(state, {
      type: 'end_turn',
      player: 'p1',
      timestamp: new Date().toISOString(),
    });
    if (!result.ok) {
      console.warn('[BattlePage] end_turn failed:', result.code, result.reason);
      return;
    }
    setState(result.newState);
    setSelectedAttacker(null);
  }

  // --- 降参 --------------------------------------------------------------------

  function handleSurrender() {
    if (!state || state.winner) return;
    if (!isPlayerActing()) return;
    const ok = window.confirm('ほんとうに降参する？');
    if (!ok) return;
    const result = applyAction(state, {
      type: 'surrender',
      player: 'p1',
      timestamp: new Date().toISOString(),
    });
    if (!result.ok) {
      console.warn('[BattlePage] surrender failed:', result.code, result.reason);
      return;
    }
    setState(result.newState);
    setSelectedAttacker(null);
  }

  // ---- render --------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-full py-20 text-white/70">
        バトルを準備中…
      </div>
    );
  }
  if (error || !state) {
    return (
      <div className="p-4 text-center">
        <div className="text-red-400 mb-4">
          {error ?? 'バトル state が読み込めませんでした'}
        </div>
        <Link href="/battle/select">
          <button className="px-4 py-2 rounded-lg bg-yellow-500 text-black font-bold">
            リーダー選択に戻る
          </button>
        </Link>
      </div>
    );
  }

  const p1 = state.players.p1;
  const p2 = state.players.p2;
  const isPlayerTurn = state.activePlayer === 'p1' && !isAIThinking;
  const canPlayerAct = isPlayerActing();
  const attackerSelected = selectedAttacker !== null;

  return (
    <div className="min-h-full px-2 pt-2 pb-4 text-white bg-black/40">
      {/* ====== 相手エリア ====== */}
      <OpponentPanel
        leader={p2.leader}
        leaderImageUrl={leaderImageMap.get(p2.leader.id) ?? ''}
        lifeCount={p2.lifeCards.length}
        handCount={p2.hand.length}
        deckCount={p2.deck.length}
        targetable={attackerSelected}
        onLeaderClick={() => handleAttackTarget({ kind: 'leader' })}
      />
      <BoardRow
        board={p2.board}
        isOwnSide={false}
        selectedAttackerId={selectedAttacker}
        canPlayerAct={canPlayerAct}
        onSlotClick={(slot) =>
          handleAttackTarget({
            kind: 'character',
            instanceId: slot.card.instanceId,
          })
        }
      />

      {/* ====== 中央情報 ====== */}
      <div className="flex items-center justify-between my-3 px-2 py-2 rounded-lg bg-white/5 border border-white/10">
        <div className="text-xs text-white/70">
          ターン <span className="text-white font-bold">{state.turn}</span>
          <span className="mx-2">/</span>
          <span className="uppercase text-[10px] px-1.5 py-0.5 rounded bg-white/10">
            {state.phase}
          </span>
        </div>
        <div className="text-xs">
          探究マナ:{' '}
          <span className="text-yellow-300 font-bold">
            {p1.currentCost}
          </span>
          <span className="text-white/50">/{p1.maxCost}</span>
        </div>
        <div className="text-xs">
          {state.activePlayer === 'p1' ? (
            <span className="text-green-400">あなたの番</span>
          ) : (
            <span className="text-red-400">
              {isAIThinking ? '相手が考え中…' : '相手の番'}
            </span>
          )}
        </div>
      </div>

      {/* ====== 自分の場 ====== */}
      <BoardRow
        board={p1.board}
        isOwnSide
        selectedAttackerId={selectedAttacker}
        canPlayerAct={canPlayerAct}
        onSlotClick={(slot) => handleSelectAttacker(slot.card.instanceId)}
      />

      {/* ====== 自分のリーダー / ライフ ====== */}
      <div className="flex items-center gap-3 mt-2 px-2 py-2 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
        <LeaderBadge
          leader={p1.leader}
          imageUrl={leaderImageMap.get(p1.leader.id) ?? ''}
          onClick={() => handleSelectAttacker('leader')}
          isSelected={selectedAttacker === 'leader'}
          canPlayerAct={canPlayerAct}
        />
        <LifePips count={p1.lifeCards.length} max={3} color="yellow" />
        <div className="text-[10px] text-white/60 ml-auto">
          手札{p1.hand.length}・山札{p1.deck.length}
        </div>
      </div>

      {/* ====== 自分の手札 (横スクロール) ====== */}
      <div className="mt-2 overflow-x-auto">
        <div className="flex gap-2 pb-2" style={{ minWidth: 'max-content' }}>
          {p1.hand.length === 0 ? (
            <div className="text-white/40 text-xs py-4 px-2">手札なし</div>
          ) : (
            p1.hand.map((card) => {
              const playable =
                canPlayerAct &&
                card.cost <= p1.currentCost &&
                p1.board.length < BOARD_MAX_SLOTS;
              return (
                <HandCard
                  key={card.instanceId}
                  card={card}
                  playable={playable}
                  onPlay={() => handlePlayCard(card)}
                />
              );
            })
          )}
        </div>
      </div>

      {/* ====== ボタン ====== */}
      <div className="mt-3 flex gap-2">
        <button
          onClick={handleEndTurn}
          disabled={!isPlayerTurn || Boolean(state.winner)}
          className="flex-1 py-3 rounded-lg font-bold text-base bg-yellow-500 text-black disabled:bg-white/10 disabled:text-white/40"
        >
          エンドターン
        </button>
        <button
          onClick={handleSurrender}
          disabled={!canPlayerAct}
          className="px-4 py-3 rounded-lg text-sm bg-red-900/60 text-white border border-red-500/40 disabled:bg-red-900/20 disabled:text-white/30 disabled:border-red-500/10"
        >
          降参
        </button>
      </div>

      {/* ====== 勝敗モーダル ====== */}
      {state.winner && (
        <BattleResultModal
          winner={state.winner}
          onReplay={() => navigate('/battle/select')}
          onHome={() => navigate('/')}
        />
      )}
    </div>
  );
}

// ---- sub components -------------------------------------------------------

function OpponentPanel({
  leader,
  leaderImageUrl,
  lifeCount,
  handCount,
  deckCount,
  targetable,
  onLeaderClick,
}: {
  leader: LeaderState;
  leaderImageUrl: string;
  lifeCount: number;
  handCount: number;
  deckCount: number;
  targetable: boolean;
  onLeaderClick: () => void;
}) {
  return (
    <div className="flex items-center gap-3 px-2 py-2 rounded-lg bg-red-900/20 border border-red-500/30">
      <LeaderBadge
        leader={leader}
        imageUrl={leaderImageUrl}
        onClick={onLeaderClick}
        targetable={targetable}
      />
      <LifePips count={lifeCount} max={3} color="red" />
      <div className="text-[10px] text-white/60 ml-auto">
        手札{handCount}・山札{deckCount}
      </div>
    </div>
  );
}

function LeaderBadge({
  leader,
  imageUrl,
  onClick,
  isSelected = false,
  canPlayerAct = false,
  targetable = false,
}: {
  leader: LeaderState;
  imageUrl: string;
  onClick?: () => void;
  isSelected?: boolean;
  canPlayerAct?: boolean;
  targetable?: boolean;
}) {
  // 自リーダー: canPlayerAct && !rested で clickable
  // 敵リーダー: targetable (= 自側で attacker 選択済み) で clickable
  const clickable = Boolean(
    onClick && (targetable || (canPlayerAct && !leader.isRested)),
  );
  const ringClass = isSelected
    ? 'ring-4 ring-yellow-300'
    : targetable
      ? 'ring-2 ring-red-400 animate-pulse'
      : '';
  return (
    <button
      type="button"
      onClick={clickable ? onClick : undefined}
      disabled={!clickable}
      className={`flex items-center gap-2 text-left rounded-lg ${clickable ? 'cursor-pointer' : 'cursor-default'} ${ringClass}`}
    >
      <div className="w-12 h-12 rounded-lg overflow-hidden border border-white/20 bg-black/40 flex items-center justify-center">
        <LeaderImage
          src={imageUrl}
          alt={leader.name}
          className="w-full h-full object-cover"
        />
      </div>
      <div className="leading-tight">
        <div className="text-sm font-bold text-yellow-300 truncate max-w-[100px]">
          {leader.name}
        </div>
        <div className="text-[10px] text-white/70">
          ⚔{leader.attackPower} 🛡{leader.defensePower}
          {leader.isRested && <span className="ml-1 text-white/50">(rest)</span>}
        </div>
      </div>
    </button>
  );
}

function LifePips({
  count,
  max,
  color,
}: {
  count: number;
  max: number;
  color: 'red' | 'yellow';
}) {
  const active = color === 'red' ? 'bg-red-500' : 'bg-yellow-400';
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: max }).map((_, i) => (
        <div
          key={i}
          className={`w-3 h-3 rounded-full border border-white/30 ${
            i < count ? active : 'bg-white/10'
          }`}
        />
      ))}
    </div>
  );
}

function BoardRow({
  board,
  isOwnSide,
  selectedAttackerId,
  canPlayerAct,
  onSlotClick,
}: {
  board: BoardSlot[];
  isOwnSide: boolean;
  selectedAttackerId: SelectedAttacker;
  canPlayerAct: boolean;
  onSlotClick: (slot: BoardSlot) => void;
}) {
  const slots: (BoardSlot | null)[] = [...board];
  while (slots.length < 5) slots.push(null);

  const attackerActive = selectedAttackerId !== null;

  return (
    <div
      className={`flex gap-1.5 my-2 ${
        isOwnSide ? 'border-t' : 'border-b'
      } border-white/10 py-2`}
    >
      {slots.map((slot, i) => (
        <BoardCardSlot
          key={i}
          slot={slot}
          isOwnSide={isOwnSide}
          isSelected={
            isOwnSide &&
            slot !== null &&
            selectedAttackerId === slot.card.instanceId
          }
          canPlayerAct={canPlayerAct}
          attackerActive={attackerActive}
          onClick={slot ? () => onSlotClick(slot) : undefined}
        />
      ))}
    </div>
  );
}

function BoardCardSlot({
  slot,
  isOwnSide,
  isSelected,
  canPlayerAct,
  attackerActive,
  onClick,
}: {
  slot: BoardSlot | null;
  isOwnSide: boolean;
  isSelected: boolean;
  canPlayerAct: boolean;
  attackerActive: boolean;
  onClick?: () => void;
}) {
  if (!slot) {
    return (
      <div className="flex-1 aspect-[3/4] rounded-md border border-dashed border-white/10 bg-black/20" />
    );
  }

  // クリック可否:
  //   自側: canPlayerAct かつ !rested かつ canAttack
  //   敵側: attackerActive (自側で attacker 選択中) かつ (リーダー or rested char)
  //         このコンポーネントは char スロット専用なので rested が要求される
  const clickable = isOwnSide
    ? canPlayerAct && !slot.isRested && slot.canAttackThisTurn
    : attackerActive && slot.isRested;

  const ringClass = isSelected
    ? 'ring-4 ring-yellow-300'
    : clickable && !isOwnSide
      ? 'ring-2 ring-red-400 animate-pulse'
      : clickable && isOwnSide
        ? 'ring-1 ring-yellow-400/60 hover:ring-yellow-300'
        : '';

  return (
    <button
      type="button"
      onClick={clickable ? onClick : undefined}
      disabled={!clickable}
      className={`relative flex-1 aspect-[3/4] rounded-md overflow-hidden border border-yellow-400/40 bg-black/60 transition-transform ${ringClass} ${clickable ? 'cursor-pointer' : 'cursor-default'}`}
      style={{ transform: slot.isRested ? 'rotate(12deg)' : 'none' }}
    >
      <CardImage
        cardId={slot.card.cardId}
        alt={slot.card.name}
        className="w-full h-full object-cover"
      />
      <div className="absolute top-0 left-0 bg-black/70 text-yellow-300 text-[10px] font-bold w-4 h-4 flex items-center justify-center rounded-br">
        {slot.card.cost}
      </div>
      <div className="absolute bottom-0 right-0 bg-black/70 text-[9px] text-white px-1 flex gap-1">
        <span className="text-red-300">⚔{slot.card.attackPower}</span>
        <span className="text-blue-300">🛡{slot.card.defensePower}</span>
      </div>
      {!slot.canAttackThisTurn && (
        <div className="absolute top-0 right-0 text-[8px] px-1 bg-purple-700/80">
          sick
        </div>
      )}
    </button>
  );
}

// ---- 勝敗モーダル ---------------------------------------------------------

function BattleResultModal({
  winner,
  onReplay,
  onHome,
}: {
  winner: BattleWinner;
  onReplay: () => void;
  onHome: () => void;
}) {
  const won = winner === 'p1';
  const title = won ? 'やったね!🏆' : 'つぎはがんばろう';
  const altEarned = won ? ALT_REWARD_WIN : ALT_REWARD_LOSE;
  const emoji = won ? '🎉' : '💪';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)' }}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-6 text-center border-2"
        style={{
          background: won
            ? 'linear-gradient(135deg, rgba(255,215,0,0.15), rgba(255,140,0,0.1))'
            : 'linear-gradient(135deg, rgba(100,100,150,0.2), rgba(50,50,80,0.2))',
          borderColor: won ? 'rgba(255,215,0,0.6)' : 'rgba(255,255,255,0.2)',
          boxShadow: won
            ? '0 0 30px rgba(255,215,0,0.4)'
            : '0 0 20px rgba(0,0,0,0.5)',
        }}
      >
        <div className="text-6xl mb-2">{emoji}</div>
        <h2
          className="text-2xl font-bold mb-4"
          style={{
            color: won ? 'var(--tqw-gold)' : '#fff',
            textShadow: won ? '0 0 10px rgba(255,215,0,0.5)' : 'none',
          }}
        >
          {title}
        </h2>
        <div className="my-4 px-4 py-3 rounded-lg bg-black/40 border border-yellow-500/30">
          <div className="text-xs text-white/70 mb-1">獲得した ALT</div>
          <div className="text-3xl font-bold text-yellow-300">
            +{altEarned} <span className="text-sm">ALT</span>
          </div>
        </div>
        <div className="flex flex-col gap-2 mt-6">
          <button
            onClick={onReplay}
            className="w-full py-3 rounded-lg font-bold bg-yellow-500 text-black hover:bg-yellow-400"
          >
            もう一度
          </button>
          <button
            onClick={onHome}
            className="w-full py-3 rounded-lg font-bold bg-white/10 text-white border border-white/20 hover:bg-white/20"
          >
            ホームへ
          </button>
        </div>
      </div>
    </div>
  );
}

function HandCard({
  card,
  playable,
  onPlay,
}: {
  card: BattleCardInstance;
  playable: boolean;
  onPlay?: () => void;
}) {
  return (
    <button
      onClick={onPlay}
      disabled={!playable}
      className={`relative w-20 aspect-[3/4] rounded-md overflow-hidden border flex-shrink-0 ${
        playable
          ? 'border-yellow-400 shadow-[0_0_8px_rgba(255,215,0,0.5)]'
          : 'border-white/20 opacity-90'
      }`}
    >
      <CardImage
        cardId={card.cardId}
        alt={card.name}
        className="w-full h-full object-cover"
      />
      <div className="absolute top-0 left-0 bg-black/80 text-yellow-300 text-[11px] font-bold w-5 h-5 flex items-center justify-center rounded-br">
        {card.cost}
      </div>
      <div className="absolute bottom-0 right-0 bg-black/80 text-[9px] text-white px-1 flex gap-1">
        <span className="text-red-300">⚔{card.attackPower}</span>
        <span className="text-blue-300">🛡{card.defensePower}</span>
      </div>
    </button>
  );
}
