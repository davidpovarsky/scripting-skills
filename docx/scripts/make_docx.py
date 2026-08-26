#!/usr/bin/env python3
"""
make_docx.py — create a .docx on-device with ZERO third-party dependencies.
Part of the docx skill's iOS adaptation for the Scripting app environment.

Usage:
    python3 make_docx.py spec.json output.docx

spec.json format (all keys optional except "elements"):
{
  "page":   {"size": "A4" | "Letter", "orientation": "portrait" | "landscape",
             "margin_mm": 25},
  "rtl":    true,                      # default text direction (Hebrew docs)
  "font":   {"name": "Arial", "size_half_points": 24},   # default body font/size
  "elements": [
    {"type": "heading", "level": 1, "text": "כותרת", "rtl": true},
    {"type": "para", "align": "right", "rtl": true,
     "runs": [{"text": "טקסט רגיל ", "bold": false},
              {"text": "מודגש", "bold": true, "color": "C00000"}]},
    {"type": "para", "text": "קיצור: פסקה מטקסט אחד"},          # simple form
    {"type": "bullet",   "items": ["סעיף אחד", "סעיף שני"], "rtl": true},
    {"type": "numbered", "items": ["אחד", "שניים"], "rtl": true},
    {"type": "table",
     "header": ["שם", "סכום"],
     "rows":   [["אליעזר", "120"], ["רחל", "85"]],
     "widths_dxa": [5000, 3000],       # optional; DXA = twentieths of a point
     "header_shade": "D9E2F3", "rtl": true},
    {"type": "page_break"}
  ]
}

Notes:
* Runs support: text, bold, italic, underline, color (RRGGBB hex),
  size_half_points (e.g. 28 = 14pt), highlight (hex fill).
* Bullets/numbers are rendered as literal prefixes + indents (no numbering.xml),
  which renders reliably in Word, Google Docs and iOS Numbers/Pages.
* RTL paragraphs use <w:bidi/> and <w:rtl/> runs; tables use <w:bidiVisual/>.
"""
import json
import sys
import zipfile
from xml.sax.saxutils import escape


# ---------------------------------------------------------------- helpers ---
def _twips(mm: float) -> int:
    return int(round(mm * 56.6929))


def _run_xml(run: dict) -> str:
    rpr = ""
    if run.get("bold"):
        rpr += "<w:b/>"
    if run.get("italic"):
        rpr += "<w:i/>"
    if run.get("underline"):
        rpr += '<w:u w:val="single"/>'
    if run.get("rtl"):
        rpr += "<w:rtl/>"
    if run.get("color"):
        rpr += f'<w:color w:val="{run["color"]}"/>'
    if run.get("highlight"):
        rpr += f'<w:highlight w:val="{run["highlight"]}"/>'
    if run.get("size_half_points"):
        rpr += f'<w:sz w:val="{int(run["size_half_points"])}"/>'
        rpr += f'<w:szCs w:val="{int(run["size_half_points"])}"/>'
    text = escape(run.get("text", ""), {'"': "&quot;"})
    return f'<w:r><w:rPr>{rpr}</w:rPr><w:t xml:space="preserve">{text}</w:t></w:r>'


def _para_xml(runs_xml: str, *, rtl: bool = False, align: str | None = None,
              style: str | None = None, indent_dxa: int = 0,
              spacing_after: int = 120) -> str:
    ppr = ""
    if style:
        ppr += f'<w:pStyle w:val="{style}"/>'
    if rtl:
        ppr += "<w:bidi/>"
    if align:
        ppr += f'<w:jc w:val="{align}"/>'
    elif rtl:
        ppr += '<w:jc w:val="right"/>'
    if indent_dxa:
        if rtl:
            ppr += f'<w:ind w:right="{indent_dxa}" w:hanging="0"/>'
        else:
            ppr += f'<w:ind w:left="{indent_dxa}" w:hanging="0"/>'
    if spacing_after is not None:
        ppr += f'<w:spacing w:after="{spacing_after}"/>'
    return f"<w:p><w:pPr>{ppr}</w:pPr>{runs_xml}</w:p>"


def _cell_xml(text: str, *, width_dxa: int, shade: str | None,
              bold: bool, rtl: bool) -> str:
    shd = f'<w:shd w:val="clear" w:fill="{shade}"/>' if shade else ""
    tcpr = (
        f'<w:tcW w:w="{width_dxa}" w:type="dxa"/>{shd}'
        '<w:vAlign w:val="center"/>'
    )
    run = _run_xml({"text": text, "bold": bold, "rtl": rtl})
    para = _para_xml(run, rtl=rtl)
    return f"<w:tc><w:tcPr>{tcpr}</w:tcPr>{para}</w:tc>"


def _table_xml(spec: dict, default_rtl: bool) -> str:
    rtl = spec.get("rtl", default_rtl)
    header = spec.get("header") or []
    rows = spec.get("rows") or []
    ncols = max(len(header), max((len(r) for r in rows), default=0))
    widths = spec.get("widths_dxa") or [9006 // max(ncols, 1)] * ncols
    shade = spec.get("header_shade", "D9E2F3")

    bidi = "<w:bidiVisual/>" if rtl else ""
    grid = "".join(f'<w:gridCol w:w="{w}"/>' for w in widths[:ncols])
    borders = (
        '<w:tblBorders>'
        '<w:top w:val="single" w:sz="4" w:color="999999"/>'
        '<w:left w:val="single" w:sz="4" w:color="999999"/>'
        '<w:bottom w:val="single" w:sz="4" w:color="999999"/>'
        '<w:right w:val="single" w:sz="4" w:color="999999"/>'
        '<w:insideH w:val="single" w:sz="4" w:color="999999"/>'
        '<w:insideV w:val="single" w:sz="4" w:color="999999"/>'
        '</w:tblBorders>'
    )
    xml = (
        '<w:tbl><w:tblPr>'
        f'{bidi}<w:tblW w:w="0" w:type="auto"/>{borders}'
        '</w:tblPr>'
        f'<w:tblGrid>{grid}</w:tblGrid>'
    )
    if header:
        cells = "".join(
            _cell_xml(header[i] if i < len(header) else "",
                      width_dxa=widths[min(i, len(widths) - 1)],
                      shade=shade, bold=True, rtl=rtl)
            for i in range(ncols)
        )
        xml += f"<w:tr>{cells}</w:tr>"
    for row in rows:
        cells = "".join(
            _cell_xml(row[i] if i < len(row) else "",
                      width_dxa=widths[min(i, len(widths) - 1)],
                      shade=None, bold=False, rtl=rtl)
            for i in range(ncols)
        )
        xml += f"<w:tr>{cells}</w:tr>"
    xml += "</w:tbl>"
    # empty paragraph after table (Word requires paragraph between table & EOF)
    xml += _para_xml("", spacing_after=0)
    return xml


# ------------------------------------------------------------- templates ---
STYLES_XML = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults><w:rPrDefault><w:rPr>
    <w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>
    <w:sz w:val="{body_size}"/><w:szCs w:val="{body_size}"/>
  </w:rPr></w:rPrDefault></w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
  <w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/>
    <w:basedOn w:val="Normal"/><w:pPr><w:outlineLvl w:val="0"/><w:spacing w:before="240" w:after="120"/></w:pPr>
    <w:rPr><w:b/><w:sz w:val="36"/><w:szCs w:val="36"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/>
    <w:basedOn w:val="Normal"/><w:pPr><w:outlineLvl w:val="1"/><w:spacing w:before="200" w:after="100"/></w:pPr>
    <w:rPr><w:b/><w:sz w:val="30"/><w:szCs w:val="30"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/>
    <w:basedOn w:val="Normal"/><w:pPr><w:outlineLvl w:val="2"/><w:spacing w:before="160" w:after="80"/></w:pPr>
    <w:rPr><w:b/><w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr></w:style>
</w:styles>"""

CONTENT_TYPES_XML = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>"""

ROOT_RELS_XML = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>"""

DOC_RELS_XML = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>"""

CORE_XML = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"
                   xmlns:dc="http://purl.org/dc/elements/1.1/"
                   xmlns:dcterms="http://purl.org/dc/terms/"
                   xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:creator>Scripting Agent</dc:creator>
  <cp:lastModifiedBy>Scripting Agent</cp:lastModifiedBy>
</cp:coreProperties>"""

APP_XML = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">
  <Application>Scripting (iOS)</Application>
</Properties>"""


def build_document_xml(spec: dict) -> str:
    page = spec.get("page", {})
    size_name = page.get("size", "A4").upper()
    landscape = page.get("orientation", "portrait") == "landscape"
    dims = {"A4": (11906, 16838), "LETTER": (12240, 15840)}
    w, h = dims.get(size_name, dims["A4"])
    if landscape:
        w, h = h, w
    margin = _twips(page.get("margin_mm", 25))

    default_rtl = bool(spec.get("rtl", False))
    body_size = spec.get("font", {}).get("size_half_points", 24)

    body_parts = []
    for el in spec.get("elements", []):
        t = el.get("type")
        rtl = el.get("rtl", default_rtl)
        if t == "heading":
            level = min(max(int(el.get("level", 1)), 1), 3)
            run = _run_xml({"text": el.get("text", ""), "rtl": rtl})
            body_parts.append(_para_xml(run, rtl=rtl, style=f"Heading{level}"))
        elif t == "para":
            runs = el.get("runs") or [{"text": el.get("text", "")}]
            for r in runs:
                if rtl and "rtl" not in r:
                    r["rtl"] = True
            body_parts.append(_para_xml(
                "".join(_run_xml(r) for r in runs),
                rtl=rtl, align=el.get("align"),
                indent_dxa=int(el.get("indent_dxa", 0)),
                spacing_after=int(el.get("spacing_after_twips", 120)),
            ))
        elif t in ("bullet", "numbered"):
            prefix_char = "\u2022" if t == "bullet" else None
            indent = 720
            for i, item in enumerate(el.get("items", []), start=1):
                pre = f"{prefix_char}  " if prefix_char else f"{i}. "
                run = _run_xml({"text": pre + item, "rtl": rtl})
                body_parts.append(_para_xml(run, rtl=rtl, indent_dxa=indent,
                                            spacing_after=60))
        elif t == "table":
            body_parts.append(_table_xml(el, default_rtl))
        elif t == "page_break":
            body_parts.append(
                '<w:p><w:r><w:br w:type="page"/></w:r></w:p>')
        else:
            raise ValueError(f"unknown element type: {t!r}")

    sect = (
        f'<w:sectPr><w:pgSz w:w="{w}" w:h="{h}"'
        f'{" w:orient=\"landscape\"" if landscape else ""}/>'
        f'<w:pgMar w:top="{margin}" w:right="{margin}" w:bottom="{margin}"'
        f' w:left="{margin}" w:header="708" w:footer="708" w:gutter="0"/>'
        "</w:sectPr>"
    )
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<w:document '
        'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
        f"<w:body>{''.join(body_parts)}{sect}</w:body></w:document>"
    )


def write_docx(spec_path: str, out_path: str) -> None:
    with open(spec_path, encoding="utf-8") as f:
        spec = json.load(f)

    document_xml = build_document_xml(spec)
    body_size = str(spec.get("font", {}).get("size_half_points", 24))
    styles_xml = STYLES_XML.replace("{body_size}", body_size)

    with zipfile.ZipFile(out_path, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("[Content_Types].xml", CONTENT_TYPES_XML)
        z.writestr("_rels/.rels", ROOT_RELS_XML)
        z.writestr("word/document.xml", document_xml)
        z.writestr("word/_rels/document.xml.rels", DOC_RELS_XML)
        z.writestr("word/styles.xml", styles_xml)
        z.writestr("docProps/core.xml", CORE_XML)
        z.writestr("docProps/app.xml", APP_XML)


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print(__doc__)
        sys.exit(2)
    write_docx(sys.argv[1], sys.argv[2])
    print(f"OK wrote {sys.argv[2]}")
