/**
 * BattlePage — 🎴 カードバトル v2 本体
 *
 * v2.0-launch: 最小完走版。AI は Easy 固定。マリガン自動 keep。
 *
 * D3 段階の実装スコープ:
 *   - URL params から leaderId / deckId を読み取り、startBattle を呼ぶ
 *   - 初期 state を refresh→draw→cost→main まで自動進行
 *   - 手札 / 自分ボード / 相手ボード / ライフ / コストの可視化
 *   - エンドターン (end_turn) → AI ターン (runAITurn) の自動進行
 *   - 手札タップ / ボードタップ / 降参 などのインタラクションは D4 で追加
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { getChildId } from '@/lib/auth';
import { applyAction } from '@/lib/battle/battleActions';
import { runAITurn } from '@/lib/battle/battleAI';
import { advancePhase } from '@/lib/battle/battleEngine';
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
  BoardSlot,
  LeaderState,
} from '@/lib/battle/battleTypes';

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

    setIsAIThinking(true);
    const t = setTimeout(() => {
      const { finalState } = runAITurn(state, 'p2');
      setState(finalState);
      setIsAIThinking(false);
    }, 600);
    return () => {
      clearTimeout(t);
      setIsAIThinking(false);
    };
    // state は依存に含めるが、isAIThinking は含めない (ループ防止)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

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

  return (
    <div className="min-h-full px-2 pt-2 pb-4 text-white bg-black/40">
      {/* ====== 相手エリア ====== */}
      <OpponentPanel
        leader={p2.leader}
        leaderImageUrl={leaderImageMap.get(p2.leader.id) ?? ''}
        lifeCount={p2.lifeCards.length}
        handCount={p2.hand.length}
        deckCount={p2.deck.length}
      />
      <BoardRow board={p2.board} isOwnSide={false} />

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
      <BoardRow board={p1.board} isOwnSide />

      {/* ====== 自分のリーダー / ライフ ====== */}
      <div className="flex items-center gap-3 mt-2 px-2 py-2 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
        <LeaderBadge
          leader={p1.leader}
          imageUrl={leaderImageMap.get(p1.leader.id) ?? ''}
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
            p1.hand.map((card) => (
              <HandCard key={card.instanceId} card={card} playable={false} />
            ))
          )}
        </div>
      </div>

      {/* ====== ボタン ====== */}
      <div className="mt-3 flex gap-2">
        <button
          onClick={handleEndTurn}
          disabled={!isPlayerTurn}
          className="flex-1 py-3 rounded-lg font-bold text-base bg-yellow-500 text-black disabled:bg-white/10 disabled:text-white/40"
        >
          エンドターン
        </button>
        <button
          disabled
          className="px-4 py-3 rounded-lg text-sm bg-red-900/40 text-white/40 border border-red-500/20"
          title="降参 (D4 で有効化)"
        >
          降参
        </button>
      </div>
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
}: {
  leader: LeaderState;
  leaderImageUrl: string;
  lifeCount: number;
  handCount: number;
  deckCount: number;
}) {
  return (
    <div className="flex items-center gap-3 px-2 py-2 rounded-lg bg-red-900/20 border border-red-500/30">
      <LeaderBadge leader={leader} imageUrl={leaderImageUrl} />
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
}: {
  leader: LeaderState;
  imageUrl: string;
}) {
  return (
    <div className="flex items-center gap-2">
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
    </div>
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
}: {
  board: BoardSlot[];
  isOwnSide: boolean;
}) {
  const slots: (BoardSlot | null)[] = [...board];
  while (slots.length < 5) slots.push(null);

  return (
    <div
      className={`flex gap-1.5 my-2 ${
        isOwnSide ? 'border-t' : 'border-b'
      } border-white/10 py-2`}
    >
      {slots.map((slot, i) => (
        <BoardCardSlot key={i} slot={slot} />
      ))}
    </div>
  );
}

function BoardCardSlot({ slot }: { slot: BoardSlot | null }) {
  if (!slot) {
    return (
      <div className="flex-1 aspect-[3/4] rounded-md border border-dashed border-white/10 bg-black/20" />
    );
  }

  return (
    <div
      className="relative flex-1 aspect-[3/4] rounded-md overflow-hidden border border-yellow-400/40 bg-black/60 transition-transform"
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
