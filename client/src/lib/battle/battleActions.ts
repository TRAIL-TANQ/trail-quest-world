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

import {
  BOARD_MAX_SLOTS,
  advancePhase,
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
  PlayCardAction,
  PlayerSlot,
  PlayerState,
  SurrenderAction,
  TriggerType,
} from './battleTypes';

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
  if (p.board.length >= BOARD_MAX_SLOTS) {
    return err('board_full', `場はすでに ${BOARD_MAX_SLOTS} 体埋まっています`);
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
    // リーダーはサモニング病なし
    attackPower = attackerPlayer.leader.attackPower;
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
    attackPower = slot.card.attackPower;
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
    defensePower = defenderPlayer.leader.defensePower;
    targetName = defenderPlayer.leader.name;
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
  events.push(
    makeEvent('attack_declared', state.turn, attackerSide, {
      attackerKind: action.attackerSource.kind,
      attackerName,
      attackPower,
      targetKind: action.targetSource.kind,
      targetName,
      defensePower,
    }),
  );

  // アタッカーはこの時点でレスト状態 (成功/失敗を問わず)
  let workingState: BattleState = {
    ...state,
    players: { ...state.players, [attackerSide]: restedAttackerState },
  };

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
