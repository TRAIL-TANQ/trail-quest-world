/**
 * 勉強ゲーム (4択 / パネル破壊) の誤答パターン enum 定義。
 *
 * STUDY_GAME_SPEC v1.2 §誤答パターン enum 定義 と、
 * supabase/migrations/0037_study_game_tables.sql の CHECK 制約と完全に一致させる。
 * ラベル/説明は QuizModePage の不正解フィードバック UI で表示する。
 */

export type ErrorPattern =
  | 'calculation_error'
  | 'carry_forget'
  | 'place_value_error'
  | 'operation_order_error'
  | 'sign_error'
  | 'unit_conversion_error'
  | 'fraction_misunderstanding'
  | 'decimal_misunderstanding'
  | 'misreading'
  | 'time_out'
  | 'other';

export const ERROR_PATTERNS: readonly ErrorPattern[] = [
  'calculation_error',
  'carry_forget',
  'place_value_error',
  'operation_order_error',
  'sign_error',
  'unit_conversion_error',
  'fraction_misunderstanding',
  'decimal_misunderstanding',
  'misreading',
  'time_out',
  'other',
] as const;

export const ERROR_PATTERN_LABELS: Record<ErrorPattern, string> = {
  calculation_error: '計算ミス',
  carry_forget: '繰り上がり忘れ',
  place_value_error: '位取りミス',
  operation_order_error: '計算順序ミス',
  sign_error: '符号ミス',
  unit_conversion_error: '単位換算ミス',
  fraction_misunderstanding: '分数の概念誤解',
  decimal_misunderstanding: '小数の概念誤解',
  misreading: '問題文読み違い',
  time_out: '時間切れ',
  other: 'その他',
};

export const ERROR_PATTERN_EXPLANATIONS: Record<ErrorPattern, string> = {
  calculation_error: '計算の途中で数字を取り違えたり、桁を飛ばしたりしたよ',
  carry_forget: '繰り上がりや繰り下がりを忘れているよ',
  place_value_error: '位取り(一の位と十の位など)を間違えたよ',
  operation_order_error: '四則演算の順序(×÷が先)を見直そう',
  sign_error: '+と-を逆にしたり、マイナスの扱いが曖昧だよ',
  unit_conversion_error: '単位(m と cm、時間と分など)を揃え忘れたよ',
  fraction_misunderstanding: '分母と分子の関係を確認しよう',
  decimal_misunderstanding: '小数点の位置が間違っているよ',
  misreading: '問題文をもう一度よく読んでみよう',
  time_out: '時間切れで当てずっぽうになったね、次は焦らず解こう',
  other: 'この誤りのパターンは特定が難しいよ',
};

export function isErrorPattern(value: unknown): value is ErrorPattern {
  return typeof value === 'string' && (ERROR_PATTERNS as readonly string[]).includes(value);
}
