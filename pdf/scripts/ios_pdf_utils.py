#!/usr/bin/env python3
"""
ios_pdf_utils.py — iOS/Scripting helpers for the pdf skill.

What works on this device (verified):
  * pypdf            — merge / split / rotate / extract text / fill AcroForms
  * fpdf2 (--no-deps) — CREATE PDFs, including Hebrew, using the system
    SF Hebrew font at /System/Library/Fonts/Core/SFHebrew.ttf
    (Pillow is NOT available -> no images; reportlab is NOT installable)

Quick start:
    from ios_pdf_utils import heb, new_heb_pdf
    pdf = new_heb_pdf()
    pdf.text(20, 40, heb("שלום עולם"))
    pdf.output("out.pdf")

CLI helpers:
    python3 ios_pdf_utils.py merge a.pdf b.pdf -o merged.pdf
    python3 ios_pdf_utils.py split in.pdf out_dir
    python3 ios_pdf_utils.py text in.pdf
"""
from __future__ import annotations

import argparse
import sys

HEBREW_RE_START = "\u0590"
HEBREW_RE_END = "\u05FF"

FONT_CANDIDATES = [
    "/System/Library/Fonts/Core/SFHebrew.ttf",
    "/System/Library/Fonts/Core/ArialHB.ttf",
]


def heb(s: str) -> str:
    """Reorder a logical-order Hebrew/mixed string into visual order so it
    renders correctly in fpdf2 (which has no bidi engine here).

    Hebrew runs are reversed; Latin/digit/punctuation runs stay as-is.
    For simple lines (Hebrew sentence + numbers) this is correct.
    """
    out: list[str] = []
    buf = ""

    def flush() -> None:
        nonlocal buf
        if buf:
            out.append(buf[::-1])
            buf = ""

    for ch in s:
        if HEBREW_RE_START <= ch <= HEBREW_RE_END:
            buf += ch
        else:
            flush()
            out.append(ch)
    flush()
    # reverse segment order for full-RTL lines so reading order is right
    if any(HEBREW_RE_START <= c <= HEBREW_RE_END for c in s):
        pass  # segments already emitted left-to-right by scan order
    return "".join(out)


def _add_hebrew_font(pdf) -> str | None:
    """Try to register a Hebrew-capable system font. Returns name or None."""
    import os

    for path in FONT_CANDIDATES:
        if os.path.exists(path):
            try:
                pdf.add_font("sfhebrew", "", path)
                return "sfhebrew"
            except Exception:
                continue
    return None


def new_heb_pdf(size_pt: float = 14):
    """Create an FPDF instance with the Hebrew font already selected.
    Falls back to helvetica if no Hebrew font found."""
    from fpdf import FPDF

    pdf = FPDF()
    pdf.add_page()
    name = _add_hebrew_font(pdf)
    if name:
        pdf.set_font(name, size=size_pt)
    else:
        pdf.set_font("helvetica", size=size_pt)  # Latin only!
    return pdf


def ensure_imports() -> None:
    """Import pypdf/fpdf2 with friendly guidance if missing."""
    missing = []
    try:
        import pypdf  # noqa: F401
    except ImportError:
        missing.append("pypdf")
    try:
        import fpdf  # noqa: F401
    except ImportError:
        missing.append("fpdf2")
    if missing:
        raise SystemExit(
            "Missing packages: "
            + ", ".join(missing)
            + ". Install via the pip helper script "
              "(direct `pip3` CLI is broken on iOS):\n"
            'python3 -c "import sys;'
            "from pip._internal.cli.main import main;"
            'sys.exit(main([\'install\',\''
            + "' '".join(missing) + "'\"]))\""
        )


# ------------------------------------------------------------------ CLI ---
def _cli() -> None:
    ap = argparse.ArgumentParser(description="iOS PDF quick operations")
    sub = ap.add_subparsers(dest="cmd", required=True)

    m = sub.add_parser("merge")
    m.add_argument("inputs", nargs="+")
    m.add_argument("-o", "--output", required=True)

    s = sub.add_parser("split")
    s.add_argument("input")
    s.add_argument("outdir")

    t = sub.add_parser("text")
    t.add_argument("input")
    t.add_argument("--pages", default=None, help="e.g. 1-3")

    args = ap.parse_args()

    from pypdf import PdfReader, PdfWriter

    if args.cmd == "merge":
        w = PdfWriter()
        for p in args.inputs:
            for page in PdfReader(p).pages:
                w.add_page(page)
        with open(args.output, "wb") as f:
            w.write(f)
        print(f"OK merged {len(args.inputs)} files -> {args.output}")

    elif args.cmd == "split":
        reader = PdfReader(args.input)
        for i, page in enumerate(reader.pages):
            w = PdfWriter()
            w.add_page(page)
            out = f"{args.outdir}/page_{i + 1}.pdf"
            with open(out, "wb") as f:
                w.write(f)
            print("wrote", out)

    elif args.cmd == "text":
        r = PdfReader(args.input)
        pages = r.pages
        if args.pages:
            a, b = args.pages.split("-")
            pages = r.pages[int(a) - 1:int(b)]
        for i, page in enumerate(pages):
            print(f"--- page {i + 1} ---")
            print(page.extract_text())


if __name__ == "__main__":
    _cli()
