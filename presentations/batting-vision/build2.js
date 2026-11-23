const pptxgen = require('pptxgenjs');
const { applyTheme } = require('/root/.claude/skills/synced/0b9079fc-a575-434d-b906-a0b143dde210_182063f9-b34f-4348-835a-62d9ee9c42ad/pptx/scripts/apply_theme.js');

const OUT = process.argv[2] || 'batting_vision.pptx';
const THEME = {
  name: 'Batting Vision',
  headFontFace: 'BIZ UDPGothic',
  bodyFontFace: 'BIZ UDPGothic',
  colors: {
    dk1: '1B2A41', lt1: 'FFFDF6', dk2: '44546A', lt2: 'EFF8EC',
    accent1: '1C6FB8', accent2: 'FFC83D', accent3: '2E8B57', accent4: '7A4FC0',
    accent5: 'C2501F', accent6: '8A5A00', hlink: '1C6FB8', folHlink: '7A4FC0',
  },
};
const H = THEME.colors; // hex-only options
const pres = new pptxgen();
pres.layout = 'LAYOUT_WIDE';
pres.title = '野球と視る力 バッティングと視る力';
pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
const C = pres.SchemeColor;
const EN = 'Arial';
const FOOT = '野球と視る力 ｜ バッティングと視る力';
const X0 = 0.75, W0 = 11.83;

// ---------- layouts ----------
function frame(name, bg, extra = {}) {
  pres.defineSlideMaster({
    title: name,
    background: bg,
    objects: [
      { placeholder: { options: { name: 'eyebrow', type: 'body', x: X0, y: 0.5, w: 8.6, h: 0.36, fontFace: EN, fontSize: 13, bold: true, color: C.accent1, charSpacing: 3, margin: 0, valign: 'middle' }, text: '' } },
      { placeholder: { options: { name: 'title', type: 'title', x: X0, y: 0.9, w: W0, h: 0.75, fontSize: 30, bold: true, color: C.text1, margin: 0, valign: 'top', align: 'left' }, text: '' } },
      { text: { text: FOOT, options: { x: X0, y: 6.92, w: 7, h: 0.3, fontSize: 11, color: extra.footColor || C.text2, margin: 0 } } },
    ],
    slideNumber: { x: 11.58, y: 6.92, w: 1.0, h: 0.3, fontFace: EN, fontSize: 11, color: extra.footColor || C.text2, align: 'right', margin: 0 },
  });
}
frame('CONTENT', { color: C.background1 });
frame('CONTENT_PAPER', { color: C.background2 });
frame('CONTENT_DARK', { path: 'bg_dark.png' });
pres.defineSlideMaster({
  title: 'STATEMENT_DARK', background: { path: 'bg_dark.png' },
  objects: [{ text: { text: FOOT, options: { x: X0, y: 6.92, w: 7, h: 0.3, fontSize: 11, color: C.text2, margin: 0 } } }],
  slideNumber: { x: 11.58, y: 6.92, w: 1.0, h: 0.3, fontFace: EN, fontSize: 11, color: C.text2, align: 'right', margin: 0 },
});
pres.defineSlideMaster({
  title: 'STATEMENT_AMBER', background: { color: C.accent2 },
  objects: [{ text: { text: FOOT, options: { x: X0, y: 6.92, w: 7, h: 0.3, fontSize: 11, color: C.text1, margin: 0 } } }],
  slideNumber: { x: 11.58, y: 6.92, w: 1.0, h: 0.3, fontFace: EN, fontSize: 11, color: C.text1, align: 'right', margin: 0 },
});
pres.defineSlideMaster({ title: 'COVER', background: { path: 'bg_dark.png' }, objects: [] });

// ---------- helpers ----------
let section = '';
function sec(title) { section = title; pres.addSection({ title }); }
function slide(master, eyebrow, title, notes) {
  const s = pres.addSlide({ masterName: master, sectionTitle: section });
  if (eyebrow !== null && eyebrow !== undefined) s.addText(eyebrow, { placeholder: 'eyebrow' });
  if (title) s.addText(title, { placeholder: 'title' });
  if (notes) s.addNotes(notes);
  return s;
}
const shadow = () => ({ type: 'outer', color: '1C6FB8', blur: 10, offset: 3, angle: 90, opacity: 0.14 });

function card(s, x, y, w, h, { tag, head, text, warm, tagColor, fill, name, hs }) {
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.16, fill: { color: fill || 'FFFEFB' }, line: { color: warm ? H.accent2 : 'D6E6F3', width: warm ? 2 : 1 }, shadow: shadow(), objectName: name || 'card' });
  const runs = [];
  if (tag) runs.push({ text: tag, options: { fontFace: EN, fontSize: 11, bold: true, charSpacing: 2, color: tagColor || (warm ? C.accent6 : C.accent1), breakLine: true, paraSpaceAfter: 4 } });
  if (head) runs.push({ text: head, options: { fontSize: hs || 20, bold: true, color: C.text1, breakLine: !!text, paraSpaceAfter: 8 } });
  if (text) runs.push({ text, options: { fontSize: 15, color: C.text2, lineSpacingMultiple: 1.35 } });
  s.addText(runs, { x: x + 0.22, y: y + 0.18, w: w - 0.44, h: h - 0.32, valign: 'top', margin: 0, isTextBox: true });
}
function statCard(s, x, y, w, h, { big, unit, small, bigColor }) {
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.16, fill: { color: 'FFFEFB' }, line: { color: 'D6E6F3', width: 1 }, shadow: shadow(), objectName: 'stat' });
  const runs = [];
  if (unit && !big.startsWith('0')) {}
  runs.push({ text: big, options: { fontFace: EN, fontSize: 48, bold: true, color: bigColor || C.accent1, breakLine: true } });
  if (unit) runs.push({ text: unit, options: { fontSize: 17, bold: true, color: C.text1, breakLine: true, paraSpaceAfter: 4 } });
  if (small) runs.push({ text: small, options: { fontSize: 13, color: C.text2, lineSpacingMultiple: 1.25 } });
  s.addText(runs, { x: x + 0.24, y: y + 0.16, w: w - 0.48, h: h - 0.3, valign: 'top', margin: 0, isTextBox: true });
}
function take(s, y, text, opts = {}) {
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: X0, y, w: W0, h: opts.h || 0.66, rectRadius: 0.33, fill: { color: opts.fill || C.accent1 }, line: { type: 'none' }, objectName: 'take' });
  s.addText(text, { x: X0 + 0.4, y, w: W0 - 0.8, h: opts.h || 0.66, fontSize: 17, bold: true, color: opts.color || 'FFFEFB', valign: 'middle', margin: 0, isTextBox: true });
}
function src(s, y, text, h = 0.3) {
  s.addText(text, { x: X0, y, w: W0, h, fontSize: 11, color: C.text2, margin: 0, valign: 'top', isTextBox: true });
}
function cols(n, gap = 0.3, x = X0, w = W0) {
  const cw = (w - gap * (n - 1)) / n;
  return Array.from({ length: n }, (_, i) => ({ x: x + i * (cw + gap), w: cw }));
}
function chip(s, text, color) {
  const w = 0.32 + text.length * 0.2;
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: X0 + W0 - w, y: 0.45, w, h: 0.46, rectRadius: 0.23, fill: { color }, line: { type: 'none' }, objectName: 'chip' });
  s.addText(text, { x: X0 + W0 - w, y: 0.45, w, h: 0.46, fontSize: 14, bold: true, color: 'FFFEFB', align: 'center', valign: 'middle', margin: 0, isTextBox: true });
}
function panel(s, x, y, w, h, head, items, focus) {
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.16, fill: { color: focus ? 'E3F1FF' : 'FFFEFB' }, line: focus ? { color: H.accent1, width: 2.5 } : { color: 'D6E6F3', width: 1 }, shadow: focus ? undefined : shadow(), objectName: focus ? 'panel-focus' : 'panel' });
  const runs = [{ text: head, options: { fontSize: 20, bold: true, color: C.text1, breakLine: true, paraSpaceAfter: 12 } }];
  items.forEach((t, i) => runs.push({ text: t, options: { fontSize: 17, color: focus ? C.text1 : C.text2, bullet: { indent: 14 }, paraSpaceAfter: 12, lineSpacingMultiple: 1.25, breakLine: i < items.length - 1 } }));
  s.addText(runs, { x: x + 0.25, y: y + 0.2, w: w - 0.5, h: h - 0.35, valign: 'top', margin: 0, isTextBox: true });
}
function table(s, y, head, rows, colW, fs = 14, opts = {}) {
  const hdr = head.map(t => ({ text: t, options: { bold: true, color: 'FFFEFB', fill: { color: H.accent1 } } }));
  const body = rows.map((r, i) => r.map((t, j) => ({ text: t, options: { fill: { color: i % 2 ? 'EAF6FF' : 'FFFEFB' }, bold: j === 0, color: H.dk1 } })));
  s.addTable([hdr, ...body], { x: X0, y, w: W0, colW, fontSize: fs, fontFace: 'BIZ UDPGothic', color: H.dk1, border: { type: 'solid', pt: 0.75, color: 'CFE3F2' }, valign: 'middle', margin: [5, 8, 5, 8], autoPage: false, rowH: opts.rowH });
}
function stageSlide({ eyebrow, chipText, chipColor, title, feat, focus, notes }) {
  const s = slide('CONTENT', eyebrow, title, notes);
  chip(s, chipText, chipColor);
  const c = cols(2, 0.3);
  panel(s, c[0].x, 1.85, c[0].w, 4.75, '目の特徴', feat, false);
  panel(s, c[1].x, 1.85, c[1].w, 4.75, '指導の重点', focus, true);
  return s;
}

// ===================== slides: バッティングと視る力（専門編） =====================
function statement(master, eyebrow, lines, lead, notes, opts = {}) {
  const s = slide(master, null, null, notes);
  s.addText(eyebrow, { x: X0, y: 1.3, w: 8, h: 0.4, fontFace: EN, fontSize: 14, bold: true, charSpacing: 3, color: opts.eyeColor || C.accent1, margin: 0, isTextBox: true });
  s.addText(lines.map((t, i) => ({ text: t, options: { breakLine: i < lines.length - 1 } })), { x: X0, y: 1.85, w: W0, h: 2.8, fontSize: opts.size || 40, bold: true, color: C.text1, margin: 0, valign: 'top', lineSpacingMultiple: 1.3, isTextBox: true });
  if (lead) s.addText(lead.map((t, i) => ({ text: t, options: { breakLine: i < lead.length - 1 } })), { x: X0, y: 4.85, w: W0, h: 1.2, fontSize: 19, color: '2E3D55', margin: 0, valign: 'top', lineSpacingMultiple: 1.5, isTextBox: true });
  return s;
}
function divider(num, title, sub, notes) {
  const s = slide('STATEMENT_DARK', null, null, notes);
  s.addText(`PART ${num}`, { x: X0, y: 2.3, w: 6, h: 0.5, fontFace: EN, fontSize: 18, bold: true, charSpacing: 4, color: C.accent1, margin: 0, isTextBox: true });
  s.addText(title, { x: X0, y: 2.9, w: W0, h: 1.0, fontSize: 40, bold: true, color: C.text1, margin: 0, valign: 'top', isTextBox: true });
  s.addText(sub, { x: X0, y: 4.05, w: W0, h: 0.9, fontSize: 18, color: '2E3D55', margin: 0, valign: 'top', lineSpacingMultiple: 1.4, isTextBox: true });
  return s;
}

sec('導入');
// 1 cover
{
  const s = pres.addSlide({ masterName: 'COVER', sectionTitle: section });
  s.addImage({ path: 'cover_art.png', x: 7.25, y: 1.0, w: 5.45, h: 5.0, altText: 'リリースからストライクゾーンへ向かう投球と、それを先回りして追う視線の軌跡' });
  s.addText('SPORTS VISION FOR HITTERS', { x: X0, y: 1.6, w: 7, h: 0.4, fontFace: EN, fontSize: 14, bold: true, charSpacing: 3, color: C.accent1, margin: 0, isTextBox: true });
  s.addText([{ text: 'バッティングと', options: { breakLine: true } }, { text: '「視る力」' }], { x: X0, y: 2.1, w: 7.2, h: 2.1, fontSize: 52, bold: true, color: C.text1, margin: 0, valign: 'top', lineSpacingMultiple: 1.05, isTextBox: true });
  s.addText([{ text: '野球と視る力 専門編。', options: { breakLine: true } }, { text: '目、頭、予測から読み解く打撃' }], { x: X0, y: 4.35, w: 7, h: 1.1, fontSize: 20, color: '2E3D55', margin: 0, valign: 'top', lineSpacingMultiple: 1.4, isTextBox: true });
  s.addText('研修資料 ｜ [講師名]', { x: X0, y: 6.55, w: 6, h: 0.35, fontSize: 12, color: C.text2, margin: 0, isTextBox: true });
  s.addNotes('皆さん、こんにちは。前回は「野球と視る力」として、小学生から高校生までの目の育ちと、年代ごとの指導の重点をお話ししました。今回はその専門編です。テーマをバッティングひとつにしぼり、スポーツビジョンの視点から、もう一段深く掘り下げます。眼科学や視覚科学、運動制御、認知心理学、そしてプロ野球のデータ分析まで、いくつかの分野の研究を横断してご紹介します。専門用語も出てきますが、出てくるたびに意味を説明しますし、用語の一覧も用意しました。今日のゴールは、「ボールをよく見ろ」という一言の中身を、指導者が自分の言葉で説明できるようになることです。そしてもうひとつ、研究で分かっていることと、まだ分かっていないことを区別して、選手や保護者に誠実に伝えられるようになることです。');
}
// 2 agenda
{
  const s = slide('CONTENT', 'AGENDA', '今日の流れ', '今日は5つのパートで進めます。パート1では、打撃を支える視覚の仕組みを整理します。眼球運動の種類や、見てから動くまでの時間の遅れといった、土台になる考え方です。パート2は予測です。熟練した打者は、ボールが投手の手を離れる前から情報を集めています。その研究を見ていきます。パート3では、投球を追うときの目と頭の使い方を、実際の測定研究から読み解きます。パート4では、視力やコントラスト感度などの視機能と、打撃成績との関係を、プロ選手の大規模なデータから確かめます。最後のパート5では、視覚トレーニングの研究をどう読むか、そして育成年代の指導にどう生かすかをお話しします。');
  const rows = [
    ['01', '打撃を支える視覚の仕組み', '情報処理の流れ、眼球運動の種類、見てから動くまでの時間の制約'],
    ['02', 'リリース前から始まる予測', 'アドバンスキュー、遮蔽法による研究、予測が外れるときに起きること'],
    ['03', '投球を追う、目と頭の使い方', '頭部での追従、前庭動眼反射の抑制、予測的サッカード'],
    ['04', '視機能と打撃成績', 'プロ選手の視機能、選球眼との関係、ぼやけと利き目をめぐる研究'],
    ['05', 'トレーニングの根拠と、指導への生かし方', '研究の読み方、転移という考え方、育成年代での実践'],
  ];
  rows.forEach((r, i) => {
    const y = 1.85 + i * 0.97;
    s.addText(r[0], { x: X0, y, w: 0.9, h: 0.55, fontFace: EN, fontSize: 28, bold: true, color: C.accent3, margin: 0, valign: 'top', isTextBox: true });
    s.addText([{ text: r[1], options: { fontSize: 19, bold: true, color: C.text1, breakLine: true, paraSpaceAfter: 3 } }, { text: r[2], options: { fontSize: 14, color: C.text2 } }], { x: X0 + 1.0, y, w: W0 - 1.0, h: 0.8, margin: 0, valign: 'top', isTextBox: true });
    s.addShape(pres.shapes.LINE, { x: X0, y: y + 0.84, w: W0, h: 0, line: { color: 'CFE3F2', width: 1.25 }, objectName: 'row-divider' });
  });
}
// 3 question
statement('STATEMENT_DARK', 'QUESTION', ['「ボールをよく見ろ」。', 'その一言で打てるなら、', '誰も苦労はしない。'], ['打者は何を、いつ、どうやって見ているのか。', '研究が明らかにしてきた「見る」の中身をひもときます。'], '本題に入る前に、少し挑戦的な言葉を置かせてください。「ボールをよく見ろ」。その一言で打てるようになるなら、誰も苦労はしません。（少し間を取る）。私たち指導者は、この言葉を本当によく使います。でも、言われた選手は、具体的に何をすればいいのでしょうか。目を大きく開けばいいのか、ボールから目を離さなければいいのか、それとも別の何かなのか。実は、打者が何を、いつ、どうやって見ているのかについては、この40年ほどで多くの研究が積み重なってきました。そして、その中には、私たちの常識とは少し違う結果もあります。今日は、その研究をひとつずつひもといて、「見る」という言葉の中身を、具体的な言葉に置きかえていきます。');

sec('打撃を支える視覚の仕組み');
// 4 information flow
{
  const s = slide('CONTENT', 'PART 1 ｜ INFORMATION PROCESSING', '打撃は「見る、判断する、打つ」の情報処理', 'パート1です。まず、打撃を情報処理の流れとして整理します。最初は入力です。網膜の中心にある中心窩は、細かいものを見分ける力がいちばん高い場所で、見たいものに視線を合わせると、像がここに映ります。一方、中心から外れた周辺視は、細かさは劣りますが、動きをとらえるのが得意です。打者は、中心視と周辺視の両方を使って、投手とボールの情報を取り込んでいます。次が知覚と認知です。入った情報から、球種、コース、スピードを読み、打つか見送るかを決めます。ここには、これまでの経験や、配球の予想といった頭の中の情報も加わります。最後が運動の出力で、タイミングを合わせてスイングします。大切なのは、この3つの段階のどこでつまずいても、結果は同じ「打てない」になるということです。見えていないのか、判断が遅いのか、スイングが間に合わないのか。原因を分けて考えることが、指導の第一歩になります。');
  const steps = [['入力', '中心視で細部を、周辺視で動きをとらえる'], ['知覚・認知', '球種、コース、速さを読み、打つか見送るかを決める'], ['運動出力', 'タイミングと軌道を合わせてスイングする']];
  const sw = 3.3, aw = 0.6, gap = (W0 - sw * 3 - aw * 2) / 4;
  steps.forEach((st, i) => {
    const x = X0 + i * (sw + aw + gap * 2);
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 1.95, w: sw, h: 1.75, rectRadius: 0.16, fill: { color: C.accent1 }, line: { type: 'none' }, objectName: 'flow-step' });
    s.addText([{ text: st[0], options: { fontSize: 24, bold: true, breakLine: true, paraSpaceAfter: 6 } }, { text: st[1], options: { fontSize: 15 } }], { x: x + 0.25, y: 2.1, w: sw - 0.5, h: 1.5, color: 'FFFEFB', margin: 0, valign: 'top', isTextBox: true });
    if (i < 2) s.addShape(pres.shapes.RIGHT_ARROW, { x: x + sw + gap, y: 2.6, w: aw, h: 0.42, fill: { color: C.accent2 }, line: { type: 'none' }, objectName: 'flow-arrow' });
  });
  const c = cols(3, 0.3);
  card(s, c[0].x, 4.0, c[0].w, 1.65, { head: '見えていない？', text: '屈折異常、コントラスト、照明。視機能の問題。', hs: 18 });
  card(s, c[1].x, 4.0, c[1].w, 1.65, { head: '判断が遅い？', text: '手がかりを読めていない。予測と経験の問題。', hs: 18 });
  card(s, c[2].x, 4.0, c[2].w, 1.65, { head: '間に合わない？', text: 'スイングの速さや始動。運動の問題。', hs: 18, warm: true });
  take(s, 5.95, '同じ「打てない」でも、つまずいている段階は選手ごとに違う');
}
// 5 glossary
{
  const s = slide('CONTENT_PAPER', 'PART 1 ｜ GLOSSARY', '今日使う、目の動きの専門用語', 'ここで、今日の話に出てくる専門用語をまとめておきます。サッカードは、視線をある点から別の点へ、ぱっと素早く飛ばす目の動きです。滑動性追従眼球運動は、英語でスムーズパシュートと呼ばれ、動いているものをなめらかに追い続ける目の動きです。前庭動眼反射、略してVORは、頭が動いたときに、その反対方向へ目を動かして、見ている像がぶれないようにする反射です。歩きながらでも景色がぶれないのは、この反射のおかげです。VORの抑制、あるいはキャンセルは、頭と一緒に目標を追いたいときに、この反射を打ち消す働きのことで、打者がボールを頭で追うときに必要になります。予測的サッカードは、ボールが来ると予測した場所へ、先回りして視線を飛ばす動きです。輻輳と開散は、近くを見るときに両目が内側に寄り、遠くを見るときに外側へ開く動き。調節は、水晶体の厚みを変えてピントを合わせる働きです。中心窩と周辺視は、先ほどのスライドでお話ししたとおりです。この表は、あとで見返せるように資料として残しておいてください。');
  table(s, 1.8, ['用語', '意味', '打撃との関わり'], [
    ['サッカード（衝動性眼球運動）', '視線をすばやく別の点へ飛ばす動き', '投手の手元からボールへ、当たる位置へ'],
    ['滑動性追従眼球運動', '動く対象をなめらかに追い続ける動き', '投球の前半を追う'],
    ['前庭動眼反射（VOR）', '頭の動きと逆向きに目を動かし、像を安定させる反射', '頭でボールを追うときは抑える必要がある'],
    ['予測的サッカード', '対象が来る位置へ先回りして視線を移す動き', '当たる位置への視線の先回り'],
    ['輻輳・開散／調節', '両目の寄せと開き／水晶体でのピント合わせ', '近づくボールの距離をつかむ手がかり'],
    ['中心窩／周辺視', '細部を見る網膜の中心／動きに敏感な周辺の視野', '投手の腕の動きを周辺視でとらえる'],
  ], [3.3, 4.3, 4.23], 14, { rowH: [0.5, 0.68, 0.68, 0.68, 0.68, 0.68, 0.68] });
  src(s, 6.45, '用語の説明は眼科学・視覚科学の一般的な定義による。右の列は打撃での場面を当てはめた例。');
}
// 6 eight skills
{
  const s = slide('CONTENT', 'PART 1 ｜ 8 VISUAL SKILLS', 'スポーツビジョンの8項目を、打席に当てはめる', 'スポーツビジョンは、日本スポーツビジョン協会の測定では8つの項目に分けて評価されます。前回もご紹介しましたが、今回は打撃の情報処理のどの段階に関わるかという視点で見直してみます。静止視力とコントラスト感度は、入力の質そのものです。いくら判断が優れていても、像がぼやけていたり、背景とボールの明るさの差が小さかったりすれば、入ってくる情報が減ります。KVA動体視力とDVA動体視力、眼球運動は、動くものから情報を取り続ける力です。深視力は、距離や奥行きをつかむ力で、ボールとの距離やミートポイントの前後に関わります。瞬間視は、一瞬で多くの情報をつかむ力で、リリースの瞬間の手がかりを読むことに関わると考えられます。そして眼と手の協応動作は、見た情報を体の動きに変える、出力の段階です。右の列は、測定項目の定義に打席の場面を当てはめた例で、それぞれを研究で確かめたものではないことを申し添えます。');
  table(s, 1.8, ['測定項目', '主に関わる段階', '打席での場面（例）'], [
    ['静止視力', '入力', '投手の手元、握り、ボールの回転'],
    ['コントラスト感度', '入力', 'ナイター、曇天、背景にまぎれる白球'],
    ['KVA動体視力', '入力から知覚', '自分に向かってくる投球を追う'],
    ['DVA動体視力', '入力から知覚', '横に曲がる変化球を追う'],
    ['眼球運動', '入力から知覚', '投手の手元からボールへの視線移動'],
    ['深視力', '知覚', 'ボールとの距離、ミートポイントの前後'],
    ['瞬間視', '知覚・認知', 'リリースの一瞬で球種やコースをつかむ'],
    ['眼と手の協応動作', '運動出力', '見た軌道にバットを合わせる'],
  ], [2.9, 3.0, 5.93], 15, { rowH: [0.5, 0.52, 0.52, 0.52, 0.52, 0.52, 0.52, 0.52, 0.52] });
  src(s, 6.55, '測定項目の区分：日本スポーツビジョン協会　中央と右の列は打撃に当てはめた整理と例');
}
// 7 time budget
{
  const s = slide('CONTENT_PAPER', 'PART 1 ｜ TIME BUDGET', '打者に与えられた時間は、0.5秒に満たない', '次に、時間の制約です。運動学習の教科書では、時速90マイル、およそ時速145キロの投球が本塁に届くまでの時間を約0.46秒、スイングにかかる時間を約0.16秒として計算しています。単純に引き算すると、スイングはボールが投手の手を離れてから約0.3秒のところで始めなければなりません。図の黄色の部分が、スイングにかかる時間です。さらに、ここに視覚運動遅延という考え方が加わります。目から入った情報が脳で処理され、筋肉の動きとして修正に使われるまでには、時間の遅れがあります。日本の樋口氏らが2016年に発表した研究では、打者の視界を途中で遮る実験を行いました。リリースから0.15秒後に見えなくした条件、ボールが届く0.15秒前に見えなくした条件、遮らない条件を比べたところ、バットのどこに当たるかの平均の位置は変わりませんでした。見える時間が長くなっても、当たる位置のばらつきが減ったのは、バットの短い軸の方向だけでした。著者らは、投球の後半、あるいは最後の3分の1の情報は、スイングの修正には使われていない可能性があると考察しています。つまり、打撃の勝負は、ボールが打者に近づく前に、かなりの部分が決まっているということです。');
  // timeline
  const tx = X0 + 0.2, tw = W0 - 0.4, ty = 2.35;
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: tx, y: ty, w: tw, h: 0.5, rectRadius: 0.1, fill: { color: 'D6E6F3' }, line: { type: 'none' }, objectName: 'timeline' });
  const swingX = tx + tw * (300 / 460);
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: swingX, y: ty, w: tx + tw - swingX, h: 0.5, rectRadius: 0.1, fill: { color: C.accent2 }, line: { type: 'none' }, objectName: 'swing-span' });
  s.addText('スイング 約0.16秒', { x: swingX, y: ty, w: tx + tw - swingX, h: 0.5, fontSize: 14, bold: true, color: C.text1, align: 'center', valign: 'middle', margin: 0, isTextBox: true });
  s.addText('見て、判断する時間 約0.3秒', { x: tx, y: ty, w: swingX - tx, h: 0.5, fontSize: 14, bold: true, color: C.accent1, align: 'center', valign: 'middle', margin: 0, isTextBox: true });
  [['0秒 リリース', tx, 'left'], ['約0.3秒 スイング開始', swingX - 1.2, 'center'], ['約0.46秒 本塁', tx + tw - 2.4, 'right']].forEach(([t, x, al]) => s.addText(t, { x, y: ty + 0.6, w: 2.4, h: 0.32, fontSize: 13, color: C.text2, align: al, margin: 0, isTextBox: true }));
  s.addText('時速約145km（90マイル）の投球の例', { x: tx, y: 1.85, w: tw, h: 0.35, fontSize: 14, color: C.text2, margin: 0, isTextBox: true });
  const c = cols(2, 0.3);
  card(s, c[0].x, 3.55, c[0].w, 2.15, { tag: 'VISUOMOTOR DELAY', head: '見てから修正するまでの遅れ', text: '目に入った情報が動きの修正に使われるまでには、時間の遅れ（視覚運動遅延）がある。' });
  card(s, c[1].x, 3.55, c[1].w, 2.15, { tag: 'HIGUCHI et al. ｜ 2016', head: '後半の情報は使われにくい', text: '途中で視界を遮っても、当たる位置の平均は変わらなかった。投球の後半の情報は、修正に寄与しない可能性。', warm: true });
  src(s, 5.9, '時間の例：Human Kinetics「Applying the Principles: Baseball Batting」／ Higuchi et al. (2016) PLoS ONE 11(2): e0148498（リリース後0.15秒、到達0.15秒前で遮蔽する条件を比較）', 0.6);
}

sec('リリース前から始まる予測');
// 8 divider
divider(2, 'リリース前から始まる予測', '熟練した打者は、ボールが手を離れる前から、投手の体の動きを読んでいる。', 'パート2、予測です。先ほど見たように、打者に与えられた時間はとても短く、しかも投球の後半の情報は、スイングの修正に使われにくいことが分かってきました。では、熟練した打者は、どうやって間に合わせているのでしょうか。その答えのひとつが予測です。熟練した打者は、ボールが投手の手を離れる前から、投手の体の動きを読んでいます。このパートでは、その研究を見ていきます。');
// 9 advance cues
{
  const s = slide('CONTENT', 'PART 2 ｜ ADVANCE CUES', '熟練打者は、投手の「肘」を見ている', 'リリースより前に手に入る、相手の体の動きからの手がかりを、アドバンスキュー、日本語では先行手がかりと呼びます。中京大学の竹内氏と猪俣氏は、2012年に、打者の視覚探索方略を調べた研究を発表しています。投手の投球映像を見せて、スイングすると決めた時点でボタンを押してもらい、目の動きと反応の速さ、正確さを測りました。その結果、打者はリリースが近づく最後の局面で、投手の投げる側の手首、肘、腕を見ていました。そして、映像の中で投球腕だけを隠すと、ほかの体の部分を隠したときよりも、反応が明らかに遅くなりました。著者らは、熟練者は投手の肘に視線の拠点、視覚的ピボットを置き、投手の全身の動きの中から投球腕の手がかりを読み取っていると結論づけています。視線は肘に置いたまま、周辺視で腕や全身の動きを感じている、というイメージです。右は、クリケットの研究です。世界トップクラスの打者は、投球する手と腕の動きという早い段階の手がかりから、球種を読み取ることができ、それより下のレベルの選手にはそれができませんでした。');
  const c = cols(2, 0.3);
  card(s, c[0].x, 1.85, c[0].w, 3.0, { tag: 'TAKEUCHI & INOMATA ｜ 2012', head: '視線の拠点は投手の肘', text: '最後の局面で、打者は投球側の手首、肘、腕を見ていた。投球腕を隠すと反応が有意に遅れた。熟練者は肘に視覚的ピボットを置き、全身の動きから手がかりを読むと結論。' });
  card(s, c[1].x, 1.85, c[1].w, 3.0, { tag: 'MÜLLER et al. ｜ 2006', head: '早い手がかりを読めるのは一流だけ', text: 'クリケットの研究。高い技能の打者だけが、投球する手と腕という早い段階の手がかりから、球種を読み取れた。', warm: true });
  take(s, 5.15, '視線は肘に置き、周辺視で腕と全身の動きをとらえる');
  src(s, 6.05, '竹内・猪俣 (2012) スポーツ心理学研究 39(1) ／ Müller, Abernethy & Farrow (2006) Q J Exp Psychol 59(12)');
}
// 10 occlusion method
{
  const s = slide('CONTENT_PAPER', 'PART 2 ｜ OCCLUSION PARADIGM', '「隠して確かめる」遮蔽法という研究方法', '今ご紹介した研究は、遮蔽法と呼ばれる方法を使っています。研究を正しく読むために、少し方法の話をさせてください。遮蔽法には大きく2つあります。ひとつは時間的遮蔽です。投球の映像を、リリースの少し前、リリースの瞬間、リリースの少し後など、いろいろな時点で止めて、その後の球種やコースを答えてもらいます。どの時点までの情報で正しく予測できるかが分かります。もうひとつは空間的遮蔽です。投手の腕、脚、体幹など、特定の部分だけを隠して、予測の正確さがどう変わるかを見ます。正確さが大きく落ちた部分が、打者が頼っている手がかりだと考えられます。この方法の良いところは、打者が「何を、いつ使っているか」を外から確かめられることです。一方で、映像を見てボタンを押す課題と、実際にバットを振る打席とは違う、という限界もあります。この方法は、後でご紹介するように、トレーニングにも応用されています。');
  const c = cols(2, 0.3);
  card(s, c[0].x, 1.85, c[0].w, 2.4, { tag: 'TEMPORAL OCCLUSION', head: '時間的遮蔽', text: '映像をリリース前、リリース時、リリース後など、いろいろな時点で止める。どこまでの情報で予測できるかが分かる。' });
  card(s, c[1].x, 1.85, c[1].w, 2.4, { tag: 'SPATIAL OCCLUSION', head: '空間的遮蔽', text: '腕、脚、体幹など一部だけを隠す。正確さが落ちた部分が、頼っている手がかり。' });
  card(s, X0, 4.5, W0, 1.05, { tag: 'LIMITATION', head: '限界：映像でボタンを押す課題と、実際の打席は同じではない', text: '', warm: true, hs: 17 });
  src(s, 5.8, '遮蔽法は、竹内・猪俣 (2012)、Müller et al. (2006) などで用いられている研究方法。');
}
// 11 prediction errors
{
  const s = slide('CONTENT', 'PART 2 ｜ WHEN PREDICTION FAILS', '予測が外れると、何が起きるのか', '予測は強力な武器ですが、外れたときにはどうなるのでしょうか。アメリカのグレイ氏は2002年、大学の野球選手に仮想の打撃課題を行ってもらいました。球速にばらつきがあると、それに応じて、予測できる形で空間的なずれ、つまり上下などの当たる位置のずれが生じました。また、タイミングの正確さに比べて、空間的な正確さの方が劣っていました。関連する研究では、直前までの配球の流れが、スイングのタイミングのずれに強く影響することも報告されています。真ん中は、有名な「浮き上がる速球」の研究です。物理的には、投球が浮き上がることはないとされています。バーヒル氏とカルナヴァス氏は1993年、浮き上がる速球や、急に落ちるカーブの見え方は、打者が球速を見誤ることによって生じる錯覚だと説明するモデルを示しました。球速を実際より遅く見積もると、ボールが来る位置を実際より低く予測してしまい、ボールが浮き上がったように感じるという説明です。つまり、打者の頭の中の予測は、見え方そのものまで変えてしまうことがあるのです。投手側から見れば、緩急や配球は、この予測を外すための技術だと言えます。');
  const c = cols(3, 0.3);
  card(s, c[0].x, 1.85, c[0].w, 3.15, { tag: 'GRAY ｜ 2002', head: '球速の変化で位置がずれる', hs: 18, text: '大学選手の仮想打撃。球速のばらつきは予測できる形の位置のずれを生み、位置の正確さはタイミングより劣った。' });
  card(s, c[1].x, 1.85, c[1].w, 3.15, { tag: 'SEQUENCE EFFECT', head: '直前の配球が影響する', hs: 18, text: '直前までの投球の流れが、スイングのタイミングのずれに強く影響すると報告されている。' });
  card(s, c[2].x, 1.85, c[2].w, 3.15, { tag: 'BAHILL & KARNAVAS ｜ 1993', head: '浮き上がる速球は錯覚', hs: 18, text: '球速の見誤りで、来る位置を誤って予測することから生じる錯覚だと説明するモデル。', warm: true });
  take(s, 5.3, '予測は武器にも弱点にもなる。緩急と配球は、予測を外す投手の技術');
  src(s, 6.2, 'Gray (2002) J Exp Psychol Hum Percept Perform ／ Bahill & Karnavas (1993) J Exp Psychol Hum Percept Perform 19(1)');
}

sec('投球を追う、目と頭の使い方');
// 12 divider
divider(3, '投球を追う、目と頭の使い方', '打者はボールを目だけで追っているのではない。頭の向き、反射の抑制、視線の先回り。', 'パート3では、ボールが投手の手を離れてからの、目と頭の使い方を見ていきます。キーワードは、頭の向き、反射の抑制、そして視線の先回りです。');
// 13 head tracking
{
  const s = slide('CONTENT', 'PART 3 ｜ HEAD TRACKING', '「最後までボールを見る」ことは、目だけではできない', '1984年、バーヒル氏とラリッツ氏は、速球を模したボールを追う打者の目の動きを実験室で測定しました。論文のタイトルは「なぜ打者はボールから目を離さずにいられないのか」です。打者は投球を手元まで、目だけで追い続けることはできませんでした。また、ボールの前半を追ったあとに、当たると予測した位置へ視線を飛ばす方法も示されています。これが、先ほど用語集でご紹介した予測的サッカードです。2014年には、オハイオ州立大学のフォグト氏らが、大学の一部リーグの選手15名を対象に、目の動きをビデオで、頭の動きを慣性センサーで測りました。選手はマシンの投球を打たずに目で追いました。すると、選手たちはボールが空中にある間、主に頭の動きでボールを追い、目は投球の終わり近くまでほとんど動いていませんでした。つまり、「目を離さない」の実体は、目を動かし続けることではなく、頭ごとボールに向け続けることに近いと考えられます。');
  const c = cols(2, 0.3);
  card(s, c[0].x, 1.85, c[0].w, 2.75, { tag: 'BAHILL & LaRITZ ｜ 1984', head: '目だけでは手元まで追えない', text: '実験室での測定。打者は投球を手元まで目で追い続けられなかった。前半を追い、当たる位置へ視線を先回りさせる方法も示された。' });
  card(s, c[1].x, 1.85, c[1].w, 2.75, { tag: 'FOGT & ZIMMERMAN ｜ 2014', head: '主に頭の向きで追う', text: '大学選手15名、眼球はビデオ、頭部は慣性センサーで測定。空中にある間は主に頭で追い、目は終盤までほとんど動かなかった。', warm: true });
  take(s, 4.95, '「目を離さない」の実体は、頭ごとボールに向け続けること');
  src(s, 5.85, 'Bahill & LaRitz (1984) American Scientist 72 ／ Fogt & Zimmerman (2014) Optom Vis Sci　※打たずに見る、または実験室での測定');
}
// 14 VOR
{
  const s = slide('CONTENT_PAPER', 'PART 3 ｜ VOR CANCELLATION', '頭で追うために、脳は「反射」を打ち消している', 'では、なぜ頭で追うことが大切なのでしょうか。ここで前庭動眼反射、VORが関わってきます。私たちが頭を動かすと、耳の奥にある前庭という器官がその動きを感じ取り、目を反対方向へ動かして、見ている像を安定させます。ところが、打者がボールを追って頭を回すとき、この反射が働くと、目は逆向きに動いてしまい、ボールから視線がずれてしまいます。オハイオ州立大学のトゥール氏とフォグト氏は、2021年の総説の中で、打者が頭でボールを追うときには、このVORを打ち消す必要があると説明しています。つまり、頭と目を一緒にボールへ向け続けるのは、反射に逆らう高度な働きなのです。また、この総説では、打者は少なくとも投球の前半では、ボールを中心窩でとらえ続けていること、そしてその動きが、技能のレベルが違っても似ていたことがまとめられています。一方で、投球の終盤については、中心窩で追い続けるという研究と、予測的サッカードを使うという研究があり、結果が分かれています。');
  const steps = [['頭を回す', 'ボールを追って頭を回旋する'], ['反射が働く', 'VORが目を逆向きに動かそうとする'], ['反射を抑える', 'VORを打ち消し、頭と目を一緒に向ける']];
  const sw = 3.3, aw = 0.6, gap = (W0 - sw * 3 - aw * 2) / 4;
  steps.forEach((st, i) => {
    const x = X0 + i * (sw + aw + gap * 2);
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 1.9, w: sw, h: 1.55, rectRadius: 0.16, fill: { color: i === 2 ? C.accent3 : C.accent1 }, line: { type: 'none' }, objectName: 'flow-step' });
    s.addText([{ text: st[0], options: { fontSize: 22, bold: true, breakLine: true, paraSpaceAfter: 6 } }, { text: st[1], options: { fontSize: 15 } }], { x: x + 0.25, y: 2.05, w: sw - 0.5, h: 1.3, color: 'FFFEFB', margin: 0, valign: 'top', isTextBox: true });
    if (i < 2) s.addShape(pres.shapes.RIGHT_ARROW, { x: x + sw + gap, y: 2.45, w: aw, h: 0.42, fill: { color: C.accent2 }, line: { type: 'none' }, objectName: 'flow-arrow' });
  });
  const c = cols(2, 0.3);
  card(s, c[0].x, 3.75, c[0].w, 1.95, { tag: 'AGREED', head: '前半は中心窩でとらえ続ける', text: '少なくとも前半は、頭を主に使って中心窩でボールをとらえる。技能レベルで似た傾向。' });
  card(s, c[1].x, 3.75, c[1].w, 1.95, { tag: 'NOT YET AGREED', head: '終盤の戦略は研究で分かれる', text: '終盤まで中心窩で追うという研究と、予測的サッカードを使うという研究がある。', warm: true });
  src(s, 5.95, 'Toole & Fogt (2021) Review: Head and eye movements and gaze tracking in baseball batting. Optom Vis Sci 98(7): 750–758');
}
// 15 elite
{
  const s = slide('CONTENT', 'PART 3 ｜ ELITE BATTERS', '一流の打者は、頭で追い、視線で先を読む', '実際に打っている一流の打者では、どうなっているのでしょうか。左は、NTTの研究チーム、木下氏、上田氏、柏野氏が2020年に発表した研究です。プロ野球の一軍と二軍の打者に、球種を知らせないまま元投手の球を打ってもらい、装着型のアイトラッカーで目の動きを、光学式のモーションキャプチャで頭の動きとバットの軌道を測りました。試合に近い状況をつくった実験です。その結果、一軍の打者は、頭の向きを使って、ボールが当たる位置をとらえている可能性が示されました。また、当てにいくときには、バットとボールが当たる直前に、当たる位置へサッカードで視線を移していました。真ん中は、クリケットの世界的な打者2名を調べた研究です。頭の回転をボールの動きにぴったり合わせ、ボールが頭から見て一定の方向に保たれるようにしていました。そして、打つ瞬間には視線をボールに向けていました。論文のタイトルは「頭が追い、視線が予測する」です。右の総説が指摘するように、どの動き方が打撃をいちばんよくするのかは、まだ結論が出ていません。それでも、一流の打者に共通する姿として、頭での追従と、視線の先回りが浮かび上がってきています。');
  const c = cols(3, 0.3);
  card(s, c[0].x, 1.85, c[0].w, 3.25, { tag: 'KISHITA et al. ｜ 2020', head: 'プロの実際の打撃', text: '一軍と二軍の打者を、装着型アイトラッカーと光学式モーションキャプチャで測定。一軍の打者は頭の向きで当たる位置をとらえている可能性。当たる直前にサッカードで視線を移していた。' });
  card(s, c[1].x, 1.85, c[1].w, 3.25, { tag: 'MANN et al. ｜ 2013', head: '頭が追い、視線が予測する', hs: 18, text: 'クリケットの一流打者2名。頭の回転をボールの動きに合わせ、ボールを頭から見て一定の方向に保った。打つ瞬間には視線をボールへ。' });
  card(s, c[2].x, 1.85, c[2].w, 3.25, { tag: 'TOOLE & FOGT ｜ 2021', head: 'まだ結論は出ていない', text: 'どの頭と目の動かし方が打撃を最もよくするかは一致した結論がない。試合条件での大規模な研究が必要。', warm: true });
  take(s, 5.4, '共通して見えてきた姿：頭での追従と、視線の先回り');
  src(s, 6.25, 'Kishita et al. (2020) Front Sports Act Living 2:3 ／ Mann et al. (2013) PLoS ONE 8(3) ／ Toole & Fogt (2021)');
}
// 16 coaching words
{
  const s = slide('CONTENT_PAPER', 'PART 3 ｜ COACHING WORDS', '研究を、打席で使える言葉に置きかえる', 'ここまでの研究を、打席で使える言葉に置きかえてみました。これは研究で効果を直接確かめた声かけではなく、研究で分かってきたことをもとに考えた例です。ひとつ目は「肘を見て、腕は周りで感じる」。熟練した打者が投手の肘に視線の拠点を置き、周辺視で腕の動きをとらえていたという研究からの言葉です。ふたつ目は「顔ごとボールに向ける」。打者は主に頭の向きでボールを追っているという研究からです。目だけを動かそうとして、顎が上がったり顔が早く開いたりする選手には、伝わりやすいと考えます。三つ目は「打つ点を見て終わる」。一流の打者が、当たる直前に視線を当たる位置へ向けていたという研究からです。四つ目は「迷ったら情報を減らす」です。人が一度に処理できる情報には限りがあります。配球の読みを一つか二つにしぼると、判断が速くなることがあります。ただし、この四つ目は研究の直接の結果ではなく、指導の現場での工夫として挙げています。どの言葉も、合う選手と合わない選手がいます。言葉を変えたら、その打席がどう変わったかを一緒に確かめてください。');
  const c = cols(2, 0.3);
  card(s, c[0].x, 1.85, c[0].w, 1.75, { tag: 'WORD 1', head: '「肘を見て、腕は周りで感じる」', text: '視覚的ピボットと周辺視の研究から。', hs: 18 });
  card(s, c[1].x, 1.85, c[1].w, 1.75, { tag: 'WORD 2', head: '「顔ごとボールに向ける」', text: '頭部での追従の研究から。', hs: 18 });
  card(s, c[0].x, 3.85, c[0].w, 1.75, { tag: 'WORD 3', head: '「打つ点を見て終わる」', text: '当たる直前の視線移動の研究から。', hs: 18 });
  card(s, c[1].x, 3.85, c[1].w, 1.75, { tag: 'WORD 4', head: '「迷ったら読みをしぼる」', text: '研究の直接の結果ではなく、現場での工夫。', hs: 18, warm: true });
  src(s, 5.9, '※研究結果をもとに考えた声かけの例です。効果を直接確かめたものではありません。');
}

sec('視機能と打撃成績');
// 17 divider
divider(4, '視機能と打撃成績', '目のよさは、打撃成績とどこまで関係するのか。プロ選手の大規模データから確かめる。', 'パート4では、視力やコントラスト感度などの視機能と、打撃成績との関係を見ていきます。プロ選手を対象にした、数百人規模のデータがいくつかあります。');
// 18 Laby 1996 & 2019
{
  const s = slide('CONTENT', 'PART 4 ｜ PROFESSIONAL PLAYERS', 'プロの打者は、一般の人より目がよい', 'まず、1996年にラビー氏らが発表した研究です。387名のプロ野球選手の視機能を測定したところ、視力、遠くを見るときの立体視の鋭さ、そしてコントラスト感度の平均が、一般の人よりも明らかに優れていました。同じ研究グループの解説記事では、プロ選手の平均視力はおよそ20/13、日本の小数視力に直すと1.5程度とされています。ただし、これは論文の要旨ではなく、研究グループの解説記事に書かれた値です。次に、同じラビー氏らが2019年に発表した研究です。585名のプロ選手にタブレットを使った視機能の検査を行い、打撃成績のデータがそろった475名を分析しました。視機能の上位20%と下位20%を比べると、上位のグループは、打席あたりの四球が11.6%多いなど、選球に関わる指標で3.5%から11.6%の差がありました。ただし、この研究は過去のデータを振り返る研究で、因果関係を示すものではありません。また、著者が視覚トレーニングの会社と関係があることも、読むときには心に留めておく必要があります。');
  const c = cols(3, 0.3);
  statCard(s, c[0].x, 1.85, c[0].w, 2.45, { big: '387名', unit: 'プロ選手の視機能', small: '視力、遠見立体視、コントラスト感度が一般より優れていた（1996年）' });
  statCard(s, c[1].x, 1.85, c[1].w, 2.45, { big: '約20/13', unit: '平均視力（小数視力 約1.5）', small: '研究グループの解説記事による値' });
  statCard(s, c[2].x, 1.85, c[2].w, 2.45, { big: '+11.6%', unit: '打席あたりの四球', small: '視機能の上位20%と下位20%の比較（2019年、475名）', bigColor: C.accent5 });
  take(s, 4.6, '目のよさは、選球眼の指標と関連していた。ただし因果関係は示していない');
  src(s, 5.5, 'Laby et al. (1996) Am J Ophthalmol 122(4) ／ Laby et al. (2019) Sci Rep 9: 16847（後ろ向き研究。著者に視覚トレーニング企業との関係あり）', 0.5);
}
// 19 Burris 2018
{
  const s = slide('CONTENT_PAPER', 'PART 4 ｜ SENSORIMOTOR', '感覚運動の能力は「選球」と関係していた', 'もうひとつ、2018年にデューク大学のバリス氏らが発表した研究です。252名のプロ野球選手が、ナイキのセンサリーステーションという機器で、視覚と運動に関わる複数のコンピュータ課題を受けました。その成績と、実際の試合の成績を、年齢やポジション、リーグの違いを考慮して比べました。その結果、感覚運動の能力の得点は、出塁率、四球の割合、三振の割合という、いわゆる選球眼に関わる指標と関係していました。一方で、長打率との関係は見られませんでした。ここから読み取れるのは、目や感覚運動の能力は、ボールを遠くへ飛ばす力よりも、打つか見送るかの判断の質と結びついている可能性がある、ということです。ただし、筆頭著者自身が、課題の得点と試合の成績のあいだに因果関係があるとは言えない、関連が見られたということだと強調しています。研究を紹介するときは、この言い方まで一緒に伝えることが大切です。');
  const c = cols(2, 0.3);
  panel(s, c[0].x, 1.85, c[0].w, 2.95, '関係が見られた指標', ['出塁率', '四球の割合', '三振の割合（少なさ）'], true);
  panel(s, c[1].x, 1.85, c[1].w, 2.95, '関係が見られなかった指標', ['長打率', '（投手）守備から独立した防御率'], false);
  take(s, 5.1, '視覚と感覚運動の力は、「振るか見送るか」の判断と結びついている可能性');
  src(s, 6.0, 'Burris et al. (2018) Sci Rep 8: 116　252名のプロ選手。年齢、ポジション、リーグを考慮。著者は「因果関係ではなく関連」と強調。');
}
// 20 blur & dominance
{
  const s = slide('CONTENT', 'PART 4 ｜ BLUR & EYE DOMINANCE', 'ぼやけへの強さと、利き目をめぐる研究', 'ここで、少し意外な研究を2つご紹介します。左は、2007年にマン氏らが発表した、クリケットの研究です。打者にコンタクトレンズをつけてもらい、わざと近視のようなぼやけをつくって、マシンの投球を打ってもらいました。ぼやけは、度数でプラス1.00、プラス2.00、プラス3.00ディオプターの3段階です。結果は、プラス1.00とプラス2.00では打撃の成績に有意な変化がなく、プラス3.00になって初めて成績が落ちました。これは、打撃が細かい像だけでなく、予測や動きの情報など、多くの情報に支えられていることを示していると考えられます。ただし、この結果を「眼鏡はいらない」と受け取るのは間違いです。プロ選手の視機能が一般より優れていたことも、選球の指標と関連していたことも、先ほど見たとおりです。右は利き目です。利き手と利き目が反対の交差型が有利だという古い報告がある一方で、プロ選手を調べたラビー氏らの研究では、交差型かどうかは打撃成績と関係していなかったとされています。研究結果は分かれており、利き目でフォームを決めつけるのは避けた方がよいと考えます。');
  const c = cols(2, 0.3);
  card(s, c[0].x, 1.85, c[0].w, 2.85, { tag: 'MANN et al. ｜ 2007', head: '+3.00Dまで成績は落ちなかった', text: 'コンタクトレンズで近視のようなぼやけをつくった打撃実験。+1.00Dと+2.00Dでは有意な変化なし。+3.00Dで初めて低下。' });
  card(s, c[1].x, 1.85, c[1].w, 2.85, { tag: 'EYE DOMINANCE', head: '利き目の影響は、研究で分かれる', text: '交差型が有利という古い報告がある一方、プロ選手の研究では打撃成績と関係しなかったとされる。', warm: true });
  take(s, 5.0, 'ぼやけに強いからといって矯正は不要ではない。利き目でフォームを決めつけない');
  src(s, 5.9, 'Mann et al. (2007) Hum Mov Sci 26(3) ／ Portal & Romano (1988) ／ Laby et al. (1998) Ophthalmology（二次文献による）', 0.5);
}

sec('トレーニングの根拠と、指導への生かし方');
// 21 divider
divider(5, 'トレーニングの根拠と、指導への生かし方', '視覚トレーニングは本当に打撃を変えるのか。研究の読み方と、育成年代での実践。', 'いよいよ最後のパートです。視覚トレーニングは本当に打撃を変えるのか。研究をどう読めばよいのか。そして、それを育成年代の指導にどう生かすのか。ここをお話しします。');
// 22 evidence table
{
  const s = slide('CONTENT', 'PART 5 ｜ TRAINING EVIDENCE', '視覚・知覚トレーニングの研究を並べて読む', '代表的なトレーニング研究を4つ並べました。1つ目は、ファッデ氏の2006年の研究です。大学のチームを2つのグループに分け、プレシーズンに、投手目線の映像を途中で止めて球種とコースを当てる、遮蔽法を応用した映像トレーニングを行いました。その後の18試合で、トレーニングしたグループは打率などで上位にありました。ただし、1チームでの小規模な研究です。2つ目は、グレイ氏の2017年の研究です。80名を4つのグループに分け、難しさを自動で調整する仮想現実の打撃練習を、週2回45分、6週間行いました。このグループは、実際のグラウンドでの打撃テストや、その後のリーグ成績でも、ほかのグループより向上がみられました。3つ目は、前回もご紹介したシンシナティ大学の研究で、比較の方法とバット規則の変更という注意点があります。4つ目は、視界を断続的に遮るストロボ眼鏡の研究で、短期記憶への情報の取り込みなど、実験室での知覚の課題に改善がみられましたが、すべての力が伸びたわけではなく、打撃成績は調べていません。このように、研究によって、確かさの度合いも、何が伸びたのかも、大きく違います。');
  table(s, 1.8, ['研究', '方法', '分かったこと', '注意点'], [
    ['Fadde (2006)', '映像を止めて球種とコースを当てる', '試合での打率などで上位', '1チームの小規模研究'],
    ['Gray (2017)', '難易度調整型の仮想現実打撃、6週間', '実際の打撃テストとリーグ成績でも向上', '80名、4群の比較'],
    ['Clark et al. (2012)', '視覚トレーニングをシーズン前から', 'チーム打率が上昇', '無作為化でない、バット規則の変更'],
    ['Appelbaum et al. (2011, 2012)', 'ストロボ眼鏡での運動', '一部の知覚、短期記憶の課題が改善', '打撃成績は未検証'],
  ], [2.7, 3.2, 3.13, 2.8], 14, { rowH: [0.5, 0.85, 0.85, 0.85, 0.85] });
  src(s, 6.2, 'Fadde (2006) TICL ／ Gray (2017) Front Psychol 8: 2183 ／ Clark et al. (2012) PLoS ONE 7(1) ／ Appelbaum et al. (2011) Front Psychol, (2012) Atten Percept Psychophys');
}
// 23 transfer
{
  const s = slide('CONTENT_PAPER', 'PART 5 ｜ TRANSFER', '大切なのは「試合に転移したか」', 'トレーニングの研究を読むときに、いちばん大切な考え方が転移です。近い転移とは、練習した課題そのもの、あるいはよく似た課題の成績が上がることです。たとえば、画面のライトをタッチする課題を練習すれば、その課題の点数は上がります。遠い転移とは、練習した課題とは違う、実際の試合の成績が上がることです。グレイ氏は2017年の論文で、近い転移だけでは効果の証拠として不十分で、本当に大切なのは実際の課題への遠い転移だと述べています。そこで、トレーニングの機器やアプリ、研究の結果を見るときのチェックポイントを3つ挙げます。ひとつ目、比べる相手のグループがいるか。ふたつ目、試合の成績のように、実際の打撃で確かめているか。三つ目、研究者や紹介者と、商品を売る会社との関係が書かれているか。この3つを確かめるだけで、宣伝と研究を見分けやすくなります。');
  const c = cols(2, 0.3);
  card(s, c[0].x, 1.85, c[0].w, 1.85, { tag: 'NEAR TRANSFER', head: '近い転移', text: '練習した課題や、よく似た課題の成績が上がる。' });
  card(s, c[1].x, 1.85, c[1].w, 1.85, { tag: 'FAR TRANSFER', head: '遠い転移', text: '実際の打席、試合の成績が上がる。本当に知りたいのはこちら。', warm: true });
  s.addText('研究や商品を見るときの3つのチェック', { x: X0, y: 3.95, w: W0, h: 0.4, fontSize: 18, bold: true, color: C.text1, margin: 0, isTextBox: true });
  const c3 = cols(3, 0.3);
  [['01', '比べる相手のグループがいるか'], ['02', '実際の打撃や試合で確かめたか'], ['03', '販売企業との関係が開示されているか']].forEach((r, i) => {
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: c3[i].x, y: 4.45, w: c3[i].w, h: 1.15, rectRadius: 0.16, fill: { color: 'FFFEFB' }, line: { color: 'D6E6F3', width: 1 }, shadow: shadow(), objectName: 'check' });
    s.addText([{ text: r[0] + '  ', options: { fontFace: EN, fontSize: 22, bold: true, color: C.accent3 } }, { text: r[1], options: { fontSize: 16, bold: true, color: C.text1 } }], { x: c3[i].x + 0.25, y: 4.45, w: c3[i].w - 0.5, h: 1.15, valign: 'middle', margin: 0, isTextBox: true });
  });
  src(s, 5.9, 'Gray (2017) Front Psychol 8: 2183（近い転移だけでは不十分で、実際の課題への転移が重要と指摘）');
}
// 24 youth roadmap
{
  const s = slide('CONTENT', 'PART 5 ｜ FOR YOUNG HITTERS', '育成年代では、何から育てるか', 'ここからは、育成年代への生かし方です。前回の内容も合わせて、年代ごとに整理しました。データとして分かっているのは、動くものを見る力が5歳から10歳で大きく伸び、15歳から20歳ごろにピークを迎えること、そして裸眼で1.0が見えない子が、小学校で3割を超え、中学校で6割程度、高校で7割程度にのぼることです。右の列は、今日の研究をもとに私たちが考えた重点の例です。小学生では、動くボールを顔ごと追う経験を、遊びの中でたくさん積ませます。中学生では、肘を見る、配球を考えるなど、何を見るかを言葉で教え始めます。高校生では、予測と配球、選球の判断を、映像や振り返りで深めていきます。そして、すべての年代を通して、見え方のチェックと矯正を後回しにしないこと。どれだけ予測の練習をしても、入力の質が低いままでは、その力を十分に発揮できないと考えます。');
  table(s, 1.8, ['年代', '目の特徴（データから）', '打撃での重点（研究をもとにした例）'], [
    ['小学生', '動くものを見る力が大きく伸びる。裸眼1.0未満は3割を超える', '動くボールを顔ごと追う遊びを多く。見えにくさを早く見つける'],
    ['中学生', '伸びはゆるやかに。裸眼1.0未満が6割程度', '肘を見る、配球を考えるなど「何を見るか」を言葉で'],
    ['高校生', '動くものを見る力がピーク。裸眼1.0未満は7割程度', '予測、配球、選球の判断を映像と振り返りで深める'],
    ['全年代', '見る力は伸びる途中、近視は増えていく', '見え方のチェックと矯正を後回しにしない'],
  ], [1.8, 4.9, 5.13], 15, { rowH: [0.5, 0.9, 0.9, 0.9, 0.9] });
  src(s, 6.25, 'データ：石垣尚男 氏らの研究（DVA動体視力の発達）、文部科学省「令和6年度学校保健統計調査」。右の列は研究をもとにした整理です。');
}
// 25 drills
{
  const s = slide('CONTENT_PAPER', 'PART 5 ｜ PRACTICE DESIGN', '研究の考え方を、チームの練習に落とし込む', '研究の考え方を、特別な機械を使わずにチームの練習に落とし込んだ例を4つご紹介します。ひとつ目は映像遮蔽クイズです。スマートフォンで撮った投手の映像を、リリースの瞬間で止めて、球種やコースを当てます。ファッデ氏の研究の考え方を、手軽にしたものです。ふたつ目はリリースコール。投手の手からボールが離れた瞬間に、速い、遅いを声に出してから、打つか見送るかを決めます。三つ目は見送りコール。打たずに見送って、ストライクかボールか、球種は何かを答え、捕手が答え合わせをします。選球の判断を育てる練習です。四つ目は配球ミーティングです。打席の前に、この投手はどんな順番で投げてくるかを話し合い、打席の後に、予測が当たったか、外れたときにどう見えたかを振り返ります。どれも研究で効果が確かめられた練習そのものではなく、研究の考え方をもとにした例です。年代やレベルに合わせて工夫してください。');
  const c = cols(2, 0.3);
  card(s, c[0].x, 1.85, c[0].w, 1.6, { tag: 'DRILL 1', head: '映像遮蔽クイズ', text: '投手の映像をリリースで止め、球種とコースを当てる。' });
  card(s, c[1].x, 1.85, c[1].w, 1.6, { tag: 'DRILL 2', head: 'リリースコール', text: '離れた瞬間に「速い／遅い」をコールしてから判断する。' });
  card(s, c[0].x, 3.7, c[0].w, 1.6, { tag: 'DRILL 3', head: '見送りコール', text: '打たずに見送り、ストライクかボールか、球種を答える。' });
  card(s, c[1].x, 3.7, c[1].w, 1.6, { tag: 'DRILL 4', head: '配球ミーティング', text: '打席の前に配球を予測し、打席の後に答え合わせをする。', warm: true });
  take(s, 5.6, '機械がなくてもできる。遮蔽、コール、予測と答え合わせ');
  src(s, 6.45, '※研究の考え方をもとにした練習例です。効果を直接確かめたものではありません。');
}
// 26 eye care
{
  const s = slide('CONTENT', 'PART 5 ｜ EYE CARE', '打撃の入力を守る、目のケア', '最後に、打撃の入力を守るための目のケアです。ひとつ目は矯正です。プロ選手の研究で、視機能のよさは選球に関わる指標と関連していました。見えにくさを感じている選手、特に練習中だけ眼鏡を外している選手には、競技用の矯正方法を眼科医と相談するよう伝えてください。コンタクトレンズを使うかどうかも、必ず眼科医の判断のもとで決めます。ふたつ目は保護です。アメリカ眼科学会は、米国国立眼研究所の情報として、野球は14歳以下の子どものスポーツによる目のけがの主な原因のひとつだと伝えています。ボールが目や顔に当たったら、本人が平気と言っても眼科を受診させること。ふだんの眼鏡のままのプレーは避けることを徹底してください。三つ目は環境です。コントラスト感度という視点で見ると、夕方やナイター、曇りの日は、ボールと背景の明るさの差が小さくなり、見えにくくなります。暗い時間の打撃練習で増えた空振りを、すぐに技術の問題と決めつけないことも、目を守る指導の一つだと考えます。');
  const c = cols(3, 0.3);
  card(s, c[0].x, 1.85, c[0].w, 2.75, { tag: 'CORRECTION', head: '矯正', text: '見えにくさを放置しない。競技用の矯正やコンタクトレンズは眼科医と相談。' });
  card(s, c[1].x, 1.85, c[1].w, 2.75, { tag: 'PROTECTION', head: '保護', text: '野球は子どもの目のけがの主な原因のひとつ（米国）。当たったら眼科へ。ふだんの眼鏡でプレーしない。' });
  card(s, c[2].x, 1.85, c[2].w, 2.75, { tag: 'CONTRAST', head: '環境', text: '夕方、ナイター、曇天はコントラストが下がる。暗い時間の空振りを技術の問題と決めつけない。', warm: true });
  take(s, 4.9, '予測も判断も、入力の質があってこそ。見え方を守ることが打撃指導の土台');
  src(s, 5.8, 'American Academy of Ophthalmology（米国国立眼研究所の情報として）／ Laby et al. (2019) Sci Rep');
}

sec('まとめと参考文献');
// 27 summary
{
  const s = slide('STATEMENT_AMBER', null, null, '最後に、今日の内容をまとめます。「ボールをよく見ろ」の中身は、3つに分けることができます。ひとつ目は、早く読むこと。熟練した打者は、リリースの前から投手の肘や腕の動きを読み、予測を立てています。打者に与えられた時間は0.5秒に満たず、投球の後半の情報はスイングの修正に使われにくいからです。ふたつ目は、頭で追うこと。打者は目だけでなく、主に頭の向きでボールを追い、そのために前庭動眼反射を打ち消しています。一流の打者は、当たる直前に視線を当たる位置へ先回りさせていました。三つ目は、入力を守ること。視機能のよさは選球眼の指標と関連していました。見え方のチェックと矯正、そして目のけがへの備えが、すべての土台になります。そして、研究には分かっていることと、まだ分かっていないことがあります。その境目を正直に伝えることも、指導者の大切な役割です。冒頭の問いに戻ります。「ボールをよく見ろ」。今日からは、その一言を、選手に合った具体的な言葉に置きかえてあげてください。ご清聴ありがとうございました。');
  s.addText('SUMMARY', { x: X0, y: 0.9, w: 6, h: 0.4, fontFace: EN, fontSize: 14, bold: true, charSpacing: 3, color: C.text1, margin: 0, isTextBox: true });
  s.addText([{ text: '「よく見ろ」の中身は、', options: { breakLine: true } }, { text: '読む、追う、守る。' }], { x: X0, y: 1.4, w: W0, h: 1.9, fontSize: 40, bold: true, color: C.text1, margin: 0, valign: 'top', lineSpacingMultiple: 1.3, isTextBox: true });
  const c = cols(3, 0.3);
  card(s, c[0].x, 3.75, c[0].w, 2.5, { tag: 'READ', head: '早く読む', text: 'リリース前から肘と腕の動きを読む。後半の情報は修正に使われにくい。', tagColor: C.text1 });
  card(s, c[1].x, 3.75, c[1].w, 2.5, { tag: 'TRACK', head: '頭で追う', text: '主に頭の向きで追い、視線は当たる位置へ先回りさせる。', tagColor: C.text1 });
  card(s, c[2].x, 3.75, c[2].w, 2.5, { tag: 'PROTECT', head: '入力を守る', text: '視機能は選球と関連。矯正、保護、環境への配慮が土台。', tagColor: C.text1 });
}
// 28-29 refs
function refSlide(title, refs, notes) {
  const s = slide('CONTENT', 'REFERENCES', title, notes);
  s.addText(refs.map((t, i) => ({ text: t, options: { bullet: { indent: 12 }, breakLine: i < refs.length - 1, paraSpaceAfter: 6 } })), { x: X0, y: 1.8, w: W0, h: 4.9, fontSize: 12, color: C.text2, lineSpacingMultiple: 1.05, margin: 0, valign: 'top', isTextBox: true });
}
refSlide('参考文献・出典（1）', [
  'Bahill, A. T. & LaRitz, T. (1984) Why can\'t batters keep their eyes on the ball? American Scientist, 72, 249–253.',
  'Bahill, A. T. & Karnavas, W. J. (1993) The perceptual illusion of baseball\'s rising fastball and breaking curveball. J Exp Psychol Hum Percept Perform, 19(1), 3–14.',
  'Fogt, N. F. & Zimmerman, A. B. (2014) A method to monitor eye and head tracking movements in college baseball players. Optometry and Vision Science.',
  'Toole, A. J. & Fogt, N. (2021) Review: Head and eye movements and gaze tracking in baseball batting. Optometry and Vision Science, 98(7), 750–758.',
  'Kishita, Y., Ueda, H. & Kashino, M. (2020) Eye and head movements of elite baseball players in real batting. Frontiers in Sports and Active Living, 2, 3.',
  'Mann, D. L., Spratford, W. & Abernethy, B. (2013) The head tracks and gaze predicts. PLoS ONE, 8(3), e58289.',
  'Higuchi, T. et al. (2016) Contribution of visual information about ball trajectory to baseball hitting accuracy. PLoS ONE, 11(2), e0148498.',
  '竹内高行・猪俣公宏 (2012) 野球の打撃時における視覚探索方略. スポーツ心理学研究, 39(1), 47–59.',
  'Müller, S., Abernethy, B. & Farrow, D. (2006) How do world-class cricket batsmen anticipate a bowler\'s intention? Q J Exp Psychol, 59(12), 2162–2186.',
  'Gray, R. (2002) Behavior of college baseball players in a virtual batting task. J Exp Psychol Hum Percept Perform, 28(5).',
], '今日ご紹介した研究の出典です。前半は、目の動きと予測に関する研究です。英語の論文の多くは無料で全文を読むことができます。');
refSlide('参考文献・出典（2）', [
  'Laby, D. M. et al. (1996) The visual function of professional baseball players. Am J Ophthalmol, 122(4), 476–485.',
  'Laby, D. M., Kirschen, D. G. et al. (2019) The effect of visual function on the batting performance of professional baseball players. Scientific Reports, 9, 16847.',
  'Burris, K. et al. (2018) Sensorimotor abilities predict on-field performance in professional baseball. Scientific Reports, 8, 116.',
  'Mann, D. L. et al. (2007) Is optimal vision required for the successful execution of an interceptive task? Human Movement Science, 26(3), 343–356.',
  'Fadde, P. J. (2006) Interactive video training of perceptual decision-making in the sport of baseball. Technology, Instruction, Cognition and Learning.',
  'Gray, R. (2017) Transfer of training from virtual to real baseball batting. Frontiers in Psychology, 8, 2183.',
  'Clark, J. F. et al. (2012) High-performance vision training improves batting statistics for University of Cincinnati baseball players. PLoS ONE, 7(1), e29109.',
  'Appelbaum, L. G. et al. (2011) Front Psychol ／ (2012) Attention, Perception, & Psychophysics（ストロボ視覚トレーニング）',
  'Human Kinetics: Applying the Principles: Baseball Batting ／ American Academy of Ophthalmology: In Baseball, Eye Safety Often Takes a Hit',
  '文部科学省 令和6年度学校保健統計調査 ／ 石垣尚男 氏らの研究（愛知工業大学）／ 測定項目の区分：日本スポーツビジョン協会',
], '後半は、視機能と打撃成績、そしてトレーニングに関する研究、統計の出典です。利き目に関する Portal & Romano (1988) と Laby ら (1998) は、二次文献での引用をもとに紹介しています。');

(async () => {
  await pres.writeFile({ fileName: OUT });
  await applyTheme(OUT, THEME);
  console.log('wrote', OUT);
})();
