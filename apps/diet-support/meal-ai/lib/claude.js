/*
 * Claude API の呼び出し（サーバー側だけで使う。APIキーはブラウザに渡さない）
 *
 * - モデル：既定は claude-opus-5-5（環境変数 CLAUDE_MODEL で変更可）
 * - 出力：JSON スキーマで形を固定（output_config.format）
 * - 安全分類器が回答を控えた場合は、サーバー側で別モデルに自動で切り替える（fallbacks: "default"）
 */
import Anthropic from '@anthropic-ai/sdk';

export const MODEL = process.env.CLAUDE_MODEL || 'claude-opus-5-5';

let client = null;
function getClient() {
  // ANTHROPIC_API_KEY を環境変数から読み込む
  if (!client) client = new Anthropic();
  return client;
}

export function isConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

export function isMock() {
  return process.env.MEAL_AI_MOCK === '1';
}

// 画面に返すエラー（status は HTTP ステータス）
export class AppError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/**
 * JSON スキーマに沿った回答を1回の呼び出しで受け取る
 * @param {object} p
 * @param {string} p.system   システムプロンプト
 * @param {Array}  p.content  ユーザーメッセージの中身（画像ブロック・テキストブロック）
 * @param {object} p.schema   JSON スキーマ（object は additionalProperties: false が必須）
 * @param {string} [p.effort] 'low' | 'medium' | 'high'
 */
export async function callJson({ system, content, schema, effort = 'medium' }) {
  let response;
  try {
    response = await getClient().beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system,
      messages: [{ role: 'user', content }],
      output_config: {
        effort,
        format: { type: 'json_schema', schema }
      }
    });
  } catch (error) {
    // 具体的なエラーから順に判定する
    if (error instanceof Anthropic.AuthenticationError) {
      throw new AppError(500, 'Claude API のキーが正しくありません。Vercel の環境変数 ANTHROPIC_API_KEY を確認してください。');
    }
    if (error instanceof Anthropic.PermissionDeniedError) {
      throw new AppError(500, 'この API キーでは、このモデルを使えません。');
    }
    if (error instanceof Anthropic.RateLimitError) {
      throw new AppError(429, '利用が集中しています。少し時間をおいてから、もう一度お試しください。');
    }
    if (error instanceof Anthropic.BadRequestError) {
      throw new AppError(400, '写真を読み取れませんでした。別の写真でお試しください。');
    }
    if (error instanceof Anthropic.APIConnectionError) {
      throw new AppError(502, 'AI に接続できませんでした。通信状態を確認して、もう一度お試しください。');
    }
    if (error instanceof Anthropic.APIError) {
      throw new AppError(502, 'AI の処理でエラーが起きました（' + error.status + '）。もう一度お試しください。');
    }
    throw error;
  }

  if (response.stop_reason === 'refusal') {
    throw new AppError(422, 'この写真は解析できませんでした。食事が写っている写真でお試しください。');
  }
  if (response.stop_reason === 'max_tokens') {
    throw new AppError(502, '解析結果が長くなりすぎました。もう一度お試しください。');
  }
  const text = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new AppError(502, 'AI の回答を読み取れませんでした。もう一度お試しください。');
  }
}

// --- リクエスト・レスポンスの道具（Vercel とローカルの両方で動く書き方） ---

export async function readJson(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return JSON.parse(req.body || '{}');
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

export function send(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(data));
}

// 合言葉（APP_PASSCODE）を設定した場合は、一致しないリクエストを断る
export function checkPasscode(req) {
  const need = process.env.APP_PASSCODE;
  if (!need) return true;
  return req.headers['x-app-passcode'] === need;
}

export async function handle(req, res, fn) {
  if (req.method !== 'POST') return send(res, 405, { error: 'POST で送ってください。' });
  if (!checkPasscode(req)) return send(res, 401, { error: '合言葉が正しくありません。プランの画面で合言葉を設定してください。' });
  if (!isMock() && !isConfigured()) {
    return send(res, 503, { error: 'AI の設定がまだです。Vercel の環境変数に ANTHROPIC_API_KEY を登録してください。' });
  }
  try {
    const body = await readJson(req);
    const data = await fn(body);
    return send(res, 200, data);
  } catch (error) {
    if (error instanceof AppError) return send(res, error.status, { error: error.message });
    console.error(error);
    return send(res, 500, { error: '予期しないエラーが起きました。もう一度お試しください。' });
  }
}
