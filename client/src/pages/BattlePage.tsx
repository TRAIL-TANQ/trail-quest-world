/**
 * BattlePage — 🎴 カードバトル v2 本体
 *
 * v2.0-launch: 最小完走版。AI は Easy 固定。マリガン自動 keep。
 *
 * D4 段階の実装スコープ:
 *   - URL params から leaderId / deckId を読み取り、startBattle を呼ぶ
 *   - 初期 state を refresh→draw→cost→main まで自動進行
 *   - 手札 / 自分ボード / 相手ボード / ライフ / コストの可視化
 *   - エンドターン (end_turn) + AI ターン (runAITurn) 自動進行
 *   - 手札タップで play_card (コスト判定 OK なら即発動)
 *   - 自分キャラ/リーダータップでアタッカー選択 (視覚ハイライト)
 *   - 敵キャラ (レスト中) / 敵リーダータップで attack
 *   - 降参ボタン (確認ダイアログ → surrender)
 *   - state.winner 確定で BattleResultModal 表示
 *     - 勝利: 「やったね!」+ ALT +10 表示
 *     - 敗北: 「つぎはがんばろう」+ ALT +2 表示
 *     - [もう一度] /battle/select / [ホームへ] /
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { getChildId } from '@/lib/auth';
import {
  ATTACK_UNLOCK_TURN,
  applyAction,
  resumeAttackWithCounter,
  resumeEventEffectWithTarget,
} from '@/lib/battle/battleActions';
import { runAITurn } from '@/lib/battle/battleAI';
import { advancePhase, BOARD_MAX_SLOTS } from '@/lib/battle/battleEngine';
import {
  fetchLeaders,
  fetchPresetDecks,
  getCardEffectText,
  getCardName,
  resolveCardImage,
  startBattle,
  type PresetDeck,
} from '@/lib/battleService';
import {
  ALT_BATTLE_LOSE,
  ALT_BATTLE_WIN,
  processBattleResult,
} from '@/lib/altGameService';
import type {
  AttackAction,
  BattleCardInstance,
  BattleLeaderRow,
  BattleState,
  BattleWinner,
  BoardSlot,
  CardType,
  LeaderState,
  PendingTargetSelection,
  PlayerSlot,
  TriggerType,
} from '@/lib/battle/battleTypes';

// アタッカー選択 ID の型: null=未選択 / 'leader'=リーダー / それ以外=character.instanceId
type SelectedAttacker = null | 'leader' | string;

// ALT 報酬の定数は altGameService で一元管理 (ALT_BATTLE_WIN / ALT_BATTLE_LOSE)。
// ここでは processBattleResult() の戻り値を優先し、非同期完了前の fallback としてのみ使用。

// ---- Phase 6c-2: カード種別別のスタイル / リボン -------------------------
//
// 手札 (HandCard) と CardFallback の両方で使う種別カラーテーマ。
//
//   character : neutral (slate, リボン無し) — 既存の見た目を維持
//   equipment : gold (装備アイコン Phase 6b-1 と統一)
//   counter   : blue (Phase 6c-5「ふせいだ！」の青と統一)
//   event     : purple (EventBanner Phase 6b-2 の紫と統一)
//   stage     : v2 では未使用、neutral プレースホルダ
//
// 子供向けに「色＋漢字一文字リボン」の二重表現で見分けやすくする。
//   装 (equipment) / 盾 (counter) / 事 (event)

const CARD_TYPE_STYLES: Record<
  CardType,
  {
    /** HandCard 外枠 (border 太さ + 色) */
    border: string;
    /** HandCard 背景 tint (薄め) */
    bg: string;
    /** HandCard グロウ (色強調) */
    glow: string;
    /** リボン背景色 */
    ribbonBg: string;
    /** リボン文字 (空文字 = リボン非表示) */
    ribbonLabel: string;
    /** CardFallback 外枠色 (border-2) */
    fallbackBorder: string;
    /** CardFallback 種別アイコン色 */
    fallbackIconColor: string;
  }
> = {
  character: {
    border: 'border border-slate-300/50',
    bg: '',
    glow: '',
    ribbonBg: '',
    ribbonLabel: '',
    fallbackBorder: 'border-yellow-400/80', // 既存維持 (battlefield 画像 404 回帰防止)
    fallbackIconColor: 'text-yellow-200/85',
  },
  equipment: {
    border: 'border-2 border-yellow-400',
    bg: 'bg-yellow-950/25',
    glow: 'shadow-[0_0_10px_rgba(250,204,21,0.45)]',
    ribbonBg: 'bg-yellow-500',
    ribbonLabel: '装',
    fallbackBorder: 'border-yellow-300',
    fallbackIconColor: 'text-yellow-200/90',
  },
  counter: {
    border: 'border-2 border-blue-400',
    bg: 'bg-blue-950/30',
    glow: 'shadow-[0_0_10px_rgba(96,165,250,0.5)]',
    ribbonBg: 'bg-blue-500',
    ribbonLabel: '盾',
    fallbackBorder: 'border-blue-400',
    fallbackIconColor: 'text-blue-200/90',
  },
  event: {
    border: 'border-2 border-purple-400',
    bg: 'bg-purple-950/30',
    glow: 'shadow-[0_0_10px_rgba(192,132,252,0.5)]',
    ribbonBg: 'bg-purple-500',
    ribbonLabel: '事',
    fallbackBorder: 'border-purple-400',
    fallbackIconColor: 'text-purple-200/90',
  },
  stage: {
    // 将来用 (現状未使用)
    border: 'border border-slate-400/50',
    bg: '',
    glow: '',
    ribbonBg: 'bg-slate-500',
    ribbonLabel: '場',
    fallbackBorder: 'border-slate-400',
    fallbackIconColor: 'text-slate-200/85',
  },
};

// ---- CardFallback: 画像未登録/404 時の placeholder (Phase 6c-7) ----------

/**
 * resolveCardImage が src を返せない (マッピング未登録 / 404) ときに
 * 描画するカード placeholder。
 *
 * デザイン (子供向け):
 *   - gold border (border-yellow-400)
 *   - 中央に種別アイコン (装備=⚙、カウンター=🛡、イベント=✨、キャラ=⚔、ステージ=🌐)
 *   - 下部に小さく card.name (alt 焼き込みではなく独立したテキスト帯として配置)
 *
 * 使い方は Phase 6b-1.5 で EquipmentIcon が確立したパターンに準拠:
 * 各消費側コンポーネントが独自に useState(imgErrored) と <img onError> を持ち、
 * 画像不可と判定したら本コンポーネントを返す。共通の CardImage ラッパは廃止。
 */
function CardFallback({
  card,
  className,
}: {
  card: BattleCardInstance;
  className?: string;
}) {
  const icon =
    card.cardType === 'equipment'
      ? '⚙'
      : card.cardType === 'counter'
        ? '🛡'
        : card.cardType === 'event'
          ? '✨'
          : card.cardType === 'stage'
            ? '🌐'
            : '⚔';
  // Phase 6c-2: 種別別の枠色 / アイコン色を CARD_TYPE_STYLES から拾う。
  // character は既存 yellow-400 を維持 (battlefield 画像 404 時の回帰防止)。
  const style = CARD_TYPE_STYLES[card.cardType];
  return (
    <div
      className={`${className ?? ''} relative flex flex-col border-2 ${style.fallbackBorder} bg-gradient-to-br from-slate-800/95 to-slate-900/95`}
    >
      <div
        className={`flex-1 flex items-center justify-center text-2xl ${style.fallbackIconColor} leading-none select-none`}
      >
        {icon}
      </div>
      <div className="bg-black/70 text-[8px] leading-tight text-yellow-100 text-center px-0.5 py-[2px] truncate">
        {card.name}
      </div>
    </div>
  );
}

function LeaderImage({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  const [errored, setErrored] = useState(false);
  if (errored || !src) {
    return (
      <div
        className={`${className ?? ''} flex items-center justify-center text-[9px] text-white/60 text-center`}
        style={{
          background:
            'linear-gradient(135deg, rgba(60,60,80,0.9), rgba(30,30,50,0.9))',
        }}
      >
        {alt}
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      draggable={false}
      onError={() => setErrored(true)}
    />
  );
}

// ---- EquipmentIcon: リーダー隣に表示する装備カードアイコン (Phase 6b-1) -----

/**
 * 現在装備中のカードを縦長アイコン (w-12 aspect-[3/4]) で表示。
 *
 * - 右上に「装」マーク (gold/yellow)
 * - once_only 装備が発動済 (`onceUsed=true`) なら半透明 + グレースケール
 *   + 中央に「使用済」オーバーレイ
 * - card=null なら何も描画しない (= 装備していない時は完全に非表示)
 *
 * Phase 6b-1.5: 共通 CardImage は 404 時に alt(=card.name) をテキストとして
 * 画面に焼き込むため、装備アイコンでは使わない。直接 <img> + onError で
 * 画像非表示にし、枠と「装」マークだけが残るようにする (cardId テキスト出ない)。
 */
function EquipmentIcon({
  card,
  onceUsed,
  size = 'md',
}: {
  card: BattleCardInstance | null;
  onceUsed?: boolean;
  size?: 'sm' | 'md';
}) {
  const [imgErrored, setImgErrored] = useState(false);
  if (!card) return null;
  const widthClass = size === 'sm' ? 'w-9' : 'w-12';
  const src = resolveCardImage(card.cardId);
  const showImg = !imgErrored && Boolean(src);
  return (
    <div
      className={`relative ${widthClass} aspect-[3/4] rounded-md overflow-hidden border-2 border-yellow-400 shadow-[0_0_6px_rgba(255,215,0,0.4)] bg-black/40 flex-shrink-0`}
      title={`${card.name}${onceUsed ? ' (使用済)' : ''}`}
    >
      {showImg && (
        <img
          src={src}
          alt=""
          aria-hidden="true"
          draggable={false}
          onError={() => setImgErrored(true)}
          className={`w-full h-full object-cover ${onceUsed ? 'opacity-50 grayscale' : ''}`}
        />
      )}
      <div className="absolute top-0 right-0 bg-yellow-500/90 text-black text-[8px] font-bold px-1 rounded-bl leading-tight">
        装
      </div>
      {onceUsed && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/55">
          <span className="text-white text-[9px] font-bold">使用済</span>
        </div>
      )}
    </div>
  );
}

// ---- EventBanner: イベント / カウンター場プレイ時の中央バナー (Phase 6b-2) ---

interface EventBannerData {
  cardId: string;
  cardName: string;
  effectText: string;
  type: 'event' | 'counter';
  /** mount 毎にユニークな key にして再アニメーションを起こさせる */
  key: number;
}

function EventBanner({
  data,
  onDismiss,
}: {
  data: EventBannerData | null;
  onDismiss: () => void;
}) {
  // バナー表示後 1500ms で自動消去 (CSS animation 終了と同期)
  useEffect(() => {
    if (!data) return;
    const t = setTimeout(onDismiss, 1500);
    return () => clearTimeout(t);
  }, [data, onDismiss]);

  if (!data) return null;

  const icon = data.type === 'event' ? '⚡' : '🛡';
  const accentClass =
    data.type === 'event'
      ? 'from-purple-600/95 to-blue-700/95'
      : 'from-amber-600/95 to-yellow-700/95';

  return (
    <div
      key={data.key}
      className={`fixed top-1/3 left-1/2 z-50 px-6 py-4 rounded-xl bg-gradient-to-r ${accentClass} shadow-2xl border-2 border-white/30 backdrop-blur-sm pointer-events-none animate-event-banner`}
      style={{ minWidth: '280px', maxWidth: '90vw' }}
    >
      <div className="flex items-center gap-3">
        <span className="text-3xl leading-none">{icon}</span>
        <div className="flex-1">
          <div className="text-white font-bold text-lg leading-tight">
            {data.cardName}
          </div>
          {data.effectText && (
            <div className="text-white/90 text-sm mt-0.5 leading-snug">
              {data.effectText}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---- AttackAnimation: 誰が誰を攻撃したかの視覚演出 (Phase 6b-5) -----------

/**
 * 直近の attack イベント情報を保持。state.log の差分から構築され、
 * 600ms 後に自動クリアされる。LeaderBadge / BoardCardSlot で
 * isAttacking / isTargeted / result を判定して該当 anim class を当てる。
 */
interface AttackAnimation {
  attackerSide: PlayerSlot;
  attackerKind: 'leader' | 'character';
  attackerInstanceId?: string;
  targetSide: PlayerSlot;
  targetKind: 'leader' | 'character';
  targetInstanceId?: string;
  /**
   * - pending   : attack_declared のみ (続報待ち、UI では shake 扱い)
   * - blocked   : attack_resolved.success === false or defense_blocked
   * - hit       : life_damaged (リーダーへヒット, シールド消費)
   * - destroyed : card_destroyed or game_over (リーダー破壊)
   */
  result: 'pending' | 'blocked' | 'hit' | 'destroyed';
  /** 同じ attacker→target が連続した時に再アニメ起動するための key */
  key: number;
}

/**
 * BattleState 内のすべての場所 (graveyard / hand / deck / lifeCards / board /
 * equippedCard) から cardId 一致の BattleCardInstance を探して返す。
 * バナー表示時に直近プレイされた card.name / effectText を取り出すための
 * ヘルパ。最初にヒットしたインスタンスを返す (graveyard を優先)。
 */
function findCardInstance(
  state: BattleState,
  cardId: string,
): BattleCardInstance | null {
  for (const p of [state.players.p1, state.players.p2]) {
    for (const c of p.graveyard) if (c.cardId === cardId) return c;
    for (const c of p.hand) if (c.cardId === cardId) return c;
    for (const c of p.deck) if (c.cardId === cardId) return c;
    for (const c of p.lifeCards) if (c.cardId === cardId) return c;
    for (const s of p.board) if (s.card.cardId === cardId) return s.card;
    if (p.equippedCard?.cardId === cardId) return p.equippedCard;
  }
  return null;
}

/**
 * instanceId 一致で BattleCardInstance を探して返す (Phase 6c-5)。
 * 攻撃直後のスナップショットでは攻撃側キャラはレストで board に残り、
 * 破壊された防御キャラは graveyard、消費されたカウンターも graveyard、
 * defense トリガーは lifeCards に残る — いずれも本関数で発見可能。
 */
function findInstanceById(
  state: BattleState,
  instanceId: string,
): BattleCardInstance | null {
  for (const p of [state.players.p1, state.players.p2]) {
    for (const c of p.graveyard) if (c.instanceId === instanceId) return c;
    for (const c of p.hand) if (c.instanceId === instanceId) return c;
    for (const c of p.deck) if (c.instanceId === instanceId) return c;
    for (const c of p.lifeCards) if (c.instanceId === instanceId) return c;
    for (const s of p.board) if (s.card.instanceId === instanceId) return s.card;
    if (p.equippedCard?.instanceId === instanceId) return p.equippedCard;
  }
  return null;
}

// ---- AttackResolutionBanner: 攻防対面表示バナー (Phase 6c-5) -------------

/**
 * 攻撃時に画面中央へ「攻撃カード ↔ 防御カード」を 1.5 倍サイズで対面表示する
 * 演出。Phase 6b-5 の battlefield アニメ (lunge/shake/block/destroy) と
 * 並行で動かし、子供にも誰が誰を攻撃したかと結果が直感的に伝わるようにする。
 *
 *   Phase A (0-800ms)   : 双方カード + 値 + 中央矢印
 *   Phase B (800-2000ms): 結果オーバーレイ追加
 *     - hit       : 防御カードに ❌ + 「ヒット！」赤
 *     - blocked   : 防御カードに 🛡 + 「ふせいだ！」青
 *     - counter   : 防御カードを counter カード画像に flip 切替 + 「カウンター成功！」金
 *     - trigger   : 防御カード上に trigger カード重ね表示 + 「トリガー！」紫
 *     - destroyed : 防御カード フェード暗転 + 「破壊！」赤
 *   T=2000ms から 200ms フェードアウトして消去。
 */

type ResolutionCardData =
  | { kind: 'leader'; leaderId: string; name: string; imageUrl: string }
  | { kind: 'card'; instance: BattleCardInstance };

type AttackResultKind = 'hit' | 'blocked' | 'counter' | 'trigger' | 'destroyed';

interface AttackScene {
  phase: 'A' | 'B';
  attackerCard: ResolutionCardData;
  defenderCard: ResolutionCardData;
  attackPower: number;
  defensePower: number;
  result: AttackResultKind;
  /** counter 成功時、phase B で防御カード位置に切り替えるカウンターカード */
  counterCard?: BattleCardInstance;
  /** defense トリガー発動時、防御カード上に重ねるトリガーカード */
  triggerCard?: BattleCardInstance;
  /** 連続攻撃時の再アニメ key */
  key: number;
}

/**
 * attack_declared payload の attacker/target 情報から ResolutionCardData を構築。
 * leader はまだ場にいるので state から直引き、character は instanceId で
 * findInstanceById を使う。失敗時はカードプレースホルダを synthesize して
 * 名前だけ表示できるようにする (CardFallback 経由)。
 */
function makeResolutionCardData(
  state: BattleState,
  side: PlayerSlot,
  kind: 'leader' | 'character',
  instanceId: string | undefined,
  fallbackName: string,
  leaderRowMap: Map<string, BattleLeaderRow>,
): ResolutionCardData {
  if (kind === 'leader') {
    const leader = state.players[side].leader;
    return {
      kind: 'leader',
      leaderId: leader.id,
      name: leader.name,
      imageUrl: leaderRowMap.get(leader.id)?.image_url ?? '',
    };
  }
  const inst = instanceId ? findInstanceById(state, instanceId) : null;
  if (inst) return { kind: 'card', instance: inst };
  return {
    kind: 'card',
    instance: {
      instanceId: instanceId ?? 'unknown',
      cardId: 'unknown',
      name: fallbackName,
      cost: 0,
      power: 0,
      attackPower: 0,
      defensePower: 0,
      color: 'colorless',
      cardType: 'character',
      effectText: null,
      triggerType: null,
      counterValue: 0,
    },
  };
}

function ResolutionCardDisplay({
  card,
  value,
  icon,
  overlay,
  triggerCard,
  counterFlip,
}: {
  card: ResolutionCardData;
  value: number;
  icon: string;
  overlay?: AttackResultKind;
  triggerCard?: BattleCardInstance;
  counterFlip?: boolean;
}) {
  const [imgErrored, setImgErrored] = useState(false);
  const [trigImgErrored, setTrigImgErrored] = useState(false);

  const src =
    card.kind === 'leader'
      ? card.imageUrl
      : resolveCardImage(card.instance.cardId);
  const showImg = !imgErrored && Boolean(src);

  const trigSrc = triggerCard ? resolveCardImage(triggerCard.cardId) : '';
  const showTrigImg = Boolean(triggerCard) && !trigImgErrored && Boolean(trigSrc);

  // CardFallback は BattleCardInstance を要求するため leader は同形 placeholder に変換
  const fallbackInstance: BattleCardInstance =
    card.kind === 'card'
      ? card.instance
      : {
          instanceId: card.leaderId,
          cardId: card.leaderId,
          name: card.name,
          cost: 0,
          power: 0,
          attackPower: 0,
          defensePower: 0,
          color: 'colorless',
          cardType: 'character',
          effectText: null,
          triggerType: null,
          counterValue: 0,
        };

  return (
    <div className="relative">
      <div
        className={`relative w-28 sm:w-32 aspect-[3/4] rounded-lg overflow-hidden border-2 border-yellow-400/70 bg-black/60 shadow-[0_8px_24px_rgba(0,0,0,0.7)] ${
          counterFlip ? 'animate-counterReveal' : ''
        } ${overlay === 'destroyed' ? 'animate-target-destroy' : ''}`}
      >
        {showImg ? (
          <img
            src={src}
            alt=""
            aria-hidden="true"
            draggable={false}
            onError={() => setImgErrored(true)}
            className="w-full h-full object-cover"
          />
        ) : (
          <CardFallback card={fallbackInstance} className="w-full h-full" />
        )}

        {triggerCard && (
          <div className="absolute inset-0 flex items-center justify-center bg-purple-900/55 backdrop-blur-[1px]">
            <div className="w-20 aspect-[3/4] rounded-md overflow-hidden border-2 border-purple-300 shadow-[0_0_12px_rgba(192,132,252,0.7)]">
              {showTrigImg ? (
                <img
                  src={trigSrc}
                  alt=""
                  aria-hidden="true"
                  draggable={false}
                  onError={() => setTrigImgErrored(true)}
                  className="w-full h-full object-cover"
                />
              ) : (
                <CardFallback card={triggerCard} className="w-full h-full" />
              )}
            </div>
          </div>
        )}

        {overlay === 'hit' && (
          <div className="absolute inset-0 flex items-center justify-center bg-red-900/40">
            <span className="text-7xl drop-shadow-[0_0_8px_rgba(0,0,0,0.8)]">
              ❌
            </span>
          </div>
        )}
        {overlay === 'blocked' && (
          <div className="absolute inset-0 flex items-center justify-center bg-blue-900/40">
            <span className="text-6xl drop-shadow-[0_0_8px_rgba(0,0,0,0.8)]">
              🛡
            </span>
          </div>
        )}
      </div>

      <div className="absolute -bottom-7 left-0 right-0 text-center pointer-events-none">
        <span className="inline-block px-2 py-0.5 rounded-md bg-black/85 text-xl font-extrabold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
          {icon} {value}
        </span>
      </div>
    </div>
  );
}

function ResolutionArrowIndicator() {
  return (
    <span className="text-5xl text-yellow-300 drop-shadow-[0_0_10px_rgba(255,215,0,0.9)] animate-resolutionArrow leading-none select-none">
      →
    </span>
  );
}

function ResolutionResultLabel({ result }: { result: AttackResultKind }) {
  const config: Record<AttackResultKind, { text: string; color: string }> = {
    hit: { text: 'ヒット！', color: 'text-red-400' },
    blocked: { text: 'ふせいだ！', color: 'text-blue-300' },
    counter: { text: 'カウンター成功！', color: 'text-yellow-300' },
    trigger: { text: 'トリガー！', color: 'text-purple-300' },
    destroyed: { text: '破壊！', color: 'text-red-500' },
  };
  const { text, color } = config[result];
  return (
    <div
      className={`absolute -top-16 left-1/2 ${color} font-extrabold text-4xl sm:text-5xl tracking-wider animate-resultLabelPop whitespace-nowrap [text-shadow:_0_0_10px_rgba(0,0,0,0.9),_0_2px_6px_rgba(0,0,0,0.9)]`}
    >
      {text}
    </div>
  );
}

function AttackResolutionBanner({ scene }: { scene: AttackScene | null }) {
  if (!scene) return null;

  const phaseB = scene.phase === 'B';
  // counter 成功時は phase B で防御カードを差し替え (flip アニメと連動)
  const displayDefender: ResolutionCardData =
    phaseB && scene.result === 'counter' && scene.counterCard
      ? { kind: 'card', instance: scene.counterCard }
      : scene.defenderCard;

  const defenderOverlay: AttackResultKind | undefined = phaseB
    ? scene.result
    : undefined;

  // displayDefender の identity が変わると ResolutionCardDisplay が remount され、
  // counterFlip / animate-target-destroy などのアニメが再起動する。
  const defenderKey =
    displayDefender.kind === 'card'
      ? displayDefender.instance.instanceId
      : `leader_${displayDefender.leaderId}`;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/55 backdrop-blur-sm pointer-events-none px-4">
      <div className="relative flex items-center justify-center gap-4 sm:gap-6 animate-attackResolution">
        <ResolutionCardDisplay
          card={scene.attackerCard}
          value={scene.attackPower}
          icon="⚔"
        />
        <ResolutionArrowIndicator />
        <ResolutionCardDisplay
          key={defenderKey}
          card={displayDefender}
          value={scene.defensePower}
          icon="🛡"
          overlay={defenderOverlay}
          triggerCard={
            phaseB && scene.result === 'trigger' ? scene.triggerCard : undefined
          }
          counterFlip={phaseB && scene.result === 'counter'}
        />
        {phaseB && <ResolutionResultLabel result={scene.result} />}
      </div>
    </div>
  );
}

// ---- CounterDeclareModal: 人間防御カウンター宣言 (Phase 6b-4) -------------

/**
 * AI 攻撃時に人間プレイヤーへカウンター宣言を促すモーダル。
 *
 * `state.pendingAttack` 経由で attacker / target / 双方の値を取り、
 * 手札のカウンターカードを候補ボタンとして並べる。
 * 「カウンターしない」ボタンも常に提示し、ユーザは必ずどちらかを選ぶ
 * (モーダルの外側クリックでは閉じない pointer-events 設計)。
 */
function CounterDeclareModal({
  state,
  defenderSlot,
  onSelect,
}: {
  state: BattleState;
  defenderSlot: PlayerSlot;
  onSelect: (counterCardInstanceId: string | null) => void;
}) {
  const pending = state.pendingAttack;
  if (!pending) return null;

  const attackerSlot = pending.player;
  const attackerPlayer = state.players[attackerSlot];
  const defenderPlayer = state.players[defenderSlot];

  // attacker info
  let attackerName = '?';
  let attackPower = 0;
  if (pending.attackerSource.kind === 'leader') {
    attackerName = attackerPlayer.leader.name;
    attackPower =
      attackerPlayer.leader.attackPower +
      (attackerPlayer.equipmentBonusAtk ?? 0);
  } else {
    const attInstanceId = pending.attackerSource.instanceId;
    const slot = attackerPlayer.board.find(
      (s) => s.card.instanceId === attInstanceId,
    );
    if (slot) {
      attackerName = slot.card.name;
      attackPower =
        slot.card.attackPower + (attackerPlayer.equipmentBonusAllyAtk ?? 0);
    }
  }

  // target info
  let targetName = '?';
  let defensePower = 0;
  if (pending.targetSource.kind === 'leader') {
    targetName = defenderPlayer.leader.name;
    defensePower =
      defenderPlayer.leader.defensePower +
      (defenderPlayer.equipmentBonusDef ?? 0);
  } else {
    const slot = defenderPlayer.board.find(
      (s) =>
        pending.targetSource.kind === 'character' &&
        s.card.instanceId === pending.targetSource.instanceId,
    );
    if (slot) {
      targetName = slot.card.name;
      defensePower = slot.card.defensePower;
    }
  }

  const counterCards = defenderPlayer.hand.filter(
    (c) => c.cardType === 'counter',
  );

  return (
    <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-gradient-to-br from-slate-900 to-blue-950 border-2 border-yellow-500 rounded-xl shadow-2xl max-w-2xl w-full p-5 max-h-[90vh] overflow-y-auto">
        <h2 className="text-yellow-400 text-xl font-bold mb-3 text-center">
          ⚔ カウンター宣言
        </h2>
        <div className="bg-black/40 rounded-lg p-3 mb-3 text-center">
          <div className="text-white text-sm">
            <span className="text-red-400 font-bold">{attackerName}</span>
            <span className="text-white/60"> ⚔{attackPower} </span>
            <span className="text-xl mx-2">→</span>
            <span className="text-blue-400 font-bold">{targetName}</span>
            <span className="text-white/60"> 🛡{defensePower}</span>
          </div>
        </div>
        <div className="text-white/80 text-xs mb-2">
          手札のカウンターカードを選んで防御値に上乗せできます
        </div>
        <div className="grid grid-cols-2 gap-2 mb-3">
          {counterCards.map((card) => {
            const cv = card.counterValue ?? 0;
            const newDef = defensePower + cv;
            const blocks = attackPower < newDef;
            return (
              <button
                key={card.instanceId}
                onClick={() => onSelect(card.instanceId)}
                className={`border-2 rounded-lg p-2 text-left transition-all ${
                  blocks
                    ? 'bg-amber-700/50 hover:bg-amber-600/70 border-amber-400'
                    : 'bg-slate-800/50 hover:bg-slate-700/70 border-slate-500'
                }`}
              >
                <div className="text-yellow-300 font-bold text-sm truncate">
                  {card.name}
                </div>
                <div className="text-white/80 text-xs">
                  +{cv} 防御 → 🛡{newDef}
                </div>
                {blocks && (
                  <div className="text-green-400 text-xs font-bold mt-0.5">
                    攻撃を防げる
                  </div>
                )}
              </button>
            );
          })}
        </div>
        <button
          onClick={() => onSelect(null)}
          className="w-full py-2 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-lg transition-all text-sm"
        >
          カウンターしない
        </button>
      </div>
    </div>
  );
}

// ---- TargetSelectionModal: 人間プレイヤーの対象選択 (Phase 6b-3) -----------

/**
 * イベント / カウンターカードのうち対象選択必須効果が pending 状態の時、
 * 人間プレイヤーに対象を選ばせるモーダル。
 *
 * - destroy_enemy_char  : 敵 board のキャラを 1 枚選んで破壊
 * - reveal_then_discard : 相手手札を公開し、1 枚選んで捨てさせる
 * - scry_then_pick      : 山札 top 3 (peekedCards) から 1 枚を手札へ
 * - draw_and_buff       : 自 board のキャラを 1 枚選んで atk +N
 *
 * 事前バリデーションで「対象 0 件」は applyPlayEvent 側で弾かれるため、
 * このモーダルが表示される時点で必ず 1 枚以上の候補がある。
 * モーダル外側クリックでは閉じない (pending 状態は対象選択でしか解除されない)。
 */
function TargetSelectionModal({
  state,
  onSelect,
}: {
  state: BattleState;
  onSelect: (targetInstanceId: string) => void;
}) {
  const pending = state.pendingTargetSelection;
  if (!pending) return null;

  const title: Record<PendingTargetSelection['type'], string> = {
    destroy_enemy_char: '破壊するキャラを選んで！',
    reveal_then_discard: '捨てさせるカードを選んで！',
    scry_then_pick: '手札に加える 1 枚を選んで！',
    draw_and_buff: '攻撃力を上げるキャラを選んで！',
  };

  // 候補となる BattleCardInstance を解決
  const me = state.players[pending.player];
  const opponent = state.players[pending.player === 'p1' ? 'p2' : 'p1'];

  let candidateCards: BattleCardInstance[] = [];
  if (pending.type === 'destroy_enemy_char') {
    candidateCards = opponent.board
      .filter((s) => pending.candidates.includes(s.card.instanceId))
      .map((s) => s.card);
  } else if (pending.type === 'reveal_then_discard') {
    candidateCards = opponent.hand.filter((c) =>
      pending.candidates.includes(c.instanceId),
    );
  } else if (pending.type === 'scry_then_pick') {
    candidateCards = pending.context?.peekedCards ?? [];
  } else if (pending.type === 'draw_and_buff') {
    candidateCards = me.board
      .filter((s) => pending.candidates.includes(s.card.instanceId))
      .map((s) => s.card);
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-gradient-to-br from-slate-900 to-blue-950 border-2 border-yellow-500 rounded-xl shadow-2xl max-w-2xl w-full p-5 max-h-[90vh] overflow-y-auto">
        <h2 className="text-yellow-400 text-xl font-bold mb-3 text-center">
          🎯 {title[pending.type]}
        </h2>
        <div className="text-white/80 text-xs mb-3 text-center">
          発動カード:{' '}
          <span className="text-yellow-200 font-bold">
            {getCardName(pending.cardId)}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {candidateCards.map((card) => (
            <TargetCandidateButton
              key={card.instanceId}
              card={card}
              onSelect={onSelect}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Phase 6c-7: TargetSelectionModal の候補ボタン。
 * Phase 6b-1.5 のパターン (独自 img + onError + imgErrored state) を踏襲し、
 * 画像取得不可時は CardFallback を表示。
 *
 * map 内で hooks を呼べないため、必ず単一カード単位の独立コンポーネントとして
 * 切り出す必要がある。
 */
function TargetCandidateButton({
  card,
  onSelect,
}: {
  card: BattleCardInstance;
  onSelect: (instanceId: string) => void;
}) {
  const [imgErrored, setImgErrored] = useState(false);
  const src = resolveCardImage(card.cardId);
  const showImg = !imgErrored && Boolean(src);
  return (
    <button
      onClick={() => onSelect(card.instanceId)}
      className="border-2 rounded-lg p-2 text-left transition-all bg-slate-800/60 hover:bg-amber-700/60 border-slate-500 hover:border-amber-400"
    >
      <div className="flex items-center gap-2">
        <div className="w-12 aspect-[3/4] rounded overflow-hidden bg-black/40 flex-shrink-0">
          {showImg ? (
            <img
              src={src!}
              alt=""
              aria-hidden="true"
              draggable={false}
              onError={() => setImgErrored(true)}
              className="w-full h-full object-cover"
            />
          ) : (
            <CardFallback card={card} className="w-full h-full" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-yellow-300 font-bold text-sm truncate">
            {card.name}
          </div>
          <div className="text-white/70 text-xs leading-tight">
            {card.cardType === 'character' && (
              <>⚔{card.attackPower} 🛡{card.defensePower}</>
            )}
            {card.cardType !== 'character' && (
              <span className="text-white/60">cost {card.cost}</span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

// ---- component ------------------------------------------------------------

export default function BattlePage() {
  const [, navigate] = useLocation();

  const [state, setState] = useState<BattleState | null>(null);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAIThinking, setIsAIThinking] = useState(false);
  // リーダー row を id でひく。image_url と life (最大ライフ) の両方をここから取る。
  const [leaderRowMap, setLeaderRowMap] = useState<Map<string, BattleLeaderRow>>(
    new Map(),
  );
  const [selectedAttacker, setSelectedAttacker] =
    useState<SelectedAttacker>(null);
  // 勝敗確定後に processBattleResult() 経由で加算確定した ALT 量 (1 回のみ計算)。
  // null = 未処理 or 処理中 → フォールバックとして ALT_BATTLE_WIN/LOSE を表示。
  const [altEarnedResult, setAltEarnedResult] = useState<number | null>(null);

  // Phase 6b-2: イベント / カウンター場プレイ時の中央バナー
  const [activeBanner, setActiveBanner] = useState<EventBannerData | null>(
    null,
  );
  // 直前まで処理済みの state.log.length (これ未満は処理済とみなす)
  const lastSeenLogLenRef = useRef(0);

  // Phase 6b-5: 直近の攻撃アニメーション (600ms で自動クリア)
  const [attackAnim, setAttackAnim] = useState<AttackAnimation | null>(null);
  const lastAttackLogLenRef = useRef(0);

  // Phase 6c-5: 攻防対面表示バナー (Phase A 800ms / Phase B 1200ms / fadeout 200ms)
  const [resolutionScene, setResolutionScene] = useState<AttackScene | null>(
    null,
  );
  const lastResolutionLogLenRef = useRef(0);

  // URL params
  const params = useMemo(() => {
    const sp = new URLSearchParams(window.location.search);
    return {
      leaderId: sp.get('leaderId') ?? '',
      deckId: Number(sp.get('deckId') ?? 0),
    };
  }, []);

  // Setup battle on mount
  useEffect(() => {
    if (!params.leaderId || !params.deckId) {
      setError('リーダーまたはデッキが指定されていません');
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        // リーダー一覧を先に取得し、UI 用の row Map を構築 (image_url + life 取得用)
        const leadersList = await fetchLeaders();
        const lMap = new Map<string, BattleLeaderRow>();
        for (const l of leadersList) {
          lMap.set(l.id, l);
        }
        if (!cancelled) setLeaderRowMap(lMap);

        // Pick AI opponent: any preset deck whose leader !== my leader, random choice.
        const presets = await fetchPresetDecks();
        const candidates = presets.filter(
          (p: PresetDeck) => p.deck.leader_id !== params.leaderId,
        );
        if (candidates.length === 0) {
          throw new Error('対戦相手のデッキが見つかりません');
        }
        const aiDeck = candidates[Math.floor(Math.random() * candidates.length)];

        const childId = getChildId();
        const { sessionId: sid, initialState } = await startBattle({
          childId,
          p1LeaderId: params.leaderId,
          p1DeckId: params.deckId,
          p2LeaderId: aiDeck.deck.leader_id,
          p2DeckId: aiDeck.deck.id,
          difficulty: 'easy',
        });
        if (cancelled) return;

        // refresh → draw → cost → main まで自動進行
        let s = initialState;
        let guard = 0;
        while (s.phase !== 'main' && !s.winner && guard++ < 10) {
          s = advancePhase(s);
        }

        setSessionId(sid);
        setState(s);
        setLoading(false);
      } catch (e) {
        if (!cancelled) {
          setError((e as Error).message);
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params.leaderId, params.deckId]);

  // --- 勝敗確定時に ALT 加算 + battle_sessions UPDATE (1 回のみ) ---
  useEffect(() => {
    if (!state) return;
    if (!state.winner) return;
    if (altEarnedResult !== null) return; // 既に処理済み

    const childId = getChildId();
    const startedMs = new Date(state.startedAt).getTime();
    const durationSeconds = Math.max(
      0,
      Math.floor((Date.now() - startedMs) / 1000),
    );
    const capturedSessionId = sessionId ?? -1;
    const capturedWinner = state.winner;
    const capturedTurnCount = state.turn;
    const capturedState = state;

    (async () => {
      try {
        console.log('[BattlePage] processBattleResult start', {
          sessionId: capturedSessionId,
          winner: capturedWinner,
          turnCount: capturedTurnCount,
          durationSeconds,
        });
        const { altEarned } = await processBattleResult({
          childId,
          sessionId: capturedSessionId,
          winner: capturedWinner,
          turnCount: capturedTurnCount,
          durationSeconds,
          finalState: capturedState,
        });
        console.log('[BattlePage] processBattleResult success', { altEarned });
        setAltEarnedResult(altEarned);
      } catch (e) {
        console.warn('[BattlePage] processBattleResult failed, using fallback', e);
        // フォールバック: 加算失敗時も UI は期待値を表示
        setAltEarnedResult(
          capturedWinner === 'p1' ? ALT_BATTLE_WIN : ALT_BATTLE_LOSE,
        );
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.winner]);

  // Phase 6b-2: state.log を監視し、新規追加された 'event_played' /
  // 'counter_used' (mode='play_from_hand') を検出してバナーを表示。
  // attack 時のカウンター発動 (mode='declared_on_attack' / 'ai_auto') は
  // バナー対象外 (戦闘演出と別レイヤで扱う想定)。
  useEffect(() => {
    if (!state) {
      lastSeenLogLenRef.current = 0;
      return;
    }
    const log = state.log;
    if (log.length <= lastSeenLogLenRef.current) {
      lastSeenLogLenRef.current = log.length;
      return;
    }
    const newEvents = log.slice(lastSeenLogLenRef.current);
    lastSeenLogLenRef.current = log.length;

    // 新規イベント中で最後のバナー対象を採用
    for (let i = newEvents.length - 1; i >= 0; i--) {
      const evt = newEvents[i];
      let bannerType: EventBannerData['type'] | null = null;
      if (evt.type === 'event_played') {
        bannerType = 'event';
      } else if (
        evt.type === 'counter_used' &&
        (evt.payload as { mode?: string }).mode === 'play_from_hand'
      ) {
        bannerType = 'counter';
      }
      if (!bannerType) continue;

      const cardId = (evt.payload as { cardId?: string }).cardId;
      if (!cardId) continue;
      const card = findCardInstance(state, cardId);
      if (!card) continue;

      setActiveBanner({
        cardId,
        cardName: card.name,
        effectText: card.effectText ?? '',
        type: bannerType,
        key: Date.now(), // 連続発火時の再アニメ trigger
      });
      break;
    }
  }, [state]);

  // Phase 6b-5: state.log を監視し、attack_declared を起点にアニメ state を構築。
  // 後続の attack_resolved / defense_blocked / life_damaged / card_destroyed /
  // game_over (leader_destroyed) で result を確定させる。同 batch (1 setState)
  // 内に複数 attack があった場合は最後のものを採用 (Easy AI では稀)。
  useEffect(() => {
    if (!state) {
      lastAttackLogLenRef.current = 0;
      return;
    }
    const log = state.log;
    if (log.length <= lastAttackLogLenRef.current) {
      lastAttackLogLenRef.current = log.length;
      return;
    }
    const newEvents = log.slice(lastAttackLogLenRef.current);
    lastAttackLogLenRef.current = log.length;

    let declared:
      | {
          attackerSide: PlayerSlot;
          attackerKind: 'leader' | 'character';
          attackerInstanceId?: string;
          targetSide: PlayerSlot;
          targetKind: 'leader' | 'character';
          targetInstanceId?: string;
        }
      | null = null;
    let result: AttackAnimation['result'] = 'pending';

    for (const evt of newEvents) {
      if (evt.type === 'attack_declared') {
        const p = evt.payload as Record<string, unknown>;
        declared = {
          attackerSide: p.attackerSide as PlayerSlot,
          attackerKind: p.attackerKind as 'leader' | 'character',
          attackerInstanceId: p.attackerInstanceId as string | undefined,
          targetSide: p.targetSide as PlayerSlot,
          targetKind: p.targetKind as 'leader' | 'character',
          targetInstanceId: p.targetInstanceId as string | undefined,
        };
        result = 'pending';
      } else if (declared) {
        if (evt.type === 'attack_resolved') {
          const success = (evt.payload as { success?: boolean }).success;
          if (success === false) result = 'blocked';
        } else if (evt.type === 'defense_blocked') {
          result = 'blocked';
        } else if (evt.type === 'card_destroyed') {
          // applyAttack 由来の card 破壊 (キャラへの攻撃成功)
          // 別経路 (event_play や trigger) も同 type だが、
          // attack_declared 直近では基本攻撃の結果と判定して問題なし
          result = 'destroyed';
        } else if (evt.type === 'life_damaged') {
          result = 'hit';
        } else if (evt.type === 'game_over') {
          const reason = (evt.payload as { reason?: string }).reason;
          if (reason === 'leader_destroyed') result = 'destroyed';
        }
      }
    }

    if (declared) {
      setAttackAnim({ ...declared, result, key: Date.now() });
    }
  }, [state]);

  // Phase 6b-5: attackAnim を 600ms で自動クリア (CSS animation 終了と同期)
  useEffect(() => {
    if (!attackAnim) return;
    const t = setTimeout(() => setAttackAnim(null), 600);
    return () => clearTimeout(t);
  }, [attackAnim]);

  // Phase 6c-5: state.log を監視し、attack_declared を起点に攻防対面シーンを構築。
  // 同 batch 内に attack_declared 以降の関連イベント (counter_used /
  // attack_resolved / defense_blocked / card_destroyed / life_damaged /
  // game_over) を順に解釈して result を確定し、scene にスナップショット。
  useEffect(() => {
    if (!state) {
      lastResolutionLogLenRef.current = 0;
      return;
    }
    const log = state.log;
    if (log.length <= lastResolutionLogLenRef.current) {
      lastResolutionLogLenRef.current = log.length;
      return;
    }
    const newEvents = log.slice(lastResolutionLogLenRef.current);
    lastResolutionLogLenRef.current = log.length;

    let declaredIdx = -1;
    for (let i = newEvents.length - 1; i >= 0; i--) {
      if (newEvents[i].type === 'attack_declared') {
        declaredIdx = i;
        break;
      }
    }
    if (declaredIdx < 0) return;

    const declared = newEvents[declaredIdx];
    const declP = declared.payload as Record<string, unknown>;

    let triggerHappened = false;
    let counterDeclared = false;
    let charDestroyed = false;
    let lifeDamaged = false;
    let leaderDestroyed = false;
    let success = true;
    let counterInstanceId: string | undefined;
    let triggerInstanceId: string | undefined;

    for (let i = declaredIdx + 1; i < newEvents.length; i++) {
      const evt = newEvents[i];
      if (evt.type === 'attack_declared') break; // 次の attack に切り替わる
      if (evt.type === 'counter_used') {
        const p = evt.payload as { mode?: string; instanceId?: string };
        if (p.mode === 'declared_on_attack' && p.instanceId) {
          counterDeclared = true;
          counterInstanceId = p.instanceId;
        }
      } else if (evt.type === 'attack_resolved') {
        const p = evt.payload as { success?: boolean };
        success = p.success === true;
      } else if (evt.type === 'defense_blocked') {
        const p = evt.payload as { instanceId?: string };
        triggerHappened = true;
        triggerInstanceId = p.instanceId;
      } else if (evt.type === 'card_destroyed') {
        const p = evt.payload as { source?: string };
        if (p.source !== 'trigger_destroy') charDestroyed = true;
      } else if (evt.type === 'life_damaged') {
        lifeDamaged = true;
      } else if (evt.type === 'game_over') {
        const p = evt.payload as { reason?: string };
        if (p.reason === 'leader_destroyed') leaderDestroyed = true;
      }
    }

    let result: AttackResultKind;
    if (triggerHappened) result = 'trigger';
    else if (counterDeclared && !success) result = 'counter';
    else if (charDestroyed) result = 'destroyed';
    else if (lifeDamaged || leaderDestroyed) result = 'hit';
    else if (!success) result = 'blocked';
    else result = 'hit';

    const attackerSide = declP.attackerSide as PlayerSlot;
    const attackerKind = declP.attackerKind as 'leader' | 'character';
    const attackerInstanceId = declP.attackerInstanceId as string | undefined;
    const attackerName = (declP.attackerName as string) ?? '?';
    const targetSide = declP.targetSide as PlayerSlot;
    const targetKind = declP.targetKind as 'leader' | 'character';
    const targetInstanceId = declP.targetInstanceId as string | undefined;
    const targetName = (declP.targetName as string) ?? '?';
    const attackPower = (declP.attackPower as number) ?? 0;
    const defensePower = (declP.defensePower as number) ?? 0;

    const attackerCard = makeResolutionCardData(
      state,
      attackerSide,
      attackerKind,
      attackerInstanceId,
      attackerName,
      leaderRowMap,
    );
    const defenderCard = makeResolutionCardData(
      state,
      targetSide,
      targetKind,
      targetInstanceId,
      targetName,
      leaderRowMap,
    );
    const counterCard = counterInstanceId
      ? findInstanceById(state, counterInstanceId) ?? undefined
      : undefined;
    const triggerCard = triggerInstanceId
      ? findInstanceById(state, triggerInstanceId) ?? undefined
      : undefined;

    setResolutionScene({
      phase: 'A',
      attackerCard,
      defenderCard,
      attackPower,
      defensePower,
      result,
      counterCard,
      triggerCard,
      key: Date.now(),
    });
  }, [state, leaderRowMap]);

  // Phase 6c-5: 800ms で Phase A → B、2200ms で消去。
  // resolutionScene.key を依存にして、新 attack 到来で必ず両 timer をリセットする。
  useEffect(() => {
    if (!resolutionScene) return;
    const sceneKey = resolutionScene.key;
    const phaseTimer = setTimeout(() => {
      setResolutionScene((prev) =>
        prev && prev.key === sceneKey ? { ...prev, phase: 'B' } : prev,
      );
    }, 800);
    const clearTimer = setTimeout(() => {
      setResolutionScene((prev) =>
        prev && prev.key === sceneKey ? null : prev,
      );
    }, 2200);
    return () => {
      clearTimeout(phaseTimer);
      clearTimeout(clearTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolutionScene?.key]);

  // AI turn trigger: activePlayer=='p2' になったら少し遅らせて runAITurn
  useEffect(() => {
    if (!state) return;
    if (state.winner) return;
    if (state.activePlayer !== 'p2') return;
    if (isAIThinking) return;
    // Phase 6b-4: 人間のカウンター宣言待ちなら AI を起動しない
    if (state.pendingAttack) return;
    // Phase 6b-3: 人間の対象選択待ちなら AI を起動しない
    // (pending は人間プレイヤーが発動した時にしかセットされないが、念のため)
    if (state.pendingTargetSelection) return;

    console.log('[BattlePage] AI turn start trigger', {
      turn: state.turn,
      phase: state.phase,
      p2Hand: state.players.p2.hand.length,
      p2Board: state.players.p2.board.length,
    });

    setIsAIThinking(true);

    // メインタイマー: 600ms 後に runAITurn 実行
    const mainTimer = setTimeout(() => {
      console.log('[BattlePage] AI main timer fired, invoking runAITurn');
      const before = state;
      const { finalState, events } = runAITurn(before, 'p2');
      console.log('[BattlePage] runAITurn returned', {
        sameRef: finalState === before,
        activePlayer: finalState.activePlayer,
        winner: finalState.winner,
        eventsCount: events.length,
      });

      // state が変化していない (同一参照) 場合、React は再レンダーしない
      // → 強制的に新しい参照で setState して useEffect を回す
      if (finalState === before) {
        console.warn('[BattlePage] AI returned same state — forcing new ref');
        setState({ ...before });
      } else {
        setState(finalState);
      }
      setIsAIThinking(false);
    }, 600);

    // 保険タイマー (watchdog): 30 秒経っても進行しなければ強制 end_turn
    const watchdog = setTimeout(() => {
      console.error(
        '[BattlePage] AI WATCHDOG TRIGGERED — AI did not finish in 30s, forcing end_turn',
      );
      const forced = applyAction(state, {
        type: 'end_turn',
        player: 'p2',
        timestamp: new Date().toISOString(),
      });
      if (forced.ok) {
        setState(forced.newState);
      } else {
        console.error(
          '[BattlePage] watchdog force end_turn ALSO failed',
          forced.code,
          forced.reason,
        );
      }
      setIsAIThinking(false);
    }, 30_000);

    return () => {
      clearTimeout(mainTimer);
      clearTimeout(watchdog);
      setIsAIThinking(false);
    };
    // state は依存に含めるが、isAIThinking は含めない (ループ防止)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  // --- プレイヤー操作可能かの判定 -------------------------------------------

  function isPlayerActing(): boolean {
    return Boolean(
      state &&
        !state.winner &&
        state.activePlayer === 'p1' &&
        state.phase === 'main' &&
        !isAIThinking &&
        !state.pendingTargetSelection,
    );
  }

  // --- Phase 6b-4: カウンター宣言モーダルでの選択処理 -------------------------

  // --- Phase 6b-3: 対象選択モーダルでの選択処理 ----------------------------

  function handleTargetSelect(targetInstanceId: string) {
    if (!state) return;
    if (!state.pendingTargetSelection) return;
    console.log('[BattlePage] handleTargetSelect', {
      type: state.pendingTargetSelection.type,
      targetInstanceId,
    });
    const result = resumeEventEffectWithTarget(state, { targetInstanceId });
    if (!result.ok) {
      console.warn(
        '[BattlePage] resumeEventEffectWithTarget failed:',
        result.code,
        result.reason,
      );
      return;
    }
    setState(result.newState);
  }

  function handleCounterChoice(counterCardInstanceId: string | null) {
    if (!state) return;
    if (!state.pendingAttack) return;
    console.log('[BattlePage] handleCounterChoice', {
      pendingAttacker: state.pendingAttack.player,
      choice: counterCardInstanceId === null ? 'pass' : 'use_counter',
      counterCardInstanceId,
    });
    const result = resumeAttackWithCounter(state, counterCardInstanceId);
    if (!result.ok) {
      console.warn(
        '[BattlePage] resumeAttackWithCounter failed:',
        result.code,
        result.reason,
      );
      return;
    }
    setState(result.newState);
    // 攻撃が解決し pendingAttack は null。activePlayer が 'p2' のままなら
    // useEffect が再発火して runAITurn が次のアクションを進める。
  }

  // --- 手札タップ: play_card --------------------------------------------------

  function handlePlayCard(card: BattleCardInstance) {
    if (!state || !isPlayerActing()) return;
    if (state.players.p1.currentCost < card.cost) return;
    if (state.players.p1.board.length >= BOARD_MAX_SLOTS) return;

    const result = applyAction(state, {
      type: 'play_card',
      player: 'p1',
      timestamp: new Date().toISOString(),
      cardInstanceId: card.instanceId,
    });
    if (!result.ok) {
      console.warn('[BattlePage] play_card failed:', result.code, result.reason);
      return;
    }
    setState(result.newState);
    setSelectedAttacker(null);
  }

  // --- 自キャラ/リーダータップ: アタッカー選択トグル -------------------------

  function handleSelectAttacker(id: SelectedAttacker) {
    console.log('[UI] handleSelectAttacker called', {
      id,
      currentSelection: selectedAttacker,
      canAct: isPlayerActing(),
      active: state?.activePlayer,
      phase: state?.phase,
      isAIThinking,
      winner: state?.winner,
    });

    if (!state || !isPlayerActing()) {
      console.log('[UI] handleSelectAttacker: blocked by isPlayerActing gate');
      return;
    }
    // Phase 6c-4: 序盤攻撃ロック中は attacker 選択させない
    // (Phase 6c-bug2 で turn 1 のみロックに短縮)
    if (state.turn < ATTACK_UNLOCK_TURN) {
      console.log('[UI] handleSelectAttacker: attack locked', { turn: state.turn });
      return;
    }

    // 選択可能か (レスト/サモニング病チェック)
    if (id === 'leader') {
      if (state.players.p1.leader.isRested) {
        console.log('[UI] handleSelectAttacker: leader rested, abort');
        return;
      }
    } else if (id !== null) {
      const slot = state.players.p1.board.find(
        (s) => s.card.instanceId === id,
      );
      if (!slot || slot.isRested || !slot.canAttackThisTurn) {
        console.log('[UI] handleSelectAttacker: char invalid', {
          found: !!slot,
          rested: slot?.isRested,
          canAttack: slot?.canAttackThisTurn,
        });
        return;
      }
    }

    setSelectedAttacker((prev) => {
      const next = prev === id ? null : id;
      console.log('[UI] handleSelectAttacker: selection change', {
        from: prev,
        to: next,
      });
      return next;
    });
  }

  // --- 敵タップ: attack 実行 --------------------------------------------------

  function handleAttackTarget(
    target: { kind: 'leader' } | { kind: 'character'; instanceId: string },
  ) {
    console.log('[UI] handleAttackTarget called', {
      target,
      selectedAttacker,
      canAct: isPlayerActing(),
      active: state?.activePlayer,
      phase: state?.phase,
      isAIThinking,
      winner: state?.winner,
    });

    if (!state || !isPlayerActing()) {
      console.log('[UI] handleAttackTarget: blocked by isPlayerActing gate');
      return;
    }
    // Phase 6c-4: 序盤攻撃ロック中は attack 実行も弾く (selectedAttacker は null のはず)
    // (Phase 6c-bug2 で turn 1 のみロックに短縮)
    if (state.turn < ATTACK_UNLOCK_TURN) {
      console.log('[UI] handleAttackTarget: attack locked', { turn: state.turn });
      return;
    }
    if (selectedAttacker === null) {
      console.log('[UI] handleAttackTarget: no attacker selected, abort');
      return;
    }

    const attackerSource =
      selectedAttacker === 'leader'
        ? ({ kind: 'leader' } as const)
        : ({ kind: 'character', instanceId: selectedAttacker } as const);

    console.log('[UI] handleAttackTarget: calling applyAction', {
      attackerSource,
      targetSource: target,
    });

    const result = applyAction(state, {
      type: 'attack',
      player: 'p1',
      timestamp: new Date().toISOString(),
      attackerSource,
      targetSource: target,
    });

    console.log('[UI] handleAttackTarget: applyAction result', {
      ok: result.ok,
      code: !result.ok ? result.code : undefined,
      reason: !result.ok ? result.reason : undefined,
      eventsCount: result.ok ? result.events.length : 0,
    });

    // 成否を問わず、選択状態はクリア
    setSelectedAttacker(null);

    if (!result.ok) {
      console.warn('[BattlePage] attack failed:', result.code, result.reason);
      return;
    }
    setState(result.newState);
  }

  // --- エンドターン ------------------------------------------------------------

  function handleEndTurn() {
    if (!state || state.winner) return;
    if (state.activePlayer !== 'p1' || state.phase !== 'main') return;
    const result = applyAction(state, {
      type: 'end_turn',
      player: 'p1',
      timestamp: new Date().toISOString(),
    });
    if (!result.ok) {
      console.warn('[BattlePage] end_turn failed:', result.code, result.reason);
      return;
    }
    setState(result.newState);
    setSelectedAttacker(null);
  }

  // --- 降参 --------------------------------------------------------------------

  function handleSurrender() {
    if (!state || state.winner) return;
    if (!isPlayerActing()) return;
    const ok = window.confirm('ほんとうに降参する？');
    if (!ok) return;
    const result = applyAction(state, {
      type: 'surrender',
      player: 'p1',
      timestamp: new Date().toISOString(),
    });
    if (!result.ok) {
      console.warn('[BattlePage] surrender failed:', result.code, result.reason);
      return;
    }
    setState(result.newState);
    setSelectedAttacker(null);
  }

  // ---- render --------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-full py-20 text-white/70">
        バトルを準備中…
      </div>
    );
  }
  if (error || !state) {
    return (
      <div className="p-4 text-center">
        <div className="text-red-400 mb-4">
          {error ?? 'バトル state が読み込めませんでした'}
        </div>
        <Link href="/battle/select">
          <button className="px-4 py-2 rounded-lg bg-yellow-500 text-black font-bold">
            リーダー選択に戻る
          </button>
        </Link>
      </div>
    );
  }

  const p1 = state.players.p1;
  const p2 = state.players.p2;
  const isPlayerTurn = state.activePlayer === 'p1' && !isAIThinking;
  const canPlayerAct = isPlayerActing();
  const attackerSelected = selectedAttacker !== null;

  // リーダー row からの派生値 (未ロード時は 3 にフォールバック)
  const p1Row = leaderRowMap.get(p1.leader.id);
  const p2Row = leaderRowMap.get(p2.leader.id);
  const p1ImageUrl = p1Row?.image_url ?? '';
  const p2ImageUrl = p2Row?.image_url ?? '';
  const p1MaxLife = p1Row?.life ?? 3;
  const p2MaxLife = p2Row?.life ?? 3;

  return (
    <div className="min-h-full px-2 pt-2 pb-4 text-white bg-black/40">
      {/* ====== 相手エリア ====== */}
      <OpponentPanel
        leader={p2.leader}
        leaderImageUrl={p2ImageUrl}
        currentCost={p2.currentCost}
        maxCost={p2.maxCost}
        lifeCount={p2.lifeCards.length}
        maxLife={p2MaxLife}
        handCount={p2.hand.length}
        deckCount={p2.deck.length}
        targetable={attackerSelected}
        onLeaderClick={() => handleAttackTarget({ kind: 'leader' })}
        equippedCard={p2.equippedCard}
        equipmentOnceUsed={p2.equipmentOnceUsed}
        equipmentBonusAtk={p2.equipmentBonusAtk}
        equipmentBonusDef={p2.equipmentBonusDef}
        attackAnim={attackAnim}
      />
      <BoardRow
        board={p2.board}
        isOwnSide={false}
        selectedAttackerId={selectedAttacker}
        canPlayerAct={canPlayerAct}
        onSlotClick={(slot) =>
          handleAttackTarget({
            kind: 'character',
            instanceId: slot.card.instanceId,
          })
        }
        side="p2"
        attackAnim={attackAnim}
      />

      {/* ====== 中央情報 (探究マナはリーダー欄に移動済) ====== */}
      <div className="flex items-center justify-between my-3 px-2 py-2 rounded-lg bg-white/5 border border-white/10">
        <div className="text-xs text-white/70">
          ターン <span className="text-white font-bold">{state.turn}</span>
          <span className="mx-2">/</span>
          <span className="uppercase text-[10px] px-1.5 py-0.5 rounded bg-white/10">
            {state.phase}
          </span>
        </div>
        <div className="text-xs">
          {state.activePlayer === 'p1' ? (
            <span className="text-green-400 font-bold">あなたの番</span>
          ) : (
            <span className="text-red-400 font-bold">
              {isAIThinking ? '相手が考え中…' : '相手の番'}
            </span>
          )}
        </div>
      </div>

      {/* ====== Phase 6c-4: 序盤攻撃ロックバナー ====== */}
      {state.turn < ATTACK_UNLOCK_TURN && !state.winner && (
        <div className="mb-2 px-3 py-2 rounded-lg bg-amber-500/15 border border-amber-400/40 text-center">
          <span className="text-amber-300 text-sm font-bold">
            🔒 あと {ATTACK_UNLOCK_TURN - state.turn} ターンで攻撃できるよ
          </span>
          <div className="text-amber-200/70 text-[10px] mt-0.5">
            最初の 1 ターンはお互い展開タイム
          </div>
        </div>
      )}

      {/* ====== 自分の場 ====== */}
      <BoardRow
        board={p1.board}
        isOwnSide
        selectedAttackerId={selectedAttacker}
        canPlayerAct={canPlayerAct}
        onSlotClick={(slot) => handleSelectAttacker(slot.card.instanceId)}
        side="p1"
        attackAnim={attackAnim}
      />

      {/* ====== 自分のリーダー / マナ / ライフ ====== */}
      <div className="flex items-center gap-2 mt-2 px-2 py-2 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
        <LeaderBadge
          leader={p1.leader}
          imageUrl={p1ImageUrl}
          onClick={() => handleSelectAttacker('leader')}
          isSelected={selectedAttacker === 'leader'}
          canPlayerAct={canPlayerAct}
          equipmentBonusAtk={p1.equipmentBonusAtk}
          equipmentBonusDef={p1.equipmentBonusDef}
          isAttacking={Boolean(
            attackAnim &&
              attackAnim.attackerSide === 'p1' &&
              attackAnim.attackerKind === 'leader',
          )}
          isTargeted={Boolean(
            attackAnim &&
              attackAnim.targetSide === 'p1' &&
              attackAnim.targetKind === 'leader',
          )}
          attackResult={attackAnim?.result}
        />
        <EquipmentIcon
          card={p1.equippedCard}
          onceUsed={p1.equipmentOnceUsed}
          size="md"
        />
        <ManaDisplay current={p1.currentCost} max={p1.maxCost} />
        <LifePips count={p1.lifeCards.length} max={p1MaxLife} color="yellow" />
        <div className="text-[10px] text-white/60 ml-auto">
          手札{p1.hand.length}・山札{p1.deck.length}
        </div>
      </div>

      {/* ====== 自分の手札 (横スクロール) ====== */}
      <div className="mt-2 overflow-x-auto">
        <div className="flex gap-2 pb-2" style={{ minWidth: 'max-content' }}>
          {p1.hand.length === 0 ? (
            <div className="text-white/40 text-xs py-4 px-2">手札なし</div>
          ) : (
            p1.hand.map((card) => {
              const playable =
                canPlayerAct &&
                card.cost <= p1.currentCost &&
                p1.board.length < BOARD_MAX_SLOTS;
              return (
                <HandCard
                  key={card.instanceId}
                  card={card}
                  playable={playable}
                  onPlay={() => handlePlayCard(card)}
                />
              );
            })
          )}
        </div>
      </div>

      {/* ====== ボタン ====== */}
      <div className="mt-3 flex gap-2">
        <button
          onClick={handleEndTurn}
          disabled={!isPlayerTurn || Boolean(state.winner)}
          className="flex-1 py-3 rounded-lg font-bold text-base bg-yellow-500 text-black disabled:bg-white/10 disabled:text-white/40"
        >
          エンドターン
        </button>
        <button
          onClick={handleSurrender}
          disabled={!canPlayerAct}
          className="px-4 py-3 rounded-lg text-sm bg-red-900/60 text-white border border-red-500/40 disabled:bg-red-900/20 disabled:text-white/30 disabled:border-red-500/10"
        >
          降参
        </button>
      </div>

      {/* ====== 勝敗モーダル ====== */}
      {state.winner && (
        <BattleResultModal
          winner={state.winner}
          altEarned={altEarnedResult}
          onReplay={() => navigate('/battle/select')}
          onHome={() => navigate('/')}
        />
      )}

      {/* ====== Phase 6b-2: イベント / カウンター場プレイ バナー ====== */}
      <EventBanner
        data={activeBanner}
        onDismiss={() => setActiveBanner(null)}
      />

      {/* ====== Phase 6c-5: 攻防対面表示バナー ====== */}
      <AttackResolutionBanner scene={resolutionScene} />

      {/* ====== Phase 6b-4: 人間防御カウンター宣言モーダル ====== */}
      {state.pendingAttack && (
        <CounterDeclareModal
          state={state}
          defenderSlot="p1"
          onSelect={handleCounterChoice}
        />
      )}

      {/* ====== Phase 6b-3: 人間プレイヤー対象選択モーダル ====== */}
      {state.pendingTargetSelection && (
        <TargetSelectionModal state={state} onSelect={handleTargetSelect} />
      )}
    </div>
  );
}

// ---- sub components -------------------------------------------------------

function OpponentPanel({
  leader,
  leaderImageUrl,
  currentCost,
  maxCost,
  lifeCount,
  maxLife,
  handCount,
  deckCount,
  targetable,
  onLeaderClick,
  equippedCard = null,
  equipmentOnceUsed = false,
  equipmentBonusAtk = 0,
  equipmentBonusDef = 0,
  attackAnim = null,
}: {
  leader: LeaderState;
  leaderImageUrl: string;
  currentCost: number;
  maxCost: number;
  lifeCount: number;
  maxLife: number;
  handCount: number;
  deckCount: number;
  targetable: boolean;
  onLeaderClick: () => void;
  /** Phase 6b-1: 相手の装備中カード (なければ null) */
  equippedCard?: BattleCardInstance | null;
  equipmentOnceUsed?: boolean;
  equipmentBonusAtk?: number;
  equipmentBonusDef?: number;
  /** Phase 6b-5: p2 (相手) リーダーへの攻撃アニメ判定用 */
  attackAnim?: AttackAnimation | null;
}) {
  const isAttacking = Boolean(
    attackAnim &&
      attackAnim.attackerSide === 'p2' &&
      attackAnim.attackerKind === 'leader',
  );
  const isTargeted = Boolean(
    attackAnim &&
      attackAnim.targetSide === 'p2' &&
      attackAnim.targetKind === 'leader',
  );
  return (
    <div className="flex items-center gap-2 px-2 py-2 rounded-lg bg-red-900/20 border border-red-500/30">
      <LeaderBadge
        leader={leader}
        imageUrl={leaderImageUrl}
        onClick={onLeaderClick}
        targetable={targetable}
        equipmentBonusAtk={equipmentBonusAtk}
        equipmentBonusDef={equipmentBonusDef}
        isAttacking={isAttacking}
        isTargeted={isTargeted}
        attackResult={attackAnim?.result}
      />
      <EquipmentIcon
        card={equippedCard}
        onceUsed={equipmentOnceUsed}
        size="sm"
      />
      <ManaDisplay current={currentCost} max={maxCost} />
      <LifePips count={lifeCount} max={maxLife} color="red" />
      <div className="text-[10px] text-white/60 ml-auto">
        手札{handCount}・山札{deckCount}
      </div>
    </div>
  );
}

/**
 * 探究マナ表示 (現在値 / 最大値)。
 * 💎 絵文字 + シアン系でマナ属性を示す。リーダー欄に配置。
 */
function ManaDisplay({ current, max }: { current: number; max: number }) {
  return (
    <div className="flex items-center gap-0.5 text-xs whitespace-nowrap">
      <span className="text-sm leading-none">💎</span>
      <span className="text-cyan-300 font-bold">{current}</span>
      <span className="text-white/50">/{max}</span>
    </div>
  );
}

function LeaderBadge({
  leader,
  imageUrl,
  onClick,
  isSelected = false,
  canPlayerAct = false,
  targetable = false,
  equipmentBonusAtk = 0,
  equipmentBonusDef = 0,
  isAttacking = false,
  isTargeted = false,
  attackResult,
}: {
  leader: LeaderState;
  imageUrl: string;
  onClick?: () => void;
  isSelected?: boolean;
  canPlayerAct?: boolean;
  targetable?: boolean;
  /** 装備による永続 atk 加算 (Phase 3)。0 の時は表示せず。 */
  equipmentBonusAtk?: number;
  /** 装備による永続 def 加算 (Phase 3)。0 の時は表示せず。 */
  equipmentBonusDef?: number;
  /** Phase 6b-5: このリーダーが現在攻撃中なら lunge アニメーション */
  isAttacking?: boolean;
  /** Phase 6b-5: このリーダーが現在攻撃対象なら shake/block/destroy のいずれか */
  isTargeted?: boolean;
  attackResult?: AttackAnimation['result'];
}) {
  // 自リーダー: canPlayerAct && !rested で clickable
  // 敵リーダー: targetable (= 自側で attacker 選択済み) で clickable
  const clickable = Boolean(
    onClick && (targetable || (canPlayerAct && !leader.isRested)),
  );
  const ringClass = isSelected
    ? 'ring-4 ring-yellow-300'
    : targetable
      ? 'ring-2 ring-red-400 animate-pulse'
      : '';
  const animClass = isAttacking
    ? 'animate-attacker-lunge'
    : isTargeted
      ? attackResult === 'blocked'
        ? 'animate-target-block'
        : attackResult === 'destroyed'
          ? 'animate-target-destroy'
          : 'animate-target-shake'
      : '';
  return (
    <button
      type="button"
      onClick={clickable ? onClick : undefined}
      disabled={!clickable}
      className={`flex items-center gap-2 text-left rounded-lg ${clickable ? 'cursor-pointer' : 'cursor-default'} ${ringClass} ${animClass}`}
    >
      <div className="w-12 h-12 rounded-lg overflow-hidden border border-white/20 bg-black/40 flex items-center justify-center">
        <LeaderImage
          src={imageUrl}
          alt={leader.name}
          className="w-full h-full object-cover"
        />
      </div>
      <div className="leading-tight">
        <div className="text-sm font-bold text-yellow-300 truncate max-w-[100px]">
          {leader.name}
        </div>
        <div className="text-[10px] text-white/70">
          ⚔{leader.attackPower}
          {equipmentBonusAtk > 0 && (
            <span className="text-yellow-300 font-bold">+{equipmentBonusAtk}</span>
          )}{' '}
          🛡{leader.defensePower}
          {equipmentBonusDef > 0 && (
            <span className="text-yellow-300 font-bold">+{equipmentBonusDef}</span>
          )}
          {leader.isRested && <span className="ml-1 text-white/50">(rest)</span>}
        </div>
      </div>
    </button>
  );
}

function LifePips({
  count,
  max,
  color,
}: {
  count: number;
  max: number;
  color: 'red' | 'yellow';
}) {
  const active = color === 'red' ? 'bg-red-500' : 'bg-yellow-400';
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: max }).map((_, i) => (
        <div
          key={i}
          className={`w-3 h-3 rounded-full border border-white/30 ${
            i < count ? active : 'bg-white/10'
          }`}
        />
      ))}
    </div>
  );
}

function BoardRow({
  board,
  isOwnSide,
  selectedAttackerId,
  canPlayerAct,
  onSlotClick,
  side,
  attackAnim,
}: {
  board: BoardSlot[];
  isOwnSide: boolean;
  selectedAttackerId: SelectedAttacker;
  canPlayerAct: boolean;
  onSlotClick: (slot: BoardSlot) => void;
  /** Phase 6b-5: 'p1' or 'p2' (side 判定で attackAnim を絞る) */
  side: PlayerSlot;
  attackAnim?: AttackAnimation | null;
}) {
  const slots: (BoardSlot | null)[] = [...board];
  while (slots.length < 5) slots.push(null);

  const attackerActive = selectedAttackerId !== null;

  return (
    <div
      className={`flex gap-1.5 my-2 ${
        isOwnSide ? 'border-t' : 'border-b'
      } border-white/10 py-2`}
    >
      {slots.map((slot, i) => {
        const isAttacking = Boolean(
          slot &&
            attackAnim &&
            attackAnim.attackerSide === side &&
            attackAnim.attackerKind === 'character' &&
            attackAnim.attackerInstanceId === slot.card.instanceId,
        );
        const isTargeted = Boolean(
          slot &&
            attackAnim &&
            attackAnim.targetSide === side &&
            attackAnim.targetKind === 'character' &&
            attackAnim.targetInstanceId === slot.card.instanceId,
        );
        return (
          <BoardCardSlot
            key={i}
            slot={slot}
            isOwnSide={isOwnSide}
            isSelected={
              isOwnSide &&
              slot !== null &&
              selectedAttackerId === slot.card.instanceId
            }
            canPlayerAct={canPlayerAct}
            attackerActive={attackerActive}
            onClick={slot ? () => onSlotClick(slot) : undefined}
            isAttacking={isAttacking}
            isTargeted={isTargeted}
            attackResult={attackAnim?.result}
          />
        );
      })}
    </div>
  );
}

function BoardCardSlot({
  slot,
  isOwnSide,
  isSelected,
  canPlayerAct,
  attackerActive,
  onClick,
  isAttacking = false,
  isTargeted = false,
  attackResult,
}: {
  slot: BoardSlot | null;
  isOwnSide: boolean;
  isSelected: boolean;
  canPlayerAct: boolean;
  attackerActive: boolean;
  onClick?: () => void;
  /** Phase 6b-5 */
  isAttacking?: boolean;
  isTargeted?: boolean;
  attackResult?: AttackAnimation['result'];
}) {
  // Phase 6c-7: 独自 img + onError + imgErrored state (slot=null 時も hook 順序維持)
  const [imgErrored, setImgErrored] = useState(false);
  const src = slot ? resolveCardImage(slot.card.cardId) : '';
  const showImg = slot ? !imgErrored && Boolean(src) : false;

  if (!slot) {
    return (
      <div className="flex-1 aspect-[3/4] rounded-md border border-dashed border-white/10 bg-black/20" />
    );
  }

  // クリック可否:
  //   自側: canPlayerAct かつ !rested かつ canAttack
  //   敵側: attackerActive (自側で attacker 選択中) かつ (リーダー or rested char)
  //         このコンポーネントは char スロット専用なので rested が要求される
  const clickable = isOwnSide
    ? canPlayerAct && !slot.isRested && slot.canAttackThisTurn
    : attackerActive && slot.isRested;

  const ringClass = isSelected
    ? 'ring-4 ring-yellow-300'
    : clickable && !isOwnSide
      ? 'ring-2 ring-red-400 animate-pulse'
      : clickable && isOwnSide
        ? 'ring-1 ring-yellow-400/60 hover:ring-yellow-300'
        : '';

  const animClass = isAttacking
    ? 'animate-attacker-lunge'
    : isTargeted
      ? attackResult === 'blocked'
        ? 'animate-target-block'
        : attackResult === 'destroyed'
          ? 'animate-target-destroy'
          : 'animate-target-shake'
      : '';

  return (
    <button
      type="button"
      onClick={clickable ? onClick : undefined}
      disabled={!clickable}
      className={`relative flex-1 aspect-[3/4] rounded-md overflow-hidden border border-yellow-400/40 bg-black/60 transition-transform ${ringClass} ${animClass} ${clickable ? 'cursor-pointer' : 'cursor-default'}`}
      style={{ transform: slot.isRested ? 'rotate(12deg)' : 'none' }}
    >
      {showImg ? (
        <img
          src={src}
          alt=""
          aria-hidden="true"
          draggable={false}
          onError={() => setImgErrored(true)}
          className="w-full h-full object-cover"
        />
      ) : (
        <CardFallback card={slot.card} className="w-full h-full" />
      )}
      <div className="absolute top-0 left-0 bg-black/70 text-yellow-300 text-[10px] font-bold w-4 h-4 flex items-center justify-center rounded-br">
        {slot.card.cost}
      </div>
      <div className="absolute bottom-0 right-0 bg-black/70 text-[9px] text-white px-1 flex gap-1">
        <span className="text-red-300">⚔{slot.card.attackPower}</span>
        <span className="text-blue-300">🛡{slot.card.defensePower}</span>
      </div>
      {!slot.canAttackThisTurn && (
        <div className="absolute top-0 right-0 text-[8px] px-1 bg-purple-700/80">
          sick
        </div>
      )}
    </button>
  );
}

// ---- 勝敗モーダル ---------------------------------------------------------

function BattleResultModal({
  winner,
  altEarned,
  onReplay,
  onHome,
}: {
  winner: BattleWinner;
  altEarned: number | null; // null = 処理中、値あり = 確定 ALT 量
  onReplay: () => void;
  onHome: () => void;
}) {
  const won = winner === 'p1';
  const title = won ? 'やったね!🏆' : 'つぎはがんばろう';
  const displayAlt = altEarned ?? (won ? ALT_BATTLE_WIN : ALT_BATTLE_LOSE);
  const emoji = won ? '🎉' : '💪';
  const confirming = altEarned === null; // まだ加算 API 未完了

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)' }}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-6 text-center border-2"
        style={{
          background: won
            ? 'linear-gradient(135deg, rgba(255,215,0,0.15), rgba(255,140,0,0.1))'
            : 'linear-gradient(135deg, rgba(100,100,150,0.2), rgba(50,50,80,0.2))',
          borderColor: won ? 'rgba(255,215,0,0.6)' : 'rgba(255,255,255,0.2)',
          boxShadow: won
            ? '0 0 30px rgba(255,215,0,0.4)'
            : '0 0 20px rgba(0,0,0,0.5)',
        }}
      >
        <div className="text-6xl mb-2">{emoji}</div>
        <h2
          className="text-2xl font-bold mb-4"
          style={{
            color: won ? 'var(--tqw-gold)' : '#fff',
            textShadow: won ? '0 0 10px rgba(255,215,0,0.5)' : 'none',
          }}
        >
          {title}
        </h2>
        <div className="my-4 px-4 py-3 rounded-lg bg-black/40 border border-yellow-500/30">
          <div className="text-xs text-white/70 mb-1">獲得した ALT</div>
          <div className="text-3xl font-bold text-yellow-300">
            +{displayAlt} <span className="text-sm">ALT</span>
          </div>
          {confirming && (
            <div className="text-[10px] text-white/50 mt-1">加算中…</div>
          )}
        </div>
        <div className="flex flex-col gap-2 mt-6">
          <button
            onClick={onReplay}
            className="w-full py-3 rounded-lg font-bold bg-yellow-500 text-black hover:bg-yellow-400"
          >
            もう一度
          </button>
          <button
            onClick={onHome}
            className="w-full py-3 rounded-lg font-bold bg-white/10 text-white border border-white/20 hover:bg-white/20"
          >
            ホームへ
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- CardDetailModal: カード詳細モーダル (Phase 6c-3) -----------------------

/**
 * 手札カードの 「?」ボタン (HandCard) クリック時に開くカード詳細モーダル。
 * z-[70] で他モーダル (z-[60]) の上に重ねて表示する。背景クリックで閉じる。
 *
 * 表示内容:
 *   - カード画像 (大、resolveCardImage + CardFallback)
 *   - 名前 (getCardName)
 *   - 種別ラベル (リボン色) + コスト
 *   - atk/def (キャラのみ — 装備/イベント/カウンターは 0/0 で意味なし)
 *   - counter 値 (カウンターカードのみ)
 *   - 効果テキスト (BattleCardInstance.effectText 優先 / cache 補助)
 *   - ライフトリガー説明 (キャラで非 null の時のみ)
 */
function CardDetailModal({
  card,
  onClose,
}: {
  card: BattleCardInstance;
  onClose: () => void;
}) {
  const [imgErrored, setImgErrored] = useState(false);
  const src = resolveCardImage(card.cardId);
  const showImg = !imgErrored && Boolean(src);

  const style = CARD_TYPE_STYLES[card.cardType];
  const typeLabel: Record<CardType, string> = {
    character: 'キャラクター',
    equipment: '装備',
    counter: 'カウンター',
    event: 'イベント',
    stage: 'ステージ',
  };

  // expandDeck で BattleCardInstance.effectText に DB の effect_text を
  // コピー済のため通常はそれをそのまま使う。古い state や cache 経由のレア
  // ケース用に getCardEffectText() でフォールバック。
  const effectText = card.effectText || getCardEffectText(card.cardId);

  const showAtkDef = card.cardType === 'character';
  const showCounterValue =
    card.cardType === 'counter' && (card.counterValue ?? 0) > 0;
  const triggerText = describeTriggerType(card.triggerType);

  return (
    <div
      className="fixed inset-0 z-[70] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className={`relative w-full max-w-sm max-h-[90vh] overflow-y-auto rounded-xl border-2 ${style.fallbackBorder} bg-gradient-to-br from-slate-900/95 to-slate-950/95 p-4 shadow-[0_8px_32px_rgba(0,0,0,0.7)]`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* カード画像 (大) */}
        <div
          className={`relative w-full aspect-[3/4] mb-3 rounded-lg overflow-hidden ${style.bg}`}
        >
          {showImg ? (
            <img
              src={src!}
              alt=""
              aria-hidden="true"
              draggable={false}
              onError={() => setImgErrored(true)}
              className="w-full h-full object-cover"
            />
          ) : (
            <CardFallback card={card} className="w-full h-full" />
          )}
        </div>

        {/* 名前 */}
        <h2 className="text-xl font-bold text-yellow-300 mb-2 leading-tight">
          {getCardName(card.cardId)}
        </h2>

        {/* 種別 + コスト */}
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span
            className={`${style.ribbonBg || 'bg-slate-600'} text-white text-xs font-bold px-2 py-0.5 rounded`}
          >
            {typeLabel[card.cardType]}
          </span>
          <span className="text-cyan-300 text-sm">💎 コスト {card.cost}</span>
        </div>

        {/* atk / def (キャラのみ) */}
        {showAtkDef && (
          <div className="text-sm mb-3">
            <span className="text-red-300 font-bold">⚔ {card.attackPower}</span>
            <span className="mx-2 text-white/40">/</span>
            <span className="text-blue-300 font-bold">
              🛡 {card.defensePower}
            </span>
          </div>
        )}

        {/* counter 値 (カウンターカードのみ) */}
        {showCounterValue && (
          <div className="mb-3 px-3 py-2 rounded-md bg-blue-900/30 border border-blue-400/40">
            <div className="text-blue-200 text-sm font-bold">
              🛡 カウンター値 +{card.counterValue}
            </div>
            <div className="text-[11px] text-white/65 mt-0.5">
              防御時に防御値へ加算されます
            </div>
          </div>
        )}

        {/* 効果テキスト */}
        <div className="border-t border-white/10 pt-3 mt-3">
          <div className="text-yellow-200/85 text-xs mb-1 font-bold">効果</div>
          {effectText ? (
            <div className="text-white text-sm leading-relaxed whitespace-pre-wrap">
              {effectText}
            </div>
          ) : (
            <div className="text-white/55 text-xs italic">
              特殊効果はありません
            </div>
          )}
        </div>

        {/* ライフトリガー (非 null のキャラのみ) */}
        {triggerText && (
          <div className="border-t border-white/10 pt-3 mt-3">
            <div className="text-purple-300/90 text-xs mb-1 font-bold">
              ライフトリガー
            </div>
            <div className="text-white text-xs leading-relaxed">
              {triggerText}
            </div>
          </div>
        )}

        {/* 閉じる */}
        <button
          onClick={onClose}
          className="w-full mt-4 py-2.5 bg-slate-700 hover:bg-slate-600 active:bg-slate-800 text-white rounded-lg font-bold text-sm border border-white/20"
        >
          閉じる
        </button>
      </div>
    </div>
  );
}

/**
 * ライフトリガー種別を子供向けの一行説明文に変換。null は空文字を返し、
 * 呼び出し側で表示有無を判断する。
 */
function describeTriggerType(t: TriggerType): string {
  switch (t) {
    case 'draw':
      return 'ドロー — リーダー被弾時、防御側がカードを 1 枚引く';
    case 'mana':
      return 'マナ — リーダー被弾時、防御側の次ターン コスト +2';
    case 'destroy':
      return '破壊 — リーダー被弾時、相手の最も弱いキャラを 1 体破壊';
    case 'defense':
      return '防御 — リーダー被弾時、その攻撃を完全無効化';
    case 'revive':
      return '復活 — リーダー被弾時、墓地から 1 枚を手札へ';
    default:
      return '';
  }
}

function HandCard({
  card,
  playable,
  onPlay,
}: {
  card: BattleCardInstance;
  playable: boolean;
  onPlay?: () => void;
}) {
  // Phase 6c-7: 共通 CardImage は廃止、Phase 6b-1.5 の EquipmentIcon パターン
  // (独自 img + onError + imgErrored state) を踏襲。画像取得不可時は CardFallback。
  const [imgErrored, setImgErrored] = useState(false);
  const src = resolveCardImage(card.cardId);
  const showImg = !imgErrored && Boolean(src);
  // Phase 6c-2: 種別ベースの枠色 / 背景 / グロウ + 右上リボン。
  // playable 時はその上に黄色のリング + 明度ブースト + 既定グロウを重ねる。
  const style = CARD_TYPE_STYLES[card.cardType];
  const isCharacter = card.cardType === 'character';
  const playableExtras = playable
    ? `ring-2 ring-yellow-300 brightness-110 ${
        style.glow || 'shadow-[0_0_8px_rgba(255,215,0,0.5)]'
      }`
    : `opacity-85 ${style.glow}`;

  // Phase 6c-3: カード詳細モーダル開閉
  const [showDetail, setShowDetail] = useState(false);

  // 「?」ボタンと play ボタンを兄弟関係にするため、外側を div にして両者を
  // 並置する (button 入れ子は HTML として無効)。
  return (
    <>
      <div className="relative w-20 aspect-[3/4] flex-shrink-0">
        <button
          onClick={onPlay}
          disabled={!playable}
          title={card.name}
          className={`absolute inset-0 rounded-md overflow-hidden ${style.border} ${style.bg} ${playableExtras}`}
        >
          {showImg ? (
            <img
              src={src!}
              alt=""
              aria-hidden="true"
              draggable={false}
              onError={() => setImgErrored(true)}
              className="w-full h-full object-cover"
            />
          ) : (
            <CardFallback card={card} className="w-full h-full" />
          )}
          {/* cost (top-left) — 既存配置を維持 */}
          <div className="absolute top-0 left-0 bg-black/80 text-yellow-300 text-[11px] font-bold w-5 h-5 flex items-center justify-center rounded-br">
            {card.cost}
          </div>
          {/* 種別リボン (top-right) — character はリボン無し */}
          {style.ribbonLabel && (
            <div
              className={`absolute top-0 right-0 ${style.ribbonBg} text-white text-[10px] font-bold leading-none px-1.5 py-[3px] rounded-bl-md shadow`}
            >
              {style.ribbonLabel}
            </div>
          )}
          {/* atk/def (キャラのみ — 装備/カウンター/イベントは 0/0 で意味なし) */}
          {isCharacter && (
            <div className="absolute bottom-0 right-0 bg-black/80 text-[9px] text-white px-1 flex gap-1">
              <span className="text-red-300">⚔{card.attackPower}</span>
              <span className="text-blue-300">🛡{card.defensePower}</span>
            </div>
          )}
        </button>
        {/* 詳細「?」ボタン (bottom-left)。play ボタンと兄弟。
            非 playable 状態でも常時押せる (子供がプレイ前に効果を確認できる)。 */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setShowDetail(true);
          }}
          aria-label={`${card.name} のカード詳細を表示`}
          title="カード詳細"
          className="absolute bottom-0.5 left-0.5 w-5 h-5 rounded-full bg-slate-900/85 border border-white/40 text-white text-[11px] leading-none font-bold flex items-center justify-center hover:bg-slate-700 active:bg-slate-800 z-10 shadow"
        >
          ?
        </button>
      </div>
      {showDetail && (
        <CardDetailModal card={card} onClose={() => setShowDetail(false)} />
      )}
    </>
  );
}
