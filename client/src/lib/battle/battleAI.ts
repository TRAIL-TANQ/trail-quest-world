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
import {
  advancePhase,
  BOARD_MAX_SLOTS,
  getEffectiveCharAtk,
  getEffectiveLeaderAtk,
  getEffectiveLeaderDef,
} from './battleEngine';
import type {
  AIThought,
  AttackAction,
  BattleEvent,
  BattleState,
  EndTurnAction,
  PlayCardAction,
  PlayerSlot,
} from './battleTypes';

// ---- デバッグ (D3.8 Hotfix 調査用、バグ解決後に false へ) ------------------
const DEBUG_AI = true;
function log(...args: unknown[]): void {
  if (DEBUG_AI && typeof console !== 'undefined') {
    // eslint-disable-next-line no-console
    console.log('[AI]', ...args);
  }
}

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
 * 強制 end_turn フォールバック: AI が進行不能な時に使う最終保険。
 *
 * 手段 1: applyAction(end_turn) を試す (phase=main の通常ケースに対応)
 * 手段 2: それが失敗しても advancePhase を直接回して active player が
 *         変わるまで進行 (phase 不整合でも強制通過できる)
 *
 * これで「AI が stuck で state が進まない」を構造的に排除する。
 */
function forceEndTurn(
  state: BattleState,
  aiSlot: PlayerSlot,
): { state: BattleState; events: BattleEvent[] } {
  log('forceEndTurn attempting', {
    turn: state.turn,
    phase: state.phase,
    active: state.activePlayer,
    winner: state.winner,
  });

  // --- 手段 1: 通常の end_turn アクション ---
  const result = applyAction(state, {
    type: 'end_turn',
    player: aiSlot,
    timestamp: new Date().toISOString(),
  });
  if (result.ok) {
    log('forceEndTurn: applyAction(end_turn) success');
    return { state: result.newState, events: result.events };
  }
  log(
    'forceEndTurn: applyAction(end_turn) failed',
    result.code,
    result.reason,
    '→ trying advancePhase cascade',
  );

  // --- 手段 2: advancePhase を直接回して activePlayer が変わるまで進める ---
  let current = state;
  const logStartLen = current.log.length;
  let guard = 0;
  while (current.activePlayer === aiSlot && !current.winner && guard++ < 30) {
    const advanced = advancePhase(current);
    if (advanced === current) {
      log('forceEndTurn: advancePhase returned same state — truly stuck');
      break;
    }
    current = advanced;
  }
  const events = current.log.slice(logStartLen);
  log('forceEndTurn: advancePhase cascade finished', {
    active: current.activePlayer,
    phase: current.phase,
    winner: current.winner,
    steps: guard,
  });
  return { state: current, events };
}

/**
 * AI のターンを end_turn が成立するまで連続実行。
 *
 * 停止条件:
 *   - end_turn アクションが成功
 *   - winner 確定
 *   - activePlayer が aiSlot から変わった (end_turn の結果として正常に発生)
 *   - applyAction が !ok を返した場合 → 強制 end_turn フォールバックで進行保証
 *   - MAX_ACTIONS_PER_TURN = 30 を超過 (安全弁) → 強制 end_turn フォールバック
 *
 * これにより「AI が stuck して state が進まない」ケースを排除する。
 */
export function runAITurn(
  state: BattleState,
  aiSlot: PlayerSlot,
): { finalState: BattleState; events: BattleEvent[] } {
  let current = state;
  const events: BattleEvent[] = [];

  log('runAITurn START', {
    turn: state.turn,
    active: state.activePlayer,
    phase: state.phase,
    handSize: state.players[aiSlot].hand.length,
    boardSize: state.players[aiSlot].board.length,
    leaderRested: state.players[aiSlot].leader.isRested,
    cost: `${state.players[aiSlot].currentCost}/${state.players[aiSlot].maxCost}`,
  });

  let loopGuardTripped = false;
  for (let i = 0; i < MAX_ACTIONS_PER_TURN; i++) {
    if (current.winner) {
      log(`iter ${i}: winner=${current.winner} → break`);
      break;
    }
    if (current.activePlayer !== aiSlot) {
      log(`iter ${i}: active=${current.activePlayer} (not aiSlot) → break`);
      break;
    }

    const thought = chooseAIAction(current, aiSlot);
    log(`iter ${i}: chose`, thought.chosenAction.type, '—', thought.reasoning);

    const result = applyAction(current, thought.chosenAction);

    if (!result.ok) {
      log(
        `iter ${i}: applyAction FAILED`,
        result.code,
        result.reason,
        '→ force end_turn fallback',
      );
      const forced = forceEndTurn(current, aiSlot);
      current = forced.state;
      events.push(...forced.events);
      break;
    }

    current = result.newState;
    events.push(...result.events);

    if (thought.chosenAction.type === 'end_turn') {
      log(`iter ${i}: end_turn succeeded → break`);
      break;
    }
    if (current.winner) {
      log(`iter ${i}: winner=${current.winner} after action → break`);
      break;
    }
    if (current.activePlayer !== aiSlot) {
      log(`iter ${i}: active changed to ${current.activePlayer} → break`);
      break;
    }

    if (i === MAX_ACTIONS_PER_TURN - 1) {
      loopGuardTripped = true;
    }
  }

  // ループ上限に到達、または break 後も active が AI のままなら強制 end_turn
  if (
    loopGuardTripped ||
    (!current.winner && current.activePlayer === aiSlot)
  ) {
    log(
      'post-loop: still AI active (loopGuard=',
      loopGuardTripped,
      ') → force end_turn',
    );
    const forced = forceEndTurn(current, aiSlot);
    current = forced.state;
    events.push(...forced.events);
  }

  log('runAITurn END', {
    finalActive: current.activePlayer,
    finalTurn: current.turn,
    finalPhase: current.phase,
    winner: current.winner,
    eventsCount: events.length,
  });

  return { finalState: current, events };
}

// ---- v2.0.2 Phase 4: 防御側 AI のカウンター発動判断 ------------------------

/**
 * AI が防御側として、攻撃を受けた時にカウンターカードを切るかを判断する。
 *
 * 発動条件 (Easy AI ポリシー):
 *   1. 自分の手札にカウンターカードがある
 *   2. 攻撃対象が自リーダー (キャラ被弾は無視、ライフ削られないため)
 *   3. 自リーダーのライフが残 2 以下 (危険ライン)
 *   4. counter_value を加算しないと突破される (effAtk >= effDef)、かつ
 *      加算すれば突破を阻止できる (effAtk < effDef + counter_value)
 *
 * 候補が複数ある場合は「必要 counter_value 以上で最小値」のカードを選ぶ
 * (もったいない使いを避ける)。
 *
 * 戻り値: 切るカウンターカードの instanceId、切らないなら null。
 *
 * 注意: AI vs AI 戦は現状なく、人間 vs AI 戦の人間アタッカー時は UI 側
 * (Phase 6) でカウンター宣言モーダルを呼ぶ。本関数は Phase 4 ではテスト
 * 用に export するだけで、attack action 構築には自動組み込みしない。
 */
export function decideCounterUse(
  state: BattleState,
  attackAction: AttackAction,
  defenderSlot: PlayerSlot,
): string | null {
  const defender = state.players[defenderSlot];

  // 1. カウンターカードが手札にあるか
  const counters = defender.hand.filter((c) => c.cardType === 'counter');
  if (counters.length === 0) return null;

  // 2. 攻撃対象がリーダーか
  if (attackAction.targetSource.kind !== 'leader') return null;

  // 3. リーダーライフ残量チェック (lifeCards.length が現在ライフ)
  if (defender.lifeCards.length > 2) return null;

  // 4. attacker 側の effective attack を計算
  const attackerSlot: PlayerSlot = attackAction.player;
  const attacker = state.players[attackerSlot];
  let effAtk: number;
  if (attackAction.attackerSource.kind === 'leader') {
    effAtk = getEffectiveLeaderAtk(attacker);
  } else {
    const attInstanceId = attackAction.attackerSource.instanceId;
    const slotInst = attacker.board.find(
      (s) => s.card.instanceId === attInstanceId,
    );
    if (!slotInst) return null;
    effAtk = getEffectiveCharAtk(attacker, slotInst.card);
  }

  const effDef = getEffectiveLeaderDef(defender);

  // カウンターなしで防げる場合は使う必要なし
  if (effAtk < effDef) return null;

  // 必要な counter_value (effAtk < effDef + cv に持ち込む)
  const needed = effAtk - effDef + 1;
  if (needed <= 0) return null;

  // 必要 counter_value 以上で最小値の候補を選ぶ
  const candidates = counters
    .filter((c) => (c.counterValue ?? 0) >= needed)
    .sort((a, b) => (a.counterValue ?? 0) - (b.counterValue ?? 0));

  return candidates[0]?.instanceId ?? null;
}
