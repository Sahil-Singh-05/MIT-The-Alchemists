"""
routers/crm.py — CRM support ticket auto-fill endpoint

When an employee gets an answer from the RAG system,
they can trigger this endpoint to auto-populate a support ticket
with the question, answer, and sources cited.
"""

import uuid
from datetime import datetime

from fastapi import APIRouter, HTTPException
from models.crm import CRMTicketRequest, CRMTicketResponse
from session_store import get_session

router = APIRouter(prefix="/crm", tags=["CRM"])

# In-memory ticket store (in production this would be a real CRM like HubSpot/Zoho)
_tickets: dict = {}


@router.post("/ticket", response_model=CRMTicketResponse)
async def create_ticket(body: CRMTicketRequest):
    """
    Auto-populate a CRM support ticket from a RAG answer.
    """
    # Validate session exists
    session = get_session(body.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")

    ticket_id  = f"TKT-{str(uuid.uuid4())[:8].upper()}"
    created_at = datetime.now().isoformat()

    # Build subject from question
    subject = body.question[:80] + ("..." if len(body.question) > 80 else "")

    # Build description
    description = (
        f"Client: {body.client_name or 'N/A'}\n\n"
        f"Employee Question:\n{body.question}\n\n"
        f"AI-Generated Answer:\n{body.answer}\n\n"
        f"Sources Referenced:\n"
        + "\n".join(
            f"- {s.get('file', '?')} | {s.get('location', '')} | Date: {s.get('date', '?')}"
            for s in body.sources
        )
    )

    # Extract source file names for the ticket
    sources_cited = list({s.get("file", "?") for s in body.sources})

    ticket = {
        "ticket_id"    : ticket_id,
        "status"       : "Open",
        "client_name"  : body.client_name or "Unknown",
        "priority"     : body.priority,
        "subject"      : subject,
        "description"  : description,
        "sources_cited": sources_cited,
        "created_at"   : created_at,
        "session_id"   : body.session_id,
    }

    _tickets[ticket_id] = ticket

    return CRMTicketResponse(
        ticket_id    = ticket_id,
        status       = "Open",
        client_name  = ticket["client_name"],
        priority     = ticket["priority"],
        subject      = subject,
        description  = description,
        sources_cited= sources_cited,
        created_at   = created_at,
    )


@router.get("/tickets")
async def list_tickets():
    """List all CRM tickets."""
    return list(_tickets.values())


@router.get("/ticket/{ticket_id}")
async def get_ticket(ticket_id: str):
    """Get a specific ticket by ID."""
    ticket = _tickets.get(ticket_id)    
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found.")
    return ticket