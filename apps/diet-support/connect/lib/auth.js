/*
 * ログインのしくみ
 *
 * - コーチ：Vercel の環境変数 COACH_PASSWORD と照合し、署名つきのトークン（30日有効）を発行する
 * - クライアント：コーチが発行する招待コード（推測できない長い文字列）で本人を確認する
 *   保存するのはコードのハッシュだけで、コードそのものは保存しない
 * - 署名には環境変数 SESSION_SECRET を使う（本番では必須）
 */
import crypto from 'node:crypto';

const COACH_TTL = 30 * 24 * 60 * 60; // 30日

export function secret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  if (process.env.VERCEL) return null; // 本番では設定が必須
  return 'local-development-secret';
}

function b64url(buf) { return Buffer.from(buf).toString('base64url'); }

function sign(payload) {
  const body = b64url(JSON.stringify(payload));
  const mac = crypto.createHmac('sha256', secret()).update(body).digest('base64url');
  return body + '.' + mac;
}

function verify(token) {
  if (!token || typeof token !== 'string' || token.indexOf('.') === -1) return null;
  const [body, mac] = token.split('.');
  const expect = crypto.createHmac('sha256', secret()).update(body).digest('base64url');
  const a = Buffer.from(mac);
  const b = Buffer.from(expect);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!p.exp || p.exp < Math.floor(Date.now() / 1000)) return null;
    return p;
  } catch (e) { return null; }
}

// 長さの違いからも情報が漏れないよう、ハッシュにしてから比べる
export function passwordMatches(input) {
  const real = process.env.COACH_PASSWORD;
  if (!real) return false;
  const a = crypto.createHash('sha256').update(String(input || '')).digest();
  const b = crypto.createHash('sha256').update(real).digest();
  return crypto.timingSafeEqual(a, b);
}

export function issueCoachToken() {
  return sign({ role: 'coach', exp: Math.floor(Date.now() / 1000) + COACH_TTL });
}

export function verifyCoachToken(token) {
  const p = verify(token);
  return p && p.role === 'coach' ? p : null;
}

export function newInviteCode() {
  return crypto.randomBytes(24).toString('base64url');
}

export function hashCode(code) {
  return crypto.createHash('sha256').update(String(code || '')).digest('hex');
}

export function bearer(req) {
  const h = req.headers.authorization || req.headers.Authorization || '';
  return h.startsWith('Bearer ') ? h.slice(7).trim() : '';
}

export function clientIp(req) {
  const f = req.headers['x-forwarded-for'];
  return (f ? String(f).split(',')[0] : (req.socket && req.socket.remoteAddress) || 'unknown').trim();
}
