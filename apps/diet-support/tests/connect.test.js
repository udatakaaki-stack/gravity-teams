'use strict';
const test = require('node:test');
const assert = require('node:assert');

function fakeReqRes(body, headers) {
  const req = { method: 'POST', body, headers: headers || {}, socket: { remoteAddress: '1.2.3.4' } };
  const res = { statusCode: 0, headers: {}, body: '', setHeader(k, v) { this.headers[k] = v; }, end(b) { this.body = b; } };
  return { req, res };
}

async function setup() {
  process.env.COACH_PASSWORD = 'correct horse';
  process.env.MEAL_AI_MOCK = '1';
  delete process.env.VERCEL;
  delete process.env.SESSION_SECRET;
  const store = await import('../connect/lib/store.js');
  store.setStore(new store.MemoryStore());
  const coach = (await import('../connect/api/coach.js')).default;
  const client = (await import('../connect/api/client.js')).default;
  async function call(handler, body, token) {
    const x = fakeReqRes(body, token ? { authorization: 'Bearer ' + token } : {});
    await handler(x.req, x.res);
    return { status: x.res.statusCode, data: JSON.parse(x.res.body) };
  }
  return { store, coach, client, call };
}

test('コーチ：パスワードでログインし、トークンがないと操作できない', async () => {
  const { coach, call } = await setup();
  assert.strictEqual((await call(coach, { action: 'overview' })).status, 401);
  assert.strictEqual((await call(coach, { action: 'login', password: 'wrong' })).status, 401);
  const ok = await call(coach, { action: 'login', password: 'correct horse' });
  assert.strictEqual(ok.status, 200);
  assert.ok(ok.data.token);
  assert.strictEqual((await call(coach, { action: 'overview' }, ok.data.token)).status, 200);
  assert.strictEqual((await call(coach, { action: 'overview' }, ok.data.token + 'x')).status, 401);
});

test('コーチ：ログインの失敗が10回続くと、しばらく受け付けない', async () => {
  const { coach, call } = await setup();
  for (let i = 0; i < 10; i++) assert.strictEqual((await call(coach, { action: 'login', password: 'nope' })).status, 401);
  assert.strictEqual((await call(coach, { action: 'login', password: 'correct horse' })).status, 429);
});

test('招待リンク：クライアントを作ると招待コードができ、作り直すと古いコードは使えない', async () => {
  const { coach, client, call } = await setup();
  const token = (await call(coach, { action: 'login', password: 'correct horse' })).data.token;
  const created = await call(coach, { action: 'createClient', profile: { name: 'はなこ', sex: 'female', age: '40', height: '160', weight: '60', coachMemo: '甘いもの好き' } }, token);
  assert.strictEqual(created.status, 200);
  const code = created.data.inviteCode;
  assert.ok(code.length >= 30);
  assert.ok(!('inviteHash' in created.data.client));
  const me = await call(client, { action: 'me' }, code);
  assert.strictEqual(me.status, 200);
  assert.strictEqual(me.data.client.name, 'はなこ');
  assert.ok(!('coachMemo' in me.data.client), 'コーチのメモはクライアントに見せない');
  assert.strictEqual((await call(client, { action: 'me' }, 'x'.repeat(32))).status, 401);
  const reset = await call(coach, { action: 'resetInvite', id: created.data.client.id }, token);
  assert.strictEqual((await call(client, { action: 'me' }, code)).status, 401);
  assert.strictEqual((await call(client, { action: 'me' }, reset.data.inviteCode)).status, 200);
});

test('記録：クライアントの食事と体の記録が、コーチの一覧と詳細に出る', async () => {
  const { coach, client, call } = await setup();
  const token = (await call(coach, { action: 'login', password: 'correct horse' })).data.token;
  const { inviteCode, client: c } = (await call(coach, { action: 'createClient', profile: { name: 'たろう', honorific: 'くん' } }, token)).data;
  const d = new Date();
  const today = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const a = await call(client, { action: 'analyze', image: 'abc', mealType: '昼食' }, inviteCode);
  assert.strictEqual(a.status, 200);
  assert.ok(a.data.demo && a.data.totals.kcal > 0);
  const saved = await call(client, { action: 'addMeal', meal: { date: today, time: '12:30', type: '昼食', dish: a.data.dish_name, items: a.data.items, thumb: 'data:image/jpeg;base64,AAAA', tags: a.data.tags } }, inviteCode);
  assert.strictEqual(saved.status, 200);
  assert.strictEqual(saved.data.meal.totals.kcal, a.data.totals.kcal);
  // 不正なサムネイルは保存しない
  const bad = await call(client, { action: 'addMeal', meal: { date: today, type: '間食', items: [{ name: 'りんご', kcal: 80 }], thumb: 'javascript:alert(1)' } }, inviteCode);
  assert.strictEqual(bad.data.meal.thumb, null);
  await call(client, { action: 'setBody', date: today, body: { weight: '59.8', mood: 'good', sleep: '7' } }, inviteCode);
  const ov = await call(coach, { action: 'overview' }, token);
  const row = ov.data.clients.find((r) => r.client.id === c.id);
  assert.strictEqual(row.days[0].meals.length, 2);
  assert.strictEqual(row.days[0].body.weight, 59.8);
  assert.strictEqual(row.days[0].meals[0].thumb, true, '一覧では写真そのものは送らない');
  const det = await call(coach, { action: 'client', id: c.id }, token);
  assert.ok(String(det.data.days[0].meals[0].thumb).startsWith('data:image/jpeg'));
  // 削除
  await call(client, { action: 'deleteMeal', date: today, mealId: bad.data.meal.id }, inviteCode);
  assert.strictEqual((await call(client, { action: 'me' }, inviteCode)).data.days[0].meals.length, 1);
});

test('メッセージ：やり取りと未読の数、AIの下書き', async () => {
  const { coach, client, call } = await setup();
  const token = (await call(coach, { action: 'login', password: 'correct horse' })).data.token;
  const { inviteCode, client: c } = (await call(coach, { action: 'createClient', profile: { name: 'はなこ' } }, token)).data;
  await new Promise((r) => setTimeout(r, 5));
  await call(client, { action: 'sendMessage', text: '昨日は食べすぎてしまいました' }, inviteCode);
  let ov = await call(coach, { action: 'overview' }, token);
  assert.strictEqual(ov.data.clients.find((r) => r.client.id === c.id).unread, 1);
  await call(coach, { action: 'markRead', id: c.id }, token);
  ov = await call(coach, { action: 'overview' }, token);
  assert.strictEqual(ov.data.clients.find((r) => r.client.id === c.id).unread, 0);
  const draft = await call(coach, { action: 'draftReply', id: c.id }, token);
  assert.strictEqual(draft.status, 200);
  assert.ok(draft.data.message.includes('はなこさん'));
  await new Promise((r) => setTimeout(r, 5));
  await call(coach, { action: 'sendMessage', id: c.id, text: draft.data.message }, token);
  const me = await call(client, { action: 'me' }, inviteCode);
  assert.strictEqual(me.data.messages.length, 2);
  assert.strictEqual(me.data.unread, 1);
  assert.strictEqual((await call(client, { action: 'sendMessage', text: '   ' }, inviteCode)).status, 400);
});

test('気にかけたいこと：体調の言葉、記録の途切れ、気分の落ち込み、体重の増加', async () => {
  const repo = await import('../connect/lib/repo.js');
  const t = '2026-11-12';
  assert.ok(repo.watchList([{ date: t, meals: [], body: { memo: '朝めまいがした' } }], t).some((w) => w.level === 'urgent'));
  assert.ok(repo.watchList([], t).some((w) => w.text.includes('まだ記録')));
  assert.ok(repo.watchList([{ date: '2026-11-08', meals: [{}], body: {} }], t).some((w) => w.text.includes('3日以上')));
  assert.ok(repo.watchList([{ date: t, meals: [], body: { mood: 'down' } }, { date: '2026-11-11', meals: [], body: { mood: 'anxious' } }], t).some((w) => w.text.includes('気持ち')));
  assert.ok(repo.watchList([{ date: t, meals: [], body: { weight: 61 } }, { date: '2026-11-08', meals: [], body: { weight: 59.8 } }], t).some((w) => w.text.includes('1kg')));
  assert.deepStrictEqual(repo.watchList([{ date: t, meals: [{}], body: { weight: 60, mood: 'good' } }], t), []);
});

test('削除：クライアントを消すと、記録・メッセージ・招待コードも消える', async () => {
  const { coach, client, call, store } = await setup();
  const token = (await call(coach, { action: 'login', password: 'correct horse' })).data.token;
  const { inviteCode, client: c } = (await call(coach, { action: 'createClient', profile: { name: 'けすひと' } }, token)).data;
  await call(client, { action: 'sendMessage', text: 'こんにちは' }, inviteCode);
  await call(coach, { action: 'deleteClient', id: c.id }, token);
  assert.strictEqual((await call(client, { action: 'me' }, inviteCode)).status, 401);
  const keys = Object.keys(store.getStore().data).filter((k) => k.includes(c.id));
  assert.deepStrictEqual(keys, []);
});

test('AIの利用回数：1人1日40回まで', async () => {
  const { coach, client, call } = await setup();
  const token = (await call(coach, { action: 'login', password: 'correct horse' })).data.token;
  const { inviteCode } = (await call(coach, { action: 'createClient', profile: { name: 'いっぱい' } }, token)).data;
  for (let i = 0; i < 40; i++) assert.strictEqual((await call(client, { action: 'advice', input: {} }, inviteCode)).status, 200);
  assert.strictEqual((await call(client, { action: 'advice', input: {} }, inviteCode)).status, 429);
});

test('本番：Vercel で SESSION_SECRET や保存先が未設定なら、はっきり断る', async () => {
  const { coach, store, call } = await setup();
  process.env.VERCEL = '1';
  try {
    assert.strictEqual(store.storeKind(), 'none');
    const r = await call(coach, { action: 'login', password: 'correct horse' });
    assert.strictEqual(r.status, 503);
    assert.ok(r.data.error.includes('SESSION_SECRET'));
  } finally { delete process.env.VERCEL; }
});

test('Upstash の保存先：Redis のコマンドを正しい形で送る', async () => {
  const { UpstashStore } = await import('../connect/lib/store.js');
  const sent = [];
  const kv = {};
  const fakeFetch = async (url, opts) => {
    const args = JSON.parse(opts.body);
    sent.push({ url, auth: opts.headers.Authorization, args });
    const [cmd, key, ...rest] = args;
    let result = null;
    if (cmd === 'SET') { kv[key] = rest[0]; result = 'OK'; }
    if (cmd === 'GET') result = kv[key] === undefined ? null : kv[key];
    if (cmd === 'INCR') { kv[key] = String((Number(kv[key]) || 0) + 1); result = Number(kv[key]); }
    if (cmd === 'EXPIRE') result = 1;
    return { ok: true, json: async () => ({ result }) };
  };
  const s = new UpstashStore('https://example.upstash.io/', 'tok', fakeFetch);
  await s.set('a', { x: 1 }, 60);
  assert.deepStrictEqual(await s.get('a'), { x: 1 });
  assert.strictEqual(await s.get('none'), null);
  assert.strictEqual(await s.incr('n', 900), 1);
  assert.deepStrictEqual(sent[0].args, ['SET', 'a', '{"x":1}', 'EX', '60']);
  assert.strictEqual(sent[0].url, 'https://example.upstash.io');
  assert.strictEqual(sent[0].auth, 'Bearer tok');
  assert.deepStrictEqual(sent[sent.length - 1].args, ['EXPIRE', 'n', '900']);
});

test('JSONスキーマ：構造化出力の条件を満たす', async () => {
  const ai = await import('../connect/lib/ai.js');
  function check(s, where) {
    if (s.type === 'object') {
      assert.strictEqual(s.additionalProperties, false, where);
      assert.deepStrictEqual([...s.required].sort(), Object.keys(s.properties).sort(), where);
      for (const [k, v] of Object.entries(s.properties)) check(v, where + '.' + k);
    }
    if (s.type === 'array') check(s.items, where + '[]');
  }
  check(ai.ANALYZE_SCHEMA, 'analyze');
  check(ai.ADVICE_SCHEMA, 'advice');
  check(ai.DRAFT_SCHEMA, 'draft');
});

// ---------------- ダイエットサポート版との連携 ----------------
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadBrowser(files) {
  const ctx = { globalThis: {} };
  ctx.window = ctx;
  vm.createContext(ctx);
  for (const f of files) vm.runInContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), ctx);
  return ctx;
}

test('連携：connect に入れたダイエットサポート版のファイルが、元のファイルと同じ', () => {
  for (const f of ['data.js', 'engine.js']) {
    const a = fs.readFileSync(path.join(__dirname, '../js', f), 'utf8');
    const b = fs.readFileSync(path.join(__dirname, '../connect/public/js/diet', f), 'utf8');
    assert.strictEqual(a, b, f + ' が元のファイルと違います。js/' + f + ' を connect/public/js/diet/ にコピーし直してください');
  }
});

const ctx = loadBrowser(['connect/public/js/diet/data.js', 'connect/public/js/diet/engine.js', 'connect/public/js/bridge.js']);
const DD = ctx.DIET_DATA, DE = ctx.DietEngine, BR = ctx.DietBridge;
const noVars = (t) => assert.ok(!/\{\w+\}|undefined|NaN|null/.test(t), t);

const cClient = { id: 'c1', name: 'はなこ', honorific: 'さん', sex: 'female', age: '40', height: '160', weight: '60.9', startWeight: '62', goalWeight: '56',
  startDate: '2026-10-20', totalDays: '90', tone: 'gentle', concerns: ['snack', 'night'], goalNote: '旅行で好きな服を着たい', createdAt: '2026-10-20T00:00:00Z' };
const cDays = [
  { date: '2026-11-12', meals: [], body: { weight: 60.9, mood: 'anxious', memo: '体重が減らない' } },
  { date: '2026-11-05', meals: [], body: { weight: 60.7 } },
  { date: '2026-10-31', meals: [], body: { weight: 60.8, sleep: 6 } },
  { date: '2026-10-28', meals: [], body: { weight: 60.9 } },
  { date: '2026-10-20', meals: [], body: {} }
];

test('連携：つなぐ版の記録を、ダイエットサポート版の形に変換する', () => {
  const dc = BR.toDietClient(cClient, cDays, { sign: 'トレーナー 佐藤' });
  assert.strictEqual(dc.gender, 'female');
  assert.strictEqual(dc.startWeight, '62');
  assert.deepStrictEqual(JSON.parse(JSON.stringify(dc.logs.map((l) => l.date))), ['2026-10-28', '2026-10-31', '2026-11-05', '2026-11-12']);
  assert.strictEqual(dc.mood, 'anxious', '最新の記録の気分を使う');
  assert.strictEqual(dc.coach, 'トレーナー 佐藤');
  // 開始体重がなければ今の体重、開始日がなければ登録日
  const dc2 = BR.toDietClient({ id: 'x', name: 'A', weight: '58', createdAt: '2026-11-01T09:00:00Z' }, []);
  assert.strictEqual(dc2.startWeight, '58');
  assert.strictEqual(dc2.startDate, '2026-11-01');
  // 体重が2週間ほど横ばい → 停滞期と判断される
  assert.strictEqual(DE.progressState(dc, '2026-11-12').state, 'plateau');
});

test('連携：定型コメント・今日のコメント・ラポール21日・停滞期サポートがすべて作れる', () => {
  const dc = BR.toDietClient(cClient, cDays, { sign: 'トレーナー 佐藤' });
  for (const t of DD.TEMPLATES) {
    const text = DE.fillTemplate(dc, t.text, { day: 24 });
    assert.ok(!/\{\w+\}/.test(text), t.id);
    assert.ok(text.includes('はなこさん'), t.id);
  }
  for (const format of ['line', 'short']) {
    const text = DE.generateComment(dc, 24, { format, emoji: 1 });
    noVars(text);
    assert.ok(text.startsWith('はなこさん') && text.endsWith('トレーナー 佐藤'));
  }
  for (let d = 1; d <= 21; d++) {
    for (const mood of DD.MOODS.map((m) => m.id)) {
      const r = DE.rapportMessage(dc, d, { format: 'line', emoji: 1, mood });
      noVars(r.text);
    }
  }
  // 記録の「不安」と「停滞」に寄り添う言葉が入る
  const r15 = DE.rapportMessage(dc, 15, { format: 'line', emoji: 1, mood: dc.mood }).text;
  assert.ok(r15.includes('旅行で好きな服を着たい'));
  assert.ok(r15.includes('今のはなこさんへ'));
  for (const s of DD.PLATEAU_SCENES) noVars(DE.plateauMessage(dc, s.id, { emoji: 1 }));
});

test('連携：送信済みのラポールの日と、次に送る日', () => {
  const msgs = [
    { from: 'coach', at: '1', meta: { kind: 'rapport', day: 1 } },
    { from: 'coach', at: '2', meta: { kind: 'rapport', day: 2 } },
    { from: 'coach', at: '3', meta: { kind: 'template', label: 'x' } },
    { from: 'client', at: '4', meta: { kind: 'rapport', day: 3 } }
  ];
  assert.deepStrictEqual(Object.keys(BR.sentRapportDays(msgs)).map(Number), [1, 2]);
  assert.strictEqual(BR.nextRapportDay(msgs), 3);
  const all = Array.from({ length: 21 }, (_, i) => ({ from: 'coach', at: String(i), meta: { kind: 'rapport', day: i + 1 } }));
  assert.strictEqual(BR.nextRapportDay(all), null);
});

test('連携（サーバー）：メッセージの種類の記録、プロフィールの新しい項目、コーチの定型文', async () => {
  const { coach, client, call } = await setup();
  const token = (await call(coach, { action: 'login', password: 'correct horse' })).data.token;
  const { inviteCode, client: c } = (await call(coach, { action: 'createClient', profile: { name: 'はなこ', startDate: '2026-10-20', totalDays: '90', startWeight: '62', tone: 'genki', concerns: ['snack', 'night', 'x'.repeat(50)] } }, token)).data;
  assert.deepStrictEqual(c.concerns, ['snack', 'night', 'x'.repeat(20)]);
  assert.strictEqual(c.tone, 'genki');
  assert.strictEqual(c.startWeight, '62');
  const sent = await call(coach, { action: 'sendMessage', id: c.id, text: 'ラポール1日目', meta: { kind: 'rapport', day: 1, label: 'ラポール21日：1日目' } }, token);
  assert.deepStrictEqual(sent.data.message.meta, { kind: 'rapport', label: 'ラポール21日：1日目', day: 1 });
  const bad = await call(coach, { action: 'sendMessage', id: c.id, text: 'x', meta: { kind: 'hack', day: 99 } }, token);
  assert.ok(!bad.data.message.meta);
  // クライアントのメッセージには種類を付けない
  const cm = await call(client, { action: 'sendMessage', text: 'はい', meta: { kind: 'rapport', day: 2 } }, inviteCode);
  assert.ok(!cm.data.message.meta);
  // 定型文
  const t1 = await call(coach, { action: 'saveTemplate', template: { title: '朝のお礼', text: '{name}、おはようございます' } }, token);
  assert.strictEqual(t1.status, 200);
  assert.strictEqual((await call(coach, { action: 'saveTemplate', template: { title: '', text: 'x' } }, token)).status, 400);
  let list = (await call(coach, { action: 'templates' }, token)).data.templates;
  assert.strictEqual(list.length, 1);
  await call(coach, { action: 'saveTemplate', template: { id: t1.data.template.id, title: '朝のお礼（改）', text: '{name}、おはよう' } }, token);
  list = (await call(coach, { action: 'templates' }, token)).data.templates;
  assert.strictEqual(list.length, 1);
  assert.strictEqual(list[0].title, '朝のお礼（改）');
  await call(coach, { action: 'deleteTemplate', id: t1.data.template.id }, token);
  assert.strictEqual((await call(coach, { action: 'templates' }, token)).data.templates.length, 0);
  // クライアントからは定型文を操作できない
  assert.strictEqual((await call(client, { action: 'templates' }, inviteCode)).status, 400);
});
