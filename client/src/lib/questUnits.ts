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
      content: '地中海の小さな島で生まれた少年が、やがてヨーロッパのほとんどを支配する皇帝になった。その名もナポレオン。どうやってそこまでのぼりつめたのか？→',
      image: '/images/learning/lc-napoleon-who.png',
      funFact: '身長は実は168cmで当時の平均くらい。「チビ」というイメージはイギリスが広めた悪口だった！',
    },
    {
      id: 'lc-napoleon-02',
      title: 'フランス革命とは？',
      content: 'パンも買えないほど貧しい国民が、ついに立ち上がった。王の力の象徴だったバスティーユ牢獄を襲撃。これがフランス革命の始まりだった。ナポレオンは、この大混乱の中で頭角をあらわしていく…→',
      image: '/images/learning/lc-french-revolution.png',
      funFact: 'バスティーユ襲撃の日（7月14日）は、今もフランスの建国記念日として盛大に祝われている！',
    },
    {
      id: 'lc-napoleon-03',
      title: 'なぜ皇帝になれた？',
      content: '革命のあと、フランスは大混乱。そこに現れたナポレオンは次々と戦いに勝ち、国民の絶大な支持を得た。そしてついに皇帝に。しかも戴冠式では、教皇の手から王冠を取り上げて自分で被った。→',
      image: '/images/learning/lc-napoleon-emperor.png',
      funFact: '自分で王冠を被せたのは歴史上ナポレオンだけ。「この地位は誰かにもらったものじゃない」という意思の表れだった！',
    },
    {
      id: 'lc-napoleon-04',
      title: 'ワーテルローの戦い',
      content: '無敵に見えたナポレオンにも終わりが来る。ワーテルローでイギリス・プロイセンの連合軍に敗れ、大西洋の孤島セントヘレナに追放された。ヨーロッパを揺るがした英雄の、最後の戦いだった。→',
      image: '/images/learning/lc-waterloo.png',
      funFact: 'ワーテルローの戦場は今ベルギーの観光地になっていて、大きなライオンの像が建っている！',
    },
    {
      id: 'lc-napoleon-05',
      title: 'ナポレオン法典って？',
      content: 'ナポレオンが残した最大の遺産は、実は戦争の勝利ではない。「法の前にすべての人は平等である」と定めたナポレオン法典だ。この考えは世界中に広まり、今の法律のもとになっている。',
      image: '/images/learning/lc-napoleon-code.png',
      funFact: '実は日本の民法もナポレオン法典の影響を受けている。はるか遠くの国にまで届いた！',
    },
  ],

  amazon: [
    {
      id: 'lc-amazon-01',
      title: 'アマゾン川ってどんな川？',
      content: '世界で最も多くの水が流れる川、アマゾン。長さは約6,400km、河口の幅はなんと330km。この川の流域には地球の酸素の約20%を生み出す巨大な森が広がっている。→',
      image: '/images/learning/lc-amazon-river.png',
      funFact: '河口の幅330kmってどのくらい？東京から名古屋くらいの距離が、まるごと川の幅！',
    },
    {
      id: 'lc-amazon-02',
      title: 'ピラニアは本当に怖い？',
      content: '映画では人を襲う恐ろしい魚として描かれるピラニア。でも実は、とても臆病な魚だ。普段は死んだ魚や虫を食べて川をきれいにしている、いわば川の掃除屋さん。→',
      image: '/images/learning/lc-piranha-truth.png',
      funFact: 'アマゾンの地元の子どもたちは、ピラニアがいる川で普通に泳いでいる！',
    },
    {
      id: 'lc-amazon-03',
      title: '熱帯雨林はなぜ大事？',
      content: 'アマゾンの熱帯雨林は「地球の肺」と呼ばれている。酸素を作り、雨を降らせ、数えきれない生き物の住みかになっている。薬の原料になる植物も、ここから見つかることがある。→',
      image: '/images/learning/lc-rainforest.png',
      funFact: 'アマゾンにはまだ発見されていない生き物が数百万種いるとも言われている！',
    },
    {
      id: 'lc-amazon-04',
      title: 'アナコンダと先住民族',
      content: 'アマゾンに暮らすトゥカノ族は、アナコンダを「世界を作った祖先」として大切にしている。彼らの神話では、巨大なアナコンダがアマゾン川を旅しながら、川沿いに人間の村を作ったという。→',
      image: '/images/learning/lc-anaconda-tribe.png',
      funFact: 'アマゾン川がくねくね蛇行する姿は、たしかに巨大なアナコンダに見える！',
    },
    {
      id: 'lc-amazon-05',
      title: '毒矢カエルの秘密',
      content: '鮮やかな青や赤の体は「近づいたら危険だよ」という警告。先住民族はこのカエルの毒を矢に塗って狩りに使っていた。小さな体に、とんでもない力を秘めた生き物だ。',
      image: '/images/learning/lc-poison-frog.png',
      funFact: 'たった1匹の毒で大人10人分の致死量。でも不思議なことに、飼育下では毒を作れなくなる。食べ物が関係しているらしい！',
    },
  ],

  qinshi: [
    {
      id: 'lc-qinshi-01',
      title: '始皇帝って誰？',
      content: 'わずか13歳で秦の王になった少年。そこから他の国を次々と倒し、中国をはじめて一つにまとめた。「皇帝」という言葉を発明したのもこの人。自分を「最初の皇帝＝始皇帝」と名乗った。→',
      image: '/images/learning/lc-qin-who.png',
      funFact: '「皇帝」は始皇帝が作った言葉。「王」よりもっとすごい称号がほしくて、自分で考えた！',
    },
    {
      id: 'lc-qinshi-02',
      title: '万里の長城はなぜ作った？',
      content: '北の草原から馬に乗って攻めてくる遊牧民族。始皇帝は彼らを防ぐために、とてつもなく長い壁を築いた。その全長、約2万km。今でも宇宙から見えると言われたが、実はそれは嘘。→',
      image: '/images/learning/lc-great-wall-why.png',
      funFact: '建設には数十万人が動員された。あまりにも過酷で、多くの人が命を落としたと伝わっている。',
    },
    {
      id: 'lc-qinshi-03',
      title: '焚書坑儒って何？',
      content: '始皇帝は自分に反対する声を徹底的に潰した。本を集めて燃やし（焚書）、批判した学者を生き埋めにした（坑儒）。恐ろしい話だが、医学や農業の実用書は残すという冷静さもあった。→',
      image: '/images/learning/lc-book-burning.png',
      funFact: '全部燃やしたわけではない。役に立つ本は残した。始皇帝なりの合理的な判断だった！',
    },
    {
      id: 'lc-qinshi-04',
      title: '兵馬俑ってすごい！',
      content: '始皇帝の墓を守るために作られた、8,000体以上の兵士の像。驚くべきことに、一体一体の顔がすべて違う。地下に眠る巨大な軍隊は、2,000年以上もの間、誰にも知られていなかった。→',
      image: '/images/learning/lc-terracotta.png',
      funFact: '1974年、井戸を掘っていた農民がたまたま発見した。世紀の大発見は偶然だった！',
    },
    {
      id: 'lc-qinshi-05',
      title: '紙の発明',
      content: '紙がなかった時代、人々は竹や木の板に文字を書いていた。中国で紙が発明されたことで、知識を広く伝えられるようになった。この発明が世界を大きく変えた。',
      image: '/images/learning/lc-paper-invention.png',
      funFact: '紙が発明される前、本1冊分の竹簡（竹の板）は馬車1台分の重さがあった！',
    },
  ],

  nobunaga: [
    {
      id: 'lc-nobunaga-01',
      title: '織田信長って誰？',
      content: '子どもの頃は「うつけ者（バカ）」と呼ばれていた少年。でも実は、誰よりも先を見ていた。古いしきたりを壊し、新しいやり方で日本の歴史を大きく動かした革命児だった。→',
      image: '/images/learning/lc-nobunaga-who.png',
      funFact: '幼い頃は裸で町を走り回り、行儀が悪すぎて家臣たちに心配された！',
    },
    {
      id: 'lc-nobunaga-02',
      title: '桶狭間の奇跡',
      content: '敵は2万5千、味方はたった3千。普通なら絶対に勝てない戦い。しかし信長は嵐の日をねらって奇襲をかけ、敵の大将・今川義元を討ち取った。日本の歴史を変えた一戦だった。→',
      image: '/images/learning/lc-okehazama.png',
      funFact: '嵐の音で足音が消されると計算していた。天気すら味方にした戦術家！',
    },
    {
      id: 'lc-nobunaga-03',
      title: '鉄砲が変えた戦い',
      content: 'ポルトガルから伝わった鉄砲に、信長はいち早く目をつけた。他の大名が数百挺しか持てなかった鉄砲を、信長は3,000挺も集めた。これにより武士の一騎討ちの時代は終わり、集団戦の時代が始まった。→',
      image: '/images/learning/lc-guns-changed.png',
      funFact: '信長が大量の鉄砲を買えたのは、楽市楽座で儲けた経済力があったから！',
    },
    {
      id: 'lc-nobunaga-04',
      title: '楽市楽座って？',
      content: '信長は戦いだけでなく、経済の天才でもあった。「楽市楽座」は、誰でも自由に商売できるようにした制度。これで城下町は大いに栄え、信長は他の大名よりはるかに豊かになった。→',
      image: '/images/learning/lc-rakuichi.png',
      funFact: '今でいう「規制緩和」と同じ考え方。400年以上前に実行していたのがすごい！',
    },
    {
      id: 'lc-nobunaga-05',
      title: '本能寺の変とは？',
      content: '天下統一まであと少し。しかし信頼していた家臣・明智光秀に裏切られ、京都の本能寺で最期を迎えた。信長は炎の中で「是非に及ばず（仕方のないことだ）」とつぶやいたと伝えられている。',
      image: '/images/learning/lc-honnoji-story.png',
      funFact: '光秀が天下を取れたのはわずか13日間。「三日天下」という言葉はここから生まれた！',
    },
  ],

  jeanne: [
    {
      id: 'lc-jeanne-01',
      title: 'ジャンヌダルクって誰？',
      content: 'フランスの小さな農村で育った少女。13歳のある日、「フランスを救いなさい」という神の声が聞こえた。読み書きもできない少女が、やがてフランス軍を率いて戦うことになる。→',
      image: '/images/learning/lc-jeanne-who.png',
      funFact: 'ジャンヌは文字が読めなかったが、戦場では大人の将軍たちを指揮した！',
    },
    {
      id: 'lc-jeanne-02',
      title: '百年戦争とは？',
      content: 'イギリスとフランスは、なんと116年間も戦い続けた。フランスは追い詰められ、もう負けるかもしれないという状況だった。そこに現れたのが、17歳のジャンヌだった。→',
      image: '/images/learning/lc-hundred-years-war.png',
      funFact: '「百年戦争」という名前だけど、実際は116年間。途中で何度か休戦した時期もある！',
    },
    {
      id: 'lc-jeanne-03',
      title: 'オルレアンの解放',
      content: 'イギリス軍に包囲されたオルレアン。何ヶ月も続いた包囲を、ジャンヌ率いるフランス軍はわずか9日で突破した。矢を受けても戦い続けるジャンヌの姿が、兵士たちの心に火をつけた。→',
      image: '/images/learning/lc-orleans.png',
      funFact: 'ジャンヌは肩に矢が刺さっても戦場から離れず、兵士たちを奮い立たせ続けた！',
    },
    {
      id: 'lc-jeanne-04',
      title: 'なぜ聖女と呼ばれた？',
      content: 'しかしジャンヌは19歳で捕らえられ、火刑に処された。「魔女」として裁かれたのだ。だが500年後、カトリック教会はジャンヌを「聖女」として正式に認めた。歴史が、ようやく彼女に正しい名前を与えた。',
      image: '/images/learning/lc-saint-jeanne.png',
      funFact: 'ジャンヌの裁判記録が今も残っていて、彼女が実際に語った言葉を読むことができる！',
    },
  ],

  murasaki: [
    {
      id: 'lc-murasaki-01',
      title: '紫式部って誰？',
      content: '今から約1,000年前、平安時代の宮廷に一人の才女がいた。彼女が書いた物語は、世界最古の長編小説と呼ばれている。その名は「源氏物語」。作者の名は、紫式部。→',
      image: '/images/learning/lc-murasaki-who.png',
      funFact: '「紫式部」はペンネームで、本名は今もわかっていない。1,000年最大のミステリー！',
    },
    {
      id: 'lc-murasaki-02',
      title: '源氏物語ってどんな話？',
      content: '主人公は光源氏という美しい貴族。恋あり、涙あり、権力争いあり。全54巻にもなる超大作を、紫式部はたった一人で書き上げた。1,000年後の今でも、世界中の人に読まれ続けている。→',
      image: '/images/learning/lc-genji-story.png',
      funFact: '54巻もある源氏物語。現代の文庫本にすると10冊以上。1,000年前にこれを書いたのがすごい！',
    },
    {
      id: 'lc-murasaki-03',
      title: '平安時代の暮らし',
      content: '平安時代の貴族は、直接会って話すより和歌（短い詩）を送り合った。季節の移り変わりを大切にし、衣の色の組み合わせにもこだわった。美しさを何より重んじる時代だった。→',
      image: '/images/learning/lc-heian-life.png',
      funFact: '貴族の女性は顔を見せないのがマナー。扇や御簾（みす）で隠すのが常識だった！',
    },
    {
      id: 'lc-murasaki-04',
      title: 'ひらがなの誕生',
      content: '当時、正式な文書は漢字で書くものとされていた。でも漢字をくずした「ひらがな」が生まれたことで、日本語の繊細な感情を自由に表現できるようになった。紫式部が源氏物語を書けたのも、ひらがなのおかげだ。',
      image: '/images/learning/lc-hiragana.png',
      funFact: 'ひらがなは最初「女手（おんなで）」と呼ばれた。女性たちが中心になって使い広めたから！',
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
