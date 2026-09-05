#!/usr/bin/env python3
"""解説中の選択肢記号（イ・ロ・ハ・ニ）を {c0}〜{c3} に置き換える。

アプリは選択肢を並び替えて出題するので、出題時の記号をそのまま書いておくと
画面の並びとずれる。{cN} にしておけば、表示中の位置の記号に読み替えられる。

  python3 scripts/letterize.py --dry   置き換え箇所を全部出す（書き換えない）
  python3 scripts/letterize.py         書き換える
"""
import json, glob, re, sys, os

# 前がカタカナでなく、後ろが助詞・句読点・記号・行末のときだけ選択肢記号とみなす
PAT = re.compile(r'(?<![ァ-ヶーｦ-ﾟ])([イロハニ])(?=[がはをのにでともやも、。，．・）\)」\s\*]|$)')
IDX = {'イ': 0, 'ロ': 1, 'ハ': 2, 'ニ': 3}
FIELDS = ('whyCorrect', 'supplement')

def convert(text, hits):
    def sub(m):
        c = m.group(1)
        s = max(0, m.start() - 24)
        hits.append(text[s:m.start()] + '【' + c + '】' + text[m.end():m.end() + 24])
        return '{c%d}' % IDX[c]
    return PAT.sub(sub, text)

def main():
    dry = '--dry' in sys.argv
    total = 0
    for f in sorted(glob.glob('public/data/denko2/questions/*.json')):
        qs = json.load(open(f, encoding='utf-8'))
        changed = False
        for q in qs:
            ex = q['explanation']
            hits = []
            for k in FIELDS:
                if ex.get(k):
                    new = convert(ex[k], hits)
                    if new != ex[k]:
                        ex[k] = new
                        changed = True
            wow = ex.get('whyOthersWrong')
            if wow:
                for i, t in enumerate(wow):
                    if t:
                        new = convert(t, hits)
                        if new != t:
                            wow[i] = new
                            changed = True
            for h in hits:
                print(f'{q["id"]}\t{h}'.replace('\n', ' '))
            total += len(hits)
        if changed and not dry:
            with open(f, 'w', encoding='utf-8') as fp:
                json.dump(qs, fp, ensure_ascii=False, indent=2)
    print(f'置き換え候補: {total} 箇所', file=sys.stderr)

if __name__ == '__main__':
    try:
        main()
    except BrokenPipeError:
        pass
