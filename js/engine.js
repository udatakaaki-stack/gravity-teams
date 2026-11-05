/*
 * ダイエットサポートプログラム：生成エンジン
 * 期分化の計算、コメント自動生成、体の指標計算を担当します。
 * ブラウザ（window.DietEngine）と Node.js（require）の両方で動作します。
 */
(function (root, factory) {
  'use strict';
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory(require('./data.js'));
  } else {
    root.DietEngine = factory(root.DIET_DATA);
  }
})(typeof window !== 'undefined' ? window : this, function (D) {
  'use strict';

  var MIN_DAYS = 1;
  var MAX_DAYS = 365;

  // ------------------------------------------------------------------
  // ユーティリティ
  // ------------------------------------------------------------------

  // 文字列から再現性のある数値を作る（同じクライアント・同じ日なら同じ文章になる）
  function hashString(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  // 乱数生成器（mulberry32）
  function createRng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function pick(rng, list) {
    if (!list || list.length === 0) return '';
    return list[Math.floor(rng() * list.length)];
  }

  function clamp(n, min, max) {
    return Math.min(max, Math.max(min, n));
  }

  function round1(n) {
    return Math.round(n * 10) / 10;
  }

  function fill(template, vars) {
    return String(template).replace(/\{(\w+)\}/g, function (m, key) {
      return Object.prototype.hasOwnProperty.call(vars, key) ? vars[key] : m;
    });
  }

  function clampDays(n) {
    var v = parseInt(n, 10);
    if (isNaN(v)) v = 90;
    return clamp(v, MIN_DAYS, MAX_DAYS);
  }

  // 'YYYY-MM-DD' を日付として扱う（タイムゾーンのずれを避けるため正午固定）
  function parseDate(s) {
    if (!s) return null;
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (!m) return null;
    return new Date(+m[1], +m[2] - 1, +m[3], 12, 0, 0);
  }

  function formatDate(d) {
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }

  function addDays(d, n) {
    var r = new Date(d.getTime());
    r.setDate(r.getDate() + n);
    return r;
  }

  function diffDays(a, b) {
    return Math.round((b.getTime() - a.getTime()) / 86400000);
  }

  var WEEKDAY_JA = ['日', '月', '火', '水', '木', '金', '土'];

  function displayName(client) {
    var name = (client && client.name ? String(client.name).trim() : '') || 'あなた';
    if (name === 'あなた') return name;
    var hon = client.honorific === undefined ? 'さん' : client.honorific;
    return name + hon;
  }

  // ------------------------------------------------------------------
  // 期分化（ピリオダイゼーション）
  // ------------------------------------------------------------------
  function buildPlan(totalDays) {
    var total = clampDays(totalDays);
    var layout;
    if (total === 1) {
      layout = [['intro', 1]];
    } else if (total < 14) {
      layout = [['intro', 0.3], ['accel', 0.7]];
    } else if (total < 30) {
      layout = [['intro', 0.2], ['accel', 0.45], ['adjust', 0.35]];
    } else {
      layout = [['intro', 0.12], ['accel', 0.33], ['adjust', 0.25], ['finish', 0.15], ['keep', 0.15]];
    }

    var plan = [];
    var cum = 0;
    var prevEnd = 0;
    for (var i = 0; i < layout.length; i++) {
      cum += layout[i][1];
      var end = i === layout.length - 1 ? total : Math.max(prevEnd + 1, Math.round(total * cum));
      end = Math.min(end, total - (layout.length - 1 - i)); // 後ろの期に最低1日を残す
      var phase = D.PHASES[layout[i][0]];
      plan.push({
        id: phase.id,
        name: phase.name,
        sub: phase.sub,
        color: phase.color,
        start: prevEnd + 1,
        end: end,
        days: end - prevEnd
      });
      prevEnd = end;
    }
    return plan;
  }

  function phaseForDay(plan, day) {
    for (var i = 0; i < plan.length; i++) {
      if (day >= plan[i].start && day <= plan[i].end) return plan[i];
    }
    return plan[plan.length - 1];
  }

  // ------------------------------------------------------------------
  // 体の指標
  // ------------------------------------------------------------------
  var ACTIVITY = {
    low: { label: 'ほとんど座っている（デスクワーク中心）', factor: 1.2 },
    light: { label: '軽く動く（週1〜3回の運動・立ち仕事）', factor: 1.375 },
    moderate: { label: 'よく動く（週3〜5回の運動）', factor: 1.55 },
    high: { label: 'とてもよく動く（ほぼ毎日の運動・肉体労働）', factor: 1.725 }
  };

  // 基礎代謝の推定（Mifflin-St Jeor式）
  function estimateBmr(client) {
    var w = parseFloat(client.currentWeight || client.startWeight);
    var h = parseFloat(client.height);
    var a = parseFloat(client.age);
    if (!w || !h || !a) return null;
    var base = 10 * w + 6.25 * h - 5 * a;
    if (client.gender === 'male') return Math.round(base + 5);
    if (client.gender === 'female') return Math.round(base - 161);
    return Math.round(base - 78); // 性別未設定の場合は男女の中間値
  }

  function metrics(client) {
    var h = parseFloat(client.height);
    var start = parseFloat(client.startWeight);
    var goal = parseFloat(client.goalWeight);
    var latest = latestLog(client);
    var current = latest ? latest.weight : start;
    var res = { warnings: [] };

    if (h && current) {
      var m = h / 100;
      res.bmi = round1(current / (m * m));
      res.standardWeight = round1(22 * m * m);
      if (goal) res.goalBmi = round1(goal / (m * m));
      res.bmiLabel = res.bmi < 18.5 ? '低体重' : res.bmi < 25 ? '普通体重' : '肥満（1度以上）';
    }

    var bmr = estimateBmr({
      currentWeight: current, height: client.height, age: client.age, gender: client.gender
    });
    if (bmr) {
      res.bmr = bmr;
      var act = ACTIVITY[client.activity] || ACTIVITY.low;
      res.tdee = Math.round(bmr * act.factor);
    }

    if (start && goal && client.totalDays) {
      var weeks = clampDays(client.totalDays) / 7;
      var toLose = start - goal;
      res.toLose = round1(toLose);
      if (toLose > 0) {
        res.weeklyPace = round1(toLose / weeks);
        if (res.weeklyPace > 1 || res.weeklyPace > start * 0.01) {
          res.warnings.push('目標のペースが1週間あたり約' + res.weeklyPace + 'kgとやや急です。期間を延ばすか、目標を段階的に設定することを検討しましょう。');
        }
      }
    }
    if (res.goalBmi && res.goalBmi < 18.5) {
      res.warnings.push('目標体重のBMIが' + res.goalBmi + 'で、低体重（18.5未満）の範囲になります。目標設定を見直しましょう。');
    }
    if (client.age && parseFloat(client.age) < 18) {
      res.warnings.push('18歳未満の方は成長期のため、食事制限を伴うダイエットは保護者・医師と相談のうえで行ってください。');
    }
    return res;
  }

  // ------------------------------------------------------------------
  // 体重記録
  // ------------------------------------------------------------------
  function sortedLogs(client) {
    return (client.logs || [])
      .filter(function (l) { return l && l.date && !isNaN(parseFloat(l.weight)); })
      .map(function (l) { return { date: l.date, weight: parseFloat(l.weight) }; })
      .sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
  }

  function latestLog(client) {
    var logs = sortedLogs(client);
    return logs.length ? logs[logs.length - 1] : null;
  }

  // 指定日までの最新記録と、その1つ前の記録
  function progressAt(client, dateStr) {
    var logs = sortedLogs(client).filter(function (l) { return l.date <= dateStr; });
    if (!logs.length) return null;
    var latest = logs[logs.length - 1];
    // 7日以上前の記録しかない場合は「最近の記録なし」とみなす
    var gap = diffDays(parseDate(latest.date), parseDate(dateStr));
    if (gap > 7) return null;
    var prev = logs.length > 1 ? logs[logs.length - 2] : null;
    var start = parseFloat(client.startWeight);
    var goal = parseFloat(client.goalWeight);
    var res = {
      latest: latest,
      prev: prev,
      diff: prev ? round1(latest.weight - prev.weight) : null,
      lost: start ? round1(start - latest.weight) : null
    };
    if (start && goal && start > goal) {
      res.pct = clamp(Math.round(((start - latest.weight) / (start - goal)) * 100), 0, 100);
      res.reached = latest.weight <= goal;
    }
    return res;
  }

  // ------------------------------------------------------------------
  // コメント生成
  // ------------------------------------------------------------------
  function dayInfo(client, day) {
    var total = clampDays(client.totalDays);
    var d = clamp(parseInt(day, 10) || 1, 1, total);
    var start = parseDate(client.startDate) || parseDate(formatDate(new Date()));
    var date = addDays(start, d - 1);
    return {
      day: d,
      total: total,
      remain: total - d,
      date: date,
      dateStr: formatDate(date),
      weekday: date.getDay(),
      weekdayJa: WEEKDAY_JA[date.getDay()]
    };
  }

  function todayDay(client) {
    var start = parseDate(client.startDate);
    if (!start) return 1;
    var today = parseDate(formatDate(new Date()));
    return clamp(diffDays(start, today) + 1, 1, clampDays(client.totalDays));
  }

  function milestoneFor(info, plan) {
    var d = info.day;
    var t = info.total;
    if (d === t && t > 1) return 'last';
    if (d === 1) return 'first';
    if (t >= 14 && d === t - 6) return 'lastWeek';
    if (t >= 20 && d === Math.ceil(t / 2)) return 'half';
    if (d === 3) return 'day3';
    if (d === 7) return 'week1';
    if (d === 14) return 'week2';
    if (d === 21) return 'week3';
    if (d === 30) return 'day30';
    if (d === 50) return 'day50';
    if (d === 100) return 'day100';
    if (d === 200) return 'day200';
    if (d === 300) return 'day300';
    return null;
  }

  // クライアントの悩みとフェーズに合うヒントを選ぶ
  function chooseTip(client, phaseId, rng) {
    var concerns = client.concerns || [];
    var inPhase = D.TIPS.filter(function (t) {
      return !t.phases.length || t.phases.indexOf(phaseId) !== -1;
    });
    var matched = inPhase.filter(function (t) {
      return t.tags.some(function (tag) { return concerns.indexOf(tag) !== -1; });
    });
    // 悩みに合うヒントを約65%の確率で優先
    if (matched.length && rng() < 0.65) return pick(rng, matched);
    return pick(rng, inPhase);
  }

  function exerciseLevel(client, phaseId) {
    var lv = clamp(parseInt(client.level, 10) || 1, 1, 3);
    if (phaseId === 'intro') lv -= 1;
    return clamp(lv, 1, 3);
  }

  function chooseExercises(client, phaseId, rng, restDay) {
    var places = client.places && client.places.length ? client.places : ['home'];
    var lvClient = clamp(parseInt(client.level, 10) || 1, 1, 3);
    var maxLevel = phaseId === 'intro' ? lvClient : lvClient + 1;
    var pool = D.EXERCISES.filter(function (e) {
      return e.level <= maxLevel && e.place.some(function (p) { return places.indexOf(p) !== -1; });
    });
    if (!pool.length) pool = D.EXERCISES.filter(function (e) { return e.level === 1; });

    var vol = exerciseLevel(client, phaseId);
    if (restDay) {
      var stretches = pool.filter(function (e) { return e.cat === 'stretch'; });
      if (!stretches.length) stretches = D.EXERCISES.filter(function (e) { return e.cat === 'stretch'; });
      return [{ ex: pick(rng, stretches), volume: 1 }];
    }
    var strength = pool.filter(function (e) { return e.cat === 'strength'; });
    var moving = pool.filter(function (e) { return e.cat === 'cardio' || e.cat === 'daily'; });
    var res = [];
    if (strength.length) res.push({ ex: pick(rng, strength), volume: vol });
    if (moving.length && phaseId !== 'intro') res.push({ ex: pick(rng, moving), volume: vol });
    if (!res.length) res.push({ ex: pick(rng, pool), volume: vol });
    return res;
  }

  function progressText(prog, vars, rng) {
    var L = D.PROGRESS_LINES;
    if (!prog) return fill(pick(rng, L.noData), vars);
    var parts = [];
    if (prog.diff !== null) {
      var v = Object.assign({}, vars, { diffAbs: Math.abs(prog.diff) });
      if (prog.diff <= -0.2) parts.push(fill(pick(rng, L.down), v));
      else if (prog.diff < 0.2) parts.push(fill(pick(rng, L.flat), v));
      else if (prog.diff < 1) parts.push(fill(pick(rng, L.upSmall), v));
      else parts.push(fill(pick(rng, L.upBig), v));
    }
    if (prog.reached) {
      parts.push(fill(pick(rng, L.goal), vars));
    } else if (prog.lost !== null && prog.lost > 0 && prog.pct !== undefined) {
      parts.push(fill(pick(rng, L.total), Object.assign({}, vars, { lostAbs: prog.lost, pct: prog.pct })));
    }
    if (!parts.length) {
      parts.push('記録をつけてくれてありがとうございます。これからの変化を一緒に見ていきましょうね。');
    }
    return parts.join('');
  }

  function decorate(text, tone, emojiLevel, rng) {
    if (!emojiLevel) return text;
    var set = (D.TONES[tone] || D.TONES.gentle).emoji;
    return text + pick(rng, set);
  }

  /**
   * コメントを生成します。
   * @param {object} client クライアント情報
   * @param {number} day    プログラムの何日目か（1〜365）
   * @param {object} opts   { variant, format: 'line'|'short'|'sns', emoji: 0|1|2, exercise, tip }
   */
  function generateComment(client, day, opts) {
    opts = opts || {};
    var format = opts.format || 'line';
    var emoji = opts.emoji === undefined ? 1 : opts.emoji;
    var withExercise = opts.exercise !== false;
    var withTip = opts.tip !== false;
    var variant = opts.variant || 0;

    var plan = buildPlan(client.totalDays);
    var info = dayInfo(client, day);
    var phaseSeg = phaseForDay(plan, info.day);
    var phase = D.PHASES[phaseSeg.id];
    var toneId = D.TONES[client.tone] ? client.tone : 'gentle';
    var tone = D.TONES[toneId];
    var rng = createRng(hashString([client.id || client.name || 'c', info.day, variant, format].join('|')));

    var vars = {
      name: displayName(client),
      day: info.day,
      total: info.total,
      remain: info.remain,
      phase: phase.name,
      coach: client.coach || ''
    };

    // 7日ごと（プログラムの最終日以外）は休養日の提案
    var restDay = info.day % 7 === 0 && info.day !== info.total;
    var ms = milestoneFor(info, plan);
    var tip = withTip ? chooseTip(client, phase.id, rng) : null;
    var exercises = withExercise ? chooseExercises(client, phase.id, rng, restDay) : [];

    if (format === 'sns') {
      return buildSns(client, info, phase, tip, exercises, rng, emoji);
    }

    var prog = progressAt(client, info.dateStr);
    var sections = [];

    // 1. あいさつ
    sections.push(decorate(fill(pick(rng, tone.openings), vars), toneId, emoji, rng));

    // 2. 進捗への声かけ
    if (opts.progress !== false) sections.push(progressText(prog, vars, rng));

    // 3. 節目のメッセージ or 期ごとのメッセージ
    if (ms) {
      sections.push(fill(D.MILESTONES[ms], vars));
    } else {
      var body = fill(pick(rng, phase.bodies), vars);
      var wd = D.WEEKDAY_LINES[info.weekday];
      if (wd && client.startDate && rng() < 0.6 && format !== 'short') {
        body = fill(pick(rng, wd), vars) + '\n' + body;
      }
      sections.push(body);
    }

    if (format === 'short') {
      sections.push(fill(pick(rng, tone.closings), vars));
      return finalize(sections, client);
    }

    // 4. 今日のヒント
    if (tip) {
      var mark = emoji ? '💡' : '■';
      sections.push(mark + '今日のヒント「' + tip.title + '」\n' + fill(tip.body, vars));
    }

    // 5. 運動の提案
    if (exercises.length) {
      var em = emoji ? '🏃' : '■';
      var lines = [em + (restDay ? '今日はおやすみの日' : '今日の運動')];
      if (restDay) lines.push(fill(pick(rng, D.REST_LINES), vars));
      exercises.forEach(function (x) {
        lines.push('・' + x.ex.name + '　' + x.ex.volume[x.volume] + '\n　' + x.ex.point);
      });
      if (!restDay) lines.push('体調がすぐれない日は、無理せず回数を減らしてくださいね。');
      sections.push(lines.join('\n'));
    }

    // 6. しめくくり
    sections.push(decorate(fill(pick(rng, tone.closings), vars), toneId, emoji >= 2 ? 1 : 0, rng));

    return finalize(sections, client);
  }

  function finalize(sections, client) {
    var text = sections.filter(Boolean).join('\n\n');
    if (client.coach) text += '\n\n' + client.coach;
    return text;
  }

  // SNS 投稿用：個人情報（名前・体重）を含めない一般向けの文章
  function buildSns(client, info, phase, tip, exercises, rng, emoji) {
    var lines = [];
    var head = emoji ? '🌿' : '';
    lines.push(head + '【ダイエット' + info.day + '日目のヒント】');
    lines.push(pick(rng, [
      '今日も自分のペースで大丈夫。',
      '小さな積み重ねが、いちばんの近道です。',
      '完璧より「続けること」を大切に。',
      'がんばっているあなたへ。'
    ]));
    if (tip) {
      lines.push('');
      lines.push((emoji ? '💡' : '■') + tip.title);
      lines.push(tip.body);
    }
    if (exercises.length) {
      var x = exercises[0];
      lines.push('');
      lines.push((emoji ? '🏃' : '■') + '今日の運動：' + x.ex.name + '（' + x.ex.volume[x.volume] + '）');
    }
    lines.push('');
    var tags = D.HASHTAGS.slice(0, 3).concat(['#' + phase.name]);
    lines.push(tags.join(' '));
    return lines.join('\n');
  }

  // 停滞期・場面別メッセージ
  function plateauMessage(client, sceneId, opts) {
    opts = opts || {};
    var scene = D.PLATEAU_SCENES.filter(function (s) { return s.id === sceneId; })[0];
    if (!scene) return '';
    var toneId = D.TONES[client.tone] ? client.tone : 'gentle';
    var tone = D.TONES[toneId];
    var rng = createRng(hashString([client.id || 'c', sceneId, opts.variant || 0].join('|')));
    var vars = { name: displayName(client), coach: client.coach || '' };
    var emoji = opts.emoji === undefined ? 1 : opts.emoji;
    var parts = [];
    parts.push(fill(vars.name + '、', vars) + (toneId === 'polite' ? 'ご連絡ありがとうございます。' : '連絡ありがとうございます。'));
    parts.push(fill(scene.message, vars));
    if (opts.withTips !== false) {
      parts.push((emoji ? '💡' : '■') + 'できることから少しずつ\n' + scene.tips.map(function (t) { return '・' + t; }).join('\n'));
    }
    parts.push(decorate(fill(pick(rng, tone.closings), vars), toneId, emoji, rng));
    return finalize(parts, client);
  }

  // 期間内の一括生成
  function generateRange(client, from, to, opts) {
    var total = clampDays(client.totalDays);
    var a = clamp(parseInt(from, 10) || 1, 1, total);
    var b = clamp(parseInt(to, 10) || a, a, total);
    var out = [];
    for (var d = a; d <= b; d++) {
      var info = dayInfo(client, d);
      var seg = phaseForDay(buildPlan(total), d);
      out.push({
        day: d,
        date: info.dateStr,
        weekday: info.weekdayJa,
        phase: seg.name,
        text: generateComment(client, d, opts)
      });
    }
    return out;
  }

  // X（旧Twitter）の文字数カウント（全角は2、半角は1として数え、上限280）
  function xWeightedLength(text) {
    var n = 0;
    for (var i = 0; i < text.length; i++) {
      var c = text.charCodeAt(i);
      if (c >= 0xd800 && c <= 0xdbff) { n += 2; i++; continue; }
      n += c <= 0x10ff || (c >= 0x2000 && c <= 0x200d) || (c >= 0x2010 && c <= 0x201f) || (c >= 0x2032 && c <= 0x2037) ? 1 : 2;
    }
    return n;
  }

  // ------------------------------------------------------------------
  // 定型コメント
  // ------------------------------------------------------------------

  // 定型文の差し込みに使う値（分からない値は「〇」にして、送る前に気づけるようにする）
  function templateVars(client, day) {
    var total = clampDays(client.totalDays);
    var d = clamp(parseInt(day, 10) || todayDay(client), 1, total);
    var phase = phaseForDay(buildPlan(total), d);
    var latest = latestLog(client);
    var start = parseFloat(client.startWeight);
    var goal = parseFloat(client.goalWeight);
    var cur = latest ? latest.weight : null;
    var blank = '〇';
    return {
      name: displayName(client),
      day: d,
      total: total,
      remain: total - d,
      phase: phase.name,
      coach: client.coach || '',
      startWeight: start ? start : blank,
      goalWeight: goal ? goal : blank,
      current: cur !== null ? cur : blank,
      lost: start && cur !== null ? round1(start - cur) : blank,
      toGoal: goal && cur !== null ? Math.max(0, round1(cur - goal)) : blank
    };
  }

  /**
   * 定型文にクライアントの情報を差し込みます。
   * @param {object} client
   * @param {string} text  定型文
   * @param {object} opts  { day, signature: 署名を付けるか（既定 true） }
   */
  function fillTemplate(client, text, opts) {
    opts = opts || {};
    var out = fill(text, templateVars(client, opts.day));
    if (opts.signature !== false && client.coach && out.indexOf(client.coach) === -1) {
      out += '\n\n' + client.coach;
    }
    return out;
  }

  // 定型文の一覧（組み込み＋ユーザー登録）。clientId を指定すると、そのクライアント専用の定型文も含める
  function listTemplates(custom, clientId) {
    var mine = (custom || []).filter(function (t) {
      return !t.clientId || t.clientId === clientId;
    }).map(function (t) { return Object.assign({ custom: true }, t); });
    return mine.concat(D.TEMPLATES);
  }

  // ------------------------------------------------------------------
  // ラポールを築く21日間のアファメーションメッセージ
  // ------------------------------------------------------------------
  var RAPPORT_TOTAL = 21;

  var RAPPORT_OPENINGS = {
    gentle: ['{name}、こんにちは。', '{name}、今日もお疲れさまです。', '{name}、体調はいかがですか？'],
    genki: ['{name}、こんにちは！', '{name}、今日も元気にいきましょう！', '{name}、お疲れさまです！'],
    polite: ['{name}、いつもお世話になっております。', '{name}、こんにちは。いつもありがとうございます。']
  };

  var AFFIRMATION_GUIDES = [
    '朝起きた時や寝る前に、心の中でゆっくり唱えてみてください。',
    '声に出しても、心の中でつぶやいても大丈夫です。少しだけ深呼吸してから唱えてみてくださいね。',
    'スマホの待ち受けやメモに書いておいて、ふとした時に読み返してみてください。',
    '鏡の前の自分に向けて、やさしく言ってあげてください。'
  ];

  var RAPPORT_CLOSINGS = {
    gentle: ['よかったら、気軽にお返事くださいね。どんなお話でもうれしいです。', 'お返事はいつでも大丈夫です。{name}のペースで、また話しかけてくださいね。'],
    genki: ['お返事、楽しみに待っています！', '気軽にお返事くださいね！どんなことでも大歓迎です！'],
    polite: ['よろしければ、お気軽にご返信ください。お話をうかがえるのを楽しみにしております。', 'ご返信はいつでも構いません。どうぞご自身のペースでお知らせください。']
  };

  function rapportDay(day) {
    var d = clamp(parseInt(day, 10) || 1, 1, RAPPORT_TOTAL);
    return D.RAPPORT_DAYS[d - 1];
  }

  /**
   * ラポールを築くアファメーションメッセージを作成します。
   * @param {object} client
   * @param {number} day   1〜21
   * @param {object} opts  { format: 'line'|'mail', emoji: 0|1|2, variant, startDate: 'YYYY-MM-DD' }
   * @returns {{subject: string, text: string, day: number, date: string|null, theme: string}}
   */
  function rapportMessage(client, day, opts) {
    opts = opts || {};
    var item = rapportDay(day);
    var format = opts.format === 'mail' ? 'mail' : 'line';
    var emoji = format === 'mail' ? 0 : (opts.emoji === undefined ? 1 : opts.emoji);
    var toneId = D.TONES[client.tone] ? client.tone : 'gentle';
    var rng = createRng(hashString([client.id || client.name || 'c', 'rapport', item.day, opts.variant || 0, format].join('|')));
    var goal = client.goalNote ? String(client.goalNote).trim() : '';
    var vars = { name: displayName(client), day: item.day, total: RAPPORT_TOTAL, goal: goal, coach: client.coach || '' };
    var body = fill(goal || !item.alt ? item.message : item.alt, vars);
    var affirmation = fill(item.affirmation, vars);
    var question = fill(item.question, vars);
    var guide = pick(rng, AFFIRMATION_GUIDES);
    var closing = fill(pick(rng, RAPPORT_CLOSINGS[toneId]), vars);
    var start = parseDate(opts.startDate || client.startDate);
    var date = start ? formatDate(addDays(start, item.day - 1)) : null;
    var subject = '【3週間サポート ' + item.day + '日目】' + fill(item.subject, vars);
    var parts = [];

    if (format === 'line') {
      parts.push(fill(pick(rng, RAPPORT_OPENINGS[toneId]), vars) + (emoji ? pick(rng, D.TONES[toneId].emoji) : ''));
      parts.push((emoji ? '🌱' : '■') + '3週間メッセージ ' + item.day + '日目「' + item.theme + '」');
      parts.push(body);
      parts.push((emoji ? '🌸' : '■') + '今日の言葉\n「' + affirmation + '」\n' + guide);
      parts.push((emoji ? '💬' : '■') + '今日の質問\n' + question);
      parts.push(closing + (emoji >= 2 ? pick(rng, D.TONES[toneId].emoji) : ''));
      if (client.coach) parts.push(client.coach);
      return { subject: subject, text: parts.join('\n\n'), day: item.day, date: date, theme: item.theme };
    }

    // メール形式
    var greet = 'いつもお世話になっております。' + (client.coach ? client.coach + 'です。' : '');
    parts.push(vars.name);
    parts.push(greet + '\n3週間サポートの' + item.day + '日目のメッセージをお送りします。今日のテーマは「' + item.theme + '」です。');
    parts.push(body);
    parts.push('◇ 今日の言葉 ◇\n「' + affirmation + '」\n' + guide);
    parts.push('◇ 今日の質問 ◇\n' + question + '\nこのメールにそのままご返信いただければ、お返事いたします。');
    parts.push(fill(pick(rng, RAPPORT_CLOSINGS.polite), vars) + '\n今後とも、どうぞよろしくお願いいたします。');
    if (client.coach) parts.push('━━━━━━━━━━\n' + client.coach + '\n━━━━━━━━━━');
    return { subject: subject, text: parts.join('\n\n'), day: item.day, date: date, theme: item.theme };
  }

  function rapportRange(client, from, to, opts) {
    var a = clamp(parseInt(from, 10) || 1, 1, RAPPORT_TOTAL);
    var b = clamp(parseInt(to, 10) || RAPPORT_TOTAL, a, RAPPORT_TOTAL);
    var out = [];
    for (var d = a; d <= b; d++) out.push(rapportMessage(client, d, opts));
    return out;
  }

  // しくみの説明文（クライアント向け）に名前を差し込む
  function mechanismText(client, id) {
    var s = D.MECHANISM_SHARES.filter(function (x) { return x.id === id; })[0];
    if (!s) return '';
    var text = fill(s.text, { name: displayName(client) });
    if (client.coach) text += '\n\n' + client.coach;
    return text;
  }

  return {
    MIN_DAYS: MIN_DAYS,
    MAX_DAYS: MAX_DAYS,
    ACTIVITY: ACTIVITY,
    buildPlan: buildPlan,
    phaseForDay: phaseForDay,
    metrics: metrics,
    estimateBmr: estimateBmr,
    progressAt: progressAt,
    sortedLogs: sortedLogs,
    latestLog: latestLog,
    dayInfo: dayInfo,
    todayDay: todayDay,
    generateComment: generateComment,
    generateRange: generateRange,
    plateauMessage: plateauMessage,
    displayName: displayName,
    xWeightedLength: xWeightedLength,
    templateVars: templateVars,
    fillTemplate: fillTemplate,
    listTemplates: listTemplates,
    RAPPORT_TOTAL: RAPPORT_TOTAL,
    rapportMessage: rapportMessage,
    rapportRange: rapportRange,
    mechanismText: mechanismText,
    formatDate: formatDate,
    parseDate: parseDate,
    clampDays: clampDays
  };
});
