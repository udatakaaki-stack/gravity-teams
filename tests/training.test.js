'use strict';
const test = require('node:test');
const assert = require('node:assert');
const E = require('../training/js/t-engine.js');
const D = require('../training/js/t-data.js');
const C = require('../training/js/t-content.js');

const team = { id: 't1', name: '〇〇高校 陸上部', goal: 'competition', startDate: '2026-10-01', totalDays: 90, eventDate: '2026-12-13', trainingDays: [1, 2, 4, 5, 6], places: ['field', 'gym'], coach: 'コーチ 佐藤', level: 2 };
const base = { id: 'm1', name: '田中', honorific: 'さん', teamId: 't1', useTeamPlan: true, level: 2, concerns: [], wellness: [], sessions: [], lifts: [] };
const noVar = t => assert.ok(!/\{\w+\}|undefined|NaN|null/.test(t), t);

test('期分化：すべての目標・1〜365日で、期が全日程を隙間なく覆う', () => {
  for (const goal of Object.keys(D.GOALS)) {
    for (let n = 1; n <= 365; n++) {
      const plan = E.buildPlan({ totalDays: n, goal });
      assert.strictEqual(plan[0].start, 1);
      assert.strictEqual(plan[plan.length - 1].end, n);
      plan.forEach((p, i) => { assert.ok(p.days >= 1); if (i) assert.strictEqual(p.start, plan[i - 1].end + 1); });
    }
  }
});

test('期分化：試合日に試合期が終わり、その後は移行期になる', () => {
  const plan = E.buildPlan({ totalDays: 90, goal: 'competition', startDate: '2026-10-01', eventDate: '2026-12-13' });
  const eventDay = E.diffDays('2026-10-01', '2026-12-13') + 1;
  const peak = plan.find(p => p.id === 'peak');
  assert.strictEqual(peak.end, eventDay);
  assert.strictEqual(plan[plan.length - 1].id, 'transition');
  // 試合日が期間外なら通常の配分
  const plan2 = E.buildPlan({ totalDays: 30, goal: 'competition', startDate: '2026-10-01', eventDate: '2027-05-01' });
  assert.ok(!plan2.some(p => p.id === 'transition'));
});

test('回復週：負荷を上げる期で4週ごと、短い期や準備期にはない', () => {
  const plan = E.buildPlan({ totalDays: 112, goal: 'hypertrophy' });
  const build = plan.find(p => p.id === 'build');
  assert.ok(E.isDeload(plan, build.start + 21));
  assert.ok(!E.isDeload(plan, build.start));
  const prep = plan.find(p => p.id === 'prep');
  for (let d = prep.start; d <= prep.end; d++) assert.ok(!E.isDeload(plan, d));
});

test('推定1RM（Epley式）', () => {
  assert.strictEqual(E.e1rm(100, 1), 100);
  assert.strictEqual(E.e1rm(100, 5), 116.7);
  assert.strictEqual(E.e1rm(60, 10), 80);
  assert.strictEqual(E.e1rm(100, 11), null);
  assert.strictEqual(E.e1rm(0, 5), null);
});

test('自己ベスト：種目ごとの最高値と、直近の更新を見つける', () => {
  const m = { ...base, lifts: [
    { date: '2026-10-10', exercise: 'バックスクワット', weight: 80, reps: 5 },
    { date: '2026-11-03', exercise: 'バックスクワット', weight: 90, reps: 5 },
    { date: '2026-11-04', exercise: 'ベンチプレス', weight: 60, reps: 5 }
  ] };
  assert.strictEqual(E.bestLifts(m)['バックスクワット'].e1rm, 105);
  const prs = E.recentPRs(m, '2026-11-06', 7);
  assert.strictEqual(prs.length, 1);
  assert.strictEqual(prs[0].exercise, 'バックスクワット');
  assert.strictEqual(E.recentPRs(m, '2026-11-20', 7).length, 0);
});

test('練習負荷：セッションRPE、モノトニー、ACWR（21日以上の記録がある時だけ）', () => {
  const sessions = [];
  for (let i = 0; i < 28; i++) sessions.push({ date: E.addDays('2026-10-10', i), minutes: 60, rpe: i >= 21 ? 8 : 5 });
  const lm = E.loadMetrics({ ...base, sessions }, '2026-11-06');
  assert.strictEqual(lm.weekly, 7 * 480);
  // 毎日同じ負荷なのでばらつきがなく、モノトニーは計算しない
  assert.strictEqual(lm.monotony, null);
  assert.strictEqual(lm.acwr, Math.round(3360 / ((21 * 300 + 3360) / 4) * 100) / 100);
  const short = E.loadMetrics({ ...base, sessions: sessions.slice(-7) }, '2026-11-06');
  assert.strictEqual(short.acwr, null);
});

test('注意：痛み・体の異変・疲労・睡眠・負荷の急増を見つける', () => {
  const s = E.planSettings(base, [team]);
  const pain = { ...base, wellness: [{ date: '2026-11-06', pain: '右膝' }] };
  assert.ok(E.alerts(pain, s, '2026-11-06').some(a => a.id === 'pain'));
  const head = { ...base, wellness: [{ date: '2026-11-06', memo: '練習中に頭を打った' }] };
  const h = E.alerts(head, s, '2026-11-06').find(a => a.id === 'urgent');
  assert.ok(h && h.body.includes('脳しんとう'));
  const tired = { ...base, wellness: ['11-02', '11-04', '11-06'].map(d => ({ date: '2026-' + d, fatigue: 5, sleep: 5 })) };
  const ids = E.alerts(tired, s, '2026-11-06').map(a => a.id);
  assert.ok(ids.includes('fatigue') && ids.includes('sleep'));
  assert.deepStrictEqual(E.alerts(base, s, '2026-11-06'), []);
});

test('チームのプラン：メンバーはチームの設定を使い、外すと個人の設定になる', () => {
  const s = E.planSettings(base, [team]);
  assert.strictEqual(s.goal, 'competition');
  assert.strictEqual(s.teamName, '〇〇高校 陸上部');
  assert.strictEqual(s.coach, 'コーチ 佐藤');
  const own = E.planSettings({ ...base, useTeamPlan: false, goal: 'strength', startDate: '2026-11-01', totalDays: 60, coach: '' }, [team]);
  assert.strictEqual(own.goal, 'strength');
  assert.strictEqual(own.coach, 'コーチ 佐藤');
  assert.strictEqual(E.planSettings({ ...base, teamId: '' }, [team]).teamName, '');
});

test('コメント：すべての日・トーン・形式で記号が残らず、痛みがある日は軽めになる', () => {
  for (const tone of Object.keys(D.TONES)) {
    const t = { ...team, tone };
    for (let d = 1; d <= 90; d++) {
      for (const format of ['line', 'short']) {
        const text = E.generateComment(base, [t], d, { format, emoji: 2 });
        noVar(text);
        assert.ok(text.includes('田中さん'));
        assert.ok(text.endsWith('コーチ 佐藤'));
      }
    }
  }
  const day = E.diffDays('2026-10-01', '2026-11-06') + 1;
  const m = { ...base, wellness: [{ date: '2026-11-06', pain: '右ハムストリング' }] };
  const text = E.generateComment(m, [team], day);
  assert.ok(text.includes('右ハムストリング'));
  assert.ok(text.includes('軽めのメニュー'));
});

test('コメント：試合前日・当日と休養日', () => {
  const s = E.planSettings(base, [team]);
  const eventDay = E.diffDays(s.startDate, s.eventDate) + 1;
  assert.ok(E.generateComment(base, [team], eventDay - 1).includes('明日は試合'));
  assert.ok(E.generateComment(base, [team], eventDay).includes('試合当日'));
  // 2026-10-04 は日曜日（練習曜日に含まれない）
  assert.ok(E.generateComment(base, [team], 4).includes('休養日'));
});

test('チームメッセージ：個人の名前や記録が入らない', () => {
  const m = { ...base, wellness: [{ date: '2026-11-06', pain: '右膝', sleep: 5 }] };
  for (let d = 1; d <= 90; d++) {
    const text = E.teamMessage(team, d);
    noVar(text);
    assert.ok(text.startsWith('〇〇高校 陸上部のみなさん'));
    assert.ok(!text.includes('田中') && !text.includes('右膝'));
  }
  void m;
});

test('週の振り返り：記録から回数・睡眠・自己ベストをまとめる', () => {
  const m = { ...base,
    sessions: [{ date: '2026-11-02', minutes: 60, rpe: 6 }, { date: '2026-11-04', minutes: 90, rpe: 7 }, { date: '2026-11-05', minutes: 60, rpe: 5 }],
    wellness: [{ date: '2026-11-03', sleep: 6, fatigue: 3 }, { date: '2026-11-05', sleep: 6.5, fatigue: 4 }],
    lifts: [{ date: '2026-10-20', exercise: 'ベンチプレス', weight: 60, reps: 5 }, { date: '2026-11-04', exercise: 'ベンチプレス', weight: 65, reps: 5 }] };
  const r = E.weeklyReport(m, [team], '2026-11-06');
  assert.strictEqual(r.stats.sessions, 3);
  assert.strictEqual(r.stats.minutes, 210);
  assert.strictEqual(r.stats.sleepAvg, 6.3);
  assert.ok(r.text.includes('ベンチプレス：推定1RM 75.8kg（自己ベスト更新）'));
  assert.ok(r.text.includes('15分早く'));
  noVar(r.text);
  noVar(E.weeklyReport(base, [team], '2026-11-06').text);
});

test('ラポール21日：状態・目標・形式のすべての組み合わせで文章ができる', () => {
  assert.strictEqual(C.RAPPORT_DAYS.length, 21);
  for (const st of C.RAPPORT_STATES.map(s => s.id)) {
    for (const goalNote of ['', 'インターハイ出場']) {
      for (const format of ['line', 'mail']) {
        for (let d = 1; d <= 21; d++) {
          const r = E.rapportMessage({ ...base, goalNote }, [team], d, { state: st, format });
          noVar(r.text + r.subject);
          assert.ok(r.text.includes('今日の言葉'));
        }
      }
    }
  }
  assert.ok(E.rapportMessage({ ...base, goalNote: 'インターハイ出場' }, [team], 15).text.includes('「インターハイ出場」'));
  // 痛みの記録があれば、状態を選ばなくても寄り添う
  const pain = { ...base, wellness: [{ date: E.today(), pain: '右膝' }] };
  assert.ok(E.rapportMessage(pain, [team], 5).text.includes('焦らず治す'));
});

test('定型文と課題サポート：記号が残らない', () => {
  const ids = new Set();
  for (const t of C.TEMPLATES) {
    assert.ok(!ids.has(t.id)); ids.add(t.id);
    assert.ok(C.TEMPLATE_CATEGORIES.some(c => c.id === t.cat), t.id);
    const text = E.fillTemplate(base, [team], t.text);
    assert.ok(!/\{\w+\}/.test(text), t.id);
  }
  for (const s of C.SCENES) {
    const text = E.sceneMessage(base, [team], s.id);
    noVar(text);
    assert.ok(text.includes('田中さん'));
  }
});

test('種目データ：期ごとに選べる種目があり、カテゴリと場所が正しい', () => {
  for (const e of D.EXERCISES) {
    assert.ok(D.EX_CATS[e.cat], e.id);
    e.place.forEach(p => assert.ok(D.PLACES[p], e.id + p));
  }
  for (const ph of Object.keys(D.PHASES)) {
    for (const places of [['gym'], ['home'], ['field']]) {
      const menu = E.chooseMenu(1, places, ph, () => 0.3);
      assert.ok(menu.length >= 1, ph + places);
    }
  }
});

test('練習負荷：練習が3日未満の週はモノトニーを計算しない', () => {
  const one = E.loadMetrics({ ...base, sessions: [{ date: '2026-11-06', minutes: 90, rpe: 7 }] }, '2026-11-06');
  assert.strictEqual(one.monotony, null);
  const three = E.loadMetrics({ ...base, sessions: ['11-02', '11-04', '11-06'].map(d => ({ date: '2026-' + d, minutes: 60, rpe: 6 })) }, '2026-11-06');
  assert.ok(three.monotony > 0);
});
