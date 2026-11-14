# -*- coding: utf-8 -*-
"""本番用（演台に置いて使う）台本を作る。  python3 stage.py

- 1ページに複数スライドを詰めて、めくる回数を減らす
- めくる位置は、動画・実技の最中かパートの切れ目を優先する
- スライドごとに大きな字のキーワード行、その下に小さな字で全文
"""
import json
import pathlib
import subprocess

from build import esc, fmt_clock, fmt_len, part_of
from content import PARTS, SLIDES, TITLE
from cues import CUES, PAUSE_SLIDES

HERE = pathlib.Path(__file__).parent
MM = 96 / 25.4            # 1mm あたりの CSS px
PAGE_W, PAGE_H = 210, 297
MARGIN = 8                # mm
HEAD_H, FOOT_H = 7, 9     # mm
BODY_H = PAGE_H - 2 * MARGIN - HEAD_H - FOOT_H - 2   # 余裕 2mm

CSS = f"""
@page {{ size: A4; margin: {MARGIN}mm; }}
:root {{ --blue:#1e98d7; --navy:#1f3a5a; --orange:#f26a3f; --ink:#26313d; --sub:#66727f;
        --line:#d9e2ec; --pale:#eef6fc; --yellow:#fff1b0; }}
* {{ box-sizing: border-box; }}
body {{ margin:0; font-family:"IPAPGothic","IPAGothic",sans-serif; color:var(--ink); background:#fff; }}
.sheet {{ width:{PAGE_W - 2*MARGIN}mm; height:{PAGE_H - 2*MARGIN}mm; display:flex; flex-direction:column;
          break-after: page; overflow:hidden; }}
.sheet:last-child {{ break-after: auto; }}
.phead {{ height:{HEAD_H}mm; display:flex; justify-content:space-between; align-items:center;
          font-size:9pt; color:var(--sub); border-bottom:0.4mm solid var(--navy); }}
.phead b {{ color:var(--navy); font-size:10.5pt; }}
.body {{ flex:1; padding-top:1.5mm; }}
.pfoot {{ height:{FOOT_H}mm; display:flex; align-items:center; justify-content:space-between;
          font-size:9.5pt; border-top:0.3mm solid var(--line); color:var(--sub); }}
.pfoot .turn {{ background:var(--navy); color:#fff; padding:0.8mm 3mm; border-radius:1.2mm; }}
.pfoot .turn.easy {{ background:var(--orange); }}
.band {{ background:var(--blue); color:#fff; border-radius:1.2mm; padding:1mm 3mm; margin:1mm 0 1.5mm;
         font-size:10pt; display:flex; gap:3mm; align-items:baseline; }}
.band b {{ font-size:11.5pt; }}
.band span {{ font-size:8.5pt; opacity:.95; }}
.blk {{ display:grid; grid-template-columns:17mm 36mm 1fr; column-gap:3mm; padding:1.6mm 0;
        border-bottom:0.25mm solid var(--line); }}
.no {{ font-size:19pt; color:var(--orange); font-weight:bold; line-height:1; }}
.clock {{ font-size:11pt; color:var(--navy); font-weight:bold; margin-top:1mm; }}
.dur {{ font-size:8pt; color:var(--sub); }}
.thumb img {{ width:36mm; border-radius:0.8mm; border:0.25mm solid var(--line); display:block; }}
.thumb .ttl {{ font-size:7.5pt; color:var(--sub); line-height:1.3; margin-top:0.8mm; }}
.cue {{ font-size:12pt; color:var(--navy); font-weight:bold; line-height:1.5; margin-bottom:0.8mm; }}
.cue i {{ font-style:normal; color:var(--orange); margin:0 1.2mm; font-weight:normal; }}
.full {{ font-size:8.6pt; line-height:1.55; color:#3c4855; }}
.full p {{ margin:0 0 0.6mm; }}
.full .nt {{ color:var(--sub); font-size:8pt; }}
.full .nt b {{ background:var(--sub); color:#fff; font-weight:normal; padding:0 1.2mm; border-radius:0.6mm;
               margin-right:1mm; font-size:7pt; }}
.full .fl {{ background:var(--yellow); padding:0.3mm 1.5mm; border-radius:0.6mm; color:var(--ink); }}
.full .qa {{ margin:0 0 0.5mm; }}
.measure .sheet {{ height:auto; overflow:visible; }}
.seg {{ white-space:nowrap; }}
.guide {{ margin-top:3mm; border:0.4mm solid var(--line); border-radius:1.5mm; padding:2mm 3.5mm;
          font-size:9pt; line-height:1.65; }}
.guide h3 {{ margin:0 0 1mm; font-size:10.5pt; color:var(--navy); }}
.guide .tag {{ display:inline-block; color:#fff; border-radius:0.8mm; padding:0 1.5mm; font-size:8pt; }}
"""


GUIDE = """<div class='guide'><h3>この台本の見方</h3>
<div>・大きな字の一行（キーワード）だけを目で追い、話すのは自分の言葉で。下の小さな字は、詰まったときの控えです。</div>
<div>・左の時刻は「研修開始から何分でこのスライドに入るか」。手元のタイマーと比べ、遅れていたら次の小さな字を読まずにキーワードだけで進めます。</div>
<div>・各ページの左下に、めくるタイミングを書いています。<span class='tag' style='background:#f26a3f'>オレンジ</span>は動画・実技の最中やパートの切れ目で、手が空いているときにめくれます。<span class='tag' style='background:#1f3a5a'>紺</span>はそのスライドを話し終えたところでめくります。</div>
<div>・右下に、めくった先の最初のスライドを書いています。めくる前に次の話の入り方を確かめられます。</div>
</div>"""


def block_html(s, first_of_part):
    num, name, start, end, rng, aim = part_of(s["no"])
    out = []
    if first_of_part:
        out.append(f"<div class='band'><b>{num} {esc(name)}</b>{fmt_clock(start*60)}〜{fmt_clock(end*60)}"
                   f"<span>{esc(aim)}</span></div>")
    cue = "<i>▸</i>".join(f"<span class='seg'>{esc(c)}</span>" for c in CUES[s["no"]].split("｜"))
    full = []
    for kind, text in s["blocks"]:
        k = kind.rstrip("+")
        if k == "say":
            full.append(f"<p>{esc(text)}</p>")
        elif k == "note":
            full.append(f"<p class='nt'><b>進行</b>{esc(text)}</p>")
        elif k == "prep":
            continue  # 準備メモは本番では不要
        elif k == "fill":
            full.append(f"<p><span class='fl'>{esc(text)}</span></p>")
        elif k == "qa":
            q, a = text.split("|")
            full.append(f"<p class='qa'><b>Q</b> {esc(q)}　<b>A</b> {esc(a)}</p>")
    out.append(f"""<div class='blk'>
      <div><div class='no'>{s['no']:02d}</div><div class='clock'>{fmt_clock(s['_clock'])}</div>
           <div class='dur'>{fmt_len(s['sec'])}</div></div>
      <div class='thumb'><img src='slides/s-{s['no']:02d}.png'><div class='ttl'>{esc(s['title'])}</div></div>
      <div><div class='cue'>{cue}</div><div class='full'>{''.join(full)}</div></div>
    </div>""")
    return "<div class='unit'>" + "".join(out) + "</div>"


def units():
    clock, res, seen = 0, [], set()
    for s in SLIDES:
        s["_clock"] = clock
        p = part_of(s["no"])
        res.append(block_html(s, p[0] not in seen))
        seen.add(p[0])
        clock += s["sec"]
    return res


def doc(body):
    return (f"<!doctype html><html lang='ja'><head><meta charset='utf-8'><title>{esc(TITLE)}（本番用）</title>"
            f"<style>{CSS}</style></head><body>{body}</body></html>")


def node(js, *args):
    return subprocess.run(["node", "-e", js, *args], check=True, capture_output=True, text=True).stdout


def measure(us):
    path = HERE / "_measure.html"
    path.write_text(doc("<div class='measure'><div class='sheet'><div class='body'>" + "".join(us)
                        + "</div></div></div>"), encoding="utf-8")
    js = ("const {chromium}=require('playwright');(async()=>{const b=await chromium.launch();"
          "const p=await b.newPage();await p.goto(process.argv[1]);await p.waitForLoadState('networkidle');"
          "const h=await p.$$eval('.unit',e=>e.map(x=>x.getBoundingClientRect().height));"
          "console.log(JSON.stringify(h));await b.close();})();")
    hs = json.loads(node(js, path.resolve().as_uri()))
    path.unlink()
    return [h / MM for h in hs]


def paginate(hs):
    """ページ数を最小にしつつ、めくりやすい位置（動画・実技中、パートの切れ目）で区切る"""
    n = len(SLIDES)
    good = set(PAUSE_SLIDES) | {p[4][1] for p in PARTS}
    INF = float("inf")
    best = [0.0] + [INF] * n
    prev = [0] * (n + 1)
    for j in range(1, n + 1):
        for i in range(j - 1, -1, -1):
            if sum(hs[i:j]) > BODY_H:
                break
            last = SLIDES[j - 1]["no"]
            cost = best[i] + 1 + (0 if (last in good or j == n) else 1.5)
            if cost < best[j]:
                best[j], prev[j] = cost, i
    groups, j = [], n
    while j:
        groups.append((prev[j], j)); j = prev[j]
    return groups[::-1]


def main():
    us = units()
    hs = measure(us)
    too_big = [SLIDES[i]["no"] for i, h in enumerate(hs) if h > BODY_H]
    if too_big:
        raise SystemExit(f"1ページに入らないスライド: {too_big}")
    groups = paginate(hs)
    total = len(groups)
    sheets = []
    for k, (i, j) in enumerate(groups):
        a, b = SLIDES[i], SLIDES[j - 1]
        t0, t1 = a["_clock"], b["_clock"] + b["sec"]
        head = (f"<div class='phead'><div><b>スライド {a['no']}〜{b['no']}</b>　{fmt_clock(t0)}〜{fmt_clock(t1)}</div>"
                f"<div>{esc(TITLE)}（本番用）　{k+1} / {total}</div></div>")
        if k + 1 < total:
            nxt = SLIDES[j]
            when = PAUSE_SLIDES.get(b["no"])
            if when:
                turn = f"<span class='turn easy'>スライド{b['no']}の{when}にめくる</span>"
            elif b["no"] in {pt[4][1] for pt in PARTS}:
                turn = f"<span class='turn easy'>パートの切れ目：次のパートに入る前にめくる</span>"
            else:
                turn = f"<span class='turn'>スライド{b['no']}を話し終えたらめくる</span>"
            foot = (f"<div class='pfoot'>{turn}<span>次のページ ▸ スライド{nxt['no']}「{esc(nxt['title'])}」"
                    f"　{fmt_clock(nxt['_clock'])}〜</span></div>")
        else:
            foot = "<div class='pfoot'><span>おわり</span><span>お疲れさまでした</span></div>"
        extra = GUIDE if k == 0 else ""
        sheets.append(f"<section class='sheet'>{head}<div class='body'>{''.join(us[i:j])}{extra}</div>{foot}</section>")
        print(f"  {k+1}ページ: スライド{a['no']}〜{b['no']}（{sum(hs[i:j]):.0f}/{BODY_H}mm）"
              + (f" めくり＝{PAUSE_SLIDES.get(b['no'], '切れ目')}" if k + 1 < total else ""))

    html_path = HERE / "stage.html"
    html_path.write_text(doc("".join(sheets)), encoding="utf-8")
    pdf = HERE / "本番用_進行台本.pdf"
    js = ("const {chromium}=require('playwright');(async()=>{const b=await chromium.launch();"
          "const p=await b.newPage();await p.goto(process.argv[1]);await p.waitForLoadState('networkidle');"
          "const o=await p.$$eval('.sheet .body',e=>e.map((x,i)=>x.scrollHeight>x.clientHeight+1?i+1:0).filter(Boolean));"
          "if(o.length){console.error('はみ出し: '+o.join(','));process.exit(3);}"
          "await p.pdf({path:process.argv[2],format:'A4',printBackground:true,preferCSSPageSize:true});"
          "await b.close();})();")
    node(js, html_path.resolve().as_uri(), str(pdf))
    print(f"本番用PDF: {total}ページ")


if __name__ == "__main__":
    main()
