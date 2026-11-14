/*
 * つなぐ版のデータを、ダイエットサポート版（js/diet/）の形に変換する
 *
 * ダイエットサポート版の文章づくり（定型コメント・今日のコメント・ラポール21日・停滞期サポート）を
 * そのまま使うための「橋わたし」。
 */
(function (root) {
  'use strict';

  var MOOD_MAP = { good: 'good', normal: 'normal', tired: 'tired', anxious: 'anxious', down: 'down' };

  /**
   * @param {object} client  つなぐ版のクライアント（プロフィール）
   * @param {Array}  days    つなぐ版の日ごとの記録（新しい順でも古い順でもよい）
   * @param {object} opts    { sign: 署名, mood: 気持ちのID（省略時は最新の記録から） }
   */
  function toDietClient(client, days, opts) {
    opts = opts || {};
    var logs = (days || []).filter(function (d) { return d.body && (d.body.weight || d.body.sleep !== undefined || d.body.mood || d.body.memo); })
      .map(function (d) {
        var l = { date: d.date };
        if (d.body.weight) l.weight = d.body.weight;
        if (d.body.sleep !== undefined) l.sleep = d.body.sleep;
        if (d.body.mood) l.mood = d.body.mood;
        if (d.body.memo) l.memo = d.body.memo;
        return l;
      })
      .sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    var latestMood = '';
    for (var i = logs.length - 1; i >= 0; i--) { if (logs[i].mood) { latestMood = logs[i].mood; break; } }
    return {
      id: client.id,
      name: client.name || '',
      honorific: client.honorific === undefined ? 'さん' : client.honorific,
      gender: client.sex === 'male' ? 'male' : client.sex === 'female' ? 'female' : 'other',
      age: client.age || '',
      height: client.height || '',
      activity: client.activity || 'low',
      // 開始体重がなければ、今の体重を開始体重として扱う
      startWeight: client.startWeight || client.weight || '',
      goalWeight: client.goalWeight || '',
      startDate: client.startDate || (client.createdAt ? String(client.createdAt).slice(0, 10) : ''),
      totalDays: client.totalDays || 90,
      goalNote: client.goalNote || '',
      tone: client.tone || 'gentle',
      level: 1,
      places: ['home'],
      concerns: Array.isArray(client.concerns) ? client.concerns : [],
      coach: opts.sign || '',
      logs: logs,
      mood: opts.mood !== undefined ? opts.mood : (MOOD_MAP[latestMood] || ''),
      rapportStart: client.rapportStart || ''
    };
  }

  /** メッセージの記録から、送信済みのラポールの日を集める */
  function sentRapportDays(messages) {
    var days = {};
    (messages || []).forEach(function (m) {
      if (m.from === 'coach' && m.meta && m.meta.kind === 'rapport' && m.meta.day) days[m.meta.day] = m.at;
    });
    return days;
  }

  /** まだ送っていない、いちばん小さいラポールの日（すべて送っていれば null） */
  function nextRapportDay(messages) {
    var sent = sentRapportDays(messages);
    for (var d = 1; d <= 21; d++) if (!sent[d]) return d;
    return null;
  }

  root.DietBridge = { toDietClient: toDietClient, sentRapportDays: sentRapportDays, nextRapportDay: nextRapportDay };
})(typeof window !== 'undefined' ? window : globalThis);
