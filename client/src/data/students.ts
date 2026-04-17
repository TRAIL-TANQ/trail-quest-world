/**
 * 固定の生徒名簿（21名）。ログイン時に名前とクラスで一致させ、child_id を組み立てる。
 *
 * childId 形式: `{クラス略称}_{名前}` 例: 'スターター_はるか'
 * 略称は「探究」プレフィックスを除いたもの。
 *
 * division は大会・対人戦績の部門分け:
 *   'elementary' = 小学生の部
 *   'middle'     = 中学生の部
 * スターター/ベーシックは小学生、アドバンス/リミットレスは中学生、
 * 個別クラスは生徒ごとに違う（かずとし・ゆうた=小学生 / ゆうせい・さとる=中学生）。
 */
export type Division = 'elementary' | 'middle';

export interface StudentRecord {
  name: string;       // ひらがな表記
  className: string;  // 「探究◯◯」
  classAbbr: string;  // 「探究」を除いた略称
  emoji: string;
  division: Division;
}

export const STUDENTS: StudentRecord[] = [
  // ===== 探究スターター（小学生） =====
  { name: 'はるか',   className: '探究スターター',     classAbbr: 'スターター',     emoji: '⭐', division: 'elementary' },
  { name: 'るい',     className: '探究スターター',     classAbbr: 'スターター',     emoji: '⭐', division: 'elementary' },
  { name: 'ゆうか',   className: '探究スターター',     classAbbr: 'スターター',     emoji: '⭐', division: 'elementary' },
  // ===== 探究ベーシック（小学生） =====
  { name: 'にしか',   className: '探究ベーシック',     classAbbr: 'ベーシック',     emoji: '🔷', division: 'elementary' },
  { name: 'のぞみ',   className: '探究ベーシック',     classAbbr: 'ベーシック',     emoji: '🔷', division: 'elementary' },
  { name: 'ゆずは',   className: '探究ベーシック',     classAbbr: 'ベーシック',     emoji: '🔷', division: 'elementary' },
  { name: 'さえ',     className: '探究ベーシック',     classAbbr: 'ベーシック',     emoji: '🔷', division: 'elementary' },
  { name: 'えりく',   className: '探究ベーシック',     classAbbr: 'ベーシック',     emoji: '🔷', division: 'elementary' },
  { name: 'ゆうと',   className: '探究ベーシック',     classAbbr: 'ベーシック',     emoji: '🔷', division: 'elementary' },
  // ===== 探究アドバンス（中学生） =====
  { name: 'りさこ',   className: '探究アドバンス',     classAbbr: 'アドバンス',     emoji: '🔶', division: 'middle' },
  { name: 'ゆきひさ', className: '探究アドバンス',     classAbbr: 'アドバンス',     emoji: '🔶', division: 'middle' },
  { name: 'こうた',   className: '探究アドバンス',     classAbbr: 'アドバンス',     emoji: '🔶', division: 'middle' },
  // ===== 探究リミットレス（中学生） =====
  { name: 'ごうき',   className: '探究リミットレス',   classAbbr: 'リミットレス',   emoji: '🚀', division: 'middle' },
  { name: 'れお',     className: '探究リミットレス',   classAbbr: 'リミットレス',   emoji: '🚀', division: 'middle' },
  { name: 'げん',     className: '探究リミットレス',   classAbbr: 'リミットレス',   emoji: '🚀', division: 'middle' },
  { name: 'はるあき', className: '探究リミットレス',   classAbbr: 'リミットレス',   emoji: '🚀', division: 'middle' },
  { name: 'はる',     className: '探究リミットレス',   classAbbr: 'リミットレス',   emoji: '🚀', division: 'middle' },
  // ===== 探究個別（個別に分かれる） =====
  { name: 'かずとし', className: '探究個別',           classAbbr: '個別',           emoji: '💎', division: 'elementary' },
  { name: 'ゆうた',   className: '探究個別',           classAbbr: '個別',           emoji: '💎', division: 'elementary' },
  { name: 'ゆうせい', className: '探究個別',           classAbbr: '個別',           emoji: '💎', division: 'middle' },
  { name: 'さとる',   className: '探究個別',           classAbbr: '個別',           emoji: '💎', division: 'middle' },
];

/** 部門（division）でフィルターした生徒一覧を返す。 */
export function studentsByDivision(division: Division): StudentRecord[] {
  return STUDENTS.filter((s) => s.division === division);
}

export const DIVISION_LABELS: Record<Division, string> = {
  elementary: '🏫 小学生の部',
  middle:     '🎓 中学生の部',
};

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
