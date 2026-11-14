#!/usr/bin/env python3
"""日本語表示のチェック。アプリの文字を変えたら実行する。

  python3 tools/check_japanese.py

確認すること
1. 画面に出る文字が、日本語の標準的な文字（Shift_JISで表せる文字）だけか
   絵文字や一部の記号は、端末によって□に化けたり中国語のフォントで描かれたりする
2. 画面に出る文字が、同梱の日本語フォントにすべて入っているか
   入っていない文字は端末のフォントで描かれ、字形がそろわなくなる
   足りない場合は tools/make_font_subset.sh でフォントを作り直す
"""
import re, sys
from pathlib import Path
from fontTools.ttLib import TTFont

root = Path(__file__).resolve().parent.parent
src = (root / 'index.html').read_text(encoding='utf-8')
# コメントは画面に出ないので除外。旧データの読み込みに使う「—」も画面には出ない
body = re.sub(r'/\*.*?\*/', '', src, flags=re.S)
body = re.sub(r'(?m)^\s*//.*$', '', body)
body = re.sub(r'\s//[^\n\'"`]*$', '', body, flags=re.M)
body = body.replace("s.inning!=='—'", '')
chars = {c for c in body if ord(c) > 0x7f and c != '﻿'}

ng = 0
non_jis = sorted(c for c in chars if not c.encode('cp932', errors='ignore'))
if non_jis:
    ng = 1
    print('NG 日本語の標準外の文字:', ' '.join(f'{c}(U+{ord(c):04X})' for c in non_jis))

for name in ['NotoSansJP-subset-Regular.woff2', 'NotoSansJP-subset-Bold.woff2']:
    cmap = TTFont(root / 'fonts' / name).getBestCmap()
    missing = sorted(c for c in chars if ord(c) not in cmap)
    if missing:
        ng = 1
        print(f'NG {name} に無い文字:', ''.join(missing))

print('OK 文字の種類', len(chars)) if not ng else None
sys.exit(ng)
