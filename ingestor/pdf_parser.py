import fitz          # PyMuPDF  — prose extraction
import pdfplumber     # table detection
from pathlib import Path
from datetime import datetime


def _extract_date_from_meta(meta: dict) -> str:
    """Try to pull a date from PDF metadata; fall back to today."""
    raw = meta.get("creationDate") or meta.get("modDate") or ""
    # PDF date format: D:20240115120000
    if raw.startswith("D:"):
        try:
            return datetime.strptime(raw[2:10], "%Y%m%d").strftime("%Y-%m-%d")
        except ValueError:
            pass
    return datetime.today().strftime("%Y-%m-%d")


def parse_pdf(file_path: str) -> list[dict]:
    """
    Returns a list of document chunks, each with:
      - text   : the actual content
      - source : filename
      - page   : page number (1-indexed)
      - type   : 'prose' or 'table'
      - date   : document date string (YYYY-MM-DD)
      - format : 'pdf'
    """
    path   = Path(file_path)
    chunks = []

    # --- Metadata (date) via PyMuPDF ---
    fitz_doc = fitz.open(file_path)
    doc_date = _extract_date_from_meta(fitz_doc.metadata)

    # --- Tables via pdfplumber (page by page) ---
    table_pages = set()  # track which pages have tables so we skip them in prose pass

    with pdfplumber.open(file_path) as pdf:
        for page_num, page in enumerate(pdf.pages, start=1):
            tables = page.extract_tables()
            if tables:
                table_pages.add(page_num)
                for table in tables:
                    if not table:
                        continue
                    headers = [str(h).strip() if h else f"col{i}"
                               for i, h in enumerate(table[0])]
                    for row in table[1:]:
                        if not any(row):          # skip empty rows
                            continue
                        # Convert row → natural language sentence
                        parts = []
                        for header, cell in zip(headers, row):
                            if cell and str(cell).strip():
                                parts.append(f"{header}: {str(cell).strip()}")
                        if parts:
                            sentence = "Table record — " + ", ".join(parts) + "."
                            chunks.append({
                                "text"  : sentence,
                                "source": path.name,
                                "page"  : page_num,
                                "type"  : "table",
                                "date"  : doc_date,
                                "format": "pdf",
                            })

    # --- Prose via PyMuPDF (skip table pages) ---
    for page_num, page in enumerate(fitz_doc, start=1):
        if page_num in table_pages:
            continue
        text = page.get_text("text").strip()
        if text:
            chunks.append({
                "text"  : text,
                "source": path.name,
                "page"  : page_num,
                "type"  : "prose",
                "date"  : doc_date,
                "format": "pdf",
            })

    fitz_doc.close()
    return chunks