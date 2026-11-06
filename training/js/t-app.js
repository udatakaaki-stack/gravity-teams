/*
 * トレーニングサポートプログラム：画面の操作
 */
(function () {
  'use strict';

  var D = window.TRAIN_DATA;
  var C = window.TRAIN_CONTENT;
  var E = window.TrainEngine;
  var STORAGE_KEY = 'trainingSupport.v1';

  var state = {
    teams: [], members: [], templates: [],
    view: null, currentId: null,
    teamTab: 'tSettings', memberTab: 'mProfile',
    cDay: null, cVariant: 0, tmDay: null, tmVariant: 0,
    wEnd: null, wVariant: 0, rpDay: 1, rpVariant: 0,
    sceneId: null, tplId: null, bulk: []
  };

  // ------------------------------------------------------------------
  // 道具
  // ------------------------------------------------------------------
  function $(s, r) { return (r || document).querySelector(s); }
  function $all(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(s) {
    return String(s === undefined || s === null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function li(s) { return '<li>' + esc(s) + '</li>'; }
  function uid(p) { return p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function slash(d) { return String(d || '').replace(/-/g, '/'); }

  var toastTimer;
  function toast(m) {
    var t = $('#toast');
    t.textContent = m;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2200);
  }

  function load() {
    try {
      var d = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (d) {
        state.teams = d.teams || [];
        state.members = d.members || [];
        state.templates = d.templates || [];
        state.view = d.view || null;
        state.currentId = d.currentId || null;
      }
    } catch (e) { /* 保存できない環境でも動くようにする */ }
  }
  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ teams: state.teams, members: state.members, templates: state.templates, view: state.view, currentId: state.currentId }));
    } catch (e) { toast('このブラウザでは保存できませんでした。データ書き出しで保管してください。'); }
  }

  function team() { return state.view === 'team' ? state.teams.filter(function (t) { return t.id === state.currentId; })[0] || null : null; }
  function member() { return state.view === 'member' ? state.members.filter(function (m) { return m.id === state.currentId; })[0] || null : null; }
  function settingsOf(m) { return E.planSettings(m, state.teams); }

  function copyText(text) {
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); toast('コピーしました。LINEやメールに貼り付けてください'); } catch (e) { toast('コピーできませんでした。テキストを選択してコピーしてください'); }
      document.body.removeChild(ta);
    }
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(function () { toast('コピーしました。LINEやメールに貼り付けてください'); }, fallback);
    } else fallback();
  }

  function xLength(text) {
    var n = 0;
    for (var i = 0; i < text.length; i++) {
      var c = text.charCodeAt(i);
      if (c >= 0xd800 && c <= 0xdbff) { n += 2; i++; continue; }
      n += c <= 0x10ff || (c >= 0x2000 && c <= 0x200d) || (c >= 0x2010 && c <= 0x201f) ? 1 : 2;
    }
    return n;
  }
  function countLabel(text) { return text.length + '文字　X換算 ' + xLength(text) + ' / 280'; }
  function setOut(id, countId, text) { $('#' + id).value = text; $('#' + countId).textContent = countLabel(text); }

  function buildShareRow(row) {
    var target = row.getAttribute('data-share-target');
    var subjectId = row.getAttribute('data-mail-subject');
    var html = '<button type="button" class="btn primary small" data-act="copy">コピー</button>' +
      '<button type="button" class="btn line small" data-act="line">LINEで送る</button>' +
      '<button type="button" class="btn ghost small" data-act="mail">メールで送る</button>' +
      '<button type="button" class="btn x small" data-act="x">Xに投稿</button>';
    if (navigator.share) html += '<button type="button" class="btn ghost small" data-act="share">その他のアプリで共有</button>';
    row.innerHTML = html;
    row.addEventListener('click', function (ev) {
      var b = ev.target.closest('button');
      if (!b) return;
      var text = document.getElementById(target).value;
      var act = b.getAttribute('data-act');
      if (act === 'copy') copyText(text);
      else if (act === 'line') window.open('https://line.me/R/share?text=' + encodeURIComponent(text), '_blank', 'noopener');
      else if (act === 'x') {
        if (xLength(text) > 280) toast('Xの文字数上限を超えています。投稿画面で調整してください');
        window.open('https://twitter.com/intent/tweet?text=' + encodeURIComponent(text), '_blank', 'noopener');
      } else if (act === 'mail') {
        var subject = subjectId && document.getElementById(subjectId) ? document.getElementById(subjectId).value : '';
        window.location.href = 'mailto:?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(text);
      } else if (act === 'share') navigator.share({ text: text }).catch(function () {});
    });
  }

  function download(name, text, type) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: type || 'text/plain;charset=utf-8' }));
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 0);
  }

  // ------------------------------------------------------------------
  // フォームの部品
  // ------------------------------------------------------------------
  function initFormParts() {
    $all('select[data-options]').forEach(function (s) {
      var kind = s.getAttribute('data-options');
      var empty = s.getAttribute('data-empty');
      var src = kind === 'levels' ? D.LEVELS : kind === 'tones' ? mapLabel(D.TONES) : mapLabel(D.GOALS);
      s.innerHTML = (empty ? '<option value="">' + esc(empty) + '</option>' : '') +
        Object.keys(src).map(function (k) { return '<option value="' + k + '">' + esc(src[k]) + '</option>'; }).join('');
    });
    $all('[data-checks]').forEach(function (box) {
      var kind = box.getAttribute('data-checks');
      var name = box.getAttribute('data-name');
      var items = kind === 'weekdays' ? [1, 2, 3, 4, 5, 6, 0].map(function (d) { return { v: d, l: D.WEEKDAYS[d] }; })
        : kind === 'places' ? Object.keys(D.PLACES).map(function (k) { return { v: k, l: D.PLACES[k] }; })
          : D.CONCERNS.map(function (c) { return { v: c.id, l: c.label }; });
      box.innerHTML = items.map(function (i) {
        return '<label><input type="checkbox" name="' + name + '" value="' + i.v + '"> ' + esc(i.l) + '</label>';
      }).join('');
    });
    $all('select[data-scale]').forEach(function (s) {
      var max = +s.getAttribute('data-scale');
      var zero = s.hasAttribute('data-zero');
      var hint = s.getAttribute('data-scale-hint') === 'mood' ? { 1: '（とても悪い）', 5: '（とてもよい）' } : max === 10 ? { 0: '（まったく楽）', 5: '（きつい）', 10: '（限界）' } : { 1: '（ほとんどない）', 5: '（とても強い）' };
      // 必須の項目は「選んでください」を初期値にして、選び忘れを防ぐ
      var html = s.hasAttribute('required') ? '<option value="">選んでください</option>' : '<option value="">―</option>';
      for (var i = zero ? 0 : 1; i <= max; i++) html += '<option value="' + i + '">' + i + (hint[i] || '') + '</option>';
      s.innerHTML = html;
    });
    // 期間のスライダーと数字の連動
    $all('form').forEach(function (f) {
      if (!f.elements.totalDaysRange) return;
      f.elements.totalDaysRange.addEventListener('input', function () { f.elements.totalDays.value = this.value; });
      f.elements.totalDays.addEventListener('change', function () {
        this.value = E.clampDays(this.value);
        f.elements.totalDaysRange.value = this.value;
      });
    });
  }
  function mapLabel(obj) { var o = {}; Object.keys(obj).forEach(function (k) { o[k] = obj[k].label; }); return o; }

  function fillForm(f, obj) {
    Array.prototype.forEach.call(f.elements, function (el) {
      if (!el.name || el.name === 'totalDaysRange') return;
      var v = obj[el.name];
      if (el.type === 'checkbox') {
        if (el.name === 'useTeamPlan') el.checked = v !== false;
        else el.checked = Array.isArray(v) && v.map(String).indexOf(el.value) !== -1;
      } else el.value = v === undefined || v === null ? '' : v;
    });
    if (f.elements.totalDaysRange) {
      f.elements.totalDays.value = E.clampDays(obj.totalDays);
      f.elements.totalDaysRange.value = f.elements.totalDays.value;
    }
  }

  function readForm(f, obj) {
    var arrays = {};
    Array.prototype.forEach.call(f.elements, function (el) {
      if (!el.name || el.name === 'totalDaysRange' || el.type === 'submit' || el.type === 'button') return;
      if (el.type === 'checkbox') {
        if (el.name === 'useTeamPlan') { obj.useTeamPlan = el.checked; return; }
        arrays[el.name] = arrays[el.name] || [];
        if (el.checked) arrays[el.name].push(el.name === 'trainingDays' ? +el.value : el.value);
      } else obj[el.name] = el.value.trim ? el.value.trim() : el.value;
    });
    Object.keys(arrays).forEach(function (k) { obj[k] = arrays[k]; });
    if ('totalDays' in obj) obj.totalDays = E.clampDays(obj.totalDays);
    if ('level' in obj) obj.level = parseInt(obj.level, 10) || 1;
    return obj;
  }

  // ------------------------------------------------------------------
  // 一覧
  // ------------------------------------------------------------------
  function renderLists() {
    $('#teamList').innerHTML = state.teams.map(function (t) {
      var count = state.members.filter(function (m) { return m.teamId === t.id; }).length;
      var s = E.planSettings({ teamId: t.id, useTeamPlan: true }, state.teams);
      var day = E.todayDay(s);
      var seg = E.phaseForDay(E.buildPlan(s), day);
      return '<li><button type="button" data-team="' + esc(t.id) + '" class="' + (state.view === 'team' && state.currentId === t.id ? 'active' : '') + '">' +
        '<span class="cl-name">' + esc(t.name || '（名前未設定）') + '</span><span class="cl-meta">' + count + '人・' + day + '日目・' + esc(seg.name) + '</span></button></li>';
    }).join('') || '<li class="hint">チームはまだありません</li>';
    var groups = state.teams.map(function (t) { return { t: t, ms: state.members.filter(function (m) { return m.teamId === t.id; }) }; });
    groups.push({ t: null, ms: state.members.filter(function (m) { return !m.teamId || !state.teams.some(function (t) { return t.id === m.teamId; }); }) });
    $('#memberList').innerHTML = groups.map(function (g) {
      return g.ms.map(function (m) {
        var alerts = E.alerts(m, settingsOf(m));
        var mark = alerts.some(function (a) { return a.level === 'urgent'; }) ? '⚠️ ' : alerts.some(function (a) { return a.level === 'warn'; }) ? '△ ' : '';
        return '<li><button type="button" data-member="' + esc(m.id) + '" class="' + (state.view === 'member' && state.currentId === m.id ? 'active' : '') + '">' +
          '<span class="cl-team">' + esc(g.t ? g.t.name : '個人') + '</span><span class="cl-name">' + mark + esc(m.name || '（名前未設定）') + '</span>' +
          '<span class="cl-meta">' + esc(D.LEVELS[m.level] ? D.LEVELS[m.level].replace(/（.*/, '') : '') + (m.position ? '・' + esc(m.position) : '') + '</span></button></li>';
      }).join('');
    }).join('') || '<li class="hint">メンバーはまだいません</li>';
  }

  function select(view, id) {
    state.view = view;
    state.currentId = id;
    state.cDay = null; state.cVariant = 0; state.tmDay = null; state.tmVariant = 0;
    state.wEnd = null; state.wVariant = 0; state.rpDay = 1; state.rpVariant = 0;
    save();
    renderAll();
  }

  function renderAll() {
    renderLists();
    var t = team();
    var m = member();
    $('#emptyState').hidden = !!(t || m);
    $('#teamSpace').hidden = !t;
    $('#memberSpace').hidden = !m;
    if (t) renderTeam();
    if (m) renderMember();
  }

  function showTab(group, tab) {
    if (group === 'team') state.teamTab = tab; else state.memberTab = tab;
    var nav = $('[data-tabs="' + group + '"]');
    $all('.tab', nav).forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-tab') === tab); });
    var space = group === 'team' ? $('#teamSpace') : $('#memberSpace');
    $all('.panel', space).forEach(function (p) { p.classList.toggle('active', p.getAttribute('data-panel') === tab); });
  }

  // ------------------------------------------------------------------
  // 期分化プラン（チーム・メンバー共通）
  // ------------------------------------------------------------------
  function renderPlanView(box, settings, title) {
    var plan = E.buildPlan(settings);
    var total = E.clampDays(settings.totalDays);
    var day = E.todayDay(settings);
    var dateOf = function (n) { return settings.startDate ? slash(E.addDays(settings.startDate, n - 1)).slice(5) : ''; };
    var deloads = [];
    for (var d = 1; d <= total; d++) {
      if (E.isDeload(plan, d) && !E.isDeload(plan, d - 1)) deloads.push(d + '〜' + (d + 6) + '日目' + (settings.startDate ? '（' + dateOf(d) + '〜' + dateOf(d + 6) + '）' : ''));
    }
    var html = '<div class="card"><div class="output-head"><h3>' + esc(title) + '：' + esc(D.GOALS[settings.goal].label) + '・全' + total + '日</h3>' +
      '<button type="button" class="btn primary small" data-print-plan>プラン表を印刷・PDF保存</button></div>' +
      '<div class="timeline">' + plan.map(function (p) {
        var w = p.days / total * 100;
        var marker = day >= p.start && day <= p.end ? '<span class="today-marker" style="left:' + ((day - p.start + 0.5) / p.days * 100) + '%"></span>' : '';
        return '<div style="width:' + w + '%;background:' + p.color + '" title="' + esc(p.name + ' ' + p.start + '〜' + p.end + '日目') + '">' + (w > 9 ? esc(p.name) : '') + marker + '</div>';
      }).join('') + '</div>' +
      '<div class="timeline-legend">' + plan.map(function (p) {
        return '<span><i style="background:' + p.color + '"></i>' + esc(p.name) + '：' + p.start + '〜' + p.end + '日目' + (settings.startDate ? '（' + dateOf(p.start) + '〜' + dateOf(p.end) + '）' : '') + '</span>';
      }).join('') + '<span>黒い線が今日です</span></div>' +
      (settings.eventDate && settings.goal === 'competition' ? '<p class="deload-note">試合日：' + slash(settings.eventDate) + '。試合期で練習量を減らして疲労を抜き、試合後は移行期（積極的休養）に入ります。</p>' : '') +
      (deloads.length ? '<p class="deload-note">回復週（練習量を減らす週）の目安：' + deloads.join('、') + '</p>' : '') +
      '</div><div class="phase-cards">' + plan.map(function (p) {
        var ph = D.PHASES[p.id];
        var cur = day >= p.start && day <= p.end;
        return '<div class="card phase-card' + (cur ? ' current' : '') + '" style="border-top-color:' + p.color + '">' +
          '<h3>' + esc(ph.name) + '<small>' + esc(ph.sub) + '・' + p.days + '日間' + (cur ? '・いまここ' : '') + '</small></h3>' +
          '<p>' + esc(ph.purpose) + '</p>' +
          '<table class="param-table"><tr><th>強度</th><td>' + esc(ph.params.load) + '</td></tr><tr><th>回数</th><td>' + esc(ph.params.reps) + '</td></tr>' +
          '<tr><th>セット数</th><td>' + esc(ph.params.sets) + '</td></tr><tr><th>休息</th><td>' + esc(ph.params.rest) + '</td></tr></table>' +
          '<h4>この時期のポイント</h4><ul>' + ph.focus.map(li).join('') + '</ul>' +
          '<h4>回復のポイント</h4><ul>' + ph.recovery.map(li).join('') + '</ul>' +
          '<div class="coach-point">指導者へのひとこと：' + esc(ph.coachPoint) + '</div></div>';
      }).join('') + '</div>';
    box.innerHTML = html;
    $('[data-print-plan]', box).onclick = function () { buildPrint(settings, title); window.print(); };
  }

  function buildPrint(settings, title) {
    var plan = E.buildPlan(settings);
    var total = E.clampDays(settings.totalDays);
    var dateOf = function (n) { return settings.startDate ? slash(E.addDays(settings.startDate, n - 1)).slice(5) : ''; };
    var html = '<div class="print-sheet"><h1>' + esc(title) + 'のトレーニングプラン</h1>' +
      '<p class="print-info">目標：' + esc(D.GOALS[settings.goal].label) + '<br>期間：' + total + '日間' + (settings.startDate ? '（' + slash(settings.startDate) + '〜' + slash(E.addDays(settings.startDate, total - 1)) + '）' : '') +
      (settings.eventDate ? '<br>試合日：' + slash(settings.eventDate) : '') + '<br>練習曜日：' + settings.trainingDays.map(function (d) { return D.WEEKDAYS[d]; }).join('・') + '</p>' +
      '<div class="print-timeline">' + plan.map(function (p) { return '<div style="width:' + (p.days / total * 100) + '%;background:' + p.color + '">' + (p.days / total > 0.1 ? esc(p.name) : '') + '</div>'; }).join('') + '</div>' +
      '<table class="print-table"><thead><tr><th>期</th><th>期間</th><th>目的</th><th>強度・回数・セット・休息</th><th>ポイント</th></tr></thead><tbody>' +
      plan.map(function (p) {
        var ph = D.PHASES[p.id];
        return '<tr><th style="border-left:6px solid ' + p.color + '">' + esc(ph.name) + '<br><small>' + esc(ph.sub) + '</small></th><td>' + p.start + '〜' + p.end + '日目' + (settings.startDate ? '<br>' + dateOf(p.start) + '〜' + dateOf(p.end) : '') + '</td>' +
          '<td>' + esc(ph.purpose) + '</td><td>' + esc(ph.params.load) + '<br>' + esc(ph.params.reps) + '／' + esc(ph.params.sets) + '<br>休息 ' + esc(ph.params.rest) + '</td><td><ul>' + ph.focus.map(li).join('') + '</ul></td></tr>';
      }).join('') + '</tbody></table>' +
      '<div class="print-box"><h2>毎日の約束</h2><ol><li>練習前はウォームアップを丁寧に行う</li><li>睡眠・疲れ・筋肉痛・痛みを毎日記録する</li><li>痛みや違和感は、その日のうちに必ず伝える</li></ol></div>' +
      (settings.coach ? '<p class="print-sign">' + esc(settings.coach) + '</p>' : '') +
      '<p class="print-note">強度などの数値は一般的な目安です。痛みや体調の異変がある時は練習を中止し、医療機関に相談してください。</p></div>';
    $('#printArea').innerHTML = html;
  }

  // ------------------------------------------------------------------
  // チーム
  // ------------------------------------------------------------------
  function renderTeam() {
    var t = team();
    var s = E.planSettings({ teamId: t.id, useTeamPlan: true }, state.teams);
    var day = E.todayDay(s);
    var seg = E.phaseForDay(E.buildPlan(s), day);
    var count = state.members.filter(function (m) { return m.teamId === t.id; }).length;
    $('#teamBannerName').textContent = t.name || 'チーム';
    $('#teamBannerMeta').textContent = [t.sport, count + '人', D.GOALS[s.goal].label, s.startDate ? slash(s.startDate) + ' 開始' : '', s.eventDate ? '試合日 ' + slash(s.eventDate) : ''].filter(Boolean).join('・');
    $('#teamBannerDay').textContent = day + '日目（' + seg.name + '）';
    fillForm($('#teamForm'), t);
    renderStatus();
    renderTeamMessage();
    renderBulk();
    renderPlanView($('[data-plan-view="team"]'), s, t.name || 'チーム');
    showTab('team', state.teamTab);
  }

  function renderStatus() {
    var t = team();
    var ms = state.members.filter(function (m) { return m.teamId === t.id; });
    if (!ms.length) { $('#statusTable').innerHTML = '<tr><td class="muted">まだメンバーがいません。「＋ メンバー」で登録し、所属チームにこのチームを選んでください。</td></tr>'; return; }
    var today = E.today();
    $('#statusTable').innerHTML = '<thead><tr><th>名前</th><th>最新の記録</th><th>睡眠</th><th>疲労</th><th>筋肉痛</th><th>気分</th><th>痛み</th><th>7日間の負荷</th><th>ACWR</th><th>注意</th></tr></thead><tbody>' +
      ms.map(function (m) {
        var w = E.latestWellness(m);
        var lm = E.loadMetrics(m);
        var al = E.alerts(m, settingsOf(m));
        var stale = !w || E.diffDays(w.date, today) >= 2;
        var flags = al.map(function (a) { return '<span class="flag ' + a.level + '" title="' + esc(a.body) + '">' + esc(a.title.replace(/があります|ています|です/g, '')) + '</span>'; }).join('');
        return '<tr class="' + (stale ? 'stale' : '') + '"><td><button type="button" class="link" data-member="' + esc(m.id) + '">' + esc(m.name || '（名前未設定）') + '</button></td>' +
          '<td>' + (w ? slash(w.date).slice(5) : '―') + '</td><td>' + (w && w.sleep ? w.sleep + 'h' : '―') + '</td><td>' + (w && w.fatigue ? w.fatigue : '―') + '</td>' +
          '<td>' + (w && w.soreness ? w.soreness : '―') + '</td><td>' + (w && w.mood ? w.mood : '―') + '</td><td>' + (w && w.pain ? esc(w.pain) : '―') + '</td>' +
          '<td>' + (lm.weekly || '―') + '</td><td>' + (lm.acwr !== null ? lm.acwr : '―') + '</td><td>' + (flags || '―') + '</td></tr>';
      }).join('') + '</tbody>';
  }

  function renderTeamMessage() {
    var t = team();
    var s = E.planSettings({ teamId: t.id, useTeamPlan: true }, state.teams);
    var total = E.clampDays(s.totalDays);
    if (state.tmDay === null) state.tmDay = E.todayDay(s);
    state.tmDay = Math.min(Math.max(1, state.tmDay), total);
    ['#tmDayRange', '#tmDayNum'].forEach(function (id) { $(id).max = total; $(id).value = state.tmDay; });
    var info = E.dayInfo(s, state.tmDay);
    var b = $('#tmPhase');
    b.textContent = info.phase.name + '（' + info.phase.sub + '）' + (info.deload ? '・回復週' : '');
    b.style.background = info.seg.color;
    $('#tmDate').textContent = state.tmDay + '日目・' + slash(info.dateStr) + '（' + info.weekdayJa + '）' + (info.training ? '' : '・休養日');
    setOut('tmOutput', 'tmCount', E.teamMessage(t, state.tmDay, { variant: state.tmVariant, emoji: +$('#tmEmoji').value, checkin: $('#tmCheckin').checked }));
  }

  function renderBulk() {
    var t = team();
    var ms = state.members.filter(function (m) { return m.teamId === t.id; });
    state.bulk = ms.map(function (m) {
      var s = settingsOf(m);
      var d = E.todayDay(s);
      return { m: m, day: d, text: E.generateComment(m, state.teams, d) };
    });
    $('#bulkList').innerHTML = state.bulk.map(function (b, i) {
      return '<article class="bulk-item"><header><strong>' + esc(E.displayName(b.m)) + '・' + b.day + '日目</strong>' +
        '<span class="btn-row"><button type="button" class="btn ghost small" data-bcopy="' + i + '">コピー</button>' +
        '<button type="button" class="btn line small" data-bline="' + i + '">LINEで送る</button></span></header><pre>' + esc(b.text) + '</pre></article>';
    }).join('') || '<p class="muted">まだメンバーがいません。</p>';
  }

  // ------------------------------------------------------------------
  // メンバー
  // ------------------------------------------------------------------
  function renderMember() {
    var m = member();
    var s = settingsOf(m);
    var day = E.todayDay(s);
    var info = E.dayInfo(s, day);
    $('#memberBannerName').textContent = E.displayName(m);
    $('#memberBannerMeta').textContent = [s.teamName || '個人', m.position, D.GOALS[s.goal].label, m.goalNote].filter(Boolean).join('・');
    $('#memberBannerDay').textContent = day + '日目（' + info.phase.name + (info.deload ? '・回復週' : '') + '）';
    $('#memberTeamSelect').innerHTML = '<option value="">所属なし（個人）</option>' + state.teams.map(function (t) { return '<option value="' + esc(t.id) + '">' + esc(t.name) + '</option>'; }).join('');
    fillForm($('#memberForm'), m);
    togglePlanFields();
    renderAlerts();
    renderRecords();
    renderPlanView($('[data-plan-view="member"]'), s, E.displayName(m));
    renderComment();
    renderWeekly();
    renderTemplates();
    renderRapport();
    renderScenes();
    renderExercises();
    showTab('member', state.memberTab);
  }

  function togglePlanFields() {
    var f = $('#memberForm');
    var inTeam = !!f.elements.teamId.value;
    $('#useTeamPlanRow').hidden = !inTeam;
    var useTeam = inTeam && f.elements.useTeamPlan.checked;
    $all('#memberPlanFields label:not(#useTeamPlanRow), #memberPlanFields .wide').forEach(function (el) {
      if (el.id === 'useTeamPlanRow') return;
      el.classList.toggle('disabled-field', useTeam);
      $all('input, select', el).forEach(function (i) { i.disabled = useTeam; });
    });
  }

  function renderAlerts() {
    var m = member();
    var al = E.alerts(m, settingsOf(m));
    var box = $('#alertBox');
    box.hidden = !al.length;
    var label = { urgent: 'すぐ確認', warn: '注意', info: '確認' };
    box.innerHTML = al.map(function (a) {
      return '<details class="alert ' + a.level + '"' + (a.level === 'urgent' ? ' open' : '') + '><summary class="alert-head"><span class="alert-level">' + label[a.level] + '</span><strong>' + esc(a.title) + '</strong></summary><p>' + esc(a.body) + '</p></details>';
    }).join('');
  }

  // 記録
  function renderRecords() {
    var m = member();
    var t = E.today();
    ['#wellForm', '#sessionForm', '#liftForm'].forEach(function (id) { $(id).elements.date.value = t; });
    $('#liftNames').innerHTML = D.EXERCISES.filter(function (e) { return e.cat === 'strength' || e.cat === 'power'; })
      .map(function (e) { return '<option value="' + esc(e.name) + '">'; }).join('');
    var lm = E.loadMetrics(m);
    var tiles = [
      ['7日間の練習負荷', lm.weekly ? lm.weekly + '' : '―'],
      ['7日間の練習日数', lm.sessions7 + '日'],
      ['急性：慢性負荷比', lm.acwr !== null ? lm.acwr + (lm.acwr > 1.5 ? '（急増）' : '') : '記録21日以上で表示'],
      ['単調さ（モノトニー）', lm.monotony !== null ? lm.monotony + (lm.monotony > 2 ? '（高め）' : '') : '―']
    ];
    $('#loadMetrics').innerHTML = tiles.map(function (x) { return '<div class="metric"><span>' + esc(x[0]) + '</span><strong>' + esc(x[1]) + '</strong></div>'; }).join('');
    // 28日の棒グラフ
    var max = Math.max.apply(null, lm.days.map(function (d) { return d.load; }).concat([1]));
    var W = 336, H = 120, bw = W / 28;
    var svg = '<svg class="load-bar" viewBox="0 0 ' + W + ' ' + (H + 16) + '" role="img" aria-label="直近28日の練習負荷">';
    lm.days.forEach(function (d, i) {
      var h = d.load ? Math.max(2, d.load / max * H) : 2;
      svg += '<rect class="' + (d.load ? '' : 'zero') + '" x="' + (i * bw + 1) + '" y="' + (H - h) + '" width="' + (bw - 2) + '" height="' + h + '"><title>' + d.date + '：' + d.load + '</title></rect>';
    });
    svg += '<text x="0" y="' + (H + 13) + '">' + slash(lm.days[0].date).slice(5) + '</text><text x="' + (W - 34) + '" y="' + (H + 13) + '">' + slash(lm.days[27].date).slice(5) + '</text></svg>';
    $('#loadChart').innerHTML = svg;

    var best = E.bestLifts(m);
    var keys = Object.keys(best);
    $('#bestLifts').innerHTML = keys.length ? '<table class="status-table lift-table"><thead><tr><th>種目</th><th>記録</th><th>日付</th><th>推定1RM</th></tr></thead><tbody>' +
      keys.map(function (k) { var b = best[k]; return '<tr><td>' + esc(k) + '</td><td>' + b.weight + 'kg × ' + b.reps + '回</td><td>' + slash(b.date).slice(5) + '</td><td><b>' + b.e1rm + 'kg</b></td></tr>'; }).join('') +
      '</tbody></table>' : '<p class="muted">挙上記録を入れると、種目ごとの自己ベスト（推定1RM）が表示されます。</p>';

    function list(arr, kind, fmt) {
      var rows = (arr || []).map(function (x, i) { return { x: x, i: i }; }).sort(function (a, b) { return a.x.date < b.x.date ? 1 : -1; });
      return '<ul>' + (rows.map(function (r) {
        return '<li><span>' + slash(r.x.date).slice(5) + '　' + fmt(r.x) + '</span><button type="button" data-del="' + kind + ':' + r.i + '" aria-label="削除">✕</button></li>';
      }).join('') || '<li class="muted">まだ記録がありません</li>') + '</ul>';
    }
    $('#recordList').innerHTML =
      '<div><h4>コンディション</h4>' + list(m.wellness, 'wellness', function (w) {
        return esc([w.sleep ? '睡眠' + w.sleep + 'h' : '', w.fatigue ? '疲労' + w.fatigue : '', w.soreness ? '筋肉痛' + w.soreness : '', w.mood ? '気分' + w.mood : '', w.pain ? '痛み：' + w.pain : '', w.memo || ''].filter(Boolean).join('・'));
      }) + '</div>' +
      '<div><h4>練習</h4>' + list(m.sessions, 'sessions', function (s) { return esc(s.type + '・' + s.minutes + '分・RPE' + s.rpe + '（負荷' + (s.minutes * s.rpe) + '）' + (s.note ? '・' + s.note : '')); }) + '</div>' +
      '<div><h4>挙上</h4>' + list(m.lifts, 'lifts', function (l) {
        var v = E.e1rm(l.weight, l.reps);
        return esc(l.exercise + ' ' + l.weight + 'kg×' + l.reps + '回' + (l.sets ? '×' + l.sets + 'セット' : '') + (v ? '（推定1RM ' + v + 'kg）' : ''));
      }) + '</div>';
  }

  // コメント
  function renderComment() {
    var m = member();
    var s = settingsOf(m);
    var total = E.clampDays(s.totalDays);
    if (state.cDay === null) state.cDay = E.todayDay(s);
    state.cDay = Math.min(Math.max(1, state.cDay), total);
    ['#cDayRange', '#cDayNum'].forEach(function (id) { $(id).max = total; $(id).value = state.cDay; });
    var info = E.dayInfo(s, state.cDay);
    var b = $('#cPhase');
    b.textContent = info.phase.name + '（' + info.phase.sub + '）' + (info.deload ? '・回復週' : '');
    b.style.background = info.seg.color;
    $('#cDate').textContent = state.cDay + '日目・' + slash(info.dateStr) + '（' + info.weekdayJa + '）' + (info.training ? '・練習日' : '・休養日') + '・残り' + info.remain + '日';
    setOut('cOutput', 'cCount', E.generateComment(m, state.teams, state.cDay, {
      variant: state.cVariant, format: $('#cFormat').value, emoji: +$('#cEmoji').value,
      menu: $('#cMenu').checked, tip: $('#cTip').checked, condition: $('#cCond').checked
    }));
  }

  function renderWeekly() {
    var m = member();
    if (!state.wEnd) state.wEnd = E.today();
    $('#wEnd').value = state.wEnd;
    setOut('wOutput', 'wCount', E.weeklyReport(m, state.teams, state.wEnd, { variant: state.wVariant, emoji: +$('#cEmoji').value }).text);
  }

  // 定型コメント
  function allTemplates() {
    return state.templates.map(function (t) { return Object.assign({ custom: true }, t); }).concat(C.TEMPLATES);
  }
  function catLabel(id) { var c = C.TEMPLATE_CATEGORIES.filter(function (x) { return x.id === id; })[0]; return c ? c.label : 'その他'; }

  function renderTemplates() {
    var m = member();
    var cat = $('#tplCat').value;
    var q = $('#tplSearch').value.trim();
    var list = allTemplates().filter(function (t) {
      return (!cat || t.cat === cat) && (!q || (t.title + t.text + catLabel(t.cat)).indexOf(q) !== -1);
    });
    $('#tplList').innerHTML = C.TEMPLATE_CATEGORIES.map(function (g) {
      var items = list.filter(function (t) { return t.cat === g.id; });
      if (!items.length) return '';
      return '<div class="tpl-group"><h3>' + esc(g.label) + '</h3>' + items.map(function (t) {
        var prev = E.fillTemplate(m, state.teams, t.text, { signature: false }).replace(/\n/g, ' ');
        return '<article class="tpl-item' + (t.id === state.tplId ? ' active' : '') + '" data-tpl="' + esc(t.id) + '" tabindex="0"><header><strong>' + esc(t.title) +
          (t.custom ? '<span class="tpl-badge">登録</span>' : '') + '</strong><button type="button" class="btn ghost small" data-tpl-edit="' + esc(t.id) + '">' + (t.custom ? '編集' : '複製して編集') + '</button></header><p>' + esc(prev) + '</p></article>';
      }).join('') + '</div>';
    }).join('') || '<p class="muted">条件に合う定型文がありません。</p>';
    var cur = allTemplates().filter(function (t) { return t.id === state.tplId; })[0];
    $('#tplCurrentTitle').textContent = cur ? catLabel(cur.cat) + '：' + cur.title : '定型文を選んでください';
    setOut('tplOutput', 'tplCount', cur ? E.fillTemplate(m, state.teams, cur.text) : '');
  }

  function openTplEditor(t, copy) {
    var f = $('#tplForm');
    var edit = t && t.custom && !copy;
    $('#tplEditorTitle').textContent = edit ? '定型文を編集' : t ? '定型文を複製して登録' : '定型文を登録';
    f.elements.id.value = edit ? t.id : '';
    f.elements.cat.value = t ? t.cat : C.TEMPLATE_CATEGORIES[0].id;
    f.elements.title.value = t ? (edit ? t.title : t.title + '（アレンジ）') : '';
    f.elements.text.value = t ? t.text : '{name}、';
    $('#btnTplDelete').hidden = !edit;
    $('#tplEditor').hidden = false;
    f.elements.title.focus();
  }

  // ラポール
  function renderRapport() {
    var m = member();
    var s = settingsOf(m);
    $('#rpWeeks').innerHTML = C.RAPPORT_WEEKS.map(function (w) {
      var color = { 1: '#7cb7a3', 2: '#e8a25c', 3: '#9a8fd1' }[w.week];
      return '<div class="rp-week" style="border-top-color:' + color + '"><h3>' + w.week + '週目　' + esc(w.title) + '</h3><p>' + esc(w.aim) + '</p><div class="rp-days">' +
        C.RAPPORT_DAYS.filter(function (d) { return d.week === w.week; }).map(function (d) {
          return '<button type="button" data-rpday="' + d.day + '" class="' + (d.day === state.rpDay ? 'active' : '') + '" title="' + esc(d.theme) + '">' + d.day + '</button>';
        }).join('') + '</div></div>';
    }).join('');
    $('#rpStart').value = m.rapportStart || s.startDate || '';
    $('#rpState').value = m.rapportState || '';
    ['#rpDayRange', '#rpDayNum'].forEach(function (id) { $(id).value = state.rpDay; });
    var isMail = $('#rpFormat').value === 'mail';
    var r = E.rapportMessage(m, state.teams, state.rpDay, { format: $('#rpFormat').value, variant: state.rpVariant });
    var item = C.RAPPORT_DAYS[state.rpDay - 1];
    var b = $('#rpBadge');
    b.textContent = item.week + '週目・' + C.RAPPORT_WEEKS[item.week - 1].title;
    b.style.background = { 1: '#7cb7a3', 2: '#e8a25c', 3: '#9a8fd1' }[item.week];
    $('#rpDate').textContent = state.rpDay + '日目' + (r.date ? '・' + slash(r.date) + 'に送信' : '');
    $('#rpSubjectRow').hidden = !isMail;
    $('#rpSubject').value = isMail ? r.subject : '';
    setOut('rpOutput', 'rpCount', r.text);
    $('#rpTheme').textContent = state.rpDay + '日目のテーマ：' + item.theme;
    $('#rpCoach').textContent = '指導者へのひとこと：' + item.coach;
  }

  // 課題サポート
  function renderScenes() {
    var m = member();
    $('#sceneGrid').innerHTML = C.SCENES.map(function (s) {
      return '<button type="button" class="scene-btn' + (s.id === state.sceneId ? ' active' : '') + '" data-scene="' + s.id + '"><span>' + s.icon + '</span><span>' + esc(s.title) + '</span></button>';
    }).join('');
    var sc = C.SCENES.filter(function (x) { return x.id === state.sceneId; })[0];
    $('#sceneDetail').hidden = !sc;
    if (!sc) return;
    $('#sceneTitle').textContent = sc.icon + ' ' + sc.title;
    $('#sceneFeeling').textContent = sc.feeling;
    $('#sceneCauses').innerHTML = sc.causes.map(li).join('');
    $('#sceneTips').innerHTML = sc.tips.map(li).join('');
    setOut('sceneOutput', 'sceneCount', E.sceneMessage(m, state.teams, sc.id));
  }

  // 種目
  function renderExercises() {
    var cat = $('#exCat').value;
    var place = $('#exPlace').value;
    var lv = { 1: '初級', 2: '中級', 3: '上級' };
    $('#exGrid').innerHTML = D.EXERCISES.filter(function (e) {
      return (!cat || e.cat === cat) && (!place || e.place.indexOf(place) !== -1);
    }).map(function (e) {
      return '<div class="card ex-card"><h3>' + esc(e.name) + '</h3><div class="ex-tags"><span>' + esc(D.EX_CATS[e.cat]) + '</span><span>' + esc(e.target) + '</span><span>' + lv[e.level] + '</span>' +
        e.place.map(function (p) { return '<span>' + esc(D.PLACES[p]) + '</span>'; }).join('') + '</div><ol>' + e.how.map(li).join('') + '</ol>' +
        '<p><strong>ポイント</strong>　' + esc(e.cue) + '</p>' + (e.caution ? '<p class="muted small">注意　' + esc(e.caution) + '</p>' : '') + '</div>';
    }).join('');
  }

  function renderKnowledge() {
    var K = D.KNOWLEDGE;
    $('#kPrinciples').innerHTML = K.principles.map(function (p) { return '<div><strong>' + esc(p.title) + '</strong>' + esc(p.body) + '</div>'; }).join('');
    $('#kTable').innerHTML = '<thead><tr><th>目的</th><th>強度</th><th>回数</th><th>セット数</th><th>休息</th></tr></thead><tbody>' +
      K.intensityTable.map(function (r) { return '<tr><td>' + esc(r.goal) + '</td><td>' + esc(r.load) + '</td><td>' + esc(r.reps) + '</td><td>' + esc(r.sets) + '</td><td>' + esc(r.rest) + '</td></tr>'; }).join('') + '</tbody>';
    $('#kTopics').innerHTML = K.topics.map(function (t) { return '<div class="card"><h3>' + esc(t.title) + '</h3><p>' + esc(t.body) + '</p></div>'; }).join('');
    $('#kSources').innerHTML = K.sources.map(li).join('');
  }

  // ------------------------------------------------------------------
  // イベント
  // ------------------------------------------------------------------
  function bind() {
    function newTeam() {
      var t = { id: uid('t'), name: '', sport: '', level: 1, tone: 'gentle', coach: '', goal: 'general', startDate: E.today(), totalDays: 84, eventDate: '', trainingDays: [1, 3, 5], places: ['gym'] };
      state.teams.push(t);
      state.teamTab = 'tSettings';
      select('team', t.id);
      $('#teamForm').elements.name.focus();
    }
    function newMember() {
      // チーム画面、またはチームに所属するメンバーの画面から追加した時は、そのチームに入れる
      var cur = team();
      var viewing = member();
      var teamId = cur ? cur.id : viewing && state.teams.some(function (t) { return t.id === viewing.teamId; }) ? viewing.teamId : '';
      var m = { id: uid('m'), name: '', honorific: 'さん', teamId: teamId, useTeamPlan: true, level: 1, tone: '', goal: 'general', startDate: E.today(), totalDays: 84, trainingDays: [1, 3, 5], places: ['gym'], concerns: [], wellness: [], sessions: [], lifts: [] };
      state.members.push(m);
      state.memberTab = 'mProfile';
      select('member', m.id);
      $('#memberForm').elements.name.focus();
    }
    $('#btnNewTeam').onclick = newTeam;
    $('#btnEmptyTeam').onclick = newTeam;
    $('#btnNewMember').onclick = newMember;
    $('#btnEmptyMember').onclick = newMember;

    document.addEventListener('click', function (ev) {
      var tb = ev.target.closest('[data-team]');
      if (tb) { select('team', tb.getAttribute('data-team')); return; }
      var mb = ev.target.closest('[data-member]');
      if (mb) { select('member', mb.getAttribute('data-member')); window.scrollTo({ top: 0 }); }
    });
    $all('[data-tabs]').forEach(function (nav) {
      nav.addEventListener('click', function (ev) {
        var b = ev.target.closest('.tab');
        if (b) showTab(nav.getAttribute('data-tabs'), b.getAttribute('data-tab'));
      });
    });

    // チーム
    $('#teamForm').addEventListener('submit', function (ev) {
      ev.preventDefault();
      readForm(this, team());
      save();
      renderAll();
      toast('チームを保存しました');
    });
    $('#btnDeleteTeam').onclick = function () {
      var t = team();
      if (!window.confirm((t.name || 'このチーム') + 'を削除します。所属メンバーは「個人」に移ります。よろしいですか？')) return;
      state.members.forEach(function (m) { if (m.teamId === t.id) m.teamId = ''; });
      state.teams = state.teams.filter(function (x) { return x !== t; });
      select(state.teams.length ? 'team' : null, state.teams.length ? state.teams[0].id : null);
    };
    function setTmDay(v) { state.tmDay = parseInt(v, 10) || 1; state.tmVariant = 0; renderTeamMessage(); }
    $('#tmDayRange').oninput = function () { setTmDay(this.value); };
    $('#tmDayNum').onchange = function () { setTmDay(this.value); };
    $('#btnTmToday').onclick = function () { state.tmDay = null; renderTeamMessage(); };
    $('#btnTmRegen').onclick = function () { state.tmVariant++; renderTeamMessage(); };
    ['#tmEmoji', '#tmCheckin'].forEach(function (id) { $(id).onchange = renderTeamMessage; });
    $('#bulkList').addEventListener('click', function (ev) {
      var c = ev.target.closest('[data-bcopy]');
      var l = ev.target.closest('[data-bline]');
      if (c) copyText(state.bulk[+c.getAttribute('data-bcopy')].text);
      if (l) window.open('https://line.me/R/share?text=' + encodeURIComponent(state.bulk[+l.getAttribute('data-bline')].text), '_blank', 'noopener');
    });
    $('#btnBulkCopyAll').onclick = function () {
      copyText(state.bulk.map(function (b) { return '━━━━━━━━━━\n【' + E.displayName(b.m) + '】\n━━━━━━━━━━\n' + b.text; }).join('\n\n'));
    };

    // メンバー
    $('#memberForm').addEventListener('submit', function (ev) {
      ev.preventDefault();
      readForm(this, member());
      save();
      state.cDay = null;
      renderAll();
      toast('保存しました。プランとコメントに反映されています');
    });
    $('#memberForm').elements.teamId.addEventListener('change', togglePlanFields);
    $('#memberForm').elements.useTeamPlan.addEventListener('change', togglePlanFields);
    $('#btnDeleteMember').onclick = function () {
      var m = member();
      if (!window.confirm((m.name || 'このメンバー') + 'のデータを削除します。よろしいですか？')) return;
      state.members = state.members.filter(function (x) { return x !== m; });
      select(null, null);
    };

    function addRecord(form, kind, build) {
      form.addEventListener('submit', function (ev) {
        ev.preventDefault();
        var rec = build(form.elements);
        if (!rec) return;
        var m = member();
        m[kind] = m[kind] || [];
        if (kind === 'wellness') m[kind] = m[kind].filter(function (x) { return x.date !== rec.date; });
        m[kind].push(rec);
        // 入力欄を空に戻す（空の選択肢がないプルダウンは、選んだ内容をそのまま残す）
        Array.prototype.forEach.call(form.elements, function (el) {
          if (!el.name || el.name === 'date' || el.tagName === 'BUTTON') return;
          if (el.tagName === 'SELECT' && !el.querySelector('option[value=""]')) return;
          el.value = '';
        });
        save();
        renderAll();
        toast('記録しました');
      });
    }
    addRecord($('#wellForm'), 'wellness', function (f) {
      var r = { date: f.date.value };
      ['sleep', 'fatigue', 'soreness', 'mood'].forEach(function (k) { if (f[k].value !== '') r[k] = parseFloat(f[k].value); });
      if (f.pain.value.trim()) r.pain = f.pain.value.trim();
      if (f.memo.value.trim()) r.memo = f.memo.value.trim();
      if (Object.keys(r).length === 1) { toast('項目をひとつ以上入力してください'); return null; }
      return r;
    });
    addRecord($('#sessionForm'), 'sessions', function (f) {
      return { date: f.date.value, type: f.type.value, minutes: parseFloat(f.minutes.value), rpe: parseFloat(f.rpe.value), note: f.note.value.trim() };
    });
    addRecord($('#liftForm'), 'lifts', function (f) {
      return { date: f.date.value, exercise: f.exercise.value.trim(), weight: parseFloat(f.weight.value), reps: parseInt(f.reps.value, 10), sets: f.sets.value ? parseInt(f.sets.value, 10) : null };
    });
    $('#recordList').addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-del]');
      if (!b || !window.confirm('この記録を削除します。よろしいですか？')) return;
      var p = b.getAttribute('data-del').split(':');
      member()[p[0]].splice(+p[1], 1);
      save();
      renderAll();
    });

    function setCDay(v) { state.cDay = parseInt(v, 10) || 1; state.cVariant = 0; renderComment(); }
    $('#cDayRange').oninput = function () { setCDay(this.value); };
    $('#cDayNum').onchange = function () { setCDay(this.value); };
    $('#btnCToday').onclick = function () { state.cDay = null; renderComment(); };
    $('#btnCRegen').onclick = function () { state.cVariant++; renderComment(); };
    ['#cFormat', '#cEmoji', '#cMenu', '#cTip', '#cCond'].forEach(function (id) { $(id).onchange = function () { renderComment(); renderWeekly(); }; });

    $('#wEnd').onchange = function () { state.wEnd = this.value || E.today(); renderWeekly(); };
    $('#btnWPrev').onclick = function () { state.wEnd = E.addDays(state.wEnd || E.today(), -7); renderWeekly(); };
    $('#btnWNext').onclick = function () { state.wEnd = E.addDays(state.wEnd || E.today(), 7); renderWeekly(); };
    $('#btnWRegen').onclick = function () { state.wVariant++; renderWeekly(); };

    // 定型コメント
    $('#tplCat').innerHTML += C.TEMPLATE_CATEGORIES.map(function (c) { return '<option value="' + c.id + '">' + esc(c.label) + '</option>'; }).join('');
    $('#tplFormCat').innerHTML = C.TEMPLATE_CATEGORIES.map(function (c) { return '<option value="' + c.id + '">' + esc(c.label) + '</option>'; }).join('');
    $('#tplVarChips').innerHTML = C.TEMPLATE_VARS.map(function (v) { return '<button type="button" class="chip" data-var="' + v.key + '">' + esc(v.label) + '</button>'; }).join('');
    $('#tplCat').onchange = renderTemplates;
    $('#tplSearch').oninput = renderTemplates;
    $('#tplList').addEventListener('click', function (ev) {
      var e = ev.target.closest('[data-tpl-edit]');
      if (e) { var t = allTemplates().filter(function (x) { return x.id === e.getAttribute('data-tpl-edit'); })[0]; openTplEditor(t, !t.custom); return; }
      var it = ev.target.closest('[data-tpl]');
      if (it) { state.tplId = it.getAttribute('data-tpl'); renderTemplates(); }
    });
    $('#btnTplNew').onclick = function () { openTplEditor(null); };
    $('#btnTplCancel').onclick = function () { $('#tplEditor').hidden = true; };
    $('#tplVarChips').addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-var]');
      if (!b) return;
      var ta = $('#tplFormText');
      var st = ta.selectionStart || 0;
      var ins = '{' + b.getAttribute('data-var') + '}';
      ta.value = ta.value.slice(0, st) + ins + ta.value.slice(ta.selectionEnd || st);
      ta.selectionStart = ta.selectionEnd = st + ins.length;
      ta.focus();
    });
    $('#tplForm').addEventListener('submit', function (ev) {
      ev.preventDefault();
      var f = this.elements;
      var id = f.id.value || uid('u');
      var item = { id: id, cat: f.cat.value, title: f.title.value.trim(), text: f.text.value };
      var i = state.templates.map(function (t) { return t.id; }).indexOf(id);
      if (i === -1) state.templates.unshift(item); else state.templates[i] = item;
      state.tplId = id;
      save();
      $('#tplEditor').hidden = true;
      renderTemplates();
      toast('定型文を保存しました');
    });
    $('#btnTplDelete').onclick = function () {
      var id = $('#tplForm').elements.id.value;
      if (!window.confirm('この定型文を削除します。よろしいですか？')) return;
      state.templates = state.templates.filter(function (t) { return t.id !== id; });
      if (state.tplId === id) state.tplId = null;
      save();
      $('#tplEditor').hidden = true;
      renderTemplates();
    };

    // ラポール
    $('#rpState').innerHTML = C.RAPPORT_STATES.map(function (s) { return '<option value="' + s.id + '">' + esc(s.label) + '</option>'; }).join('');
    function setRp(v) { state.rpDay = Math.min(21, Math.max(1, parseInt(v, 10) || 1)); state.rpVariant = 0; renderRapport(); }
    $('#rpDayRange').oninput = function () { setRp(this.value); };
    $('#rpDayNum').onchange = function () { setRp(this.value); };
    $('#rpWeeks').addEventListener('click', function (ev) { var b = ev.target.closest('[data-rpday]'); if (b) setRp(b.getAttribute('data-rpday')); });
    $('#rpFormat').onchange = renderRapport;
    $('#rpState').onchange = function () { member().rapportState = this.value; save(); renderRapport(); };
    $('#rpStart').onchange = function () { member().rapportStart = this.value; save(); renderRapport(); };
    $('#btnRpRegen').onclick = function () { state.rpVariant++; renderRapport(); };

    $('#sceneGrid').addEventListener('click', function (ev) { var b = ev.target.closest('[data-scene]'); if (b) { state.sceneId = b.getAttribute('data-scene'); renderScenes(); } });

    $('#exCat').innerHTML += Object.keys(D.EX_CATS).map(function (k) { return '<option value="' + k + '">' + esc(D.EX_CATS[k]) + '</option>'; }).join('');
    $('#exPlace').innerHTML += Object.keys(D.PLACES).map(function (k) { return '<option value="' + k + '">' + esc(D.PLACES[k]) + '</option>'; }).join('');
    ['#exCat', '#exPlace'].forEach(function (id) { $(id).onchange = renderExercises; });

    // 出力欄の文字数
    [['tmOutput', 'tmCount'], ['cOutput', 'cCount'], ['wOutput', 'wCount'], ['tplOutput', 'tplCount'], ['rpOutput', 'rpCount'], ['sceneOutput', 'sceneCount']].forEach(function (p) {
      $('#' + p[0]).addEventListener('input', function () { $('#' + p[1]).textContent = countLabel(this.value); });
    });
    $all('.share-row').forEach(buildShareRow);

    // 書き出し・読み込み
    $('#btnExport').onclick = function () {
      download('training-support_' + E.today() + '.json', JSON.stringify({ teams: state.teams, members: state.members, templates: state.templates }, null, 2), 'application/json');
    };
    $('#fileImport').addEventListener('change', function () {
      var file = this.files[0];
      if (!file) return;
      var rd = new FileReader();
      rd.onload = function () {
        try {
          var d = JSON.parse(rd.result);
          if (!Array.isArray(d.members) || !Array.isArray(d.teams)) throw new Error('format');
          if (!window.confirm('チーム' + d.teams.length + '件、メンバー' + d.members.length + '名分を読み込みます。現在のデータは置き換わります。よろしいですか？')) return;
          state.teams = d.teams;
          state.members = d.members;
          state.templates = d.templates || [];
          select(null, null);
          toast('読み込みました');
        } catch (e) { toast('ファイルの形式が正しくありません'); }
      };
      rd.readAsText(file);
      this.value = '';
    });
  }

  // ------------------------------------------------------------------
  // 起動
  // ------------------------------------------------------------------
  initFormParts();
  load();
  if (!team() && !member()) {
    if (state.teams.length) { state.view = 'team'; state.currentId = state.teams[0].id; }
    else if (state.members.length) { state.view = 'member'; state.currentId = state.members[0].id; }
  }
  bind();
  renderKnowledge();
  renderAll();
})();
