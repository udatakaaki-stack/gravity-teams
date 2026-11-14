/*
 * トレーニングサポートプログラム：計算と文章作成
 * ブラウザ（window.TrainEngine）と Node.js（require）の両方で動作します。
 */
(function (root, factory) {
  'use strict';
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory(require('./t-data.js'), require('./t-content.js'));
  } else {
    root.TrainEngine = factory(root.TRAIN_DATA, root.TRAIN_CONTENT);
  }
})(typeof window !== 'undefined' ? window : this, function (D, C) {
  'use strict';

  var MAX_DAYS = 365;
  var RAPPORT_TOTAL = 21;

  // ------------------------------------------------------------------
  // ユーティリティ
  // ------------------------------------------------------------------
  function hash(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function pick(r, list) { return list && list.length ? list[Math.floor(r() * list.length)] : ''; }
  function fill(t, v) {
    return String(t).replace(/\{(\w+)\}/g, function (m, k) { return Object.prototype.hasOwnProperty.call(v, k) ? v[k] : m; });
  }
  function clamp(n, a, b) { return Math.min(b, Math.max(a, n)); }
  function round1(n) { return Math.round(n * 10) / 10; }
  function num(v) { var n = parseFloat(v); return isNaN(n) ? null : n; }
  function clampDays(n) { var v = parseInt(n, 10); if (isNaN(v)) v = 84; return clamp(v, 1, MAX_DAYS); }
  function parseDate(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
    return m ? new Date(+m[1], +m[2] - 1, +m[3], 12) : null;
  }
  function formatDate(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function addDays(s, n) { var d = parseDate(s); d.setDate(d.getDate() + n); return formatDate(d); }
  function diffDays(a, b) { return Math.round((parseDate(b) - parseDate(a)) / 86400000); }
  function today() { return formatDate(new Date()); }

  function displayName(p) {
    var name = p && p.name ? String(p.name).trim() : '';
    if (!name) return 'あなた';
    return name + (p.honorific === undefined ? 'さん' : p.honorific);
  }

  // ------------------------------------------------------------------
  // プラン設定（チームのプランに合わせる場合はチームの設定を使う）
  // ------------------------------------------------------------------
  var PLAN_KEYS = ['startDate', 'totalDays', 'goal', 'eventDate', 'trainingDays', 'places', 'coach', 'tone'];

  function findTeam(teams, id) {
    return (teams || []).filter(function (t) { return t.id === id; })[0] || null;
  }

  function planSettings(member, teams) {
    var team = member.teamId ? findTeam(teams, member.teamId) : null;
    var src = team && member.useTeamPlan !== false ? team : member;
    var s = {};
    PLAN_KEYS.forEach(function (k) { s[k] = src[k]; });
    // 署名・トーンは個人の設定があれば優先
    if (member.coach) s.coach = member.coach;
    if (member.tone) s.tone = member.tone;
    if (!s.coach && team) s.coach = team.coach;
    s.totalDays = clampDays(s.totalDays);
    s.goal = D.GOALS[s.goal] ? s.goal : 'general';
    s.trainingDays = Array.isArray(s.trainingDays) && s.trainingDays.length ? s.trainingDays.map(Number) : [1, 3, 5];
    s.places = Array.isArray(s.places) && s.places.length ? s.places : ['gym'];
    s.teamName = team ? team.name : '';
    s.fromTeam = src === team;
    return s;
  }

  // ------------------------------------------------------------------
  // 期分化
  // ------------------------------------------------------------------
  function layoutSegments(layout, total, offset) {
    var out = [];
    var sum = layout.reduce(function (a, l) { return a + l[1]; }, 0);
    var cum = 0;
    var prev = 0;
    for (var i = 0; i < layout.length; i++) {
      cum += layout[i][1] / sum;
      var end = i === layout.length - 1 ? total : Math.max(prev + 1, Math.round(total * cum));
      end = Math.min(end, total - (layout.length - 1 - i));
      out.push({ id: layout[i][0], start: offset + prev + 1, end: offset + end });
      prev = end;
    }
    return out;
  }

  function buildPlan(settings) {
    var total = clampDays(settings.totalDays);
    var goal = D.GOALS[settings.goal] || D.GOALS.general;
    var segs;
    var eventDay = null;
    if (settings.goal === 'competition' && settings.eventDate && settings.startDate) {
      var d = diffDays(settings.startDate, settings.eventDate) + 1;
      if (d >= 1 && d <= total) eventDay = d;
    }
    function forLength(n, offset) {
      if (n <= 0) return [];
      if (n < 7) return layoutSegments([[goal.id === 'competition' ? 'peak' : 'prep', 1]], n, offset);
      if (n < 28) {
        if (goal.id === 'competition') return layoutSegments([['prep', 0.3], ['peak', 0.7]].slice(n < 14 ? 1 : 0), n, offset);
        return layoutSegments([['prep', 0.3], [goal.main, 0.7]], n, offset);
      }
      return layoutSegments(goal.layout, n, offset);
    }
    if (eventDay) {
      segs = forLength(eventDay, 0);
      if (total > eventDay) segs.push({ id: 'transition', start: eventDay + 1, end: total });
    } else {
      segs = forLength(total, 0);
    }
    return segs.map(function (s) {
      var ph = D.PHASES[s.id];
      return { id: s.id, name: ph.name, sub: ph.sub, color: ph.color, start: s.start, end: s.end, days: s.end - s.start + 1 };
    });
  }

  function phaseForDay(plan, day) {
    for (var i = 0; i < plan.length; i++) if (day >= plan[i].start && day <= plan[i].end) return plan[i];
    return plan[plan.length - 1];
  }

  // 回復週：負荷を上げる期で、期の中の4週目ごと（その期が4週以上ある場合）
  var DELOAD_PHASES = ['base', 'build', 'strength', 'power'];
  function isDeload(plan, day) {
    var seg = phaseForDay(plan, day);
    if (DELOAD_PHASES.indexOf(seg.id) === -1 || seg.days < 28) return false;
    var week = Math.floor((day - seg.start) / 7) + 1;
    var lastWeekStart = seg.start + (week - 1) * 7;
    return week % 4 === 0 && lastWeekStart + 6 <= seg.end;
  }

  function dayInfo(settings, day) {
    var total = clampDays(settings.totalDays);
    var d = clamp(parseInt(day, 10) || 1, 1, total);
    var start = settings.startDate || today();
    var dateStr = addDays(start, d - 1);
    var wd = parseDate(dateStr).getDay();
    var plan = buildPlan(settings);
    var seg = phaseForDay(plan, d);
    var eventIn = null;
    if (settings.eventDate) eventIn = diffDays(dateStr, settings.eventDate);
    return {
      day: d, total: total, remain: total - d, dateStr: dateStr, weekday: wd, weekdayJa: D.WEEKDAYS[wd],
      training: settings.trainingDays.indexOf(wd) !== -1, plan: plan, seg: seg, phase: D.PHASES[seg.id],
      deload: isDeload(plan, d), eventIn: eventIn
    };
  }

  function todayDay(settings) {
    if (!settings.startDate) return 1;
    return clamp(diffDays(settings.startDate, today()) + 1, 1, clampDays(settings.totalDays));
  }

  // ------------------------------------------------------------------
  // 記録の計算
  // ------------------------------------------------------------------
  function byDate(list) {
    return (list || []).filter(function (x) { return x && x.date; }).slice()
      .sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
  }

  // 推定1RM（Epley式）。10回を超える記録は誤差が大きいため推定しない
  function e1rm(weight, reps) {
    var w = num(weight);
    var r = parseInt(reps, 10);
    if (!w || !r || r < 1 || r > 10) return null;
    if (r === 1) return round1(w);
    return round1(w * (1 + r / 30));
  }

  // 種目ごとの最高推定1RM
  function bestLifts(member, asOf) {
    var best = {};
    byDate(member.lifts).forEach(function (l) {
      if (asOf && l.date > asOf) return;
      var v = e1rm(l.weight, l.reps);
      if (v === null) return;
      var k = String(l.exercise || '').trim();
      if (!k) return;
      if (!best[k] || v > best[k].e1rm) best[k] = { exercise: k, e1rm: v, date: l.date, weight: num(l.weight), reps: parseInt(l.reps, 10) };
    });
    return best;
  }

  // 直近 days 日以内に自己ベスト（推定1RM）を更新した記録
  function recentPRs(member, asOf, days) {
    var end = asOf || today();
    var since = addDays(end, -(days || 7) + 1);
    var running = {};
    var prs = [];
    byDate(member.lifts).forEach(function (l) {
      if (l.date > end) return;
      var v = e1rm(l.weight, l.reps);
      var k = String(l.exercise || '').trim();
      if (v === null || !k) return;
      if (running[k] !== undefined && v > running[k] && l.date >= since) prs.push({ exercise: k, e1rm: v, prev: running[k], date: l.date });
      if (running[k] === undefined || v > running[k]) running[k] = v;
    });
    return prs;
  }

  // 日ごとの練習負荷（セッションRPE × 分）
  function dailyLoads(member, end, days) {
    var map = {};
    (member.sessions || []).forEach(function (s) {
      var rpe = num(s.rpe);
      var min = num(s.minutes);
      if (rpe === null || min === null || !s.date) return;
      map[s.date] = (map[s.date] || 0) + rpe * min;
    });
    var out = [];
    for (var i = days - 1; i >= 0; i--) {
      var d = addDays(end, -i);
      out.push({ date: d, load: map[d] || 0 });
    }
    return out;
  }

  function loadMetrics(member, asOf) {
    var end = asOf || today();
    var last28 = dailyLoads(member, end, 28);
    var week = last28.slice(21);
    var weekly = week.reduce(function (a, x) { return a + x.load; }, 0);
    var mean = weekly / 7;
    var sd = Math.sqrt(week.reduce(function (a, x) { return a + Math.pow(x.load - mean, 2); }, 0) / 7);
    var chronicTotal = last28.reduce(function (a, x) { return a + x.load; }, 0);
    var loadDays = week.filter(function (x) { return x.load > 0; }).length;
    var sessions = (member.sessions || []).filter(function (s) { return s.date && s.date <= end; });
    var first = byDate(sessions)[0];
    // 急性：慢性負荷比は、記録が21日以上ある場合のみ計算する
    var history = first ? diffDays(first.date, end) + 1 : 0;
    var acwr = history >= 21 && chronicTotal > 0 ? Math.round(weekly / (chronicTotal / 4) * 100) / 100 : null;
    return {
      weekly: Math.round(weekly),
      sessions7: week.filter(function (x) { return x.load > 0; }).length,
      // 単調さは、1週間に3日以上の練習がある場合のみ計算する
      monotony: loadDays >= 3 && sd > 0 ? Math.round(mean / sd * 100) / 100 : null,
      strain: loadDays >= 3 && sd > 0 ? Math.round(weekly * (mean / sd)) : null,
      acwr: acwr,
      days: last28
    };
  }

  function latestWellness(member, asOf, maxAge) {
    var end = asOf || today();
    var list = byDate(member.wellness).filter(function (w) { return w.date <= end; });
    if (!list.length) return null;
    var w = list[list.length - 1];
    if (maxAge !== undefined && diffDays(w.date, end) > maxAge) return null;
    return w;
  }

  // ------------------------------------------------------------------
  // 注意（安全アラート）
  // ------------------------------------------------------------------
  var URGENT_WORDS = ['胸の痛み', '胸が痛', '動悸', '息苦し', '失神', '気を失', 'しびれ', '頭を打', '脳しんとう', '脳震盪', '骨折', '腫れ', '激痛', '吐き気', 'めまい'];

  function alerts(member, settings, asOf) {
    var end = asOf || today();
    var out = [];
    var wl = byDate(member.wellness).filter(function (w) { return w.date <= end; });
    var recent3 = wl.filter(function (w) { return diffDays(w.date, end) <= 2; });
    var recent7 = wl.filter(function (w) { return diffDays(w.date, end) <= 6; });

    var text = recent3.map(function (w) { return (w.memo || '') + ' ' + (w.pain || ''); }).join(' ') + ' ' +
      byDate(member.sessions).filter(function (s) { return diffDays(s.date, end) <= 2 && s.date <= end; }).map(function (s) { return s.note || ''; }).join(' ');
    var hits = URGENT_WORDS.filter(function (w) { return text.indexOf(w) !== -1; });
    if (hits.length) {
      var head = hits.some(function (h) { return /頭を打|脳/.test(h); });
      out.push({
        id: 'urgent', level: 'urgent', title: '練習を止めて確認が必要な記録があります',
        body: '直近の記録に「' + hits.join('」「') + '」があります。練習を中止し、本人の状態を確認してください。症状が強い・続く場合は医療機関の受診を。' +
          (head ? '頭を打った後の症状がある場合は、脳しんとうの可能性があります。その日の練習や試合には戻らず、医療者の評価を受けてください。' : '')
      });
    }
    var painNow = recent3.filter(function (w) { return w.pain && String(w.pain).trim(); });
    if (painNow.length && !hits.length) {
      out.push({
        id: 'pain', level: 'warn', title: '痛み・違和感の記録があります',
        body: '「' + painNow[painNow.length - 1].pain + '」に痛み・違和感の記録があります。痛む部位を使う練習は控え、続く場合は受診をすすめましょう。'
      });
    }
    var fatigued = recent7.slice(-5).filter(function (w) { return num(w.fatigue) !== null && num(w.fatigue) >= 4; });
    if (fatigued.length >= 3) {
      out.push({ id: 'fatigue', level: 'warn', title: '強い疲労が続いています', body: '直近の記録で、疲労4以上が' + fatigued.length + '回あります。練習量を減らし、睡眠と食事を確認しましょう。' });
    }
    var sore = recent7.slice(-5).filter(function (w) { return num(w.soreness) !== null && num(w.soreness) >= 4; });
    if (sore.length >= 3) {
      out.push({ id: 'soreness', level: 'warn', title: '強い筋肉痛が続いています', body: '直近の記録で、筋肉痛4以上が' + sore.length + '回あります。同じ部位への高い負荷を控えましょう。' });
    }
    var shortSleep = recent7.filter(function (w) { return num(w.sleep) !== null && num(w.sleep) < 6; });
    if (shortSleep.length >= 3) {
      out.push({ id: 'sleep', level: 'warn', title: '睡眠時間が短い日が続いています', body: '直近7日間で、睡眠6時間未満が' + shortSleep.length + '回あります。強度を控えめにし、睡眠の確保を優先しましょう。' });
    }
    var lm = loadMetrics(member, end);
    if (lm.acwr !== null && lm.acwr > 1.5) {
      out.push({ id: 'acwr', level: 'warn', title: '練習負荷が急に増えています', body: '急性：慢性負荷比が' + lm.acwr + 'です（1.5超）。直近1週間の練習負荷が、4週間の平均より大きく増えています。疲労や痛みの様子と合わせて、量の調整を検討しましょう。' });
    }
    if (lm.monotony !== null && lm.monotony > 2) {
      out.push({ id: 'monotony', level: 'info', title: '練習が単調になっています', body: '練習の単調さ（モノトニー）が' + lm.monotony + 'です（2.0超）。重い日と軽い日、休養日のメリハリをつけましょう。' });
    }
    if (num(member.age) !== null && num(member.age) < 18) {
      out.push({ id: 'minor', level: 'info', title: '18歳未満の選手です', body: '成長期のため、重い重さを扱う練習は、正しいフォームの習得と指導者の見守りのもとで、段階的に行いましょう。' });
    }
    return out;
  }

  // ------------------------------------------------------------------
  // メニュー
  // ------------------------------------------------------------------
  function chooseMenu(level, places, phaseId, r, opts) {
    opts = opts || {};
    var lv = clamp(parseInt(level, 10) || 1, 1, 3);
    var maxLevel = phaseId === 'prep' ? 1 : lv;
    var pool = D.EXERCISES.filter(function (e) {
      return e.level <= maxLevel && e.place.some(function (p) { return places.indexOf(p) !== -1; });
    });
    if (!pool.length) pool = D.EXERCISES.filter(function (e) { return e.level === 1; });
    var cats = opts.light ? ['mobility', 'core'] : (D.PHASE_EX[phaseId] || ['strength', 'core']);
    var chosen = [];
    cats.forEach(function (cat) {
      var c = pool.filter(function (e) { return e.cat === cat && chosen.indexOf(e) === -1; });
      if (c.length) chosen.push(pick(r, c));
    });
    return chosen;
  }

  function menuText(phaseId, menu, opts) {
    opts = opts || {};
    var p = D.PHASES[phaseId].params;
    var lines = [];
    menu.forEach(function (e) {
      var spec;
      if (e.cat === 'mobility') spec = '5〜10分';
      else if (e.cat === 'core') spec = '30秒×2〜3セット';
      else if (e.cat === 'conditioning') spec = phaseId === 'base' ? '20〜30分' : '15〜20分';
      else spec = p.reps + '×' + p.sets + '（休息 ' + p.rest + '）';
      if (opts.deload && e.cat !== 'mobility') spec += '　※回復週のためセット数は少なめに';
      lines.push('・' + e.name + '　' + spec + '\n　' + e.cue);
    });
    return lines.join('\n');
  }

  // ------------------------------------------------------------------
  // コメント
  // ------------------------------------------------------------------
  function chooseTip(member, phaseId, r) {
    var concerns = member.concerns || [];
    var inPhase = C.TIPS.filter(function (t) { return !t.phases.length || t.phases.indexOf(phaseId) !== -1; });
    var isMatch = function (t) { return t.tags.some(function (g) { return concerns.indexOf(g) !== -1; }); };
    var matched = inPhase.filter(isMatch);
    if (matched.length && r() < 0.65) return pick(r, matched);
    // 増量・減量など、悩みに合う人にだけ出すヒント（only）は除く
    return pick(r, inPhase.filter(function (t) { return !t.only || isMatch(t); }));
  }

  function conditionKey(w) {
    if (!w) return 'noData';
    if (w.pain && String(w.pain).trim()) return 'pain';
    if (num(w.fatigue) !== null && num(w.fatigue) >= 4) return 'fatigueHigh';
    if (num(w.soreness) !== null && num(w.soreness) >= 4) return 'sorenessHigh';
    if (num(w.sleep) !== null && num(w.sleep) < 6) return 'sleepShort';
    if ((num(w.fatigue) !== null && num(w.fatigue) <= 2) && (num(w.mood) === null || num(w.mood) >= 3)) return 'good';
    return null;
  }

  function milestone(info) {
    if (info.eventIn === 0) return 'eventDay';
    if (info.eventIn === 1) return 'eventEve';
    if (info.day === info.total && info.total > 1) return 'last';
    if (info.day === 1) return 'first';
    if (info.total >= 20 && info.day === Math.ceil(info.total / 2)) return 'half';
    if (info.day === 7) return 'week1';
    if (info.day === 30) return 'day30';
    if (info.day === 100) return 'day100';
    return null;
  }

  /**
   * メンバー向けのコメント
   * opts: { format: 'line'|'short', emoji, variant, tip, menu, condition }
   */
  function generateComment(member, teams, day, opts) {
    opts = opts || {};
    var s = planSettings(member, teams);
    var info = dayInfo(s, day);
    var toneId = D.TONES[s.tone] ? s.tone : 'gentle';
    var tone = D.TONES[toneId];
    var emoji = opts.emoji === undefined ? 1 : opts.emoji;
    var r = rng(hash([member.id || member.name || 'm', 'c', info.day, opts.variant || 0, opts.format || 'line'].join('|')));
    var vars = { name: displayName(member), day: info.day, total: info.total, remain: info.remain, phase: info.phase.name, team: s.teamName };
    var parts = [];

    parts.push(fill(pick(r, tone.openings), vars) + (emoji ? pick(r, tone.emoji) : ''));

    // コンディションへの声かけ（その日から2日以内の記録）
    var w = latestWellness(member, info.dateStr, 2);
    var ck = conditionKey(w);
    var light = ck === 'pain' || ck === 'fatigueHigh' || ck === 'sorenessHigh';
    if (opts.condition !== false && ck) {
      parts.push(fill(pick(r, C.CONDITION_LINES[ck]), Object.assign({}, vars, { pain: w && w.pain ? '「' + w.pain + '」' : '' })));
    }

    // 自己ベストの更新
    var prs = recentPRs(member, info.dateStr, 7);
    if (prs.length) {
      var pr = prs[prs.length - 1];
      parts.push(fill(pick(r, C.PR_LINES), { lift: pr.exercise, e1rm: pr.e1rm }));
    }

    // 節目 or 期のメッセージ
    var ms = milestone(info);
    if (ms) parts.push(fill(C.MILESTONES[ms], vars));
    else parts.push(fill(pick(r, info.phase.bodies), vars));
    if (info.deload) parts.push(pick(r, C.DELOAD_LINES));
    if (info.eventIn !== null && info.eventIn > 1 && info.eventIn <= 14) parts.push('試合まで、あと' + info.eventIn + '日です。');

    if (opts.format === 'short') {
      parts.push(fill(pick(r, tone.closings), vars));
      if (s.coach) parts.push(s.coach);
      return parts.join('\n\n');
    }

    // 今日のメニュー
    if (opts.menu !== false) {
      if (!info.training) {
        parts.push((emoji ? '🛌' : '■') + '今日は休養日\n' + pick(r, C.REST_LINES));
      } else {
        var menu = chooseMenu(member.level, s.places, info.phase.id, r, { light: light });
        var head = (emoji ? '🏋️' : '■') + (light ? '今日は軽めのメニュー（回復優先）' : '今日のメニュー（' + info.phase.name + '）');
        var body = menuText(info.phase.id, menu, { deload: info.deload });
        var foot = light ? '痛みや強い疲れがある部位は動かさず、気持ちよく動ける範囲で行ってください。' : '強度の目安：' + info.phase.params.load + '。ウォームアップを丁寧に行い、フォームが崩れたら無理をせず終えましょう。';
        parts.push(head + '\n' + body + '\n' + foot);
      }
    }

    // ヒント
    if (opts.tip !== false) {
      var tip = chooseTip(member, info.phase.id, r);
      parts.push((emoji ? '💡' : '■') + '今日のヒント「' + tip.title + '」\n' + tip.body);
    }

    parts.push(fill(pick(r, tone.closings), vars) + (emoji >= 2 ? pick(r, tone.emoji) : ''));
    if (s.coach) parts.push(s.coach);
    return parts.join('\n\n');
  }

  // ------------------------------------------------------------------
  // チーム全体へのメッセージ（個人の名前や数値は入れない）
  // ------------------------------------------------------------------
  function teamMessage(team, day, opts) {
    opts = opts || {};
    var s = planSettings({ teamId: team.id, useTeamPlan: true }, [team]);
    var info = dayInfo(s, day);
    var emoji = opts.emoji === undefined ? 1 : opts.emoji;
    var r = rng(hash([team.id, 'team', info.day, opts.variant || 0].join('|')));
    var vars = { team: team.name || 'チーム', day: info.day };
    var parts = [];
    var date = info.dateStr.slice(5).replace('-', '/') + '（' + info.weekdayJa + '）';
    parts.push(fill(pick(r, C.TEAM.openings), vars) + (emoji ? pick(r, ['💪', '🔥', '🏃', '🌿']) : ''));
    parts.push((emoji ? '📅' : '■') + date + '　' + info.day + '日目／' + info.phase.name + '（' + info.phase.sub + '）' +
      (info.eventIn !== null && info.eventIn >= 0 ? '\n試合まであと' + info.eventIn + '日' : ''));
    if (!info.training) {
      parts.push(C.TEAM.restDay);
    } else {
      var ms = milestone(info);
      parts.push(ms && ms !== 'last' && ms !== 'first' ? fill(C.MILESTONES[ms], { name: 'みなさん', total: info.total }) : fill(pick(r, info.phase.bodies), { name: 'みなさん' }));
      if (info.deload) parts.push(pick(r, C.DELOAD_LINES));
      parts.push((emoji ? '🎯' : '■') + '今日のテーマ\n' + info.phase.focus.map(function (f) { return '・' + f; }).join('\n'));
      var menu = chooseMenu(team.level || 1, s.places, info.phase.id, r);
      parts.push((emoji ? '🏋️' : '■') + '今日のメニュー\n・ウォームアップ（動的ウォームアップ 10分）\n' + menuText(info.phase.id, menu, { deload: info.deload }) +
        '\n・クールダウン（ストレッチ 5〜10分）\n強度の目安：' + info.phase.params.load);
      if (opts.checkin !== false) parts.push((emoji ? '📝' : '■') + C.TEAM.checkin);
    }
    parts.push(pick(r, C.TEAM.reminders));
    if (team.coach) parts.push(team.coach);
    return parts.join('\n\n');
  }

  // ------------------------------------------------------------------
  // 週の振り返り
  // ------------------------------------------------------------------
  function weeklyReport(member, teams, endDate, opts) {
    opts = opts || {};
    var end = endDate || today();
    var start = addDays(end, -6);
    var s = planSettings(member, teams);
    var emoji = opts.emoji === undefined ? 1 : opts.emoji;
    var r = rng(hash([member.id || 'm', 'w', end, opts.variant || 0].join('|')));
    var toneId = D.TONES[s.tone] ? s.tone : 'gentle';
    var name = displayName(member);
    var inW = function (x) { return x.date >= start && x.date <= end; };
    var sessions = (member.sessions || []).filter(inW);
    var wl = (member.wellness || []).filter(inW);
    var lm = loadMetrics(member, end);
    var prs = recentPRs(member, end, 7);
    var sleeps = wl.map(function (w) { return num(w.sleep); }).filter(function (x) { return x !== null; });
    var fat = wl.map(function (w) { return num(w.fatigue); }).filter(function (x) { return x !== null; });
    var avg = function (a) { return a.length ? round1(a.reduce(function (x, y) { return x + y; }, 0) / a.length) : null; };
    var minutes = sessions.reduce(function (a, x) { return a + (num(x.minutes) || 0); }, 0);
    var stats = { start: start, end: end, sessions: sessions.length, minutes: minutes, load: lm.weekly, acwr: lm.acwr, sleepAvg: avg(sleeps), fatigueAvg: avg(fat), prs: prs, painDays: wl.filter(function (w) { return w.pain && String(w.pain).trim(); }).length };

    var parts = [];
    parts.push(name + '、1週間の練習お疲れさまでした。今週の振り返りをお送りします。' + (emoji ? pick(r, D.TONES[toneId].emoji) : ''));
    var rec = ['練習回数：' + stats.sessions + '回（合計' + minutes + '分）'];
    if (stats.sleepAvg !== null) rec.push('平均睡眠時間：' + stats.sleepAvg + '時間');
    if (stats.fatigueAvg !== null) rec.push('疲労の平均：' + stats.fatigueAvg + '（5段階）');
    prs.forEach(function (p) { rec.push(p.exercise + '：推定1RM ' + p.e1rm + 'kg（自己ベスト更新）'); });
    parts.push((emoji ? '📊' : '■') + '今週の記録\n' + rec.map(function (x) { return '・' + x; }).join('\n'));

    var good = [];
    if (stats.sessions >= 3) good.push('今週は' + stats.sessions + '回の練習をやり切りました。継続こそが最大の力です。');
    else if (stats.sessions >= 1) good.push('限られた時間の中でも練習を続けられました。ゼロにしないことが、とても大切です。');
    if (prs.length) good.push('自己ベストを更新しました。積み重ねが数字に表れています。');
    if (stats.sleepAvg !== null && stats.sleepAvg >= 7) good.push('平均' + stats.sleepAvg + '時間の睡眠がとれていました。回復の土台がしっかりできています。');
    if (!good.length) good.push('思うように練習できない週もあります。こうして振り返りを読んでくれていること自体が、次につながる大切な一歩です。');
    parts.push((emoji ? '🌱' : '■') + '今週のよかったこと\n' + good.join('\n'));

    var next = [];
    if (stats.painDays) next.push('痛みのある部位は無理をせず、続く場合は医療機関で診てもらう');
    if (stats.fatigueAvg !== null && stats.fatigueAvg >= 3.5) next.push('疲れが強いので、練習量を少し減らして回復を優先する');
    if (stats.sleepAvg !== null && stats.sleepAvg < 7) next.push('いつもより15分早く寝て、睡眠時間を確保する');
    if (lm.acwr !== null && lm.acwr > 1.5) next.push('練習量が急に増えているので、来週は量を少し抑える');
    if (stats.sessions < 2) next.push('短い時間でもいいので、練習を週2回以上行う');
    var ph = D.PHASES[dayInfo(s, clamp(diffDays(s.startDate || end, end) + 1, 1, s.totalDays)).seg.id];
    next.push(ph.focus[0]);
    parts.push((emoji ? '🎯' : '■') + '来週の目標\n' + next.slice(0, 2).map(function (x) { return '・' + x; }).join('\n'));
    parts.push('来週の予定や、気になっていることがあれば教えてください。一緒に練習の計画を立てましょう。');
    parts.push(fill(pick(r, D.TONES[toneId].closings), { name: name }));
    if (s.coach) parts.push(s.coach);
    return { stats: stats, text: parts.join('\n\n') };
  }

  // ------------------------------------------------------------------
  // ラポール21日
  // ------------------------------------------------------------------
  function rapportMessage(member, teams, day, opts) {
    opts = opts || {};
    var s = planSettings(member, teams);
    var d = clamp(parseInt(day, 10) || 1, 1, RAPPORT_TOTAL);
    var item = C.RAPPORT_DAYS[d - 1];
    var format = opts.format === 'mail' ? 'mail' : 'line';
    var emoji = format === 'mail' ? 0 : (opts.emoji === undefined ? 1 : opts.emoji);
    var toneId = D.TONES[s.tone] ? s.tone : 'gentle';
    var r = rng(hash([member.id || 'm', 'rp', d, opts.variant || 0, format].join('|')));
    var goal = member.goalNote ? String(member.goalNote).trim() : '';
    var vars = { name: displayName(member), goal: goal };
    var stateId = opts.state !== undefined ? opts.state : (member.rapportState || '');
    var st = C.RAPPORT_STATES.filter(function (x) { return x.id === stateId; })[0] || C.RAPPORT_STATES[0];
    var startDate = opts.startDate || member.rapportStart || s.startDate;
    var date = startDate ? addDays(startDate, d - 1) : null;
    var empathy = st.id && C.STATE_EMPATHY[st.id] ? fill(pick(r, C.STATE_EMPATHY[st.id]), vars) : '';
    var personal = st.id && C.STATE_AFFIRMATIONS[st.id] ? pick(r, C.STATE_AFFIRMATIONS[st.id]) : '';
    // 痛みの記録がある場合は、状態の選択がなくても寄り添う
    if (!st.id) {
      var w = latestWellness(member, null, 2);
      if (w && w.pain && String(w.pain).trim()) { empathy = fill(C.STATE_EMPATHY.injured[0], vars); personal = C.STATE_AFFIRMATIONS.injured[0]; }
      else if (w && num(w.fatigue) >= 4) { empathy = fill(C.STATE_EMPATHY.tired[0], vars); personal = C.STATE_AFFIRMATIONS.tired[0]; }
    }
    var body = fill(goal || !item.alt ? item.message : item.alt, vars);
    var subject = '【3週間サポート ' + d + '日目】' + fill(item.subject, vars);
    var guide = pick(r, C.AFFIRMATION_GUIDES);
    var light = st.negative ? pick(r, C.LIGHT_REPLY) : '';
    var parts = [];
    if (format === 'line') {
      parts.push(fill(pick(r, D.TONES[toneId].openings), Object.assign({ day: d }, vars)) + (emoji ? pick(r, D.TONES[toneId].emoji) : ''));
      parts.push((emoji ? '🌱' : '■') + '3週間メッセージ ' + d + '日目「' + item.theme + '」');
      if (empathy) parts.push(empathy);
      parts.push(body);
      parts.push((emoji ? '🌸' : '■') + '今日の言葉\n「' + item.affirmation + '」' + (personal ? '\n\n' + (emoji ? '🤍' : '■') + '今の' + vars.name + 'へ\n「' + personal + '」' : '') + '\n' + guide);
      parts.push((emoji ? '💬' : '■') + '今日の質問\n' + fill(item.question, vars) + (light ? '\n' + light : ''));
      parts.push(fill(pick(r, D.TONES[toneId].closings), vars));
    } else {
      parts.push(vars.name);
      parts.push('いつもお世話になっております。' + (s.coach ? s.coach + 'です。' : '') + '\n3週間サポートの' + d + '日目のメッセージをお送りします。今日のテーマは「' + item.theme + '」です。');
      if (empathy) parts.push(empathy);
      parts.push(body);
      parts.push('◇ 今日の言葉 ◇\n「' + item.affirmation + '」' + (personal ? '\n\n◇ 今の' + vars.name + 'へ ◇\n「' + personal + '」' : '') + '\n' + guide);
      parts.push('◇ 今日の質問 ◇\n' + fill(item.question, vars) + '\n' + (light || 'このメールにそのままご返信いただければ、お返事いたします。'));
      parts.push('今後とも、どうぞよろしくお願いいたします。');
    }
    if (s.coach) parts.push(format === 'mail' ? '━━━━━━━━━━\n' + s.coach + '\n━━━━━━━━━━' : s.coach);
    return { subject: subject, text: parts.join('\n\n'), day: d, date: date, theme: item.theme };
  }

  // ------------------------------------------------------------------
  // 定型文・場面別メッセージ
  // ------------------------------------------------------------------
  function templateVars(member, teams) {
    var s = planSettings(member, teams);
    var d = todayDay(s);
    var info = dayInfo(s, d);
    return {
      name: displayName(member), team: s.teamName || 'チーム', day: d, remain: info.remain, phase: info.phase.name,
      event: info.eventIn !== null && info.eventIn >= 0 ? info.eventIn : '〇', coach: s.coach || ''
    };
  }

  function fillTemplate(member, teams, text, opts) {
    opts = opts || {};
    var v = templateVars(member, teams);
    var out = fill(text, v);
    if (opts.signature !== false && v.coach && out.indexOf(v.coach) === -1) out += '\n\n' + v.coach;
    return out;
  }

  function sceneMessage(member, teams, sceneId) {
    var sc = C.SCENES.filter(function (x) { return x.id === sceneId; })[0];
    if (!sc) return '';
    var s = planSettings(member, teams);
    var name = displayName(member);
    var parts = [name + '、話してくれてありがとうございます。', fill(sc.message, { name: name }),
      '■できることから少しずつ\n' + sc.tips.map(function (t) { return '・' + t; }).join('\n')];
    if (s.coach) parts.push(s.coach);
    return parts.join('\n\n');
  }

  return {
    MAX_DAYS: MAX_DAYS, RAPPORT_TOTAL: RAPPORT_TOTAL,
    today: today, parseDate: parseDate, formatDate: formatDate, addDays: addDays, diffDays: diffDays, clampDays: clampDays,
    displayName: displayName, planSettings: planSettings, buildPlan: buildPlan, phaseForDay: phaseForDay, isDeload: isDeload,
    dayInfo: dayInfo, todayDay: todayDay,
    e1rm: e1rm, bestLifts: bestLifts, recentPRs: recentPRs, dailyLoads: dailyLoads, loadMetrics: loadMetrics,
    latestWellness: latestWellness, alerts: alerts,
    chooseMenu: chooseMenu, generateComment: generateComment, teamMessage: teamMessage, weeklyReport: weeklyReport,
    rapportMessage: rapportMessage, templateVars: templateVars, fillTemplate: fillTemplate, sceneMessage: sceneMessage
  };
});
