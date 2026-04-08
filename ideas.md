# TRAIL QUEST WORLD デザインブレインストーミング

<response>
<text>
## Idea 1: 「古代魔導書」スタイル — Arcane Grimoire Aesthetic

### Design Movement
中世写本（Illuminated Manuscript）とダークファンタジーゲームUIの融合。Diablo、Path of Exile、原神のUI要素からインスピレーション。

### Core Principles
1. **深淵のレイヤリング**: 背景は深いネイビー～ミッドナイトブルーの多層グラデーション。星屑やパーティクルが浮遊
2. **黄金の装飾線**: すべてのUI要素にゴールドのボーダー、コーナー装飾、セパレーターを配置
3. **素材感のあるテクスチャ**: 石板、羊皮紙、金属の質感をCSS gradientとbox-shadowで表現
4. **光の演出**: ゴールドのglow効果、カードのホログラフィック光沢

### Color Philosophy
- **Primary Background**: #0a0e27 → #131842（深淵の闇。安全で没入感のある空間）
- **Gold Accent**: #ffd700 → #f0a500（達成感、報酬、進歩の象徴）
- **Emerald Green**: #00c853 → #2ecc71（正解、成功、成長）
- **Ruby Red**: #ff1744（警告、コスト）
- **Parchment**: #f5e6c8（カード背景、読みやすさ）
- **Steel Blue**: #4a6fa5（セカンダリUI要素）

### Layout Paradigm
- モバイルファースト縦スクロール。各セクションは「巻物」のように展開
- ホーム画面はワールドマップ風の非対称レイアウト。ゲームカテゴリが地図上のランドマークとして配置
- カードUIは斜めの角度やオーバーラップを使い、静的なグリッドを避ける

### Signature Elements
1. **ゴールドフレーム**: 各カード・パネルの四隅に装飾的なコーナーピース（CSS border-image + pseudo-elements）
2. **光るルーン文字風アクセント**: ヘッダーやセクション区切りに魔法陣風の装飾ライン
3. **浮遊パーティクル**: 背景に微細な光の粒子がゆっくり漂う（CSS animation）

### Interaction Philosophy
- タップ/クリックで「魔法発動」のようなリップルエフェクト
- ページ遷移は「ポータル」のようなフェード＋スケール
- ボタンホバーでゴールドのglow intensityが増加

### Animation
- ページ入場: 下からフェードイン（staggered, 各要素50ms遅延）
- カードホバー: Y軸-4px浮上 + box-shadow拡大 + ゴールドborder glow
- ALT獲得: コインが弧を描いてカウンターに吸い込まれる
- レベルアップ: 画面中央に光の柱 + 称号テキストがタイプライター表示
- ガチャ: カードが裏返り→光の爆発→レアリティに応じた色のオーラ

### Typography System
- **Display**: "Cinzel Decorative" — 中世風セリフ。タイトル、レベル名に使用
- **Heading**: "Noto Sans JP" Bold — 日本語見出し。力強さと読みやすさ
- **Body**: "Noto Sans JP" Regular — 本文。400weight
- **Numbers**: "Orbitron" — スコア、ALT数値。未来的でゲーム感
</text>
<probability>0.07</probability>
</response>

<response>
<text>
## Idea 2: 「蒸気機関冒険」スタイル — Steampunk Explorer Aesthetic

### Design Movement
スチームパンク × 探検家のワークショップ。真鍮の歯車、革のベルト、古地図の世界観。

### Core Principles
1. **機械仕掛けの精密さ**: 歯車、リベット、計器のモチーフをUI要素に
2. **温かみのある金属**: 真鍮、銅、ブロンズの色調が支配的
3. **手描き地図の質感**: 背景やカードに古地図風のテクスチャ
4. **アナログ計器**: プログレスバーは蒸気圧計、レベルは高度計風

### Color Philosophy
- **Primary**: #1a1a2e → #16213e（夜の工房）
- **Brass**: #b5651d → #cd7f32（真鍮の温かみ）
- **Copper**: #b87333（銅のアクセント）
- **Parchment**: #f4e4ba（古地図の紙）
- **Steam White**: #e8dcc8（蒸気の白）

### Layout Paradigm
- ダッシュボード風レイアウト。各パネルが「計器盤」のように配置
- ホーム画面は冒険者の机の上を見下ろすような構図
- ナビゲーションは「ツールベルト」のメタファー

### Signature Elements
1. **リベット装飾**: パネルの角にリベット（鋲）のドット
2. **歯車アイコン**: ローディングやトランジションに回転する歯車
3. **古地図風背景**: セピアトーンの等高線パターン

### Interaction Philosophy
- ボタンプレスで「レバーを引く」ような沈み込み
- ページ遷移は歯車が回転してシーンが切り替わる
- スクロールで背景の歯車がパララックス回転

### Animation
- 入場: 左右からスライドイン（機械のスライド機構風）
- ホバー: 真鍮色のシャイン効果がスイープ
- ガチャ: 蒸気が噴出→カードが上昇
- レベルアップ: 高度計の針が振り切れる演出

### Typography System
- **Display**: "Pirata One" — 冒険者風。タイトル用
- **Heading**: "M PLUS Rounded 1c" Bold — 丸みのある日本語
- **Body**: "M PLUS Rounded 1c" Regular
- **Numbers**: "Share Tech Mono" — 計器風モノスペース
</text>
<probability>0.04</probability>
</response>

<response>
<text>
## Idea 3: 「王立冒険者ギルド」スタイル — Royal Adventurer's Guild Aesthetic

### Design Movement
ハイファンタジーRPGのギルドホール。参考画像に最も忠実なアプローチ。ダークブルーの深い背景にゴールドの豪華な装飾。ドラゴンクエスト、ファイナルファンタジーのメニューUIとソーシャルゲームの華やかさを融合。

### Core Principles
1. **深淵と黄金のコントラスト**: ダークネイビー背景にゴールドの装飾が映える、高級感のある配色
2. **ギルドの紋章的装飾**: 盾、リボン、王冠モチーフのフレームとバッジ
3. **冒険者の活力**: 鮮やかなエメラルドグリーンのCTAボタン、ルビーレッドの警告
4. **階層的な奥行き**: 複数レイヤーのbox-shadowとグラデーションで立体感

### Color Philosophy
- **Deep Navy**: #0b1128 → #151d3b（ギルドホールの夜空。信頼と神秘）
- **Royal Gold**: #ffd700, #f0c040, #c8960c（王族の威厳。報酬と達成の象徴）
- **Emerald Action**: #22c55e → #16a34a（冒険への出発。ポジティブなアクション）
- **Azure Info**: #3b82f6 → #2563eb（知識と情報。セカンダリアクション）
- **Ruby Alert**: #ef4444（危険、コスト消費）
- **Ivory Parchment**: #fef3c7 → #fde68a（カード内テキスト背景。温かみ）
- **Silver Steel**: #94a3b8 → #64748b（非アクティブ、サブテキスト）

### Layout Paradigm
- **モバイルファースト縦型**: max-width 430pxのスマホ最適化レイアウト
- **ホーム**: ワールドマップ風。背景に幻想的な風景、前面にゲームカテゴリの「クエストボード」
- **リスト画面**: スクロール可能なギルド掲示板風。各アイテムがクエスト依頼書のようなカード
- **ゲーム画面**: 全画面。上部にスコアバー、中央にゲームエリア、下部にアクションバー
- **ボトムナビ**: ギルドの紋章プレート風。アクティブタブはゴールドに輝く

### Signature Elements
1. **ゴールドフレームパネル**: 各主要パネルの外周にゴールドのダブルボーダー + コーナーに装飾的なL字型オーナメント（CSS pseudo-elements）
2. **リボンバナー**: セクションタイトルがリボン型のバナーに収まる（CSS clip-path + gradient）
3. **輝くバッジ**: レアリティやランクを示す星型バッジにアニメーションglow

### Interaction Philosophy
- ボタンは「押し込む」3D効果（active時にtranslateY + shadow減少）
- カードタップで「光の波紋」が広がる
- ナビゲーション切替で「ページめくり」のようなスライド
- 重要アクション（ガチャ、購入）は確認モーダルが「封印解除」風に展開

### Animation
- **ページ入場**: opacity 0→1 + translateY 20px→0（duration 400ms, ease-out, staggered 80ms）
- **カードホバー/タップ**: scale 1→1.03 + box-shadow拡大 + border-colorがゴールドに変化（200ms）
- **ALT獲得**: コインアイコンが下から弧を描いて上昇→ヘッダーのALTカウンターに吸収（500ms）+ カウンター数値がバウンス
- **レベルアップ**: 画面中央に光の柱エフェクト（radial-gradient animation）→ 新レベル・称号がscale 0→1でポップイン → 紙吹雪パーティクル
- **ガチャ演出**: カードが裏面で回転（rotateY 0→180deg, 800ms）→ レアリティに応じた光のバースト → カード情報フェードイン
- **ボトムナビ**: アクティブタブアイコンがbounce（translateY -4px → 0, 300ms）+ ゴールドglow

### Typography System
- **Display/Title**: "Cinzel" 700 — 西洋ファンタジーの格調高いセリフ体。ロゴ、画面タイトルに
- **Japanese Heading**: "Noto Sans JP" 700 — 日本語の見出し。太字で力強く
- **Body Text**: "Noto Sans JP" 400/500 — 本文、説明文。読みやすさ重視
- **Score/Numbers**: "Orbitron" 700 — スコア、ALT数値、タイマー。ゲーム的な未来感
- **Size Scale**: Title 24px / H1 20px / H2 18px / Body 14px / Caption 12px / Tiny 10px
</text>
<probability>0.08</probability>
</response>
