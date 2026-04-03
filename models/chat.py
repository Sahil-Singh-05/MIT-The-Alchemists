"""
models/chat.py — Pydantic models for chat endpoints

Defines the shape of requests and responses for the chat API.
"""

from pydantic import BaseModel
from typing import Optional


# ── Requests ──────────────────────────────────────────────────────────────────

class NewSessionRequest(BaseModel):
    title: Optional[str] = "New Chat"


class ChatRequest(BaseModel):
    session_id: str
    question  : str


# ── Responses ─────────────────────────────────────────────────────────────────

class SourceItem(BaseModel):
    file    : str
    format  : str
    date    : str
    type    : str
    location: Optional[str] = ""


class ChatResponse(BaseModel):
    session_id    : str
    answer        : str
    sources       : list[SourceItem]
    has_conflict  : bool
    conflict_note : str
    has_answer    : bool
    no_answer_reason: str


class SessionInfo(BaseModel):
    id           : str
    title        : str
    created_at   : str
    message_count: int


class MessageItem(BaseModel):
    role     : str
    content  : str
    timestamp: str