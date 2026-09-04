# 役割分担仕様書 — Fable 5.1 と Opus

## 0. 方針

作業を性質で 2 つに割り、モデルを使い分ける。

- **Fable 5.1** — 判断が要る仕事。設計、実装、デザイン、素材の取得と機械的な下ごしらえ、成果物のレビュー。
- **Opus** — 量が支配する仕事。過去問 1,350 問（27 回 × 50 問）の文字起こし、解説の執筆、グループ化、計算問題のテンプレート化、法改正チェック。

分ける理由は 2 つ。Fable 5.1 は使用制限が厳しく、1 問ずつ書き写す作業に充てると制限を使い切る。そして問題データの作成は、型と手順を先に固めれば判断をほぼ伴わない作業に落とせる。

切り出しが成立する条件は、Opus が追加の判断なしに着手できることである。そのために次の 4 つを先に用意した。

| # | 用意したもの | 実体 |
|---|---|---|
| 1 | 素材 | 公式 PDF と、そこから切り出した問ごとの画像・テキスト草稿・解答キー |
| 2 | 型 | `src/types.ts`（正本）と `docs/DATA_FORMAT.md` |
| 3 | 手順 | `docs/OPUS_TASK.md` |
| 4 | 自動検証 | `npm run validate` と `scripts/check_answers.py` |

## 1. 分担表

| 領域 | 担当 | 状態 | 成果物 |
|---|---|---|---|
| 公式サイト調査・取得可能な回の一覧化 | Fable 5.1 | 完了 | `data/raw/denko2/sources.json` |
| 過去問 PDF（問題・解答）の取得 | Fable 5.1 | 完了（27 回・54 ファイル） | `data/raw/denko2/pdf/` |
| PDF → 問ごとの画像・テキスト草稿・解答キーの抽出 | Fable 5.1 | 完了（27 回すべて 50 問） | `scripts/extract_pdf.py`, `data/extracted/denko2/` |
| データモデル・検証スクリプト | Fable 5.1 | 完了 | `src/types.ts`, `scripts/validate-data.ts`, `docs/DATA_FORMAT.md` |
| アプリ本体（出題エンジン・間隔反復・計算問題・UI・PWA） | Fable 5.1 | 完了 | `src/`, `vite.config.ts` |
| デザイン（スマホ縦・片手操作・ダークモード） | Fable 5.1 | 完了 | `src/styles.css` |
| デプロイ設定（GitHub Pages） | Fable 5.1 | 完了 | `.github/workflows/deploy.yml` |
| **問題データの作成**（文字起こし・正答付け・図の割り当て） | **Opus** | 完了（27 / 27 回・1,350 問） | `public/data/denko2/questions/<examId>.json` |
| **解説の執筆**（whyCorrect / whyOthersWrong / supplement / references） | **Opus** | 完了 | 同上 |
| **類似問題のグループ化** | **Opus** | 完了（159 グループ） | `public/data/denko2/groups.json` |
| **計算問題のテンプレート化** | **Opus** | 完了（63 問） | 各問の `calcTemplate` |
| **法改正チェック**（`status` / `note` の付与） | **Opus** | 完了（retired 2・note 30） | 各問の `status` / `note` |
| **図・写真の公開用コピー** | **Opus**（スクリプト実行） | 完了（645 点・39 MB） | `public/data/denko2/figures/<examId>/` |
| **転記と解説の検証**（作成とは別のエージェント） | **Opus** | 完了（26 回） | `data/review/denko2/<examId>.md` |
| 最終レビュー・統合・実機確認 | Opus | 完了 | — |

## 2. 引き継ぎの境界

### Fable 5.1 → Opus に渡すもの

すべてリポジトリ内にある。公式サイトへのアクセスは要らない。

| パス | 中身 |
|---|---|
| `data/raw/denko2/pdf/` | 公式 PDF（問題 27・解答 27） |
| `data/raw/denko2/sources.json` | 取得元 URL・利用条件・sha256 |
| `data/raw/denko2/answers_override/` | 解答表がスキャンで OCR できなかった回の、目視で書き起こした解答キー |
| `data/extracted/denko2/index.json` | 全 27 回の一覧（examId・年・期・午前午後・テキスト PDF か・図面ページ） |
| `data/extracted/denko2/<examId>/` | 1 回分の素材（下表） |
| `docs/DATA_FORMAT.md` | 出力 JSON の仕様 |
| `docs/OPUS_TASK.md` | 作業手順・品質基準・禁止事項 |
| `docs/samples.json` | 書式の見本（4 問） |
| `public/data/denko2/questions/denko2-2026-上期.json` | 完成済みの実例 50 問（レビュー済み） |

1 回分の素材（`data/extracted/denko2/<examId>/`）:

| ファイル | 中身 |
|---|---|
| `meta.json` | 年・期・午前午後・`textPdf`・`figurePages`・`answerSource` |
| `answers.json` | 公式解答キー（問番号 → イ/ロ/ハ/ニ） |
| `questions_raw.json` | 問ごとのテキスト草稿・bbox・画像パス・要注意フラグ |
| `cells/qNN_row.png` | 問 1 行ぶん（問いと選択肢が両方写る） |
| `cells/qNN_stem.png`, `qNN_choices.png` | 「問い」欄・「答え」欄 |
| `cells/qNN_figure.png` | 自動切り出しの図（テキスト PDF のみ） |
| `cells/qNN_choice_K.png` | 写真選択肢の 1 枚ずつ |
| `pages/pNN.png` | 4 頁目以降の全頁画像。配線図面は必ず `p15.png` |

PNG は git 管理外。`python3 scripts/extract_pdf.py --exam <examId>` で再生成する（全 27 回なら 1 時間ほど）。

### Opus → Fable 5.1 に返すもの

- `public/data/denko2/questions/<examId>.json`（1 回 50 問）
- `public/data/denko2/groups.json` への追記
- `public/data/denko2/figures/<examId>/`（`publish_figures.py` が生成）
- `public/data/denko2/subject.json` の `questionFiles` への追記
- `data/review/denko2/<examId>.md`（判断に迷った点・retired の理由・画像で確認した問・仕様への提案）

## 3. 進め方

テキスト PDF の回から始めてスキャン PDF の回に進む。テキスト PDF は問題文がそのまま取り出せるぶん速く、
先に片付けると型と勘所が固まる。

| 段階 | 回 | 数 | 状態 |
|---|---|---|---|
| ① パイロット | 2026 上期 | 1 | 完了 |
| ② テキスト PDF | 2022〜2025（午前・午後を含む） | 12 | 完了 |
| ③ スキャン PDF | 2015〜2021（午前・午後を含む） | 14 | 完了 |
| ④ 横断作業 | グループ体系の設計、配線図の前提条件、図記号の記述統一、画像の軽量化 | — | 完了 |

**実施方法**: ②③ は 1 回につき「作成」と「検証」の 2 エージェントを流す並列ワークフローで実行した。
検証側は作成側の自己申告を受け取り、原本画像と突き合わせて転記を疑い、解説の電気的・法令的な誤りを
探して直す。1 回あたり 6〜15 件の修正が入った。

進捗の正本は `public/data/denko2/subject.json` の `questionFiles`。ここに載っている回が完成した回である。

1 回ごとに 1 コミットし、`npm run validate` が通った状態で push する。全部まとめてからのコミットは避ける。
途中で仕様の不備に気づいても仕様は変えず、レビューノートに提案として書き残す（判断は Fable 5.1 か人間が行う）。

## 4. 品質ゲート

Opus の成果物は次をすべて満たすこと。①〜③ は機械で確認でき、④〜⑥ は書き手が担保する。

1. `python3 scripts/check_answers.py <examId>` が「欠番なし・不一致なし」
2. `npm run validate` がエラー 0
3. `npm test` が通る
4. 解説は市販教材・Web 記事の転載でなく、根拠（条番号・公式・法則名）を `references` に持つ
5. 図がないと解けない問に図が付いている
6. 現行法令で答えが変わる問は `retired`、用語だけの違いは `note`

## 5. 想定コスト

パイロット（2026 上期・テキスト PDF・50 問）の実測は **約 33 万トークン、ツール呼び出し 120 回、42 分**。
成果は 50 問すべて active、計算問題 2、図 24 点、公式解答と全問一致、validate エラー 0。

ここから残り 26 回を見積もると次のとおり。

| 区分 | 回数 | 1 回あたり | 小計 |
|---|---|---|---|
| テキスト PDF | 12 | 約 33 万トークン | 約 400 万 |
| スキャン PDF | 14 | 約 50 万トークン（画像確認が増えるため 1.5 倍） | 約 700 万 |
| 合計 | 26 | — | **約 1,100 万トークン・実時間 20〜25 時間** |

Fable 5.1 側の残作業は抜き取りレビューだけで、1 回あたり 1〜2 万トークン。

## 6. Opus セッションの始め方

1. Claude Code を Opus で起動し、このリポジトリを作業用ブランチで開く
2. 最初のメッセージに次を貼る（`denko2-2024-上期` の部分を対象の回に差し替える）

```
docs/OPUS_TASK.md の手順どおりに、第二種電気工事士 学科試験の問題データを作成してください。
対象は denko2-2024-上期（1 回分 50 問）です。
scripts/check_answers.py と npm run validate を通し、レビューノートを書いてコミットしてから報告してください。
```

3. 報告を確認し、次の回を指示する。回の一覧は `python3 scripts/extract_pdf.py --list` で出せる

## 7. 素材についての既知の制約

- **2021 年度（令和 3 年度）下期の学科試験は取得できていない。** 公式サイトの「試験問題と解答」ページに
  掲載が見当たらず、日付総当たりでも PDF が見つからなかった。掲載が確認できたら
  `data/raw/denko2/pdf/` に追加し、`scripts/extract_pdf.py` の `EXAMS` に日付を足せば取り込める。
- **2020 年度（令和 2 年度）上期は実施されていない**ため存在しない。
- **2023 年度下期（午前・午後）の解答 PDF はスキャン画像**で、OCR が実用精度に届かなかった。
  解答表を目視で書き起こして `data/raw/denko2/answers_override/` に置き、抽出時にそちらを優先している
  （`meta.json` の `answerSource` が `manual`）。この 2 回は問題データ作成時に解答表画像で再確認すること。
