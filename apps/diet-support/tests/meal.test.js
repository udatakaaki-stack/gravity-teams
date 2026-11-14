'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// 画面側の計算（ブラウザ用のファイルをそのまま読み込む）
const ctx = { globalThis: {} };
ctx.window = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../meal-ai/public/js/calc.js'), 'utf8'), ctx);
const M = ctx.MealCalc;

const profile = { name: 'はなこ', sex: 'female', age: 40, height: 160, weight: 60, goalWeight: 55, activity: 'light', pace: 'standard' };

test('目標：基礎代謝（Mifflin-St Jeor）×活動量から計算し、PFCと塩分の目安を出す', () => {
  // 女性：10×60 + 6.25×160 − 5×40 − 161 = 1239
  assert.strictEqual(M.bmr(profile), 1239);
  const t = M.targets(profile);
  assert.strictEqual(t.tdee, Math.round(1239 * 1.375));
  assert.strictEqual(t.kcal, Math.max(Math.round((t.tdee - 500) / 10) * 10, Math.ceil(1239 / 10) * 10));
  assert.strictEqual(t.protein_g, Math.round(t.kcal * 0.2 / 4));
  assert.strictEqual(t.fat_g, Math.round(t.kcal * 0.25 / 9));
  assert.strictEqual(t.carbs_g, Math.round(t.kcal * 0.55 / 4));
  assert.strictEqual(t.salt_g, 6.5);
  assert.strictEqual(M.targets({ ...profile, sex: 'male' }).salt_g, 7.5);
  assert.strictEqual(M.targets({ height: 160 }), null);
});

test('目標：基礎代謝を下回る目標、低体重、目標体重が今以上の場合', () => {
  const low = M.targets({ ...profile, activity: 'low', pace: 'standard' });
  // 基礎代謝を下回る場合は、基礎代謝（10kcal単位で切り上げ）に合わせる
  assert.strictEqual(low.kcal, Math.ceil(low.bmr / 10) * 10);
  assert.ok(low.warnings.some(w => w.includes('基礎代謝')));
  assert.ok(M.targets({ ...profile, weight: 45, goalWeight: 42 }).warnings.some(w => w.includes('BMI')));
  const keep = M.targets({ ...profile, goalWeight: 62 });
  assert.ok(keep.deficit < 10);
  assert.ok(!keep.warnings.length);
});

test('集計：一品ずつの値から合計し、日付と食事の順に並べる', () => {
  const items = [{ kcal: 240, protein_g: 4.5, fat_g: 0.8, carbs_g: 53, salt_g: 0 }, { kcal: 300.4, protein_g: 19, fat_g: 20, carbs_g: 8, salt_g: 1.85 }];
  const t = M.totalsFromItems(items);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(t)), { kcal: 540, protein_g: 23.5, fat_g: 20.8, carbs_g: 61, salt_g: 1.9 });
  const meals = [
    { date: '2026-11-12', type: '夕食', time: '19:00', totals: { kcal: 500 } },
    { date: '2026-11-12', type: '朝食', time: '07:00', totals: { kcal: 400 } },
    { date: '2026-11-11', type: '昼食', time: '12:00', totals: { kcal: 700 } }
  ];
  const day = M.dayMeals(meals, '2026-11-12');
  assert.deepStrictEqual(day.map(m => m.type), ['朝食', '夕食']);
  assert.strictEqual(M.sumTotals(day).kcal, 900);
});

test('連続記録：今日または昨日からさかのぼって数える', () => {
  const meals = ['2026-11-09', '2026-11-10', '2026-11-11'].map(date => ({ date }));
  assert.strictEqual(M.streak(meals, '2026-11-11'), 3);
  assert.strictEqual(M.streak(meals, '2026-11-12'), 3);
  assert.strictEqual(M.streak(meals, '2026-11-13'), 0);
});

test('判定：目標との差と、まだ食べていない食事に合わせて言葉を変える', () => {
  const tg = M.targets(profile);
  const over = M.verdict({ kcal: tg.kcal + 293 }, tg, ['夕食']);
  assert.strictEqual(over.level, 'over');
  assert.ok(over.title.includes('+293'));
  assert.ok(over.body.includes('夕食'));
  const ok = M.verdict({ kcal: tg.kcal - 400 }, tg, ['夕食']);
  assert.ok(ok.title.includes('400'));
  assert.strictEqual(M.verdict({ kcal: 300 }, tg, []).level, 'low');
  assert.strictEqual(M.verdict({ kcal: 0 }, tg, []).level, 'none');
  const late = new Date(2026, 10, 12, 18, 0);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(M.remainingMeals([{ date: '2026-11-12', type: '昼食' }], '2026-11-12', late))), ['夕食']);
});

test('1食の注意：脂質・塩分・エネルギーが1日の目安の半分以上', () => {
  const tg = M.targets(profile);
  const w = M.mealWarnings({ kcal: 1483, fat_g: 79, salt_g: 7.9 }, tg);
  assert.strictEqual(w.length, 3);
  assert.strictEqual(M.mealWarnings({ kcal: 400, fat_g: 10, salt_g: 1 }, tg).length, 0);
});

test('計算によるアドバイス：AIが使えない時も文章ができる', () => {
  const tg = M.targets(profile);
  const a = M.ruleAdvice({ kcal: tg.kcal + 300, protein_g: 20, fat_g: tg.fat_g + 10, carbs_g: 200, salt_g: 9 }, tg, []);
  assert.ok(a.tips.length >= 3 && a.tips.length <= 4);
  assert.ok(a.tips.some(t => t.kind === 'salt'));
});

test('食事の種類を時刻から推測する', () => {
  assert.strictEqual(M.guessMealType(new Date(2026, 0, 1, 7)), '朝食');
  assert.strictEqual(M.guessMealType(new Date(2026, 0, 1, 12)), '昼食');
  assert.strictEqual(M.guessMealType(new Date(2026, 0, 1, 16)), '間食');
  assert.strictEqual(M.guessMealType(new Date(2026, 0, 1, 19)), '夕食');
});

// ---------------- サーバー側（Vercel の関数） ----------------

function checkStrictSchema(schema, where) {
  if (schema.type === 'object') {
    assert.strictEqual(schema.additionalProperties, false, where + ' に additionalProperties: false がありません');
    assert.deepStrictEqual([...schema.required].sort(), Object.keys(schema.properties).sort(), where + ' の required がすべての項目を含んでいません');
    for (const [k, v] of Object.entries(schema.properties)) checkStrictSchema(v, where + '.' + k);
  }
  if (schema.type === 'array') checkStrictSchema(schema.items, where + '[]');
  for (const bad of ['minimum', 'maximum', 'minLength', 'maxLength']) assert.ok(!(bad in schema), where + ' に未対応の ' + bad);
}

test('JSONスキーマ：構造化出力の条件（additionalProperties: false、required）を満たす', async () => {
  const a = await import('../meal-ai/api/analyze.js');
  const b = await import('../meal-ai/api/advice.js');
  checkStrictSchema(a.SCHEMA, 'analyze');
  checkStrictSchema(b.SCHEMA, 'advice');
});

test('合計はサーバー側で一品ずつ足して計算し、負の値や小数を整える', async () => {
  const { withTotals } = await import('../meal-ai/api/analyze.js');
  const r = withTotals({ items: [{ name: 'A', portion: '', kcal: 100.6, protein_g: 3.14, fat_g: -1, carbs_g: 10, salt_g: 0.55 }, { name: 'B', portion: '', kcal: 50, protein_g: 1, fat_g: 2, carbs_g: 5, salt_g: 0.5 }] });
  assert.deepStrictEqual(r.totals, { kcal: 151, protein_g: 4.1, fat_g: 2, carbs_g: 15, salt_g: 1.1 });
  assert.strictEqual(r.items[0].fat_g, 0);
});

function fakeReqRes(method, body, headers) {
  const req = { method, body, headers: headers || {} };
  const res = { statusCode: 0, headers: {}, body: '', setHeader(k, v) { this.headers[k] = v; }, end(b) { this.body = b; } };
  return { req, res };
}

test('APIの関数：キー未設定・合言葉違い・デモモードの動き', async () => {
  const { default: analyze } = await import('../meal-ai/api/analyze.js');
  const { default: advice } = await import('../meal-ai/api/advice.js');
  const saved = { key: process.env.ANTHROPIC_API_KEY, token: process.env.ANTHROPIC_AUTH_TOKEN, mock: process.env.MEAL_AI_MOCK, pass: process.env.APP_PASSCODE };
  try {
    delete process.env.ANTHROPIC_API_KEY; delete process.env.ANTHROPIC_AUTH_TOKEN; delete process.env.MEAL_AI_MOCK; delete process.env.APP_PASSCODE;
    let x = fakeReqRes('POST', { image: 'abc' });
    await analyze(x.req, x.res);
    assert.strictEqual(x.res.statusCode, 503);
    assert.ok(JSON.parse(x.res.body).error.includes('ANTHROPIC_API_KEY'));

    x = fakeReqRes('GET', {});
    await analyze(x.req, x.res);
    assert.strictEqual(x.res.statusCode, 405);

    process.env.APP_PASSCODE = 'secret';
    process.env.MEAL_AI_MOCK = '1';
    x = fakeReqRes('POST', { mealType: '昼食' }, { 'x-app-passcode': 'wrong' });
    await analyze(x.req, x.res);
    assert.strictEqual(x.res.statusCode, 401);

    x = fakeReqRes('POST', { mealType: '昼食' }, { 'x-app-passcode': 'secret' });
    await analyze(x.req, x.res);
    assert.strictEqual(x.res.statusCode, 200);
    const data = JSON.parse(x.res.body);
    assert.ok(data.demo && data.items.length && data.totals.kcal > 0);
    assert.strictEqual(data.totals.kcal, data.items.reduce((a, i) => a + i.kcal, 0));

    x = fakeReqRes('POST', {}, { 'x-app-passcode': 'secret' });
    await advice(x.req, x.res);
    assert.strictEqual(x.res.statusCode, 200);
    assert.ok(JSON.parse(x.res.body).tips.length >= 3);
  } finally {
    for (const [k, v] of [['ANTHROPIC_API_KEY', saved.key], ['ANTHROPIC_AUTH_TOKEN', saved.token], ['MEAL_AI_MOCK', saved.mock], ['APP_PASSCODE', saved.pass]]) {
      if (v === undefined) delete process.env[k]; else process.env[k] = v;
    }
  }
});
