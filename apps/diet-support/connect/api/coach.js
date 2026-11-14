/*
 * POST /api/coach  { action, ... }
 * コーチ用の操作。login 以外は、ログインで受け取ったトークンが必要（Authorization: Bearer）。
 */
import { router, AppError } from '../lib/http.js';
import { passwordMatches, issueCoachToken, verifyCoachToken, bearer, clientIp, secret } from '../lib/auth.js';
import { isConfigured, isMock } from '../lib/claude.js';
import { getStore } from '../lib/store.js';
import * as repo from '../lib/repo.js';
import { draftReply } from '../lib/ai.js';

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
function safe(c) { const o = Object.assign({}, c); delete o.inviteHash; return o; }
function noThumbs(days) { return days.map((d) => Object.assign({}, d, { meals: (d.meals || []).map((m) => Object.assign({}, m, { thumb: m.thumb ? true : null })) })); }

function requireAi() {
  if (!isMock() && !isConfigured()) throw new AppError(503, 'AI の設定がまだです。Vercel の環境変数に ANTHROPIC_API_KEY を登録してください。');
}

const PUBLIC = ['login'];

const actions = {
  async login(body, ctx, req) {
    if (!process.env.COACH_PASSWORD) throw new AppError(503, 'コーチのパスワードが設定されていません。Vercel の環境変数に COACH_PASSWORD を登録してください。');
    if (!secret()) throw new AppError(503, 'SESSION_SECRET が設定されていません。Vercel の環境変数に登録してください。');
    const store = getStore();
    if (!store) throw new AppError(503, '保存先の設定がまだです。Vercel で Upstash Redis を追加してください。');
    // 15分間に10回まちがえたら、しばらく受け付けない
    const key = 'loginfail:' + clientIp(req);
    const fails = (await store.get(key)) || 0;
    if (fails >= 10) throw new AppError(429, 'ログインの失敗が続いたため、15分ほどお待ちください。');
    if (!passwordMatches(body.password)) {
      await store.incr(key, 900);
      throw new AppError(401, 'パスワードが違います。');
    }
    await store.del(key);
    return { token: issueCoachToken() };
  },

  async overview() {
    const t = today();
    const clients = await repo.listClients();
    const rows = await Promise.all(clients.map(async (c) => {
      const days = await repo.getDays(c.id, minus(t, 7), t);
      const msgs = await repo.listMessages(c.id, 50);
      return { client: safe(c), days: noThumbs(days), unread: repo.unreadFor('coach', c, msgs), watch: repo.watchList(days, t), lastMessage: msgs[msgs.length - 1] || null };
    }));
    return { today: t, clients: rows };
  },

  async createClient(body) {
    const { client, code } = await repo.createClient(body.profile || {});
    return { client: safe(client), inviteCode: code };
  },

  async client(body) {
    const t = today();
    const c = await repo.getClient(body.id);
    const days = await repo.getDays(c.id, minus(t, 29), t);
    const msgs = await repo.listMessages(c.id, 100);
    // 写真は直近14日分だけ送る（通信量を抑えるため）
    const cut = minus(t, 13);
    const out = days.map((d) => d.date >= cut ? d : noThumbs([d])[0]);
    return { today: t, client: safe(c), days: out, messages: msgs, unread: repo.unreadFor('coach', c, msgs), watch: repo.watchList(days, t) };
  },

  async updateClient(body) { return { client: safe(await repo.updateClient(body.id, body.profile || {})) }; },
  async resetInvite(body) { return { inviteCode: await repo.resetInvite(body.id) }; },
  async deleteClient(body) { await repo.deleteClient(body.id); return { ok: true }; },

  async sendMessage(body) {
    const c = await repo.getClient(body.id);
    return { message: await repo.addMessage(c, 'coach', body.text, body.meta) };
  },

  async templates() { return { templates: await repo.listTemplates() }; },
  async saveTemplate(body) { return { template: await repo.saveTemplate(body.template || {}) }; },
  async deleteTemplate(body) { await repo.deleteTemplate(body.id); return { ok: true }; },

  async markRead(body) {
    const c = await repo.getClient(body.id);
    await repo.markRead(c, 'coach');
    return { ok: true };
  },

  async updateMeal(body) {
    await repo.getClient(body.id);
    return { day: await repo.updateMeal(body.id, body.date, body.mealId, body.patch || {}) };
  },

  async draftReply(body) {
    requireAi();
    const t = today();
    const c = await repo.getClient(body.id);
    const days = await repo.getDays(c.id, minus(t, 2), t);
    const msgs = await repo.listMessages(c.id, 8);
    const input = {
      呼び名: repo.displayName(c),
      今日: t,
      ダイエットの目的: c.goalNote || '',
      目標: body.targets || null,
      コーチのメモ: c.coachMemo || '',
      最近の記録: days.map((d) => ({
        日付: d.date,
        食事: (d.meals || []).map((m) => ({ 種類: m.type, 料理: m.dish, エネルギー: m.totals.kcal + 'kcal', たんぱく質: m.totals.protein_g + 'g', 塩分: m.totals.salt_g + 'g', メモ: m.memo || '' })),
        体の記録: d.body || {}
      })),
      最近のやり取り: msgs.map((m) => ({ 送った人: m.from === 'coach' ? 'コーチ' : 'クライアント', 内容: m.text })),
      コーチからの指示: String(body.instruction || '').slice(0, 300)
    };
    return draftReply(input);
  }
};

export default router(actions, async (req, body) => {
  if (PUBLIC.indexOf(body.action) !== -1) return {};
  if (!secret()) throw new AppError(503, 'SESSION_SECRET が設定されていません。');
  if (!verifyCoachToken(bearer(req))) throw new AppError(401, 'ログインしてください。');
  return {};
});
