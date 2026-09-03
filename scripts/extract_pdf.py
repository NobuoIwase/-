#!/usr/bin/env python3
"""
第二種電気工事士 学科試験 公表問題PDF → 問ごとのセル画像 + テキスト草稿 + 解答キー を抽出する。

使い方:
  pip install pymupdf numpy pillow rapidocr   # 日本語OCR。入らなければ rapidocr-onnxruntime
  python3 scripts/extract_pdf.py                 # 全回
  python3 scripts/extract_pdf.py --exam 20260524_q01 --dpi 200

入力:  data/raw/denko2/pdf/<yyyymmdd>_co_second_q0N.pdf / a0N.pdf
出力:  data/extracted/denko2/<examId>/
          meta.json            試験回のメタ情報
          answers.json         {"1":"イ", ...}
          questions_raw.json   問ごとの bbox / テキスト草稿 / 埋め込み画像情報
          pages/pNN.png        4頁目以降の全頁画像（150dpi）
          cells/qNN_row.png    問の行全体
          cells/qNN_stem.png   「問い」セル
          cells/qNN_choices.png「答え」セル
          cells/qNN_choice_K.png 「答え」セル内の埋め込み画像（テキストPDFのみ、左から順）

仕組み: 全年度とも「番号 | 問い | 答え」の罫線表なので、描画画像の
黒画素投影で水平/垂直罫線を検出し、行=1問としてセルを切り出す。
テキストPDF(2022年以降)はセル内テキストを直接取得、
スキャンPDF(2015〜2021年)は RapidOCR で草稿テキストを生成する（要目視確認）。
"""
import argparse, json, os, re, sys, glob
import numpy as np
import pymupdf

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PDF_DIR = os.path.join(ROOT, "data", "raw", "denko2", "pdf")
OUT_DIR = os.path.join(ROOT, "data", "extracted", "denko2")

# 年度・回の対応（q01=午前, q02=午後。午前/午後のない回は session=None）
EXAMS = {
    "20150607": (2015, "上期"), "20151003": (2015, "下期"),
    "20160605": (2016, "上期"), "20161001": (2016, "下期"),
    "20170604": (2017, "上期"), "20170930": (2017, "下期"),
    "20180603": (2018, "上期"), "20181007": (2018, "下期"),
    "20190602": (2019, "上期"), "20191006": (2019, "下期"),
    "20201004": (2020, "下期"),
    "20210530": (2021, "上期"),
    "20220529": (2022, "上期"), "20221030": (2022, "下期"),
    "20230528": (2023, "上期"), "20231029": (2023, "下期"),
    "20240526": (2024, "上期"), "20241027": (2024, "下期"),
    "20250525": (2025, "上期"), "20251026": (2025, "下期"),
    "20260524": (2026, "上期"),
}

_ocr = None
def ocr_engine():
    """日本語認識モデル (rapidocr v3, PP-OCRv4 japan) を優先。無ければ rapidocr_onnxruntime (中国語モデル、仮名が落ちる)"""
    global _ocr
    if _ocr is None:
        try:
            from rapidocr import RapidOCR, LangRec, OCRVersion, ModelType
            eng = RapidOCR(params={"Rec.lang_type": LangRec.JAPAN, "Rec.ocr_version": OCRVersion.PPOCRV4,
                                   "Rec.model_type": ModelType.MOBILE, "Global.log_level": "warning"})
            _ocr = ("v3", eng)
        except Exception as e:  # noqa
            print("  [warn] rapidocr(japan) が使えません。rapidocr_onnxruntime にフォールバック:", e)
            from rapidocr_onnxruntime import RapidOCR
            _ocr = ("v1", RapidOCR())
    return _ocr

def ocr_text(pix):
    """pymupdf Pixmap → OCR テキスト（行を y でソートして結合）"""
    img = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.h, pix.w, pix.n)
    if pix.n == 1:
        img = np.repeat(img, 3, axis=2)
    elif pix.n == 4:
        img = img[:, :, :3]
    kind, eng = ocr_engine()
    if kind == "v3":
        res = eng(img[:, :, ::-1])
        if res is None or not res.txts:
            return ""
        items = list(zip(res.boxes, res.txts))
    else:
        res, _ = eng(img[:, :, ::-1])
        if not res:
            return ""
        items = [(r[0], r[1]) for r in res]
    items.sort(key=lambda r: (round(float(r[0][0][1]) / 12), float(r[0][0][0])))
    return "\n".join(t for _, t in items)

def _dilate_rows(dark, k=2):
    """縦方向に ±k 画素の論理和（スキャンの微小な傾きを吸収）"""
    out = dark.copy()
    for d in range(1, k + 1):
        out[d:] |= dark[:-d]
        out[:-d] |= dark[d:]
    return out

def _thin_rows(dark, k=5):
    """縦方向に「細い」黒だけ残す（±k 画素先も黒なら写真や塗りつぶしとみなして除外）"""
    up = np.zeros_like(dark); dn = np.zeros_like(dark)
    up[k:] = dark[:-k]
    dn[:-k] = dark[k:]
    return dark & ~up & ~dn

def detect_lines(page, dpi=150, thr=200):
    """罫線検出。戻り値: (水平線y座標リスト[pt], 垂直線x座標リスト[pt])
    - 罫線は「細い黒」（写真の青背景や塗りつぶしは太いので除外）
    - 垂直線: ページ高の20%以上続く → 表の上下端の間で85%以上を覆うものだけ採用
    - 水平線: 表幅の50%以上が黒 かつ 番号列部分も黒（写真の縁を除外）
    - スキャンの傾き対策として ±2px 膨張させて判定する"""
    pix = page.get_pixmap(dpi=dpi, colorspace=pymupdf.csGRAY)
    a = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.h, pix.w)
    dark = a < thr
    scale = 72.0 / dpi
    thin_v = _thin_rows(dark.T, 5).T   # 横に細い → 垂直線候補
    thin_h = _thin_rows(dark, 5)       # 縦に細い → 水平線候補
    darkc = _dilate_rows(thin_v.T, 2).T
    col = darkc.sum(axis=0) / pix.h
    vx = _cluster(np.where(col > 0.20)[0], gap=4)
    if len(vx) < 3:
        return [], []
    left, right = int(vx[0]), int(vx[-1])
    numx = int(vx[1])
    darkr = _dilate_rows(thin_h, 2)
    span = darkr[:, left:right + 1]
    row = span.sum(axis=1) / max(1, span.shape[1])
    numspan = darkr[:, left:numx + 1]
    rown = numspan.sum(axis=1) / max(1, numspan.shape[1])
    hy = _cluster(np.where((row > 0.50) & (rown > 0.50))[0], gap=4)
    if len(hy) >= 2:
        top, bottom = int(hy[0]), int(hy[-1])
        if bottom - top > 20:
            keep = []
            for x in vx:
                xi = int(x)
                cov = darkc[top:bottom + 1, max(0, xi - 2):xi + 3].any(axis=1).mean()
                if cov > 0.85:
                    keep.append(x)
            if len(keep) >= 3:
                vx = keep
    return [y * scale for y in hy], [x * scale for x in vx]

def _cluster(idx, gap=3):
    """連続する画素位置を1本の線にまとめる（中心を返す）"""
    if len(idx) == 0:
        return []
    out, start, prev = [], idx[0], idx[0]
    for i in idx[1:]:
        if i - prev > gap:
            out.append((start + prev) / 2.0)
            start = i
        prev = i
    out.append((start + prev) / 2.0)
    return out

def find_split_lines(page, left, right, numx, y0, y1, dpi=150, thr=200, frac=0.30):
    """結合された行 (y0,y1) の中から、弱い水平罫線を探す（閾値を下げて再判定）。戻り値: y座標[pt]のリスト"""
    clip = pymupdf.Rect(left, y0, right, y1)
    pix = page.get_pixmap(dpi=dpi, colorspace=pymupdf.csGRAY, clip=clip)
    a = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.h, pix.w)
    dark = _dilate_rows(_thin_rows(a < thr, 5), 2)
    scale = 72.0 / dpi
    nx = int((numx - left) / scale)
    row = dark.sum(axis=1) / max(1, dark.shape[1])
    rown = dark[:, :max(1, nx)].sum(axis=1) / max(1, nx)
    ys = _cluster(np.where((row > frac) & (rown > frac))[0], gap=4)
    margin = 30 / scale
    return [y0 + y * scale for y in ys if margin < y < pix.h - margin]

def number_positions(page, is_text, left, num_x, top, bottom, expected_start=1):
    """番号列（left〜num_x, top〜bottom）にある問番号とその y 中心 [(number, y)] を返す。
    テキストPDFは単語座標。スキャンは番号列の帯の黒画素投影で数字の塊を見つけ、塊ごとに OCR で数字を読む
    （読めなければ expected_start からの連番で補う）"""
    out = []
    if is_text:
        for w in page.get_text("words"):
            x0, y0, x1, y1, t = w[:5]
            t = t.strip()
            if re.fullmatch(r"[0-9]{1,2}", t) and left <= x0 < num_x and top <= y0 <= bottom:
                n = int(t)
                if 1 <= n <= 50:
                    out.append((n, (y0 + y1) / 2))
        out.sort(key=lambda t: t[1])
        return out
    dpi = 300
    scale = 72.0 / dpi
    strip = pymupdf.Rect(left + 2, top + 2, num_x - 2, bottom - 2)
    pix = page.get_pixmap(dpi=dpi, clip=strip, colorspace=pymupdf.csGRAY)
    a = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.h, pix.w)
    inner = a[:, int(pix.w * 0.15):int(pix.w * 0.85)]   # 左右の罫線の膨らみを避ける
    dark_rows = (inner < 160).sum(axis=1) >= 2
    idx = np.where(dark_rows)[0]
    blobs, s0, prev = [], None, None
    for i in idx:
        if s0 is None:
            s0 = prev = i
        elif i - prev > 6:
            blobs.append((s0, prev)); s0 = prev = i
        else:
            prev = i
    if s0 is not None:
        blobs.append((s0, prev))
    blobs = [(y0, y1) for (y0, y1) in blobs if 12 <= (y1 - y0) <= 70]
    kind, eng = ocr_engine()
    cands = []
    for (y0, y1) in blobs:
        pad = 8
        crop = a[max(0, y0 - pad):min(pix.h, y1 + pad), :]
        img = np.repeat(crop[:, :, None], 3, axis=2)
        img = np.kron(img, np.ones((2, 2, 1), dtype=np.uint8))  # 2倍に拡大
        n = None
        try:
            if kind == "v3":
                res = eng(img[:, :, ::-1])
                txt = "".join(res.txts) if res is not None and res.txts else ""
            else:
                res, _ = eng(img[:, :, ::-1])
                txt = "".join(r[1] for r in (res or []))
            m = re.search(r"\d{1,2}", txt.replace("O", "0").replace("o", "0").replace("l", "1").replace("I", "1"))
            if m and 1 <= int(m.group()) <= 50:
                n = int(m.group())
        except Exception:
            n = None
        cands.append((n, strip.y0 + (y0 + y1) / 2 * scale))
    # 連番で整合させる: 読めた番号が期待値と矛盾すれば連番を優先
    expect = expected_start
    for n, y in cands:
        if n is None or n < expect or n > expect + 2:
            n = expect
        out.append((n, y))
        expect = n + 1
    return out

def rows_from_numbers(nums, hy, table_top, table_bottom):
    """番号の y 位置から行境界を作る。各行の上端は番号の直上の罫線（30pt 以内）、無ければ番号の 10pt 上"""
    rows = []
    tops = []
    for n, y in nums:
        above = [h for h in hy if y - 30 <= h <= y]
        tops.append(max(above) if above else y - 10)
    for i, (n, y) in enumerate(nums):
        top = tops[i]
        if i + 1 < len(nums):
            bottom = tops[i + 1]
        else:
            below = [h for h in hy if h > y + 10]
            bottom = min(below) if below else table_bottom
        if bottom - top > 25:
            rows.append((top, bottom, n))
    return rows

def cell_text(page, rect):
    t = page.get_text("text", clip=rect)
    t = re.sub(r"[\x00-\x08\x0b-\x1f]", "", t)
    t = "\n".join(l.rstrip() for l in t.splitlines())
    return re.sub(r"\n{2,}", "\n", t).strip()

def has_drawing(page, rect, lines_h, lines_v):
    """罫線以外の描画(回路図など)がセル内にあるか（テキストPDF用）"""
    n = 0
    for d in page.get_drawings():
        r = d["rect"]
        if not r.intersects(rect):
            continue
        # 罫線（細長い水平・垂直線）は除外
        if r.width < 2 or r.height < 2:
            continue
        n += 1
    return n

def figure_bbox(page, cell, imgs, margin=4):
    """セル内の罫線以外の描画・画像の外接矩形（図の自動切り出し用）。無ければ None"""
    rects = list(imgs)
    for d in page.get_drawings():
        r = d["rect"]
        if not r.intersects(cell) or r.width < 2 or r.height < 2:
            continue
        # セル幅の95%以上の矩形（表の枠）は除外
        if r.width > cell.width * 0.95 and r.height > cell.height * 0.95:
            continue
        rects.append(r & cell)
    if not rects:
        return None
    u = rects[0]
    for r in rects[1:]:
        u = u | r
    if u.width < 30 or u.height < 20:
        return None
    u = pymupdf.Rect(u.x0 - margin, u.y0 - margin, u.x1 + margin, u.y1 + margin) & cell
    return u

def extract_exam(qpdf, apdf, exam_id, meta, dpi=200, page_dpi=150):
    out = os.path.join(OUT_DIR, exam_id)
    os.makedirs(os.path.join(out, "pages"), exist_ok=True)
    os.makedirs(os.path.join(out, "cells"), exist_ok=True)
    doc = pymupdf.open(qpdf)
    is_text = sum(len(p.get_text()) for p in doc) > 2000
    questions, seq = [], 0
    figure_pages = []
    for pno in range(3, len(doc)):
        page = doc[pno]
        page.get_pixmap(dpi=page_dpi, colorspace=pymupdf.csGRAY).save(
            os.path.join(out, "pages", f"p{pno+1:02d}.png"))
        hy, vx = detect_lines(page)
        rows = [(hy[i], hy[i + 1]) for i in range(len(hy) - 1) if hy[i + 1] - hy[i] > 40]
        if len(rows) > 0 and len(vx) >= 3:
            # 極端に高い行（他の行の 1.8 倍超）は 2 問が結合している可能性 → 弱い罫線で分割を試みる
            heights = sorted(y1 - y0 for (y0, y1) in rows)
            med = heights[len(heights) // 2]
            fixed = []
            for (y0, y1) in rows:
                if len(rows) >= 2 and (y1 - y0) > med * 1.8:
                    sp = find_split_lines(page, vx[0], vx[-1], vx[1], y0, y1)
                    if sp:
                        ys = [y0] + sp + [y1]
                        fixed += [(ys[i], ys[i + 1]) for i in range(len(ys) - 1) if ys[i + 1] - ys[i] > 40]
                        continue
                fixed.append((y0, y1))
            rows = fixed
        if len(rows) == 0 or len(vx) < 3:
            # 表がない頁 = 配線図面 or 注意書き。図面候補として記録
            if len(page.get_drawings()) > 50 or len(page.get_images()) > 0:
                figure_pages.append(pno + 1)
            continue
        # 列境界: 左端 | 番号 | 問い | 答え | 右端 (垂直線が5本未満なら推定)
        left, right = vx[0], vx[-1]
        inner = vx[1:-1]
        if len(inner) >= 2:
            num_x, mid_x = inner[0], inner[1]
        else:
            num_x = left + (right - left) * 0.03
            mid_x = inner[0] if inner else left + (right - left) * 0.41
        # 行境界は「番号の位置」から決める（写真行などで罫線が途切れても取りこぼさない）。
        # 番号が 3 件未満しか取れない頁は罫線ベースの行に番号を読んで付ける（従来方式）
        table_top, table_bottom = hy[0], hy[-1]
        nums = number_positions(page, is_text, left, num_x, table_top, table_bottom, expected_start=seq + 1)
        # 単調増加でないもの（誤読）を落とす
        cleaned = []
        for n, y in nums:
            if not cleaned or n > cleaned[-1][0]:
                cleaned.append((n, y))
        nums = cleaned
        if len(nums) >= 3 or (is_text and len(nums) >= 1):
            nrows = rows_from_numbers(nums, hy, table_top, table_bottom)
            rows = [(a, b) for (a, b, _) in nrows]
            numbers = [n for (_, _, n) in nrows]
        else:
            def read_number(y0, y1):
                num_rect = pymupdf.Rect(left, y0, num_x, y1)
                if is_text:
                    t = cell_text(page, num_rect)
                else:
                    t = ocr_text(page.get_pixmap(dpi=300, clip=num_rect))
                m = re.search(r"\d+", t)
                return int(m.group()) if m else None
            numbers = [read_number(y0, y1) for (y0, y1) in rows]
        looks_like_table = (num_x - left) < 40 and (mid_x - num_x) > 120
        if (not any(n is not None for n in numbers) and not looks_like_table) or seq >= 50:
            if len(page.get_drawings()) > 50 or len(page.get_images()) > 0:
                figure_pages.append(pno + 1)
            continue
        page_has_q = False
        for (y0, y1), number in zip(rows, numbers):
            if seq >= 50:
                break
            num_rect = pymupdf.Rect(left, y0, num_x, y1)
            stem_rect = pymupdf.Rect(num_x, y0, mid_x, y1)
            ch_rect = pymupdf.Rect(mid_x, y0, right, y1)
            if number is None:
                # ヘッダ行（問い/答え）や番号なし行はスキップ。ただしOCR失敗の可能性もあるので連番で補う
                if y1 - y0 < 45:
                    continue
                number = seq + 1
                guessed = True
            else:
                guessed = False
            skipped = False
            if number != seq + 1:
                if guessed or abs(number - (seq + 1)) > 3:
                    number = seq + 1
                    guessed = True
                elif number > seq + 1:
                    skipped = True  # 直前の行に複数問が結合している可能性
                elif number <= seq:
                    # OCR の誤読（9→8 など）。番号は単調増加なので連番で補正
                    number = seq + 1
                    guessed = True
            seq = number
            page_has_q = True
            tag = f"q{number:02d}"
            row_rect = pymupdf.Rect(left, y0, right, y1)
            page.get_pixmap(dpi=dpi, clip=row_rect).save(os.path.join(out, "cells", f"{tag}_row.png"))
            page.get_pixmap(dpi=dpi, clip=stem_rect).save(os.path.join(out, "cells", f"{tag}_stem.png"))
            page.get_pixmap(dpi=dpi, clip=ch_rect).save(os.path.join(out, "cells", f"{tag}_choices.png"))
            q = {
                "number": number, "page": pno + 1, "numberGuessed": guessed,
                "previousMerged": skipped,
                "rowBbox": [round(v, 1) for v in row_rect],
                "stemBbox": [round(v, 1) for v in stem_rect],
                "choicesBbox": [round(v, 1) for v in ch_rect],
                "textSource": "pdf" if is_text else "ocr",
                "images": {"row": f"cells/{tag}_row.png", "stem": f"cells/{tag}_stem.png",
                           "choices": f"cells/{tag}_choices.png"},
            }
            if is_text:
                q["stemText"] = cell_text(page, stem_rect)
                q["choicesText"] = cell_text(page, ch_rect)
                q["stemDrawings"] = has_drawing(page, stem_rect, hy, vx)
                q["choicesDrawings"] = has_drawing(page, ch_rect, hy, vx)
                # 答えセル内の埋め込み画像（写真選択肢）を左から順に保存
                imgs = []
                for img in page.get_images(full=True):
                    for r in page.get_image_rects(img[0]):
                        if r.intersects(ch_rect) and r.width > 20 and r.height > 20 and (r & ch_rect).get_area() > r.get_area() * 0.5:
                            imgs.append((r.x0, r))
                imgs.sort(key=lambda t: t[0])
                q["choiceImages"] = []
                for k, (_, r) in enumerate(imgs):
                    fn = f"cells/{tag}_choice_{k+1}.png"
                    page.get_pixmap(dpi=dpi, clip=r & ch_rect).save(os.path.join(out, fn))
                    q["choiceImages"].append({"file": fn, "bbox": [round(v, 1) for v in r]})
                stem_imgs = [r for img in page.get_images(full=True) for r in page.get_image_rects(img[0])
                             if r.intersects(stem_rect) and r.width > 20 and r.height > 20
                             and (r & stem_rect).get_area() > r.get_area() * 0.5]
                q["stemImages"] = len(stem_imgs)
                fb = figure_bbox(page, stem_rect, stem_imgs)
                if fb is not None:
                    fn = f"cells/{tag}_figure.png"
                    page.get_pixmap(dpi=dpi, clip=fb).save(os.path.join(out, fn))
                    q["figure"] = {"file": fn, "bbox": [round(v, 1) for v in fb],
                                   # bbox が問い欄の高さの 55% 超 → 本文のアンダーラインや空欄枠を拾っている疑い。要目視
                                   "suspicious": (fb.height > stem_rect.height * 0.55)}
            else:
                q["stemText"] = ocr_text(page.get_pixmap(dpi=300, clip=stem_rect))
                q["choicesText"] = ocr_text(page.get_pixmap(dpi=300, clip=ch_rect))
            questions.append(q)
        if not page_has_q and (len(page.get_drawings()) > 50 or len(page.get_images()) > 0):
            figure_pages.append(pno + 1)
    # 解答
    answers = extract_answers(apdf)
    meta = dict(meta, examId=exam_id, questionPdf=os.path.basename(qpdf), answerPdf=os.path.basename(apdf),
                textPdf=is_text, pages=len(doc), questionCount=len(questions), figurePages=figure_pages,
                answerSource=answers.pop("_source"))
    json.dump(meta, open(os.path.join(out, "meta.json"), "w"), ensure_ascii=False, indent=2)
    json.dump(questions, open(os.path.join(out, "questions_raw.json"), "w"), ensure_ascii=False, indent=2)
    json.dump(answers, open(os.path.join(out, "answers.json"), "w"), ensure_ascii=False, indent=2)
    return meta

def extract_answers(apdf):
    # 目視で書き起こした上書きファイルがあれば最優先（スキャン解答表の OCR が不十分な回）
    ov = os.path.join(PDF_DIR, "..", "answers_override", os.path.basename(apdf)[:-4] + ".json")
    if os.path.exists(ov):
        d = json.load(open(ov, encoding="utf-8"))
        ans = dict(d["answers"])
        ans["_source"] = "manual"
        return ans
    doc = pymupdf.open(apdf)
    page = doc[0]
    t = page.get_text()
    src = "pdf"
    if len(t.strip()) < 100:
        t = ocr_text(page.get_pixmap(dpi=300, colorspace=pymupdf.csGRAY))
        src = "ocr"
    # "問 解答" 表の並びは列優先(1..10,11..20,...)。トークン列から (番号, 記号) の対を拾う
    toks = re.findall(r"\d+|[イロハニ]", t)
    ans, i = {}, 0
    while i < len(toks) - 1:
        if toks[i].isdigit() and toks[i + 1] in "イロハニ":
            n = int(toks[i])
            if 1 <= n <= 50 and str(n) not in ans:
                ans[str(n)] = toks[i + 1]
            i += 2
        else:
            i += 1
    ans["_source"] = src
    return ans

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--exam", help="例: 20260524_q01 (省略時は全回)")
    ap.add_argument("--dpi", type=int, default=200)
    ap.add_argument("--index-only", action="store_true", help="抽出は行わず meta.json を集めて index.json を再生成")
    args = ap.parse_args()
    if args.index_only:
        metas = [json.load(open(f, encoding="utf-8")) for f in sorted(glob.glob(os.path.join(OUT_DIR, "denko2-*", "meta.json")))]
        json.dump(metas, open(os.path.join(OUT_DIR, "index.json"), "w"), ensure_ascii=False, indent=2)
        print(f"index.json: {len(metas)} exams")
        return
    results = []
    for qpdf in sorted(glob.glob(os.path.join(PDF_DIR, "*_co_second_q0*.pdf"))):
        base = os.path.basename(qpdf)
        date, sess = base[:8], base[-6:-4]  # "q01"→"01"
        key = f"{date}_q{sess}"
        if args.exam and args.exam != key:
            continue
        year, term = EXAMS[date]
        apdf = qpdf.replace("_q0", "_a0")
        has_pm = os.path.exists(os.path.join(PDF_DIR, f"{date}_co_second_q02.pdf"))
        session = ("午前" if sess == "01" else "午後") if has_pm else None
        exam_id = f"denko2-{year}-{term}" + (f"-{session}" if session else "")
        print(f"== {exam_id}  ({base})", flush=True)
        meta = extract_exam(qpdf, apdf, exam_id, {"subject": "denko2", "year": year, "term": term,
                                                  "session": session, "date": date}, dpi=args.dpi)
        print(f"   questions={meta['questionCount']} textPdf={meta['textPdf']} figurePages={meta['figurePages']} answers={meta['answerSource']}")
        results.append(meta)
    if not args.exam:
        json.dump(results, open(os.path.join(OUT_DIR, "index.json"), "w"), ensure_ascii=False, indent=2)

if __name__ == "__main__":
    main()
