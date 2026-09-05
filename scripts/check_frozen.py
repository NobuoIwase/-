#!/usr/bin/env python3
"""公式解答と突き合わせ済みの項目が書き換わっていないことを確かめる。

  python3 scripts/check_frozen.py <比較元のコミット> [examId ...]

stem / choices / answer / type / category / groupId / source / figure 類は
公式問題・公式解答と照合済みなので、解説の手直しでは絶対に動かしてはいけない。
1つでも違えば ERROR を出して終了コード1を返す。
"""
import json, subprocess, sys, glob, os

FROZEN = ('stem', 'choices', 'answer', 'type', 'category', 'groupId', 'status',
          'source', 'figure', 'sharedFigure', 'choicesFigure', 'choiceFigures',
          'premise', 'note', 'calcTemplate', 'shuffleChoices')
QDIR = 'public/data/denko2/questions'

def main():
    if len(sys.argv) < 2:
        print(__doc__); sys.exit(1)
    base = sys.argv[1]
    names = sys.argv[2:]
    files = [os.path.join(QDIR, n + '.json') for n in names] or sorted(glob.glob(QDIR + '/*.json'))
    bad = 0
    for path in files:
        try:
            old = json.loads(subprocess.run(['git', 'show', f'{base}:{path}'], capture_output=True, check=True).stdout.decode())
        except subprocess.CalledProcessError:
            print(f'SKIP {path}（{base} に無い）'); continue
        o = {q['id']: q for q in old}
        new = json.load(open(path, encoding='utf-8'))
        if len(new) != len(old):
            print(f'ERROR {path}: 問数が {len(old)} → {len(new)} に変わっている'); bad += 1
        for q in new:
            p = o.get(q['id'])
            if not p:
                print(f'ERROR {q["id"]}: 元データに無い問が増えている'); bad += 1; continue
            for k in FROZEN:
                if p.get(k) != q.get(k):
                    print(f'ERROR {q["id"]}: {k} が書き換わっている')
                    print(f'  元: {json.dumps(p.get(k), ensure_ascii=False)[:200]}')
                    print(f'  今: {json.dumps(q.get(k), ensure_ascii=False)[:200]}')
                    bad += 1
        for qid in o:
            if qid not in {q['id'] for q in new}:
                print(f'ERROR {qid}: 問が消えている'); bad += 1
    print(f'固定項目の書き換え: {bad}')
    sys.exit(1 if bad else 0)

if __name__ == '__main__':
    try:
        main()
    except BrokenPipeError:
        pass
