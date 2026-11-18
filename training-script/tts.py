# -*- coding: utf-8 -*-
"""台本の読み上げ音声（練習用）を作る。  python3 tts.py

- この環境の中だけで動く Open JTalk を使う（台本を外部に送らない）
- 読むのは読み上げ文（say / key / draft）だけ。進行メモ・（ ）の動作指示・名前の記入欄は読まない
- 各スライドの前に「スライド○」と短く案内し、動画・実技の場面には長めの間を入れる
- パートごとの mp3 と、全体を通した mp3 を audio/ に書き出す
"""
import pathlib
import re
import subprocess
import tempfile

from content import PARTS, SLIDES

HERE = pathlib.Path(__file__).parent
OUT = HERE / "audio"
DIC = "/var/lib/mecab/dic/open-jtalk/naist-jdic"
VOICE = "/usr/share/hts-voice/nitech-jp-atr503-m001/nitech_jp_atr503_m001.htsvoice"
SPEED = 0.95          # 少しゆっくりめ
RATE = 48000

# 音声にするときだけ置き換える読み方（読み間違いを防ぐ）
READING = [
    ("2人組", "ふたり組"), ("〜", "から"), ("×", "かける"), ("・", "、"),
]


def clean(text):
    text = re.sub(r"（[^）]*）", "", text)       # 動作の指示などは読まない
    for a, b in READING:
        text = text.replace(a, b)
    return text.strip()


def silence(sec, path):
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-f", "lavfi", "-i",
                    f"anullsrc=r={RATE}:cl=mono", "-t", str(sec), "-sample_fmt", "s16", str(path)], check=True)


def speak(text, path):
    subprocess.run(["open_jtalk", "-x", DIC, "-m", VOICE, "-r", str(SPEED), "-s", str(RATE), "-ow", str(path)],
                   input=text.encode("utf-8"), check=True)


def main():
    OUT.mkdir(exist_ok=True)
    tmp = pathlib.Path(tempfile.mkdtemp())
    gap_s, gap_m, gap_l = tmp / "s.wav", tmp / "m.wav", tmp / "l.wav"
    silence(0.5, gap_s); silence(1.2, gap_m); silence(3.0, gap_l)
    n = 0
    part_files = []
    for num, name, start, end, (a, b), _ in PARTS:
        pieces = []
        head = tmp / f"h{num}.wav"
        speak(f"パート{'一二三四五六七'['①②③④⑤⑥⑦'.index(num)]}、{name}。", head)
        pieces += [head, gap_m]
        for s in SLIDES:
            if not a <= s["no"] <= b:
                continue
            n += 1
            label = tmp / f"n{s['no']}.wav"
            speak(f"スライド{s['no']}。", label)
            pieces += [label, gap_s]
            for kind, text in s["blocks"]:
                k = kind.rstrip("+")
                if k in ("say", "key", "draft"):
                    t = clean(text)
                    if t:
                        w = tmp / f"t{len(pieces)}.wav"
                        speak(t, w)
                        pieces += [w, gap_s]
                elif k == "qa":
                    q, ans = text.split("|")
                    w = tmp / f"t{len(pieces)}.wav"
                    speak(clean(f"質問。{q}　答え。{ans}"), w)
                    pieces += [w, gap_s]
                elif k == "note" and ("動画を再生" in text or "全員で" in text):
                    pieces.append(gap_l)    # 動画・実技の場面は長めの間
            pieces.append(gap_m)
        lst = tmp / f"list{num}.txt"
        lst.write_text("".join(f"file '{p}'\n" for p in pieces))
        idx = "①②③④⑤⑥⑦".index(num) + 1
        mp3 = OUT / f"{idx}_{name.split('・')[0]}.mp3"
        subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-f", "concat", "-safe", "0", "-i", str(lst),
                        "-ac", "1", "-c:a", "libmp3lame", "-b:a", "64k", str(mp3)], check=True)
        part_files.append(mp3)
        print(f"  {mp3.name}")
    lst = tmp / "all.txt"
    lst.write_text("".join(f"file '{p.resolve()}'\n" for p in part_files))
    full = OUT / "0_全体を通して.mp3"
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-f", "concat", "-safe", "0", "-i", str(lst),
                    "-c", "copy", str(full)], check=True)
    print(f"  {full.name}（スライド{n}枚分）")


if __name__ == "__main__":
    main()
