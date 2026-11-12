/*
 * 栄養の計算（画面から独立した計算だけをまとめる）
 *
 * 根拠
 * - 基礎代謝の推定：Mifflin-St Jeor 式
 * - 活動量の係数：1.2 / 1.375 / 1.55 / 1.725（一般的に使われる係数）
 * - たんぱく質・脂質・炭水化物の割合：日本人の食事摂取基準（2025年版）の目標量の範囲内
 *   （たんぱく質 13〜20%、脂質 20〜30%、炭水化物 50〜65%）から 20% / 25% / 55% を採用
 * - 食塩相当量の目標量：日本人の食事摂取基準（2025年版）成人 男性 7.5g未満、女性 6.5g未満
 */
(function (root) {
  'use strict';

  var ACTIVITY = {
    low: { label: 'ほとんど座っている（デスクワーク中心）', factor: 1.2 },
    light: { label: '軽く動く（週1〜3回の運動・立ち仕事）', factor: 1.375 },
    moderate: { label: 'よく動く（週3〜5回の運動）', factor: 1.55 },
    high: { label: 'とてもよく動く（ほぼ毎日の運動・肉体労働）', factor: 1.725 }
  };
  var PACES = {
    keep: { label: '今の体重を保つ', deficit: 0 },
    gentle: { label: 'ゆっくり減らす（1日 約250kcal 控えめ）', deficit: 250 },
    standard: { label: 'しっかり減らす（1日 約500kcal 控えめ）', deficit: 500 }
  };
  var PFC = { protein: 0.2, fat: 0.25, carbs: 0.55 };
  var MEAL_TYPES = ['朝食', '昼食', '夕食', '間食'];

  function num(v) { var n = parseFloat(v); return isNaN(n) ? null : n; }
  function round1(n) { return Math.round(n * 10) / 10; }

  function bmr(p) {
    var w = num(p.weight), h = num(p.height), a = num(p.age);
    if (!w || !h || !a) return null;
    var base = 10 * w + 6.25 * h - 5 * a;
    if (p.sex === 'male') return Math.round(base + 5);
    if (p.sex === 'female') return Math.round(base - 161);
    return Math.round(base - 78);
  }

  function bmi(p) {
    var w = num(p.weight), h = num(p.height);
    if (!w || !h) return null;
    return round1(w / Math.pow(h / 100, 2));
  }

  function bmiLabel(v) {
    if (v === null) return '';
    return v < 18.5 ? '低体重' : v < 25 ? '標準' : '肥満';
  }

  /** プロフィールから1日の目標を計算する */
  function targets(p) {
    var b = bmr(p);
    if (!b) return null;
    var act = ACTIVITY[p.activity] || ACTIVITY.low;
    var tdee = Math.round(b * act.factor);
    var pace = PACES[p.pace] || PACES.gentle;
    // 目標体重が今の体重以上なら「保つ」
    if (num(p.goalWeight) && num(p.weight) && num(p.goalWeight) >= num(p.weight)) pace = PACES.keep;
    var kcal = Math.round((tdee - pace.deficit) / 10) * 10;
    var warnings = [];
    // 目標は基礎代謝を下回らないようにする（下回る場合は基礎代謝に合わせる）
    var floor = Math.ceil(b / 10) * 10;
    if (kcal < floor) {
      warnings.push('選んだペースだと目標が基礎代謝（約' + b + 'kcal）を下回るため、目標を基礎代謝に合わせています。体への負担を避けるためです。');
      kcal = floor;
    }
    var cur = bmi(p);
    if (cur !== null && cur < 18.5) warnings.push('BMIが18.5未満（低体重）です。減量より、体を整えることを優先しましょう。');
    if (num(p.age) !== null && num(p.age) < 18) warnings.push('18歳未満の方は成長期のため、食事を減らすダイエットは保護者や医師と相談してください。');
    return {
      bmr: b,
      tdee: tdee,
      kcal: kcal,
      deficit: Math.max(0, tdee - kcal),
      protein_g: Math.round(kcal * PFC.protein / 4),
      fat_g: Math.round(kcal * PFC.fat / 9),
      carbs_g: Math.round(kcal * PFC.carbs / 4),
      salt_g: p.sex === 'male' ? 7.5 : 6.5,
      warnings: warnings
    };
  }

  // ------------------------------------------------------------------
  // 日付
  // ------------------------------------------------------------------
  function pad(n) { return String(n).padStart(2, '0'); }
  function dateKey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function parseKey(s) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ''); return m ? new Date(+m[1], +m[2] - 1, +m[3], 12) : null; }
  function addDays(s, n) { var d = parseKey(s); d.setDate(d.getDate() + n); return dateKey(d); }
  var WD = ['日', '月', '火', '水', '木', '金', '土'];
  function dateLabel(s) { var d = parseKey(s); return (d.getMonth() + 1) + '月' + d.getDate() + '日（' + WD[d.getDay()] + '）'; }

  /** 時刻から食事の種類を推測する */
  function guessMealType(date) {
    var h = (date || new Date()).getHours();
    if (h >= 4 && h < 10) return '朝食';
    if (h >= 10 && h < 15) return '昼食';
    if (h >= 15 && h < 17) return '間食';
    if (h >= 17 && h < 23) return '夕食';
    return '間食';
  }

  // ------------------------------------------------------------------
  // 集計
  // ------------------------------------------------------------------
  function emptyTotals() { return { kcal: 0, protein_g: 0, fat_g: 0, carbs_g: 0, salt_g: 0 }; }

  function dayMeals(meals, key) {
    return (meals || []).filter(function (m) { return m.date === key; })
      .sort(function (a, b) { return MEAL_TYPES.indexOf(a.type) - MEAL_TYPES.indexOf(b.type) || String(a.time).localeCompare(String(b.time)); });
  }

  function sumTotals(meals) {
    var t = emptyTotals();
    (meals || []).forEach(function (m) {
      var x = m.totals || {};
      Object.keys(t).forEach(function (k) { t[k] += Number(x[k]) || 0; });
    });
    t.kcal = Math.round(t.kcal);
    ['protein_g', 'fat_g', 'carbs_g', 'salt_g'].forEach(function (k) { t[k] = round1(t[k]); });
    return t;
  }

  /** 一品ずつの値から食事の合計を計算し直す（手で修正した時に使う） */
  function totalsFromItems(items) {
    var t = emptyTotals();
    (items || []).forEach(function (it) { Object.keys(t).forEach(function (k) { t[k] += Math.max(0, Number(it[k]) || 0); }); });
    t.kcal = Math.round(t.kcal);
    ['protein_g', 'fat_g', 'carbs_g', 'salt_g'].forEach(function (k) { t[k] = round1(t[k]); });
    return t;
  }

  /** 連続で記録した日数（今日、または昨日までさかのぼって数える） */
  function streak(meals, todayKey) {
    var days = {};
    (meals || []).forEach(function (m) { days[m.date] = true; });
    var d = days[todayKey] ? todayKey : addDays(todayKey, -1);
    var n = 0;
    while (days[d]) { n++; d = addDays(d, -1); }
    return n;
  }

  /** まだ記録していない主な食事 */
  function remainingMeals(meals, todayKey, now) {
    var done = dayMeals(meals, todayKey).map(function (m) { return m.type; });
    var h = (now || new Date()).getHours();
    return ['朝食', '昼食', '夕食'].filter(function (t) {
      if (done.indexOf(t) !== -1) return false;
      if (t === '朝食' && h >= 11) return false;
      if (t === '昼食' && h >= 16) return false;
      return true;
    });
  }

  /** 1日の判定 */
  function verdict(total, tg, remaining) {
    if (!tg) return { level: 'none', title: 'プロフィールを入力しましょう', body: 'プランの画面で身長・体重・年齢などを入れると、1日の目標が計算されます。' };
    var diff = total.kcal - tg.kcal;
    if (total.kcal === 0) return { level: 'none', title: '今日の食事を記録しましょう', body: '写真を撮るだけで、AIが栄養を推定します。' };
    if (diff > 0) {
      return {
        level: 'over', title: '目標より +' + diff + 'kcal',
        body: '目標の' + tg.kcal + 'kcalを超えています。' + (remaining.length ? 'このあとの' + remaining.join('・') + 'は、野菜とたんぱく質を中心に軽めにすると整いやすくなります。' : '今日は軽く体を動かして、明日いつもの食事に戻せば大丈夫です。')
      };
    }
    var left = -diff;
    if (remaining.length) return { level: 'ok', title: 'あと ' + left + 'kcal', body: 'このあとの' + remaining.join('・') + 'で、あと約' + left + 'kcalが目安です。' };
    if (left > tg.kcal * 0.3) return { level: 'low', title: '目標まで ' + left + 'kcal', body: '今日は少なめです。食べなさすぎると続けにくくなるので、たんぱく質を中心にしっかり食べてくださいね。' };
    return { level: 'ok', title: '目標の範囲内です', body: '今日は目標の範囲に収まっています。この調子です。' };
  }

  /** 1食の注意（1日の目安に対して） */
  function mealWarnings(t, tg) {
    var w = [];
    if (!tg || !t) return w;
    if (t.fat_g >= tg.fat_g * 0.5) w.push('脂質' + t.fat_g + 'g は、1日の目安（' + tg.fat_g + 'g）の半分以上です');
    if (t.salt_g >= tg.salt_g * 0.5) w.push('塩分' + t.salt_g + 'g は、1日の目安（' + tg.salt_g + 'g未満）の半分以上です');
    if (t.kcal >= tg.kcal * 0.5) w.push('この1食で、1日の目標の半分以上（' + t.kcal + 'kcal）になります');
    return w;
  }

  /** AI を使えない時の、計算だけによるアドバイス */
  function ruleAdvice(total, tg, remaining) {
    var tips = [];
    if (!tg) return { verdict_title: 'まずはプロフィールから', verdict_body: '目標が分かると、具体的なアドバイスができます。', tips: [] };
    var left = tg.kcal - total.kcal;
    if (total.protein_g >= tg.protein_g * 0.6) tips.push({ kind: 'praise', title: 'たんぱく質がとれています', body: 'ここまでで' + total.protein_g + 'g。筋肉を守りながら進められています。' });
    else tips.push({ kind: 'protein', title: 'たんぱく質をもう少し', body: '目安は1日' + tg.protein_g + 'g。卵、納豆、豆腐、魚、鶏肉などを次の食事に1品足してみましょう。' });
    if (remaining.length && left > 0) tips.push({ kind: 'meal', title: remaining.join('・') + 'は約' + left + 'kcalが目安', body: '主食・主菜・副菜をそろえて、揚げ物より焼く・煮る料理を選ぶと収まりやすくなります。' });
    if (left < 0) tips.push({ kind: 'activity', title: '少し体を動かしましょう', body: '食後に10〜20分歩くなど、無理のない範囲で体を動かしてみてください。明日いつもの食事に戻せば大丈夫です。' });
    if (total.salt_g > tg.salt_g) tips.push({ kind: 'salt', title: '塩分が目安を超えています', body: '汁物は具を中心に、汁を少し残しましょう。水分をこまめにとるのもおすすめです。' });
    if (total.fat_g > tg.fat_g) tips.push({ kind: 'meal', title: '脂質が多めです', body: '次の食事は、揚げ物や脂身の多い肉を控えて、魚や豆腐、野菜を中心にすると整います。' });
    return { verdict_title: left >= 0 ? '順調です' : '少しだけ調整しましょう', verdict_body: '記録をもとに計算したアドバイスです。AI の設定をすると、より具体的な提案が届きます。', tips: tips.slice(0, 4) };
  }

  /** 推定値の確からしさの表示 */
  var CONFIDENCE = { high: '推定の確からしさ：高め', medium: '推定の確からしさ：ふつう', low: '推定の確からしさ：低め（量を確認してください）' };

  var api = {
    ACTIVITY: ACTIVITY, PACES: PACES, PFC: PFC, MEAL_TYPES: MEAL_TYPES, CONFIDENCE: CONFIDENCE,
    bmr: bmr, bmi: bmi, bmiLabel: bmiLabel, targets: targets,
    dateKey: dateKey, parseKey: parseKey, addDays: addDays, dateLabel: dateLabel, guessMealType: guessMealType,
    dayMeals: dayMeals, sumTotals: sumTotals, totalsFromItems: totalsFromItems, streak: streak, remainingMeals: remainingMeals,
    verdict: verdict, mealWarnings: mealWarnings, ruleAdvice: ruleAdvice
  };
  root.MealCalc = api;
})(typeof window !== 'undefined' ? window : globalThis);
