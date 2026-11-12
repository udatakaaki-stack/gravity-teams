/*
 * GET /api/health
 * AI の設定状況を返す（キーそのものは返さない）
 */
import { isConfigured, isMock, MODEL, send } from '../lib/claude.js';

export default function handler(req, res) {
  return send(res, 200, {
    ready: isMock() || isConfigured(),
    mock: isMock(),
    model: MODEL,
    passcodeRequired: Boolean(process.env.APP_PASSCODE)
  });
}
