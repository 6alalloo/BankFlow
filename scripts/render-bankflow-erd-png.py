from __future__ import annotations

import re
import xml.etree.ElementTree as ET
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
SVG_PATH = ROOT / "docs" / "assets" / "bankflow-current-erd.svg"
PNG_PATH = ROOT / "docs" / "assets" / "bankflow-current-erd.png"

WIDTH = 2600
HEIGHT = 1700

COLORS = {
    "workspace": "#eef3f7",
    "grid": "#d9e1e8",
    "table-box": "#ffffff",
    "table-box-stroke": "#9aa9b8",
    "table-head": "#dce8f5",
    "table-head-stroke": "#8fa6bd",
    "title": "#1e3448",
    "col": "#1f2933",
    "type": "#607080",
    "fk-text": "#075985",
    "pk": "#f6c54d",
    "pk-stroke": "#a77100",
    "fk": "#b7d8ff",
    "fk-stroke": "#4f83bd",
    "uq": "#dadde3",
    "uq-stroke": "#8a94a3",
    "dot": "#c2cbd3",
    "rel": "#4f6275",
    "icon": "#7fa6cf",
    "icon-stroke": "#37638c",
}


def font(size: int, bold: bool = False):
    candidates = [
        "C:/Windows/Fonts/segoeuib.ttf" if bold else "C:/Windows/Fonts/segoeui.ttf",
        "C:/Windows/Fonts/arialbd.ttf" if bold else "C:/Windows/Fonts/arial.ttf",
    ]
    for candidate in candidates:
        try:
            return ImageFont.truetype(candidate, size)
        except OSError:
            pass
    return ImageFont.load_default()


FONT_TITLE = font(16, True)
FONT_COL = font(14)
FONT_COL_BOLD = font(14, True)
FONT_TYPE = font(13)
FONT_BADGE = font(8, True)


def cls(elem: ET.Element) -> set[str]:
    return set((elem.attrib.get("class") or "").split())


def f(value: str | None, default: float = 0) -> float:
    if value is None:
        return default
    return float(value)


def color_for_rect(classes: set[str]):
    if "workspace" in classes:
        return COLORS["workspace"], COLORS["workspace"], 0
    if "table-box" in classes:
        return COLORS["table-box"], COLORS["table-box-stroke"], 2
    if "table-head" in classes:
        return COLORS["table-head"], COLORS["table-head-stroke"], 2
    if "pk" in classes:
        return COLORS["pk"], COLORS["pk-stroke"], 1
    if "fk" in classes:
        return COLORS["fk"], COLORS["fk-stroke"], 1
    if "uq" in classes:
        return COLORS["uq"], COLORS["uq-stroke"], 1
    if "alt" in classes:
        return "#f7fafc", "#f7fafc", 0
    if "row" in classes:
        return "#ffffff", "#ffffff", 0
    if "table-icon" in classes:
        return COLORS["icon"], COLORS["icon-stroke"], 1
    return "#ffffff", "#cccccc", 1


def draw_grid(draw: ImageDraw.ImageDraw):
    for x in range(0, WIDTH, 24):
        draw.line([(x, 0), (x, HEIGHT)], fill=COLORS["grid"], width=1)
    for y in range(0, HEIGHT, 24):
        draw.line([(0, y), (WIDTH, y)], fill=COLORS["grid"], width=1)


def draw_rect(draw: ImageDraw.ImageDraw, elem: ET.Element):
    classes = cls(elem)
    if "grid" in classes:
        draw_grid(draw)
        return
    x, y = f(elem.attrib.get("x")), f(elem.attrib.get("y"))
    w, h = f(elem.attrib.get("width")), f(elem.attrib.get("height"))
    rx = f(elem.attrib.get("rx"), 0)
    fill, outline, width = color_for_rect(classes)
    box = [x, y, x + w, y + h]
    if rx:
        draw.rounded_rectangle(box, radius=rx, fill=fill, outline=outline, width=width)
    else:
        draw.rectangle(box, fill=fill, outline=outline, width=width)


def path_points(d: str):
    nums = [float(n) for n in re.findall(r"-?\d+(?:\.\d+)?", d)]
    return list(zip(nums[0::2], nums[1::2]))


def draw_path(draw: ImageDraw.ImageDraw, elem: ET.Element):
    d = elem.attrib.get("d", "")
    points = path_points(d)
    if len(points) < 2:
        return
    classes = cls(elem)
    fill = elem.attrib.get("fill")
    if "table-icon-line" in classes:
        draw.line(points, fill="#ffffff", width=1)
        return
    if fill and fill != "none":
        draw.polygon(points, fill=fill)
        return
    draw.line(points, fill=COLORS["rel"], width=2, joint="curve")


def draw_circle(draw: ImageDraw.ImageDraw, elem: ET.Element):
    cx, cy, r = f(elem.attrib.get("cx")), f(elem.attrib.get("cy")), f(elem.attrib.get("r"))
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=COLORS["dot"], outline="#8d99a5")


def draw_text(draw: ImageDraw.ImageDraw, elem: ET.Element):
    text = "".join(elem.itertext())
    if not text:
        return
    classes = cls(elem)
    x, y = f(elem.attrib.get("x")), f(elem.attrib.get("y"))
    anchor = "la"
    selected_font = FONT_COL
    fill = COLORS["col"]
    if "table-title" in classes:
        selected_font = FONT_TITLE
        fill = COLORS["title"]
    elif "type" in classes:
        selected_font = FONT_TYPE
        fill = COLORS["type"]
    elif "badge" in classes:
        selected_font = FONT_BADGE
        fill = COLORS["col"]
        anchor = "ma"
    elif "pk-text" in classes:
        selected_font = FONT_COL_BOLD
        fill = COLORS["col"]
    elif "fk-text" in classes:
        selected_font = FONT_COL
        fill = COLORS["fk-text"]
    draw.text((x, y), text, fill=fill, font=selected_font, anchor=anchor)


def draw_element(draw: ImageDraw.ImageDraw, elem: ET.Element):
    tag = elem.tag.split("}")[-1]
    if tag == "defs" or tag == "style":
        return
    if tag == "rect":
        draw_rect(draw, elem)
    elif tag == "path":
        draw_path(draw, elem)
    elif tag == "circle":
        draw_circle(draw, elem)
    elif tag == "text":
        draw_text(draw, elem)
    for child in list(elem):
        draw_element(draw, child)


def main():
    tree = ET.parse(SVG_PATH)
    image = Image.new("RGB", (WIDTH, HEIGHT), COLORS["workspace"])
    draw = ImageDraw.Draw(image)
    draw_element(draw, tree.getroot())
    image.save(PNG_PATH)
    print(PNG_PATH)


if __name__ == "__main__":
    main()
