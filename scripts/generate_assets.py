from __future__ import annotations

import math
import random
import struct
import zlib
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
ASSET_DIR = ROOT / "static" / "assets"


def clamp(value: float) -> int:
    return max(0, min(255, int(value)))


def mix(a: tuple[int, int, int], b: tuple[int, int, int], t: float) -> tuple[int, int, int]:
    return tuple(clamp(a[i] + (b[i] - a[i]) * t) for i in range(3))


def write_png(path: Path, width: int, height: int, pixels: bytearray) -> None:
    def chunk(kind: bytes, data: bytes) -> bytes:
        return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data) & 0xFFFFFFFF)

    raw = bytearray()
    stride = width * 3
    for y in range(height):
        raw.append(0)
        raw.extend(pixels[y * stride : (y + 1) * stride])

    path.parent.mkdir(parents=True, exist_ok=True)
    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(bytes(raw), 9))
    png += chunk(b"IEND", b"")
    path.write_bytes(png)


class Canvas:
    def __init__(self, width: int, height: int, top=(5, 8, 13), bottom=(1, 2, 4)):
        self.width = width
        self.height = height
        self.pixels = bytearray(width * height * 3)
        for y in range(height):
            t = y / max(height - 1, 1)
            base = mix(top, bottom, t)
            row = y * width * 3
            for x in range(width):
                noise = ((x * 17 + y * 31 + (x >> 3) * (y >> 5)) % 11) - 5
                vignette = ((x - width * 0.5) ** 2 / (width * width) + (y - height * 0.48) ** 2 / (height * height)) * 105
                idx = row + x * 3
                self.pixels[idx] = clamp(base[0] + noise - vignette)
                self.pixels[idx + 1] = clamp(base[1] + noise - vignette)
                self.pixels[idx + 2] = clamp(base[2] + noise - vignette)

    def set(self, x: int, y: int, color: tuple[int, int, int], alpha: float = 1.0) -> None:
        if x < 0 or y < 0 or x >= self.width or y >= self.height:
            return
        idx = (y * self.width + x) * 3
        if alpha >= 1:
            self.pixels[idx : idx + 3] = bytes(color)
            return
        inv = 1 - alpha
        self.pixels[idx] = clamp(self.pixels[idx] * inv + color[0] * alpha)
        self.pixels[idx + 1] = clamp(self.pixels[idx + 1] * inv + color[1] * alpha)
        self.pixels[idx + 2] = clamp(self.pixels[idx + 2] * inv + color[2] * alpha)

    def rect(self, x0: int, y0: int, x1: int, y1: int, color: tuple[int, int, int], alpha: float = 1.0) -> None:
        for y in range(max(0, y0), min(self.height, y1)):
            for x in range(max(0, x0), min(self.width, x1)):
                self.set(x, y, color, alpha)

    def circle(self, cx: int, cy: int, radius: int, color: tuple[int, int, int], alpha: float = 1.0) -> None:
        rr = radius * radius
        for y in range(cy - radius, cy + radius + 1):
            for x in range(cx - radius, cx + radius + 1):
                dist = (x - cx) ** 2 + (y - cy) ** 2
                if dist <= rr:
                    edge = min(1.0, (rr - dist) / max(radius * 18, 1))
                    self.set(x, y, color, alpha * edge)

    def line(self, x0: int, y0: int, x1: int, y1: int, color: tuple[int, int, int], width: int = 1, alpha: float = 1.0) -> None:
        steps = max(abs(x1 - x0), abs(y1 - y0), 1)
        for step in range(steps + 1):
            t = step / steps
            x = round(x0 + (x1 - x0) * t)
            y = round(y0 + (y1 - y0) * t)
            for oy in range(-width, width + 1):
                for ox in range(-width, width + 1):
                    if ox * ox + oy * oy <= width * width:
                        self.set(x + ox, y + oy, color, alpha)

    def triangle(self, points: tuple[tuple[int, int], tuple[int, int], tuple[int, int]], color: tuple[int, int, int], alpha: float = 1.0) -> None:
        (x1, y1), (x2, y2), (x3, y3) = points
        min_x, max_x = max(0, min(x1, x2, x3)), min(self.width - 1, max(x1, x2, x3))
        min_y, max_y = max(0, min(y1, y2, y3)), min(self.height - 1, max(y1, y2, y3))
        denom = (y2 - y3) * (x1 - x3) + (x3 - x2) * (y1 - y3)
        if denom == 0:
            return
        for y in range(min_y, max_y + 1):
            for x in range(min_x, max_x + 1):
                a = ((y2 - y3) * (x - x3) + (x3 - x2) * (y - y3)) / denom
                b = ((y3 - y1) * (x - x3) + (x1 - x3) * (y - y3)) / denom
                c = 1 - a - b
                if a >= 0 and b >= 0 and c >= 0:
                    self.set(x, y, color, alpha)

    def save(self, name: str) -> None:
        write_png(ASSET_DIR / name, self.width, self.height, self.pixels)


def draw_castle(canvas: Canvas, x: int, ground: int, scale: float, color=(6, 9, 14)) -> None:
    width = int(760 * scale)
    canvas.rect(x - width // 2, ground - int(150 * scale), x + width // 2, ground, color, 0.94)
    tower_offsets = [-330, -245, -155, -70, 20, 105, 185, 275, 350]
    heights = [250, 350, 285, 430, 380, 510, 315, 390, 260]
    for offset, height in zip(tower_offsets, heights):
        tw = int(random.choice([34, 44, 54, 66]) * scale)
        tx = x + int(offset * scale)
        top = ground - int(height * scale)
        canvas.rect(tx - tw // 2, top, tx + tw // 2, ground, color, 0.98)
        canvas.triangle(((tx - tw, top), (tx + tw, top), (tx, top - int(86 * scale))), color, 0.98)
        canvas.line(tx, top - int(86 * scale), tx, top - int(126 * scale), (18, 22, 29), 1, 0.92)
        for wy in range(top + int(42 * scale), ground - int(18 * scale), int(62 * scale)):
            if random.random() > 0.26:
                canvas.rect(tx - 3, wy, tx + 3, wy + int(12 * scale), (190, 139, 70), 0.65)
    for i in range(34):
        wx = x - width // 2 + random.randint(20, width - 20)
        wy = ground - random.randint(22, 135)
        canvas.rect(wx, wy, wx + 5, wy + 13, (194, 140, 63), random.uniform(0.28, 0.65))


def generate_hero() -> None:
    random.seed(7)
    canvas = Canvas(2400, 1350, top=(9, 17, 31), bottom=(2, 3, 6))
    for _ in range(9):
        cy = random.randint(90, 360)
        canvas.circle(random.randint(100, 2300), cy, random.randint(120, 290), (50, 68, 92), 0.05)
    for i in range(7):
        y = 520 + i * 36
        canvas.line(0, y, 2400, y - random.randint(30, 80), (28, 38, 52), 18, 0.16)
    draw_castle(canvas, 1180, 965, 1.38, (7, 10, 17))
    draw_castle(canvas, 540, 1030, 0.68, (5, 8, 13))
    draw_castle(canvas, 1900, 1015, 0.72, (5, 8, 13))
    canvas.rect(0, 955, 2400, 1350, (2, 3, 5), 0.62)
    for band in range(11):
        y = 650 + band * 48
        for x in range(0, 2400, 3):
            alpha = 0.04 + 0.025 * math.sin((x + band * 37) / 120)
            canvas.set(x, y + int(math.sin(x / 90) * 18), (118, 139, 164), alpha)
            canvas.set(x + 1, y + 1 + int(math.sin(x / 90) * 18), (118, 139, 164), alpha * 0.6)
    for _ in range(360):
        x, y = random.randint(0, 2399), random.randint(50, 1260)
        color = (197, 151, 76) if random.random() > 0.55 else (107, 136, 177)
        canvas.circle(x, y, random.randint(1, 2), color, random.uniform(0.16, 0.54))
    for _ in range(9):
        bx = random.randint(1000, 1600)
        by = random.randint(230, 460)
        canvas.line(bx, by, bx + 18, by + 7, (2, 3, 5), 2, 0.92)
        canvas.line(bx + 18, by + 7, bx + 36, by, (2, 3, 5), 2, 0.92)
    canvas.save("hero-castle.png")


def generate_portrait(index: int, name: str) -> None:
    random.seed(40 + index)
    top_palette = [(9, 21, 40), (18, 11, 18), (8, 17, 28), (15, 18, 27)]
    canvas = Canvas(720, 960, top=top_palette[index % len(top_palette)], bottom=(2, 3, 6))
    for y in range(0, 960, 4):
        shade = int(24 * (1 - y / 960))
        canvas.line(0, y, 720, y + random.randint(-8, 8), (20 + shade, 25 + shade, 34 + shade), 1, 0.16)
    canvas.circle(360, 260, 130, (10, 12, 16), 0.98)
    canvas.circle(360, 242, 86, (18, 18, 22), 0.98)
    canvas.triangle(((230, 840), (490, 840), (410, 414)), (9, 11, 15), 1.0)
    canvas.triangle(((170, 840), (360, 468), (548, 840)), (13, 16, 23), 0.92)
    canvas.line(360, 352, 360, 628, (173, 129, 66), 3, 0.62)
    canvas.line(296, 555, 424, 555, (173, 129, 66), 2, 0.48)
    for _ in range(70):
        angle = random.random() * math.pi * 2
        radius = random.randint(70, 178)
        x = int(360 + math.cos(angle) * radius)
        y = int(500 + math.sin(angle) * radius * 1.5)
        canvas.circle(x, y, random.randint(1, 3), (182, 140, 76), random.uniform(0.18, 0.5))
    for offset in [24, 38]:
        canvas.rect(offset, offset, 720 - offset, offset + 2, (185, 148, 85), 0.75)
        canvas.rect(offset, 960 - offset, 720 - offset, 960 - offset + 2, (185, 148, 85), 0.75)
        canvas.rect(offset, offset, offset + 2, 960 - offset, (185, 148, 85), 0.75)
        canvas.rect(720 - offset, offset, 720 - offset + 2, 960 - offset, (185, 148, 85), 0.75)
    canvas.circle(360, 842, 44, (9, 29, 58), 0.78)
    canvas.circle(360, 842, 28, (184, 145, 76), 0.28)
    canvas.line(330, 842, 390, 842, (226, 194, 126), 2, 0.8)
    canvas.line(360, 812, 360, 872, (226, 194, 126), 2, 0.8)
    canvas.save(name)


def generate_map() -> None:
    random.seed(22)
    canvas = Canvas(1600, 980, top=(24, 23, 23), bottom=(5, 8, 12))
    for _ in range(650):
        x, y = random.randint(0, 1599), random.randint(0, 979)
        canvas.circle(x, y, random.randint(1, 2), (164, 128, 76), random.uniform(0.04, 0.13))
    points = [(240, 570), (360, 420), (520, 370), (675, 450), (800, 410), (1040, 520), (1230, 470), (1370, 650), (1130, 780), (850, 720), (650, 820), (450, 705)]
    for i in range(len(points)):
        x0, y0 = points[i]
        x1, y1 = points[(i + 1) % len(points)]
        canvas.line(x0, y0, x1, y1, (115, 95, 63), 5, 0.8)
    for _ in range(90):
        x = random.randint(250, 1350)
        y = random.randint(390, 780)
        if random.random() > 0.45:
            canvas.circle(x, y, random.randint(2, 6), (45, 55, 62), 0.18)
    cities = [(520, 440), (875, 530), (1150, 500), (1010, 720), (430, 660)]
    for x, y in cities:
        canvas.circle(x, y, 18, (16, 64, 123), 0.7)
        canvas.circle(x, y, 7, (231, 197, 119), 0.9)
        canvas.triangle(((x - 18, y - 22), (x + 18, y - 22), (x, y - 54)), (5, 8, 13), 0.92)
    for a, b in zip(cities, cities[1:]):
        canvas.line(a[0], a[1], b[0], b[1], (198, 157, 83), 2, 0.5)
    canvas.rect(32, 32, 1568, 36, (185, 148, 85), 0.62)
    canvas.rect(32, 944, 1568, 948, (185, 148, 85), 0.62)
    canvas.rect(32, 32, 36, 948, (185, 148, 85), 0.62)
    canvas.rect(1564, 32, 1568, 948, (185, 148, 85), 0.62)
    canvas.save("territory-map.png")


def generate_gallery(name: str, seed: int, fortress: bool = False) -> None:
    random.seed(seed)
    canvas = Canvas(1200, 760, top=(9, 18, 31), bottom=(4, 5, 8))
    for i in range(5):
        y = 390 + i * 40
        canvas.line(0, y, 1200, y - random.randint(20, 70), (58, 68, 76), 11, 0.15)
    draw_castle(canvas, 620 if not fortress else 860, 605, 0.75 if not fortress else 0.52, (5, 8, 13))
    if fortress:
        canvas.rect(130, 510, 530, 660, (6, 9, 13), 0.95)
        for x in range(160, 520, 62):
            canvas.rect(x, 470, x + 32, 660, (6, 9, 13), 0.98)
            canvas.triangle(((x - 16, 470), (x + 48, 470), (x + 16, 420)), (6, 9, 13), 0.98)
    for _ in range(120):
        canvas.circle(random.randint(0, 1199), random.randint(90, 720), random.randint(1, 2), (185, 148, 85), random.uniform(0.08, 0.35))
    canvas.save(name)


def main() -> None:
    generate_hero()
    for index in range(4):
        generate_portrait(index, f"member-placeholder-{index + 1}.png")
    generate_map()
    generate_gallery("gallery-castle.png", 81)
    generate_gallery("gallery-fortress.png", 92, fortress=True)


if __name__ == "__main__":
    main()
