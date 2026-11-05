/*
 * ダイエットサポートプログラム：画面の操作
 */
(function () {
  'use strict';

  var D = window.DIET_DATA;
  var E = window.DietEngine;
  var STORAGE_KEY = 'dietSupport.v1';

  var state = {
    clients: [],
    currentId: null,
    tab: 'profile',
    day: null,
    variant: 0,
    sceneId: null,
    sceneVariant: 0,
    bulk: []
  };

  // ------------------------------------------------------------------
  // 小さな道具
  // ------------------------------------------------------------------
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function esc(s) {
    return String(s === undefined || s === null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function uid() {
    return 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function today() { return E.formatDate(new Date()); }

  var toastTimer;
  function toast(msg) {
    var t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2200);
  }

  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var data = JSON.parse(raw);
        state.clients = Array.isArray(data.clients) ? data.clients : [];
        state.currentId = data.currentId || null;
      }
    } catch (e) { /* 保存領域が使えない環境でも動くようにする */ }
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ clients: state.clients, currentId: state.currentId }));
    } catch (e) {
      toast('このブラウザでは保存できませんでした。データ書き出しで保管してください。');
    }
  }

  function current() {
    return state.clients.filter(function (c) { return c.id === state.currentId; })[0] || null;
  }

  function newClient() {
    return {
      id: uid(),
      name: '',
      honorific: 'さん',
      gender: 'female',
      age: '',
      height: '',
      activity: 'low',
      startWeight: '',
      goalWeight: '',
      startDate: today(),
      totalDays: 90,
      goalNote: '',
      tone: 'gentle',
      level: 1,
      places: ['home'],
      coach: '',
      concerns: [],
      memo: '',
      logs: []
    };
  }

  // ------------------------------------------------------------------
  // コピー・共有
  // ------------------------------------------------------------------
  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).then(function () { toast('コピーしました。LINEやSNSに貼り付けてください'); }, fallback);
    }
    fallback();
    return Promise.resolve();

    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
        toast('コピーしました。LINEやSNSに貼り付けてください');
      } catch (e) {
        toast('コピーできませんでした。テキストを選択してコピーしてください');
      }
      document.body.removeChild(ta);
    }
  }

  function openShare(kind, text) {
    var url;
    if (kind === 'line') url = 'https://line.me/R/share?text=' + encodeURIComponent(text);
    if (kind === 'x') url = 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(text);
    if (url) window.open(url, '_blank', 'noopener');
  }

  function buildShareRow(row) {
    var targetId = row.getAttribute('data-share-target');
    var html = '' +
      '<button type="button" class="btn primary small" data-act="copy">コピー</button>' +
      '<button type="button" class="btn line small" data-act="line">LINEで送る</button>' +
      '<button type="button" class="btn x small" data-act="x">Xに投稿</button>';
    if (navigator.share) html += '<button type="button" class="btn ghost small" data-act="share">その他のアプリで共有</button>';
    row.innerHTML = html;
    row.addEventListener('click', function (ev) {
      var btn = ev.target.closest('button');
      if (!btn) return;
      var text = document.getElementById(targetId).value;
      var act = btn.getAttribute('data-act');
      if (act === 'copy') copyText(text);
      else if (act === 'share') navigator.share({ text: text }).catch(function () {});
      else {
        if (act === 'x' && E.xWeightedLength(text) > 280) {
          toast('Xの文字数上限を超えています。投稿画面で調整してください');
        }
        openShare(act, text);
      }
    });
  }

  function countLabel(text) {
    var x = E.xWeightedLength(text);
    var over = x > 280 ? '（Xの上限を超えています。SNS形式やひとこと形式がおすすめです）' : '';
    return text.length + '文字　X換算 ' + x + ' / 280' + over;
  }

  // ------------------------------------------------------------------
  // クライアント一覧
  // ------------------------------------------------------------------
  function renderClientList() {
    var ul = $('#clientList');
    if (!state.clients.length) {
      ul.innerHTML = '<li class="hint">まだ登録がありません</li>';
      return;
    }
    ul.innerHTML = state.clients.map(function (c) {
      var day = E.todayDay(c);
      var plan = E.buildPlan(c.totalDays);
      var ph = E.phaseForDay(plan, day);
      return '<li><button type="button" data-id="' + esc(c.id) + '" class="' + (c.id === state.currentId ? 'active' : '') + '">' +
        '<span class="cl-name">' + esc(c.name || '（名前未設定）') + '</span>' +
        '<span class="cl-meta">' + day + '/' + E.clampDays(c.totalDays) + '日目・' + esc(ph.name) + '</span></button></li>';
    }).join('');
  }

  function selectClient(id) {
    state.currentId = id;
    state.day = null;
    state.variant = 0;
    state.sceneVariant = 0;
    save();
    renderAll();
  }

  // ------------------------------------------------------------------
  // 全体描画
  // ------------------------------------------------------------------
  function renderAll() {
    renderClientList();
    var c = current();
    $('#emptyState').hidden = !!c;
    $('#workspace').hidden = !c;
    if (!c) return;
    if (state.day === null) state.day = E.todayDay(c);
    renderBanner();
    fillProfileForm();
    renderMetrics();
    renderLogs();
    renderPlan();
    renderCommentControls();
    renderComment();
    renderScenes();
    renderExercises();
    renderKnowledge();
    showTab(state.tab);
  }

  function renderBanner() {
    var c = current();
    var total = E.clampDays(c.totalDays);
    var day = E.todayDay(c);
    var ph = E.phaseForDay(E.buildPlan(total), day);
    $('#bannerName').textContent = E.displayName(c);
    var meta = [];
    if (c.startWeight && c.goalWeight) meta.push(c.startWeight + 'kg → 目標 ' + c.goalWeight + 'kg');
    meta.push('全' + total + '日');
    if (c.startDate) meta.push(c.startDate.replace(/-/g, '/') + ' 開始');
    if (c.goalNote) meta.push(c.goalNote);
    $('#bannerMeta').textContent = meta.join('・');
    $('#bannerDay').textContent = day + '日目（' + ph.name + '）';
  }

  function showTab(tab) {
    state.tab = tab;
    $all('.tab').forEach(function (b) {
      var on = b.getAttribute('data-tab') === tab;
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    $all('.panel').forEach(function (p) { p.classList.toggle('active', p.getAttribute('data-panel') === tab); });
  }

  // ------------------------------------------------------------------
  // プロフィール
  // ------------------------------------------------------------------
  function initProfileOptions() {
    $('#activitySelect').innerHTML = Object.keys(E.ACTIVITY).map(function (k) {
      return '<option value="' + k + '">' + esc(E.ACTIVITY[k].label) + '</option>';
    }).join('');
    $('#toneSelect').innerHTML = Object.keys(D.TONES).map(function (k) {
      return '<option value="' + k + '">' + esc(D.TONES[k].label) + '</option>';
    }).join('');
    $('#placeChecks').innerHTML = Object.keys(D.PLACES).map(function (k) {
      return '<label><input type="checkbox" name="places" value="' + k + '"> ' + esc(D.PLACES[k]) + '</label>';
    }).join('');
    $('#concernChecks').innerHTML = D.CONCERNS.map(function (c) {
      return '<label><input type="checkbox" name="concerns" value="' + c.id + '"> ' + esc(c.label) + '</label>';
    }).join('');
  }

  function fillProfileForm() {
    var c = current();
    var f = $('#profileForm');
    ['name', 'honorific', 'gender', 'age', 'height', 'activity', 'startWeight', 'goalWeight', 'startDate', 'goalNote', 'tone', 'level', 'coach', 'memo']
      .forEach(function (k) { if (f.elements[k]) f.elements[k].value = c[k] === undefined ? '' : c[k]; });
    var days = E.clampDays(c.totalDays);
    f.elements.totalDays.value = days;
    f.elements.totalDaysNum.value = days;
    $all('input[name="places"]', f).forEach(function (i) { i.checked = (c.places || []).indexOf(i.value) !== -1; });
    $all('input[name="concerns"]', f).forEach(function (i) { i.checked = (c.concerns || []).indexOf(i.value) !== -1; });
  }

  function readProfileForm() {
    var c = current();
    var f = $('#profileForm');
    ['name', 'honorific', 'gender', 'age', 'height', 'activity', 'startWeight', 'goalWeight', 'startDate', 'goalNote', 'tone', 'level', 'coach', 'memo']
      .forEach(function (k) { if (f.elements[k]) c[k] = f.elements[k].value.trim ? f.elements[k].value.trim() : f.elements[k].value; });
    c.honorific = f.elements.honorific.value;
    c.totalDays = E.clampDays(f.elements.totalDaysNum.value);
    c.level = parseInt(c.level, 10) || 1;
    c.places = $all('input[name="places"]:checked', f).map(function (i) { return i.value; });
    c.concerns = $all('input[name="concerns"]:checked', f).map(function (i) { return i.value; });
  }

  function syncDays(v) {
    var n = E.clampDays(v);
    var f = $('#profileForm');
    f.elements.totalDays.value = n;
    f.elements.totalDaysNum.value = n;
  }

  function renderMetrics() {
    var c = current();
    var m = E.metrics(c);
    var latest = E.latestLog(c);
    var items = [];
    function add(label, val) { items.push('<div class="metric"><span>' + esc(label) + '</span><strong>' + esc(val) + '</strong></div>'); }
    add('現在の体重', latest ? latest.weight + ' kg' : (c.startWeight ? c.startWeight + ' kg' : '未入力'));
    if (m.bmi) add('BMI', m.bmi + '（' + m.bmiLabel + '）');
    if (m.standardWeight) add('標準体重（BMI22）', m.standardWeight + ' kg');
    if (m.goalBmi) add('目標体重のBMI', m.goalBmi);
    if (m.bmr) add('基礎代謝の推定', m.bmr + ' kcal/日');
    if (m.tdee) add('1日の消費エネルギー推定', m.tdee + ' kcal/日');
    if (m.toLose !== undefined) add('目標までの差', m.toLose + ' kg');
    if (m.weeklyPace !== undefined) add('必要なペース', '週 ' + m.weeklyPace + ' kg');
    var html = '<div class="metric-grid">' + items.join('') + '</div>';
    html += m.warnings.map(function (w) { return '<p class="warn">' + esc(w) + '</p>'; }).join('');
    html += '<p class="hint">基礎代謝はMifflin-St Jeor式による推定値です。実際の値には個人差があります。</p>';
    $('#metricsBox').innerHTML = html;
  }

  // ------------------------------------------------------------------
  // 体重記録
  // ------------------------------------------------------------------
  function renderLogs() {
    var c = current();
    var logs = E.sortedLogs(c);
    $('#logForm').elements.date.value = today();
    $('#logList').innerHTML = logs.slice().reverse().map(function (l) {
      return '<li><span>' + esc(l.date.replace(/-/g, '/')) + '</span><span>' + l.weight.toFixed(1) + ' kg</span>' +
        '<button type="button" data-date="' + esc(l.date) + '" aria-label="この記録を削除">✕</button></li>';
    }).join('') || '<li class="hint">記録すると、コメントの中で前回との変化に合わせた声かけをします。</li>';
    renderChart(logs, parseFloat(c.goalWeight));
  }

  function renderChart(logs, goal) {
    var box = $('#chartBox');
    if (logs.length < 2) { box.innerHTML = ''; return; }
    var W = 320, H = 140, P = 28;
    var ws = logs.map(function (l) { return l.weight; });
    if (goal) ws.push(goal);
    var min = Math.min.apply(null, ws) - 0.5;
    var max = Math.max.apply(null, ws) + 0.5;
    var t0 = E.parseDate(logs[0].date).getTime();
    var t1 = E.parseDate(logs[logs.length - 1].date).getTime();
    var span = Math.max(1, t1 - t0);
    function x(d) { return P + ((E.parseDate(d).getTime() - t0) / span) * (W - P - 8); }
    function y(w) { return 8 + (1 - (w - min) / (max - min)) * (H - 8 - 20); }
    var pts = logs.map(function (l) { return x(l.date).toFixed(1) + ',' + y(l.weight).toFixed(1); });
    var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="体重の推移">' +
      '<line class="axis" x1="' + P + '" y1="' + (H - 20) + '" x2="' + W + '" y2="' + (H - 20) + '"/>' +
      '<text x="0" y="' + (y(max - 0.5) + 4) + '">' + (max - 0.5).toFixed(1) + '</text>' +
      '<text x="0" y="' + (y(min + 0.5) + 4) + '">' + (min + 0.5).toFixed(1) + '</text>';
    if (goal) svg += '<line class="goal" x1="' + P + '" x2="' + W + '" y1="' + y(goal) + '" y2="' + y(goal) + '"/><text x="' + (W - 40) + '" y="' + (y(goal) - 4) + '">目標</text>';
    svg += '<polyline class="line" points="' + pts.join(' ') + '"/>';
    logs.forEach(function (l) { svg += '<circle cx="' + x(l.date) + '" cy="' + y(l.weight) + '" r="3"><title>' + l.date + ' ' + l.weight + 'kg</title></circle>'; });
    svg += '<text x="' + P + '" y="' + (H - 4) + '">' + logs[0].date.slice(5).replace('-', '/') + '</text>';
    svg += '<text x="' + (W - 36) + '" y="' + (H - 4) + '">' + logs[logs.length - 1].date.slice(5).replace('-', '/') + '</text>';
    svg += '</svg>';
    box.innerHTML = svg;
  }

  // ------------------------------------------------------------------
  // 期分化プラン
  // ------------------------------------------------------------------
  function renderPlan() {
    var c = current();
    var total = E.clampDays(c.totalDays);
    var plan = E.buildPlan(total);
    var day = E.todayDay(c);
    var start = E.parseDate(c.startDate);

    function dateOf(n) {
      if (!start) return '';
      var d = new Date(start.getTime());
      d.setDate(d.getDate() + n - 1);
      return (d.getMonth() + 1) + '/' + d.getDate();
    }

    var tl = plan.map(function (p) {
      var w = (p.days / total) * 100;
      var label = w > 9 ? esc(p.name) : '';
      var marker = '';
      if (day >= p.start && day <= p.end) {
        var pos = ((day - p.start + 0.5) / p.days) * 100;
        marker = '<span class="today-marker" style="left:' + pos + '%" title="今日"></span>';
      }
      return '<div style="width:' + w + '%;background:' + p.color + '" title="' + esc(p.name + ' ' + p.start + '〜' + p.end + '日目') + '">' + label + marker + '</div>';
    }).join('');
    $('#timeline').innerHTML = tl;
    $('#timelineLegend').innerHTML = plan.map(function (p) {
      var range = p.start === p.end ? p.start + '日目' : p.start + '〜' + p.end + '日目';
      var dates = start ? '（' + dateOf(p.start) + '〜' + dateOf(p.end) + '）' : '';
      return '<span><i style="background:' + p.color + '"></i>' + esc(p.name) + '：' + range + dates + '</span>';
    }).join('') + '<span>黒い線が今日です</span>';

    $('#phaseCards').innerHTML = plan.map(function (p) {
      var ph = D.PHASES[p.id];
      var cur = day >= p.start && day <= p.end;
      return '<div class="card phase-card' + (cur ? ' current' : '') + '" style="border-top-color:' + p.color + '">' +
        '<h3>' + esc(ph.name) + '<small>' + esc(ph.sub) + '・' + p.days + '日間' + (cur ? '・いまここ' : '') + '</small></h3>' +
        '<p>' + esc(ph.purpose) + '</p>' +
        '<h4>食事のポイント</h4><ul>' + ph.diet.map(li).join('') + '</ul>' +
        '<h4>運動のポイント</h4><ul>' + ph.exercise.map(li).join('') + '</ul>' +
        '<h4>心の持ち方</h4><ul>' + ph.mind.map(li).join('') + '</ul>' +
        '<div class="coach-point">コーチへのひとこと：' + esc(ph.coachPoint) + '</div>' +
        '</div>';
    }).join('');
  }

  function li(s) { return '<li>' + esc(s) + '</li>'; }

  // ------------------------------------------------------------------
  // コメント
  // ------------------------------------------------------------------
  function renderCommentControls() {
    var c = current();
    var total = E.clampDays(c.totalDays);
    ['#dayRange', '#dayNum'].forEach(function (s) {
      var el = $(s);
      el.max = total;
      el.value = Math.min(state.day, total);
    });
    $('#bulkFrom').max = total;
    $('#bulkTo').max = total;
  }

  function commentOpts() {
    return {
      variant: state.variant,
      format: $('#formatSelect').value,
      emoji: parseInt($('#emojiSelect').value, 10),
      tip: $('#chkTip').checked,
      exercise: $('#chkExercise').checked,
      progress: $('#chkProgress').checked
    };
  }

  function renderComment() {
    var c = current();
    var total = E.clampDays(c.totalDays);
    state.day = Math.min(Math.max(1, state.day || 1), total);
    var info = E.dayInfo(c, state.day);
    var seg = E.phaseForDay(E.buildPlan(total), state.day);
    var text = E.generateComment(c, state.day, commentOpts());
    $('#commentOutput').value = text;
    $('#commentCount').textContent = countLabel(text);
    var badge = $('#commentPhase');
    badge.textContent = seg.name + '（' + seg.sub + '）';
    badge.style.background = seg.color;
    $('#commentDate').textContent = state.day + '日目・' + info.dateStr.replace(/-/g, '/') + '（' + info.weekdayJa + '）・残り' + info.remain + '日';
  }

  // ------------------------------------------------------------------
  // 一括生成
  // ------------------------------------------------------------------
  function runBulk() {
    var c = current();
    var total = E.clampDays(c.totalDays);
    var from = Math.min(Math.max(1, parseInt($('#bulkFrom').value, 10) || 1), total);
    var to = Math.min(Math.max(from, parseInt($('#bulkTo').value, 10) || from), total);
    $('#bulkFrom').value = from;
    $('#bulkTo').value = to;
    var opts = { format: $('#bulkFormat').value, emoji: parseInt($('#emojiSelect').value, 10) };
    state.bulk = E.generateRange(c, from, to, opts);
    $('#bulkInfo').textContent = from + '〜' + to + '日目（' + state.bulk.length + '件）';
    $('#bulkList').innerHTML = state.bulk.map(function (b, i) {
      return '<article class="bulk-item"><header><strong>' + b.day + '日目・' + esc(b.date.replace(/-/g, '/')) + '（' + b.weekday + '）・' + esc(b.phase) + '</strong>' +
        '<button type="button" class="btn ghost small" data-copy="' + i + '">コピー</button></header>' +
        '<pre>' + esc(b.text) + '</pre></article>';
    }).join('');
  }

  function bulkText() {
    return state.bulk.map(function (b) {
      return '━━━━━━━━━━\n【' + b.day + '日目　' + b.date.replace(/-/g, '/') + '（' + b.weekday + '）　' + b.phase + '】\n━━━━━━━━━━\n' + b.text;
    }).join('\n\n');
  }

  function download(filename, text, type) {
    var blob = new Blob([text], { type: type || 'text/plain;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 0);
  }

  // ------------------------------------------------------------------
  // 停滞期サポート
  // ------------------------------------------------------------------
  function renderScenes() {
    $('#sceneGrid').innerHTML = D.PLATEAU_SCENES.map(function (s) {
      return '<button type="button" class="scene-btn' + (s.id === state.sceneId ? ' active' : '') + '" data-scene="' + s.id + '">' +
        '<span>' + s.icon + '</span><span>' + esc(s.title) + '</span></button>';
    }).join('');
    renderSceneDetail();
  }

  function renderSceneDetail() {
    var box = $('#sceneDetail');
    var s = D.PLATEAU_SCENES.filter(function (x) { return x.id === state.sceneId; })[0];
    if (!s) { box.hidden = true; return; }
    box.hidden = false;
    $('#sceneTitle').textContent = s.icon + ' ' + s.title;
    $('#sceneFeeling').textContent = s.feeling;
    $('#sceneCauses').innerHTML = s.causes.map(li).join('');
    $('#sceneTips').innerHTML = s.tips.map(li).join('');
    var text = E.plateauMessage(current(), s.id, { variant: state.sceneVariant, emoji: parseInt($('#emojiSelect').value, 10) });
    $('#sceneOutput').value = text;
    $('#sceneCount').textContent = countLabel(text);
  }

  // ------------------------------------------------------------------
  // 運動ライブラリ
  // ------------------------------------------------------------------
  function initExerciseFilters() {
    $('#exCat').innerHTML += Object.keys(D.EXERCISE_CATS).map(function (k) {
      return '<option value="' + k + '">' + esc(D.EXERCISE_CATS[k]) + '</option>';
    }).join('');
    $('#exPlace').innerHTML += Object.keys(D.PLACES).map(function (k) {
      return '<option value="' + k + '">' + esc(D.PLACES[k]) + '</option>';
    }).join('');
  }

  function renderExercises() {
    var c = current();
    var cat = $('#exCat').value;
    var place = $('#exPlace').value;
    var fit = $('#exFit').checked;
    var lv = parseInt(c.level, 10) || 1;
    var places = c.places && c.places.length ? c.places : ['home'];
    var levelNames = { 1: '初心者向け', 2: '中級者向け', 3: '経験者向け' };
    var list = D.EXERCISES.filter(function (e) {
      if (cat && e.cat !== cat) return false;
      if (place && e.place.indexOf(place) === -1) return false;
      if (fit && (e.level > lv + 1 || !e.place.some(function (p) { return places.indexOf(p) !== -1; }))) return false;
      return true;
    });
    $('#exGrid').innerHTML = list.map(function (e) {
      return '<div class="card ex-card"><h3>' + esc(e.name) + '</h3>' +
        '<div class="ex-tags"><span>' + esc(D.EXERCISE_CATS[e.cat]) + '</span><span>' + esc(e.target) + '</span><span>' + esc(levelNames[e.level]) + '</span>' +
        e.place.map(function (p) { return '<span>' + esc(D.PLACES[p]) + '</span>'; }).join('') + '</div>' +
        '<ol>' + e.how.map(li).join('') + '</ol>' +
        '<p><strong>ポイント</strong>　' + esc(e.point) + '</p>' +
        '<p class="muted small">注意　' + esc(e.caution) + '</p>' +
        '<div class="vol">' + esc(E.displayName(c)) + 'の目安：' + esc(e.volume[Math.min(3, Math.max(1, lv))]) + '</div>' +
        '</div>';
    }).join('') || '<p class="muted">条件に合う運動がありません。絞り込みを変えてみてください。</p>';
  }

  // ------------------------------------------------------------------
  // 知識
  // ------------------------------------------------------------------
  function renderKnowledge() {
    $('#knowledgeList').innerHTML = D.KNOWLEDGE.map(function (k) {
      return '<div class="card"><h3>' + esc(k.title) + '</h3><p>' + esc(k.body) + '</p></div>';
    }).join('');
    var c = current();
    var seg = E.phaseForDay(E.buildPlan(c.totalDays), E.todayDay(c));
    var ph = D.PHASES[seg.id];
    var concernTips = D.TIPS.filter(function (t) {
      return t.tags.some(function (tag) { return (c.concerns || []).indexOf(tag) !== -1; });
    });
    var html = '<p><span class="phase-badge" style="background:' + seg.color + '">' + esc(ph.name) + '</span>' + esc(ph.purpose) + '</p>';
    if (concernTips.length) {
      html += '<h4>' + esc(E.displayName(c)) + 'の気になることに合わせたヒント</h4><ul>' +
        concernTips.map(function (t) { return '<li><strong>' + esc(t.title) + '</strong>　' + esc(t.body) + '</li>'; }).join('') + '</ul>';
    } else {
      html += '<p class="hint">プロフィールで「気になっていること」を選ぶと、その方に合わせたヒントがここに並びます。</p>';
    }
    $('#phaseKnowledge').innerHTML = html;
  }

  // ------------------------------------------------------------------
  // イベント
  // ------------------------------------------------------------------
  function bind() {
    function create() {
      var c = newClient();
      state.clients.push(c);
      state.tab = 'profile';
      selectClient(c.id);
      $('#profileForm').elements.name.focus();
    }
    $('#btnNewClient').addEventListener('click', create);
    $('#btnEmptyNew').addEventListener('click', create);

    $('#clientList').addEventListener('click', function (ev) {
      var b = ev.target.closest('button[data-id]');
      if (b) selectClient(b.getAttribute('data-id'));
    });

    $('.tabs').addEventListener('click', function (ev) {
      var b = ev.target.closest('.tab');
      if (b) showTab(b.getAttribute('data-tab'));
    });

    var f = $('#profileForm');
    f.addEventListener('submit', function (ev) {
      ev.preventDefault();
      readProfileForm();
      save();
      state.day = E.todayDay(current());
      renderAll();
      toast('保存しました。プランとコメントに反映されています');
    });
    $('#daysRange').addEventListener('input', function () { syncDays(this.value); });
    $('#daysNum').addEventListener('change', function () { syncDays(this.value); });
    $all('[data-days]').forEach(function (b) {
      b.addEventListener('click', function () { syncDays(b.getAttribute('data-days')); });
    });

    $('#btnDeleteClient').addEventListener('click', function () {
      var c = current();
      if (!c) return;
      if (!window.confirm((c.name || 'このクライアント') + 'のデータを削除します。よろしいですか？')) return;
      state.clients = state.clients.filter(function (x) { return x.id !== c.id; });
      state.currentId = state.clients.length ? state.clients[0].id : null;
      state.day = null;
      save();
      renderAll();
    });

    $('#logForm').addEventListener('submit', function (ev) {
      ev.preventDefault();
      var c = current();
      var date = this.elements.date.value;
      var w = parseFloat(this.elements.weight.value);
      if (!date || isNaN(w)) return;
      c.logs = (c.logs || []).filter(function (l) { return l.date !== date; });
      c.logs.push({ date: date, weight: w });
      this.elements.weight.value = '';
      save();
      renderMetrics();
      renderLogs();
      renderComment();
      toast('記録しました。コメントにも反映されます');
    });
    $('#logList').addEventListener('click', function (ev) {
      var b = ev.target.closest('button[data-date]');
      if (!b) return;
      var c = current();
      var d = b.getAttribute('data-date');
      c.logs = (c.logs || []).filter(function (l) { return l.date !== d; });
      save();
      renderMetrics();
      renderLogs();
      renderComment();
    });

    function setDay(v) {
      var total = E.clampDays(current().totalDays);
      state.day = Math.min(Math.max(1, parseInt(v, 10) || 1), total);
      state.variant = 0;
      $('#dayRange').value = state.day;
      $('#dayNum').value = state.day;
      renderComment();
    }
    $('#dayRange').addEventListener('input', function () { setDay(this.value); });
    $('#dayNum').addEventListener('change', function () { setDay(this.value); });
    $('#btnToday').addEventListener('click', function () { setDay(E.todayDay(current())); });
    ['#formatSelect', '#emojiSelect', '#chkTip', '#chkExercise', '#chkProgress'].forEach(function (s) {
      $(s).addEventListener('change', function () { renderComment(); renderSceneDetail(); });
    });
    $('#btnRegenerate').addEventListener('click', function () {
      state.variant += 1;
      renderComment();
    });
    $('#commentOutput').addEventListener('input', function () { $('#commentCount').textContent = countLabel(this.value); });
    $('#sceneOutput').addEventListener('input', function () { $('#sceneCount').textContent = countLabel(this.value); });

    $('#btnBulk').addEventListener('click', runBulk);
    $all('[data-bulk]').forEach(function (b) {
      b.addEventListener('click', function () {
        var c = current();
        var total = E.clampDays(c.totalDays);
        var day = E.todayDay(c);
        var kind = b.getAttribute('data-bulk');
        var from = 1, to = total;
        if (kind === 'week') { from = day; to = Math.min(total, day + 6); }
        if (kind === 'phase') { var seg = E.phaseForDay(E.buildPlan(total), day); from = seg.start; to = seg.end; }
        $('#bulkFrom').value = from;
        $('#bulkTo').value = to;
        runBulk();
      });
    });
    $('#bulkList').addEventListener('click', function (ev) {
      var b = ev.target.closest('button[data-copy]');
      if (b) copyText(state.bulk[+b.getAttribute('data-copy')].text);
    });
    $('#btnBulkCopy').addEventListener('click', function () {
      if (!state.bulk.length) return toast('先に「まとめて作る」を押してください');
      copyText(bulkText());
    });
    $('#btnBulkDownload').addEventListener('click', function () {
      if (!state.bulk.length) return toast('先に「まとめて作る」を押してください');
      var c = current();
      download((c.name || 'client') + '_コメント_' + state.bulk[0].day + '-' + state.bulk[state.bulk.length - 1].day + '日目.txt', bulkText());
    });

    $('#sceneGrid').addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-scene]');
      if (!b) return;
      state.sceneId = b.getAttribute('data-scene');
      state.sceneVariant = 0;
      renderScenes();
    });
    $('#btnSceneRegen').addEventListener('click', function () {
      state.sceneVariant += 1;
      renderSceneDetail();
    });

    ['#exCat', '#exPlace', '#exFit'].forEach(function (s) { $(s).addEventListener('change', renderExercises); });

    $all('.share-row').forEach(buildShareRow);

    $('#btnExport').addEventListener('click', function () {
      download('diet-support-data_' + today() + '.json', JSON.stringify({ clients: state.clients }, null, 2), 'application/json');
    });
    $('#fileImport').addEventListener('change', function () {
      var file = this.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        try {
          var data = JSON.parse(reader.result);
          if (!data || !Array.isArray(data.clients)) throw new Error('format');
          if (!window.confirm(data.clients.length + '名分のデータを読み込みます。現在のデータは置き換わります。よろしいですか？')) return;
          state.clients = data.clients;
          state.currentId = state.clients.length ? state.clients[0].id : null;
          state.day = null;
          save();
          renderAll();
          toast('読み込みました');
        } catch (e) {
          toast('ファイルの形式が正しくありません');
        }
      };
      reader.readAsText(file);
      this.value = '';
    });
  }

  // ------------------------------------------------------------------
  // 起動
  // ------------------------------------------------------------------
  initProfileOptions();
  initExerciseFilters();
  load();
  if (!current() && state.clients.length) state.currentId = state.clients[0].id;
  bind();
  renderAll();
})();
