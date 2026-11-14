// お試し版（connect/demo）を作る
//   node scripts/build-demo.mjs
// public の画面をそのまま写し、サーバーの代わりをする demo-backend.js を最初に読み込ませます。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'public');
const out = path.join(root, 'demo');
const TAG = '<script src="js/demo-backend.js"></script>';

fs.rmSync(out, { recursive: true, force: true });
fs.cpSync(src, out, { recursive: true });
fs.rmSync(path.join(out, 'sw.js'), { force: true });
fs.copyFileSync(path.join(root, 'demo-src', 'demo-backend.js'), path.join(out, 'js', 'demo-backend.js'));
fs.copyFileSync(path.join(root, 'demo-src', 'index.html'), path.join(out, 'index.html'));

for (const name of ['index.html', 'app.html', 'coach.html']) {
  const f = path.join(out, name);
  let html = fs.readFileSync(f, 'utf8');
  if (!html.includes('</head>')) throw new Error(name + ' に </head> がありません');
  html = html.replace('</head>', '  ' + TAG + '\n</head>');
  fs.writeFileSync(f, html);
}
console.log('お試し版を作成しました: ' + path.relative(process.cwd(), out));
