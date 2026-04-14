/**
 * PvP Session — ローカル同端末2人対戦用のセッション情報
 *
 * セットアップ画面で両プレイヤーのPIN認証とデッキ選択が完了したら保存し、
 * バトル画面が読み込む。sessionStorage を使うのでタブを閉じると消える。
 */

export interface PvPPlayer {
  childId: string;
  childName: string;
  isAdmin: boolean;
  starterDeckId: string;
  /** SSR card names this player has unlocked. Admins → all SSRs. */
  unlockedSSRCardNames: string[];
}

export type PvPRoundCount = 3 | 5 | 7;

export interface PvPSession {
  player1: PvPPlayer;
  player2: PvPPlayer;
  startedAt: number;
  /** 試合の総回戦数。デフォルトは5。 */
  roundCount: PvPRoundCount;
}

const SS_KEY = 'trail-quest-pvp-session';

export function savePvPSession(session: PvPSession): void {
  try {
    sessionStorage.setItem(SS_KEY, JSON.stringify(session));
  } catch {
    /* ignore quota errors */
  }
}

export function loadPvPSession(): PvPSession | null {
  try {
    const raw = sessionStorage.getItem(SS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PvPSession;
    if (!parsed.player1?.childId || !parsed.player2?.childId) return null;
    // Backward compat: default to 5 if older sessions lack roundCount
    if (parsed.roundCount !== 3 && parsed.roundCount !== 5 && parsed.roundCount !== 7) {
      parsed.roundCount = 5;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearPvPSession(): void {
  sessionStorage.removeItem(SS_KEY);
}
