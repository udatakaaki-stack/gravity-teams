/*
 * クライアント用・コーチ用の画面で共通に使う道具
 */
(function (root) {
  'use strict';
  var M = root.MealCalc;

  function $(s, r) { return (r || document).querySelector(s); }
  function $all(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(s) {
    return String(s === undefined || s === null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function fmt(n) { return Number(n || 0).toLocaleString('ja-JP'); }
  function nowTime() { var d = new Date(); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }
  function todayKey() { return M.dateKey(new Date()); }

  var toastTimer;
  function toast(msg) {
    var t = $('#toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2600);
  }

  function storeGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function storeSet(k, v) { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { /* 保存できなくても動かす */ } }

  /** サーバーの操作を呼ぶ。401 の時は onUnauthorized を呼ぶ */
  function api(path, body, token, onUnauthorized) {
    var headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = 'Bearer ' + token;
    return fetch(path, { method: 'POST', headers: headers, body: JSON.stringify(body) }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (data) {
        if (r.status === 401 && onUnauthorized) onUnauthorized(data.error);
        if (!r.ok) { var e = new Error(data.error || ('通信エラー（' + r.status + '）')); e.status = r.status; throw e; }
        return data;
      });
    }, function () { throw new Error('サーバーに接続できませんでした。通信状態を確認してください。'); });
  }

  function health() {
    return fetch('api/health').then(function (r) { return r.json(); }).catch(function () { return { offline: true }; });
  }

  // ------------------------------------------------------------------
  // 写真
  // ------------------------------------------------------------------
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
    var c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    var ctx = c.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    return c.toDataURL('image/jpeg', quality);
  }
  /** 解析用（長い辺1280px）と保存用サムネイル（240px）を作る */
  function preparePhoto(file) {
    return loadImage(file).then(function (r) {
      var full = toJpeg(r.img, 1280, 0.82);
      var thumb = toJpeg(r.img, 240, 0.62);
      URL.revokeObjectURL(r.url);
      return { dataUrl: full, base64: full.split(',')[1], thumb: thumb };
    });
  }

  // ------------------------------------------------------------------
  // 表示の部品
  // ------------------------------------------------------------------
  function ringSvg(intake, target) {
    var r = 54, c = 2 * Math.PI * r;
    var ratio = target ? Math.min(intake / target, 1) : 0;
    var over = target && intake > target;
    var gid = 'rg' + Math.random().toString(36).slice(2, 7);
    return '<svg viewBox="0 0 132 132" role="img" aria-label="目標' + target + 'kcalのうち' + intake + 'kcal">' +
      '<defs><linearGradient id="' + gid + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + (over ? '#fb7185' : '#a78bfa') + '"/><stop offset="1" stop-color="' + (over ? '#e11d48' : '#ec4899') + '"/></linearGradient></defs>' +
      '<circle class="track" cx="66" cy="66" r="' + r + '" fill="none" stroke-width="12"/>' +
      '<circle cx="66" cy="66" r="' + r + '" fill="none" stroke="url(#' + gid + ')" stroke-width="12" stroke-linecap="round" stroke-dasharray="' + (c * ratio) + ' ' + c + '" transform="rotate(-90 66 66)"/>' +
      '<text class="num" x="66" y="68" text-anchor="middle">' + fmt(intake) + '</text>' +
      '<text class="sub" x="66" y="88" text-anchor="middle">/ ' + (target ? fmt(target) + ' 目標' : '目標未設定') + '</text></svg>';
  }

  function balanceHtml(total, tg, meals) {
    var eaten = meals.map(function (m) { return m.type.replace('食', ''); }).filter(function (x, i, a) { return a.indexOf(x) === i; }).join('＋');
    var diff = tg ? total.kcal - tg.kcal : null;
    return '<div><dt><i style="background:#8b5cf6"></i>摂取' + (eaten ? '（' + esc(eaten) + '）' : '') + '</dt><dd>' + fmt(total.kcal) + ' kcal</dd></div>' +
      '<div><dt><i style="background:#10b981"></i>目標摂取</dt><dd>' + (tg ? fmt(tg.kcal) + ' kcal' : '―') + '</dd></div>' +
      '<div><dt><i style="background:#60a5fa"></i>消費目安</dt><dd>' + (tg ? '約' + fmt(tg.tdee) + ' kcal' : '―') + '</dd></div>' +
      '<div><dt><i style="background:#f43f5e"></i>目標との差</dt><dd class="' + (diff > 0 ? 'plus' : 'minus') + '">' + (diff === null ? '―' : (diff > 0 ? '+' : '') + fmt(diff) + ' kcal') + '</dd></div>';
  }

  var MEAL_ORDER = ['朝食', '昼食', '夕食', '間食'];
  function sortMeals(meals) {
    return (meals || []).slice().sort(function (a, b) { return MEAL_ORDER.indexOf(a.type) - MEAL_ORDER.indexOf(b.type) || String(a.time).localeCompare(String(b.time)); });
  }

  function mealItemHtml(m, tg, opts) {
    opts = opts || {};
    var warn = M.mealWarnings(m.totals, tg).length;
    var tag = (m.tags && m.tags.length ? m.tags.slice(0, 2).join('・') : '') + (warn ? (m.tags && m.tags.length ? '　' : '') + '⚠️ 気をつけたい点あり' : '');
    var img = typeof m.thumb === 'string' ? '<img src="' + m.thumb + '" alt="">' : '<span class="no-img">' + (m.thumb ? '📷' : '🍽') + '</span>';
    return '<li><button type="button" class="meal-item" data-meal="' + esc(m.id) + '" data-date="' + esc(opts.date || '') + '">' + img +
      '<span><span class="m-name">' + esc(m.type + '・' + (m.dish || '食事')) + '</span><span class="m-tag">' + esc(tag || m.time || '') + '</span></span>' +
      '<span class="m-kcal">' + fmt(m.totals.kcal) + '<small>kcal</small></span></button></li>';
  }

  var NUM_KEYS = ['kcal', 'protein_g', 'fat_g', 'carbs_g', 'salt_g'];
  var NUM_LABEL = { kcal: 'kcal', protein_g: 'P(g)', fat_g: 'F(g)', carbs_g: 'C(g)', salt_g: '塩分(g)' };
  var TILE_LABEL = { kcal: 'kcal', protein_g: 'たんぱく質', fat_g: '脂質', carbs_g: '炭水化物', salt_g: '塩分' };

  function tilesHtml(t, tg) {
    var hot = {};
    if (tg) { if (t.fat_g >= tg.fat_g * 0.5) hot.fat_g = true; if (t.salt_g >= tg.salt_g * 0.5) hot.salt_g = true; }
    return '<div class="tiles">' + NUM_KEYS.map(function (k) {
      return '<div class="tile' + (hot[k] ? ' hot' : '') + '"><b>' + (k === 'kcal' ? fmt(t.kcal) : t[k] + 'g') + '</b><span>' + TILE_LABEL[k] + '</span></div>';
    }).join('') + '</div>';
  }

  function itemsEditorHtml(items, readonly) {
    return '<div class="items">' + items.map(function (it, i) {
      return '<div class="item" data-i="' + i + '"><div class="item-top"><input class="name" data-k="name" value="' + esc(it.name) + '" placeholder="料理名" aria-label="料理名"' + (readonly ? ' readonly' : '') + '>' +
        (readonly ? '' : '<button type="button" class="del" data-del="' + i + '" aria-label="この料理を削除">✕</button>') + '</div>' +
        (it.portion ? '<p class="portion">推定量：' + esc(it.portion) + '</p>' : '') +
        '<div class="item-nums">' + NUM_KEYS.map(function (k) {
          return '<label><span>' + NUM_LABEL[k] + '</span><input type="number" inputmode="decimal" step="' + (k === 'kcal' ? 1 : 0.1) + '" min="0" data-k="' + k + '" value="' + it[k] + '"' + (readonly ? ' readonly' : '') + '></label>';
        }).join('') + '</div></div>';
    }).join('') + '</div>';
  }

  /** 料理の編集欄の入力を items に反映する */
  function bindItemsEditor(container, getItems, onChange) {
    container.addEventListener('input', function (ev) {
      var inp = ev.target.closest('input[data-k]');
      if (!inp || inp.readOnly) return;
      var row = inp.closest('[data-i]');
      var it = getItems()[+row.getAttribute('data-i')];
      var k = inp.getAttribute('data-k');
      it[k] = k === 'name' ? inp.value : Math.max(0, parseFloat(inp.value) || 0);
      onChange(false);
    });
    container.addEventListener('click', function (ev) {
      var del = ev.target.closest('[data-del]');
      if (!del) return;
      getItems().splice(+del.getAttribute('data-del'), 1);
      onChange(true);
    });
  }

  function notesHtml(good, cautions, assumptions) {
    var h = '';
    if (good && good.length) h += '<div class="note good">🌱 よいところ<ul>' + good.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></div>';
    if (cautions && cautions.length) h += '<div class="note care">💡 さらに整えるなら<ul>' + cautions.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></div>';
    if (assumptions && assumptions.length) h += '<div class="note">📝 推定の前提<ul>' + assumptions.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></div>';
    return h;
  }

  function kcalChart(days, tg, todayK) {
    var list = [];
    for (var i = 13; i >= 0; i--) {
      var d = M.addDays(todayK, -i);
      var day = days.filter(function (x) { return x.date === d; })[0];
      var meals = day ? day.meals || [] : [];
      list.push({ d: d, kcal: M.sumTotals(meals).kcal, n: meals.length });
    }
    var W = 336, H = 150, P = 24, bw = (W - P) / 14;
    var max = Math.max.apply(null, list.map(function (x) { return x.kcal; }).concat([tg ? tg.kcal * 1.2 : 2000, 1]));
    var y = function (v) { return 8 + (1 - v / max) * (H - 28); };
    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="直近14日のカロリー"><line class="axis" x1="' + P + '" x2="' + W + '" y1="' + (H - 20) + '" y2="' + (H - 20) + '"/>';
    if (tg) s += '<line class="target" x1="' + P + '" x2="' + W + '" y1="' + y(tg.kcal) + '" y2="' + y(tg.kcal) + '"/><text x="0" y="' + (y(tg.kcal) + 3) + '">目標</text>';
    list.forEach(function (x, i) {
      if (!x.n) return;
      s += '<rect class="bar' + (tg && x.kcal > tg.kcal ? ' over' : '') + '" x="' + (P + i * bw + 2) + '" y="' + y(x.kcal) + '" width="' + (bw - 4) + '" height="' + Math.max(1, (H - 20) - y(x.kcal)) + '" rx="3"><title>' + x.d + '：' + x.kcal + 'kcal</title></rect>';
    });
    s += '<text x="' + P + '" y="' + (H - 6) + '">' + list[0].d.slice(5).replace('-', '/') + '</text><text x="' + (W - 30) + '" y="' + (H - 6) + '">今日</text></svg>';
    var rec = list.filter(function (x) { return x.n; });
    var avg = rec.length ? Math.round(rec.reduce(function (a, x) { return a + x.kcal; }, 0) / rec.length) : null;
    return { svg: s, avg: avg, days: rec.length };
  }

  function weightChart(days) {
    var ws = days.filter(function (d) { return d.body && d.body.weight; }).map(function (d) { return { date: d.date, weight: d.body.weight }; })
      .sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    if (ws.length < 2) return { svg: '', note: ws.length ? '2日以上記録すると、グラフが表示されます。' : 'まだ体重の記録がありません。' };
    var W = 336, H = 150, P = 24;
    var vals = ws.map(function (w) { return w.weight; });
    var mn = Math.min.apply(null, vals) - 0.5, mx = Math.max.apply(null, vals) + 0.5;
    var y = function (v) { return 8 + (1 - (v - mn) / (mx - mn)) * (H - 28); };
    var x = function (i) { return P + i * ((W - P - 8) / (ws.length - 1)); };
    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="体重の推移"><line class="axis" x1="' + P + '" x2="' + W + '" y1="' + (H - 20) + '" y2="' + (H - 20) + '"/>' +
      '<polyline class="wline" points="' + ws.map(function (w, i) { return x(i) + ',' + y(w.weight); }).join(' ') + '"/>';
    ws.forEach(function (w, i) { s += '<circle cx="' + x(i) + '" cy="' + y(w.weight) + '" r="3"><title>' + w.date + '：' + w.weight + 'kg</title></circle>'; });
    s += '<text x="0" y="' + (y(mx - 0.5) + 3) + '">' + (mx - 0.5).toFixed(1) + '</text><text x="0" y="' + (y(mn + 0.5) + 3) + '">' + (mn + 0.5).toFixed(1) + '</text>' +
      '<text x="' + P + '" y="' + (H - 6) + '">' + ws[0].date.slice(5).replace('-', '/') + '</text><text x="' + (W - 34) + '" y="' + (H - 6) + '">' + ws[ws.length - 1].date.slice(5).replace('-', '/') + '</text></svg>';
    var diff = Math.round((ws[ws.length - 1].weight - ws[0].weight) * 10) / 10;
    return { svg: s, note: ws[0].date.slice(5).replace('-', '/') + 'から ' + (diff > 0 ? '+' : '') + diff + 'kg。体重は水分などで毎日上下するので、1週間くらいの流れで見ていきましょう。' };
  }

  var MOODS = [['good', '😊 よい'], ['normal', '🙂 ふつう'], ['tired', '😮‍💨 疲れ気味'], ['anxious', '😟 不安'], ['down', '😢 落ち込み']];
  function moodLabel(id) { var m = MOODS.filter(function (x) { return x[0] === id; })[0]; return m ? m[1] : ''; }

  function messagesHtml(msgs, me, opts) {
    opts = opts || {};
    if (!msgs.length) return '<p class="empty">まだメッセージはありません。</p>';
    var last = '';
    return msgs.map(function (m) {
      var d = new Date(m.at);
      var day = (d.getMonth() + 1) + '月' + d.getDate() + '日';
      var sep = day !== last ? '<div class="msg-day">' + day + '</div>' : '';
      last = day;
      var time = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
      var meta = opts.meta && m.meta && m.meta.label ? '<span class="msg-meta">' + esc(m.meta.label) + '</span>' : '';
      return sep + '<div class="msg ' + (m.from === me ? 'mine' : 'theirs') + '"><div><div class="bubble">' + esc(m.text).replace(/\n/g, '<br>') + '</div>' + meta + '</div><span class="msg-time">' + time + '</span></div>';
    }).join('');
  }

  function copyText(text) {
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); toast('コピーしました'); } catch (e) { toast('コピーできませんでした'); }
      document.body.removeChild(ta);
    }
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(function () { toast('コピーしました'); }, fallback);
    else fallback();
  }

  function openLine(text) { window.open('https://line.me/R/share?text=' + encodeURIComponent(text), '_blank', 'noopener'); }

  function registerSw() {
    if (!root.__DEMO__ && 'serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(function () { /* 登録できなくても動く */ });
  }

  root.UI = {
    $: $, $all: $all, esc: esc, fmt: fmt, nowTime: nowTime, todayKey: todayKey, toast: toast, storeGet: storeGet, storeSet: storeSet,
    api: api, health: health, preparePhoto: preparePhoto, ringSvg: ringSvg, balanceHtml: balanceHtml, sortMeals: sortMeals,
    mealItemHtml: mealItemHtml, tilesHtml: tilesHtml, itemsEditorHtml: itemsEditorHtml, bindItemsEditor: bindItemsEditor, notesHtml: notesHtml,
    kcalChart: kcalChart, weightChart: weightChart, MOODS: MOODS, moodLabel: moodLabel, messagesHtml: messagesHtml,
    copyText: copyText, openLine: openLine, registerSw: registerSw
  };
})(window);
