#!/usr/bin/env python3
"""
read_docx.py — extract text from a .docx using ONLY the standard library.
iOS replacement for `pandoc -t markdown file.docx` in the Scripting environment.

Usage:
    python3 read_docx.py file.docx [--meta]

Output: markdown-ish text (headings as #, tables as pipe rows).
--meta also prints core properties (title/creator).
"""
import sys
import zipfile
import re
import xml.etree.ElementTree as ET

W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
CP = "{http://schemas.openxmlformats.org/package/2006/metadata/core-properties}"
DC = "{http://purl.org/dc/elements/1.1/"


def _para_text(p: ET.Element) -> str:
    parts = []
    for node in p.iter():
        if node.tag == W + "t":
            parts.append(node.text or "")
        elif node.tag == W + "tab":
            parts.append("\t")
        elif node.tag in (W + "br", W + "cr"):
            parts.append("\n")
    return "".join(parts)


def _style_of(p: ET.Element) -> str | None:
    ppr = p.find(W + "pPr")
    if ppr is not None:
        st = ppr.find(W + "pStyle")
        if st is not None:
            return st.get(W + "val")
    return None


def read(path: str) -> str:
    with zipfile.ZipFile(path) as z:
        root = ET.fromstring(z.read("word/document.xml"))
    body = root.find(W + "body")
    out: list[str] = []
    for el in body:
        if el.tag == W + "p":
            style = _style_of(el) or ""
            text = _para_text(el)
            m = re.match(r"Heading(\d)", style)
            if m and text.strip():
                out.append("#" * int(m.group(1)) + " " + text)
            elif text.strip():
                out.append(text)
        elif el.tag == W + "tbl":
            for tr in el.findall(W + "tr"):
                cells = [_para_text(tc) for tc in tr.findall(W + "tc")]
                out.append("| " + " | ".join(cells) + " |")
    return "\n".join(out)


def meta(path: str) -> str:
    lines = []
    with zipfile.ZipFile(path) as z:
        if "docProps/core.xml" not in z.namelist():
            return ""
        root = ET.fromstring(z.read("docProps/core.xml"))
    for child in root:
        tag = child.tag.replace(CP, "cp:").replace(DC, "dc:")
        if child.text and child.text.strip():
            lines.append(f"{tag}: {child.text.strip()}")
    return "\n".join(lines)


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(2)
    print(read(sys.argv[1]))
    if "--meta" in sys.argv[2:]:
        m = meta(sys.argv[1])
        if m:
            print("\n--- metadata ---\n" + m)
