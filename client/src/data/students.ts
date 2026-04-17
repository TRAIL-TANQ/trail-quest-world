/**
 * 固定の生徒名簿（20名）。ログイン時に名前とクラスで一致させ、child_id を組み立てる。
 *
 * childId 形式: `{クラス略称}_{名前}` 例: 'スターター_はるか'
 * 略称は「探究」プレフィックスを除いたもの。
 */
export interface StudentRecord {
  name: string;       // ひらがな表記
  className: string;  // 「探究◯◯」
  classAbbr: string;  // 「探究」を除いた略称
  emoji: string;
}

export const STUDENTS: StudentRecord[] = [
  // ===== 探究スターター =====
  { name: 'はるか',   className: '探究スターター',     classAbbr: 'スターター',     emoji: '⭐' },
  { name: 'るい',     className: '探究スターター',     classAbbr: 'スターター',     emoji: '⭐' },
  { name: 'ゆうか',   className: '探究スターター',     classAbbr: 'スターター',     emoji: '⭐' },
  // ===== 探究ベーシック =====
  { name: 'にしか',   className: '探究ベーシック',     classAbbr: 'ベーシック',     emoji: '🔷' },
  { name: 'のぞみ',   className: '探究ベーシック',     classAbbr: 'ベーシック',     emoji: '🔷' },
  { name: 'ゆずは',   className: '探究ベーシック',     classAbbr: 'ベーシック',     emoji: '🔷' },
  { name: 'さえ',     className: '探究ベーシック',     classAbbr: 'ベーシック',     emoji: '🔷' },
  { name: 'えりく',   className: '探究ベーシック',     classAbbr: 'ベーシック',     emoji: '🔷' },
  { name: 'ゆうと',   className: '探究ベーシック',     classAbbr: 'ベーシック',     emoji: '🔷' },
  // ===== 探究アドバンス =====
  { name: 'りさこ',   className: '探究アドバンス',     classAbbr: 'アドバンス',     emoji: '🔶' },
  { name: 'ゆきひさ', className: '探究アドバンス',     classAbbr: 'アドバンス',     emoji: '🔶' },
  { name: 'こうた',   className: '探究アドバンス',     classAbbr: 'アドバンス',     emoji: '🔶' },
  // ===== 探究リミットレス =====
  { name: 'ごうき',   className: '探究リミットレス',   classAbbr: 'リミットレス',   emoji: '🚀' },
  { name: 'れお',     className: '探究リミットレス',   classAbbr: 'リミットレス',   emoji: '🚀' },
  { name: 'げん',     className: '探究リミットレス',   classAbbr: 'リミットレス',   emoji: '🚀' },
  { name: 'はるあき', className: '探究リミットレス',   classAbbr: 'リミットレス',   emoji: '🚀' },
  { name: 'はる',     className: '探究リミットレス',   classAbbr: 'リミットレス',   emoji: '🚀' },
  // ===== 探究個別 =====
  { name: 'かずとし', className: '探究個別',           classAbbr: '個別',           emoji: '💎' },
  { name: 'ゆうた',   className: '探究個別',           classAbbr: '個別',           emoji: '💎' },
  { name: 'ゆうせい', className: '探究個別',           classAbbr: '個別',           emoji: '💎' },
];

/** child_id を生徒データから組み立てる。 */
export function buildStudentChildId(s: StudentRecord): string {
  return `${s.classAbbr}_${s.name}`;
}

/**
 * カタカナ→ひらがな変換（全角）。半角カナ・空白・記号はそのまま通す。
 * アプリ全体で「ひらがな入力」として扱うためのノーマライズ。
 */
export function kanaToHira(input: string): string {
  return input.replace(/[\u30A1-\u30F6]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60));
}

/** 入力文字列を正規化して生徒を検索。一致すれば該当レコード、なければ null。 */
export function findStudentByName(input: string): StudentRecord | null {
  const normalized = kanaToHira(input.trim());
  if (!normalized) return null;
  return STUDENTS.find((s) => s.name === normalized) ?? null;
}

/** childId（'スターター_はるか' 形式）から生徒レコードを逆引き。 */
export function findStudentByChildId(childId: string): StudentRecord | null {
  if (!childId || !childId.includes('_')) return null;
  const [abbr, name] = childId.split('_', 2);
  return STUDENTS.find((s) => s.classAbbr === abbr && s.name === name) ?? null;
}
