#!/usr/bin/env bash
# 同梱の日本語フォントを作り直す。
# 元フォント：Noto Sans CJK JP（Debian/Ubuntu なら apt-get install fonts-noto-cjk）
# 必要なもの：pip install fonttools brotli
# 入れる文字：英数字・かな・記号・JIS第1水準漢字・index.html に出てくる全文字
set -euo pipefail
cd "$(dirname "$0")/.."
SRC=${NOTO_DIR:-/usr/share/fonts/opentype/noto}
TMP=$(mktemp)
python3 - "$TMP" <<'PY'
import sys
chars = {chr(c) for c in range(0x20, 0x7f)}
for hi in range(0x81, 0x99):            # Shift_JIS 0x8140〜0x989E：記号・かな・第1水準漢字
    for lo in list(range(0x40, 0x7f)) + list(range(0x80, 0xfd)):
        if (hi << 8 | lo) >= 0x989f: continue
        try: chars.add(bytes([hi, lo]).decode('cp932'))
        except UnicodeDecodeError: pass
chars |= {c for c in open('index.html', encoding='utf-8').read() if ord(c) > 0x7f and c != '﻿'}
open(sys.argv[1], 'w', encoding='utf-8').write(''.join(sorted(chars)))
PY
for W in Regular Bold; do
  # TTCの0番が日本語版（JP）。1〜4番は韓国語・中国語版なので使わない
  pyftsubset "$SRC/NotoSansCJK-$W.ttc" --font-number=0 --text-file="$TMP" \
    --flavor=woff2 --layout-features='kern,palt,vert,locl' --no-hinting --desubroutinize \
    --name-IDs='*' --output-file="fonts/NotoSansJP-subset-$W.woff2"
done
rm -f "$TMP"
ls -la fonts/*.woff2
