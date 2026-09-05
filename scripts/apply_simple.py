#!/usr/bin/env python3
"""「もっと分かりやすく！」の文章を問題データに流し込む。

  python3 scripts/apply_simple.py denko2-2024-上期 /tmp/simple-2024-上期.json

第2引数は {"問題ID": "本文", ...} の JSON。explanation.supplement の直後に simple を入れる。
既にある simple は上書きする。ファイル全体は書式（indent=2 / 日本語そのまま / 末尾改行なし）を保って書き戻す。
"""
import json, sys, os
from collections import OrderedDict

QDIR = 'public/data/denko2/questions'
ORDER = ['whyCorrect', 'whyOthersWrong', 'supplement', 'simple', 'references']

def main():
    if len(sys.argv) != 3:
        print(__doc__)
        sys.exit(1)
    exam, patch_path = sys.argv[1], sys.argv[2]
    path = os.path.join(QDIR, exam + '.json')
    qs = json.load(open(path, encoding='utf-8'))
    patch = json.load(open(patch_path, encoding='utf-8'))
    ids = {q['id'] for q in qs}
    unknown = [k for k in patch if k not in ids]
    if unknown:
        print('ERROR 知らない問題ID: ' + ', '.join(unknown))
        sys.exit(1)
    n = 0
    for q in qs:
        text = patch.get(q['id'])
        if text is None:
            continue
        text = text.strip()
        if not text:
            print(f'ERROR {q["id"]}: 空文字')
            sys.exit(1)
        ex = q['explanation']
        ex['simple'] = text
        q['explanation'] = OrderedDict(
            [(k, ex[k]) for k in ORDER if k in ex] + [(k, v) for k, v in ex.items() if k not in ORDER]
        )
        n += 1
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(qs, f, ensure_ascii=False, indent=2)
    missing = [q['id'] for q in qs if q.get('status') == 'active' and not (q['explanation'].get('simple') or '').strip()]
    print(f'{exam}: {n} 問に simple を書き込んだ（未記入 {len(missing)} 問）')
    if missing:
        print('  未記入: ' + ', '.join(missing))

if __name__ == '__main__':
    main()
