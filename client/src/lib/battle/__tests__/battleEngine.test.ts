// ============================================================================
// battleEngine.test.ts
// TRAIL QUEST WORLD - Battle System v2.0 MVP
// Vitest: 指示書 05_PHASE_A_IMPLEMENTATION.md 準拠の 7 シナリオ
// ============================================================================

import { describe, expect, it } from 'vitest';

import { applyAction } from '../battleActions';
import {
  advancePhase,
  createInitialState,
  drawCard,
  leaderRowToState,
} from '../battleEngine';
import type {
  AttackAction,
  BattleCardInstance,
  BattleColor,
  BattleLeaderRow,
  BattleState,
  PlayCardAction,
  PlayerState,
} from '../battleTypes';

// ============================================================================
// テスト用ヘルパー
// ============================================================================

function makeCard(
  cardId: string,
  opts: Partial<{
    name: string;
    cost: number;
    attackPower: number;
    defensePower: number;
    color: BattleColor;
    instanceId: string;
  }> = {},
): BattleCardInstance {
  return {
    instanceId: opts.instanceId ?? `inst_${cardId}`,
    cardId,
    name: opts.name ?? `Card ${cardId}`,
    cost: opts.cost ?? 1,
    power: 1000,
    attackPower: opts.attackPower ?? 5,
    defensePower: opts.defensePower ?? 5,
    color: opts.color ?? 'red',
    cardType: 'character',
    effectText: null,
  };
}

function makeLeader(
  id: string,
  opts: Partial<{
    name: string;
    color: BattleColor;
    life: number;
    attackPower: number;
    defensePower: number;
  }> = {},
): BattleLeaderRow {
  return {
    id,
    name: opts.name ?? `Leader ${id}`,
    color: opts.color ?? 'red',
    life: opts.life ?? 3,
    power: 5000,
    attack_power: opts.attackPower ?? 5,
    defense_power: opts.defensePower ?? 5,
    description: null,
    image_url: null,
    effect_text: null,
    created_at: '2026-04-24T00:00:00Z',
  };
}

/**
 * 決定的な 30 枚デッキを生成。cost/atk/def は index ベースで分散。
 */
function makeDeck(size: number, color: BattleColor = 'red'): BattleCardInstance[] {
  return Array.from({ length: size }, (_, i) =>
    makeCard(`c${i}`, {
      instanceId: `inst_c${i}`,
      name: `Card ${i}`,
      cost: Math.min((i % 10) + 1, 10),
      attackPower: ((i % 12) + 1) as number,
      defensePower: ((i % 12) + 1) as number,
      color,
    }),
  );
}

/**
 * カスタム state を最小の定型コードで構築。
 */
function makeEmptyPlayer(
  id: string,
  leader: BattleLeaderRow,
  overrides: Partial<PlayerState> = {},
): PlayerState {
  return {
    id,
    leader: leaderRowToState(leader),
    hand: [],
    deck: [],
    lifeCards: [],
    board: [],
    graveyard: [],
    currentCost: 0,
    maxCost: 0,
    hasDrawnThisTurn: false,
    ...overrides,
  };
}

function makeState(overrides: Partial<BattleState> = {}): BattleState {
  const leader = makeLeader('l_default');
  return {
    sessionId: 's_test',
    turn: 1,
    activePlayer: 'p1',
    phase: 'main',
    players: {
      p1: makeEmptyPlayer('u1', leader),
      p2: makeEmptyPlayer('ai', leader),
    },
    log: [],
    winner: null,
    startedAt: '2026-04-24T00:00:00Z',
    endedAt: null,
    ...overrides,
  };
}

// ============================================================================
// シナリオ 1: 初期 state 生成
// ============================================================================

describe('battleEngine.createInitialState', () => {
  it('正しい初期値 (turn=1, phase=refresh, life=3, hand=5, lifeCards=3, deck=22) を返す', () => {
    const leader = makeLeader('l1', { life: 3 });
    const state = createInitialState(
      'session_1',
      'p1_user',
      leader,
      makeDeck(30),
      leader,
      makeDeck(30),
      'easy',
      { shuffle: false },
    );

    expect(state.sessionId).toBe('session_1');
    expect(state.turn).toBe(1);
    expect(state.phase).toBe('refresh');
    expect(state.activePlayer).toBe('p1');
    expect(state.winner).toBeNull();

    // p1: 手札 5 / ライフ 3 / デッキ 22 (= 30 - 3 - 5)
    expect(state.players.p1.leader.life).toBe(3);
    expect(state.players.p1.leader.attackPower).toBe(5);
    expect(state.players.p1.leader.defensePower).toBe(5);
    expect(state.players.p1.hand).toHaveLength(5);
    expect(state.players.p1.lifeCards).toHaveLength(3);
    expect(state.players.p1.deck).toHaveLength(22);
    expect(state.players.p1.board).toHaveLength(0);
    expect(state.players.p1.currentCost).toBe(0);

    // p2: AI, 同じ構造
    expect(state.players.p2.id).toBe('ai');
    expect(state.players.p2.hand).toHaveLength(5);
    expect(state.players.p2.lifeCards).toHaveLength(3);
    expect(state.players.p2.deck).toHaveLength(22);

    // game_start イベントが log 先頭にある
    expect(state.log[0]?.type).toBe('game_start');
  });
});

// ============================================================================
// シナリオ 2: ドローフェイズで 1 枚減る
// ============================================================================

describe('battleEngine.advancePhase (draw)', () => {
  it('refresh → draw → cost と進むと deck が 1 枚減り hand が 1 枚増える', () => {
    const leader = makeLeader('l1');
    const initial = createInitialState(
      'session_1',
      'p1_user',
      leader,
      makeDeck(30),
      leader,
      makeDeck(30),
      'easy',
      { shuffle: false },
    );
    // refresh → draw (refresh 処理が走り、phase='draw' になる。カード未ドロー)
    const afterRefresh = advancePhase(initial);
    expect(afterRefresh.phase).toBe('draw');
    expect(afterRefresh.players.p1.deck).toHaveLength(22); // まだ引いてない

    // draw → cost (ドロー処理が走り、phase='cost' になる)
    const afterDraw = advancePhase(afterRefresh);
    expect(afterDraw.phase).toBe('cost');
    expect(afterDraw.players.p1.deck).toHaveLength(21); // 22 - 1
    expect(afterDraw.players.p1.hand).toHaveLength(6); // 5 + 1
    expect(afterDraw.players.p1.hasDrawnThisTurn).toBe(true);
  });
});

// ============================================================================
// シナリオ 3: 場にキャラを出すとコストが減る
// ============================================================================

describe('battleActions.applyAction (play_card)', () => {
  it('currentCost=3 の状態で cost=2 のカードをプレイすると currentCost=1 になる', () => {
    const leader = makeLeader('l1');
    const card = makeCard('c_hand', { cost: 2 });
    const state = makeState({
      turn: 3,
      phase: 'main',
      players: {
        p1: makeEmptyPlayer('u1', leader, {
          hand: [card],
          currentCost: 3,
          maxCost: 3,
          hasDrawnThisTurn: true,
        }),
        p2: makeEmptyPlayer('ai', leader),
      },
    });

    const action: PlayCardAction = {
      type: 'play_card',
      player: 'p1',
      timestamp: '2026-04-24T00:00:00Z',
      cardInstanceId: card.instanceId,
    };

    const result = applyAction(state, action);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.newState.players.p1.currentCost).toBe(1); // 3 - 2
      expect(result.newState.players.p1.board).toHaveLength(1);
      expect(result.newState.players.p1.board[0].card.cardId).toBe('c_hand');
      expect(result.newState.players.p1.board[0].canAttackThisTurn).toBe(false); // 召喚酔い
      expect(result.newState.players.p1.hand).toHaveLength(0);
    }
  });
});

// ============================================================================
// シナリオ 4: サモニング病中は攻撃不可
// ============================================================================

describe('battleActions.applyAction (attack summoning sickness)', () => {
  it('play_card 直後 (canAttackThisTurn=false) のキャラは attack 宣言でエラー', () => {
    const leader = makeLeader('l1');
    const card = makeCard('c_summoning', { cost: 1, attackPower: 5 });
    const state = makeState({
      turn: 1,
      phase: 'main',
      players: {
        p1: makeEmptyPlayer('u1', leader, {
          board: [
            {
              card,
              isRested: false,
              canAttackThisTurn: false, // 召喚酔い
              playedTurn: 1,
            },
          ],
          hasDrawnThisTurn: true,
        }),
        p2: makeEmptyPlayer('ai', leader),
      },
    });

    const action: AttackAction = {
      type: 'attack',
      player: 'p1',
      timestamp: '2026-04-24T00:00:00Z',
      attackerSource: { kind: 'character', instanceId: card.instanceId },
      targetSource: { kind: 'leader' },
    };

    const result = applyAction(state, action);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('summoning_sickness');
    }
  });
});

// ============================================================================
// シナリオ 5: リーダーへのアタック → ライフ減少 + ライフカード手札移動
// ============================================================================

describe('battleActions.applyAction (attack leader)', () => {
  it('attackPower >= defensePower なら defender のライフが 1 減り、ライフカードが手札へ', () => {
    const p1Leader = makeLeader('l_p1', { attackPower: 5 });
    const p2Leader = makeLeader('l_p2', { life: 3, defensePower: 3 });
    const attacker = makeCard('c_attacker', { attackPower: 5 });
    const lifeCard1 = makeCard('life_top');
    const lifeCard2 = makeCard('life_mid');
    const lifeCard3 = makeCard('life_bot');

    const state = makeState({
      turn: 2,
      phase: 'main',
      players: {
        p1: makeEmptyPlayer('u1', p1Leader, {
          board: [
            {
              card: attacker,
              isRested: false,
              canAttackThisTurn: true, // 攻撃可能
              playedTurn: 1,
            },
          ],
          hasDrawnThisTurn: true,
        }),
        p2: makeEmptyPlayer('ai', p2Leader, {
          lifeCards: [lifeCard1, lifeCard2, lifeCard3],
        }),
      },
    });

    const action: AttackAction = {
      type: 'attack',
      player: 'p1',
      timestamp: '2026-04-24T00:00:00Z',
      attackerSource: { kind: 'character', instanceId: attacker.instanceId },
      targetSource: { kind: 'leader' },
    };

    const result = applyAction(state, action);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.newState.players.p2.leader.life).toBe(2); // 3 - 1
      expect(result.newState.players.p2.lifeCards).toHaveLength(2);
      expect(result.newState.players.p2.hand).toHaveLength(1);
      expect(result.newState.players.p2.hand[0].cardId).toBe('life_top'); // top から移動
      expect(result.newState.players.p1.board[0].isRested).toBe(true); // アタッカーはレスト
      expect(result.newState.winner).toBeNull(); // まだ game_over ではない
      expect(result.events.some((e) => e.type === 'life_damaged')).toBe(true);
    }
  });
});

// ============================================================================
// シナリオ 6: ライフ 0 + 被ダメージ → game_over
// ============================================================================

describe('battleActions.applyAction (attack when life is 0)', () => {
  it('ライフ 0 (lifeCards 空) の状態で更にリーダーにヒット → winner が確定', () => {
    const p1Leader = makeLeader('l_p1', { attackPower: 5 });
    const p2Leader = makeLeader('l_p2', { life: 0, defensePower: 3 });
    const attacker = makeCard('c_final', { attackPower: 5 });

    const state = makeState({
      turn: 5,
      phase: 'main',
      players: {
        p1: makeEmptyPlayer('u1', p1Leader, {
          board: [
            {
              card: attacker,
              isRested: false,
              canAttackThisTurn: true,
              playedTurn: 4,
            },
          ],
          hasDrawnThisTurn: true,
        }),
        p2: makeEmptyPlayer('ai', p2Leader, {
          // 手動で life=0 に上書き
          leader: { ...leaderRowToState(p2Leader), life: 0 },
          lifeCards: [],
        }),
      },
    });

    const action: AttackAction = {
      type: 'attack',
      player: 'p1',
      timestamp: '2026-04-24T00:00:00Z',
      attackerSource: { kind: 'character', instanceId: attacker.instanceId },
      targetSource: { kind: 'leader' },
    };

    const result = applyAction(state, action);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.newState.winner).toBe('p1');
      expect(result.newState.endedAt).not.toBeNull();
      expect(result.events.some((e) => e.type === 'game_over')).toBe(true);
    }
  });
});

// ============================================================================
// シナリオ 7: デッキ切れ → game_over (ドロー試行時)
// ============================================================================

describe('battleEngine.drawCard (deck out)', () => {
  it('空デッキに対する drawCard は相手を winner に設定する', () => {
    const leader = makeLeader('l1');
    const state = makeState({
      players: {
        p1: makeEmptyPlayer('u1', leader, { deck: [] }),
        p2: makeEmptyPlayer('ai', leader, { deck: [makeCard('x')] }),
      },
    });

    const result = drawCard(state, 'p1', 1);
    expect(result.winner).toBe('p2');
    expect(result.endedAt).not.toBeNull();
    expect(
      result.log.some(
        (e) => e.type === 'game_over' && e.payload.reason === 'deck_out',
      ),
    ).toBe(true);
  });
});
