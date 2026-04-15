/**
 * Quest Learning Units — 予習スライド教材
 * unit.id は DeckKey と一致。notebookUrl が空のユニットは「準備中」表示。
 */
import type { DeckKey } from './questProgress';

export interface QuestUnit {
  id: DeckKey;
  title: string;
  icon: string;
  slideCount: number;
  duration: string;
  notebookUrl: string;
  deckName: string;
}

export const QUEST_UNITS: QuestUnit[] = [
  {
    id: 'qinshi',
    title: '始皇帝と中華統一',
    icon: '🏛️',
    slideCount: 16,
    duration: '約4分',
    notebookUrl: '',
    deckName: '始皇帝',
  },
  {
    id: 'napoleon',
    title: 'ナポレオンの野望',
    icon: '⚔️',
    slideCount: 16,
    duration: '約4分',
    notebookUrl: '',
    deckName: 'ナポレオン',
  },
  {
    id: 'amazon',
    title: 'アマゾンの生態系',
    icon: '🌿',
    slideCount: 15,
    duration: '約4分',
    notebookUrl: '',
    deckName: 'アマゾン',
  },
  {
    id: 'galileo',
    title: 'ガリレオと科学革命',
    icon: '🔭',
    slideCount: 16,
    duration: '約4分',
    notebookUrl: '',
    deckName: 'ガリレオ',
  },
  {
    id: 'jeanne',
    title: 'ジャンヌ・ダルクと百年戦争',
    icon: '🗡️',
    slideCount: 16,
    duration: '約4分',
    notebookUrl: '',
    deckName: 'ジャンヌ・ダルク',
  },
  {
    id: 'murasaki',
    title: '紫式部と平安文学',
    icon: '📖',
    slideCount: 16,
    duration: '約4分',
    notebookUrl: '',
    deckName: '紫式部',
  },
  {
    id: 'mandela',
    title: 'マンデラと自由への闘い',
    icon: '🌍',
    slideCount: 16,
    duration: '約4分',
    notebookUrl: '',
    deckName: 'マンデラ',
  },
  {
    id: 'davinci',
    title: 'ダ・ヴィンチ — 万能の天才',
    icon: '🎨',
    slideCount: 16,
    duration: '約4分',
    notebookUrl: '',
    deckName: 'ダ・ヴィンチ',
  },
];

export function getQuestUnit(id: string): QuestUnit | undefined {
  return QUEST_UNITS.find((u) => u.id === id);
}

// ============================================================
// Learning Cards — 歴史解説カード
// 画像: /images/learning/lc-<deckKey>-<nn>.png
// 未到着時はデッキテーマカラーのフォールバック表示（UI側で処理）
// ============================================================

export interface LearningCard {
  id: string;
  title: string;          // 見出し（rubyタグ可）
  content: string;        // 本文（rubyタグ可、通常モード）
  image: string;          // /images/learning/lc-xxx.png
  funFact: string;        // 💡豆知識（通常モード）
  easyContent?: string;   // やさしいモード用の本文（漢字少なめ＋ruby多め）
  easyFunFact?: string;   // やさしいモード用の豆知識
}

type LearningCardsByDeck = Partial<Record<DeckKey, LearningCard[]>> & {
  nobunaga?: LearningCard[];
  wolf?: LearningCard[];
};

export const LEARNING_CARDS: LearningCardsByDeck = {
  napoleon: [
    {
      id: 'lc-napoleon-01',
      title: 'ナポレオンって誰？',
      content: '<ruby>地中海<rt>ちちゅうかい</rt></ruby>の小さな島で生まれた<ruby>少年<rt>しょうねん</rt></ruby>が、やがてヨーロッパのほとんどを<ruby>支配<rt>しはい</rt></ruby>する<ruby>皇帝<rt>こうてい</rt></ruby>になった。その名もナポレオン。どうやってそこまでのぼりつめたのか？→',
      image: '/images/learning/lc-napoleon-who.png',
      funFact: '<ruby>身長<rt>しんちょう</rt></ruby>は実は168cmで<ruby>当時<rt>とうじ</rt></ruby>の<ruby>平均<rt>へいきん</rt></ruby>くらい。「チビ」というイメージはイギリスが広めた<ruby>悪口<rt>わるぐち</rt></ruby>だった！',
    },
    {
      id: 'lc-napoleon-02',
      title: 'フランス革命とは？',
      content: 'パンも買えないほど<ruby>貧<rt>まず</rt></ruby>しい<ruby>国民<rt>こくみん</rt></ruby>が、ついに立ち上がった。王の力の<ruby>象徴<rt>しょうちょう</rt></ruby>だったバスティーユ<ruby>牢獄<rt>ろうごく</rt></ruby>を<ruby>襲撃<rt>しゅうげき</rt></ruby>。これがフランス<ruby>革命<rt>かくめい</rt></ruby>の<ruby>始<rt>はじ</rt></ruby>まりだった。ナポレオンは、この大<ruby>混乱<rt>こんらん</rt></ruby>の中で<ruby>頭角<rt>とうかく</rt></ruby>をあらわしていく…→',
      image: '/images/learning/lc-french-revolution.png',
      funFact: 'バスティーユ<ruby>襲撃<rt>しゅうげき</rt></ruby>の日（7月14日）は、今もフランスの<ruby>建国記念日<rt>けんこくきねんび</rt></ruby>として<ruby>盛大<rt>せいだい</rt></ruby>に<ruby>祝<rt>いわ</rt></ruby>われている！',
    },
    {
      id: 'lc-napoleon-03',
      title: 'なぜ皇帝になれた？',
      content: '<ruby>革命<rt>かくめい</rt></ruby>のあと、フランスは大<ruby>混乱<rt>こんらん</rt></ruby>。そこに<ruby>現<rt>あらわ</rt></ruby>れたナポレオンは<ruby>次々<rt>つぎつぎ</rt></ruby>と<ruby>戦<rt>たたか</rt></ruby>いに<ruby>勝<rt>か</rt></ruby>ち、<ruby>国民<rt>こくみん</rt></ruby>の<ruby>絶大<rt>ぜつだい</rt></ruby>な<ruby>支持<rt>しじ</rt></ruby>を<ruby>得<rt>え</rt></ruby>た。そしてついに<ruby>皇帝<rt>こうてい</rt></ruby>に。しかも<ruby>戴冠式<rt>たいかんしき</rt></ruby>では、<ruby>教皇<rt>きょうこう</rt></ruby>の手から<ruby>王冠<rt>おうかん</rt></ruby>を<ruby>取<rt>と</rt></ruby>り上げて自分で<ruby>被<rt>かぶ</rt></ruby>った。→',
      image: '/images/learning/lc-napoleon-emperor.png',
      funFact: '自分で<ruby>王冠<rt>おうかん</rt></ruby>を<ruby>被<rt>かぶ</rt></ruby>せたのは<ruby>歴史<rt>れきし</rt></ruby>上ナポレオンだけ。「この<ruby>地位<rt>ちい</rt></ruby>は<ruby>誰<rt>だれ</rt></ruby>かにもらったものじゃない」という<ruby>意思<rt>いし</rt></ruby>の<ruby>表<rt>あらわ</rt></ruby>れだった！',
    },
    {
      id: 'lc-napoleon-04',
      title: 'ワーテルローの戦い',
      content: '<ruby>無敵<rt>むてき</rt></ruby>に見えたナポレオンにも<ruby>終<rt>お</rt></ruby>わりが<ruby>来<rt>く</rt></ruby>る。ワーテルローでイギリス・プロイセンの<ruby>連合軍<rt>れんごうぐん</rt></ruby>に<ruby>敗<rt>やぶ</rt></ruby>れ、<ruby>大西洋<rt>たいせいよう</rt></ruby>の<ruby>孤島<rt>ことう</rt></ruby>セントヘレナに<ruby>追放<rt>ついほう</rt></ruby>された。ヨーロッパを<ruby>揺<rt>ゆ</rt></ruby>るがした<ruby>英雄<rt>えいゆう</rt></ruby>の、<ruby>最後<rt>さいご</rt></ruby>の<ruby>戦<rt>たたか</rt></ruby>いだった。→',
      image: '/images/learning/lc-waterloo.png',
      funFact: 'ワーテルローの<ruby>戦場<rt>せんじょう</rt></ruby>は今ベルギーの<ruby>観光地<rt>かんこうち</rt></ruby>になっていて、大きなライオンの<ruby>像<rt>ぞう</rt></ruby>が<ruby>建<rt>た</rt></ruby>っている！',
    },
    {
      id: 'lc-napoleon-05',
      title: 'ナポレオン法典って？',
      content: 'ナポレオンが<ruby>残<rt>のこ</rt></ruby>した<ruby>最大<rt>さいだい</rt></ruby>の<ruby>遺産<rt>いさん</rt></ruby>は、実は<ruby>戦争<rt>せんそう</rt></ruby>の<ruby>勝利<rt>しょうり</rt></ruby>ではない。「<ruby>法<rt>ほう</rt></ruby>の前にすべての人は<ruby>平等<rt>びょうどう</rt></ruby>である」と<ruby>定<rt>さだ</rt></ruby>めたナポレオン<ruby>法典<rt>ほうてん</rt></ruby>だ。この<ruby>考<rt>かんが</rt></ruby>えは<ruby>世界中<rt>せかいじゅう</rt></ruby>に<ruby>広<rt>ひろ</rt></ruby>まり、今の<ruby>法律<rt>ほうりつ</rt></ruby>のもとになっている。',
      image: '/images/learning/lc-napoleon-code.png',
      funFact: '実は日本の<ruby>民法<rt>みんぽう</rt></ruby>もナポレオン<ruby>法典<rt>ほうてん</rt></ruby>の<ruby>影響<rt>えいきょう</rt></ruby>を<ruby>受<rt>う</rt></ruby>けている。はるか<ruby>遠<rt>とお</rt></ruby>くの国にまで<ruby>届<rt>とど</rt></ruby>いた！',
    },
  ],

  amazon: [
    {
      id: 'lc-amazon-01',
      title: 'アマゾン川ってどんな川？',
      content: '世界で<ruby>最<rt>もっと</rt></ruby>も多くの水が<ruby>流<rt>なが</rt></ruby>れる川、アマゾン。長さは<ruby>約<rt>やく</rt></ruby>6,400km、<ruby>河口<rt>かこう</rt></ruby>の<ruby>幅<rt>はば</rt></ruby>はなんと330km。この川の<ruby>流域<rt>りゅういき</rt></ruby>には<ruby>地球<rt>ちきゅう</rt></ruby>の<ruby>酸素<rt>さんそ</rt></ruby>の<ruby>約<rt>やく</rt></ruby>20%を生み出す<ruby>巨大<rt>きょだい</rt></ruby>な森が<ruby>広<rt>ひろ</rt></ruby>がっている。→',
      image: '/images/learning/lc-amazon-river.png',
      funFact: '<ruby>河口<rt>かこう</rt></ruby>の<ruby>幅<rt>はば</rt></ruby>330kmってどのくらい？<ruby>東京<rt>とうきょう</rt></ruby>から<ruby>名古屋<rt>なごや</rt></ruby>くらいの<ruby>距離<rt>きょり</rt></ruby>が、まるごと川の<ruby>幅<rt>はば</rt></ruby>！',
    },
    {
      id: 'lc-amazon-02',
      title: 'ピラニアは本当に怖い？',
      content: '<ruby>映画<rt>えいが</rt></ruby>では人を<ruby>襲<rt>おそ</rt></ruby>う<ruby>恐<rt>おそ</rt></ruby>ろしい魚として<ruby>描<rt>えが</rt></ruby>かれるピラニア。でも実は、とても<ruby>臆病<rt>おくびょう</rt></ruby>な魚だ。<ruby>普段<rt>ふだん</rt></ruby>は<ruby>死<rt>し</rt></ruby>んだ魚や<ruby>虫<rt>むし</rt></ruby>を食べて川をきれいにしている、いわば川の<ruby>掃除屋<rt>そうじや</rt></ruby>さん。→',
      image: '/images/learning/lc-piranha-truth.png',
      funFact: 'アマゾンの<ruby>地元<rt>じもと</rt></ruby>の子どもたちは、ピラニアがいる川で<ruby>普通<rt>ふつう</rt></ruby>に<ruby>泳<rt>およ</rt></ruby>いでいる！',
    },
    {
      id: 'lc-amazon-03',
      title: '熱帯雨林はなぜ大事？',
      content: 'アマゾンの<ruby>熱帯雨林<rt>ねったいうりん</rt></ruby>は「<ruby>地球<rt>ちきゅう</rt></ruby>の<ruby>肺<rt>はい</rt></ruby>」と<ruby>呼<rt>よ</rt></ruby>ばれている。<ruby>酸素<rt>さんそ</rt></ruby>を作り、<ruby>雨<rt>あめ</rt></ruby>を<ruby>降<rt>ふ</rt></ruby>らせ、<ruby>数<rt>かぞ</rt></ruby>えきれない生き物の<ruby>住<rt>す</rt></ruby>みかになっている。<ruby>薬<rt>くすり</rt></ruby>の<ruby>原料<rt>げんりょう</rt></ruby>になる<ruby>植物<rt>しょくぶつ</rt></ruby>も、ここから<ruby>見<rt>み</rt></ruby>つかることがある。→',
      image: '/images/learning/lc-rainforest.png',
      funFact: 'アマゾンにはまだ<ruby>発見<rt>はっけん</rt></ruby>されていない生き物が<ruby>数百万種<rt>すうひゃくまんしゅ</rt></ruby>いるとも<ruby>言<rt>い</rt></ruby>われている！',
    },
    {
      id: 'lc-amazon-04',
      title: 'アナコンダと先住民族',
      content: 'アマゾンに<ruby>暮<rt>く</rt></ruby>らすトゥカノ<ruby>族<rt>ぞく</rt></ruby>は、アナコンダを「世界を作った<ruby>祖先<rt>そせん</rt></ruby>」として<ruby>大切<rt>たいせつ</rt></ruby>にしている。<ruby>彼<rt>かれ</rt></ruby>らの<ruby>神話<rt>しんわ</rt></ruby>では、<ruby>巨大<rt>きょだい</rt></ruby>なアナコンダがアマゾン川を<ruby>旅<rt>たび</rt></ruby>しながら、川<ruby>沿<rt>ぞ</rt></ruby>いに<ruby>人間<rt>にんげん</rt></ruby>の<ruby>村<rt>むら</rt></ruby>を作ったという。→',
      image: '/images/learning/lc-anaconda-tribe.png',
      funFact: 'アマゾン川がくねくね<ruby>蛇行<rt>だこう</rt></ruby>する<ruby>姿<rt>すがた</rt></ruby>は、たしかに<ruby>巨大<rt>きょだい</rt></ruby>なアナコンダに見える！',
    },
    {
      id: 'lc-amazon-05',
      title: '毒矢カエルの秘密',
      content: '<ruby>鮮<rt>あざ</rt></ruby>やかな青や赤の<ruby>体<rt>からだ</rt></ruby>は「<ruby>近<rt>ちか</rt></ruby>づいたら<ruby>危険<rt>きけん</rt></ruby>だよ」という<ruby>警告<rt>けいこく</rt></ruby>。<ruby>先住民族<rt>せんじゅうみんぞく</rt></ruby>はこのカエルの<ruby>毒<rt>どく</rt></ruby>を<ruby>矢<rt>や</rt></ruby>に<ruby>塗<rt>ぬ</rt></ruby>って<ruby>狩<rt>か</rt></ruby>りに<ruby>使<rt>つか</rt></ruby>っていた。小さな<ruby>体<rt>からだ</rt></ruby>に、とんでもない力を<ruby>秘<rt>ひ</rt></ruby>めた生き物だ。',
      image: '/images/learning/lc-poison-frog.png',
      funFact: 'たった1<ruby>匹<rt>ぴき</rt></ruby>の<ruby>毒<rt>どく</rt></ruby>で<ruby>大人<rt>おとな</rt></ruby>10人分の<ruby>致死量<rt>ちしりょう</rt></ruby>。でも<ruby>不思議<rt>ふしぎ</rt></ruby>なことに、<ruby>飼育下<rt>しいくか</rt></ruby>では<ruby>毒<rt>どく</rt></ruby>を作れなくなる。食べ物が<ruby>関係<rt>かんけい</rt></ruby>しているらしい！',
    },
  ],

  qinshi: [
    {
      id: 'lc-qinshi-01',
      title: '始皇帝って誰？',
      content: 'わずか13<ruby>歳<rt>さい</rt></ruby>で<ruby>秦<rt>しん</rt></ruby>の王になった<ruby>少年<rt>しょうねん</rt></ruby>。そこから<ruby>他<rt>ほか</rt></ruby>の国を<ruby>次々<rt>つぎつぎ</rt></ruby>と<ruby>倒<rt>たお</rt></ruby>し、<ruby>中国<rt>ちゅうごく</rt></ruby>をはじめて一つにまとめた。「<ruby>皇帝<rt>こうてい</rt></ruby>」という<ruby>言葉<rt>ことば</rt></ruby>を<ruby>発明<rt>はつめい</rt></ruby>したのもこの人。自分を「<ruby>最初<rt>さいしょ</rt></ruby>の<ruby>皇帝<rt>こうてい</rt></ruby>＝<ruby>始皇帝<rt>しこうてい</rt></ruby>」と名<ruby>乗<rt>の</rt></ruby>った。→',
      image: '/images/learning/lc-qin-who.png',
      funFact: '「<ruby>皇帝<rt>こうてい</rt></ruby>」は<ruby>始皇帝<rt>しこうてい</rt></ruby>が作った<ruby>言葉<rt>ことば</rt></ruby>。「王」よりもっとすごい<ruby>称号<rt>しょうごう</rt></ruby>がほしくて、自分で<ruby>考<rt>かんが</rt></ruby>えた！',
    },
    {
      id: 'lc-qinshi-02',
      title: '万里の長城はなぜ作った？',
      content: '北の<ruby>草原<rt>そうげん</rt></ruby>から<ruby>馬<rt>うま</rt></ruby>に<ruby>乗<rt>の</rt></ruby>って<ruby>攻<rt>せ</rt></ruby>めてくる<ruby>遊牧民族<rt>ゆうぼくみんぞく</rt></ruby>。<ruby>始皇帝<rt>しこうてい</rt></ruby>は<ruby>彼<rt>かれ</rt></ruby>らを<ruby>防<rt>ふせ</rt></ruby>ぐために、とてつもなく長い<ruby>壁<rt>かべ</rt></ruby>を<ruby>築<rt>きず</rt></ruby>いた。その<ruby>全長<rt>ぜんちょう</rt></ruby>、<ruby>約<rt>やく</rt></ruby>2<ruby>万<rt>まん</rt></ruby>km。今でも<ruby>宇宙<rt>うちゅう</rt></ruby>から見えると<ruby>言<rt>い</rt></ruby>われたが、実はそれは<ruby>嘘<rt>うそ</rt></ruby>。→',
      image: '/images/learning/lc-great-wall-why.png',
      funFact: '<ruby>建設<rt>けんせつ</rt></ruby>には<ruby>数十万人<rt>すうじゅうまんにん</rt></ruby>が<ruby>動員<rt>どういん</rt></ruby>された。あまりにも<ruby>過酷<rt>かこく</rt></ruby>で、多くの人が<ruby>命<rt>いのち</rt></ruby>を<ruby>落<rt>お</rt></ruby>としたと<ruby>伝<rt>つた</rt></ruby>わっている。',
    },
    {
      id: 'lc-qinshi-03',
      title: '焚書坑儒って何？',
      content: '<ruby>始皇帝<rt>しこうてい</rt></ruby>は自分に<ruby>反対<rt>はんたい</rt></ruby>する<ruby>声<rt>こえ</rt></ruby>を<ruby>徹底的<rt>てっていてき</rt></ruby>に<ruby>潰<rt>つぶ</rt></ruby>した。本を<ruby>集<rt>あつ</rt></ruby>めて<ruby>燃<rt>も</rt></ruby>やし（<ruby>焚書<rt>ふんしょ</rt></ruby>）、<ruby>批判<rt>ひはん</rt></ruby>した<ruby>学者<rt>がくしゃ</rt></ruby>を生き<ruby>埋<rt>う</rt></ruby>めにした（<ruby>坑儒<rt>こうじゅ</rt></ruby>）。<ruby>恐<rt>おそ</rt></ruby>ろしい話だが、<ruby>医学<rt>いがく</rt></ruby>や<ruby>農業<rt>のうぎょう</rt></ruby>の<ruby>実用書<rt>じつようしょ</rt></ruby>は<ruby>残<rt>のこ</rt></ruby>すという<ruby>冷静<rt>れいせい</rt></ruby>さもあった。→',
      image: '/images/learning/lc-book-burning.png',
      funFact: '<ruby>全部<rt>ぜんぶ</rt></ruby><ruby>燃<rt>も</rt></ruby>やしたわけではない。<ruby>役<rt>やく</rt></ruby>に立つ本は<ruby>残<rt>のこ</rt></ruby>した。<ruby>始皇帝<rt>しこうてい</rt></ruby>なりの<ruby>合理的<rt>ごうりてき</rt></ruby>な<ruby>判断<rt>はんだん</rt></ruby>だった！',
    },
    {
      id: 'lc-qinshi-04',
      title: '兵馬俑ってすごい！',
      content: '<ruby>始皇帝<rt>しこうてい</rt></ruby>の<ruby>墓<rt>はか</rt></ruby>を<ruby>守<rt>まも</rt></ruby>るために作られた、8,000<ruby>体<rt>たい</rt></ruby><ruby>以上<rt>いじょう</rt></ruby>の<ruby>兵士<rt>へいし</rt></ruby>の<ruby>像<rt>ぞう</rt></ruby>。<ruby>驚<rt>おどろ</rt></ruby>くべきことに、<ruby>一体一体<rt>いったいいったい</rt></ruby>の<ruby>顔<rt>かお</rt></ruby>がすべて<ruby>違<rt>ちが</rt></ruby>う。<ruby>地下<rt>ちか</rt></ruby>に<ruby>眠<rt>ねむ</rt></ruby>る<ruby>巨大<rt>きょだい</rt></ruby>な<ruby>軍隊<rt>ぐんたい</rt></ruby>は、2,000<ruby>年以上<rt>ねんいじょう</rt></ruby>もの<ruby>間<rt>あいだ</rt></ruby>、<ruby>誰<rt>だれ</rt></ruby>にも<ruby>知<rt>し</rt></ruby>られていなかった。→',
      image: '/images/learning/lc-terracotta.png',
      funFact: '1974年、<ruby>井戸<rt>いど</rt></ruby>を<ruby>掘<rt>ほ</rt></ruby>っていた<ruby>農民<rt>のうみん</rt></ruby>がたまたま<ruby>発見<rt>はっけん</rt></ruby>した。<ruby>世紀<rt>せいき</rt></ruby>の<ruby>大発見<rt>だいはっけん</rt></ruby>は<ruby>偶然<rt>ぐうぜん</rt></ruby>だった！',
    },
    {
      id: 'lc-qinshi-05',
      title: '紙の発明',
      content: '<ruby>紙<rt>かみ</rt></ruby>がなかった<ruby>時代<rt>じだい</rt></ruby>、<ruby>人々<rt>ひとびと</rt></ruby>は<ruby>竹<rt>たけ</rt></ruby>や木の<ruby>板<rt>いた</rt></ruby>に<ruby>文字<rt>もじ</rt></ruby>を書いていた。<ruby>中国<rt>ちゅうごく</rt></ruby>で<ruby>紙<rt>かみ</rt></ruby>が<ruby>発明<rt>はつめい</rt></ruby>されたことで、<ruby>知識<rt>ちしき</rt></ruby>を広く<ruby>伝<rt>つた</rt></ruby>えられるようになった。この<ruby>発明<rt>はつめい</rt></ruby>が世界を大きく<ruby>変<rt>か</rt></ruby>えた。',
      image: '/images/learning/lc-paper-invention.png',
      funFact: '<ruby>紙<rt>かみ</rt></ruby>が<ruby>発明<rt>はつめい</rt></ruby>される前、本1<ruby>冊分<rt>さつぶん</rt></ruby>の<ruby>竹簡<rt>ちくかん</rt></ruby>（<ruby>竹<rt>たけ</rt></ruby>の<ruby>板<rt>いた</rt></ruby>）は<ruby>馬車<rt>ばしゃ</rt></ruby>1<ruby>台分<rt>だいぶん</rt></ruby>の<ruby>重<rt>おも</rt></ruby>さがあった！',
    },
  ],

  nobunaga: [
    {
      id: 'lc-nobunaga-01',
      title: '織田信長って誰？',
      content: '子どもの<ruby>頃<rt>ころ</rt></ruby>は「うつけ<ruby>者<rt>もの</rt></ruby>（バカ）」と<ruby>呼<rt>よ</rt></ruby>ばれていた<ruby>少年<rt>しょうねん</rt></ruby>。でも実は、<ruby>誰<rt>だれ</rt></ruby>よりも<ruby>先<rt>さき</rt></ruby>を見ていた。<ruby>古<rt>ふる</rt></ruby>いしきたりを<ruby>壊<rt>こわ</rt></ruby>し、新しいやり方で日本の<ruby>歴史<rt>れきし</rt></ruby>を大きく<ruby>動<rt>うご</rt></ruby>かした<ruby>革命児<rt>かくめいじ</rt></ruby>だった。→',
      image: '/images/learning/lc-nobunaga-who.png',
      funFact: '<ruby>幼<rt>おさな</rt></ruby>い<ruby>頃<rt>ころ</rt></ruby>は<ruby>裸<rt>はだか</rt></ruby>で<ruby>町<rt>まち</rt></ruby>を<ruby>走<rt>はし</rt></ruby>り<ruby>回<rt>まわ</rt></ruby>り、<ruby>行儀<rt>ぎょうぎ</rt></ruby>が<ruby>悪<rt>わる</rt></ruby>すぎて<ruby>家臣<rt>かしん</rt></ruby>たちに<ruby>心配<rt>しんぱい</rt></ruby>された！',
    },
    {
      id: 'lc-nobunaga-02',
      title: '桶狭間の奇跡',
      content: '<ruby>敵<rt>てき</rt></ruby>は2<ruby>万<rt>まん</rt></ruby>5<ruby>千<rt>せん</rt></ruby>、<ruby>味方<rt>みかた</rt></ruby>はたった3<ruby>千<rt>せん</rt></ruby>。<ruby>普通<rt>ふつう</rt></ruby>なら<ruby>絶対<rt>ぜったい</rt></ruby>に<ruby>勝<rt>か</rt></ruby>てない<ruby>戦<rt>たたか</rt></ruby>い。しかし<ruby>信長<rt>のぶなが</rt></ruby>は<ruby>嵐<rt>あらし</rt></ruby>の日をねらって<ruby>奇襲<rt>きしゅう</rt></ruby>をかけ、<ruby>敵<rt>てき</rt></ruby>の<ruby>大将<rt>たいしょう</rt></ruby>・<ruby>今川義元<rt>いまがわよしもと</rt></ruby>を<ruby>討<rt>う</rt></ruby>ち<ruby>取<rt>と</rt></ruby>った。日本の<ruby>歴史<rt>れきし</rt></ruby>を<ruby>変<rt>か</rt></ruby>えた<ruby>一戦<rt>いっせん</rt></ruby>だった。→',
      image: '/images/learning/lc-okehazama.png',
      funFact: '<ruby>嵐<rt>あらし</rt></ruby>の<ruby>音<rt>おと</rt></ruby>で<ruby>足音<rt>あしおと</rt></ruby>が<ruby>消<rt>け</rt></ruby>されると<ruby>計算<rt>けいさん</rt></ruby>していた。<ruby>天気<rt>てんき</rt></ruby>すら<ruby>味方<rt>みかた</rt></ruby>にした<ruby>戦術家<rt>せんじゅつか</rt></ruby>！',
    },
    {
      id: 'lc-nobunaga-03',
      title: '鉄砲が変えた戦い',
      content: 'ポルトガルから<ruby>伝<rt>つた</rt></ruby>わった<ruby>鉄砲<rt>てっぽう</rt></ruby>に、<ruby>信長<rt>のぶなが</rt></ruby>はいち<ruby>早<rt>はや</rt></ruby>く<ruby>目<rt>め</rt></ruby>をつけた。<ruby>他<rt>ほか</rt></ruby>の<ruby>大名<rt>だいみょう</rt></ruby>が<ruby>数百挺<rt>すうひゃくちょう</rt></ruby>しか<ruby>持<rt>も</rt></ruby>てなかった<ruby>鉄砲<rt>てっぽう</rt></ruby>を、<ruby>信長<rt>のぶなが</rt></ruby>は3,000<ruby>挺<rt>ちょう</rt></ruby>も<ruby>集<rt>あつ</rt></ruby>めた。これにより<ruby>武士<rt>ぶし</rt></ruby>の<ruby>一騎討<rt>いっきう</rt></ruby>ちの<ruby>時代<rt>じだい</rt></ruby>は<ruby>終<rt>お</rt></ruby>わり、<ruby>集団戦<rt>しゅうだんせん</rt></ruby>の<ruby>時代<rt>じだい</rt></ruby>が<ruby>始<rt>はじ</rt></ruby>まった。→',
      image: '/images/learning/lc-guns-changed.png',
      funFact: '<ruby>信長<rt>のぶなが</rt></ruby>が<ruby>大量<rt>たいりょう</rt></ruby>の<ruby>鉄砲<rt>てっぽう</rt></ruby>を<ruby>買<rt>か</rt></ruby>えたのは、<ruby>楽市楽座<rt>らくいちらくざ</rt></ruby>で<ruby>儲<rt>もう</rt></ruby>けた<ruby>経済力<rt>けいざいりょく</rt></ruby>があったから！',
    },
    {
      id: 'lc-nobunaga-04',
      title: '楽市楽座って？',
      content: '<ruby>信長<rt>のぶなが</rt></ruby>は<ruby>戦<rt>たたか</rt></ruby>いだけでなく、<ruby>経済<rt>けいざい</rt></ruby>の<ruby>天才<rt>てんさい</rt></ruby>でもあった。「<ruby>楽市楽座<rt>らくいちらくざ</rt></ruby>」は、<ruby>誰<rt>だれ</rt></ruby>でも自由に<ruby>商売<rt>しょうばい</rt></ruby>できるようにした<ruby>制度<rt>せいど</rt></ruby>。これで<ruby>城下町<rt>じょうかまち</rt></ruby>は大いに<ruby>栄<rt>さか</rt></ruby>え、<ruby>信長<rt>のぶなが</rt></ruby>は<ruby>他<rt>ほか</rt></ruby>の<ruby>大名<rt>だいみょう</rt></ruby>よりはるかに<ruby>豊<rt>ゆた</rt></ruby>かになった。→',
      image: '/images/learning/lc-rakuichi.png',
      funFact: '今でいう「<ruby>規制緩和<rt>きせいかんわ</rt></ruby>」と同じ<ruby>考<rt>かんが</rt></ruby>え方。400<ruby>年以上<rt>ねんいじょう</rt></ruby>前に<ruby>実行<rt>じっこう</rt></ruby>していたのがすごい！',
    },
    {
      id: 'lc-nobunaga-05',
      title: '本能寺の変とは？',
      content: '<ruby>天下統一<rt>てんかとういつ</rt></ruby>まであと少し。しかし<ruby>信頼<rt>しんらい</rt></ruby>していた<ruby>家臣<rt>かしん</rt></ruby>・<ruby>明智光秀<rt>あけちみつひで</rt></ruby>に<ruby>裏切<rt>うらぎ</rt></ruby>られ、<ruby>京都<rt>きょうと</rt></ruby>の<ruby>本能寺<rt>ほんのうじ</rt></ruby>で<ruby>最期<rt>さいご</rt></ruby>を<ruby>迎<rt>むか</rt></ruby>えた。<ruby>信長<rt>のぶなが</rt></ruby>は<ruby>炎<rt>ほのお</rt></ruby>の中で「<ruby>是非<rt>ぜひ</rt></ruby>に<ruby>及<rt>およ</rt></ruby>ばず（<ruby>仕方<rt>しかた</rt></ruby>のないことだ）」とつぶやいたと<ruby>伝<rt>つた</rt></ruby>えられている。',
      image: '/images/learning/lc-honnoji-story.png',
      funFact: '<ruby>光秀<rt>みつひで</rt></ruby>が<ruby>天下<rt>てんか</rt></ruby>を<ruby>取<rt>と</rt></ruby>れたのはわずか13<ruby>日間<rt>にちかん</rt></ruby>。「<ruby>三日天下<rt>みっかてんか</rt></ruby>」という<ruby>言葉<rt>ことば</rt></ruby>はここから生まれた！',
    },
  ],

  jeanne: [
    {
      id: 'lc-jeanne-01',
      title: 'ジャンヌダルクって誰？',
      content: 'フランスの小さな<ruby>農村<rt>のうそん</rt></ruby>で<ruby>育<rt>そだ</rt></ruby>った<ruby>少女<rt>しょうじょ</rt></ruby>。13<ruby>歳<rt>さい</rt></ruby>のある日、「フランスを<ruby>救<rt>すく</rt></ruby>いなさい」という<ruby>神<rt>かみ</rt></ruby>の<ruby>声<rt>こえ</rt></ruby>が<ruby>聞<rt>き</rt></ruby>こえた。<ruby>読<rt>よ</rt></ruby>み書きもできない<ruby>少女<rt>しょうじょ</rt></ruby>が、やがてフランス<ruby>軍<rt>ぐん</rt></ruby>を<ruby>率<rt>ひき</rt></ruby>いて<ruby>戦<rt>たたか</rt></ruby>うことになる。→',
      image: '/images/learning/lc-jeanne-who.png',
      funFact: 'ジャンヌは<ruby>文字<rt>もじ</rt></ruby>が<ruby>読<rt>よ</rt></ruby>めなかったが、<ruby>戦場<rt>せんじょう</rt></ruby>では<ruby>大人<rt>おとな</rt></ruby>の<ruby>将軍<rt>しょうぐん</rt></ruby>たちを<ruby>指揮<rt>しき</rt></ruby>した！',
    },
    {
      id: 'lc-jeanne-02',
      title: '百年戦争とは？',
      content: 'イギリスとフランスは、なんと116<ruby>年間<rt>ねんかん</rt></ruby>も<ruby>戦<rt>たたか</rt></ruby>い<ruby>続<rt>つづ</rt></ruby>けた。フランスは<ruby>追<rt>お</rt></ruby>い<ruby>詰<rt>つ</rt></ruby>められ、もう<ruby>負<rt>ま</rt></ruby>けるかもしれないという<ruby>状況<rt>じょうきょう</rt></ruby>だった。そこに<ruby>現<rt>あらわ</rt></ruby>れたのが、17<ruby>歳<rt>さい</rt></ruby>のジャンヌだった。→',
      image: '/images/learning/lc-hundred-years-war.png',
      funFact: '「<ruby>百年戦争<rt>ひゃくねんせんそう</rt></ruby>」という<ruby>名前<rt>なまえ</rt></ruby>だけど、<ruby>実際<rt>じっさい</rt></ruby>は116<ruby>年間<rt>ねんかん</rt></ruby>。<ruby>途中<rt>とちゅう</rt></ruby>で<ruby>何度<rt>なんど</rt></ruby>か<ruby>休戦<rt>きゅうせん</rt></ruby>した<ruby>時期<rt>じき</rt></ruby>もある！',
    },
    {
      id: 'lc-jeanne-03',
      title: 'オルレアンの解放',
      content: 'イギリス<ruby>軍<rt>ぐん</rt></ruby>に<ruby>包囲<rt>ほうい</rt></ruby>されたオルレアン。<ruby>何<rt>なん</rt></ruby>ヶ月も<ruby>続<rt>つづ</rt></ruby>いた<ruby>包囲<rt>ほうい</rt></ruby>を、ジャンヌ<ruby>率<rt>ひき</rt></ruby>いるフランス<ruby>軍<rt>ぐん</rt></ruby>はわずか9日で<ruby>突破<rt>とっぱ</rt></ruby>した。<ruby>矢<rt>や</rt></ruby>を<ruby>受<rt>う</rt></ruby>けても<ruby>戦<rt>たたか</rt></ruby>い<ruby>続<rt>つづ</rt></ruby>けるジャンヌの<ruby>姿<rt>すがた</rt></ruby>が、<ruby>兵士<rt>へいし</rt></ruby>たちの<ruby>心<rt>こころ</rt></ruby>に<ruby>火<rt>ひ</rt></ruby>をつけた。→',
      image: '/images/learning/lc-orleans.png',
      funFact: 'ジャンヌは<ruby>肩<rt>かた</rt></ruby>に<ruby>矢<rt>や</rt></ruby>が<ruby>刺<rt>さ</rt></ruby>さっても<ruby>戦場<rt>せんじょう</rt></ruby>から<ruby>離<rt>はな</rt></ruby>れず、<ruby>兵士<rt>へいし</rt></ruby>たちを<ruby>奮<rt>ふる</rt></ruby>い立たせ<ruby>続<rt>つづ</rt></ruby>けた！',
    },
    {
      id: 'lc-jeanne-04',
      title: 'なぜ聖女と呼ばれた？',
      content: 'しかしジャンヌは19<ruby>歳<rt>さい</rt></ruby>で<ruby>捕<rt>と</rt></ruby>らえられ、<ruby>火刑<rt>かけい</rt></ruby>に<ruby>処<rt>しょ</rt></ruby>された。「<ruby>魔女<rt>まじょ</rt></ruby>」として<ruby>裁<rt>さば</rt></ruby>かれたのだ。だが500<ruby>年後<rt>ねんご</rt></ruby>、カトリック<ruby>教会<rt>きょうかい</rt></ruby>はジャンヌを「<ruby>聖女<rt>せいじょ</rt></ruby>」として<ruby>正式<rt>せいしき</rt></ruby>に<ruby>認<rt>みと</rt></ruby>めた。<ruby>歴史<rt>れきし</rt></ruby>が、ようやく<ruby>彼女<rt>かのじょ</rt></ruby>に<ruby>正<rt>ただ</rt></ruby>しい<ruby>名前<rt>なまえ</rt></ruby>を<ruby>与<rt>あた</rt></ruby>えた。',
      image: '/images/learning/lc-saint-jeanne.png',
      funFact: 'ジャンヌの<ruby>裁判記録<rt>さいばんきろく</rt></ruby>が今も<ruby>残<rt>のこ</rt></ruby>っていて、<ruby>彼女<rt>かのじょ</rt></ruby>が<ruby>実際<rt>じっさい</rt></ruby>に<ruby>語<rt>かた</rt></ruby>った<ruby>言葉<rt>ことば</rt></ruby>を<ruby>読<rt>よ</rt></ruby>むことができる！',
    },
  ],

  murasaki: [
    {
      id: 'lc-murasaki-01',
      title: '紫式部って誰？',
      content: '今から<ruby>約<rt>やく</rt></ruby>1,000<ruby>年前<rt>ねんまえ</rt></ruby>、<ruby>平安時代<rt>へいあんじだい</rt></ruby>の<ruby>宮廷<rt>きゅうてい</rt></ruby>に一人の<ruby>才女<rt>さいじょ</rt></ruby>がいた。<ruby>彼女<rt>かのじょ</rt></ruby>が書いた<ruby>物語<rt>ものがたり</rt></ruby>は、<ruby>世界最古<rt>せかいさいこ</rt></ruby>の<ruby>長編小説<rt>ちょうへんしょうせつ</rt></ruby>と<ruby>呼<rt>よ</rt></ruby>ばれている。その名は「<ruby>源氏物語<rt>げんじものがたり</rt></ruby>」。<ruby>作者<rt>さくしゃ</rt></ruby>の名は、<ruby>紫式部<rt>むらさきしきぶ</rt></ruby>。→',
      image: '/images/learning/lc-murasaki-who.png',
      funFact: '「<ruby>紫式部<rt>むらさきしきぶ</rt></ruby>」はペンネームで、<ruby>本名<rt>ほんみょう</rt></ruby>は今もわかっていない。1,000<ruby>年最大<rt>ねんさいだい</rt></ruby>のミステリー！',
    },
    {
      id: 'lc-murasaki-02',
      title: '源氏物語ってどんな話？',
      content: '<ruby>主人公<rt>しゅじんこう</rt></ruby>は<ruby>光源氏<rt>ひかるげんじ</rt></ruby>という<ruby>美<rt>うつく</rt></ruby>しい<ruby>貴族<rt>きぞく</rt></ruby>。<ruby>恋<rt>こい</rt></ruby>あり、<ruby>涙<rt>なみだ</rt></ruby>あり、<ruby>権力争<rt>けんりょくあらそ</rt></ruby>いあり。<ruby>全<rt>ぜん</rt></ruby>54<ruby>巻<rt>かん</rt></ruby>にもなる<ruby>超大作<rt>ちょうたいさく</rt></ruby>を、<ruby>紫式部<rt>むらさきしきぶ</rt></ruby>はたった一人で書き上げた。1,000<ruby>年後<rt>ねんご</rt></ruby>の今でも、<ruby>世界中<rt>せかいじゅう</rt></ruby>の人に<ruby>読<rt>よ</rt></ruby>まれ<ruby>続<rt>つづ</rt></ruby>けている。→',
      image: '/images/learning/lc-genji-story.png',
      funFact: '54<ruby>巻<rt>かん</rt></ruby>もある<ruby>源氏物語<rt>げんじものがたり</rt></ruby>。<ruby>現代<rt>げんだい</rt></ruby>の<ruby>文庫本<rt>ぶんこぼん</rt></ruby>にすると10<ruby>冊以上<rt>さついじょう</rt></ruby>。1,000<ruby>年前<rt>ねんまえ</rt></ruby>にこれを書いたのがすごい！',
    },
    {
      id: 'lc-murasaki-03',
      title: '平安時代の暮らし',
      content: '<ruby>平安時代<rt>へいあんじだい</rt></ruby>の<ruby>貴族<rt>きぞく</rt></ruby>は、<ruby>直接<rt>ちょくせつ</rt></ruby>会って話すより<ruby>和歌<rt>わか</rt></ruby>（<ruby>短<rt>みじか</rt></ruby>い<ruby>詩<rt>し</rt></ruby>）を<ruby>送<rt>おく</rt></ruby>り<ruby>合<rt>あ</rt></ruby>った。<ruby>季節<rt>きせつ</rt></ruby>の<ruby>移<rt>うつ</rt></ruby>り<ruby>変<rt>か</rt></ruby>わりを<ruby>大切<rt>たいせつ</rt></ruby>にし、<ruby>衣<rt>ころも</rt></ruby>の<ruby>色<rt>いろ</rt></ruby>の<ruby>組<rt>く</rt></ruby>み<ruby>合<rt>あ</rt></ruby>わせにもこだわった。<ruby>美<rt>うつく</rt></ruby>しさを<ruby>何<rt>なに</rt></ruby>より<ruby>重<rt>おも</rt></ruby>んじる<ruby>時代<rt>じだい</rt></ruby>だった。→',
      image: '/images/learning/lc-heian-life.png',
      funFact: '<ruby>貴族<rt>きぞく</rt></ruby>の<ruby>女性<rt>じょせい</rt></ruby>は<ruby>顔<rt>かお</rt></ruby>を見せないのがマナー。<ruby>扇<rt>おうぎ</rt></ruby>や<ruby>御簾<rt>みす</rt></ruby>で<ruby>隠<rt>かく</rt></ruby>すのが<ruby>常識<rt>じょうしき</rt></ruby>だった！',
    },
    {
      id: 'lc-murasaki-04',
      title: 'ひらがなの誕生',
      content: '<ruby>当時<rt>とうじ</rt></ruby>、<ruby>正式<rt>せいしき</rt></ruby>な<ruby>文書<rt>ぶんしょ</rt></ruby>は<ruby>漢字<rt>かんじ</rt></ruby>で書くものとされていた。でも<ruby>漢字<rt>かんじ</rt></ruby>をくずした「ひらがな」が生まれたことで、<ruby>日本語<rt>にほんご</rt></ruby>の<ruby>繊細<rt>せんさい</rt></ruby>な<ruby>感情<rt>かんじょう</rt></ruby>を自由に<ruby>表現<rt>ひょうげん</rt></ruby>できるようになった。<ruby>紫式部<rt>むらさきしきぶ</rt></ruby>が<ruby>源氏物語<rt>げんじものがたり</rt></ruby>を書けたのも、ひらがなのおかげだ。',
      image: '/images/learning/lc-hiragana.png',
      funFact: 'ひらがなは<ruby>最初<rt>さいしょ</rt></ruby>「<ruby>女手<rt>おんなで</rt></ruby>」と<ruby>呼<rt>よ</rt></ruby>ばれた。<ruby>女性<rt>じょせい</rt></ruby>たちが<ruby>中心<rt>ちゅうしん</rt></ruby>になって<ruby>使<rt>つか</rt></ruby>い<ruby>広<rt>ひろ</rt></ruby>めたから！',
    },
  ],

  mandela: [
    {
      id: 'lc-mandela-01',
      title: 'マンデラって誰？',
      content: '南アフリカで生まれたネルソン・マンデラ。弁護士として人々の権利のために戦い、投獄され、それでもあきらめなかった。そして76歳で、南アフリカ初の黒人大統領になった。→',
      image: '/images/learning/lc-mandela-who.png',
      funFact: '大統領になった時76歳。人生の3分の1にあたる27年間を刑務所で過ごしていた！',
    },
    {
      id: 'lc-mandela-02',
      title: 'アパルトヘイトとは？',
      content: 'かつて南アフリカには、肌の色で人を分ける法律があった。バスの座席も、学校も、トイレまで別々。「アパルトヘイト（隔離）」と呼ばれるこの制度に、マンデラは真っ向から立ち向かった。→',
      image: '/images/learning/lc-apartheid.png',
      funFact: 'アパルトヘイトは1948年から1991年まで43年間も続いた。生まれた時から差別が当たり前の社会だった。',
    },
    {
      id: 'lc-mandela-03',
      title: 'なぜ27年も投獄された？',
      content: '差別に反対する活動を続けたマンデラは「危険人物」として逮捕された。ロベン島の小さな独房で27年間。しかしマンデラは絶望せず、獄中でも法律の勉強を続け、仲間たちに教え続けた。→',
      image: '/images/learning/lc-robben-prison.png',
      funFact: '刑務所の看守たちもマンデラの人柄に感動し、やがて尊敬するようになったという！',
    },
    {
      id: 'lc-mandela-04',
      title: '赦しの力',
      content: '27年もの間、自分を閉じ込めた人たちを、マンデラは許した。「恨みを持ち続けることは、自分自身を牢獄に閉じ込め続けるのと同じだ」と語った。この赦しの精神が、南アフリカを「虹の国」へと変えていった。',
      image: '/images/learning/lc-forgiveness.png',
      funFact: '大統領になった後、自分を監視していた元看守を昼食に招待した。相手は驚いて泣いたという！',
    },
  ],

  wolf: [
    {
      id: 'lc-wolf-01',
      title: 'オオカミの群れの仕組み',
      content: 'オオカミは群れで暮らす動物。リーダーの「αペア」を中心に、見張り役、子育て役と、しっかり役割を分けて生活している。実はこのα、つまりリーダーはお父さんとお母さんのこと。群れとは家族なのだ。→',
      image: '/images/learning/lc-wolf-pack.png',
      funFact: '映画で描かれる「力で支配するリーダー」は実は誤解。自然界のリーダーは家族を守る親のこと！',
    },
    {
      id: 'lc-wolf-02',
      title: 'ニホンオオカミはなぜ絶滅した？',
      content: '日本にもかつてオオカミがいた。しかし人間が森を切り開き、住む場所を奪い、さらに狂犬病の流行も重なって数を減らしていった。1905年、奈良県で最後の1頭が確認されたのを最後に、ニホンオオカミは姿を消した。→',
      image: '/images/learning/lc-nihon-wolf.png',
      funFact: '最後のニホンオオカミの剥製は今も博物館に保管されている。体長はわずか1mほどだった！',
    },
    {
      id: 'lc-wolf-03',
      title: 'イエローストーンの奇跡',
      content: 'アメリカのイエローストーン国立公園では、オオカミが絶滅したら鹿が増えすぎて木が枯れ、川の流れまで変わってしまった。そこでオオカミを再び戻したところ、森が蘇り、川が元の姿を取り戻した。→',
      image: '/images/learning/lc-yellowstone.png',
      funFact: 'オオカミが戻ったら川の形まで変わった。これを「栄養カスケード」と呼ぶ。自然は全部つながっている！',
    },
    {
      id: 'lc-wolf-04',
      title: 'オオカミと人間の関係',
      content: '犬の祖先はオオカミだ。約1万5千年前、人間とオオカミは出会い、一緒に暮らし始めた。チワワもゴールデンレトリバーもグレートデンも、みんなオオカミの子孫。人間が最初に友達になった動物、それがオオカミだった。',
      image: '/images/learning/lc-wolf-human.png',
      funFact: 'あらゆる犬種の祖先がオオカミ。チワワからグレートデンまで、元は同じ動物！',
    },
  ],

  galileo: [
    {
      id: 'lc-galileo-01',
      title: 'ガリレオって誰？',
      content: '最初は医者を目指して大学に入った青年。ところが数学と物理に夢中になり、やがて自分で望遠鏡を改良して夜空を観察し始めた。そこで見たものが、世界の常識をひっくり返すことになる。→',
      image: '/images/learning/lc-galileo-who.png',
      funFact: '大学では医学を学ぶはずだったが、授業中に数学の本ばかり読んでいたらしい！',
    },
    {
      id: 'lc-galileo-02',
      title: '地動説と天動説',
      content: '当時、「地球が宇宙の中心で、太陽が地球のまわりを回っている」と信じられていた。しかしガリレオは望遠鏡で観察を重ね、「地球が太陽のまわりを回っている」ことを確信した。これは当時、とんでもなく危険な考えだった。→',
      image: '/images/learning/lc-helio-vs-geo.png',
      funFact: '地動説を最初に唱えたのはコペルニクス。でも証拠を示したのはガリレオだった！',
    },
    {
      id: 'lc-galileo-03',
      title: '望遠鏡で何を見つけた？',
      content: 'ガリレオが改良した望遠鏡で夜空を覗くと、月にはクレーター（でこぼこ）があり、木星には4つの衛星が回っていた。「天体は完璧な球体」という常識が崩れた瞬間だった。→',
      image: '/images/learning/lc-telescope.png',
      funFact: '木星の4つの衛星は今も「ガリレオ衛星」と呼ばれている。イオ、エウロパ、ガニメデ、カリスト！',
    },
    {
      id: 'lc-galileo-04',
      title: '科学と権力',
      content: '「地球は動かない」と教える教会に逆らったガリレオは、宗教裁判にかけられた。有罪判決を受け、「それでも地球は動いている」とつぶやいたという伝説が残っている。ガリレオの名誉が正式に回復されたのは、なんと359年後のことだった。',
      image: '/images/learning/lc-galileo-trial.png',
      funFact: 'ガリレオの名誉回復は1992年。ローマ教皇ヨハネ・パウロ2世が誤りを認めた！',
    },
  ],

  davinci: [
    {
      id: 'lc-davinci-01',
      title: 'ダ・ヴィンチって誰？',
      content: '画家、彫刻家、建築家、科学者、発明家、解剖学者、音楽家…。レオナルド・ダ・ヴィンチはあまりにも多くのことをやりすぎた天才だった。500年前に、ヘリコプターや戦車のアイデアまで考えていた。→',
      easyContent: '絵をかく人、<ruby>彫刻<rt>ちょうこく</rt></ruby>をつくる人、<ruby>建物<rt>たてもの</rt></ruby>をつくる人、<ruby>科学者<rt>かがくしゃ</rt></ruby>…。ダ・ヴィンチは何でもできるすごい人だった。500年も前に、空をとぶ<ruby>機械<rt>きかい</rt></ruby>のアイデアまで考えていたんだ。→',
      image: '/images/learning/lc-davinci-who.png',
      funFact: 'ダ・ヴィンチは左利きで、鏡に映したように右から左に文字を書いた。読まれたくないメモを隠すためだったとも言われている！',
      easyFunFact: 'ダ・ヴィンチは左きき。文字を右から左にかいていたんだ。<ruby>秘密<rt>ひみつ</rt></ruby>のメモをかくすためだったかも！',
    },
    {
      id: 'lc-davinci-02',
      title: 'モナ・リザの謎',
      content: '世界で一番有名な絵、モナ・リザ。でもこの絵には謎が多い。描かれた女性は誰なのか？なぜ微笑んでいるのか？ダ・ヴィンチはこの絵を手放さず、死ぬまで持ち歩いていたという。→',
      easyContent: '世界で一番ゆうめいな絵、モナ・リザ。でもこの絵にはなぞがたくさん。かかれた女の人はだれ？なぜわらっているの？ダ・ヴィンチはこの絵を手ばなさず、しぬまでもちあるいていたんだって。→',
      image: '/images/learning/lc-mona-lisa.png',
      funFact: 'モナ・リザは意外と小さい。77cm×53cmで、だいたいノートパソコンを開いたくらいのサイズ！',
      easyFunFact: 'モナ・リザは思ったより小さい絵なんだ。ノートパソコンを開いたくらいの大きさだよ！',
    },
    {
      id: 'lc-davinci-03',
      title: '500年先を行った発明家',
      content: 'ダ・ヴィンチのノートには、ヘリコプター、パラシュート、戦車、潜水服の設計図が残されている。どれも当時の技術では作れなかったが、500年後に実際に発明された。未来を見ていた男だった。→',
      easyContent: 'ダ・ヴィンチのノートには、ヘリコプターやパラシュート、<ruby>戦車<rt>せんしゃ</rt></ruby>の絵がのこっている。当時はつくれなかったけど、500年後にほんとうに<ruby>発明<rt>はつめい</rt></ruby>されたんだ。<ruby>未来<rt>みらい</rt></ruby>が見えていたのかも。→',
      image: '/images/learning/lc-davinci-inventions.png',
      funFact: 'ダ・ヴィンチのノートは約7,000ページ残っている。でもこれは全体の3分の1くらいで、残りは失われてしまった！',
      easyFunFact: 'ダ・ヴィンチのノートは7,000ページもある！でもこれは3分の1で、のこりはなくなってしまったんだ！',
    },
    {
      id: 'lc-davinci-04',
      title: '「最後の晩餐」と科学の目',
      content: 'ダ・ヴィンチは絵を描くために人体を解剖し、筋肉や骨の構造を研究した。「最後の晩餐」に描かれた人物の表情やポーズは、すべて科学的な観察に基づいている。芸術と科学は、ダ・ヴィンチの中で一つだった。',
      easyContent: 'ダ・ヴィンチは絵をかくために人の体を<ruby>研究<rt>けんきゅう</rt></ruby>した。「<ruby>最後<rt>さいご</rt></ruby>の<ruby>晩餐<rt>ばんさん</rt></ruby>」にかかれた人の<ruby>表情<rt>ひょうじょう</rt></ruby>やポーズは、ぜんぶ<ruby>科学的<rt>かがくてき</rt></ruby>にしらべてかいたもの。<ruby>芸術<rt>げいじゅつ</rt></ruby>と科学は、ダ・ヴィンチの中で一つだったんだ。',
      image: '/images/learning/lc-last-supper.png',
      funFact: 'ダ・ヴィンチは30体以上の遺体を解剖して人体を研究した。そのスケッチは現代の医学書と比べても正確だった！',
      easyFunFact: 'ダ・ヴィンチは30人いじょうの体を<ruby>調<rt>しら</rt></ruby>べて<ruby>研究<rt>けんきゅう</rt></ruby>した。そのスケッチは今の<ruby>医学<rt>いがく</rt></ruby>の本とくらべてもただしいんだって！',
    },
    {
      id: 'lc-davinci-05',
      title: '人体の秘密に挑んだ男',
      content: '当時、人の体を切り開いて調べることは禁じられていた。しかしダ・ヴィンチは夜中にこっそり遺体を解剖し、筋肉、骨、血管を正確にスケッチした。その図は現代の医学書と比べても驚くほど正確だった。→',
      easyContent: '昔は人の体を切って<ruby>調<rt>しら</rt></ruby>べることはきんしされていた。でもダ・ヴィンチは夜中にこっそり体を<ruby>調<rt>しら</rt></ruby>べて、<ruby>筋肉<rt>きんにく</rt></ruby>や<ruby>骨<rt>ほね</rt></ruby>をただしくスケッチしたんだ。その絵は今の<ruby>医学<rt>いがく</rt></ruby>の本とくらべてもすごくただしい。→',
      image: '/images/learning/lc-davinci-anatomy.png',
      funFact: 'ダ・ヴィンチは心臓の弁の動きまで正確に描いていた。これが科学的に確認されたのは、なんと500年後のことだった！',
      easyFunFact: 'ダ・ヴィンチは<ruby>心臓<rt>しんぞう</rt></ruby>の動きまでただしくかいていた。それが本当だとわかったのは500年後！',
    },
    {
      id: 'lc-davinci-06',
      title: 'なぜ「未完成の天才」と呼ばれる？',
      content: 'ダ・ヴィンチは興味がありすぎた。一つの仕事を始めると、途中で別のことに夢中になってしまう。引き受けた仕事の多くは未完成のまま。それでも残されたものだけで、人類史上最高の天才と呼ばれている。',
      easyContent: 'ダ・ヴィンチは<ruby>興味<rt>きょうみ</rt></ruby>がありすぎたんだ。一つの<ruby>仕事<rt>しごと</rt></ruby>をはじめても、とちゅうで<ruby>別<rt>べつ</rt></ruby>のことにむちゅうになってしまう。だからたくさんの作品が<ruby>未完成<rt>みかんせい</rt></ruby>のまま。でものこったものだけで「<ruby>天才<rt>てんさい</rt></ruby>」とよばれているんだ。',
      image: '/images/learning/lc-davinci-unfinished.png',
      funFact: '注文を受けてから完成まで16年かかった絵もある。依頼主はさぞかし待ちくたびれただろう！',
      easyFunFact: '<ruby>注文<rt>ちゅうもん</rt></ruby>されてからかんせいまで16年もかかった絵がある。たのんだ人、どんなにまったことか！',
    },
  ],
};

export function getLearningCards(deckKey: string): LearningCard[] {
  return (LEARNING_CARDS as Record<string, LearningCard[] | undefined>)[deckKey] ?? [];
}
