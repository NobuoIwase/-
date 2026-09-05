#!/usr/bin/env python3
"""{c0}〜{c3} への置き換えが「記号を差し込みに替えただけ」であることを機械的に確かめる。

  python3 scripts/check_letterize_diff.py <比較元のコミット>

各問の whyCorrect / whyOthersWrong / supplement について、いまの本文の {cN} を
元の記号（0=イ,1=ロ,2=ハ,3=ニ）に戻したものが、比較元の本文と1文字も違わないことを確認する。
違いがあれば、置き換え以外の書き換えが混ざっている。
"""
import json, subprocess, sys, glob, os, re

LET = ['イ', 'ロ', 'ハ', 'ニ']
FIELDS = ('whyCorrect', 'supplement')

def unfill(t):
    return re.sub(r'\{c([0-3])\}', lambda m: LET[int(m.group(1))], t) if t else t

def main():
    base = sys.argv[1] if len(sys.argv) > 1 else 'HEAD'
    bad = 0
    changed = 0
    for path in sorted(glob.glob('public/data/denko2/questions/*.json')):
        try:
            old = json.loads(subprocess.run(['git', 'show', f'{base}:{path}'], capture_output=True, check=True).stdout.decode())
        except subprocess.CalledProcessError:
            print(f'SKIP {path}（{base} に無い）'); continue
        new = json.load(open(path, encoding='utf-8'))
        o = {q['id']: q for q in old}
        for q in new:
            p = o.get(q['id'])
            if not p:
                continue
            for k in FIELDS:
                a, b = p['explanation'].get(k), q['explanation'].get(k)
                if a == b:
                    continue
                changed += 1
                if unfill(b) != a:
                    bad += 1
                    print(f'ERROR {q["id"]} {k}: 置き換え以外の変更がある')
                    print(f'  元: {a}')
                    print(f'  今: {unfill(b)}')
            aw, bw = p['explanation'].get('whyOthersWrong') or [], q['explanation'].get('whyOthersWrong') or []
            for i, (a, b) in enumerate(zip(aw, bw)):
                if a == b:
                    continue
                changed += 1
                if unfill(b) != a:
                    bad += 1
                    print(f'ERROR {q["id"]} whyOthersWrong[{i}]: 置き換え以外の変更がある')
                    print(f'  元: {a}')
                    print(f'  今: {unfill(b)}')
    print(f'変更のあった本文: {changed}、置き換え以外の変更: {bad}')
    sys.exit(1 if bad else 0)

if __name__ == '__main__':
    main()
