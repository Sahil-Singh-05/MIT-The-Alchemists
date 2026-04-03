import pandas as pd
from pathlib import Path
from datetime import datetime


def _infer_date(df: pd.DataFrame, file_path: str) -> str:
    """
    Look for a 'date' column in the sheet.
    If found, use the most recent value as the document date.
    Otherwise fall back to today.
    """
    for col in df.columns:
        if "date" in str(col).lower():
            try:
                dates = pd.to_datetime(df[col], errors="coerce").dropna()
                if not dates.empty:
                    return dates.max().strftime("%Y-%m-%d")
            except Exception:
                pass
    return datetime.today().strftime("%Y-%m-%d")


def parse_excel(file_path: str) -> list[dict]:
    """
    Returns a list of document chunks, each with:
      - text   : natural-language sentence representing one row
      - source : filename
      - sheet  : sheet name
      - row    : row number (1-indexed, excluding header)
      - type   : 'table'
      - date   : document date string (YYYY-MM-DD)
      - format : 'excel'
    """
    path   = Path(file_path)
    chunks = []

    xl = pd.ExcelFile(file_path)

    for sheet_name in xl.sheet_names:
        df = xl.parse(sheet_name)
        df.columns = [str(c).strip() for c in df.columns]  # clean headers

        # Drop fully empty rows
        df.dropna(how="all", inplace=True)

        doc_date = _infer_date(df, file_path)

        for row_idx, (_, row) in enumerate(df.iterrows(), start=1):
            parts = []
            for col in df.columns:
                val = row[col]
                if pd.notna(val) and str(val).strip():
                    parts.append(f"{col}: {str(val).strip()}")

            if not parts:
                continue

            # Full natural-language sentence for the row
            sentence = (
                f"[Sheet: {sheet_name}] Row {row_idx} — "
                + ", ".join(parts)
                + "."
            )

            chunks.append({
                "text"  : sentence,
                "source": path.name,
                "sheet" : sheet_name,
                "row"   : row_idx,
                "type"  : "table",
                "date"  : doc_date,
                "format": "excel",
            })

    return chunks