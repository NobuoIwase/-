# 問題データ形式仕様（public/data/<subject>/）

型定義の正本は `src/types.ts`。検証は `npm run validate`（`scripts/validate-data.ts`）。

## ディレクトリ

```
public/data/
  subjects.json                     試験種別の一覧
  denko2/
    subject.json                    分野定義・模擬試験設定・読み込む questions ファイルの一覧
    groups.json                     類似問題グループの定義
    questions/<examId>.json         1 回分の問題（配列）。examId 例: denko2-2023-上期-午前
    figures/<examId>/qNN.png        問題文の図
    figures/<examId>/qNN_choices.png 選択肢が写真・図のときの「答え」欄全体の画像
    figures/<examId>/qNN_choice_K.png 選択肢ごとの画像（任意）
    figures/<examId>/pNN.png        配線図面（配線図問題が共有する図面）
```

## Question（1 問）

```jsonc
{
  "id": "denko2-2023-上期-午前-12",       // 一意。`${examId}-${問番号}`
  "subject": "denko2",
  "category": 3,                          // 1〜7（subject.json の分野番号）
  "groupId": "g3-ringslv-kumiawase",      // 類似問題グループ。groups.json に定義（英数字とハイフン）
  "type": "static",                       // "static" | "calc"
  "stem": "①で示す部分に…（Markdown 可: **強調**, 改行は \n, 段落は \n\n）",
  "figure": "figures/denko2-2023-上期-午前/q12.png",          // 任意。問題文の図
  "sharedFigure": "figures/denko2-2023-上期-午前/p15.png",    // 任意。配線図問題の図面。同じ値の問は連続出題される
  "choicesFigure": "figures/denko2-2023-上期-午前/q12_choices.png", // 任意。選択肢が写真のとき
  "choiceFigures": ["...q12_choice_1.png", "...", "...", "..."],    // 任意。選択肢ごとの画像
  "choices": ["イの本文", "ロの本文", "ハの本文", "ニの本文"],        // 必ず 4 つ。choicesFigure がある場合は短い説明か "写真イ" 等
  "answer": 1,                            // 0=イ 1=ロ 2=ハ 3=ニ（公式解答と一致させる）
  "shuffleChoices": true,                 // 任意。省略時: static は true、calc と choicesFigure ありは false
  "explanation": {
    "whyCorrect": "正答の根拠（Claude 自身の言葉で。条番号・公式を添える）",
    "whyOthersWrong": ["イが違う理由", "", "ハが違う理由", "ニが違う理由"], // 任意。4 要素、正答の位置は ""
    "supplement": "正解したときにも出す補足・周辺知識・覚え方",
    "references": ["電技解釈 第29条", "内線規程 1350-3"]
  },
  "calcTemplate": { /* type が calc のとき。下記 */ },
  "status": "active",                     // "active" | "retired"
  "retiredReason": "…",                   // retired のとき必須
  "note": "現行法では「一般用電気工作物等」。出題当時の表記のまま掲載",  // 任意。出題時に表示
  "source": { "year": 2023, "term": "上期", "session": "午前", "number": 12 },
  "tags": ["リングスリーブ"]               // 任意
}
```

### 選択肢について

- 実試験の「イ・ロ・ハ・ニ」は表示位置のラベルであり、アプリが毎回シャッフルする（`shuffleChoices: false` 以外）
- 数値の選択肢は `"2.5"`, `"5"` のように単位なしの文字列。問題文側に〔Ω〕などの単位がある
- 選択肢が写真・図のとき: `choicesFigure` に「答え」欄全体の画像（イ〜ニのラベルが写っている）を入れ、
  `choices` は `["写真イ", "写真ロ", "写真ハ", "写真ニ"]` のようにラベルのみにして `shuffleChoices: false`（省略可、自動で false）
- 選択肢が図（回路図 4 つなど）でも同じ扱い
- `choices` に短い説明を入れるかどうかの指針:
  - **選択肢そのものが答えの識別対象**（「この図記号の器具の写真は」「この器具の図記号は」など、説明を書くと答えになる問）
    → `["写真イ", "写真ロ", "写真ハ", "写真ニ"]` / `["図イ", …]` のラベルのみ
  - **選択肢が条件の組合せを表す図・写真**（リングスリーブの種類と個数、コネクタの本数、測定方法の図、回路図の違いなど）
    → `["小 3個", "小 4個", "小 3個と中 1個", "小 1個と中 2個"]` のように内容を短く書く（画像が見づらい環境でも解ける）

### 図について

- 図がないと解けない問（「図のような回路で」「①で示す」など）には必ず画像を付ける
- `scripts/extract_pdf.py` が `cells/qNN_figure.png`（テキスト PDF のみ自動）と `cells/qNN_stem.png`（問い欄全体）を出力している
- `scripts/publish_figures.py <questions.json>` を実行すると、参照している `figures/<examId>/qNN.png` を
  `cells/qNN_figure.png`（無ければ `qNN_stem.png`）から自動コピーする。手動で切り出した画像は
  `data/extracted/denko2/<examId>/custom/<name>.png` に置けば同じ仕組みでコピーされる
- 配線図問題（分野 6）は `sharedFigure` に図面ページ（`pages/p15.png` → `figures/<examId>/p15.png`）を指定する

## CalcTemplate（計算問題の数値バリエーション）

```jsonc
{
  "params": { "V": [100, 200], "R": [10, 20, 25, 40, 50, 100] }, // キリのよい値のプール。元問題の値を必ず含める
  "formula": "V * V / R",                 // 正答を返す JS 式。params の名前と Math が使える
  "accept": "answer >= 100 && answer <= 4000", // 任意。実試験らしい範囲だけ採用
  "distractors": ["answer / 2", "answer * 2", "V * R / 10"], // 誤答の式。正答と重複したものは自動で捨てて補う
  "unit": "W",
  "round": 0,                             // 丸め桁（小数点以下）
  "explanation": "P = V²/R = {V}² ÷ {R} = **{answer} W**", // {param} と {answer} を置換。途中式を書く
  "original": { "V": 100, "R": 25 }       // 元の過去問の値
}
```

- `stem` の中でも `{V}` `{R}` のようにパラメータを参照する（元の数値をそのまま書かない）
- 検証スクリプトが全組合せで「正答が選択肢内に一意に存在」「採用可能な組合せが 1 つ以上」を確認する
- 図の中に数値が描かれている問（回路図に「5 Ω」など）は、図の数値が変わらないので **calc にしない**（static のまま）
  。ただし図の数値を問題文に書き直せる場合（「各抵抗は {R} Ω」）は calc にしてよい

## groups.json

```jsonc
{
  "subject": "denko2",
  "groups": [
    { "id": "g5-zetsuen-teikou-kijun", "name": "絶縁抵抗の基準値", "category": 5, "summary": "対地電圧区分ごとの基準（0.1/0.2/0.4 MΩ）" }
  ]
}
```

- 粒度: 「その問題を 1 問解けば同グループの他問題も正解できる」レベル
- 1 グループは 1 分野に属する（validate がチェック）。分野をまたいで同じ知識を問う場合（例: 配線図問題での絶縁抵抗の基準値）は
  別グループにし、任意の `relatedGroups: ["g5-zetsuen-teikou-kijun"]` で関連付ける（現状は表示のみ、出題制御には未使用）
- id は `g<分野番号>-<ローマ字の短い名前>`。人間が読んで意味が分かること

## subject.json

- `categories[].examCount` … 実試験 50 問中の出題数の目安。デイリー 30 問の分野別最低数はこれに比例
- `questionFiles` … `questions/` 配下で読み込むファイル名。新しい回を追加したら必ず追記する
- `citation` … 出典表記のテンプレート

## examId と source の対応

| examId | year | term | session |
|---|---|---|---|
| denko2-2026-上期 | 2026 | 上期 | （なし） |
| denko2-2023-上期-午前 | 2023 | 上期 | 午前 |
| denko2-2020-下期-午後 | 2020 | 下期 | 午後 |

年は西暦（令和 8 年度 = 2026）。`data/extracted/denko2/index.json` に全回の一覧がある。
