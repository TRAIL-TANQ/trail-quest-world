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

export type CardType = 'character' | 'event' | 'stage';

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
  card_type: CardType;           // v2.0: 全て 'character'
  cost: number;                  // 1-10
  power: number;                 // (廃止予定、後方互換のため残存、後日 DROP)
  attack_power: number;          // 1-12 (1/1000スケール、v2.0-launch)
  defense_power: number;         // 1-12 (1/1000スケール、v2.0-launch)
  color: BattleColor;
  is_leader: boolean;            // v2.0: false 固定
  effect_text: string | null;    // v2.0: null
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
 * プレイヤー1人のフル state
 */
export interface PlayerState {
  id: string;                        // child_id or 'ai'
  leader: LeaderState;
  hand: BattleCardInstance[];        // UI 順序
  deck: BattleCardInstance[];        // 山札、[0] = top
  lifeCards: BattleCardInstance[];   // 裏向きライフ、[0] = top
  board: BoardSlot[];                // 最大5枠
  graveyard: BattleCardInstance[];
  currentCost: number;               // 残コスト
  maxCost: number;                   // = turn number、max 10
  hasDrawnThisTurn: boolean;
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
  | 'game_over';

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
  turn: number;                      // 1-indexed
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
