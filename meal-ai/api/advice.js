/*
 * POST /api/advice
 * その日の食事の合計と目標から、AI コーチのアドバイスを作る
 *
 * 受け取る JSON：{ profile, targets, meals: [{ type, dish, totals }], totals, time }
 */
import { callJson, handle, isMock } from '../lib/claude.js';

const KINDS = ['praise', 'meal', 'salt', 'protein', 'activity', 'water', 'sleep', 'other'];

const SYSTEM = `あなたは、日本のダイエット支援アプリの AI コーチです。利用者のその日の食事の記録と目標をもとに、短く具体的なアドバイスを書きます。

大切にすること
- 利用者は前向きに取り組んでいます。責めたり、怖がらせたりする言い方はしません。まずできていることを認め、そのうえで次の一歩を提案します。
- 今の時刻と、まだ食べていない食事を踏まえて、「次に何をどう食べるとよいか」を具体的な料理名で提案します。
- 目標を超えている時も、食事を抜くことはすすめません。量を少し控える、野菜やたんぱく質を中心にする、歩く時間を少し増やす、翌日に整える、といった無理のない調整を提案します。
- 目標より大きく少ない時は、食べなさすぎにならないよう、たんぱく質を中心にしっかり食べることをすすめます。
- 塩分が目標を超えそうな時は、汁物を控える、野菜や果物をとるなど、やさしい工夫を伝えます。
- 数値はアプリから渡された記録と目標だけを使い、新しい数値を作らないでください。料理を提案する時の量の目安は「軽め」「茶碗半分」のような言葉で表します。
- 病気の診断や治療の話はしません。体調に不安がある時は医師に相談するよう伝えます。
- verdict_title は20文字程度の見出し、verdict_body は2文程度、tips は3つか4つにします。すべて自然な日本語で書いてください。`;

export const SCHEMA = {
  type: 'object',
  properties: {
    verdict_title: { type: 'string' },
    verdict_body: { type: 'string' },
    tips: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          kind: { type: 'string', enum: KINDS },
          title: { type: 'string', description: '太字にする短い見出し' },
          body: { type: 'string' }
        },
        required: ['kind', 'title', 'body'],
        additionalProperties: false
      }
    }
  },
  required: ['verdict_title', 'verdict_body', 'tips'],
  additionalProperties: false
};

function mockAdvice() {
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

export default function handler(req, res) {
  return handle(req, res, async (body) => {
    if (isMock()) return mockAdvice();
    const input = {
      現在の時刻: String(body.time || ''),
      プロフィール: body.profile || {},
      目標: body.targets || {},
      今日の合計: body.totals || {},
      今日の食事: Array.isArray(body.meals) ? body.meals.slice(0, 12) : [],
      まだ記録がない食事: Array.isArray(body.remaining) ? body.remaining : []
    };
    return callJson({
      system: SYSTEM,
      schema: SCHEMA,
      effort: 'low',
      content: [{ type: 'text', text: '今日の記録です。アドバイスをお願いします。\n' + JSON.stringify(input, null, 2) }]
    });
  });
}
