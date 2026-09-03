# 役割分担仕様書 — Fable 5.1（設計・システム・素材取得）／ Opus（問題データ作成）

## 0. なぜ分けるか

- Fable 5.1 は使用制限が厳しく、「PDF の文章を JSON に書き写す」「1,350 問分の解説を書く」といった
  **量が多くコピペに近い作業**に使うと制限を食いつぶす。
- そこで、**判断・設計・仕組み作り・素材のダウンロード**は Fable 5.1、
  **問題データを実際に作る作業（文字起こし・解説執筆・グループ分け・計算テンプレート化）**は Opus に割り当てる。
- Opus は `docs/OPUS_TASK.md` の指示書だけを読めば、追加の判断なしに作業を進められるようにしてある。

## 1. 分担表

| 領域 | 担当 | 状態 | 成果物 |
|---|---|---|---|
| 公式サイト調査・取得可能な年度の一覧化 | Fable 5.1 | 完了 | `data/raw/denko2/sources.json` |
| 過去問 PDF（問題・解答）のダウンロード | Fable 5.1 | 完了（27 回分 54 ファイル） | `data/raw/denko2/pdf/*.pdf` |
| PDF → 問ごとの画像・テキスト草稿・解答キーの自動抽出 | Fable 5.1 | 完了 | `scripts/extract_pdf.py`, `data/extracted/denko2/<回>/` |
| データモデル・JSON スキーマ・検証スクリプト | Fable 5.1 | 完了 | `src/types.ts`, `scripts/validate-data.ts`, `docs/DATA_FORMAT.md` |
| アプリ本体（出題エンジン・間隔反復・計算問題の数値変化・UI・PWA・進捗・設定） | Fable 5.1 | 完了 | `src/`, `vite.config.ts` |
| デザイン（スマホ縦・片手操作・ダークモード） | Fable 5.1 | 完了 | `src/styles.css` |
| デプロイ設定（GitHub Pages） | Fable 5.1 | 完了 | `.github/workflows/deploy.yml` |
| **問題データの作成**（文字起こし・正答付け・図の割り当て） | **Opus** | 未着手 | `public/data/denko2/questions/<回>.json` |
| **解説の執筆**（whyCorrect / whyOthersWrong / supplement / references） | **Opus** | 未着手 | 同上 |
| **類似問題のグループ化** | **Opus** | 未着手 | `public/data/denko2/groups.json` |
| **計算問題のテンプレート化**（数値プール・式・誤答ルール） | **Opus** | 未着手 | 各問の `calcTemplate` |
| **法改正チェック**（retired / note の付与） | **Opus** | 未着手 | 各問の `status` / `note` |
| **図・写真の公開用コピー** | **Opus**（スクリプト実行のみ） | 未着手 | `public/data/denko2/figures/<回>/*.png` |
| 品質チェック（自動） | 両者（スクリプト） | 整備済み | `npm run validate`, `npm test` |
| 最終レビュー・Opus の成果物の抜き取り確認 | Fable 5.1（または人間） | Opus 完了後 | — |

## 2. 引き継ぎの境界（インターフェース）

Fable 5.1 → Opus に渡すもの（すべてリポジトリ内にある）:

1. `data/raw/denko2/pdf/` — 公式 PDF（問題 27 回、解答 27 回）
2. `data/extracted/denko2/<examId>/` — `scripts/extract_pdf.py` の出力
   - `answers.json` … 公式解答キー（問番号 → イ/ロ/ハ/ニ）
   - `questions_raw.json` … 問ごとのテキスト草稿（2022 年以降は PDF から直接、2015〜2021 年は OCR）と画像パス
   - `cells/qNN_stem.png` / `qNN_choices.png` / `qNN_row.png` / `qNN_figure.png`（自動切り出しの図）/ `qNN_choice_K.png`
   - `pages/pNN.png` … 4 頁目以降の全頁画像（配線図面はここから）
   - `meta.json` … 年度・回・午前/午後・テキスト PDF かどうか・図面ページ番号
   - PNG は git 管理外。`python3 scripts/extract_pdf.py` で数分で再生成できる
3. `docs/DATA_FORMAT.md` — 出力 JSON の厳密な仕様
4. `docs/OPUS_TASK.md` — Opus への作業指示書（手順・品質基準・禁止事項・チェック方法）
5. `public/data/denko2/questions/samples.json` — 書式の見本（5 問）

Opus → Fable 5.1（または人間）に返すもの:

- `public/data/denko2/questions/denko2-<year>-<term>[-<session>].json`（1 回分 50 問ずつ）
- `public/data/denko2/groups.json`
- `public/data/denko2/figures/**`
- `subject.json` の `questionFiles` への追記
- `data/review/denko2/<examId>.md` … その回で判断に迷った点・retired にした理由・OCR が読めず画像で確認した問のリスト

## 3. 作業順序

```
[Fable 5.1 完了済み]  PDF取得 → 抽出 → アプリ実装 → 仕様書
        ↓
[Opus]  ① 2026-上期（テキストPDF・最新）で 1 回分を作り、npm run validate を通す
        ② 2024〜2025 の 4 回分（テキストPDF）
        ③ 2022〜2023 の 8 回分（テキストPDF、午前/午後）
        ④ 2015〜2021 の 14 回分（スキャン → OCR草稿 + 画像確認。時間がかかる）
        ⑤ groups.json の整理（全回を横断して類似問題をまとめ直す）
        ⑥ 計算問題のテンプレート化（分野1・2 中心）
        ⑦ 法改正チェックの総ざらい
        ↓
[Fable 5.1 / 人間]  抜き取りレビュー → main へマージ → GitHub Pages に自動デプロイ
```

新しい回ごとに **1 ファイル 1 コミット**にし、`npm run validate` が通った状態で push する。

## 4. 品質ゲート（Opus の成果物が満たすべきこと）

- `npm run validate` がエラー 0（スキーマ・画像存在・計算テンプレートの一意性）
- 正答が `answers.json` と全問一致（validate ではなく Opus が作成時に突き合わせる。指示書に手順あり）
- 解説は市販教材の転載禁止。根拠（電技解釈の条番号・省令条番号・公式）を `references` に入れる
- 2023 年の法改正（「一般用電気工作物」→「一般用電気工作物等」等）で答えが変わる問は `retired`、用語だけの違いは `note`
- 図が必要な問（stemDrawings > 0 や写真選択肢）は必ず `figure` / `choicesFigure` を付ける。図なしでは解けない問を図なしで出さない

## 5. 想定コスト（目安）

- 1 回分 50 問 ≒ 入力 15〜25 万トークン（画像込み）、出力 3〜5 万トークン
- 27 回分で入力 500〜700 万トークン、出力 100〜150 万トークン程度
- スキャン年度（2015〜2021）は画像確認が増えるため 1.5 倍ほど見込む

## 6. Opus セッションの起動方法（人間がやること）

1. Claude Code を Opus で起動し、このリポジトリを開く（ブランチ: 作業用ブランチを切る）
2. 最初のメッセージに以下を貼る:

```
docs/OPUS_TASK.md を読み、その手順どおりに第二種電気工事士の問題データを作成してください。
まず対象: denko2-2026-上期（1回分50問）。完了したら npm run validate を通し、コミットして報告してください。
```

3. 1 回分ごとに結果を確認し、次の回を指示する（または「残り全部」と指示する）
