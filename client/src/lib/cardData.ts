import type { CollectionCard } from './types';

// 50枚のカードコレクションデータ
// 各カードに個別イラストを設定済み
export const COLLECTION_CARDS: CollectionCard[] = [
  // ===== 偉人 (15枚) =====
  { id: 'card-001', name: 'ダ・ヴィンチ', category: 'great_people', rarity: 'SR', description: '万能の天才。芸術家にして科学者、発明家。モナ・リザや最後の晩餐を描いた。', imageUrl: '/images/cards/da-vinci.png' },
  { id: 'card-002', name: 'アインシュタイン', category: 'great_people', rarity: 'SR', description: '相対性理論を発表した天才物理学者。ノーベル物理学賞を受賞。', imageUrl: '/images/cards/einstein.png' },
  { id: 'card-003', name: 'キュリー夫人', category: 'great_people', rarity: 'SR', description: '放射能の研究でノーベル賞を2度受賞した科学者。', imageUrl: '/images/cards/marie-curie.png' },
  { id: 'card-004', name: 'ナポレオン', category: 'great_people', rarity: 'R', description: 'フランスの皇帝。ヨーロッパ中を征服した軍事の天才。', imageUrl: '/images/cards/napoleon.png' },
  { id: 'card-005', name: 'クレオパトラ', category: 'great_people', rarity: 'R', description: '古代エジプト最後の女王。知恵と美貌で国を守った。', imageUrl: '/images/cards/cleopatra.png' },
  { id: 'card-006', name: '織田信長', category: 'great_people', rarity: 'R', description: '戦国時代の革命児。天下統一を目指した武将。', imageUrl: '/images/cards/oda-nobunaga.png' },
  { id: 'card-007', name: '坂本龍馬', category: 'great_people', rarity: 'R', description: '幕末の志士。薩長同盟を仲介し、明治維新の立役者となった。', imageUrl: '/images/cards/card-007.webp' },
  { id: 'card-008', name: 'エジソン', category: 'great_people', rarity: 'R', description: '発明王。電球や蓄音機など1000以上の発明をした。', imageUrl: '/images/cards/edison.png' },
  { id: 'card-009', name: 'ニュートン', category: 'great_people', rarity: 'SR', description: '万有引力の法則を発見した物理学者・数学者。', imageUrl: '/images/cards/newton.png' },
  { id: 'card-010', name: 'ガリレオ', category: 'great_people', rarity: 'R', description: '天文学の父。望遠鏡で天体を観測し、地動説を支持した。', imageUrl: '/images/cards/galileo.png' },
  { id: 'card-011', name: 'モーツァルト', category: 'great_people', rarity: 'N', description: '神童と呼ばれた作曲家。5歳で作曲を始めた音楽の天才。', imageUrl: '/images/cards/mozart.png' },
  { id: 'card-012', name: 'シェイクスピア', category: 'great_people', rarity: 'N', description: 'イギリスの劇作家。ロミオとジュリエットなど名作を残した。', imageUrl: '/images/cards/card-012.webp' },
  { id: 'card-013', name: '野口英世', category: 'great_people', rarity: 'N', description: '細菌学者。黄熱病の研究に生涯を捧げた。千円札の肖像。', imageUrl: '/images/cards/noguchi.png' },
  { id: 'card-014', name: '北里柴三郎', category: 'great_people', rarity: 'N', description: '近代日本医学の父。破傷風の治療法を開発した。', imageUrl: '/images/cards/kitasato.png' },
  { id: 'card-015', name: '伊能忠敬', category: 'great_people', rarity: 'N', description: '日本全国を歩いて測量し、精密な日本地図を作った。', imageUrl: '/images/cards/card-015.webp' },

  // ===== 生き物 (10枚) =====
  { id: 'card-016', name: 'ティラノサウルス', category: 'creatures', rarity: 'SR', description: '白亜紀最強の肉食恐竜。体長12メートル以上の巨体。', imageUrl: '/images/cards/card-016.webp' },
  { id: 'card-017', name: 'マンモス', category: 'creatures', rarity: 'R', description: '氷河期に生きた巨大な象。長い牙と毛が特徴。', imageUrl: '/images/cards/card-017.webp' },
  { id: 'card-018', name: 'シロナガスクジラ', category: 'creatures', rarity: 'R', description: '地球上最大の動物。体長30メートルにもなる海の王者。', imageUrl: '/images/cards/card-018.webp' },
  { id: 'card-019', name: 'アフリカゾウ', category: 'creatures', rarity: 'N', description: '陸上最大の動物。大きな耳と長い鼻が特徴。', imageUrl: '/images/cards/card-019.webp' },
  { id: 'card-020', name: 'ジャイアントパンダ', category: 'creatures', rarity: 'N', description: '中国に住む白黒模様のクマ。竹を食べる。', imageUrl: '/images/cards/card-020.webp' },
  { id: 'card-021', name: 'コモドドラゴン', category: 'creatures', rarity: 'N', description: '世界最大のトカゲ。インドネシアの島に生息する。', imageUrl: '/images/cards/card-021.webp' },
  { id: 'card-022', name: 'ミツバチ', category: 'creatures', rarity: 'N', description: '花粉を運ぶ大切な虫。はちみつを作る働き者。', imageUrl: '/images/cards/card-022.webp' },
  { id: 'card-023', name: 'ダーウィンフィンチ', category: 'creatures', rarity: 'R', description: 'ガラパゴス諸島の鳥。進化論のヒントになった。', imageUrl: '/images/cards/card-023.webp' },
  { id: 'card-024', name: 'シーラカンス', category: 'creatures', rarity: 'SR', description: '生きた化石。4億年前から姿が変わっていない深海魚。', imageUrl: '/images/cards/card-024.webp' },
  { id: 'card-025', name: 'ピラニア', category: 'creatures', rarity: 'N', description: 'アマゾン川に住む肉食魚。鋭い歯を持つ。', imageUrl: '/images/cards/piranha.png' },

  // ===== 世界遺産 (10枚) =====
  { id: 'card-026', name: '万里の長城', category: 'world_heritage', rarity: 'SR', description: '中国の巨大な防壁。全長2万キロ以上。宇宙からも見える。', imageUrl: '/images/cards/great-wall.png' },
  { id: 'card-027', name: 'ピラミッド', category: 'world_heritage', rarity: 'SR', description: 'エジプトの巨大建造物。ファラオの墓として4500年前に建てられた。', imageUrl: '/images/cards/pyramid.png' },
  { id: 'card-028', name: 'コロッセオ', category: 'world_heritage', rarity: 'R', description: '古代ローマの円形闘技場。5万人を収容できた。', imageUrl: '/images/cards/colosseum.png' },
  { id: 'card-029', name: 'タージ・マハル', category: 'world_heritage', rarity: 'R', description: 'インドの白い大理石の霊廟。愛の象徴として有名。', imageUrl: '/images/cards/taj-mahal.png' },
  { id: 'card-030', name: 'アンコールワット', category: 'world_heritage', rarity: 'R', description: 'カンボジアの巨大寺院。世界最大の宗教建築物。', imageUrl: '/images/cards/angkor-wat.png' },
  { id: 'card-031', name: '屋久島', category: 'world_heritage', rarity: 'N', description: '鹿児島県の島。樹齢7000年の縄文杉がある自然遺産。', imageUrl: '/images/cards/card-031.webp' },
  { id: 'card-032', name: '富士山', category: 'world_heritage', rarity: 'N', description: '日本一高い山。標高3776メートル。文化遺産に登録。', imageUrl: '/images/cards/card-032.webp' },
  { id: 'card-033', name: 'マチュ・ピチュ', category: 'world_heritage', rarity: 'SR', description: 'ペルーの空中都市。インカ帝国の遺跡。標高2400メートル。', imageUrl: '/images/cards/machu-picchu.png' },
  { id: 'card-034', name: 'ストーンヘンジ', category: 'world_heritage', rarity: 'R', description: 'イギリスの巨石遺跡。5000年前に作られた謎の石の環。', imageUrl: '/images/cards/card-034.webp' },
  { id: 'card-035', name: '法隆寺', category: 'world_heritage', rarity: 'N', description: '奈良県の寺院。世界最古の木造建築物。聖徳太子が建立。', imageUrl: '/images/cards/card-035.webp' },

  // ===== 発明 (10枚) =====
  { id: 'card-036', name: '電球', category: 'inventions', rarity: 'N', description: 'エジソンが実用化した照明器具。世界を明るくした。', imageUrl: '/images/cards/lightbulb.png' },
  { id: 'card-037', name: '蒸気機関', category: 'inventions', rarity: 'N', description: '産業革命を起こした動力源。工場や鉄道を動かした。', imageUrl: '/images/cards/steam-engine.png' },
  { id: 'card-038', name: '印刷機', category: 'inventions', rarity: 'R', description: 'グーテンベルクが発明した活版印刷。知識の普及に貢献。', imageUrl: '/images/cards/card-038.webp' },
  { id: 'card-039', name: '飛行機', category: 'inventions', rarity: 'SR', description: 'ライト兄弟が初飛行に成功。人類の空への夢を実現した。', imageUrl: '/images/cards/card-039.webp' },
  { id: 'card-040', name: 'インターネット', category: 'inventions', rarity: 'SR', description: '世界中のコンピュータをつなぐ通信網。情報革命を起こした。', imageUrl: '/images/cards/internet.png' },
  { id: 'card-041', name: '電話', category: 'inventions', rarity: 'N', description: 'ベルが発明した通信機器。遠くの人と話せるようになった。', imageUrl: '/images/cards/telephone.png' },
  { id: 'card-042', name: '望遠鏡', category: 'inventions', rarity: 'N', description: '遠くのものを見る光学機器。天文学の発展に貢献した。', imageUrl: '/images/cards/telescope.png' },
  { id: 'card-043', name: 'ペニシリン', category: 'inventions', rarity: 'R', description: 'フレミングが発見した抗生物質。多くの命を救った。', imageUrl: '/images/cards/penicillin.png' },
  { id: 'card-044', name: '羅針盤', category: 'inventions', rarity: 'N', description: '方角を知るための道具。大航海時代を支えた。', imageUrl: '/images/cards/compass.png' },
  { id: 'card-045', name: '火薬', category: 'inventions', rarity: 'N', description: '中国で発明された爆発物。花火や採掘にも使われる。', imageUrl: '/images/cards/gunpowder.png' },

  // ===== 探究 (5枚) =====
  { id: 'card-046', name: '宇宙の誕生', category: 'discovery', rarity: 'SSR', description: '138億年前のビッグバン。宇宙のはじまりの瞬間。', imageUrl: '/images/cards/card-046.webp' },
  { id: 'card-047', name: 'DNAの二重らせん', category: 'discovery', rarity: 'SR', description: '生命の設計図。ワトソンとクリックが構造を解明した。', imageUrl: '/images/cards/card-047.webp' },
  { id: 'card-048', name: '元素周期表', category: 'discovery', rarity: 'R', description: 'メンデレーエフが作った元素の表。化学の基礎。', imageUrl: '/images/cards/card-048.webp' },
  { id: 'card-049', name: '地動説', category: 'discovery', rarity: 'R', description: 'コペルニクスが唱えた説。地球が太陽の周りを回る。', imageUrl: '/images/cards/heliocentric.png' },
  { id: 'card-050', name: '進化論', category: 'discovery', rarity: 'SR', description: 'ダーウィンが唱えた理論。生物は環境に適応して変化する。', imageUrl: '/images/cards/card-050.webp' },

  // ===== 追加50枚 (偉人15+生き物10+世界遺産10+発明10+探究5) =====
  { id: 'card-051', name: 'ゴッホ', category: 'great_people', rarity: 'SR', description: '後期印象派の画家。星月夜やひまわりなど情熱的な作品を残した。', imageUrl: '/images/cards/gogh.png' },
  { id: 'card-052', name: 'ピカソ', category: 'great_people', rarity: 'SR', description: 'キュビズムの創始者。ゲルニカなど革新的な作品で美術史を変えた。', imageUrl: '/images/cards/card-052.webp' },
  { id: 'card-053', name: 'ベートーヴェン', category: 'great_people', rarity: 'SR', description: '聴覚を失いながらも交響曲第九番など不朽の名作を作曲した。', imageUrl: '/images/cards/card-053.webp' },
  { id: 'card-054', name: 'マリー・アントワネット', category: 'great_people', rarity: 'R', description: 'フランス王妃。豪華な生活で知られ、フランス革命で処刑された。', imageUrl: '/images/cards/card-054.webp' },
  { id: 'card-055', name: '孔子', category: 'great_people', rarity: 'R', description: '中国の思想家。儒教の祖として東アジア文化に大きな影響を与えた。', imageUrl: '/images/cards/card-055.webp' },
  { id: 'card-056', name: 'マルコ・ポーロ', category: 'great_people', rarity: 'R', description: 'ヴェネツィアの冒険家。シルクロードを旅し東方見聞録を残した。', imageUrl: '/images/cards/card-056.webp' },
  { id: 'card-057', name: 'ジャンヌ・ダルク', category: 'great_people', rarity: 'R', description: 'フランスの英雄。神の声を聞き、百年戦争でフランスを救った少女。', imageUrl: '/images/cards/card-057.webp' },
  { id: 'card-058', name: 'アレクサンダー大王', category: 'great_people', rarity: 'R', description: 'マケドニアの征服者。東方遠征で史上最大の帝国を築いた。', imageUrl: '/images/cards/card-058.webp' },
  { id: 'card-059', name: '豊臣秀吉', category: 'great_people', rarity: 'R', description: '天下統一を果たした武将。農民から関白にまで上り詰めた。', imageUrl: '/images/cards/hideyoshi.png' },
  { id: 'card-060', name: 'フロレンス・ナイチンゲール', category: 'great_people', rarity: 'N', description: '近代看護の母。クリミア戦争で傷病兵の看護に尽力した。', imageUrl: '/images/cards/card-060.webp' },
  { id: 'card-061', name: 'パスツール', category: 'great_people', rarity: 'N', description: '微生物学の父。狂犬病ワクチンや低温殺菌法を開発した。', imageUrl: '/images/cards/card-061.webp' },
  { id: 'card-062', name: 'ヘレン・ケラー', category: 'great_people', rarity: 'N', description: '三重苦を克服した女性。サリバン先生と共に障害者教育に貢献した。', imageUrl: '/images/cards/card-062.webp' },
  { id: 'card-063', name: 'アルキメデス', category: 'great_people', rarity: 'N', description: '古代ギリシャの数学者。浮力の原理やてこの原理を発見した。', imageUrl: '/images/cards/card-063.webp' },
  { id: 'card-064', name: 'ヒポクラテス', category: 'great_people', rarity: 'N', description: '医学の父。医師の倫理を説き、ヒポクラテスの誓いを残した。', imageUrl: '/images/cards/card-064.webp' },
  { id: 'card-065', name: '紫式部', category: 'great_people', rarity: 'R', description: '源氏物語の作者。世界最古の長編小説を書いた平安時代の女性文学者。', imageUrl: '/images/cards/murasaki-shikibu.png' },
  { id: 'card-066', name: 'プテラノドン', category: 'creatures', rarity: 'SR', description: '白亜紀の翼竜。翼を広げると7メートル以上にもなる空の支配者。', imageUrl: '/images/cards/card-066.webp' },
  { id: 'card-067', name: 'サーベルタイガー', category: 'creatures', rarity: 'SR', description: '氷河期の猛獣。20センチもの長い犬歯を持つ大型ネコ科動物。', imageUrl: '/images/cards/card-067.webp' },
  { id: 'card-068', name: 'オオカミ', category: 'creatures', rarity: 'R', description: '群れで狩りをする社会性の高い動物。月に向かって遠吠えする。', imageUrl: '/images/cards/card-068.webp' },
  { id: 'card-069', name: 'イルカ', category: 'creatures', rarity: 'R', description: '知能の高い海洋哺乳類。超音波で仲間とコミュニケーションする。', imageUrl: '/images/cards/card-069.webp' },
  { id: 'card-070', name: 'カメレオン', category: 'creatures', rarity: 'R', description: '体の色を自在に変える爬虫類。360度回転する目を持つ。', imageUrl: '/images/cards/card-070.webp' },
  { id: 'card-071', name: 'ホッキョクグマ', category: 'creatures', rarity: 'N', description: '北極圏に住む最大の陸上肉食動物。厚い毛皮で極寒に耐える。', imageUrl: '/images/cards/card-071.webp' },
  { id: 'card-072', name: 'カブトムシ', category: 'creatures', rarity: 'N', description: '子供に人気の昆虫。大きな角で他のオスと戦う甲虫の王様。', imageUrl: '/images/cards/card-072.webp' },
  { id: 'card-073', name: 'ウミガメ', category: 'creatures', rarity: 'N', description: '海を何千キロも旅する爬虫類。産卵のため生まれた浜に戻る。', imageUrl: '/images/cards/card-073.webp' },
  { id: 'card-074', name: 'フクロウ', category: 'creatures', rarity: 'R', description: '夜行性の猛禽類。音を立てずに飛び、暗闇で獲物を捕らえる。', imageUrl: '/images/cards/card-074.webp' },
  { id: 'card-075', name: 'クラゲ', category: 'creatures', rarity: 'N', description: '透明な体で深海を漂う幻想的な生き物。一部は発光する。', imageUrl: '/images/cards/card-075.webp' },
  { id: 'card-076', name: '自由の女神', category: 'world_heritage', rarity: 'SR', description: 'ニューヨークのシンボル。フランスから贈られた自由と民主主義の象徴。', imageUrl: '/images/cards/statue-of-liberty.png' },
  { id: 'card-077', name: 'サグラダ・ファミリア', category: 'world_heritage', rarity: 'SR', description: 'ガウディの未完の教会。1882年着工、今なお建設が続く。', imageUrl: '/images/cards/card-077.webp' },
  { id: 'card-078', name: 'モン・サン=ミシェル', category: 'world_heritage', rarity: 'SR', description: '海に浮かぶ修道院。満潮時に海に囲まれるフランスの世界遺産。', imageUrl: '/images/cards/card-078.webp' },
  { id: 'card-079', name: 'ヴェルサイユ宮殿', category: 'world_heritage', rarity: 'R', description: 'フランスの豪華な宮殿。鏡の間やフランス式庭園で知られる。', imageUrl: '/images/cards/card-079.webp' },
  { id: 'card-080', name: 'ケルン大聖堂', category: 'world_heritage', rarity: 'R', description: 'ゴシック建築の傑作。157メートルの双塔がそびえるドイツの大聖堂。', imageUrl: '/images/cards/card-080.webp' },
  { id: 'card-081', name: 'ナスカの地上絵', category: 'world_heritage', rarity: 'R', description: 'ペルーの謎の巨大絵。上空からしか全体が見えない古代の地上絵。', imageUrl: '/images/cards/card-081.webp' },
  { id: 'card-082', name: '兵馬俑', category: 'world_heritage', rarity: 'R', description: '秦の始皇帝の軍団。8000体以上の等身大の兵士像が眠る。', imageUrl: '/images/cards/terracotta.png' },
  { id: 'card-083', name: '厳島神社', category: 'world_heritage', rarity: 'N', description: '海に浮かぶ朱色の大鳥居。満潮時に海上に立つ日本の象徴的景観。', imageUrl: '/images/cards/itsukushima.png' },
  { id: 'card-084', name: 'アヤソフィア', category: 'world_heritage', rarity: 'N', description: 'イスタンブールの大聖堂。ビザンツ建築の最高傑作。巨大なドーム。', imageUrl: '/images/cards/card-084.webp' },
  { id: 'card-085', name: '知床', category: 'world_heritage', rarity: 'N', description: '北海道の自然遺産。流氷とヒグマが共存する手つかずの大自然。', imageUrl: '/images/cards/shiretoko.png' },
  { id: 'card-086', name: 'ロケット', category: 'inventions', rarity: 'SR', description: '宇宙への扉。人類を月や宇宙ステーションへ運ぶ巨大な乗り物。', imageUrl: '/images/cards/card-086.webp' },
  { id: 'card-087', name: '自動車', category: 'inventions', rarity: 'SR', description: '移動の革命。カール・ベンツが発明した世界初の自動車。', imageUrl: '/images/cards/card-087.webp' },
  { id: 'card-088', name: 'カメラ', category: 'inventions', rarity: 'SR', description: '記録の発明。光を使って一瞬を永遠に残す装置。', imageUrl: '/images/cards/card-088.webp' },
  { id: 'card-089', name: '顕微鏡', category: 'inventions', rarity: 'R', description: 'ミクロの世界への窓。肉眼では見えない微生物や細胞を観察する。', imageUrl: '/images/cards/microscope.png' },
  { id: 'card-090', name: '温度計', category: 'inventions', rarity: 'R', description: '温度を正確に測る道具。ガリレオが原型を発明した。', imageUrl: '/images/cards/card-090.webp' },
  { id: 'card-091', name: '気球', category: 'inventions', rarity: 'R', description: '空への挑戦。モンゴルフィエ兄弟が発明した人類初の飛行装置。', imageUrl: '/images/cards/card-091.webp' },
  { id: 'card-092', name: '時計', category: 'inventions', rarity: 'R', description: '時を刻む精密機械。歯車とバネで正確な時間を知らせる。', imageUrl: '/images/cards/card-092.webp' },
  { id: 'card-093', name: 'ダイナマイト', category: 'inventions', rarity: 'N', description: 'ノーベルが発明した爆薬。建設や採掘に革命をもたらした。', imageUrl: '/images/cards/dynamite.png' },
  { id: 'card-094', name: '紙', category: 'inventions', rarity: 'N', description: '中国四大発明の一つ。知識の記録と伝達を飛躍的に進歩させた。', imageUrl: '/images/cards/paper.png' },
  { id: 'card-095', name: '車輪', category: 'inventions', rarity: 'N', description: '文明の基礎。輸送と機械の発展を支えた人類最大の発明の一つ。', imageUrl: '/images/cards/wheel.png' },
  { id: 'card-096', name: '光の波動性', category: 'discovery', rarity: 'SR', description: '光の二重性。プリズムで虹色に分かれる光の不思議な性質。', imageUrl: '/images/cards/card-096.webp' },
  { id: 'card-097', name: '量子力学', category: 'discovery', rarity: 'SR', description: 'ミクロの物理法則。原子や電子の振る舞いを記述する革命的理論。', imageUrl: '/images/cards/card-097.webp' },
  { id: 'card-098', name: '万有引力', category: 'discovery', rarity: 'R', description: 'リンゴと月を結ぶ力。ニュートンが発見した宇宙の基本法則。', imageUrl: '/images/cards/gravity.png' },
  { id: 'card-099', name: '原子核の構造', category: 'discovery', rarity: 'R', description: '物質の核心。陽子と中性子からなる原子の中心構造。', imageUrl: '/images/cards/card-099.webp' },
  { id: 'card-100', name: '光合成', category: 'creatures', rarity: 'SSR', description: '密林の生命力。太陽の光がアマゾンの仲間を蘇らせる。', imageUrl: '/images/cards/photosynthesis.png' },

  // ===== コンボカード: 原爆コンボ (3枚) =====
  { id: 'card-101', name: 'マンハッタン計画', category: 'inventions', rarity: 'R', description: '第二次世界大戦中の極秘プロジェクト。世界中の科学者を集めて原子爆弾を開発した。【コンボ素材】', imageUrl: '/images/cards/card-101.webp' },
  { id: 'card-102', name: 'トリニティ実験', category: 'inventions', rarity: 'R', description: '1945年7月、ニューメキシコ州の砂漠で行われた世界初の核実験。原子爆弾の威力が実証された瞬間。【コンボ素材】', imageUrl: '/images/cards/card-102.webp' },
  { id: 'card-103', name: '原子爆弾', category: 'inventions', rarity: 'SSR', description: '人類が生み出した最悪の兵器。ベンチに「マンハッタン計画」と「トリニティ実験」が揃うと発動する究極コンボカード。', imageUrl: '' },

  // ===== 追加カード (2枚) =====
  { id: 'card-104', name: '黄熱病', category: 'discovery', rarity: 'R', description: '蛊が媒介する感染症。野口英世が研究に生涯を捧げ、多くの科学者が命を落とした恐ろしい病気。', imageUrl: '/images/cards/yellow-fever.png' },
  { id: 'card-105', name: '天動説', category: 'discovery', rarity: 'R', description: '地球が宇宙の中心で、太陽や星が地球の周りを回るという古代の宇宙観。プトレマイオスが体系化した。', imageUrl: '/images/cards/geocentric.png' },

  // ===== コンボカード: エジソン/ダーウィン/ライト兄弟/北里/始皇帝/アマゾン/ニュートン/宗教改革/ゴッホ/ジャンヌ/マリー =====
  { id: 'card-106', name: '蓄音機', category: 'inventions', rarity: 'N', description: 'エジソンが発明した音を記録する装置。音楽の歴史を変えた。', imageUrl: '/images/cards/phonograph.png' },
  { id: 'card-107', name: 'ゾウガメ', category: 'creatures', rarity: 'N', description: 'ガラパゴス諸島の大型陸ガメ。100年以上生きる長寿の生き物。', imageUrl: '/images/cards/tortoise.png' },
  { id: 'card-108', name: 'ダーウィン', category: 'great_people', rarity: 'R', description: '進化論を唱えた博物学者。ビーグル号でガラパゴスを旅し、自然選択説を発表した。', imageUrl: '/images/cards/darwin.png' },
  { id: 'card-109', name: 'グライダー', category: 'inventions', rarity: 'N', description: 'ライト兄弟が初飛行前に何度も実験した無動力滑空機。', imageUrl: '/images/cards/glider.png' },
  { id: 'card-110', name: '風洞', category: 'inventions', rarity: 'N', description: 'ライト兄弟が翼の形を研究するために作った装置。空気の流れを可視化した。', imageUrl: '/images/cards/wind-tunnel.png' },
  { id: 'card-111', name: 'ライト兄弟', category: 'great_people', rarity: 'R', description: '世界で初めて動力飛行機による有人飛行に成功した兄弟。人類の空への夢を実現した。', imageUrl: '/images/cards/wright-brothers.png' },
  { id: 'card-112', name: 'ペスト菌', category: 'inventions', rarity: 'N', description: '黒死病と呼ばれた恐るべき感染症の原因菌。北里柴三郎が発見した。', imageUrl: '/images/cards/plague.png' },
  { id: 'card-113', name: '血清', category: 'inventions', rarity: 'N', description: '抗体を含む治療液。北里柴三郎が破傷風の血清療法を確立した。', imageUrl: '/images/cards/serum.png' },
  { id: 'card-114', name: '始皇帝', category: 'great_people', rarity: 'SR', description: '中国を初めて統一した秦の皇帝。万里の長城や兵馬俑を築いた絶対君主。', imageUrl: '/images/cards/emperor-qin.png' },
  { id: 'card-115', name: 'アマゾン川', category: 'world_heritage', rarity: 'SR', description: 'アマゾン流域の生命の源。密林の仲間を呼び寄せる大河。', imageUrl: '/images/cards/amazon-river.png' },
  { id: 'card-116', name: 'アナコンダ', category: 'creatures', rarity: 'R', description: 'アマゾンに棲む世界最大級のヘビ。獲物を締め上げて捕食する。', imageUrl: '/images/cards/anaconda.png' },
  { id: 'card-117', name: '毒矢カエル', category: 'creatures', rarity: 'N', description: '鮮やかな色をしたアマゾンのカエル。先住民が矢毒に使う猛毒を持つ。', imageUrl: '/images/cards/poison-frog.png' },
  { id: 'card-118', name: 'リンゴ', category: 'inventions', rarity: 'N', description: 'ニュートンが万有引力を思いつくきっかけになったとされる果実。', imageUrl: '/images/cards/apple.png' },
  { id: 'card-119', name: 'プリズム', category: 'inventions', rarity: 'N', description: '光を虹色に分ける三角柱。ニュートンが光の性質を解き明かした。', imageUrl: '/images/cards/prism.png' },
  { id: 'card-120', name: '活版印刷機', category: 'inventions', rarity: 'N', description: 'グーテンベルクの発明。聖書を広め、宗教改革のきっかけになった。', imageUrl: '/images/cards/printing-press.png' },
  { id: 'card-121', name: '聖書', category: 'inventions', rarity: 'N', description: 'キリスト教の聖典。活版印刷機によって民衆にも広まった。', imageUrl: '/images/cards/bible.png' },
  { id: 'card-122', name: '免罪符', category: 'inventions', rarity: 'N', description: '罪を赦すと売られた札。ルターが激しく批判し宗教改革の発端となった。', imageUrl: '/images/cards/indulgence.png' },
  { id: 'card-123', name: 'ルター', category: 'great_people', rarity: 'R', description: '95ヶ条の論題を掲げ、カトリック教会に対抗して宗教改革を起こした神学者。', imageUrl: '/images/cards/luther.png' },
  { id: 'card-124', name: 'ひまわり', category: 'inventions', rarity: 'N', description: 'ゴッホの代表作。黄色の花が燃えるように描かれた油彩画。', imageUrl: '/images/cards/sunflower.png' },
  { id: 'card-125', name: '星月夜', category: 'inventions', rarity: 'N', description: '渦を巻く夜空を描いたゴッホの傑作。精神病院から見た風景とされる。', imageUrl: '/images/cards/starry-night.png' },
  { id: 'card-126', name: '糸杉', category: 'inventions', rarity: 'N', description: '天へ伸びるように描かれたゴッホの樹木。炎のような筆致が特徴。', imageUrl: '/images/cards/cypress.png' },
  { id: 'card-127', name: '聖剣', category: 'inventions', rarity: 'N', description: 'ジャンヌ・ダルクが神の啓示で見つけたとされる剣。フランス救国の象徴。', imageUrl: '/images/cards/holy-sword.png' },
  { id: 'card-128', name: '軍旗', category: 'inventions', rarity: 'N', description: 'ジャンヌ・ダルクが先頭で掲げた白い旗。兵士の士気を奮い立たせた。', imageUrl: '/images/cards/war-banner.png' },
  { id: 'card-129', name: 'ケーキ', category: 'inventions', rarity: 'N', description: '「パンがなければお菓子を食べればいい」と言ったとされるマリーの象徴。', imageUrl: '/images/cards/cake.png' },

  // ===== コンボカード: ナポレオン (3枚) =====
  { id: 'card-130', name: '大砲', category: 'inventions', rarity: 'N', description: 'ナポレオンが戦場で多用した火力兵器。砲兵隊を率いて数々の勝利を収めた。', imageUrl: '/images/cards/cannon.png' },
  { id: 'card-131', name: 'ナポレオン法典', category: 'inventions', rarity: 'N', description: 'ナポレオンが制定した民法典。近代法の基礎となり、世界中に影響を与えた。', imageUrl: '/images/cards/napoleon-code.png' },
  { id: 'card-132', name: 'ワーテルローの戦い', category: 'discovery', rarity: 'N', description: '1815年、ナポレオンが最後に敗れた戦い。ヨーロッパの運命を決めた一戦。', imageUrl: '/images/cards/waterloo.png' },

  // ===== コンボカード: アインシュタイン (3枚) =====
  { id: 'card-133', name: 'E=mc²', category: 'discovery', rarity: 'N', description: 'エネルギーと質量の等価性を示すアインシュタインの有名な式。', imageUrl: '/images/cards/emc2.png' },
  { id: 'card-134', name: '相対性理論の論文', category: 'discovery', rarity: 'N', description: '1905年にアインシュタインが発表した革命的論文。時間と空間の概念を覆した。', imageUrl: '/images/cards/relativity.png' },
  { id: 'card-135', name: '光速', category: 'discovery', rarity: 'N', description: '秒速約30万キロメートル。宇宙で最も速く、相対性理論の鍵となる定数。', imageUrl: '/images/cards/lightspeed.png' },

  // ===== コンボカード: キュリー夫人 (3枚) =====
  { id: 'card-136', name: 'ラジウム', category: 'discovery', rarity: 'N', description: 'キュリー夫人が発見した放射性元素。暗闇で青白く光る不思議な物質。', imageUrl: '/images/cards/radium.png' },
  { id: 'card-137', name: '研究ノート', category: 'inventions', rarity: 'N', description: 'キュリー夫人の研究ノート。今でも放射線を発しており、鉛の箱に保管されている。', imageUrl: '/images/cards/research-notes.png' },
  { id: 'card-138', name: 'ノーベル賞メダル', category: 'inventions', rarity: 'N', description: 'ノーベル賞受賞者に贈られる金メダル。キュリー夫人は2度手にした。', imageUrl: '/images/cards/nobel-medal.png' },

  // ===== コンボカード: 織田信長 (3枚) =====
  { id: 'card-139', name: '鉄砲', category: 'inventions', rarity: 'N', description: '戦国時代に伝来した新兵器。信長は長篠の戦いで大量の鉄砲を使い勝利した。', imageUrl: '/images/cards/gun.png' },
  { id: 'card-140', name: '楽市楽座', category: 'inventions', rarity: 'N', description: '信長が推進した自由市場政策。座の特権を廃止し、商業を活性化させた。', imageUrl: '/images/cards/rakuichi.png' },
  { id: 'card-141', name: '千利休', category: 'great_people', rarity: 'N', description: '茶道を大成した茶聖。信長・秀吉に仕え、わび茶の美を極めた。', imageUrl: '/images/cards/rikyu.png' },

  // ===== コンボカード: 大航海時代 (4枚) =====
  { id: 'card-142', name: 'コロンブス', category: 'great_people', rarity: 'R', description: '大西洋を横断しアメリカ大陸に到達した航海者。大航海時代の先駆者。', imageUrl: '/images/cards/columbus.png' },
  { id: 'card-143', name: 'マゼラン', category: 'great_people', rarity: 'R', description: '世界一周航海を率いた探検家。地球が丸いことを航海で証明した。', imageUrl: '/images/cards/magellan.png' },
  { id: 'card-144', name: 'キャラベル船', category: 'inventions', rarity: 'N', description: '大航海時代を支えた帆船。小型ながら外洋航海に優れた性能を持つ。', imageUrl: '/images/cards/caravel.png' },
  { id: 'card-145', name: '香辛料', category: 'inventions', rarity: 'N', description: 'コショウやシナモンなど東方の貴重な調味料。大航海時代の原動力となった。', imageUrl: '/images/cards/spice.png' },

  // ===== 宝石カード (5枚) =====
  { id: 'card-146', name: 'ダイヤモンド', category: 'inventions', rarity: 'SR', description: '最も硬い天然鉱物。永遠の輝きを放ち、不滅の象徴とされる。', imageUrl: '/images/cards/diamond.png' },
  { id: 'card-147', name: 'ルビー', category: 'inventions', rarity: 'N', description: '情熱的な赤色の宝石。コランダムにクロムが含まれて赤く輝く。', imageUrl: '/images/cards/ruby.png' },
  { id: 'card-148', name: 'サファイア', category: 'inventions', rarity: 'N', description: '深い青色の宝石。ルビーと同じコランダム鉱物で、知恵の象徴。', imageUrl: '/images/cards/sapphire.png' },
  { id: 'card-149', name: 'エメラルド', category: 'inventions', rarity: 'N', description: '鮮やかな緑の宝石。クレオパトラも愛した再生と癒しの象徴。', imageUrl: '/images/cards/emerald.png' },
  { id: 'card-150', name: 'アメジスト', category: 'inventions', rarity: 'N', description: '美しい紫色の水晶。精神を守り、邪気を払うとされてきた。', imageUrl: '/images/cards/amethyst.png' },

  // ===== アフリカデッキ (5枚) =====
  { id: 'card-151', name: 'ネルソン・マンデラ', category: 'great_people', rarity: 'R', description: '南アフリカの指導者。27年間の投獄を経てアパルトヘイトを終わらせた。', imageUrl: '/images/cards/mandela.png' },
  { id: 'card-152', name: 'アパルトヘイト', category: 'inventions', rarity: 'N', description: '南アフリカで行われた人種隔離政策。マンデラらの闘いで1994年に廃止された。', imageUrl: '/images/cards/apartheid.png' },
  { id: 'card-153', name: 'キリマンジャロ', category: 'world_heritage', rarity: 'N', description: 'アフリカ大陸最高峰。標高5895メートルの雪を頂く山。', imageUrl: '/images/cards/kilimanjaro.png' },
  { id: 'card-154', name: 'アフリカゾウ', category: 'creatures', rarity: 'R', description: 'サバンナの王者。巨大な体と長い牙で全てを薙ぎ倒す。', imageUrl: '/images/cards/card-019.webp' },
  { id: 'card-155', name: 'サバンナ', category: 'inventions', rarity: 'N', description: 'アフリカの広大な草原地帯。多様な野生動物の生息地。', imageUrl: '/images/cards/savanna.png' },
  { id: 'card-173', name: 'ロベン島', category: 'world_heritage', rarity: 'N', description: 'マンデラが27年間投獄された監獄島。不屈の精神の象徴。', imageUrl: '/images/cards/robben-island.png' },
  { id: 'card-174', name: '虹の国', category: 'inventions', rarity: 'SR', description: '多民族が共存する南アフリカの理想。全てを取り戻す希望の虹。', imageUrl: '/images/cards/rainbow-nation.png' },
  { id: 'card-175', name: '自由憲章', category: 'inventions', rarity: 'N', description: '1955年に採択された反アパルトヘイト宣言。自由への誓い。', imageUrl: '/images/cards/freedom-charter.png' },
  { id: 'card-176', name: 'ノーベル平和賞', category: 'inventions', rarity: 'N', description: '1993年、デクラークと共同受賞。平和の力で全員を強くする。', imageUrl: '/images/cards/nobel-peace-prize.png' },

  // ===== 産業革命デッキ (4枚新規 + 蒸気機関は既存card-037) =====
  { id: 'card-156', name: '石炭', category: 'inventions', rarity: 'N', description: '産業革命の燃料。黒いダイヤとも呼ばれた地下資源。', imageUrl: '/images/cards/coal.png' },
  { id: 'card-157', name: '紡績機', category: 'inventions', rarity: 'N', description: '産業革命で最初に機械化された繊維産業の象徴。大量生産を可能にした。', imageUrl: '/images/cards/spinning-machine.png' },
  { id: 'card-158', name: '蒸気機関車', category: 'inventions', rarity: 'R', description: '蒸気の力で走る鉄道車両。物流を革命し、世界を縮めた。', imageUrl: '/images/cards/steam-locomotive.png' },
  { id: 'card-159', name: 'ジェームズ・ワット', category: 'great_people', rarity: 'R', description: '蒸気機関を改良し産業革命の原動力を作った発明家。ワットの由来。', imageUrl: '/images/cards/james-watt.png' },

  // ===== ステージモード用追加カード =====
  { id: 'card-160', name: 'ライオン', category: 'creatures', rarity: 'R', description: '百獣の王。サバンナの頂点に立つ大型肉食獣。群れで狩りを行う。', imageUrl: '/images/cards/lion.png' },
  { id: 'card-161', name: 'ハチドリ', category: 'creatures', rarity: 'N', description: '世界最小の鳥。1秒に80回も羽ばたき、空中に静止できる。', imageUrl: '/images/cards/hummingbird.png' },
  { id: 'card-162', name: 'モアイ像', category: 'world_heritage', rarity: 'N', description: 'イースター島の巨大石像。約900体が海を見つめるように立つ謎の遺跡。', imageUrl: '/images/cards/moai.png' },
  { id: 'card-163', name: '焚書坑儒', category: 'inventions', rarity: 'SSR', description: '始皇帝が行った思想統制。書物を焼き、儒者を生き埋めにした。', imageUrl: '/images/cards/book-burning.png' },
  { id: 'card-164', name: '不老不死の薬', category: 'inventions', rarity: 'N', description: '始皇帝が求め続けた永遠の命。徐福を東方に派遣して探させた。', imageUrl: '/images/cards/elixir.png' },
  { id: 'card-165', name: '大蛇', category: 'creatures', rarity: 'SR', description: 'アマゾンの密林に潜む伝説の巨大蛇。全てを呑み込む恐怖の存在。', imageUrl: '/images/cards/giant-serpent.png' },
  { id: 'card-166', name: '大蛇の巫師', category: 'great_people', rarity: 'SSR', description: 'トゥカノ族の戦士。祖先のアナコンダを崇め、その力を操る蛇の巫師。', imageUrl: '/images/cards/anaconda-hunter.png' },
  { id: 'card-167', name: '凱旋門', category: 'world_heritage', rarity: 'R', description: 'パリのシャンゼリゼ通りに建つ勝利の門。ナポレオンが建設を命じた。', imageUrl: '/images/cards/arc-de-triomphe.png' },
  { id: 'card-168', name: '秦の兵士', category: 'great_people', rarity: 'N', description: '始皇帝に仕える忠実な兵士。万里の長城と共に力を発揮する。', imageUrl: '/images/cards/qin-soldier.png' },
  { id: 'card-169', name: '始皇帝の勅令', category: 'inventions', rarity: 'N', description: '始皇帝が発した命令書。紙を集める力を持つ。', imageUrl: '/images/cards/imperial-decree.png' },

  // ===== ジャンヌダルクデッキ用追加カード =====
  { id: 'card-170', name: '祈りの光', category: 'inventions', rarity: 'N', description: '教会から差す聖なる光。ジャンヌを戦場に呼び戻す。', imageUrl: '/images/cards/prayer-light.png' },
  { id: 'card-171', name: '白百合の盾', category: 'inventions', rarity: 'N', description: 'フランス王家の百合が刻まれた聖なる盾。', imageUrl: '/images/cards/lily-shield.png' },
  { id: 'card-172', name: '聖女の旗印', category: 'inventions', rarity: 'SR', description: '聖女が掲げた旗。失われた仲間を呼び戻す力を持つ。', imageUrl: '/images/cards/holy-banner.png' },

  // ===== 紫式部デッキ追加 (4枚) =====
  { id: 'card-177', name: '源氏物語', category: 'inventions', rarity: 'SR', description: '紫式部が書いた世界最古の長編小説。光源氏の恋と運命を描いた平安文学の傑作。', imageUrl: '/images/cards/tale-of-genji.png' },
  { id: 'card-178', name: '筆', category: 'inventions', rarity: 'N', description: '和紙に墨で文字を綴る平安の筆記具。紫式部が物語を書き残した道具。', imageUrl: '/images/cards/fude.png' },
  { id: 'card-179', name: '和歌', category: 'inventions', rarity: 'N', description: '五七五七七の日本古来の詩歌。平安貴族の心を伝える言葉の花。', imageUrl: '/images/cards/waka.png' },
  { id: 'card-180', name: '十二単', category: 'inventions', rarity: 'N', description: '平安時代の女官が着用した豪華な重ね着装束。宮廷文化の象徴。', imageUrl: '/images/cards/junihitoe.png' },

  // ===== 信長デッキ拡張 (11枚) =====
  { id: 'card-181', name: '敦盛の舞', category: 'inventions', rarity: 'N', description: '信長が愛した幸若舞。「人間五十年」の一節を舞い、出陣の前に気を奮い立たせた。', imageUrl: '/images/cards/atsumori.png' },
  { id: 'card-182', name: '足軽', category: 'great_people', rarity: 'N', description: '戦国の歩兵。鉄砲や槍を手に、信長軍の主力として戦場を駆け抜けた。', imageUrl: '/images/cards/ashigaru.png' },
  { id: 'card-183', name: '馬防柵', category: 'inventions', rarity: 'N', description: '長篠の戦いで使われた木柵。騎馬武者の突撃を防ぎ、鉄砲隊を守った。', imageUrl: '/images/cards/babousaku.png' },
  { id: 'card-184', name: '長篠の陣', category: 'inventions', rarity: 'N', description: '1575年、信長が武田騎馬隊を鉄砲三段撃ちで撃破した布陣。戦術革命の象徴。', imageUrl: '' },
  { id: 'card-185', name: '南蛮貿易', category: 'inventions', rarity: 'N', description: 'ポルトガル・スペインとの交易。鉄砲やキリスト教が日本に伝わった。', imageUrl: '/images/cards/nanban-trade.png' },
  { id: 'card-186', name: '安土城', category: 'world_heritage', rarity: 'N', description: '信長が築いた天下の名城。天守閣を持つ日本初の近世城郭とされる。', imageUrl: '/images/cards/azuchi-castle.png' },
  { id: 'card-187', name: '本能寺の変', category: 'discovery', rarity: 'SR', description: '1582年、明智光秀の謀反で織田信長が命を落とした事件。戦国史最大の転換点。', imageUrl: '/images/cards/honnoji.png' },
  { id: 'card-188', name: '明智光秀', category: 'great_people', rarity: 'SR', description: '織田信長の家臣。本能寺の変で主君を討ったが、わずか11日で秀吉に敗れた武将。', imageUrl: '/images/cards/akechi-mitsuhide.png' },
  { id: 'card-189', name: '愛宕百韻', category: 'inventions', rarity: 'SR', description: '本能寺の変の直前、光秀が愛宕山で詠んだ連歌。「時は今」の句に謀反の暗示を残した。', imageUrl: '/images/cards/atago-hyakuin.png' },
  { id: 'card-190', name: '天王山', category: 'discovery', rarity: 'SR', description: '山崎の戦いの舞台。光秀と秀吉が覇権を賭けて激突した天下分け目の地。', imageUrl: '/images/cards/tennouzan.png' },
  { id: 'card-191', name: '三日天下', category: 'discovery', rarity: 'SR', description: '光秀が信長を討ってから秀吉に敗れるまでの短命な支配。儚き権力の象徴。', imageUrl: '/images/cards/mikka-tenka.png' },

  // ===== オオカミデッキ追加 (4枚) =====
  { id: 'card-192', name: '遠吠え', category: 'inventions', rarity: 'N', description: '月夜に響くオオカミの咆哮。仲間を呼び寄せる群れの合図。', imageUrl: '' },
  { id: 'card-193', name: '群れの掟', category: 'inventions', rarity: 'N', description: 'オオカミの社会を支える厳格な序列。アルファを頂点とする絆の結束。', imageUrl: '' },
  { id: 'card-194', name: '縄張り', category: 'inventions', rarity: 'N', description: 'オオカミが匂いで示す支配領域。侵入者を威嚇で退ける。', imageUrl: '' },
  { id: 'card-195', name: '一匹狼', category: 'creatures', rarity: 'SR', description: '群れを離れ独りで生きる孤高のオオカミ。誰にも頼らぬ強さの象徴。', imageUrl: '' },
];

// ガチャ排出率
export const GACHA_RARITY_RATES = {
  N: 0.60,
  R: 0.30,
  SR: 0.09,
  SSR: 0.01,
} as const;
