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
from content import PARTS, PRIVATE, SHORTCUTS, SLIDES, TITLE, TOTAL_MIN
from cues import CUES, DEMO_CARDS, PAUSE_SLIDES

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
.body {{ flex:1; min-height:0; overflow:hidden; padding-top:1.5mm; }}
.pfoot {{ height:{FOOT_H}mm; display:flex; align-items:center; justify-content:space-between;
          font-size:9.5pt; border-top:0.3mm solid var(--line); color:var(--sub); }}
.pfoot .turn {{ background:var(--navy); color:#fff; padding:0.8mm 3mm; border-radius:1.2mm; }}
.pfoot .turn.easy {{ background:var(--orange); }}
.band {{ background:var(--blue); color:#fff; border-radius:1.2mm; padding:1mm 3mm; margin:1mm 0 1.5mm;
         font-size:10pt; display:flex; gap:3mm; align-items:baseline; }}
.band b {{ font-size:11.5pt; }}
.band span {{ font-size:8.5pt; opacity:.95; }}
.blk {{ display:grid; grid-template-columns:15mm 28mm 1fr; column-gap:3mm; padding:1.8mm 0;
        border-bottom:0.25mm solid var(--line); }}
.no {{ font-size:19pt; color:var(--orange); font-weight:bold; line-height:1; }}
.clock {{ font-size:11pt; color:var(--navy); font-weight:bold; margin-top:1mm; }}
.dur {{ font-size:8pt; color:var(--sub); }}
.thumb img {{ width:28mm; border-radius:0.8mm; border:0.25mm solid var(--line); display:block; }}
.thumb .ttl {{ font-size:7.5pt; color:var(--sub); line-height:1.3; margin-top:0.8mm; }}
.cue {{ font-size:9.5pt; color:var(--blue); font-weight:bold; line-height:1.5; margin-bottom:1mm; }}
.cue i {{ font-style:normal; color:var(--orange); margin:0 1.2mm; font-weight:normal; }}
.full {{ font-size:11pt; line-height:1.7; color:var(--ink); }}
.full p {{ margin:0 0 1.2mm; }}
.full .key {{ font-weight:bold; color:var(--navy); font-size:11.5pt; border-left:1.2mm solid var(--navy); padding-left:2mm; }}
.full .key b {{ display:inline-block; background:var(--navy); color:#fff; font-weight:normal; font-size:7.5pt; padding:0 1.2mm; border-radius:0.6mm; margin-right:1.5mm; vertical-align:2px; }}
.full .card {{ background:var(--orange); color:#fff; font-size:10pt; padding:0.6mm 2mm; border-radius:0.8mm; display:inline-block; }}
.full .nt {{ color:var(--sub); font-size:9pt; line-height:1.5; }}
.full .draft b {{ display:inline-block; background:var(--blue); color:#fff; font-weight:normal; font-size:7.5pt; padding:0 1.2mm; border-radius:0.6mm; margin-right:1.5mm; vertical-align:2px; }}
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


GUIDE = """<div class='guide'><h3>この台本の見方（本番前に一度お読みください）</h3>
<div>・黒い大きな字が読み上げる文です。1文ごとに改行してあるので、文の終わりで顔を上げます。</div>
<div>・<span class='tag' style='background:#1f3a5a'>顔を上げて</span>の太字は、会場の顔を見ながら、少しゆっくり言う一文です。</div>
<div>・各スライドの上の青い小さな行は、話の流れの要約です。読むところを見失ったら、ここで位置を確かめます。</div>
<div>・<span class='tag' style='background:#f26a3f'>デモ用カード</span>の印があるスライドでは、台本を置き、別紙のデモ用カードを見て実技を進めます。</div>
<div>・左の時刻は「研修開始から何分でこのスライドに入るか」の目安です。各ページの左下に、めくるタイミングを書いています（オレンジ＝手が空いているときにめくれる、紺＝話し終えたらめくる）。</div>
<div>・{RESERVE_LINE}</div>
</div>"""


def sentences(text):
    """読みやすいよう1文ずつに分ける（かっこの中の句点では切らない）"""
    out, buf, depth = [], "", 0
    for ch in text:
        buf += ch
        depth += ch in "（「『" ; depth -= ch in "）」』"
        if ch == "。" and depth <= 0:
            out.append(buf); buf = ""
    if buf:
        out.append(buf)
    return out


def reserve_line():
    end = PARTS[-1][3]
    order = " → ".join(("・".join(map(str, n)) if isinstance(n, tuple) else str(n)) for n, _, _ in SHORTCUTS)
    total = sum(x[2] for x in SHORTCUTS)
    return (f"本編は{end}:00で終わる計画です。そのあと{TOTAL_MIN - end}分が予備時間です。"
            f"押したときは <b>{order}</b> の順に削ると、合計で約{round(total / 60)}分縮みます"
            f"（削り方は準備用の台本の時間配分のページ）。")


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
            full.append("<p>" + "<br>".join(esc(x) for x in sentences(text)) + "</p>")
        elif k == "draft":
            full.append("<p class='draft'><b>仮</b>" + "<br>".join(esc(x) for x in sentences(text)) + "</p>")
        elif k == "key":
            full.append("<p class='key'><b>顔を上げて</b>" + "<br>".join(esc(x) for x in sentences(text)) + "</p>")
        elif k == "note":
            full.append(f"<p class='nt'><b>進行</b>{esc(text)}</p>")
        elif k == "prep":
            continue  # 準備メモは本番では不要
        elif k == "fill":
            full.append(f"<p><span class='fl'>{esc(text)}</span></p>")
        elif k == "qa":
            q, a = text.split("|")
            full.append(f"<p class='qa'><b>Q</b> {esc(q)}　<b>A</b> {esc(a)}</p>")
    if s["no"] in DEMO_CARDS:
        full.insert(0, f"<p><span class='card'>▶ デモ用カード「{esc(DEMO_CARDS[s['no']][0])}」を見て進める</span></p>")
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
                        + "<div class='unit'>" + GUIDE.replace("{RESERVE_LINE}", reserve_line()) + "</div>"
                        + "</div></div></div>"), encoding="utf-8")
    js = ("const {chromium}=require('playwright');(async()=>{const b=await chromium.launch();"
          "const p=await b.newPage();await p.goto(process.argv[1]);await p.waitForLoadState('networkidle');"
          "const h=await p.$$eval('.unit',e=>e.map(x=>x.getBoundingClientRect().height));"
          "console.log(JSON.stringify(h));await b.close();})();")
    hs = json.loads(node(js, path.resolve().as_uri()))
    path.unlink()
    hs = [h / MM for h in hs]
    return hs[:-1], hs[-1]   # 各スライドの高さ, 見方の欄の高さ


def paginate(hs, last_extra=0.0):
    """ページ数を最小にしつつ、めくりやすい位置（動画・実技中、パートの切れ目）で区切る"""
    n = len(SLIDES)
    good = set(PAUSE_SLIDES) | {p[4][1] for p in PARTS}
    INF = float("inf")
    best = [0.0] + [INF] * n
    prev = [0] * (n + 1)
    for j in range(1, n + 1):
        for i in range(j - 1, -1, -1):
            if sum(hs[i:j]) + (last_extra if j == n else 0) > BODY_H:
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
    hs, guide_h = measure(us)
    too_big = [SLIDES[i]["no"] for i, h in enumerate(hs) if h > BODY_H]
    if too_big:
        raise SystemExit(f"1ページに入らないスライド: {too_big}")
    groups = paginate(hs, guide_h)
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
            end = PARTS[-1][3]
            foot = (f"<div class='pfoot'><span>本編おわり {end}:00</span>"
                    f"<span>ここから予備{TOTAL_MIN - end}分（〜{TOTAL_MIN}:00）</span></div>")
        extra = GUIDE.replace("{RESERVE_LINE}", reserve_line()) if k + 1 == total else ""
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
    build_cards()



CARD_CSS = """
@page { size: A4 landscape; margin: 12mm; }
body { margin:0; font-family:"IPAPGothic","IPAGothic",sans-serif; color:#1f3a5a; }
.card { height:184mm; break-after:page; display:flex; flex-direction:column; }
.card:last-child { break-after:auto; }
.top { display:flex; justify-content:space-between; align-items:baseline; border-bottom:1.2mm solid #f26a3f; padding-bottom:2mm; }
.top h1 { margin:0; font-size:30pt; }
.top span { font-size:16pt; color:#66727f; }
ol { margin:5mm 0 0; padding-left:16mm; font-size:29pt; line-height:1.5; flex:1; }
ol li { margin-bottom:2.5mm; }
.say { margin-top:auto; background:#fff1b0; border-radius:2mm; padding:3mm 5mm; font-size:20pt; color:#26313d; }
"""


def build_cards():
    cards = []
    for no, (title, minutes, steps, line) in DEMO_CARDS.items():
        items = "".join(f"<li>{esc(x)}</li>" for x in steps)
        cards.append(f"<section class='card'><div class='top'><h1>{esc(title)}</h1>"
                     f"<span>スライド{no}　約{minutes}分</span></div><ol>{items}</ol>"
                     f"<div class='say'>{esc(line)}</div></section>")
    html_path = HERE / "cards.html"
    html_path.write_text(f"<!doctype html><html lang='ja'><head><meta charset='utf-8'><title>デモ用カード</title>"
                         f"<style>{CARD_CSS}</style></head><body>{''.join(cards)}</body></html>", encoding="utf-8")
    js = ("const {chromium}=require('playwright');(async()=>{const b=await chromium.launch();"
          "const p=await b.newPage();await p.goto(process.argv[1]);"
          "const o=await p.$$eval('.card ol',e=>e.map((x,i)=>x.scrollHeight>x.clientHeight+1?i+1:0).filter(Boolean));"
          "if(o.length){console.error('カードのはみ出し: '+o.join(','));process.exit(3);}"
          "await p.pdf({path:process.argv[2],printBackground:true,preferCSSPageSize:true});"
          "await b.close();})();")
    node(js, html_path.resolve().as_uri(), str(HERE / "デモ用カード.pdf"))
    print(f"デモ用カード: {len(cards)}枚")


if __name__ == "__main__":
    main()
