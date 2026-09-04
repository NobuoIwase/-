#!/usr/bin/env python3
"""完成した回を本体に取り込む。

  python3 scripts/merge_rounds.py            取り込む（groups.json と subject.json を更新）
  python3 scripts/merge_rounds.py --dry-run  何が変わるかだけ表示

やること:
1. data/review/denko2/<examId>.groups.json（各回が必要とした新規グループ）を
   public/data/denko2/groups.json に統合する。id が既にあれば既存を優先して捨てる
2. public/data/denko2/questions/ にある問題ファイルを
   public/data/denko2/subject.json の questionFiles に登録する（年度・期の順に並べる）

並行作業中でも安全に何度でも実行できる。取り込み後は npm run validate を通すこと。
"""
import argparse, glob, json, os, re, subprocess

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "public", "data", "denko2")
REVIEW = os.path.join(ROOT, "data", "review", "denko2")
TERM_ORDER = {"上期": 0, "下期": 1}
SESSION_ORDER = {None: 0, "午前": 0, "午後": 1}


def sort_key(name: str):
    m = re.match(r"denko2-(\d{4})-(上期|下期)(?:-(午前|午後))?", name)
    if not m:
        return (9999, 9, 9, name)
    return (int(m.group(1)), TERM_ORDER.get(m.group(2), 9), SESSION_ORDER.get(m.group(3), 9), name)


def check_round(exam: str):
    """登録してよい回かを判定する。問題なければ None、駄目なら理由の文字列。
    作業中の回（図がまだコピーされていない等）を取り込まないための門番。"""
    qs = json.load(open(os.path.join(DATA, "questions", exam + ".json"), encoding="utf-8"))
    if len(qs) != 50:
        return f"{len(qs)} 問しかない"
    r = subprocess.run(["python3", os.path.join(ROOT, "scripts", "check_answers.py"), exam],
                       capture_output=True, text=True, cwd=ROOT)
    if r.returncode != 0:
        return "公式解答と不一致: " + r.stdout.strip().splitlines()[-1][:120]
    r = subprocess.run(["npx", "tsx", os.path.join(ROOT, "scripts", "validate-data.ts"), "--exam", exam],
                       capture_output=True, text=True, cwd=ROOT)
    if r.returncode != 0:
        lines = [l for l in (r.stdout + r.stderr).splitlines() if l.startswith("ERROR")]
        return f"検証エラー {len(lines)} 件: " + (lines[0][:120] if lines else "")
    return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    # 1. グループの統合
    gpath = os.path.join(DATA, "groups.json")
    gfile = json.load(open(gpath, encoding="utf-8"))
    known = {g["id"] for g in gfile["groups"]}
    added = []
    for f in sorted(glob.glob(os.path.join(REVIEW, "*.groups.json"))):
        for g in json.load(open(f, encoding="utf-8")).get("groups", []):
            if g["id"] in known:
                continue
            if not re.match(r"^g[1-7]-[a-z0-9-]+$", g["id"]):
                print(f"  [skip] 命名規約に合わない id: {g['id']} ({os.path.basename(f)})")
                continue
            if int(g["id"][1]) != g.get("category"):
                print(f"  [skip] id と category が食い違う: {g['id']} category={g.get('category')}")
                continue
            known.add(g["id"])
            added.append({k: g[k] for k in ("id", "name", "category", "summary") if k in g})
    if added:
        gfile["groups"] = gfile["groups"] + added
        gfile["groups"].sort(key=lambda g: (g["category"], g["id"]))
    print(f"グループ: 既存 {len(known) - len(added)} + 新規 {len(added)} = {len(known)}")
    for g in added:
        print(f"  + {g['id']}  {g['name']}")

    # 2. questionFiles の更新（検証を通った回だけ登録する）
    spath = os.path.join(DATA, "subject.json")
    subject = json.load(open(spath, encoding="utf-8"))
    candidates = sorted((os.path.basename(p)[:-5] for p in glob.glob(os.path.join(DATA, "questions", "denko2-*.json"))),
                        key=sort_key)
    files, skipped = [], []
    for exam in candidates:
        why = check_round(exam)
        (files.append(exam + ".json") if why is None else skipped.append((exam, why)))
    new_files = [f for f in files if f not in subject["questionFiles"]]
    print(f"questionFiles: {len(subject['questionFiles'])} → {len(files)} 回")
    for f in new_files:
        print(f"  + {f}")
    for exam, why in skipped:
        print(f"  [保留] {exam}: {why}")
    subject["questionFiles"] = files

    if args.dry_run:
        print("(--dry-run のため書き込みなし)")
        return
    json.dump(gfile, open(gpath, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    json.dump(subject, open(spath, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    print("書き込み完了。npm run validate を実行すること")


if __name__ == "__main__":
    main()
