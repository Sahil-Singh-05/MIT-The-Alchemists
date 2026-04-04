"""
Pydantic models for chat endpoints.
"""

from typing import Optional

from pydantic import BaseModel, Field


class NewSessionRequest(BaseModel):
    title: Optional[str] = "New Chat"


class ChatRequest(BaseModel):
    session_id: str
    question: str


class SourceItem(BaseModel):
    file: str
    format: str
    date: str
    type: str
    location: Optional[str] = ""


class ChatResponse(BaseModel):
    session_id: str
    answer: str
    sources: list[SourceItem]
    has_conflict: bool
    conflict_note: str
    has_answer: bool
    no_answer_reason: str


class SessionInfo(BaseModel):
    id: str
    title: str
    created_at: str
    message_count: int


class MessageItem(BaseModel):
    role: str
    content: str
    timestamp: str
    question: Optional[str] = None
    sources: list[SourceItem] = Field(default_factory=list)
    has_conflict: bool = False
    conflict_note: str = ""
    has_answer: bool = True
    no_answer_reason: str = ""
    is_error: bool = False
