'use strict';
const test = require('node:test');
const assert = require('node:assert');
const F = require('../js/features.js');
const D = require('../js/data.js');

const base = {
  id: 'f1', name: '山田', honorific: 'さん', tone: 'gentle', startDate: '2026-10-20', totalDays: 90,
  startWeight: 62, goalWeight: 56, height: 160, age: 35, coach: 'トレーナー 佐藤', concerns: [], logs: []
};
const noVar = t => assert.ok(!/\{\w+\}|undefined|NaN|null/.test(t), t);

test('安全：メモの体調不良・つらい言葉を「すぐ確認」で知らせる', () => {
  const c = { ...base, logs: [{ date: '2026-11-04', weight: 61, memo: '朝めまいがした' }] };
  const a = F.safetyAlerts(c, '2026-11-05');
  assert.ok(a.some(x => x.id === 'symptom' && x.level === 'urgent'));
  const c2 = { ...base, logs: [{ date: '2026-11-04', memo: 'もう消えたい' }] };
  assert.ok(F.safetyAlerts(c2, '2026-11-05').some(x => x.id === 'crisis' && x.level === 'urgent'));
  // 14日より前のメモは対象外
  const c3 = { ...base, logs: [{ date: '2026-10-01', memo: 'めまい' }] };
  assert.ok(!F.safetyAlerts(c3, '2026-11-05').some(x => x.id === 'symptom'));
});

test('安全：減るペースが速い・睡眠不足・気分の落ち込み・低体重を知らせる', () => {
  const fast = { ...base, logs: [{ date: '2026-10-28', weight: 62 }, { date: '2026-11-04', weight: 60.5 }] };
  assert.ok(F.safetyAlerts(fast, '2026-11-05').some(x => x.id === 'fastLoss'));
  const slow = { ...base, logs: [{ date: '2026-10-28', weight: 62 }, { date: '2026-11-04', weight: 61.5 }] };
  assert.ok(!F.safetyAlerts(slow, '2026-11-05').some(x => x.id === 'fastLoss'));
  const sleep = { ...base, logs: ['11-01', '11-02', '11-03'].map(d => ({ date: '2026-' + d, sleep: 4 })) };
  assert.ok(F.safetyAlerts(sleep, '2026-11-05').some(x => x.id === 'sleep'));
  const mood = { ...base, logs: ['11-01', '11-02', '11-03'].map(d => ({ date: '2026-' + d, mood: 'down' })) };
  assert.ok(F.safetyAlerts(mood, '2026-11-05').some(x => x.id === 'mood'));
  const low = { ...base, logs: [{ date: '2026-11-04', weight: 46 }] };
  assert.ok(F.safetyAlerts(low, '2026-11-05').some(x => x.id === 'lowBmi'));
  assert.deepStrictEqual(F.safetyAlerts({ ...base }, '2026-11-05'), []);
});

test('安全：持病・妊娠の申告で「確認」を出す。「なし」は対象外', () => {
  assert.ok(F.safetyAlerts({ ...base, counseling: { medical: '高血圧の薬を飲んでいます' } }).some(x => x.id === 'medical'));
  assert.ok(F.safetyAlerts({ ...base, counseling: { pregnant: 'yes' } }).some(x => x.id === 'medical'));
  assert.ok(!F.safetyAlerts({ ...base, counseling: { medical: 'なし' } }).some(x => x.id === 'medical'));
});

test('返信アシスト：気持ちと話題を読み取る', () => {
  const a = F.analyzeReply('昨日は飲み会で食べすぎてしまって自己嫌悪です。体重も増えた');
  assert.deepStrictEqual(a.moods, ['guilty']);
  assert.ok(a.topics.includes('overeat') && a.topics.includes('party') && a.topics.includes('weightUp'));
  const b = F.analyzeReply('今週は運動できなかったです');
  assert.ok(b.topics.includes('exerciseSkip') && !b.topics.includes('exerciseDone'));
  assert.ok(!b.moods.includes('good'));
  assert.ok(F.analyzeReply('3kg減りました！うれしいです').moods.includes('good'));
});

test('返信アシスト：命や体調に関わる内容は、ダイエットの話より優先する', () => {
  const crisis = F.buildReply(base, F.analyzeReply('もう消えたい。食べすぎた'));
  assert.ok(crisis.includes('相談窓口'));
  assert.ok(!crisis.includes('次の食事から'));
  const sym = F.buildReply(base, F.analyzeReply('最近めまいがします'));
  assert.ok(sym.includes('医療機関'));
});

test('返信アシスト：すべての気持ちと話題の組み合わせで文章ができる', () => {
  const moods = F.MOOD_PRIORITY;
  const topics = Object.keys(F.REPLY_TOPICS);
  for (const m of [null, ...moods]) {
    for (const t of topics) {
      const text = F.buildReply({ ...base, logs: [{ date: '2026-11-01', weight: 62 }, { date: '2026-11-04', weight: 61 }] },
        { moods: m ? [m] : [], topics: [t], crisis: [], symptoms: [] });
      noVar(text);
      assert.ok(text.startsWith('山田さん、'));
      assert.ok(text.endsWith('トレーナー 佐藤'));
    }
  }
  const down = F.buildReply({ ...base, logs: [{ date: '2026-11-01', weight: 62 }, { date: '2026-11-04', weight: 61 }] }, F.analyzeReply('1kg減った！'));
  assert.ok(down.includes('スタートから1kg'));
});

test('週の振り返り：記録から変化を計算し、記録がなくても文章ができる', () => {
  const c = { ...base, concerns: ['snack'], logs: [
    { date: '2026-10-28', weight: 61.5, waist: 80 },
    { date: '2026-10-31', weight: 61.2, sleep: 5, steps: 6000, mood: 'good' },
    { date: '2026-11-03', weight: 61.0, sleep: 5.5, steps: 7000, waist: 79 },
    { date: '2026-11-05', weight: 60.8 }
  ] };
  const r = F.weeklyReport(c, '2026-11-05');
  assert.strictEqual(r.stats.recordDays, 3);
  assert.deepStrictEqual(r.stats.weight, { from: 61.5, to: 60.8, diff: -0.7 });
  assert.strictEqual(r.stats.waist.diff, -1);
  assert.strictEqual(r.stats.sleepAvg, 5.3);
  assert.strictEqual(r.stats.stepsAvg, 6500);
  assert.ok(r.text.includes('−0.7kg'));
  assert.ok(r.text.includes('15分早く'));
  noVar(r.text);
  const empty = F.weeklyReport({ ...base }, '2026-11-05');
  assert.strictEqual(empty.stats.recordDays, 0);
  assert.ok(empty.text.includes('週4日以上'));
  noVar(empty.text);
});

test('食事の例：悩みに合わせて選び、3件の提案文を作る', () => {
  const r = F.mealProposal({ ...base, concerns: ['skip', 'alcohol'] });
  assert.strictEqual(r.meals.length, 3);
  assert.ok(r.meals.some(m => m.time === 'breakfast'));
  assert.ok(r.meals.some(m => m.name === '居酒屋'));
  assert.ok(!/kcal|カロリー/.test(r.text));
  noVar(r.text);
  for (const m of F.MEALS) {
    assert.ok(F.MEAL_TIMES[m.time] && F.MEAL_STYLES[m.style], m.name);
  }
});

test('カウンセリング：回答をプロフィールに反映する内容を作る（元のデータは変えない）', () => {
  const c = { ...base, concerns: ['snack'] };
  const r = F.counselingPatch(c, {
    purpose: '結婚式でドレスを着たい', exercise: 'たまにする', places: ['自宅', '屋外'], tonePref: 'genki',
    breakfast: 'ほとんど食べない', alcohol: 'ほぼ毎日', dinnerTime: '21時以降が多い', lifestyle: 'デスクワーク中心'
  });
  assert.strictEqual(r.patch.goalNote, '結婚式でドレスを着たい');
  assert.strictEqual(r.patch.level, 2);
  assert.deepStrictEqual(r.patch.places, ['home', 'outdoor']);
  assert.strictEqual(r.patch.tone, 'genki');
  assert.strictEqual(r.patch.activity, 'low');
  assert.deepStrictEqual(r.patch.concerns, ['snack', 'skip', 'alcohol', 'night']);
  assert.deepStrictEqual(c.concerns, ['snack']);
  assert.deepStrictEqual(F.counselingPatch(c, {}).notes, []);
  const valid = new Set(D.CONCERNS.map(x => x.id));
  r.patch.concerns.forEach(x => assert.ok(valid.has(x), x));
});

test('カウンセリング：質問メッセージとまとめが作れる', () => {
  const msg = F.counselingMessage(base);
  assert.ok(msg.includes('1. このダイエットで'));
  noVar(msg);
  const sum = F.counselingSummary(base, { purpose: 'A', pregnant: 'no', places: ['自宅'] });
  assert.ok(sum.includes('妊娠中・授乳中：いいえ'));
  assert.ok(sum.includes('運動できる場所：自宅'));
  assert.ok(F.counselingSummary(base, {}).includes('まだ回答'));
});

test('返信アシスト：「自分を責めている」と「食べすぎ」が重なっても、同じ言い回しをくり返さない', () => {
  for (let v = 0; v < 10; v++) {
    const t = F.buildReply(base, F.analyzeReply('食べすぎて自己嫌悪です'), { variant: v });
    const n = (t.match(/積み重ねてきたもの|積み重ねがなくなる/g) || []).length;
    assert.ok(n <= 1, t);
  }
});

test('サンプルデータ：停滞期の記録と、カウンセリングの回答がそろっている', () => {
  const E = require('../js/engine.js');
  const c = F.sampleClient('2026-11-06');
  assert.ok(c.logs.length >= 10);
  assert.strictEqual(E.progressState(c, '2026-11-06').state, 'plateau');
  assert.ok(F.weeklyReport(c, '2026-11-06').stats.recordDays >= 3);
  noVar(E.rapportMessage(c, 10).text);
  assert.ok(F.counselingSummary(c, c.counseling).includes('来年の旅行'));
});
