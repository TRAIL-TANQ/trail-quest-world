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

import {
  applyAction,
  resumeEventEffectWithTarget,
} from '../battleActions';
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

  it('destroy_enemy_char destroys opponent board head slot (AI immediate path)', () => {
    const p1Leader = makeLeader('l_p1');
    const p2Leader = makeLeader('l_p2');
    const target = makeCard('c_target', { instanceId: 'inst_target' });
    const survivor = makeCard('c_survivor', { instanceId: 'inst_survivor' });
    const event = makeEvent('ev_honnoji', {
      eventEffectType: 'destroy_enemy_char',
    });
    // Phase 6b-3: 人間プレイヤーは pendingTargetSelection に保留されるので、
    // 即時実行 (先頭スロット破壊) を検証するこのテストでは isAI: true を立てる。
    const state = makeState(
      makeEmptyPlayer('u1', p1Leader, {
        isAI: true,
        hand: [event],
        currentCost: 5,
      }),
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

// ============================================================================
// Phase 6b-3: 対象選択 UI 関連
// ============================================================================

describe('Phase 6b-3: target selection UI', () => {
  it('destroy_enemy_char: human player → pendingTargetSelection set', () => {
    const p1Leader = makeLeader('l_p1');
    const p2Leader = makeLeader('l_p2');
    const target = makeCard('c_target', { instanceId: 'inst_target' });
    const survivor = makeCard('c_survivor', { instanceId: 'inst_survivor' });
    const event = makeEvent('ev_honnoji', {
      eventEffectType: 'destroy_enemy_char',
    });
    const state = makeState(
      // isAI 未指定 → human 扱い
      makeEmptyPlayer('u1', p1Leader, { hand: [event], currentCost: 5 }),
      makeEmptyPlayer('ai', p2Leader, {
        isAI: true,
        board: [
          {
            card: target,
            isRested: false,
            canAttackThisTurn: true,
            playedTurn: 1,
          },
          {
            card: survivor,
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
    // pending がセットされる
    expect(result.newState.pendingTargetSelection).not.toBeNull();
    const pending = result.newState.pendingTargetSelection!;
    expect(pending.type).toBe('destroy_enemy_char');
    expect(pending.cardInstanceId).toBe(event.instanceId);
    expect(pending.candidates).toEqual(['inst_target', 'inst_survivor']);
    // コスト消費は完了 (event.cost=2, currentCost=5 → 3)
    expect(result.newState.players.p1.currentCost).toBe(3);
    // カードはまだ手札に残っている
    expect(
      result.newState.players.p1.hand.find(
        (c) => c.instanceId === event.instanceId,
      ),
    ).toBeDefined();
    // 相手 board / graveyard はまだ変化なし
    expect(result.newState.players.p2.board).toHaveLength(2);
    expect(result.newState.players.p2.graveyard).toHaveLength(0);
  });

  it('destroy_enemy_char: resumeEventEffectWithTarget destroys chosen card', () => {
    const p1Leader = makeLeader('l_p1');
    const p2Leader = makeLeader('l_p2');
    const target = makeCard('c_target', { instanceId: 'inst_target' });
    const survivor = makeCard('c_survivor', { instanceId: 'inst_survivor' });
    const event = makeEvent('ev_honnoji', {
      eventEffectType: 'destroy_enemy_char',
    });
    const initial = makeState(
      makeEmptyPlayer('u1', p1Leader, { hand: [event], currentCost: 5 }),
      makeEmptyPlayer('ai', p2Leader, {
        isAI: true,
        board: [
          {
            card: target,
            isRested: false,
            canAttackThisTurn: true,
            playedTurn: 1,
          },
          {
            card: survivor,
            isRested: false,
            canAttackThisTurn: true,
            playedTurn: 1,
          },
        ],
      }),
    );

    const playResult = applyAction(initial, {
      type: 'play_card',
      player: 'p1',
      cardInstanceId: event.instanceId,
      timestamp: '2026-04-24T00:00:00Z',
    });
    expect(playResult.ok).toBe(true);
    if (!playResult.ok) return;

    // 2 枚目 (survivor) を選択
    const resumed = resumeEventEffectWithTarget(playResult.newState, {
      targetInstanceId: 'inst_survivor',
    });
    expect(resumed.ok).toBe(true);
    if (!resumed.ok) return;
    expect(resumed.newState.pendingTargetSelection).toBeNull();
    const p1 = resumed.newState.players.p1;
    const p2 = resumed.newState.players.p2;
    // survivor 破壊、target は残る
    expect(p2.board.map((s) => s.card.cardId)).toEqual(['c_target']);
    expect(p2.graveyard.map((c) => c.cardId)).toEqual(['c_survivor']);
    // 発動カードは hand → graveyard
    expect(p1.hand.find((c) => c.instanceId === event.instanceId)).toBeUndefined();
    expect(p1.graveyard.map((c) => c.cardId)).toEqual(['ev_honnoji']);
  });

  it('resumeEventEffectWithTarget: invalid targetInstanceId returns invalid_target', () => {
    const p1Leader = makeLeader('l_p1');
    const p2Leader = makeLeader('l_p2');
    const target = makeCard('c_target', { instanceId: 'inst_target' });
    const event = makeEvent('ev_honnoji', {
      eventEffectType: 'destroy_enemy_char',
    });
    const initial = makeState(
      makeEmptyPlayer('u1', p1Leader, { hand: [event], currentCost: 5 }),
      makeEmptyPlayer('ai', p2Leader, {
        isAI: true,
        board: [
          {
            card: target,
            isRested: false,
            canAttackThisTurn: true,
            playedTurn: 1,
          },
        ],
      }),
    );
    const playResult = applyAction(initial, {
      type: 'play_card',
      player: 'p1',
      cardInstanceId: event.instanceId,
      timestamp: '2026-04-24T00:00:00Z',
    });
    if (!playResult.ok) return;

    const resumed = resumeEventEffectWithTarget(playResult.newState, {
      targetInstanceId: 'inst_nonexistent',
    });
    expect(resumed.ok).toBe(false);
    if (resumed.ok) return;
    expect(resumed.code).toBe('invalid_target');
  });

  it('destroy_enemy_char: human player with empty enemy board → no_valid_targets', () => {
    const p1Leader = makeLeader('l_p1');
    const p2Leader = makeLeader('l_p2');
    const event = makeEvent('ev_honnoji', {
      eventEffectType: 'destroy_enemy_char',
    });
    const state = makeState(
      makeEmptyPlayer('u1', p1Leader, { hand: [event], currentCost: 5 }),
      makeEmptyPlayer('ai', p2Leader, { isAI: true }),
    );
    const result = applyAction(state, {
      type: 'play_card',
      player: 'p1',
      cardInstanceId: event.instanceId,
      timestamp: '2026-04-24T00:00:00Z',
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('no_valid_targets');
  });

  it('scry_then_pick: peeked snapshot stored, resume preserves remaining order', () => {
    const p1Leader = makeLeader('l_p1');
    const p2Leader = makeLeader('l_p2');
    const event = makeEvent('ev_genji_writing', {
      eventEffectType: 'scry_then_pick',
      eventEffectData: { scry: 3, pick: 1 },
    });
    const top1 = makeCard('c_top1', { instanceId: 'inst_top1' });
    const top2 = makeCard('c_top2', { instanceId: 'inst_top2' });
    const top3 = makeCard('c_top3', { instanceId: 'inst_top3' });
    const top4 = makeCard('c_top4', { instanceId: 'inst_top4' });
    const state = makeState(
      makeEmptyPlayer('u1', p1Leader, {
        hand: [event],
        deck: [top1, top2, top3, top4],
        currentCost: 5,
      }),
      makeEmptyPlayer('ai', p2Leader, { isAI: true }),
    );
    const playResult = applyAction(state, {
      type: 'play_card',
      player: 'p1',
      cardInstanceId: event.instanceId,
      timestamp: '2026-04-24T00:00:00Z',
    });
    expect(playResult.ok).toBe(true);
    if (!playResult.ok) return;
    const pending = playResult.newState.pendingTargetSelection!;
    expect(pending.type).toBe('scry_then_pick');
    expect(pending.context?.peekedCards?.map((c) => c.cardId)).toEqual([
      'c_top1',
      'c_top2',
      'c_top3',
    ]);
    // デッキはまだ変化なし (resume 時に splice する)
    expect(playResult.newState.players.p1.deck).toHaveLength(4);

    // 真ん中 (top2) を手札へ
    const resumed = resumeEventEffectWithTarget(playResult.newState, {
      targetInstanceId: 'inst_top2',
    });
    expect(resumed.ok).toBe(true);
    if (!resumed.ok) return;
    const p1 = resumed.newState.players.p1;
    // 手札: 元のイベント (墓地行き) は除き、選んだ top2 が増える
    expect(p1.hand.map((c) => c.cardId)).toEqual(['c_top2']);
    // 山札 top: top1 → top3 → top4 (元の順序維持)
    expect(p1.deck.map((c) => c.cardId)).toEqual([
      'c_top1',
      'c_top3',
      'c_top4',
    ]);
    expect(p1.graveyard.map((c) => c.cardId)).toEqual(['ev_genji_writing']);
  });

  it('AI player: destroy_enemy_char skips pause, runs immediate path', () => {
    const p1Leader = makeLeader('l_p1');
    const p2Leader = makeLeader('l_p2');
    const target = makeCard('c_target', { instanceId: 'inst_target' });
    const event = makeEvent('ev_honnoji', {
      eventEffectType: 'destroy_enemy_char',
    });
    // 攻撃側 (p1) が AI → pause せず即時実行
    const state = makeState(
      makeEmptyPlayer('u1', p1Leader, {
        isAI: true,
        hand: [event],
        currentCost: 5,
      }),
      makeEmptyPlayer('ai', p2Leader, {
        board: [
          {
            card: target,
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
    expect(result.newState.pendingTargetSelection ?? null).toBeNull();
    expect(result.newState.players.p2.board).toHaveLength(0);
    expect(result.newState.players.p2.graveyard.map((c) => c.cardId)).toEqual([
      'c_target',
    ]);
  });
});
