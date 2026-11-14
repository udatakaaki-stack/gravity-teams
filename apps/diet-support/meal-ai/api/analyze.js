/*
 * POST /api/analyze
 * 食事の写真から、料理名・量・エネルギー・たんぱく質・脂質・炭水化物・塩分を推定する
 *
 * 受け取る JSON：{ image: base64文字列, mediaType: 'image/jpeg', mealType: '朝食', memo: '' }
 */
import { callJson, handle, isMock, AppError } from '../lib/claude.js';

const TAGS = ['高たんぱく', '野菜たっぷり', 'バランス良好', '主食あり', '発酵食品', '脂質多め', '塩分多め', '糖質多め', '軽め', '間食'];

const SYSTEM = `あなたは、管理栄養士の知識を持つ食事解析アシスタントです。日本のダイエット支援アプリで、利用者が送った食事の写真から栄養を推定します。

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

export const SCHEMA = {
  type: 'object',
  properties: {
    dish_name: { type: 'string', description: '食事全体の短い名前（例：焼き魚定食、豚の生姜焼きとご飯）' },
    summary: { type: 'string', description: 'この食事の内容を1文で' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', description: '料理・食品の名前' },
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
    assumptions: { type: 'array', items: { type: 'string' }, description: '推定の前提（量の見立てなど）' },
    good_points: { type: 'array', items: { type: 'string' } },
    cautions: { type: 'array', items: { type: 'string' } },
    tags: { type: 'array', items: { type: 'string', enum: TAGS } }
  },
  required: ['dish_name', 'summary', 'items', 'confidence', 'assumptions', 'good_points', 'cautions', 'tags'],
  additionalProperties: false
};

const MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_BASE64 = 4 * 1024 * 1024; // Vercel の関数は本文 4.5MB まで

function round1(n) { return Math.round((Number(n) || 0) * 10) / 10; }

// 合計はサーバー側で一品ずつ足し合わせて計算する（AI の暗算に頼らない）
export function withTotals(result) {
  const items = (result.items || []).map((it) => ({
    name: String(it.name || ''),
    portion: String(it.portion || ''),
    kcal: Math.max(0, Math.round(Number(it.kcal) || 0)),
    protein_g: Math.max(0, round1(it.protein_g)),
    fat_g: Math.max(0, round1(it.fat_g)),
    carbs_g: Math.max(0, round1(it.carbs_g)),
    salt_g: Math.max(0, round1(it.salt_g))
  }));
  const sum = (k) => items.reduce((a, it) => a + it[k], 0);
  return Object.assign({}, result, {
    items,
    totals: { kcal: Math.round(sum('kcal')), protein_g: round1(sum('protein_g')), fat_g: round1(sum('fat_g')), carbs_g: round1(sum('carbs_g')), salt_g: round1(sum('salt_g')) }
  });
}

// デモ用（MEAL_AI_MOCK=1 の時だけ。実際の解析ではありません）
function mockResult(mealType) {
  const lunch = {
    dish_name: '豚の生姜焼き定食（デモ）',
    summary: 'デモ用のサンプルです。実際の写真は解析していません。',
    items: [
      { name: '雑穀ご飯', portion: '茶碗1杯 約150g', kcal: 240, protein_g: 4.5, fat_g: 0.8, carbs_g: 53.0, salt_g: 0 },
      { name: '豚の生姜焼き', portion: '豚ロース 約100g', kcal: 300, protein_g: 19.0, fat_g: 20.0, carbs_g: 8.0, salt_g: 1.8 },
      { name: 'キャベツの千切り（マヨネーズ）', portion: '約60g＋マヨネーズ小さじ1', kcal: 45, protein_g: 0.8, fat_g: 3.5, carbs_g: 3.2, salt_g: 0.1 },
      { name: 'ごぼうのきんぴら', portion: '小鉢1つ 約50g', kcal: 60, protein_g: 1.0, fat_g: 2.0, carbs_g: 9.0, salt_g: 0.8 }
    ],
    confidence: 'medium',
    assumptions: ['デモ用の固定データです', 'ご飯は一般的な茶碗1杯として計算しています'],
    good_points: ['主食・主菜・副菜がそろった定食の形になっています', '豚肉でたんぱく質がしっかりとれています'],
    cautions: ['生姜焼きのたれときんぴらで塩分が重なっています。汁物がある日は汁を少し残すと、さらに整います'],
    tags: ['バランス良好', '高たんぱく', '主食あり']
  };
  const snack = {
    dish_name: 'ヨーグルトとナッツ（デモ）',
    summary: 'デモ用のサンプルです。実際の写真は解析していません。',
    items: [
      { name: 'プレーンヨーグルト（キウイ・ブルーベリー）', portion: '約100g', kcal: 95, protein_g: 4.0, fat_g: 3.0, carbs_g: 13.0, salt_g: 0.1 },
      { name: '素焼きミックスナッツ', portion: '約15g', kcal: 90, protein_g: 2.8, fat_g: 8.0, carbs_g: 2.5, salt_g: 0 }
    ],
    confidence: 'medium',
    assumptions: ['デモ用の固定データです'],
    good_points: ['たんぱく質と食物繊維がとれる間食です'],
    cautions: [],
    tags: ['間食', '軽め']
  };
  return withTotals(mealType === '間食' ? snack : lunch);
}

export default function handler(req, res) {
  return handle(req, res, async (body) => {
    const mealType = String(body.mealType || '食事').slice(0, 10);
    const memo = String(body.memo || '').slice(0, 300);
    if (isMock()) return Object.assign(mockResult(mealType), { demo: true });

    const image = String(body.image || '');
    const mediaType = MEDIA_TYPES.indexOf(body.mediaType) !== -1 ? body.mediaType : 'image/jpeg';
    if (!image) throw new AppError(400, '写真が送られていません。');
    if (image.length > MAX_BASE64) throw new AppError(413, '写真のサイズが大きすぎます。');

    const text = '食事の種類：' + mealType + '\n利用者のメモ：' + (memo || 'なし') + '\nこの写真の食事を解析してください。';
    const result = await callJson({
      system: SYSTEM,
      schema: SCHEMA,
      content: [
        { type: 'image', source: { type: 'base64', media_type: mediaType, data: image } },
        { type: 'text', text }
      ]
    });
    return withTotals(result);
  });
}
