// ============================================================================
// battleTypes.ts
// TRAIL QUEST WORLD - Battle System v2.0 MVP
// 型定義一式: Supabase スキーマとランタイム state の両方をカバー
// ============================================================================
//
// 配置先想定: client/src/lib/battle/battleTypes.ts
// ============================================================================

// ---- 1. 基本 enum ----------------------------------------------------------

export type BattleColor =
  | 'red'
  | 'blue'
  | 'green'
  | 'yellow'
  | 'purple'
  | 'black'
  | 'colorless';

export type CardType = 'character' | 'equipment' | 'event' | 'counter' | 'stage';
// 'stage' は将来用に予約 (現在未使用)

/**
 * 装備カードの効果発動タイミング種別 (v2.0.2 で追加)。
 *
 * - permanent : 場に出ている間ずっと効果適用 (atk/def 加算など)
 * - per_turn  : 自ターン開始時など、毎ターン一度発動
 * - once_only : 一度だけ発動 (PlayerState.equipmentOnceUsed で管理)
 */
export type EquipmentEffectType = 'permanent' | 'per_turn' | 'once_only';

/**
 * イベント / カウンターカードの効果種別 (v2.0.2 で追加)。
 * DB 投入済 (battle_cards_meta.event_effect_type) の全種を列挙。
 * 末尾 5 種 (draw〜reveal_opponent_hand) はカウンターカードのプレイ時効果用。
 * 将来追加に備え BattleCardMetaRow / BattleCardInstance では string も許容する。
 */
export type EventEffectType =
  | 'buff_my_chars_atk'
  | 'destroy_enemy_char'
  | 'both_draw_self_extra'
  | 'reveal_then_discard'
  | 'scry_then_pick'
  | 'draw_and_buff'
  | 'debuff_all_enemies_atk'
  | 'rest_release_all_my_chars'
  | 'heal_life'
  | 'buff_leader_def'
  | 'rest_all_chars'
  | 'opponent_cant_play_chars'
  | 'destroy_low_cost_chars'
  | 'reveal_opponent_hand_all'
  | 'draw'
  | 'peek_top_deck'
  | 'revive_from_graveyard'
  | 'draw_then_discard'
  | 'rest_release_one'
  | 'reveal_opponent_hand';

/**
 * ライフトリガー効果の種別 (v2.0-launch で追加)。
 * デッキ 30 枚中 5 枚がトリガー持ち。リーダー命中時にめくれたライフカードが
 * トリガーを持っていれば、手札へ戻る前に効果発動。
 *
 * - draw    : 防御側が 1 枚ドロー
 * - mana    : 次ターンの防御側 maxCost を +2 (1 ターンのみ)
 * - destroy : 攻撃側の場の最弱キャラ 1 体を破壊
 * - defense : 今回の攻撃を無効化、ライフ減らない (カードは手札へ)
 * - revive  : 防御側の墓地から 1 枚を手札に戻す
 * - null    : トリガーなし (通常カード)
 */
export type TriggerType =
  | 'draw'
  | 'mana'
  | 'destroy'
  | 'defense'
  | 'revive'
  | null;

export type BattleDifficulty = 'easy' | 'normal' | 'hard';

export type BattlePhase = 'refresh' | 'draw' | 'cost' | 'main' | 'end';

export type PlayerSlot = 'p1' | 'p2';

export type BattleWinner = 'p1' | 'p2' | 'draw';

// ---- 2. DB スキーマ型 (Supabase からのレスポンスと対応) --------------------

export interface BattleLeaderRow {
  id: string;                    // 'leader_napoleon'
  name: string;
  color: BattleColor;            // 'colorless' はリーダーには使用しない
  life: number;                  // v2.0-launch: 3 固定 (デッキ30枚構成のためマイルド化)
  power: number;                 // (廃止予定、後方互換のため残存、後日 DROP)
  attack_power: number;          // v2.0-launch: 5 固定 (1/1000スケール)
  defense_power: number;         // v2.0-launch: 5 固定 (1/1000スケール)
  description: string | null;
  image_url: string | null;
  effect_text: string | null;    // v2.0: null
  created_at: string;
}

export interface BattleCardMetaRow {
  card_id: string;
  card_type: CardType;           // v2.0.2: 'character' / 'equipment' / 'event' / 'counter'
  cost: number;                  // 1-10
  power: number;                 // (廃止予定、後方互換のため残存、後日 DROP)
  attack_power: number;          // 1-12 (1/1000スケール、v2.0-launch)
  defense_power: number;         // 1-12 (1/1000スケール、v2.0-launch)
  color: BattleColor;
  is_leader: boolean;            // v2.0: false 固定
  effect_text: string | null;    // v2.0: null
  trigger_type: TriggerType;     // v2.0-launch で追加、各デッキ 30 枚中 5 枚が非 null
  // ---- v2.0.2 追加 (equipment / counter / event カード用) ------------------
  counter_value: number;                                     // 0-5、カウンターカードのみ非 0
  equipment_target_leader_id?: string | null;                // 'leader_napoleon' 等、装備カード専用
  equipment_effect_type?: EquipmentEffectType | null;
  equipment_effect_data?: Record<string, any> | null;
  event_effect_type?: EventEffectType | string | null;       // string も許容 (将来拡張)
  event_effect_data?: Record<string, any> | null;
  created_at: string;
}

export interface BattleDeckRow {
  id: number;                    // bigserial
  child_id: string;
  name: string;
  leader_id: string;
  is_preset: boolean;
  created_at: string;
  updated_at: string;
}

export interface BattleDeckCardRow {
  deck_id: number;
  card_id: string;
  count: number;                 // 1-4
}

export interface BattleSessionRow {
  id: number;
  player1_id: string;
  player1_leader: string;
  player1_deck_id: number | null;
  player2_id: string;            // v2.0: 'ai' 固定
  player2_leader: string;
  player2_deck_id: number | null;
  difficulty: BattleDifficulty;
  winner: BattleWinner | null;   // 対戦中は null
  turn_count: number;
  duration_seconds: number;
  alt_earned: number;
  state_snapshot: BattleStateSnapshot | null;
  created_at: string;
}

// ---- 3. ランタイム state 型 ------------------------------------------------

/**
 * バトル進行中のランタイムカードインスタンス
 * 同じ card_id でも場のインスタンスごとに instanceId が異なる
 */
export interface BattleCardInstance {
  instanceId: string;            // クライアントで発行 (uuid)
  cardId: string;                // マスタへの参照
  name: string;                  // UI 表示用のコピー
  cost: number;
  power: number;                 // (廃止予定、後方互換)
  attackPower: number;           // アタック時の値 (v2.0-launch)
  defensePower: number;          // 防御時の値 (v2.0-launch)
  color: BattleColor;
  cardType: CardType;
  effectText: string | null;
  triggerType: TriggerType;      // null = 通常カード (非トリガー)
  // ---- v2.0.2 追加 (equipment / counter / event カード用) ------------------
  counterValue: number;                                      // 0-5、カウンターカードのみ非 0
  equipmentTargetLeaderId?: string | null;                   // 装備カードの専用リーダー
  equipmentEffectType?: EquipmentEffectType | null;
  equipmentEffectData?: Record<string, any> | null;
  eventEffectType?: string | null;                           // EventEffectType を許容、将来拡張で string も
  eventEffectData?: Record<string, any> | null;
}

/**
 * 場のスロット (最大5個/プレイヤー)
 */
export interface BoardSlot {
  card: BattleCardInstance;
  isRested: boolean;                 // true = レスト状態 (攻撃不可、相手から狙われる)
  canAttackThisTurn: boolean;        // false = サモニング病 (場に出たターン)
  playedTurn: number;                // デバッグ・アニメ用
}

/**
 * リーダーのランタイム state
 */
export interface LeaderState {
  id: string;                        // 'leader_napoleon'
  name: string;
  color: BattleColor;
  power: number;                     // v2.0-launch: 5 (1/1000スケール、廃止予定)
  attackPower: number;               // ランタイム攻撃力
  defensePower: number;              // ランタイム防御力
  life: number;                      // 残ライフ枚数
  isRested: boolean;                 // アタック後 true
  canAttackThisTurn: boolean;        // リーダーはサモニング病なし、毎ターン true
}

/**
 * 一時バフ / デバフ (v2.0.2)。
 * イベントカードや装備カードによる時限効果を表現する。
 *
 * scope:
 *   - all_my_chars     : 自分の場の全キャラ
 *   - leader           : 自分のリーダー
 *   - 1_char           : 単体 (targetInstanceId 必須)
 *   - all_enemies      : 相手の場の全キャラ
 *   - opponent_self    : 相手プレイヤー自身のフラグ (cantPlayCharsThisTurn 等)
 *
 * expiresAt:
 *   - this_turn                       : 現ターン終了時に消滅
 *   - next_opponent_turn_end          : 相手の次ターン終了時に消滅
 *   - until_next_opponent_turn_end    : 相手が次に動き終えるまで持続
 */
export interface TempBuff {
  id: string;
  type:
    | 'atk_bonus'
    | 'def_bonus'
    | 'leader_def_bonus'
    | 'leader_atk_bonus'
    | 'opponent_cant_play_chars'
    | 'all_enemies_atk_debuff';
  value: number;
  scope: 'all_my_chars' | 'leader' | '1_char' | 'all_enemies' | 'opponent_self';
  targetInstanceId?: string;
  expiresAt: 'this_turn' | 'next_opponent_turn_end' | 'until_next_opponent_turn_end';
  createdTurn: number;
}

/**
 * プレイヤー1人のフル state
 */
export interface PlayerState {
  id: string;                        // child_id or 'ai'
  /**
   * AI 判別フラグ (v2.0.2 Phase 6a)。default: false (人間)。
   * 旧 state では未設定 (undefined)。互換のため id==='ai' でも AI 扱いされる。
   */
  isAI?: boolean;
  leader: LeaderState;
  hand: BattleCardInstance[];        // UI 順序
  deck: BattleCardInstance[];        // 山札、[0] = top
  lifeCards: BattleCardInstance[];   // 裏向きライフ、[0] = top
  board: BoardSlot[];                // 最大5枠
  graveyard: BattleCardInstance[];
  currentCost: number;               // 残コスト
  maxCost: number;                   // = turn number、max 10
  hasDrawnThisTurn: boolean;
  nextTurnManaBonus?: number;        // 'mana' トリガーが発動した時に +2、次ターンの
                                     // cost フェーズで消費される。未定義/0 は効果なし。
  // ---- v2.0.2 追加 (装備 / カウンター / イベント) -------------------------
  equippedCard: BattleCardInstance | null;   // 現在装備中のカード (1 枚まで)
  equipmentBonusAtk: number;                 // 装備によるリーダー永続 atk 加算 (default 0)
  equipmentBonusDef: number;                 // 装備によるリーダー永続 def 加算 (default 0)
  equipmentBonusAllyAtk: number;             // 装備による味方キャラ全体 atk 加算 (default 0)
  maxHandSize: number;                       // 手札上限 (default 99 = 実質無制限)
  tempBuffs: TempBuff[];                     // 時限バフ / デバフリスト
  cantPlayCharsThisTurn: boolean;            // 相手のイベントで封じられた時 true
  equipmentOnceUsed: boolean;                // once_only 装備が発動済みか
}

/**
 * バトルイベント (ログ用)
 */
export type BattleEventType =
  | 'game_start'
  | 'phase_change'
  | 'draw'
  | 'play_card'
  | 'attack_declared'
  | 'attack_resolved'
  | 'life_damaged'
  | 'card_destroyed'
  | 'turn_end'
  | 'game_over'
  | 'trigger_activated'    // ライフカードのトリガー効果発動
  | 'defense_blocked'      // 'defense' トリガーにより攻撃無効化
  // ---- v2.0.2 追加 ------------------------------------------------------
  | 'equipment_played'     // 装備カードを場に出した
  | 'event_played'         // イベントカードをプレイ・効果適用
  | 'counter_used'         // カウンターカードを攻撃時に発動
  | 'temp_buff_applied'    // 時限バフ適用
  | 'temp_buff_expired';   // 時限バフ消滅

export interface BattleEvent {
  eventId: string;
  type: BattleEventType;
  turn: number;
  player: PlayerSlot;
  payload: Record<string, unknown>;  // type ごとに詳細
  timestamp: string;                 // ISO8601
}

/**
 * バトルのメイン state
 */
export interface BattleState {
  sessionId: string;                 // DB の battle_sessions.id (bigint を文字列化)
  turn: number;                      // 1-indexed (両者のターンを通したラウンド数)
  firstPlayer: PlayerSlot;           // 先攻プレイヤー (マナ計算に使用)、v2.0-launch では 'p1' 固定
  activePlayer: PlayerSlot;
  phase: BattlePhase;
  players: {
    p1: PlayerState;
    p2: PlayerState;
  };
  log: BattleEvent[];
  winner: BattleWinner | null;
  startedAt: string;
  endedAt: string | null;
  /**
   * v2.0.2 Phase 6b-4: AI 攻撃時に防御側が人間 + 手札カウンターあり + 未指定の
   * 場合に保留される AttackAction。UI が CounterDeclareModal を出して人間に
   * 選択させ、resumeAttackWithCounter で再実行する。null/undefined = 保留なし。
   */
  pendingAttack?: AttackAction | null;
  /**
   * v2.0.2 Phase 6b-3: 人間がイベント / カウンターで対象選択必須の効果
   * (destroy_enemy_char / reveal_then_discard / scry_then_pick / draw_and_buff)
   * をプレイした際、効果発動を保留して UI に対象を選ばせる為の中間状態。
   * resumeEventEffectWithTarget で確定発動 → null に戻す。AI プレイヤーは
   * 即時実行 (従来動作) なのでこの field を使わない。null/undefined = 保留なし。
   */
  pendingTargetSelection?: PendingTargetSelection | null;
}

/**
 * v2.0.2 Phase 6b-3: 人間プレイヤーの対象選択待ち中間状態。
 *
 *   - destroy_enemy_char  : 敵 board の破壊対象キャラ instanceId を選ぶ
 *   - reveal_then_discard : 相手手札から捨てさせる cardInstanceId を選ぶ
 *   - scry_then_pick      : 山札 top 3 (peekedCards) から手札に加える 1 枚を選ぶ
 *   - draw_and_buff       : 自 board の atk +N 対象キャラ instanceId を選ぶ
 *
 * cardInstanceId / cost / handIdx は resume 時にカードを墓地送りする為に保持。
 * peekedCards (scry のみ) は resume 時に山札へ戻す為に保持。
 */
export interface PendingTargetSelection {
  type:
    | 'destroy_enemy_char'
    | 'reveal_then_discard'
    | 'scry_then_pick'
    | 'draw_and_buff';
  cardInstanceId: string;
  cardId: string;
  player: PlayerSlot;
  candidates: string[];
  context?: {
    peekedCards?: BattleCardInstance[];
  };
}

/**
 * DB に保存するスナップショット (state_snapshot jsonb)
 */
export type BattleStateSnapshot = BattleState;

// ---- 4. アクション型 (プレイヤー入力) --------------------------------------

export type BattleActionType =
  | 'mulligan'
  | 'play_card'
  | 'attack'
  | 'end_turn'
  | 'surrender';

export interface BattleActionBase {
  type: BattleActionType;
  player: PlayerSlot;
  timestamp: string;
}

export interface MulliganAction extends BattleActionBase {
  type: 'mulligan';
  keep: boolean;                     // false なら手札全交換
}

export interface PlayCardAction extends BattleActionBase {
  type: 'play_card';
  cardInstanceId: string;            // 手札からの参照
  boardSlotIndex?: number;           // 指定位置 (通常は末尾追加で省略)
}

export interface AttackAction extends BattleActionBase {
  type: 'attack';
  attackerSource:
    | { kind: 'leader' }
    | { kind: 'character'; instanceId: string };
  targetSource:
    | { kind: 'leader' }
    | { kind: 'character'; instanceId: string };
  /**
   * 防御側がカウンターカードを切る場合の手札 instanceId (v2.0.2)。
   *
   * セマンティクス (Phase 6a):
   *   - undefined : 未指定。防御側が AI なら applyAttack 内で
   *                 decideCounterUse により自動判定される。
   *   - null      : 人間が「カウンターしない」を明示。AI 自動判定もスキップ。
   *   - string    : 既に指定済 (人間 UI が選択 or AI が事前決定済)。
   *                 該当カードを手札→墓地、counter_value を defensePower に加算。
   */
  counterCardInstanceId?: string | null;
}

export interface EndTurnAction extends BattleActionBase {
  type: 'end_turn';
}

export interface SurrenderAction extends BattleActionBase {
  type: 'surrender';
}

export type BattleAction =
  | MulliganAction
  | PlayCardAction
  | AttackAction
  | EndTurnAction
  | SurrenderAction;

// ---- 5. アクション結果型 ---------------------------------------------------

export interface ActionResultOk {
  ok: true;
  newState: BattleState;
  events: BattleEvent[];             // このアクションで発生したイベント
}

export interface ActionResultError {
  ok: false;
  reason: string;                    // UI 表示用メッセージ
  code:
    | 'not_your_turn'
    | 'wrong_phase'
    | 'insufficient_cost'
    | 'board_full'
    | 'card_not_in_hand'
    | 'invalid_target'
    | 'cannot_attack_active'
    | 'summoning_sickness'
    | 'already_rested'
    | 'game_already_over'
    // ---- v2.0.2 装備 / カウンター / イベント関連 -------------------------
    | 'already_equipped'         // 既に他の装備が付いている
    | 'leader_mismatch'          // 装備が別リーダー専用
    | 'not_implemented_yet'      // event / counter は Phase 4-5 で実装
    // ---- v2.0.2 Phase 6b-3 対象選択 UI 関連 ------------------------------
    | 'no_valid_targets'         // 効果対象が 0 件 (例: destroy_enemy_char で敵キャラ 0 体)
    | 'no_pending_selection'     // resume を呼んだが pendingTargetSelection が無い
    // ---- v2.0.2 Phase 6c-4 序盤攻撃ロック (子供向け展開保護) -------------
    | 'attack_locked_early_turns'  // turn 1, 2 は両者攻撃不可 (turn 3 から解禁)
    | 'internal_error';
}

export type ActionResult = ActionResultOk | ActionResultError;

// ---- 6. バトル結果型 -------------------------------------------------------

export interface BattleResult {
  winner: BattleWinner;
  turnCount: number;
  durationSeconds: number;
  altEarned: number;                 // 勝者側のみ、敗者は参加賞
  finalState: BattleState;
}

// ---- 7. AI 思考結果型 ------------------------------------------------------

export interface AIThought {
  chosenAction: BattleAction;
  confidence: number;                // 0-1
  reasoning?: string;                // デバッグ用、本番 UI では表示しない
}

// ---- 8. デッキバリデーション結果 -------------------------------------------

export interface DeckValidationResult {
  isValid: boolean;
  totalCards: number;                // 期待 30 (v2.0-launch、デッキ30枚構成)
  errors: Array<
    | { code: 'wrong_total'; actual: number; expected: number }
    | { code: 'color_violation'; cardId: string; cardColor: BattleColor; leaderColor: BattleColor }
    | { code: 'count_exceeded'; cardId: string; count: number; max: number }
    | { code: 'leader_not_set' }
  >;
}

// ---- 9. UI ヘルパー型 ------------------------------------------------------

/**
 * 手札カードの UI 表示用 props
 */
export interface HandCardProps {
  instance: BattleCardInstance;
  isPlayable: boolean;               // コスト足りる + フェイズ合う
  onPlay?: () => void;
}

/**
 * 場のカード UI 表示用 props
 */
export interface BoardCardProps {
  slot: BoardSlot;
  isOwnSide: boolean;
  isAttackableTarget: boolean;       // 相手キャラで、レスト中かつ攻撃宣言中
  isAttackerSelected: boolean;
  onClick?: () => void;
}

// ---- 10. エクスポート確認用 -------------------------------------------------

// 開発時の型チェック: これで全ての主要型が export されている
// (何か追加したら同様にここに追記)
export type _BattleTypesManifest = {
  colors: BattleColor;
  phases: BattlePhase;
  state: BattleState;
  action: BattleAction;
  result: ActionResult;
  dbRow: BattleSessionRow;
};
