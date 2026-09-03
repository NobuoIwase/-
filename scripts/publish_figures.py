#!/usr/bin/env python3
"""
問題JSONが参照する図画像を data/extracted から public/data/<subject>/figures へコピーする。

  python3 scripts/publish_figures.py public/data/denko2/questions/denko2-2026-上期.json

各問の figure / choicesFigure / sharedFigure / choiceFigures のパス（"figures/<examId>/<name>.png"）について、
public 側に無ければ data/extracted/denko2/<examId>/cells/ または pages/ から探してコピーする。
  figures/<examId>/qNN.png          ← cells/qNN_figure.png（無ければ cells/qNN_stem.png）
  figures/<examId>/qNN_choices.png  ← cells/qNN_choices.png
  figures/<examId>/qNN_choice_K.png ← cells/qNN_choice_K.png
  figures/<examId>/pNN.png          ← pages/pNN.png（配線図面）
それ以外の名前は data/extracted/denko2/<examId>/custom/<name>.png を探す（Opusが手動で切り出した画像置き場）。
"""
import json, os, shutil, sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def resolve(exam_id, name):
    base = os.path.join(ROOT, "data", "extracted", "denko2", exam_id)
    stem, _ = os.path.splitext(name)
    cands = []
    if stem.startswith("p") and stem[1:].isdigit():
        cands.append(os.path.join(base, "pages", name))
    elif "_choice" in stem:
        cands.append(os.path.join(base, "cells", name))
    elif stem.startswith("q") and stem[1:].isdigit():
        cands += [os.path.join(base, "cells", f"{stem}_figure.png"), os.path.join(base, "cells", f"{stem}_stem.png")]
    cands.append(os.path.join(base, "custom", name))
    for c in cands:
        if os.path.exists(c):
            return c
    return None

def main():
    files = sys.argv[1:]
    missing, copied = [], 0
    for f in files:
        qs = json.load(open(f, encoding="utf-8"))
        subject = qs[0]["subject"] if qs else "denko2"
        for q in qs:
            refs = [q.get("figure"), q.get("choicesFigure"), q.get("sharedFigure")] + list(q.get("choiceFigures") or [])
            for r in refs:
                if not r:
                    continue
                dst = os.path.join(ROOT, "public", "data", subject, r)
                if os.path.exists(dst):
                    continue
                parts = r.split("/")
                if len(parts) != 3 or parts[0] != "figures":
                    missing.append((q["id"], r)); continue
                src = resolve(parts[1], parts[2])
                if not src:
                    missing.append((q["id"], r)); continue
                os.makedirs(os.path.dirname(dst), exist_ok=True)
                # スマホ向けに幅1200px以下へ縮小し PNG→ 画質を保ったまま保存
                im = Image.open(src)
                if im.width > 1200:
                    im = im.resize((1200, int(im.height * 1200 / im.width)), Image.LANCZOS)
                im.save(dst, optimize=True)
                copied += 1
    print(f"copied {copied} images")
    if missing:
        print("MISSING:")
        for m in missing:
            print("  ", m)
        sys.exit(1)

if __name__ == "__main__":
    main()
