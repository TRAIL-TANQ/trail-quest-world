// ============================================================================
// battleEngine.ts
// TRAIL QUEST WORLD - Battle System v2.0 MVP
// コアエンジン: 初期化 / フェーズ遷移 / ドロー / 終局判定
// ============================================================================
//
// 原則:
//   - pure 関数。入力 state を変更せず、新しい state を返す。
//   - leader の life / attackPower / defensePower は DB 値をそのまま使用、ハードコードなし。
//   - マリガン / play_card / attack 等のプレイヤー入力処理は battleActions.ts 側。
//     ここではフェーズ進行とドロー、終局判定のみを扱う。
// ============================================================================

import { nanoid } from 'nanoid';
import type {
  BattleCardInstance,
  BattleDifficulty,
  BattleEvent,
  BattleEventType,
  BattleLeaderRow,
  BattleState,
  LeaderState,
  PlayerSlot,
  PlayerState,
} from './battleTypes';

// ---- 定数 ------------------------------------------------------------------

export const INITIAL_HAND_SIZE = 3;       // v2.0-launch: 3 (旧 5)
export const MAX_COST = 15;               // 探究マナの上限 (旧 10)
export const BOARD_MAX_SLOTS = 5;

// ---- マナ計算 --------------------------------------------------------------

/**
 * 各プレイヤーの、指定ターン開始時点で使える探究マナの最大値。
 *
 * 先攻: min(turn * 2 - 1, MAX_COST)
 * 後攻: min(turn * 2,     MAX_COST)
 *
 * 結果、turn 1 は 1/2、turn 2 は 3/4、... turn 8 以降は先攻 15、turn 8 以降 後攻 15 (cap)。
 */
export function calcManaForTurn(
  turn: number,
  slot: PlayerSlot,
  firstPlayer: PlayerSlot,
): number {
  const isFirst = slot === firstPlayer;
  const base = isFirst ? turn * 2 - 1 : turn * 2;
  return Math.min(base, MAX_COST);
}

// ---- 内部ヘルパー ----------------------------------------------------------

/**
 * イベント生成。ログ追加時に都度呼び出す。
 */
export function makeEvent(
  type: BattleEventType,
  turn: number,
  player: PlayerSlot,
  payload: Record<string, unknown> = {},
): BattleEvent {
  return {
    eventId: nanoid(10),
    type,
    turn,
    player,
    payload,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Fisher-Yates シャッフル。元配列は変更しない。
 * rng を渡せばテストで決定的動作可能。
 */
export function shuffleDeck<T>(deck: readonly T[], rng: () => number = Math.random): T[] {
  const copy = deck.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * DB 行 → ランタイム LeaderState 変換。
 * attackPower / defensePower / life は DB 値をそのまま使用。
 */
export function leaderRowToState(row: BattleLeaderRow): LeaderState {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    power: row.power,
    attackPower: row.attack_power,
    defensePower: row.defense_power,
    life: row.life,
    isRested: false,
    canAttackThisTurn: true,
  };
}

/**
 * リフレッシュ処理: 自場とリーダーの isRested / サモニング病解除、ドロー済みフラグ解除。
 */
function refreshPlayer(p: PlayerState): PlayerState {
  return {
    ...p,
    leader: { ...p.leader, isRested: false, canAttackThisTurn: true },
    board: p.board.map((slot) => ({
      ...slot,
      isRested: false,
      canAttackThisTurn: true,
    })),
    hasDrawnThisTurn: false,
  };
}

function otherPlayer(p: PlayerSlot): PlayerSlot {
  return p === 'p1' ? 'p2' : 'p1';
}

// ---- 公開 API --------------------------------------------------------------

export interface CreateInitialStateOptions {
  /**
   * デッキをシャッフルするか。デフォルト true。
   * テストで決定的動作が必要な時に false にする。
   */
  shuffle?: boolean;
  /**
   * シャッフル時の rng。デフォルト Math.random。
   */
  rng?: () => number;
  /**
   * 初期手札枚数。デフォルト INITIAL_HAND_SIZE (5)。
   */
  initialHandSize?: number;
}

/**
 * バトル state の初期生成。
 *
 * フロー:
 *   1. 両プレイヤーのデッキをシャッフル
 *   2. ライフ山札を裏向きに (leader.life 枚)
 *   3. 初期手札を 5 枚ドロー
 *   4. p1 先攻、phase='refresh', turn=1 で開始
 *
 * leader.life / attackPower / defensePower は BattleLeaderRow (DB 値) をそのまま採用。
 */
export function createInitialState(
  sessionId: string,
  p1Id: string,
  p1Leader: BattleLeaderRow,
  p1DeckCards: BattleCardInstance[],
  p2Leader: BattleLeaderRow,
  p2DeckCards: BattleCardInstance[],
  difficulty: BattleDifficulty,
  options: CreateInitialStateOptions = {},
): BattleState {
  const shuffle = options.shuffle ?? true;
  const rng = options.rng ?? Math.random;
  const handSize = options.initialHandSize ?? INITIAL_HAND_SIZE;

  const p1Shuffled = shuffle ? shuffleDeck(p1DeckCards, rng) : p1DeckCards.slice();
  const p2Shuffled = shuffle ? shuffleDeck(p2DeckCards, rng) : p2DeckCards.slice();

  const p1Player = dealPlayer(p1Id, p1Leader, p1Shuffled, handSize);
  const p2Player = dealPlayer('ai', p2Leader, p2Shuffled, handSize);

  const now = new Date().toISOString();

  return {
    sessionId,
    turn: 1,
    firstPlayer: 'p1',           // v2.0-launch 固定
    activePlayer: 'p1',
    phase: 'refresh',
    players: {
      p1: p1Player,
      p2: p2Player,
    },
    log: [
      makeEvent('game_start', 1, 'p1', {
        sessionId,
        p1Id,
        p2Id: 'ai',
        p1LeaderId: p1Leader.id,
        p2LeaderId: p2Leader.id,
        difficulty,
      }),
    ],
    winner: null,
    startedAt: now,
    endedAt: null,
  };
}

function dealPlayer(
  id: string,
  leader: BattleLeaderRow,
  shuffledDeck: BattleCardInstance[],
  handSize: number,
): PlayerState {
  const lifeCount = leader.life;
  const lifeCards = shuffledDeck.slice(0, lifeCount);
  const afterLife = shuffledDeck.slice(lifeCount);
  const hand = afterLife.slice(0, handSize);
  const deck = afterLife.slice(handSize);

  return {
    id,
    leader: leaderRowToState(leader),
    hand,
    deck,
    lifeCards,
    board: [],
    graveyard: [],
    currentCost: 0,
    maxCost: 0,
    hasDrawnThisTurn: false,
    // v2.0.2 追加フィールド: Phase 3 以降で本格的に使用
    equippedCard: null,
    equipmentBonusAtk: 0,
    equipmentBonusDef: 0,
    equipmentBonusAllyAtk: 0,
    maxHandSize: 99,
    tempBuffs: [],
    cantPlayCharsThisTurn: false,
    equipmentOnceUsed: false,
  };
}

// ---- v2.0.2: 装備ボーナスを反映した実効値の計算ヘルパー --------------------

/**
 * リーダーの実効攻撃力 = base + 装備による永続 atk 加算。
 * (一時バフは Phase 5 で tempBuffs を取り込む)
 */
export function getEffectiveLeaderAtk(player: PlayerState): number {
  return player.leader.attackPower + (player.equipmentBonusAtk ?? 0);
}

/**
 * リーダーの実効防御力 = base + 装備による永続 def 加算。
 */
export function getEffectiveLeaderDef(player: PlayerState): number {
  return player.leader.defensePower + (player.equipmentBonusDef ?? 0);
}

/**
 * 味方キャラの実効攻撃力 = base + 装備による全体 atk 加算。
 * (味方キャラには装備の def 加算は乗らない仕様)
 */
export function getEffectiveCharAtk(
  player: PlayerState,
  card: BattleCardInstance,
): number {
  return card.attackPower + (player.equipmentBonusAllyAtk ?? 0);
}

/**
 * 味方キャラの実効防御力 = base (装備 def 加算は乗らない)。
 */
export function getEffectiveCharDef(
  _player: PlayerState,
  card: BattleCardInstance,
): number {
  return card.defensePower;
}

// ---- v2.0.2: per_turn 装備のコストフェーズ発動 -----------------------------

/**
 * per_turn 装備の効果を cost フェーズ開始時に適用。
 *
 * 対応する equipmentEffectData キー (Phase 3):
 *   - draw_per_turn:           N 枚ドロー (デッキ切れ時は game_over)
 *   - reveal_opponent_hand:    相手手札を N 枚見る (UI 用に events を発行のみ)
 *
 * 効果が無いカードや、stub データ形式の場合は no-op。
 */
export function applyPerTurnEquipmentEffect(
  state: BattleState,
  active: PlayerSlot,
): BattleState {
  const player = state.players[active];
  const card = player.equippedCard;
  if (!card || card.equipmentEffectType !== 'per_turn') return state;

  const data = (card.equipmentEffectData ?? {}) as Record<string, unknown>;
  let next: BattleState = state;

  if (typeof data.draw_per_turn === 'number' && data.draw_per_turn > 0) {
    next = drawCard(next, active, data.draw_per_turn);
    if (next.winner) return next;
  }

  if (
    typeof data.reveal_opponent_hand === 'number' &&
    data.reveal_opponent_hand > 0
  ) {
    const opponentSlot: PlayerSlot = active === 'p1' ? 'p2' : 'p1';
    const opponent = next.players[opponentSlot];
    const revealCount = Math.min(data.reveal_opponent_hand, opponent.hand.length);
    const revealed = opponent.hand.slice(0, revealCount);
    next = {
      ...next,
      log: [
        ...next.log,
        makeEvent('temp_buff_applied', next.turn, active, {
          source: 'equipment_per_turn',
          equipmentCardId: card.cardId,
          revealKind: 'reveal_opponent_hand',
          revealedCardIds: revealed.map((c) => c.cardId),
        }),
      ],
    };
  }

  return next;
}

/**
 * 現在フェイズから次フェイズへ 1 ステップ進める。
 *
 * 遷移表:
 *   refresh → draw   (active の場をリフレッシュ後、draw へ)
 *   draw    → cost   (active が 1 枚ドロー後、cost へ)
 *   cost    → main   (maxCost/currentCost を min(turn, 10) に更新)
 *   main    → end    (通常は end_turn アクションが呼ぶ)
 *   end     → refresh (active を入れ替え、active==p1 に戻ったら turn++)
 *
 * ゲーム終了中 (winner != null) は no-op。
 */
export function advancePhase(state: BattleState): BattleState {
  if (state.winner) return state;

  const active = state.activePlayer;

  switch (state.phase) {
    case 'refresh': {
      const refreshed = refreshPlayer(state.players[active]);
      return {
        ...state,
        players: { ...state.players, [active]: refreshed },
        phase: 'draw',
        log: [
          ...state.log,
          makeEvent('phase_change', state.turn, active, { to: 'draw' }),
        ],
      };
    }

    case 'draw': {
      const afterDraw = drawCard(state, active, 1);
      if (afterDraw.winner) return afterDraw;
      return {
        ...afterDraw,
        phase: 'cost',
        log: [
          ...afterDraw.log,
          makeEvent('phase_change', afterDraw.turn, active, { to: 'cost' }),
        ],
      };
    }

    case 'cost': {
      const player = state.players[active];
      // 先攻/後攻で異なる: 先攻 = turn*2-1, 後攻 = turn*2 (上限 MAX_COST=15)
      const baseMax = calcManaForTurn(state.turn, active, state.firstPlayer);
      // 'mana' トリガー由来のボーナスを合算して 1 ターンのみ反映 (上限 cap は外す)
      const bonus = player.nextTurnManaBonus ?? 0;
      const newMax = baseMax + bonus;
      const afterCost: BattleState = {
        ...state,
        players: {
          ...state.players,
          [active]: {
            ...player,
            maxCost: newMax,
            currentCost: newMax,
            nextTurnManaBonus: 0, // ボーナスは 1 ターン消費
          },
        },
        log: [
          ...state.log,
          makeEvent('phase_change', state.turn, active, {
            to: 'main',
            maxCost: newMax,
            manaBonus: bonus,
          }),
        ],
      };
      // v2.0.2: per_turn 装備の効果を cost フェーズ完了時に発動
      const afterEquip = applyPerTurnEquipmentEffect(afterCost, active);
      // per_turn 装備の draw_per_turn でデッキ切れ → game_over
      if (afterEquip.winner) return afterEquip;
      return { ...afterEquip, phase: 'main' };
    }

    case 'main': {
      return {
        ...state,
        phase: 'end',
        log: [
          ...state.log,
          makeEvent('phase_change', state.turn, active, { to: 'end' }),
        ],
      };
    }

    case 'end': {
      const next = otherPlayer(active);
      // ラウンド完了 (p2 → p1 に戻る) で turn++
      const nextTurn = active === 'p2' ? state.turn + 1 : state.turn;
      return {
        ...state,
        activePlayer: next,
        turn: nextTurn,
        phase: 'refresh',
        log: [
          ...state.log,
          makeEvent('turn_end', state.turn, active, {
            nextActive: next,
            nextTurn,
          }),
        ],
      };
    }
  }
}

/**
 * 指定プレイヤーが count 枚ドロー。
 * デッキが尽きた場合、ドロー試行時点で相手の勝利として winner を設定。
 */
export function drawCard(
  state: BattleState,
  player: PlayerSlot,
  count = 1,
): BattleState {
  if (state.winner) return state;

  let current: BattleState = state;

  for (let i = 0; i < count; i++) {
    const p = current.players[player];

    if (p.deck.length === 0) {
      const winner = otherPlayer(player);
      return {
        ...current,
        winner,
        endedAt: new Date().toISOString(),
        log: [
          ...current.log,
          makeEvent('game_over', current.turn, player, {
            reason: 'deck_out',
            loser: player,
            winner,
          }),
        ],
      };
    }

    const drawn = p.deck[0];
    const restDeck = p.deck.slice(1);

    current = {
      ...current,
      players: {
        ...current.players,
        [player]: {
          ...p,
          deck: restDeck,
          hand: [...p.hand, drawn],
          hasDrawnThisTurn: true,
        },
      },
      log: [
        ...current.log,
        makeEvent('draw', current.turn, player, {
          cardId: drawn.cardId,
          instanceId: drawn.instanceId,
        }),
      ],
    };
  }

  return current;
}

/**
 * 終局判定。winner が確定しているかを返す。
 * 実際の勝利条件判定 (ライフ 0 + 被ダメージ / デッキ切れ / サレンダー) は
 * drawCard や battleActions 側で winner を設定する。
 */
export function isGameOver(state: BattleState): boolean {
  return state.winner !== null;
}
