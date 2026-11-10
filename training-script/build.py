# -*- coding: utf-8 -*-
"""改訂版 台本の HTML と PDF を作る。  python3 build.py"""
import html
import pathlib
import re

from content import (PARTS, PRE_CHECKS, REFERENCES, SCRIPT_CHANGES, SLIDE_FIXES,
                     SLIDES, SPEAKER, SUBTITLE, TITLE)

HERE = pathlib.Path(__file__).parent
TOTAL = len(SLIDES)
CHARS_PER_MIN = 300  # 落ち着いて話すときの目安（1分あたりの文字数）


def esc(s):
    return html.escape(s)


def fmt_len(sec):
    m, s = divmod(sec, 60)
    if m and s == 30:
        return f"{m}分半"
    if m and s:
        return f"{m}分{s}秒"
    if m:
        return f"{m}分"
    return f"{s}秒"


def fmt_clock(sec):
    return f"{sec // 60}:{sec % 60:02d}"


def part_of(no):
    for p in PARTS:
        if p[4][0] <= no <= p[4][1]:
            return p
    raise ValueError(no)


# ---------- 時間のチェック ----------
def check_timing():
    problems = []
    for num, name, start, end, (a, b), _ in PARTS:
        total = sum(s["sec"] for s in SLIDES if a <= s["no"] <= b)
        if total != (end - start) * 60:
            problems.append(f"{num}{name}: 合計 {total}秒 / 枠 {(end-start)*60}秒")
    grand = sum(s["sec"] for s in SLIDES)
    if grand != 3600:
        problems.append(f"全体 {grand}秒")
    return problems


def speaking_report():
    """読み上げ文の文字数から、話すのに必要な時間を見積もる（動画・待ち時間は別に足す）"""
    rows = []
    for s in SLIDES:
        chars = sum(len(re.sub(r"（[^）]*）", "", t)) for k, t in s["blocks"]
                    if k.startswith("say") or k == "qa")
        waits = 0
        for k, t in s["blocks"]:
            if k.startswith("note"):
                for n in re.findall(r"(\d+)秒(?:ほど待つ|計る)", t):
                    waits += int(n)
                if "動画を再生" in t:
                    m = re.search(r"(\d+)分以内", t)
                    waits += int(m.group(1)) * 60 if m else 150
        need = chars / CHARS_PER_MIN * 60 + waits
        rows.append((s["no"], chars, waits, round(need), s["sec"]))
    return rows


# ---------- HTML ----------
CSS = """
@page { size: A4; margin: 14mm 15mm 16mm 15mm; }
:root { --blue:#1e98d7; --navy:#1f3a5a; --orange:#f26a3f; --green:#2fae6e;
        --ink:#1d2733; --sub:#5b6878; --line:#d9e2ec; --pale:#eef6fc; --yellow:#fff4c2; }
* { box-sizing: border-box; }
body { font-family: "IPAPGothic","IPAGothic",sans-serif; color: var(--ink);
       font-size: 11.5pt; line-height: 1.85; margin: 0; background:#fff; }
h1,h2,h3 { color: var(--navy); line-height: 1.4; margin: 0; }
.page { break-before: page; }
.cover { height: 260mm; display:flex; flex-direction:column; justify-content:center; }
.cover .kicker { color: var(--blue); font-size: 13pt; letter-spacing: .1em; }
.cover h1 { font-size: 30pt; margin: 6mm 0 4mm; }
.cover .rev { display:inline-block; background: var(--orange); color:#fff; padding: 1mm 4mm;
              border-radius: 2mm; font-size: 12pt; margin-bottom: 8mm; }
.cover p { margin: 1mm 0; color: var(--sub); }
.cover img { width: 120mm; border-radius: 2mm; box-shadow: 0 1mm 4mm rgba(0,0,0,.15); margin-top: 10mm; }
.sec-title { font-size: 17pt; border-left: 2.2mm solid var(--blue); padding-left: 3mm; margin: 0 0 4mm; }
.lead { color: var(--sub); margin: 0 0 4mm; }
table { border-collapse: collapse; width: 100%; font-size: 10pt; line-height: 1.6; }
th, td { border: 0.3mm solid var(--line); padding: 1.6mm 2.2mm; vertical-align: top; text-align: left; }
th { background: var(--pale); color: var(--navy); white-space: nowrap; }
td.nowrap { white-space: nowrap; }
.legend { margin-top: 6mm; font-size: 10.5pt; }
.legend div { margin: 1.5mm 0; }
.tag { display:inline-block; font-size: 8.5pt; padding: 0 2mm; border-radius: 1mm; color:#fff;
       line-height: 1.7; margin-right: 1.5mm; vertical-align: 1px; white-space: nowrap; }
.tag.t-note { background: var(--sub); } .tag.t-prep { background: var(--green); }
.tag.rev { background: var(--orange); } .tag.t-fill { background:#c9a400; }
.tag.must { background: #d64545; } .tag.rec { background: var(--blue); } .tag.ask { background: #8a5cc2; }
.head { display:flex; justify-content: space-between; align-items:center; font-size: 9.5pt;
        border-bottom: 0.3mm solid var(--line); padding-bottom: 1.5mm; margin-bottom: 4mm; }
.chip { background: var(--blue); color:#fff; border-radius: 3mm; padding: 0 3mm; margin-right: 2mm; }
.slidehead { display:flex; gap: 6mm; align-items: flex-start; margin-bottom: 4mm; }
.slidehead img { width: 92mm; border-radius: 1.5mm; box-shadow: 0 .6mm 2.5mm rgba(0,0,0,.18); }
.num { font-size: 26pt; color: var(--orange); font-weight: bold; line-height: 1.1; }
.stitle { font-size: 14pt; color: var(--navy); font-weight: bold; line-height: 1.45; margin: 1mm 0 2.5mm; }
.meta span { display:inline-block; font-size: 9.5pt; background: var(--yellow); padding: 0 2.2mm;
             border-radius: 1mm; margin: 0 1.5mm 1.5mm 0; }
.meta span.clock { background: var(--pale); color: var(--navy); }
.aim { background: var(--pale); border-radius: 2mm; padding: 2mm 3mm; font-size: 10pt; margin-bottom: 4mm; line-height:1.7; }
.aim b { background: var(--blue); color:#fff; padding: 0 2mm; border-radius: 1mm; margin-right: 2mm; font-weight: normal; }
p.say { margin: 0 0 2.6mm; }
p.say.revised { border-left: 1.2mm solid var(--orange); padding-left: 2.5mm; }
.note, .prep { font-size: 9.8pt; color: var(--sub); margin: 0 0 2.6mm 3mm; line-height: 1.65; }
.note.revised, .prep.revised { border-left: 1.2mm solid var(--orange); padding-left: 2.5mm; margin-left: 0; }
.fill { background: var(--yellow); border: 0.4mm dashed #c9a400; border-radius: 1.5mm; padding: 2mm 3mm;
        margin: 0 0 2.6mm; }
.qa { margin: 0 0 3mm; }
.qa .q { font-weight: bold; color: var(--navy); }
.foot { position: fixed; bottom: -9mm; left: 0; right: 0; font-size: 8pt; color: var(--sub);
        border-top: 0.3mm solid var(--line); padding-top: 1mm; }
ol.refs { font-size: 9.5pt; line-height: 1.55; padding-left: 6mm; }
ol.refs li { margin-bottom: 1.6mm; } ol.refs .url { color: var(--sub); word-break: break-all; font-size: 8.5pt; }
ul.checks { padding-left: 5mm; } ul.checks li { margin-bottom: 2mm; }
"""


def block_html(kind, text):
    revised = kind.endswith("+")
    k = kind.rstrip("+")
    rev = ' <span class="tag rev">改訂</span>' if revised else ""
    cls = " revised" if revised else ""
    if k == "say":
        return f'<p class="say{cls}">{esc(text)}{rev}</p>'
    if k == "note":
        return f'<div class="note{cls}"><span class="tag t-note">進行</span>{rev}{esc(text)}</div>'
    if k == "prep":
        return f'<div class="prep{cls}"><span class="tag t-prep">準備</span>{rev}{esc(text)}</div>'
    if k == "fill":
        return f'<div class="fill"><span class="tag t-fill">要記入</span>{esc(text)}</div>'
    if k == "qa":
        q, a = text.split("|")
        return f'<div class="qa"><div class="q">Q　{esc(q)}</div><div>A　{esc(a)}</div></div>'
    raise ValueError(kind)


def build_html():
    out = [f"<!doctype html><html lang='ja'><head><meta charset='utf-8'><title>{esc(TITLE)}（改訂版）</title>"
           f"<style>{CSS}</style></head><body>"]

    # 表紙
    out.append(f"""<section class='cover'>
      <h1>少年期に大切な<br>姿勢・休息・動き・視る力</h1>
      <div><span class='rev'>改訂版</span></div>
      <p>{esc(SUBTITLE)}</p>
      <img src='slides/s-01.png'>
    </section>""")

    # 改訂のポイント
    out.append("<section class='page'><h2 class='sec-title'>今回の改訂で直したところ</h2>"
               "<p class='lead'>台本の中で直した箇所には、左側にオレンジの線と「改訂」の印を付けています。"
               "スライド（PowerPoint）側で直してほしい箇所は、巻末の「スライド修正リスト」にまとめました。</p>"
               "<table><tr><th>箇所</th><th>内容</th></tr>")
    for where, what in SCRIPT_CHANGES:
        out.append(f"<tr><td class='nowrap'>{esc(where)}</td><td>{esc(what)}</td></tr>")
    out.append("</table></section>")

    # 時間配分
    out.append("<section class='page'><h2 class='sec-title'>時間配分</h2><table>"
               "<tr><th>時間</th><th>パート</th><th>スライド</th><th>このパートのねらい</th></tr>")
    for num, name, start, end, (a, b), aim in PARTS:
        out.append(f"<tr><td class='nowrap'>{start}〜{end}分</td><td class='nowrap'>{num} {esc(name)}</td>"
                   f"<td class='nowrap'>{a}〜{b}</td><td>{esc(aim)}</td></tr>")
    out.append("</table>")
    out.append("""<div class='legend'><h3>台本の見方</h3>
      <div>ふつうの書体の文章は、そのまま声に出して読める話し言葉です。</div>
      <div><span class='tag t-note'>進行</span>動き、間の取り方、問いかけなどのメモです。読み上げません。</div>
      <div><span class='tag t-prep'>準備</span>本番前にやっておくことです。</div>
      <div><span class='tag t-fill'>要記入</span>講師ご自身の言葉を書き込む欄です。</div>
      <div><span class='tag rev'>改訂</span>今回の改訂で追加・変更したところです。</div>
      <div><span class='meta'><span class='clock'>開始 12:30</span></span>研修の開始から何分何秒の時点でこのスライドに入るかの目安です。</div>
      <h3 style='margin-top:5mm'>話すときの心がけ</h3>
      <div>・数字を出したら、一度ゆっくり繰り返す</div>
      <div>・問いかけのあとは3秒ほど待ち、会場の顔を見る</div>
      <div>・実技は先にやって見せ、そのあと全員で一緒に動く</div>
      <div>・手元のタイマーと各スライドの「開始」時刻を見比べ、遅れていたら次のスライドの説明を短くする</div>
    </div></section>""")

    # スライドごと
    clock = 0
    for s in SLIDES:
        num, name, start, end, rng, aim = part_of(s["no"])
        out.append("<section class='page'>")
        out.append(f"<div class='head'><div><span class='chip'>{num} {esc(name)}</span>{start}〜{end}分</div>"
                   f"<div>スライド {s['no']} / {TOTAL}</div></div>")
        out.append(f"<div class='slidehead'><img src='slides/s-{s['no']:02d}.png'><div>"
                   f"<div class='num'>{s['no']:02d}</div><div class='stitle'>{esc(s['title'])}</div>"
                   f"<div class='meta'><span>目安 {fmt_len(s['sec'])}</span>"
                   f"<span class='clock'>開始 {fmt_clock(clock)}</span></div></div></div>")
        if s.get("aim"):
            extra = s.get("aim_extra", "")
            out.append(f"<div class='aim'><b>ねらい</b>{esc(aim)}{esc(extra)}</div>")
        for kind, text in s["blocks"]:
            out.append(block_html(kind, text))
        out.append("</section>")
        clock += s["sec"]

    # 付録
    out.append("<section class='page'><h2 class='sec-title'>付録　本番前の確認ポイント</h2><ul class='checks'>")
    out += [f"<li>{esc(c)}</li>" for c in PRE_CHECKS]
    out.append("</ul></section>")

    tagmap = {"必須": "must", "必須（確認）": "must", "推奨": "rec", "要判断": "ask"}
    out.append("<section class='page'><h2 class='sec-title'>付録　スライド修正リスト</h2>"
               "<p class='lead'>PowerPoint側で直してほしい箇所です。「必須」は本番前に必ず、「推奨」はできれば、"
               "「要判断」は講師のご判断でお願いします。</p>"
               "<table><tr><th>番号</th><th>スライド</th><th>区分</th><th>内容</th></tr>")
    for i, (no, level, what) in enumerate(SLIDE_FIXES, 1):
        out.append(f"<tr><td>{i}</td><td class='nowrap'>{esc(no)}</td>"
                   f"<td><span class='tag {tagmap[level]}'>{esc(level)}</span></td><td>{esc(what)}</td></tr>")
    out.append("</table></section>")

    out.append("<section class='page'><h2 class='sec-title'>付録　参考資料</h2><ol class='refs'>")
    for name, url in REFERENCES:
        out.append(f"<li>{esc(name)}<br><span class='url'>{esc(url)}</span></li>")
    out.append("</ol></section></body></html>")
    return "\n".join(out)


def main():
    probs = check_timing()
    if probs:
        raise SystemExit("時間の合計が合いません: " + " / ".join(probs))
    print("時間配分: 各パート・全体ともに枠どおり（60分）")
    tight = [r for r in speaking_report() if r[3] > r[4] + 10]
    for no, chars, waits, need, sec in tight:
        print(f"  注意 スライド{no}: 読み上げ{chars}字＋待ち{waits}秒 ≒ {need}秒 / 目安{sec}秒")

    html_path = HERE / "script_revised.html"
    html_path.write_text(build_html(), encoding="utf-8")
    import subprocess
    pdf_path = HERE / "研修シナリオ台本_改訂版.pdf"
    footer = ("<div style='width:100%;font-size:7.5pt;color:#5b6878;font-family:IPAPGothic;"
              "padding:0 15mm;display:flex;justify-content:space-between'>"
              f"<span>{esc(TITLE)}（改訂版）</span>"
              "<span><span class='pageNumber'></span> / <span class='totalPages'></span></span></div>")
    js = ("const {chromium}=require('playwright');(async()=>{const b=await chromium.launch();"
          "const p=await b.newPage();await p.goto(process.argv[1]);await p.waitForLoadState('networkidle');"
          "await p.pdf({path:process.argv[2],format:'A4',printBackground:true,preferCSSPageSize:true,"
          "displayHeaderFooter:true,headerTemplate:'<span></span>',footerTemplate:process.argv[3]});"
          "await b.close();})();")
    subprocess.run(["node", "-e", js, html_path.resolve().as_uri(), str(pdf_path), footer], check=True)
    print("PDF を書き出しました")


if __name__ == "__main__":
    main()
