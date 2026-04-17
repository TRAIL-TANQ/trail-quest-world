/**
 * 都道府県データ（47件）。
 * svg フィールドは JapanMap コンポーネントで使う簡易座標（viewBox: 400×560）。
 * 実際の地理と完全一致はしないが、大まかな配置でタップ可能にする。
 * 小さい県（大阪/香川 等）はタップしやすいよう多少誇張している。
 *
 * difficulty:
 *   1 = 有名（★1 で使う） / 2 = 主要（★2 追加） / 3 = その他全て（★3-5 追加）
 * region は色分けに使う。
 */
export interface Prefecture {
  id: string;          // ローマ字キー
  name: string;        // 表示名（◯◯県/都/府/道）
  region: Region;
  difficulty: 1 | 2 | 3;
  x: number;
  y: number;
  w: number;
  h: number;
}

export type Region =
  | 'hokkaido'
  | 'tohoku'
  | 'kanto'
  | 'chubu'
  | 'kansai'
  | 'chugoku'
  | 'shikoku'
  | 'kyushu'
  | 'okinawa';

export const REGION_COLORS: Record<Region, string> = {
  hokkaido: '#5b8fb9',
  tohoku:   '#6a7fb5',
  kanto:    '#4a6fbf',
  chubu:    '#7b6fc5',
  kansai:   '#bf5f5f',
  chugoku:  '#bf7a5f',
  shikoku:  '#8bbf5f',
  kyushu:   '#bf9050',
  okinawa:  '#5fbf9e',
};

export const PREFECTURES: Prefecture[] = [
  // ===== 北海道 =====
  { id: 'hokkaido',  name: '北海道',   region: 'hokkaido', difficulty: 1, x: 260, y: 15,  w: 120, h: 115 },

  // ===== 東北 =====
  { id: 'aomori',    name: '青森県',   region: 'tohoku', difficulty: 2, x: 288, y: 135, w: 60,  h: 28 },
  { id: 'akita',     name: '秋田県',   region: 'tohoku', difficulty: 2, x: 260, y: 165, w: 45,  h: 35 },
  { id: 'iwate',     name: '岩手県',   region: 'tohoku', difficulty: 3, x: 308, y: 165, w: 45,  h: 45 },
  { id: 'yamagata',  name: '山形県',   region: 'tohoku', difficulty: 3, x: 260, y: 200, w: 45,  h: 35 },
  { id: 'miyagi',    name: '宮城県',   region: 'tohoku', difficulty: 1, x: 308, y: 210, w: 45,  h: 35 },
  { id: 'fukushima', name: '福島県',   region: 'tohoku', difficulty: 3, x: 265, y: 235, w: 85,  h: 30 },

  // ===== 関東 =====
  { id: 'ibaraki',   name: '茨城県',   region: 'kanto',  difficulty: 3, x: 340, y: 265, w: 28,  h: 40 },
  { id: 'tochigi',   name: '栃木県',   region: 'kanto',  difficulty: 3, x: 312, y: 265, w: 28,  h: 30 },
  { id: 'gunma',     name: '群馬県',   region: 'kanto',  difficulty: 3, x: 282, y: 265, w: 30,  h: 30 },
  { id: 'saitama',   name: '埼玉県',   region: 'kanto',  difficulty: 2, x: 290, y: 295, w: 35,  h: 20 },
  { id: 'chiba',     name: '千葉県',   region: 'kanto',  difficulty: 2, x: 340, y: 305, w: 28,  h: 38 },
  { id: 'tokyo',     name: '東京都',   region: 'kanto',  difficulty: 1, x: 314, y: 315, w: 25,  h: 14 },
  { id: 'kanagawa',  name: '神奈川県', region: 'kanto',  difficulty: 2, x: 305, y: 329, w: 28,  h: 20 },

  // ===== 中部 =====
  { id: 'niigata',   name: '新潟県',   region: 'chubu',  difficulty: 2, x: 225, y: 220, w: 55,  h: 50 },
  { id: 'toyama',    name: '富山県',   region: 'chubu',  difficulty: 3, x: 195, y: 260, w: 35,  h: 28 },
  { id: 'ishikawa',  name: '石川県',   region: 'chubu',  difficulty: 2, x: 175, y: 240, w: 23,  h: 60 },
  { id: 'fukui',     name: '福井県',   region: 'chubu',  difficulty: 3, x: 180, y: 300, w: 40,  h: 25 },
  { id: 'nagano',    name: '長野県',   region: 'chubu',  difficulty: 2, x: 245, y: 270, w: 35,  h: 60 },
  { id: 'yamanashi', name: '山梨県',   region: 'chubu',  difficulty: 3, x: 282, y: 325, w: 30,  h: 22 },
  { id: 'gifu',      name: '岐阜県',   region: 'chubu',  difficulty: 3, x: 215, y: 285, w: 30,  h: 45 },
  { id: 'shizuoka',  name: '静岡県',   region: 'chubu',  difficulty: 2, x: 258, y: 335, w: 55,  h: 22 },
  { id: 'aichi',     name: '愛知県',   region: 'chubu',  difficulty: 1, x: 230, y: 335, w: 40,  h: 25 },

  // ===== 関西 =====
  { id: 'mie',       name: '三重県',   region: 'kansai', difficulty: 3, x: 210, y: 345, w: 30,  h: 50 },
  { id: 'shiga',     name: '滋賀県',   region: 'kansai', difficulty: 3, x: 188, y: 330, w: 22,  h: 30 },
  { id: 'kyoto',     name: '京都府',   region: 'kansai', difficulty: 1, x: 158, y: 320, w: 30,  h: 40 },
  { id: 'osaka',     name: '大阪府',   region: 'kansai', difficulty: 1, x: 172, y: 365, w: 20,  h: 26 },
  { id: 'hyogo',     name: '兵庫県',   region: 'kansai', difficulty: 2, x: 128, y: 325, w: 42,  h: 55 },
  { id: 'nara',      name: '奈良県',   region: 'kansai', difficulty: 3, x: 192, y: 380, w: 20,  h: 28 },
  { id: 'wakayama',  name: '和歌山県', region: 'kansai', difficulty: 3, x: 150, y: 390, w: 40,  h: 28 },

  // ===== 中国 =====
  { id: 'tottori',   name: '鳥取県',   region: 'chugoku', difficulty: 3, x: 95,  y: 315, w: 50,  h: 22 },
  { id: 'shimane',   name: '島根県',   region: 'chugoku', difficulty: 3, x: 30,  y: 320, w: 65,  h: 22 },
  { id: 'okayama',   name: '岡山県',   region: 'chugoku', difficulty: 3, x: 95,  y: 340, w: 40,  h: 35 },
  { id: 'hiroshima', name: '広島県',   region: 'chugoku', difficulty: 1, x: 50,  y: 345, w: 45,  h: 38 },
  { id: 'yamaguchi', name: '山口県',   region: 'chugoku', difficulty: 3, x: 8,   y: 358, w: 42,  h: 30 },

  // ===== 四国 =====
  { id: 'kagawa',    name: '香川県',   region: 'shikoku', difficulty: 3, x: 113, y: 385, w: 36,  h: 20 },
  { id: 'tokushima', name: '徳島県',   region: 'shikoku', difficulty: 3, x: 128, y: 405, w: 30,  h: 25 },
  { id: 'ehime',     name: '愛媛県',   region: 'shikoku', difficulty: 3, x: 68,  y: 398, w: 45,  h: 32 },
  { id: 'kochi',     name: '高知県',   region: 'shikoku', difficulty: 3, x: 85,  y: 430, w: 60,  h: 22 },

  // ===== 九州 =====
  { id: 'fukuoka',   name: '福岡県',   region: 'kyushu', difficulty: 1, x: 5,   y: 375, w: 35,  h: 32 },
  { id: 'saga',      name: '佐賀県',   region: 'kyushu', difficulty: 3, x: 0,   y: 408, w: 26,  h: 22 },
  { id: 'nagasaki',  name: '長崎県',   region: 'kyushu', difficulty: 3, x: 0,   y: 431, w: 28,  h: 38 },
  { id: 'kumamoto',  name: '熊本県',   region: 'kyushu', difficulty: 3, x: 28,  y: 408, w: 40,  h: 38 },
  { id: 'oita',      name: '大分県',   region: 'kyushu', difficulty: 3, x: 40,  y: 378, w: 30,  h: 30 },
  { id: 'miyazaki',  name: '宮崎県',   region: 'kyushu', difficulty: 3, x: 62,  y: 430, w: 30,  h: 42 },
  { id: 'kagoshima', name: '鹿児島県', region: 'kyushu', difficulty: 2, x: 28,  y: 446, w: 34,  h: 42 },

  // ===== 沖縄 =====
  { id: 'okinawa',   name: '沖縄県',   region: 'okinawa', difficulty: 1, x: 10,  y: 500, w: 50,  h: 20 },
];

export function getPrefecturesByDifficulty(diff: 1 | 2 | 3 | 4 | 5): Prefecture[] {
  // diff 1 = difficulty:1 のみ
  // diff 2 = difficulty:1,2
  // diff 3,4,5 = 全47
  if (diff === 1) return PREFECTURES.filter((p) => p.difficulty === 1);
  if (diff === 2) return PREFECTURES.filter((p) => p.difficulty <= 2);
  return PREFECTURES;
}

export function findPrefecture(id: string): Prefecture | undefined {
  return PREFECTURES.find((p) => p.id === id);
}
