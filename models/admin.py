from pydantic import BaseModel


class DocumentInfo(BaseModel):
    id: str
    filename: str
    file_type: str
    file_size: int
    status: str
    category: str
    description: str
    total_chunks: int
    total_queries: int
    uploaded_at: str
    uploaded_by_name: str


class UploadResponse(BaseModel):
    status: str
    filename: str
    message: str
    total_chunks: int
    document: DocumentInfo
