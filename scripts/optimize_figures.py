#!/usr/bin/env python3
"""写真の図を WebP に変換して軽くする。スマホでのオフライン保存量を減らすため。

  python3 scripts/optimize_figures.py --dry-run   変換対象と削減量を試算
  python3 scripts/optimize_figures.py             変換して問題JSONの参照も書き換える

対象は写真（選択肢の器具・工具写真）だけ。回路図・配線図面は線をたどって解く問題があるため
PNG のまま残す（可逆でないと細い線が崩れる恐れがある）。

WebP は iOS 14 以降・主要ブラウザすべてで表示できる。品質 92 では刻印や刃受の形状が
原本と見分けられないことを確認済み。
"""
import argparse, glob, json, os, re
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FIG = os.path.join(ROOT, "public", "data", "denko2", "figures")
QDIR = os.path.join(ROOT, "public", "data", "denko2", "questions")
QUALITY = 92
# 写真とみなすファイル名（選択肢の写真欄・個別写真）
PHOTO = re.compile(r"(_choices|_ans|_photo|_choice_\d+)\.png$")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--quality", type=int, default=QUALITY)
    args = ap.parse_args()

    targets = [p for p in sorted(glob.glob(os.path.join(FIG, "*", "*.png"))) if PHOTO.search(os.path.basename(p))]
    before = sum(os.path.getsize(p) for p in targets)
    after = 0
    mapping = {}  # 旧パス(figures/... ) → 新パス
    for p in targets:
        rel = "figures/" + os.path.relpath(p, FIG).replace(os.sep, "/")
        new_rel = rel[:-4] + ".webp"
        new_p = p[:-4] + ".webp"
        if args.dry_run:
            import io
            buf = io.BytesIO()
            Image.open(p).convert("RGB").save(buf, "WEBP", quality=args.quality, method=6)
            after += buf.tell()
        else:
            Image.open(p).convert("RGB").save(new_p, "WEBP", quality=args.quality, method=6)
            after += os.path.getsize(new_p)
            os.remove(p)
        mapping[rel] = new_rel

    print(f"写真 {len(targets)} 枚: {before/1e6:.1f} MB → {after/1e6:.1f} MB ({after/max(1,before)*100:.0f}%)")
    if args.dry_run:
        print("(--dry-run のため書き込みなし)")
        return

    # 問題JSONの参照を書き換える
    changed_files = 0
    for f in sorted(glob.glob(os.path.join(QDIR, "*.json"))):
        blob = open(f, encoding="utf-8").read()
        orig = blob
        for old, new in mapping.items():
            blob = blob.replace('"' + old + '"', '"' + new + '"')
        if blob != orig:
            open(f, "w", encoding="utf-8").write(blob)
            changed_files += 1
    print(f"問題JSON {changed_files} ファイルの参照を .webp に更新")

    kept = [p for p in glob.glob(os.path.join(FIG, "*", "*.png"))]
    print(f"PNG のまま残した図: {len(kept)} 枚 {sum(os.path.getsize(p) for p in kept)/1e6:.1f} MB（回路図・配線図面）")


if __name__ == "__main__":
    main()
