/*
 * GET /api/health
 * 設定の状況を返す（キーやパスワードそのものは返さない）
 */
import { send } from '../lib/http.js';
import { isConfigured, isMock, MODEL } from '../lib/claude.js';
import { storeKind } from '../lib/store.js';
import { secret } from '../lib/auth.js';

export default function handler(req, res) {
  return send(res, 200, {
    ai: isMock() || isConfigured(),
    mock: isMock(),
    model: MODEL,
    store: storeKind(),
    coachPassword: Boolean(process.env.COACH_PASSWORD),
    sessionSecret: Boolean(secret())
  });
}
