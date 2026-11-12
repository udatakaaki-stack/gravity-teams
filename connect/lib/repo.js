/*
 * データの読み書き
 *
 * 保存のしかた（キー）
 *   clients            … クライアントIDの集合
 *   client:{id}        … クライアントのプロフィール
 *   invite:{hash}      … 招待コードのハッシュ → クライアントID
 *   days:{id}          … 記録がある日付の集合
 *   day:{id}:{日付}    … その日の記録（食事・体の記録）
 *   msgs:{id}          … メッセージ（新しいものを最大300件）
 */
import crypto from 'node:crypto';
import { getStore } from './store.js';
import { newInviteCode, hashCode } from './auth.js';
import { AppError } from './claude.js';
import { cleanItems, totalsOf } from './ai.js';

const MAX_MESSAGES = 300;
const PROFILE_KEYS = ['name', 'honorific', 'sex', 'age', 'height', 'weight', 'goalWeight', 'activity', 'pace', 'startDate', 'goalNote', 'coachMemo', 'tone'];
const MEAL_TYPES = ['朝食', '昼食', '夕食', '間食'];
const MOODS = ['good', 'normal', 'tired', 'anxious', 'down'];

function db() {
  const s = getStore();
  if (!s) throw new AppError(503, '保存先の設定がまだです。Vercel で Upstash Redis を追加してください。');
  return s;
}

function str(v, max) { return String(v === undefined || v === null ? '' : v).trim().slice(0, max); }
function isDate(s) { return /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')); }
function newId(prefix) { return prefix + crypto.randomBytes(8).toString('hex'); }

function cleanProfile(input) {
  const p = {};
  PROFILE_KEYS.forEach((k) => { if (input[k] !== undefined) p[k] = str(input[k], k === 'coachMemo' ? 1000 : k === 'goalNote' ? 200 : 40); });
  if (p.honorific === undefined && input.name !== undefined) p.honorific = 'さん';
  return p;
}

// 呼び名＋敬称
export function displayName(c) {
  const n = c && c.name ? c.name : 'クライアント';
  return n + (c && c.honorific !== undefined ? c.honorific : 'さん');
}

// ------------------------------------------------------------------
// クライアント
// ------------------------------------------------------------------
export async function createClient(input) {
  const s = db();
  const id = newId('c');
  const code = newInviteCode();
  const now = new Date().toISOString();
  const client = Object.assign({ honorific: 'さん', sex: 'female', activity: 'low', pace: 'gentle' }, cleanProfile(input), {
    id, createdAt: now, inviteHash: hashCode(code), coachReadAt: now, clientReadAt: now, lastActivityAt: null
  });
  if (!client.name) throw new AppError(400, 'お名前（呼び名）を入力してください。');
  await s.set('client:' + id, client);
  await s.set('invite:' + client.inviteHash, id);
  await s.sadd('clients', id);
  return { client, code };
}

export async function getClient(id) {
  const c = await db().get('client:' + id);
  if (!c) throw new AppError(404, 'クライアントが見つかりません。');
  return c;
}

export async function listClients() {
  const ids = await db().smembers('clients');
  const list = await Promise.all(ids.map((id) => db().get('client:' + id)));
  return list.filter(Boolean).sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
}

export async function updateClient(id, patch) {
  const c = await getClient(id);
  Object.assign(c, cleanProfile(patch));
  await db().set('client:' + id, c);
  return c;
}

export async function deleteClient(id) {
  const s = db();
  const c = await getClient(id);
  const days = await s.smembers('days:' + id);
  await Promise.all(days.map((d) => s.del('day:' + id + ':' + d)));
  await s.del('days:' + id);
  await s.del('msgs:' + id);
  await s.del('invite:' + c.inviteHash);
  await s.del('client:' + id);
  await s.srem('clients', id);
}

export async function resetInvite(id) {
  const s = db();
  const c = await getClient(id);
  await s.del('invite:' + c.inviteHash);
  const code = newInviteCode();
  c.inviteHash = hashCode(code);
  await s.set('client:' + id, c);
  await s.set('invite:' + c.inviteHash, id);
  return code;
}

export async function clientByCode(code) {
  if (!code || code.length < 20) return null;
  const id = await db().get('invite:' + hashCode(code));
  if (!id) return null;
  return db().get('client:' + id);
}

async function touch(c, field) {
  c[field] = new Date().toISOString();
  await db().set('client:' + c.id, c);
}

// ------------------------------------------------------------------
// 日ごとの記録
// ------------------------------------------------------------------
function emptyDay(date) { return { date, meals: [], body: {} }; }

export async function getDay(id, date) {
  return (await db().get('day:' + id + ':' + date)) || emptyDay(date);
}

async function saveDay(id, day) {
  day.updatedAt = new Date().toISOString();
  await db().set('day:' + id + ':' + day.date, day);
  await db().sadd('days:' + id, day.date);
}

/** from〜to（両端を含む）の記録がある日を新しい順に返す */
export async function getDays(id, from, to) {
  const dates = (await db().smembers('days:' + id)).filter((d) => d >= from && d <= to).sort().reverse();
  return (await Promise.all(dates.map((d) => db().get('day:' + id + ':' + d)))).filter(Boolean);
}

function cleanThumb(t) {
  const v = String(t || '');
  return /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(v) && v.length < 80000 ? v : null;
}

export async function addMeal(client, input) {
  const date = isDate(input.date) ? input.date : null;
  if (!date) throw new AppError(400, '日付が正しくありません。');
  const items = cleanItems(input.items);
  if (!items.length) throw new AppError(400, '料理を1つ以上入力してください。');
  const meal = {
    id: newId('m'),
    time: /^\d{2}:\d{2}$/.test(input.time) ? input.time : '',
    type: MEAL_TYPES.indexOf(input.type) !== -1 ? input.type : '間食',
    dish: str(input.dish, 60) || items[0].name || '食事',
    items,
    totals: totalsOf(items),
    confidence: ['high', 'medium', 'low'].indexOf(input.confidence) !== -1 ? input.confidence : null,
    good: (input.good || []).slice(0, 5).map((x) => str(x, 200)),
    cautions: (input.cautions || []).slice(0, 5).map((x) => str(x, 200)),
    tags: (input.tags || []).slice(0, 6).map((x) => str(x, 20)),
    memo: str(input.memo, 300),
    thumb: cleanThumb(input.thumb),
    demo: !!input.demo,
    createdAt: new Date().toISOString()
  };
  const day = await getDay(client.id, date);
  day.meals.push(meal);
  await saveDay(client.id, day);
  await touch(client, 'lastActivityAt');
  return { meal, day };
}

export async function updateMeal(clientId, date, mealId, patch) {
  const day = await getDay(clientId, date);
  const m = day.meals.find((x) => x.id === mealId);
  if (!m) throw new AppError(404, '食事の記録が見つかりません。');
  if (patch.items) { m.items = cleanItems(patch.items); m.totals = totalsOf(m.items); }
  if (patch.dish !== undefined) m.dish = str(patch.dish, 60) || m.dish;
  if (patch.type && MEAL_TYPES.indexOf(patch.type) !== -1) m.type = patch.type;
  await saveDay(clientId, day);
  return day;
}

export async function deleteMeal(clientId, date, mealId) {
  const day = await getDay(clientId, date);
  const before = day.meals.length;
  day.meals = day.meals.filter((x) => x.id !== mealId);
  if (day.meals.length === before) throw new AppError(404, '食事の記録が見つかりません。');
  await saveDay(clientId, day);
  return day;
}

export async function setBody(client, date, input) {
  if (!isDate(date)) throw new AppError(400, '日付が正しくありません。');
  const day = await getDay(client.id, date);
  const b = day.body || {};
  const w = parseFloat(input.weight);
  if (input.weight !== undefined) { if (!isNaN(w) && w >= 20 && w <= 300) b.weight = Math.round(w * 10) / 10; else if (input.weight === '' || input.weight === null) delete b.weight; }
  const sl = parseFloat(input.sleep);
  if (input.sleep !== undefined) { if (!isNaN(sl) && sl >= 0 && sl <= 24) b.sleep = sl; else if (input.sleep === '' || input.sleep === null) delete b.sleep; }
  if (input.mood !== undefined) { if (MOODS.indexOf(input.mood) !== -1) b.mood = input.mood; else delete b.mood; }
  if (input.memo !== undefined) b.memo = str(input.memo, 300);
  day.body = b;
  await saveDay(client.id, day);
  // いちばん新しい体重をプロフィールにも反映（目標の計算に使う）
  if (b.weight) {
    const latest = (await db().smembers('days:' + client.id)).sort().pop();
    if (latest === date) { client.weight = String(b.weight); }
  }
  await touch(client, 'lastActivityAt');
  return day;
}

// ------------------------------------------------------------------
// メッセージ
// ------------------------------------------------------------------
export async function addMessage(client, from, text) {
  const t = str(text, 2000);
  if (!t) throw new AppError(400, 'メッセージを入力してください。');
  const msg = { id: newId('t'), from: from === 'coach' ? 'coach' : 'client', text: t, at: new Date().toISOString() };
  await db().rpush('msgs:' + client.id, msg);
  await db().ltrim('msgs:' + client.id, -MAX_MESSAGES, -1);
  await touch(client, from === 'coach' ? 'coachReadAt' : 'clientReadAt');
  return msg;
}

export async function listMessages(id, n) {
  return db().lrange('msgs:' + id, -(n || 100), -1);
}

export async function markRead(client, who) {
  await touch(client, who === 'coach' ? 'coachReadAt' : 'clientReadAt');
}

export function unreadFor(who, client, msgs) {
  const since = who === 'coach' ? client.coachReadAt : client.clientReadAt;
  const other = who === 'coach' ? 'client' : 'coach';
  return msgs.filter((m) => m.from === other && (!since || m.at > since)).length;
}

// ------------------------------------------------------------------
// コーチが気にかけたいこと
// ------------------------------------------------------------------
const URGENT_WORDS = ['めまい', 'ふらつ', '動悸', '吐き気', '生理が止ま', '生理が来な', '食べられな', '吐いて', '吐いた', '死にたい', '消えたい'];

function addDays(s, n) {
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(y, m - 1, d, 12);
  dt.setDate(dt.getDate() + n);
  return dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0');
}

/** 直近の記録から、注意を返す。days は新しい順 */
export function watchList(days, today) {
  const out = [];
  const recent = days.filter((d) => d.date >= addDays(today, -2));
  const text = recent.map((d) => [(d.body && d.body.memo) || ''].concat((d.meals || []).map((m) => m.memo || '')).join(' ')).join(' ');
  const hits = URGENT_WORDS.filter((w) => text.indexOf(w) !== -1);
  if (hits.length) out.push({ level: 'urgent', text: '体調やつらい気持ちを示す言葉があります（' + hits.join('、') + '）' });
  const withRecord = days.filter((d) => (d.meals && d.meals.length) || (d.body && Object.keys(d.body).length));
  const last = withRecord.length ? withRecord[0].date : null;
  if (!last) out.push({ level: 'info', text: 'まだ記録がありません' });
  else if (last < addDays(today, -2)) out.push({ level: 'warn', text: '最後の記録から3日以上たっています' });
  const moods = recent.map((d) => d.body && d.body.mood).filter((m) => m === 'down' || m === 'anxious');
  if (moods.length >= 2) out.push({ level: 'warn', text: '気持ちが沈んだ記録が続いています' });
  const ws = days.filter((d) => d.body && d.body.weight).map((d) => ({ date: d.date, w: d.body.weight }));
  if (ws.length >= 2) {
    const latest = ws[0];
    const prev = ws.slice(1).filter((x) => x.date >= addDays(latest.date, -7));
    if (prev.length) {
      const min = Math.min.apply(null, prev.map((x) => x.w));
      if (latest.w - min >= 1) out.push({ level: 'info', text: '体重が1週間で1kg以上増えています（水分などの影響もあり得ます）' });
    }
  }
  return out;
}
