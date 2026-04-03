"""
session_store.py — In-memory chat session manager

Manages multiple chat sessions just like ChatGPT:
- Each session has a unique ID
- Each session stores its full message history
- History is passed to the RAG engine for multi-turn context
"""

import uuid
from datetime import datetime


# In-memory store: { session_id: { "title": str, "created_at": str, "messages": [] } }
_sessions: dict = {}


def create_session(title: str = "New Chat") -> dict:
    """Create a new chat session and return its info."""
    session_id = str(uuid.uuid4())
    _sessions[session_id] = {
        "id"        : session_id,
        "title"     : title,
        "created_at": datetime.now().isoformat(),
        "messages"  : [],
    }
    return _sessions[session_id]


def get_session(session_id: str) -> dict | None:
    """Get a session by ID. Returns None if not found."""
    return _sessions.get(session_id)


def list_sessions() -> list[dict]:
    """Return all sessions sorted by newest first."""
    return sorted(
        [
            {
                "id"        : s["id"],
                "title"     : s["title"],
                "created_at": s["created_at"],
                "message_count": len(s["messages"]),
            }
            for s in _sessions.values()
        ],
        key=lambda x: x["created_at"],
        reverse=True,
    )


def add_message(session_id: str, role: str, content: str) -> bool:
    """
    Add a message to a session.
    role: 'user' or 'assistant'
    Returns False if session not found.
    """
    session = _sessions.get(session_id)
    if not session:
        return False

    session["messages"].append({
        "role"      : role,
        "content"   : content,
        "timestamp" : datetime.now().isoformat(),
    })

    # Auto-update title from first user message
    if role == "user" and session["title"] == "New Chat":
        session["title"] = content[:50] + ("..." if len(content) > 50 else "")

    return True


def get_history(session_id: str) -> list[dict]:
    """
    Get chat history for a session in the format
    expected by the RAG query engine: [{"role": ..., "content": ...}]
    """
    session = _sessions.get(session_id)
    if not session:
        return []
    return [
        {"role": m["role"], "content": m["content"]}
        for m in session["messages"]
    ]


def delete_session(session_id: str) -> bool:
    """Delete a session. Returns False if not found."""
    if session_id not in _sessions:
        return False
    del _sessions[session_id]
    return True


def clear_all_sessions():
    """Wipe all sessions (for testing)."""
    _sessions.clear()