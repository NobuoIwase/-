#!/usr/bin/env python3
"""抽出済みの問題文を、問番号の範囲で横断的に一覧する（グループ体系の設計・重複調査用）。

  python3 scripts/dump_stems.py --from 1 --to 5              問1〜5 を全27回ぶん
  python3 scripts/dump_stems.py --from 28 --to 30 --chars 200
  python3 scripts/dump_stems.py --exam denko2-2024-上期       1回分すべて
  python3 scripts/dump_stems.py --grep 絶縁抵抗                問題文の検索

出力: <examId>\t<問番号>\t<問題文の先頭>
スキャン回の問題文は OCR 草稿なので誤字がある。傾向をつかむ用途に限る。
"""
import argparse, glob, json, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EX_DIR = os.path.join(ROOT, "data", "extracted", "denko2")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--from", dest="lo", type=int, default=1)
    ap.add_argument("--to", dest="hi", type=int, default=50)
    ap.add_argument("--exam", help="examId を1つに絞る")
    ap.add_argument("--grep", help="問題文・選択肢に含まれる語で絞る")
    ap.add_argument("--chars", type=int, default=120, help="表示する文字数（既定 120）")
    args = ap.parse_args()

    for path in sorted(glob.glob(os.path.join(EX_DIR, "denko2-*", "questions_raw.json"))):
        exam = os.path.basename(os.path.dirname(path))
        if args.exam and args.exam != exam:
            continue
        for q in json.load(open(path, encoding="utf-8")):
            n = q["number"]
            if not (args.lo <= n <= args.hi):
                continue
            body = (q.get("stemText") or "").strip()
            if args.grep and args.grep not in body and args.grep not in (q.get("choicesText") or ""):
                continue
            flat = re.sub(r"\s+", " ", body)[: args.chars]
            marks = "".join(
                m for m, on in (("N", q.get("numberGuessed")), ("M", q.get("previousMerged")),
                                ("F", bool(q.get("figure"))), ("P", bool(q.get("choiceImages")))) if on
            )
            print(f"{exam}\t{n}\t{marks}\t{flat}")


if __name__ == "__main__":
    try:
        main()
    except BrokenPipeError:  # head などで打ち切られた場合
        pass
