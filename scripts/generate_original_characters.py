"""오리지널 캐릭터 PNG 준비.

우선순위:
1) Cursor 생성본 JPG가 assets에 있으면 import_generated_characters.py 로 변환
2) 없으면 간단한 절차적 픽셀 초상화로 폴백
"""
from __future__ import annotations

from collections import deque
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "frontend" / "public" / "assets" / "characters"
ASSETS = Path(r"C:\Users\USER\.cursor\projects\c-Users-USER-OneDrive-IT-rezero\assets")
OUT = 512
CONTENT = 0.90

GENERATED = [
    ("char1", ASSETS / "orig-char1-sepi.jpg"),
    ("char2", ASSETS / "orig-char2-nox.jpg"),
    ("char3", ASSETS / "orig-char3-ark.jpg"),
    ("char4", ASSETS / "orig-char4-sol.jpg"),
]


def is_bg(r: int, g: int, b: int) -> bool:
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


def procedural_fallback(cid: str) -> Image.Image:
    """생성본이 없을 때만 쓰는 단순 오리지널 실루엣."""
    palettes = {
        "char1": ((120, 230, 255), (40, 90, 160), (255, 220, 90)),
        "char2": ((150, 100, 220), (50, 30, 80), (200, 120, 255)),
        "char3": ((70, 160, 140), (50, 90, 100), (240, 190, 70)),
        "char4": ((255, 120, 40), (160, 40, 40), (255, 220, 80)),
    }
    hair, body, accent = palettes[cid]
    im = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.ellipse([16, 36, 47, 60], fill=(*body, 255))
    d.ellipse([18, 10, 45, 42], fill=(*hair, 255))
    d.ellipse([22, 18, 41, 40], fill=(255, 220, 190, 255))
    d.rectangle([26, 26, 28, 29], fill=(40, 40, 60, 255))
    d.rectangle([35, 26, 37, 29], fill=(40, 40, 60, 255))
    d.ellipse([28, 46, 35, 53], fill=(*accent, 255))
    return im.resize((OUT, OUT), Image.Resampling.NEAREST)


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for cid, src in GENERATED:
        if src.exists():
            im = center(flood_alpha(Image.open(src)))
            print("import", cid, src.name)
        else:
            im = procedural_fallback(cid)
            print("fallback", cid)
        path = OUT_DIR / f"{cid}.png"
        im.save(path, "PNG", optimize=True)
        print("ok", path.name)


if __name__ == "__main__":
    main()
