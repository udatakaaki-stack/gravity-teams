#!/usr/bin/env python3
"""claude.ai で表示・共有する「アーティファクト」用のページを index.html から作る。

  python3 tools/build_artifact.py 出力先.html

アーティファクトでは次の制限があるため、アプリ本体と少し変える
・ページの外側（<html><head><body>）は表示側が用意する → 取り除く
・同梱フォントのファイルを置けない → 同じ Noto 系の日本語フォント（Google Fonts の Noto Sans JP）を読み込む
・ファイル保存、AIへの通信、オフライン化（Service Worker）は使えない → window.TELL_EMBED で無効にする
・最初からサンプル投手を表示する（アプリ側で TELL_EMBED のときに自動で入る）
"""
import re, sys
from pathlib import Path

root = Path(__file__).resolve().parent.parent
out = Path(sys.argv[1]) if len(sys.argv) > 1 else root / 'tell-alert-artifact.html'
s = (root / 'index.html').read_text(encoding='utf-8').lstrip('﻿')

def cut(pattern, repl='', flags=0, count=1):
    global s
    s2, n = re.subn(pattern, repl, s, count=count, flags=flags)
    if n == 0:
        sys.exit(f'見つかりません: {pattern}')
    s = s2

cut(r'<!DOCTYPE html>\s*<html lang="ja">\s*<head>\s*')
cut(r'<meta charset="UTF-8">\s*<meta name="viewport"[^>]*>\s*')
cut(r'<meta name="theme-color"[^>]*>\s*')
cut(r'(<meta name="(apple-mobile|mobile-web)[^>]*>\s*)+')
cut(r'<link rel="manifest"[^>]*>\s*<link rel="icon"[^>]*>\s*<link rel="apple-touch-icon"[^>]*>\s*<link rel="preload"[^>]*>\s*')
cut(r'<title>TELL ALERT</title>\s*',
    '<title>TELL ALERT</title>\n<meta name="claude:viewport-fit-sides" content="cover">\n'
    '<link rel="preconnect" href="https://fonts.googleapis.com">\n'
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
    '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;700;900&display=swap">\n')
cut(r'@font-face\{font-family:"TellJP"[^}]*\}\s*@font-face\{font-family:"TellJP"[^}]*\}', '')
cut(r'font:15px/1.6 "TellJP",', 'font:15px/1.6 "Noto Sans JP",')
# 上部の帯：表示側が端末の切り欠き分の余白を付けるので、ヘッダーは top を切り欠き分ずらす
cut(r'\.hdr\{position:sticky;top:0;([^}]*?)padding:calc\(8px \+ env\(safe-area-inset-top\)\) 12px 8px;',
    r'.hdr{position:sticky;top:env(safe-area-inset-top,0px);\1padding:8px max(12px,env(safe-area-inset-right,0px)) 8px max(12px,env(safe-area-inset-left,0px));')
cut(r'</style>', 'body::before{content:"";position:fixed;inset:0 0 auto;height:env(safe-area-inset-top,0px);z-index:49;background:var(--bg)}\n</style>')
cut(r'</head>\s*<body>\s*')
# 表示側のページに lang が無くても、漢字を日本の字形で描くよう lang="ja" を付ける
cut(r'<div id="app"></div>\s*<div id="overlay"></div>\s*<div id="dialog"></div>\s*<div id="toast"',
    '<div lang="ja"><div id="app"></div>\n<div id="overlay"></div>\n<div id="dialog"></div>\n<div id="toast"')
cut(r'(<div id="toast"[^>]*></div>)', r'\1</div>')
cut(r'<script>\s*\'use strict\';',
    "<script>document.documentElement.lang='ja';window.TELL_EMBED=true;</script>\n<script>\n'use strict';")
cut(r'</body>\s*</html>\s*$', '')
out.write_text(s, encoding='utf-8')
print(out, len(s.encode()), 'bytes')
