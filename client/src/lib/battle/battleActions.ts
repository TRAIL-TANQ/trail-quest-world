// ============================================================================
// battleActions.ts
// TRAIL QUEST WORLD - Battle System v2.0 MVP
// プレイヤーアクション処理: applyAction(state, action) -> ActionResult
// ============================================================================
//
// 5 アクション:
//   - mulligan   手札全交換 (turn 1 / phase refresh のみ)
//   - play_card  手札からキャラを場へ
//   - attack     リーダー/キャラによる攻撃 (戦闘判定 = attackPower >= defensePower)
//   - end_turn   メインフェイズ終了 → 相手メインまで advancePhase を連続適用
//   - surrender  降参 (相手勝利)
//
// 戦闘ルール (v2.0-launch):
//   - attackerPower >= defenderPower で対象破壊 (キャラ) / ライフ 1 減 (リーダー)
//   - ライフ 0 の状態で更に被ダメージ = game_over
//   - アタッカーはアタック後レスト (成功/失敗を問わず)
//   - 相手キャラ攻撃は「レスト中」のみ、リーダーはいつでも攻撃可
//
// 制約: pure 関数。入力 state 不変、新 state を返す。
// ============================================================================

import { nanoid } from 'nanoid';
import {
  BOARD_MAX_SLOTS,
  advancePhase,
  decideCounterUse,
  drawCard,
  getEffectiveCharAtk,
  getEffectiveLeaderAtk,
  getEffectiveLeaderDef,
  makeEvent,
  shuffleDeck,
} from './battleEngine';
import type {
  ActionResult,
  ActionResultError,
  AttackAction,
  BattleAction,
  BattleCardInstance,
  BattleEvent,
  BattleState,
  BoardSlot,
  EndTurnAction,
  MulliganAction,
  PendingTargetSelection,
  PlayCardAction,
  PlayerSlot,
  PlayerState,
  SurrenderAction,
  TempBuff,
  TriggerType,
} from './battleTypes';

// v2.0.2 Phase 6b-3: 人間プレイヤー時に対象選択 UI を介したい effect_type
const TARGET_SELECTION_REQUIRED: ReadonlySet<PendingTargetSelection['type']> =
  new Set<PendingTargetSelection['type']>([
    'destroy_enemy_char',
    'reveal_then_discard',
    'scry_then_pick',
    'draw_and_buff',
  ]);

// ---- エラーヘルパー --------------------------------------------------------

function err(
  code: ActionResultError['code'],
  reason: string,
): ActionResultError {
  return { ok: false, code, reason };
}

function otherPlayer(p: PlayerSlot): PlayerSlot {
  return p === 'p1' ? 'p2' : 'p1';
}

/**
 * events を state.log に追加した新しい state を返す。
 */
function commit(
  state: BattleState,
  originalLog: BattleEvent[],
  events: BattleEvent[],
  extras: Partial<BattleState> = {},
): BattleState {
  return {
    ...state,
    ...extras,
    log: [...originalLog, ...events],
  };
}

// ---- トリガー発動処理 (v2.0-launch Phase 2) -------------------------------

/**
 * ライフトリガーの効果適用結果。
 * blocksAttack=true の時のみ、呼び出し側はシールド消費 / 手札移動を行わない。
 */
interface TriggerResult {
  state: BattleState;
  events: BattleEvent[];
  blocksAttack: boolean;
}

/**
 * リーダー被弾時、めくれたライフカードの triggerType に応じた効果を適用。
 *
 * 共通: 非 null の triggerType なら 'trigger_activated' イベントを 1 回発火。
 * 効果別挙動:
 *   - draw    : defender が deck top から 1 枚ドロー (空デッキは no-op)
 *   - mana    : defender.nextTurnManaBonus += 2 (次ターン cost フェーズで消費)
 *   - destroy : attacker の場で最小 attackPower のキャラを 1 体破壊 (空場は no-op)
 *   - defense : シールド消費ゼロ、完全無効化 (blocksAttack=true を返す)
 *   - revive  : defender.graveyard[0] を手札へ (空墓地は no-op)
 *   - null    : no-op、events=[]
 */
function applyTriggerEffect(
  state: BattleState,
  triggerType: TriggerType,
  attackerSide: PlayerSlot,
  defenderSide: PlayerSlot,
  triggeringCard: BattleCardInstance,
): TriggerResult {
  if (triggerType === null) {
    return { state, events: [], blocksAttack: false };
  }

  const events: BattleEvent[] = [];
  events.push(
    makeEvent('trigger_activated', state.turn, defenderSide, {
      type: triggerType,
      cardId: triggeringCard.cardId,
      instanceId: triggeringCard.instanceId,
    }),
  );

  const defender = state.players[defenderSide];
  const attacker = state.players[attackerSide];

  switch (triggerType) {
    case 'draw': {
      if (defender.deck.length === 0) {
        // 空デッキ: トリガー不発 (game_over にはしない、シールド消費は通常通り)
        return { state, events, blocksAttack: false };
      }
      const drawn = defender.deck[0];
      const newDefender: PlayerState = {
        ...defender,
        deck: defender.deck.slice(1),
        hand: [...defender.hand, drawn],
      };
      return {
        state: {
          ...state,
          players: { ...state.players, [defenderSide]: newDefender },
        },
        events,
        blocksAttack: false,
      };
    }

    case 'mana': {
      const current = defender.nextTurnManaBonus ?? 0;
      const newDefender: PlayerState = {
        ...defender,
        nextTurnManaBonus: current + 2,
      };
      return {
        state: {
          ...state,
          players: { ...state.players, [defenderSide]: newDefender },
        },
        events,
        blocksAttack: false,
      };
    }

    case 'destroy': {
      if (attacker.board.length === 0) {
        return { state, events, blocksAttack: false };
      }
      // 最小 attackPower のスロットを選ぶ (同点は先頭)
      let weakestIdx = 0;
      let weakestPower = attacker.board[0].card.attackPower;
      for (let i = 1; i < attacker.board.length; i++) {
        if (attacker.board[i].card.attackPower < weakestPower) {
          weakestPower = attacker.board[i].card.attackPower;
          weakestIdx = i;
        }
      }
      const destroyed = attacker.board[weakestIdx];
      const newAttacker: PlayerState = {
        ...attacker,
        board: [
          ...attacker.board.slice(0, weakestIdx),
          ...attacker.board.slice(weakestIdx + 1),
        ],
        graveyard: [...attacker.graveyard, destroyed.card],
      };
      events.push(
        makeEvent('card_destroyed', state.turn, defenderSide, {
          lostBy: attackerSide,
          cardId: destroyed.card.cardId,
          instanceId: destroyed.card.instanceId,
          source: 'trigger_destroy',
        }),
      );
      return {
        state: {
          ...state,
          players: { ...state.players, [attackerSide]: newAttacker },
        },
        events,
        blocksAttack: false,
      };
    }

    case 'defense': {
      events.push(
        makeEvent('defense_blocked', state.turn, defenderSide, {
          cardId: triggeringCard.cardId,
          instanceId: triggeringCard.instanceId,
        }),
      );
      return { state, events, blocksAttack: true };
    }

    case 'revive': {
      if (defender.graveyard.length === 0) {
        return { state, events, blocksAttack: false };
      }
      const revived = defender.graveyard[0];
      const newDefender: PlayerState = {
        ...defender,
        graveyard: defender.graveyard.slice(1),
        hand: [...defender.hand, revived],
      };
      return {
        state: {
          ...state,
          players: { ...state.players, [defenderSide]: newDefender },
        },
        events,
        blocksAttack: false,
      };
    }
  }
}

// ---- メインディスパッチャ --------------------------------------------------

/**
 * プレイヤーアクションを現在 state に適用。
 * 成功時は新 state と今回発生したイベント配列、失敗時はエラーコードを返す。
 */
export function applyAction(
  state: BattleState,
  action: BattleAction,
): ActionResult {
  if (state.winner) {
    return err('game_already_over', 'ゲームは既に終了しています');
  }
  // v2.0.2 Phase 6b-3: 対象選択モーダル表示中は他のアクションを受け付けない
  // (resumeEventEffectWithTarget 経由でしか進めない)
  if (state.pendingTargetSelection) {
    return err(
      'wrong_phase',
      'カードの対象を選んでください',
    );
  }

  switch (action.type) {
    case 'mulligan':
      return applyMulligan(state, action);
    case 'play_card':
      return applyPlayCard(state, action);
    case 'attack':
      return applyAttack(state, action);
    case 'end_turn':
      return applyEndTurn(state, action);
    case 'surrender':
      return applySurrender(state, action);
  }
}

// ---- mulligan --------------------------------------------------------------

function applyMulligan(
  state: BattleState,
  action: MulliganAction,
): ActionResult {
  // v2.0-launch: マリガンは turn 1 / phase refresh のみ受付
  if (state.turn !== 1 || state.phase !== 'refresh') {
    return err('wrong_phase', 'マリガンはゲーム開始直後のみ可能');
  }

  if (action.keep) {
    // 手札キープ → no-op
    return { ok: true, newState: state, events: [] };
  }

  // 手札を山札に戻してシャッフル、5枚引き直し
  const p = state.players[action.player];
  const handSize = p.hand.length;
  const combined = [...p.deck, ...p.hand];
  const shuffled = shuffleDeck(combined);
  const newHand = shuffled.slice(0, handSize);
  const newDeck = shuffled.slice(handSize);

  const newPlayer: PlayerState = {
    ...p,
    hand: newHand,
    deck: newDeck,
  };

  const event = makeEvent('draw', state.turn, action.player, {
    reason: 'mulligan',
    drawn: handSize,
  });

  const newState = commit(
    { ...state, players: { ...state.players, [action.player]: newPlayer } },
    state.log,
    [event],
  );

  return { ok: true, newState, events: [event] };
}

// ---- play_card -------------------------------------------------------------

function applyPlayCard(
  state: BattleState,
  action: PlayCardAction,
): ActionResult {
  if (action.player !== state.activePlayer) {
    return err('not_your_turn', 'あなたのターンではありません');
  }
  if (state.phase !== 'main') {
    return err('wrong_phase', 'メインフェイズでのみカードをプレイできます');
  }

  const p = state.players[action.player];
  const handIdx = p.hand.findIndex(
    (c) => c.instanceId === action.cardInstanceId,
  );
  if (handIdx < 0) {
    return err('card_not_in_hand', 'そのカードは手札にありません');
  }

  const card = p.hand[handIdx];

  if (card.cost > p.currentCost) {
    return err(
      'insufficient_cost',
      `コストが不足 (所持 ${p.currentCost} / 必要 ${card.cost})`,
    );
  }

  // v2.0.2: cardType でディスパッチ
  switch (card.cardType) {
    case 'character':
      return applyPlayCharacter(state, action, card, handIdx);
    case 'equipment':
      return applyPlayEquipment(state, action, card, handIdx);
    case 'event':
      return applyPlayEvent(state, action, card, handIdx);
    case 'counter':
      // カウンターは「場プレイモード」(主動) と「攻撃時の防御モード」の二刀流。
      // 主動プレイは Phase 4 の applyPlayCounter で event_effect_type に従って発動。
      return applyPlayCounter(state, action, card, handIdx);
    case 'stage':
      return err('not_implemented_yet', 'ステージカードは未実装です');
    default:
      return err('internal_error', `不明なカードタイプ: ${card.cardType}`);
  }
}

// ---- play_card: character (既存ロジック) ----------------------------------

function applyPlayCharacter(
  state: BattleState,
  action: PlayCardAction,
  card: BattleCardInstance,
  handIdx: number,
): ActionResult {
  const p = state.players[action.player];

  if (p.board.length >= BOARD_MAX_SLOTS) {
    return err('board_full', `場はすでに ${BOARD_MAX_SLOTS} 体埋まっています`);
  }
  if (p.cantPlayCharsThisTurn) {
    return err(
      'wrong_phase',
      '相手のイベントによりこのターンはキャラを出せません',
    );
  }

  const newHand = [
    ...p.hand.slice(0, handIdx),
    ...p.hand.slice(handIdx + 1),
  ];
  const newSlot: BoardSlot = {
    card,
    isRested: false,
    canAttackThisTurn: false, // 召喚酔い、次ターンから攻撃可
    playedTurn: state.turn,
  };
  const newBoard = [...p.board, newSlot];

  const newPlayer: PlayerState = {
    ...p,
    hand: newHand,
    board: newBoard,
    currentCost: p.currentCost - card.cost,
  };

  const event = makeEvent('play_card', state.turn, action.player, {
    cardId: card.cardId,
    instanceId: card.instanceId,
    cost: card.cost,
    remainingCost: newPlayer.currentCost,
    boardSize: newBoard.length,
  });

  const newState = commit(
    { ...state, players: { ...state.players, [action.player]: newPlayer } },
    state.log,
    [event],
  );

  return { ok: true, newState, events: [event] };
}

// ---- play_card: equipment (v2.0.2 Phase 3) --------------------------------

/**
 * 装備カードをプレイ。
 *
 * バリデーション:
 *   - 既に装備中なら 'already_equipped'
 *   - equipmentTargetLeaderId と自リーダー id が違うなら 'leader_mismatch'
 *
 * 効果:
 *   - permanent : equipmentBonusAtk/Def/AllyAtk/maxHandSize に加算
 *   - per_turn  : 装備時は no-op (cost フェーズで毎ターン発動)
 *   - once_only : 装備時に 1 回だけ発動 (Phase 3 では revive_from_graveyard のみ対応)
 *                 equipmentOnceUsed = true をセット
 *
 * リーダー破壊時の自動廃棄は不要 (リーダー破壊 = 敗北 = ゲーム終了)。
 */
function applyPlayEquipment(
  state: BattleState,
  action: PlayCardAction,
  card: BattleCardInstance,
  handIdx: number,
): ActionResult {
  const p = state.players[action.player];

  if (p.equippedCard) {
    return err(
      'already_equipped',
      'すでに装備カードが付いています (1 リーダー 1 装備)',
    );
  }

  if (
    card.equipmentTargetLeaderId &&
    card.equipmentTargetLeaderId !== p.leader.id
  ) {
    return err(
      'leader_mismatch',
      `この装備は ${card.equipmentTargetLeaderId} 専用です`,
    );
  }

  // 手札から除去 + コスト消費 + equippedCard セット
  const newHand = [
    ...p.hand.slice(0, handIdx),
    ...p.hand.slice(handIdx + 1),
  ];
  let newPlayer: PlayerState = {
    ...p,
    hand: newHand,
    equippedCard: card,
    currentCost: p.currentCost - card.cost,
  };

  const events: BattleEvent[] = [];

  // permanent ボーナス加算
  if (card.equipmentEffectType === 'permanent') {
    const data = (card.equipmentEffectData ?? {}) as Record<string, unknown>;
    let { equipmentBonusAtk, equipmentBonusDef, equipmentBonusAllyAtk, maxHandSize } =
      newPlayer;
    if (typeof data.atk_bonus === 'number') {
      equipmentBonusAtk += data.atk_bonus;
    }
    if (typeof data.def_bonus === 'number') {
      equipmentBonusDef += data.def_bonus;
    }
    if (typeof data.ally_atk_bonus === 'number') {
      equipmentBonusAllyAtk += data.ally_atk_bonus;
    }
    if (typeof data.max_hand_bonus === 'number') {
      maxHandSize += data.max_hand_bonus;
    }
    newPlayer = {
      ...newPlayer,
      equipmentBonusAtk,
      equipmentBonusDef,
      equipmentBonusAllyAtk,
      maxHandSize,
    };
  }

  // once_only 即時発動
  if (card.equipmentEffectType === 'once_only') {
    const onceResult = applyOnceOnlyEquipmentEffect(
      newPlayer,
      card,
      state.turn,
      action.player,
    );
    newPlayer = { ...onceResult.player, equipmentOnceUsed: true };
    events.push(...onceResult.events);
  }

  // per_turn は装備時には何もしない (advancePhase('cost') の applyPerTurnEquipmentEffect 経由)

  // メインイベントは先頭に置く
  const playEvent = makeEvent('equipment_played', state.turn, action.player, {
    cardId: card.cardId,
    instanceId: card.instanceId,
    cost: card.cost,
    effectType: card.equipmentEffectType ?? null,
    leaderId: p.leader.id,
  });
  events.unshift(playEvent);

  const newState = commit(
    { ...state, players: { ...state.players, [action.player]: newPlayer } },
    state.log,
    events,
  );

  return { ok: true, newState, events };
}

/**
 * once_only 装備の即時効果適用。
 * Phase 3 対応: revive_from_graveyard (墓地 top → 手札)。
 * その他の once_only データは将来拡張で追加。
 */
function applyOnceOnlyEquipmentEffect(
  player: PlayerState,
  card: BattleCardInstance,
  turn: number,
  playerSlot: PlayerSlot,
): { player: PlayerState; events: BattleEvent[] } {
  const data = (card.equipmentEffectData ?? {}) as Record<string, unknown>;
  const events: BattleEvent[] = [];
  let p = player;

  if (data.revive_from_graveyard) {
    if (p.graveyard.length > 0) {
      const revived = p.graveyard[0];
      p = {
        ...p,
        graveyard: p.graveyard.slice(1),
        hand: [...p.hand, revived],
      };
      events.push(
        makeEvent('temp_buff_applied', turn, playerSlot, {
          source: 'equipment_once_only',
          equipmentCardId: card.cardId,
          effectKind: 'revive_from_graveyard',
          revivedCardId: revived.cardId,
          revivedInstanceId: revived.instanceId,
        }),
      );
    }
  }

  return { player: p, events };
}

// ---- play_card: counter (主動プレイモード, v2.0.2 Phase 4) ----------------

/**
 * カウンターカードを手札からプレイ (場プレイモード)。
 *
 * フロー:
 *   1. cost 消費 + 手札除去
 *   2. eventEffectType に従って効果発動 (executeCounterPlayEffect)
 *   3. カウンターカードを墓地末尾に追加
 *
 * カウンターカードのもう一方のモード (攻撃時の防御発動) は applyAttack 側で
 * action.counterCardInstanceId を介して処理される。
 */
function applyPlayCounter(
  state: BattleState,
  action: PlayCardAction,
  card: BattleCardInstance,
  handIdx: number,
): ActionResult {
  const p = state.players[action.player];

  // 手札除去 + コスト消費
  const newHand = [
    ...p.hand.slice(0, handIdx),
    ...p.hand.slice(handIdx + 1),
  ];
  const afterRemoval: BattleState = {
    ...state,
    players: {
      ...state.players,
      [action.player]: {
        ...p,
        hand: newHand,
        currentCost: p.currentCost - card.cost,
      },
    },
    log: [
      ...state.log,
      makeEvent('counter_used', state.turn, action.player, {
        cardId: card.cardId,
        instanceId: card.instanceId,
        cost: card.cost,
        effectType: card.eventEffectType ?? null,
        mode: 'play_from_hand',
      }),
    ],
  };

  const originalLogLen = state.log.length;

  // 効果発動 (墓地追加前: 自分自身を revive_from_graveyard で蘇生不可)
  const afterEffect = executeEventEffect(afterRemoval, action.player, card);

  // 効果発動の結果デッキ切れ等で game_over してたら早期 return
  if (afterEffect.winner) {
    const events = afterEffect.log.slice(originalLogLen);
    return { ok: true, newState: afterEffect, events };
  }

  // 墓地末尾へ追加
  const finalPlayerState = afterEffect.players[action.player];
  const finalState: BattleState = {
    ...afterEffect,
    players: {
      ...afterEffect.players,
      [action.player]: {
        ...finalPlayerState,
        graveyard: [...finalPlayerState.graveyard, card],
      },
    },
  };

  const events = finalState.log.slice(originalLogLen);
  return { ok: true, newState: finalState, events };
}

/**
 * イベントカード / カウンターカードのプレイ時効果ディスパッチャ (v2.0.2)。
 *
 * 仕様:
 *   - state を受け取り、log にイベントを追加した新しい state を返す (pure)
 *   - 21 種の event_effect_type をカバー (Phase 4 + Phase 5)
 *   - 呼び出し側 (applyPlayCounter / applyPlayEvent) は戻り値 state.log の
 *     差分を events として ActionResult に詰める
 */
function executeEventEffect(
  state: BattleState,
  slot: PlayerSlot,
  card: BattleCardInstance,
): BattleState {
  const data = (card.eventEffectData ?? {}) as Record<string, unknown>;
  const effectType = card.eventEffectType ?? null;
  const opponentSlot: PlayerSlot = otherPlayer(slot);

  switch (effectType) {
    case 'draw': {
      const count = typeof data.count === 'number' ? data.count : 1;
      const next = drawCard(state, slot, count);
      if (next.winner) return next;
      return {
        ...next,
        log: [
          ...next.log,
          makeEvent('temp_buff_applied', state.turn, slot, {
            source: 'counter_play',
            cardId: card.cardId,
            effectKind: 'draw',
            count,
          }),
        ],
      };
    }

    case 'reveal_opponent_hand': {
      const opponent = state.players[opponentSlot];
      const count =
        typeof data.reveal_count === 'number'
          ? data.reveal_count
          : typeof data.count === 'number'
            ? data.count
            : 1;
      const revealed = opponent.hand.slice(
        0,
        Math.min(count, opponent.hand.length),
      );
      return {
        ...state,
        log: [
          ...state.log,
          makeEvent('temp_buff_applied', state.turn, slot, {
            source: 'counter_play',
            cardId: card.cardId,
            effectKind: 'reveal_opponent_hand',
            revealedCardIds: revealed.map((c) => c.cardId),
          }),
        ],
      };
    }

    case 'peek_top_deck': {
      const player = state.players[slot];
      const count = typeof data.count === 'number' ? data.count : 1;
      const peeked = player.deck.slice(0, Math.min(count, player.deck.length));
      return {
        ...state,
        log: [
          ...state.log,
          makeEvent('temp_buff_applied', state.turn, slot, {
            source: 'counter_play',
            cardId: card.cardId,
            effectKind: 'peek_top_deck',
            peekedCardIds: peeked.map((c) => c.cardId),
          }),
        ],
      };
    }

    case 'revive_from_graveyard': {
      const player = state.players[slot];
      if (player.graveyard.length === 0) return state;
      const revived = player.graveyard[0];
      return {
        ...state,
        players: {
          ...state.players,
          [slot]: {
            ...player,
            graveyard: player.graveyard.slice(1),
            hand: [...player.hand, revived],
          },
        },
        log: [
          ...state.log,
          makeEvent('temp_buff_applied', state.turn, slot, {
            source: 'counter_play',
            cardId: card.cardId,
            effectKind: 'revive_from_graveyard',
            revivedCardId: revived.cardId,
            revivedInstanceId: revived.instanceId,
          }),
        ],
      };
    }

    case 'draw_then_discard': {
      const drawCount = typeof data.draw === 'number' ? data.draw : 1;
      const next = drawCard(state, slot, drawCount);
      if (next.winner) return next;
      const player = next.players[slot];
      if (player.hand.length === 0) {
        return {
          ...next,
          log: [
            ...next.log,
            makeEvent('temp_buff_applied', state.turn, slot, {
              source: 'counter_play',
              cardId: card.cardId,
              effectKind: 'draw_then_discard',
              drawn: drawCount,
              discardedCardId: null,
            }),
          ],
        };
      }
      // 簡易: 手札の先頭を捨てる (UI 選択は Phase 6)
      const discarded = player.hand[0];
      return {
        ...next,
        players: {
          ...next.players,
          [slot]: {
            ...player,
            hand: player.hand.slice(1),
            graveyard: [...player.graveyard, discarded],
          },
        },
        log: [
          ...next.log,
          makeEvent('temp_buff_applied', state.turn, slot, {
            source: 'counter_play',
            cardId: card.cardId,
            effectKind: 'draw_then_discard',
            drawn: drawCount,
            discardedCardId: discarded.cardId,
          }),
        ],
      };
    }

    case 'heal_life': {
      // ライフ回復: deck 先頭を lifeCards 末尾に積み直す (デッキ切れは無効)
      const amount =
        typeof data.life_bonus === 'number'
          ? data.life_bonus
          : typeof data.count === 'number'
            ? data.count
            : 1;
      let working: BattleState = state;
      let healed = 0;
      for (let i = 0; i < amount; i++) {
        const player = working.players[slot];
        if (player.deck.length === 0) break;
        const top = player.deck[0];
        working = {
          ...working,
          players: {
            ...working.players,
            [slot]: {
              ...player,
              deck: player.deck.slice(1),
              lifeCards: [...player.lifeCards, top],
              leader: { ...player.leader, life: player.leader.life + 1 },
            },
          },
        };
        healed++;
      }
      return {
        ...working,
        log: [
          ...working.log,
          makeEvent('temp_buff_applied', state.turn, slot, {
            source: 'counter_play',
            cardId: card.cardId,
            effectKind: 'heal_life',
            requested: amount,
            healed,
          }),
        ],
      };
    }

    case 'rest_release_one': {
      const player = state.players[slot];
      const restedIdx = player.board.findIndex((s) => s.isRested);
      if (restedIdx < 0) return state;
      const target = player.board[restedIdx];
      return {
        ...state,
        players: {
          ...state.players,
          [slot]: {
            ...player,
            board: player.board.map((s, i) =>
              i === restedIdx ? { ...s, isRested: false } : s,
            ),
          },
        },
        log: [
          ...state.log,
          makeEvent('temp_buff_applied', state.turn, slot, {
            source: 'counter_play',
            cardId: card.cardId,
            effectKind: 'rest_release_one',
            targetCardId: target.card.cardId,
            targetInstanceId: target.card.instanceId,
          }),
        ],
      };
    }

    case 'buff_leader_def': {
      const value = typeof data.def_bonus === 'number' ? data.def_bonus : 2;
      // duration: 'until_next_opponent_turn_end' (ev_great_wall_build 等) と
      // それ以外 (this_turn) を分岐
      const expiresAt: TempBuff['expiresAt'] =
        data.duration === 'until_next_opponent_turn_end'
          ? 'until_next_opponent_turn_end'
          : data.duration === 'next_opponent_turn_end'
            ? 'next_opponent_turn_end'
            : 'this_turn';
      const player = state.players[slot];
      const buff: TempBuff = {
        id: nanoid(10),
        type: 'leader_def_bonus',
        value,
        scope: 'leader',
        expiresAt,
        createdTurn: state.turn,
      };
      return {
        ...state,
        players: {
          ...state.players,
          [slot]: { ...player, tempBuffs: [...(player.tempBuffs ?? []), buff] },
        },
        log: [
          ...state.log,
          makeEvent('temp_buff_applied', state.turn, slot, {
            source: 'event_play',
            cardId: card.cardId,
            effectKind: 'buff_leader_def',
            value,
            expiresAt,
            buffId: buff.id,
          }),
        ],
      };
    }

    case 'buff_my_chars_atk': {
      const value = typeof data.atk_bonus === 'number' ? data.atk_bonus : 1;
      const player = state.players[slot];
      const buff: TempBuff = {
        id: nanoid(10),
        type: 'atk_bonus',
        value,
        scope: 'all_my_chars',
        expiresAt: 'this_turn',
        createdTurn: state.turn,
      };
      return {
        ...state,
        players: {
          ...state.players,
          [slot]: { ...player, tempBuffs: [...(player.tempBuffs ?? []), buff] },
        },
        log: [
          ...state.log,
          makeEvent('temp_buff_applied', state.turn, slot, {
            source: 'event_play',
            cardId: card.cardId,
            effectKind: 'buff_my_chars_atk',
            value,
            buffId: buff.id,
          }),
        ],
      };
    }

    // ---- v2.0.2 Phase 5 新規 11 種 ----------------------------------------

    case 'destroy_enemy_char': {
      // ev_honnoji 等: 敵キャラ 1 体を強制破壊 (UI 選択は Phase 6)
      const opponent = state.players[opponentSlot];
      if (opponent.board.length === 0) return state;
      const targetIdx = 0; // 簡易: 先頭スロットを破壊
      const target = opponent.board[targetIdx];
      return {
        ...state,
        players: {
          ...state.players,
          [opponentSlot]: {
            ...opponent,
            board: [
              ...opponent.board.slice(0, targetIdx),
              ...opponent.board.slice(targetIdx + 1),
            ],
            graveyard: [...opponent.graveyard, target.card],
          },
        },
        log: [
          ...state.log,
          makeEvent('card_destroyed', state.turn, slot, {
            source: 'event_play',
            cardId: card.cardId,
            effectKind: 'destroy_enemy_char',
            destroyedCardId: target.card.cardId,
            destroyedInstanceId: target.card.instanceId,
          }),
        ],
      };
    }

    case 'both_draw_self_extra': {
      // ev_renaissance: 両者 N 枚ドロー、自分はさらに +M 枚
      const bothCount =
        typeof data.both_count === 'number' ? data.both_count : 2;
      const selfExtra =
        typeof data.self_extra === 'number' ? data.self_extra : 1;
      let next: BattleState = state;
      next = drawCard(next, slot, bothCount);
      if (next.winner) return next;
      next = drawCard(next, opponentSlot, bothCount);
      if (next.winner) return next;
      next = drawCard(next, slot, selfExtra);
      if (next.winner) return next;
      return {
        ...next,
        log: [
          ...next.log,
          makeEvent('temp_buff_applied', state.turn, slot, {
            source: 'event_play',
            cardId: card.cardId,
            effectKind: 'both_draw_self_extra',
            bothCount,
            selfExtra,
          }),
        ],
      };
    }

    case 'reveal_then_discard': {
      // ev_heliocentric 等: 相手手札 1 枚見て 1 枚捨てさせる (簡易: 先頭)
      const opponent = state.players[opponentSlot];
      if (opponent.hand.length === 0) return state;
      const target = opponent.hand[0];
      return {
        ...state,
        players: {
          ...state.players,
          [opponentSlot]: {
            ...opponent,
            hand: opponent.hand.slice(1),
            graveyard: [...opponent.graveyard, target],
          },
        },
        log: [
          ...state.log,
          makeEvent('temp_buff_applied', state.turn, slot, {
            source: 'event_play',
            cardId: card.cardId,
            effectKind: 'reveal_then_discard',
            discardedCardId: target.cardId,
          }),
        ],
      };
    }

    case 'scry_then_pick': {
      // ev_genji_writing: 山札上 N 枚を見て M 枚を手札に、残りはデッキ上に戻す
      const scryCount = typeof data.scry === 'number' ? data.scry : 3;
      const pickCount = typeof data.pick === 'number' ? data.pick : 1;
      const player = state.players[slot];
      if (player.deck.length === 0) return state;
      const peekedAll = player.deck.slice(0, scryCount);
      const picked = peekedAll.slice(0, pickCount);
      const returned = peekedAll.slice(pickCount);
      const restDeck = player.deck.slice(peekedAll.length);
      // returned は山札 top に戻す (順序維持)
      const newDeck = [...returned, ...restDeck];
      return {
        ...state,
        players: {
          ...state.players,
          [slot]: {
            ...player,
            deck: newDeck,
            hand: [...player.hand, ...picked],
          },
        },
        log: [
          ...state.log,
          makeEvent('temp_buff_applied', state.turn, slot, {
            source: 'event_play',
            cardId: card.cardId,
            effectKind: 'scry_then_pick',
            pickedCardIds: picked.map((c) => c.cardId),
            returnedCount: returned.length,
          }),
        ],
      };
    }

    case 'draw_and_buff': {
      // ev_pillow_morning: 1 ドロー + 自分の場のキャラ 1 体に atk +N (this_turn)
      const drawCount = typeof data.draw === 'number' ? data.draw : 1;
      const atkBonus = typeof data.atk_bonus === 'number' ? data.atk_bonus : 2;
      let next: BattleState = drawCard(state, slot, drawCount);
      if (next.winner) return next;
      const player = next.players[slot];
      if (player.board.length === 0) {
        // 場にキャラがいなければドローのみ
        return {
          ...next,
          log: [
            ...next.log,
            makeEvent('temp_buff_applied', state.turn, slot, {
              source: 'event_play',
              cardId: card.cardId,
              effectKind: 'draw_and_buff',
              drawn: drawCount,
              buffApplied: false,
            }),
          ],
        };
      }
      const targetSlot = player.board[0]; // 簡易: 先頭スロット
      const buff: TempBuff = {
        id: nanoid(10),
        type: 'atk_bonus',
        value: atkBonus,
        scope: '1_char',
        targetInstanceId: targetSlot.card.instanceId,
        expiresAt: 'this_turn',
        createdTurn: state.turn,
      };
      return {
        ...next,
        players: {
          ...next.players,
          [slot]: {
            ...player,
            tempBuffs: [...(player.tempBuffs ?? []), buff],
          },
        },
        log: [
          ...next.log,
          makeEvent('temp_buff_applied', state.turn, slot, {
            source: 'event_play',
            cardId: card.cardId,
            effectKind: 'draw_and_buff',
            drawn: drawCount,
            atkBonus,
            targetInstanceId: targetSlot.card.instanceId,
            buffId: buff.id,
          }),
        ],
      };
    }

    case 'debuff_all_enemies_atk': {
      // ev_river_flood 等: 敵キャラ全員 atk -N (this_turn)
      // 実装方針: 相手プレイヤーの tempBuffs に scope='all_my_chars' で
      // value=負数 を仕込む (getEffectiveCharAtk が player.tempBuffs を見るので
      // 相手側からみたキャラの atk が下がる)
      const debuff = typeof data.atk_debuff === 'number' ? data.atk_debuff : 1;
      const opponent = state.players[opponentSlot];
      const buff: TempBuff = {
        id: nanoid(10),
        type: 'atk_bonus', // 同じ atk_bonus type でマイナス値
        value: -Math.abs(debuff),
        scope: 'all_my_chars',
        expiresAt: 'this_turn',
        createdTurn: state.turn,
      };
      return {
        ...state,
        players: {
          ...state.players,
          [opponentSlot]: {
            ...opponent,
            tempBuffs: [...(opponent.tempBuffs ?? []), buff],
          },
        },
        log: [
          ...state.log,
          makeEvent('temp_buff_applied', state.turn, slot, {
            source: 'event_play',
            cardId: card.cardId,
            effectKind: 'debuff_all_enemies_atk',
            value: -Math.abs(debuff),
            buffId: buff.id,
          }),
        ],
      };
    }

    case 'rest_release_all_my_chars': {
      // ev_moonlight_hunt 等: 自分のキャラ全員のレスト解除
      const player = state.players[slot];
      if (player.board.length === 0) return state;
      return {
        ...state,
        players: {
          ...state.players,
          [slot]: {
            ...player,
            board: player.board.map((s) => ({ ...s, isRested: false })),
          },
        },
        log: [
          ...state.log,
          makeEvent('temp_buff_applied', state.turn, slot, {
            source: 'event_play',
            cardId: card.cardId,
            effectKind: 'rest_release_all_my_chars',
            count: player.board.length,
          }),
        ],
      };
    }

    case 'rest_all_chars': {
      // ev_great_storm 等: 両者キャラ全員レスト
      const player = state.players[slot];
      const opponent = state.players[opponentSlot];
      return {
        ...state,
        players: {
          ...state.players,
          [slot]: {
            ...player,
            board: player.board.map((s) => ({ ...s, isRested: true })),
          },
          [opponentSlot]: {
            ...opponent,
            board: opponent.board.map((s) => ({ ...s, isRested: true })),
          },
        },
        log: [
          ...state.log,
          makeEvent('temp_buff_applied', state.turn, slot, {
            source: 'event_play',
            cardId: card.cardId,
            effectKind: 'rest_all_chars',
            myCount: player.board.length,
            enemyCount: opponent.board.length,
          }),
        ],
      };
    }

    case 'opponent_cant_play_chars': {
      // ev_lunar_eclipse 等: 相手はこのターン キャラを場に出せない
      // 相手 PlayerState のフラグを直接立てる (advancePhase の end で false に戻す)
      const opponent = state.players[opponentSlot];
      return {
        ...state,
        players: {
          ...state.players,
          [opponentSlot]: { ...opponent, cantPlayCharsThisTurn: true },
        },
        log: [
          ...state.log,
          makeEvent('temp_buff_applied', state.turn, slot, {
            source: 'event_play',
            cardId: card.cardId,
            effectKind: 'opponent_cant_play_chars',
          }),
        ],
      };
    }

    case 'destroy_low_cost_chars': {
      // ev_earthquake_global: 両者の cost <= max_cost のキャラを全破壊
      const maxCost = typeof data.max_cost === 'number' ? data.max_cost : 3;
      const player = state.players[slot];
      const opponent = state.players[opponentSlot];

      const partition = (
        boardSlots: typeof player.board,
      ): { survivors: typeof player.board; destroyed: BattleCardInstance[] } => {
        const survivors: typeof player.board = [];
        const destroyed: BattleCardInstance[] = [];
        for (const s of boardSlots) {
          if (s.card.cost <= maxCost) destroyed.push(s.card);
          else survivors.push(s);
        }
        return { survivors, destroyed };
      };

      const myParts = partition(player.board);
      const enemyParts = partition(opponent.board);

      const newPlayer: PlayerState = {
        ...player,
        board: myParts.survivors,
        graveyard: [...player.graveyard, ...myParts.destroyed],
      };
      const newOpponent: PlayerState = {
        ...opponent,
        board: enemyParts.survivors,
        graveyard: [...opponent.graveyard, ...enemyParts.destroyed],
      };

      return {
        ...state,
        players: {
          ...state.players,
          [slot]: newPlayer,
          [opponentSlot]: newOpponent,
        },
        log: [
          ...state.log,
          makeEvent('temp_buff_applied', state.turn, slot, {
            source: 'event_play',
            cardId: card.cardId,
            effectKind: 'destroy_low_cost_chars',
            maxCost,
            myDestroyedIds: myParts.destroyed.map((c) => c.cardId),
            enemyDestroyedIds: enemyParts.destroyed.map((c) => c.cardId),
          }),
        ],
      };
    }

    case 'reveal_opponent_hand_all': {
      // ev_scout 等: 相手手札を全部見る (UI 表示用イベント)
      const opponent = state.players[opponentSlot];
      return {
        ...state,
        log: [
          ...state.log,
          makeEvent('temp_buff_applied', state.turn, slot, {
            source: 'event_play',
            cardId: card.cardId,
            effectKind: 'reveal_opponent_hand_all',
            revealedCardIds: opponent.hand.map((c) => c.cardId),
          }),
        ],
      };
    }

    default: {
      console.warn(
        '[executeEventEffect] unknown effect type:',
        effectType,
      );
      return state;
    }
  }
}

// ---- play_card: event (主動プレイ, v2.0.2 Phase 5) ------------------------

/**
 * イベントカードを手札からプレイ。即時効果発動 → 墓地末尾追加。
 *
 * カウンターと違い、攻撃時の防御モードは持たない (常にメインフェイズ主動プレイ)。
 * カウンターの「場プレイモード」と本関数は実質同じ流れだが、ログに発火する
 * メインイベント種別 ('event_played' vs 'counter_used') を分けて扱う。
 */
function applyPlayEvent(
  state: BattleState,
  action: PlayCardAction,
  card: BattleCardInstance,
  handIdx: number,
): ActionResult {
  const p = state.players[action.player];
  const isAIPlayer = p.isAI === true || p.id === 'ai';
  const effectType = card.eventEffectType ?? null;

  // v2.0.2 Phase 6b-3: 人間 + 対象選択必須 effect は pending に保留
  if (
    !isAIPlayer &&
    typeof effectType === 'string' &&
    TARGET_SELECTION_REQUIRED.has(
      effectType as PendingTargetSelection['type'],
    )
  ) {
    return applyPlayEventWithSelection(
      state,
      action,
      card,
      handIdx,
      effectType as PendingTargetSelection['type'],
    );
  }

  // 手札除去 + コスト消費
  const newHand = [
    ...p.hand.slice(0, handIdx),
    ...p.hand.slice(handIdx + 1),
  ];
  const afterRemoval: BattleState = {
    ...state,
    players: {
      ...state.players,
      [action.player]: {
        ...p,
        hand: newHand,
        currentCost: p.currentCost - card.cost,
      },
    },
    log: [
      ...state.log,
      makeEvent('event_played', state.turn, action.player, {
        cardId: card.cardId,
        instanceId: card.instanceId,
        cost: card.cost,
        effectType: card.eventEffectType ?? null,
      }),
    ],
  };

  const originalLogLen = state.log.length;

  // 効果発動 (墓地追加前)
  const afterEffect = executeEventEffect(afterRemoval, action.player, card);

  if (afterEffect.winner) {
    const events = afterEffect.log.slice(originalLogLen);
    return { ok: true, newState: afterEffect, events };
  }

  // 墓地末尾へ追加
  const finalPlayerState = afterEffect.players[action.player];
  const finalState: BattleState = {
    ...afterEffect,
    players: {
      ...afterEffect.players,
      [action.player]: {
        ...finalPlayerState,
        graveyard: [...finalPlayerState.graveyard, card],
      },
    },
  };

  const events = finalState.log.slice(originalLogLen);
  return { ok: true, newState: finalState, events };
}

// ---- v2.0.2 Phase 6b-3: 対象選択を伴うイベントカードの保留処理 ----------

/**
 * 対象選択必須効果をプレイした際の候補 instanceId 配列を返す。
 * 候補が 0 件なら空配列。
 *
 *   - destroy_enemy_char  : 相手 board キャラ全件
 *   - reveal_then_discard : 相手 hand 全件
 *   - scry_then_pick      : 自 deck top の peeked カード instanceId 全件
 *   - draw_and_buff       : 自 board キャラ全件 (場が空でもドローはするが、
 *                           pause せず即時実行する: 後段で分岐)
 */
function collectTargetCandidates(
  state: BattleState,
  player: PlayerSlot,
  type: PendingTargetSelection['type'],
  scryCount: number,
): { candidates: string[]; peekedCards?: BattleCardInstance[] } {
  const me = state.players[player];
  const opponent = state.players[otherPlayer(player)];
  switch (type) {
    case 'destroy_enemy_char':
      return { candidates: opponent.board.map((s) => s.card.instanceId) };
    case 'reveal_then_discard':
      return { candidates: opponent.hand.map((c) => c.instanceId) };
    case 'scry_then_pick': {
      const peeked = me.deck.slice(0, Math.min(scryCount, me.deck.length));
      return {
        candidates: peeked.map((c) => c.instanceId),
        peekedCards: peeked,
      };
    }
    case 'draw_and_buff':
      return { candidates: me.board.map((s) => s.card.instanceId) };
  }
}

/**
 * 人間プレイヤーが対象選択必須効果をプレイした時の保留処理。
 *
 * フロー:
 *   1. 候補を集める。0 件なら 'no_valid_targets' で弾く
 *      (例外: draw_and_buff は board が空でも「ドローのみ」で即時実行)
 *   2. コスト消費 + pendingTargetSelection セット
 *      (カードは hand に残す。resume 時に hand から graveyard へ移す)
 *   3. event_played ログを発火 (UI バナー用)
 */
function applyPlayEventWithSelection(
  state: BattleState,
  action: PlayCardAction,
  card: BattleCardInstance,
  handIdx: number,
  type: PendingTargetSelection['type'],
): ActionResult {
  const p = state.players[action.player];
  const data = (card.eventEffectData ?? {}) as Record<string, unknown>;
  const scryCount = typeof data.scry === 'number' ? data.scry : 3;

  const { candidates, peekedCards } = collectTargetCandidates(
    state,
    action.player,
    type,
    scryCount,
  );

  // draw_and_buff: 自 board が空でも「ドローのみ」のフォールバックを取りたいので
  // pause せず即時実行に回す (executeEventEffect 側の既存実装が buffApplied=false を
  // 返す)。
  if (candidates.length === 0) {
    if (type === 'draw_and_buff') {
      // 即時パスへフォールバック (人間でも board 空時はドローのみ)
      return applyPlayEventImmediate(state, action, card, handIdx);
    }
    return err('no_valid_targets', 'このカードの対象がいません');
  }

  // コスト消費 + pending セット (hand はそのまま、resume で除去 → 墓地へ)
  const pending: PendingTargetSelection = {
    type,
    cardInstanceId: card.instanceId,
    cardId: card.cardId,
    player: action.player,
    candidates,
    context: peekedCards ? { peekedCards } : undefined,
  };

  const playEvent = makeEvent('event_played', state.turn, action.player, {
    cardId: card.cardId,
    instanceId: card.instanceId,
    cost: card.cost,
    effectType: type,
    pendingTargetSelection: true,
  });

  const newState: BattleState = {
    ...state,
    players: {
      ...state.players,
      [action.player]: {
        ...p,
        currentCost: p.currentCost - card.cost,
      },
    },
    pendingTargetSelection: pending,
    log: [...state.log, playEvent],
  };

  return { ok: true, newState, events: [playEvent] };
}

/**
 * AI / 即時パス用に旧 applyPlayEvent 本体を抽出したヘルパ。
 * (人間 + draw_and_buff で board 空のフォールバックでも使う)
 */
function applyPlayEventImmediate(
  state: BattleState,
  action: PlayCardAction,
  card: BattleCardInstance,
  handIdx: number,
): ActionResult {
  const p = state.players[action.player];
  const newHand = [
    ...p.hand.slice(0, handIdx),
    ...p.hand.slice(handIdx + 1),
  ];
  const afterRemoval: BattleState = {
    ...state,
    players: {
      ...state.players,
      [action.player]: {
        ...p,
        hand: newHand,
        currentCost: p.currentCost - card.cost,
      },
    },
    log: [
      ...state.log,
      makeEvent('event_played', state.turn, action.player, {
        cardId: card.cardId,
        instanceId: card.instanceId,
        cost: card.cost,
        effectType: card.eventEffectType ?? null,
      }),
    ],
  };
  const originalLogLen = state.log.length;
  const afterEffect = executeEventEffect(afterRemoval, action.player, card);
  if (afterEffect.winner) {
    const events = afterEffect.log.slice(originalLogLen);
    return { ok: true, newState: afterEffect, events };
  }
  const finalPlayerState = afterEffect.players[action.player];
  const finalState: BattleState = {
    ...afterEffect,
    players: {
      ...afterEffect.players,
      [action.player]: {
        ...finalPlayerState,
        graveyard: [...finalPlayerState.graveyard, card],
      },
    },
  };
  const events = finalState.log.slice(originalLogLen);
  return { ok: true, newState: finalState, events };
}

/**
 * 対象選択 pending → 効果適用本体。
 * pending.candidates に含まれない targetInstanceId は invalid_target で弾く。
 * 戻り値は新 state + 今回追加されたイベント差分。
 */
function executeEventEffectWithTarget(
  state: BattleState,
  pending: PendingTargetSelection,
  targetInstanceId: string,
  card: BattleCardInstance,
): ActionResult {
  if (!pending.candidates.includes(targetInstanceId)) {
    return err('invalid_target', '選択されたカードは対象として無効です');
  }

  const slot = pending.player;
  const opponentSlot = otherPlayer(slot);
  const data = (card.eventEffectData ?? {}) as Record<string, unknown>;
  const originalLogLen = state.log.length;

  switch (pending.type) {
    case 'destroy_enemy_char': {
      const opponent = state.players[opponentSlot];
      const targetIdx = opponent.board.findIndex(
        (s) => s.card.instanceId === targetInstanceId,
      );
      if (targetIdx < 0) {
        return err('invalid_target', '対象キャラが場にいません');
      }
      const target = opponent.board[targetIdx];
      const newOpponent: PlayerState = {
        ...opponent,
        board: [
          ...opponent.board.slice(0, targetIdx),
          ...opponent.board.slice(targetIdx + 1),
        ],
        graveyard: [...opponent.graveyard, target.card],
      };
      const ev = makeEvent('card_destroyed', state.turn, slot, {
        source: 'event_play',
        cardId: card.cardId,
        effectKind: 'destroy_enemy_char',
        destroyedCardId: target.card.cardId,
        destroyedInstanceId: target.card.instanceId,
        chosenBy: 'human',
      });
      const newState: BattleState = {
        ...state,
        players: { ...state.players, [opponentSlot]: newOpponent },
        log: [...state.log, ev],
      };
      return { ok: true, newState, events: newState.log.slice(originalLogLen) };
    }

    case 'reveal_then_discard': {
      const opponent = state.players[opponentSlot];
      const targetIdx = opponent.hand.findIndex(
        (c) => c.instanceId === targetInstanceId,
      );
      if (targetIdx < 0) {
        return err('invalid_target', '対象カードが手札にありません');
      }
      const target = opponent.hand[targetIdx];
      const newOpponent: PlayerState = {
        ...opponent,
        hand: [
          ...opponent.hand.slice(0, targetIdx),
          ...opponent.hand.slice(targetIdx + 1),
        ],
        graveyard: [...opponent.graveyard, target],
      };
      const ev = makeEvent('temp_buff_applied', state.turn, slot, {
        source: 'event_play',
        cardId: card.cardId,
        effectKind: 'reveal_then_discard',
        discardedCardId: target.cardId,
        chosenBy: 'human',
      });
      const newState: BattleState = {
        ...state,
        players: { ...state.players, [opponentSlot]: newOpponent },
        log: [...state.log, ev],
      };
      return { ok: true, newState, events: newState.log.slice(originalLogLen) };
    }

    case 'scry_then_pick': {
      const player = state.players[slot];
      const peeked = pending.context?.peekedCards ?? [];
      const pickIdx = peeked.findIndex(
        (c) => c.instanceId === targetInstanceId,
      );
      if (pickIdx < 0) {
        return err('invalid_target', '選択カードはピーク対象にありません');
      }
      const picked = peeked[pickIdx];
      const remaining = [
        ...peeked.slice(0, pickIdx),
        ...peeked.slice(pickIdx + 1),
      ];
      // 山札 top から peeked.length 枚を取り除き、残り (remaining) を元の順序で先頭に戻す
      const restDeck = player.deck.slice(peeked.length);
      const newDeck = [...remaining, ...restDeck];
      const newPlayer: PlayerState = {
        ...player,
        deck: newDeck,
        hand: [...player.hand, picked],
      };
      const ev = makeEvent('temp_buff_applied', state.turn, slot, {
        source: 'event_play',
        cardId: card.cardId,
        effectKind: 'scry_then_pick',
        pickedCardIds: [picked.cardId],
        returnedCount: remaining.length,
        chosenBy: 'human',
      });
      const newState: BattleState = {
        ...state,
        players: { ...state.players, [slot]: newPlayer },
        log: [...state.log, ev],
      };
      return { ok: true, newState, events: newState.log.slice(originalLogLen) };
    }

    case 'draw_and_buff': {
      const drawCount = typeof data.draw === 'number' ? data.draw : 1;
      const atkBonus = typeof data.atk_bonus === 'number' ? data.atk_bonus : 2;
      let next: BattleState = drawCard(state, slot, drawCount);
      if (next.winner) {
        return {
          ok: true,
          newState: next,
          events: next.log.slice(originalLogLen),
        };
      }
      const player = next.players[slot];
      const targetIdx = player.board.findIndex(
        (s) => s.card.instanceId === targetInstanceId,
      );
      if (targetIdx < 0) {
        return err('invalid_target', '対象キャラが場にいません');
      }
      const buff: TempBuff = {
        id: nanoid(10),
        type: 'atk_bonus',
        value: atkBonus,
        scope: '1_char',
        targetInstanceId,
        expiresAt: 'this_turn',
        createdTurn: state.turn,
      };
      const newPlayer: PlayerState = {
        ...player,
        tempBuffs: [...(player.tempBuffs ?? []), buff],
      };
      const ev = makeEvent('temp_buff_applied', state.turn, slot, {
        source: 'event_play',
        cardId: card.cardId,
        effectKind: 'draw_and_buff',
        drawn: drawCount,
        atkBonus,
        targetInstanceId,
        buffId: buff.id,
        chosenBy: 'human',
      });
      const newState: BattleState = {
        ...next,
        players: { ...next.players, [slot]: newPlayer },
        log: [...next.log, ev],
      };
      return { ok: true, newState, events: newState.log.slice(originalLogLen) };
    }
  }
}

/**
 * 保留中の対象選択を確定して効果を発動する。
 *
 *   - selection.targetInstanceId : 選んだ対象 (pending.candidates のいずれか)
 *
 * フロー:
 *   1. pending を取り出して null クリア
 *   2. executeEventEffectWithTarget で効果適用
 *   3. 元カードを hand → graveyard へ移動 (winner が確定していなければ)
 */
export function resumeEventEffectWithTarget(
  state: BattleState,
  selection: { targetInstanceId: string },
): ActionResult {
  const pending = state.pendingTargetSelection;
  if (!pending) {
    return err('no_pending_selection', '保留中の対象選択がありません');
  }

  const player = state.players[pending.player];
  const handIdx = player.hand.findIndex(
    (c) => c.instanceId === pending.cardInstanceId,
  );
  if (handIdx < 0) {
    return err('internal_error', '保留中のカードが手札に見つかりません');
  }
  const card = player.hand[handIdx];

  const cleared: BattleState = { ...state, pendingTargetSelection: null };
  const result = executeEventEffectWithTarget(
    cleared,
    pending,
    selection.targetInstanceId,
    card,
  );
  if (!result.ok) return result;

  if (result.newState.winner) {
    return result;
  }

  // hand → graveyard
  const finalPlayerState = result.newState.players[pending.player];
  const newHand = [
    ...finalPlayerState.hand.slice(0, handIdx),
    ...finalPlayerState.hand.slice(handIdx + 1),
  ];
  const finalState: BattleState = {
    ...result.newState,
    players: {
      ...result.newState.players,
      [pending.player]: {
        ...finalPlayerState,
        hand: newHand,
        graveyard: [...finalPlayerState.graveyard, card],
      },
    },
  };

  return { ok: true, newState: finalState, events: result.events };
}

// ---- attack ----------------------------------------------------------------

function applyAttack(state: BattleState, action: AttackAction): ActionResult {
  if (action.player !== state.activePlayer) {
    return err('not_your_turn', 'あなたのターンではありません');
  }
  if (state.phase !== 'main') {
    return err('wrong_phase', 'メインフェイズでのみ攻撃できます');
  }

  const attackerSide = action.player;
  const defenderSide = otherPlayer(attackerSide);
  const attackerPlayer = state.players[attackerSide];
  const defenderPlayer = state.players[defenderSide];

  // [DEBUG] D4.2 攻撃バグ調査 — 値の型と実態を残す
  console.log('[applyAttack] ENTRY', {
    action: {
      attackerSource: action.attackerSource,
      targetSource: action.targetSource,
      player: action.player,
    },
    activePlayer: state.activePlayer,
    phase: state.phase,
    attackerLeader: {
      id: attackerPlayer.leader.id,
      name: attackerPlayer.leader.name,
      attackPower: attackerPlayer.leader.attackPower,
      attackPowerType: typeof attackerPlayer.leader.attackPower,
      defensePower: attackerPlayer.leader.defensePower,
      isRested: attackerPlayer.leader.isRested,
    },
    defenderLeader: {
      id: defenderPlayer.leader.id,
      name: defenderPlayer.leader.name,
      attackPower: defenderPlayer.leader.attackPower,
      defensePower: defenderPlayer.leader.defensePower,
      defensePowerType: typeof defenderPlayer.leader.defensePower,
      life: defenderPlayer.leader.life,
      lifeCardsLen: defenderPlayer.lifeCards.length,
    },
  });

  // --- アタッカー解決 ---
  let attackPower: number;
  let attackerName: string;
  let restedAttackerState: PlayerState;

  if (action.attackerSource.kind === 'leader') {
    if (attackerPlayer.leader.isRested) {
      return err('already_rested', 'リーダーはすでにレスト状態です');
    }
    // リーダーはサモニング病なし、装備の atk_bonus を反映
    attackPower = getEffectiveLeaderAtk(attackerPlayer);
    attackerName = attackerPlayer.leader.name;
    restedAttackerState = {
      ...attackerPlayer,
      leader: { ...attackerPlayer.leader, isRested: true },
    };
  } else {
    const attInstanceId = action.attackerSource.instanceId;
    const slotIdx = attackerPlayer.board.findIndex(
      (s) => s.card.instanceId === attInstanceId,
    );
    if (slotIdx < 0) {
      return err('invalid_target', 'アタッカーが場にいません');
    }
    const slot = attackerPlayer.board[slotIdx];
    if (slot.isRested) {
      return err('already_rested', 'そのキャラはすでにレスト状態です');
    }
    if (!slot.canAttackThisTurn) {
      return err('summoning_sickness', 'そのキャラは召喚酔い中で攻撃できません');
    }
    // キャラ攻撃時は装備の ally_atk_bonus を反映
    attackPower = getEffectiveCharAtk(attackerPlayer, slot.card);
    attackerName = slot.card.name;
    restedAttackerState = {
      ...attackerPlayer,
      board: attackerPlayer.board.map((s, i) =>
        i === slotIdx ? { ...s, isRested: true } : s,
      ),
    };
  }

  // --- ターゲット解決 ---
  let defensePower: number;
  let targetName: string;
  let targetCharIdx = -1; // キャラターゲット時のみ有効

  if (action.targetSource.kind === 'leader') {
    // リーダー防御は装備の def_bonus を反映
    defensePower = getEffectiveLeaderDef(defenderPlayer);
    targetName = defenderPlayer.leader.name;
    // [DEBUG] Phase 6b-3.5 — 防御値の内訳を出して再発時の調査を早くする
    const leaderDefBuffs = (defenderPlayer.tempBuffs ?? []).filter(
      (b) => b.type === 'leader_def_bonus' && b.scope === 'leader',
    );
    console.log('[applyAttack] defense breakdown (leader)', {
      total: defensePower,
      base: defenderPlayer.leader.defensePower,
      equipmentBonusDef: defenderPlayer.equipmentBonusDef ?? 0,
      tempBuffs: leaderDefBuffs.map((b) => ({
        value: b.value,
        expiresAt: b.expiresAt,
        createdTurn: b.createdTurn,
      })),
    });
  } else {
    const targetInstanceId = action.targetSource.instanceId;
    targetCharIdx = defenderPlayer.board.findIndex(
      (s) => s.card.instanceId === targetInstanceId,
    );
    if (targetCharIdx < 0) {
      return err('invalid_target', '対象が場にいません');
    }
    const tSlot = defenderPlayer.board[targetCharIdx];
    // v2.0-launch: キャラはレスト中のみ攻撃対象
    if (!tSlot.isRested) {
      return err(
        'cannot_attack_active',
        'アクティブなキャラは攻撃できません (レスト中のみ対象)',
      );
    }
    defensePower = tSlot.card.defensePower;
    targetName = tSlot.card.name;
  }

  const events: BattleEvent[] = [];

  // attack_declared
  // v2.0.2 Phase 6b-5: フロントエンドのアタックアニメーション用に
  // attackerSide / targetSide / *InstanceId (character の場合のみ) を追記
  events.push(
    makeEvent('attack_declared', state.turn, attackerSide, {
      attackerSide,
      attackerKind: action.attackerSource.kind,
      attackerInstanceId:
        action.attackerSource.kind === 'character'
          ? action.attackerSource.instanceId
          : undefined,
      attackerName,
      attackPower,
      targetSide: defenderSide,
      targetKind: action.targetSource.kind,
      targetInstanceId:
        action.targetSource.kind === 'character'
          ? action.targetSource.instanceId
          : undefined,
      targetName,
      defensePower,
    }),
  );

  // アタッカーはこの時点でレスト状態 (成功/失敗を問わず)
  let workingState: BattleState = {
    ...state,
    players: { ...state.players, [attackerSide]: restedAttackerState },
  };

  // v2.0.2 Phase 6a: AI 防御側の自動カウンター判定
  // counterCardInstanceId が undefined (= 未指定) の場合に限り、防御側 AI が
  // 切るべきと判断したら decideCounterUse の戻り値を採用する。
  //   - undefined : 未指定 → AI が判断 (人間 vs AI 戦の AI 防御で発動)
  //   - null      : 人間が「切らない」と明示 → AI 判断もスキップ
  //   - string    : 既決 (人間 UI 選択 or 別経路で決定済) → そのまま採用
  let effectiveCounterId: string | null | undefined =
    action.counterCardInstanceId;
  if (effectiveCounterId === undefined) {
    const defenderRaw = workingState.players[defenderSide];
    const defenderIsAI = defenderRaw.isAI === true || defenderRaw.id === 'ai';
    if (defenderIsAI) {
      const aiPick = decideCounterUse(workingState, action, defenderSide);
      if (aiPick) {
        effectiveCounterId = aiPick;
        events.push(
          makeEvent('counter_used', state.turn, defenderSide, {
            decidedBy: 'ai_auto',
            chosenInstanceId: aiPick,
          }),
        );
      }
    }
  }

  // v2.0.2 Phase 4: 防御側のカウンター発動処理
  // effectiveCounterId が指定されたら手札から該当カウンターカードを取り、
  // counterValue を defensePower に加算 → 手札→墓地に移動 → counter_used イベント発火。
  if (effectiveCounterId) {
    const defenderForCounter = workingState.players[defenderSide];
    const counterIdx = defenderForCounter.hand.findIndex(
      (c) => c.instanceId === effectiveCounterId,
    );
    if (counterIdx < 0) {
      return err(
        'card_not_in_hand',
        '指定されたカウンターカードが防御側の手札にありません',
      );
    }
    const counterCard = defenderForCounter.hand[counterIdx];
    if (counterCard.cardType !== 'counter') {
      return err(
        'invalid_target',
        '指定カードはカウンターカードではありません',
      );
    }
    const counterValue = counterCard.counterValue ?? 0;
    defensePower += counterValue;
    const newDefenderHand = [
      ...defenderForCounter.hand.slice(0, counterIdx),
      ...defenderForCounter.hand.slice(counterIdx + 1),
    ];
    const newDefenderForCounter: PlayerState = {
      ...defenderForCounter,
      hand: newDefenderHand,
      graveyard: [...defenderForCounter.graveyard, counterCard],
    };
    workingState = {
      ...workingState,
      players: {
        ...workingState.players,
        [defenderSide]: newDefenderForCounter,
      },
    };
    events.push(
      makeEvent('counter_used', state.turn, defenderSide, {
        cardId: counterCard.cardId,
        instanceId: counterCard.instanceId,
        counterValue,
        addedDefense: counterValue,
        newDefensePower: defensePower,
        mode: 'declared_on_attack',
      }),
    );
  }

  const success = attackPower >= defensePower;

  // [DEBUG] D4.2
  console.log('[applyAttack] power check', {
    attackPower,
    attackPowerType: typeof attackPower,
    defensePower,
    defensePowerType: typeof defensePower,
    comparison: `${attackPower} >= ${defensePower}`,
    success,
  });

  events.push(
    makeEvent('attack_resolved', state.turn, attackerSide, {
      success,
      attackPower,
      defensePower,
    }),
  );

  if (!success) {
    // 攻撃失敗: アタッカーのレストのみ反映して終了
    console.log('[applyAttack] FAILED (attack < defense), no damage applied');
    const finalState = commit(workingState, state.log, events);
    return { ok: true, newState: finalState, events };
  }

  // --- ダメージ処理 ---
  if (action.targetSource.kind === 'leader') {
    // リーダーにヒット (v2.0-launch 勝敗ルール + Phase 2 トリガー)
    //   - シールド 0: リーダー破壊、attacker 勝利 (reason='leader_destroyed')
    //   - シールド > 0:
    //       ライフカードのトリガー効果発動 (あれば)
    //       defense トリガーなら攻撃完全無効化 (シールド消費ゼロ)
    //       それ以外は通常通り 1 枚消費 → 手札へ、leader.life = lifeCards.length 同期
    if (defenderPlayer.lifeCards.length === 0) {
      const winner = attackerSide;
      console.log('[applyAttack] shield 0 + hit → leader destroyed', {
        winner,
        loser: defenderSide,
      });
      const goEvent = makeEvent('game_over', state.turn, attackerSide, {
        winner,
        loser: defenderSide,
        reason: 'leader_destroyed',
      });
      events.push(goEvent);
      const finalState = commit(workingState, state.log, events, {
        winner,
        endedAt: new Date().toISOString(),
      });
      return { ok: true, newState: finalState, events };
    }

    // トリガー発動判定 (シールド消費前に評価)
    const topLife = defenderPlayer.lifeCards[0];
    const triggerResult = applyTriggerEffect(
      workingState,
      topLife.triggerType,
      attackerSide,
      defenderSide,
      topLife,
    );
    let nextState = triggerResult.state;
    events.push(...triggerResult.events);

    if (triggerResult.blocksAttack) {
      // defense: シールド消費ゼロ、完全無効化。手札にも移動しない。
      console.log('[applyAttack] defense trigger blocked the attack', {
        cardId: topLife.cardId,
      });
      const finalState = commit(nextState, state.log, events);
      return { ok: true, newState: finalState, events };
    }

    // シールド消費 → 手札へ (defense 以外、trigger 後の state を起点に)
    const nextDefender = nextState.players[defenderSide];
    console.log('[applyAttack] shield consumed', {
      defenderSide,
      shieldBefore: nextDefender.lifeCards.length,
      shieldAfter: nextDefender.lifeCards.length - 1,
      handLenBefore: nextDefender.hand.length,
      triggerType: topLife.triggerType,
    });
    const restLife = nextDefender.lifeCards.slice(1);
    const newDefender: PlayerState = {
      ...nextDefender,
      lifeCards: restLife,
      leader: {
        ...nextDefender.leader,
        life: restLife.length,
      },
      hand: [...nextDefender.hand, topLife],
    };
    events.push(
      makeEvent('life_damaged', state.turn, attackerSide, {
        defender: defenderSide,
        newLife: newDefender.leader.life,
        cardToHand: topLife.cardId,
        instanceToHand: topLife.instanceId,
      }),
    );
    nextState = {
      ...nextState,
      players: { ...nextState.players, [defenderSide]: newDefender },
    };
    const finalState = commit(nextState, state.log, events);
    return { ok: true, newState: finalState, events };
  } else {
    // キャラ破壊
    const destroyed = defenderPlayer.board[targetCharIdx];
    const newDefender: PlayerState = {
      ...defenderPlayer,
      board: [
        ...defenderPlayer.board.slice(0, targetCharIdx),
        ...defenderPlayer.board.slice(targetCharIdx + 1),
      ],
      graveyard: [...defenderPlayer.graveyard, destroyed.card],
    };
    events.push(
      makeEvent('card_destroyed', state.turn, attackerSide, {
        defender: defenderSide,
        cardId: destroyed.card.cardId,
        instanceId: destroyed.card.instanceId,
      }),
    );
    workingState = {
      ...workingState,
      players: { ...workingState.players, [defenderSide]: newDefender },
    };
    const finalState = commit(workingState, state.log, events);
    return { ok: true, newState: finalState, events };
  }
}

// ---- end_turn --------------------------------------------------------------

/**
 * メインフェイズ終了。
 * main → end → (swap active) → refresh → draw → cost → main まで advancePhase を連続適用。
 * 途中で winner が決まったら中断。
 */
function applyEndTurn(
  state: BattleState,
  action: EndTurnAction,
): ActionResult {
  if (action.player !== state.activePlayer) {
    return err('not_your_turn', 'あなたのターンではありません');
  }
  if (state.phase !== 'main') {
    return err('wrong_phase', 'メインフェイズでのみターン終了できます');
  }

  const originalActive = state.activePlayer;
  const originalLogLen = state.log.length;
  let current: BattleState = state;

  // 最大 20 ステップで停止 (安全弁)
  for (let i = 0; i < 20; i++) {
    current = advancePhase(current);
    if (current.winner) break;
    if (
      current.phase === 'main' &&
      current.activePlayer !== originalActive
    ) {
      break;
    }
  }

  const events = current.log.slice(originalLogLen);
  return { ok: true, newState: current, events };
}

// ---- surrender -------------------------------------------------------------

function applySurrender(
  state: BattleState,
  action: SurrenderAction,
): ActionResult {
  const winner = otherPlayer(action.player);
  const event = makeEvent('game_over', state.turn, action.player, {
    winner,
    loser: action.player,
    reason: 'surrender',
  });
  const newState: BattleState = {
    ...state,
    winner,
    endedAt: new Date().toISOString(),
    log: [...state.log, event],
  };
  return { ok: true, newState, events: [event] };
}

// ---- v2.0.2 Phase 6b-4: 人間カウンター宣言ウィンドウ ---------------------

/**
 * AI 攻撃を applyAction にかける前段の判定。
 * 防御側が人間 (id !== 'ai' かつ isAI !== true) で、手札にカウンター
 * カードがあり、かつ counterCardInstanceId が undefined (= 未指定) の場合のみ
 * `pendingAttack` をセットして applyAction を保留する (UI で人間に選ばせる)。
 *
 * 上記条件を満たさない場合は通常通り applyAction を実行 (透過パススルー)。
 * runAITurn は attack action でこの関数を applyAction の代わりに呼ぶ。
 *
 * 戻り値の newState.pendingAttack が非 null/undefined なら caller (runAITurn)
 * は pause を検知してループを break する。
 */
export function prepareAIAttack(
  state: BattleState,
  action: AttackAction,
): ActionResult {
  if (state.winner) {
    return { ok: false, code: 'game_already_over', reason: 'ゲームは既に終了しています' };
  }

  const defenderSide = otherPlayer(action.player);
  const defender = state.players[defenderSide];
  const defenderIsHuman = !(defender.isAI === true || defender.id === 'ai');
  const hasCounterInHand = defender.hand.some((c) => c.cardType === 'counter');
  const counterUndecided = action.counterCardInstanceId === undefined;

  if (defenderIsHuman && hasCounterInHand && counterUndecided) {
    // 人間の判断待ち: pendingAttack をセット、applyAction はスキップ
    return {
      ok: true,
      newState: { ...state, pendingAttack: action },
      events: [],
    };
  }

  // 即実行 (AI 防御の自動判定 / counter 未所持 / 既決 などすべて applyAction で処理)
  return applyAction(state, action);
}

/**
 * 保留中の AI 攻撃を、人間の選択結果と共に再実行する。
 *
 *   - counterCardInstanceId === string : そのカウンターを切る
 *   - counterCardInstanceId === null   : カウンターしないと明示
 *
 * pendingAttack を null にクリアしてから applyAction で attack 再開。
 */
export function resumeAttackWithCounter(
  state: BattleState,
  counterCardInstanceId: string | null,
): ActionResult {
  const pending = state.pendingAttack;
  if (!pending) {
    return {
      ok: false,
      code: 'internal_error',
      reason: '保留中の攻撃がありません',
    };
  }
  const cleared: BattleState = { ...state, pendingAttack: null };
  const resumedAction: AttackAction = { ...pending, counterCardInstanceId };
  return applyAction(cleared, resumedAction);
}
