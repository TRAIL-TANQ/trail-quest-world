/**
 * Quest Quiz Data - デッキ別クエストクイズ (140問)
 * 7デッキ × 4難易度 × 5問 = 140問
 * 全問ふりがな対応（HTMLのrubyタグ使用）
 */
import type { DeckKey, QuestDifficulty } from './questProgress';

export interface QuestQuiz {
  question: string;      // HTML(ruby)可
  choices: string[];     // 4択
  correctIndex: number;
}

export const QUEST_QUIZ_DATA: Record<DeckKey, Record<QuestDifficulty, QuestQuiz[]>> = {

  // ================================================================
  // ⚔️ ナポレオン
  // ================================================================
  napoleon: {
    beginner: [
      { question: 'ナポレオンはどの<ruby>国<rt>くに</rt></ruby>の<ruby>皇帝<rt>こうてい</rt></ruby>？', choices: ['フランス', 'イギリス', 'ドイツ', 'スペイン'], correctIndex: 0 },
      { question: 'ナポレオンが<ruby>最後<rt>さいご</rt></ruby>に<ruby>流<rt>なが</rt></ruby>された<ruby>島<rt>しま</rt></ruby>は？', choices: ['セントヘレナ<ruby>島<rt>とう</rt></ruby>', 'マダガスカル<ruby>島<rt>とう</rt></ruby>', 'シチリア<ruby>島<rt>とう</rt></ruby>', 'コルシカ<ruby>島<rt>とう</rt></ruby>'], correctIndex: 0 },
      { question: '<ruby>大砲<rt>たいほう</rt></ruby>は<ruby>何<rt>なに</rt></ruby>を<ruby>飛<rt>と</rt></ruby>ばす<ruby>武器<rt>ぶき</rt></ruby>？', choices: ['<ruby>砲弾<rt>ほうだん</rt></ruby>', '<ruby>矢<rt>や</rt></ruby>', '<ruby>石<rt>いし</rt></ruby>', '<ruby>槍<rt>やり</rt></ruby>'], correctIndex: 0 },
      { question: '<ruby>火薬<rt>かやく</rt></ruby>はどこで<ruby>発明<rt>はつめい</rt></ruby>された？', choices: ['<ruby>中国<rt>ちゅうごく</rt></ruby>', 'ヨーロッパ', 'インド', 'エジプト'], correctIndex: 0 },
      { question: 'ナポレオンが<ruby>建設<rt>けんせつ</rt></ruby>を<ruby>命<rt>めい</rt></ruby>じた<ruby>有名<rt>ゆうめい</rt></ruby>な<ruby>門<rt>もん</rt></ruby>は？', choices: ['<ruby>凱旋門<rt>がいせんもん</rt></ruby>', 'ブランデンブルク<ruby>門<rt>もん</rt></ruby>', '<ruby>天安門<rt>てんあんもん</rt></ruby>', 'トラファルガー<ruby>門<rt>もん</rt></ruby>'], correctIndex: 0 },
    ],
    challenger: [
      { question: 'ナポレオンが<ruby>制定<rt>せいてい</rt></ruby>した<ruby>法律<rt>ほうりつ</rt></ruby>は？', choices: ['ナポレオン<ruby>法典<rt>ほうてん</rt></ruby>', '<ruby>大憲章<rt>だいけんしょう</rt></ruby>', '<ruby>十二表法<rt>じゅうにひょうほう</rt></ruby>', '<ruby>独立宣言<rt>どくりつせんげん</rt></ruby>'], correctIndex: 0 },
      { question: 'ナポレオンが<ruby>敗<rt>やぶ</rt></ruby>れた<ruby>最後<rt>さいご</rt></ruby>の<ruby>戦<rt>たたか</rt></ruby>いは？', choices: ['ワーテルローの<ruby>戦<rt>たたか</rt></ruby>い', 'トラファルガーの<ruby>海戦<rt>かいせん</rt></ruby>', 'ライプツィヒの<ruby>戦<rt>たたか</rt></ruby>い', 'アウステルリッツの<ruby>戦<rt>たたか</rt></ruby>い'], correctIndex: 0 },
      { question: 'ナポレオンの<ruby>出身地<rt>しゅっしんち</rt></ruby>はどこ？', choices: ['コルシカ<ruby>島<rt>とう</rt></ruby>', 'パリ', 'マルセイユ', 'リヨン'], correctIndex: 0 },
      { question: 'ナポレオンが<ruby>遠征<rt>えんせい</rt></ruby>して<ruby>失敗<rt>しっぱい</rt></ruby>した<ruby>国<rt>くに</rt></ruby>は？', choices: ['ロシア', 'イタリア', 'エジプト', 'スペイン'], correctIndex: 0 },
      { question: 'ナポレオンが<ruby>皇帝<rt>こうてい</rt></ruby>になったのは<ruby>何年<rt>なんねん</rt></ruby>？', choices: ['1804<ruby>年<rt>ねん</rt></ruby>', '1789<ruby>年<rt>ねん</rt></ruby>', '1815<ruby>年<rt>ねん</rt></ruby>', '1776<ruby>年<rt>ねん</rt></ruby>'], correctIndex: 0 },
    ],
    master: [
      { question: 'ナポレオンが<ruby>戴冠式<rt>たいかんしき</rt></ruby>で<ruby>自<rt>みずか</rt></ruby>ら<ruby>冠<rt>かんむり</rt></ruby>をかぶった<ruby>理由<rt>りゆう</rt></ruby>は？', choices: ['<ruby>自分<rt>じぶん</rt></ruby>の<ruby>力<rt>ちから</rt></ruby>で<ruby>皇帝<rt>こうてい</rt></ruby>になったことを<ruby>示<rt>しめ</rt></ruby>すため', '<ruby>教皇<rt>きょうこう</rt></ruby>が<ruby>拒否<rt>きょひ</rt></ruby>したため', '<ruby>慣例<rt>かんれい</rt></ruby>に<ruby>従<rt>したが</rt></ruby>ったため', '<ruby>冠<rt>かんむり</rt></ruby>が<ruby>重<rt>おも</rt></ruby>すぎたため'], correctIndex: 0 },
      { question: 'ナポレオン<ruby>法典<rt>ほうてん</rt></ruby>が<ruby>現代<rt>げんだい</rt></ruby>に<ruby>与<rt>あた</rt></ruby>えた<ruby>影響<rt>えいきょう</rt></ruby>は？', choices: ['<ruby>民法<rt>みんぽう</rt></ruby>の<ruby>基礎<rt>きそ</rt></ruby>となった', '<ruby>軍事<rt>ぐんじ</rt></ruby><ruby>戦略<rt>せんりゃく</rt></ruby>を<ruby>変<rt>か</rt></ruby>えた', '<ruby>科学<rt>かがく</rt></ruby><ruby>技術<rt>ぎじゅつ</rt></ruby>を<ruby>発展<rt>はってん</rt></ruby>させた', '<ruby>宗教<rt>しゅうきょう</rt></ruby>を<ruby>統一<rt>とういつ</rt></ruby>した'], correctIndex: 0 },
      { question: 'ナポレオンの「<ruby>百日天下<rt>ひゃくにちてんか</rt></ruby>」とは？', choices: ['エルバ<ruby>島<rt>とう</rt></ruby><ruby>脱出<rt>だっしゅつ</rt></ruby>から<ruby>再<rt>ふたた</rt></ruby>び<ruby>敗北<rt>はいぼく</rt></ruby>するまでの<ruby>期間<rt>きかん</rt></ruby>', '<ruby>最初<rt>さいしょ</rt></ruby>の100<ruby>日<rt>にち</rt></ruby>の<ruby>統治<rt>とうち</rt></ruby>', '<ruby>戦争<rt>せんそう</rt></ruby>が100<ruby>日間<rt>にちかん</rt></ruby><ruby>続<rt>つづ</rt></ruby>いたこと', '<ruby>法典<rt>ほうてん</rt></ruby><ruby>作成<rt>さくせい</rt></ruby>にかかった<ruby>期間<rt>きかん</rt></ruby>'], correctIndex: 0 },
      { question: '<ruby>大陸封鎖令<rt>たいりくふうされい</rt></ruby>の<ruby>目的<rt>もくてき</rt></ruby>は？', choices: ['イギリスを<ruby>経済的<rt>けいざいてき</rt></ruby>に<ruby>孤立<rt>こりつ</rt></ruby>させるため', 'フランスを<ruby>守<rt>まも</rt></ruby>るため', '<ruby>貿易<rt>ぼうえき</rt></ruby>を<ruby>独占<rt>どくせん</rt></ruby>するため', '<ruby>海軍<rt>かいぐん</rt></ruby>を<ruby>強化<rt>きょうか</rt></ruby>するため'], correctIndex: 0 },
      { question: 'ナポレオンの<ruby>身長<rt>しんちょう</rt></ruby>が<ruby>低<rt>ひく</rt></ruby>いという<ruby>話<rt>はなし</rt></ruby>は？', choices: ['イギリスの<ruby>風刺画<rt>ふうしが</rt></ruby>による<ruby>誇張<rt>こちょう</rt></ruby>', '<ruby>実際<rt>じっさい</rt></ruby>に<ruby>低<rt>ひく</rt></ruby>かった', '<ruby>本人<rt>ほんにん</rt></ruby>が<ruby>公表<rt>こうひょう</rt></ruby>した', '<ruby>医師<rt>いし</rt></ruby>の<ruby>記録<rt>きろく</rt></ruby>による'], correctIndex: 0 },
    ],
    legend: [
      { question: 'ナポレオンのロシア<ruby>遠征<rt>えんせい</rt></ruby>で<ruby>大<rt>おお</rt></ruby>きな<ruby>被害<rt>ひがい</rt></ruby>を<ruby>出<rt>だ</rt></ruby>した<ruby>主<rt>おも</rt></ruby>な<ruby>原因<rt>げんいん</rt></ruby>は？', choices: ['<ruby>冬将軍<rt>ふゆしょうぐん</rt></ruby>（<ruby>厳<rt>きび</rt></ruby>しい<ruby>寒<rt>さむ</rt></ruby>さ）と<ruby>焦土作戦<rt>しょうどさくせん</rt></ruby>', '<ruby>敵<rt>てき</rt></ruby>の<ruby>新兵器<rt>しんへいき</rt></ruby>', '<ruby>味方<rt>みかた</rt></ruby>の<ruby>裏切<rt>うらぎ</rt></ruby>り', '<ruby>補給路<rt>ほきゅうろ</rt></ruby>を<ruby>海賊<rt>かいぞく</rt></ruby>に<ruby>断<rt>た</rt></ruby>たれた'], correctIndex: 0 },
      { question: 'アウステルリッツの<ruby>戦<rt>たたか</rt></ruby>いの<ruby>別名<rt>べつめい</rt></ruby>は？', choices: ['<ruby>三帝会戦<rt>さんていかいせん</rt></ruby>', '<ruby>百年戦争<rt>ひゃくねんせんそう</rt></ruby>', '<ruby>解放戦争<rt>かいほうせんそう</rt></ruby>', '<ruby>大同盟戦争<rt>だいどうめいせんそう</rt></ruby>'], correctIndex: 0 },
      { question: 'ナポレオンがエジプト<ruby>遠征<rt>えんせい</rt></ruby>で<ruby>発見<rt>はっけん</rt></ruby>のきっかけとなったものは？', choices: ['ロゼッタストーン', 'ツタンカーメンの<ruby>墓<rt>はか</rt></ruby>', 'ピラミッドの<ruby>設計図<rt>せっけいず</rt></ruby>', '<ruby>死海文書<rt>しかいもんじょ</rt></ruby>'], correctIndex: 0 },
      { question: 'ナポレオンの<ruby>戦術<rt>せんじゅつ</rt></ruby>で<ruby>有名<rt>ゆうめい</rt></ruby>な<ruby>概念<rt>がいねん</rt></ruby>は？', choices: ['<ruby>内線作戦<rt>ないせんさくせん</rt></ruby>（<ruby>各個撃破<rt>かっこげきは</rt></ruby>）', '<ruby>海上封鎖<rt>かいじょうふうさ</rt></ruby>', 'ゲリラ<ruby>戦<rt>せん</rt></ruby>', '<ruby>塹壕戦<rt>ざんごうせん</rt></ruby>'], correctIndex: 0 },
      { question: 'ナポレオンが<ruby>死去<rt>しきょ</rt></ruby>したセントヘレナ<ruby>島<rt>とう</rt></ruby>はどこにある？', choices: ['<ruby>南<rt>みなみ</rt></ruby>大西洋<ruby>上<rt>じょう</rt></ruby>', '<ruby>地中海<rt>ちちゅうかい</rt></ruby>', 'カリブ<ruby>海<rt>かい</rt></ruby>', '<ruby>太平洋<rt>たいへいよう</rt></ruby>'], correctIndex: 0 },
    ],
  },

  // ================================================================
  // 🌿 アマゾン
  // ================================================================
  amazon: {
    beginner: [
      { question: 'アマゾン<ruby>川<rt>がわ</rt></ruby>がある<ruby>大陸<rt>たいりく</rt></ruby>は？', choices: ['<ruby>南<rt>みなみ</rt></ruby>アメリカ', '<ruby>北<rt>きた</rt></ruby>アメリカ', 'アフリカ', 'アジア'], correctIndex: 0 },
      { question: 'ピラニアは<ruby>何<rt>なに</rt></ruby>を<ruby>食<rt>た</rt></ruby>べる<ruby>魚<rt>さかな</rt></ruby>？', choices: ['<ruby>肉<rt>にく</rt></ruby>', '<ruby>草<rt>くさ</rt></ruby>だけ', '<ruby>プランクトン', '<ruby>石<rt>いし</rt></ruby>'], correctIndex: 0 },
      { question: 'アナコンダはどんな<ruby>動物<rt>どうぶつ</rt></ruby>？', choices: ['<ruby>大<rt>おお</rt></ruby>きなヘビ', '<ruby>大<rt>おお</rt></ruby>きなワニ', '<ruby>大<rt>おお</rt></ruby>きなカエル', '<ruby>大<rt>おお</rt></ruby>きな<ruby>鳥<rt>とり</rt></ruby>'], correctIndex: 0 },
      { question: '<ruby>毒矢<rt>どくや</rt></ruby>カエルの<ruby>特徴<rt>とくちょう</rt></ruby>は？', choices: ['<ruby>派手<rt>はで</rt></ruby>な<ruby>色<rt>いろ</rt></ruby>をしている', '<ruby>地味<rt>じみ</rt></ruby>な<ruby>色<rt>いろ</rt></ruby>をしている', 'とても<ruby>大<rt>おお</rt></ruby>きい', '<ruby>水中<rt>すいちゅう</rt></ruby>にしかいない'], correctIndex: 0 },
      { question: 'アマゾンの<ruby>森<rt>もり</rt></ruby>は「<ruby>地球<rt>ちきゅう</rt></ruby>の○○」と<ruby>呼<rt>よ</rt></ruby>ばれる？', choices: ['<ruby>肺<rt>はい</rt></ruby>', '<ruby>心臓<rt>しんぞう</rt></ruby>', '<ruby>胃<rt>い</rt></ruby>', '<ruby>脳<rt>のう</rt></ruby>'], correctIndex: 0 },
    ],
    challenger: [
      { question: 'アマゾン<ruby>川<rt>がわ</rt></ruby>の<ruby>流域面積<rt>りゅういきめんせき</rt></ruby>は<ruby>世界<rt>せかい</rt></ruby><ruby>何位<rt>なんい</rt></ruby>？', choices: ['1<ruby>位<rt>い</rt></ruby>', '2<ruby>位<rt>い</rt></ruby>', '3<ruby>位<rt>い</rt></ruby>', '5<ruby>位<rt>い</rt></ruby>'], correctIndex: 0 },
      { question: 'アナコンダの<ruby>最大体長<rt>さいだいたいちょう</rt></ruby>は<ruby>約<rt>やく</rt></ruby>何メートル？', choices: ['9メートル', '3メートル', '15メートル', '20メートル'], correctIndex: 0 },
      { question: '<ruby>光合成<rt>こうごうせい</rt></ruby>で<ruby>植物<rt>しょくぶつ</rt></ruby>が<ruby>作<rt>つく</rt></ruby>るものは？', choices: ['<ruby>酸素<rt>さんそ</rt></ruby>と<ruby>糖<rt>とう</rt></ruby>', '<ruby>二酸化炭素<rt>にさんかたんそ</rt></ruby>', '<ruby>窒素<rt>ちっそ</rt></ruby>', '<ruby>水素<rt>すいそ</rt></ruby>'], correctIndex: 0 },
      { question: 'ピラニアの<ruby>歯<rt>は</rt></ruby>の<ruby>特徴<rt>とくちょう</rt></ruby>は？', choices: ['カミソリのように<ruby>鋭<rt>するど</rt></ruby>い', '<ruby>丸<rt>まる</rt></ruby>くて<ruby>平<rt>たい</rt></ruby>ら', '<ruby>歯<rt>は</rt></ruby>がない', '<ruby>毒<rt>どく</rt></ruby>がある'], correctIndex: 0 },
      { question: 'アマゾンの<ruby>熱帯雨林<rt>ねったいうりん</rt></ruby>にいる<ruby>生物<rt>せいぶつ</rt></ruby>は<ruby>全<rt>すべ</rt></ruby>ての<ruby>種<rt>しゅ</rt></ruby>の<ruby>約<rt>やく</rt></ruby>何%？', choices: ['10%', '30%', '50%', '5%'], correctIndex: 0 },
    ],
    master: [
      { question: '<ruby>毒矢<rt>どくや</rt></ruby>カエルの<ruby>毒<rt>どく</rt></ruby>は<ruby>何<rt>なに</rt></ruby>に<ruby>由来<rt>ゆらい</rt></ruby>する？', choices: ['<ruby>食<rt>た</rt></ruby>べた<ruby>昆虫<rt>こんちゅう</rt></ruby>から<ruby>蓄積<rt>ちくせき</rt></ruby>', '<ruby>体内<rt>たいない</rt></ruby>で<ruby>自然<rt>しぜん</rt></ruby>に<ruby>生成<rt>せいせい</rt></ruby>', '<ruby>水<rt>みず</rt></ruby>から<ruby>吸収<rt>きゅうしゅう</rt></ruby>', '<ruby>遺伝<rt>いでん</rt></ruby>だけで<ruby>決<rt>き</rt></ruby>まる'], correctIndex: 0 },
      { question: 'アナコンダの<ruby>狩<rt>か</rt></ruby>りの<ruby>方法<rt>ほうほう</rt></ruby>は？', choices: ['<ruby>獲物<rt>えもの</rt></ruby>を<ruby>巻<rt>ま</rt></ruby>きつけて<ruby>締<rt>し</rt></ruby>め<ruby>上<rt>あ</rt></ruby>げる', '<ruby>毒<rt>どく</rt></ruby>で<ruby>麻痺<rt>まひ</rt></ruby>させる', '<ruby>高速<rt>こうそく</rt></ruby>で<ruby>追<rt>お</rt></ruby>いかける', '<ruby>穴<rt>あな</rt></ruby>を<ruby>掘<rt>ほ</rt></ruby>って<ruby>罠<rt>わな</rt></ruby>を<ruby>仕掛<rt>しか</rt></ruby>ける'], correctIndex: 0 },
      { question: 'アマゾン<ruby>川<rt>がわ</rt></ruby>の<ruby>水<rt>みず</rt></ruby>が<ruby>茶色<rt>ちゃいろ</rt></ruby>い<ruby>理由<rt>りゆう</rt></ruby>は？', choices: ['<ruby>大量<rt>たいりょう</rt></ruby>の<ruby>土砂<rt>どしゃ</rt></ruby>と<ruby>有機物<rt>ゆうきぶつ</rt></ruby>を<ruby>含<rt>ふく</rt></ruby>むため', '<ruby>汚染<rt>おせん</rt></ruby>されているため', '<ruby>鉄分<rt>てつぶん</rt></ruby>が<ruby>多<rt>おお</rt></ruby>いため', '<ruby>藻<rt>も</rt></ruby>が<ruby>大量<rt>たいりょう</rt></ruby>にあるため'], correctIndex: 0 },
      { question: 'アマゾンの<ruby>森林伐採<rt>しんりんばっさい</rt></ruby>が<ruby>問題<rt>もんだい</rt></ruby>になる<ruby>主<rt>おも</rt></ruby>な<ruby>理由<rt>りゆう</rt></ruby>は？', choices: ['<ruby>二酸化炭素<rt>にさんかたんそ</rt></ruby>の<ruby>吸収<rt>きゅうしゅう</rt></ruby>が<ruby>減<rt>へ</rt></ruby>り<ruby>温暖化<rt>おんだんか</rt></ruby>が<ruby>進<rt>すす</rt></ruby>むため', '<ruby>観光客<rt>かんこうきゃく</rt></ruby>が<ruby>来<rt>こ</rt></ruby>なくなるため', '<ruby>魚<rt>さかな</rt></ruby>が<ruby>減<rt>へ</rt></ruby>るため', '<ruby>雨<rt>あめ</rt></ruby>が<ruby>降<rt>ふ</rt></ruby>らなくなるため'], correctIndex: 0 },
      { question: '<ruby>世界<rt>せかい</rt></ruby>で<ruby>一番<rt>いちばん</rt></ruby><ruby>水量<rt>すいりょう</rt></ruby>の<ruby>多<rt>おお</rt></ruby>い<ruby>川<rt>かわ</rt></ruby>は？', choices: ['アマゾン<ruby>川<rt>がわ</rt></ruby>', 'ナイル<ruby>川<rt>がわ</rt></ruby>', 'ミシシッピ<ruby>川<rt>がわ</rt></ruby>', '<ruby>揚子江<rt>ようすこう</rt></ruby>'], correctIndex: 0 },
    ],
    legend: [
      { question: 'ピラニアが<ruby>群<rt>む</rt></ruby>れで<ruby>襲<rt>おそ</rt></ruby>うのはどんなとき？', choices: ['<ruby>乾季<rt>かんき</rt></ruby>で<ruby>水<rt>みず</rt></ruby>が<ruby>少<rt>すく</rt></ruby>なく<ruby>餌<rt>えさ</rt></ruby>が<ruby>不足<rt>ふそく</rt></ruby>したとき', '<ruby>満月<rt>まんげつ</rt></ruby>の<ruby>夜<rt>よる</rt></ruby>', '<ruby>雨季<rt>うき</rt></ruby>のはじめ', '<ruby>新<rt>あたら</rt></ruby>しい<ruby>獲物<rt>えもの</rt></ruby>を<ruby>見<rt>み</rt></ruby>つけたとき'], correctIndex: 0 },
      { question: 'アマゾンに<ruby>生息<rt>せいそく</rt></ruby>する<ruby>世界最大<rt>せかいさいだい</rt></ruby>の<ruby>淡水魚<rt>たんすいぎょ</rt></ruby>は？', choices: ['ピラルク', 'ナマズ', 'アロワナ', '<ruby>電気<rt>でんき</rt></ruby>ウナギ'], correctIndex: 0 },
      { question: '<ruby>毒矢<rt>どくや</rt></ruby>カエルの<ruby>毒<rt>どく</rt></ruby>は<ruby>先住民<rt>せんじゅうみん</rt></ruby>に<ruby>何<rt>なに</rt></ruby>に<ruby>使<rt>つか</rt></ruby>われた？', choices: ['<ruby>吹<rt>ふ</rt></ruby>き<ruby>矢<rt>や</rt></ruby>の<ruby>毒<rt>どく</rt></ruby>', '<ruby>薬<rt>くすり</rt></ruby>', '<ruby>染料<rt>せんりょう</rt></ruby>', '<ruby>儀式<rt>ぎしき</rt></ruby>'], correctIndex: 0 },
      { question: 'アマゾンの「<ruby>黒<rt>くろ</rt></ruby>い<ruby>水<rt>みず</rt></ruby>」と「<ruby>白<rt>しろ</rt></ruby>い<ruby>水<rt>みず</rt></ruby>」が<ruby>合流<rt>ごうりゅう</rt></ruby>する<ruby>現象<rt>げんしょう</rt></ruby>は？', choices: ['<ruby>二河合流<rt>にがごうりゅう</rt></ruby>（ミーティング・オブ・ウォーターズ）', 'アマゾンの<ruby>涙<rt>なみだ</rt></ruby>', '<ruby>虹<rt>にじ</rt></ruby>の<ruby>川<rt>かわ</rt></ruby>', '<ruby>黄金<rt>おうごん</rt></ruby>の<ruby>合流<rt>ごうりゅう</rt></ruby>'], correctIndex: 0 },
      { question: 'グリーンアナコンダが<ruby>水中<rt>すいちゅう</rt></ruby>で<ruby>待<rt>ま</rt></ruby>ち<ruby>伏<rt>ぶ</rt></ruby>せする<ruby>理由<rt>りゆう</rt></ruby>は？', choices: ['<ruby>巨体<rt>きょたい</rt></ruby>を<ruby>水<rt>みず</rt></ruby>の<ruby>浮力<rt>ふりょく</rt></ruby>で<ruby>支<rt>ささ</rt></ruby>え、<ruby>獲物<rt>えもの</rt></ruby>を<ruby>奇襲<rt>きしゅう</rt></ruby>するため', '<ruby>体温<rt>たいおん</rt></ruby>を<ruby>下<rt>さ</rt></ruby>げるため', '<ruby>呼吸<rt>こきゅう</rt></ruby>しやすいため', '<ruby>天敵<rt>てんてき</rt></ruby>から<ruby>隠<rt>かく</rt></ruby>れるため'], correctIndex: 0 },
    ],
  },

  // ================================================================
  // 🏛️ 始皇帝
  // ================================================================
  qinshi: {
    beginner: [
      { question: '<ruby>始皇帝<rt>しこうてい</rt></ruby>はどの<ruby>国<rt>くに</rt></ruby>の<ruby>皇帝<rt>こうてい</rt></ruby>？', choices: ['<ruby>中国<rt>ちゅうごく</rt></ruby>', '<ruby>日本<rt>にほん</rt></ruby>', '<ruby>韓国<rt>かんこく</rt></ruby>', 'インド'], correctIndex: 0 },
      { question: '<ruby>万里<rt>ばんり</rt></ruby>の<ruby>長城<rt>ちょうじょう</rt></ruby>は<ruby>何<rt>なに</rt></ruby>のために<ruby>作<rt>つく</rt></ruby>られた？', choices: ['<ruby>敵<rt>てき</rt></ruby>の<ruby>侵入<rt>しんにゅう</rt></ruby>を<ruby>防<rt>ふせ</rt></ruby>ぐため', '<ruby>道路<rt>どうろ</rt></ruby>として', '<ruby>水<rt>みず</rt></ruby>を<ruby>運<rt>はこ</rt></ruby>ぶため', '<ruby>観光<rt>かんこう</rt></ruby>のため'], correctIndex: 0 },
      { question: '<ruby>兵馬俑<rt>へいばよう</rt></ruby>とは<ruby>何<rt>なに</rt></ruby>？', choices: ['<ruby>土<rt>つち</rt></ruby>で<ruby>作<rt>つく</rt></ruby>った<ruby>兵士<rt>へいし</rt></ruby>の<ruby>像<rt>ぞう</rt></ruby>', '<ruby>本物<rt>ほんもの</rt></ruby>の<ruby>兵士<rt>へいし</rt></ruby>', '<ruby>武器<rt>ぶき</rt></ruby>の<ruby>倉庫<rt>そうこ</rt></ruby>', '<ruby>宮殿<rt>きゅうでん</rt></ruby>の<ruby>名前<rt>なまえ</rt></ruby>'], correctIndex: 0 },
      { question: '<ruby>紙<rt>かみ</rt></ruby>が<ruby>発明<rt>はつめい</rt></ruby>された<ruby>国<rt>くに</rt></ruby>は？', choices: ['<ruby>中国<rt>ちゅうごく</rt></ruby>', 'エジプト', 'ギリシャ', 'ローマ'], correctIndex: 0 },
      { question: '<ruby>始皇帝<rt>しこうてい</rt></ruby>が<ruby>統一<rt>とういつ</rt></ruby>したものは？', choices: ['<ruby>文字<rt>もじ</rt></ruby>・<ruby>通貨<rt>つうか</rt></ruby>・<ruby>度量衡<rt>どりょうこう</rt></ruby>', '<ruby>言語<rt>げんご</rt></ruby>だけ', '<ruby>宗教<rt>しゅうきょう</rt></ruby>だけ', '<ruby>軍隊<rt>ぐんたい</rt></ruby>だけ'], correctIndex: 0 },
    ],
    challenger: [
      { question: '<ruby>焚書坑儒<rt>ふんしょこうじゅ</rt></ruby>とは<ruby>何<rt>なに</rt></ruby>？', choices: ['<ruby>書物<rt>しょもつ</rt></ruby>を<ruby>焼<rt>や</rt></ruby>き<ruby>学者<rt>がくしゃ</rt></ruby>を<ruby>埋<rt>う</rt></ruby>めた<ruby>政策<rt>せいさく</rt></ruby>', '<ruby>本<rt>ほん</rt></ruby>を<ruby>集<rt>あつ</rt></ruby>める<ruby>政策<rt>せいさく</rt></ruby>', '<ruby>学校<rt>がっこう</rt></ruby>を<ruby>建<rt>た</rt></ruby>てる<ruby>政策<rt>せいさく</rt></ruby>', '<ruby>図書館<rt>としょかん</rt></ruby>を<ruby>作<rt>つく</rt></ruby>る<ruby>政策<rt>せいさく</rt></ruby>'], correctIndex: 0 },
      { question: '<ruby>始皇帝<rt>しこうてい</rt></ruby>が<ruby>求<rt>もと</rt></ruby>めた「<ruby>不老不死<rt>ふろうふし</rt></ruby>」とは？', choices: ['<ruby>永遠<rt>えいえん</rt></ruby>に<ruby>生<rt>い</rt></ruby>きること', '<ruby>強<rt>つよ</rt></ruby>い<ruby>軍隊<rt>ぐんたい</rt></ruby>', '<ruby>黄金<rt>おうごん</rt></ruby>', '<ruby>広<rt>ひろ</rt></ruby>い<ruby>領土<rt>りょうど</rt></ruby>'], correctIndex: 0 },
      { question: '<ruby>秦<rt>しん</rt></ruby>が<ruby>統一<rt>とういつ</rt></ruby>する<ruby>前<rt>まえ</rt></ruby>の<ruby>時代<rt>じだい</rt></ruby>は？', choices: ['<ruby>戦国時代<rt>せんごくじだい</rt></ruby>', '<ruby>三国時代<rt>さんごくじだい</rt></ruby>', '<ruby>唐<rt>とう</rt></ruby>の<ruby>時代<rt>じだい</rt></ruby>', '<ruby>漢<rt>かん</rt></ruby>の<ruby>時代<rt>じだい</rt></ruby>'], correctIndex: 0 },
      { question: '<ruby>万里<rt>ばんり</rt></ruby>の<ruby>長城<rt>ちょうじょう</rt></ruby>の<ruby>長<rt>なが</rt></ruby>さは<ruby>約<rt>やく</rt></ruby>何km？', choices: ['<ruby>約<rt>やく</rt></ruby>21,000km', '<ruby>約<rt>やく</rt></ruby>5,000km', '<ruby>約<rt>やく</rt></ruby>1,000km', '<ruby>約<rt>やく</rt></ruby>50,000km'], correctIndex: 0 },
      { question: '<ruby>兵馬俑<rt>へいばよう</rt></ruby>が<ruby>発見<rt>はっけん</rt></ruby>されたのは<ruby>何年<rt>なんねん</rt></ruby>？', choices: ['1974<ruby>年<rt>ねん</rt></ruby>', '1900<ruby>年<rt>ねん</rt></ruby>', '1800<ruby>年<rt>ねん</rt></ruby>', '2000<ruby>年<rt>ねん</rt></ruby>'], correctIndex: 0 },
    ],
    master: [
      { question: '<ruby>始皇帝<rt>しこうてい</rt></ruby>が<ruby>統一<rt>とういつ</rt></ruby>した<ruby>文字<rt>もじ</rt></ruby>は？', choices: ['<ruby>小篆<rt>しょうてん</rt></ruby>', '<ruby>甲骨文字<rt>こうこつもじ</rt></ruby>', '<ruby>楷書<rt>かいしょ</rt></ruby>', '<ruby>草書<rt>そうしょ</rt></ruby>'], correctIndex: 0 },
      { question: '<ruby>徐福<rt>じょふく</rt></ruby>が<ruby>始皇帝<rt>しこうてい</rt></ruby>の<ruby>命<rt>めい</rt></ruby>で<ruby>探<rt>さが</rt></ruby>しに<ruby>行<rt>い</rt></ruby>ったものは？', choices: ['<ruby>不老不死<rt>ふろうふし</rt></ruby>の<ruby>薬<rt>くすり</rt></ruby>', '<ruby>黄金<rt>おうごん</rt></ruby>の<ruby>都市<rt>とし</rt></ruby>', '<ruby>新<rt>あたら</rt></ruby>しい<ruby>大陸<rt>たいりく</rt></ruby>', '<ruby>軍事技術<rt>ぐんじぎじゅつ</rt></ruby>'], correctIndex: 0 },
      { question: '<ruby>兵馬俑<rt>へいばよう</rt></ruby>の<ruby>兵士<rt>へいし</rt></ruby>はそれぞれ<ruby>何<rt>なに</rt></ruby>が<ruby>違<rt>ちが</rt></ruby>う？', choices: ['<ruby>顔<rt>かお</rt></ruby>がすべて<ruby>異<rt>こと</rt></ruby>なる', '<ruby>大<rt>おお</rt></ruby>きさが<ruby>違<rt>ちが</rt></ruby>う', '<ruby>色<rt>いろ</rt></ruby>が<ruby>違<rt>ちが</rt></ruby>う', 'すべて<ruby>同<rt>おな</rt></ruby>じ'], correctIndex: 0 },
      { question: '<ruby>秦<rt>しん</rt></ruby>の<ruby>統一<rt>とういつ</rt></ruby>は<ruby>紀元前<rt>きげんぜん</rt></ruby><ruby>何年<rt>なんねん</rt></ruby>？', choices: ['<ruby>紀元前<rt>きげんぜん</rt></ruby>221<ruby>年<rt>ねん</rt></ruby>', '<ruby>紀元前<rt>きげんぜん</rt></ruby>500<ruby>年<rt>ねん</rt></ruby>', '<ruby>紀元前<rt>きげんぜん</rt></ruby>100<ruby>年<rt>ねん</rt></ruby>', '<ruby>紀元<rt>きげん</rt></ruby>200<ruby>年<rt>ねん</rt></ruby>'], correctIndex: 0 },
      { question: '<ruby>秦<rt>しん</rt></ruby>が<ruby>短命<rt>たんめい</rt></ruby>に<ruby>終<rt>お</rt></ruby>わった<ruby>主<rt>おも</rt></ruby>な<ruby>理由<rt>りゆう</rt></ruby>は？', choices: ['<ruby>厳<rt>きび</rt></ruby>しすぎる<ruby>法治主義<rt>ほうちしゅぎ</rt></ruby>と<ruby>民衆<rt>みんしゅう</rt></ruby>の<ruby>反乱<rt>はんらん</rt></ruby>', '<ruby>外国<rt>がいこく</rt></ruby>の<ruby>侵略<rt>しんりゃく</rt></ruby>', '<ruby>自然災害<rt>しぜんさいがい</rt></ruby>', '<ruby>皇帝<rt>こうてい</rt></ruby>の<ruby>病気<rt>びょうき</rt></ruby>'], correctIndex: 0 },
    ],
    legend: [
      { question: '<ruby>始皇帝<rt>しこうてい</rt></ruby>の<ruby>陵墓<rt>りょうぼ</rt></ruby>にあるとされる<ruby>水銀<rt>すいぎん</rt></ruby>の<ruby>河<rt>かわ</rt></ruby>とは？', choices: ['<ruby>川<rt>かわ</rt></ruby>や<ruby>海<rt>うみ</rt></ruby>を<ruby>水銀<rt>すいぎん</rt></ruby>で<ruby>再現<rt>さいげん</rt></ruby>した<ruby>地下宮殿<rt>ちかきゅうでん</rt></ruby>', '<ruby>実際<rt>じっさい</rt></ruby>の<ruby>水銀<rt>すいぎん</rt></ruby>の<ruby>川<rt>かわ</rt></ruby>', '<ruby>金<rt>きん</rt></ruby>で<ruby>作<rt>つく</rt></ruby>られた<ruby>川<rt>かわ</rt></ruby>', '<ruby>銀<rt>ぎん</rt></ruby>の<ruby>装飾品<rt>そうしょくひん</rt></ruby>'], correctIndex: 0 },
      { question: '<ruby>李斯<rt>りし</rt></ruby>は<ruby>始皇帝<rt>しこうてい</rt></ruby>のもとで<ruby>何<rt>なに</rt></ruby>の<ruby>役割<rt>やくわり</rt></ruby>を<ruby>果<rt>は</rt></ruby>たした？', choices: ['<ruby>丞相<rt>じょうしょう</rt></ruby>として<ruby>法律<rt>ほうりつ</rt></ruby><ruby>整備<rt>せいび</rt></ruby>と<ruby>文字<rt>もじ</rt></ruby><ruby>統一<rt>とういつ</rt></ruby>', '<ruby>将軍<rt>しょうぐん</rt></ruby>として<ruby>軍<rt>ぐん</rt></ruby>を<ruby>指揮<rt>しき</rt></ruby>', '<ruby>建築家<rt>けんちくか</rt></ruby>として<ruby>長城<rt>ちょうじょう</rt></ruby>を<ruby>設計<rt>せっけい</rt></ruby>', '<ruby>医者<rt>いしゃ</rt></ruby>として<ruby>皇帝<rt>こうてい</rt></ruby>を<ruby>治療<rt>ちりょう</rt></ruby>'], correctIndex: 0 },
      { question: '<ruby>秦<rt>しん</rt></ruby>の<ruby>統一<rt>とういつ</rt></ruby><ruby>通貨<rt>つうか</rt></ruby>「<ruby>半両銭<rt>はんりょうせん</rt></ruby>」の<ruby>形<rt>かたち</rt></ruby>は？', choices: ['<ruby>丸<rt>まる</rt></ruby>い<ruby>形<rt>かたち</rt></ruby>に<ruby>四角<rt>しかく</rt></ruby>い<ruby>穴<rt>あな</rt></ruby>', '<ruby>長方形<rt>ちょうほうけい</rt></ruby>', '<ruby>三角形<rt>さんかくけい</rt></ruby>', '<ruby>穴<rt>あな</rt></ruby>のない<ruby>丸<rt>まる</rt></ruby>い<ruby>形<rt>かたち</rt></ruby>'], correctIndex: 0 },
      { question: '<ruby>始皇帝<rt>しこうてい</rt></ruby>が<ruby>統一<rt>とういつ</rt></ruby>した「<ruby>度量衡<rt>どりょうこう</rt></ruby>」とは？', choices: ['<ruby>長<rt>なが</rt></ruby>さ・<ruby>容量<rt>ようりょう</rt></ruby>・<ruby>重<rt>おも</rt></ruby>さの<ruby>基準<rt>きじゅん</rt></ruby>', '<ruby>税金<rt>ぜいきん</rt></ruby>の<ruby>基準<rt>きじゅん</rt></ruby>', '<ruby>軍隊<rt>ぐんたい</rt></ruby>の<ruby>階級<rt>かいきゅう</rt></ruby>', '<ruby>暦<rt>こよみ</rt></ruby>の<ruby>基準<rt>きじゅん</rt></ruby>'], correctIndex: 0 },
      { question: '<ruby>兵馬俑<rt>へいばよう</rt></ruby>が<ruby>発見<rt>はっけん</rt></ruby>されたきっかけは？', choices: ['<ruby>農民<rt>のうみん</rt></ruby>が<ruby>井戸<rt>いど</rt></ruby>を<ruby>掘<rt>ほ</rt></ruby>っていて<ruby>偶然<rt>ぐうぜん</rt></ruby><ruby>発見<rt>はっけん</rt></ruby>', '<ruby>考古学者<rt>こうこがくしゃ</rt></ruby>の<ruby>計画的<rt>けいかくてき</rt></ruby>な<ruby>発掘<rt>はっくつ</rt></ruby>', '<ruby>地震<rt>じしん</rt></ruby>で<ruby>地面<rt>じめん</rt></ruby>が<ruby>割<rt>わ</rt></ruby>れた', '<ruby>古文書<rt>こもんじょ</rt></ruby>の<ruby>記録<rt>きろく</rt></ruby>から'], correctIndex: 0 },
    ],
  },

  // ================================================================
  // 🔭 ガリレオ
  // ================================================================
  galileo: {
    beginner: [
      { question: 'ガリレオが<ruby>使<rt>つか</rt></ruby>った<ruby>道具<rt>どうぐ</rt></ruby>は？', choices: ['<ruby>望遠鏡<rt>ぼうえんきょう</rt></ruby>', '<ruby>顕微鏡<rt>けんびきょう</rt></ruby>', 'コンパス', '<ruby>時計<rt>とけい</rt></ruby>'], correctIndex: 0 },
      { question: '<ruby>地動説<rt>ちどうせつ</rt></ruby>とはどんな<ruby>考<rt>かんが</rt></ruby>え？', choices: ['<ruby>地球<rt>ちきゅう</rt></ruby>が<ruby>太陽<rt>たいよう</rt></ruby>の<ruby>周<rt>まわ</rt></ruby>りを<ruby>回<rt>まわ</rt></ruby>る', '<ruby>太陽<rt>たいよう</rt></ruby>が<ruby>地球<rt>ちきゅう</rt></ruby>の<ruby>周<rt>まわ</rt></ruby>りを<ruby>回<rt>まわ</rt></ruby>る', '<ruby>月<rt>つき</rt></ruby>が<ruby>地球<rt>ちきゅう</rt></ruby>を<ruby>回<rt>まわ</rt></ruby>る', '<ruby>星<rt>ほし</rt></ruby>が<ruby>回<rt>まわ</rt></ruby>る'], correctIndex: 0 },
      { question: 'ガリレオはどの<ruby>国<rt>くに</rt></ruby>の<ruby>科学者<rt>かがくしゃ</rt></ruby>？', choices: ['イタリア', 'フランス', 'イギリス', 'ドイツ'], correctIndex: 0 },
      { question: 'ガリレオが<ruby>落<rt>お</rt></ruby>としたとされる<ruby>場所<rt>ばしょ</rt></ruby>は？', choices: ['ピサの<ruby>斜塔<rt>しゃとう</rt></ruby>', 'エッフェル<ruby>塔<rt>とう</rt></ruby>', 'バベルの<ruby>塔<rt>とう</rt></ruby>', '<ruby>東京<rt>とうきょう</rt></ruby>タワー'], correctIndex: 0 },
      { question: '<ruby>天動説<rt>てんどうせつ</rt></ruby>とはどんな<ruby>考<rt>かんが</rt></ruby>え？', choices: ['<ruby>太陽<rt>たいよう</rt></ruby>や<ruby>星<rt>ほし</rt></ruby>が<ruby>地球<rt>ちきゅう</rt></ruby>の<ruby>周<rt>まわ</rt></ruby>りを<ruby>回<rt>まわ</rt></ruby>る', '<ruby>地球<rt>ちきゅう</rt></ruby>が<ruby>回<rt>まわ</rt></ruby>る', '<ruby>月<rt>つき</rt></ruby>だけが<ruby>回<rt>まわ</rt></ruby>る', '<ruby>何<rt>なに</rt></ruby>も<ruby>回<rt>まわ</rt></ruby>らない'], correctIndex: 0 },
    ],
    challenger: [
      { question: 'ガリレオが<ruby>望遠鏡<rt>ぼうえんきょう</rt></ruby>で<ruby>発見<rt>はっけん</rt></ruby>したものは？', choices: ['<ruby>木星<rt>もくせい</rt></ruby>の<ruby>衛星<rt>えいせい</rt></ruby>', '<ruby>冥王星<rt>めいおうせい</rt></ruby>', '<ruby>彗星<rt>すいせい</rt></ruby>', 'ブラックホール'], correctIndex: 0 },
      { question: 'ガリレオが<ruby>裁判<rt>さいばん</rt></ruby>にかけられた<ruby>理由<rt>りゆう</rt></ruby>は？', choices: ['<ruby>地動説<rt>ちどうせつ</rt></ruby>を<ruby>主張<rt>しゅちょう</rt></ruby>したため', '<ruby>犯罪<rt>はんざい</rt></ruby>を<ruby>犯<rt>おか</rt></ruby>したため', '<ruby>税金<rt>ぜいきん</rt></ruby>を<ruby>払<rt>はら</rt></ruby>わなかったため', '<ruby>王<rt>おう</rt></ruby>を<ruby>批判<rt>ひはん</rt></ruby>したため'], correctIndex: 0 },
      { question: '<ruby>地動説<rt>ちどうせつ</rt></ruby>を<ruby>最初<rt>さいしょ</rt></ruby>にとなえた<ruby>人<rt>ひと</rt></ruby>は？', choices: ['コペルニクス', 'ガリレオ', 'ニュートン', 'ケプラー'], correctIndex: 0 },
      { question: 'ガリレオが<ruby>発見<rt>はっけん</rt></ruby>した「<ruby>振<rt>ふ</rt></ruby>り<ruby>子<rt>こ</rt></ruby>の<ruby>法則<rt>ほうそく</rt></ruby>」はどこで<ruby>気<rt>き</rt></ruby>づいた？', choices: ['<ruby>教会<rt>きょうかい</rt></ruby>のシャンデリア', '<ruby>時計台<rt>とけいだい</rt></ruby>', '<ruby>公園<rt>こうえん</rt></ruby>のブランコ', '<ruby>船<rt>ふね</rt></ruby>の<ruby>揺<rt>ゆ</rt></ruby>れ'], correctIndex: 0 },
      { question: 'ガリレオの<ruby>有名<rt>ゆうめい</rt></ruby>な<ruby>言葉<rt>ことば</rt></ruby>は？', choices: ['それでも<ruby>地球<rt>ちきゅう</rt></ruby>は<ruby>回<rt>まわ</rt></ruby>っている', '<ruby>我思<rt>われおも</rt></ruby>う、ゆえに<ruby>我<rt>われ</rt></ruby>あり', 'ユーリカ！', '<ruby>万有引力<rt>ばんゆういんりょく</rt></ruby>だ！'], correctIndex: 0 },
    ],
    master: [
      { question: 'ガリレオが<ruby>発見<rt>はっけん</rt></ruby>した<ruby>木星<rt>もくせい</rt></ruby>の<ruby>衛星<rt>えいせい</rt></ruby>はいくつ？', choices: ['4つ', '2つ', '6つ', '1つ'], correctIndex: 0 },
      { question: 'ガリレオの<ruby>望遠鏡<rt>ぼうえんきょう</rt></ruby>の<ruby>倍率<rt>ばいりつ</rt></ruby>は<ruby>最大<rt>さいだい</rt></ruby>で<ruby>約<rt>やく</rt></ruby>何<ruby>倍<rt>ばい</rt></ruby>？', choices: ['<ruby>約<rt>やく</rt></ruby>30<ruby>倍<rt>ばい</rt></ruby>', '<ruby>約<rt>やく</rt></ruby>3<ruby>倍<rt>ばい</rt></ruby>', '<ruby>約<rt>やく</rt></ruby>100<ruby>倍<rt>ばい</rt></ruby>', '<ruby>約<rt>やく</rt></ruby>1000<ruby>倍<rt>ばい</rt></ruby>'], correctIndex: 0 },
      { question: 'ガリレオが<ruby>観察<rt>かんさつ</rt></ruby>した<ruby>月<rt>つき</rt></ruby>の<ruby>表面<rt>ひょうめん</rt></ruby>について<ruby>何<rt>なに</rt></ruby>を<ruby>発見<rt>はっけん</rt></ruby>した？', choices: ['クレーター（<ruby>凸凹<rt>でこぼこ</rt></ruby>がある）', '<ruby>完全<rt>かんぜん</rt></ruby>に<ruby>平<rt>たい</rt></ruby>ら', '<ruby>水<rt>みず</rt></ruby>がある', '<ruby>生物<rt>せいぶつ</rt></ruby>がいる'], correctIndex: 0 },
      { question: 'ガリレオを<ruby>裁<rt>さば</rt></ruby>いたのはどの<ruby>組織<rt>そしき</rt></ruby>？', choices: ['カトリック<ruby>教会<rt>きょうかい</rt></ruby>の<ruby>宗教裁判所<rt>しゅうきょうさいばんしょ</rt></ruby>', 'ローマ<ruby>元老院<rt>げんろういん</rt></ruby>', 'イタリア<ruby>王国<rt>おうこく</rt></ruby>', '<ruby>大学<rt>だいがく</rt></ruby>の<ruby>評議会<rt>ひょうぎかい</rt></ruby>'], correctIndex: 0 },
      { question: 'ガリレオの<ruby>落体<rt>らくたい</rt></ruby>の<ruby>法則<rt>ほうそく</rt></ruby>とは？', choices: ['<ruby>重<rt>おも</rt></ruby>さに<ruby>関係<rt>かんけい</rt></ruby>なく<ruby>同<rt>おな</rt></ruby>じ<ruby>速<rt>はや</rt></ruby>さで<ruby>落<rt>お</rt></ruby>ちる', '<ruby>重<rt>おも</rt></ruby>い<ruby>物<rt>もの</rt></ruby>ほど<ruby>速<rt>はや</rt></ruby>く<ruby>落<rt>お</rt></ruby>ちる', '<ruby>軽<rt>かる</rt></ruby>い<ruby>物<rt>もの</rt></ruby>ほど<ruby>速<rt>はや</rt></ruby>く<ruby>落<rt>お</rt></ruby>ちる', '<ruby>大<rt>おお</rt></ruby>きい<ruby>物<rt>もの</rt></ruby>ほど<ruby>速<rt>はや</rt></ruby>く<ruby>落<rt>お</rt></ruby>ちる'], correctIndex: 0 },
    ],
    legend: [
      { question: 'ガリレオが<ruby>発見<rt>はっけん</rt></ruby>した<ruby>金星<rt>きんせい</rt></ruby>の<ruby>満<rt>み</rt></ruby>ち<ruby>欠<rt>か</rt></ruby>けが<ruby>証明<rt>しょうめい</rt></ruby>したことは？', choices: ['<ruby>金星<rt>きんせい</rt></ruby>が<ruby>太陽<rt>たいよう</rt></ruby>の<ruby>周<rt>まわ</rt></ruby>りを<ruby>回<rt>まわ</rt></ruby>っていること', '<ruby>金星<rt>きんせい</rt></ruby>に<ruby>大気<rt>たいき</rt></ruby>があること', '<ruby>金星<rt>きんせい</rt></ruby>が<ruby>自転<rt>じてん</rt></ruby>していること', '<ruby>金星<rt>きんせい</rt></ruby>に<ruby>水<rt>みず</rt></ruby>があること'], correctIndex: 0 },
      { question: 'ガリレオの「<ruby>対話<rt>たいわ</rt></ruby>」は<ruby>何<rt>なに</rt></ruby>について<ruby>書<rt>か</rt></ruby>かれた？', choices: ['<ruby>天動説<rt>てんどうせつ</rt></ruby>と<ruby>地動説<rt>ちどうせつ</rt></ruby>の<ruby>議論<rt>ぎろん</rt></ruby>', '<ruby>数学<rt>すうがく</rt></ruby>の<ruby>定理<rt>ていり</rt></ruby>', '<ruby>哲学<rt>てつがく</rt></ruby>の<ruby>問題<rt>もんだい</rt></ruby>', '<ruby>医学<rt>いがく</rt></ruby>の<ruby>発見<rt>はっけん</rt></ruby>'], correctIndex: 0 },
      { question: 'ガリレオの<ruby>名誉<rt>めいよ</rt></ruby>が<ruby>正式<rt>せいしき</rt></ruby>に<ruby>回復<rt>かいふく</rt></ruby>されたのは<ruby>何年<rt>なんねん</rt></ruby>？', choices: ['1992<ruby>年<rt>ねん</rt></ruby>', '1700<ruby>年<rt>ねん</rt></ruby>', '1900<ruby>年<rt>ねん</rt></ruby>', '2020<ruby>年<rt>ねん</rt></ruby>'], correctIndex: 0 },
      { question: 'ガリレオが<ruby>改良<rt>かいりょう</rt></ruby>した<ruby>望遠鏡<rt>ぼうえんきょう</rt></ruby>の<ruby>原理<rt>げんり</rt></ruby>は？', choices: ['<ruby>凸<rt>とつ</rt></ruby>レンズと<ruby>凹<rt>おう</rt></ruby>レンズの<ruby>組<rt>く</rt></ruby>み<ruby>合<rt>あ</rt></ruby>わせ', '<ruby>反射鏡<rt>はんしゃきょう</rt></ruby>', 'プリズム', '<ruby>水晶<rt>すいしょう</rt></ruby>の<ruby>球<rt>たま</rt></ruby>'], correctIndex: 0 },
      { question: '<ruby>木星<rt>もくせい</rt></ruby>の4つの<ruby>衛星<rt>えいせい</rt></ruby>は<ruby>現在<rt>げんざい</rt></ruby><ruby>何<rt>なに</rt></ruby>と<ruby>呼<rt>よ</rt></ruby>ばれている？', choices: ['ガリレオ<ruby>衛星<rt>えいせい</rt></ruby>', 'コペルニクス<ruby>衛星<rt>えいせい</rt></ruby>', 'ニュートン<ruby>衛星<rt>えいせい</rt></ruby>', 'ケプラー<ruby>衛星<rt>えいせい</rt></ruby>'], correctIndex: 0 },
    ],
  },

  // ================================================================
  // 🗡️ ジャンヌ
  // ================================================================
  jeanne: {
    beginner: [
      { question: 'ジャンヌ・ダルクはどの<ruby>国<rt>くに</rt></ruby>の<ruby>英雄<rt>えいゆう</rt></ruby>？', choices: ['フランス', 'イギリス', 'ドイツ', 'スペイン'], correctIndex: 0 },
      { question: 'ジャンヌ・ダルクは<ruby>何<rt>なに</rt></ruby>を<ruby>聞<rt>き</rt></ruby>いた？', choices: ['<ruby>神<rt>かみ</rt></ruby>の<ruby>声<rt>こえ</rt></ruby>', '<ruby>音楽<rt>おんがく</rt></ruby>', '<ruby>雷<rt>かみなり</rt></ruby>', '<ruby>鐘<rt>かね</rt></ruby>の<ruby>音<rt>おと</rt></ruby>'], correctIndex: 0 },
      { question: '<ruby>百年戦争<rt>ひゃくねんせんそう</rt></ruby>はどの<ruby>国<rt>くに</rt></ruby>と<ruby>国<rt>くに</rt></ruby>の<ruby>戦争<rt>せんそう</rt></ruby>？', choices: ['フランスとイギリス', 'フランスとドイツ', 'イギリスとスペイン', 'フランスとイタリア'], correctIndex: 0 },
      { question: 'ジャンヌ・ダルクの<ruby>別名<rt>べつめい</rt></ruby>は？', choices: ['オルレアンの<ruby>乙女<rt>おとめ</rt></ruby>', 'パリの<ruby>薔薇<rt>ばら</rt></ruby>', 'フランスの<ruby>太陽<rt>たいよう</rt></ruby>', '<ruby>百合<rt>ゆり</rt></ruby>の<ruby>騎士<rt>きし</rt></ruby>'], correctIndex: 0 },
      { question: 'ジャンヌ・ダルクが<ruby>解放<rt>かいほう</rt></ruby>した<ruby>都市<rt>とし</rt></ruby>は？', choices: ['オルレアン', 'パリ', 'マルセイユ', 'リヨン'], correctIndex: 0 },
    ],
    challenger: [
      { question: 'ジャンヌ・ダルクが<ruby>神<rt>かみ</rt></ruby>の<ruby>声<rt>こえ</rt></ruby>を<ruby>聞<rt>き</rt></ruby>いたのは<ruby>何歳<rt>なんさい</rt></ruby>？', choices: ['13<ruby>歳<rt>さい</rt></ruby>', '5<ruby>歳<rt>さい</rt></ruby>', '20<ruby>歳<rt>さい</rt></ruby>', '30<ruby>歳<rt>さい</rt></ruby>'], correctIndex: 0 },
      { question: '<ruby>百年戦争<rt>ひゃくねんせんそう</rt></ruby>は<ruby>実際<rt>じっさい</rt></ruby>には<ruby>何年間<rt>なんねんかん</rt></ruby><ruby>続<rt>つづ</rt></ruby>いた？', choices: ['<ruby>約<rt>やく</rt></ruby>116<ruby>年<rt>ねん</rt></ruby>', 'ちょうど100<ruby>年<rt>ねん</rt></ruby>', '<ruby>約<rt>やく</rt></ruby>50<ruby>年<rt>ねん</rt></ruby>', '<ruby>約<rt>やく</rt></ruby>200<ruby>年<rt>ねん</rt></ruby>'], correctIndex: 0 },
      { question: 'フランス<ruby>王家<rt>おうけ</rt></ruby>の<ruby>紋章<rt>もんしょう</rt></ruby>の<ruby>花<rt>はな</rt></ruby>は？', choices: ['<ruby>百合<rt>ゆり</rt></ruby>', '<ruby>薔薇<rt>ばら</rt></ruby>', '<ruby>菊<rt>きく</rt></ruby>', '<ruby>桜<rt>さくら</rt></ruby>'], correctIndex: 0 },
      { question: 'ジャンヌが<ruby>捕<rt>つか</rt></ruby>まった<ruby>後<rt>あと</rt></ruby>の<ruby>運命<rt>うんめい</rt></ruby>は？', choices: ['<ruby>火刑<rt>かけい</rt></ruby>にされた', '<ruby>牢獄<rt>ろうごく</rt></ruby>で<ruby>一生<rt>いっしょう</rt></ruby>を<ruby>終<rt>お</rt></ruby>えた', '<ruby>追放<rt>ついほう</rt></ruby>された', '<ruby>許<rt>ゆる</rt></ruby>されて<ruby>帰<rt>かえ</rt></ruby>された'], correctIndex: 0 },
      { question: 'ジャンヌが<ruby>掲<rt>かか</rt></ruby>げた<ruby>旗<rt>はた</rt></ruby>に<ruby>描<rt>えが</rt></ruby>かれていたのは？', choices: ['<ruby>神<rt>かみ</rt></ruby>と<ruby>天使<rt>てんし</rt></ruby>', '<ruby>百合<rt>ゆり</rt></ruby>と<ruby>剣<rt>けん</rt></ruby>', '<ruby>十字<rt>じゅうじ</rt></ruby>と<ruby>王冠<rt>おうかん</rt></ruby>', '<ruby>鷲<rt>わし</rt></ruby>と<ruby>星<rt>ほし</rt></ruby>'], correctIndex: 0 },
    ],
    master: [
      { question: 'ジャンヌが<ruby>戴冠<rt>たいかん</rt></ruby>させた<ruby>王<rt>おう</rt></ruby>は？', choices: ['シャルル7<ruby>世<rt>せい</rt></ruby>', 'ルイ14<ruby>世<rt>せい</rt></ruby>', 'フィリップ4<ruby>世<rt>せい</rt></ruby>', 'シャルル5<ruby>世<rt>せい</rt></ruby>'], correctIndex: 0 },
      { question: 'ジャンヌを<ruby>捕<rt>つか</rt></ruby>まえたのは<ruby>誰<rt>だれ</rt></ruby>？', choices: ['ブルゴーニュ<ruby>派<rt>は</rt></ruby>', 'イギリス<ruby>軍<rt>ぐん</rt></ruby>', 'フランス<ruby>王<rt>おう</rt></ruby>', '<ruby>教会<rt>きょうかい</rt></ruby>'], correctIndex: 0 },
      { question: 'ジャンヌの<ruby>裁判<rt>さいばん</rt></ruby>で<ruby>問<rt>と</rt></ruby>われた<ruby>罪<rt>つみ</rt></ruby>は？', choices: ['<ruby>異端<rt>いたん</rt></ruby>（<ruby>教会<rt>きょうかい</rt></ruby>の<ruby>教<rt>おし</rt></ruby>えに<ruby>反<rt>はん</rt></ruby>する）', '<ruby>殺人<rt>さつじん</rt></ruby>', '<ruby>窃盗<rt>せっとう</rt></ruby>', '<ruby>反逆<rt>はんぎゃく</rt></ruby>'], correctIndex: 0 },
      { question: 'ジャンヌが「<ruby>聖女<rt>せいじょ</rt></ruby>」と<ruby>認<rt>みと</rt></ruby>められたのは<ruby>何年<rt>なんねん</rt></ruby>？', choices: ['1920<ruby>年<rt>ねん</rt></ruby>', '1431<ruby>年<rt>ねん</rt></ruby>', '1500<ruby>年<rt>ねん</rt></ruby>', '1800<ruby>年<rt>ねん</rt></ruby>'], correctIndex: 0 },
      { question: 'オルレアン<ruby>包囲戦<rt>ほういせん</rt></ruby>でジャンヌが<ruby>勝利<rt>しょうり</rt></ruby>したのは<ruby>何年<rt>なんねん</rt></ruby>？', choices: ['1429<ruby>年<rt>ねん</rt></ruby>', '1337<ruby>年<rt>ねん</rt></ruby>', '1453<ruby>年<rt>ねん</rt></ruby>', '1500<ruby>年<rt>ねん</rt></ruby>'], correctIndex: 0 },
    ],
    legend: [
      { question: 'ジャンヌの<ruby>裁判<rt>さいばん</rt></ruby>を<ruby>主導<rt>しゅどう</rt></ruby>した<ruby>司教<rt>しきょう</rt></ruby>は？', choices: ['コーション<ruby>司教<rt>しきょう</rt></ruby>', 'ボニファティウス<ruby>司教<rt>しきょう</rt></ruby>', 'クレメンス<ruby>司教<rt>しきょう</rt></ruby>', 'グレゴリウス<ruby>司教<rt>しきょう</rt></ruby>'], correctIndex: 0 },
      { question: 'ジャンヌの<ruby>死後<rt>しご</rt></ruby>、<ruby>復権裁判<rt>ふっけんさいばん</rt></ruby>が<ruby>行<rt>おこな</rt></ruby>われたのは<ruby>何年<rt>なんねん</rt></ruby>？', choices: ['1456<ruby>年<rt>ねん</rt></ruby>', '1431<ruby>年<rt>ねん</rt></ruby>', '1500<ruby>年<rt>ねん</rt></ruby>', '1600<ruby>年<rt>ねん</rt></ruby>'], correctIndex: 0 },
      { question: 'ジャンヌが<ruby>男装<rt>だんそう</rt></ruby>した<ruby>理由<rt>りゆう</rt></ruby>として<ruby>考<rt>かんが</rt></ruby>えられているのは？', choices: ['<ruby>戦場<rt>せんじょう</rt></ruby>での<ruby>安全<rt>あんぜん</rt></ruby>と<ruby>実用性<rt>じつようせい</rt></ruby>', 'ファッション', '<ruby>王<rt>おう</rt></ruby>の<ruby>命令<rt>めいれい</rt></ruby>', '<ruby>変装<rt>へんそう</rt></ruby>して<ruby>逃<rt>に</rt></ruby>げるため'], correctIndex: 0 },
      { question: 'ジャンヌの<ruby>聖剣<rt>せいけん</rt></ruby>はどこで<ruby>見<rt>み</rt></ruby>つかったとされる？', choices: ['サント・カトリーヌ・ド・フィエルボワの<ruby>教会<rt>きょうかい</rt></ruby>', 'パリの<ruby>大聖堂<rt>だいせいどう</rt></ruby>', '<ruby>湖<rt>みずうみ</rt></ruby>の<ruby>底<rt>そこ</rt></ruby>', '<ruby>王宮<rt>おうきゅう</rt></ruby>の<ruby>宝物庫<rt>ほうもつこ</rt></ruby>'], correctIndex: 0 },
      { question: '<ruby>百年戦争<rt>ひゃくねんせんそう</rt></ruby>の<ruby>原因<rt>げんいん</rt></ruby>の<ruby>一<rt>ひと</rt></ruby>つは？', choices: ['フランス<ruby>王位<rt>おうい</rt></ruby><ruby>継承問題<rt>けいしょうもんだい</rt></ruby>', '<ruby>宗教<rt>しゅうきょう</rt></ruby>の<ruby>違<rt>ちが</rt></ruby>い', '<ruby>貿易<rt>ぼうえき</rt></ruby><ruby>紛争<rt>ふんそう</rt></ruby>', '<ruby>領土<rt>りょうど</rt></ruby><ruby>発見<rt>はっけん</rt></ruby>'], correctIndex: 0 },
    ],
  },

  // ================================================================
  // 📖 紫式部
  // ================================================================
  murasaki: {
    beginner: [
      { question: '<ruby>紫式部<rt>むらさきしきぶ</rt></ruby>が<ruby>書<rt>か</rt></ruby>いた<ruby>作品<rt>さくひん</rt></ruby>は？', choices: ['<ruby>源氏物語<rt>げんじものがたり</rt></ruby>', '<ruby>枕草子<rt>まくらのそうし</rt></ruby>', '<ruby>徒然草<rt>つれづれぐさ</rt></ruby>', '<ruby>方丈記<rt>ほうじょうき</rt></ruby>'], correctIndex: 0 },
      { question: '<ruby>紫式部<rt>むらさきしきぶ</rt></ruby>が<ruby>活躍<rt>かつやく</rt></ruby>した<ruby>時代<rt>じだい</rt></ruby>は？', choices: ['<ruby>平安時代<rt>へいあんじだい</rt></ruby>', '<ruby>鎌倉時代<rt>かまくらじだい</rt></ruby>', '<ruby>江戸時代<rt>えどじだい</rt></ruby>', '<ruby>奈良時代<rt>ならじだい</rt></ruby>'], correctIndex: 0 },
      { question: '<ruby>平安時代<rt>へいあんじだい</rt></ruby>の<ruby>都<rt>みやこ</rt></ruby>はどこ？', choices: ['<ruby>京都<rt>きょうと</rt></ruby>', '<ruby>東京<rt>とうきょう</rt></ruby>', '<ruby>奈良<rt>なら</rt></ruby>', '<ruby>大阪<rt>おおさか</rt></ruby>'], correctIndex: 0 },
      { question: '<ruby>紙<rt>かみ</rt></ruby>は<ruby>日本<rt>にほん</rt></ruby>で<ruby>何<rt>なに</rt></ruby>に<ruby>使<rt>つか</rt></ruby>われていた？', choices: ['<ruby>書道<rt>しょどう</rt></ruby>や<ruby>手紙<rt>てがみ</rt></ruby>', '<ruby>建物<rt>たてもの</rt></ruby>の<ruby>壁<rt>かべ</rt></ruby>だけ', '<ruby>食器<rt>しょっき</rt></ruby>', '<ruby>武器<rt>ぶき</rt></ruby>'], correctIndex: 0 },
      { question: '<ruby>源氏物語<rt>げんじものがたり</rt></ruby>は<ruby>世界最古<rt>せかいさいこ</rt></ruby>の<ruby>何<rt>なに</rt></ruby>？', choices: ['<ruby>長編小説<rt>ちょうへんしょうせつ</rt></ruby>', '<ruby>詩集<rt>ししゅう</rt></ruby>', '<ruby>歴史書<rt>れきししょ</rt></ruby>', '<ruby>日記<rt>にっき</rt></ruby>'], correctIndex: 0 },
    ],
    challenger: [
      { question: '<ruby>源氏物語<rt>げんじものがたり</rt></ruby>の<ruby>主人公<rt>しゅじんこう</rt></ruby>は？', choices: ['<ruby>光源氏<rt>ひかるげんじ</rt></ruby>', '<ruby>在原業平<rt>ありわらのなりひら</rt></ruby>', '<ruby>藤原道長<rt>ふじわらのみちなが</rt></ruby>', '<ruby>清少納言<rt>せいしょうなごん</rt></ruby>'], correctIndex: 0 },
      { question: '<ruby>枕草子<rt>まくらのそうし</rt></ruby>を<ruby>書<rt>か</rt></ruby>いたのは<ruby>誰<rt>だれ</rt></ruby>？', choices: ['<ruby>清少納言<rt>せいしょうなごん</rt></ruby>', '<ruby>紫式部<rt>むらさきしきぶ</rt></ruby>', '<ruby>小野小町<rt>おののこまち</rt></ruby>', '<ruby>和泉式部<rt>いずみしきぶ</rt></ruby>'], correctIndex: 0 },
      { question: '<ruby>紫式部<rt>むらさきしきぶ</rt></ruby>が<ruby>仕<rt>つか</rt></ruby>えた<ruby>人物<rt>じんぶつ</rt></ruby>は？', choices: ['<ruby>藤原道長<rt>ふじわらのみちなが</rt></ruby>の<ruby>娘<rt>むすめ</rt></ruby>・<ruby>彰子<rt>しょうし</rt></ruby>', '<ruby>天皇<rt>てんのう</rt></ruby>', '<ruby>将軍<rt>しょうぐん</rt></ruby>', '<ruby>僧侶<rt>そうりょ</rt></ruby>'], correctIndex: 0 },
      { question: '<ruby>平安時代<rt>へいあんじだい</rt></ruby>の<ruby>女性<rt>じょせい</rt></ruby>が<ruby>使<rt>つか</rt></ruby>った<ruby>文字<rt>もじ</rt></ruby>は？', choices: ['<ruby>ひらがな<rt>ひらがな</rt></ruby>', '<ruby>漢字<rt>かんじ</rt></ruby>だけ', 'カタカナだけ', 'ローマ<ruby>字<rt>じ</rt></ruby>'], correctIndex: 0 },
      { question: '<ruby>源氏物語<rt>げんじものがたり</rt></ruby>は<ruby>全部<rt>ぜんぶ</rt></ruby>で<ruby>何帖<rt>なんじょう</rt></ruby>？', choices: ['54<ruby>帖<rt>じょう</rt></ruby>', '10<ruby>帖<rt>じょう</rt></ruby>', '100<ruby>帖<rt>じょう</rt></ruby>', '30<ruby>帖<rt>じょう</rt></ruby>'], correctIndex: 0 },
    ],
    master: [
      { question: '<ruby>紫式部<rt>むらさきしきぶ</rt></ruby>の<ruby>本名<rt>ほんみょう</rt></ruby>は？', choices: ['<ruby>正確<rt>せいかく</rt></ruby>には<ruby>不明<rt>ふめい</rt></ruby>（<ruby>藤原香子<rt>ふじわらのかおりこ</rt></ruby>とも）', '<ruby>紫<rt>むらさき</rt></ruby>', '<ruby>式部<rt>しきぶ</rt></ruby>', '<ruby>源<rt>みなもと</rt></ruby>'],  correctIndex: 0 },
      { question: '<ruby>紫式部日記<rt>むらさきしきぶにっき</rt></ruby>に<ruby>書<rt>か</rt></ruby>かれた<ruby>清少納言<rt>せいしょうなごん</rt></ruby>への<ruby>評価<rt>ひょうか</rt></ruby>は？', choices: ['<ruby>批判的<rt>ひはんてき</rt></ruby>（<ruby>知識<rt>ちしき</rt></ruby>をひけらかすと）', '<ruby>称賛<rt>しょうさん</rt></ruby>', '<ruby>無関心<rt>むかんしん</rt></ruby>', '<ruby>友好的<rt>ゆうこうてき</rt></ruby>'], correctIndex: 0 },
      { question: '<ruby>源氏物語<rt>げんじものがたり</rt></ruby>が<ruby>英語<rt>えいご</rt></ruby>に<ruby>初<rt>はじ</rt></ruby>めて<ruby>翻訳<rt>ほんやく</rt></ruby>されたのは<ruby>何世紀<rt>なんせいき</rt></ruby>？', choices: ['20<ruby>世紀初頭<rt>せいきしょとう</rt></ruby>（アーサー・ウェイリー<ruby>訳<rt>やく</rt></ruby>）', '17<ruby>世紀<rt>せいき</rt></ruby>', '19<ruby>世紀<rt>せいき</rt></ruby>', '21<ruby>世紀<rt>せいき</rt></ruby>'], correctIndex: 0 },
      { question: '<ruby>藤原道長<rt>ふじわらのみちなが</rt></ruby>の「この<ruby>世<rt>よ</rt></ruby>をば…」の<ruby>和歌<rt>わか</rt></ruby>が<ruby>詠<rt>よ</rt></ruby>まれた<ruby>背景<rt>はいけい</rt></ruby>は？', choices: ['<ruby>娘<rt>むすめ</rt></ruby>たちが<ruby>皇后<rt>こうごう</rt></ruby>になり<ruby>権力<rt>けんりょく</rt></ruby>が<ruby>絶頂<rt>ぜっちょう</rt></ruby>に<ruby>達<rt>たっ</rt></ruby>した', '<ruby>戦<rt>いくさ</rt></ruby>に<ruby>勝<rt>か</rt></ruby>った', '<ruby>宝<rt>たから</rt></ruby>を<ruby>発見<rt>はっけん</rt></ruby>した', '<ruby>病気<rt>びょうき</rt></ruby>が<ruby>治<rt>なお</rt></ruby>った'], correctIndex: 0 },
      { question: '<ruby>平安時代<rt>へいあんじだい</rt></ruby>の<ruby>貴族<rt>きぞく</rt></ruby>が<ruby>恋<rt>こい</rt></ruby>の<ruby>気持<rt>きも</rt></ruby>ちを<ruby>伝<rt>つた</rt></ruby>える<ruby>方法<rt>ほうほう</rt></ruby>は？', choices: ['<ruby>和歌<rt>わか</rt></ruby>を<ruby>書<rt>か</rt></ruby>いて<ruby>送<rt>おく</rt></ruby>る', '<ruby>直接<rt>ちょくせつ</rt></ruby><ruby>会<rt>あ</rt></ruby>って<ruby>話<rt>はな</rt></ruby>す', '<ruby>使者<rt>ししゃ</rt></ruby>に<ruby>伝言<rt>でんごん</rt></ruby>を<ruby>頼<rt>たの</rt></ruby>む', '<ruby>贈<rt>おく</rt></ruby>り<ruby>物<rt>もの</rt></ruby>をする'], correctIndex: 0 },
    ],
    legend: [
      { question: '<ruby>源氏物語<rt>げんじものがたり</rt></ruby>の「<ruby>須磨<rt>すま</rt></ruby>」の<ruby>巻<rt>まき</rt></ruby>で<ruby>光源氏<rt>ひかるげんじ</rt></ruby>が<ruby>都<rt>みやこ</rt></ruby>を<ruby>離<rt>はな</rt></ruby>れた<ruby>理由<rt>りゆう</rt></ruby>は？', choices: ['<ruby>政治的<rt>せいじてき</rt></ruby>な<ruby>失脚<rt>しっきゃく</rt></ruby>による<ruby>自主的<rt>じしゅてき</rt></ruby>な<ruby>退去<rt>たいきょ</rt></ruby>', '<ruby>戦争<rt>せんそう</rt></ruby>', '<ruby>病気<rt>びょうき</rt></ruby>の<ruby>療養<rt>りょうよう</rt></ruby>', '<ruby>修行<rt>しゅぎょう</rt></ruby>のため'], correctIndex: 0 },
      { question: '<ruby>紫式部<rt>むらさきしきぶ</rt></ruby>の<ruby>父<rt>ちち</rt></ruby>・<ruby>藤原為時<rt>ふじわらのためとき</rt></ruby>の<ruby>職業<rt>しょくぎょう</rt></ruby>は？', choices: ['<ruby>漢学者<rt>かんがくしゃ</rt></ruby>・<ruby>文人<rt>ぶんじん</rt></ruby><ruby>官僚<rt>かんりょう</rt></ruby>', '<ruby>武士<rt>ぶし</rt></ruby>', '<ruby>僧侶<rt>そうりょ</rt></ruby>', '<ruby>商人<rt>しょうにん</rt></ruby>'], correctIndex: 0 },
      { question: '<ruby>源氏物語<rt>げんじものがたり</rt></ruby>の<ruby>最後<rt>さいご</rt></ruby>の10<ruby>帖<rt>じょう</rt></ruby>の<ruby>通称<rt>つうしょう</rt></ruby>は？', choices: ['<ruby>宇治十帖<rt>うじじゅうじょう</rt></ruby>', '<ruby>光源氏十帖<rt>ひかるげんじじゅうじょう</rt></ruby>', '<ruby>紫十帖<rt>むらさきじゅうじょう</rt></ruby>', '<ruby>京都十帖<rt>きょうとじゅうじょう</rt></ruby>'], correctIndex: 0 },
      { question: '<ruby>平安時代<rt>へいあんじだい</rt></ruby>に<ruby>紙<rt>かみ</rt></ruby>が<ruby>貴重<rt>きちょう</rt></ruby>だった<ruby>理由<rt>りゆう</rt></ruby>は？', choices: ['<ruby>手作業<rt>てさぎょう</rt></ruby>で<ruby>一枚一枚<rt>いちまいいちまい</rt></ruby><ruby>漉<rt>す</rt></ruby>いていたため', '<ruby>外国<rt>がいこく</rt></ruby>からの<ruby>輸入品<rt>ゆにゅうひん</rt></ruby>だったため', '<ruby>法律<rt>ほうりつ</rt></ruby>で<ruby>使用<rt>しよう</rt></ruby>が<ruby>制限<rt>せいげん</rt></ruby>されていたため', '<ruby>原料<rt>げんりょう</rt></ruby>がなかったため'], correctIndex: 0 },
      { question: '2024<ruby>年<rt>ねん</rt></ruby>のNHK<ruby>大河<rt>たいが</rt></ruby>ドラマ「<ruby>光<rt>ひか</rt></ruby>る<ruby>君<rt>きみ</rt></ruby>へ」の<ruby>主人公<rt>しゅじんこう</rt></ruby>は？', choices: ['<ruby>紫式部<rt>むらさきしきぶ</rt></ruby>', '<ruby>光源氏<rt>ひかるげんじ</rt></ruby>', '<ruby>清少納言<rt>せいしょうなごん</rt></ruby>', '<ruby>藤原道長<rt>ふじわらのみちなが</rt></ruby>'], correctIndex: 0 },
    ],
  },

  // ================================================================
  // 🌍 マンデラ
  // ================================================================
  mandela: {
    beginner: [
      { question: 'ネルソン・マンデラはどこの<ruby>国<rt>くに</rt></ruby>の<ruby>指導者<rt>しどうしゃ</rt></ruby>？', choices: ['<ruby>南<rt>みなみ</rt></ruby>アフリカ', 'ケニア', 'エジプト', 'ナイジェリア'], correctIndex: 0 },
      { question: 'マンデラが<ruby>闘<rt>たたか</rt></ruby>った<ruby>制度<rt>せいど</rt></ruby>は？', choices: ['アパルトヘイト', '<ruby>植民地主義<rt>しょくみんちしゅぎ</rt></ruby>', '<ruby>奴隷制度<rt>どれいせいど</rt></ruby>', '<ruby>共産主義<rt>きょうさんしゅぎ</rt></ruby>'], correctIndex: 0 },
      { question: 'ロベン<ruby>島<rt>とう</rt></ruby>はどこにある？', choices: ['<ruby>南<rt>みなみ</rt></ruby>アフリカ', 'イギリス', 'オーストラリア', 'ブラジル'], correctIndex: 0 },
      { question: 'アフリカ<ruby>大陸<rt>たいりく</rt></ruby>の<ruby>最高峰<rt>さいこうほう</rt></ruby>は？', choices: ['キリマンジャロ', 'エベレスト', 'モンブラン', '<ruby>富士山<rt>ふじさん</rt></ruby>'], correctIndex: 0 },
      { question: '<ruby>百獣<rt>ひゃくじゅう</rt></ruby>の<ruby>王<rt>おう</rt></ruby>と<ruby>呼<rt>よ</rt></ruby>ばれる<ruby>動物<rt>どうぶつ</rt></ruby>は？', choices: ['ライオン', 'トラ', 'ゾウ', 'クマ'], correctIndex: 0 },
    ],
    challenger: [
      { question: 'マンデラがロベン<ruby>島<rt>とう</rt></ruby>に<ruby>投獄<rt>とうごく</rt></ruby>されていた<ruby>期間<rt>きかん</rt></ruby>は？', choices: ['27<ruby>年<rt>ねん</rt></ruby>', '10<ruby>年<rt>ねん</rt></ruby>', '5<ruby>年<rt>ねん</rt></ruby>', '50<ruby>年<rt>ねん</rt></ruby>'], correctIndex: 0 },
      { question: '<ruby>南<rt>みなみ</rt></ruby>アフリカが「<ruby>虹<rt>にじ</rt></ruby>の<ruby>国<rt>くに</rt></ruby>」と<ruby>呼<rt>よ</rt></ruby>ばれる<ruby>理由<rt>りゆう</rt></ruby>は？', choices: ['<ruby>多民族<rt>たみんぞく</rt></ruby>が<ruby>共存<rt>きょうぞん</rt></ruby>しているから', '<ruby>虹<rt>にじ</rt></ruby>がよく<ruby>出<rt>で</rt></ruby>るから', '<ruby>国旗<rt>こっき</rt></ruby>が<ruby>虹色<rt>にじいろ</rt></ruby>だから', '<ruby>名産品<rt>めいさんひん</rt></ruby>が<ruby>虹色<rt>にじいろ</rt></ruby>'], correctIndex: 0 },
      { question: '<ruby>自由憲章<rt>じゆうけんしょう</rt></ruby>が<ruby>採択<rt>さいたく</rt></ruby>された<ruby>年<rt>とし</rt></ruby>は？', choices: ['1955<ruby>年<rt>ねん</rt></ruby>', '1990<ruby>年<rt>ねん</rt></ruby>', '1948<ruby>年<rt>ねん</rt></ruby>', '1994<ruby>年<rt>ねん</rt></ruby>'], correctIndex: 0 },
      { question: 'アパルトヘイトとは<ruby>何語<rt>なにご</rt></ruby>で「<ruby>分離<rt>ぶんり</rt></ruby>」を<ruby>意味<rt>いみ</rt></ruby>する？', choices: ['アフリカーンス<ruby>語<rt>ご</rt></ruby>', '<ruby>英語<rt>えいご</rt></ruby>', 'フランス<ruby>語<rt>ご</rt></ruby>', 'スワヒリ<ruby>語<rt>ご</rt></ruby>'], correctIndex: 0 },
      { question: '<ruby>南<rt>みなみ</rt></ruby>アフリカの<ruby>公用語<rt>こうようご</rt></ruby>は<ruby>何語<rt>なんご</rt></ruby>ある？', choices: ['11<ruby>語<rt>ご</rt></ruby>', '2<ruby>語<rt>ご</rt></ruby>', '5<ruby>語<rt>ご</rt></ruby>', '1<ruby>語<rt>ご</rt></ruby>'], correctIndex: 0 },
    ],
    master: [
      { question: 'マンデラが<ruby>大統領<rt>だいとうりょう</rt></ruby>になった<ruby>年<rt>とし</rt></ruby>は？', choices: ['1994<ruby>年<rt>ねん</rt></ruby>', '1990<ruby>年<rt>ねん</rt></ruby>', '2000<ruby>年<rt>ねん</rt></ruby>', '1980<ruby>年<rt>ねん</rt></ruby>'], correctIndex: 0 },
      { question: 'マンデラと<ruby>共同<rt>きょうどう</rt></ruby>でノーベル<ruby>平和賞<rt>へいわしょう</rt></ruby>を<ruby>受賞<rt>じゅしょう</rt></ruby>したのは？', choices: ['デクラーク', 'オバマ', 'ガンジー', 'キング<ruby>牧師<rt>ぼくし</rt></ruby>'], correctIndex: 0 },
      { question: 'ロベン<ruby>島<rt>とう</rt></ruby>は<ruby>現在<rt>げんざい</rt></ruby><ruby>何<rt>なに</rt></ruby>になっている？', choices: ['<ruby>世界遺産<rt>せかいいさん</rt></ruby>の<ruby>博物館<rt>はくぶつかん</rt></ruby>', '<ruby>刑務所<rt>けいむしょ</rt></ruby>', '<ruby>軍事基地<rt>ぐんじきち</rt></ruby>', 'リゾート'], correctIndex: 0 },
      { question: '<ruby>自由憲章<rt>じゆうけんしょう</rt></ruby>の<ruby>主<rt>おも</rt></ruby>な<ruby>内容<rt>ないよう</rt></ruby>は？', choices: ['<ruby>全<rt>すべ</rt></ruby>ての<ruby>人種<rt>じんしゅ</rt></ruby>の<ruby>平等<rt>びょうどう</rt></ruby>', '<ruby>白人<rt>はくじん</rt></ruby>だけの<ruby>自由<rt>じゆう</rt></ruby>', '<ruby>経済発展<rt>けいざいはってん</rt></ruby>', '<ruby>軍事強化<rt>ぐんじきょうか</rt></ruby>'], correctIndex: 0 },
      { question: 'ノーベル<ruby>平和賞<rt>へいわしょう</rt></ruby>はどこの<ruby>国<rt>くに</rt></ruby>で<ruby>授賞式<rt>じゅしょうしき</rt></ruby>が<ruby>行<rt>おこな</rt></ruby>われる？', choices: ['ノルウェー', 'スウェーデン', 'アメリカ', 'イギリス'], correctIndex: 0 },
    ],
    legend: [
      { question: 'マンデラがノーベル<ruby>平和賞<rt>へいわしょう</rt></ruby>を<ruby>受賞<rt>じゅしょう</rt></ruby>した<ruby>年<rt>とし</rt></ruby>は？', choices: ['1993<ruby>年<rt>ねん</rt></ruby>', '2000<ruby>年<rt>ねん</rt></ruby>', '1990<ruby>年<rt>ねん</rt></ruby>', '1994<ruby>年<rt>ねん</rt></ruby>'], correctIndex: 0 },
      { question: 'アパルトヘイト<ruby>時代<rt>じだい</rt></ruby>に<ruby>黒人<rt>こくじん</rt></ruby>が<ruby>持<rt>も</rt></ruby>たされたパスとは？', choices: ['<ruby>身分証明書<rt>みぶんしょうめいしょ</rt></ruby>（<ruby>移動制限<rt>いどうせいげん</rt></ruby>のため）', 'バスの<ruby>乗車券<rt>じょうしゃけん</rt></ruby>', '<ruby>食料配給券<rt>しょくりょうはいきゅうけん</rt></ruby>', '<ruby>投票券<rt>とうひょうけん</rt></ruby>'], correctIndex: 0 },
      { question: 'マンデラの<ruby>自伝<rt>じでん</rt></ruby>のタイトルは？', choices: ['<ruby>自由<rt>じゆう</rt></ruby>への<ruby>長<rt>なが</rt></ruby>い<ruby>道<rt>みち</rt></ruby>', '<ruby>虹<rt>にじ</rt></ruby>の<ruby>向<rt>む</rt></ruby>こう', '<ruby>不屈<rt>ふくつ</rt></ruby>の<ruby>魂<rt>たましい</rt></ruby>', 'アフリカの<ruby>夜明<rt>よあ</rt></ruby>け'], correctIndex: 0 },
      { question: 'キリマンジャロの<ruby>山頂<rt>さんちょう</rt></ruby>にある<ruby>氷河<rt>ひょうが</rt></ruby>が<ruby>問題<rt>もんだい</rt></ruby>になっている<ruby>理由<rt>りゆう</rt></ruby>は？', choices: ['<ruby>地球温暖化<rt>ちきゅうおんだんか</rt></ruby>で<ruby>消<rt>き</rt></ruby>えつつある', '<ruby>噴火<rt>ふんか</rt></ruby>の<ruby>危険<rt>きけん</rt></ruby>', '<ruby>登山者<rt>とざんしゃ</rt></ruby>が<ruby>汚<rt>よご</rt></ruby>している', '<ruby>動物<rt>どうぶつ</rt></ruby>が<ruby>住<rt>す</rt></ruby>めなくなった'], correctIndex: 0 },
      { question: 'マンデラが<ruby>釈放<rt>しゃくほう</rt></ruby>された<ruby>年<rt>とし</rt></ruby>は？', choices: ['1990<ruby>年<rt>ねん</rt></ruby>', '1994<ruby>年<rt>ねん</rt></ruby>', '1985<ruby>年<rt>ねん</rt></ruby>', '2000<ruby>年<rt>ねん</rt></ruby>'], correctIndex: 0 },
    ],
  },

  // ================================================================
  // 🎨 ダ・ヴィンチ
  // ================================================================
  davinci: {
    beginner: [
      { question: 'レオナルド・ダ・ヴィンチは<ruby>何<rt>なに</rt></ruby><ruby>人<rt>じん</rt></ruby>？', choices: ['イタリア<ruby>人<rt>じん</rt></ruby>', 'フランス<ruby>人<rt>じん</rt></ruby>', 'スペイン<ruby>人<rt>じん</rt></ruby>', 'ドイツ<ruby>人<rt>じん</rt></ruby>'], correctIndex: 0 },
      { question: 'ダ・ヴィンチが<ruby>描<rt>か</rt></ruby>いた<ruby>有名<rt>ゆうめい</rt></ruby>な<ruby>女性<rt>じょせい</rt></ruby>の<ruby>絵<rt>え</rt></ruby>は？', choices: ['モナ・リザ', 'ひまわり', '<ruby>真珠<rt>しんじゅ</rt></ruby>の<ruby>耳飾<rt>みみかざ</rt></ruby>りの<ruby>少女<rt>しょうじょ</rt></ruby>', '<ruby>叫<rt>さけ</rt></ruby>び'], correctIndex: 0 },
      { question: 'ダ・ヴィンチが<ruby>活躍<rt>かつやく</rt></ruby>した<ruby>時代<rt>じだい</rt></ruby>は？', choices: ['ルネサンス', '<ruby>古代<rt>こだい</rt></ruby>', '<ruby>中世<rt>ちゅうせい</rt></ruby>', '<ruby>産業革命<rt>さんぎょうかくめい</rt></ruby>'], correctIndex: 0 },
      { question: 'モナ・リザは<ruby>現在<rt>げんざい</rt></ruby>どこに<ruby>展示<rt>てんじ</rt></ruby>されている？', choices: ['ルーヴル<ruby>美術館<rt>びじゅつかん</rt></ruby>', '<ruby>大英博物館<rt>だいえいはくぶつかん</rt></ruby>', 'メトロポリタン<ruby>美術館<rt>びじゅつかん</rt></ruby>', 'ウフィツィ<ruby>美術館<rt>びじゅつかん</rt></ruby>'], correctIndex: 0 },
      { question: 'ダ・ヴィンチが<ruby>描<rt>か</rt></ruby>いた<ruby>宗教画<rt>しゅうきょうが</rt></ruby>で<ruby>有名<rt>ゆうめい</rt></ruby>なのは？', choices: ['<ruby>最後<rt>さいご</rt></ruby>の<ruby>晩餐<rt>ばんさん</rt></ruby>', '<ruby>天地創造<rt>てんちそうぞう</rt></ruby>', '<ruby>最後<rt>さいご</rt></ruby>の<ruby>審判<rt>しんぱん</rt></ruby>', 'ピエタ'], correctIndex: 0 },
    ],
    challenger: [
      { question: 'ダ・ヴィンチが<ruby>設計<rt>せっけい</rt></ruby>した<ruby>空<rt>そら</rt></ruby>を<ruby>飛<rt>と</rt></ruby>ぶ<ruby>装置<rt>そうち</rt></ruby>は？', choices: ['<ruby>飛行機械<rt>ひこうきかい</rt></ruby>', '<ruby>気球<rt>ききゅう</rt></ruby>', 'ロケット', '<ruby>凧<rt>たこ</rt></ruby>'], correctIndex: 0 },
      { question: 'ウィトルウィウス<ruby>的<rt>てき</rt></ruby><ruby>人体図<rt>じんたいず</rt></ruby>に<ruby>描<rt>か</rt></ruby>かれているのは？', choices: ['<ruby>円<rt>えん</rt></ruby>と<ruby>正方形<rt>せいほうけい</rt></ruby>の<ruby>中<rt>なか</rt></ruby>の<ruby>人体<rt>じんたい</rt></ruby>', '<ruby>骨格<rt>こっかく</rt></ruby>のみ', '<ruby>顔<rt>かお</rt></ruby>だけ', '<ruby>動物<rt>どうぶつ</rt></ruby>と<ruby>人間<rt>にんげん</rt></ruby>'], correctIndex: 0 },
      { question: '<ruby>最後<rt>さいご</rt></ruby>の<ruby>晩餐<rt>ばんさん</rt></ruby>は<ruby>何人<rt>なんにん</rt></ruby>が<ruby>描<rt>か</rt></ruby>かれている？', choices: ['13<ruby>人<rt>にん</rt></ruby>', '10<ruby>人<rt>にん</rt></ruby>', '15<ruby>人<rt>にん</rt></ruby>', '12<ruby>人<rt>にん</rt></ruby>'], correctIndex: 0 },
      { question: 'ダ・ヴィンチが<ruby>研究<rt>けんきゅう</rt></ruby>した<ruby>分野<rt>ぶんや</rt></ruby>でないものは？', choices: ['<ruby>宇宙飛行<rt>うちゅうひこう</rt></ruby>', '<ruby>解剖学<rt>かいぼうがく</rt></ruby>', '<ruby>絵画<rt>かいが</rt></ruby>', '<ruby>建築<rt>けんちく</rt></ruby>'], correctIndex: 0 },
      { question: 'ダ・ヴィンチが<ruby>生<rt>う</rt></ruby>まれた<ruby>町<rt>まち</rt></ruby>の<ruby>名前<rt>なまえ</rt></ruby>は？', choices: ['ヴィンチ<ruby>村<rt>むら</rt></ruby>', 'フィレンツェ', 'ローマ', 'ミラノ'], correctIndex: 0 },
    ],
    master: [
      { question: 'ダ・ヴィンチが<ruby>絵画<rt>かいが</rt></ruby>で<ruby>用<rt>もち</rt></ruby>いた<ruby>ぼかし<rt>ぼかし</rt></ruby>の<ruby>技法<rt>ぎほう</rt></ruby>は？', choices: ['スフマート', 'キアロスクーロ', 'フレスコ', 'テンペラ'], correctIndex: 0 },
      { question: 'モナ・リザのモデルとされる<ruby>女性<rt>じょせい</rt></ruby>は？', choices: ['リザ・デル・ジョコンド', 'ベアトリーチェ', 'イザベラ・デステ', 'チェチリア・ガッレラーニ'], correctIndex: 0 },
      { question: 'ダ・ヴィンチが<ruby>残<rt>のこ</rt></ruby>した<ruby>手稿<rt>しゅこう</rt></ruby>の<ruby>特徴<rt>とくちょう</rt></ruby>は？', choices: ['<ruby>鏡文字<rt>かがみもじ</rt></ruby>で<ruby>書<rt>か</rt></ruby>かれている', '<ruby>全<rt>すべ</rt></ruby>てラテン<ruby>語<rt>ご</rt></ruby>', '<ruby>暗号<rt>あんごう</rt></ruby>で<ruby>書<rt>か</rt></ruby>かれている', '<ruby>絵<rt>え</rt></ruby>がない'], correctIndex: 0 },
      { question: 'ダ・ヴィンチが<ruby>仕<rt>つか</rt></ruby>えた<ruby>最後<rt>さいご</rt></ruby>の<ruby>王<rt>おう</rt></ruby>は？', choices: ['フランソワ1<ruby>世<rt>せい</rt></ruby>', 'ルイ14<ruby>世<rt>せい</rt></ruby>', 'カール5<ruby>世<rt>せい</rt></ruby>', 'ヘンリー8<ruby>世<rt>せい</rt></ruby>'], correctIndex: 0 },
      { question: '<ruby>最後<rt>さいご</rt></ruby>の<ruby>晩餐<rt>ばんさん</rt></ruby>が<ruby>描<rt>か</rt></ruby>かれた<ruby>場所<rt>ばしょ</rt></ruby>は？', choices: ['サンタ・マリア・デッレ・グラツィエ<ruby>教会<rt>きょうかい</rt></ruby>', 'サン・ピエトロ<ruby>大聖堂<rt>だいせいどう</rt></ruby>', 'ドゥオモ', 'システィーナ<ruby>礼拝堂<rt>れいはいどう</rt></ruby>'], correctIndex: 0 },
    ],
    legend: [
      { question: 'ダ・ヴィンチが<ruby>構想<rt>こうそう</rt></ruby>していた<ruby>発明<rt>はつめい</rt></ruby>でないものは？', choices: ['<ruby>蒸気機関車<rt>じょうききかんしゃ</rt></ruby>', 'ヘリコプター', '<ruby>戦車<rt>せんしゃ</rt></ruby>', 'パラシュート'], correctIndex: 0 },
      { question: 'モナ・リザが<ruby>盗難<rt>とうなん</rt></ruby>された<ruby>年<rt>とし</rt></ruby>は？', choices: ['1911<ruby>年<rt>ねん</rt></ruby>', '1800<ruby>年<rt>ねん</rt></ruby>', '1950<ruby>年<rt>ねん</rt></ruby>', '1870<ruby>年<rt>ねん</rt></ruby>'], correctIndex: 0 },
      { question: 'ウィトルウィウス<ruby>的<rt>てき</rt></ruby><ruby>人体図<rt>じんたいず</rt></ruby>の<ruby>元<rt>もと</rt></ruby>になった<ruby>建築家<rt>けんちくか</rt></ruby>は？', choices: ['<ruby>古代<rt>こだい</rt></ruby>ローマのウィトルウィウス', 'ブルネレスキ', 'パラディオ', 'ブラマンテ'], correctIndex: 0 },
      { question: 'ダ・ヴィンチが<ruby>最後<rt>さいご</rt></ruby>の<ruby>晩餐<rt>ばんさん</rt></ruby>で<ruby>使<rt>つか</rt></ruby>った<ruby>技法<rt>ぎほう</rt></ruby>の<ruby>問題点<rt>もんだいてん</rt></ruby>は？', choices: ['<ruby>壁<rt>かべ</rt></ruby>に<ruby>直接<rt>ちょくせつ</rt></ruby><ruby>描<rt>か</rt></ruby>いたため<ruby>劣化<rt>れっか</rt></ruby>が<ruby>早<rt>はや</rt></ruby>かった', '<ruby>色<rt>いろ</rt></ruby>が<ruby>少<rt>すく</rt></ruby>なかった', '<ruby>小<rt>ちい</rt></ruby>さすぎた', '<ruby>未完成<rt>みかんせい</rt></ruby>だった'], correctIndex: 0 },
      { question: 'ダ・ヴィンチが<ruby>亡<rt>な</rt></ruby>くなった<ruby>国<rt>くに</rt></ruby>は？', choices: ['フランス', 'イタリア', 'スペイン', 'イギリス'], correctIndex: 0 },
    ],
  },
};
