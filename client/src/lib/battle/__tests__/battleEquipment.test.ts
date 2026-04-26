// ============================================================================
// battleEquipment.test.ts
// TRAIL QUEST WORLD - Battle System v2.0.2 (Phase 3 装備カード実装)
// 5 シナリオ: プレイ成功 / already_equipped / leader_mismatch /
//             permanent atk/def 加算 / once_only 即時発動
// ============================================================================

import { describe, expect, it } from 'vitest';

import { applyAction } from '../battleActions';
import { leaderRowToState } from '../battleEngine';
import type {
  BattleCardInstance,
  BattleColor,
  BattleLeaderRow,
  BattleState,
  EquipmentEffectType,
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

function makeEquipment(
  cardId: string,
  opts: Partial<{
    name: string;
    cost: number;
    color: BattleColor;
    instanceId: string;
    targetLeaderId: string;
    effectType: EquipmentEffectType;
    effectData: Record<string, unknown>;
  }> = {},
): BattleCardInstance {
  return {
    instanceId: opts.instanceId ?? `inst_${cardId}`,
    cardId,
    name: opts.name ?? `Equipment ${cardId}`,
    cost: opts.cost ?? 2,
    power: 0,
    attackPower: 0,
    defensePower: 0,
    color: opts.color ?? 'red',
    cardType: 'equipment',
    effectText: null,
    triggerType: null,
    counterValue: 0,
    equipmentTargetLeaderId: opts.targetLeaderId ?? null,
    equipmentEffectType: opts.effectType ?? 'permanent',
    equipmentEffectData: opts.effectData ?? {},
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

describe('equipment cards (Phase 3)', () => {
  it('plays equipment, sets equippedCard, consumes cost', () => {
    const p1Leader = makeLeader('leader_napoleon');
    const p2Leader = makeLeader('leader_oda');
    const equip = makeEquipment('card_napoleon_code', {
      cost: 2,
      targetLeaderId: 'leader_napoleon',
      effectType: 'permanent',
      effectData: {},
    });
    const state = makeState(
      makeEmptyPlayer('u1', p1Leader, { hand: [equip], currentCost: 5 }),
      makeEmptyPlayer('ai', p2Leader),
    );

    const action: PlayCardAction = {
      type: 'play_card',
      player: 'p1',
      cardInstanceId: equip.instanceId,
      timestamp: '2026-04-24T00:00:00Z',
    };
    const result = applyAction(state, action);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const p1 = result.newState.players.p1;
    expect(p1.equippedCard?.cardId).toBe('card_napoleon_code');
    expect(p1.hand).toHaveLength(0);
    expect(p1.currentCost).toBe(3); // 5 - 2
    expect(
      result.events.some((e) => e.type === 'equipment_played'),
    ).toBe(true);
  });

  it('rejects equipment if already equipped (already_equipped)', () => {
    const p1Leader = makeLeader('leader_napoleon');
    const p2Leader = makeLeader('leader_oda');
    const existing = makeEquipment('card_first_equipment', {
      targetLeaderId: 'leader_napoleon',
    });
    const incoming = makeEquipment('card_second_equipment', {
      cost: 2,
      targetLeaderId: 'leader_napoleon',
    });
    const state = makeState(
      makeEmptyPlayer('u1', p1Leader, {
        hand: [incoming],
        equippedCard: existing,
        currentCost: 5,
      }),
      makeEmptyPlayer('ai', p2Leader),
    );

    const action: PlayCardAction = {
      type: 'play_card',
      player: 'p1',
      cardInstanceId: incoming.instanceId,
      timestamp: '2026-04-24T00:00:00Z',
    };
    const result = applyAction(state, action);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('already_equipped');
  });

  it('rejects equipment if leader mismatch (leader_mismatch)', () => {
    const p1Leader = makeLeader('leader_napoleon');
    const p2Leader = makeLeader('leader_oda');
    const equip = makeEquipment('card_oda_only_equipment', {
      cost: 2,
      targetLeaderId: 'leader_oda', // p1 のリーダーは napoleon なので不一致
    });
    const state = makeState(
      makeEmptyPlayer('u1', p1Leader, { hand: [equip], currentCost: 5 }),
      makeEmptyPlayer('ai', p2Leader),
    );

    const action: PlayCardAction = {
      type: 'play_card',
      player: 'p1',
      cardInstanceId: equip.instanceId,
      timestamp: '2026-04-24T00:00:00Z',
    };
    const result = applyAction(state, action);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('leader_mismatch');
  });

  it('applies permanent atk/def bonus correctly', () => {
    const p1Leader = makeLeader('leader_napoleon', {
      attackPower: 5,
      defensePower: 5,
    });
    const p2Leader = makeLeader('leader_oda');
    const equip = makeEquipment('card_napoleon_bicorne', {
      cost: 2,
      targetLeaderId: 'leader_napoleon',
      effectType: 'permanent',
      effectData: {
        atk_bonus: 2,
        def_bonus: 1,
        ally_atk_bonus: 1,
        max_hand_bonus: 2,
      },
    });
    const state = makeState(
      makeEmptyPlayer('u1', p1Leader, { hand: [equip], currentCost: 5 }),
      makeEmptyPlayer('ai', p2Leader),
    );

    const action: PlayCardAction = {
      type: 'play_card',
      player: 'p1',
      cardInstanceId: equip.instanceId,
      timestamp: '2026-04-24T00:00:00Z',
    };
    const result = applyAction(state, action);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const p1 = result.newState.players.p1;
    expect(p1.equipmentBonusAtk).toBe(2);
    expect(p1.equipmentBonusDef).toBe(1);
    expect(p1.equipmentBonusAllyAtk).toBe(1);
    expect(p1.maxHandSize).toBe(99 + 2);
    expect(p1.equipmentOnceUsed).toBe(false); // permanent では false のまま
  });

  it('applies once_only effect immediately, sets equipmentOnceUsed', () => {
    const p1Leader = makeLeader('leader_sei_shonagon');
    const p2Leader = makeLeader('leader_oda');
    const buriedCard = makeCard('card_buried', { name: 'Buried Card' });
    const equip = makeEquipment('card_makura_no_soshi', {
      cost: 2,
      targetLeaderId: 'leader_sei_shonagon',
      effectType: 'once_only',
      effectData: { revive_from_graveyard: true },
    });
    const state = makeState(
      makeEmptyPlayer('u1', p1Leader, {
        hand: [equip],
        graveyard: [buriedCard],
        currentCost: 5,
      }),
      makeEmptyPlayer('ai', p2Leader),
    );

    const action: PlayCardAction = {
      type: 'play_card',
      player: 'p1',
      cardInstanceId: equip.instanceId,
      timestamp: '2026-04-24T00:00:00Z',
    };
    const result = applyAction(state, action);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const p1 = result.newState.players.p1;
    expect(p1.equippedCard?.cardId).toBe('card_makura_no_soshi');
    expect(p1.equipmentOnceUsed).toBe(true);
    expect(p1.graveyard).toHaveLength(0);
    expect(p1.hand.map((c) => c.cardId)).toContain('card_buried');
    expect(
      result.events.some(
        (e) =>
          e.type === 'temp_buff_applied' &&
          (e.payload as { effectKind?: string }).effectKind ===
            'revive_from_graveyard',
      ),
    ).toBe(true);
  });
});
