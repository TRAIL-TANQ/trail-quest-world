// ============================================================================
// battleEvent.test.ts
// TRAIL QUEST WORLD - Battle System v2.0.2 (Phase 5 イベントカード15種)
// 7 シナリオ:
//   1. プレイ成功 + 効果適用 + 墓地遷移 + コスト消費 (heal_life)
//   2. destroy_enemy_char で敵 board の先頭スロットを破壊
//   3. both_draw_self_extra で両者の手札枚数が正確に増える
//   4. opponent_cant_play_chars でフラグが立ち、相手のキャラプレイがブロックされる
//   5. destroy_low_cost_chars で両者の cost <= max_cost のキャラのみ破壊
//   6. buff_leader_def with until_next_opponent_turn_end は 2 ラウンド跨ぎで生存
//   7. debuff_all_enemies_atk で相手キャラの effective atk が下がる
// ============================================================================

import { describe, expect, it } from 'vitest';

import { applyAction } from '../battleActions';
import {
  expireTempBuffs,
  getEffectiveCharAtk,
  getEffectiveLeaderDef,
  leaderRowToState,
} from '../battleEngine';
import type {
  BattleCardInstance,
  BattleColor,
  BattleLeaderRow,
  BattleState,
  EventEffectType,
  PlayCardAction,
  PlayerState,
} from '../battleTypes';

// ============================================================================
// ヘルパー
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
    triggerType: BattleCardInstance['triggerType'];
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
    triggerType: opts.triggerType ?? null,
    counterValue: 0,
  };
}

function makeEvent(
  cardId: string,
  opts: Partial<{
    name: string;
    cost: number;
    color: BattleColor;
    instanceId: string;
    eventEffectType: EventEffectType | string;
    eventEffectData: Record<string, unknown>;
  }> = {},
): BattleCardInstance {
  return {
    instanceId: opts.instanceId ?? `inst_${cardId}`,
    cardId,
    name: opts.name ?? `Event ${cardId}`,
    cost: opts.cost ?? 2,
    power: 0,
    attackPower: 0,
    defensePower: 0,
    color: opts.color ?? 'red',
    cardType: 'event',
    effectText: null,
    triggerType: null,
    counterValue: 0,
    eventEffectType: opts.eventEffectType ?? 'draw',
    eventEffectData: opts.eventEffectData ?? {},
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
    currentCost: 5,
    maxCost: 5,
    hasDrawnThisTurn: false,
    equippedCard: null,
    equipmentBonusAtk: 0,
    equipmentBonusDef: 0,
    equipmentBonusAllyAtk: 0,
    maxHandSize: 99,
    tempBuffs: [],
    cantPlayCharsThisTurn: false,
    equipmentOnceUsed: false,
    ...overrides,
  };
}

function makeState(
  p1: PlayerState,
  p2: PlayerState,
  overrides: Partial<BattleState> = {},
): BattleState {
  return {
    sessionId: 's_test',
    turn: 2,
    firstPlayer: 'p1',
    activePlayer: 'p1',
    phase: 'main',
    players: { p1, p2 },
    log: [],
    winner: null,
    startedAt: '2026-04-24T00:00:00Z',
    endedAt: null,
    ...overrides,
  };
}

// ============================================================================
// テスト
// ============================================================================

describe('event cards (Phase 5)', () => {
  it('plays event card, applies heal_life, moves to graveyard, consumes cost', () => {
    const p1Leader = makeLeader('l_p1');
    const p2Leader = makeLeader('l_p2');
    const event = makeEvent('ev_jeanne_oracle', {
      cost: 2,
      eventEffectType: 'heal_life',
      eventEffectData: { life_bonus: 1 },
    });
    const deckTop = makeCard('c_deck_top');
    const state = makeState(
      makeEmptyPlayer('u1', p1Leader, {
        hand: [event],
        deck: [deckTop],
        lifeCards: [makeCard('l_existing')],
        currentCost: 5,
      }),
      makeEmptyPlayer('ai', p2Leader),
    );

    const action: PlayCardAction = {
      type: 'play_card',
      player: 'p1',
      cardInstanceId: event.instanceId,
      timestamp: '2026-04-24T00:00:00Z',
    };
    const result = applyAction(state, action);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const p1 = result.newState.players.p1;
    // 効果: deck top → lifeCards 末尾
    expect(p1.deck).toHaveLength(0);
    expect(p1.lifeCards.map((c) => c.cardId)).toEqual([
      'l_existing',
      'c_deck_top',
    ]);
    // コスト消費
    expect(p1.currentCost).toBe(3); // 5 - 2
    // 墓地末尾にイベントカード
    expect(p1.graveyard.map((c) => c.cardId)).toEqual(['ev_jeanne_oracle']);
    // event_played イベント発火
    expect(result.events.some((e) => e.type === 'event_played')).toBe(true);
  });

  it('destroy_enemy_char destroys opponent board head slot', () => {
    const p1Leader = makeLeader('l_p1');
    const p2Leader = makeLeader('l_p2');
    const target = makeCard('c_target', { instanceId: 'inst_target' });
    const survivor = makeCard('c_survivor', { instanceId: 'inst_survivor' });
    const event = makeEvent('ev_honnoji', {
      eventEffectType: 'destroy_enemy_char',
    });
    const state = makeState(
      makeEmptyPlayer('u1', p1Leader, { hand: [event], currentCost: 5 }),
      makeEmptyPlayer('ai', p2Leader, {
        board: [
          { card: target, isRested: false, canAttackThisTurn: true, playedTurn: 1 },
          { card: survivor, isRested: false, canAttackThisTurn: true, playedTurn: 1 },
        ],
      }),
    );

    const result = applyAction(state, {
      type: 'play_card',
      player: 'p1',
      cardInstanceId: event.instanceId,
      timestamp: '2026-04-24T00:00:00Z',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const p2 = result.newState.players.p2;
    expect(p2.board.map((s) => s.card.cardId)).toEqual(['c_survivor']);
    expect(p2.graveyard.map((c) => c.cardId)).toEqual(['c_target']);
  });

  it('both_draw_self_extra draws correct amounts for both players', () => {
    const p1Leader = makeLeader('l_p1');
    const p2Leader = makeLeader('l_p2');
    const event = makeEvent('ev_renaissance', {
      eventEffectType: 'both_draw_self_extra',
      eventEffectData: { both_count: 2, self_extra: 1 },
    });
    // 自分のデッキは 2 + 1 = 3 枚必要、相手は 2 枚必要
    const p1Deck = [
      makeCard('p1_d1'), makeCard('p1_d2'), makeCard('p1_d3'),
      makeCard('p1_d4'), makeCard('p1_d5'),
    ];
    const p2Deck = [makeCard('p2_d1'), makeCard('p2_d2'), makeCard('p2_d3')];
    const state = makeState(
      makeEmptyPlayer('u1', p1Leader, {
        hand: [event],
        deck: p1Deck,
        currentCost: 5,
      }),
      makeEmptyPlayer('ai', p2Leader, { deck: p2Deck }),
    );

    const result = applyAction(state, {
      type: 'play_card',
      player: 'p1',
      cardInstanceId: event.instanceId,
      timestamp: '2026-04-24T00:00:00Z',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const p1 = result.newState.players.p1;
    const p2 = result.newState.players.p2;
    // p1 は both 2 + extra 1 = 3 枚ドロー
    expect(p1.hand.map((c) => c.cardId)).toEqual([
      'p1_d1', 'p1_d2', 'p1_d3',
    ]);
    expect(p1.deck.map((c) => c.cardId)).toEqual(['p1_d4', 'p1_d5']);
    // p2 は both 2 枚のみドロー
    expect(p2.hand.map((c) => c.cardId)).toEqual(['p2_d1', 'p2_d2']);
    expect(p2.deck.map((c) => c.cardId)).toEqual(['p2_d3']);
  });

  it('opponent_cant_play_chars sets flag, blocks character play', () => {
    const p1Leader = makeLeader('l_p1');
    const p2Leader = makeLeader('l_p2');
    const event = makeEvent('ev_lunar_eclipse', {
      eventEffectType: 'opponent_cant_play_chars',
    });
    const charForP2 = makeCard('c_p2_char', {
      instanceId: 'inst_p2_char',
      cost: 1,
    });
    const state = makeState(
      makeEmptyPlayer('u1', p1Leader, { hand: [event], currentCost: 5 }),
      makeEmptyPlayer('ai', p2Leader, {
        hand: [charForP2],
        currentCost: 5,
      }),
    );

    // p1 が ev_lunar_eclipse をプレイ
    const eventResult = applyAction(state, {
      type: 'play_card',
      player: 'p1',
      cardInstanceId: event.instanceId,
      timestamp: '2026-04-24T00:00:00Z',
    });
    expect(eventResult.ok).toBe(true);
    if (!eventResult.ok) return;
    expect(eventResult.newState.players.p2.cantPlayCharsThisTurn).toBe(true);

    // p2 が active になった想定で character プレイを試みる
    const p2Active: BattleState = {
      ...eventResult.newState,
      activePlayer: 'p2',
    };
    const playResult = applyAction(p2Active, {
      type: 'play_card',
      player: 'p2',
      cardInstanceId: charForP2.instanceId,
      timestamp: '2026-04-24T00:00:00Z',
    });
    expect(playResult.ok).toBe(false);
    if (playResult.ok) return;
    expect(playResult.code).toBe('wrong_phase');
    expect(playResult.reason).toContain('キャラを出せません');
  });

  it('destroy_low_cost_chars destroys both sides cost <= max_cost', () => {
    const p1Leader = makeLeader('l_p1');
    const p2Leader = makeLeader('l_p2');
    const event = makeEvent('ev_earthquake_global', {
      eventEffectType: 'destroy_low_cost_chars',
      eventEffectData: { max_cost: 3 },
    });
    const myLow = makeCard('c_my_low', { instanceId: 'inst_my_low', cost: 2 });
    const myHigh = makeCard('c_my_high', { instanceId: 'inst_my_high', cost: 5 });
    const enemyLow1 = makeCard('c_enemy_low1', { instanceId: 'inst_e1', cost: 1 });
    const enemyLow2 = makeCard('c_enemy_low2', { instanceId: 'inst_e2', cost: 3 });
    const enemyHigh = makeCard('c_enemy_high', { instanceId: 'inst_eh', cost: 6 });

    const state = makeState(
      makeEmptyPlayer('u1', p1Leader, {
        hand: [event],
        currentCost: 5,
        board: [
          { card: myLow, isRested: false, canAttackThisTurn: true, playedTurn: 1 },
          { card: myHigh, isRested: false, canAttackThisTurn: true, playedTurn: 1 },
        ],
      }),
      makeEmptyPlayer('ai', p2Leader, {
        board: [
          { card: enemyLow1, isRested: false, canAttackThisTurn: true, playedTurn: 1 },
          { card: enemyLow2, isRested: false, canAttackThisTurn: true, playedTurn: 1 },
          { card: enemyHigh, isRested: false, canAttackThisTurn: true, playedTurn: 1 },
        ],
      }),
    );

    const result = applyAction(state, {
      type: 'play_card',
      player: 'p1',
      cardInstanceId: event.instanceId,
      timestamp: '2026-04-24T00:00:00Z',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const p1 = result.newState.players.p1;
    const p2 = result.newState.players.p2;
    expect(p1.board.map((s) => s.card.cardId)).toEqual(['c_my_high']);
    // 効果で c_my_low が墓地、その後 applyPlayEvent が ev_earthquake_global 自身も墓地末尾へ
    expect(p1.graveyard.map((c) => c.cardId)).toEqual([
      'c_my_low',
      'ev_earthquake_global',
    ]);
    expect(p2.board.map((s) => s.card.cardId)).toEqual(['c_enemy_high']);
    expect(p2.graveyard.map((c) => c.cardId)).toEqual([
      'c_enemy_low1',
      'c_enemy_low2',
    ]);
  });

  it('buff_leader_def with until_next_opponent_turn_end persists across opponent turn', () => {
    const p1Leader = makeLeader('l_p1', { defensePower: 5 });
    const p2Leader = makeLeader('l_p2');
    const event = makeEvent('ev_great_wall_build', {
      eventEffectType: 'buff_leader_def',
      eventEffectData: { def_bonus: 3, duration: 'until_next_opponent_turn_end' },
    });
    const state = makeState(
      makeEmptyPlayer('u1', p1Leader, { hand: [event], currentCost: 5 }),
      makeEmptyPlayer('ai', p2Leader),
      { turn: 3 },
    );

    const result = applyAction(state, {
      type: 'play_card',
      player: 'p1',
      cardInstanceId: event.instanceId,
      timestamp: '2026-04-24T00:00:00Z',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // 発動直後 (turn 3): defensePower 5 + 3 = 8
    const p1AfterPlay = result.newState.players.p1;
    expect(getEffectiveLeaderDef(p1AfterPlay)).toBe(8);

    // turn 4 経過: createdTurn=3, currentTurn=4 → 残る
    const p1Turn4 = expireTempBuffs(p1AfterPlay, 4);
    expect(p1Turn4.tempBuffs).toHaveLength(1);
    expect(getEffectiveLeaderDef(p1Turn4)).toBe(8);

    // turn 5 経過: createdTurn=3, currentTurn=5 → 5 >= 3+2 で消滅
    const p1Turn5 = expireTempBuffs(p1AfterPlay, 5);
    expect(p1Turn5.tempBuffs).toHaveLength(0);
    expect(getEffectiveLeaderDef(p1Turn5)).toBe(5);
  });

  it('debuff_all_enemies_atk reduces opponent char effective atk this turn', () => {
    const p1Leader = makeLeader('l_p1');
    const p2Leader = makeLeader('l_p2');
    const event = makeEvent('ev_river_flood', {
      eventEffectType: 'debuff_all_enemies_atk',
      eventEffectData: { atk_debuff: 2 },
    });
    const enemyChar = makeCard('c_enemy', {
      instanceId: 'inst_enemy',
      attackPower: 6,
    });
    const state = makeState(
      makeEmptyPlayer('u1', p1Leader, { hand: [event], currentCost: 5 }),
      makeEmptyPlayer('ai', p2Leader, {
        board: [
          {
            card: enemyChar,
            isRested: false,
            canAttackThisTurn: true,
            playedTurn: 1,
          },
        ],
      }),
    );

    const result = applyAction(state, {
      type: 'play_card',
      player: 'p1',
      cardInstanceId: event.instanceId,
      timestamp: '2026-04-24T00:00:00Z',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const p2 = result.newState.players.p2;
    // 相手 (p2) の tempBuffs に scope='all_my_chars', value=-2 が入る
    expect(p2.tempBuffs).toHaveLength(1);
    expect(p2.tempBuffs[0].value).toBe(-2);
    // p2 視点でキャラの effective atk = 6 - 2 = 4
    expect(getEffectiveCharAtk(p2, enemyChar)).toBe(4);
  });
});
