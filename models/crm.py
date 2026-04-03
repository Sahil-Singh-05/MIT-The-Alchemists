"""
models/crm.py — Pydantic models for CRM ticket endpoint

Defines the shape of the auto-populated support ticket.
"""

from pydantic import BaseModel
from typing import Optional


# ── Request ───────────────────────────────────────────────────────────────────

class CRMTicketRequest(BaseModel):
    session_id  : str
    question    : str
    answer      : str
    sources     : list[dict]
    client_name : Optional[str] = ""
    priority    : Optional[str] = "Medium"  # Low / Medium / High


# ── Response ──────────────────────────────────────────────────────────────────

class CRMTicketResponse(BaseModel):
    ticket_id      : str
    status         : str
    client_name    : str
    priority       : str
    subject        : str
    description    : str
    sources_cited  : list[str]
    created_at     : str