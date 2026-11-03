"""캐릭터 PNG: 가장자리 연결 흰 배경 투명화 + 정사각 중앙 균일 배치."""
from __future__ import annotations

from collections import deque
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
CHAR_DIR = ROOT / "frontend" / "public" / "assets" / "characters"
OUT_SIZE = 256
CONTENT_RATIO = 0.9

# 안티앨리어싱 회색 링까지 포함해 flood (피부/은발은 chroma로 보호)
BG_LUMA = 232
BG_CHROMA = 14


def is_bg(r: int, g: int, b: int, a: int) -> bool:
    if a < 8:
        return True
    mx, mn = max(r, g, b), min(r, g, b)
    luma = 0.299 * r + 0.587 * g + 0.114 * b
    return luma >= BG_LUMA and (mx - mn) <= BG_CHROMA


def flood_clear_white(im: Image.Image) -> Image.Image:
    w, h = im.size
    px = im.load()
    visited = [[False] * w for _ in range(h)]
    q: deque[tuple[int, int]] = deque()

    def try_push(x: int, y: int) -> None:
        if x < 0 or y < 0 or x >= w or y >= h or visited[y][x]:
            return
        r, g, b, a = px[x, y]
        if not is_bg(r, g, b, a):
            return
        visited[y][x] = True
        q.append((x, y))

    for x in range(w):
        try_push(x, 0)
        try_push(x, h - 1)
    for y in range(h):
        try_push(0, y)
        try_push(w - 1, y)

    while q:
        x, y = q.popleft()
        px[x, y] = (0, 0, 0, 0)
        try_push(x + 1, y)
        try_push(x - 1, y)
        try_push(x, y + 1)
        try_push(x, y - 1)

    # 투명에 맞닿은 잔여 밝은 배경을 몇 바퀴 더 깎음
    for _ in range(6):
        victims: list[tuple[int, int]] = []
        for y in range(h):
            for x in range(w):
                r, g, b, a = px[x, y]
                if a == 0 or not is_bg(r, g, b, a):
                    continue
                for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                    if 0 <= nx < w and 0 <= ny < h and px[nx, ny][3] == 0:
                        victims.append((x, y))
                        break
        if not victims:
            break
        for x, y in victims:
            px[x, y] = (0, 0, 0, 0)

    # 가장자리 흰색 헤일로: 투명 이웃이 있으면 알파를 낮춤
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            mx, mn = max(r, g, b), min(r, g, b)
            luma = 0.299 * r + 0.587 * g + 0.114 * b
            if luma < 220 or (mx - mn) > 20:
                continue
            touch = False
            for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                if 0 <= nx < w and 0 <= ny < h and px[nx, ny][3] == 0:
                    touch = True
                    break
            if touch:
                px[x, y] = (r, g, b, max(0, a // 3))

    return im


def opaque_bbox(im: Image.Image, alpha_min: int = 16) -> tuple[int, int, int, int] | None:
    alpha = im.split()[-1]
    mask = alpha.point(lambda v: 255 if v >= alpha_min else 0)
    return mask.getbbox()


def center_on_canvas(im: Image.Image) -> Image.Image:
    bbox = opaque_bbox(im)
    if not bbox:
        return Image.new("RGBA", (OUT_SIZE, OUT_SIZE), (0, 0, 0, 0))

    cropped = im.crop(bbox)
    cw, ch = cropped.size
    side = max(cw, ch)
    target = int(OUT_SIZE * CONTENT_RATIO)
    scale = target / side
    nw = max(1, int(round(cw * scale)))
    nh = max(1, int(round(ch * scale)))
    resized = cropped.resize((nw, nh), Image.Resampling.LANCZOS)

    canvas = Image.new("RGBA", (OUT_SIZE, OUT_SIZE), (0, 0, 0, 0))
    ox = (OUT_SIZE - nw) // 2
    oy = (OUT_SIZE - nh) // 2
    canvas.paste(resized, (ox, oy), resized)
    return canvas


def recrop_from_sheets() -> dict[str, Image.Image]:
    s1 = Image.open(
        r"C:\Users\USER\.cursor\projects\c-Users-USER-OneDrive-IT-rezero\assets\_____2026-11-04_042350-90ed7a50-e8fc-4ab5-a195-91f358520b40.png"
    ).convert("RGBA")
    s2 = Image.open(
        r"C:\Users\USER\.cursor\projects\c-Users-USER-OneDrive-IT-rezero\assets\_____2026-11-04_042402-79dc3e27-8065-4ebf-be40-8c0b6a976820.png"
    ).convert("RGBA")
    cw1, ch1 = s1.width / 5, s1.height / 3
    cw2, ch2 = s2.width / 5, s2.height / 2

    def cell(im: Image.Image, col: int, row: int, cw: float, ch: float, ratio: float = 0.68) -> Image.Image:
        # ratio를 낮춰 하단 이름 라벨이 들어가지 않게
        x0 = int(col * cw) + 2
        y0 = int(row * ch) + 2
        x1 = int((col + 1) * cw) - 2
        y1 = int(y0 + ch * ratio)
        return im.crop((x0, y0, x1, y1)).resize((OUT_SIZE, OUT_SIZE), Image.Resampling.LANCZOS)

    return {
        "char1": cell(s1, 1, 0, cw1, ch1),
        "char2": cell(s1, 3, 0, cw1, ch1),
        "char3": cell(s1, 0, 2, cw1, ch1),
        "char4": cell(s2, 1, 0, cw2, ch2),
    }


def main() -> None:
    CHAR_DIR.mkdir(parents=True, exist_ok=True)
    for cid, im in recrop_from_sheets().items():
        im = flood_clear_white(im)
        im = center_on_canvas(im)
        path = CHAR_DIR / f"{cid}.png"
        im.save(path, "PNG")
        rem = sum(
            1
            for p in im.getdata()
            if p[3] > 0 and p[0] >= 245 and p[1] >= 245 and p[2] >= 245 and max(p[:3]) - min(p[:3]) <= 8
        )
        print("ok", path.name, "bbox", opaque_bbox(im), "pureWhiteLeft", rem)


if __name__ == "__main__":
    main()
