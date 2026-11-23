const pptxgen = require('pptxgenjs');
const { applyTheme } = require('/root/.claude/skills/synced/0b9079fc-a575-434d-b906-a0b143dde210_182063f9-b34f-4348-835a-62d9ee9c42ad/pptx/scripts/apply_theme.js');

const OUT = process.argv[2] || 'baseball_vision.pptx';
const THEME = {
  name: 'Baseball Vision',
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
pres.title = '野球と視る力 小学生から高校まで';
pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
const C = pres.SchemeColor;
const EN = 'Arial';
const FOOT = '野球と視る力 ｜ 小学生から高校まで';
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

// =====================================================================
sec('導入');
// 1 cover
{
  const s = pres.addSlide({ masterName: 'COVER', sectionTitle: section });
  s.addImage({ path: 'cover_art.png', x: 7.25, y: 1.0, w: 5.45, h: 5.0, altText: 'リリースからストライクゾーンへ向かう投球と、それを先回りして追う視線の軌跡' });
  s.addText('FOR FUTURE ATHLETES ｜ AGE 6–18', { x: X0, y: 1.6, w: 7, h: 0.4, fontFace: EN, fontSize: 14, bold: true, charSpacing: 3, color: C.accent1, margin: 0, isTextBox: true });
  s.addText([{ text: '野球と', options: { breakLine: true } }, { text: '「視る力」' }], { x: X0, y: 2.1, w: 7.2, h: 2.1, fontSize: 54, bold: true, color: C.text1, margin: 0, valign: 'top', lineSpacingMultiple: 1.05, isTextBox: true });
  s.addText([{ text: '小学生から高校まで。', options: { breakLine: true } }, { text: 'バッティングと視る力' }], { x: X0, y: 4.35, w: 7, h: 1.1, fontSize: 20, color: '2E3D55', margin: 0, valign: 'top', lineSpacingMultiple: 1.4, isTextBox: true });
  s.addText('研修資料 ｜ [講師名]', { x: X0, y: 6.55, w: 6, h: 0.35, fontSize: 12, color: C.text2, margin: 0, isTextBox: true });
  s.addNotes('皆さん、こんにちは。これまでサッカー、ゴールキーパーと、競技ごとに視る力のお話をしてきました。今回は野球です。対象は、学童野球を始める小学生から、高校生までの年代です。そして野球の中でも、今日はバッティングに焦点をしぼります。投手の手を離れたボールを、一瞬で見きわめて、バットを出すか、見送るかを決める。バッティングは、スポーツの中でも目への要求がとても高い動きのひとつです。一方で、子どもの目は、まだ育っている途中です。6歳の子と17歳の選手とでは、目の育ち方も、指導で大切にすることも大きく違います。今日は、子どもの目がどのように育つのかという発達の道すじから始めて、打者の目の使い方について研究で分かってきたこと、そして年代ごとの指導の重点と練習例、最後に目を守るための知識をお伝えします。研究や公的なデータをもとにお話ししますが、言葉はできるだけかみくだきますので、気楽に聞いてください。');
}
// 2 agenda
{
  const s = slide('CONTENT', 'AGENDA', '今日の流れ', '今日は4つのパートで進めます。パート1では、見る力の基本をおさらいし、打席で使う見る力を整理します。そのうえで、投げたボールが打者に届くまでに、どれくらいの時間しかないのかを計算でお見せし、子どもの目が育っていく道すじと、近視の現状をデータで確認します。パート2では、「最後までボールを見ろ」という、野球でいちばんよく聞く言葉を手がかりに、打者が実際にどのように目と頭を使っているのかを、研究からひもときます。パート3が今日の中心です。小学校低学年、高学年、中学生、高校生の4つの年代に分けて、目の特徴と指導の重点、そして年代に合わせた練習例をご紹介します。最後のパート4では、目を守るための知識です。近視の予防、野球で起きる目のけが、そして指導者が子どもの見えにくさに気づくためのチェックポイントをお伝えします。');
  const rows = [
    ['01', '見る力の基本と、目が育つ道すじ', '視力とスポーツビジョン、打席で使う8つの見る力、ボールが届くまでの時間、目の発達と近視の現状'],
    ['02', 'バッティングの目を、研究から読み解く', '「最後までボールを見ろ」は本当にできるのか。打者の目と頭の使い方について分かってきたこと'],
    ['03', '年代別：特徴と指導の重点、練習例', '小学校低学年、高学年、中学生、高校生の4つの年代に分けて整理し、練習例を紹介'],
    ['04', '目を守る', '近視の予防、野球での目のけが、指導者が気づくための見え方チェック'],
  ];
  rows.forEach((r, i) => {
    const y = 1.95 + i * 1.18;
    s.addText(r[0], { x: X0, y, w: 0.9, h: 0.6, fontFace: EN, fontSize: 30, bold: true, color: C.accent3, margin: 0, valign: 'top', isTextBox: true });
    s.addText([{ text: r[1], options: { fontSize: 19, bold: true, color: C.text1, breakLine: true, paraSpaceAfter: 4 } }, { text: r[2], options: { fontSize: 14, color: C.text2 } }], { x: X0 + 1.0, y, w: W0 - 1.0, h: 0.95, margin: 0, valign: 'top', isTextBox: true });
    s.addShape(pres.shapes.LINE, { x: X0, y: y + 1.02, w: W0, h: 0, line: { color: 'CFE3F2', width: 1.25 }, objectName: 'row-divider' });
  });
}
// 3 question
{
  const s = slide('STATEMENT_DARK', null, null, '本題に入る前に、ひとつ問いかけをさせてください。皆さんのチームにも、空振りや振り遅れが続く子がいるかもしれません。そのとき私たちはつい、スイングの形を直そう、もっと振る量を増やそうと考えがちです。でも、足りないのは本当にスイングでしょうか。（3秒ほど間を取る）。もちろん、技術の問題のこともあります。ただ、ほかにもいくつかの可能性が考えられます。ひとつは年齢です。動くものを見る力は、子どもの時期にはまだ育っている途中です。ひとつは、目の育ち方の個人差です。同じ学年でも、見る力には差があることが分かっています。そしてもうひとつは、見え方そのもの。近視などで、そもそもボールがくっきり見えていない場合です。今日は、この3つを順番にひもといていきます。振り遅れという同じ姿の裏にある理由を見分けられるようになること。それが今日の目標です。');
  s.addText('QUESTION', { x: X0, y: 1.3, w: 6, h: 0.4, fontFace: EN, fontSize: 14, bold: true, charSpacing: 3, color: C.accent1, margin: 0, isTextBox: true });
  s.addText([{ text: '空振りが続くあの子。', options: { breakLine: true } }, { text: '足りないのは、', options: { breakLine: true } }, { text: '本当にスイングでしょうか。' }], { x: X0, y: 1.85, w: W0, h: 2.7, fontSize: 40, bold: true, color: C.text1, margin: 0, valign: 'top', lineSpacingMultiple: 1.3, isTextBox: true });
  s.addText([{ text: '年齢、目の育ち、見え方。', options: { breakLine: true } }, { text: '同じ「振り遅れ」にも、いくつもの理由が隠れています。' }], { x: X0, y: 4.85, w: W0, h: 1.0, fontSize: 19, color: '2E3D55', margin: 0, valign: 'top', lineSpacingMultiple: 1.5, isTextBox: true });
}

// =====================================================================
sec('見る力の基本と、目が育つ道すじ');
// 4 basics
{
  const s = slide('CONTENT', 'PART 1 ｜ BASICS', '「視力」と「スポーツビジョン」は別のもの', 'パート1です。まず言葉の整理をおさらいします。ふだん「視力」と呼んでいるのは、正確には静止視力です。止まっている指標をどれだけ細かく見分けられるかを測っていて、学校の健康診断で測っているのがこれです。一方、スポーツビジョンは、動いているボールや人を目で追い、その情報をもとに判断して、体を動かす。この一連の流れを支える見る力をまとめた呼び名です。バッティングに当てはめると、下の図のようになります。投手の手元からボールの情報を入れる。球種やコース、スピードを読んで、打つか見送るかを決める。そしてバットを出す。この3つが、1秒にも満たない時間の中で起きています。最初の「見る」で入る情報が少なかったり遅かったりすると、判断もスイングも遅れます。そして大切なのは、子どもの場合、この「見る」の力そのものが、まだ育っている途中だということです。大人の打者と同じ物差しで「見えているはず」と考えないこと。これが、育成年代の指導の出発点になります。');
  const c = cols(2, 0.3);
  card(s, c[0].x, 1.85, c[0].w, 1.85, { tag: 'VISUAL ACUITY', head: '視力（静止視力）', text: '止まっているものを、どれだけ細かく見分けられるか。学校の健康診断で測っている値。' });
  card(s, c[1].x, 1.85, c[1].w, 1.85, { tag: 'SPORTS VISION', head: 'スポーツビジョン', text: '動いている状況の中で、見て、判断し、体を動かすまでをつなげる力の総称。', warm: true });
  const steps = [['見る', '投手の手元からボールの情報を入れる'], ['判断する', '球種やコースを読み、打つか見送るか決める'], ['打つ', 'タイミングを合わせてバットを出す']];
  const sw = 3.3, aw = 0.6, gap = (W0 - sw * 3 - aw * 2) / 4;
  steps.forEach((st, i) => {
    const x = X0 + i * (sw + aw + gap * 2);
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 4.2, w: sw, h: 1.65, rectRadius: 0.16, fill: { color: C.accent1 }, line: { type: 'none' }, objectName: 'flow-step' });
    s.addText([{ text: st[0], options: { fontSize: 24, bold: true, breakLine: true, paraSpaceAfter: 6 } }, { text: st[1], options: { fontSize: 14 } }], { x: x + 0.25, y: 4.35, w: sw - 0.5, h: 1.4, color: 'FFFEFB', margin: 0, valign: 'top', isTextBox: true });
    if (i < 2) s.addShape(pres.shapes.RIGHT_ARROW, { x: x + sw + gap, y: 4.8, w: aw, h: 0.42, fill: { color: C.accent2 }, line: { type: 'none' }, objectName: 'flow-arrow' });
  });
}
// 5 eight
{
  const s = slide('CONTENT', 'PART 1 ｜ 8 VISUAL SKILLS', '打席で使う、8つの見る力', 'スポーツビジョンは、日本スポーツビジョン協会の測定では8つの項目に分けて評価されます。右の列には、打席でどんな場面に関わるかの例を書きました。静止視力はすべての土台で、投手の手元や握りを見ることにも関わります。KVA動体視力は自分に向かってくるものを見続ける力で、まさに投球を追う力です。DVA動体視力は横に動くものを見続ける力で、横に曲がる変化球を追う場面が思い浮かびます。コントラスト感度は、明るさの差が小さいものを見分ける力で、ナイターや曇りの日、白いボールが背景にまぎれる場面に関わります。眼球運動は視線をすばやく正確に移す力、深視力は距離や奥行きをつかむ力、瞬間視は一瞬で多くの情報をつかむ力です。眼と手の協応動作は、見た情報にバットの軌道を合わせる力と言えます。なお、右の列は測定項目の定義に私たちが打席の場面を当てはめた例で、それぞれを研究で確かめたものではありません。この8つはそれぞれ別の力で、育つ時期や伸び方も同じではありません。');
  table(s, 1.8, ['測定項目', 'どんな力か', '打席での場面（例）'], [
    ['静止視力', '止まった物の細部を見分ける', '投手の手元、握り、サインを見る'],
    ['KVA動体視力', '前後に動く物を見続ける', '自分に向かってくる投球を追う'],
    ['DVA動体視力', '横に動く物を見続ける', '横に曲がる変化球を追う'],
    ['コントラスト感度', '明暗の差が小さい物を見分ける', 'ナイター、曇天、背景にまぎれる白球'],
    ['眼球運動', '視線をすばやく正確に移す', '投手の手元からボールへの視線の移動'],
    ['深視力', '距離や奥行きをつかむ', 'ボールとの距離、ミートポイントの前後'],
    ['瞬間視', '一瞬で多くの情報をつかむ', 'リリースの一瞬で球種やコースをつかむ'],
    ['眼と手の協応動作', '見た情報に体の動きを合わせる', '見た軌道にバットを合わせる'],
  ], [2.6, 4.3, 4.93], 14);
  src(s, 6.45, '測定項目の区分：日本スポーツビジョン協会　右の列は打席での場面を当てはめた例');
}
// 6 time
{
  const s = slide('CONTENT_PAPER', 'PART 1 ｜ TIME TO THE PLATE', '投げてから届くまで、1秒もない', 'ここで、打者にどれだけ時間がないかを、簡単な計算で確かめてみます。学童野球の大会規則では、投手板から本塁までの距離は16メートルとされています。一般の野球は公認野球規則で18.44メートルです。この距離を球速で割ると、ボールが届くまでのおおよその時間が出ます。16メートルを時速90キロで投げると約0.64秒。18.44メートルを時速120キロなら約0.55秒、時速140キロなら約0.47秒です。表示している球速は、計算のための例であって、それぞれの年代の平均ではありません。また、実際には投手は投手板より前でボールを離しますし、空気の抵抗で球速も落ちるので、これは目安です。それでも、1秒に満たない時間で、見て、判断して、バットを出さなければならないことは変わりません。しかも、バットを振り始めるのはボールが届くより前です。つまり、打つかどうかの判断は、さらに短い時間で下す必要があります。打者にとって、ボールの情報をどれだけ早く、正確に入れられるかが、どれほど大切かが分かると思います。');
  const c = cols(3, 0.3);
  statCard(s, c[0].x, 1.85, c[0].w, 2.6, { big: '約0.64秒', unit: '16m ・ 時速90km', small: '学童野球の投球距離で計算した例' });
  statCard(s, c[1].x, 1.85, c[1].w, 2.6, { big: '約0.55秒', unit: '18.44m ・ 時速120km', small: '一般の投球距離で計算した例' });
  statCard(s, c[2].x, 1.85, c[2].w, 2.6, { big: '約0.47秒', unit: '18.44m ・ 時速140km', small: '球速が上がるほど、時間は短くなる', bigColor: C.accent5 });
  take(s, 4.8, 'バットを振り始めるのは届く前。判断に使える時間は、さらに短い');
  src(s, 5.7, '※投手板から本塁までの距離を球速で割った単純計算。実際はリリース位置や空気抵抗で変わる。球速は計算のための例で、年代の平均ではない。距離：公認野球規則（18.44m）、学童部の大会規則（16m）', 0.6);
}
// 7 eyesgrow
{
  const s = slide('CONTENT', 'PART 1 ｜ HOW EYESIGHT GROWS', '視力は、小学校に入る頃に大人並みになる', 'ここからは、子どもの目がどのように育っていくかを見ていきます。まずは静止視力です。視力は生まれてから3歳ごろまでに急速に発達し、日本眼科医会は「6歳で視力1.0」をひとつの目安にしています。つまり、学童野球を始める小学1年生の頃には、静止視力はおおむね大人と同じ水準に届いているのが一般的です。ただし、ここに大切な注意点があります。強い遠視や乱視、斜視などがあると、ピントの合った像が脳に届かないため、視力の発達が途中で止まってしまうことがあります。これを弱視といいます。弱視の治療は8歳くらいまで可能とされていて、年齢が低いほど治療の効果が高いと説明されています。小学校低学年の子を預かる指導者は、この時期にあたる子どもたちと、毎週のように顔を合わせています。ボールを見るときの様子に気になることがあれば、早めに保護者に伝えることが、その子の目の将来を守ることにつながります。');
  const c = cols(3, 0.3);
  card(s, c[0].x, 1.85, c[0].w, 2.6, { tag: '0 – 3 YEARS', head: '急速に育つ', text: '生まれてから3歳ごろまでに、視力は急速に発達する。' });
  card(s, c[1].x, 1.85, c[1].w, 2.6, { tag: 'AROUND 6', head: '6歳ごろに1.0', text: '日本眼科医会は「6歳で視力1.0」を発達の目安としている。' });
  card(s, c[2].x, 1.85, c[2].w, 2.6, { tag: 'UNTIL ABOUT 8', head: '治療に間に合う時期', text: '強い遠視や乱視で発達が止まる弱視は、8歳くらいまで治療できるとされ、年齢が低いほど効果が高い。', warm: true });
  take(s, 4.8, '野球を始める頃が、見えにくさを見つける最後のチャンスになることもある');
  src(s, 5.7, '出典：日本眼科医会の目安（東洋経済オンライン掲載記事より）、各自治体の弱視に関する案内');
}
// 8 dva
{
  const s = slide('CONTENT', 'PART 1 ｜ DYNAMIC VISUAL ACUITY', '動くものを見る力は、高校生の頃まで育つ', '静止視力が6歳ごろに大人並みになるのに対して、動くものを見る力は、もっと長い時間をかけて育ちます。愛知工業大学の石垣尚男氏らは、5歳から92歳までの826名を対象に、横に動くものを見る力、DVA動体視力を測定しました。その結果、DVA動体視力は、体が育つ5歳から15歳ごろまでに急速に発達し、特に5歳から10歳の伸びが大きいことが分かりました。ピークは15歳から20歳ごろで、そのあとは年齢とともにゆるやかに下がっていきます。左の図は、この結果を言葉どおりに描いた概念図で、縦軸は実際の数値ではありません。もうひとつ、大切な報告があります。DVA動体視力や瞬間視の個人差は、小学校低学年ですでに見られ、その一因として運動の多い少ないが推測されています。つまり、小学生の年代は、動くものを見る力がいちばん大きく伸びる時期であり、同時に、どれだけ体を動かし、動くものを見てきたかで差がつき始める時期でもあるということです。なお、打者にとって特に大切な、自分に向かってくるものを見るKVA動体視力については、子どもから高校生までの発達をはっきり示した資料を、今回は見つけることができませんでした。');
  s.addImage({ path: 'dva.png', x: X0, y: 1.9, w: 7.4, h: 2.93, altText: 'DVA動体視力の発達の概念図。5歳から10歳で急に伸び、15歳まで伸び続け、15歳から20歳ごろが最も高い' });
  ['5歳', '10歳', '15歳', '20歳', '25歳〜'].forEach((t, i) => s.addText(t, { x: X0 + i * 1.48, y: 4.9, w: 1.4, h: 0.3, fontSize: 12, color: C.text2, margin: 0, isTextBox: true }));
  src(s, 5.3, '※研究結果を言葉どおりに描いた概念図です。縦軸は数値ではありません。');
  const x = X0 + 7.75, w = W0 - 7.75;
  card(s, x, 1.85, w, 1.2, { head: '5〜10歳で急速に', text: '特に5〜10歳の伸びが大きい' });
  card(s, x, 3.2, w, 1.2, { head: 'ピークは15〜20歳', text: 'その後はゆるやかに下がっていく', warm: true });
  card(s, x, 4.55, w, 1.2, { head: '低学年から個人差', text: '運動経験の多少が一因と推測' });
  src(s, 6.15, '出典：石垣尚男 氏らの研究（愛知工業大学）5〜92歳の826名を測定');
}
// 9 myopia
{
  const s = slide('CONTENT_DARK', 'PART 1 ｜ MYOPIA TODAY', '学年が上がるほど、裸眼で見えない子が増える', 'ここまで、目が育つ道すじを見てきました。一方で、育ったはずの視力が、学年が上がるにつれて下がっていく現実もあります。文部科学省の令和6年度学校保健統計調査によると、裸眼視力が1.0未満の子どもの割合は、小学校で3割を超え、中学校で6割程度、高校で7割程度です。学校段階が進むほど高くなっています。なお、文部科学省は、令和2年度から5年度は調査の時期が違うため、年度ごとの単純な比較はできないと注記しています。この数字を、皆さんのチームに当てはめてみてください。小学生のチームなら3人に1人、中学生なら半分以上、高校生なら7割の選手が、裸眼では1.0が見えていない計算になります。もちろん、その多くは眼鏡やコンタクトで矯正しているでしょう。ただ、練習中は外している、合っていない眼鏡を使っている、そもそも検査結果を家庭で放置している。そうした子が混じっている可能性は十分にあります。打席で振り遅れる子を見たとき、「全員がくっきり見えているとは限らない」と考えておくこと。それが、この年代の指導者に求められる視点です。');
  s.addText('裸眼視力1.0未満の子どもの割合（全国）', { x: X0, y: 1.75, w: W0, h: 0.35, fontSize: 14, color: C.text2, margin: 0, isTextBox: true });
  const c = cols(3, 0.3);
  [['小学校', '3割', 'を超える'], ['中学校', '6割', '程度'], ['高校', '7割', '程度']].forEach((r, i) => {
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: c[i].x, y: 2.2, w: c[i].w, h: 2.1, rectRadius: 0.16, fill: { color: 'FFFEFB' }, line: { color: 'D6E6F3', width: 1 }, shadow: shadow(), objectName: 'stat' });
    s.addText([{ text: r[0], options: { fontSize: 18, bold: true, color: C.text1, breakLine: true } }, { text: r[1], options: { fontSize: 54, bold: true, color: C.accent1, breakLine: true } }, { text: r[2], options: { fontSize: 14, color: C.text2 } }], { x: c[i].x + 0.3, y: 2.35, w: c[i].w - 0.6, h: 1.85, margin: 0, valign: 'top', isTextBox: true });
  });
  take(s, 4.7, 'チームの中に「見えにくいまま打席に立っている子」がいる前提で考える');
  src(s, 5.6, '出典：文部科学省「令和6年度学校保健統計調査」確定値（令和2〜5年度とは調査時期が異なり、単純比較はできない）');
}

// =====================================================================
sec('バッティングの目を、研究から読み解く');
// 10 keep eye
{
  const s = slide('CONTENT', 'PART 2 ｜ KEEP YOUR EYE ON THE BALL?', '「最後までボールを見ろ」は、本当にできるのか', 'パート2です。野球の指導で、いちばんよく聞く言葉のひとつが「最後までボールを見ろ」ではないでしょうか。この言葉について、研究は何を教えてくれるのかを見ていきます。左は、1984年にアメリカのバーヒル氏らが発表した、よく知られた研究です。実験室で、速球を模したボールを目で追うときの目の動きを測りました。その結果、打者は投球を、手元に来るまで目で追い続けることはできませんでした。論文のタイトルそのものが「なぜ打者はボールから目を離さずにいられないのか」です。そして、打者の目の使い方として、ボールの前半を追ったあとに、当たると予測した位置へ視線を先回りさせる方法があることが示されています。右は、2014年にオハイオ州立大学のフォグト氏らが行った研究です。大学の一部リーグの選手15名に、マシンの投球を打たずに目で追ってもらい、目と頭の動きを測りました。すると、ボールが空中にある時間の大半を、選手たちは目ではなく頭の向きで追っていて、目は投球の終わりの方までほとんど動いていませんでした。つまり、「目だけでボールを最後まで追う」というイメージは、実際の打者の姿とは少し違うようです。ただし、どちらも打たずに見る、あるいは実験室での研究であることは、心に留めておいてください。');
  const c = cols(2, 0.3);
  card(s, c[0].x, 1.85, c[0].w, 2.75, { tag: 'BAHILL & LaRITZ ｜ 1984', head: '目だけでは、最後まで追えない', text: '速球を模したボールを追う目の動きを実験室で測定。打者は投球を手元まで目で追い続けることはできなかった。前半を追い、当たる位置へ視線を先回りさせる方法も示された。' });
  card(s, c[1].x, 1.85, c[1].w, 2.75, { tag: 'FOGT & ZIMMERMAN ｜ 2014', head: '主に頭の向きで追っている', text: '大学野球の選手15名が、マシンの投球を打たずに目で追った。ボールが空中にある時間の大半を頭の動きで追い、目は終盤までほとんど動いていなかった。', warm: true });
  take(s, 4.95, '「目だけで追う」ではなく、「顔ごと向けて、視線は先回り」');
  src(s, 5.85, 'Bahill & LaRitz (1984) Am Sci 72 ／ Fogt & Zimmerman (2014) Optom Vis Sci　※打たずに見る、または実験室での測定');
}
// 11 elite
{
  const s = slide('CONTENT_PAPER', 'PART 2 ｜ HOW ELITE BATTERS SEE', '一流の打者は、頭で追い、視線で先を読む', '次に、実際に打っている一流の打者を調べた研究です。左は、日本のNTTの研究チーム、木下氏らが2020年に発表した研究です。プロ野球の一軍と二軍の打者に、球種を知らせないまま元投手の投球を打ってもらい、目の動きと頭の動き、バットの軌道を同時に測りました。その結果、一軍の打者は頭の向きを使って、ボールが当たる位置をとらえている可能性が示されました。また、バットがボールに当たる直前に、視線を当たる位置へすばやく移していました。真ん中は、2013年に発表されたクリケットの研究です。世界のトップクラスの打者2名を調べたところ、頭の回転をボールの動きにぴったり合わせ、打つ瞬間には視線をボールに向けていました。右は、2021年にオハイオ州立大学のチームがまとめた総説です。打者はボールを頭の向きで追っていることを確かめた一方で、どの目と頭の動かし方が打撃をいちばんよくするのかは、まだ一致した結論が出ていないとしています。ここで大切なのは、研究はまだ進んでいる途中だということです。「この目の使い方が正解」と決めつけて子どもに押しつけるのではなく、分かってきたことをヒントとして使う。その姿勢で、次の声かけの話に進みます。');
  const c = cols(3, 0.3);
  card(s, c[0].x, 1.85, c[0].w, 3.15, { tag: 'KISHITA et al. ｜ 2020', head: 'プロの実際の打撃', text: '一軍・二軍の打者が、球種を知らされずに元投手の球を打った。一軍の打者は頭の向きで当たる位置をとらえている可能性。当たる直前に視線を当たる位置へ移していた。' });
  card(s, c[1].x, 1.85, c[1].w, 3.15, { tag: 'MANN et al. ｜ 2013', head: '世界トップの打者', text: 'クリケットの一流打者2名を調査。頭の回転をボールの動きに合わせ、打つ瞬間には視線をボールに向けていた。' });
  card(s, c[2].x, 1.85, c[2].w, 3.15, { tag: 'TOOLE & FOGT ｜ 2021', head: '研究のまとめ', text: '打者はボールを頭の向きで追っている。ただし、どの動かし方が打撃を最もよくするかは、まだ一致した結論がない。', warm: true });
  take(s, 5.3, '研究は進んでいる途中。正解の目の使い方を、ひとつに決めつけない');
  src(s, 6.15, 'Kishita et al. (2020) Front Sports Act Living 2:3 ／ Mann et al. (2013) PLoS ONE 8(3) ／ Toole & Fogt (2021) Optom Vis Sci');
}
// 12 words
{
  const s = slide('CONTENT', 'PART 2 ｜ COACHING WORDS', '「ボールをよく見ろ」を、具体的な言葉にする', 'ここまでの研究をふまえて、「ボールをよく見ろ」という声かけを、もう少し具体的な言葉にしてみました。最初にお断りしておくと、これは研究で効果を直接確かめた声かけではありません。研究で分かってきたことをもとに、私たちが考えた言いかえの例です。ひとつ目は「ピッチャーの手を見よう」。ボールが届くまでの時間はとても短いので、できるだけ早く、投手の手を離れる瞬間から情報を入れることを狙います。ふたつ目は「顔ごとボールに向けよう」。打者が目だけでなく、頭の向きでボールを追っているという研究から考えた言葉です。目だけを動かそうとして顔が早く開いてしまう子にも、伝わりやすいと考えます。三つ目は「打つ点を見て終わろう」。一流の打者が、当たる直前に視線を当たる位置に向けていたという研究から考えました。どの言葉も、合う子と合わない子がいます。言葉を変えたら、その子の打席がどう変わったかをよく見て、合う言葉を一緒に探してあげてください。');
  const c = cols(3, 0.3);
  card(s, c[0].x, 1.85, c[0].w, 2.6, { tag: 'WORD 1', head: '「ピッチャーの手を見よう」', hs: 17, text: '届くまでの時間は短い。手を離れる瞬間から情報を入れる。' });
  card(s, c[1].x, 1.85, c[1].w, 2.6, { tag: 'WORD 2', head: '「顔ごとボールに向けよう」', hs: 17, text: '打者は頭の向きでボールを追っている、という研究から。' });
  card(s, c[2].x, 1.85, c[2].w, 2.6, { tag: 'WORD 3', head: '「打つ点を見て終わろう」', hs: 17, text: '一流の打者は、当たる直前に視線を当たる位置へ向けていた。', warm: true });
  take(s, 4.8, '言葉を変えたら、その子の打席がどう変わったかを見る');
  src(s, 5.7, '※研究結果をもとに考えた声かけの例です。効果を直接確かめたものではありません。');
}

// =====================================================================
sec('年代別：特徴と指導の重点、練習例');
// 13 roadmap
{
  const s = slide('CONTENT', 'PART 3 ｜ ROADMAP', '年代別に見る、目の特徴と指導の重点', 'パート3です。ここまでのデータを、年代ごとに一枚にまとめました。真ん中の列はデータから分かる目の特徴、右の列はそれをもとに整理した指導の重点です。右の列は研究で確かめられた処方ではなく、データを踏まえた指導の目安だということを、あらかじめお伝えしておきます。小学校低学年は、静止視力が1.0前後に届き、動くものを見る力が急に伸び始める時期です。高学年になると、動くものを見る力はさらに伸び続けますが、同時に近視の子が増え始めます。中学生では伸び方がゆるやかになり、裸眼で1.0が見えない子が6割程度に増えます。高校生では動くものを見る力がピークを迎える一方、裸眼1.0未満は7割程度です。つまり、見る力が伸びていく流れと、視力が下がっていく流れが、同じ時期に並んで進んでいるのが、この年代の特徴です。次のスライドから、ひとつずつ詳しく見ていきます。');
  table(s, 1.8, ['年代', '目の特徴（データから）', '打撃指導の重点'], [
    ['小学校低学年', '視力は1.0前後に届く。動くものを見る力が急に伸びる', '動くボールを目で追う遊びをたくさん。見えにくさを早く見つける'],
    ['小学校高学年', '動くものを見る力は伸び続ける。近視が増え始める', '投手の手を見る習慣づくり。健診結果を確かめる'],
    ['中学生', '伸びはゆるやかに。裸眼1.0未満が6割程度に', '「何を見るか」を言葉で教える。矯正方法を見直す'],
    ['高校生', '動くものを見る力がピーク。裸眼1.0未満は7割程度', '速い球の中で見る。打席の振り返りと自己管理'],
  ], [2.3, 4.76, 4.77], 16, { rowH: [0.55, 0.95, 0.95, 0.95, 0.95] });
  src(s, 6.35, 'データ：石垣尚男 氏らの研究、文部科学省 学校保健統計調査、日本眼科医会の目安。指導の重点はこれらをもとにした整理です。', 0.5);
}
// 14-17 stages
stageSlide({
  eyebrow: 'PART 3 ｜ STAGE 1', chipText: '小学校低学年 ｜ 6〜8歳ごろ', chipColor: C.accent3, title: 'たくさん動いて、たくさん見る時期',
  feat: ['静止視力は1.0前後に届くのが目安', '動くものを見る力が、いちばん大きく伸びる時期に入る', '見る力の個人差は、すでにこの頃からある', '弱視の治療に間に合うとされる時期の終わりが近い'],
  focus: ['投げる、捕る、打つ遊びで、動くボールを目で追う経験を多く', '「ボールを見て」ではなく「ピッチャーの手を見て」と具体的に', '怖くて目をつぶる子には、やわらかいボールと短い距離から', '目を細める、顔を近づける様子に気づいたら、その日のうちに保護者へ'],
  notes: 'ここから年代ごとに詳しく見ていきます。最初は小学校低学年、6歳から8歳ごろです。目の特徴です。静止視力は1.0前後に届いているのが目安です。そして、動くものを見る力が、一生のうちでいちばん大きく伸びる時期に入ります。石垣氏らの研究では、DVA動体視力は5歳から10歳の伸びが特に大きいとされていました。また、見る力の個人差は、この頃にはすでに見られます。さらに、弱視の治療に間に合うとされる8歳くらいまでの時期の、終わりが近づいています。これを踏まえた指導の重点です。まず、投げる、捕る、打つといった遊びの中で、動くボールを目で追う経験をたくさん積ませること。この時期は、打撃練習の数だけにかたよらず、いろいろな動きの中で見る経験を増やすことが大切だと考えます。次に、声かけを具体的にすること。「ボールを見て」ではなく、「ピッチャーの手を見て」と、どこを見るかまで伝えると、子どもは行動に移しやすくなります。また、ボールが怖くて目をつぶってしまう子もいます。そういう子には、やわらかいボールを使い、距離を短くするところから始めてください。目を開けていられなければ、見る練習そのものができません。そして、目を細める、顔を近づけるといった様子に気づいたら、その日のうちに保護者に伝えてください。この年代では、早く気づくことそのものが、いちばんの指導になります。',
});
stageSlide({
  eyebrow: 'PART 3 ｜ STAGE 2', chipText: '小学校高学年 ｜ 9〜12歳ごろ', chipColor: C.accent1, title: '「投手の手を見る」を習慣にする時期',
  feat: ['動くものを見る力は、15歳ごろまで伸び続ける', '小学校全体で、裸眼1.0未満が3割を超える', 'タブレットやゲームなど、近くを見る時間が増えやすい'],
  focus: ['打席に入ったら、投手の手に目を向ける習慣を毎回の練習で', '健康診断の視力の結果を、保護者と一緒に確かめる', '練習中も眼鏡が必要な子には、競技用の矯正を眼科で相談', '夕方の練習では、ボールが見えにくくなることにも配慮する'],
  notes: '次は小学校高学年、9歳から12歳ごろです。目の特徴です。動くものを見る力は、15歳ごろまで伸び続けます。一方で、小学校全体では裸眼で1.0が見えない子が3割を超えていて、学年が上がるほどその割合は高くなります。タブレットやゲームなど、近くを見る時間が増えやすいのもこの時期です。日本眼科医会の資料でも、近くを見る作業の増加と、外で過ごす時間の減少が、近視の発症に関わると考えられています。指導の重点です。まず、打席に入ったら投手の手に目を向ける。これを毎回の練習で習慣にしていくこと。ボールが届くまでの時間はとても短いので、早く情報を入れる習慣は、中学、高校で球が速くなったときに生きてくると考えます。次に、健康診断の視力の結果を、保護者と一緒に確かめること。結果の紙が届いても、そのままになっている家庭は少なくありません。練習中も眼鏡が必要な子には、競技用の矯正方法を眼科で相談するよう伝えてください。そして、夕方の練習への配慮です。日が落ちてくると、明るさの差が小さくなり、白いボールは見えにくくなります。暗くなってからの打撃練習で、見えにくさが原因の空振りを、技術の問題と取り違えないようにしてあげてください。',
});
stageSlide({
  eyebrow: 'PART 3 ｜ STAGE 3', chipText: '中学生 ｜ 12〜15歳ごろ', chipColor: C.accent4, title: '「何を見るか」を言葉で教える時期',
  feat: ['動くものを見る力の伸びは、小学生の頃よりゆるやかに', '裸眼1.0未満が6割程度に増える', '投球距離や球速が変わり、見え方の感覚が変わりやすい'],
  focus: ['見るものを「手の位置、腕の振り、ボールの出どころ」に分けて言葉で伝える', '距離や球速の変化に、目が慣れるまでの時間をとる', '眼鏡からコンタクトなど、矯正方法の見直しは眼科医と', '見送った球について「何が見えた？」と確かめる'],
  notes: '3つ目は中学生、12歳から15歳ごろです。目の特徴です。動くものを見る力の伸びは、小学生の頃に比べるとゆるやかになりますが、15歳ごろまでは発達が続きます。一方、裸眼で1.0が見えない子は6割程度に増えます。そして、多くの選手にとって、学童野球のころとは投球の距離や球速が変わる時期でもあります。小学生の頃の感覚のままでは、タイミングがずれやすくなります。これを踏まえた指導の重点です。まず、見るものを言葉で分けて伝えること。たとえば、投手の手の位置、腕の振り、ボールがどこから出てくるか。何となく投手を見るのではなく、何を見るのかを知ることで、見方は変わっていくと考えます。次に、距離や球速の変化に目が慣れるまでの時間を、きちんととってあげてください。急に打てなくなった子がいても、すぐにフォームをいじるのではなく、まずは慣れの問題ではないかを考えます。矯正方法を見直す子も増える年代です。眼鏡からコンタクトレンズに変えるかどうかなどは、必ず眼科医と相談するよう伝えましょう。そして、見送った球について「今、何が見えた？」と確かめる声かけを加えると、見る中身が育っていきます。',
});
stageSlide({
  eyebrow: 'PART 3 ｜ STAGE 4', chipText: '高校生 ｜ 15〜18歳ごろ', chipColor: C.accent5, title: '速い球の中で、見る力を発揮する時期',
  feat: ['動くものを見る力が、ピーク（15〜20歳）を迎える', '裸眼1.0未満が7割程度', '球速が上がるほど、判断に使える時間は短くなる'],
  focus: ['打席ごとに「何が見えて、どう判断したか」を振り返る', '球種やコースを読む手がかりを、選手同士で言葉にする', '自分の見え方とコンディションを、自分で管理させる', '打撃の映像で、顔の向きや目線を確かめる'],
  notes: '4つ目は高校生、15歳から18歳ごろです。目の特徴です。動くものを見る力が、15歳から20歳ごろのピークを迎えます。一方で、裸眼で1.0が見えない生徒は7割程度です。そして、先ほどの計算で見たとおり、球速が上がるほど、判断に使える時間は短くなっていきます。指導の重点です。まず、打席ごとに、何が見えて、どう判断したかを振り返る習慣をつけること。打った結果だけでなく、判断の中身を言葉にすることで、自分の目の使い方に気づけるようになると考えます。次に、球種やコースを読む手がかりを、選手同士で言葉にして共有すること。たとえば、この投手は変化球のとき腕の振りがどう見えたか。こうした会話は、見る中身を育てることにつながります。そして、この年代では、自分の見え方やコンディションを自分で管理できるように促すことも大切です。眼鏡やコンタクトの度が合っているか、定期的に眼科で確かめているか。最後に、打撃の映像を使って、顔の向きや目線を確かめること。研究でも、一流の打者は頭の向きでボールを追い、当たる直前に視線を当たる位置へ向けていました。ただし、正解の形はひとつではないので、映像は比べて考える材料として使ってください。',
});
// 18 drill_es
{
  const s = slide('CONTENT', 'PART 3 ｜ PRACTICE FOR ELEMENTARY', '練習例：遊びの中で「見て打つ」を増やす', 'ここから年代別の練習例です。最初にお断りしておくと、これらは研究で効果が確かめられた方法そのものではなく、ここまでの研究の考え方を練習に落とし込んだ例です。チームに合わせて工夫してください。まずは小学生向けです。この年代は、動くものを見る力が大きく伸びる時期なので、遊びの中で見て動く経験を増やすことを狙います。ひとつ目は色ボールトスです。色の違うボールを2つ持ってトスを上げ、上げる直前にコーチが言った色のボールだけを打ちます。見て、判断して、打つという流れを、遊びの中で何度もくり返せます。ふたつ目は数字ボールです。ボールに大きく数字を書いておき、トスやゆるい投球のボールの数字を読んでから、打つか捕ります。ボールの回転や縫い目に自然と目が向くようになります。三つ目は風船やソフトボールを顔ごと追う遊びです。ふわっと上がった風船を、目だけでなく顔ごと向けて追いかけ、手でタッチします。低学年の子や、ボールが怖い子でも安心して取り組めます。どれも、うまく打てたかより、楽しく何回も見て動けたかを大切にしてください。');
  chip(s, '小学生向け', C.accent3);
  const c = cols(3, 0.3);
  card(s, c[0].x, 1.85, c[0].w, 2.75, { tag: 'GAME 1', head: '色ボールトス', text: '色の違うボールを2つトスし、直前にコーチが言った色だけを打つ。見て、判断して、打つをくり返す。' });
  card(s, c[1].x, 1.85, c[1].w, 2.75, { tag: 'GAME 2', head: '数字ボール', text: 'ボールに大きく数字を書く。トスやゆるい球の数字を読んでから、打つか捕る。' });
  card(s, c[2].x, 1.85, c[2].w, 2.75, { tag: 'GAME 3', head: '顔ごと追う風船タッチ', text: '上がった風船やソフトなボールを、顔ごと向けて追いかけてタッチ。ボールが怖い子にも。', warm: true });
  take(s, 4.95, 'うまく打てたかより、楽しく何回も「見て動けたか」を大切に');
  src(s, 5.85, '※研究結果をもとに考えた練習例です。年齢に合わせて距離やスピードを調整してください。');
}
// 19 drill_teen
{
  const s = slide('CONTENT', 'PART 3 ｜ PRACTICE FOR JUNIOR HIGH & HIGH SCHOOL', '練習例：速い球の中で、見て判断する', '次は中学生・高校生向けの練習例です。この年代は、何を見るかという中身を育て、速い球の中で見る力を使えるようにすることを狙います。ひとつ目は、見送りコールです。打席に立ち、打たずに見送って、球種やコース、ストライクかボールかを声に出して言います。捕手やコーチが答え合わせをします。バッティング練習の合間に、打席の一部を見送りに使うだけでも取り組めます。ふたつ目は、リリースコールです。投手の手からボールが離れた瞬間に、速い、遅いを声に出し、そのうえで打つか見送るかを決めます。早い段階で情報を入れ、判断につなげる練習です。三つ目は、映像での振り返りです。スマートフォンで打席を撮影し、打つ瞬間までの顔の向きや目線を、選手自身が確かめます。研究で使われているような専用の機械はなくても、顔がどこを向いているかは映像でかなり分かります。ただし、正解の形はひとつではないので、うまく打てた打席とそうでない打席を比べる材料として使ってください。');
  chip(s, '中学生・高校生向け', C.accent4);
  const c = cols(3, 0.3);
  card(s, c[0].x, 1.85, c[0].w, 2.75, { tag: 'DRILL 1', head: '見送りコール', text: '打たずに見送り、球種、コース、ストライクかボールかを声に出す。捕手やコーチが答え合わせ。' });
  card(s, c[1].x, 1.85, c[1].w, 2.75, { tag: 'DRILL 2', head: 'リリースコール', text: '手を離れた瞬間に「速い／遅い」をコールし、打つか見送るかを決める。' });
  card(s, c[2].x, 1.85, c[2].w, 2.75, { tag: 'DRILL 3', head: '映像で振り返り', text: '打席をスマートフォンで撮影し、打つ瞬間までの顔の向きや目線を選手自身が確かめる。', warm: true });
  take(s, 4.95, '見たことを声に出し、判断までつなげる。結果より判断の中身を振り返る');
  src(s, 5.85, '※研究結果をもとに考えた練習例です。年代とレベルに合わせて強度を調整してください。');
}
// 20 vision training evidence
{
  const s = slide('CONTENT_PAPER', 'PART 3 ｜ VISION TRAINING', '視覚トレーニングの効果は、まだ「期待の段階」', '練習例の最後に、視覚トレーニングそのものについての研究を、ひとつご紹介します。アメリカのシンシナティ大学の野球部で、シーズン前から視覚のトレーニングを取り入れた研究が、2012年に発表されています。チームの打率は、前の年の2割5分1厘から、2割8分5厘に上がりました。同じリーグのほかの大学の打率は、3割0分5厘から2割7分2厘に下がっていました。これだけを見ると、大きな効果があったように見えます。ただし、この研究には注意点があります。まず、選手をくじ引きで2つのグループに分けた比較ではありません。そして、ちょうど同じ時期に、大学野球のバットの規則が変わっていて、著者自身がそのことを指摘しています。ほかのチームの打率が下がっているのも、その影響が考えられます。さらに、トレーニングの課題の成績がどう変わり、それが打撃とどう関係していたのかも分析されていないと指摘されています。つまり、視覚トレーニングは期待はあるけれど、打撃がよくなると言い切れる段階にはまだありません。市販の機器やアプリを使う場合も、「これで打てるようになる」と子どもや保護者に約束しないこと。それが指導者として誠実な伝え方だと思います。');
  const c = cols(3, 0.3);
  statCard(s, c[0].x, 1.85, c[0].w, 2.15, { big: '.251→.285', unit: 'チーム打率', small: '訓練を取り入れた大学（2010→2011年）' });
  statCard(s, c[1].x, 1.85, c[1].w, 2.15, { big: '.305→.272', unit: '同リーグ他校の打率', small: '同じ期間の比較', bigColor: C.text2 });
  card(s, c[2].x, 1.85, c[2].w, 2.15, { tag: 'CAUTION', head: '注意点', text: 'くじ引きの比較ではない。同時期にバットの規則が変わっていた。', warm: true });
  take(s, 4.35, '期待はあるが、まだ言い切れない。「これで打てる」と約束しない');
  src(s, 5.25, 'Clark et al. (2012) PLoS ONE 7(1): e29109　米国シンシナティ大学野球部の前後比較。同時期のNCAAのバット規則変更は著者も言及。', 0.5);
}

// =====================================================================
sec('目を守る');
// 21 protect
{
  const s = slide('CONTENT', 'PART 4 ｜ PROTECT 1', '近視を防ぐ鍵は、外で過ごす時間', 'パート4、目を守るための知識です。まずは近視の予防です。厚生労働省の健康情報サイトでは、屋外活動が近視の発症予防に効果があることは科学的に示されていて、効果を得るには1日2時間の屋外時間が望ましいとされています。まとまった時間でなくても、短い時間を組み合わせてもよいとも説明されています。その根拠のひとつが、中国の広州の小学校で行われた比較試験です。学校での屋外活動の時間を増やしたグループでは、近視の発症が減ったことが報告されています。画面との付き合い方については、文部科学省が、目と画面の距離を30cm程度以上離すこと、そして啓発資料の中で、30分に1回はタブレットから目を離すことを呼びかけています。野球の練習は、多くが屋外で行われます。つまり、外で投げて、捕って、打つ時間そのものが、子どもの目を守る時間にもなっているということです。保護者の方にも、ぜひこの視点を伝えてあげてください。');
  const c = cols(3, 0.3);
  card(s, c[0].x, 1.85, c[0].w, 2.6, { tag: 'OUTDOORS', head: '1日2時間の屋外', text: '屋外活動は近視の発症予防に効果があり、1日2時間が望ましい。短い時間を合わせてもよい。', warm: true });
  card(s, c[1].x, 1.85, c[1].w, 2.6, { tag: 'EVIDENCE', head: '比較試験の結果', text: '中国の小学校で屋外活動の時間を増やしたグループは、近視の発症が減った。' });
  card(s, c[2].x, 1.85, c[2].w, 2.6, { tag: 'SCREENS', head: '画面との付き合い方', text: '目と画面は30cm程度以上離す。30分に1回は画面から目を離す。' });
  take(s, 4.8, '外で投げて、捕って、打つ時間そのものが、子どもの目を守る時間になる');
  src(s, 5.7, '厚生労働省 e-ヘルスネット ／ He et al. (2015) JAMA 314(11) ／ 文部科学省 ICT活用ガイドブックおよび啓発資料');
}
// 22 injury
{
  const s = slide('CONTENT_DARK', 'PART 4 ｜ PROTECT 2', '野球は、子どもの目のけがが多いスポーツ', '目を守るもうひとつの視点が、けがです。ここでは、アメリカのデータをご紹介します。アメリカ眼科学会は、米国国立眼研究所の情報として、野球は14歳以下の子どものスポーツによる目のけがの、主な原因のひとつだと伝えています。また、2025年に発表された、アメリカのインディアナ州で3歳から18歳の子どものスポーツによる目のけがを調べた研究では、原因のスポーツは野球が38.5%でいちばん多く、バスケットボール、サッカーが続きました。手術が必要だったけがでは、目のまわりの骨が折れる眼窩骨折がいちばん多く、その原因の67.0%が野球でした。これらは日本のデータではなく、またインディアナ州の研究はひとつの地域の結果であることは、お伝えしておきます。日本の子どもについて、同じように整理されたデータは、今回は見つけることができませんでした。それでも、硬いボールが速く飛んでくる競技である以上、目や顔のけがへの備えは欠かせません。指導の現場では、ボールが目や顔に当たったときは、本人が「大丈夫」と言っても、眼科を受診させるようにしてください。また、ふだんの眼鏡のままのプレーは、レンズやフレームでけがをするおそれがあるので、競技用の保護具などを眼科医と相談するよう伝えましょう。');
  const c = cols(3, 0.3);
  card(s, c[0].x, 1.85, c[0].w, 2.45, { tag: 'U.S. NEI', head: '主な原因のひとつ', text: '米国で、14歳以下の子どものスポーツによる目のけがの主な原因のひとつが野球。' });
  statCard(s, c[1].x, 1.85, c[1].w, 2.45, { big: '38.5%', unit: '原因の最多は野球', small: '3〜18歳のスポーツによる目のけが（インディアナ州）' });
  statCard(s, c[2].x, 1.85, c[2].w, 2.45, { big: '67.0%', unit: '眼窩骨折の原因', small: '手術が必要だった眼窩骨折のうち、野球が原因の割合' });
  take(s, 4.6, 'ボールが目や顔に当たったら、本人が平気と言っても眼科へ');
  src(s, 5.5, '米国眼科学会（米国国立眼研究所の情報として）／ Clinical Ophthalmology 19 (2025)　※いずれも米国のデータ');
}
// 23 checklist
{
  const s = slide('CONTENT_PAPER', 'PART 4 ｜ CHECKLIST', '指導者が気づくための、見え方チェック', '最後に、指導者が子どもの見えにくさに気づくためのチェックポイントです。左はふだんの様子です。遠くを見るときに目を細める、ボードや紙に顔を近づけて見る、頭を傾けたり横目で見たりする、片目をつぶって見る。こうした様子は、自治体や眼科の啓発資料でもよく挙げられているサインです。右はグラウンドでの様子です。これは研究で確かめられた診断の目安ではなく、ここまでの内容をもとに、プレーの中で気にかけたい様子の例として挙げています。高いフライを見失うことが多い、夕方やナイターで急に空振りや見逃しが増える、打席で顔をしかめたり目を細めたりする、そして練習中だけ眼鏡を外している。もちろん、これらは技術や経験の問題であることも多いです。大切なのは、指導者が診断をすることではありません。気づいたら決めつけずに、保護者に伝えて、眼科の受診をすすめる。その一歩をためらわないことです。');
  const c = cols(2, 0.3);
  panel(s, c[0].x, 1.85, c[0].w, 3.35, 'ふだんの様子', ['遠くを見るときに目を細める', 'ボードや紙に顔を近づけて見る', '頭を傾けたり、横目で見たりする', '片目をつぶって見ることがある'], false);
  panel(s, c[1].x, 1.85, c[1].w, 3.35, 'グラウンドでの様子', ['高いフライを見失うことが多い', '夕方やナイターで、急に空振りや見逃しが増える', '打席で顔をしかめたり、目を細めたりする', '練習中だけ眼鏡を外している'], false);
  take(s, 5.45, '気づいたら決めつけずに、保護者へ伝えて眼科の受診をすすめる');
  src(s, 6.3, '※左は自治体や眼科の啓発資料でよく挙げられるサイン、右はプレーの中で気にかけたい様子の例です。');
}

// =====================================================================
sec('まとめと参考文献');
// 24 summary
{
  const s = slide('STATEMENT_AMBER', null, null, '最後に、今日の内容をまとめます。年代に合わせて、目を育てる。そして、目を守る。この2つが今日のメッセージです。ひとつ目、育つ時期を知ること。動くものを見る力は5歳から10歳で大きく伸び、15歳から20歳でピークを迎えます。小学生の年代は、見る力がいちばん伸びる時期のまっただ中です。ふたつ目、打者の目の使い方を知ること。打者はボールを目だけで最後まで追っているのではなく、頭の向きで追い、視線を先回りさせていることが分かってきました。ただし研究は途中なので、正解をひとつに決めつけず、具体的な言葉で伝えて、その子の変化を見ていきます。三つ目、見え方を守ること。外で過ごす時間を大切にし、見えにくさや目のけがに気づいたら、ためらわずに眼科へつなぐ。冒頭の問いを思い出してください。空振りが続くあの子に足りないのは、本当にスイングでしょうか。今日のお話が、その子をもう一度違う目で見るきっかけになればうれしく思います。ご清聴ありがとうございました。');
  s.addText('SUMMARY', { x: X0, y: 0.9, w: 6, h: 0.4, fontFace: EN, fontSize: 14, bold: true, charSpacing: 3, color: C.text1, margin: 0, isTextBox: true });
  s.addText([{ text: '年代に合わせて、', options: { breakLine: true } }, { text: '目を育てる。目を守る。' }], { x: X0, y: 1.4, w: W0, h: 1.9, fontSize: 40, bold: true, color: C.text1, margin: 0, valign: 'top', lineSpacingMultiple: 1.3, isTextBox: true });
  const c = cols(3, 0.3);
  card(s, c[0].x, 3.75, c[0].w, 2.5, { head: '育つ時期を知る', text: '動くものを見る力は5〜10歳で大きく伸び、15〜20歳でピークを迎える。' });
  card(s, c[1].x, 3.75, c[1].w, 2.5, { head: '打者の目を知る', text: '目だけでなく頭の向きで追い、視線は先回り。正解はひとつに決めつけない。' });
  card(s, c[2].x, 3.75, c[2].w, 2.5, { head: '見え方を守る', text: '外で過ごす時間を大切にし、見えにくさやけがに気づいたら眼科へつなぐ。' });
}
// 25 future
{
  const s = slide('STATEMENT_DARK', null, null, '最後のこのスライドは、選手のみんなへのメッセージです。指導者の皆さんから、ぜひ子どもたちに伝えてあげてください。未来のアスリートのみんなへ。きみの目は、高校生の頃まで伸びつづけます。動くものを見る力は、5歳から10歳で大きく伸びて、15歳から20歳ごろにいちばん高くなることが分かっています。今、まさに伸びている最中です。だから、今日からできることを3つ。ひとつ目、外で思いきりボールを追いかけよう。外で過ごす時間は、目を育てるだけでなく、近視から目を守ることにもつながります。ふたつ目、打席では、ピッチャーの手から、顔ごとボールに向けよう。プロの打者も、目だけでなく頭の向きでボールを追っていることが分かってきています。三つ目、もし見えにくいと感じたら、コーチやお家の人に話そう。くっきり見えることが、うまくなるためのスタートです。みんなの目がこれからどこまで伸びていくのか、楽しみにしています。');
  s.addText('TO FUTURE ATHLETES', { x: X0, y: 0.9, w: 6, h: 0.4, fontFace: EN, fontSize: 14, bold: true, charSpacing: 3, color: C.accent1, margin: 0, isTextBox: true });
  s.addText([{ text: '未来のアスリートへ。', options: { breakLine: true } }, { text: 'きみの目は、高校生まで伸びつづける。' }], { x: X0, y: 1.4, w: W0, h: 1.9, fontSize: 38, bold: true, color: C.text1, margin: 0, valign: 'top', lineSpacingMultiple: 1.3, isTextBox: true });
  const c = cols(3, 0.3);
  card(s, c[0].x, 3.75, c[0].w, 2.5, { tag: 'PLAY OUTSIDE', head: '外で思いきり', text: '外でボールを追う時間が、目を育てて守る。', tagColor: C.accent3 });
  card(s, c[1].x, 3.75, c[1].w, 2.5, { tag: 'WATCH THE HAND', head: '手から、顔ごと', text: 'ピッチャーの手を見て、顔ごとボールに向けよう。', warm: true });
  card(s, c[2].x, 3.75, c[2].w, 2.5, { tag: 'SPEAK UP', head: '見えにくいなら伝えよう', text: 'ぼやけて見えたら、コーチや家の人に話そう。' });
}
// 26 refs
{
  const s = slide('CONTENT', 'REFERENCES', '参考文献・出典', '今日ご紹介した研究と統計の出典です。英語の論文の多くは、無料で全文を読むことができます。気になるものがあれば、原文もぜひご覧ください。');
  const refs = [
    '文部科学省（2025）令和6年度学校保健統計調査 確定値',
    '日本眼科医会「6歳で視力1.0」の目安（東洋経済オンライン掲載記事より）／各自治体の弱視に関する案内',
    '石垣尚男 氏らの研究（愛知工業大学）：5〜92歳826名のDVA動体視力の測定、年少時のスポーツビジョンの個人差',
    'Bahill, A. T. & LaRitz, T. (1984) Why can\'t batters keep their eyes on the ball? American Scientist, 72, 249–253.',
    'Fogt, N. F. & Zimmerman, A. B. (2014) A method to monitor eye and head tracking movements in college baseball players. Optometry and Vision Science.',
    'Kishita, Y., Ueda, H. & Kashino, M. (2020) Eye and head movements of elite baseball players in real batting. Frontiers in Sports and Active Living, 2, 3.',
    'Mann, D. L., Spratford, W. & Abernethy, B. (2013) The head tracks and gaze predicts. PLoS ONE, 8(3), e58289.',
    'Toole, A. J. & Fogt, N. (2021) Review: Head and eye movements and gaze tracking in baseball batting. Optometry and Vision Science.',
    'Clark, J. F. et al. (2012) High-performance vision training improves batting statistics for University of Cincinnati baseball players. PLoS ONE, 7(1), e29109.',
    '厚生労働省 e-ヘルスネット（屋外活動と近視）／ He, M. et al. (2015) JAMA, 314(11) ／ 文部科学省 ICT活用ガイドブック、啓発資料',
    'American Academy of Ophthalmology: In Baseball, Eye Safety Often Takes a Hit ／ 小児のスポーツ眼外傷の分析, Clinical Ophthalmology, 19 (2025)',
    '公認野球規則（投手板から本塁まで18.44m）／ 学童部の大会規則（16m）／ 測定項目の区分：日本スポーツビジョン協会',
  ];
  s.addText(refs.map((t, i) => ({ text: t, options: { bullet: { indent: 12 }, breakLine: i < refs.length - 1, paraSpaceAfter: 5 } })), { x: X0, y: 1.75, w: W0, h: 5.0, fontSize: 13, color: C.text2, lineSpacingMultiple: 1.1, margin: 0, valign: 'top', isTextBox: true });
}

(async () => {
  await pres.writeFile({ fileName: OUT });
  await applyTheme(OUT, THEME);
  console.log('wrote', OUT);
})();
