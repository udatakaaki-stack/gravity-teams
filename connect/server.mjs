/*
 * ローカル確認用のサーバー（Vercel と同じ api/ の関数を動かす）
 *   npm run dev   … 本物の Claude API を使う（ANTHROPIC_API_KEY が必要）
 *   npm run demo  … AI を使わないデモモード（コーチのパスワードは demo）
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import coach from './api/coach.js';
import client from './api/client.js';
import health from './api/health.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const pub = path.join(here, 'public');
const PORT = Number(process.env.PORT || 3000);
const routes = { '/api/coach': coach, '/api/client': client, '/api/health': health };
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml' };

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (routes[url.pathname]) return routes[url.pathname](req, res);
  let file = path.normalize(path.join(pub, decodeURIComponent(url.pathname)));
  if (!file.startsWith(pub)) { res.statusCode = 403; return res.end(); }
  if (url.pathname.endsWith('/')) file = path.join(file, 'index.html');
  fs.readFile(file, (err, data) => {
    if (err) { res.statusCode = 404; return res.end('not found'); }
    res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
    res.end(data);
  });
}).listen(PORT, () => {
  console.log('http://localhost:' + PORT + (process.env.MEAL_AI_MOCK === '1' ? '（デモモード：コーチのパスワードは demo）' : ''));
});
