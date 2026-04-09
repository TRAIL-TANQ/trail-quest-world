import type { CollectionCard } from './types';

// 50枚のカードコレクションデータ
// 各カードに個別イラストを設定済み
export const COLLECTION_CARDS: CollectionCard[] = [
  // ===== 偉人 (15枚) =====
  { id: 'card-001', name: 'ダ・ヴィンチ', category: 'great_people', rarity: 'SR', description: '万能の天才。芸術家にして科学者、発明家。モナ・リザや最後の晩餐を描いた。', imageUrl: 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663286960690/agDvMKMvFtIvVPau.png' },
  { id: 'card-002', name: 'アインシュタイン', category: 'great_people', rarity: 'SR', description: '相対性理論を発表した天才物理学者。ノーベル物理学賞を受賞。', imageUrl: 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663286960690/YTwugOvmfABQuHcr.png' },
  { id: 'card-003', name: 'キュリー夫人', category: 'great_people', rarity: 'SR', description: '放射能の研究でノーベル賞を2度受賞した科学者。', imageUrl: 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663286960690/HLvLJabHssNfmPrQ.png' },
  { id: 'card-004', name: 'ナポレオン', category: 'great_people', rarity: 'R', description: 'フランスの皇帝。ヨーロッパ中を征服した軍事の天才。', imageUrl: 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663286960690/PkaNJYfkCruFomdK.png' },
  { id: 'card-005', name: 'クレオパトラ', category: 'great_people', rarity: 'R', description: '古代エジプト最後の女王。知恵と美貌で国を守った。', imageUrl: 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663286960690/yZGpMeEFLlOmofzH.png' },
  { id: 'card-006', name: '織田信長', category: 'great_people', rarity: 'R', description: '戦国時代の革命児。天下統一を目指した武将。', imageUrl: 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663286960690/SgKBpaflveEpEhQB.png' },
  { id: 'card-007', name: '坂本龍馬', category: 'great_people', rarity: 'R', description: '幕末の志士。薩長同盟を仲介し、明治維新の立役者となった。', imageUrl: 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663286960690/OvXtQliIkjeWulKL.png' },
  { id: 'card-008', name: 'エジソン', category: 'great_people', rarity: 'R', description: '発明王。電球や蓄音機など1000以上の発明をした。', imageUrl: 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663286960690/gvAzJTkNLKZndcHT.png' },
  { id: 'card-009', name: 'ニュートン', category: 'great_people', rarity: 'SR', description: '万有引力の法則を発見した物理学者・数学者。', imageUrl: 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663286960690/PRpYjdmjbaIuOAIJ.png' },
  { id: 'card-010', name: 'ガリレオ', category: 'great_people', rarity: 'R', description: '天文学の父。望遠鏡で天体を観測し、地動説を支持した。', imageUrl: 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663286960690/EpMmcgfFunxUSEdt.png' },
  { id: 'card-011', name: 'モーツァルト', category: 'great_people', rarity: 'N', description: '神童と呼ばれた作曲家。5歳で作曲を始めた音楽の天才。', imageUrl: 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663286960690/fYuOqPycZyVERUsY.png' },
  { id: 'card-012', name: 'シェイクスピア', category: 'great_people', rarity: 'N', description: 'イギリスの劇作家。ロミオとジュリエットなど名作を残した。', imageUrl: 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663286960690/KUmGgzZKYxZDYOOb.png' },
  { id: 'card-013', name: '野口英世', category: 'great_people', rarity: 'N', description: '細菌学者。黄熱病の研究に生涯を捧げた。千円札の肖像。', imageUrl: 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663286960690/gPZKvDKkTXQsqUcN.png' },
  { id: 'card-014', name: '北里柴三郎', category: 'great_people', rarity: 'N', description: '近代日本医学の父。破傷風の治療法を開発した。', imageUrl: 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663286960690/SsYbZiLOjHRAxLwL.png' },
  { id: 'card-015', name: '伊能忠敬', category: 'great_people', rarity: 'N', description: '日本全国を歩いて測量し、精密な日本地図を作った。', imageUrl: 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663286960690/NqvNTwCyXTAnSPnp.png' },

  // ===== 生き物 (10枚) =====
  { id: 'card-016', name: 'ティラノサウルス', category: 'creatures', rarity: 'SR', description: '白亜紀最強の肉食恐竜。体長12メートル以上の巨体。', imageUrl: 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663286960690/fRkXmCcHpPcdBCmE.png' },
  { id: 'card-017', name: 'マンモス', category: 'creatures', rarity: 'R', description: '氷河期に生きた巨大な象。長い牙と毛が特徴。', imageUrl: 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663286960690/JWcTnCHAnzFHNiWi.png' },
  { id: 'card-018', name: 'シロナガスクジラ', category: 'creatures', rarity: 'R', description: '地球上最大の動物。体長30メートルにもなる海の王者。', imageUrl: 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663286960690/MGzzSppMaicoIuRB.png' },
  { id: 'card-019', name: 'アフリカゾウ', category: 'creatures', rarity: 'N', description: '陸上最大の動物。大きな耳と長い鼻が特徴。', imageUrl: 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663286960690/LWTCIkFkIpASqRio.png' },
  { id: 'card-020', name: 'ジャイアントパンダ', category: 'creatures', rarity: 'N', description: '中国に住む白黒模様のクマ。竹を食べる。', imageUrl: 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663286960690/DlPIgaMrmPdJRxPV.png' },
  { id: 'card-021', name: 'コモドドラゴン', category: 'creatures', rarity: 'N', description: '世界最大のトカゲ。インドネシアの島に生息する。', imageUrl: 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663286960690/hOQwfWGNxvoqdiUW.png' },
  { id: 'card-022', name: 'ミツバチ', category: 'creatures', rarity: 'N', description: '花粉を運ぶ大切な虫。はちみつを作る働き者。', imageUrl: 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663286960690/pdXtymnRGoLVORRQ.png' },
  { id: 'card-023', name: 'ダーウィンフィンチ', category: 'creatures', rarity: 'R', description: 'ガラパゴス諸島の鳥。進化論のヒントになった。', imageUrl: 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663286960690/NghbmItaqaglkTUj.png' },
  { id: 'card-024', name: 'シーラカンス', category: 'creatures', rarity: 'SR', description: '生きた化石。4億年前から姿が変わっていない深海魚。', imageUrl: 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663286960690/NbvikssGzfaFeUQE.png' },
  { id: 'card-025', name: 'ピラニア', category: 'creatures', rarity: 'N', description: 'アマゾン川に住む肉食魚。鋭い歯を持つ。', imageUrl: 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663286960690/FVepbJLMyStewSWR.png' },

  // ===== 世界遺産 (10枚) =====
  { id: 'card-026', name: '万里の長城', category: 'world_heritage', rarity: 'SR', description: '中国の巨大な防壁。全長2万キロ以上。宇宙からも見える。', imageUrl: 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663286960690/NlhCjhinDBzgPjfB.png' },
  { id: 'card-027', name: 'ピラミッド', category: 'world_heritage', rarity: 'SR', description: 'エジプトの巨大建造物。ファラオの墓として4500年前に建てられた。', imageUrl: 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663286960690/VYmkFSMAMKaRPqCT.png' },
  { id: 'card-028', name: 'コロッセオ', category: 'world_heritage', rarity: 'R', description: '古代ローマの円形闘技場。5万人を収容できた。', imageUrl: 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663286960690/mKMDyYnFKvzbXmYD.png' },
  { id: 'card-029', name: 'タージ・マハル', category: 'world_heritage', rarity: 'R', description: 'インドの白い大理石の霊廟。愛の象徴として有名。', imageUrl: 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663286960690/EjOfxPpPRdEleFLa.png' },
  { id: 'card-030', name: 'アンコールワット', category: 'world_heritage', rarity: 'R', description: 'カンボジアの巨大寺院。世界最大の宗教建築物。', imageUrl: 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663286960690/rtzHKKZTDmjwqUzv.png' },
  { id: 'card-031', name: '屋久島', category: 'world_heritage', rarity: 'N', description: '鹿児島県の島。樹齢7000年の縄文杉がある自然遺産。', imageUrl: 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663286960690/FRpIENxFzAHJoPmN.png' },
  { id: 'card-032', name: '富士山', category: 'world_heritage', rarity: 'N', description: '日本一高い山。標高3776メートル。文化遺産に登録。', imageUrl: 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663286960690/JihSvHJDOqpCLbTp.png' },
  { id: 'card-033', name: 'マチュ・ピチュ', category: 'world_heritage', rarity: 'SR', description: 'ペルーの空中都市。インカ帝国の遺跡。標高2400メートル。', imageUrl: 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663286960690/zrOoeOClyWFSfMeT.png' },
  { id: 'card-034', name: 'ストーンヘンジ', category: 'world_heritage', rarity: 'R', description: 'イギリスの巨石遺跡。5000年前に作られた謎の石の環。', imageUrl: 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663286960690/sguTHjMnNJIwJKUA.png' },
  { id: 'card-035', name: '法隆寺', category: 'world_heritage', rarity: 'N', description: '奈良県の寺院。世界最古の木造建築物。聖徳太子が建立。', imageUrl: 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663286960690/QdUXsztQPkxifCae.png' },

  // ===== 発明 (10枚) =====
  { id: 'card-036', name: '電球', category: 'inventions', rarity: 'N', description: 'エジソンが実用化した照明器具。世界を明るくした。', imageUrl: 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663286960690/eTjKXWPybUqoGzpc.png' },
  { id: 'card-037', name: '蒸気機関', category: 'inventions', rarity: 'R', description: '産業革命を起こした動力源。工場や鉄道を動かした。', imageUrl: 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663286960690/DLLArSZsWrDpOVCu.png' },
  { id: 'card-038', name: '印刷機', category: 'inventions', rarity: 'R', description: 'グーテンベルクが発明した活版印刷。知識の普及に貢献。', imageUrl: 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663286960690/FOXtnJaVNaQhZFVY.png' },
  { id: 'card-039', name: '飛行機', category: 'inventions', rarity: 'SR', description: 'ライト兄弟が初飛行に成功。人類の空への夢を実現した。', imageUrl: 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663286960690/xIKtiQUUzQRyzaww.png' },
  { id: 'card-040', name: 'インターネット', category: 'inventions', rarity: 'SR', description: '世界中のコンピュータをつなぐ通信網。情報革命を起こした。', imageUrl: 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663286960690/EGEjFtYVPVSZmkud.png' },
  { id: 'card-041', name: '電話', category: 'inventions', rarity: 'N', description: 'ベルが発明した通信機器。遠くの人と話せるようになった。', imageUrl: 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663286960690/BKZKfMSuTztIBwjB.png' },
  { id: 'card-042', name: '望遠鏡', category: 'inventions', rarity: 'N', description: '遠くのものを見る光学機器。天文学の発展に貢献した。', imageUrl: 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663286960690/loFhDtNlaAzEAJNl.png' },
  { id: 'card-043', name: 'ペニシリン', category: 'inventions', rarity: 'R', description: 'フレミングが発見した抗生物質。多くの命を救った。', imageUrl: 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663286960690/GmKABnFnnttgnwEr.png' },
  { id: 'card-044', name: '羅針盤', category: 'inventions', rarity: 'N', description: '方角を知るための道具。大航海時代を支えた。', imageUrl: 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663286960690/uNvjsxOSoVKjQGmK.png' },
  { id: 'card-045', name: '火薬', category: 'inventions', rarity: 'N', description: '中国で発明された爆発物。花火や採掘にも使われる。', imageUrl: 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663286960690/aBaltcHieAcHNVfa.png' },

  // ===== 探究 (5枚) =====
  { id: 'card-046', name: '宇宙の誕生', category: 'discovery', rarity: 'SSR', description: '138億年前のビッグバン。宇宙のはじまりの瞬間。', imageUrl: 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663286960690/FVspuTTsNDRoENYQ.png' },
  { id: 'card-047', name: 'DNAの二重らせん', category: 'discovery', rarity: 'SR', description: '生命の設計図。ワトソンとクリックが構造を解明した。', imageUrl: 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663286960690/GlHRjgIYkZQQoiNC.png' },
  { id: 'card-048', name: '元素周期表', category: 'discovery', rarity: 'R', description: 'メンデレーエフが作った元素の表。化学の基礎。', imageUrl: 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663286960690/kPiSmiGMLYPvrYal.png' },
  { id: 'card-049', name: '地動説', category: 'discovery', rarity: 'R', description: 'コペルニクスが唱えた説。地球が太陽の周りを回る。', imageUrl: 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663286960690/uaoynJBphdRixKZm.png' },
  { id: 'card-050', name: '進化論', category: 'discovery', rarity: 'SR', description: 'ダーウィンが唱えた理論。生物は環境に適応して変化する。', imageUrl: 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663286960690/nCcOOMxxIRZEqfHB.png' },
];

// ガチャ排出率
export const GACHA_RARITY_RATES = {
  N: 0.60,
  R: 0.30,
  SR: 0.09,
  SSR: 0.01,
} as const;
