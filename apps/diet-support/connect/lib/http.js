/*
 * リクエストとレスポンスの道具（Vercel の関数と、手元のサーバーの両方で動く書き方）
 */
import { AppError } from './claude.js';

export { AppError };

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

/** POST { action, ... } を受け取り、actions[action] を実行する */
export function router(actions, prepare) {
  return async function handler(req, res) {
    if (req.method !== 'POST') return send(res, 405, { error: 'POST で送ってください。' });
    try {
      const body = await readJson(req);
      const fn = actions[body.action];
      if (!fn) throw new AppError(400, '不明な操作です。');
      const ctx = prepare ? await prepare(req, body) : {};
      const data = await fn(body, ctx, req);
      return send(res, 200, data || { ok: true });
    } catch (error) {
      if (error instanceof AppError) return send(res, error.status, { error: error.message });
      console.error(error);
      return send(res, 500, { error: '予期しないエラーが起きました。もう一度お試しください。' });
    }
  };
}
