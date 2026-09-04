# Opus 作業指示書 — 第二種電気工事士 学科試験 問題データの作成

設計判断は済んでいる。**この手順どおりに 1 回分（50 問）ずつ**データを作る。

- 型の仕様: `docs/DATA_FORMAT.md`
- 書式の見本: `docs/samples.json`（4 問）
- 完成済みの実例: `public/data/denko2/questions/denko2-2026-上期.json`（50 問、レビュー済み。最も参考になる）

仕様を変えたくなっても変えない。`data/review/denko2/<examId>.md` に提案として書き残す。

## 0. 前提

- 素材はすべてリポジトリ内にある。公式サイトへのアクセスは不要
- 出典は一般財団法人 電気技術者試験センター「第二種電気工事士試験の問題と解答」。
  教育目的の利用は許諾・使用料とも不要で、条件は出典の明記と、改変した場合にその旨を明記すること。
  出典はアプリが `source` から自動表示する。計算問題の数値変更も「数値を変更して出題」と自動表示される
- 解説は**市販テキスト・Web 記事の転載禁止**。自分の言葉で書き、根拠（条番号・公式・法則名）を添える

## 1. 環境準備（初回のみ）

```bash
npm ci
pip install pymupdf numpy pillow rapidocr   # 日本語 OCR。antlr4 のビルドに失敗する環境では rapidocr-onnxruntime（精度は落ちる）

python3 scripts/extract_pdf.py --list                      # 全 27 回の examId 一覧
python3 scripts/extract_pdf.py --exam denko2-2024-上期     # 1 回分の素材（画像）を生成。数分
```

抽出画像は git 管理外なので、担当する回の分だけ生成すればよい。全回まとめて作るなら引数なしで 1 時間ほど。

## 2. 1 回分の手順

対象を `examId`（例 `denko2-2024-上期`）とする。素材は `data/extracted/denko2/<examId>/`。

### 2-1. 素材を読む

**`meta.json` の `textPdf` で作業量が変わる。**

- `true`（2022 年以降の 13 回）— `questions_raw.json` の `stemText` / `choicesText` は PDF 由来で信頼できる。
  ただし記号が落ちる: **Ω が `W`、φ が `f`** に化ける、√・分数が崩れる、上付き下付きが消える（`mm²` → `mm2`）、
  空欄の枠が消える。該当箇所は画像で確認して直す
- `false`（2021 年以前の 14 回）— テキストは OCR 草稿。**全 50 問を `cells/qNN_row.png` で確認する**

**要注意フラグ**（`questions_raw.json`）。付いている問は必ず画像を見る。

| フラグ | 意味 |
|---|---|
| `numberGuessed: true` | 問番号が読めず連番で補った |
| `previousMerged: true` | 直前の行に 2 問が結合している疑い |
| `figure.suspicious: true` | 自動切り出しの図が大きすぎる（本文を含んでいる疑い） |

**解答キー**は `answers.json`（`"12": "ロ"` → `answer: 1`。イ 0 / ロ 1 / ハ 2 / ニ 3）。
`meta.json` の `answerSource` が `manual` の回（2023 下期の午前・午後）は解答表がスキャンで OCR できず、
目視で書き起こしたもの。この 2 回は解答表画像でもう一度確認する。

**画像を見る問の絞り込み。** 50 問すべてを見る必要はない（`textPdf: true` の場合）。
`stemDrawings == 0` かつ `choiceImages` が空かつ `choicesDrawings` が小さい問はテキストだけで書ける。
図・写真・回路図がある問、フラグの付いた問、OCR 由来の問だけ `cells/qNN_row.png` を見る。row 画像 1 枚で問いと選択肢が両方確認できる。

**配線図面は必ず `pages/p15.png`。** `meta.json` の `figurePages` には `[4, 14, 15, 16]` のように
白紙ページも混ざるが、図面は常に 15 頁目である。作業前に一度開いて ①〜⑳ の位置と器具を把握しておく。
1 枚の図面に 20 問（通常 31〜50 問）がぶら下がる。

### 2-2. JSON を書く

出力先は `public/data/denko2/questions/<examId>.json`。50 問の配列で、`id` は `<examId>-<問番号>`（例 `denko2-2024-上期-12`）。
各項目の仕様は `docs/DATA_FORMAT.md` にある。ここでは判断の要る点だけ挙げる。

- **`category`** — 出題内容で決める。番号の並びは目安にとどめる（一般問題 1〜30、配線図 31〜50。
  一般問題の内訳は基礎理論 5 → 配電・配線設計 6 → 機器・材料・工具 7 → 施工方法 6 → 検査 4 → 法令 3 が目安で、年度によりずれる）
- **`stem`** — 原文どおり。実試験の太字（**不適切なものは**、**誤っているものは**）を再現する。
  「ただし，…」は改行して続ける。全角記号（，。〔〕）は原文のまま、単位は半角（100 V、1.6 mm、0.1 MΩ）
- **`choices`** — 4 つ。「イ．」等のラベルは含めない。写真・図の選択肢の書き方は `docs/DATA_FORMAT.md`「選択肢について」に従う
- **`explanation`**
  - `whyCorrect` — 2〜4 文。根拠の条番号・公式を含める
  - `whyOthersWrong` — 4 要素（正答の位置は `""`）。各 1〜2 文。できるだけ書く
  - `supplement` — 正解した人にも役立つ周辺知識・覚え方・頻出の引っかけ。2〜4 文
  - `references` — `"電技解釈 第17条"`、`"電気工事士法施行令 第1条"`、`"内線規程 3102-4"`、`"公式 P = V²/R"` など
- **`groupId`** — §3 のルール
- **`type` / `calcTemplate`** — §4 のルール
- **`status` / `note`** — §5 のルール
- **`source`** — `{ "year": 2024, "term": "上期", "session": "午前"（ある回のみ）, "number": 12 }`

計算問題（`type: "calc"`）では、アプリは `calcTemplate.explanation` と `supplement` を表示し、
`whyCorrect` と `whyOthersWrong` は表示しない（誤答が動的生成のため）。**解き方は `calcTemplate.explanation` に self-contained で書く。**

### 2-3. 図を公開用にコピー

```bash
python3 scripts/publish_figures.py public/data/denko2/questions/<examId>.json
```

参照先の画像が `cells/`・`pages/` から `public/data/denko2/figures/<examId>/` にコピーされる。
`MISSING` が出たら参照を直す。`figures/<examId>/qNN.png` は `cells/qNN_figure.png` → `qNN_stem.png` の順に解決される。

自動切り出しが不適切なとき（本文が入り込む、図が切れる）は、PyMuPDF でページから座標指定で切り出し、
`data/extracted/denko2/<examId>/custom/<name>.png` に置く。bbox は `questions_raw.json` にある。
横幅は「問い」欄の全幅を使い、y 方向だけ調整すると失敗しにくい。

### 2-4. 検証

**この順で通す。すべて通ってからコミットする。**

```bash
# 1. 公式解答と突き合わせ（欠番なし・不一致なしになるまで直す）
python3 scripts/check_answers.py <examId>
# 2. この回だけを検証（エラー 0 になるまで直す）
npx tsx scripts/validate-data.ts --exam <examId>
# 3. subject.json の questionFiles に "<examId>.json" を追加してから全体検証
npm run validate
npm test
```

`--exam` は `subject.json` に登録していない回も検証でき、`groups.json` に加えて
`data/review/denko2/<examId>.groups.json` も既知グループとして読む。
複数の回を並行して作るときは、**`groups.json` と `subject.json` を直接編集せず**、
新しいグループを `data/review/denko2/<examId>.groups.json` に
`{"subject":"denko2","groups":[{...}]}` の形で書く。統合は最後にまとめて行う。

### 2-5. レビューノートとコミット

`data/review/denko2/<examId>.md` に箇条書きで残す。

- OCR やテキストが読めず画像で判断した問
- `retired` にした問とその理由、`note` を付けた問
- 図の切り出しに手を入れた問
- `category` や `groupId` で迷った問
- 自信が持てなかった箇所（後で裏取りできるように）
- 仕様への提案

```bash
git add public/data/denko2 data/review
git commit -m "data(denko2): <examId> 50問を追加"
```

## 3. グループ化のルール

`groupId` は「同じ知識で解ける問題」をまとめる単位。1 問解ければ同グループの他問も解ける粒度にする。

- 命名は `g<分野番号>-<ローマ字の短い名前>`。例:
  `g1-gousei-teikou`（合成抵抗）、`g1-denryoku-netsuryou`（電力量と発熱量）、`g2-denatsu-kouka`（電圧降下）、
  `g2-kyoyou-denryu`（許容電流と電流減少係数）、`g4-setti-kouji`（接地工事の種類・接地抵抗値・省略条件）、
  `g5-zetsuen-teikou-kijun`（絶縁抵抗の基準値）、`g7-denkikoujishi-sagyou-hani`（電気工事士の作業範囲）
- 配線図問題は問の型でまとめる。例:
  `g6-zumen-kigou`（図記号の意味）、`g6-ringslv`（リングスリーブ）、`g6-sashikomi-connector`（差込形コネクタ）、
  `g6-densen-honsu`（電線の最少本数）、`g6-kigu-shashin`（器具写真）、`g6-kanchi-kougu`（工具写真）、
  `g6-haisen-houhou`（配線方法の適否）、`g6-fukusen-zu`（複線図・結線）
- 新しいグループを作ったら `public/data/denko2/groups.json` に `{id, name, category, summary}` を追加する
- **迷ったら細かく分ける。** 後で統合するほうが楽。ただし「同じ問題の年度違い」は必ず同じグループにする
- 1 グループは 1 分野に属する（validate が検査する）。分野をまたぐ関連は `relatedGroups` で示す
- 同じ年度の午前と午後は別問題だが問う知識は近い。グループ名を揃える

グループ化は 1 日の出題内容を決める土台になる。同じ `groupId` は 1 日 1 問しか出ないので、
粒度が粗いと似た問題ばかり、細かすぎると復習間隔が伸びない。

## 4. 計算問題のテンプレート化

数値を変えても解き方が同じ問題は `type: "calc"` にして数値をパラメータ化する。答えの丸暗記を防ぐため。

**対象** — 合成抵抗、オームの法則、電力・電力量・熱量、電圧降下、電力損失、力率、三相回路、
許容電流と電流減少係数、幹線・分岐回路の電流など。

**対象外** — 図の中に数値が描き込まれている問。図の数値は変えられないため矛盾する。
ただし「各抵抗は {R} Ω」のように問題文で言い換えられる場合は calc にしてよい。

- `params` は実試験で見るキリのよい値のプールにする（抵抗 5〜100、電圧 100/200、電流 5〜30、
  電線長 10〜50、断面積 2/3.5/5.5/8/14、時間 1〜3 など）。元問題の値を必ず含め、`original` に書く
- `accept` で答えが実試験らしい範囲・桁になる組合せだけ通す。割り切れない場合は `round` を 1〜2 にする
- `distractors` は「よくある間違い」を式で書く（公式の取り違え、2 倍・半分、単位換算ミス）
- `explanation` に途中式を書く。`{V}` `{R}` `{answer}` が実際の値に置換される
- `npm run validate` が全組合せを検査し、正答が選択肢に一意に存在することを確認する。
  エラーが出たらプールか `accept` を調整する

## 5. 法改正チェック

各問を現行の法令・規程と照らす。判断は 3 通り。

| 状況 | 対応 |
|---|---|
| 答えが変わる | `status: "retired"` ＋ `retiredReason`（何がどう変わったか） |
| 用語だけ変わった | 問題文は原文のまま。`note` に「現行法では『…』。出題当時の表記のまま掲載」 |
| 確信が持てない | `retired` にせず `note` に「要確認: …」。レビューノートにも書く |

押さえておく改正:

- **2023 年 3 月 20 日施行の電気事業法改正**（令和 4 年法律第 74 号）。出力 10 kW 以上 50 kW 未満の
  太陽電池発電設備と 20 kW 未満の風力発電設備が「小規模事業用電気工作物」として事業用電気工作物に移った。
  これに伴い電気工事士法の対象が「一般用電気工作物」から「**一般用電気工作物等**」（一般用電気工作物＋小規模事業用電気工作物）に変わった。
  用語だけの言い換えなら `note`、選択肢の正誤が変わるなら `retired`
- **内線規程は第 14 版（JEAC 8001-2022、2022 年 12 月発行）が最新**。基準値が改定された項目に注意
- **電技解釈の第 218 条・第 219 条（国際規格の取り入れ）は本試験に適用されない**（公式「学科試験のポイント」に明記）
- 「筆記試験」は 2023 年度から「学科試験」に改称された。アプリは出題年から自動で切り替えるので `note` は不要

条文を正確に思い出せない場合は、無理に書かず `note` の「要確認」に回す。誤った根拠を書くほうが害が大きい。

## 6. 効率のための指針

- 1 回分を 1 セッション・1 ファイルで仕上げる。50 問を一度に書いてよい（1 ファイル 100〜150 KB 程度）
- 画像を見るのは必要な問だけ（§2-1）。row 画像 1 枚で問いと選択肢を両方確認できる
- スキャン回は OCR の誤りが多い（「，」と「。」、「ー」と「一」、0 と O、単位）。全問を画像で確認する
- 迷ったら `docs/samples.json` と `denko2-2026-上期.json` の書き方に合わせる

## 7. 禁止事項

- 仕様（型・ファイル構成・検証ルール）を変えること。提案はレビューノートへ
- 市販教材・Web からの解説の転載
- 公式解答と異なる `answer` を入れること。公式が誤りだと思っても公式に合わせ、`note` に書く
- 図がないと解けない問を、図なしで `active` のままにすること
- `retiredReason` のない `retired`、根拠のない `retired`
- 問題文の改変。数値のバリエーションは `calcTemplate` で行う

## 8. 受け入れ基準と報告

コミット前に次をすべて満たすこと。

- [ ] 50 問ある。欠番がない
- [ ] `python3 scripts/check_answers.py <examId>` が「欠番なし・不一致なし」
- [ ] `npm run validate` がエラー 0
- [ ] `npm test` が通る
- [ ] 図がないと解けない問すべてに `figure` / `choicesFigure` / `sharedFigure` が付いている
- [ ] 全問に `whyCorrect`・`supplement`・`references` がある
- [ ] `retired` にした問すべてに `retiredReason` がある
- [ ] `subject.json` の `questionFiles` に追記した
- [ ] `groups.json` に新規グループを追加した
- [ ] レビューノートを書いた

報告は次を含める。

> examId / 問数 / active・retired の内訳 / calc の数 / `check_answers.py` の結果 / `npm run validate` の結果 /
> 自信の持てなかった箇所 / レビューノートのパス
