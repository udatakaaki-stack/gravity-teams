/*
 * トレーニングサポートプログラム：追加機能
 *   返信アシスト / 初回カウンセリング / 食事・補食の例 / サンプルデータ
 */
(function (root, factory) {
  'use strict';
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory(require('./t-data.js'), require('./t-content.js'), require('./t-engine.js'));
  } else {
    root.TrainFeatures = factory(root.TRAIN_DATA, root.TRAIN_CONTENT, root.TrainEngine);
  }
})(typeof window !== 'undefined' ? window : this, function (D, C, E) {
  'use strict';

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
  function pick(r, l) { return l && l.length ? l[Math.floor(r() * l.length)] : ''; }
  function fill(t, v) { return String(t).replace(/\{(\w+)\}/g, function (m, k) { return Object.prototype.hasOwnProperty.call(v, k) ? v[k] : m; }); }
  function has(text, words) { return words.filter(function (w) { return text.indexOf(w) !== -1; }); }

  // ------------------------------------------------------------------
  // 返信アシスト
  // ------------------------------------------------------------------
  var URGENT_WORDS = ['頭を打', '脳しんとう', '脳震盪', '胸の痛み', '胸が痛', '動悸', '息苦し', '失神', '気を失', 'しびれ', '骨折', '激痛'];
  var CRISIS_WORDS = ['死にたい', '消えたい', '生きていたくな', 'いなくなりたい'];

  var REPLY_STATES = {
    frustrated: ['悔し', '伸びな', '上がらな', '勝てな', 'うまくいかな', 'ダメだ', 'だめだ'],
    anxious: ['不安', '緊張', '怖い', 'こわい', '心配', '自信がな'],
    tired: ['疲れ', 'だるい', 'しんどい', 'ヘトヘト', 'へとへと', 'きつかった'],
    injured: ['痛い', '痛み', '違和感', 'けが', '怪我', '捻挫', '肉離れ'],
    lowMotivation: ['やる気', '行きたくな', 'やめたい', '辞めたい', '楽しくな'],
    good: ['うれしい', '嬉しい', '楽しかった', '調子がいい', '調子いい', 'よかった', '良かった', '最高', '更新']
  };
  var STATE_PRIORITY = ['injured', 'frustrated', 'anxious', 'lowMotivation', 'tired', 'good'];

  var REPLY_TOPICS = {
    pain: { label: '痛み・けが', words: ['痛い', '痛み', '違和感', 'けが', '怪我', '捻挫', '肉離れ', '腫れ'], line: '痛みや違和感がある部位を使う練習は、いったんお休みしましょう。鋭い痛み、腫れ、しびれがある時や、痛みが続く時は、早めに医療機関で診てもらってください。痛みのない範囲でできる練習を一緒に考えます。', follow: 'どこが、どんな時に痛みますか？いつ頃からかも教えてください。' },
    fatigue: { label: '疲れ', words: ['疲れ', 'だるい', 'しんどい', 'ヘトヘト', 'へとへと'], line: '疲れがたまっている時は、練習の量を減らして回復を優先しましょう。休むことも、強くなるための大切なトレーニングです。', follow: '最近の睡眠時間はどのくらいですか？' },
    pr: { label: '記録更新', words: ['自己ベスト', 'ベスト更新', '記録更新', '新記録', '上がった', '更新'], line: '自己ベストの更新、本当におめでとうございます！毎日の地道な積み重ねが、しっかり形になりましたね。', follow: '今回うまくいった理由は、何だったと思いますか？' },
    slump: { label: '伸び悩み', words: ['伸びな', '上がらな', '停滞', 'スランプ', '変わらな'], line: '伸び悩みは、体が今の練習に慣れてきた時や、疲れがたまっている時によく起こります。練習内容に変化をつけたり、一度量を減らして疲れを抜いたりすると、また伸び始めることがよくあります。', follow: '最近の練習の中で、きついと感じているところはどこですか？' },
    gameWin: { label: '試合（よい結果）', words: ['勝った', '勝てた', '優勝', '入賞', '自己新', '突破'], line: '試合での結果、本当におめでとうございます！ここまでの努力が実を結びましたね。今日はしっかり喜んで、体をゆっくり休めてください。', follow: '試合で、いちばんうまくいったと思う場面を教えてください。' },
    gameLose: { label: '試合（悔しい結果）', words: ['負けた', '負けて', '勝てなかった', '予選落ち', '敗退', 'ミスした'], line: '悔しい気持ちがあるのは、それだけ本気で向き合ってきたからです。まずは、ここまで頑張ってきた自分をねぎらってください。振り返りは、気持ちが落ち着いてから一緒にしましょう。', follow: '' },
    nerves: { label: '試合前の緊張', words: ['緊張', '本番', '試合前', 'プレッシャー'], line: '緊張するのは、それだけ本気で取り組んできた証拠です。試合前にいつも行う準備の流れを決めておいたり、ゆっくり息を吐く呼吸をしたりすると、落ち着きを取り戻しやすくなります。', follow: '緊張した時、自分を落ち着かせるためにしていることはありますか？' },
    sleep: { label: '睡眠', words: ['眠れ', '寝不足', '睡眠', '寝れな', '夜更かし'], line: '睡眠は回復の土台です。睡眠が足りない日は、練習の強度を少し控えめにして、早めに休むことを優先しましょう。', follow: '寝る時間はだいたい何時ごろになっていますか？' },
    soreness: { label: '筋肉痛', words: ['筋肉痛'], line: '筋肉痛が強い時は、同じ部位の高い負荷は避けて、軽い運動やストレッチで回復を促しましょう。関節の痛みや腫れがある時は、筋肉痛とは違う可能性があるので教えてください。', follow: '' },
    absence: { label: '欠席・遅刻', words: ['休みます', '欠席', '遅刻', '行けません', '参加できな'], line: '連絡ありがとうございます。了解しました。無理をせず、用事や体調を優先してください。', follow: '' },
    form: { label: 'フォーム', words: ['フォーム', '動き方', 'やり方が'], line: 'フォームが気になる時は、一度重さを下げて、正しい動きを確認するところから始めましょう。動画で撮影して見比べるのもおすすめです。', follow: 'よかったら、動画を送ってもらえますか？一緒に確認しましょう。' },
    eat: { label: '食事', words: ['食べられな', '食欲', '食事', '体重が増えな', '体重が減'], line: '練習を頑張っている時ほど、食事は体をつくる大切な材料になります。1回の量を増やすのが難しければ、補食を含めて食べる回数を増やす方法もありますよ。', follow: '練習の後は、何か食べられていますか？' }
  };

  function analyzeReply(text) {
    text = String(text || '');
    var states = STATE_PRIORITY.filter(function (k) { return has(text, REPLY_STATES[k]).length; });
    if (states.indexOf('good') !== -1 && /できなかった|負けた|悔し/.test(text) && !/うれし|嬉し|楽しかった/.test(text)) states.splice(states.indexOf('good'), 1);
    var topics = Object.keys(REPLY_TOPICS).filter(function (k) { return has(text, REPLY_TOPICS[k].words).length; });
    if (topics.indexOf('gameLose') !== -1 && topics.indexOf('gameWin') !== -1) topics.splice(topics.indexOf('gameWin'), 1);
    if (topics.indexOf('slump') !== -1 && topics.indexOf('pr') !== -1) topics.splice(topics.indexOf('pr'), 1);
    return { states: states, topics: topics, urgent: has(text, URGENT_WORDS), crisis: has(text, CRISIS_WORDS) };
  }

  function buildReply(member, teams, a, opts) {
    opts = opts || {};
    var s = E.planSettings(member, teams);
    var name = E.displayName(member);
    var toneId = D.TONES[s.tone] ? s.tone : 'gentle';
    var r = rng(hash([member.id || 'm', 'reply', (a.states || []).join(), (a.topics || []).join(), opts.variant || 0].join('|')));
    var emoji = opts.emoji === undefined ? 1 : opts.emoji;
    var parts = [name + '、' + (toneId === 'polite' ? 'ご連絡ありがとうございます。' : '連絡ありがとうございます。') + (emoji ? pick(r, D.TONES[toneId].emoji) : '')];
    if (a.crisis && a.crisis.length) {
      parts.push('とてもつらい気持ちを話してくれて、本当にありがとうございます。今は、練習のことより' + name + '自身のことがいちばん大切です。\n\nどうかひとりで抱えずに、家族や信頼できる人、専門の相談窓口にも話してみてください。私も、いつでも話を聴きます。');
    } else if (a.urgent && a.urgent.length) {
      var head = a.urgent.some(function (w) { return /頭を打|脳/.test(w); });
      parts.push(head
        ? '頭を打ったと聞いて、とても心配しています。頭痛、めまい、吐き気、ぼんやりするなどの症状がある時は、今日の練習には戻らず、必ず医療機関で診てもらってください。症状がなくても、今日は無理をせず安静に過ごしましょう。'
        : '体のことを教えてくれてありがとうございます。とても心配しています。すぐに練習を中止して、安静にしてください。症状が強い時や続く時は、早めに医療機関を受診してください。');
    } else {
      var st = STATE_PRIORITY.filter(function (k) { return (a.states || []).indexOf(k) !== -1; })[0];
      if (st && C.STATE_EMPATHY[st]) parts.push(fill(pick(r, C.STATE_EMPATHY[st]), { name: name }));
      var topics = (a.topics || []).slice(0, 3);
      var lines = topics.map(function (t) { return REPLY_TOPICS[t].line; });
      if (lines.length) parts.push(lines.join('\n'));
      if (!st && !lines.length) parts.push('いつも様子を教えてくれて、本当にうれしいです。こうしてやり取りを続けられること自体が、' + name + 'の大きな力になっていますよ。');
      var follow = topics.map(function (t) { return REPLY_TOPICS[t].follow; }).filter(Boolean)[0];
      if (follow) parts.push(follow);
      var negative = ['injured', 'frustrated', 'anxious', 'lowMotivation', 'tired'].indexOf(st) !== -1;
      parts.push(negative ? pick(r, C.LIGHT_REPLY) : fill(pick(r, D.TONES[toneId].closings), { name: name }));
    }
    if (s.coach) parts.push(s.coach);
    return parts.join('\n\n');
  }

  // ------------------------------------------------------------------
  // 初回カウンセリング（選手向け）
  // ------------------------------------------------------------------
  var COUNSELING = [
    { group: '競技と目標', items: [
      { id: 'sport', label: '競技・ポジション', type: 'text', ask: '取り組んでいる競技とポジション（種目）を教えてください。' },
      { id: 'career', label: '競技歴', type: 'text', placeholder: '例：中学から5年', ask: '競技歴はどのくらいですか？' },
      { id: 'goalLong', label: '最終的な目標', type: 'text', placeholder: '例：インターハイ出場', ask: 'いちばん叶えたい目標は何ですか？' },
      { id: 'goalShort', label: '3か月以内の目標', type: 'text', ask: '3か月以内に達成したい目標はありますか？' },
      { id: 'event', label: '大事な試合の予定', type: 'text', placeholder: '例：12月の県大会', ask: '大事な試合の予定があれば教えてください。' }
    ] },
    { group: '練習の状況', items: [
      { id: 'frequency', label: '練習の頻度・時間', type: 'text', placeholder: '例：週5回・2時間', ask: '今の練習の頻度と時間を教えてください。' },
      { id: 'strengthExp', label: '筋力トレーニングの経験', type: 'select', options: ['', 'ほとんどない', '少しある（1年未満）', '1年以上続けている'], ask: '筋力トレーニングの経験はありますか？' },
      { id: 'places', label: 'トレーニングできる場所', type: 'checks', options: ['ジム・トレーニング室', '自宅', 'グラウンド・体育館'], ask: 'トレーニングできる場所はどこですか？' },
      { id: 'records', label: '今の記録（分かる範囲で）', type: 'textarea', placeholder: '例：スクワット80kg×5回、100m 12秒0', ask: '今の記録が分かれば教えてください（スクワットの重さ、タイムなど）。' }
    ] },
    { group: '体のこと', items: [
      { id: 'injuries', label: 'これまでのけが', type: 'textarea', placeholder: '部位・時期・今の状態', ask: 'これまでに大きなけがをしたことはありますか？部位と時期、今の状態を教えてください。' },
      { id: 'painNow', label: '今、痛みや違和感があるところ', type: 'text', placeholder: 'なければ「なし」', ask: '今、痛みや違和感があるところはありますか？' },
      { id: 'medical', label: '持病・服薬・医師からの指示', type: 'textarea', placeholder: 'なければ「なし」', ask: '持病やお薬、医師から運動について言われていることがあれば教えてください。' },
      { id: 'sleepHours', label: 'ふだんの睡眠時間', type: 'select', options: ['', '6時間未満', '6〜7時間', '7〜8時間', '8時間以上'], ask: 'ふだんの睡眠時間はどのくらいですか？' },
      { id: 'breakfast', label: '朝食', type: 'select', options: ['', '毎日食べる', '時々食べる', 'ほとんど食べない'], ask: '朝ごはんは食べていますか？' },
      { id: 'afterMeal', label: '練習後の補食', type: 'select', options: ['', 'いつも食べる', '時々', 'ほとんど食べない'], ask: '練習の後に、何か食べていますか？' },
      { id: 'weightGoal', label: '体重について', type: 'select', options: ['', '増やしたい', '減らしたい', '今のままでよい'], ask: '体重は増やしたい、減らしたい、今のままでよいのどれですか？' }
    ] },
    { group: '気持ちと連絡', items: [
      { id: 'worries', label: '不安なこと・悩み', type: 'textarea', ask: '競技や練習について、不安なことや悩みはありますか？' },
      { id: 'nerves', label: '本番での緊張', type: 'select', options: ['', 'とても緊張する', '少し緊張する', 'あまりしない'], ask: '試合の本番では緊張しやすいですか？' },
      { id: 'tonePref', label: '声かけの好み', type: 'select', options: ['', 'gentle', 'genki', 'polite', 'coach'], optionLabels: ['', 'やさしく寄り添ってほしい', '明るく元気に励ましてほしい', '丁寧で落ち着いた連絡がよい', '指導者らしく力強く'], ask: 'メッセージは、どんな雰囲気だとうれしいですか？' },
      { id: 'contact', label: '連絡の希望', type: 'text', placeholder: '例：LINE、夜はNG', ask: '連絡はLINEとメールのどちらがよいですか？避けてほしい時間帯もあれば教えてください。' }
    ] }
  ];

  function optionLabel(item, v) {
    if (!item.optionLabels) return v;
    var i = item.options.indexOf(v);
    return i === -1 ? v : item.optionLabels[i];
  }

  function isNone(v) { return !v || /^(なし|特になし|ない|無し|ありません)$/.test(String(v).trim()); }

  function counselingPatch(member, ans) {
    ans = ans || {};
    var patch = {};
    var notes = [];
    if (ans.goalLong && ans.goalLong.trim()) { patch.goalNote = ans.goalLong.trim(); notes.push('目標・目的'); }
    if (ans.sport && ans.sport.trim() && !member.position) { patch.position = ans.sport.trim(); notes.push('ポジション・種目'); }
    var lv = { 'ほとんどない': 1, '少しある（1年未満）': 2, '1年以上続けている': 3 }[ans.strengthExp];
    if (lv) { patch.level = lv; notes.push('トレーニング経験'); }
    var pm = { 'ジム・トレーニング室': 'gym', '自宅': 'home', 'グラウンド・体育館': 'field' };
    if (Array.isArray(ans.places) && ans.places.length) { patch.places = ans.places.map(function (p) { return pm[p]; }).filter(Boolean); notes.push('トレーニングできる場所'); }
    if (ans.tonePref && D.TONES[ans.tonePref]) { patch.tone = ans.tonePref; notes.push('トーン'); }
    var add = [];
    if (!isNone(ans.injuries) || !isNone(ans.painNow)) add.push('injury');
    if (ans.sleepHours === '6時間未満') add.push('sleep');
    if (ans.breakfast === 'ほとんど食べない' || ans.afterMeal === 'ほとんど食べない') add.push('eatLess');
    if (ans.weightGoal === '増やしたい') add.push('weightGain');
    if (ans.weightGoal === '減らしたい') add.push('weightLoss');
    if (ans.nerves === 'とても緊張する') add.push('nerves');
    if (lv === 1) add.push('beginner');
    if (add.length) {
      var cur = (member.concerns || []).slice();
      add.forEach(function (c) { if (cur.indexOf(c) === -1) cur.push(c); });
      patch.concerns = cur;
      notes.push('気になっていること（' + add.length + '項目）');
    }
    return { patch: patch, notes: notes };
  }

  function counselingAlerts(ans) {
    ans = ans || {};
    var out = [];
    if (!isNone(ans.painNow)) out.push({ id: 'cPain', level: 'warn', title: 'カウンセリングで痛みの申告があります', body: '「' + ans.painNow + '」に痛みや違和感があるとの回答です。痛む部位を使う練習は控え、必要に応じて受診をすすめてください。' });
    if (!isNone(ans.medical)) out.push({ id: 'cMedical', level: 'info', title: '持病・服薬・医師の指示の申告があります', body: 'カウンセリングで申告があります（' + ans.medical + '）。医師の指示を確認したうえで練習内容を決めてください。' });
    return out;
  }

  function counselingSummary(member, ans) {
    ans = ans || {};
    var lines = ['【初回カウンセリング】' + E.displayName(member)];
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

  function counselingMessage(member, teams, opts) {
    opts = opts || {};
    var s = E.planSettings(member, teams);
    var name = E.displayName(member);
    var qs = [];
    COUNSELING.forEach(function (g) { g.items.forEach(function (it) { if (it.ask) qs.push(it.ask); }); });
    var parts = [
      name + '、これから一緒にトレーニングに取り組めること、とてもうれしく思っています。' + (opts.emoji === 0 ? '' : '💪'),
      name + 'に合った練習計画をつくるために、いくつか教えてください。答えられるものだけで大丈夫です。一言ずつでもまったく問題ありません。',
      qs.map(function (q, i) { return (i + 1) + '. ' + q; }).join('\n'),
      '特に、けがや痛み、持病のことは、安全に練習するためにとても大切な情報です。ここで教えてもらった内容は、サポートのためだけに使います。\nこれからよろしくお願いします。'
    ];
    if (s.coach) parts.push(s.coach);
    return parts.join('\n\n');
  }

  // ------------------------------------------------------------------
  // 食事・補食の例（数値は出典のあるものだけ）
  // ------------------------------------------------------------------
  var MEAL_TIMINGS = {
    morning: '朝食',
    before: '練習の前',
    after: '練習の後',
    bulk: '体を大きくしたい時',
    eventEve: '試合の前日',
    eventDay: '試合の当日',
    trip: '遠征・外出先'
  };

  var MEALS = [
    { timing: 'morning', name: '和食の朝ごはん', items: 'ご飯、納豆、卵、具だくさん味噌汁、果物', point: '炭水化物とたんぱく質を朝からそろえると、午前の練習や授業のエネルギーになります。' },
    { timing: 'morning', name: '時間がない朝', items: 'おにぎり、牛乳かヨーグルト、バナナ', point: '準備がいらないものを前の日に用意しておくと、朝食を抜かずに済みます。' },
    { timing: 'before', name: '練習の2〜3時間前', items: 'ご飯や麺類などの主食に、消化のよいおかず（脂っこいものは控えめに）', point: '練習中のエネルギー源になる炭水化物を中心に。揚げ物など消化に時間がかかるものは控えめにします。' },
    { timing: 'before', name: '練習の直前（30分〜1時間前）', items: 'バナナ、おにぎり（小さめ）、ゼリー飲料', point: 'お腹にたまりにくい、消化のよい炭水化物を少しだけ。' },
    { timing: 'after', name: '練習後すぐの補食', items: 'おにぎりやバナナ＋牛乳、ヨーグルト、ゆで卵', point: '炭水化物とたんぱく質を一緒にとると、回復を助けてくれます。家に帰るまで時間がかかる時ほど大切です。' },
    { timing: 'after', name: '練習後の夕食', items: 'ご飯、肉や魚のおかず、野菜のおかず、汁物、果物', point: '主食・主菜・副菜をそろえた定食の形にすると、必要な栄養をまとめてとりやすくなります。' },
    { timing: 'bulk', name: '食べる回数を増やす', items: '3食＋練習前後や寝る前の補食（おにぎり、牛乳、チーズ、ナッツなど）', point: '1回の量を増やすのが難しい人は、回数を増やす方が続けやすくなります。' },
    { timing: 'bulk', name: '主食をしっかり', items: '毎食の主食をしっかりと、丼もの・麺類・パンなどを組み合わせる', point: '練習量が多い選手は、炭水化物が不足すると体重が増えにくくなります。' },
    { timing: 'eventEve', name: '試合前日の夕食', items: 'ご飯や麺類などの主食を中心に、食べ慣れたおかず。生ものや脂っこいものは控えめに', point: '新しいものや食べ慣れないものは避け、いつもどおりの食事を心がけます。' },
    { timing: 'eventDay', name: '試合当日の食事', items: '試合の3〜4時間前までに主食中心の食事、直前はバナナやゼリー飲料など', point: '試合の時間から逆算して食べる時間を決めておくと安心です。初めて食べるものは試合の日には避けましょう。' },
    { timing: 'eventDay', name: '試合の合間', items: 'ゼリー飲料、バナナ、カステラ、スポーツドリンク', point: '消化がよく、すぐにエネルギーになるものを少しずつ。水分補給も忘れずに。' },
    { timing: 'trip', name: 'コンビニで選ぶ補食', items: 'おにぎり、サンドイッチ、牛乳やヨーグルト、ゆで卵、サラダチキン、バナナ', point: '「主食＋たんぱく質」の組み合わせを基本に選びます。' },
    { timing: 'trip', name: '遠征先の外食', items: '定食や丼もの＋汁物、うどんやそばに卵や肉をトッピング', point: '揚げ物ばかりにならないよう、主食とたんぱく質がそろうメニューを選びます。' }
  ];

  var MEAL_RULES = {
    eatLess: ['after', 'morning'],
    weightGain: ['bulk', 'after'],
    weightLoss: ['after', 'morning'],
    busy: ['trip', 'after'],
    fatigue: ['after']
  };

  function mealProposal(member, teams, opts) {
    opts = opts || {};
    var r = rng(hash([member.id || 'm', 'meal', opts.variant || 0].join('|')));
    var s = E.planSettings(member, teams);
    var want = [];
    var info = E.dayInfo(s, E.todayDay(s));
    if (info.eventIn !== null && info.eventIn >= 0 && info.eventIn <= 7) want.push('eventEve', 'eventDay');
    (member.concerns || []).forEach(function (c) { (MEAL_RULES[c] || []).forEach(function (t) { want.push(t); }); });
    want.push('after', 'before', 'morning');
    var chosen = [];
    want.forEach(function (t) {
      if (chosen.length >= 3 || chosen.some(function (m) { return m.timing === t; })) return;
      chosen.push(pick(r, MEALS.filter(function (m) { return m.timing === t; })));
    });
    return { meals: chosen, text: mealText(member, teams, chosen, opts) };
  }

  function mealText(member, teams, meals, opts) {
    opts = opts || {};
    var s = E.planSettings(member, teams);
    var name = E.displayName(member);
    var emoji = opts.emoji === undefined ? 1 : opts.emoji;
    var parts = [name + '、練習の効果を高めるための食事と補食の例をまとめました。'];
    meals.forEach(function (m) {
      parts.push((emoji ? '🍙' : '■') + MEAL_TIMINGS[m.timing] + '：' + m.name + '\n' + m.items + '\n' + m.point);
    });
    parts.push('全部を一度に変えなくて大丈夫です。できそうなものからひとつ試してみてください。食べてみた感想や、食べにくいものがあれば教えてくださいね。');
    if (s.coach) parts.push(s.coach);
    return parts.join('\n\n');
  }

  // ------------------------------------------------------------------
  // サンプルデータ（動作確認用の架空のチーム）
  // ------------------------------------------------------------------
  function sampleData(todayStr) {
    var t = todayStr || E.today();
    var start = E.addDays(t, -36);
    var team = {
      id: 'sample-team', name: 'サンプル高校 陸上部', sport: '陸上 短距離', level: 2, tone: 'gentle', coach: 'コーチ 佐藤（サンプル）',
      goal: 'competition', startDate: start, totalDays: 90, eventDate: E.addDays(start, 72), trainingDays: [1, 2, 4, 5, 6], places: ['field', 'gym']
    };
    function make(id, name, opts) {
      var m = {
        id: id, name: name, honorific: 'さん', teamId: team.id, useTeamPlan: true, level: opts.level, position: opts.position,
        age: 17, goalNote: opts.goal, concerns: opts.concerns, tone: '', wellness: [], sessions: [], lifts: [], history: []
      };
      for (var i = 27; i >= 0; i--) {
        var d = E.addDays(t, -i);
        var wd = E.parseDate(d).getDay();
        if (team.trainingDays.indexOf(wd) === -1) continue;
        var rpe = Math.min(10, opts.rpe + (i < 7 ? opts.ramp : 0));
        m.sessions.push({ date: d, type: '筋力トレーニング', minutes: i < 7 ? opts.minutes + opts.extra : opts.minutes, rpe: rpe, note: '' });
        m.wellness.push({ date: d, sleep: opts.sleep - (i < 5 ? opts.sleepDrop : 0), fatigue: Math.min(5, opts.fatigue + (i < 5 ? opts.fatigueUp : 0)), soreness: 2 + (i % 3 === 0 ? 1 : 0), mood: opts.mood });
      }
      if (opts.pain) m.wellness[m.wellness.length - 1].pain = opts.pain;
      opts.lifts.forEach(function (l) { m.lifts.push({ date: E.addDays(t, -l[0]), exercise: l[1], weight: l[2], reps: l[3], sets: 3 }); });
      return m;
    }
    var members = [
      make('sample-m1', '田中 太郎', { level: 2, position: '100m', goal: 'インターハイ出場', concerns: ['injury', 'nerves'], rpe: 6, ramp: 2, minutes: 90, extra: 30, sleep: 7, sleepDrop: 1.5, fatigue: 3, fatigueUp: 1, mood: 3, pain: '右ハムストリング',
        lifts: [[25, 'バックスクワット', 80, 5], [11, 'バックスクワット', 85, 5], [3, 'バックスクワット', 90, 5]] }),
      make('sample-m2', '鈴木 花子', { level: 1, position: '200m', goal: '県大会で自己ベスト', concerns: ['eatLess', 'beginner'], rpe: 5, ramp: 0, minutes: 80, extra: 0, sleep: 8, sleepDrop: 0, fatigue: 2, fatigueUp: 0, mood: 4,
        lifts: [[20, 'ゴブレットスクワット', 16, 10], [6, 'ゴブレットスクワット', 20, 8]] }),
      make('sample-m3', '佐藤 健', { level: 3, position: '400m', goal: '全国大会出場', concerns: ['sleep', 'fatigue'], rpe: 6, ramp: 1, minutes: 100, extra: 20, sleep: 6.5, sleepDrop: 1.5, fatigue: 3, fatigueUp: 2, mood: 3,
        lifts: [[22, 'デッドリフト', 120, 3], [8, 'デッドリフト', 125, 3]] })
    ];
    return { teams: [team], members: members };
  }

  return {
    REPLY_TOPICS: REPLY_TOPICS, STATE_PRIORITY: STATE_PRIORITY, analyzeReply: analyzeReply, buildReply: buildReply,
    COUNSELING: COUNSELING, optionLabel: optionLabel, counselingPatch: counselingPatch, counselingAlerts: counselingAlerts,
    counselingSummary: counselingSummary, counselingMessage: counselingMessage,
    MEAL_TIMINGS: MEAL_TIMINGS, MEALS: MEALS, mealProposal: mealProposal, mealText: mealText,
    sampleData: sampleData
  };
});
