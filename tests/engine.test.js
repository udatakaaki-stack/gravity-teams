'use strict';
const test = require('node:test');
const assert = require('node:assert');
const E = require('../js/engine.js');
const D = require('../js/data.js');

const client = {
  id: 't1', name: '山田', honorific: 'さん', gender: 'female', age: 35, height: 160,
  startWeight: 62, goalWeight: 56, startDate: '2026-11-01', totalDays: 90, tone: 'gentle',
  level: 1, places: ['home'], concerns: ['snack'], activity: 'low', coach: 'トレーナー 佐藤',
  logs: [{ date: '2026-11-01', weight: 62 }, { date: '2026-11-04', weight: 61.4 }]
};

test('1〜365日のすべての期間で、期分化が全日程を隙間なく覆う', () => {
  for (let total = 1; total <= 365; total++) {
    const plan = E.buildPlan(total);
    assert.strictEqual(plan[0].start, 1);
    assert.strictEqual(plan[plan.length - 1].end, total);
    for (let i = 0; i < plan.length; i++) {
      assert.ok(plan[i].days >= 1, `total=${total} の ${plan[i].name} が0日`);
      if (i > 0) assert.strictEqual(plan[i].start, plan[i - 1].end + 1);
    }
  }
});

test('期間は1〜365日に丸められる', () => {
  assert.strictEqual(E.clampDays(0), 1);
  assert.strictEqual(E.clampDays(999), 365);
  assert.strictEqual(E.clampDays('abc'), 90);
});

test('30日以上のプランは5つの期に分かれる', () => {
  assert.deepStrictEqual(E.buildPlan(90).map(p => p.id), ['intro', 'accel', 'adjust', 'finish', 'keep']);
});

test('同じ条件なら同じ文章、言い回し変更で別の文章になる', () => {
  const a = E.generateComment(client, 10);
  const b = E.generateComment(client, 10);
  assert.strictEqual(a, b);
  const variants = new Set([0, 1, 2, 3, 4].map(v => E.generateComment(client, 10, { variant: v })));
  assert.ok(variants.size > 1);
});

test('コメントに名前・署名が入り、未置換の差し込み記号が残らない', () => {
  for (const tone of Object.keys(D.TONES)) {
    for (let d = 1; d <= 90; d++) {
      for (const format of ['line', 'short', 'sns']) {
        const text = E.generateComment({ ...client, tone }, d, { format, emoji: 2 });
        assert.ok(!/\{\w+\}/.test(text), `未置換: tone=${tone} day=${d} ${format}\n${text}`);
        if (format !== 'sns') {
          assert.ok(text.includes('山田さん'));
          assert.ok(text.endsWith('トレーナー 佐藤'));
        }
      }
    }
  }
});

test('SNS形式には名前や体重が入らない', () => {
  for (let d = 1; d <= 30; d++) {
    const text = E.generateComment(client, d, { format: 'sns' });
    assert.ok(!text.includes('山田'));
    assert.ok(!/\d+(\.\d)?kg/.test(text));
  }
});

test('前回の記録との差に応じて声かけが変わる', () => {
  const p = E.progressAt(client, '2026-11-04');
  assert.strictEqual(p.diff, -0.6);
  assert.strictEqual(p.lost, 0.6);
  assert.strictEqual(p.pct, 10);
  const text = E.generateComment(client, 4);
  assert.ok(text.includes('0.6kg'));
  // 7日以上前の記録しかない日は記録なし扱い
  assert.strictEqual(E.progressAt(client, '2026-11-20'), null);
});

test('最初の日と最終日は節目のメッセージになる', () => {
  assert.ok(E.generateComment(client, 1).includes('スタート'));
  assert.ok(E.generateComment(client, 90).includes('90日間'));
});

test('停滞期メッセージはすべての場面で生成できる', () => {
  for (const s of D.PLATEAU_SCENES) {
    const text = E.plateauMessage(client, s.id);
    assert.ok(text.length > 100);
    assert.ok(!/\{\w+\}/.test(text));
    assert.ok(text.includes('山田さん'));
  }
});

test('体の指標の計算（BMI・Mifflin-St Jeor）', () => {
  const m = E.metrics(client);
  assert.strictEqual(m.bmi, 24);
  // 女性: 10*61.4 + 6.25*160 - 5*35 - 161 = 1278
  assert.strictEqual(m.bmr, 1278);
  assert.strictEqual(m.tdee, Math.round(1278 * 1.2));
});

test('急すぎる目標や低すぎる目標には注意が出る', () => {
  const m = E.metrics({ ...client, goalWeight: 45, totalDays: 30, logs: [] });
  assert.ok(m.warnings.length >= 2);
});

test('一括生成は指定範囲の件数を返す', () => {
  const r = E.generateRange(client, 1, 365);
  assert.strictEqual(r.length, 90);
  assert.strictEqual(r[0].date, '2026-11-01');
});

test('Xの文字数換算（全角2・半角1）', () => {
  assert.strictEqual(E.xWeightedLength('abc'), 3);
  assert.strictEqual(E.xWeightedLength('あいう'), 6);
});
