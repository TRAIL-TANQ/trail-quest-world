// ============================================================================
// battleAI.test.ts
// TRAIL QUEST WORLD - Battle System v2.0 MVP
// Vitest: Easy AI の 5 シナリオ
// ============================================================================

import { describe, expect, it } from 'vitest';

import { chooseAIAction, runAITurn } from '../battleAI';
import { leaderRowToState } from '../battleEngine';
import type {
  BattleCardInstance,
  BattleColor,
  BattleLeaderRow,
  BattleState,
  PlayerState,
} from '../battleTypes';

// ============================================================================
// テスト用ヘルパー (battleEngine.test.ts と同仕様の複製)
// 将来、複数 test が共通で使うようになったら __tests__/_helpers.ts に切り出す。
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
// シナリオ 1: playable card あり → play_card を選ぶ
// ============================================================================

describe('battleAI.chooseAIAction (play priority)', () => {
  it('1. プレイ可能カード (cost <= currentCost) があれば play_card を返す', () => {
    const leader = makeLeader('l_ai');
    const card = makeCard('c_cheap', { cost: 1 });
    const state = makeState({
      activePlayer: 'p2',
      phase: 'main',
      players: {
        p1: makeEmptyPlayer('u1', leader),
        p2: makeEmptyPlayer('ai', leader, {
          hand: [card],
          currentCost: 2,
          maxCost: 2,
        }),
      },
    });

    const thought = chooseAIAction(state, 'p2');
    expect(thought.chosenAction.type).toBe('play_card');
    if (thought.chosenAction.type === 'play_card') {
      expect(thought.chosenAction.cardInstanceId).toBe(card.instanceId);
      expect(thought.chosenAction.player).toBe('p2');
    }
  });
});

// ============================================================================
// シナリオ 2: cost 低い順にプレイする (hand 1/3/5 → cost 1 を選ぶ)
// ============================================================================

describe('battleAI.chooseAIAction (cost ordering)', () => {
  it('2. hand に cost 5/3/1 がある時、cost 1 のカードを選ぶ', () => {
    const leader = makeLeader('l_ai');
    const c1 = makeCard('card_1', { cost: 1 });
    const c3 = makeCard('card_3', { cost: 3 });
    const c5 = makeCard('card_5', { cost: 5 });
    const state = makeState({
      activePlayer: 'p2',
      phase: 'main',
      players: {
        p1: makeEmptyPlayer('u1', leader),
        p2: makeEmptyPlayer('ai', leader, {
          // hand の並び順は意図的にバラバラ
          hand: [c5, c3, c1],
          currentCost: 5,
          maxCost: 5,
        }),
      },
    });

    const thought = chooseAIAction(state, 'p2');
    expect(thought.chosenAction.type).toBe('play_card');
    if (thought.chosenAction.type === 'play_card') {
      expect(thought.chosenAction.cardInstanceId).toBe(c1.instanceId);
    }
  });
});

// ============================================================================
// シナリオ 3: プレイ不可だがアタック可能 → attack (target=leader)
// ============================================================================

describe('battleAI.chooseAIAction (attack fallback)', () => {
  it('3. コスト不足で手札がプレイ不可 → 相手リーダーへの attack を選ぶ', () => {
    const leader = makeLeader('l_ai');
    const c5 = makeCard('card_5', { cost: 5 });
    const state = makeState({
      activePlayer: 'p2',
      phase: 'main',
      players: {
        p1: makeEmptyPlayer('u1', leader),
        p2: makeEmptyPlayer('ai', leader, {
          hand: [c5],
          currentCost: 2, // cost 5 を払えない
          maxCost: 2,
          // leader は isRested=false デフォルトなのでアタック可能
        }),
      },
    });

    const thought = chooseAIAction(state, 'p2');
    expect(thought.chosenAction.type).toBe('attack');
    if (thought.chosenAction.type === 'attack') {
      expect(thought.chosenAction.attackerSource.kind).toBe('leader');
      expect(thought.chosenAction.targetSource.kind).toBe('leader');
    }
  });
});

// ============================================================================
// シナリオ 4: プレイもアタックもできない → end_turn
// ============================================================================

describe('battleAI.chooseAIAction (end turn)', () => {
  it('4. プレイ不可 + 全アタッカーがレスト / 召喚酔い → end_turn を選ぶ', () => {
    const leaderRow = makeLeader('l_ai');
    const unplayable = makeCard('card_5', { cost: 5 });
    const sickCharCard = makeCard('sick_char', { cost: 1 });
    const state = makeState({
      activePlayer: 'p2',
      phase: 'main',
      players: {
        p1: makeEmptyPlayer('u1', leaderRow),
        p2: makeEmptyPlayer('ai', leaderRow, {
          hand: [unplayable],
          currentCost: 2,
          maxCost: 2,
          // leader をレスト状態に上書き
          leader: { ...leaderRowToState(leaderRow), isRested: true },
          // 場のキャラは召喚酔い中でアタック不可
          board: [
            {
              card: sickCharCard,
              isRested: false,
              canAttackThisTurn: false,
              playedTurn: 1,
            },
          ],
        }),
      },
    });

    const thought = chooseAIAction(state, 'p2');
    expect(thought.chosenAction.type).toBe('end_turn');
    if (thought.chosenAction.type === 'end_turn') {
      expect(thought.chosenAction.player).toBe('p2');
    }
  });
});

// ============================================================================
// シナリオ 5: runAITurn で 1 ターン連鎖、activePlayer が p1 へ切り替わる
// ============================================================================

describe('battleAI.runAITurn (full turn loop)', () => {
  it('5. runAITurn: play_card → attack → end_turn 連鎖、最終 state で activePlayer=p1', () => {
    const p1Leader = makeLeader('l_p1');
    const p2Leader = makeLeader('l_p2');
    const cheapCard = makeCard('cheap', { cost: 1 });

    const state = makeState({
      turn: 2,
      activePlayer: 'p2',
      phase: 'main',
      players: {
        p1: makeEmptyPlayer('u1', p1Leader, {
          // p1 がライフ減でも耐えるだけのライフカードを用意
          lifeCards: [
            makeCard('p1_life1'),
            makeCard('p1_life2'),
            makeCard('p1_life3'),
          ],
          // end_turn で p1 がドローするためデッキ 2 枚以上必要
          deck: [makeCard('p1_deck1'), makeCard('p1_deck2')],
        }),
        p2: makeEmptyPlayer('ai', p2Leader, {
          hand: [cheapCard],
          currentCost: 2,
          maxCost: 2,
          deck: [
            makeCard('p2_deck1'),
            makeCard('p2_deck2'),
            makeCard('p2_deck3'),
          ],
        }),
      },
    });

    const { finalState, events } = runAITurn(state, 'p2');

    // activePlayer が p1 に切替わっていること = end_turn が完走した証拠
    expect(finalState.activePlayer).toBe('p1');
    expect(finalState.winner).toBeNull();

    const eventTypes = events.map((e) => e.type);
    // AI がプレイ→アタック→ターン終了 を経たイベント痕跡
    expect(eventTypes).toContain('play_card');
    expect(eventTypes).toContain('attack_declared');
    expect(eventTypes).toContain('attack_resolved');
    expect(eventTypes).toContain('turn_end');

    // p2 のハンドは空 (1枚をプレイ済)
    expect(finalState.players.p2.hand).toHaveLength(0);
    // p2 のボードに 1 体 (プレイしたキャラ)
    expect(finalState.players.p2.board).toHaveLength(1);
    // リーダーはアタックしたためレスト
    expect(finalState.players.p2.leader.isRested).toBe(true);
    // p1 はリーダー攻撃で life 1 減、ライフカード 1 枚が手札へ。
    // さらに end_turn で p1 の新ターンに入り、draw フェーズで 1 枚引くため hand は計 2。
    expect(finalState.players.p1.leader.life).toBe(2);
    expect(finalState.players.p1.lifeCards).toHaveLength(2);
    expect(finalState.players.p1.hand).toHaveLength(2);
    // p1 のデッキは 2 → 1 に
    expect(finalState.players.p1.deck).toHaveLength(1);
  });
});
