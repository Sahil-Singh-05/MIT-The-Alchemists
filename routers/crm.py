"""
Persistent CRM support ticket endpoints.
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from database import get_db
from db_models import CRMTicket, ChatSession, User
from dependencies import get_current_user
from models.crm import CRMQuery, CRMTicketRequest, CRMTicketResponse

router = APIRouter(prefix="/crm", tags=["CRM"])


def _truncate_subject(question: str) -> str:
    return question[:80] + ("..." if len(question) > 80 else "")


def _flatten_sources(queries: list[CRMQuery], fallback_sources: list[dict]) -> list[dict]:
    collected_sources = [source for query in queries for source in query.sources]
    return collected_sources or fallback_sources


def _build_chat_summary(queries: list[CRMQuery], fallback_question: str, fallback_sources: list[dict]) -> str:
    effective_queries = queries or [CRMQuery(question=fallback_question, answer="", sources=fallback_sources)]
    latest_question = next(
        (query.question.strip() for query in reversed(effective_queries) if query.question.strip()),
        fallback_question.strip() or "the employee query",
    )
    source_names = []
    for source in _flatten_sources(effective_queries, fallback_sources):
        name = str(source.get("file", "")).strip()
        if name and name not in source_names:
            source_names.append(name)

    query_count = len([query for query in effective_queries if query.question.strip()]) or 1
    source_note = (
        f" grounded in {len(source_names)} source document(s): {', '.join(source_names[:3])}."
        if source_names
        else " grounded in the indexed knowledge base."
    )
    if len(source_names) > 3:
        source_note = source_note[:-1] + ", and others."

    if query_count == 1:
        return f"Employee raised a support query about '{latest_question}' with an AI response{source_note}"

    return (
        f"Employee raised {query_count} related support queries. "
        f"The latest topic was '{latest_question}', with AI responses{source_note}"
    )


def _ticket_query_for_user(db: Session, ticket_id: str, user: User):
    query = db.query(CRMTicket).filter(CRMTicket.ticket_id == ticket_id)
    if user.role != "admin":
        query = query.filter(CRMTicket.user_id == user.id)
    return query


def _to_response(ticket: CRMTicket) -> CRMTicketResponse:
    return CRMTicketResponse(
        ticket_id=ticket.ticket_id,
        status=ticket.status,
        client_name=ticket.client_name,
        priority=ticket.priority,
        subject=ticket.subject,
        description=ticket.description,
        sources_cited=ticket.sources_cited or [],
        created_at=ticket.created_at.isoformat(),
        session_id=ticket.session_id,
        created_by=ticket.created_by,
        employee_id=ticket.employee_id,
        chat_summary=ticket.chat_summary,
        queries=ticket.queries or [],
    )


@router.post("/ticket", response_model=CRMTicketResponse)
async def create_ticket(
    body: CRMTicketRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session_query = db.query(ChatSession).filter(ChatSession.id == body.session_id)
    if current_user.role != "admin":
        session_query = session_query.filter(ChatSession.user_id == current_user.id)
    chat_session = session_query.first()
    if not chat_session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found.")

    existing_ticket = (
        db.query(CRMTicket)
        .filter(CRMTicket.session_id == body.session_id, CRMTicket.user_id == chat_session.user_id)
        .first()
    )
    if existing_ticket:
        return _to_response(existing_ticket)

    ticket_id = f"TKT-{str(uuid.uuid4())[:8].upper()}"
    queries = body.queries or [CRMQuery(question=body.question, answer=body.answer, sources=body.sources)]
    all_sources = _flatten_sources(queries, body.sources)
    sources_cited = list({source.get("file", "?") for source in all_sources})
    subject = _truncate_subject(body.question)
    chat_summary = _build_chat_summary(queries, body.question, body.sources)
    description = (
        f"Client: {body.client_name or 'N/A'}\n\n"
        f"Employee Question:\n{body.question}\n\n"
        f"AI-Generated Answer:\n{body.answer}\n\n"
        f"Sources Referenced:\n"
        + "\n".join(
            f"- {source.get('file', '?')} | {source.get('location', '')} | Date: {source.get('date', '?')}"
            for source in all_sources
        )
    )

    ticket = CRMTicket(
        ticket_id=ticket_id,
        user_id=chat_session.user_id,
        session_id=body.session_id,
        status="Open",
        client_name=body.client_name or "Unknown",
        priority=body.priority or "Medium",
        subject=subject,
        description=description,
        sources_cited=sources_cited,
        created_by=body.created_by or current_user.employee_name,
        employee_id=body.employee_id or current_user.employee_id,
        chat_summary=chat_summary,
        queries=[query.model_dump() for query in queries],
    )
    db.add(ticket)
    db.commit()
    db.refresh(ticket)
    return _to_response(ticket)


@router.get("/tickets", response_model=list[CRMTicketResponse])
async def list_tickets(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    query = db.query(CRMTicket).order_by(CRMTicket.created_at.desc())
    if current_user.role != "admin":
        query = query.filter(CRMTicket.user_id == current_user.id)
    return [_to_response(ticket) for ticket in query.all()]


@router.get("/ticket/{ticket_id}", response_model=CRMTicketResponse)
async def get_ticket(
    ticket_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ticket = _ticket_query_for_user(db, ticket_id, current_user).first()
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found.")
    return _to_response(ticket)
