# -*- coding: utf-8 -*-
"""iPad 用プロンプター（1枚の HTML）を作る。  python3 prompter.py

台本データ（content.py / cues.py）とスライドの縮小画像をページの中に埋め込むので、
一度開けば、あとはネットにつながっていなくても動く。
"""
import base64
import io
import json
import pathlib
import re

from PIL import Image

from build import part_of
from content import PARTS, SHORTCUTS, SLIDES, TITLE, TOTAL_MIN
from cues import CUES, DEMO_CARDS

HERE = pathlib.Path(__file__).parent


def thumb(no):
    im = Image.open(HERE / "slides" / f"s-{no:02d}.png").convert("RGB")
    im.thumbnail((360, 203))
    buf = io.BytesIO()
    im.save(buf, "JPEG", quality=62, optimize=True)
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()


def data():
    out, clock = [], 0
    for s in SLIDES:
        num, name, *_ = part_of(s["no"])
        blocks = [[k.rstrip("+"), t] for k, t in s["blocks"] if k.rstrip("+") != "prep"]
        card = DEMO_CARDS.get(s["no"])
        out.append({
            "no": s["no"], "title": s["title"], "part": f"{num} {name}", "start": clock, "sec": s["sec"],
            "cue": CUES[s["no"]].split("｜"), "blocks": blocks, "thumb": thumb(s["no"]),
            "card": {"title": card[0], "min": card[1], "steps": card[2], "line": card[3]} if card else None,
        })
        clock += s["sec"]
    order = " → ".join(("・".join(map(str, n)) if isinstance(n, tuple) else str(n)) for n, _, _ in SHORTCUTS)
    return {"slides": out, "end": PARTS[-1][3] * 60, "total": TOTAL_MIN * 60, "shortcuts": order}


PAGE = r"""<title>研修プロンプター</title>
<meta name="claude:viewport-fit-sides" content="cover">
<meta name="apple-mobile-web-app-capable" content="yes">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=BIZ+UDPGothic:wght@400;700&display=swap">
<style>
/* 演台用の一画面アプリ：暗い地に大きな字。上＝時間、中＝読む文、下＝次のスライド */
:root {
  --bg: #0d1218; --panel: #161e27; --line: #26313d;
  --fg: #eef2f6; --muted: #8b98a7; --accent: #4fb3e8;
  --key: #ffd166; --late: #ff7a6b; --ok: #62d394; --fill: #f2c94c;
  --body: "BIZ UDPGothic", "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Noto Sans JP", system-ui, sans-serif;
  --size: 34px;
  color-scheme: dark;
}
html, body { height: 100%; }
body { margin: 0; background: var(--bg); color: var(--fg); font-family: var(--body);
  -webkit-user-select: none; user-select: none; -webkit-tap-highlight-color: transparent; overflow: hidden; }
.app { height: 100%; display: grid; grid-template-rows: auto auto 1fr auto; }
.bar { display: flex; align-items: center; gap: 14px; flex-wrap: wrap;
  padding-block: 10px; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px));
  background: var(--panel); border-bottom: 1px solid var(--line); }
.no { font-size: 30px; font-weight: 700; color: var(--accent); font-variant-numeric: tabular-nums; min-width: 2.4em; }
.ttl { flex: 1; min-width: 0; }
.ttl b { display: block; font-size: 19px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ttl small { color: var(--muted); font-size: 14px; }
.clock { text-align: right; font-variant-numeric: tabular-nums; }
.clock .el { font-size: 26px; font-weight: 700; }
.clock .df { font-size: 14px; color: var(--muted); }
.clock .df.late { color: var(--late); } .clock .df.ok { color: var(--ok); }
button { font: inherit; color: var(--fg); background: #22303d; border: 1px solid var(--line); border-radius: 10px;
  padding: 8px 14px; font-size: 16px; cursor: pointer; }
button:focus-visible { outline: 3px solid var(--accent); outline-offset: 2px; }
button.go { background: var(--accent); color: #06121b; font-weight: 700; border-color: var(--accent); }
.progress { height: 4px; background: var(--line); }
.progress i { display: block; height: 100%; background: var(--accent); width: 0; transition: width .25s; }
main { overflow-y: auto; -webkit-overflow-scrolling: touch; min-height: 0; position: relative;
  padding-block: 18px 40vh; padding-left: max(28px, env(safe-area-inset-left, 0px)); padding-right: max(28px, env(safe-area-inset-right, 0px)); }
.inner { max-width: 40em; margin: 0 auto; font-size: var(--size); line-height: 1.6; }
.cue { font-size: .5em; color: var(--accent); font-weight: 700; margin-bottom: .8em; line-height: 1.5; }
.cue span { white-space: nowrap; } .cue i { font-style: normal; color: var(--muted); margin: 0 .4em; }
.say { margin: 0 0 .7em; }
.say .dim { color: var(--muted); font-size: .7em; }
.key { margin: 0 0 .7em; color: var(--key); font-weight: 700; border-left: 6px solid var(--key); padding-left: .5em; }
.key::before { content: "顔を上げて"; display: block; font-size: .42em; letter-spacing: .1em; font-weight: 400; opacity: .85; }
.draft { margin: 0 0 .7em; }
.draft::before { content: "仮"; font-size: .45em; background: var(--accent); color: #06121b; border-radius: 4px;
  padding: 0 .35em; margin-right: .4em; vertical-align: .25em; }
.note { margin: 0 0 .9em; font-size: .5em; color: var(--muted); line-height: 1.5; }
.note b { font-weight: 400; background: #2a3846; color: var(--fg); border-radius: 4px; padding: 0 .4em; margin-right: .4em; }
.fill { margin: 0 0 .7em; color: var(--fill); border: 2px dashed var(--fill); border-radius: 10px; padding: .1em .4em; display: inline-block; }
.qa { margin: 0 0 .7em; font-size: .75em; }
.qa b { color: var(--accent); }
.card { border: 2px solid #ff9f6b; border-radius: 14px; padding: .5em .8em; margin: 0 0 1em; }
.card h3 { margin: 0 0 .3em; font-size: .7em; color: #ff9f6b; }
.card ol { margin: 0; padding-left: 1.3em; font-size: .75em; line-height: 1.5; }
.card p { margin: .4em 0 0; font-size: .6em; color: var(--key); }
.stage { position: relative; min-height: 0; display: grid; }
.more { position: absolute; left: 0; right: 0; bottom: 0; text-align: center; font-size: 15px; color: var(--muted); padding: 18px 6px 6px; pointer-events: none; background: linear-gradient(transparent, var(--bg) 60%); }
.foot { display: flex; align-items: center; gap: 14px;
  padding-block: 10px; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px));
  background: var(--panel); border-top: 1px solid var(--line); }
.foot img { width: 120px; border-radius: 6px; flex: none; }
.foot .nx { flex: 1; min-width: 0; color: var(--muted); font-size: 15px; }
.foot .nx b { display: block; color: var(--fg); font-size: 19px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tools { display: flex; gap: 8px; flex-wrap: wrap; }
.sheet { position: fixed; inset: 0; background: rgba(5,8,12,.94); overflow-y: auto; z-index: 20;
  padding-block: max(20px, env(safe-area-inset-top, 0px)) 30px; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); }
.sheet h2 { margin: 0 0 12px; font-size: 22px; }
.sheet .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 10px; }
.sheet .grid button { text-align: left; display: flex; gap: 10px; align-items: center; padding: 8px; }
.sheet .grid button.cur { border-color: var(--accent); }
.sheet .grid img { width: 72px; border-radius: 4px; flex: none; }
.sheet .grid span { min-width: 0; font-size: 14px; }
.sheet p { color: var(--muted); font-size: 15px; line-height: 1.7; max-width: 46em; }
@media (max-width: 700px) { :root { --size: 24px; } .foot img { width: 84px; } .no { font-size: 24px; } }
@media (prefers-reduced-motion: reduce) { .progress i { transition: none; } }
</style>

<div class="app">
  <header class="bar">
    <div class="no" id="no">01</div>
    <div class="ttl"><b id="ttl"></b><small id="meta"></small></div>
    <div class="clock"><div class="el" id="el">0:00</div><div class="df" id="df">タイマー停止中</div></div>
    <div class="tools">
      <button class="go" id="start" type="button">開始</button>
      <button id="smaller" type="button" aria-label="文字を小さく">字−</button>
      <button id="bigger" type="button" aria-label="文字を大きく">字＋</button>
      <button id="list" type="button">一覧</button>
    </div>
  </header>
  <div class="progress"><i id="prog"></i></div>
  <div class="stage"><main id="main"><div class="inner" id="inner"></div></main><div class="more" id="more" hidden>▼ 続きがあります（右側をタップ）</div></div>
  <footer class="foot">
    <img id="nimg" alt="">
    <div class="nx">次のスライド<b id="ntl"></b><span id="nmeta"></span></div>
    <div class="tools"><button id="prev" type="button">◀ 前へ</button><button class="go" id="next" type="button">次へ ▶</button></div>
  </footer>
</div>

<div class="sheet" id="sheet" hidden>
  <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
    <h2>スライドを選ぶ</h2><button id="close" type="button">閉じる</button>
  </div>
  <p>画面の右側（全体の7割）をタップすると次へ、左側をタップすると前へ進みます。長いスライドは、まず下へ送り、読み終えると次のスライドへ進みます。Bluetoothのページめくり器の矢印キー、PageUp・PageDownでも操作できます。<br>
  押したときに削る順番：<span id="sc"></span></p>
  <div class="grid" id="grid"></div>
</div>

<script>
const D = __DATA__;
const S = D.slides;
const $ = id => document.getElementById(id);
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
};
let idx = Math.min(Math.max(store.get("idx", 0), 0), S.length - 1);
let size = store.get("size", 0);
let t0 = store.get("t0", null), pausedAt = store.get("pausedAt", null);

const esc = s => s.replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const fmt = sec => { sec = Math.max(0, Math.round(sec)); return Math.floor(sec / 60) + ":" + String(sec % 60).padStart(2, "0"); };
const sentences = t => (t.match(/[^。]+。?/g) || [t]).join("<br>");
const dimParen = t => t.replace(/（[^）]*）/g, m => `<span class="dim">${m}</span>`);
const len = sec => sec >= 60 ? (Math.floor(sec / 60) + "分" + (sec % 60 ? (sec % 60 === 30 ? "半" : sec % 60 + "秒") : "")) : sec + "秒";

function render() {
  const s = S[idx], n = S[idx + 1];
  $("no").textContent = String(s.no).padStart(2, "0");
  $("ttl").textContent = s.title;
  $("meta").textContent = `${s.part}　予定 ${fmt(s.start)} から ${len(s.sec)}`;
  $("prog").style.width = ((idx + 1) / S.length * 100) + "%";
  let h = `<div class="cue">${s.cue.map(c => `<span>${esc(c)}</span>`).join("<i>▸</i>")}</div>`;
  if (s.card) h += `<div class="card"><h3>デモ：${esc(s.card.title)}（約${s.card.min}分）</h3><ol>${s.card.steps.map(x => `<li>${esc(x)}</li>`).join("")}</ol><p>${esc(s.card.line)}</p></div>`;
  for (const [k, t] of s.blocks) {
    if (k === "say") h += `<p class="say">${dimParen(sentences(esc(t)))}</p>`;
    else if (k === "key") h += `<p class="key">${sentences(esc(t))}</p>`;
    else if (k === "draft") h += `<p class="say draft">${sentences(esc(t))}</p>`;
    else if (k === "note") h += `<p class="note"><b>進行</b>${esc(t)}</p>`;
    else if (k === "fill") h += `<p><span class="fill">${esc(t)}</span></p>`;
    else if (k === "qa") { const [q, a] = t.split("|"); h += `<p class="qa"><b>Q</b> ${esc(q)}<br><b>A</b> ${esc(a)}</p>`; }
  }
  $("inner").innerHTML = h;
  $("main").scrollTop = 0;
  if (n) { $("nimg").src = n.thumb; $("nimg").hidden = false; $("ntl").textContent = `${n.no}　${n.title}`; $("nmeta").textContent = `予定 ${fmt(n.start)}`; }
  else { $("nimg").hidden = true; $("ntl").textContent = "おわり"; $("nmeta").textContent = `本編 ${fmt(D.end)}／予備 ${fmt(D.total)}まで`; }
  store.set("idx", idx);
  requestAnimationFrame(updateMore);
  tick();
}
function updateMore() { const m = $("main"); $("more").hidden = m.scrollTop + m.clientHeight >= m.scrollHeight - 0.4 * window.innerHeight - 8; }
function go(i) { if (i < 0 || i >= S.length) return; idx = i; render(); }
function next() {
  const m = $("main"), rest = m.scrollHeight - 0.4 * window.innerHeight - (m.scrollTop + m.clientHeight);
  if (rest > 8) m.scrollBy({ top: Math.min(rest, m.clientHeight * 0.75), behavior: "smooth" }); else go(idx + 1);
}
function prev() { const m = $("main"); if (m.scrollTop > 8) m.scrollBy({ top: -m.clientHeight * 0.75, behavior: "smooth" }); else go(idx - 1); }

function elapsed() { if (t0 === null) return null; return ((pausedAt ?? Date.now()) - t0) / 1000; }
function tick() {
  const e = elapsed(), s = S[idx];
  $("start").textContent = t0 === null ? "開始" : (pausedAt ? "再開" : "一時停止");
  if (e === null) { $("el").textContent = "0:00"; $("df").textContent = "タイマー停止中"; $("df").className = "df"; return; }
  $("el").textContent = fmt(e);
  const d = e - s.start;
  if (Math.abs(d) < 30) { $("df").textContent = "予定どおり"; $("df").className = "df ok"; }
  else if (d > 0) { $("df").textContent = `${fmt(d)} おくれ`; $("df").className = "df late"; }
  else { $("df").textContent = `${fmt(-d)} 早い`; $("df").className = "df ok"; }
}
setInterval(tick, 1000);
$("start").onclick = e => {
  e.stopPropagation();
  if (t0 === null) { t0 = Date.now() - S[idx].start * 1000; pausedAt = null; }
  else if (pausedAt) { t0 += Date.now() - pausedAt; pausedAt = null; }
  else pausedAt = Date.now();
  store.set("t0", t0); store.set("pausedAt", pausedAt); tick(); keepAwake();
};
function applySize() { document.documentElement.style.setProperty("--size", `calc(${window.innerWidth <= 700 ? 24 : 34}px + ${size * 4}px)`); store.set("size", size); requestAnimationFrame(updateMore); }
$("bigger").onclick = e => { e.stopPropagation(); if (size < 8) size++; applySize(); };
$("smaller").onclick = e => { e.stopPropagation(); if (size > -4) size--; applySize(); };
$("next").onclick = e => { e.stopPropagation(); next(); keepAwake(); };
$("prev").onclick = e => { e.stopPropagation(); prev(); };

// 画面のタップ：右7割＝次へ、左3割＝前へ
$("main").addEventListener("click", e => { if (e.clientX < window.innerWidth * 0.3) prev(); else next(); keepAwake(); });
$("main").addEventListener("scroll", updateMore, { passive: true });
document.addEventListener("keydown", e => {
  if (!$("sheet").hidden) { if (e.key === "Escape") $("sheet").hidden = true; return; }
  if (["ArrowRight", "ArrowDown", "PageDown", " ", "Enter"].includes(e.key)) { e.preventDefault(); next(); }
  else if (["ArrowLeft", "ArrowUp", "PageUp", "Backspace"].includes(e.key)) { e.preventDefault(); prev(); }
});

// 一覧
$("sc").textContent = D.shortcuts;
$("list").onclick = e => {
  e.stopPropagation();
  $("grid").innerHTML = S.map((s, i) => `<button type="button" data-i="${i}" class="${i === idx ? "cur" : ""}"><img src="${s.thumb}" alt=""><span>${s.no}　${esc(s.title)}<br><small style="color:var(--muted)">${esc(s.part)}　${fmt(s.start)}</small></span></button>`).join("");
  $("sheet").hidden = false;
};
$("grid").addEventListener("click", e => { const b = e.target.closest("button[data-i]"); if (b) { $("sheet").hidden = true; go(+b.dataset.i); } });
$("close").onclick = () => { $("sheet").hidden = true; };

// 画面が暗くならないようにする（使えない環境では何もしない）
let lock = null;
async function keepAwake() { try { if (!lock && navigator.wakeLock) { lock = await navigator.wakeLock.request("screen"); lock.addEventListener("release", () => { lock = null; }); } } catch (e) {} }
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") keepAwake(); });

applySize(); render();
</script>
"""


def main():
    html = PAGE.replace("__DATA__", json.dumps(data(), ensure_ascii=False))
    out = HERE / "prompter.html"
    out.write_text(html, encoding="utf-8")
    print(f"prompter.html {len(html.encode()) / 1024:.0f}KB")


if __name__ == "__main__":
    main()
