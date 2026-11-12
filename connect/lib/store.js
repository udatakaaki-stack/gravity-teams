/*
 * データの保存先
 *
 * - 本番（Vercel）：Upstash Redis（REST API）
 *     環境変数 KV_REST_API_URL / KV_REST_API_TOKEN（Vercel の Marketplace から追加した場合）
 *     または UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN
 * - 手元での確認：.data/store.json に保存（Vercel では使えない）
 * - 自動テスト：メモリ
 *
 * どれも同じ使い方（get / set / del / sadd / srem / smembers / rpush / lrange / incr）になるようにしている。
 * 値は JSON にして保存する。
 */
import fs from 'node:fs';
import path from 'node:path';

// ------------------------------------------------------------------
// Upstash Redis（REST）
// ------------------------------------------------------------------
export class UpstashStore {
  constructor(url, token, fetchImpl) {
    this.url = url.replace(/\/$/, '');
    this.token = token;
    this.fetch = fetchImpl || globalThis.fetch;
  }
  async cmd(args) {
    const res = await this.fetch(this.url, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + this.token, 'Content-Type': 'application/json' },
      body: JSON.stringify(args)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.error) throw new Error('保存先でエラーが起きました：' + (data.error || res.status));
    return data.result;
  }
  async get(key) { const v = await this.cmd(['GET', key]); return v === null || v === undefined ? null : JSON.parse(v); }
  async set(key, value, ttlSeconds) {
    const args = ['SET', key, JSON.stringify(value)];
    if (ttlSeconds) args.push('EX', String(ttlSeconds));
    await this.cmd(args);
  }
  async del(key) { await this.cmd(['DEL', key]); }
  async sadd(key, member) { await this.cmd(['SADD', key, member]); }
  async srem(key, member) { await this.cmd(['SREM', key, member]); }
  async smembers(key) { return (await this.cmd(['SMEMBERS', key])) || []; }
  async rpush(key, value) { await this.cmd(['RPUSH', key, JSON.stringify(value)]); }
  async lrange(key, start, stop) { return ((await this.cmd(['LRANGE', key, String(start), String(stop)])) || []).map((v) => JSON.parse(v)); }
  async ltrim(key, start, stop) { await this.cmd(['LTRIM', key, String(start), String(stop)]); }
  async incr(key, ttlSeconds) {
    const n = await this.cmd(['INCR', key]);
    if (ttlSeconds && Number(n) === 1) await this.cmd(['EXPIRE', key, String(ttlSeconds)]);
    return Number(n);
  }
}

// ------------------------------------------------------------------
// メモリ（テスト用）とファイル（手元での確認用）
// ------------------------------------------------------------------
export class MemoryStore {
  constructor() { this.data = {}; this.exp = {}; }
  _alive(key) {
    if (this.exp[key] && this.exp[key] < Date.now()) { delete this.data[key]; delete this.exp[key]; }
    return key in this.data;
  }
  _changed() {}
  async get(key) { return this._alive(key) ? JSON.parse(this.data[key]) : null; }
  async set(key, value, ttlSeconds) {
    this.data[key] = JSON.stringify(value);
    if (ttlSeconds) this.exp[key] = Date.now() + ttlSeconds * 1000; else delete this.exp[key];
    this._changed();
  }
  async del(key) { delete this.data[key]; delete this.exp[key]; this._changed(); }
  async sadd(key, member) {
    const s = this._alive(key) ? JSON.parse(this.data[key]) : [];
    if (s.indexOf(member) === -1) s.push(member);
    this.data[key] = JSON.stringify(s);
    this._changed();
  }
  async srem(key, member) {
    if (!this._alive(key)) return;
    this.data[key] = JSON.stringify(JSON.parse(this.data[key]).filter((m) => m !== member));
    this._changed();
  }
  async smembers(key) { return this._alive(key) ? JSON.parse(this.data[key]) : []; }
  async rpush(key, value) {
    const l = this._alive(key) ? JSON.parse(this.data[key]) : [];
    l.push(value);
    this.data[key] = JSON.stringify(l);
    this._changed();
  }
  async lrange(key, start, stop) {
    const l = this._alive(key) ? JSON.parse(this.data[key]) : [];
    const n = l.length;
    const s = start < 0 ? Math.max(0, n + start) : start;
    const e = stop < 0 ? n + stop : Math.min(stop, n - 1);
    return l.slice(s, e + 1);
  }
  async ltrim(key, start, stop) {
    if (!this._alive(key)) return;
    this.data[key] = JSON.stringify(await this.lrange(key, start, stop));
    this._changed();
  }
  async incr(key, ttlSeconds) {
    const n = (this._alive(key) ? JSON.parse(this.data[key]) : 0) + 1;
    this.data[key] = JSON.stringify(n);
    if (ttlSeconds && n === 1) this.exp[key] = Date.now() + ttlSeconds * 1000;
    this._changed();
    return n;
  }
}

export class FileStore extends MemoryStore {
  constructor(file) {
    super();
    this.file = file;
    try {
      const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
      this.data = saved.data || {};
      this.exp = saved.exp || {};
    } catch (e) { /* まだファイルがない */ }
  }
  _changed() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(this.file, JSON.stringify({ data: this.data, exp: this.exp }));
  }
}

// ------------------------------------------------------------------
// 環境に合わせて保存先を選ぶ
// ------------------------------------------------------------------
let current = null;

export function storeKind() {
  if ((process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) || (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)) return 'upstash';
  if (process.env.VERCEL) return 'none'; // Vercel ではファイルに保存できない
  return 'file';
}

export function getStore() {
  if (current) return current;
  const kind = storeKind();
  if (kind === 'upstash') {
    current = new UpstashStore(process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL, process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN);
  } else if (kind === 'file') {
    current = new FileStore(path.join(process.cwd(), '.data', 'store.json'));
  } else {
    current = null;
  }
  return current;
}

// テストで保存先を差し替える
export function setStore(store) { current = store; }
