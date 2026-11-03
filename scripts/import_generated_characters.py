"""GenerateImage JPG → 배경 투명 PNG로 변환해 char1~4에 배치."""
from __future__ import annotations

from collections import deque
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "frontend" / "public" / "assets" / "characters"
ASSETS = Path(r"C:\Users\USER\.cursor\projects\c-Users-USER-OneDrive-IT-rezero\assets")
OUT = 512
CONTENT = 0.90

SOURCES = [
    ("char1", ASSETS / "orig-char1-sepi.jpg"),
    ("char2", ASSETS / "orig-char2-nox.jpg"),
    ("char3", ASSETS / "orig-char3-ark.jpg"),
    ("char4", ASSETS / "orig-char4-sol.jpg"),
]


def is_bg(r: int, g: int, b: int) -> bool:
    # 중간 회색~밝은 회색 배경
    mx, mn = max(r, g, b), min(r, g, b)
    if mx - mn > 28:
        return False
    return 70 <= ((r + g + b) / 3) <= 210


def flood_alpha(im: Image.Image) -> Image.Image:
    im = im.convert("RGBA")
    w, h = im.size
    px = im.load()
    visited = [[False] * w for _ in range(h)]
    q: deque[tuple[int, int]] = deque()

    def push(x: int, y: int) -> None:
        if x < 0 or y < 0 or x >= w or y >= h or visited[y][x]:
            return
        r, g, b, _ = px[x, y]
        if not is_bg(r, g, b):
            return
        visited[y][x] = True
        q.append((x, y))

    for x in range(w):
        push(x, 0)
        push(x, h - 1)
    for y in range(h):
        push(0, y)
        push(w - 1, y)

    while q:
        x, y = q.popleft()
        px[x, y] = (0, 0, 0, 0)
        push(x + 1, y)
        push(x - 1, y)
        push(x, y + 1)
        push(x, y - 1)

    # 가장자리 회색 잔여 페더
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0 or not is_bg(r, g, b):
                continue
            for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                if 0 <= nx < w and 0 <= ny < h and px[nx, ny][3] == 0:
                    px[x, y] = (r, g, b, 0)
                    break
    return im


def center(im: Image.Image) -> Image.Image:
    alpha = im.split()[-1]
    bbox = alpha.point(lambda v: 255 if v >= 16 else 0).getbbox()
    if not bbox:
        return Image.new("RGBA", (OUT, OUT), (0, 0, 0, 0))
    crop = im.crop(bbox)
    cw, ch = crop.size
    scale = (OUT * CONTENT) / max(cw, ch)
    nw, nh = max(1, int(round(cw * scale))), max(1, int(round(ch * scale)))
    resized = crop.resize((nw, nh), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (OUT, OUT), (0, 0, 0, 0))
    canvas.paste(resized, ((OUT - nw) // 2, (OUT - nh) // 2), resized)
    return canvas


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for cid, src in SOURCES:
        im = Image.open(src)
        im = flood_alpha(im)
        im = center(im)
        path = OUT_DIR / f"{cid}.png"
        im.save(path, "PNG", optimize=True)
        print("ok", path.name, im.size)


if __name__ == "__main__":
    main()
