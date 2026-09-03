# 過去問トレーナー（第二種電気工事士 学科試験）

第二種電気工事士 学科試験の公表問題（2015〜2026 年、27 回分）を毎日 30 問ずつ解いて継続するための PWA。
サーバーレス（静的ホスティング）、進捗は端末内（IndexedDB）に保存、オフライン対応。
将来、二級ボイラー技士・第三種冷凍機械責任者を `subject` として追加できる構造。

## 使い方（開発）

```bash
npm ci
npm run dev        # http://localhost:5173
npm test           # 出題エンジン・計算テンプレートの単体テスト
npm run validate   # 問題データの検証（build 時にも実行）
npm run build      # dist/ を生成（PWA の service worker も生成）
```

## 構成

```
src/                    アプリ本体（Vite + React + TypeScript + zustand + Dexie + vite-plugin-pwa）
  engine/scheduler.ts   間隔反復・分野配分・グループ重複回避・出題順
  engine/calc.ts        計算問題の数値バリエーション
  store/useAppStore.ts  セッション管理・統計更新
  pages/, components/   UI（スマホ縦画面優先、ダークモード）
public/data/            問題データ（JSON）と図（PNG）。詳細は docs/DATA_FORMAT.md
scripts/extract_pdf.py  公式 PDF → 問ごとの画像・テキスト草稿・解答キー
scripts/publish_figures.py  問題 JSON が参照する図を public/ にコピー
scripts/check_answers.py    公式解答との突き合わせ
scripts/validate-data.ts    データ検証
data/raw/denko2/        公式 PDF（54 ファイル）と出典マニフェスト
data/extracted/denko2/  抽出結果（JSON は管理、PNG は再生成）
docs/ROLE_DIVISION.md   Fable 5.1 / Opus の役割分担
docs/OPUS_TASK.md       Opus 向け作業指示書（問題データ作成）
docs/DATA_FORMAT.md     データ形式仕様
```

## デプロイ

`main` に push すると GitHub Actions が GitHub Pages にデプロイする（`.github/workflows/deploy.yml`）。
リポジトリの Settings → Pages → Source を「GitHub Actions」にしておく。
URL は `https://<owner>.github.io/<repo>/`。スマホで開いて「ホーム画面に追加」。

## 問題データの出典

一般財団法人 電気技術者試験センター「第二種電気工事士試験の問題と解答」
（https://www.shiken.or.jp/construction/second/qa/ ）。教育目的の利用は許諾不要・出典明記。
出典は各問の解説に自動表示される。解説は本アプリ独自のもの。
