from PIL import Image
from pathlib import Path

out = Path(__file__).resolve().parents[1] / "frontend" / "public" / "assets" / "characters"
out.mkdir(parents=True, exist_ok=True)

s1 = Image.open(
    r"C:\Users\USER\.cursor\projects\c-Users-USER-OneDrive-IT-rezero\assets\_____2026-11-04_042350-90ed7a50-e8fc-4ab5-a195-91f358520b40.png"
).convert("RGBA")
s2 = Image.open(
    r"C:\Users\USER\.cursor\projects\c-Users-USER-OneDrive-IT-rezero\assets\_____2026-11-04_042402-79dc3e27-8065-4ebf-be40-8c0b6a976820.png"
).convert("RGBA")

cw1, ch1 = s1.width / 5, s1.height / 3
cw2, ch2 = s2.width / 5, s2.height / 2


def crop_cell(im, col, row, cw, ch, portrait_ratio=0.72):
    x0 = int(col * cw)
    y0 = int(row * ch)
    x1 = int((col + 1) * cw)
    y1 = int(y0 + ch * portrait_ratio)
    pad = 2
    return im.crop((x0 + pad, y0 + pad, x1 - pad, y1))


picks = [
    ("char1", crop_cell(s1, 1, 0, cw1, ch1), "에밀리아"),
    ("char2", crop_cell(s1, 3, 0, cw1, ch1), "렘"),
    ("char3", crop_cell(s1, 0, 2, cw1, ch1), "라인하르트"),
    ("char4", crop_cell(s2, 1, 0, cw2, ch2), "프리실라"),
]

preview = Path(r"C:\Users\USER\.cursor\projects\c-Users-USER-OneDrive-IT-rezero\assets\char_preview")
preview.mkdir(parents=True, exist_ok=True)

for cid, img, name in picks:
    big = img.resize((256, 256), Image.Resampling.LANCZOS)
    path = out / f"{cid}.png"
    big.save(path, "PNG")
    big.save(preview / f"{cid}_{name}.png", "PNG")
    print(cid, name, img.size, "->", path)

print("done")
