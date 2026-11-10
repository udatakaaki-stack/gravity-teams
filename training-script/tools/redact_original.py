import sys, pymupdf as f
src, out, thumb, fontfile = sys.argv[1:5]
inserts = []
d = f.open(src)
for pno, word, repl in [(0, "宇田", ""), (0, "高明", ""), (1, "宇田", "〇〇"), (42, "宇田", "〇〇"), (48, "宇田", "〇〇")]:
    p = d[pno]
    for r in p.search_for(word):
        # 元の文字の大きさと色を拾う
        size, color = 10.5, (0.11, 0.15, 0.2)
        for b in p.get_text("dict", clip=r)["blocks"]:
            for l in b.get("lines", []):
                for s in l["spans"]:
                    if word[0] in s["text"]:
                        size = s["size"]; c = s["color"]
                        color = ((c >> 16 & 255) / 255, (c >> 8 & 255) / 255, (c & 255) / 255)
        p.add_redact_annot(r, fill=False)
        if repl:
            inserts.append((pno, r, repl, size, color))
    p.apply_redactions(images=f.PDF_REDACT_IMAGE_NONE, graphics=f.PDF_REDACT_LINE_ART_NONE)
for pno, r, repl, size, color in inserts:
    d[pno].insert_text((r.x0, r.y1 - (r.height - size) / 2 - size * 0.12), repl, fontsize=size,
                       fontname="ipag", fontfile=fontfile, color=color)
# 2ページ目の表紙スライド画像を、名前を消した画像に差し替える
p = d[1]
xref = p.get_images()[0][0]
p.replace_image(xref, filename=thumb)
d.save(out, garbage=4, deflate=True)
