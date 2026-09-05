#!/usr/bin/env python3
"""解説に「出題時のまま」の選択肢記号（イ・ロ・ハ・ニ）が残っていないかを見る。

アプリは選択肢を並び替えて出題するので、解説で記号を名指しするときは
{c0}〜{c3}（出題時の順で 0=イ, 1=ロ, 2=ハ, 3=ニ）と書く必要がある。
並び替えない問（choicesFigure がある問・計算問題）はそのままでよい。

  python3 scripts/check_letters.py [examId ...]

判定は機械的なので、配線図の傍記（点滅器イ・照明ロ など）も引っかかる。
その場合は「候補」として出すだけで、エラーにはしない（--strict でエラーにする）。
"""
import json, glob, os, re, sys

PAT = re.compile(r'(?<![ァ-ヶーｦ-ﾟ])([イロハニ])(?=[がはをのにでともやもだなかへ、。，．・）\)」\s\*]|$)')
# 判定の言葉が近くにあれば「選択肢の名指し」とみなす
VERDICT = re.compile(r'^.{0,16}?(正解|正しい|正答|適切|不適切|不適当|誤り|誤っ|該当|当てはま|妥当)')
QDIR = 'public/data/denko2/questions'

def shuffles(q):
    s = q.get('shuffleChoices')
    if s is not None:
        return s
    return False if q.get('choicesFigure') else q['type'] != 'calc'

def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    strict = '--strict' in sys.argv
    files = [os.path.join(QDIR, a + '.json') for a in args] or sorted(glob.glob(QDIR + '/*.json'))
    hard = soft = 0
    for f in files:
        for q in json.load(open(f, encoding='utf-8')):
            if not shuffles(q):
                continue
            ex = q['explanation']
            fields = [('whyCorrect', ex.get('whyCorrect')), ('supplement', ex.get('supplement'))]
            fields += [(f'whyOthersWrong[{i}]', t) for i, t in enumerate(ex.get('whyOthersWrong') or [])]
            for k, t in fields:
                if not t:
                    continue
                for m in PAT.finditer(t):
                    tail = t[m.end():m.end() + 20]
                    verdict = bool(VERDICT.match(tail))
                    label = 'ERROR' if verdict or strict else 'note '
                    if verdict:
                        hard += 1
                    else:
                        soft += 1
                    print(f'{label} {q["id"]} {k}: …{t[max(0, m.start() - 26):m.start()]}【{m.group(1)}】{tail}…'.replace('\n', ' '))
    print(f'選択肢の名指しとみられるもの: {hard}、判断が要るもの（配線図の傍記など）: {soft}')
    sys.exit(1 if hard or (strict and soft) else 0)

if __name__ == '__main__':
    try:
        main()
    except BrokenPipeError:
        pass
