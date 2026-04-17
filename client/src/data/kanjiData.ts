/**
 * 漢字フラッシュ用のデータ。
 * grade を元に難易度（★1〜★5）を決める:
 *   ★1: grade=1（小1）
 *   ★2: grade=2（小2）
 *   ★3: grade=3 or 4（小3-4）
 *   ★4: grade=5 or 6（小5-6、主に熟語）
 *   ★5: grade=9（中学〜難読）
 */
export interface KanjiQuestion {
  kanji: string;
  answer: string;
  distractors: string[]; // 3択ぶんの紛らわしい不正解
  grade: 1 | 2 | 3 | 4 | 5 | 6 | 9;
}

export const KANJI_DATA: KanjiQuestion[] = [
  // ===== 小1（★1） 30問 =====
  { kanji: '山', answer: 'やま', distractors: ['かわ', 'もり', 'はな'], grade: 1 },
  { kanji: '川', answer: 'かわ', distractors: ['やま', 'うみ', 'いけ'], grade: 1 },
  { kanji: '花', answer: 'はな', distractors: ['くさ', 'もり', 'そら'], grade: 1 },
  { kanji: '空', answer: 'そら', distractors: ['うみ', 'やま', 'つき'], grade: 1 },
  { kanji: '雨', answer: 'あめ', distractors: ['かぜ', 'ゆき', 'くも'], grade: 1 },
  { kanji: '火', answer: 'ひ', distractors: ['みず', 'つち', 'かぜ'], grade: 1 },
  { kanji: '水', answer: 'みず', distractors: ['ひ', 'つち', 'かぜ'], grade: 1 },
  { kanji: '土', answer: 'つち', distractors: ['いし', 'すな', 'みず'], grade: 1 },
  { kanji: '犬', answer: 'いぬ', distractors: ['ねこ', 'とり', 'うま'], grade: 1 },
  { kanji: '虫', answer: 'むし', distractors: ['とり', 'さかな', 'いぬ'], grade: 1 },
  { kanji: '森', answer: 'もり', distractors: ['はやし', 'やま', 'はな'], grade: 1 },
  { kanji: '林', answer: 'はやし', distractors: ['もり', 'たけ', 'くさ'], grade: 1 },
  { kanji: '石', answer: 'いし', distractors: ['つち', 'すな', 'いわ'], grade: 1 },
  { kanji: '竹', answer: 'たけ', distractors: ['くさ', 'はな', 'もり'], grade: 1 },
  { kanji: '貝', answer: 'かい', distractors: ['さかな', 'えび', 'かに'], grade: 1 },
  { kanji: '目', answer: 'め', distractors: ['みみ', 'はな', 'くち'], grade: 1 },
  { kanji: '耳', answer: 'みみ', distractors: ['め', 'はな', 'て'], grade: 1 },
  { kanji: '手', answer: 'て', distractors: ['あし', 'ゆび', 'うで'], grade: 1 },
  { kanji: '足', answer: 'あし', distractors: ['て', 'うで', 'ゆび'], grade: 1 },
  { kanji: '口', answer: 'くち', distractors: ['め', 'みみ', 'はな'], grade: 1 },
  { kanji: '月', answer: 'つき', distractors: ['ひ', 'ほし', 'そら'], grade: 1 },
  { kanji: '日', answer: 'ひ', distractors: ['つき', 'とき', 'ひる'], grade: 1 },
  { kanji: '金', answer: 'きん', distractors: ['ぎん', 'どう', 'てつ'], grade: 1 },
  { kanji: '糸', answer: 'いと', distractors: ['ひも', 'ぬの', 'なわ'], grade: 1 },
  { kanji: '草', answer: 'くさ', distractors: ['はな', 'き', 'もり'], grade: 1 },
  { kanji: '木', answer: 'き', distractors: ['くさ', 'え', 'ね'], grade: 1 },
  { kanji: '人', answer: 'ひと', distractors: ['いえ', 'くに', 'ひろ'], grade: 1 },
  { kanji: '子', answer: 'こ', distractors: ['し', 'ちち', 'いえ'], grade: 1 },
  { kanji: '女', answer: 'おんな', distractors: ['おとこ', 'ひと', 'こ'], grade: 1 },
  { kanji: '男', answer: 'おとこ', distractors: ['おんな', 'こ', 'ひと'], grade: 1 },

  // ===== 小2（★2） 30問 =====
  { kanji: '教', answer: 'おしえる', distractors: ['まなぶ', 'ならう', 'しる'], grade: 2 },
  { kanji: '朝', answer: 'あさ', distractors: ['ひる', 'よる', 'ゆう'], grade: 2 },
  { kanji: '星', answer: 'ほし', distractors: ['つき', 'そら', 'ひかり'], grade: 2 },
  { kanji: '雪', answer: 'ゆき', distractors: ['あめ', 'くも', 'かぜ'], grade: 2 },
  { kanji: '風', answer: 'かぜ', distractors: ['あめ', 'くも', 'ゆき'], grade: 2 },
  { kanji: '船', answer: 'ふね', distractors: ['くるま', 'うま', 'ひこうき'], grade: 2 },
  { kanji: '馬', answer: 'うま', distractors: ['いぬ', 'うし', 'ひつじ'], grade: 2 },
  { kanji: '牛', answer: 'うし', distractors: ['うま', 'ひつじ', 'ぶた'], grade: 2 },
  { kanji: '鳥', answer: 'とり', distractors: ['むし', 'さかな', 'いぬ'], grade: 2 },
  { kanji: '魚', answer: 'さかな', distractors: ['とり', 'かい', 'えび'], grade: 2 },
  { kanji: '春', answer: 'はる', distractors: ['なつ', 'あき', 'ふゆ'], grade: 2 },
  { kanji: '夏', answer: 'なつ', distractors: ['はる', 'あき', 'ふゆ'], grade: 2 },
  { kanji: '秋', answer: 'あき', distractors: ['はる', 'なつ', 'ふゆ'], grade: 2 },
  { kanji: '冬', answer: 'ふゆ', distractors: ['はる', 'なつ', 'あき'], grade: 2 },
  { kanji: '弓', answer: 'ゆみ', distractors: ['や', 'たて', 'けん'], grade: 2 },
  { kanji: '歌', answer: 'うた', distractors: ['おと', 'こえ', 'ことば'], grade: 2 },
  { kanji: '紙', answer: 'かみ', distractors: ['ふで', 'すみ', 'ほん'], grade: 2 },
  { kanji: '学', answer: 'まなぶ', distractors: ['しる', 'おしえる', 'よむ'], grade: 2 },
  { kanji: '楽', answer: 'たのしい', distractors: ['うれしい', 'かなしい', 'うつくしい'], grade: 2 },
  { kanji: '汽', answer: 'き', distractors: ['ゆ', 'すい', 'てつ'], grade: 2 },
  { kanji: '走', answer: 'はしる', distractors: ['あるく', 'とぶ', 'のぼる'], grade: 2 },
  { kanji: '歩', answer: 'あるく', distractors: ['はしる', 'とまる', 'のぼる'], grade: 2 },
  { kanji: '光', answer: 'ひかり', distractors: ['やみ', 'つき', 'ほし'], grade: 2 },
  { kanji: '雲', answer: 'くも', distractors: ['そら', 'かぜ', 'あめ'], grade: 2 },
  { kanji: '里', answer: 'さと', distractors: ['むら', 'まち', 'のはら'], grade: 2 },
  { kanji: '麦', answer: 'むぎ', distractors: ['まめ', 'こめ', 'あわ'], grade: 2 },
  { kanji: '鳴', answer: 'なく', distractors: ['ほえる', 'さけぶ', 'わらう'], grade: 2 },
  { kanji: '羽', answer: 'はね', distractors: ['つばさ', 'とり', 'そら'], grade: 2 },
  { kanji: '門', answer: 'もん', distractors: ['いえ', 'みち', 'とびら'], grade: 2 },
  { kanji: '野', answer: 'の', distractors: ['はら', 'やま', 'もり'], grade: 2 },

  // ===== 小3-4（★3） 30問（音読み訓読みミックス） =====
  { kanji: '港', answer: 'みなと', distractors: ['うみ', 'かわ', 'いけ'], grade: 3 },
  { kanji: '湖', answer: 'みずうみ', distractors: ['いけ', 'かわ', 'うみ'], grade: 3 },
  { kanji: '島', answer: 'しま', distractors: ['やま', 'おか', 'みさき'], grade: 3 },
  { kanji: '橋', answer: 'はし', distractors: ['みち', 'みなと', 'まち'], grade: 3 },
  { kanji: '祭', answer: 'まつり', distractors: ['おどり', 'うた', 'あそび'], grade: 3 },
  { kanji: '宿', answer: 'やど', distractors: ['いえ', 'むら', 'みせ'], grade: 3 },
  { kanji: '暗', answer: 'くらい', distractors: ['あかるい', 'くろい', 'あさい'], grade: 3 },
  { kanji: '商', answer: 'しょう', distractors: ['じょう', 'ぞう', 'そう'], grade: 3 },
  { kanji: '岸', answer: 'きし', distractors: ['はま', 'なぎさ', 'がけ'], grade: 3 },
  { kanji: '坂', answer: 'さか', distractors: ['やま', 'みち', 'のぼり'], grade: 3 },
  { kanji: '旅', answer: 'たび', distractors: ['みち', 'ゆき', 'のり'], grade: 3 },
  { kanji: '薬', answer: 'くすり', distractors: ['いしゃ', 'びょう', 'ちりょう'], grade: 3 },
  { kanji: '庭', answer: 'にわ', distractors: ['いえ', 'つち', 'はな'], grade: 3 },
  { kanji: '荷', answer: 'に', distractors: ['つみ', 'もの', 'ふくろ'], grade: 3 },
  { kanji: '宮', answer: 'みや', distractors: ['おう', 'しろ', 'てら'], grade: 3 },
  { kanji: '命', answer: 'いのち', distractors: ['こころ', 'ちから', 'ゆめ'], grade: 4 },
  { kanji: '努', answer: 'つとめる', distractors: ['はげむ', 'がんばる', 'はたらく'], grade: 4 },
  { kanji: '笑', answer: 'わらう', distractors: ['なく', 'おこる', 'よろこぶ'], grade: 4 },
  { kanji: '辺', answer: 'あたり', distractors: ['そば', 'ところ', 'ちかく'], grade: 4 },
  { kanji: '牧', answer: 'まき', distractors: ['のはら', 'はたけ', 'ぼく'], grade: 4 },
  { kanji: '熱', answer: 'あつい', distractors: ['つめたい', 'ぬるい', 'ねつい'], grade: 4 },
  { kanji: '願', answer: 'ねがう', distractors: ['いのる', 'のぞむ', 'おもう'], grade: 4 },
  { kanji: '芽', answer: 'め', distractors: ['は', 'ね', 'み'], grade: 4 },
  { kanji: '街', answer: 'まち', distractors: ['みち', 'むら', 'さと'], grade: 4 },
  { kanji: '博', answer: 'はく', distractors: ['ひろ', 'ばく', 'ほ'], grade: 4 },
  { kanji: '司', answer: 'し', distractors: ['じ', 'す', 'そ'], grade: 4 },
  { kanji: '貨', answer: 'か', distractors: ['け', 'きん', 'ざい'], grade: 4 },
  { kanji: '季', answer: 'き', distractors: ['と', 'せ', 'じ'], grade: 4 },
  { kanji: '欠', answer: 'かける', distractors: ['やぶる', 'なくす', 'おちる'], grade: 4 },
  { kanji: '機', answer: 'はた', distractors: ['いと', 'ぬの', 'ほう'], grade: 4 },

  // ===== 小5-6（★4） 30問（熟語中心） =====
  { kanji: '創造', answer: 'そうぞう', distractors: ['そうぞ', 'しょうぞう', 'さいぞう'], grade: 5 },
  { kanji: '経済', answer: 'けいざい', distractors: ['けいさい', 'きょうざい', 'けいざ'], grade: 5 },
  { kanji: '政治', answer: 'せいじ', distractors: ['せいち', 'しょうじ', 'まつりごと'], grade: 6 },
  { kanji: '憲法', answer: 'けんぽう', distractors: ['けんほう', 'かんぽう', 'げんぽう'], grade: 6 },
  { kanji: '演説', answer: 'えんぜつ', distractors: ['えんせつ', 'えんぜい', 'えんだん'], grade: 6 },
  { kanji: '幹部', answer: 'かんぶ', distractors: ['みきぶ', 'かんぷ', 'きぶ'], grade: 5 },
  { kanji: '素直', answer: 'すなお', distractors: ['そちょく', 'すちょく', 'もとなお'], grade: 5 },
  { kanji: '余裕', answer: 'よゆう', distractors: ['あまゆう', 'よう', 'あまり'], grade: 5 },
  { kanji: '複雑', answer: 'ふくざつ', distractors: ['ふくさつ', 'ぶくざつ', 'ふくしゅう'], grade: 5 },
  { kanji: '単純', answer: 'たんじゅん', distractors: ['たんすみ', 'だんじゅん', 'たんじゅ'], grade: 5 },
  { kanji: '仮定', answer: 'かてい', distractors: ['かりてい', 'けてい', 'かで'], grade: 5 },
  { kanji: '境界', answer: 'きょうかい', distractors: ['けいかい', 'さかいかい', 'きょうさかい'], grade: 5 },
  { kanji: '快適', answer: 'かいてき', distractors: ['けってき', 'こころよき', 'かいちょう'], grade: 5 },
  { kanji: '損失', answer: 'そんしつ', distractors: ['そんじつ', 'そんじ', 'うしなしつ'], grade: 5 },
  { kanji: '勤労', answer: 'きんろう', distractors: ['つとめろう', 'きんどう', 'こんろう'], grade: 6 },
  { kanji: '縦横', answer: 'じゅうおう', distractors: ['たてよこ', 'じゅうこう', 'しゅうおう'], grade: 6 },
  { kanji: '延長', answer: 'えんちょう', distractors: ['のばちょう', 'えんじょう', 'えちょう'], grade: 6 },
  { kanji: '簡潔', answer: 'かんけつ', distractors: ['かんせつ', 'かんき', 'あっけつ'], grade: 6 },
  { kanji: '討議', answer: 'とうぎ', distractors: ['うちぎ', 'とうき', 'とんぎ'], grade: 6 },
  { kanji: '著者', answer: 'ちょしゃ', distractors: ['ちゃくしゃ', 'しょじゃ', 'ちょじゃ'], grade: 6 },
  { kanji: '批評', answer: 'ひひょう', distractors: ['ひんひょう', 'ひよう', 'ぴひょう'], grade: 6 },
  { kanji: '否定', answer: 'ひてい', distractors: ['ふてい', 'ひぜい', 'いなてい'], grade: 6 },
  { kanji: '尊敬', answer: 'そんけい', distractors: ['とうとけい', 'そんぎょう', 'そうけい'], grade: 6 },
  { kanji: '閉鎖', answer: 'へいさ', distractors: ['へいさく', 'へいしん', 'とじくさり'], grade: 6 },
  { kanji: '拡張', answer: 'かくちょう', distractors: ['ひろちょう', 'かくじょう', 'こうちょう'], grade: 6 },
  { kanji: '模範', answer: 'もはん', distractors: ['もうはん', 'ぼはん', 'もいはん'], grade: 6 },
  { kanji: '純粋', answer: 'じゅんすい', distractors: ['じゅんしゅい', 'すみすい', 'じゅんきり'], grade: 6 },
  { kanji: '誕生', answer: 'たんじょう', distractors: ['たんせい', 'たんじょ', 'だんじょう'], grade: 6 },
  { kanji: '困難', answer: 'こんなん', distractors: ['こんだん', 'くるなん', 'こんにん'], grade: 6 },
  { kanji: '印象', answer: 'いんしょう', distractors: ['しるぞう', 'いんぞう', 'いんしん'], grade: 6 },

  // ===== 中学〜難読（★5） 30問 =====
  { kanji: '相殺', answer: 'そうさい', distractors: ['そうさつ', 'あいころし', 'そうけし'], grade: 9 },
  { kanji: '月極', answer: 'つきぎめ', distractors: ['げっきょく', 'つきごく', 'げつきめ'], grade: 9 },
  { kanji: '出納', answer: 'すいとう', distractors: ['しゅつのう', 'でのう', 'でいり'], grade: 9 },
  { kanji: '素人', answer: 'しろうと', distractors: ['そじん', 'すひと', 'もとひと'], grade: 9 },
  { kanji: '十八番', answer: 'おはこ', distractors: ['じゅうはちばん', 'じゅうはっぱん', 'とはちばん'], grade: 9 },
  { kanji: '灰汁', answer: 'あく', distractors: ['はいじる', 'かいじゅう', 'かいしる'], grade: 9 },
  { kanji: '雰囲気', answer: 'ふんいき', distractors: ['ふいんき', 'ふんにんき', 'ふうにんき'], grade: 9 },
  { kanji: '生粋', answer: 'きっすい', distractors: ['せいすい', 'きいすい', 'なますい'], grade: 9 },
  { kanji: '凡例', answer: 'はんれい', distractors: ['ぼんれい', 'ふつれい', 'ひんれい'], grade: 9 },
  { kanji: '白夜', answer: 'びゃくや', distractors: ['はくや', 'しろよる', 'しろや'], grade: 9 },
  { kanji: '時雨', answer: 'しぐれ', distractors: ['ときあめ', 'じう', 'ときさめ'], grade: 9 },
  { kanji: '海老', answer: 'えび', distractors: ['うみろう', 'かいろう', 'うみおい'], grade: 9 },
  { kanji: '寿司', answer: 'すし', distractors: ['じゅし', 'ことぶきし', 'すじ'], grade: 9 },
  { kanji: '浴衣', answer: 'ゆかた', distractors: ['よくい', 'あびごろも', 'ゆき'], grade: 9 },
  { kanji: '雑魚', answer: 'ざこ', distractors: ['ぞうぎょ', 'ざつぎょ', 'まぜうお'], grade: 9 },
  { kanji: '案山子', answer: 'かかし', distractors: ['あんざんし', 'あんさんこ', 'かがし'], grade: 9 },
  { kanji: '玄人', answer: 'くろうと', distractors: ['げんじん', 'くろひと', 'はかりと'], grade: 9 },
  { kanji: '団扇', answer: 'うちわ', distractors: ['だんせん', 'まるおうぎ', 'たんせん'], grade: 9 },
  { kanji: '読経', answer: 'どきょう', distractors: ['どっきょう', 'よみぎょう', 'とくきょう'], grade: 9 },
  { kanji: '反故', answer: 'ほご', distractors: ['はんこ', 'そりゆえ', 'はんゆえ'], grade: 9 },
  { kanji: '流石', answer: 'さすが', distractors: ['りゅうせき', 'ながれいし', 'りゅういし'], grade: 9 },
  { kanji: '面影', answer: 'おもかげ', distractors: ['めんえい', 'めんかげ', 'おもえい'], grade: 9 },
  { kanji: '数珠', answer: 'じゅず', distractors: ['かずたま', 'すうじゅ', 'すうたま'], grade: 9 },
  { kanji: '蜃気楼', answer: 'しんきろう', distractors: ['しんきろ', 'みずけろう', 'しんきおおきみ'], grade: 9 },
  { kanji: '弥生', answer: 'やよい', distractors: ['みせい', 'びせい', 'いやせい'], grade: 9 },
  { kanji: '師走', answer: 'しわす', distractors: ['しそう', 'せんそう', 'しわれ'], grade: 9 },
  { kanji: '祝詞', answer: 'のりと', distractors: ['しゅくし', 'いわいし', 'しゅくじ'], grade: 9 },
  { kanji: '払拭', answer: 'ふっしょく', distractors: ['はらいぬぐい', 'ふつしょく', 'はらいしき'], grade: 9 },
  { kanji: '逐次', answer: 'ちくじ', distractors: ['つぎつぎ', 'ちくし', 'おいつぎ'], grade: 9 },
  { kanji: '語彙', answer: 'ごい', distractors: ['ごき', 'かたりつどい', 'ごりゅう'], grade: 9 },
];

/** 難易度（1-5）に該当する問題を返す。 */
export function getKanjiByDifficulty(diff: 1 | 2 | 3 | 4 | 5): KanjiQuestion[] {
  switch (diff) {
    case 1: return KANJI_DATA.filter((q) => q.grade === 1);
    case 2: return KANJI_DATA.filter((q) => q.grade === 2);
    case 3: return KANJI_DATA.filter((q) => q.grade === 3 || q.grade === 4);
    case 4: return KANJI_DATA.filter((q) => q.grade === 5 || q.grade === 6);
    case 5: return KANJI_DATA.filter((q) => q.grade === 9);
  }
}
