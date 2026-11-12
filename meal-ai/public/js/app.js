/*
 * AI食事コーチ：画面の操作
 */
(function () {
  'use strict';

  var M = window.MealCalc;
  var KEY = 'mealAi.v1';

  var state = {
    profile: { name: '', sex: 'female', age: '', height: '', weight: '', goalWeight: '', activity: 'low', pace: 'gentle' },
    meals: [],
    weights: [],
    passcode: '',
    advice: null
  };
  var ui = { view: 'home', ai: { ready: false, mock: false, checked: false }, photo: null, mealType: null, result: null, adviceLoading: false };

  // ------------------------------------------------------------------
  // 道具
  // ------------------------------------------------------------------
  function $(s, r) { return (r || document).querySelector(s); }
  function $all(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(s) {
    return String(s === undefined || s === null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function uid() { return 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function todayKey() { return M.dateKey(new Date()); }
  function nowTime() { var d = new Date(); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }
  function fmt(n) { return Number(n || 0).toLocaleString('ja-JP'); }

  var toastTimer;
  function toast(msg) {
    var t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2600);
  }

  function load() {
    try {
      var d = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (d) {
        Object.assign(state.profile, d.profile || {});
        state.meals = d.meals || [];
        state.weights = d.weights || [];
        state.passcode = d.passcode || '';
        state.advice = d.advice || null;
      }
    } catch (e) { /* 保存できない環境でも動かす */ }
  }
  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
      return true;
    } catch (e) {
      toast('保存できませんでした。容量がいっぱいの可能性があります。古い記録を書き出して整理してください。');
      return false;
    }
  }

  function targets() { return M.targets(state.profile); }

  // ------------------------------------------------------------------
  // サーバーとのやり取り
  // ------------------------------------------------------------------
  function callApi(path, body) {
    var headers = { 'Content-Type': 'application/json' };
    if (state.passcode) headers['x-app-passcode'] = state.passcode;
    return fetch(path, { method: 'POST', headers: headers, body: JSON.stringify(body) })
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (data) {
          if (!r.ok) throw new Error(data.error || ('通信エラー（' + r.status + '）'));
          return data;
        });
      }, function () { throw new Error('サーバーに接続できませんでした。通信状態を確認してください。'); });
  }

  function checkHealth() {
    return fetch('api/health').then(function (r) { return r.json(); }).then(function (d) {
      ui.ai = { ready: !!d.ready, mock: !!d.mock, model: d.model, passcodeRequired: !!d.passcodeRequired, checked: true };
    }, function () {
      ui.ai = { ready: false, mock: false, offline: true, checked: true };
    }).then(renderStatus);
  }

  function renderStatus() {
    var bar = $('#statusBar');
    var msg = '';
    if (ui.ai.mock) msg = '🧪 デモモードです。写真は解析されず、サンプルの結果が表示されます。';
    else if (ui.ai.offline) msg = 'AI に接続できません。サーバーを起動してから開いてください。写真なしの入力は使えます。';
    else if (ui.ai.checked && !ui.ai.ready) msg = 'AI の設定がまだです（管理者が ANTHROPIC_API_KEY を設定すると使えます）。写真なしの入力は使えます。';
    bar.hidden = !msg;
    bar.textContent = msg;
    $('#btnAnalyze').disabled = !ui.photo || !(ui.ai.ready);
    var st = $('#aiStatus');
    st.textContent = ui.ai.mock ? 'デモモード（サンプルの結果を表示）' : ui.ai.ready ? '✅ AI を使えます（モデル：' + (ui.ai.model || '') + '）' : ui.ai.offline ? '❌ サーバーに接続できません' : '⚠️ AI の設定がまだです';
  }

  // ------------------------------------------------------------------
  // 画面の切り替え
  // ------------------------------------------------------------------
  function go(view) {
    ui.view = view;
    $all('.view').forEach(function (v) { v.hidden = v.getAttribute('data-view') !== view; });
    $all('.tab').forEach(function (t) { t.classList.toggle('active', t.getAttribute('data-go') === view); });
    window.scrollTo({ top: 0 });
    render();
  }

  function render() {
    if (ui.view === 'home') renderHome();
    if (ui.view === 'nutrition') renderNutrition();
    if (ui.view === 'record') renderRecord();
    if (ui.view === 'history') renderHistory();
    if (ui.view === 'plan') renderPlan();
  }

  // ------------------------------------------------------------------
  // ホーム
  // ------------------------------------------------------------------
  function mealItemHtml(m) {
    var tg = targets();
    var warn = M.mealWarnings(m.totals, tg).length;
    var tag = (m.tags && m.tags.length ? m.tags.slice(0, 2).join('・') : '') + (warn ? (m.tags && m.tags.length ? '　' : '') + '⚠️ 気をつけたい点あり' : '');
    return '<li><button type="button" class="meal-item" data-meal="' + esc(m.id) + '">' +
      (m.thumb ? '<img src="' + m.thumb + '" alt="">' : '<span class="no-img">🍽</span>') +
      '<span><span class="m-name">' + esc(m.type + '・' + (m.dish || '食事')) + '</span><span class="m-tag">' + esc(tag || m.time || '') + '</span></span>' +
      '<span class="m-kcal">' + fmt(m.totals.kcal) + '<small>kcal</small></span></button></li>';
  }

  function ringSvg(intake, target) {
    var r = 54, c = 2 * Math.PI * r;
    var ratio = target ? Math.min(intake / target, 1) : 0;
    var over = target && intake > target;
    return '<svg viewBox="0 0 132 132" role="img" aria-label="目標' + target + 'kcalのうち' + intake + 'kcal">' +
      '<defs><linearGradient id="rg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + (over ? '#fb7185' : '#a78bfa') + '"/><stop offset="1" stop-color="' + (over ? '#e11d48' : '#ec4899') + '"/></linearGradient></defs>' +
      '<circle class="track" cx="66" cy="66" r="' + r + '" fill="none" stroke-width="12"/>' +
      '<circle cx="66" cy="66" r="' + r + '" fill="none" stroke="url(#rg)" stroke-width="12" stroke-linecap="round" stroke-dasharray="' + (c * ratio) + ' ' + c + '" transform="rotate(-90 66 66)"/>' +
      '<text class="num" x="66" y="68" text-anchor="middle">' + fmt(intake) + '</text>' +
      '<text class="sub" x="66" y="88" text-anchor="middle">/ ' + (target ? fmt(target) + ' 目標' : '目標未設定') + '</text></svg>';
  }

  function renderHome() {
    var p = state.profile;
    var tg = targets();
    var key = todayKey();
    var meals = M.dayMeals(state.meals, key);
    var total = M.sumTotals(meals);
    var remaining = M.remainingMeals(state.meals, key, new Date());
    var streak = M.streak(state.meals, key);
    var bmi = M.bmi(p);

    $('#helloName').textContent = 'こんにちは、' + (p.name ? p.name + 'さん' : 'ようこそ') + ' 👋';
    $('#helloMeta').textContent = M.dateLabel(key) + (streak ? '・記録 ' + streak + '日連続 🔥' : '');
    var meta = [];
    if (p.height) meta.push('📏' + p.height + 'cm');
    if (p.weight) meta.push('⚖️' + p.weight + 'kg');
    if (bmi !== null) meta.push('BMI ' + bmi + '（' + M.bmiLabel(bmi) + '）');
    if (tg) meta.push('🎯目標 ' + fmt(tg.kcal) + 'kcal/日');
    $('#helloBody').textContent = meta.join('・') || 'プランの画面で、身長や体重を入れてください。';

    var v = M.verdict(total, tg, remaining);
    var card = $('#verdictCard');
    card.className = 'verdict ' + v.level;
    card.innerHTML = '<div class="v-label">' + (v.level === 'over' ? '⚠️ ' : '✨ ') + '今日の判定</div><div class="v-title">' + esc(v.title) + '</div><div class="v-body">' + esc(v.body) + '</div>';

    $('#ring').innerHTML = ringSvg(total.kcal, tg ? tg.kcal : 0);
    var eaten = meals.map(function (m) { return m.type.replace('食', ''); }).filter(function (x, i, a) { return a.indexOf(x) === i; }).join('＋');
    var diff = tg ? total.kcal - tg.kcal : null;
    $('#balanceList').innerHTML =
      '<div><dt><i style="background:#8b5cf6"></i>摂取' + (eaten ? '（' + esc(eaten) + '）' : '') + '</dt><dd>' + fmt(total.kcal) + ' kcal</dd></div>' +
      '<div><dt><i style="background:#10b981"></i>目標摂取</dt><dd>' + (tg ? fmt(tg.kcal) + ' kcal' : '―') + '</dd></div>' +
      '<div><dt><i style="background:#60a5fa"></i>消費目安</dt><dd>' + (tg ? '約' + fmt(tg.tdee) + ' kcal' : '―') + '</dd></div>' +
      '<div><dt><i style="background:#f43f5e"></i>目標との差</dt><dd class="' + (diff > 0 ? 'plus' : 'minus') + '">' + (diff === null ? '―' : (diff > 0 ? '+' : '') + fmt(diff) + ' kcal') + '</dd></div>';

    $('#todayMeals').innerHTML = meals.map(mealItemHtml).join('') || '<li class="empty">まだ記録がありません。下の ＋ から写真を撮ってみましょう。</li>';
  }

  // ------------------------------------------------------------------
  // 栄養
  // ------------------------------------------------------------------
  var TIP_ICON = { praise: '👏', meal: '🍽', salt: '💧', protein: '🥚', activity: '🚶', water: '💧', sleep: '🌙', other: '💡' };

  function adviceSignature() {
    var meals = M.dayMeals(state.meals, todayKey());
    return todayKey() + '|' + meals.map(function (m) { return m.id + ':' + m.totals.kcal; }).join(',') + '|' + JSON.stringify(state.profile);
  }

  function renderNutrition() {
    var tg = targets();
    var key = todayKey();
    var total = M.sumTotals(M.dayMeals(state.meals, key));
    $('#nutriDate').textContent = M.dateLabel(key);
    var rows = [
      ['たんぱく質 P', total.protein_g, tg && tg.protein_g, 'g', 'var(--p)', false],
      ['脂質 F', total.fat_g, tg && tg.fat_g, 'g', 'var(--f)', false],
      ['炭水化物 C', total.carbs_g, tg && tg.carbs_g, 'g', 'var(--c)', false],
      ['塩分', total.salt_g, tg && tg.salt_g, 'g未満', 'var(--s)', true]
    ];
    $('#nutriBars').innerHTML = rows.map(function (r) {
      var over = r[2] && r[1] > r[2];
      var pct = r[2] ? Math.min(100, r[1] / r[2] * 100) : 0;
      return '<div class="bar-row"><div class="bar-head"><span>' + r[0] + '</span><span class="' + (over ? 'over' : '') + '">' + r[1] + ' / ' + (r[2] ? r[2] + r[3] : '―') + (over && r[5] ? '（オーバー）' : '') + '</span></div>' +
        '<div class="bar-track"><div class="bar-fill" style="width:' + pct + '%;background:' + (over ? 'var(--warn)' : r[4]) + '"></div></div></div>';
    }).join('');
    renderAdvice(false);
  }

  function renderAdvice(force) {
    var box = $('#adviceBox');
    var tg = targets();
    var key = todayKey();
    var meals = M.dayMeals(state.meals, key);
    var total = M.sumTotals(meals);
    var remaining = M.remainingMeals(state.meals, key, new Date());
    var sig = adviceSignature();
    var cached = state.advice && state.advice.sig === sig ? state.advice.data : null;

    function show(data, note) {
      box.innerHTML = '<div class="advice-head"><strong>' + esc(data.verdict_title) + (data.demo ? '<span class="demo-flag">デモ</span>' : '') + '</strong><span class="small muted">' + esc(data.verdict_body) + '</span></div>' +
        (data.tips || []).map(function (t) {
          return '<div class="tip k-' + esc(t.kind) + '"><span class="tip-icon">' + (TIP_ICON[t.kind] || '💡') + '</span><div><strong>' + esc(t.title) + '</strong>　' + esc(t.body) + '</div></div>';
        }).join('') + (note ? '<p class="muted small">' + esc(note) + '</p>' : '');
    }

    if (!meals.length) { box.innerHTML = '<p class="empty">食事を記録すると、アドバイスが届きます。</p>'; return; }
    if (cached && !force) { show(cached); return; }
    if (!ui.ai.ready) { show(M.ruleAdvice(total, tg, remaining)); return; }
    if (ui.adviceLoading) return;
    ui.adviceLoading = true;
    box.innerHTML = '<div class="loading"><div class="spinner"></div><p class="small">AIコーチがアドバイスを考えています…</p></div>';
    var p = state.profile;
    callApi('api/advice', {
      time: nowTime(),
      profile: { 呼び名: p.name, 性別: p.sex, 年齢: p.age, 身長: p.height, 体重: p.weight, 目標体重: p.goalWeight },
      targets: tg ? { エネルギー: tg.kcal + 'kcal', たんぱく質: tg.protein_g + 'g', 脂質: tg.fat_g + 'g', 炭水化物: tg.carbs_g + 'g', 塩分: tg.salt_g + 'g未満', 消費の目安: tg.tdee + 'kcal' } : null,
      totals: total,
      meals: meals.map(function (m) { return { 種類: m.type, 時刻: m.time, 料理: m.dish, 合計: m.totals }; }),
      remaining: remaining
    }).then(function (data) {
      state.advice = { sig: sig, data: data };
      save();
      show(data);
    }, function (err) {
      show(M.ruleAdvice(total, tg, remaining), 'AI のアドバイスを取得できなかったため、計算によるアドバイスを表示しています（' + err.message + '）');
    }).then(function () { ui.adviceLoading = false; });
  }

  // ------------------------------------------------------------------
  // 記録
  // ------------------------------------------------------------------
  function renderRecord() {
    if (!ui.mealType) ui.mealType = M.guessMealType(new Date());
    $('#mealTypeChips').innerHTML = M.MEAL_TYPES.map(function (t) {
      return '<button type="button" class="chip' + (t === ui.mealType ? ' active' : '') + '" data-type="' + t + '">' + t + '</button>';
    }).join('');
    if (!$('#recDate').value) $('#recDate').value = todayKey();
    if (!$('#recTime').value) $('#recTime').value = nowTime();
    renderStatus();
  }

  function loadImage(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () { resolve({ img: img, url: url }); };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('この写真は読み込めませんでした。別の写真でお試しください。')); };
      img.src = url;
    });
  }

  function toJpeg(img, max, quality) {
    var scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    var w = Math.max(1, Math.round(img.naturalWidth * scale));
    var h = Math.max(1, Math.round(img.naturalHeight * scale));
    var canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL('image/jpeg', quality);
  }

  function onFile(file) {
    if (!file) return;
    loadImage(file).then(function (r) {
      // 解析用は長い辺 1280px、保存用のサムネイルは 240px に縮める
      var full = toJpeg(r.img, 1280, 0.82);
      var thumb = toJpeg(r.img, 240, 0.62);
      URL.revokeObjectURL(r.url);
      ui.photo = { dataUrl: full, base64: full.split(',')[1], thumb: thumb };
      var pv = $('#preview');
      pv.src = full;
      pv.hidden = false;
      $('#resultCard').hidden = true;
      renderStatus();
    }, function (e) { toast(e.message); });
  }

  function analyze() {
    if (!ui.photo) return;
    $('#loading').hidden = false;
    $('#resultCard').hidden = true;
    $('#btnAnalyze').disabled = true;
    callApi('api/analyze', { image: ui.photo.base64, mediaType: 'image/jpeg', mealType: ui.mealType, memo: $('#recMemo').value.trim() })
      .then(function (data) {
        ui.result = data;
        renderResult();
      }, function (err) { toast(err.message); })
      .then(function () { $('#loading').hidden = true; renderStatus(); });
  }

  function manualEntry() {
    ui.result = { dish_name: '', summary: '', items: [{ name: '', portion: '', kcal: 0, protein_g: 0, fat_g: 0, carbs_g: 0, salt_g: 0 }], confidence: null, assumptions: [], good_points: [], cautions: [], tags: [], manual: true };
    renderResult();
  }

  var NUM_KEYS = [['kcal', 'kcal'], ['protein_g', 'P'], ['fat_g', 'F'], ['carbs_g', 'C'], ['salt_g', '塩分']];

  function tilesHtml(t, tg) {
    var warnKeys = {};
    if (tg) {
      if (t.fat_g >= tg.fat_g * 0.5) warnKeys.fat_g = true;
      if (t.salt_g >= tg.salt_g * 0.5) warnKeys.salt_g = true;
    }
    var label = { kcal: 'kcal', protein_g: 'たんぱく質', fat_g: '脂質', carbs_g: '炭水化物', salt_g: '塩分' };
    return '<div class="tiles">' + NUM_KEYS.map(function (k) {
      return '<div class="tile' + (warnKeys[k[0]] ? ' hot' : '') + '"><b>' + (k[0] === 'kcal' ? fmt(t.kcal) : t[k[0]] + 'g') + '</b><span>' + label[k[0]] + '</span></div>';
    }).join('') + '</div>';
  }

  function itemsTableHtml(items) {
    var label = { kcal: 'kcal', protein_g: 'P(g)', fat_g: 'F(g)', carbs_g: 'C(g)', salt_g: '塩分(g)' };
    return '<div class="items">' + items.map(function (it, i) {
      return '<div class="item" data-i="' + i + '">' +
        '<div class="item-top"><input class="name" data-k="name" value="' + esc(it.name) + '" placeholder="料理名" aria-label="料理名">' +
        '<button type="button" class="del" data-del="' + i + '" aria-label="この料理を削除">✕</button></div>' +
        (it.portion ? '<p class="portion">推定量：' + esc(it.portion) + '</p>' : '') +
        '<div class="item-nums">' + NUM_KEYS.map(function (k) {
          return '<label><span>' + label[k[0]] + '</span><input type="number" inputmode="decimal" step="' + (k[0] === 'kcal' ? 1 : 0.1) + '" min="0" data-k="' + k[0] + '" value="' + it[k[0]] + '"></label>';
        }).join('') + '</div></div>';
    }).join('') + '</div>';
  }

  function notesHtml(r) {
    var h = '';
    if (r.good_points && r.good_points.length) h += '<div class="note good">🌱 よいところ<ul>' + r.good_points.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></div>';
    if (r.cautions && r.cautions.length) h += '<div class="note care">💡 さらに整えるなら<ul>' + r.cautions.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></div>';
    if (r.assumptions && r.assumptions.length) h += '<div class="note">📝 推定の前提<ul>' + r.assumptions.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></div>';
    return h;
  }

  function renderResult() {
    var r = ui.result;
    var tg = targets();
    var t = M.totalsFromItems(r.items);
    var warns = M.mealWarnings(t, tg);
    var card = $('#resultCard');
    card.hidden = false;
    card.innerHTML =
      '<span class="ai-badge">' + (r.manual ? '✍️ 手入力' : '✨ AIが写真を解析しました') + '</span>' + (r.demo ? '<span class="demo-flag">デモ</span>' : '') +
      (ui.photo && !r.manual ? '<img class="r-photo" src="' + ui.photo.dataUrl + '" alt="">' : '') +
      '<label class="field" style="margin-top:10px">料理名<input id="resDish" value="' + esc(r.dish_name) + '" placeholder="例：焼き魚定食"></label>' +
      (r.summary ? '<p class="r-summary">' + esc(r.summary) + '</p>' : '') +
      '<div id="resTiles">' + tilesHtml(t, tg) + '</div>' +
      '<div id="resWarn">' + (warns.length ? '<div class="alert">⚠️ ' + esc(warns.join('。')) + '。</div>' : '') + '</div>' +
      (r.confidence ? '<p class="conf">' + esc(M.CONFIDENCE[r.confidence] || '') + '　数字は押して修正できます</p>' : '<p class="conf">分かる範囲で入力してください。パッケージの栄養成分表示が便利です。</p>') +
      '<div id="resItems">' + itemsTableHtml(r.items) + '</div>' +
      '<button type="button" class="link-btn" id="btnAddRow">＋ 料理を追加</button>' +
      notesHtml(r) +
      '<div class="btn-row"><button type="button" class="btn primary" id="btnSave" style="flex:1">記録する</button><button type="button" class="btn ghost" id="btnDiscard">やり直す</button></div>';
    card.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function refreshResultTotals() {
    var tg = targets();
    var t = M.totalsFromItems(ui.result.items);
    var warns = M.mealWarnings(t, tg);
    $('#resTiles').innerHTML = tilesHtml(t, tg);
    $('#resWarn').innerHTML = warns.length ? '<div class="alert">⚠️ ' + esc(warns.join('。')) + '。</div>' : '';
  }

  function saveResult() {
    var r = ui.result;
    var items = r.items.filter(function (it) { return it.name.trim() || it.kcal > 0; });
    if (!items.length) { toast('料理を1つ以上入力してください'); return; }
    var meal = {
      id: uid(),
      date: $('#recDate').value || todayKey(),
      time: $('#recTime').value || nowTime(),
      type: ui.mealType,
      dish: $('#resDish').value.trim() || items[0].name || '食事',
      summary: r.summary || '',
      items: items,
      totals: M.totalsFromItems(items),
      confidence: r.confidence || null,
      assumptions: r.assumptions || [],
      good: r.good_points || [],
      cautions: r.cautions || [],
      tags: r.tags || [],
      thumb: r.manual ? null : (ui.photo ? ui.photo.thumb : null),
      demo: !!r.demo,
      manual: !!r.manual,
      memo: $('#recMemo').value.trim()
    };
    state.meals.push(meal);
    if (!save()) { state.meals.pop(); return; }
    resetRecord();
    toast('記録しました。今日の合計は ' + fmt(M.sumTotals(M.dayMeals(state.meals, todayKey())).kcal) + 'kcal です');
    go('home');
  }

  function resetRecord() {
    ui.photo = null;
    ui.result = null;
    ui.mealType = null;
    $('#preview').hidden = true;
    $('#resultCard').hidden = true;
    $('#recMemo').value = '';
    $('#recDate').value = '';
    $('#recTime').value = '';
    $('#fileCamera').value = '';
    $('#fileLibrary').value = '';
  }

  // ------------------------------------------------------------------
  // 食事の詳細（シート）
  // ------------------------------------------------------------------
  var sheetMeal = null;
  function openMeal(id) {
    var m = state.meals.filter(function (x) { return x.id === id; })[0];
    if (!m) return;
    sheetMeal = JSON.parse(JSON.stringify(m));
    renderSheet();
    $('#sheet').hidden = false;
  }
  function renderSheet() {
    var m = sheetMeal;
    var tg = targets();
    var t = M.totalsFromItems(m.items);
    var warns = M.mealWarnings(t, tg);
    $('#sheetContent').innerHTML =
      '<p class="muted small">' + esc(M.dateLabel(m.date) + ' ' + m.time + '・' + m.type) + (m.demo ? '<span class="demo-flag">デモ</span>' : '') + '</p>' +
      '<h2 class="r-name" style="margin:2px 40px 6px 0">' + esc(m.dish) + '</h2>' +
      (m.thumb ? '<img class="r-photo" src="' + m.thumb + '" alt="">' : '') +
      '<div id="shTiles">' + tilesHtml(t, tg) + '</div>' +
      (warns.length ? '<div class="alert">⚠️ ' + esc(warns.join('。')) + '。</div>' : '') +
      (m.confidence ? '<p class="conf">' + esc(M.CONFIDENCE[m.confidence] || '') + '</p>' : '') +
      '<div id="shItems">' + itemsTableHtml(m.items) + '</div>' +
      notesHtml({ good_points: m.good, cautions: m.cautions, assumptions: m.assumptions }) +
      '<div class="btn-row"><button type="button" class="btn primary" id="btnSheetSave" style="flex:1">修正を保存</button><button type="button" class="btn danger" id="btnSheetDelete">削除</button></div>';
  }

  // ------------------------------------------------------------------
  // 履歴
  // ------------------------------------------------------------------
  function renderHistory() {
    var tg = targets();
    var key = todayKey();
    var days = [];
    for (var i = 13; i >= 0; i--) {
      var d = M.addDays(key, -i);
      var meals = M.dayMeals(state.meals, d);
      days.push({ d: d, kcal: M.sumTotals(meals).kcal, n: meals.length });
    }
    var W = 336, H = 150, P = 24, bw = (W - P) / 14;
    var max = Math.max.apply(null, days.map(function (x) { return x.kcal; }).concat([tg ? tg.kcal * 1.2 : 2000, 1]));
    var y = function (v) { return 8 + (1 - v / max) * (H - 28); };
    var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="直近14日のカロリー">';
    svg += '<line class="axis" x1="' + P + '" x2="' + W + '" y1="' + (H - 20) + '" y2="' + (H - 20) + '"/>';
    if (tg) svg += '<line class="target" x1="' + P + '" x2="' + W + '" y1="' + y(tg.kcal) + '" y2="' + y(tg.kcal) + '"/><text x="0" y="' + (y(tg.kcal) + 3) + '">目標</text>';
    days.forEach(function (x, i) {
      if (!x.n) return;
      var h = (H - 20) - y(x.kcal);
      svg += '<rect class="bar' + (tg && x.kcal > tg.kcal ? ' over' : '') + '" x="' + (P + i * bw + 2) + '" y="' + y(x.kcal) + '" width="' + (bw - 4) + '" height="' + Math.max(1, h) + '" rx="3"><title>' + x.d + '：' + x.kcal + 'kcal</title></rect>';
    });
    svg += '<text x="' + P + '" y="' + (H - 6) + '">' + days[0].d.slice(5).replace('-', '/') + '</text><text x="' + (W - 30) + '" y="' + (H - 6) + '">今日</text></svg>';
    $('#kcalChart').innerHTML = svg;
    var rec = days.filter(function (x) { return x.n; });
    $('#kcalAvg').textContent = rec.length ? '記録した' + rec.length + '日の平均：' + fmt(Math.round(rec.reduce(function (a, x) { return a + x.kcal; }, 0) / rec.length)) + 'kcal' + (tg ? '（目標 ' + fmt(tg.kcal) + 'kcal）' : '') : 'まだ記録がありません。';

    // 体重
    var ws = state.weights.slice().sort(function (a, b) { return a.date < b.date ? -1 : 1; }).slice(-30);
    $('#weightForm').elements.date.value = key;
    if (ws.length >= 2) {
      var vals = ws.map(function (w) { return w.weight; });
      var mn = Math.min.apply(null, vals) - 0.5, mx = Math.max.apply(null, vals) + 0.5;
      var wy = function (v) { return 8 + (1 - (v - mn) / (mx - mn)) * (H - 28); };
      var wx = function (i) { return P + i * ((W - P - 8) / (ws.length - 1)); };
      var s2 = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="体重の推移"><line class="axis" x1="' + P + '" x2="' + W + '" y1="' + (H - 20) + '" y2="' + (H - 20) + '"/>';
      s2 += '<polyline class="wline" points="' + ws.map(function (w, i) { return wx(i) + ',' + wy(w.weight); }).join(' ') + '"/>';
      ws.forEach(function (w, i) { s2 += '<circle cx="' + wx(i) + '" cy="' + wy(w.weight) + '" r="3"><title>' + w.date + '：' + w.weight + 'kg</title></circle>'; });
      s2 += '<text x="0" y="' + (wy(mx - 0.5) + 3) + '">' + (mx - 0.5).toFixed(1) + '</text><text x="0" y="' + (wy(mn + 0.5) + 3) + '">' + (mn + 0.5).toFixed(1) + '</text>';
      s2 += '<text x="' + P + '" y="' + (H - 6) + '">' + ws[0].date.slice(5).replace('-', '/') + '</text><text x="' + (W - 34) + '" y="' + (H - 6) + '">' + ws[ws.length - 1].date.slice(5).replace('-', '/') + '</text></svg>';
      $('#weightChart').innerHTML = s2;
      var diff = Math.round((ws[ws.length - 1].weight - ws[0].weight) * 10) / 10;
      $('#weightNote').textContent = slashDate(ws[0].date) + 'から ' + (diff > 0 ? '+' : '') + diff + 'kg。体重は水分などで毎日上下するので、1週間くらいの流れで見ていきましょう。';
    } else {
      $('#weightChart').innerHTML = '';
      $('#weightNote').textContent = '2日以上記録すると、グラフが表示されます。';
    }

    // 日ごと
    var dates = {};
    state.meals.forEach(function (m) { dates[m.date] = true; });
    $('#dayList').innerHTML = Object.keys(dates).sort().reverse().slice(0, 60).map(function (d) {
      var meals = M.dayMeals(state.meals, d);
      var t = M.sumTotals(meals);
      return '<details class="day"' + (d === key ? ' open' : '') + '><summary><span>' + esc(M.dateLabel(d)) + '</span><span>' + fmt(t.kcal) + ' kcal</span></summary>' +
        '<p class="muted small">P ' + t.protein_g + 'g・F ' + t.fat_g + 'g・C ' + t.carbs_g + 'g・塩分 ' + t.salt_g + 'g</p>' +
        '<ul class="meal-list">' + meals.map(mealItemHtml).join('') + '</ul></details>';
    }).join('') || '<p class="empty">まだ記録がありません。</p>';
  }
  function slashDate(s) { return s.slice(5).replace('-', '/'); }

  // ------------------------------------------------------------------
  // プラン
  // ------------------------------------------------------------------
  function renderPlan() {
    var f = $('#profileForm');
    Object.keys(state.profile).forEach(function (k) { if (f.elements[k]) f.elements[k].value = state.profile[k] === undefined ? '' : state.profile[k]; });
    var tg = targets();
    var box = $('#targetBox');
    if (!tg) {
      box.innerHTML = '<p class="muted small">性別・年齢・身長・体重を入れて保存すると、1日の目標が計算されます。</p>';
    } else {
      box.innerHTML = '<div class="target-grid">' +
        '<div><span>1日の目標エネルギー</span><b>' + fmt(tg.kcal) + ' kcal</b></div>' +
        '<div><span>消費の目安</span><b>約 ' + fmt(tg.tdee) + ' kcal</b></div>' +
        '<div><span>たんぱく質</span><b>' + tg.protein_g + ' g</b></div>' +
        '<div><span>脂質</span><b>' + tg.fat_g + ' g</b></div>' +
        '<div><span>炭水化物</span><b>' + tg.carbs_g + ' g</b></div>' +
        '<div><span>塩分</span><b>' + tg.salt_g + ' g未満</b></div></div>' +
        '<p class="muted small" style="margin-top:8px">基礎代謝の推定 約' + fmt(tg.bmr) + 'kcal（Mifflin-St Jeor 式）× 活動量の係数で消費の目安を出し、ペースに合わせて' + (tg.deficit ? '約' + tg.deficit + 'kcal 控えめ' : 'そのまま') + 'にしています。</p>' +
        tg.warnings.map(function (w) { return '<div class="warn-box">' + esc(w) + '</div>'; }).join('');
    }
    $('#passcode').value = state.passcode;
    renderStatus();
  }

  // ------------------------------------------------------------------
  // コーチに送るまとめ
  // ------------------------------------------------------------------
  function summaryText() {
    var key = todayKey();
    var meals = M.dayMeals(state.meals, key);
    var t = M.sumTotals(meals);
    var tg = targets();
    var lines = ['【' + M.dateLabel(key) + 'の食事記録】'];
    meals.forEach(function (m) { lines.push('・' + m.type + '（' + m.time + '）' + m.dish + '　' + m.totals.kcal + 'kcal'); });
    if (!meals.length) lines.push('・まだ記録がありません');
    lines.push('');
    lines.push('合計：' + fmt(t.kcal) + 'kcal' + (tg ? '（目標 ' + fmt(tg.kcal) + 'kcal）' : ''));
    lines.push('P ' + t.protein_g + 'g／F ' + t.fat_g + 'g／C ' + t.carbs_g + 'g／塩分 ' + t.salt_g + 'g');
    var w = state.weights.filter(function (x) { return x.date === key; })[0];
    if (w) lines.push('体重：' + w.weight + 'kg');
    lines.push('※栄養の値はAIによる写真からの推定です');
    return lines.join('\n');
  }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(function () { toast('コピーしました'); }, function () { fallbackCopy(text); });
    } else fallbackCopy(text);
  }
  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); toast('コピーしました'); } catch (e) { toast('コピーできませんでした'); }
    document.body.removeChild(ta);
  }

  // ------------------------------------------------------------------
  // イベント
  // ------------------------------------------------------------------
  function bindItemsEditor(container, getItems, onChange) {
    container.addEventListener('input', function (ev) {
      var inp = ev.target.closest('input[data-k]');
      if (!inp) return;
      var row = inp.closest('[data-i]');
      var it = getItems()[+row.getAttribute('data-i')];
      var k = inp.getAttribute('data-k');
      it[k] = k === 'name' ? inp.value : Math.max(0, parseFloat(inp.value) || 0);
      onChange();
    });
    container.addEventListener('click', function (ev) {
      var del = ev.target.closest('[data-del]');
      if (!del) return;
      getItems().splice(+del.getAttribute('data-del'), 1);
      onChange(true);
    });
  }

  function bind() {
    $all('[data-go]').forEach(function (b) { b.addEventListener('click', function () { go(b.getAttribute('data-go')); }); });
    document.addEventListener('click', function (ev) {
      var m = ev.target.closest('[data-meal]');
      if (m) openMeal(m.getAttribute('data-meal'));
    });

    // 記録
    $('#fileCamera').addEventListener('change', function () { onFile(this.files[0]); });
    $('#fileLibrary').addEventListener('change', function () { onFile(this.files[0]); });
    $('#mealTypeChips').addEventListener('click', function (ev) {
      var c = ev.target.closest('[data-type]');
      if (!c) return;
      ui.mealType = c.getAttribute('data-type');
      renderRecord();
    });
    $('#btnAnalyze').addEventListener('click', analyze);
    $('#btnManual').addEventListener('click', manualEntry);
    var rc = $('#resultCard');
    bindItemsEditor(rc, function () { return ui.result.items; }, function (structural) {
      if (structural) $('#resItems').innerHTML = itemsTableHtml(ui.result.items);
      refreshResultTotals();
    });
    rc.addEventListener('click', function (ev) {
      if (ev.target.closest('#btnSave')) saveResult();
      if (ev.target.closest('#btnDiscard')) { resetRecord(); renderRecord(); }
      if (ev.target.closest('#btnAddRow')) {
        ui.result.items.push({ name: '', portion: '', kcal: 0, protein_g: 0, fat_g: 0, carbs_g: 0, salt_g: 0 });
        $('#resItems').innerHTML = itemsTableHtml(ui.result.items);
      }
    });

    // シート
    var sh = $('#sheet');
    sh.addEventListener('click', function (ev) {
      if (ev.target.closest('[data-close]')) { sh.hidden = true; sheetMeal = null; return; }
      if (ev.target.closest('#btnSheetSave')) {
        var i = state.meals.map(function (x) { return x.id; }).indexOf(sheetMeal.id);
        sheetMeal.items = sheetMeal.items.filter(function (it) { return it.name.trim() || it.kcal > 0; });
        sheetMeal.totals = M.totalsFromItems(sheetMeal.items);
        if (i !== -1) state.meals[i] = sheetMeal;
        save();
        sh.hidden = true;
        toast('修正を保存しました');
        render();
      }
      if (ev.target.closest('#btnSheetDelete')) {
        if (!window.confirm('この食事の記録を削除します。よろしいですか？')) return;
        state.meals = state.meals.filter(function (x) { return x.id !== sheetMeal.id; });
        save();
        sh.hidden = true;
        toast('削除しました');
        render();
      }
    });
    bindItemsEditor($('#sheetContent'), function () { return sheetMeal.items; }, function (structural) {
      if (structural) $('#shItems').innerHTML = itemsTableHtml(sheetMeal.items);
      $('#shTiles').innerHTML = tilesHtml(M.totalsFromItems(sheetMeal.items), targets());
    });

    // 栄養
    $('#btnAdvice').addEventListener('click', function () { renderAdvice(true); });

    // 履歴
    $('#weightForm').addEventListener('submit', function (ev) {
      ev.preventDefault();
      var d = this.elements.date.value;
      var w = parseFloat(this.elements.weight.value);
      if (!d || isNaN(w)) return;
      state.weights = state.weights.filter(function (x) { return x.date !== d; });
      state.weights.push({ date: d, weight: w });
      // いちばん新しい記録なら、プロフィールの体重も更新する
      var latest = state.weights.slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; })[0];
      if (latest.date === d) state.profile.weight = w;
      save();
      this.elements.weight.value = '';
      toast('体重を記録しました' + (latest.date === d ? '。目標も計算し直しました' : ''));
      renderHistory();
    });

    // プラン
    $('#activitySel').innerHTML = Object.keys(M.ACTIVITY).map(function (k) { return '<option value="' + k + '">' + esc(M.ACTIVITY[k].label) + '</option>'; }).join('');
    $('#paceSel').innerHTML = Object.keys(M.PACES).map(function (k) { return '<option value="' + k + '">' + esc(M.PACES[k].label) + '</option>'; }).join('');
    $('#profileForm').addEventListener('submit', function (ev) {
      ev.preventDefault();
      var f = this.elements;
      Object.keys(state.profile).forEach(function (k) { if (f[k]) state.profile[k] = f[k].value.trim ? f[k].value.trim() : f[k].value; });
      save();
      toast('保存しました。目標を計算し直しました');
      renderPlan();
    });
    $('#btnPasscode').addEventListener('click', function () {
      state.passcode = $('#passcode').value;
      save();
      toast('合言葉を保存しました');
    });
    $('#btnExport').addEventListener('click', function () {
      var a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }));
      a.download = 'meal-ai_' + todayKey() + '.json';
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 0);
    });
    $('#fileImport').addEventListener('change', function () {
      var file = this.files[0];
      if (!file) return;
      var rd = new FileReader();
      rd.onload = function () {
        try {
          var d = JSON.parse(rd.result);
          if (!d || !Array.isArray(d.meals)) throw new Error('format');
          if (!window.confirm(d.meals.length + '件の食事の記録を読み込みます。今のデータは置き換わります。よろしいですか？')) return;
          state.profile = Object.assign(state.profile, d.profile || {});
          state.meals = d.meals;
          state.weights = d.weights || [];
          state.advice = null;
          save();
          toast('読み込みました');
          render();
        } catch (e) { toast('ファイルの形式が正しくありません'); }
      };
      rd.readAsText(file);
      this.value = '';
    });
    $('#btnReset').addEventListener('click', function () {
      if (!window.confirm('すべての記録とプロフィールを削除します。元に戻せません。よろしいですか？')) return;
      try { localStorage.removeItem(KEY); } catch (e) { /* 何もしない */ }
      location.reload();
    });

    $('#btnShareCopy').addEventListener('click', function () { copyText(summaryText()); });
    $('#btnShareLine').addEventListener('click', function () {
      window.open('https://line.me/R/share?text=' + encodeURIComponent(summaryText()), '_blank', 'noopener');
    });
  }

  // ------------------------------------------------------------------
  // 起動
  // ------------------------------------------------------------------
  load();
  bind();
  go(state.profile.weight ? 'home' : 'plan');
  checkHealth().then(function () { if (ui.view === 'nutrition') renderAdvice(false); });
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(function () { /* 登録できなくても動く */ });
  }
})();
