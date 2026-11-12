/*
 * お試し版：ブラウザの中で動く「サーバーの代わり」
 *
 * 本番では api/coach・api/client・api/health が Vercel 上で動きます。
 * お試し版では、その呼び出しをこのファイルが受け取り、ブラウザの保存領域（localStorage）に記録します。
 * AI はサンプルの結果を返します（写真の内容は解析しません）。
 */
(function () {
  'use strict';

  window.__DEMO__ = true;
  var DB_KEY = 'connect.demo.db';
  var DB_VERSION = 4;
  var COACH_TOKEN = 'demo-coach-token';
  var CODES = { hanako: 'demo-hanako-0000000000000001', taro: 'demo-taro-00000000000000000002', yuki: 'demo-yuki-00000000000000000003', kenji: 'demo-kenji-0000000000000000004' };

  // ------------------------------------------------------------------
  // 日付
  // ------------------------------------------------------------------
  function pad(n) { return String(n).padStart(2, '0'); }
  function dk(daysAgo) { var d = new Date(); d.setDate(d.getDate() - daysAgo); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  // 今日の時刻は、開いた時刻より前になるように前へずらす（並び順は保つ）
  function at(daysAgo, hh, mm) {
    var now = new Date();
    if (daysAgo === 0) return new Date(now.getTime() - (24 * 60 - (hh * 60 + (mm || 0))) * 6000 - 60000).toISOString();
    var d = new Date(); d.setDate(d.getDate() - daysAgo); d.setHours(hh, mm || 0, 0, 0); return d.toISOString();
  }
  function nowHm() { var d = new Date(); return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function today() { return dk(0); }
  function uid(p) { return p + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4); }

  // ------------------------------------------------------------------
  // サンプルの食事（値は一般的な目安。お試し用）
  // ------------------------------------------------------------------
  function it(name, portion, kcal, p, f, c, s) { return { name: name, portion: portion, kcal: kcal, protein_g: p, fat_g: f, carbs_g: c, salt_g: s }; }
  var RICE = it('雑穀ご飯', '茶碗1杯 約150g', 252, 4.5, 1.0, 54.0, 0);
  var MISO = it('具だくさん味噌汁', 'お椀1杯', 50, 3.0, 1.5, 5.0, 1.5);
  var SETS = {
    b1: { type: '朝食', time: '07:20', dish: '和朝食', emoji: '🍚', color: '#fde68a', tags: ['バランス良好', '発酵食品'], items: [RICE, it('納豆（ねぎ入り）', '1パック', 95, 7.5, 4.5, 6.0, 0.6), it('卵焼き', '2切れ', 90, 6.0, 6.0, 2.0, 0.6), MISO] },
    b2: { type: '朝食', time: '07:40', dish: 'トーストとヨーグルト', emoji: '🍞', color: '#fed7aa', tags: ['軽め'], items: [it('トースト（6枚切り）', '1枚', 160, 5.5, 3.0, 27.0, 0.7), it('プレーンヨーグルト', '約100g', 62, 3.6, 3.0, 4.9, 0.1), it('バナナ', '1本', 86, 1.1, 0.2, 22.5, 0)] },
    l1: { type: '昼食', time: '12:30', dish: '豚の生姜焼き定食', emoji: '🍱', color: '#fecaca', tags: ['高たんぱく', '主食あり'], items: [RICE, it('豚の生姜焼き', '豚ロース 約100g', 300, 19.0, 20.0, 8.0, 1.8), it('キャベツの千切り（マヨネーズ）', '約60g', 45, 0.8, 3.5, 3.2, 0.1), it('ごぼうのきんぴら', '小鉢1つ', 60, 1.0, 2.0, 9.0, 0.8)] },
    l2: { type: '昼食', time: '12:10', dish: '山菜そば', emoji: '🍜', color: '#d9f99d', tags: ['軽め'], items: [it('山菜そば', '1杯', 330, 13.0, 2.5, 62.0, 4.0)] },
    l3: { type: '昼食', time: '12:45', dish: 'おにぎりとサラダチキン', emoji: '🍙', color: '#bfdbfe', tags: ['高たんぱく', '主食あり'], items: [it('鮭おにぎり', '1個', 180, 4.5, 1.5, 38.0, 1.1), it('サラダチキン', '1パック', 110, 24.0, 1.5, 0.3, 1.2), it('グリーンサラダ（ノンオイル）', '1パック', 30, 1.0, 0.2, 5.0, 0.3)] },
    d1: { type: '夕食', time: '19:00', dish: '焼き魚定食', emoji: '🐟', color: '#bae6fd', tags: ['バランス良好', '高たんぱく'], items: [RICE, it('鮭の塩焼き', '1切れ', 140, 18.0, 6.0, 0.1, 1.4), it('ほうれん草のおひたし', '小鉢1つ', 20, 1.5, 0.3, 2.0, 0.5), MISO] },
    d2: { type: '夕食', time: '19:30', dish: '肉じゃがともずく酢', emoji: '🥔', color: '#e9d5ff', tags: ['主食あり'], items: [RICE, it('肉じゃが', '1皿', 280, 10.0, 10.0, 35.0, 2.0), it('もずく酢', '小鉢1つ', 20, 0.3, 0.1, 4.0, 0.8)] },
    d3: { type: '夕食', time: '20:00', dish: '鶏と豆腐の鍋', emoji: '🍲', color: '#fbcfe8', tags: ['高たんぱく', '野菜たっぷり'], items: [it('鶏と豆腐の鍋', '1人分', 350, 30.0, 15.0, 15.0, 3.0), it('ご飯', '小盛り 約100g', 168, 2.5, 0.3, 37.0, 0)] },
    s1: { type: '間食', time: '15:00', dish: '素焼きナッツ', emoji: '🥜', color: '#fef3c7', tags: ['間食'], items: [it('素焼きミックスナッツ', '約15g', 90, 3.0, 8.0, 2.5, 0)] },
    s2: { type: '間食', time: '16:00', dish: '蒸したさつまいも', emoji: '🍠', color: '#fde2e4', tags: ['間食'], items: [it('蒸したさつまいも', '約80g', 105, 1.0, 0.2, 25.0, 0)] },
    s3: { type: '間食', time: '21:30', dish: 'チョコレート', emoji: '🍫', color: '#e7d3c3', tags: ['間食', '糖質多め'], items: [it('チョコレート', '3かけ', 85, 1.0, 5.0, 8.0, 0)] }
  };

  function thumbFor(set) {
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" rx="18" fill="' + set.color + '"/><text x="60" y="78" font-size="56" text-anchor="middle">' + set.emoji + '</text></svg>';
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }
  function round1(n) { return Math.round(n * 10) / 10; }
  function totalsOf(items) {
    var t = { kcal: 0, protein_g: 0, fat_g: 0, carbs_g: 0, salt_g: 0 };
    items.forEach(function (x) { Object.keys(t).forEach(function (k) { t[k] += Math.max(0, Number(x[k]) || 0); }); });
    t.kcal = Math.round(t.kcal);
    ['protein_g', 'fat_g', 'carbs_g', 'salt_g'].forEach(function (k) { t[k] = round1(t[k]); });
    return t;
  }
  function mealFrom(key, extra) {
    var s = SETS[key];
    var items = JSON.parse(JSON.stringify(s.items));
    return Object.assign({ id: uid('m'), time: s.time, type: s.type, dish: s.dish, items: items, totals: totalsOf(items), confidence: 'medium', good: [], cautions: [], tags: s.tags.slice(), memo: '', thumb: thumbFor(s), demo: true, createdAt: new Date().toISOString() }, extra || {});
  }

  // ------------------------------------------------------------------
  // サンプルデータ
  // ------------------------------------------------------------------
  function seed() {
    var db = { version: DB_VERSION, clients: {}, codes: {}, days: {}, msgs: {}, templates: [] };
    function addClient(key, c) {
      db.clients[c.id] = c;
      db.codes[CODES[key]] = c.id;
      db.days[c.id] = {};
      db.msgs[c.id] = [];
    }
    function day(cid, n) { var d = dk(n); return db.days[cid][d] || (db.days[cid][d] = { date: d, meals: [], body: {} }); }
    function msg(cid, from, n, hh, text, meta) { var m = { id: uid('t'), from: from, text: text, at: at(n, hh, 5) }; if (meta) m.meta = meta; db.msgs[cid].push(m); }
    var plans = ['b1,l1,d1', 'b2,l3,d2,s1', 'b1,l2,d3', 'b1,l1,d2,s2', 'b2,l3,d1', 'b1,l2,d3,s3', 'b1,l1,d1,s1'];

    // 1. はなこさん：体重が2週間ほど横ばい（停滞期）で、今日は不安な気持ち
    var h = { id: 'c-hanako', name: 'はなこ', honorific: 'さん', sex: 'female', age: '40', height: '160', weight: '60.9', goalWeight: '56', activity: 'light', pace: 'gentle',
      startDate: dk(23), totalDays: '90', startWeight: '62', tone: 'gentle', concerns: ['snack', 'night', 'sweets'], goalNote: '来年の旅行で好きな服を着たい',
      coachMemo: '甘いものが好き。夜勤のある週は食事が乱れやすい。', createdAt: at(23, 9), coachReadAt: at(0, 8), clientReadAt: at(0, 7), lastActivityAt: at(0, 12, 40) };
    addClient('hanako', h);
    var hw = { 23: 62.0, 20: 61.6, 17: 61.3, 14: 60.9, 12: 60.9, 10: 60.8, 8: 60.7, 6: 60.8, 4: 60.8, 2: 60.7, 1: 60.8, 0: 60.9 };
    for (var n = 13; n >= 1; n--) plans[n % 7].split(',').forEach(function (k) { day(h.id, n).meals.push(mealFrom(k)); });
    if (nowHm() >= '07:20') day(h.id, 0).meals.push(mealFrom('b1'));
    if (nowHm() >= '12:30') day(h.id, 0).meals.push(mealFrom('l1', { memo: 'ご飯は少なめにしました' }));
    Object.keys(hw).forEach(function (k) { day(h.id, +k).body.weight = hw[k]; });
    day(h.id, 2).body.mood = 'normal'; day(h.id, 1).body.mood = 'tired'; day(h.id, 1).body.sleep = 5.5; day(h.id, 1).body.memo = '夜勤明けで寝不足';
    Object.assign(day(h.id, 0).body, { mood: 'anxious', sleep: 6, memo: 'なかなか体重が減りません…' });
    var rapportThemes = ['はじまりの感謝', '不安を受け止める', '小さな一歩を認める', '好きなものを大切に', '体の声を聴く', '過去の自分を責めない', '1週間の振り返り', '自分の強みに気づく', '7割で合格', '言葉を変えてみる'];
    rapportThemes.forEach(function (t, i) {
      msg(h.id, 'coach', 23 - i * 2, 8, 'はなこさん、おはようございます。3週間メッセージ ' + (i + 1) + '日目「' + t + '」をお送りします。（サンプル）', { kind: 'rapport', day: i + 1, label: 'ラポール21日：' + (i + 1) + '日目' });
      if (i % 3 === 0) msg(h.id, 'client', 23 - i * 2, 21, 'ありがとうございます。今日もがんばります！');
    });
    msg(h.id, 'coach', 2, 20, 'はなこさん、夜勤の週なのに記録を続けていて本当にすごいです。無理せず、休めるときにしっかり休んでくださいね。', { kind: 'template', label: '定型文：疲れが見える時に' });
    msg(h.id, 'client', 0, 12, '最近体重が減らなくて、少し落ち込んでいます。やり方が合っていないのでしょうか…');

    // 2. たろうさん：順調に減っている。ラポール21日は全部送信済み
    var t = { id: 'c-taro', name: 'たろう', honorific: 'さん', sex: 'male', age: '35', height: '175', weight: '79.4', goalWeight: '75', activity: 'moderate', pace: 'standard',
      startDate: dk(40), totalDays: '120', startWeight: '82', tone: 'genki', concerns: ['eatout', 'alcohol'], goalNote: '健康診断の数値を良くしたい',
      coachMemo: '飲み会が週1回ある。', createdAt: at(40, 9), coachReadAt: at(0, 9), clientReadAt: at(1, 22), lastActivityAt: at(0, 8) };
    addClient('taro', t);
    for (var m = 13; m >= 1; m--) plans[(m + 3) % 7].split(',').forEach(function (k) { day(t.id, m).meals.push(mealFrom(k)); });
    if (nowHm() >= '07:40') day(t.id, 0).meals.push(mealFrom('b2'));
    [[13, 80.6], [11, 80.4], [9, 80.1], [7, 80.0], [5, 79.8], [3, 79.7], [1, 79.5], [0, 79.4]].forEach(function (x) { day(t.id, x[0]).body.weight = x[1]; });
    day(t.id, 0).body.mood = 'good'; day(t.id, 0).body.sleep = 7;
    for (var r = 1; r <= 21; r++) msg(t.id, 'coach', 40 - r, 8, 'たろうさん、3週間メッセージ ' + r + '日目です。（サンプル）', { kind: 'rapport', day: r, label: 'ラポール21日：' + r + '日目' });
    msg(t.id, 'client', 1, 21, '昨日は飲み会でしたが、焼き鳥（塩）と枝豆中心にしました！');
    msg(t.id, 'coach', 1, 22, 'たろうさん、ナイスチョイスです！お酒の合間にお水も飲めるとさらにいいですね。', { kind: 'reply', label: '返信' });

    // 3. ゆきさん：体調不良のメモと、気持ちの落ち込みが続いている
    var y = { id: 'c-yuki', name: 'ゆき', honorific: 'さん', sex: 'female', age: '28', height: '155', weight: '54.6', goalWeight: '52', activity: 'low', pace: 'gentle',
      startDate: dk(10), totalDays: '60', startWeight: '55.2', tone: 'gentle', concerns: ['skip', 'stress'], goalNote: '自分の体に自信を持ちたい',
      coachMemo: '朝食を抜きがち。', createdAt: at(10, 9), coachReadAt: at(1, 9), clientReadAt: at(1, 9), lastActivityAt: at(1, 8) };
    addClient('yuki', y);
    for (var q = 9; q >= 1; q--) ('l3,d2' + (q % 2 ? '' : ',s3')).split(',').forEach(function (k) { day(y.id, q).meals.push(mealFrom(k)); });
    [[9, 55.0], [6, 54.8], [3, 54.7], [1, 54.6]].forEach(function (x) { day(y.id, x[0]).body.weight = x[1]; });
    Object.assign(day(y.id, 2).body, { mood: 'down', memo: '仕事で疲れて食欲がない' });
    Object.assign(day(y.id, 1).body, { mood: 'down', sleep: 5, memo: '朝、少しめまいがした' });
    msg(y.id, 'coach', 10, 9, 'ゆきさん、今日から一緒に取り組めること、とてもうれしいです。（サンプル）', { kind: 'rapport', day: 1, label: 'ラポール21日：1日目' });
    msg(y.id, 'client', 1, 8, '最近ちょっと疲れていて、朝ごはんを食べられていません');

    // 4. けんじさん：最後の記録から5日たっている
    var k = { id: 'c-kenji', name: 'けんじ', honorific: 'さん', sex: 'male', age: '50', height: '170', weight: '74.8', goalWeight: '70', activity: 'low', pace: 'gentle',
      startDate: dk(30), totalDays: '90', startWeight: '76', tone: 'polite', concerns: ['busy', 'noexercise'], goalNote: '階段で息切れしない体になりたい',
      coachMemo: '出張が多い。', createdAt: at(30, 9), coachReadAt: at(5, 9), clientReadAt: at(5, 9), lastActivityAt: at(5, 20) };
    addClient('kenji', k);
    for (var z = 12; z >= 5; z--) 'b1,l2,d1'.split(',').forEach(function (key) { day(k.id, z).meals.push(mealFrom(key)); });
    [[12, 75.2], [9, 75.0], [5, 74.8]].forEach(function (x) { day(k.id, x[0]).body.weight = x[1]; });
    msg(k.id, 'coach', 5, 21, 'けんじさん、出張中も記録をありがとうございます。（サンプル）', { kind: 'template', label: '定型文：記録へのお礼' });

    db.templates.push({ id: 'u-sample', title: '朝の記録へのお礼（サンプル）', text: '{name}、朝から記録ありがとうございます。今日も{name}のペースで、無理なくいきましょうね。', cat: 'mine', updatedAt: new Date().toISOString() });
    return db;
  }

  // ------------------------------------------------------------------
  // 保存
  // ------------------------------------------------------------------
  var memo = null;
  function load() {
    if (memo) return memo;
    try { var d = JSON.parse(localStorage.getItem(DB_KEY) || 'null'); if (d && d.version === DB_VERSION) memo = d; } catch (e) { /* 何もしない */ }
    if (!memo) { memo = seed(); persist(); }
    return memo;
  }
  function persist() { try { localStorage.setItem(DB_KEY, JSON.stringify(memo)); } catch (e) { /* 容量不足でも動かす */ } }
  function reset() {
    try {
      localStorage.removeItem(DB_KEY);
      ['connect.client.code', 'connect.coach.token', 'connect.client.advice'].forEach(function (k) { localStorage.removeItem(k); });
    } catch (e) { /* 何もしない */ }
    memo = null;
  }

  // ------------------------------------------------------------------
  // 本番の lib/repo.js と同じ考え方の処理
  // ------------------------------------------------------------------
  function Err(status, message) { this.status = status; this.message = message; }
  function safe(c, forClient) { var o = JSON.parse(JSON.stringify(c)); if (forClient) delete o.coachMemo; return o; }
  function daysOf(cid, from, to) {
    var all = load().days[cid] || {};
    return Object.keys(all).filter(function (d) { return d >= from && d <= to; }).sort().reverse().map(function (d) { return all[d]; });
  }
  function getDay(cid, date) { var all = load().days[cid]; return all[date] || (all[date] = { date: date, meals: [], body: {} }); }
  function msgs(cid, n) { var l = load().msgs[cid] || []; return l.slice(-(n || 100)); }
  function unreadFor(who, c, list) {
    var since = who === 'coach' ? c.coachReadAt : c.clientReadAt;
    var other = who === 'coach' ? 'client' : 'coach';
    return list.filter(function (m) { return m.from === other && (!since || m.at > since); }).length;
  }
  function addDays(s, n) { var p = s.split('-').map(Number); var d = new Date(p[0], p[1] - 1, p[2], 12); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  var URGENT = ['めまい', 'ふらつ', '動悸', '吐き気', '生理が止ま', '生理が来な', '食べられな', '吐いて', '吐いた', '死にたい', '消えたい'];
  function watchList(days, t) {
    var out = [];
    var recent = days.filter(function (d) { return d.date >= addDays(t, -2); });
    var text = recent.map(function (d) { return [(d.body && d.body.memo) || ''].concat((d.meals || []).map(function (m) { return m.memo || ''; })).join(' '); }).join(' ');
    var hits = URGENT.filter(function (w) { return text.indexOf(w) !== -1; });
    if (hits.length) out.push({ level: 'urgent', text: '体調やつらい気持ちを示す言葉があります（' + hits.join('、') + '）' });
    var withRec = days.filter(function (d) { return (d.meals && d.meals.length) || (d.body && Object.keys(d.body).length); });
    var last = withRec.length ? withRec[0].date : null;
    if (!last) out.push({ level: 'info', text: 'まだ記録がありません' });
    else if (last < addDays(t, -2)) out.push({ level: 'warn', text: '最後の記録から3日以上たっています' });
    var moods = recent.map(function (d) { return d.body && d.body.mood; }).filter(function (m) { return m === 'down' || m === 'anxious'; });
    if (moods.length >= 2) out.push({ level: 'warn', text: '気持ちが沈んだ記録が続いています' });
    var ws = days.filter(function (d) { return d.body && d.body.weight; }).map(function (d) { return { date: d.date, w: d.body.weight }; });
    if (ws.length >= 2) {
      var prev = ws.slice(1).filter(function (x) { return x.date >= addDays(ws[0].date, -7); });
      if (prev.length && ws[0].w - Math.min.apply(null, prev.map(function (x) { return x.w; })) >= 1) out.push({ level: 'info', text: '体重が1週間で1kg以上増えています（水分などの影響もあり得ます）' });
    }
    return out;
  }
  function noThumbs(days) { return days.map(function (d) { return Object.assign({}, d, { meals: (d.meals || []).map(function (m) { return Object.assign({}, m, { thumb: m.thumb ? true : null }); }) }); }); }
  function touch(c, f) { c[f] = new Date().toISOString(); }
  function addMessage(c, from, text, meta) {
    var t = String(text || '').trim().slice(0, 2000);
    if (!t) throw new Err(400, 'メッセージを入力してください。');
    var m = { id: uid('t'), from: from, text: t, at: new Date().toISOString() };
    if (from === 'coach' && meta && ['template', 'comment', 'rapport', 'plateau', 'reply', 'draft', 'other'].indexOf(meta.kind) !== -1) {
      m.meta = { kind: meta.kind };
      if (meta.label) m.meta.label = String(meta.label).slice(0, 60);
      if (meta.kind === 'rapport' && meta.day >= 1 && meta.day <= 21) m.meta.day = parseInt(meta.day, 10);
    }
    load().msgs[c.id].push(m);
    touch(c, from === 'coach' ? 'coachReadAt' : 'clientReadAt');
    return m;
  }
  function cleanItems(items) {
    return (items || []).slice(0, 20).map(function (x) {
      return { name: String(x.name || '').slice(0, 60), portion: String(x.portion || '').slice(0, 60), kcal: Math.max(0, Math.round(Number(x.kcal) || 0)), protein_g: Math.max(0, round1(Number(x.protein_g) || 0)), fat_g: Math.max(0, round1(Number(x.fat_g) || 0)), carbs_g: Math.max(0, round1(Number(x.carbs_g) || 0)), salt_g: Math.max(0, round1(Number(x.salt_g) || 0)) };
    });
  }

  // ------------------------------------------------------------------
  // AI のサンプル
  // ------------------------------------------------------------------
  function mockAnalyze(mealType) {
    var key = { 朝食: 'b1', 昼食: 'l1', 夕食: 'd1', 間食: 's1' }[mealType] || 'l1';
    var s = SETS[key];
    var items = JSON.parse(JSON.stringify(s.items));
    return {
      demo: true, dish_name: s.dish + '（お試し）', summary: 'お試し版のため、写真の内容に関係なくサンプルの結果を表示しています。',
      items: items, totals: totalsOf(items), confidence: 'medium', assumptions: ['お試し用の固定のデータです'],
      good_points: ['主食・主菜・副菜をそろえようとしている様子が伝わってきます'], cautions: ['汁物や味の濃いおかずが重なる日は、汁を少し残すと塩分を控えられます'], tags: s.tags.slice()
    };
  }
  function mockAdvice() {
    return { demo: true, verdict_title: 'いいバランスで進んでいます（お試し）', verdict_body: 'お試し版のサンプルです。本番では、今日の記録と目標をもとに AI が具体的に提案します。', tips: [
      { kind: 'praise', title: '記録を続けられています', body: '毎日記録することが、いちばんの力になります。' },
      { kind: 'meal', title: '次の食事は野菜とたんぱく質を中心に', body: '焼き魚や豆腐に、具だくさんの汁物を合わせると整いやすくなります。' },
      { kind: 'activity', title: '食後に10分歩いてみませんか', body: '少し体を動かすだけでも、1日の消費エネルギーは積み重なります。' }
    ] };
  }
  var MOOD_TEXT = { good: '前向きな様子が伝わってきて、私もうれしいです。', normal: '', tired: 'お疲れが出ているようなので、今日は無理せず休むことも大切にしてくださいね。', anxious: '不安な気持ち、とてもよく分かります。数字が動かない時期があるのは自然なことなので、焦らなくて大丈夫ですよ。', down: '気持ちが沈んでいる時は、ダイエットのことは少しお休みして大丈夫です。' };
  function mockDraft(c) {
    var name = c.name + (c.honorific === undefined ? 'さん' : c.honorific);
    var days = daysOf(c.id, addDays(today(), -2), today());
    var meal = null, mood = '', memoText = '';
    days.forEach(function (d) { if (!meal && d.meals && d.meals.length) meal = d.meals[d.meals.length - 1]; if (!mood && d.body && d.body.mood) mood = d.body.mood; if (!memoText && d.body && d.body.memo) memoText = d.body.memo; });
    var lines = [name + '、いつも記録をありがとうございます。'];
    if (meal) lines.push(meal.dish + 'の記録、拝見しました。' + (meal.tags && meal.tags.indexOf('高たんぱく') !== -1 ? 'たんぱく質がしっかりとれていて、とてもいいですね。' : '毎日の積み重ねが、ちゃんと形になってきています。'));
    if (mood && MOOD_TEXT[mood]) lines.push(MOOD_TEXT[mood]);
    lines.push('今日はどんな一日でしたか？よかったら教えてくださいね。');
    var considered = [];
    if (meal) considered.push('最新の食事：' + meal.dish);
    if (mood) considered.push('最近の気分：' + mood);
    if (memoText) considered.push('メモ：' + memoText);
    considered.push('お試し版の下書きです（本番では AI が記録とやり取りを読んで作ります）');
    return { demo: true, message: lines.join('\n\n'), considered: considered };
  }

  // ------------------------------------------------------------------
  // 操作
  // ------------------------------------------------------------------
  function findClient(id) { var c = load().clients[id]; if (!c) throw new Err(404, 'クライアントが見つかりません。'); return c; }
  var PROFILE_KEYS = ['name', 'honorific', 'sex', 'age', 'height', 'weight', 'goalWeight', 'activity', 'pace', 'startDate', 'goalNote', 'coachMemo', 'tone', 'startWeight', 'totalDays', 'rapportStart'];
  function applyProfile(c, p) {
    PROFILE_KEYS.forEach(function (k) { if (p[k] !== undefined) c[k] = String(p[k]).trim().slice(0, k === 'coachMemo' ? 1000 : 200); });
    if (Array.isArray(p.concerns)) c.concerns = p.concerns.slice(0, 20);
  }

  var coachActions = {
    login: function (b) { if (b.password !== 'demo') throw new Err(401, 'パスワードが違います（お試し版のパスワードは demo です）。'); return { token: COACH_TOKEN }; },
    overview: function () {
      var t = today();
      var rows = Object.keys(load().clients).map(function (id) {
        var c = load().clients[id];
        var days = daysOf(id, addDays(t, -7), t);
        var ms = msgs(id, 50);
        return { client: safe(c), days: noThumbs(days), unread: unreadFor('coach', c, ms), watch: watchList(days, t), lastMessage: ms[ms.length - 1] || null };
      });
      return { today: t, clients: rows };
    },
    createClient: function (b) {
      var id = uid('c-');
      var code = 'demo-' + uid('') + uid('');
      var c = { id: id, honorific: 'さん', sex: 'female', activity: 'low', pace: 'gentle', createdAt: new Date().toISOString(), coachReadAt: new Date().toISOString(), clientReadAt: new Date().toISOString(), lastActivityAt: null };
      applyProfile(c, b.profile || {});
      if (!c.name) throw new Err(400, 'お名前（呼び名）を入力してください。');
      var db = load();
      db.clients[id] = c; db.codes[code] = id; db.days[id] = {}; db.msgs[id] = [];
      return { client: safe(c), inviteCode: code };
    },
    client: function (b) {
      var t = today();
      var c = findClient(b.id);
      var days = daysOf(c.id, addDays(t, -29), t);
      var ms = msgs(c.id, 100);
      return { today: t, client: safe(c), days: days, messages: ms, unread: unreadFor('coach', c, ms), watch: watchList(days, t) };
    },
    updateClient: function (b) { var c = findClient(b.id); applyProfile(c, b.profile || {}); return { client: safe(c) }; },
    resetInvite: function (b) {
      var c = findClient(b.id);
      var db = load();
      Object.keys(db.codes).forEach(function (k) { if (db.codes[k] === c.id) delete db.codes[k]; });
      var code = 'demo-' + uid('') + uid('');
      db.codes[code] = c.id;
      return { inviteCode: code };
    },
    deleteClient: function (b) {
      var db = load();
      Object.keys(db.codes).forEach(function (k) { if (db.codes[k] === b.id) delete db.codes[k]; });
      delete db.clients[b.id]; delete db.days[b.id]; delete db.msgs[b.id];
      return { ok: true };
    },
    sendMessage: function (b) { return { message: addMessage(findClient(b.id), 'coach', b.text, b.meta) }; },
    markRead: function (b) { touch(findClient(b.id), 'coachReadAt'); return { ok: true }; },
    updateMeal: function (b) {
      var d = getDay(b.id, b.date);
      var m = d.meals.filter(function (x) { return x.id === b.mealId; })[0];
      if (!m) throw new Err(404, '食事の記録が見つかりません。');
      var pt = b.patch || {};
      if (pt.items) { m.items = cleanItems(pt.items); m.totals = totalsOf(m.items); }
      if (pt.dish) m.dish = String(pt.dish).slice(0, 60);
      if (['朝食', '昼食', '夕食', '間食'].indexOf(pt.type) !== -1) m.type = pt.type;
      return { day: d };
    },
    draftReply: function (b) { return mockDraft(findClient(b.id)); },
    templates: function () { return { templates: load().templates }; },
    saveTemplate: function (b) {
      var t = b.template || {};
      if (!t.title || !t.text) throw new Err(400, 'タイトルと本文を入力してください。');
      var db = load();
      var id = t.id && db.templates.some(function (x) { return x.id === t.id; }) ? t.id : uid('u');
      var item = { id: id, title: String(t.title).slice(0, 60), text: String(t.text).slice(0, 2000), cat: 'mine', updatedAt: new Date().toISOString() };
      db.templates = [item].concat(db.templates.filter(function (x) { return x.id !== id; }));
      return { template: item };
    },
    deleteTemplate: function (b) { var db = load(); db.templates = db.templates.filter(function (x) { return x.id !== b.id; }); return { ok: true }; }
  };

  var clientActions = {
    me: function (b, c) {
      var t = today();
      var ms = msgs(c.id, 100);
      return { today: t, client: safe(c, true), days: daysOf(c.id, addDays(t, -13), t), messages: ms, unread: unreadFor('client', c, ms), ai: true, mock: true };
    },
    addMeal: function (b, c) {
      var m = b.meal || {};
      var items = cleanItems(m.items);
      if (!items.length) throw new Err(400, '料理を1つ以上入力してください。');
      var meal = { id: uid('m'), time: m.time || '', type: m.type || '間食', dish: String(m.dish || items[0].name || '食事').slice(0, 60), items: items, totals: totalsOf(items), confidence: m.confidence || null,
        good: (m.good || []).slice(0, 5), cautions: (m.cautions || []).slice(0, 5), tags: (m.tags || []).slice(0, 6), memo: String(m.memo || '').slice(0, 300), thumb: m.thumb || null, demo: !!m.demo, createdAt: new Date().toISOString() };
      var d = getDay(c.id, m.date || today());
      d.meals.push(meal);
      touch(c, 'lastActivityAt');
      return { meal: meal, day: d };
    },
    updateMeal: function (b, c) { return coachActions.updateMeal({ id: c.id, date: b.date, mealId: b.mealId, patch: b.patch }); },
    deleteMeal: function (b, c) { var d = getDay(c.id, b.date); d.meals = d.meals.filter(function (x) { return x.id !== b.mealId; }); return { day: d }; },
    setBody: function (b, c) {
      var d = getDay(c.id, b.date || today());
      var i = b.body || {};
      var w = parseFloat(i.weight);
      if (!isNaN(w) && w >= 20 && w <= 300) { d.body.weight = round1(w); if (d.date === today()) c.weight = String(round1(w)); } else if (i.weight === '') delete d.body.weight;
      var s = parseFloat(i.sleep);
      if (!isNaN(s)) d.body.sleep = s; else if (i.sleep === '') delete d.body.sleep;
      if (i.mood) d.body.mood = i.mood; else delete d.body.mood;
      if (i.memo !== undefined) d.body.memo = String(i.memo).slice(0, 300);
      touch(c, 'lastActivityAt');
      return { day: d, client: safe(c, true) };
    },
    sendMessage: function (b, c) { return { message: addMessage(c, 'client', b.text) }; },
    markRead: function (b, c) { touch(c, 'clientReadAt'); return { ok: true }; },
    analyze: function (b) { return mockAnalyze(b.mealType); },
    advice: function () { return mockAdvice(); }
  };

  function handle(path, body, auth) {
    if (path === 'health') return { status: 200, data: { ai: true, mock: true, model: 'お試し版', store: 'demo', coachPassword: true, sessionSecret: true } };
    try {
      var data;
      if (path === 'coach') {
        var fn = coachActions[body.action];
        if (!fn) throw new Err(400, '不明な操作です。');
        if (body.action !== 'login' && auth !== COACH_TOKEN) throw new Err(401, 'ログインしてください。');
        data = fn(body);
      } else {
        var cid = load().codes[auth];
        var c = cid && load().clients[cid];
        if (!c) throw new Err(401, '招待リンクが無効です。お試し版のトップから開き直してください。');
        var f = clientActions[body.action];
        if (!f) throw new Err(400, '不明な操作です。');
        data = f(body, c);
      }
      persist();
      return { status: 200, data: data };
    } catch (e) {
      if (e instanceof Err) return { status: e.status, data: { error: e.message } };
      console.error(e);
      return { status: 500, data: { error: 'お試し版でエラーが起きました。' } };
    }
  }

  // ------------------------------------------------------------------
  // fetch を受け取る
  // ------------------------------------------------------------------
  var realFetch = window.fetch ? window.fetch.bind(window) : null;
  window.fetch = function (input, init) {
    var url = typeof input === 'string' ? input : input.url;
    var m = /(?:^|\/)api\/(coach|client|health)(?:$|\?)/.exec(url);
    if (!m) return realFetch(input, init);
    var body = {};
    try { body = init && init.body ? JSON.parse(init.body) : {}; } catch (e) { body = {}; }
    var h = (init && init.headers) || {};
    var auth = String(h.Authorization || h.authorization || '').replace(/^Bearer\s+/, '');
    var r = handle(m[1], body, auth);
    var wait = body.action === 'analyze' ? 1200 : body.action === 'draftReply' ? 900 : 120;
    return new Promise(function (resolve) {
      setTimeout(function () {
        resolve(new Response(JSON.stringify(r.data), { status: r.status, headers: { 'Content-Type': 'application/json' } }));
      }, wait);
    });
  };

  // お試し版の目印（画面の上に小さく表示）
  document.addEventListener('DOMContentLoaded', function () {
    if (document.body.hasAttribute('data-demo-landing')) return;
    var bar = document.createElement('a');
    bar.href = 'index.html';
    bar.className = 'demo-switch';
    bar.textContent = '🧪 お試し版 ・ 切り替え';
    bar.setAttribute('style', 'display:block;width:fit-content;margin:calc(env(safe-area-inset-top) + 8px) auto 0;background:#3b2f4a;color:#fff;font-size:13px;padding:6px 14px;border-radius:999px;text-decoration:none');
    document.body.insertBefore(bar, document.body.firstChild);
  });

  window.DemoBackend = { reset: reset, CODES: CODES, COACH_TOKEN: COACH_TOKEN, load: load };
})();
