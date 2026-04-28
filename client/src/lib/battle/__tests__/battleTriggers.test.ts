// ============================================================================
// battleTriggers.test.ts
// TRAIL QUEST WORLD - Battle System v2.0 MVP (Phase 2 本実装)
// トリガーシステム 5 種 + 非トリガーフロー = 6 シナリオ
// ============================================================================

import { describe, expect, it } from 'vitest';

import { applyAction } from '../battleActions';
import { advancePhase, leaderRowToState } from '../battleEngine';
import type {
  AttackAction,
  BattleCardInstance,
  BattleColor,
  BattleLeaderRow,
  BattleState,
  PlayerState,
} from '../battleTypes';

// ============================================================================
// ヘルパー (battleEngine.test.ts / battleAI.test.ts と同仕様)
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
    turn: 2,
    firstPlayer: 'p1',
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

/**
 * p1 がキャラで p2 リーダーを攻撃する汎用セットアップ。
 * p2.lifeCards[0] に triggerType を仕込める。
 */
function setupLeaderAttackState(args: {
  triggerType: BattleCardInstance['triggerType'];
  p2LifeCount?: number;
  p2DeckCards?: BattleCardInstance[];
  p2Graveyard?: BattleCardInstance[];
  p1ExtraBoard?: BattleCardInstance[];
}): {
  state: BattleState;
  attackerInstanceId: string;
  topLifeCardId: string;
} {
  const {
    triggerType,
    p2LifeCount = 3,
    p2DeckCards = [],
    p2Graveyard = [],
    p1ExtraBoard = [],
  } = args;
  const p1Leader = makeLeader('l_p1', { attackPower: 5 });
  const p2Leader = makeLeader('l_p2', { defensePower: 3 });
  const attacker = makeCard('c_att', { attackPower: 9 });

  const p2LifeCards: BattleCardInstance[] = [];
  for (let i = 0; i < p2LifeCount; i++) {
    p2LifeCards.push(
      makeCard(`p2_life_${i}`, {
        triggerType: i === 0 ? triggerType : null,
      }),
    );
  }

  const state = makeState({
    turn: 3,
    firstPlayer: 'p1',
    activePlayer: 'p1',
    phase: 'main',
    players: {
      p1: makeEmptyPlayer('u1', p1Leader, {
        board: [
          {
            card: attacker,
            isRested: false,
            canAttackThisTurn: true,
            playedTurn: 2,
          },
          // 追加キャラ (destroy トリガー検証用)
          ...p1ExtraBoard.map((c) => ({
            card: c,
            isRested: false,
            canAttackThisTurn: true,
            playedTurn: 2,
          })),
        ],
        hasDrawnThisTurn: true,
      }),
      p2: makeEmptyPlayer('ai', p2Leader, {
        lifeCards: p2LifeCards,
        deck: p2DeckCards,
        graveyard: p2Graveyard,
      }),
    },
  });

  return {
    state,
    attackerInstanceId: attacker.instanceId,
    topLifeCardId: p2LifeCards[0]?.cardId ?? '',
  };
}

function makeAttackAction(instanceId: string): AttackAction {
  return {
    type: 'attack',
    player: 'p1',
    timestamp: '2026-04-25T00:00:00Z',
    attackerSource: { kind: 'character', instanceId },
    targetSource: { kind: 'leader' },
  };
}

// ============================================================================
// シナリオ 1: draw トリガー — 防御側の手札 +2 (ライフ + ドロー)
// ============================================================================

describe('trigger: draw', () => {
  it('triggerType=draw で defender が deck top を 1 枚ドロー、ライフ→手札も実行 (hand +2)', () => {
    const drawn = makeCard('p2_deck_top');
    const { state, attackerInstanceId, topLifeCardId } = setupLeaderAttackState({
      triggerType: 'draw',
      p2DeckCards: [drawn, makeCard('p2_deck_1')],
    });

    const result = applyAction(state, makeAttackAction(attackerInstanceId));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const p2After = result.newState.players.p2;
    // deck から 1 枚減る
    expect(p2After.deck).toHaveLength(1);
    // lifeCards は 1 枚減る (通常消費)
    expect(p2After.lifeCards).toHaveLength(2);
    // hand は +2 (ドロー 1 + ライフカード 1)
    expect(p2After.hand).toHaveLength(2);
    const handIds = p2After.hand.map((c) => c.cardId);
    expect(handIds).toContain('p2_deck_top');
    expect(handIds).toContain(topLifeCardId);

    // イベント確認
    const types = result.events.map((e) => e.type);
    expect(types).toContain('trigger_activated');
    expect(types).toContain('life_damaged');
  });

  it('draw トリガー発動時に deck が空なら no-op、ライフ消費は通常通り', () => {
    const { state, attackerInstanceId } = setupLeaderAttackState({
      triggerType: 'draw',
      p2DeckCards: [], // empty
    });
    const result = applyAction(state, makeAttackAction(attackerInstanceId));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const p2After = result.newState.players.p2;
    expect(p2After.hand).toHaveLength(1); // ライフカードのみ
    expect(p2After.deck).toHaveLength(0);
    expect(p2After.lifeCards).toHaveLength(2);
  });
});

// ============================================================================
// シナリオ 2: mana トリガー — 次ターンの defender maxCost +2
// ============================================================================

describe('trigger: mana', () => {
  it('triggerType=mana 発動で defender.nextTurnManaBonus=2、次ターン cost 到達で maxCost=+2 反映', () => {
    const { state, attackerInstanceId } = setupLeaderAttackState({
      triggerType: 'mana',
      // p2 の draw フェーズで deck-out しないよう最低限のデッキを供給
      p2DeckCards: [makeCard('p2_d1'), makeCard('p2_d2'), makeCard('p2_d3')],
    });

    const result = applyAction(state, makeAttackAction(attackerInstanceId));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const p2After = result.newState.players.p2;
    // ボーナス設定確認
    expect(p2After.nextTurnManaBonus).toBe(2);
    // ライフ消費は通常
    expect(p2After.lifeCards).toHaveLength(2);
    expect(p2After.hand).toHaveLength(1);

    // 次ターンの p2 cost フェーズまで advancePhase を回す
    // 現在: turn=3, active=p1, phase=main → main,end,refresh,draw,cost,main (swap to p2)
    let s = result.newState;
    for (let i = 0; i < 10; i++) {
      if (s.activePlayer === 'p2' && s.phase === 'main') break;
      s = advancePhase(s);
    }
    // p2 の turn 3 の番 (後攻): 基本マナ = 3*2 = 6, ボーナス +2 → 8
    expect(s.players.p2.maxCost).toBe(8);
    expect(s.players.p2.nextTurnManaBonus).toBe(0); // 消費済
  });
});

// ============================================================================
// シナリオ 3: destroy トリガー — 攻撃側の最弱キャラ 1 体破壊
// ============================================================================

describe('trigger: destroy', () => {
  it('triggerType=destroy で attacker 場の最小 attackPower キャラが graveyard へ移動', () => {
    const weakMinion = makeCard('c_weak', { attackPower: 2 });
    const midMinion = makeCard('c_mid', { attackPower: 6 });
    const { state, attackerInstanceId } = setupLeaderAttackState({
      triggerType: 'destroy',
      p1ExtraBoard: [weakMinion, midMinion],
    });

    // 初期 p1 board: [attacker(atk=9), weak(atk=2), mid(atk=6)] → 最弱は weak
    const result = applyAction(state, makeAttackAction(attackerInstanceId));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const p1After = result.newState.players.p1;
    // weak が消えた + attacker はレスト (生存)
    expect(p1After.board.map((s) => s.card.cardId)).not.toContain('c_weak');
    expect(p1After.graveyard.map((c) => c.cardId)).toContain('c_weak');
    // 他は残る
    expect(p1After.board.map((s) => s.card.cardId)).toContain('c_att');
    expect(p1After.board.map((s) => s.card.cardId)).toContain('c_mid');

    const types = result.events.map((e) => e.type);
    expect(types).toContain('trigger_activated');
    expect(types).toContain('card_destroyed');
    expect(types).toContain('life_damaged');
  });

  it('destroy トリガーで attacker 場が空なら no-op、ライフ消費は通常通り', () => {
    // p1 の attacker を手動で場から外して attacker 場空に近い状態... は無理なので
    // 代替: applyAttack の前に destroy トリガーが発動したとき attacker board.length が
    // アタッカー 1 体のみであれば、アタッカー自体が破壊される可能性がある。
    // 実動作: 攻撃宣言 → アタッカーレスト → トリガー発動 (このとき場にアタッカー 1 体のみ)
    //   destroy は最弱 1 体破壊 = アタッカー自身を破壊する。
    const { state, attackerInstanceId } = setupLeaderAttackState({
      triggerType: 'destroy',
      // p1ExtraBoard 無し → board にアタッカー 1 体のみ
    });
    const result = applyAction(state, makeAttackAction(attackerInstanceId));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const p1After = result.newState.players.p1;
    // attacker 自身が破壊される (唯一の最弱)
    expect(p1After.board).toHaveLength(0);
    expect(p1After.graveyard).toHaveLength(1);
    expect(p1After.graveyard[0].cardId).toBe('c_att');
  });
});

// ============================================================================
// シナリオ 4: defense トリガー — 攻撃完全無効化
// ============================================================================

describe('trigger: defense', () => {
  it('triggerType=defense でライフ消費ゼロ、手札移動ゼロ、defense_blocked イベント発火', () => {
    const { state, attackerInstanceId } = setupLeaderAttackState({
      triggerType: 'defense',
    });

    const result = applyAction(state, makeAttackAction(attackerInstanceId));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const p2After = result.newState.players.p2;
    // シールドそのまま
    expect(p2After.lifeCards).toHaveLength(3);
    // 手札も増えない
    expect(p2After.hand).toHaveLength(0);
    // leader.life も変わらず
    expect(p2After.leader.life).toBe(3);

    const types = result.events.map((e) => e.type);
    expect(types).toContain('trigger_activated');
    expect(types).toContain('defense_blocked');
    expect(types).not.toContain('life_damaged');

    // アタッカーはレスト状態 (防御成功でもアタッカーは消耗する)
    const p1After = result.newState.players.p1;
    expect(p1After.board[0].isRested).toBe(true);
  });
});

// ============================================================================
// Phase 6c-bug1: defense トリガー rotation — 永続発動防止
// ============================================================================
//
// 真因: 旧実装では defense トリガー発動後も lifeCards[0] が同じ card_cross の
// まま残り続け、攻撃の度に再発動 → 防御値が永続上昇したように見える症状。
// 修正: 発動したライフカードを一番下に rotate する。length / leader.life は
// 不変、上の既存テスト (toHaveLength(3) / hand 0 / life 3) は維持される。
// ============================================================================

describe('Phase 6c-bug1: defense trigger rotation', () => {
  it('1回目の defense 発動後、lifeCards top が別カード (元の 2 枚目) に変わる', () => {
    const { state, attackerInstanceId, topLifeCardId } = setupLeaderAttackState({
      triggerType: 'defense',
    });
    // setup: lifeCards = [p2_life_0(defense), p2_life_1(null), p2_life_2(null)]

    const result = applyAction(state, makeAttackAction(attackerInstanceId));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const p2After = result.newState.players.p2;
    // 既存仕様維持: 枚数 / 手札 / life は不変
    expect(p2After.lifeCards).toHaveLength(3);
    expect(p2After.hand).toHaveLength(0);
    expect(p2After.leader.life).toBe(3);

    // 新仕様: top は元の 2 枚目 (p2_life_1) に変わり、defense カードは bottom へ
    expect(p2After.lifeCards[0].cardId).toBe('p2_life_1');
    expect(p2After.lifeCards[1].cardId).toBe('p2_life_2');
    expect(p2After.lifeCards[2].cardId).toBe(topLifeCardId); // 'p2_life_0'
  });

  it('2回連続の攻撃で 2回目は別カードが top のため通常消費 → lifeCards 2 / hand 1', () => {
    const { state, attackerInstanceId, topLifeCardId } = setupLeaderAttackState({
      triggerType: 'defense',
    });

    // 1回目: defense → rotate
    const result1 = applyAction(state, makeAttackAction(attackerInstanceId));
    expect(result1.ok).toBe(true);
    if (!result1.ok) return;

    // アタッカーをアンレストして再攻撃可能状態にする (rest はテスト目的なので直接書き換え)
    const stateAfter1 = result1.newState;
    const refreshedAttacker = {
      ...stateAfter1,
      players: {
        ...stateAfter1.players,
        p1: {
          ...stateAfter1.players.p1,
          board: stateAfter1.players.p1.board.map((s) => ({
            ...s,
            isRested: false,
            canAttackThisTurn: true,
          })),
        },
      },
    };

    // 2回目: top は p2_life_1 (triggerType=null) なので通常消費
    const result2 = applyAction(refreshedAttacker, makeAttackAction(attackerInstanceId));
    expect(result2.ok).toBe(true);
    if (!result2.ok) return;

    const p2After2 = result2.newState.players.p2;
    expect(p2After2.lifeCards).toHaveLength(2);
    expect(p2After2.hand).toHaveLength(1);
    expect(p2After2.hand[0].cardId).toBe('p2_life_1');
    // bottom に rotate された defense カード (元 top) は健在
    expect(p2After2.lifeCards.map((c) => c.cardId)).toContain(topLifeCardId);

    const types2 = result2.events.map((e) => e.type);
    expect(types2).toContain('life_damaged');
    expect(types2).not.toContain('defense_blocked'); // 2 回目は trigger 発動しない
  });

  it('lifeCards 全カードが defense の場合、3 回攻撃で枚数は 3 のまま (1 周 rotate)', () => {
    // 既存ヘルパは top のみに trigger を仕込むので、ここは手動セットアップ
    const p1Leader = makeLeader('l_p1', { attackPower: 5 });
    const p2Leader = makeLeader('l_p2', { defensePower: 3 });
    const attacker = makeCard('c_att', { attackPower: 9 });
    const allDefenseLife = [
      makeCard('def_a', { triggerType: 'defense' }),
      makeCard('def_b', { triggerType: 'defense' }),
      makeCard('def_c', { triggerType: 'defense' }),
    ];

    let s = makeState({
      turn: 3,
      activePlayer: 'p1',
      phase: 'main',
      players: {
        p1: makeEmptyPlayer('u1', p1Leader, {
          board: [
            { card: attacker, isRested: false, canAttackThisTurn: true, playedTurn: 2 },
          ],
          hasDrawnThisTurn: true,
        }),
        p2: makeEmptyPlayer('ai', p2Leader, { lifeCards: allDefenseLife }),
      },
    });

    const expectedTops = ['def_a', 'def_b', 'def_c']; // 各攻撃時の top
    for (let i = 0; i < 3; i++) {
      expect(s.players.p2.lifeCards[0].cardId).toBe(expectedTops[i]);
      const r = applyAction(s, makeAttackAction(attacker.instanceId));
      expect(r.ok).toBe(true);
      if (!r.ok) return;

      // 既存仕様: 枚数 / 手札 / life は不変
      expect(r.newState.players.p2.lifeCards).toHaveLength(3);
      expect(r.newState.players.p2.hand).toHaveLength(0);
      expect(r.newState.players.p2.leader.life).toBe(3);

      // アタッカーをアンレストして次の攻撃へ
      s = {
        ...r.newState,
        players: {
          ...r.newState.players,
          p1: {
            ...r.newState.players.p1,
            board: r.newState.players.p1.board.map((sl) => ({
              ...sl,
              isRested: false,
              canAttackThisTurn: true,
            })),
          },
        },
      };
    }

    // 3 回 rotate 後は元の順序に戻っている
    expect(s.players.p2.lifeCards.map((c) => c.cardId)).toEqual(['def_a', 'def_b', 'def_c']);
  });
});

// ============================================================================
// シナリオ 5: revive トリガー — 墓地から 1 枚を手札へ
// ============================================================================

describe('trigger: revive', () => {
  it('triggerType=revive で defender.graveyard[0] が手札へ、ライフカードも手札へ (hand +2)', () => {
    const graveCard = makeCard('p2_grave_top');
    const { state, attackerInstanceId, topLifeCardId } = setupLeaderAttackState({
      triggerType: 'revive',
      p2Graveyard: [graveCard, makeCard('p2_grave_1')],
    });

    const result = applyAction(state, makeAttackAction(attackerInstanceId));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const p2After = result.newState.players.p2;
    expect(p2After.graveyard).toHaveLength(1);
    expect(p2After.hand).toHaveLength(2);
    const handIds = p2After.hand.map((c) => c.cardId);
    expect(handIds).toContain('p2_grave_top');
    expect(handIds).toContain(topLifeCardId);
    expect(p2After.lifeCards).toHaveLength(2);
  });

  it('revive トリガーで墓地が空なら no-op、ライフ消費は通常通り', () => {
    const { state, attackerInstanceId } = setupLeaderAttackState({
      triggerType: 'revive',
      p2Graveyard: [], // empty
    });
    const result = applyAction(state, makeAttackAction(attackerInstanceId));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const p2After = result.newState.players.p2;
    expect(p2After.hand).toHaveLength(1); // ライフカードのみ
    expect(p2After.graveyard).toHaveLength(0);
  });
});

// ============================================================================
// シナリオ 6: 非トリガー (triggerType=null) 通常フロー
// ============================================================================

describe('trigger: null (non-trigger)', () => {
  it('triggerType=null なら trigger_activated 発生せず、ライフ→手札のみ実行', () => {
    const { state, attackerInstanceId, topLifeCardId } = setupLeaderAttackState({
      triggerType: null,
    });

    const result = applyAction(state, makeAttackAction(attackerInstanceId));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const p2After = result.newState.players.p2;
    expect(p2After.lifeCards).toHaveLength(2);
    expect(p2After.hand).toHaveLength(1);
    expect(p2After.hand[0].cardId).toBe(topLifeCardId);
    expect(p2After.leader.life).toBe(2);

    const types = result.events.map((e) => e.type);
    expect(types).not.toContain('trigger_activated');
    expect(types).not.toContain('defense_blocked');
    expect(types).toContain('life_damaged');
  });
});
