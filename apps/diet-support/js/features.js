/*
 * ダイエットサポートプログラム：追加機能のデータと処理
 *   返信アシスト / 安全アラート / 週の振り返り / 食事の組み合わせ例 / 初回カウンセリング
 * ブラウザ（window.DietFeatures）と Node.js（require）の両方で動作します。
 */
(function (root, factory) {
  'use strict';
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory(require('./data.js'), require('./engine.js'));
  } else {
    root.DietFeatures = factory(root.DIET_DATA, root.DietEngine);
  }
})(typeof window !== 'undefined' ? window : this, function (D, E) {
  'use strict';

  // ------------------------------------------------------------------
  // 共通
  // ------------------------------------------------------------------
  function hash(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function pick(r, list) { return list && list.length ? list[Math.floor(r() * list.length)] : ''; }
  function fill(t, v) {
    return String(t).replace(/\{(\w+)\}/g, function (m, k) { return Object.prototype.hasOwnProperty.call(v, k) ? v[k] : m; });
  }
  function round1(n) { return Math.round(n * 10) / 10; }
  function num(v) { var n = parseFloat(v); return isNaN(n) ? null : n; }
  function avg(list) { return list.length ? list.reduce(function (a, b) { return a + b; }, 0) / list.length : null; }
  function addDays(dateStr, n) { var d = E.parseDate(dateStr); d.setDate(d.getDate() + n); return E.formatDate(d); }
  function signed(n, unit) { return (n > 0 ? '＋' : n < 0 ? '−' : '±') + Math.abs(round1(n)) + unit; }
  function today() { return E.formatDate(new Date()); }

  // 体重以外の項目も含めた記録（日付順）
  function allLogs(client) {
    return (client.logs || []).filter(function (l) { return l && l.date; })
      .slice().sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
  }

  // ------------------------------------------------------------------
  // 記録項目
  // ------------------------------------------------------------------
  var LOG_MOODS = [
    { id: '', label: '―' },
    { id: 'good', label: 'よい' },
    { id: 'normal', label: 'ふつう' },
    { id: 'tired', label: '疲れ気味' },
    { id: 'anxious', label: '不安' },
    { id: 'down', label: '落ち込み' }
  ];

  // ------------------------------------------------------------------
  // 安全アラート
  // ------------------------------------------------------------------
  var SYMPTOM_WORDS = ['めまい', 'ふらつ', '立ちくらみ', '倒れ', '動悸', '吐き気', '生理が止ま', '生理が来な', '生理がこな', '食べられな', '吐いて', '吐いた', '下剤'];
  var CRISIS_WORDS = ['死にたい', '消えたい', '生きていたくな', 'いなくなりたい'];

  function findWords(text, words) {
    text = String(text || '');
    return words.filter(function (w) { return text.indexOf(w) !== -1; });
  }

  var SAFETY_MESSAGES = {
    symptom: '{name}、体調のこと、教えてくださってありがとうございます。とても心配しています。\n\nまずは無理をせず、食事と水分をしっかりとって、体を休めることを最優先にしてください。症状が続く場合や強い場合は、早めに医療機関を受診してください。\n\n体調が落ち着くまでは、ダイエットのことは一度お休みしましょう。元気になってから、また一緒に再開すれば大丈夫ですよ。',
    crisis: '{name}、とてもつらい気持ちを話してくださって、ありがとうございます。\n\n今は、ダイエットのことより{name}自身のことがいちばん大切です。どうかひとりで抱えずに、信頼できる人や、専門の相談窓口にも話してみてください。\n\n私も、いつでも話を聴きます。',
    fastLoss: '{name}、毎日本当によく頑張っていますね。\n\nここ1週間で体重が少し早いペースで減っているので、念のため確認させてください。食事の量が少なくなりすぎていたり、だるさやめまいを感じたりしていませんか？\n\n早く減ることより、元気に続けられることの方がずっと大切です。少し食事を増やすくらいの気持ちで大丈夫ですよ。',
    sleep: '{name}、最近お疲れではありませんか？\n\n睡眠時間が短い日が続いているようなので、少し心配しています。睡眠が足りないと食欲が増えやすくなることも分かっています。今週は、いつもより15分だけ早く布団に入ることを、いちばんの目標にしてみませんか。',
    mood: '{name}、最近、気持ちがしんどい日が続いていませんか？\n\nそんな時は、ダイエットのことは少しお休みして大丈夫です。頑張れない日があるのは当たり前のことです。話したいことがあれば、どんなことでも聞かせてくださいね。',
    lowBmi: '{name}、ここまで本当によく頑張ってきましたね。\n\n今の体重は、BMIで見ると「低体重」の範囲に入ってきています。ここからは、減らすことよりも体を元気に保つことを大切にしていきましょう。一度、目標を一緒に見直させてください。',
    medical: '{name}、持病やお薬のことを教えてくださってありがとうございます。\n\n安心して取り組んでいただけるように、食事や運動の内容について、一度主治医の先生にも相談してみてください。先生からのアドバイスに合わせて、プランを調整していきますね。'
  };

  /**
   * コーチ向けの注意を返します。
   * level: urgent（すぐ対応）/ warn（注意）/ info（確認）
   */
  function safetyAlerts(client, asOf) {
    var alerts = [];
    var end = asOf || today();
    var logs = allLogs(client).filter(function (l) { return l.date <= end; });
    var wlogs = logs.filter(function (l) { return num(l.weight) !== null; });
    var h = num(client.height);
    var counseling = client.counseling || {};

    // 記録のメモ・カウンセリングの回答に、体調不良やつらい気持ちを示す言葉がないか（直近14日）
    var since14 = addDays(end, -13);
    var memoText = logs.filter(function (l) { return l.date >= since14; }).map(function (l) { return l.memo || ''; }).join('\n');
    var allText = memoText + '\n' + (counseling.worries || '') + '\n' + (counseling.medical || '');
    var crisis = findWords(allText, CRISIS_WORDS);
    if (crisis.length) {
      alerts.push({
        id: 'crisis', level: 'urgent', title: 'つらい気持ちを示す言葉があります',
        body: '記録のメモなどに「' + crisis.join('」「') + '」という言葉があります。ダイエットの話はいったん脇に置き、気持ちを受け止めることを優先してください。命に関わる心配がある場合は、ご家族や専門家と連携しましょう。厚生労働省のサイト「まもろうよ こころ」に、電話やSNSの相談窓口がまとめられています。',
        message: SAFETY_MESSAGES.crisis
      });
    }
    var symptoms = findWords(memoText, SYMPTOM_WORDS);
    if (symptoms.length) {
      alerts.push({
        id: 'symptom', level: 'urgent', title: '体調不良を示す言葉があります',
        body: '直近の記録のメモに「' + symptoms.join('」「') + '」という言葉があります。食事制限や運動の強度を下げ、症状が続く場合は医療機関の受診をすすめてください。',
        message: SAFETY_MESSAGES.symptom
      });
    }

    // 減るペースが速い（直近の記録と、その5〜9日前の記録を比べる）
    if (wlogs.length >= 2) {
      var latest = wlogs[wlogs.length - 1];
      var from = addDays(latest.date, -9);
      var to = addDays(latest.date, -5);
      var base = wlogs.filter(function (l) { return l.date >= from && l.date <= to; })[0];
      if (base) {
        var days = Math.round((E.parseDate(latest.date) - E.parseDate(base.date)) / 86400000);
        var weekly = (num(base.weight) - num(latest.weight)) / days * 7;
        if (weekly > 1 && weekly > num(base.weight) * 0.01) {
          alerts.push({
            id: 'fastLoss', level: 'warn', title: '減るペースが速めです',
            body: '直近の記録では、1週間あたり約' + round1(weekly) + 'kgのペースで減っています。始めて1〜2週間は水分の変化で大きく動くこともありますが、食べなさすぎていないか、だるさやめまいがないかを確認しましょう。',
            message: SAFETY_MESSAGES.fastLoss
          });
        }
      }
    }
    if (h && wlogs.length) {
      var bmi = num(wlogs[wlogs.length - 1].weight) / Math.pow(h / 100, 2);
      if (bmi < 18.5) {
        alerts.push({
          id: 'lowBmi', level: 'warn', title: '現在のBMIが低体重の範囲です',
          body: '最新の体重でのBMIは' + round1(bmi) + 'です（18.5未満は低体重）。これ以上の減量は控え、維持や目標の見直しを検討しましょう。',
          message: SAFETY_MESSAGES.lowBmi
        });
      }
    }

    // 睡眠不足が続いている（直近7日で5時間未満が3回以上）
    var since7 = addDays(end, -6);
    var week = logs.filter(function (l) { return l.date >= since7; });
    var shortSleep = week.filter(function (l) { var s = num(l.sleep); return s !== null && s < 5; });
    if (shortSleep.length >= 3) {
      alerts.push({
        id: 'sleep', level: 'warn', title: '睡眠時間が短い日が続いています',
        body: '直近7日間で、睡眠5時間未満の記録が' + shortSleep.length + '回あります。食事や運動の目標を少しゆるめ、睡眠を優先する提案をしましょう。',
        message: SAFETY_MESSAGES.sleep
      });
    }

    // 気持ちが沈んだ記録が続いている
    var lowMood = week.filter(function (l) { return l.mood === 'down' || l.mood === 'anxious'; });
    if (lowMood.length >= 3) {
      alerts.push({
        id: 'mood', level: 'warn', title: '気持ちが沈んだ記録が続いています',
        body: '直近7日間で「落ち込み」「不安」の記録が' + lowMood.length + '回あります。数字の話より、気持ちを聴くことを優先しましょう。',
        message: SAFETY_MESSAGES.mood
      });
    }

    // 目標体重・年齢
    var goal = num(client.goalWeight);
    if (h && goal && goal / Math.pow(h / 100, 2) < 18.5) {
      alerts.push({
        id: 'lowGoal', level: 'warn', title: '目標体重が低体重の範囲です',
        body: '目標体重のBMIは' + round1(goal / Math.pow(h / 100, 2)) + 'です。目標の見直しを一緒に検討しましょう。',
        message: SAFETY_MESSAGES.lowBmi
      });
    }
    if (num(client.age) !== null && num(client.age) < 18) {
      alerts.push({
        id: 'minor', level: 'info', title: '18歳未満の方です',
        body: '成長期のため、食事制限を伴うダイエットは保護者や医師と相談のうえで行ってください。',
        message: ''
      });
    }

    // 持病・服薬・妊娠中など
    if ((counseling.medical && String(counseling.medical).trim() && !/^(なし|特になし|ない|無し)$/.test(String(counseling.medical).trim())) ||
      counseling.pregnant === 'yes') {
      alerts.push({
        id: 'medical', level: 'info', title: '持病・服薬・妊娠などの申告があります',
        body: 'カウンセリングで' + (counseling.pregnant === 'yes' ? '妊娠中・授乳中であること' : '持病や服薬') + 'の申告があります。食事や運動の内容は、主治医に相談したうえで進めてください。',
        message: SAFETY_MESSAGES.medical
      });
    }
    return alerts;
  }

  // ------------------------------------------------------------------
  // 返信アシスト
  // ------------------------------------------------------------------
  var REPLY_MOOD_WORDS = {
    crisisCheck: [],
    guilty: ['罪悪感', '自己嫌悪', '情けな', 'ダメな', 'だめな', '責め', '我慢できなかった', 'やってしまった', '最低'],
    down: ['落ち込', 'つらい', '辛い', 'しんどい', '悲しい', 'ショック', '最悪', 'へこ', 'ヘコ'],
    anxious: ['不安', '心配', '怖い', 'こわい', '大丈夫かな', 'できるかな'],
    impatient: ['焦', '早く結果', 'なかなか', 'もっと早く'],
    tired: ['疲れ', '忙し', '余裕がな', 'くたくた', 'ヘトヘト', 'へとへと', 'バタバタ'],
    good: ['うれしい', '嬉しい', '楽しい', '調子がいい', '調子いい', 'よかった', '良かった', 'がんばれ', '頑張れ', 'できました', 'できた']
  };

  var REPLY_TOPICS = {
    overeat: {
      label: '食べすぎ', words: ['食べすぎ', '食べ過ぎ', 'ドカ食い', 'どか食い', '爆食', '止まらな', '我慢できな'],
      lines: ['食べすぎてしまった日があっても、そこまでの積み重ねがなくなることはありません。食事を抜いて取り戻そうとするより、次の食事からいつも通りに戻すことがいちばんの近道です。'],
      // 「自分を責めている」の言葉と重ならないようにする時の文
      alt: ['食事を抜いて取り戻そうとするより、次の食事からいつも通りに戻すことがいちばんの近道です。野菜や汁物、お水を多めにとって、体を整えていきましょう。']
    },
    plateau: {
      label: '体重が動かない', words: ['減らない', '変わらない', '動かない', '停滞', '横ばい', '落ちない'],
      lines: ['体重が減ってくると、体はその状態に慣れようとして、少しずつエネルギーの使い方を変えていきます。だから数字が止まる時期があるのは自然なことなんです。ウエストや服の着心地など、体重以外の変化も一緒に見ていきましょう。']
    },
    weightUp: {
      label: '体重が増えた', words: ['増えた', '増えて', '太った', 'リバウンド', '戻った'],
      lines: ['体重は、水分や塩分、食事の量などで1日の中でも上下します。増えた分がすべて脂肪というわけではないので、1週間くらいの流れで一緒に見ていきましょう。']
    },
    weightDown: {
      label: '体重が減った', words: ['減った', '減って', '痩せた', 'やせた', '落ちた', '下がった'],
      lines: ['数字に表れているのは、{name}が丁寧に過ごしてきた毎日そのものです。この調子で、焦らず続けていきましょう。']
    },
    party: {
      label: '外食・飲み会・旅行', words: ['飲み会', '外食', '会食', '旅行', '飲みすぎ', '飲み過ぎ', 'お酒', '宴会', '帰省'],
      lines: ['楽しい時間を過ごせたなら、それが何よりです。翌日は食事を抜くのではなく、いつもの食事に戻して、野菜や汁物、お水を多めにとれば大丈夫ですよ。']
    },
    period: {
      label: '生理', words: ['生理'],
      lines: ['生理の前後は、体が水分をためこみやすく、体重が増えたり食欲が出たりしやすい時期です。この時期の数字は気にしすぎず、体を温めて休むことを優先してくださいね。']
    },
    busy: {
      label: '忙しい', words: ['忙しい', '時間がな', '残業', 'バタバタ', '余裕がな'],
      lines: ['忙しい時期は「現状維持」で十分です。食事は主食とたんぱく質、野菜をそろえることだけ意識して、運動はできる日に階段を使うくらいで大丈夫ですよ。']
    },
    sleep: {
      label: '睡眠', words: ['眠れ', '寝不足', '睡眠', '寝れな', '夜更かし'],
      lines: ['睡眠が足りないと、食欲が増えやすくなることが分かっています。今は、いつもより少しでも早く休むことを優先してくださいね。']
    },
    exerciseDone: {
      label: '運動できた', words: ['運動した', '歩いた', '筋トレ', 'ジム', 'ウォーキング', 'スクワット', 'ストレッチした', '走った'],
      lines: ['体を動かせたこと、本当に素晴らしいです。終わった後はストレッチと水分補給を忘れずに。お疲れさまでした。']
    },
    exerciseSkip: {
      label: '運動できなかった', words: ['運動できな', 'サボ', 'さぼ', '動けな', '運動してな'],
      lines: ['運動できない日があっても、まったく問題ありません。階段を使う、少し遠回りして歩くなど、日常の中で動けたらそれで十分です。']
    },
    quit: {
      label: 'やめたい・自信がない', words: ['やめたい', '辞めたい', '無理かも', '続けられな', '自信がな', 'もう無理'],
      lines: ['そう感じるのは、それだけ毎日向き合ってきた証拠です。一度ルールをゆるめて、「これだけは続ける」をひとつに絞ってみませんか。{name}が続けやすい形を、一緒に探させてください。']
    },
    sick: {
      label: '体調不良', words: ['体調', '風邪', '熱が', '具合', '頭痛', 'お腹が痛'],
      lines: ['体調がすぐれない時は、ダイエットのことは一度忘れて、しっかり休むことを最優先にしてください。食べられるものを、食べられる時に食べれば大丈夫です。']
    },
    sweets: {
      label: '甘いもの・間食', words: ['お菓子', 'おやつ', '甘いもの', 'チョコ', 'ケーキ', 'アイス', '間食'],
      lines: ['甘いものを楽しむことも、長く続けるためには大切です。量と時間を決めて、ゆっくり味わって楽しめたなら、それで大丈夫ですよ。']
    }
  };

  var REPLY_FOLLOWUPS = {
    overeat: 'よかったら、食べすぎてしまった時の状況（時間帯や気持ち）を教えてもらえますか？次の作戦を一緒に考えたいです。',
    plateau: 'よかったら、ウエストのサイズを測ったり、服の着心地を確かめたりしてみてもらえますか？',
    weightUp: 'ここ数日で、外食や塩分の多い食事、睡眠不足などはありましたか？',
    quit: '今いちばん負担に感じていることは、どんなことですか？',
    busy: '今の生活の中で「これならできそう」と思えることは、どんなことですか？',
    sleep: '最近、寝る時間はだいたい何時ごろになっていますか？',
    party: '次の予定があれば教えてください。前後の過ごし方を一緒に考えましょう。'
  };

  /** 返信の文章から、気持ち・話題・安全上の注意を読み取ります（キーワードによる判定） */
  function analyzeReply(text) {
    text = String(text || '');
    var moods = Object.keys(REPLY_MOOD_WORDS).filter(function (k) {
      return k !== 'crisisCheck' && findWords(text, REPLY_MOOD_WORDS[k]).length;
    });
    // 「できなかった」は「できた」と誤判定しないように除外
    if (moods.indexOf('good') !== -1 && /できなかった|できてない|できていない/.test(text) && !/うれし|嬉し|楽し|よかった|良かった/.test(text)) {
      moods.splice(moods.indexOf('good'), 1);
    }
    var topics = Object.keys(REPLY_TOPICS).filter(function (k) { return findWords(text, REPLY_TOPICS[k].words).length; });
    if (topics.indexOf('exerciseSkip') !== -1 && topics.indexOf('exerciseDone') !== -1) topics.splice(topics.indexOf('exerciseDone'), 1);
    return {
      moods: moods,
      topics: topics,
      crisis: findWords(text, CRISIS_WORDS),
      symptoms: findWords(text, SYMPTOM_WORDS)
    };
  }

  // 気持ちの優先順位（いちばん寄り添いが必要なものから）
  var MOOD_PRIORITY = ['guilty', 'down', 'anxious', 'impatient', 'tired', 'good'];

  /**
   * 読み取った内容から返事の案を作ります。
   * @param {object} client
   * @param {object} a  analyzeReply の結果（コーチが選び直したもの）
   * @param {object} opts { variant, emoji }
   */
  function buildReply(client, a, opts) {
    opts = opts || {};
    var r = rng(hash([client.id || 'c', 'reply', (a.moods || []).join(), (a.topics || []).join(), opts.variant || 0].join('|')));
    var toneId = D.TONES[client.tone] ? client.tone : 'gentle';
    var vars = { name: E.displayName(client) };
    var emoji = opts.emoji === undefined ? 1 : opts.emoji;
    var parts = [];
    parts.push(vars.name + '、' + (toneId === 'polite' ? 'ご返信ありがとうございます。' : 'お返事ありがとうございます。') +
      (emoji ? pick(r, D.TONES[toneId].emoji) : ''));

    // 命や体調に関わる内容は、ダイエットの話より先に
    if (a.crisis && a.crisis.length) {
      parts.push(fill(SAFETY_MESSAGES.crisis, vars).split('\n\n').slice(1).join('\n\n'));
      if (client.coach) parts.push(client.coach);
      return parts.join('\n\n');
    }
    if (a.symptoms && a.symptoms.length) {
      parts.push(fill(SAFETY_MESSAGES.symptom, vars).split('\n\n').slice(1).join('\n\n'));
      if (client.coach) parts.push(client.coach);
      return parts.join('\n\n');
    }

    var mood = MOOD_PRIORITY.filter(function (m) { return (a.moods || []).indexOf(m) !== -1; })[0];
    if (mood && D.MOOD_EMPATHY[mood]) parts.push(fill(pick(r, D.MOOD_EMPATHY[mood]), vars));

    var topics = (a.topics || []).slice(0, 3);
    var lines = topics.map(function (t) {
      var src = mood === 'guilty' && REPLY_TOPICS[t].alt ? REPLY_TOPICS[t].alt : REPLY_TOPICS[t].lines;
      return fill(pick(r, src), vars);
    });
    // 体重が減った報告には数字を添える
    if (topics.indexOf('weightDown') !== -1) {
      var p = E.progressState(client);
      if (p.lost !== null && p.lost > 0) lines.unshift('スタートから' + p.lost + 'kgの変化ですね。');
    }
    if (lines.length) parts.push(lines.join('\n'));
    if (!mood && !lines.length) {
      parts.push('いつも様子を教えてくださって、本当にうれしいです。こうしてやり取りを続けてくださること自体が、{name}の大きな力になっていますよ。'.replace('{name}', vars.name));
    }

    var follow = topics.map(function (t) { return REPLY_FOLLOWUPS[t]; }).filter(Boolean)[0];
    if (follow) parts.push(follow);
    if (mood && ['guilty', 'down', 'anxious', 'tired'].indexOf(mood) !== -1) {
      parts.push(pick(r, D.LIGHT_REPLY));
    } else {
      parts.push(fill(pick(r, D.TONES[toneId].closings), vars));
    }
    if (client.coach) parts.push(client.coach);
    return parts.join('\n\n');
  }

  // ------------------------------------------------------------------
  // 週の振り返り
  // ------------------------------------------------------------------
  function weeklyStats(client, endDate) {
    var end = endDate || today();
    var start = addDays(end, -6);
    var logs = allLogs(client);
    var inWeek = logs.filter(function (l) { return l.date >= start && l.date <= end; });
    var before = logs.filter(function (l) { return l.date < start; });
    function series(key) {
      return inWeek.filter(function (l) { return num(l[key]) !== null; }).map(function (l) { return num(l[key]); });
    }
    function lastBefore(key) {
      var b = before.filter(function (l) { return num(l[key]) !== null; });
      return b.length ? num(b[b.length - 1][key]) : null;
    }
    function change(key) {
      var s = series(key);
      if (!s.length) return null;
      var prev = lastBefore(key);
      var from = prev !== null ? prev : s[0];
      if (prev === null && s.length < 2) return null;
      return { from: from, to: s[s.length - 1], diff: round1(s[s.length - 1] - from) };
    }
    var sleep = series('sleep');
    var steps = series('steps');
    var moods = {};
    inWeek.forEach(function (l) { if (l.mood) moods[l.mood] = (moods[l.mood] || 0) + 1; });
    var total = E.clampDays(client.totalDays);
    var sd = E.parseDate(client.startDate);
    var day = sd ? Math.round((E.parseDate(end) - sd) / 86400000) + 1 : null;
    var dayInProgram = day ? Math.min(Math.max(day, 1), total) : null;
    return {
      start: start,
      end: end,
      recordDays: inWeek.length,
      weight: change('weight'),
      waist: change('waist'),
      sleepAvg: sleep.length ? round1(avg(sleep)) : null,
      stepsAvg: steps.length ? Math.round(avg(steps)) : null,
      moods: moods,
      day: dayInProgram,
      week: dayInProgram ? Math.ceil(dayInProgram / 7) : null,
      phase: dayInProgram ? E.phaseForDay(E.buildPlan(total), dayInProgram).name : null
    };
  }

  function weeklyReport(client, endDate, opts) {
    opts = opts || {};
    var st = weeklyStats(client, endDate);
    var r = rng(hash([client.id || 'c', 'weekly', st.end, opts.variant || 0].join('|')));
    var emoji = opts.emoji === undefined ? 1 : opts.emoji;
    var toneId = D.TONES[client.tone] ? client.tone : 'gentle';
    var name = E.displayName(client);
    var mk = function (e, fallback) { return emoji ? e : fallback; };
    var parts = [];

    var head = name + '、1週間お疲れさまでした。';
    if (st.week) head += '\nプログラム' + st.week + '週目（' + st.phase + '）の振り返りをお送りします。';
    else head += '\n今週の振り返りをお送りします。';
    parts.push(head + (emoji ? pick(r, D.TONES[toneId].emoji) : ''));

    // 今週の記録
    var rec = [];
    rec.push('記録した日：' + st.recordDays + '日');
    if (st.weight) rec.push('体重：' + st.weight.from + 'kg → ' + st.weight.to + 'kg（' + signed(st.weight.diff, 'kg') + '）');
    if (st.waist) rec.push('ウエスト：' + st.waist.from + 'cm → ' + st.waist.to + 'cm（' + signed(st.waist.diff, 'cm') + '）');
    if (st.sleepAvg !== null) rec.push('平均睡眠時間：' + st.sleepAvg + '時間');
    if (st.stepsAvg !== null) rec.push('平均歩数：' + st.stepsAvg.toLocaleString('ja-JP') + '歩');
    parts.push(mk('📊', '■') + '今週の記録\n' + rec.map(function (x) { return '・' + x; }).join('\n'));

    // よかったこと
    var good = [];
    if (st.recordDays >= 5) good.push('7日のうち' + st.recordDays + '日も記録を続けられました。続けること自体が、いちばんの力です。');
    else if (st.recordDays >= 1) good.push('忙しい中でも記録を送ってくださいました。その一つひとつが、作戦を立てる大切な手がかりになっています。');
    if (st.weight && st.weight.diff <= -0.2) good.push('体重が' + Math.abs(st.weight.diff) + 'kg減りました。丁寧に過ごした1週間の結果ですね。');
    if (st.waist && st.waist.diff < 0) good.push('ウエストが' + Math.abs(st.waist.diff) + 'cm細くなりました。体重以上に、見た目の変化として表れています。');
    if (st.sleepAvg !== null && st.sleepAvg >= 7) good.push('平均' + st.sleepAvg + '時間の睡眠がとれていました。体を整える土台がしっかりできています。');
    if (st.stepsAvg !== null && st.stepsAvg >= 8000) good.push('1日平均' + st.stepsAvg.toLocaleString('ja-JP') + '歩、よく動けていました。');
    if (st.moods.good) good.push('「気分がよい」と感じた日が' + st.moods.good + '日ありました。');
    if (!good.length) good.push('思うようにいかないことがあったとしても、こうして1週間を過ごし、振り返りを読んでくれていること自体が大切な一歩です。');
    parts.push(mk('🌱', '■') + '今週のよかったこと\n' + good.join('\n'));

    // 体重への言葉
    if (st.weight) {
      var w;
      if (st.weight.diff <= -0.2) w = 'この調子で、焦らず今のペースを大切にしていきましょう。';
      else if (st.weight.diff < 0.3) w = '体重はほぼ横ばいでした。数字が動かない週も、体の中では変化が進んでいます。続けていることに大きな意味がありますよ。';
      else w = '体重は少し増えましたが、水分や塩分、生理周期などでも上下するものです。増えた分がすべて脂肪というわけではないので、来週の流れで一緒に見ていきましょう。';
      parts.push(mk('💬', '■') + '体重について\n' + w);
    }

    // 来週の小さな目標（2つまで）
    var goals = [];
    if (st.recordDays < 4) goals.push('体重を週4日以上測って記録する（朝のトイレの後がおすすめです）');
    if (st.sleepAvg !== null && st.sleepAvg < 6) goals.push('いつもより15分早く布団に入る');
    if (st.stepsAvg !== null && st.stepsAvg < 8000) goals.push('1日の歩数を今より1,000歩増やす');
    if (st.weight && st.weight.diff >= 0.3) goals.push('汁物は具だくさんにして、塩分を少し控えめにする');
    (client.concerns || []).forEach(function (c) {
      var t = D.TIPS.filter(function (x) { return x.tags.indexOf(c) !== -1; })[0];
      if (t) goals.push(t.title);
    });
    if (st.day) {
      var ph = D.PHASES[E.phaseForDay(E.buildPlan(client.totalDays), st.day).id];
      goals.push(ph.diet[0]);
    }
    goals.push('毎食たんぱく質のおかずを1品入れる');
    var uniq = goals.filter(function (g, i) { return goals.indexOf(g) === i; }).slice(0, 2);
    parts.push(mk('🎯', '■') + '来週の小さな目標\n' + uniq.map(function (g) { return '・' + g; }).join('\n') +
      '\n全部でなくて大丈夫です。できそうな方から試してみてくださいね。');

    parts.push('来週、特に気をつけたいことや、予定があれば教えてください。一緒に作戦を立てましょう。');
    parts.push(fill(pick(r, D.TONES[toneId].closings), { name: name }));
    if (client.coach) parts.push(client.coach);
    return { stats: st, text: parts.join('\n\n') };
  }

  // ------------------------------------------------------------------
  // 食事の組み合わせ例（カロリーの数字は載せず、選び方の例にとどめる）
  // ------------------------------------------------------------------
  var MEAL_TIMES = { breakfast: '朝食', lunch: '昼食', dinner: '夕食', snack: '間食' };
  var MEAL_STYLES = { home: '自炊', conveni: 'コンビニ', eatout: '外食' };

  var MEALS = [
    { time: 'breakfast', style: 'home', name: '和定食の朝ごはん', items: 'ご飯（いつもより少なめ）、納豆、具だくさん味噌汁、卵焼き', point: '納豆と卵でたんぱく質がしっかりとれます。味噌汁の具を増やすと満足感が上がります。' },
    { time: 'breakfast', style: 'home', name: '時間がない日の朝ごはん', items: 'バナナ、ヨーグルト、ゆで卵', point: '火を使わずに準備できます。ゆで卵は作り置きしておくと便利です。' },
    { time: 'breakfast', style: 'home', name: 'パン派の朝ごはん', items: '全粒粉パン、目玉焼き、サラダ、牛乳または豆乳', point: 'パンだけで済ませず、卵や乳製品を足すのがポイントです。' },
    { time: 'breakfast', style: 'conveni', name: 'コンビニで買う朝ごはん', items: 'おにぎり1個、ゆで卵、カップのスープまたは味噌汁', point: '主食にたんぱく質と汁物を足すと、昼まで持ちやすくなります。' },
    { time: 'breakfast', style: 'conveni', name: '軽めに済ませたい朝', items: 'ヨーグルト（無糖や甘さ控えめ）、バナナ、牛乳', point: '食欲がない朝も、何かひとつ口にすることから始めましょう。' },
    { time: 'lunch', style: 'home', name: 'お弁当', items: 'ご飯、鶏むね肉や魚のおかず、野菜のおかず2品', point: '作り置きのおかずを詰めるだけにすると、続けやすくなります。' },
    { time: 'lunch', style: 'home', name: '麺類の日', items: 'そば、温泉卵、わかめ、ねぎ、小鉢の野菜', point: '麺だけにせず、卵や野菜をトッピングしてバランスをとります。' },
    { time: 'lunch', style: 'conveni', name: 'コンビニの定食風', items: 'おにぎり1〜2個、サラダチキン、カット野菜やサラダ', point: '「主食＋たんぱく質＋野菜」の3つをそろえるのが基本です。' },
    { time: 'lunch', style: 'conveni', name: '温かいものが欲しい日', items: 'おにぎり、具だくさんのスープ（豚汁など）、ゆで卵', point: '具の多い汁物は、野菜とたんぱく質を一度にとれます。' },
    { time: 'lunch', style: 'eatout', name: '定食屋さん', items: '焼き魚定食や生姜焼き定食（ご飯は少なめでお願いする）', point: '主菜・副菜・汁物がそろう定食は、バランスをとりやすい選択です。' },
    { time: 'lunch', style: 'eatout', name: 'そば・うどん屋さん', items: '山菜そばや月見うどん＋小鉢（おひたしなど）', point: '天ぷらやかつ丼とのセットより、卵や小鉢を足すのがおすすめです。' },
    { time: 'lunch', style: 'eatout', name: '牛丼・丼もの屋さん', items: '並盛りまたはご飯少なめ＋サラダ＋味噌汁', point: '大盛りやセットの揚げ物は控えて、サラダと汁物を足しましょう。' },
    { time: 'dinner', style: 'home', name: '一汁二菜の夕食', items: 'ご飯（少なめ）、焼き魚、野菜の煮物やおひたし、具だくさん味噌汁', point: '主菜はたんぱく質、副菜で野菜をとる、昔ながらの組み合わせです。' },
    { time: 'dinner', style: 'home', name: '鍋の日', items: '鶏肉や豆腐、きのこ、白菜などの鍋、締めは少なめに', point: 'たんぱく質も野菜もたっぷりとれて、体も温まります。' },
    { time: 'dinner', style: 'home', name: '夕食が遅くなる日', items: '夕方におにぎり、夜は豆腐とスープ、野菜のおかず', point: '主食を夕方に先に食べておく「分食」で、夜を軽めにできます。' },
    { time: 'dinner', style: 'conveni', name: 'コンビニで買う夕食', items: '焼き魚や煮物のお惣菜、サラダ、おにぎり1個', point: '揚げ物より、焼く・煮る・蒸すおかずを選ぶのがコツです。' },
    { time: 'dinner', style: 'conveni', name: '遅い時間の軽い夕食', items: 'おでん（大根、卵、こんにゃく、厚揚げなど）', point: '温かく、たんぱく質と野菜がとれます。汁は少し残すと塩分を控えられます。' },
    { time: 'dinner', style: 'eatout', name: '居酒屋', items: '枝豆、冷奴、焼き鳥（塩）、刺身、サラダ', point: 'たんぱく質中心のおつまみを選び、お酒の合間にお水を飲みましょう。' },
    { time: 'dinner', style: 'eatout', name: 'ファミリーレストラン', items: 'グリルチキンや魚のメニュー＋サラダ＋スープ', point: 'セットのライスやパンは量を調整して、揚げ物より焼き物を選びます。' },
    { time: 'dinner', style: 'eatout', name: '焼肉', items: '野菜やスープから食べ始め、赤身の肉を中心に、ご飯は小さめ', point: 'ゆっくり焼いて食べるので、食べるペースを落としやすいお店です。' },
    { time: 'snack', style: 'home', name: '小腹がすいた時', items: 'ゆで卵、チーズ、素焼きのナッツ（ひとつかみ）', point: 'たんぱく質がとれるものを選ぶと、次の食事まで持ちやすくなります。' },
    { time: 'snack', style: 'home', name: '甘いものが欲しい時', items: 'ヨーグルトに果物を添えて', point: 'お皿に出して、ゆっくり味わうと満足感が違います。' },
    { time: 'snack', style: 'conveni', name: 'コンビニのおやつ', items: 'ヨーグルト、ゆで卵、小さめのナッツ、高カカオのチョコを少し', point: '個包装のものを選ぶと、量を決めやすくなります。' },
    { time: 'snack', style: 'conveni', name: '夜にお腹がすいた時', items: 'カップのスープや味噌汁、ホットミルク', point: '温かいものは、気持ちも落ち着かせてくれます。' }
  ];

  // 悩みに合わせて提案する食事のしぼり込み
  var MEAL_CONCERN_RULES = {
    skip: { time: 'breakfast' },
    busy: { style: 'conveni' },
    eatout: { style: 'eatout' },
    alcohol: { name: '居酒屋' },
    night: { name: '夕食が遅くなる日' },
    snack: { time: 'snack' },
    sweets: { name: '甘いものが欲しい時' },
    fastEat: { name: '焼肉' }
  };

  function mealProposal(client, opts) {
    opts = opts || {};
    var r = rng(hash([client.id || 'c', 'meal', opts.variant || 0].join('|')));
    var chosen = [];
    (client.concerns || []).forEach(function (c) {
      var rule = MEAL_CONCERN_RULES[c];
      if (!rule) return;
      var pool = MEALS.filter(function (m) {
        return (!rule.time || m.time === rule.time) && (!rule.style || m.style === rule.style) && (!rule.name || m.name === rule.name) &&
          chosen.indexOf(m) === -1;
      });
      if (pool.length) chosen.push(pick(r, pool));
    });
    ['breakfast', 'lunch', 'dinner'].forEach(function (t) {
      if (chosen.length >= 3) return;
      if (chosen.some(function (m) { return m.time === t; })) return;
      chosen.push(pick(r, MEALS.filter(function (m) { return m.time === t; })));
    });
    chosen = chosen.slice(0, 3);
    return { meals: chosen, text: mealText(client, chosen, opts) };
  }

  /** 選んだ食事例から、クライアントに送る提案文を作ります */
  function mealText(client, chosen, opts) {
    opts = opts || {};
    var emoji = opts.emoji === undefined ? 1 : opts.emoji;
    var name = E.displayName(client);
    var parts = [];
    parts.push(name + '、今の生活や気になっていることに合わせて、食事の組み合わせ例をまとめてみました。');
    chosen.forEach(function (m) {
      parts.push((emoji ? '🍽' : '■') + MEAL_TIMES[m.time] + '（' + MEAL_STYLES[m.style] + '）：' + m.name + '\n' + m.items + '\n' + m.point);
    });
    parts.push('全部を変えなくて大丈夫です。できそうなものをひとつ選んで、試してみてくださいね。食べてみた感想も、ぜひ聞かせてください。');
    if (client.coach) parts.push(client.coach);
    return parts.join('\n\n');
  }

  // ------------------------------------------------------------------
  // 初回カウンセリング
  // ------------------------------------------------------------------
  var COUNSELING = [
    {
      group: '目的とゴール', items: [
        { id: 'purpose', label: 'このダイエットで叶えたいこと', type: 'text', placeholder: '例：来年の結婚式でドレスを着たい', ask: 'このダイエットで、いちばん叶えたいことは何ですか？' },
        { id: 'trigger', label: '今始めようと思ったきっかけ', type: 'text', ask: '今、始めようと思ったきっかけを教えてください。' },
        { id: 'afterGoal', label: '目標を達成したらしたいこと', type: 'text', ask: '目標を達成したら、どんなことをしてみたいですか？' }
      ]
    },
    {
      group: '生活のリズム', items: [
        { id: 'lifestyle', label: '仕事・生活のスタイル', type: 'select', options: ['', 'デスクワーク中心', '立ち仕事・外回りが多い', '在宅勤務', '家事・育児が中心', '夜勤・シフト勤務あり', 'その他'], ask: 'お仕事や毎日の過ごし方を教えてください（デスクワーク、立ち仕事、家事・育児など）。' },
        { id: 'wake', label: '起きる時間', type: 'time', ask: '' },
        { id: 'bed', label: '寝る時間', type: 'time', ask: 'ふだんの起きる時間と寝る時間を教えてください。' },
        { id: 'sleepQuality', label: '睡眠の満足度', type: 'select', options: ['', 'よく眠れている', 'ふつう', 'あまり眠れていない'], ask: '' }
      ]
    },
    {
      group: '食事', items: [
        { id: 'breakfast', label: '朝食', type: 'select', options: ['', '毎日食べる', '時々食べる', 'ほとんど食べない'], ask: '朝ごはんは食べていますか？' },
        { id: 'snack', label: '間食', type: 'select', options: ['', 'ほぼ毎日', '週に数回', 'ほとんどしない'], ask: '間食はどのくらいしますか？' },
        { id: 'sweets', label: '甘いものが好き', type: 'select', options: ['', 'とても好き', 'ふつう', 'あまり食べない'], ask: '' },
        { id: 'alcohol', label: 'お酒', type: 'select', options: ['', 'ほぼ毎日', '週に数回', 'たまに', '飲まない'], ask: 'お酒はどのくらい飲みますか？' },
        { id: 'eatout', label: '外食・コンビニ', type: 'select', options: ['', 'ほぼ毎日', '週に数回', '少ない'], ask: '外食やコンビニの食事はどのくらいですか？' },
        { id: 'dinnerTime', label: '夕食の時間', type: 'select', options: ['', '19時ごろまで', '19〜21時', '21時以降が多い'], ask: '夕食はだいたい何時ごろですか？' },
        { id: 'eatSpeed', label: '食べるスピード', type: 'select', options: ['', '早い', 'ふつう', 'ゆっくり'], ask: '' },
        { id: 'likes', label: '好きな食べ物', type: 'text', ask: '好きな食べ物を教えてください。無理にやめる必要はありません。' }
      ]
    },
    {
      group: '運動', items: [
        { id: 'exercise', label: '運動経験', type: 'select', options: ['', 'ほとんどしていない', 'たまにする', '定期的にしている'], ask: '今、運動はしていますか？' },
        { id: 'places', label: '運動できる場所', type: 'checks', options: ['自宅', 'ジム', '屋外'], ask: '運動できる場所はどこですか（自宅、ジム、屋外）？' }
      ]
    },
    {
      group: 'これまでのこと・体のこと', items: [
        { id: 'pastDiet', label: '過去のダイエット経験', type: 'textarea', ask: 'これまでにダイエットをしたことはありますか？うまくいったこと、難しかったことも教えてください。' },
        { id: 'rebound', label: 'リバウンドの経験', type: 'select', options: ['', 'ある', 'ない'], ask: '' },
        { id: 'medical', label: '持病・服薬・通院中のこと', type: 'textarea', placeholder: 'なければ「なし」', ask: '持病やお薬、通院中のことがあれば教えてください。' },
        { id: 'pregnant', label: '妊娠中・授乳中', type: 'select', options: ['', 'no', 'yes'], optionLabels: ['', 'いいえ', 'はい'], ask: '' }
      ]
    },
    {
      group: '気持ちとサポート', items: [
        { id: 'worries', label: '不安なこと・心配なこと', type: 'textarea', ask: '始めるにあたって、不安なことや心配なことはありますか？' },
        { id: 'support', label: '応援してくれる人', type: 'text', ask: '' },
        { id: 'tonePref', label: '声かけの好み', type: 'select', options: ['', 'gentle', 'genki', 'polite'], optionLabels: ['', 'やさしく寄り添ってほしい', '明るく元気に励ましてほしい', '丁寧で落ち着いた連絡がよい'], ask: 'メッセージは、どんな雰囲気だとうれしいですか（やさしく、元気に、丁寧に）？' },
        { id: 'contact', label: '連絡の希望（時間帯・頻度・LINEかメールか）', type: 'text', ask: '連絡はLINEとメールのどちらがよいですか？送ってほしい時間帯もあれば教えてください。' }
      ]
    }
  ];

  /** カウンセリングの回答から、プロフィールに反映する内容を作ります（元のデータは変更しません） */
  function counselingPatch(client, ans) {
    ans = ans || {};
    var patch = {};
    var notes = [];
    if (ans.purpose && String(ans.purpose).trim()) { patch.goalNote = String(ans.purpose).trim(); notes.push('ダイエットの目的'); }
    var lv = { 'ほとんどしていない': 1, 'たまにする': 2, '定期的にしている': 3 }[ans.exercise];
    if (lv) { patch.level = lv; notes.push('運動経験'); }
    var placeMap = { '自宅': 'home', 'ジム': 'gym', '屋外': 'outdoor' };
    if (Array.isArray(ans.places) && ans.places.length) {
      patch.places = ans.places.map(function (p) { return placeMap[p]; }).filter(Boolean);
      notes.push('運動できる場所');
    }
    if (ans.tonePref && D.TONES[ans.tonePref]) { patch.tone = ans.tonePref; notes.push('声かけのトーン'); }
    var act = { 'デスクワーク中心': 'low', '在宅勤務': 'low', '立ち仕事・外回りが多い': 'light', '家事・育児が中心': 'light' }[ans.lifestyle];
    if (act) { patch.activity = act; notes.push('活動量'); }

    var add = [];
    if (ans.breakfast === 'ほとんど食べない' || ans.breakfast === '時々食べる') add.push('skip');
    if (ans.snack === 'ほぼ毎日') add.push('snack');
    if (ans.sweets === 'とても好き') add.push('sweets');
    if (ans.alcohol === 'ほぼ毎日' || ans.alcohol === '週に数回') add.push('alcohol');
    if (ans.eatout === 'ほぼ毎日' || ans.eatout === '週に数回') add.push('eatout');
    if (ans.dinnerTime === '21時以降が多い') add.push('night');
    if (ans.eatSpeed === '早い') add.push('fastEat');
    if (ans.rebound === 'ある') add.push('rebound');
    if (ans.sleepQuality === 'あまり眠れていない') add.push('sleep');
    if (ans.lifestyle === '夜勤・シフト勤務あり' || ans.lifestyle === '家事・育児が中心') add.push('busy');
    if (lv === 1) add.push('noexercise');
    if (add.length) {
      var cur = (client.concerns || []).slice();
      add.forEach(function (c) { if (cur.indexOf(c) === -1) cur.push(c); });
      patch.concerns = cur;
      notes.push('気になっていること（' + add.length + '項目）');
    }
    return { patch: patch, notes: notes };
  }

  function optionLabel(item, v) {
    if (!item.optionLabels) return v;
    var i = item.options.indexOf(v);
    return i === -1 ? v : item.optionLabels[i];
  }

  /** コーチ用のまとめ */
  function counselingSummary(client, ans) {
    ans = ans || {};
    var lines = ['【初回カウンセリング】' + E.displayName(client)];
    COUNSELING.forEach(function (g) {
      var rows = g.items.map(function (it) {
        var v = ans[it.id];
        if (Array.isArray(v)) v = v.join('、');
        v = optionLabel(it, v);
        return v ? '・' + it.label + '：' + v : null;
      }).filter(Boolean);
      if (rows.length) lines.push('\n■' + g.group + '\n' + rows.join('\n'));
    });
    if (lines.length === 1) lines.push('まだ回答が入力されていません。');
    return lines.join('\n');
  }

  /** 事前に送る質問メッセージ */
  function counselingMessage(client, opts) {
    opts = opts || {};
    var emoji = opts.emoji === undefined ? 1 : opts.emoji;
    var name = E.displayName(client);
    var qs = [];
    COUNSELING.forEach(function (g) { g.items.forEach(function (it) { if (it.ask) qs.push(it.ask); }); });
    var parts = [];
    parts.push(name + '、このたびはお申し込みいただき、本当にありがとうございます。' + (emoji ? '🌿' : ''));
    parts.push(name + 'に合ったプランを一緒に作っていくために、いくつか教えていただきたいことがあります。答えられるものだけで大丈夫です。一言ずつでも、まったく問題ありません。');
    parts.push(qs.map(function (q, i) { return (i + 1) + '. ' + q; }).join('\n'));
    parts.push('お返事をもとに、' + name + 'のペースに合わせたプランを考えていきます。ここで教えていただいた内容は、サポートのためだけに使います。\nこれからどうぞよろしくお願いします。');
    if (client.coach) parts.push(client.coach);
    return parts.join('\n\n');
  }

  // ------------------------------------------------------------------
  // サンプルデータ（動作確認用の架空のクライアント）
  // ------------------------------------------------------------------
  function sampleClient(todayStr) {
    var t = todayStr || today();
    var start = addDays(t, -24);
    var c = {
      id: 'sample-client', name: 'サンプル 花子', honorific: 'さん', gender: 'female', age: 38, height: 158, activity: 'low',
      startWeight: 63, goalWeight: 57, startDate: start, totalDays: 90, goalNote: '来年の旅行で好きな服を着たい',
      tone: 'gentle', level: 1, places: ['home', 'outdoor'], coach: 'トレーナー 佐藤（サンプル）',
      concerns: ['snack', 'night', 'busy'], memo: 'これは動作確認用のサンプルです。', logs: [], history: [], mood: 'anxious',
      counseling: { purpose: '来年の旅行で好きな服を着たい', lifestyle: 'デスクワーク中心', breakfast: '時々食べる', snack: 'ほぼ毎日', dinnerTime: '21時以降が多い', exercise: 'ほとんどしていない', places: ['自宅', '屋外'], medical: 'なし', worries: '仕事が忙しく続けられるか不安' }
    };
    // 最初は順調に減り、ここ2週間ほどは横ばい（停滞期）になる記録
    var weights = [63, 62.7, 62.4, 62.2, 61.9, 61.8, 61.6, 61.7, 61.6, 61.5, 61.6, 61.5, 61.6];
    weights.forEach(function (w, i) {
      var d = addDays(start, i * 2);
      if (d > t) return;
      var log = { date: d, weight: w, sleep: i > 9 ? 5.5 : 6.5, steps: 4000 + i * 300 };
      if (i % 4 === 0) log.waist = round1(80 - i * 0.3);
      if (i >= 10) log.mood = 'anxious';
      c.logs.push(log);
    });
    return c;
  }

  return {
    sampleClient: sampleClient,
    LOG_MOODS: LOG_MOODS,
    allLogs: allLogs,
    safetyAlerts: safetyAlerts,
    SAFETY_MESSAGES: SAFETY_MESSAGES,
    REPLY_TOPICS: REPLY_TOPICS,
    MOOD_PRIORITY: MOOD_PRIORITY,
    analyzeReply: analyzeReply,
    buildReply: buildReply,
    weeklyStats: weeklyStats,
    weeklyReport: weeklyReport,
    MEAL_TIMES: MEAL_TIMES,
    MEAL_STYLES: MEAL_STYLES,
    MEALS: MEALS,
    mealProposal: mealProposal,
    mealText: mealText,
    COUNSELING: COUNSELING,
    counselingPatch: counselingPatch,
    counselingSummary: counselingSummary,
    counselingMessage: counselingMessage,
    optionLabel: optionLabel,
    fillName: function (client, text) { return fill(text, { name: E.displayName(client) }); }
  };
});
