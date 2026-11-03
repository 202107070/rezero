"""캐릭터 PNG: 흰 배경 투명화 + 업스케일/선명·명암 보정 + 중앙 균일 배치."""
from __future__ import annotations

from collections import deque
from pathlib import Path

from PIL import Image, ImageEnhance, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
CHAR_DIR = ROOT / "frontend" / "public" / "assets" / "characters"
OUT_SIZE = 512  # 큰 해상도로 저장해 UI 축소 시에도 덜 뭉개지게
CONTENT_RATIO = 0.92

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


def enhance_portrait(im: Image.Image) -> Image.Image:
    """작은 원본 한계 안에서 선명·명암·채도를 살짝 살림 (디테일 복원은 불가)."""
    rgb = im.convert("RGBA")
    alpha = rgb.split()[-1]
    base = Image.merge("RGB", rgb.split()[:3])

    # 단계적 업스케일 (한 번에 크게 키우면 더 뭉개짐)
    w, h = base.size
    while max(w, h) < OUT_SIZE:
        w, h = min(OUT_SIZE, w * 2), min(OUT_SIZE, h * 2)
        base = base.resize((w, h), Image.Resampling.LANCZOS)
        alpha = alpha.resize((w, h), Image.Resampling.LANCZOS)

    if (w, h) != (OUT_SIZE, OUT_SIZE):
        # 비율 유지하며 OUT_SIZE 박스에 맞게 맞추기 전 단계 — 긴 변 기준
        scale = OUT_SIZE / max(w, h)
        nw, nh = max(1, int(round(w * scale))), max(1, int(round(h * scale)))
        base = base.resize((nw, nh), Image.Resampling.LANCZOS)
        alpha = alpha.resize((nw, nh), Image.Resampling.LANCZOS)

    base = ImageEnhance.Contrast(base).enhance(1.18)
    base = ImageEnhance.Color(base).enhance(1.12)
    base = ImageEnhance.Sharpness(base).enhance(1.45)
    base = base.filter(ImageFilter.UnsharpMask(radius=1.6, percent=140, threshold=2))

    out = base.convert("RGBA")
    out.putalpha(alpha)
    return out


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
        x0 = int(col * cw) + 2
        y0 = int(row * ch) + 2
        x1 = int((col + 1) * cw) - 2
        y1 = int(y0 + ch * ratio)
        # 원본 해상도 유지한 채 크롭 (업스케일은 enhance에서)
        return im.crop((x0, y0, x1, y1))

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
        im = enhance_portrait(im)
        im = center_on_canvas(im)
        path = CHAR_DIR / f"{cid}.png"
        im.save(path, "PNG", optimize=True)
        print("ok", path.name, im.size, "bbox", opaque_bbox(im))


if __name__ == "__main__":
    main()
