#!/usr/bin/env python3
"""問題JSONの answer を公式解答 (data/extracted/.../answers.json) と突き合わせる。
   python3 scripts/check_answers.py denko2-2026-上期 [examId ...]   (引数なしなら questions/ 内の全ファイル)"""
import glob, json, os, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
M = "イロハニ"
ids = sys.argv[1:] or [os.path.basename(f)[:-5] for f in glob.glob(os.path.join(ROOT, "public/data/denko2/questions/denko2-*.json"))]
bad_total = 0
for ex in ids:
    qf = os.path.join(ROOT, "public/data/denko2/questions", ex + ".json")
    af = os.path.join(ROOT, "data/extracted/denko2", ex, "answers.json")
    if not os.path.exists(qf) or not os.path.exists(af):
        print(f"{ex}: ファイルなし ({qf if not os.path.exists(qf) else af})"); bad_total += 1; continue
    qs = json.load(open(qf, encoding="utf-8")); a = json.load(open(af, encoding="utf-8"))
    nums = sorted(q["source"]["number"] for q in qs)
    missing = [n for n in range(1, 51) if n not in nums]
    bad = [(q["source"]["number"], M[q["answer"]], a.get(str(q["source"]["number"]))) for q in qs if M[q["answer"]] != a.get(str(q["source"]["number"]))]
    print(f"{ex}: {len(qs)} 問, 欠番 {missing or 'なし'}, 不一致 {bad or 'なし'}")
    bad_total += len(bad) + len(missing)
sys.exit(1 if bad_total else 0)
