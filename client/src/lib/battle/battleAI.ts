// ============================================================================
// battleAI.ts
// TRAIL QUEST WORLD - Battle System v2.0 MVP
// AI 意思決定ロジック (Easy のみ、Normal/Hard は v2.0.1+)
// ============================================================================
//
// Easy AI の方針 (固定ポリシー):
//   1. プレイ可能 (cost <= currentCost) なカードを cost 昇順で 1 枚プレイ
//      場が満杯 (BOARD_MAX_SLOTS) ならプレイスキップ
//   2. canAttackThisTurn=true かつ !isRested のリーダー / キャラでアタック
//      対象は常に相手リーダー (キャラ vs キャラ戦闘はしない)
//   3. 上のどれも不可なら end_turn
//
// 公開 API:
//   - chooseAIAction(state, aiSlot): AIThought
//   - runAITurn(state, aiSlot): { finalState, events }
// ============================================================================

import { applyAction } from './battleActions';
import { BOARD_MAX_SLOTS } from './battleEngine';
import type {
  AIThought,
  AttackAction,
  BattleEvent,
  BattleState,
  EndTurnAction,
  PlayCardAction,
  PlayerSlot,
} from './battleTypes';

const MAX_ACTIONS_PER_TURN = 30;

/**
 * Easy AI: 現 state から次アクションを 1 つ決定。
 * 呼び出し側は state.phase='main' / state.activePlayer === aiSlot を想定。
 */
export function chooseAIAction(
  state: BattleState,
  aiSlot: PlayerSlot,
): AIThought {
  const now = new Date().toISOString();
  const player = state.players[aiSlot];

  // --- 1. プレイ可能カード (cost 昇順) があればプレイ ---
  if (player.board.length < BOARD_MAX_SLOTS) {
    const playable = player.hand
      .filter((c) => c.cost <= player.currentCost)
      .slice()
      .sort((a, b) => a.cost - b.cost);

    if (playable.length > 0) {
      const card = playable[0];
      const action: PlayCardAction = {
        type: 'play_card',
        player: aiSlot,
        timestamp: now,
        cardInstanceId: card.instanceId,
      };
      return {
        chosenAction: action,
        confidence: 0.8,
        reasoning: `play lowest-cost card ${card.cardId} (cost=${card.cost}/${player.currentCost})`,
      };
    }
  }

  // --- 2. アタック可能なリーダー / キャラで相手リーダーへ ---
  if (!player.leader.isRested && player.leader.canAttackThisTurn) {
    const action: AttackAction = {
      type: 'attack',
      player: aiSlot,
      timestamp: now,
      attackerSource: { kind: 'leader' },
      targetSource: { kind: 'leader' },
    };
    return {
      chosenAction: action,
      confidence: 0.6,
      reasoning: 'attack opponent leader with AI leader',
    };
  }

  for (const slot of player.board) {
    if (!slot.isRested && slot.canAttackThisTurn) {
      const action: AttackAction = {
        type: 'attack',
        player: aiSlot,
        timestamp: now,
        attackerSource: {
          kind: 'character',
          instanceId: slot.card.instanceId,
        },
        targetSource: { kind: 'leader' },
      };
      return {
        chosenAction: action,
        confidence: 0.6,
        reasoning: `attack opponent leader with ${slot.card.cardId}`,
      };
    }
  }

  // --- 3. 何もできなければターン終了 ---
  const endAction: EndTurnAction = {
    type: 'end_turn',
    player: aiSlot,
    timestamp: now,
  };
  return {
    chosenAction: endAction,
    confidence: 1.0,
    reasoning: 'no playable cards and no available attackers',
  };
}

/**
 * AI のターンを end_turn が成立するまで連続実行。
 * 停止条件:
 *   - end_turn アクションが成功
 *   - winner 確定
 *   - activePlayer が aiSlot から変わった (end_turn の結果として正常に発生)
 *   - applyAction が !ok を返した (想定外、防御的に即停止)
 *   - MAX_ACTIONS_PER_TURN = 30 を超過 (安全弁)
 */
export function runAITurn(
  state: BattleState,
  aiSlot: PlayerSlot,
): { finalState: BattleState; events: BattleEvent[] } {
  let current = state;
  const events: BattleEvent[] = [];

  for (let i = 0; i < MAX_ACTIONS_PER_TURN; i++) {
    if (current.winner) break;
    if (current.activePlayer !== aiSlot) break;

    const thought = chooseAIAction(current, aiSlot);
    const result = applyAction(current, thought.chosenAction);

    if (!result.ok) {
      // AI が合法でないアクションを出したら即停止 (想定外)
      break;
    }

    current = result.newState;
    events.push(...result.events);

    if (thought.chosenAction.type === 'end_turn') break;
    if (current.winner) break;
    if (current.activePlayer !== aiSlot) break;
  }

  return { finalState: current, events };
}
