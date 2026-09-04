#!/usr/bin/env python3
"""「問い」欄の画像から図の部分だけを切り出して custom/ に保存する。

スキャンPDFの回（2021年以前）では自動切り出し（cells/qNN_figure.png）が作られないため、
問題文と図が同じセル（cells/qNN_stem.png）に入っている。ここから図だけを取り出す。

  # 自動: 罫線的な長い横線が最初に現れる位置から下を図とみなす
  python3 scripts/crop_figure.py denko2-2015-上期 1 --auto

  # 手動: セル高さに対する比率で上下を指定（--auto の結果を見て微調整するとき）
  python3 scripts/crop_figure.py denko2-2015-上期 1 --y0 0.35 --y1 1.0

  # 「答え」欄から切り出す（選択肢が図のとき）
  python3 scripts/crop_figure.py denko2-2015-上期 27 --from choices --y0 0 --y1 1

出力: data/extracted/denko2/<examId>/custom/qNN_fig.png
      （問題JSONからは "figures/<examId>/qNN_fig.png" と参照する。publish_figures.py が custom/ から拾う）

--name を付ければ別名で保存できる（例: --name q41_photo → qNN 以外の名前にしたいとき）。
保存後は必ず Read ツールで画像を開いて、図が過不足なく入っているか目視で確かめること。
"""
import argparse, os, sys
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def auto_top(a: np.ndarray, min_run_ratio: float = 0.22, max_run_ratio: float = 0.93) -> int:
    """図が始まる y を推定する。長い横方向の黒の連続（回路図の導線・枠）が最初に現れる行。
    日本語の本文にはこれほど長い連続は出ないので、本文と図の境目になる。
    セルの外枠（幅いっぱいの罫線）と上下端は除外する。"""
    dark = a < 160
    h, w = a.shape
    lo, hi = int(w * min_run_ratio), int(w * max_run_ratio)
    for y in range(6, h - 6):
        row = dark[y]
        if not row.any():
            continue
        run = best = 0
        for v in row:
            run = run + 1 if v else 0
            if run > best:
                best = run
        if lo <= best <= hi:
            return max(0, y - 30)
    return 0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("exam_id")
    ap.add_argument("number", type=int)
    ap.add_argument("--from", dest="src", choices=["stem", "choices", "row"], default="stem")
    ap.add_argument("--auto", action="store_true", help="図の上端を自動推定して下端まで切り出す")
    ap.add_argument("--y0", type=float, help="上端（セル高さに対する比率 0〜1）")
    ap.add_argument("--y1", type=float, default=1.0, help="下端（比率）")
    ap.add_argument("--x0", type=float, default=0.0, help="左端（比率）")
    ap.add_argument("--x1", type=float, default=1.0, help="右端（比率）")
    ap.add_argument("--name", help="保存名（既定 qNN_fig）")
    args = ap.parse_args()

    base = os.path.join(ROOT, "data", "extracted", "denko2", args.exam_id)
    src = os.path.join(base, "cells", f"q{args.number:02d}_{args.src}.png")
    if not os.path.exists(src):
        sys.exit(f"ERROR 元画像がない: {src}")

    im = Image.open(src).convert("RGB")
    g = np.asarray(im.convert("L"))
    h, w = g.shape

    if args.auto and args.y0 is None:
        y0 = auto_top(g)
    else:
        y0 = int(h * (args.y0 if args.y0 is not None else 0.0))
    y1 = int(h * args.y1)
    x0, x1 = int(w * args.x0), int(w * args.x1)
    if y1 - y0 < 20 or x1 - x0 < 20:
        sys.exit(f"ERROR 切り出し範囲が小さすぎる: y {y0}-{y1} / x {x0}-{x1} (元 {w}x{h})")

    crop = im.crop((x0, y0, x1, y1))
    # 余白を詰める（内容の外接矩形 + 8px）
    gc = np.asarray(crop.convert("L")) < 220
    if gc.any():
        ys, xs = np.where(gc)
        m = 8
        crop = crop.crop((max(0, xs.min() - m), max(0, ys.min() - m),
                          min(crop.width, xs.max() + m), min(crop.height, ys.max() + m)))

    out_dir = os.path.join(base, "custom")
    os.makedirs(out_dir, exist_ok=True)
    name = args.name or f"q{args.number:02d}_fig"
    out = os.path.join(out_dir, f"{name}.png")
    crop.save(out)
    print(f"{out}  ({crop.width}x{crop.height})  元 {w}x{h} の y {y0}-{y1}")
    print(f'問題JSONからは "figures/{args.exam_id}/{name}.png" と参照する')


if __name__ == "__main__":
    main()
