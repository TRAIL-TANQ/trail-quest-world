/**
 * Knowledge Challenger - Card & Quiz Data
 * カードバトルゲーム「ナレッジ・チャレンジャー」のカード定義とクイズデータ
 */

export type CardCategory = 'great_person' | 'creature' | 'heritage' | 'invention' | 'discovery';
export type CardRarity = 'N' | 'R' | 'SR' | 'SSR';

export interface BattleCard {
  id: string;
  name: string;
  category: CardCategory;
  rarity: CardRarity;
  power: number;
  effectDescription: string;
  quizzes: Quiz[];
  correctBonus: number; // +1 or +2
}

export interface Quiz {
  question: string;
  choices: [string, string, string, string];
  correctIndex: number; // 0-3
}

// Category display info
export const CATEGORY_INFO: Record<CardCategory, { label: string; emoji: string; color: string }> = {
  great_person: { label: '偉人', emoji: '👤', color: '#f59e0b' },
  creature: { label: '生き物', emoji: '🐾', color: '#22c55e' },
  heritage: { label: '世界遺産', emoji: '🏛️', color: '#8b5cf6' },
  invention: { label: '発明', emoji: '⚙️', color: '#3b82f6' },
  discovery: { label: '発見', emoji: '🔬', color: '#ef4444' },
};

export const RARITY_INFO: Record<CardRarity, { label: string; color: string; bgColor: string }> = {
  N: { label: 'N', color: '#9ca3af', bgColor: 'rgba(156,163,175,0.15)' },
  R: { label: 'R', color: '#3b82f6', bgColor: 'rgba(59,130,246,0.15)' },
  SR: { label: 'SR', color: '#a855f7', bgColor: 'rgba(168,85,247,0.15)' },
  SSR: { label: 'SSR', color: '#ffd700', bgColor: 'rgba(255,215,0,0.15)' },
};

// ===== Initial Deck Cards (N rarity, no special effects) =====
const INITIAL_CARDS: BattleCard[] = [
  {
    id: 'init-great-person',
    name: '名もなき偉人',
    category: 'great_person',
    rarity: 'N',
    power: 1,
    effectDescription: '特殊効果なし',
    correctBonus: 1,
    quizzes: [
      { question: '世界で最初に月面を歩いた人は？', choices: ['ニール・アームストロング', 'バズ・オルドリン', 'ユーリ・ガガーリン', 'ジョン・グレン'], correctIndex: 0 },
      { question: '「我思う、ゆえに我あり」と言った哲学者は？', choices: ['ソクラテス', 'プラトン', 'デカルト', 'アリストテレス'], correctIndex: 2 },
      { question: '日本で最初の女性小説家と言われるのは？', choices: ['清少納言', '紫式部', '与謝野晶子', '樋口一葉'], correctIndex: 1 },
    ],
  },
  {
    id: 'init-creature',
    name: '身近な生き物',
    category: 'creature',
    rarity: 'N',
    power: 2,
    effectDescription: '特殊効果なし',
    correctBonus: 1,
    quizzes: [
      { question: 'カブトムシの幼虫が食べるのは？', choices: ['葉っぱ', '腐葉土', '木の実', '花の蜜'], correctIndex: 1 },
      { question: 'メダカの体の特徴として正しいのは？', choices: ['ヒゲがある', '背びれが大きい', '口が上向き', '体に縞模様がある'], correctIndex: 2 },
      { question: 'アゲハチョウの幼虫が好む植物は？', choices: ['サクラ', 'ミカン', 'ヒマワリ', 'チューリップ'], correctIndex: 1 },
    ],
  },
  {
    id: 'init-discovery',
    name: '小さな発見',
    category: 'discovery',
    rarity: 'N',
    power: 3,
    effectDescription: '特殊効果なし',
    correctBonus: 1,
    quizzes: [
      { question: 'リンゴが木から落ちるのを見て万有引力を発見したのは？', choices: ['ガリレオ', 'ニュートン', 'アインシュタイン', 'ケプラー'], correctIndex: 1 },
      { question: '虹は何色に分かれる？', choices: ['5色', '6色', '7色', '8色'], correctIndex: 2 },
      { question: '水が氷になる温度は？', choices: ['−10℃', '0℃', '10℃', '100℃'], correctIndex: 1 },
    ],
  },
  {
    id: 'init-invention',
    name: '古い発明',
    category: 'invention',
    rarity: 'N',
    power: 4,
    effectDescription: '特殊効果なし',
    correctBonus: 1,
    quizzes: [
      { question: '世界で最初に印刷に使われた技術は？', choices: ['活版印刷', '石版印刷', '木版印刷', 'スクリーン印刷'], correctIndex: 2 },
      { question: '車輪が発明されたのはおよそ何年前？', choices: ['約1000年前', '約3000年前', '約5000年前', '約500年前'], correctIndex: 2 },
      { question: '紙を発明した国は？', choices: ['日本', 'エジプト', '中国', 'インド'], correctIndex: 2 },
    ],
  },
];

// ===== Battle Cards with Special Effects =====
const EFFECT_CARDS: BattleCard[] = [
  // === 偉人 (Great Person) - Synergy type ===
  {
    id: 'edison',
    name: 'トーマス・エジソン',
    category: 'great_person',
    rarity: 'SR',
    power: 5,
    effectDescription: 'ベンチの「発明」カード1枚につきパワー+2',
    correctBonus: 2,
    quizzes: [
      { question: 'エジソンが実用化した発明は？', choices: ['電話', '白熱電球', 'テレビ', 'ラジオ'], correctIndex: 1 },
      { question: 'エジソンの有名な言葉「天才とは○○のインスピレーションと99%の○○」', choices: ['1%・努力', '10%・才能', '1%・運', '50%・知識'], correctIndex: 0 },
      { question: 'エジソンが設立した会社は現在の何という会社？', choices: ['アップル', 'GE（ゼネラル・エレクトリック）', 'マイクロソフト', 'IBM'], correctIndex: 1 },
    ],
  },
  {
    id: 'curie',
    name: 'マリー・キュリー',
    category: 'great_person',
    rarity: 'SSR',
    power: 7,
    effectDescription: '防衛時、相手の次の攻撃カードのパワーを半減',
    correctBonus: 2,
    quizzes: [
      { question: 'キュリー夫人が発見した元素は？', choices: ['ウラン', 'ラジウム', 'プルトニウム', 'ネオン'], correctIndex: 1 },
      { question: 'キュリー夫人はノーベル賞を何回受賞した？', choices: ['1回', '2回', '3回', '4回'], correctIndex: 1 },
      { question: 'キュリー夫人の出身国は？', choices: ['フランス', 'ドイツ', 'ポーランド', 'ロシア'], correctIndex: 2 },
    ],
  },
  {
    id: 'da-vinci',
    name: 'レオナルド・ダ・ヴィンチ',
    category: 'great_person',
    rarity: 'R',
    power: 4,
    effectDescription: '場に出た時、山札の上から1枚を確認して戻す',
    correctBonus: 1,
    quizzes: [
      { question: 'ダ・ヴィンチが描いた有名な絵画は？', choices: ['ひまわり', 'モナ・リザ', '叫び', '真珠の耳飾りの少女'], correctIndex: 1 },
      { question: 'ダ・ヴィンチが活躍した時代は？', choices: ['古代ギリシャ', '中世', 'ルネサンス', '産業革命'], correctIndex: 2 },
      { question: 'ダ・ヴィンチが設計図を残したものは？', choices: ['ロケット', 'ヘリコプター', '潜水艦', '電車'], correctIndex: 1 },
    ],
  },
  {
    id: 'nobunaga',
    name: '織田信長',
    category: 'great_person',
    rarity: 'SR',
    power: 6,
    effectDescription: '攻撃時、相手の防衛カードのパワーを−1する',
    correctBonus: 2,
    quizzes: [
      { question: '織田信長が行った戦いで有名なのは？', choices: ['関ヶ原の戦い', '桶狭間の戦い', '壇ノ浦の戦い', '長篠の戦い'], correctIndex: 1 },
      { question: '信長が建てた城は？', choices: ['大阪城', '姫路城', '安土城', '名古屋城'], correctIndex: 2 },
      { question: '信長の異名は？', choices: ['太閤', '第六天魔王', '征夷大将軍', '天下人'], correctIndex: 1 },
    ],
  },

  // === 生き物 (Creature) - Special ability type ===
  {
    id: 'honeybee',
    name: 'ミツバチ',
    category: 'creature',
    rarity: 'R',
    power: 3,
    effectDescription: 'ベンチに送られず山札の一番下に戻る',
    correctBonus: 1,
    quizzes: [
      { question: 'ミツバチが花から集めるものは？', choices: ['花粉だけ', '蜜だけ', '花粉と蜜', '種'], correctIndex: 2 },
      { question: 'ミツバチの巣の形は？', choices: ['三角形', '四角形', '六角形', '円形'], correctIndex: 2 },
      { question: 'ミツバチが仲間に花の場所を教える方法は？', choices: ['鳴き声', '8の字ダンス', 'フェロモン', '色を変える'], correctIndex: 1 },
    ],
  },
  {
    id: 'coelacanth',
    name: 'シーラカンス',
    category: 'creature',
    rarity: 'SR',
    power: 6,
    effectDescription: 'ベンチ空き枠が2つ以下ならパワー+4',
    correctBonus: 2,
    quizzes: [
      { question: 'シーラカンスが「生きた化石」と呼ばれる理由は？', choices: ['体が石のように硬い', '何億年も姿が変わっていない', '化石の中から見つかった', '石を食べる'], correctIndex: 1 },
      { question: 'シーラカンスが発見された海は？', choices: ['太平洋', '大西洋', 'インド洋', '北極海'], correctIndex: 2 },
      { question: 'シーラカンスの特徴的な体の部分は？', choices: ['大きな目', '肉質のヒレ', '長い尾', '鋭い歯'], correctIndex: 1 },
    ],
  },
  {
    id: 'dolphin',
    name: 'イルカ',
    category: 'creature',
    rarity: 'R',
    power: 3,
    effectDescription: '場に出た時、自分の山札をシャッフルする',
    correctBonus: 1,
    quizzes: [
      { question: 'イルカは何の仲間？', choices: ['魚類', '爬虫類', '哺乳類', '両生類'], correctIndex: 2 },
      { question: 'イルカが使うコミュニケーション方法は？', choices: ['光', '超音波', '電気', '磁力'], correctIndex: 1 },
      { question: 'イルカの睡眠方法の特徴は？', choices: ['目を開けて寝る', '脳の半分ずつ寝る', '水の上で寝る', '冬眠する'], correctIndex: 1 },
    ],
  },

  // === 世界遺産 (Heritage) - High power, conditional ===
  {
    id: 'pyramid',
    name: 'ピラミッド',
    category: 'heritage',
    rarity: 'SSR',
    power: 10,
    effectDescription: 'ベンチの最もパワーが低いカードを1枚除外して空き枠を作る',
    correctBonus: 2,
    quizzes: [
      { question: 'ピラミッドがある国は？', choices: ['インド', 'エジプト', 'ギリシャ', 'トルコ'], correctIndex: 1 },
      { question: '最も大きいピラミッドの名前は？', choices: ['カフラー王', 'クフ王', 'メンカウラー王', 'ツタンカーメン'], correctIndex: 1 },
      { question: 'ピラミッドは何のために作られた？', choices: ['神殿', '王の墓', '天文台', '倉庫'], correctIndex: 1 },
    ],
  },
  {
    id: 'machu-picchu',
    name: 'マチュ・ピチュ',
    category: 'heritage',
    rarity: 'SR',
    power: 8,
    effectDescription: '防衛時、相手は必ず2枚以上めくらなければならない',
    correctBonus: 2,
    quizzes: [
      { question: 'マチュ・ピチュがある国は？', choices: ['ブラジル', 'ペルー', 'メキシコ', 'チリ'], correctIndex: 1 },
      { question: 'マチュ・ピチュの別名は？', choices: ['空中都市', '黄金都市', '水の都', '砂の城'], correctIndex: 0 },
      { question: 'マチュ・ピチュを作った文明は？', choices: ['マヤ文明', 'アステカ文明', 'インカ帝国', 'オルメカ文明'], correctIndex: 2 },
    ],
  },
  {
    id: 'great-wall',
    name: '万里の長城',
    category: 'heritage',
    rarity: 'SR',
    power: 7,
    effectDescription: '防衛時、このカードのパワー+3',
    correctBonus: 2,
    quizzes: [
      { question: '万里の長城の長さはおよそ？', choices: ['約2000km', '約6000km', '約21000km', '約500km'], correctIndex: 2 },
      { question: '万里の長城を最初に大規模に建設した皇帝は？', choices: ['始皇帝', '劉邦', '武帝', '康熙帝'], correctIndex: 0 },
      { question: '万里の長城は何のために作られた？', choices: ['交易路', '北方民族の侵入を防ぐため', '水路', '宗教施設'], correctIndex: 1 },
    ],
  },

  // === 発明 (Invention) - Defense type ===
  {
    id: 'printing-press',
    name: '活版印刷',
    category: 'invention',
    rarity: 'R',
    power: 4,
    effectDescription: '山札の上から2枚を見て好きな順番で戻す',
    correctBonus: 1,
    quizzes: [
      { question: 'ヨーロッパで活版印刷を発明したのは？', choices: ['エジソン', 'グーテンベルク', 'ガリレオ', 'ニュートン'], correctIndex: 1 },
      { question: '活版印刷で最初に印刷された有名な本は？', choices: ['聖書', 'コーラン', '論語', 'イリアス'], correctIndex: 0 },
      { question: '活版印刷が発明されたのは何世紀？', choices: ['13世紀', '15世紀', '17世紀', '19世紀'], correctIndex: 1 },
    ],
  },
  {
    id: 'steam-engine',
    name: '蒸気機関',
    category: 'invention',
    rarity: 'SR',
    power: 6,
    effectDescription: '攻撃時、追加で1枚めくりパワーを合算（クイズなし）',
    correctBonus: 2,
    quizzes: [
      { question: '蒸気機関を改良して産業革命を起こしたのは？', choices: ['ワット', 'スティーブンソン', 'フルトン', 'ニューコメン'], correctIndex: 0 },
      { question: '蒸気機関が最初に使われた分野は？', choices: ['鉄道', '船', '炭鉱の排水', '工場'], correctIndex: 2 },
      { question: '産業革命が始まった国は？', choices: ['フランス', 'ドイツ', 'アメリカ', 'イギリス'], correctIndex: 3 },
    ],
  },
  {
    id: 'telescope',
    name: '望遠鏡',
    category: 'invention',
    rarity: 'R',
    power: 3,
    effectDescription: '防衛時、パワー+2',
    correctBonus: 1,
    quizzes: [
      { question: '望遠鏡を天体観測に初めて使った科学者は？', choices: ['コペルニクス', 'ガリレオ', 'ケプラー', 'ニュートン'], correctIndex: 1 },
      { question: 'ガリレオが望遠鏡で発見したものは？', choices: ['土星の輪', '木星の衛星', '海王星', '火星の運河'], correctIndex: 1 },
      { question: '望遠鏡が発明された国は？', choices: ['イタリア', 'オランダ', 'イギリス', 'ドイツ'], correctIndex: 1 },
    ],
  },

  // === 発見 (Discovery) - Attack/deck manipulation type ===
  {
    id: 'gravity',
    name: '万有引力の法則',
    category: 'discovery',
    rarity: 'SSR',
    power: 9,
    effectDescription: '相手の防衛カードを強制的にベンチに送る（パワー無視）',
    correctBonus: 2,
    quizzes: [
      { question: '万有引力を発見したのは？', choices: ['アインシュタイン', 'ニュートン', 'ガリレオ', 'ケプラー'], correctIndex: 1 },
      { question: 'ニュートンが万有引力を思いついたきっかけは？', choices: ['月を見て', 'リンゴが落ちるのを見て', '海の波を見て', '風を感じて'], correctIndex: 1 },
      { question: '万有引力の法則が発表されたのは何世紀？', choices: ['15世紀', '16世紀', '17世紀', '18世紀'], correctIndex: 2 },
    ],
  },
  {
    id: 'penicillin',
    name: 'ペニシリン',
    category: 'discovery',
    rarity: 'R',
    power: 3,
    effectDescription: 'ベンチのカード1枚を山札に戻してシャッフル',
    correctBonus: 1,
    quizzes: [
      { question: 'ペニシリンを発見したのは？', choices: ['パスツール', 'フレミング', 'コッホ', 'ジェンナー'], correctIndex: 1 },
      { question: 'ペニシリンは何に効く薬？', choices: ['ウイルス', '細菌', 'がん', 'アレルギー'], correctIndex: 1 },
      { question: 'ペニシリンが発見されたきっかけは？', choices: ['実験の成功', 'カビが生えた培養皿', '植物の研究', '動物の観察'], correctIndex: 1 },
    ],
  },
  {
    id: 'dna',
    name: 'DNAの二重らせん',
    category: 'discovery',
    rarity: 'SR',
    power: 5,
    effectDescription: '攻撃時、パワー+3',
    correctBonus: 2,
    quizzes: [
      { question: 'DNAの構造を発見した科学者は？', choices: ['メンデル', 'ワトソンとクリック', 'ダーウィン', 'パスツール'], correctIndex: 1 },
      { question: 'DNAは何の略？', choices: ['デオキシリボ核酸', 'ジアミノ核酸', 'ダイナミック核酸', 'デュアル核酸'], correctIndex: 0 },
      { question: 'DNAの形は？', choices: ['一本の直線', '二重らせん', '三角形', '環状'], correctIndex: 1 },
    ],
  },
];

// Build initial deck: 名もなき偉人x2, 身近な生き物x2, 小さな発見x1, 古い発明x1
export function createInitialDeck(): BattleCard[] {
  const gp = INITIAL_CARDS.find(c => c.id === 'init-great-person')!;
  const cr = INITIAL_CARDS.find(c => c.id === 'init-creature')!;
  const di = INITIAL_CARDS.find(c => c.id === 'init-discovery')!;
  const inv = INITIAL_CARDS.find(c => c.id === 'init-invention')!;
  return [
    { ...gp, id: 'init-great-person-1' },
    { ...gp, id: 'init-great-person-2' },
    { ...cr, id: 'init-creature-1' },
    { ...cr, id: 'init-creature-2' },
    { ...di, id: 'init-discovery-1' },
    { ...inv, id: 'init-invention-1' },
  ];
}

// AI deck: slightly stronger
export function createAIDeck(): BattleCard[] {
  const gp = INITIAL_CARDS.find(c => c.id === 'init-great-person')!;
  const cr = INITIAL_CARDS.find(c => c.id === 'init-creature')!;
  const di = INITIAL_CARDS.find(c => c.id === 'init-discovery')!;
  const inv = INITIAL_CARDS.find(c => c.id === 'init-invention')!;
  return [
    { ...gp, id: 'ai-great-person-1' },
    { ...gp, id: 'ai-great-person-2' },
    { ...cr, id: 'ai-creature-1' },
    { ...cr, id: 'ai-creature-2' },
    { ...di, id: 'ai-discovery-1' },
    { ...inv, id: 'ai-invention-1' },
  ];
}

export const ALL_CARDS = [...INITIAL_CARDS, ...EFFECT_CARDS];
