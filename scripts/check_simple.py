#!/usr/bin/env python3
"""explanation.simple（「もっと分かりやすく！」）の機械チェック。

  python3 scripts/check_simple.py                 全回
  python3 scripts/check_simple.py denko2-2024-上期 指定した回だけ

見るのは形式だけ（中身の正しさは人／検証エージェントが見る）:
  - active な問すべてに simple があるか
  - 長さ 80〜400 字
  - 文の数 3〜6（。で数える）
  - 未置換のプレースホルダ {x} が残っていないか（calc 問のパラメータ名は可）
  - 段落を分けていないか（\\n\\n）
  - 選択肢の記号「イ・ロ・ハ・ニ」を名指ししていないか（並び替えで変わるため）
  - **強調** が多すぎないか（3箇所以上）
"""
import json, sys, re, glob, os

QDIR = 'public/data/denko2/questions'
CHOICE_RE = re.compile(r'(?<![ァ-ヶー])(?:選択肢の)?[イロハニ](?:が|は|を|の|に|と|、|。|・)')

def check(path):
    name = os.path.basename(path)[:-5]
    qs = json.load(open(path, encoding='utf-8'))
    errs = []
    for q in qs:
        tag = q['id']
        s = q['explanation'].get('simple')
        if q.get('status') != 'active':
            continue
        if not s or not s.strip():
            errs.append(f'{tag}: simple がない')
            continue
        n = len(s)
        if n < 80:
            errs.append(f'{tag}: simple が短すぎる（{n}字）')
        if n > 400:
            errs.append(f'{tag}: simple が長すぎる（{n}字）')
        sent = len([x for x in s.split('。') if x.strip()])
        if sent < 3:
            errs.append(f'{tag}: 文が少ない（{sent}文・3〜5文にする）')
        if sent > 6:
            errs.append(f'{tag}: 文が多い（{sent}文・3〜5文にする）')
        allowed = set((q.get('calcTemplate') or {}).get('params', {}).keys())
        for m in re.findall(r'\{(\w+)\}', s):
            if m not in allowed:
                errs.append(f'{tag}: 未知のプレースホルダ {{{m}}}')
        if '\n\n' in s:
            errs.append(f'{tag}: 段落を分けている（1段落にする）')
        if s.count('**') > 4:
            errs.append(f'{tag}: **強調** が多い（1〜2箇所まで）')
        if CHOICE_RE.search(s):
            errs.append(f'{tag}: 選択肢の記号（イロハニ）を名指ししている（並び替えで変わる）')
    have = sum(1 for q in qs if (q['explanation'].get('simple') or '').strip())
    print(f'{name}: simple {have}/{len(qs)}, errors {len(errs)}')
    for e in errs:
        print('  ERROR ' + e)
    return len(errs)

def main():
    targets = [os.path.join(QDIR, a + '.json') for a in sys.argv[1:]] or sorted(glob.glob(QDIR + '/*.json'))
    total = sum(check(p) for p in targets)
    print(f'errors: {total}')
    sys.exit(1 if total else 0)

if __name__ == '__main__':
    try:
        main()
    except BrokenPipeError:
        pass
