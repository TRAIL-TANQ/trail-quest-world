/**
 * Invite Code Service
 * 保護者ダッシュボード: 招待コード発行・削除・再発行・一覧取得を担当する。
 *
 * Supabase RPC（migration 0025）を薄くラップし、
 * - QR コード (data URL)
 * - LIFF URL 組立 (VITE_LIFF_ID_PARENT、未設定時 PLACEHOLDER)
 * - LINE 共有メッセージ／URL
 * も同時に提供する。
 *
 * 一覧取得は View `parent_invite_codes_with_status` を参照（status 算出列付き）。
 */
import QRCode from 'qrcode';
import { supabase } from './supabase';

// ===== 定数（RPC 側と一致） =====

/** 招待コード 6 桁部分に使う文字集合。0,1,I,O,L,l を除外した 30 文字。 */
export const INVITE_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const INVITE_CODE_PREFIX = 'TRAIL-';
export const INVITE_CODE_REGEX = /^TRAIL-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/;

// ===== 型 =====

export type InviteCodeStatus = 'active' | 'used' | 'expired';
export type InviteCodeStatusFilter = InviteCodeStatus | 'all';
export type Relationship = 'mother' | 'father' | 'grandparent' | 'other';

export interface InviteCode {
  id: string;
  code: string;                      // 'TRAIL-XXXXXX'
  targetChildren: string[];          // child_id の配列
  parentName: string | null;
  relationship: Relationship | null;
  memo: string | null;
  childId: string | null;            // 後方互換（target_children[0] と同じ）
  createdBy: string;
  createdAt: string;
  expiresAt: string;
  usedAt: string | null;
  usedByLineUid: string | null;
  status: InviteCodeStatus;
}

export interface CreateInviteCodeInput {
  targetChildren: string[];
  parentName?: string | null;
  relationship?: Relationship | null;
  memo?: string | null;
}

export interface CreateInviteCodeResult {
  success: boolean;
  id?: string;
  code?: string;
  expiresAt?: string;
  error?: string;
}

export interface DeleteInviteCodeResult {
  success: boolean;
  error?: string;
}

export interface RegenerateInviteCodeResult {
  success: boolean;
  id?: string;
  code?: string;
  expiresAt?: string;
  error?: string;
}

export interface ListInviteCodesOptions {
  status?: InviteCodeStatusFilter;
  /** 子 ID・保護者名・メモを対象にしたあいまい検索（クライアント側フィルタ） */
  search?: string;
}

// ===== row mapping =====

function rowToInviteCode(r: Record<string, unknown>): InviteCode {
  return {
    id:             r.id as string,
    code:           r.code as string,
    targetChildren: (r.target_children as string[] | null) ?? [],
    parentName:     (r.parent_name as string | null) ?? null,
    relationship:   (r.relationship as Relationship | null) ?? null,
    memo:           (r.memo as string | null) ?? null,
    childId:        (r.child_id as string | null) ?? null,
    createdBy:      (r.created_by as string) ?? 'admin',
    createdAt:      r.created_at as string,
    expiresAt:      r.expires_at as string,
    usedAt:         (r.used_at as string | null) ?? null,
    usedByLineUid:  (r.used_by_line_uid as string | null) ?? null,
    status:         (r.status as InviteCodeStatus) ?? 'active',
  };
}

// ===== RPC ラッパー =====

/** 招待コードを新規発行する。 */
export async function createInviteCode(input: CreateInviteCodeInput): Promise<CreateInviteCodeResult> {
  const { data, error } = await supabase.rpc('admin_create_invite_code', {
    p_target_children: input.targetChildren,
    p_parent_name:     input.parentName ?? null,
    p_relationship:    input.relationship ?? null,
    p_memo:            input.memo ?? null,
  });
  if (error) {
    console.error('[inviteCode.create] rpc error', error);
    return { success: false, error: error.message };
  }
  const d = (data ?? {}) as Record<string, unknown>;
  return {
    success:   Boolean(d.success),
    id:        d.id as string | undefined,
    code:      d.code as string | undefined,
    expiresAt: d.expires_at as string | undefined,
    error:     d.error as string | undefined,
  };
}

/** 未使用コードを削除する。使用済みは `already_used` エラーが返る。 */
export async function deleteInviteCode(id: string): Promise<DeleteInviteCodeResult> {
  const { data, error } = await supabase.rpc('admin_delete_invite_code', { p_id: id });
  if (error) {
    console.error('[inviteCode.delete] rpc error', error);
    return { success: false, error: error.message };
  }
  const d = (data ?? {}) as Record<string, unknown>;
  return {
    success: Boolean(d.success),
    error:   d.error as string | undefined,
  };
}

/** 期限切れ等のコードを破棄し、同一メタ情報で新コードを発行する。 */
export async function regenerateInviteCode(id: string): Promise<RegenerateInviteCodeResult> {
  const { data, error } = await supabase.rpc('admin_regenerate_invite_code', { p_id: id });
  if (error) {
    console.error('[inviteCode.regenerate] rpc error', error);
    return { success: false, error: error.message };
  }
  const d = (data ?? {}) as Record<string, unknown>;
  return {
    success:   Boolean(d.success),
    id:        d.id as string | undefined,
    code:      d.code as string | undefined,
    expiresAt: d.expires_at as string | undefined,
    error:     d.error as string | undefined,
  };
}

/**
 * 招待コード一覧を取得する。
 * View `parent_invite_codes_with_status` を参照し、発行日降順で返す。
 * search は子ID・保護者名・メモに対してクライアント側であいまい一致。
 */
export async function listInviteCodes(opts: ListInviteCodesOptions = {}): Promise<InviteCode[]> {
  let query = supabase
    .from('parent_invite_codes_with_status')
    .select('*')
    .order('created_at', { ascending: false });

  if (opts.status && opts.status !== 'all') {
    query = query.eq('status', opts.status);
  }

  const { data, error } = await query;
  if (error) {
    console.error('[inviteCode.list] error', error);
    return [];
  }

  let rows = ((data ?? []) as Record<string, unknown>[]).map(rowToInviteCode);

  const s = opts.search?.trim().toLowerCase();
  if (s) {
    rows = rows.filter((r) =>
      r.targetChildren.some((c) => c.toLowerCase().includes(s)) ||
      (r.memo ?? '').toLowerCase().includes(s) ||
      (r.parentName ?? '').toLowerCase().includes(s),
    );
  }

  return rows;
}

/** 1 件だけ ID 指定で取得。 */
export async function getInviteCode(id: string): Promise<InviteCode | null> {
  const { data, error } = await supabase
    .from('parent_invite_codes_with_status')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) {
    console.error('[inviteCode.get] error', error);
    return null;
  }
  if (!data) return null;
  return rowToInviteCode(data as Record<string, unknown>);
}

// ===== LIFF / LINE 共有 =====

/**
 * LIFF URL を組み立てる。
 * VITE_LIFF_ID_PARENT 未設定時は `PLACEHOLDER` を入れて動作だけ維持する。
 * Phase B2 で実 LIFF ID を投入する前提。
 */
export function buildLiffUrl(code: string): string {
  const liffId = (import.meta.env.VITE_LIFF_ID_PARENT as string | undefined) ?? 'PLACEHOLDER';
  return `https://liff.line.me/${liffId}?code=${encodeURIComponent(code)}`;
}

/** LINE 共有用のメッセージ本文を生成する。 */
export function buildLineShareMessage(code: string): string {
  return [
    '🎓 TRAIL QUEST World',
    '保護者アカウントの招待が届きました',
    '',
    `招待コード: ${code}`,
    '',
    '以下のリンクから登録できます（72時間以内）',
    `👉 ${buildLiffUrl(code)}`,
    '',
    '※ LINEアプリで開いてください',
  ].join('\n');
}

/**
 * LINE 共有シートを開く URL を生成する。
 * `https://line.me/R/share?text=...`（text は URL エンコード必須）。
 */
export function buildLineShareUrl(code: string): string {
  return `https://line.me/R/share?text=${encodeURIComponent(buildLineShareMessage(code))}`;
}

// ===== QR コード =====

export interface GenerateInviteQrOptions {
  /** 1 辺のピクセル数（デフォルト 300） */
  size?: number;
  /** ドット色（デフォルト tqw-gold） */
  dark?: string;
  /** 背景色（デフォルト tqw-bg-dark、透明にしたい場合は '#00000000'） */
  light?: string;
}

/**
 * 招待コードを埋め込んだ LIFF URL の QR コードを data URL (image/png) で生成する。
 * 既存 /admin スタイルに合わせて gold / dark ネイビーを既定値に。
 */
export async function generateInviteQrDataUrl(
  code: string,
  opts: GenerateInviteQrOptions = {},
): Promise<string> {
  const url = buildLiffUrl(code);
  return QRCode.toDataURL(url, {
    width:  opts.size ?? 300,
    margin: 1,
    color: {
      dark:  opts.dark  ?? '#ffd700',
      light: opts.light ?? '#0f1428',
    },
    errorCorrectionLevel: 'M',
  });
}

// ===== 小物 =====

/** コード形式の簡易バリデーション（クライアント側の表示前チェック用）。 */
export function isValidInviteCode(code: string): boolean {
  return INVITE_CODE_REGEX.test(code);
}

/** 残り時間（ミリ秒）。負値なら期限切れ。 */
export function remainingMs(invite: Pick<InviteCode, 'expiresAt'>): number {
  return new Date(invite.expiresAt).getTime() - Date.now();
}

/** '残り 47 時間 12 分' 形式の短文を返す。期限切れ/使用済は別ラベルで呼び分ける想定。 */
export function formatRemaining(invite: Pick<InviteCode, 'expiresAt'>): string {
  const ms = remainingMs(invite);
  if (ms <= 0) return '期限切れ';
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h >= 1) return `残り ${h} 時間 ${m} 分`;
  return `残り ${m} 分`;
}

export const RELATIONSHIP_LABELS: Record<Relationship, string> = {
  mother:      '母',
  father:      '父',
  grandparent: '祖父母',
  other:       'その他',
};
