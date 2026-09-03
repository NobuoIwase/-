# Opus 作業指示書 — 第二種電気工事士 学科試験 問題データの作成

この文書は Opus（Claude Code）向けの作業手順書です。設計判断はすでに済んでいるので、
**この手順どおりに、1 回分（50 問）ずつ**データを作ってください。分からない点は `docs/DATA_FORMAT.md` と
`public/data/denko2/questions/samples.json`（書式見本）を見てください。仕様を変更したくなったら、変更せずに
`data/review/denko2/<examId>.md` に「提案」として書き残してください。

## 0. 前提

- 素材はすべてリポジトリ内にあります。公式サイトへのアクセスは不要です（PDF は取得済み）
- 出典: 一般財団法人 電気技術者試験センター「第二種電気工事士試験の問題と解答」。教育目的の利用は許諾不要、
  ただし出典明記が条件（アプリ側で `source` から自動表示します）。**改変した場合はその旨を明記**（計算問題の
  数値変更は `calcTemplate` があれば自動で「数値を変更して出題」と表示されます）
- 解説は **市販テキスト・Web 記事の転載禁止**。自分の言葉で、根拠（電技解釈・省令の条番号、内線規程、公式、法則名）を添える

## 1. 環境準備（初回だけ）

```bash
npm ci
pip install pymupdf numpy pillow rapidocr-onnxruntime
# 抽出画像（git 管理外）を再生成する。全回で数十分。1 回分だけなら --exam を付ける
python3 scripts/extract_pdf.py --exam 20260524_q01      # 例: 2026 上期
python3 scripts/extract_pdf.py                          # 全回
```

`data/extracted/denko2/index.json` に全回の一覧（examId, 年, 期, 午前/午後, テキスト PDF か, 図面ページ）があります。
`--exam` の引数は `<yyyymmdd>_q01`（午前 or 単独）/ `_q02`（午後）。日付は `data/raw/denko2/sources.json` 参照。

## 2. 1 回分の作業手順

対象を `examId`（例 `denko2-2026-上期`）とする。作業ディレクトリ `data/extracted/denko2/<examId>/`。

### 2-1. 材料を読む

1. `meta.json` … `textPdf` が true なら `questions_raw.json` の `stemText`/`choicesText` は PDF 由来で正確（ただし
   記号フォントの化け: Ω が `W`、φ が `f`、√ や分数が崩れる、下付き/上付きが消える、「   」の空欄が消える）。
   false なら OCR 草稿なので **必ず画像で確認**する
2. `answers.json` … 公式解答。`"12": "ロ"` → `answer: 1`（イ0 ロ1 ハ2 ニ3）
3. `questions_raw.json` … 各問の `stemText`, `choicesText`, `images.stem/choices/row`, `figure`（自動切り出しの図、あれば）,
   `stemDrawings`（問い欄の描画数。0 より大きければ図がある可能性大）, `choiceImages`（答え欄の埋め込み画像 = 写真選択肢）
4. 画像は Read ツールで見る。まず `cells/qNN_row.png`（行全体）を見れば問いと答えが両方分かる。
   **50 問すべての row 画像を見る必要はない**: textPdf が true で `stemDrawings == 0` かつ `choiceImages` が空で
   `choicesDrawings` が小さい問はテキストだけで作れる。図・写真・回路図・OCR 由来の問だけ画像を見る
5. 配線図問題（通常 31〜50 問）は `pages/p15.png`（`meta.figurePages` の最後のページ）が図面。図面は一度見て
   ①〜⑳ の位置と器具を把握する。1 枚の図面に 20 問がぶら下がる

### 2-2. JSON を書く

出力先: `public/data/denko2/questions/<examId>.json`（50 問の配列、`id` は `<examId>-<問番号>` 例 `denko2-2026-上期-12`）。

各問について:

- `category`: 出題内容で判断（目安: 1〜5 問=基礎理論, 6〜11=配電・配線設計, 12〜18=機器・材料・工具, 19〜24=施工方法,
  25〜27=検査, 28〜30=法令, 31〜50=配線図。年度によりずれるので **内容で決める**）
- `stem`: 問題文を正確に。太字は実試験の太字（**不適切なものは**、**誤っているものは** 等）に合わせる。
  「ただし，…」は改行して続ける。全角記号は原文どおり（，。〔〕）でよい。単位は半角（100 V, 1.6 mm, 0.1 MΩ）
- `choices`: 4 つ。原文の「イ．」等のラベルは含めない
- 図がある問: `figure: "figures/<examId>/qNN.png"`。写真選択肢: `choicesFigure: "figures/<examId>/qNN_choices.png"` +
  `choices: ["写真イ","写真ロ","写真ハ","写真ニ"]`（または短い説明「クランプ形電流計」など。分かる場合は説明の方がよい）。
  配線図問題: `sharedFigure: "figures/<examId>/p15.png"`。加えて問に固有の図（結線図など）があれば `figure` も
- `explanation`:
  - `whyCorrect`: 2〜4 文。根拠の条番号・公式を含める
  - `whyOthersWrong`: 4 要素（正答の位置は ""）。各 1〜2 文。書けない場合は省略可だが、できるだけ書く
  - `supplement`: 正解した人にも役立つ周辺知識・覚え方・頻出の引っかけ。2〜4 文
  - `references`: 条番号など。例 `"電技解釈 第17条"`, `"電気工事士法施行令 第1条"`, `"内線規程 3102-4"`, `"公式 P = V²/R"`
- `groupId`: §3 のルールで付ける
- `type` / `calcTemplate`: §4 のルールで
- `status` / `note`: §5 のルールで
- `source`: `{ "year": 2026, "term": "上期", "session": "午前"(あれば), "number": 12 }`

### 2-3. 図を公開用にコピー

```bash
python3 scripts/publish_figures.py public/data/denko2/questions/<examId>.json
```

参照している画像が `cells/`・`pages/` から `public/data/denko2/figures/<examId>/` にコピーされます。
見つからない参照は MISSING と表示されるので直す。自動切り出し（`qNN_figure.png`）が不適切（切れている・余計なものが
入っている）なら、`cells/qNN_stem.png`（問い欄全体）を使う（`figures/<examId>/qNN.png` の解決順は figure → stem）。
それでも駄目なら PyMuPDF でページから座標指定で切り出して `custom/<name>.png` に置く（`questions_raw.json` に bbox がある）。

### 2-4. 検証とコミット

```bash
# subject.json の questionFiles に "<examId>.json" を追加してから
npm run validate      # エラー 0 になるまで直す
npm test
git add public/data/denko2 data/review && git commit -m "data(denko2): <examId> 50問を追加"
```

さらに **正答の突き合わせ**を自分で行う: `answers.json` の 50 件と JSON の `answer` を比較し、全問一致を確認する。
`scripts/check_answers.py <examId>` を実行すると突き合わせ結果が出る。

### 2-5. レビューノート

`data/review/denko2/<examId>.md` に箇条書きで残す:
- OCR/テキストが読めず画像で判断した問
- retired にした問とその理由、note を付けた問
- 図の切り出しに手を入れた問
- 分類（category）や groupId で迷った問
- 仕様への提案（あれば）

## 3. 類似問題のグループ化ルール

- `groupId` は「同じ知識で解ける問題」をまとめる。例:
  - `g1-gousei-teikou`（合成抵抗）, `g1-denryoku-netsuryou`（電力量と発熱量）, `g2-denatsu-kouka`（電圧降下）,
    `g2-kyoyou-denryu`（電線の許容電流と電流減少係数）, `g3-ringslv-kumiawase`（リングスリーブの種類と個数）,
    `g4-setti-kouji`（接地工事の種類と接地抵抗値・省略条件）, `g5-zetsuen-teikou-kijun`（絶縁抵抗の基準値）,
    `g7-denkikoujishi-sagyou-hani`（電気工事士の作業範囲）
- 新しいグループを作ったら `public/data/denko2/groups.json` に `{id, name, category, summary}` を追加する
- 迷ったら**細かく分ける**（後で統合するほうが楽）。ただし「同一問題の年度違い」は必ず同じグループにする
- 配線図問題は問の種類でグループ化する: `g6-zumen-kigou`（図記号の意味）, `g6-ringslv`（リングスリーブ）,
  `g6-sashikomi-connector`（差込形コネクタ）, `g6-densen-honsu`（電線の最少本数）, `g6-kigu-shashin`（器具写真）,
  `g6-kanchi-kougu`（工具写真）, `g6-haisen-houhou`（配線方法の適否）, `g6-fukusen-zu`（複線図・結線）など

## 4. 計算問題のテンプレート化ルール

- 対象: 数値を変えても解き方が同じ問題（合成抵抗、オームの法則、電力・電力量・熱量、電圧降下、電力損失、
  力率、三相回路、電線の許容電流の計算、幹線・分岐回路の電流など）
- 図に数値が描き込まれている問は、問題文で「各抵抗は {R} Ω」のように **文で言い換えられる場合だけ** calc にする。
  言い換えられない場合は static のまま
- `params` のプールは実試験で見る**キリのよい値**（抵抗 5,10,15,20,25,30,40,50,60,100 / 電圧 100,200 / 電流 5,10,15,20,30 /
  電線長 10,20,30,50 / 断面積 2,3.5,5.5,8,14 / 時間 1,2,3 など）。元問題の値を必ず含め `original` に書く
- `accept` で答えが実試験らしい範囲・桁になる組合せだけ通す（例: 抵抗なら 1〜1000、電力なら 100〜10000）。
  無理数が出る場合は `round` を 1〜2 にする
- `distractors` は「よくある間違い」（公式の取り違え、2 倍・半分、単位換算ミス）を式で書く
- `explanation` に途中計算を式で書く（`{V}`, `{R}`, `{answer}` を使う）
- 検証: `npm run validate` が全組合せを検査する。エラーが出たらプールか accept を調整する

## 5. 法改正チェックルール

各問について、現行法令・規程と照らして:

- **答えが変わる** → `status: "retired"` と `retiredReason`（何がどう変わったか）。例: 2023 年 3 月の電気事業法改正
  （小規模事業用電気工作物の新設）で選択肢の正誤が変わる法令問題、内線規程改正で基準値が変わった問
- **用語だけ変わった**（「一般用電気工作物」→「一般用電気工作物等」、「筆記試験」→「学科試験」）→ 問題文は原文のまま、
  `note` に「現行法では『一般用電気工作物等』。出題当時の表記のまま掲載」等を書く
- 不確かな場合は retired にせず `note` に「要確認: …」と書き、レビューノートにも残す
- 参考にすべき主な改正（実際の条文を思い出せない場合は無理に書かない）:
  - 2023 年（令和 5 年）電気事業法改正: 一般用電気工作物等・小規模事業用電気工作物
  - 電技解釈の改正（接地・漏電遮断器・太陽光関連。第 218/219 条は試験に不適用）
  - 内線規程 2022 年版

## 6. 効率のための指針

- 1 回分を **1 セッション・1 ファイル**で仕上げる。50 問を一度に書いてよい（JSON は 1 ファイル 100〜150 KB 程度）
- 画像を見るのは必要な問だけ（§2-1）。row 画像 1 枚で問いと答えを両方確認できる
- スキャン年度（2015〜2021）は OCR 草稿の誤りが多い（「，」「。」「ー」「一」、数字の 0/O、単位）。
  **必ず** `cells/qNN_row.png` で全問確認する
- 同じ年度の午前/午後は問題が異なる。共通点が多いので groupId を揃える
- 迷ったら samples.json の書き方に合わせる

## 7. 禁止事項

- 仕様（型・ファイル構成・検証ルール）の変更。提案はレビューノートへ
- 市販教材・Web からの解説の転載
- 公式解答と異なる `answer` を入れること（公式が誤りだと思っても、公式に合わせて `note` に書く）
- 図が必要な問を図なしで `active` にすること
- `retiredReason` なしの retired、根拠のない retired
- 問題文の改変（数値バリエーションは calcTemplate で行う）

## 8. 完了報告の形式

各回の完了時にコミットし、次を報告する: examId、問数、active/retired 数、calc 数、正答突き合わせ結果（全問一致）、
validate の結果、レビューノートのパス。
