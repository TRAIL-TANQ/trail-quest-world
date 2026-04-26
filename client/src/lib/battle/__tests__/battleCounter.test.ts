// ============================================================================
// battleCounter.test.ts
// TRAIL QUEST WORLD - Battle System v2.0.2 (Phase 4 カウンターカード実装)
// 5 シナリオ:
//   1. プレイモード: 手札 → 効果発動 (draw) → 墓地
//   2. attack 防御モード: counterCardInstanceId 指定で defensePower 加算
//   3. attack 防御モード: 使用したカウンターは hand → graveyard へ
//   4. attack 防御モード: counter_value で突破阻止 (atk < def+cv)
//   5. AI 判断: ライフ残量と必要 counter_value で適切に決定
// ============================================================================

import { describe, expect, it } from 'vitest';

import { decideCounterUse } from '../battleAI';
import { applyAction } from '../battleActions';
import { leaderRowToState } from '../battleEngine';
import type {
  AttackAction,
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

function makeCounter(
  cardId: string,
  opts: Partial<{
    name: string;
    cost: number;
    color: BattleColor;
    instanceId: string;
    counterValue: number;
    eventEffectType: EventEffectType | string;
    eventEffectData: Record<string, unknown>;
  }> = {},
): BattleCardInstance {
  return {
    instanceId: opts.instanceId ?? `inst_${cardId}`,
    cardId,
    name: opts.name ?? `Counter ${cardId}`,
    cost: opts.cost ?? 1,
    power: 0,
    attackPower: 0,
    defensePower: 0,
    color: opts.color ?? 'red',
    cardType: 'counter',
    effectText: null,
    triggerType: null,
    counterValue: opts.counterValue ?? 2,
    eventEffectType: opts.eventEffectType ?? 'draw',
    eventEffectData: opts.eventEffectData ?? { count: 1 },
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

describe('counter cards (Phase 4)', () => {
  it('plays counter card from hand, applies draw effect, moves to graveyard', () => {
    const p1Leader = makeLeader('l_p1');
    const p2Leader = makeLeader('l_p2');
    const counterCard = makeCounter('cn_universal_diagram', {
      cost: 2,
      counterValue: 2,
      eventEffectType: 'draw',
      eventEffectData: { count: 1 },
    });
    const deckCard = makeCard('c_deck_top', { name: 'Deck Top' });
    const state = makeState(
      makeEmptyPlayer('u1', p1Leader, {
        hand: [counterCard],
        deck: [deckCard],
        currentCost: 5,
      }),
      makeEmptyPlayer('ai', p2Leader),
    );

    const action: PlayCardAction = {
      type: 'play_card',
      player: 'p1',
      cardInstanceId: counterCard.instanceId,
      timestamp: '2026-04-24T00:00:00Z',
    };
    const result = applyAction(state, action);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const p1 = result.newState.players.p1;
    // 手札からカウンターは消えて、deck top が手札に来ている
    expect(p1.hand.map((c) => c.cardId)).toEqual(['c_deck_top']);
    expect(p1.deck).toHaveLength(0);
    // 墓地末尾にカウンターカードが移動
    expect(p1.graveyard.map((c) => c.cardId)).toEqual(['cn_universal_diagram']);
    expect(p1.currentCost).toBe(3); // 5 - 2
    expect(
      result.events.some(
        (e) =>
          e.type === 'counter_used' &&
          (e.payload as { mode?: string }).mode === 'play_from_hand',
      ),
    ).toBe(true);
  });

  it('attack with counterCardInstanceId adds counter_value to effective_defense', () => {
    // p1 leader atk=6 vs p2 leader def=5 → 通常なら 6>=5 で突破
    // p2 が counter_value=3 を切ると def=5+3=8、6<8 で阻止
    const p1Leader = makeLeader('l_p1', { attackPower: 6, defensePower: 5 });
    const p2Leader = makeLeader('l_p2', { attackPower: 5, defensePower: 5 });
    const counterCard = makeCounter('cn_great_wall_shield', {
      counterValue: 3,
    });
    const lifeCard = makeCard('p2_life_0');
    const state = makeState(
      makeEmptyPlayer('u1', p1Leader, { currentCost: 5 }),
      makeEmptyPlayer('ai', p2Leader, {
        hand: [counterCard],
        lifeCards: [lifeCard],
      }),
    );

    const action: AttackAction = {
      type: 'attack',
      player: 'p1',
      attackerSource: { kind: 'leader' },
      targetSource: { kind: 'leader' },
      counterCardInstanceId: counterCard.instanceId,
      timestamp: '2026-04-24T00:00:00Z',
    };
    const result = applyAction(state, action);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const counterEvt = result.events.find((e) => e.type === 'counter_used');
    expect(counterEvt).toBeTruthy();
    expect((counterEvt!.payload as { newDefensePower?: number }).newDefensePower).toBe(8);
    // 攻撃失敗 (6 < 8)
    const resolved = result.events.find((e) => e.type === 'attack_resolved');
    expect((resolved!.payload as { success?: boolean }).success).toBe(false);
  });

  it('counter card moves from hand to graveyard after counter declaration', () => {
    const p1Leader = makeLeader('l_p1', { attackPower: 6 });
    const p2Leader = makeLeader('l_p2', { defensePower: 5 });
    const counterCard = makeCounter('cn_great_wall_shield', {
      counterValue: 3,
    });
    const otherHand = makeCard('p2_hand_other');
    const lifeCard = makeCard('p2_life_0');
    const state = makeState(
      makeEmptyPlayer('u1', p1Leader, { currentCost: 5 }),
      makeEmptyPlayer('ai', p2Leader, {
        hand: [counterCard, otherHand],
        lifeCards: [lifeCard],
      }),
    );

    const action: AttackAction = {
      type: 'attack',
      player: 'p1',
      attackerSource: { kind: 'leader' },
      targetSource: { kind: 'leader' },
      counterCardInstanceId: counterCard.instanceId,
      timestamp: '2026-04-24T00:00:00Z',
    };
    const result = applyAction(state, action);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const p2 = result.newState.players.p2;
    expect(p2.hand.map((c) => c.cardId)).toEqual(['p2_hand_other']);
    expect(p2.graveyard.map((c) => c.cardId)).toContain('cn_great_wall_shield');
    // ライフは減っていない (突破阻止)
    expect(p2.lifeCards).toHaveLength(1);
  });

  it('counter blocks attack when effective_atk < effective_def_with_counter', () => {
    // atk=7 vs def=5 → 通常 7>=5 突破。 counter_value=2 で def=7、7>=7 で突破成功 (border)
    // counter_value=3 で def=8、7<8 で阻止
    const p1Leader = makeLeader('l_p1', { attackPower: 7 });
    const p2Leader = makeLeader('l_p2', { defensePower: 5 });
    const weakCounter = makeCounter('cn_weak', {
      instanceId: 'inst_weak',
      counterValue: 2,
    });
    const strongCounter = makeCounter('cn_strong', {
      instanceId: 'inst_strong',
      counterValue: 3,
    });
    const lifeCard = makeCard('p2_life_0');

    // 弱いカウンター: 阻止失敗
    {
      const state = makeState(
        makeEmptyPlayer('u1', p1Leader),
        makeEmptyPlayer('ai', p2Leader, {
          hand: [weakCounter],
          lifeCards: [lifeCard],
        }),
      );
      const action: AttackAction = {
        type: 'attack',
        player: 'p1',
        attackerSource: { kind: 'leader' },
        targetSource: { kind: 'leader' },
        counterCardInstanceId: weakCounter.instanceId,
        timestamp: '2026-04-24T00:00:00Z',
      };
      const result = applyAction(state, action);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const resolved = result.events.find((e) => e.type === 'attack_resolved');
      expect((resolved!.payload as { success?: boolean }).success).toBe(true);
    }

    // 強いカウンター: 阻止成功
    {
      const state = makeState(
        makeEmptyPlayer('u1', p1Leader),
        makeEmptyPlayer('ai', p2Leader, {
          hand: [strongCounter],
          lifeCards: [lifeCard],
        }),
      );
      const action: AttackAction = {
        type: 'attack',
        player: 'p1',
        attackerSource: { kind: 'leader' },
        targetSource: { kind: 'leader' },
        counterCardInstanceId: strongCounter.instanceId,
        timestamp: '2026-04-24T00:00:00Z',
      };
      const result = applyAction(state, action);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const resolved = result.events.find((e) => e.type === 'attack_resolved');
      expect((resolved!.payload as { success?: boolean }).success).toBe(false);
    }
  });

  it('AI uses counter only when leader life <= 2 and counter blocks attack', () => {
    // 攻撃側 p1 leader atk=7, 防御側 p2 leader def=5 (突破される: 7>=5)
    // 必要 counter_value = 7 - 5 + 1 = 3
    const p1Leader = makeLeader('l_p1', { attackPower: 7 });
    const p2Leader = makeLeader('l_p2', { defensePower: 5 });
    const cv2 = makeCounter('cn_cv2', { instanceId: 'inst_cv2', counterValue: 2 });
    const cv3 = makeCounter('cn_cv3', { instanceId: 'inst_cv3', counterValue: 3 });
    const cv5 = makeCounter('cn_cv5', { instanceId: 'inst_cv5', counterValue: 5 });

    const baseAttackAction: AttackAction = {
      type: 'attack',
      player: 'p1',
      attackerSource: { kind: 'leader' },
      targetSource: { kind: 'leader' },
      timestamp: '2026-04-24T00:00:00Z',
    };

    // ケース A: ライフ 3 (危険ラインでない) → null
    {
      const state = makeState(
        makeEmptyPlayer('u1', p1Leader),
        makeEmptyPlayer('ai', p2Leader, {
          hand: [cv5],
          lifeCards: [makeCard('l1'), makeCard('l2'), makeCard('l3')],
        }),
      );
      expect(decideCounterUse(state, baseAttackAction, 'p2')).toBeNull();
    }

    // ケース B: ライフ 2 + counter cv=2 (足りない) → null
    {
      const state = makeState(
        makeEmptyPlayer('u1', p1Leader),
        makeEmptyPlayer('ai', p2Leader, {
          hand: [cv2],
          lifeCards: [makeCard('l1'), makeCard('l2')],
        }),
      );
      expect(decideCounterUse(state, baseAttackAction, 'p2')).toBeNull();
    }

    // ケース C: ライフ 2 + cv=3 と cv=5 (cv=3 で足りる、もったいない使い回避)
    {
      const state = makeState(
        makeEmptyPlayer('u1', p1Leader),
        makeEmptyPlayer('ai', p2Leader, {
          hand: [cv5, cv3],
          lifeCards: [makeCard('l1'), makeCard('l2')],
        }),
      );
      const chosen = decideCounterUse(state, baseAttackAction, 'p2');
      expect(chosen).toBe('inst_cv3'); // 必要 cv=3 以上で最小値
    }

    // ケース D: 攻撃対象がキャラ (リーダーじゃない) → null
    {
      const targetChar = makeCard('p2_char', {
        instanceId: 'inst_p2_char',
        defensePower: 3,
      });
      const state = makeState(
        makeEmptyPlayer('u1', p1Leader),
        makeEmptyPlayer('ai', p2Leader, {
          hand: [cv5],
          lifeCards: [makeCard('l1'), makeCard('l2')],
          board: [
            {
              card: targetChar,
              isRested: true,
              canAttackThisTurn: false,
              playedTurn: 1,
            },
          ],
        }),
      );
      const charTargetAction: AttackAction = {
        ...baseAttackAction,
        targetSource: { kind: 'character', instanceId: targetChar.instanceId },
      };
      expect(decideCounterUse(state, charTargetAction, 'p2')).toBeNull();
    }
  });
});

// ============================================================================
// Phase 6a: AI 防御カウンター自動統合テスト
// ============================================================================

describe('AI counter defense integration (Phase 6a)', () => {
  it('AI defender auto-declares counter when life <= 2 and attack is lethal', () => {
    // p1 (人間アタッカー) leader atk=7
    // p2 (AI 防御) leader def=5, 残ライフ 2、cv=3 のカウンター持ち
    // → counterCardInstanceId 未指定でも applyAttack 内で自動セットされ阻止される
    const p1Leader = makeLeader('l_p1', { attackPower: 7 });
    const p2Leader = makeLeader('l_p2', { defensePower: 5 });
    const aiCounter = makeCounter('cn_ai_counter', {
      instanceId: 'inst_ai_counter',
      counterValue: 3,
    });
    const state = makeState(
      makeEmptyPlayer('u1', p1Leader),
      makeEmptyPlayer('ai', p2Leader, {
        isAI: true,
        hand: [aiCounter],
        lifeCards: [makeCard('l1'), makeCard('l2')], // 残 2 (=危険)
      }),
    );

    const action: AttackAction = {
      type: 'attack',
      player: 'p1',
      attackerSource: { kind: 'leader' },
      targetSource: { kind: 'leader' },
      // counterCardInstanceId 意図的に未指定 (undefined)
      timestamp: '2026-04-24T00:00:00Z',
    };
    const result = applyAction(state, action);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const resolved = result.events.find((e) => e.type === 'attack_resolved');
    expect((resolved!.payload as { success?: boolean }).success).toBe(false);
    // AI が自動でカウンターを発動した event_played
    const autoEvt = result.events.find(
      (e) =>
        e.type === 'counter_used' &&
        (e.payload as { decidedBy?: string }).decidedBy === 'ai_auto',
    );
    expect(autoEvt).toBeTruthy();
    // カウンターは defender 墓地へ移動
    const p2 = result.newState.players.p2;
    expect(p2.hand).toHaveLength(0);
    expect(p2.graveyard.map((c) => c.cardId)).toContain('cn_ai_counter');
  });

  it('AI defender does NOT counter when life > 2', () => {
    // 残ライフ 4 (危険ラインじゃない) → AI は温存、突破される
    const p1Leader = makeLeader('l_p1', { attackPower: 7 });
    const p2Leader = makeLeader('l_p2', { defensePower: 5 });
    const aiCounter = makeCounter('cn_ai_counter', {
      instanceId: 'inst_ai_counter',
      counterValue: 3,
    });
    const state = makeState(
      makeEmptyPlayer('u1', p1Leader),
      makeEmptyPlayer('ai', p2Leader, {
        isAI: true,
        hand: [aiCounter],
        lifeCards: [
          makeCard('l1'),
          makeCard('l2'),
          makeCard('l3'),
          makeCard('l4'),
        ], // 残 4 = 安全
      }),
    );

    const action: AttackAction = {
      type: 'attack',
      player: 'p1',
      attackerSource: { kind: 'leader' },
      targetSource: { kind: 'leader' },
      timestamp: '2026-04-24T00:00:00Z',
    };
    const result = applyAction(state, action);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const resolved = result.events.find((e) => e.type === 'attack_resolved');
    expect((resolved!.payload as { success?: boolean }).success).toBe(true);
    // AI 自動カウンターは発動しない
    const autoEvt = result.events.find(
      (e) =>
        e.type === 'counter_used' &&
        (e.payload as { decidedBy?: string }).decidedBy === 'ai_auto',
    );
    expect(autoEvt).toBeUndefined();
    // カウンターは温存 (defender 手札に残る)
    const p2 = result.newState.players.p2;
    expect(p2.hand.map((c) => c.cardId)).toContain('cn_ai_counter');
    expect(p2.graveyard.map((c) => c.cardId)).not.toContain('cn_ai_counter');
  });

  it('AI defender does NOT counter when caller explicitly passes (null)', () => {
    // 同じ状況 (life=2, cv=3 持ち) でも、攻撃側が counterCardInstanceId: null を
    // 明示的に渡せば AI 自動判定はスキップされる (= 人間意思の尊重)
    const p1Leader = makeLeader('l_p1', { attackPower: 7 });
    const p2Leader = makeLeader('l_p2', { defensePower: 5 });
    const aiCounter = makeCounter('cn_ai_counter', {
      instanceId: 'inst_ai_counter',
      counterValue: 3,
    });
    const state = makeState(
      makeEmptyPlayer('u1', p1Leader),
      makeEmptyPlayer('ai', p2Leader, {
        isAI: true,
        hand: [aiCounter],
        lifeCards: [makeCard('l1'), makeCard('l2')], // 残 2 (本来なら AI 発動)
      }),
    );

    const action: AttackAction = {
      type: 'attack',
      player: 'p1',
      attackerSource: { kind: 'leader' },
      targetSource: { kind: 'leader' },
      counterCardInstanceId: null, // 明示パス
      timestamp: '2026-04-24T00:00:00Z',
    };
    const result = applyAction(state, action);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // 攻撃成立: 7 >= 5
    const resolved = result.events.find((e) => e.type === 'attack_resolved');
    expect((resolved!.payload as { success?: boolean }).success).toBe(true);
    // AI 自動カウンターはスキップされた
    const autoEvt = result.events.find(
      (e) =>
        e.type === 'counter_used' &&
        (e.payload as { decidedBy?: string }).decidedBy === 'ai_auto',
    );
    expect(autoEvt).toBeUndefined();
    // カウンターは依然手札に
    const p2 = result.newState.players.p2;
    expect(p2.hand.map((c) => c.cardId)).toContain('cn_ai_counter');
  });
});
