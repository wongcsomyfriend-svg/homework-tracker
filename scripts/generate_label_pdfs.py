"""Generate A4 PDFs of DICT_4X4_50 ArUco labels at exact physical sizes."""

from __future__ import annotations

from pathlib import Path

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm, mm
from reportlab.pdfgen import canvas

# OpenCV DICT_4X4_50 — first 50 codes (2 bytes each), same as the app.
DICT_4X4_50: list[tuple[int, int]] = [
    (181, 50), (15, 154), (51, 45), (153, 70), (84, 158),
    (121, 205), (158, 46), (196, 242), (254, 218), (207, 86),
    (249, 145), (17, 167), (14, 183), (42, 15), (36, 177),
    (38, 62), (70, 101), (102, 0), (108, 94), (118, 175),
    (134, 139), (176, 43), (204, 213), (221, 130), (254, 71),
    (148, 113), (172, 228), (165, 84), (33, 35), (52, 111),
    (68, 21), (87, 178), (158, 207), (240, 203), (8, 174),
    (9, 41), (24, 117), (4, 255), (13, 246), (28, 90),
    (23, 24), (42, 40), (50, 140), (56, 178), (36, 232),
    (46, 235), (45, 63), (75, 100), (80, 46), (80, 19),
]

PAGE_W, PAGE_H = A4
MARGIN = 10 * mm


def code_to_bits(code: tuple[int, int]) -> str:
    return f"{code[0]:08b}{code[1]:08b}"


def draw_marker(c: canvas.Canvas, x: float, y: float, size: float, marker_id: int) -> None:
    """
    Draw an ArUco marker whose outer black square is exactly `size` x `size`.
    Origin (x, y) is the bottom-left of the black square.
    """
    bits = code_to_bits(DICT_4X4_50[marker_id])
    cells = 6  # 4 data + 1 black border each side
    cell = size / cells

    # Solid black square
    c.setFillColorRGB(0, 0, 0)
    c.rect(x, y, size, size, fill=1, stroke=0)

    # White data cells (bit == '1'); PDF y grows upward, matrix row 0 is top
    c.setFillColorRGB(1, 1, 1)
    for row in range(4):
        for col in range(4):
            if bits[row * 4 + col] == "1":
                # Convert image coords (top-left origin) to PDF (bottom-left)
                px = x + (col + 1) * cell
                py = y + (cells - 2 - row) * cell
                c.rect(px, py, cell, cell, fill=1, stroke=0)


def generate_pdf(path: Path, marker_cm: float) -> None:
    marker_size = marker_cm * cm
    # Quiet zone = one cell width around the black square
    quiet = marker_size / 6
    label_h = 4.2 * mm
    gap = 3 * mm

    tile_w = marker_size + 2 * quiet
    tile_h = marker_size + 2 * quiet + label_h + 1.5 * mm

    usable_w = PAGE_W - 2 * MARGIN
    usable_h = PAGE_H - 2 * MARGIN - 12 * mm  # room for header

    cols = max(1, int((usable_w + gap) // (tile_w + gap)))
    rows = max(1, int((usable_h + gap) // (tile_h + gap)))
    per_page = cols * rows

    c = canvas.Canvas(str(path), pagesize=A4)
    total = len(DICT_4X4_50)

    for index in range(total):
        page_index = index // per_page
        slot = index % per_page
        if slot == 0:
            if index > 0:
                c.showPage()
            # Header
            c.setFillColorRGB(0.1, 0.1, 0.1)
            c.setFont("Helvetica-Bold", 11)
            c.drawString(
                MARGIN,
                PAGE_H - MARGIN - 5 * mm,
                f"DICT_4X4_50  ArUco labels  |  black square = {marker_cm:g} cm  |  A4",
            )
            c.setFont("Helvetica", 8)
            c.drawString(
                MARGIN,
                PAGE_H - MARGIN - 9 * mm,
                "Print at 100% (Actual size). Do not use Fit to page. Matte sticker recommended.",
            )

        col = slot % cols
        row = slot // cols
        # Top-down layout
        tile_x = MARGIN + col * (tile_w + gap)
        tile_top = PAGE_H - MARGIN - 12 * mm - row * (tile_h + gap)
        tile_y = tile_top - tile_h

        # White quiet-zone background (helps cutting / detection)
        c.setFillColorRGB(1, 1, 1)
        c.setStrokeColorRGB(0.85, 0.85, 0.85)
        c.setLineWidth(0.3)
        c.rect(tile_x, tile_y, tile_w, tile_h, fill=1, stroke=1)

        marker_x = tile_x + quiet
        marker_y = tile_y + label_h + 1.5 * mm + quiet
        draw_marker(c, marker_x, marker_y, marker_size, index)

        c.setFillColorRGB(0.1, 0.1, 0.1)
        c.setFont("Helvetica", 7)
        text = f"#{index}  {marker_cm:g}cm"
        c.drawCentredString(tile_x + tile_w / 2, tile_y + 1.6 * mm, text)

    c.save()
    print(f"Wrote {path}  ({cols}x{rows} per page, {total} markers)")


def main() -> None:
    out_dir = Path(__file__).resolve().parents[1] / "print-labels"
    out_dir.mkdir(parents=True, exist_ok=True)
    for size in (1.0, 1.2, 1.5):
        name = f"aruco-dict4x4-50-{size:g}cm-A4.pdf"
        generate_pdf(out_dir / name, size)


if __name__ == "__main__":
    main()
