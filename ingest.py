"""
ingest.py — Master ingestion pipeline

Usage:
  python ingest.py --pdf path/to/file.pdf
  python ingest.py --excel path/to/file.xlsx
  python ingest.py --email path/to/email.eml
  python ingest.py --email-folder path/to/emails/
  python ingest.py --clear          # wipe the vector store
"""

import argparse
from pathlib import Path

from ingestor.pdf_parser   import parse_pdf
from ingestor.excel_parser import parse_excel
from ingestor.email_parser import parse_eml, parse_eml_folder
from ingestor.chunker      import chunk_documents
from vectorstore.chroma_store import add_chunks, clear_collection, collection_count


def ingest_pdf(path: str):
    print(f"[Ingest] Parsing PDF: {path}")
    raw    = parse_pdf(path)
    chunks = chunk_documents(raw)
    add_chunks(chunks)
    print(f"[Ingest] PDF done — {len(chunks)} chunks added.")


def ingest_excel(path: str):
    print(f"[Ingest] Parsing Excel: {path}")
    raw    = parse_excel(path)
    chunks = chunk_documents(raw)
    add_chunks(chunks)
    print(f"[Ingest] Excel done — {len(chunks)} chunks added.")


def ingest_eml(path: str):
    print(f"[Ingest] Parsing email: {path}")
    raw    = parse_eml(path)
    chunks = chunk_documents(raw)
    add_chunks(chunks)
    print(f"[Ingest] Email done — {len(chunks)} chunks added.")


def ingest_eml_folder(folder: str):
    print(f"[Ingest] Parsing email folder: {folder}")
    raw    = parse_eml_folder(folder)
    chunks = chunk_documents(raw)
    add_chunks(chunks)
    print(f"[Ingest] Email folder done — {len(chunks)} chunks added.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="SME RAG ingestion pipeline")
    parser.add_argument("--pdf",          type=str, help="Path to a PDF file")
    parser.add_argument("--excel",        type=str, help="Path to an Excel file")
    parser.add_argument("--email",        type=str, help="Path to a .eml file")
    parser.add_argument("--email-folder", type=str, help="Path to folder with .eml files")
    parser.add_argument("--clear",        action="store_true", help="Clear the vector store")

    args = parser.parse_args()

    if args.clear:
        clear_collection()

    if args.pdf:
        ingest_pdf(args.pdf)

    if args.excel:
        ingest_excel(args.excel)

    if args.email:
        ingest_eml(args.email)

    if args.email_folder:
        ingest_eml_folder(args.email_folder)

    print(f"\n[VectorStore] Total chunks in DB: {collection_count()}")