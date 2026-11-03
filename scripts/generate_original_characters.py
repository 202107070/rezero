"""캐릭터 PNG/JPG의 회색·검정 사각 배경을 투명화."""
from __future__ import annotations

from collections import deque
from pathlib import Path

from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "frontend" / "public" / "assets" / "characters"
ASSETS = Path(r"C:\Users\USER\.cursor\projects\c-Users-USER-OneDrive-IT-rezero\assets")
OUT = 512
CONTENT = 0.92

SOURCES = [
    ("char1", ASSETS / "orig-char1-sepi.jpg"),
    ("char2", ASSETS / "orig-char2-nox.jpg"),
    ("char3", ASSETS / "orig-char3-ark.jpg"),
    ("char4", ASSETS / "orig-char4-sol.jpg"),
]


def is_bg(r: int, g: int, b: int) -> bool:
    """중립(회색) 배경 — 캐릭터 색(채도 있음)은 제외."""
    mx, mn = max(r, g, b), min(r, g, b)
    chroma = mx - mn
    luma = (r + g + b) / 3.0
    # 어두운~중간 회색 배경 (현재 에셋의 ~33~57 포함)
    if chroma <= 22 and luma <= 100:
        return True
    # 생성본 JPG의 중간 회색
    if chroma <= 30 and 100 < luma <= 215:
        return True
    return False


def flood_clear(im: Image.Image) -> Image.Image:
    im = im.convert("RGBA")
    w, h = im.size
    px = im.load()
    visited = [[False] * w for _ in range(h)]
    q: deque[tuple[int, int]] = deque()

    def push(x: int, y: int) -> None:
        if x < 0 or y < 0 or x >= w or y >= h or visited[y][x]:
            return
        r, g, b, a = px[x, y]
        if a == 0:
            visited[y][x] = True
            q.append((x, y))
            return
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

    # 가장자리 회색 잔여 · 반투명 헤일로 정리
    for _ in range(4):
        victims: list[tuple[int, int]] = []
        for y in range(h):
            for x in range(w):
                r, g, b, a = px[x, y]
                if a == 0:
                    continue
                touch = any(
                    0 <= nx < w and 0 <= ny < h and px[nx, ny][3] == 0
                    for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1))
                )
                if not touch:
                    continue
                if is_bg(r, g, b) or (max(r, g, b) - min(r, g, b) <= 25 and (r + g + b) / 3 <= 70):
                    victims.append((x, y))
        if not victims:
            break
        for x, y in victims:
            px[x, y] = (0, 0, 0, 0)

    return im


def center(im: Image.Image) -> Image.Image:
    alpha = im.split()[-1]
    # 살짝 블러 후 bbox — 들쭉날쭉 가장자리 포함
    soft = alpha.filter(ImageFilter.MaxFilter(3))
    bbox = soft.point(lambda v: 255 if v >= 12 else 0).getbbox()
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
        if src.exists():
            im = Image.open(src)
            print("from", src.name)
        else:
            im = Image.open(OUT_DIR / f"{cid}.png")
            print("from existing", cid)
        im = flood_clear(im)
        im = center(im)
        # 재차 가장자리 정리 (리사이즈 후 회색 번짐)
        im = flood_clear(im)
        path = OUT_DIR / f"{cid}.png"
        im.save(path, "PNG", optimize=True)
        # 통계
        dark = sum(
            1
            for r, g, b, a in im.getdata()
            if a > 200 and max(r, g, b) - min(r, g, b) <= 18 and (r + g + b) / 3 < 90
        )
        print("ok", path.name, "dark_gray_left", dark)


if __name__ == "__main__":
    main()
