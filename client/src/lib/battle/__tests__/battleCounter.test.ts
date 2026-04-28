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
import {
  applyAction,
  prepareAIAttack,
  resumeAttackWithCounter,
} from '../battleActions';
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
    // Phase 6c-4: turn 1 は両者攻撃ロック中のためデフォルトは 3 (=攻撃可能)
    // (Phase 6c-bug2 で turn 2 から解禁。デフォルト 3 は安定性維持のため変更しない)
    turn: 3,
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

// ============================================================================
// Phase 6b-4: 人間防御カウンター宣言ウィンドウ (prepareAIAttack / resume)
// ============================================================================

describe('AI attack with human counter window (Phase 6b-4)', () => {
  it('prepareAIAttack sets pendingAttack when defender is human with counter', () => {
    // p2 (AI) → p1 (人間) リーダー攻撃。p1 はカウンター持ち。
    const p1Leader = makeLeader('l_p1', { defensePower: 5 });
    const p2Leader = makeLeader('l_p2', { attackPower: 7 });
    const counterCard = makeCounter('cn_p1_counter', {
      instanceId: 'inst_p1_counter',
      counterValue: 3,
    });
    const state = makeState(
      makeEmptyPlayer('u1', p1Leader, {
        hand: [counterCard],
        lifeCards: [makeCard('l1'), makeCard('l2')],
      }),
      makeEmptyPlayer('ai', p2Leader, { isAI: true }),
      { activePlayer: 'p2' },
    );

    const action: AttackAction = {
      type: 'attack',
      player: 'p2',
      attackerSource: { kind: 'leader' },
      targetSource: { kind: 'leader' },
      timestamp: '2026-04-24T00:00:00Z',
    };
    const result = prepareAIAttack(state, action);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // pendingAttack がセットされ、まだ attack は実行されていない
    expect(result.newState.pendingAttack).toBeTruthy();
    expect(result.newState.pendingAttack?.player).toBe('p2');
    expect(result.events).toHaveLength(0);
    // p1 のライフは変わらず (攻撃未実行)
    expect(result.newState.players.p1.lifeCards).toHaveLength(2);
    // p1 のカウンターはまだ手札に
    expect(result.newState.players.p1.hand).toHaveLength(1);
  });

  it('prepareAIAttack runs immediately when defender is AI', () => {
    // p1 (人間) → p2 (AI) 攻撃。AI 防御はそもそも本フェーズの対象外で即時実行。
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
        lifeCards: [makeCard('l1')],
      }),
    );

    const action: AttackAction = {
      type: 'attack',
      player: 'p1',
      attackerSource: { kind: 'leader' },
      targetSource: { kind: 'leader' },
      timestamp: '2026-04-24T00:00:00Z',
    };
    const result = prepareAIAttack(state, action);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // pendingAttack はセットされない (AI 防御は applyAction 直行)
    expect(result.newState.pendingAttack ?? null).toBeNull();
    // attack イベントが発生している (即時実行された証拠)
    expect(
      result.events.some((e) => e.type === 'attack_resolved'),
    ).toBe(true);
  });

  it('prepareAIAttack runs immediately when human has no counter card', () => {
    // p2 (AI) → p1 (人間) 攻撃。p1 は counter を持ってない → ペンディング不要。
    const p1Leader = makeLeader('l_p1', { defensePower: 5 });
    const p2Leader = makeLeader('l_p2', { attackPower: 7 });
    const state = makeState(
      makeEmptyPlayer('u1', p1Leader, {
        hand: [makeCard('c_random')], // 普通のキャラのみ
        lifeCards: [makeCard('l1'), makeCard('l2')],
      }),
      makeEmptyPlayer('ai', p2Leader, { isAI: true }),
      { activePlayer: 'p2' },
    );

    const action: AttackAction = {
      type: 'attack',
      player: 'p2',
      attackerSource: { kind: 'leader' },
      targetSource: { kind: 'leader' },
      timestamp: '2026-04-24T00:00:00Z',
    };
    const result = prepareAIAttack(state, action);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.newState.pendingAttack ?? null).toBeNull();
    expect(
      result.events.some((e) => e.type === 'attack_resolved'),
    ).toBe(true);
    // ライフは 1 減 (突破成立)
    expect(result.newState.players.p1.lifeCards).toHaveLength(1);
  });

  it('resumeAttackWithCounter applies counter card and clears pendingAttack', () => {
    // pendingAttack を持った state を作り、人間が counter を選んだケース
    const p1Leader = makeLeader('l_p1', { defensePower: 5 });
    const p2Leader = makeLeader('l_p2', { attackPower: 7 });
    const counterCard = makeCounter('cn_block', {
      instanceId: 'inst_block',
      counterValue: 3,
    });
    const lifeCard = makeCard('l1');
    const pending: AttackAction = {
      type: 'attack',
      player: 'p2',
      attackerSource: { kind: 'leader' },
      targetSource: { kind: 'leader' },
      timestamp: '2026-04-24T00:00:00Z',
    };
    const state = makeState(
      makeEmptyPlayer('u1', p1Leader, {
        hand: [counterCard],
        lifeCards: [lifeCard],
      }),
      makeEmptyPlayer('ai', p2Leader, { isAI: true }),
      { activePlayer: 'p2', pendingAttack: pending },
    );

    const result = resumeAttackWithCounter(state, counterCard.instanceId);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // pendingAttack はクリア
    expect(result.newState.pendingAttack ?? null).toBeNull();
    // 攻撃阻止: 7 vs 5+3=8 → 防御成功
    const resolved = result.events.find((e) => e.type === 'attack_resolved');
    expect((resolved!.payload as { success?: boolean }).success).toBe(false);
    // counter は墓地、手札から消える
    const p1 = result.newState.players.p1;
    expect(p1.hand.map((c) => c.cardId)).not.toContain('cn_block');
    expect(p1.graveyard.map((c) => c.cardId)).toContain('cn_block');
    // ライフは消費されてない
    expect(p1.lifeCards).toHaveLength(1);
  });

  it('resumeAttackWithCounter with null skips counter and runs attack normally', () => {
    // 人間が「カウンターしない」を選んだケース
    const p1Leader = makeLeader('l_p1', { defensePower: 5 });
    const p2Leader = makeLeader('l_p2', { attackPower: 7 });
    const counterCard = makeCounter('cn_unused', {
      instanceId: 'inst_unused',
      counterValue: 3,
    });
    const lifeCard = makeCard('l1');
    const pending: AttackAction = {
      type: 'attack',
      player: 'p2',
      attackerSource: { kind: 'leader' },
      targetSource: { kind: 'leader' },
      timestamp: '2026-04-24T00:00:00Z',
    };
    const state = makeState(
      makeEmptyPlayer('u1', p1Leader, {
        hand: [counterCard],
        lifeCards: [lifeCard, makeCard('l2')],
      }),
      makeEmptyPlayer('ai', p2Leader, { isAI: true }),
      { activePlayer: 'p2', pendingAttack: pending },
    );

    const result = resumeAttackWithCounter(state, null);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.newState.pendingAttack ?? null).toBeNull();
    // 攻撃成立: 7 >= 5
    const resolved = result.events.find((e) => e.type === 'attack_resolved');
    expect((resolved!.payload as { success?: boolean }).success).toBe(true);
    // counter は依然手札に (使ってない)
    const p1 = result.newState.players.p1;
    expect(p1.hand.map((c) => c.cardId)).toContain('cn_unused');
    expect(p1.graveyard.map((c) => c.cardId)).not.toContain('cn_unused');
    // ライフは 1 減
    expect(p1.lifeCards).toHaveLength(1);
  });
});

// ============================================================================
// Phase 6b-3.5 緊急回帰: 場プレイカウンターの 'this_turn' buff_leader_def が
// 自ターン終了時に消えること (それまで 2 ラウンド残って相手の攻撃を弾いていた)
// ============================================================================

describe('Phase 6b-3.5: counter play_from_hand this_turn buff lifecycle', () => {
  it('cn_great_wall_shield play_from_hand: this_turn def buff expires at own main->end', async () => {
    const { advancePhase } = await import('../battleEngine');

    // p1 が cn_great_wall_shield を場プレイ → 自リーダー def +2 (this_turn)
    const p1Leader = makeLeader('l_p1', { defensePower: 5 });
    const p2Leader = makeLeader('l_p2', { attackPower: 6 });
    const wallShield = makeCounter('cn_great_wall_shield', {
      cost: 3,
      counterValue: 3,
      eventEffectType: 'buff_leader_def',
      eventEffectData: { def_bonus: 2, duration: 'this_turn' },
    });
    const state = makeState(
      makeEmptyPlayer('u1', p1Leader, {
        hand: [wallShield],
        currentCost: 5,
        lifeCards: [makeCard('l1'), makeCard('l2'), makeCard('l3')],
      }),
      makeEmptyPlayer('ai', p2Leader, {
        isAI: true,
        // p2 の draw phase に最低 1 枚必要 (空デッキは game_over)
        deck: [makeCard('p2_d1'), makeCard('p2_d2')],
      }),
      { turn: 3, activePlayer: 'p1', phase: 'main' },
    );

    // play
    const playResult = applyAction(state, {
      type: 'play_card',
      player: 'p1',
      cardInstanceId: wallShield.instanceId,
      timestamp: '2026-04-24T00:00:00Z',
    });
    expect(playResult.ok).toBe(true);
    if (!playResult.ok) return;
    // 発動直後は buff 1 件、scope='leader', value=2
    const p1AfterPlay = playResult.newState.players.p1;
    expect(p1AfterPlay.tempBuffs).toHaveLength(1);
    expect(p1AfterPlay.tempBuffs[0].value).toBe(2);
    expect(p1AfterPlay.tempBuffs[0].expiresAt).toBe('this_turn');

    // p1 main → end で buff 消滅
    const afterMainEnd = advancePhase(playResult.newState);
    expect(afterMainEnd.phase).toBe('end');
    expect(afterMainEnd.players.p1.tempBuffs).toHaveLength(0);

    // 同じ state で end → refresh (active=p2, turn=3) → draw → cost → main
    let s = afterMainEnd;
    let guard = 0;
    while (
      !(s.activePlayer === 'p2' && s.phase === 'main') &&
      !s.winner &&
      guard++ < 10
    ) {
      s = advancePhase(s);
    }
    // p2 視点で p1 リーダー攻撃 → 6 >= 5 で成立 (buff が残っていれば 6 < 7 で失敗)
    const attackResult = applyAction(s, {
      type: 'attack',
      player: 'p2',
      attackerSource: { kind: 'leader' },
      targetSource: { kind: 'leader' },
      counterCardInstanceId: null, // 防御カウンターはなし
      timestamp: '2026-04-24T00:00:00Z',
    });
    expect(attackResult.ok).toBe(true);
    if (!attackResult.ok) return;
    const resolved = attackResult.events.find(
      (e) => e.type === 'attack_resolved',
    );
    expect((resolved!.payload as { success?: boolean }).success).toBe(true);
    expect(
      (resolved!.payload as { defensePower?: number }).defensePower,
    ).toBe(5);
    // p1 ライフが 1 枚減ってる (buff 残ってたら防がれてゼロ減)
    expect(attackResult.newState.players.p1.lifeCards).toHaveLength(2);
  });

  it('attack-mode counter declaration does not poison subsequent defense calc', async () => {
    const { advancePhase } = await import('../battleEngine');

    // p1 atk=6 が p2 leader を狙う。p2 は cn_great_wall_shield を防御発動 → counter_value=3
    // で 6<8 で阻止。重要: 防御発動は tempBuffs に積まないので、その後の p2 のターンで
    // p1 が改めて p2 リーダーを attack した時、defense は base 5 のままになる。
    const p1Leader = makeLeader('l_p1', { attackPower: 6 });
    const p2Leader = makeLeader('l_p2', { defensePower: 5 });
    const wallShield = makeCounter('cn_great_wall_shield', {
      cost: 3,
      counterValue: 3,
      eventEffectType: 'buff_leader_def',
      eventEffectData: { def_bonus: 2, duration: 'this_turn' },
    });
    const charAtt = makeCard('c_p1_att', {
      instanceId: 'inst_p1_att',
      attackPower: 6,
    });
    const state = makeState(
      makeEmptyPlayer('u1', p1Leader, {
        currentCost: 5,
        board: [
          {
            card: charAtt,
            isRested: false,
            canAttackThisTurn: true,
            playedTurn: 1,
          },
        ],
      }),
      makeEmptyPlayer('ai', p2Leader, {
        isAI: true,
        hand: [wallShield],
        lifeCards: [makeCard('l1'), makeCard('l2'), makeCard('l3')],
      }),
      { turn: 3, activePlayer: 'p1', phase: 'main' },
    );

    // attack with counter declaration
    const firstAtk = applyAction(state, {
      type: 'attack',
      player: 'p1',
      attackerSource: { kind: 'leader' },
      targetSource: { kind: 'leader' },
      counterCardInstanceId: wallShield.instanceId,
      timestamp: '2026-04-24T00:00:00Z',
    });
    expect(firstAtk.ok).toBe(true);
    if (!firstAtk.ok) return;
    // 防御成立、p2 tempBuffs に何も積まれていない
    expect(firstAtk.newState.players.p2.tempBuffs).toHaveLength(0);
    expect(firstAtk.newState.players.p2.lifeCards).toHaveLength(3);
    // counterCard は p2 の手札 → 墓地
    expect(firstAtk.newState.players.p2.graveyard.map((c) => c.cardId)).toContain(
      'cn_great_wall_shield',
    );

    // 続けて board キャラで再攻撃 (アタッカー違うのでレスト関係ない)
    const secondAtk = applyAction(firstAtk.newState, {
      type: 'attack',
      player: 'p1',
      attackerSource: { kind: 'character', instanceId: 'inst_p1_att' },
      targetSource: { kind: 'leader' },
      counterCardInstanceId: null,
      timestamp: '2026-04-24T00:00:00Z',
    });
    expect(secondAtk.ok).toBe(true);
    if (!secondAtk.ok) return;
    const resolved = secondAtk.events.find(
      (e) => e.type === 'attack_resolved',
    );
    // 6 >= 5 で成立 (前回のカウンター発動で残留 buff があれば 6 < 7 で失敗)
    expect((resolved!.payload as { success?: boolean }).success).toBe(true);
    expect(
      (resolved!.payload as { defensePower?: number }).defensePower,
    ).toBe(5);
    // 念のため未使用の不要な advancePhase は呼ばない (この場では state を進める必要なし)
    void advancePhase;
  });
});
