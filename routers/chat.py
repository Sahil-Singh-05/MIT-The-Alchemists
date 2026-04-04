"""
Persistent employee chat endpoints.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from auth_utils import utcnow
from database import get_db
from db_models import ChatMessage, ChatSession, User
from dependencies import get_current_user
from models.chat import ChatRequest, ChatResponse, MessageItem, NewSessionRequest, SessionInfo
from rag.query_engine import ask

router = APIRouter(prefix="/chat", tags=["Chat"])


def _session_query_for_user(db: Session, session_id: str, user: User):
    query = db.query(ChatSession).filter(ChatSession.id == session_id)
    if user.role != "admin":
        query = query.filter(ChatSession.user_id == user.id)
    return query


def _message_item(message: ChatMessage) -> MessageItem:
    return MessageItem(
        role=message.role,
        content=message.content,
        timestamp=message.timestamp.isoformat(),
        question=message.question,
        sources=message.sources or [],
        has_conflict=message.has_conflict,
        conflict_note=message.conflict_note or "",
        has_answer=message.has_answer,
        no_answer_reason=message.no_answer_reason or "",
        is_error=message.is_error,
    )


@router.post("/session", response_model=SessionInfo)
async def new_session(
    body: NewSessionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = ChatSession(user_id=current_user.id, title=(body.title or "New Chat").strip() or "New Chat")
    db.add(session)
    db.commit()
    db.refresh(session)
    return SessionInfo(id=session.id, title=session.title, created_at=session.created_at.isoformat(), message_count=0)


@router.get("/sessions", response_model=list[SessionInfo])
async def get_all_sessions(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    query = (
        db.query(ChatSession, func.count(ChatMessage.id).label("message_count"))
        .outerjoin(ChatMessage, ChatMessage.session_id == ChatSession.id)
        .group_by(ChatSession.id)
        .order_by(ChatSession.updated_at.desc(), ChatSession.created_at.desc())
    )
    if current_user.role != "admin":
        query = query.filter(ChatSession.user_id == current_user.id)

    rows = query.all()
    return [
        SessionInfo(
            id=session.id,
            title=session.title,
            created_at=session.created_at.isoformat(),
            message_count=message_count,
        )
        for session, message_count in rows
    ]


@router.get("/session/{session_id}", response_model=list[MessageItem])
async def get_session_history(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = _session_query_for_user(db, session_id, current_user).first()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found.")

    messages = (
        db.query(ChatMessage)
        .filter(ChatMessage.session_id == session.id)
        .order_by(ChatMessage.timestamp.asc(), ChatMessage.id.asc())
        .all()
    )
    return [_message_item(message) for message in messages]


@router.delete("/session/{session_id}")
async def remove_session(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = _session_query_for_user(db, session_id, current_user).first()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found.")

    db.delete(session)
    db.commit()
    return {"status": "deleted", "session_id": session_id}


@router.post("/ask", response_model=ChatResponse)
async def ask_question(
    body: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = _session_query_for_user(db, body.session_id, current_user).first()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found.")

    existing_messages = (
        db.query(ChatMessage)
        .filter(ChatMessage.session_id == session.id)
        .order_by(ChatMessage.timestamp.asc(), ChatMessage.id.asc())
        .all()
    )
    history = [{"role": message.role, "content": message.content} for message in existing_messages]

    user_message = ChatMessage(session_id=session.id, role="user", content=body.question)
    db.add(user_message)

    if session.title == "New Chat":
        session.title = body.question[:50] + ("..." if len(body.question) > 50 else "")
    session.updated_at = utcnow()
    db.add(session)
    db.commit()

    result = ask(body.question, chat_history=history)
    answer_text = result["answer"] if result["has_answer"] else result["no_answer_reason"]

    assistant_message = ChatMessage(
        session_id=session.id,
        role="assistant",
        content=answer_text,
        question=body.question,
        sources=result["sources"],
        has_conflict=result["has_conflict"],
        conflict_note=result["conflict_note"],
        has_answer=result["has_answer"],
        no_answer_reason=result["no_answer_reason"],
    )
    session.updated_at = utcnow()
    db.add(assistant_message)
    db.add(session)
    db.commit()

    return ChatResponse(
        session_id=body.session_id,
        answer=answer_text,
        sources=result["sources"],
        has_conflict=result["has_conflict"],
        conflict_note=result["conflict_note"],
        has_answer=result["has_answer"],
        no_answer_reason=result["no_answer_reason"],
    )
