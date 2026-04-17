/**
 * 四字熟語クイズ用のデータ。
 * difficulty: 1=超有名 / 2=有名 / 3=やや難 / 4=難 / 5=非常に難しい
 */
export interface YojijukugoQuestion {
  full: string;         // 完全な四字熟語
  display: string;      // □入り表示（例: '一□二鳥'）
  answer: string;       // 正解の漢字1文字
  distractors: string[]; // 不正解の漢字3つ
  meaning: string;      // 意味
  difficulty: 1 | 2 | 3 | 4 | 5;
}

export const YOJIJUKUGO_DATA: YojijukugoQuestion[] = [
  // ===== ★1（超有名）20問 =====
  { full: '一石二鳥', display: '一□二鳥', answer: '石', distractors: ['木', '山', '水'], meaning: 'ひとつのことで二つの利益を得ること', difficulty: 1 },
  { full: '十人十色', display: '十人十□', answer: '色', distractors: ['声', '力', '顔'], meaning: '人それぞれ好みや考えが違うこと', difficulty: 1 },
  { full: '一生懸命', display: '一生□命', answer: '懸', distractors: ['賢', '険', '権'], meaning: 'ものすごくがんばること', difficulty: 1 },
  { full: '以心伝心', display: '以□伝心', answer: '心', distractors: ['身', '神', '真'], meaning: '言葉を使わなくても気持ちが通じ合うこと', difficulty: 1 },
  { full: '弱肉強食', display: '弱肉□食', answer: '強', distractors: ['共', '凶', '狂'], meaning: '強い者が弱い者を食い物にすること', difficulty: 1 },
  { full: '自業自得', display: '自□自得', answer: '業', distractors: ['行', '合', '楽'], meaning: '自分のしたことの報いを自分で受けること', difficulty: 1 },
  { full: '百発百中', display: '百□百中', answer: '発', distractors: ['点', '的', '弾'], meaning: 'すべて命中すること、予想がすべて当たること', difficulty: 1 },
  { full: '一日千秋', display: '一日□秋', answer: '千', distractors: ['万', '百', '十'], meaning: '待ち遠しくてたまらないこと', difficulty: 1 },
  { full: '花鳥風月', display: '花鳥□月', answer: '風', distractors: ['雨', '雪', '雲'], meaning: '自然の美しい風景のこと', difficulty: 1 },
  { full: '天下無双', display: '天下無□', answer: '双', distractors: ['敵', '類', '比'], meaning: '世の中に並ぶものがないほどすぐれていること', difficulty: 1 },
  { full: '四苦八苦', display: '四□八苦', answer: '苦', distractors: ['区', '句', '九'], meaning: 'いろいろと苦しみ悩むこと', difficulty: 1 },
  { full: '大器晩成', display: '大□晩成', answer: '器', distractors: ['気', '機', '期'], meaning: '大人物は遅れて成功するということ', difficulty: 1 },
  { full: '三寒四温', display: '三寒□温', answer: '四', distractors: ['五', '二', '数'], meaning: '寒い日と暖かい日が交互に来ること', difficulty: 1 },
  { full: '一期一会', display: '一期一□', answer: '会', distractors: ['回', '界', '開'], meaning: '一生に一度の出会いを大切にすること', difficulty: 1 },
  { full: '七転八倒', display: '七転□倒', answer: '八', distractors: ['九', '十', '倒'], meaning: '苦しんでもがき回ること', difficulty: 1 },
  { full: '一心同体', display: '一心□体', answer: '同', distractors: ['道', '動', '働'], meaning: '心も体もひとつになること', difficulty: 1 },
  { full: '千差万別', display: '千差□別', answer: '万', distractors: ['千', '百', '十'], meaning: 'ひとつひとつ違いがあり様々なこと', difficulty: 1 },
  { full: '一長一短', display: '一長□短', answer: '一', distractors: ['二', '三', '長'], meaning: '良いところと悪いところの両方があること', difficulty: 1 },
  { full: '心機一転', display: '心機□転', answer: '一', distractors: ['二', '新', '再'], meaning: '気持ちをすっかり切り替えること', difficulty: 1 },
  { full: '二人三脚', display: '二人□脚', answer: '三', distractors: ['四', '両', '双'], meaning: '二人が協力して物事を進めること', difficulty: 1 },

  // ===== ★2（有名）20問 =====
  { full: '起死回生', display: '起□回生', answer: '死', distractors: ['始', '使', '士'], meaning: '絶望的な状況から立ち直ること', difficulty: 2 },
  { full: '温故知新', display: '□故知新', answer: '温', distractors: ['恩', '音', '穏'], meaning: '古いことを学んで新しい知識を得ること', difficulty: 2 },
  { full: '切磋琢磨', display: '切磋□磨', answer: '琢', distractors: ['拓', '卓', '託'], meaning: '互いに励まし合い向上すること', difficulty: 2 },
  { full: '前代未聞', display: '前代□聞', answer: '未', distractors: ['味', '実', '美'], meaning: '今までに聞いたことがないほど珍しいこと', difficulty: 2 },
  { full: '試行錯誤', display: '試行□誤', answer: '錯', distractors: ['作', '策', '削'], meaning: '失敗を繰り返しながら解決策を見つけること', difficulty: 2 },
  { full: '危機一髪', display: '危機一□', answer: '髪', distractors: ['発', '抜', '髷'], meaning: '一歩間違えば大変なことになる状況', difficulty: 2 },
  { full: '有言実行', display: '有言□行', answer: '実', distractors: ['失', '室', '質'], meaning: '言ったことを必ず実行すること', difficulty: 2 },
  { full: '臥薪嘗胆', display: '臥薪□胆', answer: '嘗', distractors: ['賞', '償', '常'], meaning: '目的のために苦労に耐えること', difficulty: 2 },
  { full: '付和雷同', display: '付和□同', answer: '雷', distractors: ['頼', '来', '礼'], meaning: '自分の考えなく他人の意見に同調すること', difficulty: 2 },
  { full: '一石二鳥', display: '□石二鳥', answer: '一', distractors: ['二', '三', '単'], meaning: 'ひとつのことで二つの利益を得ること', difficulty: 2 },
  { full: '単刀直入', display: '単刀□入', answer: '直', distractors: ['置', '値', '着'], meaning: '前置きなしに本題へ入ること', difficulty: 2 },
  { full: '一騎当千', display: '一騎□千', answer: '当', distractors: ['統', '踏', '投'], meaning: 'ひとりで千人を相手にできるほど強いこと', difficulty: 2 },
  { full: '諸行無常', display: '諸行□常', answer: '無', distractors: ['非', '不', '未'], meaning: 'すべてのものは移り変わるということ', difficulty: 2 },
  { full: '異口同音', display: '異口□音', answer: '同', distractors: ['導', '堂', '童'], meaning: '多くの人が同じことを言うこと', difficulty: 2 },
  { full: '一進一退', display: '一進□退', answer: '一', distractors: ['二', '三', '進'], meaning: '進んだり戻ったりすること', difficulty: 2 },
  { full: '自画自賛', display: '自画□賛', answer: '自', distractors: ['他', '相', '共'], meaning: '自分で自分をほめること', difficulty: 2 },
  { full: '公明正大', display: '公明□大', answer: '正', distractors: ['整', '政', '清'], meaning: '公平で正しく堂々としていること', difficulty: 2 },
  { full: '適材適所', display: '適材□所', answer: '適', distractors: ['敵', '的', '滴'], meaning: '人の能力にあった仕事を与えること', difficulty: 2 },
  { full: '意気投合', display: '意気□合', answer: '投', distractors: ['統', '当', '踏'], meaning: '互いの気持ちがぴったり合うこと', difficulty: 2 },
  { full: '取捨選択', display: '取□選択', answer: '捨', distractors: ['者', '社', '舎'], meaning: '必要なものを取り不要なものを捨てること', difficulty: 2 },

  // ===== ★3（やや難）20問 =====
  { full: '臨機応変', display: '臨機□変', answer: '応', distractors: ['王', '横', '央'], meaning: '場に応じて柔軟に対応すること', difficulty: 3 },
  { full: '独立独歩', display: '独立□歩', answer: '独', distractors: ['毒', '読', '特'], meaning: '他に頼らず自分の力で進むこと', difficulty: 3 },
  { full: '針小棒大', display: '針小□大', answer: '棒', distractors: ['暴', '防', '望'], meaning: '小さなことを大げさに言うこと', difficulty: 3 },
  { full: '朝令暮改', display: '朝□暮改', answer: '令', distractors: ['礼', '例', '冷'], meaning: '命令がころころ変わること', difficulty: 3 },
  { full: '一刀両断', display: '一刀□断', answer: '両', distractors: ['料', '量', '漁'], meaning: '思い切って決断すること', difficulty: 3 },
  { full: '大同小異', display: '大同□異', answer: '小', distractors: ['少', '紹', '笑'], meaning: '細かい違いはあるが大体同じこと', difficulty: 3 },
  { full: '五里霧中', display: '五里□中', answer: '霧', distractors: ['夢', '無', '武'], meaning: '物事の判断がつかないこと', difficulty: 3 },
  { full: '疑心暗鬼', display: '疑心□鬼', answer: '暗', distractors: ['安', '案', '闇'], meaning: '疑いの心があると何でも怪しく見えること', difficulty: 3 },
  { full: '縦横無尽', display: '縦横□尽', answer: '無', distractors: ['不', '非', '未'], meaning: '自由自在に活動すること', difficulty: 3 },
  { full: '難攻不落', display: '難攻□落', answer: '不', distractors: ['無', '非', '未'], meaning: '攻め落とすのが難しいこと', difficulty: 3 },
  { full: '奇想天外', display: '奇想□外', answer: '天', distractors: ['点', '典', '伝'], meaning: '普通では考えつかないほど変わったこと', difficulty: 3 },
  { full: '起承転結', display: '起承□結', answer: '転', distractors: ['展', '点', '典'], meaning: '物事の順序や組み立て', difficulty: 3 },
  { full: '無病息災', display: '無病□災', answer: '息', distractors: ['意', '異', '移'], meaning: '病気や災いがなく健康なこと', difficulty: 3 },
  { full: '首尾一貫', display: '首尾一□', answer: '貫', distractors: ['感', '関', '完'], meaning: '最初から最後まで筋が通っていること', difficulty: 3 },
  { full: '言語道断', display: '言語□断', answer: '道', distractors: ['導', '堂', '道'], meaning: 'もってのほか、あきれてものが言えないこと', difficulty: 3 },
  { full: '我田引水', display: '我田□水', answer: '引', distractors: ['飲', '陰', '因'], meaning: '自分に都合のいいように振る舞うこと', difficulty: 3 },
  { full: '美辞麗句', display: '美辞□句', answer: '麗', distractors: ['励', '礼', '例'], meaning: 'うわべを飾った美しい言葉', difficulty: 3 },
  { full: '本末転倒', display: '本末□倒', answer: '転', distractors: ['展', '典', '点'], meaning: '大事なことと小さなことを取り違えること', difficulty: 3 },
  { full: '日進月歩', display: '日進□歩', answer: '月', distractors: ['年', '週', '日'], meaning: '絶えず進歩し続けること', difficulty: 3 },
  { full: '無我夢中', display: '無我□中', answer: '夢', distractors: ['霧', '無', '謀'], meaning: 'ある事に熱中して我を忘れること', difficulty: 3 },

  // ===== ★4（難）20問 =====
  { full: '呉越同舟', display: '呉□同舟', answer: '越', distractors: ['悦', '閲', '謁'], meaning: '敵同士が同じ場所にいること', difficulty: 4 },
  { full: '画竜点睛', display: '画竜点□', answer: '睛', distractors: ['晴', '精', '清'], meaning: '最後の仕上げを加えて完成させること', difficulty: 4 },
  { full: '堅忍不抜', display: '堅忍□抜', answer: '不', distractors: ['無', '非', '未'], meaning: 'どんなことにも耐え忍ぶこと', difficulty: 4 },
  { full: '泰然自若', display: '泰然□若', answer: '自', distractors: ['事', '似', '慈'], meaning: '落ち着いて動じないこと', difficulty: 4 },
  { full: '傍若無人', display: '傍若□人', answer: '無', distractors: ['不', '非', '未'], meaning: '他人に構わず勝手気ままに振る舞うこと', difficulty: 4 },
  { full: '巧言令色', display: '巧言□色', answer: '令', distractors: ['礼', '例', '冷'], meaning: 'うまい言葉と愛想のいい顔で人をごまかすこと', difficulty: 4 },
  { full: '空前絶後', display: '空前□後', answer: '絶', distractors: ['切', '節', '設'], meaning: '今までにもこれからもないほど珍しいこと', difficulty: 4 },
  { full: '栄枯盛衰', display: '栄枯□衰', answer: '盛', distractors: ['成', '省', '整'], meaning: '栄えることと衰えることの繰り返し', difficulty: 4 },
  { full: '狂喜乱舞', display: '狂喜□舞', answer: '乱', distractors: ['卵', '欄', '蘭'], meaning: 'この上なく喜んで踊り回ること', difficulty: 4 },
  { full: '沈思黙考', display: '沈思□考', answer: '黙', distractors: ['墨', '穆', '目'], meaning: '静かに深く考え込むこと', difficulty: 4 },
  { full: '森羅万象', display: '森羅□象', answer: '万', distractors: ['千', '方', '放'], meaning: '宇宙に存在する全てのもの', difficulty: 4 },
  { full: '大言壮語', display: '大言□語', answer: '壮', distractors: ['装', '奏', '送'], meaning: '自分の実力以上に大きなことを言うこと', difficulty: 4 },
  { full: '風林火山', display: '風林□山', answer: '火', distractors: ['化', '花', '華'], meaning: '状況によって戦い方を変えること', difficulty: 4 },
  { full: '勧善懲悪', display: '勧善□悪', answer: '懲', distractors: ['徴', '聴', '澄'], meaning: '善を勧め悪を懲らしめること', difficulty: 4 },
  { full: '言行一致', display: '言行一□', answer: '致', distractors: ['知', '恥', '痴'], meaning: '言ったことと行いが同じであること', difficulty: 4 },
  { full: '傍目八目', display: '傍目□目', answer: '八', distractors: ['発', '抜', '伐'], meaning: '傍から見ている方がよく分かること', difficulty: 4 },
  { full: '粉骨砕身', display: '粉骨□身', answer: '砕', distractors: ['最', '細', '祭'], meaning: '身を粉にして一生懸命働くこと', difficulty: 4 },
  { full: '千載一遇', display: '千載一□', answer: '遇', distractors: ['偶', '隅', '愚'], meaning: '千年に一度のめったにない機会', difficulty: 4 },
  { full: '八方美人', display: '八方□人', answer: '美', distractors: ['尾', '備', '眉'], meaning: 'だれにも良い顔をする人', difficulty: 4 },
  { full: '流言飛語', display: '流言□語', answer: '飛', distractors: ['非', '比', '避'], meaning: '根拠のないうわさ', difficulty: 4 },

  // ===== ★5（非常に難）20問 =====
  { full: '羊頭狗肉', display: '羊頭□肉', answer: '狗', distractors: ['犬', '牛', '狐'], meaning: '見かけと中身が違うこと', difficulty: 5 },
  { full: '蛙鳴蝉噪', display: '蛙鳴蝉□', answer: '噪', distractors: ['騒', '燥', '操'], meaning: 'うるさいだけで中身のない議論のこと', difficulty: 5 },
  { full: '魑魅魍魎', display: '魑魅□魎', answer: '魍', distractors: ['罔', '網', '亡'], meaning: '様々な化け物、悪い人々のこと', difficulty: 5 },
  { full: '傍若無人', display: '□若無人', answer: '傍', distractors: ['旁', '彷', '坊'], meaning: '他人に構わず勝手気ままに振る舞うこと', difficulty: 5 },
  { full: '曖昧模糊', display: '曖昧□糊', answer: '模', distractors: ['墓', '模', '摸'], meaning: 'はっきりせずぼんやりしていること', difficulty: 5 },
  { full: '朝三暮四', display: '朝□暮四', answer: '三', distractors: ['二', '四', '参'], meaning: '目先の違いにとらわれて結果が同じだと気付かないこと', difficulty: 5 },
  { full: '天衣無縫', display: '天衣□縫', answer: '無', distractors: ['無', '不', '非'], meaning: '自然で飾り気がなく美しいこと', difficulty: 5 },
  { full: '傲岸不遜', display: '傲岸□遜', answer: '不', distractors: ['無', '非', '未'], meaning: 'おごり高ぶって人を見下す態度', difficulty: 5 },
  { full: '捲土重来', display: '捲土□来', answer: '重', distractors: ['従', '縦', '銃'], meaning: '一度負けた者が再び勢いを盛り返すこと', difficulty: 5 },
  { full: '唯我独尊', display: '唯我□尊', answer: '独', distractors: ['読', '毒', '督'], meaning: '自分だけが優れていると思い込むこと', difficulty: 5 },
  { full: '夜郎自大', display: '夜郎□大', answer: '自', distractors: ['事', '時', '似'], meaning: '実力もないのに威張ること', difficulty: 5 },
  { full: '狐疑逡巡', display: '狐疑□巡', answer: '逡', distractors: ['峻', '駿', '巡'], meaning: '疑ってためらうこと', difficulty: 5 },
  { full: '酒池肉林', display: '酒□肉林', answer: '池', distractors: ['地', '知', '治'], meaning: '非常にぜいたくな酒宴のこと', difficulty: 5 },
  { full: '不倶戴天', display: '不俱□天', answer: '戴', distractors: ['代', '台', '態'], meaning: '同じ空の下に生かしておけない憎しみ', difficulty: 5 },
  { full: '跳梁跋扈', display: '跳梁□扈', answer: '跋', distractors: ['抜', '髪', '伐'], meaning: '悪人などが勝手気ままに振る舞うこと', difficulty: 5 },
  { full: '乾坤一擲', display: '乾坤一□', answer: '擲', distractors: ['敵', '滴', '摘'], meaning: '運命をかけて勝負に出ること', difficulty: 5 },
  { full: '呵呵大笑', display: '呵呵□笑', answer: '大', distractors: ['太', '代', '対'], meaning: '大声で笑うこと', difficulty: 5 },
  { full: '韋編三絶', display: '韋編□絶', answer: '三', distractors: ['参', '山', '散'], meaning: '何度も繰り返し本を読むこと', difficulty: 5 },
  { full: '天真爛漫', display: '天真□漫', answer: '爛', distractors: ['欄', '蘭', '卵'], meaning: '飾り気がなく無邪気なこと', difficulty: 5 },
  { full: '傲慢無礼', display: '傲慢□礼', answer: '無', distractors: ['不', '非', '未'], meaning: 'おごり高ぶって失礼なこと', difficulty: 5 },
];

export function getYojijukugoByDifficulty(diff: 1 | 2 | 3 | 4 | 5): YojijukugoQuestion[] {
  return YOJIJUKUGO_DATA.filter((q) => q.difficulty === diff);
}
