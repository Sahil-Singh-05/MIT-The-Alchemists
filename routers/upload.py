"""
Admin document upload endpoints backed by the database.
"""

import os
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from database import get_db
from db_models import UploadedDocument, User
from dependencies import get_current_admin
from ingest import ingest_eml, ingest_excel, ingest_pdf
from models.admin import DocumentInfo, UploadResponse
from vectorstore.chroma_store import collection_count

router = APIRouter(prefix="/admin", tags=["Admin"])

SUPPORTED_EXTENSIONS = {".pdf", ".xlsx", ".xls", ".eml"}
DOCUMENT_STORAGE_DIR = Path("uploaded_files")
DOCUMENT_STORAGE_DIR.mkdir(parents=True, exist_ok=True)


def _document_type(suffix: str) -> str:
    if suffix == ".pdf":
        return "pdf"
    if suffix in {".xlsx", ".xls"}:
        return "excel"
    return "email"


def _document_category(document_type: str) -> str:
    return {
        "pdf": "Policy PDF",
        "excel": "Spreadsheet",
        "email": "Email Record",
    }[document_type]


def _document_info(document: UploadedDocument) -> DocumentInfo:
    return DocumentInfo(
        id=document.id,
        filename=document.filename,
        file_type=document.file_type,
        file_size=document.file_size,
        status=document.status,
        category=document.category,
        description=document.description,
        total_chunks=document.total_chunks,
        total_queries=document.total_queries,
        uploaded_at=document.uploaded_at.isoformat(),
        uploaded_by_name=document.uploaded_by_name,
    )


def _document_storage_path(document_id: str, filename: str) -> Path:
    suffix = Path(filename).suffix.lower()
    return DOCUMENT_STORAGE_DIR / f"{document_id}{suffix}"


def _viewer_media_type(filename: str) -> str:
    suffix = Path(filename).suffix.lower()
    if suffix == ".pdf":
        return "application/pdf"
    if suffix == ".xlsx":
        return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    if suffix == ".xls":
        return "application/vnd.ms-excel"
    if suffix == ".eml":
        return "message/rfc822"
    return "application/octet-stream"


@router.post("/upload", response_model=UploadResponse)
async def upload_document(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin),
):
    suffix = Path(file.filename).suffix.lower()
    if suffix not in SUPPORTED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file type '{suffix}'. Supported: PDF, Excel, EML",
        )

    contents = await file.read()
    before_count = collection_count()
    document_type = _document_type(suffix)
    document = UploadedDocument(
        filename=file.filename,
        file_type=document_type,
        file_size=len(contents),
        status="Indexed",
        category=_document_category(document_type),
        description=f"{file.filename} has been ingested into the knowledge base.",
        total_chunks=0,
        uploaded_by_user_id=current_user.id,
        uploaded_by_name=current_user.employee_name,
    )
    db.add(document)
    db.flush()
    storage_path = _document_storage_path(document.id, file.filename)
    storage_path.write_bytes(contents)

    try:
        if suffix == ".pdf":
            ingest_pdf(str(storage_path), source_name=file.filename)
        elif suffix in (".xlsx", ".xls"):
            ingest_excel(str(storage_path), source_name=file.filename)
        else:
            ingest_eml(str(storage_path), source_name=file.filename)

        after_count = collection_count()
        document.total_chunks = max(0, after_count - before_count)
        db.add(document)
        db.commit()
        db.refresh(document)

        return UploadResponse(
            status="success",
            filename=file.filename,
            message=f"{file.filename} ingested successfully.",
            total_chunks=after_count,
            document=_document_info(document),
        )
    except Exception as exc:
        db.rollback()
        if storage_path.exists():
            storage_path.unlink()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Ingestion failed: {exc}")


@router.get("/documents", response_model=list[DocumentInfo])
async def list_documents(db: Session = Depends(get_db), current_user: User = Depends(get_current_admin)):
    documents = db.query(UploadedDocument).order_by(UploadedDocument.uploaded_at.desc()).all()
    return [_document_info(document) for document in documents]


@router.get("/documents/{document_id}/viewer")
async def open_document_viewer(
    document_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin),
):
    document = db.query(UploadedDocument).filter(UploadedDocument.id == document_id).first()
    if not document:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found.")

    storage_path = _document_storage_path(document.id, document.filename)
    if not storage_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Original file is unavailable for this document. Please re-upload it to open the real viewer.",
        )

    return FileResponse(
        path=storage_path,
        media_type=_viewer_media_type(document.filename),
        filename=document.filename,
    )


@router.get("/status")
async def knowledge_base_status(current_user: User = Depends(get_current_admin)):
    return {"status": "ok", "total_chunks": collection_count()}
