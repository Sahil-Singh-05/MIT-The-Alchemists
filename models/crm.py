"""
Pydantic models for CRM ticket endpoints.
"""

from typing import Optional

from pydantic import BaseModel, Field


class CRMQuery(BaseModel):
    question: str
    answer: str
    sources: list[dict] = Field(default_factory=list)


class CRMTicketRequest(BaseModel):
    session_id: str
    question: str
    answer: str
    sources: list[dict]
    client_name: Optional[str] = ""
    priority: Optional[str] = "Medium"
    created_by: Optional[str] = ""
    employee_id: Optional[str] = ""
    chat_summary: Optional[str] = ""
    queries: list[CRMQuery] = Field(default_factory=list)


class CRMTicketResponse(BaseModel):
    ticket_id: str
    status: str
    client_name: str
    priority: str
    subject: str
    description: str
    sources_cited: list[str]
    created_at: str
    session_id: str
    created_by: str
    employee_id: str
    chat_summary: str
    queries: list[CRMQuery]
