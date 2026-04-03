"""
routers/chat.py — Employee chat endpoints

Handles all chat-related operations:
- Create a new chat session
- Send a message and get a RAG answer
- List all chat sessions
- Get history of a specific session
- Delete a session
"""

from fastapi import APIRouter, HTTPException

from models.chat import (
    NewSessionRequest,
    ChatRequest,
    ChatResponse,
    SessionInfo,
    MessageItem,
)
from session_store import (
    create_session,
    get_session,
    list_sessions,
    add_message,
    get_history,
    delete_session,
)
from rag.query_engine import ask

router = APIRouter(prefix="/chat", tags=["Chat"])


@router.post("/session", response_model=SessionInfo)
async def new_session(body: NewSessionRequest):
    """Create a new chat session."""
    session = create_session(title=body.title)
    return SessionInfo(
        id            = session["id"],
        title         = session["title"],
        created_at    = session["created_at"],
        message_count = 0,
    )


@router.get("/sessions", response_model=list[SessionInfo])
async def get_all_sessions():
    """List all chat sessions."""
    return list_sessions()


@router.get("/session/{session_id}", response_model=list[MessageItem])
async def get_session_history(session_id: str):
    """Get full message history for a session."""
    session = get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")
    return [
        MessageItem(
            role      = m["role"],
            content   = m["content"],
            timestamp = m["timestamp"],
        )
        for m in session["messages"]
    ]


@router.delete("/session/{session_id}")
async def remove_session(session_id: str):
    """Delete a chat session."""
    success = delete_session(session_id)
    if not success:
        raise HTTPException(status_code=404, detail="Session not found.")
    return {"status": "deleted", "session_id": session_id}


@router.post("/ask", response_model=ChatResponse)
async def ask_question(body: ChatRequest):
    """
    Send a question and get a RAG-powered answer.
    Automatically stores the message in the session history.
    """
    # Validate session
    session = get_session(body.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")

    # Get existing history for multi-turn context
    history = get_history(body.session_id)

    # Store user message
    add_message(body.session_id, role="user", content=body.question)

    # Run RAG pipeline
    result = ask(body.question, chat_history=history)

    # Build answer text
    if result["has_answer"]:
        answer_text = result["answer"]
    else:
        answer_text = result["no_answer_reason"]

    # Store assistant response
    add_message(body.session_id, role="assistant", content=answer_text)

    return ChatResponse(
        session_id       = body.session_id,
        answer           = answer_text,
        sources          = result["sources"],
        has_conflict     = result["has_conflict"],
        conflict_note    = result["conflict_note"],
        has_answer       = result["has_answer"],
        no_answer_reason = result["no_answer_reason"],
    )