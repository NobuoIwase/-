#!/usr/bin/env python3
"""配線図問題（分野6）に、その回の共通の前提条件（premise）を書き込む。

実試験では配線図問題の冒頭（問題PDFの11頁目）に「図は，木造2階建住宅の配線図である」と
【注意】1〜8 が印刷されており、20問すべての答えの根拠になる。本アプリは1問ずつ出題するので、
この前提を各問に持たせないと単独で解けない。

  python3 scripts/apply_premise.py premises.json            適用する
  python3 scripts/apply_premise.py premises.json --dry-run  変更点だけ表示

premises.json の形式: {"denko2-2024-上期": "図は，木造2階建住宅の…", ...}
"""
import argparse, json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
QDIR = os.path.join(ROOT, "public", "data", "denko2", "questions")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("premises", help="examId → premise の JSON")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--category", type=int, default=6, help="適用する分野（既定 6＝配線図）")
    args = ap.parse_args()

    premises = json.load(open(args.premises, encoding="utf-8"))
    total = changed = 0
    for exam, text in sorted(premises.items()):
        path = os.path.join(QDIR, exam + ".json")
        if not os.path.exists(path):
            print(f"  [skip] {exam}: 問題ファイルがない")
            continue
        text = " ".join(text.split())
        qs = json.load(open(path, encoding="utf-8"))
        n = 0
        for q in qs:
            if q["category"] != args.category:
                continue
            total += 1
            if q.get("premise") != text:
                q["premise"] = text
                n += 1
        changed += n
        print(f"{exam}: 分野{args.category} {sum(1 for q in qs if q['category']==args.category)} 問中 {n} 問を更新")
        if not args.dry_run and n:
            json.dump(qs, open(path, "w", encoding="utf-8"), ensure_ascii=False, indent=2)

    print(f"合計 {total} 問中 {changed} 問に premise を設定" + ("（--dry-run のため書き込みなし）" if args.dry_run else ""))
    missing = [e for e in (os.path.basename(p)[:-5] for p in sorted(os.listdir(QDIR))) if e not in premises]
    if missing:
        print("premise が未指定の回:", ", ".join(missing))
        sys.exit(1)


if __name__ == "__main__":
    main()
