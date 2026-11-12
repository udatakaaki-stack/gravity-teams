/*
 * クライアント用アプリ
 */
(function () {
  'use strict';
  var M = window.MealCalc;
  var U = window.UI;
  var $ = U.$, $all = U.$all, esc = U.esc, fmt = U.fmt;
  var CODE_KEY = 'connect.client.code';
  var ADVICE_KEY = 'connect.client.advice';

  var code = U.storeGet(CODE_KEY);
  var data = null; // サーバーから受け取った { client, days, messages, unread, ai, mock }
  var ui = { view: 'home', photo: null, mealType: null, result: null, mood: '', sheet: null, adviceLoading: false };

  function call(body) {
    return U.api('api/client', body, code, function () {
      U.storeSet(CODE_KEY, null);
      showNoJoin();
    });
  }

  function showNoJoin() {
    $('#noJoin').hidden = false;
    $all('[data-view]').forEach(function (v) { v.hidden = true; });
    $('#tabbar').hidden = true;
  }

  function targets() { return data ? M.targets(data.client) : null; }
  function day(date) { return (data.days || []).filter(function (d) { return d.date === date; })[0] || { date: date, meals: [], body: {} }; }
  function allMeals() {
    var out = [];
    (data.days || []).forEach(function (d) { (d.meals || []).forEach(function (m) { out.push(Object.assign({ date: d.date }, m)); }); });
    return out;
  }
  function putDay(d) {
    data.days = (data.days || []).filter(function (x) { return x.date !== d.date; }).concat([d]).sort(function (a, b) { return a.date < b.date ? 1 : -1; });
  }

  function refresh() {
    return call({ action: 'me' }).then(function (d) {
      data = d;
      $('#tabbar').hidden = false;
      renderStatus();
      render();
    }, function (e) { if (e.status !== 401) U.toast(e.message); });
  }

  function renderStatus() {
    var msg = '';
    if (data && data.mock) msg = '🧪 デモモードです。写真は解析されず、サンプルの結果が表示されます。';
    else if (data && !data.ai) msg = 'AI の写真解析はまだ使えません。写真なしの入力はできます。';
    var bar = $('#statusBar');
    bar.hidden = !msg;
    bar.textContent = msg;
    $('#btnAnalyze').disabled = !ui.photo || !(data && data.ai);
    var b = $('#msgBadge');
    b.hidden = !(data && data.unread);
    b.textContent = data && data.unread ? data.unread : '';
  }

  function go(view) {
    ui.view = view;
    $all('[data-view]').forEach(function (v) { v.hidden = v.getAttribute('data-view') !== view; });
    $all('.tab').forEach(function (t) { t.classList.toggle('active', t.getAttribute('data-go') === view); });
    window.scrollTo({ top: 0 });
    render();
    if (view === 'messages' && data && data.unread) {
      call({ action: 'markRead' }).then(function () { data.unread = 0; renderStatus(); renderHome(); });
    }
  }

  function render() {
    if (!data) return;
    if (ui.view === 'home') renderHome();
    if (ui.view === 'nutrition') renderNutrition();
    if (ui.view === 'record') renderRecord();
    if (ui.view === 'messages') renderMessages();
    if (ui.view === 'history') renderHistory();
  }

  // ------------------------------------------------------------------
  // ホーム
  // ------------------------------------------------------------------
  function renderHome() {
    var c = data.client;
    var tg = targets();
    var key = data.today;
    var d = day(key);
    var meals = U.sortMeals(d.meals);
    var total = M.sumTotals(meals);
    var remaining = M.remainingMeals(allMeals(), key, new Date());
    var streak = M.streak(allMeals(), key);
    var bmi = M.bmi(c);
    $('#helloName').textContent = 'こんにちは、' + (c.name || '') + (c.honorific !== undefined ? c.honorific : 'さん') + ' 👋';
    $('#helloMeta').textContent = M.dateLabel(key) + (streak ? '・記録 ' + streak + '日連続 🔥' : '');
    var meta = [];
    if (c.height) meta.push('📏' + c.height + 'cm');
    if (c.weight) meta.push('⚖️' + c.weight + 'kg');
    if (bmi !== null) meta.push('BMI ' + bmi + '（' + M.bmiLabel(bmi) + '）');
    if (tg) meta.push('🎯目標 ' + fmt(tg.kcal) + 'kcal/日');
    $('#helloBody').textContent = meta.join('・') || '目標はコーチが設定します。';

    // コーチからの最新メッセージ
    var last = (data.messages || []).filter(function (m) { return m.from === 'coach'; }).pop();
    var cc = $('#coachCard');
    cc.hidden = !last;
    if (last) {
      cc.classList.toggle('unread', !!data.unread);
      cc.innerHTML = '<span class="coach-label">💬 コーチから' + (data.unread ? '<i class="badge">' + data.unread + '</i>' : '') + '</span><span class="coach-text">' + esc(last.text.length > 90 ? last.text.slice(0, 90) + '…' : last.text) + '</span>';
    }

    var v = M.verdict(total, tg, remaining);
    var card = $('#verdictCard');
    card.className = 'verdict ' + v.level;
    card.innerHTML = '<div class="v-label">' + (v.level === 'over' ? '⚠️ ' : '✨ ') + '今日の判定</div><div class="v-title">' + esc(v.title) + '</div><div class="v-body">' + esc(v.body) + '</div>';
    $('#ring').innerHTML = U.ringSvg(total.kcal, tg ? tg.kcal : 0);
    $('#balanceList').innerHTML = U.balanceHtml(total, tg, meals);

    var f = $('#bodyForm');
    var b = d.body || {};
    if (document.activeElement === null || !f.contains(document.activeElement)) {
      f.elements.weight.value = b.weight || '';
      f.elements.sleep.value = b.sleep === undefined ? '' : b.sleep;
      f.elements.memo.value = b.memo || '';
      ui.mood = b.mood || '';
    }
    $('#moodChips').innerHTML = U.MOODS.map(function (m) {
      return '<button type="button" class="chip' + (ui.mood === m[0] ? ' active' : '') + '" data-mood="' + m[0] + '">' + m[1] + '</button>';
    }).join('');

    $('#todayMeals').innerHTML = meals.map(function (m) { return U.mealItemHtml(m, tg, { date: key }); }).join('') || '<li class="empty">まだ記録がありません。下の ＋ から写真を撮ってみましょう。</li>';
  }

  // ------------------------------------------------------------------
  // 栄養
  // ------------------------------------------------------------------
  var TIP_ICON = { praise: '👏', meal: '🍽', salt: '💧', protein: '🥚', activity: '🚶', water: '💧', sleep: '🌙', other: '💡' };

  function renderNutrition() {
    var tg = targets();
    var total = M.sumTotals(day(data.today).meals);
    $('#nutriDate').textContent = M.dateLabel(data.today);
    var rows = [['たんぱく質 P', total.protein_g, tg && tg.protein_g, 'g', 'var(--p)', false], ['脂質 F', total.fat_g, tg && tg.fat_g, 'g', 'var(--f)', false], ['炭水化物 C', total.carbs_g, tg && tg.carbs_g, 'g', 'var(--c)', false], ['塩分', total.salt_g, tg && tg.salt_g, 'g未満', 'var(--s)', true]];
    $('#nutriBars').innerHTML = rows.map(function (r) {
      var over = r[2] && r[1] > r[2];
      return '<div class="bar-row"><div class="bar-head"><span>' + r[0] + '</span><span class="' + (over ? 'over' : '') + '">' + r[1] + ' / ' + (r[2] ? r[2] + r[3] : '―') + (over && r[5] ? '（オーバー）' : '') + '</span></div>' +
        '<div class="bar-track"><div class="bar-fill" style="width:' + (r[2] ? Math.min(100, r[1] / r[2] * 100) : 0) + '%;background:' + (over ? 'var(--warn)' : r[4]) + '"></div></div></div>';
    }).join('');
    renderAdvice(false);
  }

  function renderAdvice(force) {
    var box = $('#adviceBox');
    var tg = targets();
    var meals = U.sortMeals(day(data.today).meals);
    var total = M.sumTotals(meals);
    var remaining = M.remainingMeals(allMeals(), data.today, new Date());
    var sig = data.today + '|' + meals.map(function (m) { return m.id + ':' + m.totals.kcal; }).join(',');
    var cached = null;
    try { var a = JSON.parse(U.storeGet(ADVICE_KEY) || 'null'); if (a && a.sig === sig) cached = a.data; } catch (e) { /* 何もしない */ }
    function show(d, note) {
      box.innerHTML = '<div class="advice-head"><strong>' + esc(d.verdict_title) + (d.demo ? '<span class="demo-flag">デモ</span>' : '') + '</strong><span class="small muted">' + esc(d.verdict_body) + '</span></div>' +
        (d.tips || []).map(function (t) { return '<div class="tip k-' + esc(t.kind) + '"><span class="tip-icon">' + (TIP_ICON[t.kind] || '💡') + '</span><div><strong>' + esc(t.title) + '</strong>　' + esc(t.body) + '</div></div>'; }).join('') +
        (note ? '<p class="muted small">' + esc(note) + '</p>' : '');
    }
    if (!meals.length) { box.innerHTML = '<p class="empty">食事を記録すると、アドバイスが届きます。</p>'; return; }
    if (cached && !force) return show(cached);
    if (!data.ai) return show(M.ruleAdvice(total, tg, remaining));
    if (ui.adviceLoading) return;
    ui.adviceLoading = true;
    box.innerHTML = '<div class="loading"><div class="spinner"></div><p class="small">AIコーチがアドバイスを考えています…</p></div>';
    var c = data.client;
    call({ action: 'advice', input: {
      現在の時刻: U.nowTime(),
      プロフィール: { 呼び名: c.name, 性別: c.sex, 年齢: c.age, 身長: c.height, 体重: c.weight, 目標体重: c.goalWeight },
      目標: tg ? { エネルギー: tg.kcal + 'kcal', たんぱく質: tg.protein_g + 'g', 脂質: tg.fat_g + 'g', 炭水化物: tg.carbs_g + 'g', 塩分: tg.salt_g + 'g未満', 消費の目安: tg.tdee + 'kcal' } : null,
      今日の合計: total,
      今日の食事: meals.map(function (m) { return { 種類: m.type, 時刻: m.time, 料理: m.dish, 合計: m.totals }; }),
      まだ記録がない食事: remaining
    } }).then(function (d) {
      U.storeSet(ADVICE_KEY, JSON.stringify({ sig: sig, data: d }));
      show(d);
    }, function (e) {
      show(M.ruleAdvice(total, tg, remaining), 'AI のアドバイスを取得できなかったため、計算によるアドバイスを表示しています（' + e.message + '）');
    }).then(function () { ui.adviceLoading = false; });
  }

  // ------------------------------------------------------------------
  // 記録
  // ------------------------------------------------------------------
  function renderRecord() {
    if (!ui.mealType) ui.mealType = M.guessMealType(new Date());
    $('#mealTypeChips').innerHTML = M.MEAL_TYPES.map(function (t) { return '<button type="button" class="chip' + (t === ui.mealType ? ' active' : '') + '" data-type="' + t + '">' + t + '</button>'; }).join('');
    if (!$('#recDate').value) $('#recDate').value = data.today;
    if (!$('#recTime').value) $('#recTime').value = U.nowTime();
    renderStatus();
  }

  function onFile(file) {
    if (!file) return;
    U.preparePhoto(file).then(function (p) {
      ui.photo = p;
      $('#preview').src = p.dataUrl;
      $('#preview').hidden = false;
      $('#resultCard').hidden = true;
      renderStatus();
    }, function (e) { U.toast(e.message); });
  }

  function analyze() {
    $('#loading').hidden = false;
    $('#resultCard').hidden = true;
    $('#btnAnalyze').disabled = true;
    call({ action: 'analyze', image: ui.photo.base64, mediaType: 'image/jpeg', mealType: ui.mealType, memo: $('#recMemo').value.trim() })
      .then(function (r) { ui.result = r; renderResult(); }, function (e) { U.toast(e.message); })
      .then(function () { $('#loading').hidden = true; renderStatus(); });
  }

  function renderResult() {
    var r = ui.result;
    var tg = targets();
    var t = M.totalsFromItems(r.items);
    var warns = M.mealWarnings(t, tg);
    var card = $('#resultCard');
    card.hidden = false;
    card.innerHTML = '<span class="ai-badge">' + (r.manual ? '✍️ 手入力' : '✨ AIが写真を解析しました') + '</span>' + (r.demo ? '<span class="demo-flag">デモ</span>' : '') +
      (ui.photo && !r.manual ? '<img class="r-photo" src="' + ui.photo.dataUrl + '" alt="">' : '') +
      '<label class="field" style="margin-top:10px">料理名<input id="resDish" value="' + esc(r.dish_name) + '" placeholder="例：焼き魚定食"></label>' +
      (r.summary ? '<p class="r-summary">' + esc(r.summary) + '</p>' : '') +
      '<div id="resTiles">' + U.tilesHtml(t, tg) + '</div><div id="resWarn">' + (warns.length ? '<div class="alert">⚠️ ' + esc(warns.join('。')) + '。</div>' : '') + '</div>' +
      (r.confidence ? '<p class="conf">' + esc(M.CONFIDENCE[r.confidence] || '') + '　数字は押して修正できます</p>' : '<p class="conf">分かる範囲で入力してください。</p>') +
      '<div id="resItems">' + U.itemsEditorHtml(r.items) + '</div><button type="button" class="link-btn" id="btnAddRow">＋ 料理を追加</button>' +
      U.notesHtml(r.good_points, r.cautions, r.assumptions) +
      '<div class="btn-row"><button type="button" class="btn primary" id="btnSave" style="flex:1">記録する</button><button type="button" class="btn ghost" id="btnDiscard">やり直す</button></div>';
    card.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function refreshResult() {
    var tg = targets();
    var t = M.totalsFromItems(ui.result.items);
    var w = M.mealWarnings(t, tg);
    $('#resTiles').innerHTML = U.tilesHtml(t, tg);
    $('#resWarn').innerHTML = w.length ? '<div class="alert">⚠️ ' + esc(w.join('。')) + '。</div>' : '';
  }

  function saveResult() {
    var r = ui.result;
    var items = r.items.filter(function (it) { return String(it.name).trim() || it.kcal > 0; });
    if (!items.length) return U.toast('料理を1つ以上入力してください');
    var btn = $('#btnSave');
    btn.disabled = true;
    call({ action: 'addMeal', meal: {
      date: $('#recDate').value || data.today, time: $('#recTime').value || U.nowTime(), type: ui.mealType,
      dish: $('#resDish').value.trim(), items: items, confidence: r.confidence, good: r.good_points, cautions: r.cautions, tags: r.tags,
      memo: $('#recMemo').value.trim(), thumb: r.manual ? null : (ui.photo ? ui.photo.thumb : null), demo: !!r.demo
    } }).then(function (res) {
      putDay(res.day);
      resetRecord();
      U.toast('記録しました。コーチにも届いています');
      go('home');
    }, function (e) { U.toast(e.message); btn.disabled = false; });
  }

  function resetRecord() {
    ui.photo = null; ui.result = null; ui.mealType = null;
    $('#preview').hidden = true; $('#resultCard').hidden = true;
    ['#recMemo', '#recDate', '#recTime', '#fileCamera', '#fileLibrary'].forEach(function (s) { $(s).value = ''; });
  }

  // ------------------------------------------------------------------
  // メッセージ
  // ------------------------------------------------------------------
  function renderMessages() {
    var th = $('#thread');
    th.innerHTML = U.messagesHtml(data.messages || [], 'client');
    th.scrollTop = th.scrollHeight;
  }

  // ------------------------------------------------------------------
  // 履歴
  // ------------------------------------------------------------------
  function renderHistory() {
    var tg = targets();
    var k = U.kcalChart(data.days, tg, data.today);
    $('#kcalChart').innerHTML = k.svg;
    $('#kcalAvg').textContent = k.days ? '記録した' + k.days + '日の平均：' + fmt(k.avg) + 'kcal' + (tg ? '（目標 ' + fmt(tg.kcal) + 'kcal）' : '') : 'まだ記録がありません。';
    var w = U.weightChart(data.days);
    $('#weightChart').innerHTML = w.svg;
    $('#weightNote').textContent = w.note;
    $('#dayList').innerHTML = (data.days || []).map(function (d) {
      var meals = U.sortMeals(d.meals);
      var t = M.sumTotals(meals);
      var b = d.body || {};
      var body = [b.weight ? '体重 ' + b.weight + 'kg' : '', b.sleep !== undefined ? '睡眠 ' + b.sleep + '時間' : '', b.mood ? U.moodLabel(b.mood) : ''].filter(Boolean).join('・');
      return '<details class="day"' + (d.date === data.today ? ' open' : '') + '><summary><span>' + esc(M.dateLabel(d.date)) + '</span><span>' + fmt(t.kcal) + ' kcal</span></summary>' +
        (body ? '<p class="muted small">' + esc(body) + '</p>' : '') +
        '<ul class="meal-list">' + meals.map(function (m) { return U.mealItemHtml(m, tg, { date: d.date }); }).join('') + '</ul></details>';
    }).join('') || '<p class="empty">まだ記録がありません。</p>';
  }

  // ------------------------------------------------------------------
  // 食事の詳細
  // ------------------------------------------------------------------
  function openMeal(date, id) {
    var m = day(date).meals.filter(function (x) { return x.id === id; })[0];
    if (!m) return;
    ui.sheet = JSON.parse(JSON.stringify(Object.assign({ date: date }, m)));
    var tg = targets();
    var t = M.totalsFromItems(ui.sheet.items);
    $('#sheetContent').innerHTML = '<p class="muted small">' + esc(M.dateLabel(date) + ' ' + (m.time || '') + '・' + m.type) + (m.demo ? '<span class="demo-flag">デモ</span>' : '') + '</p>' +
      '<h2 class="r-name" style="margin:2px 40px 6px 0">' + esc(m.dish) + '</h2>' +
      (typeof m.thumb === 'string' ? '<img class="r-photo" src="' + m.thumb + '" alt="">' : '') +
      '<div id="shTiles">' + U.tilesHtml(t, tg) + '</div>' +
      '<div id="shItems">' + U.itemsEditorHtml(ui.sheet.items) + '</div>' +
      U.notesHtml(m.good, m.cautions, []) +
      '<div class="btn-row"><button type="button" class="btn primary" id="btnSheetSave" style="flex:1">修正を保存</button><button type="button" class="btn danger" id="btnSheetDelete">削除</button></div>';
    $('#sheet').hidden = false;
  }

  // ------------------------------------------------------------------
  // イベント
  // ------------------------------------------------------------------
  function bind() {
    $all('[data-go]').forEach(function (b) { b.addEventListener('click', function () { go(b.getAttribute('data-go')); }); });
    document.addEventListener('click', function (ev) {
      var m = ev.target.closest('[data-meal]');
      if (m) openMeal(m.getAttribute('data-date'), m.getAttribute('data-meal'));
    });
    $('#moodChips').addEventListener('click', function (ev) {
      var c = ev.target.closest('[data-mood]');
      if (!c) return;
      ui.mood = ui.mood === c.getAttribute('data-mood') ? '' : c.getAttribute('data-mood');
      $all('[data-mood]').forEach(function (x) { x.classList.toggle('active', x.getAttribute('data-mood') === ui.mood); });
    });
    $('#bodyForm').addEventListener('submit', function (ev) {
      ev.preventDefault();
      var f = this.elements;
      call({ action: 'setBody', date: data.today, body: { weight: f.weight.value, sleep: f.sleep.value, mood: ui.mood, memo: f.memo.value.trim() } })
        .then(function (r) { putDay(r.day); data.client = r.client; U.toast('記録しました。コーチにも届いています'); document.activeElement.blur(); renderHome(); }, function (e) { U.toast(e.message); });
    });
    $('#fileCamera').addEventListener('change', function () { onFile(this.files[0]); });
    $('#fileLibrary').addEventListener('change', function () { onFile(this.files[0]); });
    $('#mealTypeChips').addEventListener('click', function (ev) {
      var c = ev.target.closest('[data-type]');
      if (c) { ui.mealType = c.getAttribute('data-type'); renderRecord(); }
    });
    $('#btnAnalyze').addEventListener('click', analyze);
    $('#btnManual').addEventListener('click', function () {
      ui.result = { dish_name: '', items: [{ name: '', portion: '', kcal: 0, protein_g: 0, fat_g: 0, carbs_g: 0, salt_g: 0 }], manual: true };
      renderResult();
    });
    var rc = $('#resultCard');
    U.bindItemsEditor(rc, function () { return ui.result.items; }, function (structural) {
      if (structural) $('#resItems').innerHTML = U.itemsEditorHtml(ui.result.items);
      refreshResult();
    });
    rc.addEventListener('click', function (ev) {
      if (ev.target.closest('#btnSave')) saveResult();
      if (ev.target.closest('#btnDiscard')) { resetRecord(); renderRecord(); }
      if (ev.target.closest('#btnAddRow')) {
        ui.result.items.push({ name: '', portion: '', kcal: 0, protein_g: 0, fat_g: 0, carbs_g: 0, salt_g: 0 });
        $('#resItems').innerHTML = U.itemsEditorHtml(ui.result.items);
      }
    });
    var sh = $('#sheet');
    U.bindItemsEditor($('#sheetContent'), function () { return ui.sheet.items; }, function (structural) {
      if (structural) $('#shItems').innerHTML = U.itemsEditorHtml(ui.sheet.items);
      $('#shTiles').innerHTML = U.tilesHtml(M.totalsFromItems(ui.sheet.items), targets());
    });
    sh.addEventListener('click', function (ev) {
      if (ev.target.closest('[data-close]')) { sh.hidden = true; return; }
      if (ev.target.closest('#btnSheetSave')) {
        call({ action: 'updateMeal', date: ui.sheet.date, mealId: ui.sheet.id, patch: { items: ui.sheet.items } })
          .then(function (r) { putDay(r.day); sh.hidden = true; U.toast('修正を保存しました'); render(); }, function (e) { U.toast(e.message); });
      }
      if (ev.target.closest('#btnSheetDelete')) {
        if (!window.confirm('この食事の記録を削除します。よろしいですか？')) return;
        call({ action: 'deleteMeal', date: ui.sheet.date, mealId: ui.sheet.id })
          .then(function (r) { putDay(r.day); sh.hidden = true; U.toast('削除しました'); render(); }, function (e) { U.toast(e.message); });
      }
    });
    $('#btnAdvice').addEventListener('click', function () { renderAdvice(true); });
    $('#msgForm').addEventListener('submit', function (ev) {
      ev.preventDefault();
      var ta = this.elements.text;
      var text = ta.value.trim();
      if (!text) return;
      call({ action: 'sendMessage', text: text }).then(function (r) {
        data.messages.push(r.message);
        ta.value = '';
        renderMessages();
      }, function (e) { U.toast(e.message); });
    });
    // 画面を開いている間は、1分ごとに新しいメッセージを確認する
    setInterval(function () { if (!document.hidden && data) refresh(); }, 60000);
    document.addEventListener('visibilitychange', function () { if (!document.hidden && data) refresh(); });
  }

  // ------------------------------------------------------------------
  // 起動
  // ------------------------------------------------------------------
  // 招待リンク（#join=コード）から開いた時は、コードを保存してアドレスから消す
  var m = /[#&]join=([A-Za-z0-9_-]{20,})/.exec(location.hash);
  if (m) {
    code = m[1];
    U.storeSet(CODE_KEY, code);
    history.replaceState(null, '', location.pathname);
  }
  bind();
  U.registerSw();
  if (!code) showNoJoin();
  else { go('home'); refresh(); }
})();
