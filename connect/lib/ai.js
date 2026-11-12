/*
 * AI の機能
 *   analyzeMeal  … 食事の写真から栄養を推定（AI食事コーチと同じしくみ）
 *   dayAdvice    … クライアント向け、その日のアドバイス
 *   draftReply   … コーチ向け、クライアントへの返信の下書き
 */
import { callJson, isMock, AppError } from './claude.js';

// ------------------------------------------------------------------
// 食事の写真の解析
// ------------------------------------------------------------------
const TAGS = ['高たんぱく', '野菜たっぷり', 'バランス良好', '主食あり', '発酵食品', '脂質多め', '塩分多め', '糖質多め', '軽め', '間食'];

const ANALYZE_SYSTEM = `あなたは、管理栄養士の知識を持つ食事解析アシスタントです。日本のダイエット支援サービスで、利用者が送った食事の写真から栄養を推定します。

推定のしかた
- 写っている料理・食品を一品ずつ分けて、それぞれの量と栄養を推定してください。
- 量は、器の大きさ、個数、厚み、定規や手など一緒に写っているものを手がかりにします。日本の家庭や飲食店で一般的な量を基準にしてください。
- 栄養の値は、日本食品標準成分表の考え方に沿った一般的な値を目安にします。商品のパッケージや栄養成分表示が読み取れる場合は、その表示を優先してください。
- 利用者のメモに量や内容が書かれていれば、写真よりメモを優先してください。
- たれ、ドレッシング、マヨネーズ、油などの調味料が見えたり、料理に一般的に使われていたりする場合は、その分も含めてください。
- 写真からの推定には限界があります。見えない部分や判断が難しい部分は、推定の前提として短く書き、確信の度合いを confidence に正直に示してください。
- 食事が写っていない写真の場合は、items を空にして、dish_name を「食事が写っていません」としてください。

コメントの書き方
- 利用者は前向きにダイエットに取り組んでいます。責める言い方はせず、やさしく具体的に書いてください。
- good_points には、この食事のよいところを具体的に書きます。
- cautions には、気をつけたい点を「〜すると、さらによくなります」のような提案の形で書きます。なければ空にします。
- 病気の診断や、極端な食事制限をすすめる内容は書かないでください。
- すべて自然な日本語で書いてください。`;

export const ANALYZE_SCHEMA = {
  type: 'object',
  properties: {
    dish_name: { type: 'string', description: '食事全体の短い名前（例：焼き魚定食）' },
    summary: { type: 'string', description: 'この食事の内容を1文で' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          portion: { type: 'string', description: '推定した量（例：茶碗1杯 約150g）' },
          kcal: { type: 'number' },
          protein_g: { type: 'number' },
          fat_g: { type: 'number' },
          carbs_g: { type: 'number' },
          salt_g: { type: 'number', description: '食塩相当量' }
        },
        required: ['name', 'portion', 'kcal', 'protein_g', 'fat_g', 'carbs_g', 'salt_g'],
        additionalProperties: false
      }
    },
    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
    assumptions: { type: 'array', items: { type: 'string' } },
    good_points: { type: 'array', items: { type: 'string' } },
    cautions: { type: 'array', items: { type: 'string' } },
    tags: { type: 'array', items: { type: 'string', enum: TAGS } }
  },
  required: ['dish_name', 'summary', 'items', 'confidence', 'assumptions', 'good_points', 'cautions', 'tags'],
  additionalProperties: false
};

function round1(n) { return Math.round((Number(n) || 0) * 10) / 10; }

export function cleanItems(items) {
  return (items || []).slice(0, 20).map((it) => ({
    name: String(it.name || '').slice(0, 60),
    portion: String(it.portion || '').slice(0, 60),
    kcal: Math.max(0, Math.round(Number(it.kcal) || 0)),
    protein_g: Math.max(0, round1(it.protein_g)),
    fat_g: Math.max(0, round1(it.fat_g)),
    carbs_g: Math.max(0, round1(it.carbs_g)),
    salt_g: Math.max(0, round1(it.salt_g))
  }));
}

export function totalsOf(items) {
  const sum = (k) => items.reduce((a, it) => a + it[k], 0);
  return { kcal: Math.round(sum('kcal')), protein_g: round1(sum('protein_g')), fat_g: round1(sum('fat_g')), carbs_g: round1(sum('carbs_g')), salt_g: round1(sum('salt_g')) };
}

const MOCK_MEAL = {
  dish_name: '豚の生姜焼き定食（デモ）',
  summary: 'デモ用のサンプルです。実際の写真は解析していません。',
  items: [
    { name: '雑穀ご飯', portion: '茶碗1杯 約150g', kcal: 240, protein_g: 4.5, fat_g: 0.8, carbs_g: 53.0, salt_g: 0 },
    { name: '豚の生姜焼き', portion: '豚ロース 約100g', kcal: 300, protein_g: 19.0, fat_g: 20.0, carbs_g: 8.0, salt_g: 1.8 },
    { name: 'キャベツの千切り（マヨネーズ）', portion: '約60g＋マヨネーズ小さじ1', kcal: 45, protein_g: 0.8, fat_g: 3.5, carbs_g: 3.2, salt_g: 0.1 }
  ],
  confidence: 'medium',
  assumptions: ['デモ用の固定データです'],
  good_points: ['主食・主菜・副菜がそろった定食の形になっています'],
  cautions: ['生姜焼きのたれで塩分がやや多めです。汁物がある日は汁を少し残すと、さらに整います'],
  tags: ['バランス良好', '高たんぱく', '主食あり'],
  demo: true
};

const MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export async function analyzeMeal({ image, mediaType, mealType, memo }) {
  if (isMock()) {
    const items = cleanItems(MOCK_MEAL.items);
    return Object.assign({}, MOCK_MEAL, { items, totals: totalsOf(items) });
  }
  const data = String(image || '');
  if (!data) throw new AppError(400, '写真が送られていません。');
  if (data.length > 4 * 1024 * 1024) throw new AppError(413, '写真のサイズが大きすぎます。');
  const result = await callJson({
    system: ANALYZE_SYSTEM,
    schema: ANALYZE_SCHEMA,
    content: [
      { type: 'image', source: { type: 'base64', media_type: MEDIA_TYPES.indexOf(mediaType) !== -1 ? mediaType : 'image/jpeg', data } },
      { type: 'text', text: '食事の種類：' + String(mealType || '食事').slice(0, 10) + '\n利用者のメモ：' + (String(memo || '').slice(0, 300) || 'なし') + '\nこの写真の食事を解析してください。' }
    ]
  });
  const items = cleanItems(result.items);
  return Object.assign(result, { items, totals: totalsOf(items) });
}

// ------------------------------------------------------------------
// クライアント向けアドバイス
// ------------------------------------------------------------------
const KINDS = ['praise', 'meal', 'salt', 'protein', 'activity', 'water', 'sleep', 'other'];

const ADVICE_SYSTEM = `あなたは、日本のダイエット支援サービスの AI コーチです。利用者のその日の食事の記録と目標をもとに、短く具体的なアドバイスを書きます。

大切にすること
- 利用者は前向きに取り組んでいます。責めたり、怖がらせたりする言い方はしません。まずできていることを認め、そのうえで次の一歩を提案します。
- 今の時刻と、まだ食べていない食事を踏まえて、「次に何をどう食べるとよいか」を具体的な料理名で提案します。
- 目標を超えている時も、食事を抜くことはすすめません。量を少し控える、野菜やたんぱく質を中心にする、歩く時間を少し増やす、翌日に整える、といった無理のない調整を提案します。
- 目標より大きく少ない時は、食べなさすぎにならないよう、たんぱく質を中心にしっかり食べることをすすめます。
- 数値はアプリから渡された記録と目標だけを使い、新しい数値を作らないでください。
- 病気の診断や治療の話はしません。体調に不安がある時は医師に相談するよう伝えます。
- verdict_title は20文字程度の見出し、verdict_body は2文程度、tips は3つか4つにします。すべて自然な日本語で書いてください。`;

export const ADVICE_SCHEMA = {
  type: 'object',
  properties: {
    verdict_title: { type: 'string' },
    verdict_body: { type: 'string' },
    tips: {
      type: 'array',
      items: {
        type: 'object',
        properties: { kind: { type: 'string', enum: KINDS }, title: { type: 'string' }, body: { type: 'string' } },
        required: ['kind', 'title', 'body'],
        additionalProperties: false
      }
    }
  },
  required: ['verdict_title', 'verdict_body', 'tips'],
  additionalProperties: false
};

export async function dayAdvice(input) {
  if (isMock()) {
    return {
      demo: true,
      verdict_title: 'いいバランスで進んでいます（デモ）',
      verdict_body: 'これはデモ用のアドバイスです。実際の記録をもとにした内容ではありません。',
      tips: [
        { kind: 'praise', title: '定食の形がそろっています', body: '主食・主菜・副菜がそろうと、満足感も栄養も整いやすくなります。' },
        { kind: 'meal', title: '夕食は野菜とたんぱく質を中心に', body: '焼き魚や豆腐に、具だくさんの汁物を合わせると、残りの目安に収まりやすくなります。' },
        { kind: 'activity', title: '食後に10分歩いてみませんか', body: '少し体を動かすだけでも、1日の消費エネルギーは積み重なります。' }
      ]
    };
  }
  return callJson({
    system: ADVICE_SYSTEM,
    schema: ADVICE_SCHEMA,
    effort: 'low',
    content: [{ type: 'text', text: '今日の記録です。アドバイスをお願いします。\n' + JSON.stringify(input, null, 2) }]
  });
}

// ------------------------------------------------------------------
// コーチの返信の下書き
// ------------------------------------------------------------------
const DRAFT_SYSTEM = `あなたは、日本のダイエット指導者（コーチ）のアシスタントです。コーチがクライアントに LINE のように送るメッセージの下書きを作ります。下書きはコーチが確認・修正してから送ります。

書き方
- コーチ本人の言葉として、クライアントの呼び名と敬称を使って書きます。
- 最近の記録（食事、体重、気分、メモ）と、これまでのやり取りを読み、具体的な事実に触れます。たとえば「昨日の朝ごはん、納豆と卵でたんぱく質がしっかりとれていましたね」のように書きます。
- まずできていることを認め、気持ちに寄り添います。改善の提案は1つか2つに絞り、責める言い方はしません。
- 体重が増えた時は、水分や塩分でも上下することを伝え、安心できる言葉を添えます。停滞している時は、続けていること自体の価値を伝えます。
- 体調不良やつらい気持ちを示す言葉がある時は、ダイエットの話より体と気持ちを優先し、必要に応じて医療機関への相談をすすめます。
- 最後は、返信しやすい問いかけか、応援の言葉で締めます。
- 数値は渡された記録のものだけを使い、新しい数値を作らないでください。
- 長さは200〜350文字程度。絵文字は控えめに1〜2個まで。自然な日本語で書いてください。
- considered には、下書きで触れた記録上のポイントを箇条書きで短く書きます（コーチ向けのメモ）。`;

export const DRAFT_SCHEMA = {
  type: 'object',
  properties: {
    message: { type: 'string' },
    considered: { type: 'array', items: { type: 'string' } }
  },
  required: ['message', 'considered'],
  additionalProperties: false
};

export async function draftReply(input) {
  if (isMock()) {
    return {
      demo: true,
      message: (input.呼び名 || 'クライアント') + '、毎日の記録ありがとうございます（デモの下書きです）。\n\n食事の写真から、主食・主菜・副菜をそろえようとしている様子がよく伝わってきます。この調子で続けていきましょう。\n\n今日の夕食は、どんなものを予定していますか？',
      considered: ['デモ用の固定の下書きです']
    };
  }
  return callJson({
    system: DRAFT_SYSTEM,
    schema: DRAFT_SCHEMA,
    effort: 'medium',
    content: [{ type: 'text', text: 'クライアントの情報と最近の記録です。返信の下書きをお願いします。\n' + JSON.stringify(input, null, 2) }]
  });
}
