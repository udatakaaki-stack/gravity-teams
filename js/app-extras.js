/*
 * ダイエットサポートプログラム：追加機能の画面
 *   安全アラート / 記録項目 / 初回カウンセリング / 返信アシスト / 週の振り返り /
 *   送信管理と履歴 / 食事の組み合わせ例 / 印刷用プラン表
 * app.js の起動時に init(api) が呼ばれ、画面を描き直すたびに render() が呼ばれます。
 */
(function () {
  'use strict';

  var D = window.DIET_DATA;
  var E = window.DietEngine;
  var F = window.DietFeatures;
  var A; // app.js から渡される窓口
  var $, $all, esc;

  var local = {
    counselOut: 'message',
    reply: { moods: [], topics: [], crisis: [], symptoms: [] },
    replyVariant: 0,
    weeklyEnd: null,
    weeklyVariant: 0,
    mealPicked: null,
    mealVariant: 0
  };

  function today() { return E.formatDate(new Date()); }
  function shiftDate(s, n) { var d = E.parseDate(s); d.setDate(d.getDate() + n); return E.formatDate(d); }
  function setOutput(id, countId, text) {
    $('#' + id).value = text;
    $('#' + countId).textContent = A.countLabel(text);
  }
  function emojiLevel() {
    var el = document.getElementById('emojiSelect');
    return el ? parseInt(el.value, 10) : 1;
  }

  // ------------------------------------------------------------------
  // 安全アラート
  // ------------------------------------------------------------------
  var LEVEL_LABEL = { urgent: 'すぐ確認', warn: '注意', info: '確認' };

  function renderAlerts() {
    var c = A.current();
    var box = $('#alertBox');
    var alerts = F.safetyAlerts(c);
    if (!alerts.length) { box.hidden = true; box.innerHTML = ''; return; }
    box.hidden = false;
    box.innerHTML = alerts.map(function (a, i) {
      return '<details class="alert ' + a.level + '"' + (a.level === 'urgent' ? ' open' : '') + '><summary class="alert-head"><span class="alert-level">' + LEVEL_LABEL[a.level] + '</span><strong>' + esc(a.title) + '</strong></summary>' +
        '<p>' + esc(a.body) + '</p>' +
        (a.message ? '<button type="button" class="btn ghost small" data-alert-copy="' + i + '">クライアントへの文面をコピー</button>' : '') + '</details>';
    }).join('');
    box.onclick = function (ev) {
      var b = ev.target.closest('[data-alert-copy]');
      if (b) A.copyText(F.fillName(c, alerts[+b.getAttribute('data-alert-copy')].message) + (c.coach ? '\n\n' + c.coach : ''));
    };
  }

  // ------------------------------------------------------------------
  // 初回カウンセリング
  // ------------------------------------------------------------------
  function buildCounselForm() {
    $('#counselForm').innerHTML = F.COUNSELING.map(function (g) {
      return '<fieldset><legend>' + esc(g.group) + '</legend>' + g.items.map(function (it) {
        var field;
        if (it.type === 'select') {
          field = '<select name="' + it.id + '">' + it.options.map(function (o, i) {
            var lab = it.optionLabels ? it.optionLabels[i] : o;
            return '<option value="' + esc(o) + '">' + esc(lab || '選んでください') + '</option>';
          }).join('') + '</select>';
        } else if (it.type === 'checks') {
          field = '<span class="checks">' + it.options.map(function (o) {
            return '<label><input type="checkbox" name="' + it.id + '" value="' + esc(o) + '"> ' + esc(o) + '</label>';
          }).join('') + '</span>';
        } else if (it.type === 'textarea') {
          field = '<textarea name="' + it.id + '" rows="3" placeholder="' + esc(it.placeholder || '') + '"></textarea>';
        } else {
          field = '<input type="' + (it.type === 'time' ? 'time' : 'text') + '" name="' + it.id + '" placeholder="' + esc(it.placeholder || '') + '">';
        }
        var wide = it.type === 'textarea' || it.type === 'checks' || it.type === 'text' ? ' class="wide"' : '';
        return '<label' + wide + '>' + esc(it.label) + field + '</label>';
      }).join('') + '</fieldset>';
    }).join('');
  }

  function readCounsel() {
    var f = $('#counselForm');
    var ans = {};
    F.COUNSELING.forEach(function (g) {
      g.items.forEach(function (it) {
        if (it.type === 'checks') {
          ans[it.id] = $all('input[name="' + it.id + '"]:checked', f).map(function (i) { return i.value; });
        } else {
          var v = f.elements[it.id].value;
          if (v && String(v).trim()) ans[it.id] = String(v).trim();
        }
      });
    });
    return ans;
  }

  function fillCounsel() {
    var c = A.current();
    var ans = c.counseling || {};
    var f = $('#counselForm');
    F.COUNSELING.forEach(function (g) {
      g.items.forEach(function (it) {
        if (it.type === 'checks') {
          $all('input[name="' + it.id + '"]', f).forEach(function (i) { i.checked = (ans[it.id] || []).indexOf(i.value) !== -1; });
        } else {
          f.elements[it.id].value = ans[it.id] || '';
        }
      });
    });
    $('#counselApplyNote').textContent = '';
    renderCounselOutput();
  }

  function renderCounselOutput() {
    var c = A.current();
    $all('[data-counsel-out]').forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-counsel-out') === local.counselOut); });
    var text = local.counselOut === 'summary' ? F.counselingSummary(c, c.counseling) : F.counselingMessage(c, { emoji: emojiLevel() });
    setOutput('counselOutput', 'counselCount', text);
  }

  function bindCounsel() {
    buildCounselForm();
    $('#btnCounselSave').addEventListener('click', function () {
      A.current().counseling = readCounsel();
      A.save();
      renderCounselOutput();
      renderAlerts();
      A.toast('カウンセリングの回答を保存しました');
    });
    $('#btnCounselApply').addEventListener('click', function () {
      var c = A.current();
      c.counseling = readCounsel();
      var res = F.counselingPatch(c, c.counseling);
      if (!res.notes.length) { A.toast('反映できる回答がまだありません'); return; }
      Object.assign(c, res.patch);
      A.save();
      A.renderAll();
      A.showTab('counsel');
      $('#counselApplyNote').textContent = 'プロフィールに反映しました：' + res.notes.join('、') + '。プロフィールのタブで確認できます。';
      A.toast('プロフィールに反映しました');
    });
    $('[data-panel="counsel"]').addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-counsel-out]');
      if (!b) return;
      local.counselOut = b.getAttribute('data-counsel-out');
      renderCounselOutput();
    });
    $('#counselOutput').addEventListener('input', function () { $('#counselCount').textContent = A.countLabel(this.value); });
  }

  // ------------------------------------------------------------------
  // 返信アシスト
  // ------------------------------------------------------------------
  function moodLabel(id) {
    var m = D.MOODS.filter(function (x) { return x.id === id; })[0];
    return m ? m.label : id;
  }

  function renderReply() {
    var c = A.current();
    var r = local.reply;
    $('#replyMoods').innerHTML = F.MOOD_PRIORITY.map(function (id) {
      return '<button type="button" class="chip' + (r.moods.indexOf(id) !== -1 ? ' active' : '') + '" data-rmood="' + id + '">' + esc(moodLabel(id)) + '</button>';
    }).join('');
    $('#replyTopics').innerHTML = Object.keys(F.REPLY_TOPICS).map(function (id) {
      return '<button type="button" class="chip' + (r.topics.indexOf(id) !== -1 ? ' active' : '') + '" data-rtopic="' + id + '">' + esc(F.REPLY_TOPICS[id].label) + '</button>';
    }).join('');
    var safety = '';
    if (r.crisis.length) {
      safety = '<div class="alert urgent"><div class="alert-head"><span class="alert-level">すぐ確認</span><strong>つらい気持ちを示す言葉があります（' + esc(r.crisis.join('、')) + '）</strong></div>' +
        '<p>ダイエットの話はいったん脇に置き、気持ちを受け止めることを優先した返事にしています。命に関わる心配がある場合は、ご家族や専門家と連携してください。厚生労働省のサイト「まもろうよ こころ」に相談窓口がまとめられています。</p></div>';
    } else if (r.symptoms.length) {
      safety = '<div class="alert urgent"><div class="alert-head"><span class="alert-level">すぐ確認</span><strong>体調不良を示す言葉があります（' + esc(r.symptoms.join('、')) + '）</strong></div>' +
        '<p>休養と、必要に応じた受診をすすめる返事にしています。</p></div>';
    }
    $('#replySafety').innerHTML = safety;
    var text = $('#replyInput').value.trim() || r.moods.length || r.topics.length
      ? F.buildReply(c, r, { variant: local.replyVariant, emoji: emojiLevel() })
      : '';
    setOutput('replyOutput', 'replyCount', text);
  }

  function bindReply() {
    var timer;
    $('#replyInput').addEventListener('input', function () {
      var el = this;
      clearTimeout(timer);
      timer = setTimeout(function () {
        local.reply = F.analyzeReply(el.value);
        local.replyVariant = 0;
        renderReply();
      }, 250);
    });
    $('[data-panel="reply"]').addEventListener('click', function (ev) {
      var m = ev.target.closest('[data-rmood]');
      var t = ev.target.closest('[data-rtopic]');
      if (!m && !t) return;
      var list = m ? local.reply.moods : local.reply.topics;
      var id = m ? m.getAttribute('data-rmood') : t.getAttribute('data-rtopic');
      var i = list.indexOf(id);
      if (i === -1) list.push(id); else list.splice(i, 1);
      renderReply();
    });
    $('#btnReplyRegen').addEventListener('click', function () { local.replyVariant += 1; renderReply(); });
    $('#replyOutput').addEventListener('input', function () { $('#replyCount').textContent = A.countLabel(this.value); });
    $('#btnReplyToRapport').addEventListener('click', function () {
      var mood = F.MOOD_PRIORITY.filter(function (m) { return local.reply.moods.indexOf(m) !== -1; })[0];
      if (!mood) { A.toast('気持ちが選ばれていません'); return; }
      A.current().mood = mood;
      A.save();
      A.toast('「' + moodLabel(mood) + '」をラポール21日に反映しました');
    });
  }

  // ------------------------------------------------------------------
  // 週の振り返り
  // ------------------------------------------------------------------
  function renderWeekly() {
    var c = A.current();
    if (!local.weeklyEnd) local.weeklyEnd = today();
    $('#weeklyEnd').value = local.weeklyEnd;
    var res = F.weeklyReport(c, local.weeklyEnd, { variant: local.weeklyVariant, emoji: emojiLevel() });
    var st = res.stats;
    $('#weeklyRange').textContent = st.start.replace(/-/g, '/') + '〜' + st.end.replace(/-/g, '/') + (st.week ? '（' + st.week + '週目・' + st.phase + '）' : '');
    var tiles = [];
    function tile(label, val) { tiles.push('<div class="metric"><span>' + esc(label) + '</span><strong>' + esc(val) + '</strong></div>'); }
    tile('記録した日', st.recordDays + '日');
    if (st.weight) tile('体重の変化', (st.weight.diff > 0 ? '＋' : st.weight.diff < 0 ? '−' : '±') + Math.abs(st.weight.diff) + 'kg');
    if (st.waist) tile('ウエストの変化', (st.waist.diff > 0 ? '＋' : st.waist.diff < 0 ? '−' : '±') + Math.abs(st.waist.diff) + 'cm');
    if (st.sleepAvg !== null) tile('平均睡眠', st.sleepAvg + '時間');
    if (st.stepsAvg !== null) tile('平均歩数', st.stepsAvg.toLocaleString('ja-JP') + '歩');
    var moods = Object.keys(st.moods).map(function (k) {
      var m = F.LOG_MOODS.filter(function (x) { return x.id === k; })[0];
      return (m ? m.label : k) + st.moods[k];
    });
    if (moods.length) tile('気分', moods.join('・'));
    $('#weeklyStats').innerHTML = tiles.join('');
    setOutput('weeklyOutput', 'weeklyCount', res.text);
  }

  function bindWeekly() {
    $('#weeklyEnd').addEventListener('change', function () { local.weeklyEnd = this.value || today(); local.weeklyVariant = 0; renderWeekly(); });
    $('#btnWeeklyPrev').addEventListener('click', function () { local.weeklyEnd = shiftDate(local.weeklyEnd || today(), -7); renderWeekly(); });
    $('#btnWeeklyNext').addEventListener('click', function () { local.weeklyEnd = shiftDate(local.weeklyEnd || today(), 7); renderWeekly(); });
    $('#btnWeeklyRegen').addEventListener('click', function () { local.weeklyVariant += 1; renderWeekly(); });
    $('#weeklyOutput').addEventListener('input', function () { $('#weeklyCount').textContent = A.countLabel(this.value); });
  }

  // ------------------------------------------------------------------
  // 送信管理と履歴
  // ------------------------------------------------------------------
  function rapportDayToday(c) {
    var start = E.parseDate(c.rapportStart || c.startDate);
    if (!start) return null;
    var d = Math.round((E.parseDate(today()) - start) / 86400000) + 1;
    return d;
  }

  function sentRapportDays(c) {
    return (c.history || []).filter(function (h) { return h.kind === 'rapport' && h.meta && h.meta.rapportDay; })
      .map(function (h) { return h.meta.rapportDay; });
  }

  function renderSent() {
    var t = today();
    var rows = [];
    A.state.clients.forEach(function (c) {
      var hist = c.history || [];
      var sentToday = hist.filter(function (h) { return h.date === t; });
      var day = E.todayDay(c);
      var start = E.parseDate(c.startDate);
      var started = start && c.startDate <= t;
      var ended = start && Math.round((E.parseDate(t) - start) / 86400000) + 1 > E.clampDays(c.totalDays);
      if (started && !ended) {
        var done = sentToday.some(function (h) { return h.kind !== 'rapport'; });
        rows.push({ c: c, label: '今日のメッセージ（' + day + '日目）', done: done, tab: 'comment' });
      }
      var rd = rapportDayToday(c);
      if (rd && rd >= 1 && rd <= E.RAPPORT_TOTAL) {
        var rdone = sentRapportDays(c).indexOf(rd) !== -1;
        rows.push({ c: c, label: 'ラポール' + rd + '日目「' + D.RAPPORT_DAYS[rd - 1].theme + '」', done: rdone, tab: 'rapport', rpDay: rd });
      }
    });
    rows.sort(function (a, b) { return a.done - b.done; });
    $('#sendToday').innerHTML = rows.map(sendRow).join('') || '<p class="muted">今日の送信予定はありません。</p>';

    // 送り忘れ（ラポールを1件以上送信済みにしたクライアントだけ）
    var missed = [];
    A.state.clients.forEach(function (c) {
      var sent = sentRapportDays(c);
      if (!sent.length) return;
      var rd = Math.min(rapportDayToday(c) || 0, E.RAPPORT_TOTAL + 1);
      for (var d = 1; d < rd && d <= E.RAPPORT_TOTAL; d++) {
        if (sent.indexOf(d) === -1) missed.push({ c: c, label: 'ラポール' + d + '日目「' + D.RAPPORT_DAYS[d - 1].theme + '」', done: false, tab: 'rapport', rpDay: d });
      }
    });
    $('#sendMissed').innerHTML = missed.map(sendRow).join('') ||
      '<p class="muted">送り忘れはありません。（ラポール21日のメッセージを1件以上「送信済み」にしたクライアントが対象です）</p>';

    // 履歴（選択中のクライアント）
    var c = A.current();
    var kind = $('#historyKind').value;
    var hist = (c.history || []).filter(function (h) { return !kind || h.kind === kind; });
    $('#historyTitle').textContent = A.current().name ? E.displayName(c) + 'への送信履歴（' + (c.history || []).length + '件）' : '送信履歴';
    $('#historyList').innerHTML = hist.map(function (h) {
      return '<article class="bulk-item"><header><strong>' + esc(h.date.replace(/-/g, '/')) + ' ' + esc(h.time || '') + '・' + esc(h.kindLabel) + '・' + esc(h.label) + '</strong>' +
        '<span class="btn-row"><button type="button" class="btn ghost small" data-hcopy="' + esc(h.id) + '">コピー</button>' +
        '<button type="button" class="btn ghost small" data-hdel="' + esc(h.id) + '">削除</button></span></header>' +
        '<details><summary>本文を見る</summary><pre>' + esc(h.text) + '</pre></details></article>';
    }).join('') || '<p class="muted">まだ記録がありません。各タブの「✓ 送信済みにする」を押すと、ここに残ります。</p>';
  }

  function sendRow(r, i) {
    return '<div class="send-row' + (r.done ? ' done' : '') + '"><span class="send-status">' + (r.done ? '✓ 送信済み' : '未送信') + '</span>' +
      '<span class="send-name">' + esc(E.displayName(r.c)) + '</span><span class="send-label">' + esc(r.label) + '</span>' +
      '<button type="button" class="btn ghost small" data-open-client="' + esc(r.c.id) + '" data-open-tab="' + r.tab + '"' +
      (r.rpDay ? ' data-open-rp="' + r.rpDay + '"' : '') + '>開く</button></div>';
  }

  function bindSent() {
    $('#historyKind').innerHTML += Object.keys(A.kindLabels).map(function (k) {
      return '<option value="' + k + '">' + esc(A.kindLabels[k]) + '</option>';
    }).join('');
    $('#historyKind').addEventListener('change', renderSent);
    $('[data-panel="sent"]').addEventListener('click', function (ev) {
      var o = ev.target.closest('[data-open-client]');
      if (o) {
        var tab = o.getAttribute('data-open-tab');
        var rp = o.getAttribute('data-open-rp');
        A.state.tab = tab;
        A.selectClient(o.getAttribute('data-open-client'));
        if (rp) {
          A.state.rpDay = +rp;
          var b = document.querySelector('[data-rpday="' + rp + '"]');
          if (b) b.click();
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      var c = A.current();
      var cp = ev.target.closest('[data-hcopy]');
      if (cp) {
        var h = (c.history || []).filter(function (x) { return x.id === cp.getAttribute('data-hcopy'); })[0];
        if (h) A.copyText(h.text);
        return;
      }
      var del = ev.target.closest('[data-hdel]');
      if (del && window.confirm('この履歴を削除します。よろしいですか？')) {
        c.history = (c.history || []).filter(function (x) { return x.id !== del.getAttribute('data-hdel'); });
        A.save();
        renderSent();
      }
    });
  }

  // ------------------------------------------------------------------
  // 食事の組み合わせ例
  // ------------------------------------------------------------------
  function renderMeals() {
    var c = A.current();
    var time = $('#mealTime').value;
    var style = $('#mealStyle').value;
    if (!local.mealPicked) local.mealPicked = F.mealProposal(c, { variant: local.mealVariant }).meals;
    var picked = local.mealPicked;
    $('#mealGrid').innerHTML = F.MEALS.map(function (m, i) {
      if ((time && m.time !== time) || (style && m.style !== style)) return '';
      var on = picked.indexOf(m) !== -1;
      return '<div class="card meal-card' + (on ? ' picked' : '') + '"><div class="ex-tags"><span>' + esc(F.MEAL_TIMES[m.time]) + '</span><span>' + esc(F.MEAL_STYLES[m.style]) + '</span></div>' +
        '<h3>' + esc(m.name) + '</h3><p>' + esc(m.items) + '</p><p class="muted small">' + esc(m.point) + '</p>' +
        '<button type="button" class="btn ' + (on ? 'primary' : 'ghost') + ' small" data-meal="' + i + '">' + (on ? '提案に入っています（外す）' : '提案に入れる') + '</button></div>';
    }).join('');
    setOutput('mealOutput', 'mealCount', F.mealText(c, picked, { emoji: emojiLevel() }));
  }

  function bindMeals() {
    $('#mealTime').innerHTML += Object.keys(F.MEAL_TIMES).map(function (k) { return '<option value="' + k + '">' + esc(F.MEAL_TIMES[k]) + '</option>'; }).join('');
    $('#mealStyle').innerHTML += Object.keys(F.MEAL_STYLES).map(function (k) { return '<option value="' + k + '">' + esc(F.MEAL_STYLES[k]) + '</option>'; }).join('');
    ['#mealTime', '#mealStyle'].forEach(function (s) { $(s).addEventListener('change', renderMeals); });
    $('#mealGrid').addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-meal]');
      if (!b) return;
      var m = F.MEALS[+b.getAttribute('data-meal')];
      var i = local.mealPicked.indexOf(m);
      if (i !== -1) local.mealPicked.splice(i, 1);
      else {
        local.mealPicked.push(m);
        if (local.mealPicked.length > 4) local.mealPicked.shift();
      }
      renderMeals();
    });
    $('#btnMealRegen').addEventListener('click', function () {
      local.mealVariant += 1;
      local.mealPicked = null;
      renderMeals();
    });
    $('#mealOutput').addEventListener('input', function () { $('#mealCount').textContent = A.countLabel(this.value); });
  }

  // ------------------------------------------------------------------
  // 印刷用プラン表
  // ------------------------------------------------------------------
  function buildPrint() {
    var c = A.current();
    var total = E.clampDays(c.totalDays);
    var plan = E.buildPlan(total);
    var start = E.parseDate(c.startDate);
    function dateOf(n) {
      if (!start) return '';
      var d = new Date(start.getTime());
      d.setDate(d.getDate() + n - 1);
      return (d.getMonth() + 1) + '月' + d.getDate() + '日';
    }
    function list(items) { return '<ul>' + items.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>'; }
    var name = E.displayName(c);
    var html = '<div class="print-sheet">';
    html += '<h1>' + esc(name) + 'のダイエットプラン</h1>';
    var info = [];
    info.push('期間：' + total + '日間' + (start ? '（' + dateOf(1) + '〜' + dateOf(total) + '）' : ''));
    if (c.startWeight && c.goalWeight) info.push('体重：' + c.startWeight + 'kg → 目標 ' + c.goalWeight + 'kg');
    if (c.goalNote) info.push('目的：' + c.goalNote);
    html += '<p class="print-info">' + info.map(esc).join('<br>') + '</p>';
    html += '<div class="print-timeline">' + plan.map(function (p) {
      return '<div style="width:' + (p.days / total * 100) + '%;background:' + p.color + '">' + (p.days / total > 0.1 ? esc(p.name) : '') + '</div>';
    }).join('') + '</div>';
    html += '<table class="print-table"><thead><tr><th>期</th><th>期間</th><th>この時期の目的</th><th>食事</th><th>運動</th><th>心の持ち方</th></tr></thead><tbody>';
    plan.forEach(function (p) {
      var ph = D.PHASES[p.id];
      var range = p.start + '〜' + p.end + '日目' + (start ? '<br>' + dateOf(p.start) + '〜' + dateOf(p.end) : '');
      html += '<tr><th style="border-left:6px solid ' + p.color + '">' + esc(ph.name) + '<br><small>' + esc(ph.sub) + '</small></th><td>' + range + '</td>' +
        '<td>' + esc(ph.purpose) + '</td><td>' + list(ph.diet) + '</td><td>' + list(ph.exercise) + '</td><td>' + list(ph.mind) + '</td></tr>';
    });
    html += '</tbody></table>';
    html += '<div class="print-box"><h2>毎日の3つの約束</h2><ol><li>体重は毎日同じ条件で測って記録する（起床後・トイレの後など）</li>' +
      '<li>毎食たんぱく質のおかずを1品入れる</li><li>完璧を目指さず「7割できたら合格」</li></ol></div>';
    html += '<div class="print-box"><h2>コーチから</h2><p>' + esc(name) + 'のペースを何より大切に、一緒に進めていきます。うまくいかない日があっても大丈夫です。困った時は、いつでも気軽に連絡してくださいね。</p>' +
      (c.coach ? '<p class="print-sign">' + esc(c.coach) + '</p>' : '') + '</div>';
    html += '<p class="print-note">このプランの数値や内容は一般的な目安です。体調に異変を感じた時はすぐに中止し、医療機関に相談してください。持病のある方、服薬中の方、妊娠中・授乳中の方は、医師に相談のうえで取り組んでください。</p>';
    html += '</div>';
    $('#printArea').innerHTML = html;
  }

  // ------------------------------------------------------------------
  // 登録
  // ------------------------------------------------------------------
  (window.DietExtras = window.DietExtras || []).push({
    init: function (api) {
      A = api;
      $ = api.$;
      $all = api.$all;
      esc = api.esc;

      // 送信履歴の種類と見出し
      Object.assign(A.kindLabels, { counsel: '初回カウンセリング', reply: '返信への返事', weekly: '週の振り返り', meal: '食事の提案' });
      A.historyLabels.counsel = function () { return { label: local.counselOut === 'summary' ? '回答のまとめ' : '事前の質問', meta: {} }; };
      A.historyLabels.reply = function () {
        var t = local.reply.topics.map(function (id) { return F.REPLY_TOPICS[id].label; }).join('・');
        return { label: '返信への返事' + (t ? '（' + t + '）' : ''), meta: {} };
      };
      A.historyLabels.weekly = function () { return { label: '週の振り返り（〜' + (local.weeklyEnd || today()).replace(/-/g, '/') + '）', meta: {} }; };
      A.historyLabels.meal = function () { return { label: '食事の提案', meta: {} }; };

      $('#logMood').innerHTML = F.LOG_MOODS.map(function (m) { return '<option value="' + m.id + '">' + esc(m.label) + '</option>'; }).join('');
      bindCounsel();
      bindReply();
      bindWeekly();
      bindSent();
      bindMeals();
      $('#btnPrintPlan').addEventListener('click', function () {
        buildPrint();
        window.print();
      });
      var emojiSel = document.getElementById('emojiSelect');
      if (emojiSel) emojiSel.addEventListener('change', function () { if (A.current()) { renderReply(); renderWeekly(); renderMeals(); renderCounselOutput(); } });
    },
    render: function () {
      // クライアントが切り替わった時だけ、入力中の内容をリセットする
      var id = A.state.currentId;
      if (id !== local.clientId) {
        local.clientId = id;
        local.mealPicked = null;
        local.mealVariant = 0;
        local.replyVariant = 0;
        local.weeklyVariant = 0;
        local.reply = { moods: [], topics: [], crisis: [], symptoms: [] };
        $('#replyInput').value = '';
      }
      renderAlerts();
      fillCounsel();
      renderReply();
      renderWeekly();
      renderSent();
      renderMeals();
    },
    onTab: function (tab) {
      if (tab === 'sent') renderSent();
    },
    onHistory: function () {
      renderSent();
    }
  });
})();
