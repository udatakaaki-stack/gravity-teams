/*
 * コーチ用アプリ
 */
(function () {
  'use strict';
  var M = window.MealCalc;
  var U = window.UI;
  var DD = window.DIET_DATA;
  var DE = window.DietEngine;
  var BR = window.DietBridge;
  var $ = U.$, $all = U.$all, esc = U.esc, fmt = U.fmt;
  var TOKEN_KEY = 'connect.coach.token';

  var token = U.storeGet(TOKEN_KEY);
  var ov = null;      // 一覧のデータ
  var cur = null;     // 詳細のデータ
  var ui = { view: 'list', dtab: 'records', history: [], sheet: null };

  function call(body) {
    return U.api('api/coach', body, token, function () {
      token = null;
      U.storeSet(TOKEN_KEY, null);
      if (body.action !== 'login') { U.toast('ログインしてください'); show('login'); }
    });
  }

  function nameOf(c) { return (c.name || '') + (c.honorific !== undefined ? c.honorific : 'さん'); }
  function inviteUrl(code) { return location.origin + location.pathname.replace(/coach\.html$/, '') + 'app.html#join=' + code; }

  function show(view) {
    ui.view = view;
    $all('[data-view]').forEach(function (v) { v.hidden = v.getAttribute('data-view') !== view; });
    window.scrollTo({ top: 0 });
  }

  // ------------------------------------------------------------------
  // 一覧
  // ------------------------------------------------------------------
  function loadList() {
    return call({ action: 'overview' }).then(function (d) { ov = d; renderList(); }, function (e) { if (e.status !== 401) U.toast(e.message); });
  }

  function lastLabel(c) {
    if (!c.lastActivityAt) return 'まだ記録なし';
    var mins = Math.round((Date.now() - new Date(c.lastActivityAt).getTime()) / 60000);
    if (mins < 1) return 'たった今記録';
    if (mins < 60) return mins + '分前に記録';
    if (mins < 60 * 24) return Math.round(mins / 60) + '時間前に記録';
    return Math.round(mins / 60 / 24) + '日前に記録';
  }

  function renderList() {
    if (!ov) return;
    $('#listDate').textContent = M.dateLabel(ov.today);
    var rows = ov.clients;
    var attention = rows.filter(function (r) { return r.watch.some(function (w) { return w.level !== 'info'; }); }).length;
    var unread = rows.reduce(function (a, r) { return a + r.unread; }, 0);
    var recordedToday = rows.filter(function (r) { return r.days[0] && r.days[0].date === ov.today && ((r.days[0].meals || []).length || Object.keys(r.days[0].body || {}).length); }).length;
    $('#summary').innerHTML = '<div><b>' + rows.length + '</b><span>クライアント</span></div><div><b>' + recordedToday + '</b><span>今日記録した人</span></div>' +
      '<div class="' + (unread ? 'hot' : '') + '"><b>' + unread + '</b><span>未読メッセージ</span></div><div class="' + (attention ? 'hot' : '') + '"><b>' + attention + '</b><span>気にかけたい人</span></div>';
    // 気にかけたい人 → 未読 → 最近の記録 の順に並べる
    var rank = function (r) { return (r.watch.some(function (w) { return w.level === 'urgent'; }) ? 0 : r.watch.some(function (w) { return w.level === 'warn'; }) ? 1 : r.unread ? 2 : 3); };
    rows = rows.slice().sort(function (a, b) { return rank(a) - rank(b) || String(b.client.lastActivityAt || '').localeCompare(String(a.client.lastActivityAt || '')); });
    $('#clientCards').innerHTML = rows.map(function (r) {
      var c = r.client;
      var tg = M.targets(c);
      var td = r.days[0] && r.days[0].date === ov.today ? r.days[0] : null;
      var kcal = td ? M.sumTotals(td.meals).kcal : 0;
      var w = (r.days.filter(function (d) { return d.body && d.body.weight; })[0] || {}).body;
      var badges = r.watch.map(function (x) { return '<span class="flag ' + x.level + '">' + esc(x.text) + '</span>'; }).join('');
      return '<button type="button" class="client-card" data-client="' + esc(c.id) + '">' +
        '<span class="cc-top"><span class="cc-name">' + esc(nameOf(c)) + '</span>' + (r.unread ? '<i class="badge">' + r.unread + '</i>' : '') + '<span class="cc-last">' + esc(lastLabel(c)) + '</span></span>' +
        '<span class="cc-stats"><span>今日 <b>' + fmt(kcal) + '</b>' + (tg ? ' / ' + fmt(tg.kcal) : '') + ' kcal</span><span>体重 <b>' + (w ? w.weight + 'kg' : '―') + '</b></span>' + (td && td.body && td.body.mood ? '<span>' + esc(U.moodLabel(td.body.mood)) + '</span>' : '') + '</span>' +
        (r.lastMessage ? '<span class="cc-msg">' + (r.lastMessage.from === 'coach' ? 'あなた：' : '') + esc(r.lastMessage.text.slice(0, 50)) + '</span>' : '') +
        (badges ? '<span class="cc-flags">' + badges + '</span>' : '') + '</button>';
    }).join('') || '<div class="card"><p class="empty">まだクライアントがいません。「＋ 追加」から登録し、招待リンクを送りましょう。</p></div>';
  }

  // ------------------------------------------------------------------
  // プロフィールのフォーム（追加・編集で共通）
  // ------------------------------------------------------------------
  function profileFormHtml(c, submitLabel) {
    c = c || {};
    function opt(list, val) { return Object.keys(list).map(function (k) { return '<option value="' + k + '"' + (val === k ? ' selected' : '') + '>' + esc(list[k].label || list[k]) + '</option>'; }).join(''); }
    function v(k) { return esc(c[k] === undefined ? '' : c[k]); }
    return '<label class="field">呼び名<input name="name" required value="' + v('name') + '" placeholder="例：はなこ"></label>' +
      '<div class="field-row"><label class="field">敬称<select name="honorific">' + ['さん', '様', 'ちゃん', 'くん', ''].map(function (h) { return '<option value="' + h + '"' + ((c.honorific === undefined ? 'さん' : c.honorific) === h ? ' selected' : '') + '>' + (h || 'なし') + '</option>'; }).join('') + '</select></label>' +
      '<label class="field">性別（計算用）<select name="sex">' + opt({ female: '女性', male: '男性', other: '回答しない' }, c.sex || 'female') + '</select></label></div>' +
      '<div class="field-row"><label class="field">年齢<input type="number" name="age" min="10" max="100" inputmode="numeric" value="' + v('age') + '"></label>' +
      '<label class="field">身長（cm）<input type="number" name="height" step="0.1" inputmode="decimal" value="' + v('height') + '"></label></div>' +
      '<div class="field-row"><label class="field">体重（kg）<input type="number" name="weight" step="0.1" inputmode="decimal" value="' + v('weight') + '"></label>' +
      '<label class="field">目標体重（kg）<input type="number" name="goalWeight" step="0.1" inputmode="decimal" value="' + v('goalWeight') + '"></label></div>' +
      '<label class="field">活動量<select name="activity">' + opt(M.ACTIVITY, c.activity || 'low') + '</select></label>' +
      '<label class="field">ペース<select name="pace">' + opt(M.PACES, c.pace || 'gentle') + '</select></label>' +
      '<label class="field">ダイエットの目的<input name="goalNote" value="' + v('goalNote') + '" placeholder="例：来年の旅行で好きな服を着たい"></label>' +
      '<p class="label-small">プログラム（今日のコメント・ラポール21日・停滞期の判定に使います）</p>' +
      '<div class="field-row"><label class="field">開始日<input type="date" name="startDate" value="' + v('startDate') + '"></label>' +
      '<label class="field">期間（1〜365日）<input type="number" name="totalDays" min="1" max="365" inputmode="numeric" value="' + esc(c.totalDays || 90) + '"></label></div>' +
      '<div class="field-row"><label class="field">開始時の体重（kg）<input type="number" name="startWeight" step="0.1" inputmode="decimal" value="' + v('startWeight') + '"></label>' +
      '<label class="field">ラポール21日の開始日<input type="date" name="rapportStart" value="' + v('rapportStart') + '"></label></div>' +
      '<label class="field">声かけのトーン<select name="tone">' + Object.keys(DD.TONES).map(function (k) { return '<option value="' + k + '"' + ((c.tone || 'gentle') === k ? ' selected' : '') + '>' + esc(DD.TONES[k].label) + '</option>'; }).join('') + '</select></label>' +
      '<div class="field"><span class="label">気になっていること（コメントのヒントに反映）</span><div class="concern-checks">' + DD.CONCERNS.map(function (x) {
        return '<label><input type="checkbox" name="concerns" value="' + x.id + '"' + ((c.concerns || []).indexOf(x.id) !== -1 ? ' checked' : '') + '> ' + esc(x.label) + '</label>';
      }).join('') + '</div></div>' +
      '<label class="field">コーチ用メモ（クライアントには見えません）<textarea name="coachMemo" rows="3">' + v('coachMemo') + '</textarea></label>' +
      '<p class="muted small" id="formTarget"></p>' +
      '<button type="submit" class="btn primary block">' + submitLabel + '</button>';
  }
  function readProfile(form) {
    var p = {};
    ['name', 'honorific', 'sex', 'age', 'height', 'weight', 'goalWeight', 'activity', 'pace', 'goalNote', 'coachMemo', 'startDate', 'totalDays', 'startWeight', 'rapportStart', 'tone'].forEach(function (k) { p[k] = form.elements[k].value.trim ? form.elements[k].value.trim() : form.elements[k].value; });
    p.concerns = $all('input[name="concerns"]:checked', form).map(function (i) { return i.value; });
    // 開始日・開始体重が空なら、今日・今の体重を入れる
    if (!p.startDate) p.startDate = M.dateKey(new Date());
    if (!p.startWeight && p.weight) p.startWeight = p.weight;
    return p;
  }
  function showFormTarget(form) {
    var tg = M.targets(readProfile(form));
    var el = $('#formTarget', form);
    el.textContent = tg ? '1日の目標：' + fmt(tg.kcal) + 'kcal（P ' + tg.protein_g + 'g・F ' + tg.fat_g + 'g・C ' + tg.carbs_g + 'g・塩分 ' + tg.salt_g + 'g未満）' + (tg.warnings.length ? '　⚠️ ' + tg.warnings.join(' ') : '') : '性別・年齢・身長・体重を入れると、1日の目標が計算されます。';
  }

  function showInvite(c, code) {
    var text = nameOf(c) + '、こんにちは。これから一緒にダイエットに取り組めることを、とてもうれしく思っています。\n\n下のリンクを開くと、あなた専用の記録アプリが使えます。食事の写真や体重を記録すると、私にも届きます。\n' + inviteUrl(code) + '\n\nリンクを開いたら、ホーム画面に追加しておくと便利です（iPhone は共有ボタン →「ホーム画面に追加」）。\nこのリンクは、ほかの人には教えないでくださいね。';
    $('#inviteFor').textContent = nameOf(c) + 'への招待';
    $('#inviteText').value = text;
    show('invite');
  }

  // ------------------------------------------------------------------
  // 詳細
  // ------------------------------------------------------------------
  function openClient(id) {
    return call({ action: 'client', id: id }).then(function (d) {
      cur = d;
      ui.dtab = ui.dtab || 'records';
      show('detail');
      renderDetail();
      if (ui.dtab === 'messages') markRead();
    }, function (e) { U.toast(e.message); });
  }

  function dayOf(date) { return cur.days.filter(function (d) { return d.date === date; })[0] || { date: date, meals: [], body: {} }; }

  function renderDetail() {
    var c = cur.client;
    var tg = M.targets(c);
    $('#dName').textContent = nameOf(c);
    var meta = [c.age ? c.age + '歳' : '', c.height ? c.height + 'cm' : '', c.weight ? c.weight + 'kg' : '', c.goalWeight ? '目標 ' + c.goalWeight + 'kg' : '', tg ? fmt(tg.kcal) + 'kcal/日' : ''].filter(Boolean);
    $('#dMeta').textContent = meta.join('・') + (c.goalNote ? '｜' + c.goalNote : '');
    var dc = dietClient();
    var prog = '';
    if (c.startDate) {
      var dn = DE.todayDay(dc);
      var seg = DE.phaseForDay(DE.buildPlan(dc.totalDays), dn);
      prog = 'プログラム ' + dn + '日目／全' + DE.clampDays(dc.totalDays) + '日（' + seg.name + '）';
    }
    var next = BR.nextRapportDay(cur.messages);
    prog += (prog ? '・' : '') + (next ? 'ラポール21日：次は' + next + '日目' : 'ラポール21日：すべて送信済み');
    $('#dProgram').innerHTML = '<span class="program-line">' + esc(prog) + '</span>';
    $('#dWatch').innerHTML = cur.watch.map(function (w) { return '<div class="watch-item ' + w.level + '">' + (w.level === 'urgent' ? '🚨 ' : w.level === 'warn' ? '⚠️ ' : 'ℹ️ ') + esc(w.text) + '</div>'; }).join('');
    $all('[data-dtab]').forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-dtab') === ui.dtab); });
    $all('[data-dpanel]').forEach(function (p) { p.hidden = p.getAttribute('data-dpanel') !== ui.dtab; });
    var b = $('#dBadge');
    b.hidden = !cur.unread;
    b.textContent = cur.unread || '';

    // 記録
    var td = dayOf(cur.today);
    var meals = U.sortMeals(td.meals);
    var total = M.sumTotals(meals);
    var v = M.verdict(total, tg, M.remainingMeals(meals.map(function (m) { return Object.assign({ date: cur.today }, m); }), cur.today, new Date()));
    var vc = $('#dVerdict');
    vc.className = 'verdict ' + v.level;
    vc.innerHTML = '<div class="v-label">今日の判定</div><div class="v-title">' + esc(v.title) + '</div><div class="v-body">' + esc(v.body.replace('このあとの', '')) + '</div>';
    $('#dRing').innerHTML = U.ringSvg(total.kcal, tg ? tg.kcal : 0);
    $('#dBalance').innerHTML = U.balanceHtml(total, tg, meals);
    var k = U.kcalChart(cur.days, tg, cur.today);
    $('#dKcal').innerHTML = k.svg;
    $('#dKcalAvg').textContent = k.days ? '記録した' + k.days + '日の平均：' + fmt(k.avg) + 'kcal' : 'まだ食事の記録がありません。';
    var w = U.weightChart(cur.days);
    $('#dWeight').innerHTML = w.svg;
    $('#dWeightNote').textContent = w.note;
    $('#dDays').innerHTML = cur.days.map(function (d) {
      var ms = U.sortMeals(d.meals);
      var t = M.sumTotals(ms);
      var bd = d.body || {};
      var body = [bd.weight ? '体重 ' + bd.weight + 'kg' : '', bd.sleep !== undefined ? '睡眠 ' + bd.sleep + '時間' : '', bd.mood ? U.moodLabel(bd.mood) : ''].filter(Boolean).join('・');
      return '<details class="day"' + (d.date === cur.today ? ' open' : '') + '><summary><span>' + esc(M.dateLabel(d.date)) + '</span><span>' + fmt(t.kcal) + ' kcal</span></summary>' +
        '<p class="muted small">P ' + t.protein_g + 'g・F ' + t.fat_g + 'g・C ' + t.carbs_g + 'g・塩分 ' + t.salt_g + 'g' + (body ? '｜' + esc(body) : '') + '</p>' +
        (bd.memo ? '<p class="memo">📝 ' + esc(bd.memo) + '</p>' : '') +
        '<ul class="meal-list">' + ms.map(function (m) { return U.mealItemHtml(m, tg, { date: d.date }); }).join('') + '</ul></details>';
    }).join('') || '<p class="empty">まだ記録がありません。</p>';

    // メッセージ
    var th = $('#dThread');
    th.innerHTML = U.messagesHtml(cur.messages, 'coach', { meta: true });
    th.scrollTop = th.scrollHeight;
    renderMake();

    // 設定
    var ef = $('#editForm');
    ef.innerHTML = profileFormHtml(c, '保存する');
    showFormTarget(ef);
  }

  function markRead() {
    if (!cur || !cur.unread) return;
    call({ action: 'markRead', id: cur.client.id }).then(function () { cur.unread = 0; renderDetail(); });
  }


  // ------------------------------------------------------------------
  // ダイエットサポート版との連携（定型文・今日のコメント・ラポール21日・停滞期）
  // ------------------------------------------------------------------
  var SIGN_KEY = 'connect.coach.sign';
  var make = { mode: 'ai', variant: 0, tplCat: '', rpDay: null, rpMood: null, sceneId: null, format: 'line', compose: null, myTemplates: [], draftNote: null };

  function sign() { return U.storeGet(SIGN_KEY) || ''; }
  function dietClient(mood) { return BR.toDietClient(cur.client, cur.days, { sign: sign(), mood: mood }); }

  function setCompose(text, meta) {
    var ta = $('#dMsgForm').elements.text;
    ta.value = text;
    make.compose = meta || null;
    renderComposeKind();
    ta.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }
  function renderComposeKind() {
    var k = $('#composeKind');
    k.hidden = !make.compose;
    k.textContent = make.compose ? '📎 ' + make.compose.label : '';
  }

  function loadTemplates() {
    return call({ action: 'templates' }).then(function (d) { make.myTemplates = d.templates || []; }, function () { /* 取れなくても動く */ });
  }

  function renderMake() {
    if (!cur) return;
    $all('[data-make]').forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-make') === make.mode); });
    $('#signInput').value = sign();
    var box = $('#makeBody');
    var dc = dietClient(make.rpMood === null ? undefined : make.rpMood);
    var h = '';
    if (make.mode === 'ai') {
      h = '<label class="field">下書きへの指示（なくても大丈夫）<input id="draftHint" placeholder="例：停滞期で落ち込んでいるので励ましたい"></label>' +
        '<button type="button" class="btn ghost block" data-act="draft">下書きを作る</button>' +
        '<p class="muted small">最近3日の食事・体重・気分・メモと、これまでのやり取りを読んで下書きを作ります。</p>' +
        (make.draftNote ? '<div class="note">' + make.draftNote + '</div>' : '');
    } else if (make.mode === 'template') {
      var cats = [['', 'すべて'], ['mine', '登録した定型文']].concat(DD.TEMPLATE_CATEGORIES.map(function (c) { return [c.id, c.label]; }));
      var list = make.myTemplates.map(function (t) { return Object.assign({ mine: true, cat: 'mine' }, t); }).concat(DD.TEMPLATES);
      var shown = list.filter(function (t) { return !make.tplCat || t.cat === make.tplCat || (make.tplCat === 'mine' && t.mine); });
      h = '<label class="field">場面<select data-act="tplcat">' + cats.map(function (c) { return '<option value="' + c[0] + '"' + (make.tplCat === c[0] ? ' selected' : '') + '>' + esc(c[1]) + '</option>'; }).join('') + '</select></label>' +
        '<div class="tpl-pick">' + shown.map(function (t) {
          var prev = DE.fillTemplate(dc, t.text, { signature: false }).replace(/\n/g, ' ');
          return '<div class="tp"><button type="button" class="use" data-tpl="' + esc(t.id) + '">' + (t.mine ? '⭐ ' : '') + esc(t.title) + '<small>' + esc(prev) + '</small></button>' +
            (t.mine ? '<button type="button" class="del" data-deltpl="' + esc(t.id) + '" aria-label="この定型文を削除">✕</button>' : '') + '</div>';
        }).join('') + '</div>' +
        '<p class="muted small">「〇」の部分は、送る前に書き換えてください。下の入力欄の文は「この文を定型文として保存」で登録できます。</p>';
    } else if (make.mode === 'comment') {
      var dn = DE.todayDay(dc);
      var seg = DE.phaseForDay(DE.buildPlan(dc.totalDays), dn);
      h = '<p class="rp-theme">' + (cur.client.startDate ? dn + '日目（' + esc(seg.name) + '・' + esc(seg.sub) + '）のコメントです。期分化のプラン、最近の体重、曜日、気になっていることに合わせて作ります。' : '開始日が未設定のため、今日を1日目として作ります。設定の画面で開始日を入れてください。') + '</p>' +
        '<div class="field-row"><label class="field">形式<select data-act="format"><option value="line"' + (make.format === 'line' ? ' selected' : '') + '>しっかり（ヒント・運動つき）</option><option value="short"' + (make.format === 'short' ? ' selected' : '') + '>ひとこと（短め）</option></select></label>' +
        '<button type="button" class="btn ghost" data-act="comment">作る</button></div>' +
        '<button type="button" class="link-btn" data-act="comment-again">別の言い回しにする</button>';
    } else if (make.mode === 'rapport') {
      var sent = BR.sentRapportDays(cur.messages);
      var next = BR.nextRapportDay(cur.messages);
      if (!make.rpDay) make.rpDay = next || 21;
      var item = DD.RAPPORT_DAYS[make.rpDay - 1];
      var moodNow = make.rpMood === null ? dc.mood : make.rpMood;
      h = '<div class="rp-grid">' + DD.RAPPORT_DAYS.map(function (d) {
        var cls = [sent[d.day] ? 'sent' : '', d.day === next ? 'next' : '', d.day === make.rpDay ? 'active' : ''].join(' ');
        return '<button type="button" class="' + cls + '" data-rpday="' + d.day + '" title="' + esc(d.theme) + '">' + (sent[d.day] ? '✓' : d.day) + '</button>';
      }).join('') + '</div>' +
        '<p class="rp-legend">✓＝送信済み　太い枠＝次に送る日</p>' +
        '<p class="rp-theme">' + item.day + '日目「' + esc(item.theme) + '」<br><span class="muted small">' + esc(item.coach) + '</span></p>' +
        '<label class="field">今の気持ち（記録から自動で選んでいます）<select data-act="rpmood">' + DD.MOODS.map(function (m) { return '<option value="' + m.id + '"' + (moodNow === m.id ? ' selected' : '') + '>' + esc(m.label) + '</option>'; }).join('') + '</select></label>' +
        '<div class="btn-row"><button type="button" class="btn ghost" data-act="rapport" style="flex:1">' + item.day + '日目のメッセージを作る</button><button type="button" class="link-btn" data-act="rapport-again">別の言い回し</button></div>';
    } else if (make.mode === 'plateau') {
      var sc = DD.PLATEAU_SCENES.filter(function (x) { return x.id === make.sceneId; })[0];
      h = '<div class="scene-chips">' + DD.PLATEAU_SCENES.map(function (x) {
        return '<button type="button" data-scene="' + x.id + '" class="' + (x.id === make.sceneId ? 'active' : '') + '">' + x.icon + ' ' + esc(x.title) + '</button>';
      }).join('') + '</div>' +
        (sc ? '<div class="note">クライアントの気持ち：' + esc(sc.feeling) + '<ul>' + sc.causes.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></div>' : '<p class="muted small">相談があった場面を選ぶと、寄り添ったメッセージができます。</p>');
    }
    box.innerHTML = h;
  }

  function bindMake() {
    $('#makeTabs').addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-make]');
      if (!b) return;
      make.mode = b.getAttribute('data-make');
      make.variant = 0;
      renderMake();
    });
    $('#signInput').addEventListener('change', function () { U.storeSet(SIGN_KEY, this.value.trim()); U.toast('署名を保存しました'); renderMake(); });
    var box = $('#makeBody');
    box.addEventListener('change', function (ev) {
      var t = ev.target;
      if (t.matches('[data-act=tplcat]')) { make.tplCat = t.value; renderMake(); }
      if (t.matches('[data-act=format]')) { make.format = t.value; }
      if (t.matches('[data-act=rpmood]')) { make.rpMood = t.value; }
    });
    box.addEventListener('click', function (ev) {
      var t = ev.target.closest('button');
      if (!t) return;
      var dc = dietClient(make.rpMood === null ? undefined : make.rpMood);
      var act = t.getAttribute('data-act');
      if (t.hasAttribute('data-tpl')) {
        var id = t.getAttribute('data-tpl');
        var tpl = make.myTemplates.concat(DD.TEMPLATES).filter(function (x) { return x.id === id; })[0];
        if (tpl) setCompose(DE.fillTemplate(dc, tpl.text, {}), { kind: 'template', label: '定型文：' + tpl.title });
        return;
      }
      if (t.hasAttribute('data-deltpl')) {
        var did = t.getAttribute('data-deltpl');
        U.ask('この定型文を削除します。よろしいですか？', { ok: '削除する', danger: true }).then(function (yes) {
          if (yes) call({ action: 'deleteTemplate', id: did }).then(function () { make.myTemplates = make.myTemplates.filter(function (x) { return x.id !== did; }); renderMake(); });
        });
        return;
      }
      if (t.hasAttribute('data-rpday')) { make.rpDay = +t.getAttribute('data-rpday'); make.variant = 0; renderMake(); return; }
      if (t.hasAttribute('data-scene')) {
        make.sceneId = t.getAttribute('data-scene');
        var sc = DD.PLATEAU_SCENES.filter(function (x) { return x.id === make.sceneId; })[0];
        renderMake();
        setCompose(DE.plateauMessage(dc, make.sceneId, { emoji: 1 }), { kind: 'plateau', label: '停滞期サポート：' + sc.title });
        return;
      }
      if (act === 'comment' || act === 'comment-again') {
        if (act === 'comment-again') make.variant++;
        var dn = DE.todayDay(dc);
        setCompose(DE.generateComment(dc, dn, { format: make.format, emoji: 1, variant: make.variant }), { kind: 'comment', label: '今日のコメント（' + dn + '日目）' });
      }
      if (act === 'rapport' || act === 'rapport-again') {
        if (act === 'rapport-again') make.variant++;
        var r = DE.rapportMessage(dc, make.rpDay, { format: 'line', emoji: 1, variant: make.variant, mood: make.rpMood === null ? dc.mood : make.rpMood });
        setCompose(r.text, { kind: 'rapport', day: make.rpDay, label: 'ラポール21日：' + make.rpDay + '日目' });
      }
      if (act === 'draft') {
        t.disabled = true;
        t.textContent = 'AIが下書きを作っています…';
        var tg = M.targets(cur.client);
        call({ action: 'draftReply', id: cur.client.id, instruction: ($('#draftHint') || {}).value || '',
          targets: tg ? { エネルギー: tg.kcal + 'kcal', たんぱく質: tg.protein_g + 'g', 塩分: tg.salt_g + 'g未満' } : null })
          .then(function (d) {
            var text = d.message + (sign() && d.message.indexOf(sign()) === -1 ? '\n\n' + sign() : '');
            make.draftNote = '📝 下書きで触れたこと' + (d.demo ? '<span class="demo-flag">デモ</span>' : '') + '<ul>' + (d.considered || []).map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul><span class="small muted">内容を確認して、必要なら直してから送ってください。</span>';
            renderMake();
            setCompose(text, { kind: 'draft', label: 'AIの下書き' });
          }, function (e) { U.toast(e.message); renderMake(); });
      }
    });
  }

  // ------------------------------------------------------------------
  // イベント
  // ------------------------------------------------------------------
  function bind() {
    $('#loginForm').addEventListener('submit', function (ev) {
      ev.preventDefault();
      var pw = this.elements.password.value;
      call({ action: 'login', password: pw }).then(function (d) {
        token = d.token;
        U.storeSet(TOKEN_KEY, token);
        show('list');
        loadList();
        loadTemplates();
      }, function (e) { U.toast(e.message); });
    });
    $('#btnLogout').addEventListener('click', function () { token = null; U.storeSet(TOKEN_KEY, null); show('login'); });
    $all('[data-back]').forEach(function (b) { b.addEventListener('click', function () { show('list'); loadList(); }); });
    $('#clientCards').addEventListener('click', function (ev) {
      var c = ev.target.closest('[data-client]');
      if (c) { ui.dtab = 'records'; openClient(c.getAttribute('data-client')); }
    });

    $('#btnAdd').addEventListener('click', function () {
      var f = $('#addForm');
      f.innerHTML = profileFormHtml({}, '追加して招待リンクを作る');
      showFormTarget(f);
      show('add');
    });
    $('#addForm').addEventListener('input', function () { showFormTarget(this); });
    $('#addForm').addEventListener('submit', function (ev) {
      ev.preventDefault();
      call({ action: 'createClient', profile: readProfile(this) }).then(function (d) { showInvite(d.client, d.inviteCode); }, function (e) { U.toast(e.message); });
    });
    $('#btnInviteCopy').addEventListener('click', function () { U.copyText($('#inviteText').value); });
    $('#btnInviteLine').addEventListener('click', function () { U.openLine($('#inviteText').value); });

    $('#dTabs').addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-dtab]');
      if (!b) return;
      ui.dtab = b.getAttribute('data-dtab');
      renderDetail();
      if (ui.dtab === 'messages') markRead();
    });
    document.addEventListener('click', function (ev) {
      var m = ev.target.closest('[data-meal]');
      if (!m || !cur) return;
      var date = m.getAttribute('data-date');
      var meal = dayOf(date).meals.filter(function (x) { return x.id === m.getAttribute('data-meal'); })[0];
      if (!meal) return;
      var tg = M.targets(cur.client);
      ui.sheet = JSON.parse(JSON.stringify(Object.assign({ date: date }, meal)));
      $('#sheetContent').innerHTML = '<p class="muted small">' + esc(M.dateLabel(date) + ' ' + (meal.time || '') + '・' + meal.type) + (meal.demo ? '<span class="demo-flag">デモ</span>' : '') + '</p>' +
        '<h2 class="r-name" style="margin:2px 40px 6px 0">' + esc(meal.dish) + '</h2>' +
        (typeof meal.thumb === 'string' ? '<img class="r-photo" src="' + meal.thumb + '" alt="">' : meal.thumb ? '<p class="muted small">写真は直近14日分のみ表示しています</p>' : '') +
        '<div id="shTiles">' + U.tilesHtml(M.totalsFromItems(meal.items), tg) + '</div>' +
        (meal.confidence ? '<p class="conf">' + esc(M.CONFIDENCE[meal.confidence] || '') + '</p>' : '') +
        '<div id="shItems">' + U.itemsEditorHtml(ui.sheet.items) + '</div>' +
        (meal.memo ? '<p class="memo">📝 ' + esc(meal.memo) + '</p>' : '') +
        U.notesHtml(meal.good, meal.cautions, []) +
        '<div class="btn-row"><button type="button" class="btn primary" id="btnSheetSave" style="flex:1">数値の修正を保存</button><button type="button" class="btn ghost" id="btnSheetReply">この食事に返信</button></div>';
      $('#sheet').hidden = false;
    });
    U.bindItemsEditor($('#sheetContent'), function () { return ui.sheet.items; }, function (structural) {
      if (structural) $('#shItems').innerHTML = U.itemsEditorHtml(ui.sheet.items);
      $('#shTiles').innerHTML = U.tilesHtml(M.totalsFromItems(ui.sheet.items), M.targets(cur.client));
    });
    $('#sheet').addEventListener('click', function (ev) {
      if (ev.target.closest('[data-close]')) { this.hidden = true; return; }
      if (ev.target.closest('#btnSheetSave')) {
        var sh = this;
        call({ action: 'updateMeal', id: cur.client.id, date: ui.sheet.date, mealId: ui.sheet.id, patch: { items: ui.sheet.items } }).then(function (r) {
          cur.days = cur.days.map(function (d) { return d.date === r.day.date ? r.day : d; });
          sh.hidden = true;
          U.toast('修正を保存しました');
          renderDetail();
        }, function (e) { U.toast(e.message); });
      }
      if (ev.target.closest('#btnSheetReply')) {
        this.hidden = true;
        ui.dtab = 'messages';
        renderDetail();
        markRead();
        var ta = $('#dMsgForm').elements.text;
        ta.value = nameOf(cur.client) + '、' + M.dateLabel(ui.sheet.date).replace(/（.）/, '') + 'の' + ui.sheet.type + '（' + ui.sheet.dish + '）の写真、ありがとうございます。\n';
        make.compose = { kind: 'reply', label: '食事への返信：' + ui.sheet.dish };
        renderComposeKind();
        ta.focus();
      }
    });

    bindMake();
    $('#dMsgForm').addEventListener('submit', function (ev) {
      ev.preventDefault();
      var ta = this.elements.text;
      var text = ta.value.trim();
      if (!text) return;
      call({ action: 'sendMessage', id: cur.client.id, text: text, meta: make.compose }).then(function (r) {
        cur.messages.push(r.message);
        ta.value = '';
        make.compose = null;
        make.draftNote = null;
        renderComposeKind();
        renderDetail();
        U.toast('送信しました');
      }, function (e) { U.toast(e.message); });
    });
    $('#btnSaveTpl').addEventListener('click', function () {
      var text = $('#dMsgForm').elements.text.value.trim();
      if (!text) return U.toast('先にメッセージを入力してください');
      U.ask('定型文のタイトルを入れてください', { input: true, placeholder: '例：朝の記録へのお礼', ok: '保存する' }).then(function (title) {
        if (!title) return;
        // 呼び名は {name} に戻して、ほかのクライアントにも使えるようにする
        var generic = text.split(nameOf(cur.client)).join('{name}');
        call({ action: 'saveTemplate', template: { title: title, text: generic } }).then(function (r) {
          make.myTemplates.unshift(r.template);
          U.toast('定型文に保存しました（呼び名は自動で差し込まれます）');
          if (make.mode === 'template') renderMake();
        }, function (e) { U.toast(e.message); });
      });
    });

    $('#editForm').addEventListener('input', function () { showFormTarget(this); });
    $('#editForm').addEventListener('submit', function (ev) {
      ev.preventDefault();
      call({ action: 'updateClient', id: cur.client.id, profile: readProfile(this) }).then(function (d) { cur.client = d.client; U.toast('保存しました'); renderDetail(); }, function (e) { U.toast(e.message); });
    });
    $('#btnReinvite').addEventListener('click', function () {
      U.ask('招待リンクを作り直します。今のリンクは使えなくなります。よろしいですか？', { ok: '作り直す' }).then(function (yes) {
        if (yes) call({ action: 'resetInvite', id: cur.client.id }).then(function (d) { showInvite(cur.client, d.inviteCode); }, function (e) { U.toast(e.message); });
      });
    });
    $('#btnDelete').addEventListener('click', function () {
      U.ask(nameOf(cur.client) + 'の記録とメッセージをすべて削除します。元に戻せません。よろしいですか？', { ok: '削除する', danger: true }).then(function (yes) {
        if (yes) call({ action: 'deleteClient', id: cur.client.id }).then(function () { U.toast('削除しました'); show('list'); loadList(); }, function (e) { U.toast(e.message); });
      });
    });

    setInterval(function () {
      if (document.hidden || !token) return;
      if (ui.view === 'list') loadList();
    }, 60000);
  }

  function checkSetup() {
    return U.health().then(function (h) {
      var msgs = [];
      if (h.offline) msgs.push('サーバーに接続できません。');
      else {
        if (h.mock) msgs.push('🧪 デモモードです（AI はサンプルの結果を返します）。');
        else if (!h.ai) msgs.push('AI の設定がまだです（ANTHROPIC_API_KEY）。');
        if (h.store === 'none') msgs.push('保存先の設定がまだです（Upstash Redis）。');
        if (!h.coachPassword) msgs.push('コーチのパスワードが未設定です（COACH_PASSWORD）。');
        if (!h.sessionSecret) msgs.push('SESSION_SECRET が未設定です。');
      }
      var bar = $('#statusBar');
      bar.hidden = !msgs.length;
      bar.textContent = msgs.join(' ');
    });
  }

  bind();
  U.registerSw();
  checkSetup();
  if (token) { show('list'); loadList(); loadTemplates(); } else show('login');
})();
