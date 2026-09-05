#!/usr/bin/env python3
"""解説（whyCorrect / whyOthersWrong / supplement / references / note）を差分で書き換える。

  python3 scripts/apply_explanation.py denko2-2024-上期 /tmp/fix.json

/tmp/fix.json の形:
  {
    "denko2-2024-上期-12": {
      "whyCorrect": "…",
      "whyOthersWrong": ["…", "", "…", "…"],     // 4要素そろえる（正答の位置は空文字）
      "supplement": "…"
    }
  }

指定したキーだけ差し替える。stem・choices・answer・simple には触れない。
"""
import json, sys, os

QDIR = 'public/data/denko2/questions'
ALLOWED = {'whyCorrect', 'whyOthersWrong', 'supplement', 'references'}

def main():
    if len(sys.argv) != 3:
        print(__doc__)
        sys.exit(1)
    exam, patch_path = sys.argv[1], sys.argv[2]
    path = os.path.join(QDIR, exam + '.json')
    qs = json.load(open(path, encoding='utf-8'))
    patch = json.load(open(patch_path, encoding='utf-8'))
    by_id = {q['id']: q for q in qs}
    bad = [k for k in patch if k not in by_id]
    if bad:
        print('ERROR 知らない問題ID: ' + ', '.join(bad)); sys.exit(1)
    n = 0
    for qid, fields in patch.items():
        if not isinstance(fields, dict):
            print(f'ERROR {qid}: 値はオブジェクトにする'); sys.exit(1)
        extra = set(fields) - ALLOWED
        if extra:
            print(f'ERROR {qid}: 書き換えられない項目 {sorted(extra)}'); sys.exit(1)
        ex = by_id[qid]['explanation']
        for k, v in fields.items():
            if k == 'whyOthersWrong':
                if not isinstance(v, list) or len(v) != 4:
                    print(f'ERROR {qid}: whyOthersWrong は4要素の配列'); sys.exit(1)
                if (v[by_id[qid]['answer']] or '').strip():
                    print(f'ERROR {qid}: whyOthersWrong の正答の位置は空文字にする'); sys.exit(1)
            elif k == 'references':
                if not isinstance(v, list):
                    print(f'ERROR {qid}: references は配列'); sys.exit(1)
            elif not isinstance(v, str) or not v.strip():
                print(f'ERROR {qid}: {k} は空でない文字列にする'); sys.exit(1)
            ex[k] = v
        n += 1
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(qs, f, ensure_ascii=False, indent=2)
    print(f'{exam}: {n} 問の解説を書き換えた')

if __name__ == '__main__':
    main()
