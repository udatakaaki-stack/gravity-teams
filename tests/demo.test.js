// お試し版（connect/demo）のテスト
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');

const dir = path.join(__dirname, '..', 'connect');

function boot() {
  const mem = {};
  const win = {
    localStorage: { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: (k) => { delete mem[k]; } },
    fetch: () => Promise.reject(new Error('本物の通信はしない'))
  };
  const ctx = { window: win, document: { addEventListener() {} }, localStorage: win.localStorage, Response, Date, Math, JSON, console, setTimeout, Promise, encodeURIComponent };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(dir, 'demo-src', 'demo-backend.js'), 'utf8'), ctx);
  const call = (p, body, token) => win.fetch('api/' + p, { method: 'POST', headers: token ? { Authorization: 'Bearer ' + token } : {}, body: JSON.stringify(body) }).then(async (r) => ({ status: r.status, data: await r.json() }));
  return { win, call };
}

test('お試し版を作ると、3つの画面に demo-backend.js が最初に読み込まれる', () => {
  execFileSync(process.execPath, [path.join(dir, 'scripts', 'build-demo.mjs')], { cwd: dir });
  for (const f of ['index.html', 'app.html', 'coach.html']) {
    const html = fs.readFileSync(path.join(dir, 'demo', f), 'utf8');
    const i = html.indexOf('js/demo-backend.js');
    assert.ok(i > 0, f);
    const firstOther = html.search(/<script src="js\/(?!demo-backend)/);
    assert.ok(firstOther === -1 || i < firstOther, f + ' で最初に読み込む');
  }
  assert.ok(!fs.existsSync(path.join(dir, 'demo', 'sw.js')));
  // diet のファイルも一緒に入っている
  assert.ok(fs.existsSync(path.join(dir, 'demo', 'js', 'diet', 'engine.js')));
});

test('サンプルデータ：4人のクライアントと、気にかけたい人の判定', async () => {
  const { win, call } = boot();
  const bad = await call('coach', { action: 'overview' }, 'x');
  assert.strictEqual(bad.status, 401);
  const login = await call('coach', { action: 'login', password: 'demo' });
  assert.strictEqual(login.data.token, win.DemoBackend.COACH_TOKEN);
  const ov = (await call('coach', { action: 'overview' }, login.data.token)).data;
  const by = {};
  ov.clients.forEach((r) => { by[r.client.name] = r; });
  assert.deepStrictEqual(Object.keys(by).sort(), ['けんじ', 'たろう', 'はなこ', 'ゆき'].sort());
  assert.ok(by['ゆき'].watch.some((w) => w.level === 'urgent' && w.text.includes('めまい')));
  assert.ok(by['けんじ'].watch.some((w) => w.text.includes('3日以上')));
  assert.strictEqual(by['はなこ'].unread, 1);
  assert.strictEqual(by['たろう'].watch.length, 0);
  // 今日のメッセージの時刻は、今より前
  const h = (await call('coach', { action: 'client', id: by['はなこ'].client.id }, login.data.token)).data;
  assert.ok(h.messages.every((m) => new Date(m.at).getTime() <= Date.now()));
  const rapportDays = h.messages.filter((m) => m.meta && m.meta.kind === 'rapport').map((m) => m.meta.day);
  assert.deepStrictEqual(rapportDays, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
});

test('コーチが送ったメッセージがクライアントに届き、返信がコーチに届く', async () => {
  const { win, call } = boot();
  const token = win.DemoBackend.COACH_TOKEN;
  const code = win.DemoBackend.CODES.hanako;
  const me0 = (await call('client', { action: 'me' }, code)).data;
  assert.strictEqual(me0.client.coachMemo, undefined, 'コーチのメモは見せない');
  assert.strictEqual(me0.mock, true);
  await call('coach', { action: 'sendMessage', id: me0.client.id, text: 'テストです', meta: { kind: 'rapport', day: 11 } }, token);
  const me1 = (await call('client', { action: 'me' }, code)).data;
  assert.strictEqual(me1.messages[me1.messages.length - 1].text, 'テストです');
  assert.ok(me1.unread >= 1);
  const a = (await call('client', { action: 'analyze', mealType: '夕食' }, code)).data;
  assert.ok(a.demo && a.items.length);
  const added = (await call('client', { action: 'addMeal', meal: { date: me1.today, type: '夕食', items: a.items, dish: a.dish_name } }, code)).data;
  assert.ok(added.meal.totals.kcal > 0);
  await call('client', { action: 'sendMessage', text: 'ありがとうございます' }, code);
  const d = (await call('coach', { action: 'draftReply', id: me0.client.id }, token)).data;
  assert.ok(d.message.startsWith('はなこさん'));
  const bad = await call('client', { action: 'me' }, 'wrong-code-000000000000');
  assert.strictEqual(bad.status, 401);
  // 最初の状態に戻す
  win.DemoBackend.reset();
  const me2 = (await call('client', { action: 'me' }, code)).data;
  assert.ok(!me2.messages.some((m) => m.text === 'テストです'));
});
