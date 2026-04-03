"""
routers/upload.py — Admin document upload endpoint

Handles file uploads from the admin interface.
Supports PDF, Excel (.xlsx/.xls), and EML email files.
"""

import os
import tempfile
from pathlib import Path

from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse

from ingest import ingest_pdf, ingest_excel, ingest_eml
from vectorstore.chroma_store import collection_count

router = APIRouter(prefix="/admin", tags=["Admin"])

SUPPORTED_EXTENSIONS = {".pdf", ".xlsx", ".xls", ".eml"}


@router.post("/upload")
async def upload_document(file: UploadFile = File(...)):
    """
    Upload and ingest a document into the knowledge base.
    Supported formats: PDF, Excel, EML
    """
    suffix = Path(file.filename).suffix.lower()

    if suffix not in SUPPORTED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{suffix}'. Supported: PDF, Excel, EML"
        )

    # Save to temp file (Windows-safe: close before processing)
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        contents = await file.read()
        tmp.write(contents)
        tmp_path = tmp.name
        tmp.flush()
        tmp.close()

    try:
        if suffix == ".pdf":
            ingest_pdf(tmp_path, source_name=file.filename)
        elif suffix in (".xlsx", ".xls"):
            ingest_excel(tmp_path, source_name=file.filename)
        elif suffix == ".eml":
            ingest_eml(tmp_path, source_name=file.filename)

        return JSONResponse(content={
            "status"      : "success",
            "filename"    : file.filename,
            "message"     : f"{file.filename} ingested successfully.",
            "total_chunks": collection_count(),
        })

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ingestion failed: {str(e)}")

    finally:
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)


@router.get("/status")
async def knowledge_base_status():
    """Return the current state of the knowledge base."""
    return {
        "status"      : "ok",
        "total_chunks": collection_count(),
    }