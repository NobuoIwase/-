# 過去問トレーナー（第二種電気工事士 学科試験）

第二種電気工事士 学科試験の公表問題を毎日 30 問ずつ解いて継続するための PWA。
静的ホスティングだけで動き、進捗は端末内（IndexedDB）に保存する。オフラインでも解ける。
二級ボイラー技士・第三種冷凍機械責任者を `subject` として後から足せる構造にしてある。

学科試験は四肢択一 50 問・120 分（一般問題 30 問程度、配線図問題 20 問程度）。
1 問 2 点の 100 点満点で、合格の目安は 60 点＝30 問正解。
本アプリの模擬試験もこの構成に合わせている。

## 現状

| 項目 | 状態 |
|---|---|
| アプリ本体 | 完成（デイリー練習・模擬試験・分野別集中・進捗・設定・PWA） |
| 公式 PDF の取得 | 27 回分（2015〜2026 年、問題 27・解答 27） |
| 素材の抽出 | 27 回すべて 50 問 |
| 問題データ | **27 / 27 回・1,350 問**（うち出題可能 1,348 問） |
| グループ（間隔反復の単位） | 159 個 |
| 計算問題（数値が毎回変わる） | 63 問 |

全問が公式解答と一致し、作成とは別のエージェントが原本画像と突き合わせて転記と解説を検証済み。
回ごとの判断・修正の記録は `data/review/denko2/<examId>.md` にある。
作成の分担は `docs/ROLE_DIVISION.md`、手順は `docs/OPUS_TASK.md`。

取得できていない回が 1 つある。2021 年度（令和 3 年度）下期の学科試験は公式サイトに掲載が見当たらない。
2020 年度上期は試験自体が実施されていない。

## 開発

```bash
npm ci
npm run dev        # http://localhost:5173
npm test           # 出題エンジン・計算テンプレートの単体テスト
npm run validate   # 問題データの検証（build 時にも走る）
npm run build      # dist/ を生成（service worker も生成）
```

## 構成

```
src/
  engine/scheduler.ts       間隔反復・分野配分・グループ重複回避・出題順
  engine/calc.ts            計算問題の数値バリエーション
  store/useAppStore.ts      セッション管理・統計更新
  pages/, components/       UI（スマホ縦画面優先、ダークモード）
public/data/                問題データ（JSON）と図（PNG）→ docs/DATA_FORMAT.md
scripts/
  extract_pdf.py            公式 PDF → 問ごとの画像・テキスト草稿・解答キー
  publish_figures.py        問題 JSON が参照する図を public/ にコピー
  crop_figure.py            「問い」欄の画像から図だけを切り出す
  dump_stems.py             問番号の範囲で27回分の問題文を横断一覧
  merge_rounds.py           完成した回を groups.json / subject.json に取り込む
  apply_premise.py          配線図問題に共通の前提条件を書き込む
  optimize_figures.py       写真を WebP に変換して軽量化
  check_answers.py          公式解答との突き合わせ
  validate-data.ts          データ検証（--exam で1回分だけも可）
data/raw/denko2/            公式 PDF・出典マニフェスト・手書き起こしの解答キー
data/extracted/denko2/      抽出結果（JSON は git 管理、PNG は再生成）
data/review/denko2/         回ごとのレビューノート
docs/ROLE_DIVISION.md       Fable 5.1 / Opus の役割分担
docs/OPUS_TASK.md           Opus 向け作業指示書
docs/DATA_FORMAT.md         データ形式仕様
docs/samples.json           問題 JSON の書式見本
```

技術スタックは Vite + React + TypeScript、状態管理に zustand、保存に Dexie（IndexedDB）、
PWA 化に vite-plugin-pwa。

抽出画像は git 管理外なので、必要な回だけ生成する。

```bash
python3 scripts/extract_pdf.py --list                    # 27 回の examId 一覧
python3 scripts/extract_pdf.py --exam denko2-2024-上期   # 1 回分（数分）
python3 scripts/extract_pdf.py                           # 全回（1 時間ほど）
```

## デプロイ

`main` に push すると GitHub Actions が GitHub Pages にデプロイする（`.github/workflows/deploy.yml`）。
リポジトリの Settings → Pages → Source を「GitHub Actions」にしておく。
公開 URL は `https://<owner>.github.io/<repo>/`。スマホで開いて「ホーム画面に追加」すればアプリとして起動する。

## 出典

問題は一般財団法人 電気技術者試験センターが公表している過去問題を使用している
（https://www.shiken.or.jp/construction/second/qa/ ）。
同センターは教育目的での利用に許諾・使用料を求めていないが、出典の明記と、改変した場合はその旨の明記を条件としている。

本アプリは各問の解説に出典（年度・期・試験区分・問番号・実施団体）を自動表示し、
計算問題で数値を変えた場合は「数値を変更して出題」と併記する。
表記は `public/data/denko2/subject.json` の `citation` テンプレートで変えられる（現在は西暦表記）。

解説は本アプリ独自のもので、市販教材からの転載はしていない。
