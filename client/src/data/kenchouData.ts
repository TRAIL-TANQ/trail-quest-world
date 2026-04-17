/**
 * 県庁所在地クイズ用のデータ。
 * sameNameFlag: 県名と県庁所在地が同じかどうか（★1 で使う）
 * otherCities:  同県内の別都市（紛らわしい選択肢として ★3+ で使う）
 */
export interface KenchouQuestion {
  prefecture: string;   // '東京都' など
  capital: string;      // '東京' / '札幌市' のような表示名
  sameNameFlag: boolean;
  region: string;
  otherCities: string[]; // 同県内のダミー都市（3つ程度）
}

export const KENCHOU_DATA: KenchouQuestion[] = [
  { prefecture: '北海道',   capital: '札幌',   sameNameFlag: false, region: '北海道', otherCities: ['旭川', '函館', '釧路'] },
  { prefecture: '青森県',   capital: '青森',   sameNameFlag: true,  region: '東北',   otherCities: ['弘前', '八戸', '十和田'] },
  { prefecture: '岩手県',   capital: '盛岡',   sameNameFlag: false, region: '東北',   otherCities: ['一関', '花巻', '北上'] },
  { prefecture: '宮城県',   capital: '仙台',   sameNameFlag: false, region: '東北',   otherCities: ['石巻', '大崎', '名取'] },
  { prefecture: '秋田県',   capital: '秋田',   sameNameFlag: true,  region: '東北',   otherCities: ['横手', '能代', '大館'] },
  { prefecture: '山形県',   capital: '山形',   sameNameFlag: true,  region: '東北',   otherCities: ['酒田', '米沢', '鶴岡'] },
  { prefecture: '福島県',   capital: '福島',   sameNameFlag: true,  region: '東北',   otherCities: ['郡山', 'いわき', '会津若松'] },
  { prefecture: '茨城県',   capital: '水戸',   sameNameFlag: false, region: '関東',   otherCities: ['つくば', '日立', '土浦'] },
  { prefecture: '栃木県',   capital: '宇都宮', sameNameFlag: false, region: '関東',   otherCities: ['小山', '足利', '栃木'] },
  { prefecture: '群馬県',   capital: '前橋',   sameNameFlag: false, region: '関東',   otherCities: ['高崎', '太田', '桐生'] },
  { prefecture: '埼玉県',   capital: 'さいたま', sameNameFlag: false, region: '関東', otherCities: ['川越', '熊谷', '川口'] },
  { prefecture: '千葉県',   capital: '千葉',   sameNameFlag: true,  region: '関東',   otherCities: ['船橋', '松戸', '柏'] },
  { prefecture: '東京都',   capital: '東京',   sameNameFlag: true,  region: '関東',   otherCities: ['八王子', '町田', '立川'] },
  { prefecture: '神奈川県', capital: '横浜',   sameNameFlag: false, region: '関東',   otherCities: ['川崎', '相模原', '藤沢'] },
  { prefecture: '新潟県',   capital: '新潟',   sameNameFlag: true,  region: '中部',   otherCities: ['長岡', '上越', '三条'] },
  { prefecture: '富山県',   capital: '富山',   sameNameFlag: true,  region: '中部',   otherCities: ['高岡', '魚津', '氷見'] },
  { prefecture: '石川県',   capital: '金沢',   sameNameFlag: false, region: '中部',   otherCities: ['小松', '白山', '七尾'] },
  { prefecture: '福井県',   capital: '福井',   sameNameFlag: true,  region: '中部',   otherCities: ['敦賀', '越前', '小浜'] },
  { prefecture: '山梨県',   capital: '甲府',   sameNameFlag: false, region: '中部',   otherCities: ['富士吉田', '甲斐', '南アルプス'] },
  { prefecture: '長野県',   capital: '長野',   sameNameFlag: true,  region: '中部',   otherCities: ['松本', '上田', '飯田'] },
  { prefecture: '岐阜県',   capital: '岐阜',   sameNameFlag: true,  region: '中部',   otherCities: ['大垣', '高山', '多治見'] },
  { prefecture: '静岡県',   capital: '静岡',   sameNameFlag: true,  region: '中部',   otherCities: ['浜松', '沼津', '富士'] },
  { prefecture: '愛知県',   capital: '名古屋', sameNameFlag: false, region: '中部',   otherCities: ['豊田', '岡崎', '一宮'] },
  { prefecture: '三重県',   capital: '津',     sameNameFlag: false, region: '近畿',   otherCities: ['四日市', '松阪', '伊勢'] },
  { prefecture: '滋賀県',   capital: '大津',   sameNameFlag: false, region: '近畿',   otherCities: ['彦根', '草津', '長浜'] },
  { prefecture: '京都府',   capital: '京都',   sameNameFlag: true,  region: '近畿',   otherCities: ['宇治', '舞鶴', '亀岡'] },
  { prefecture: '大阪府',   capital: '大阪',   sameNameFlag: true,  region: '近畿',   otherCities: ['堺', '東大阪', '豊中'] },
  { prefecture: '兵庫県',   capital: '神戸',   sameNameFlag: false, region: '近畿',   otherCities: ['姫路', '西宮', '尼崎'] },
  { prefecture: '奈良県',   capital: '奈良',   sameNameFlag: true,  region: '近畿',   otherCities: ['橿原', '生駒', '大和郡山'] },
  { prefecture: '和歌山県', capital: '和歌山', sameNameFlag: true,  region: '近畿',   otherCities: ['田辺', '新宮', '海南'] },
  { prefecture: '鳥取県',   capital: '鳥取',   sameNameFlag: true,  region: '中国',   otherCities: ['米子', '倉吉', '境港'] },
  { prefecture: '島根県',   capital: '松江',   sameNameFlag: false, region: '中国',   otherCities: ['出雲', '浜田', '益田'] },
  { prefecture: '岡山県',   capital: '岡山',   sameNameFlag: true,  region: '中国',   otherCities: ['倉敷', '津山', '玉野'] },
  { prefecture: '広島県',   capital: '広島',   sameNameFlag: true,  region: '中国',   otherCities: ['福山', '呉', '尾道'] },
  { prefecture: '山口県',   capital: '山口',   sameNameFlag: true,  region: '中国',   otherCities: ['下関', '宇部', '周南'] },
  { prefecture: '徳島県',   capital: '徳島',   sameNameFlag: true,  region: '四国',   otherCities: ['鳴門', '阿南', '吉野川'] },
  { prefecture: '香川県',   capital: '高松',   sameNameFlag: false, region: '四国',   otherCities: ['丸亀', '坂出', '観音寺'] },
  { prefecture: '愛媛県',   capital: '松山',   sameNameFlag: false, region: '四国',   otherCities: ['今治', '新居浜', '宇和島'] },
  { prefecture: '高知県',   capital: '高知',   sameNameFlag: true,  region: '四国',   otherCities: ['南国', '四万十', '香南'] },
  { prefecture: '福岡県',   capital: '福岡',   sameNameFlag: true,  region: '九州',   otherCities: ['北九州', '久留米', '大牟田'] },
  { prefecture: '佐賀県',   capital: '佐賀',   sameNameFlag: true,  region: '九州',   otherCities: ['唐津', '鳥栖', '伊万里'] },
  { prefecture: '長崎県',   capital: '長崎',   sameNameFlag: true,  region: '九州',   otherCities: ['佐世保', '諫早', '大村'] },
  { prefecture: '熊本県',   capital: '熊本',   sameNameFlag: true,  region: '九州',   otherCities: ['八代', '天草', '人吉'] },
  { prefecture: '大分県',   capital: '大分',   sameNameFlag: true,  region: '九州',   otherCities: ['別府', '中津', '日田'] },
  { prefecture: '宮崎県',   capital: '宮崎',   sameNameFlag: true,  region: '九州',   otherCities: ['都城', '延岡', '日南'] },
  { prefecture: '鹿児島県', capital: '鹿児島', sameNameFlag: true,  region: '九州',   otherCities: ['霧島', '薩摩川内', '鹿屋'] },
  { prefecture: '沖縄県',   capital: '那覇',   sameNameFlag: false, region: '沖縄',   otherCities: ['沖縄', '浦添', '宜野湾'] },
];

/**
 * 難易度に応じて出題プールを返す。
 * ★1: 県名と県庁所在地が同じもののみ
 * ★2: 県名と県庁所在地が違う有名なもの（北海道/愛知/兵庫/神奈川/宮城/福岡等）
 * ★3-4: 全47から
 * ★5: 全47（逆引きモード、呼び出し側で処理）
 */
export function getKenchouByDifficulty(diff: 1 | 2 | 3 | 4 | 5): KenchouQuestion[] {
  if (diff === 1) return KENCHOU_DATA.filter((k) => k.sameNameFlag);
  if (diff === 2) {
    // 有名な「違うもの」セット
    const famousDiff = new Set(['北海道', '神奈川県', '愛知県', '兵庫県', '宮城県', '福岡県', '沖縄県', '石川県', '岩手県', '香川県', '栃木県', '群馬県', '茨城県']);
    return KENCHOU_DATA.filter((k) => famousDiff.has(k.prefecture));
  }
  return KENCHOU_DATA;
}
