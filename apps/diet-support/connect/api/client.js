/*
 * POST /api/client  { action, ... }
 * クライアント用の操作。招待コードが必要（Authorization: Bearer 招待コード）。
 */
import { router, AppError } from '../lib/http.js';
import { bearer } from '../lib/auth.js';
import { isConfigured, isMock } from '../lib/claude.js';
import { getStore } from '../lib/store.js';
import * as repo from '../lib/repo.js';
import { analyzeMeal, dayAdvice } from '../lib/ai.js';

const AI_PER_DAY = 40; // 1人あたり1日に AI を使える回数（使いすぎの防止）

function today() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function minus(date, n) {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(y, m - 1, d, 12);
  dt.setDate(dt.getDate() - n);
  return dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0');
}
function safe(c) {
  // クライアントには、コーチ用のメモは見せない
  const o = Object.assign({}, c);
  delete o.inviteHash;
  delete o.coachMemo;
  return o;
}

async function useAi(client) {
  if (!isMock() && !isConfigured()) throw new AppError(503, 'AI の設定がまだです。コーチに連絡してください。写真なしの入力は使えます。');
  const n = await getStore().incr('ai:' + client.id + ':' + today(), 2 * 24 * 60 * 60);
  if (n > AI_PER_DAY) throw new AppError(429, '今日の AI の利用回数の上限に達しました。明日またお試しください。');
}

const actions = {
  async me(body, { client }) {
    const t = today();
    const days = await repo.getDays(client.id, minus(t, 13), t);
    const msgs = await repo.listMessages(client.id, 100);
    return { today: t, client: safe(client), days, messages: msgs, unread: repo.unreadFor('client', client, msgs), ai: isMock() || isConfigured(), mock: isMock() };
  },
  async addMeal(body, { client }) {
    const r = await repo.addMeal(client, body.meal || {});
    return { meal: r.meal, day: r.day };
  },
  async updateMeal(body, { client }) { return { day: await repo.updateMeal(client.id, body.date, body.mealId, body.patch || {}) }; },
  async deleteMeal(body, { client }) { return { day: await repo.deleteMeal(client.id, body.date, body.mealId) }; },
  async setBody(body, { client }) { return { day: await repo.setBody(client, body.date, body.body || {}), client: safe(client) }; },
  async sendMessage(body, { client }) { return { message: await repo.addMessage(client, 'client', body.text) }; },
  async markRead(body, { client }) { await repo.markRead(client, 'client'); return { ok: true }; },
  async analyze(body, { client }) {
    await useAi(client);
    return analyzeMeal(body);
  },
  async advice(body, { client }) {
    await useAi(client);
    return dayAdvice(body.input || {});
  }
};

export default router(actions, async (req) => {
  if (!getStore()) throw new AppError(503, '保存先の設定がまだです。コーチに連絡してください。');
  const client = await repo.clientByCode(bearer(req));
  if (!client) throw new AppError(401, '招待リンクが無効です。コーチに新しいリンクをもらってください。');
  return { client };
});
