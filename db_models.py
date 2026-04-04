import uuid
from datetime import datetime

from sqlalchemy import JSON, Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from database import Base


def _uuid() -> str:
    return str(uuid.uuid4())


def _utcnow() -> datetime:
    return datetime.utcnow()


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=_uuid)
    employee_name = Column(String, nullable=False)
    email = Column(String, nullable=False, unique=True, index=True)
    phone_number = Column(String, nullable=True)
    employee_id = Column(String, nullable=False, unique=True, index=True)
    password_hash = Column(String, nullable=False)
    role = Column(String, nullable=False, default="employee", index=True)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, nullable=False, default=_utcnow)
    updated_at = Column(DateTime, nullable=False, default=_utcnow, onupdate=_utcnow)

    auth_sessions = relationship("AuthSession", back_populates="user", cascade="all, delete-orphan")
    chat_sessions = relationship("ChatSession", back_populates="user", cascade="all, delete-orphan")
    tickets = relationship("CRMTicket", back_populates="user", cascade="all, delete-orphan")
    uploaded_documents = relationship(
        "UploadedDocument",
        back_populates="uploaded_by_user",
        cascade="all, delete-orphan",
    )


class AuthSession(Base):
    __tablename__ = "auth_sessions"

    id = Column(String, primary_key=True, default=_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    token_hash = Column(String, nullable=False, unique=True, index=True)
    created_at = Column(DateTime, nullable=False, default=_utcnow)
    last_seen_at = Column(DateTime, nullable=False, default=_utcnow)
    expires_at = Column(DateTime, nullable=False)
    revoked_at = Column(DateTime, nullable=True)
    user_agent = Column(String, nullable=True)
    ip_address = Column(String, nullable=True)

    user = relationship("User", back_populates="auth_sessions")


class ChatSession(Base):
    __tablename__ = "chat_sessions"

    id = Column(String, primary_key=True, default=_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    title = Column(String, nullable=False, default="New Chat")
    created_at = Column(DateTime, nullable=False, default=_utcnow)
    updated_at = Column(DateTime, nullable=False, default=_utcnow, onupdate=_utcnow)

    user = relationship("User", back_populates="chat_sessions")
    messages = relationship(
        "ChatMessage",
        back_populates="session",
        cascade="all, delete-orphan",
        order_by="ChatMessage.timestamp",
    )
    tickets = relationship("CRMTicket", back_populates="chat_session")


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(String, ForeignKey("chat_sessions.id"), nullable=False, index=True)
    role = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    timestamp = Column(DateTime, nullable=False, default=_utcnow, index=True)
    question = Column(Text, nullable=True)
    sources = Column(JSON, nullable=False, default=list)
    has_conflict = Column(Boolean, nullable=False, default=False)
    conflict_note = Column(Text, nullable=False, default="")
    has_answer = Column(Boolean, nullable=False, default=True)
    no_answer_reason = Column(Text, nullable=False, default="")
    is_error = Column(Boolean, nullable=False, default=False)

    session = relationship("ChatSession", back_populates="messages")


class CRMTicket(Base):
    __tablename__ = "crm_tickets"

    ticket_id = Column(String, primary_key=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    session_id = Column(String, ForeignKey("chat_sessions.id"), nullable=False, index=True)
    status = Column(String, nullable=False, default="Open")
    client_name = Column(String, nullable=False, default="Unknown")
    priority = Column(String, nullable=False, default="Medium")
    subject = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    sources_cited = Column(JSON, nullable=False, default=list)
    created_at = Column(DateTime, nullable=False, default=_utcnow)
    created_by = Column(String, nullable=False, default="Unknown")
    employee_id = Column(String, nullable=False, default="N/A")
    chat_summary = Column(Text, nullable=False, default="")
    queries = Column(JSON, nullable=False, default=list)

    user = relationship("User", back_populates="tickets")
    chat_session = relationship("ChatSession", back_populates="tickets")


class UploadedDocument(Base):
    __tablename__ = "uploaded_documents"

    id = Column(String, primary_key=True, default=_uuid)
    filename = Column(String, nullable=False)
    file_type = Column(String, nullable=False)
    file_size = Column(Integer, nullable=False, default=0)
    status = Column(String, nullable=False, default="Indexed")
    category = Column(String, nullable=False, default="Knowledge Base")
    description = Column(Text, nullable=False, default="")
    total_chunks = Column(Integer, nullable=False, default=0)
    total_queries = Column(Integer, nullable=False, default=0)
    uploaded_at = Column(DateTime, nullable=False, default=_utcnow, index=True)
    uploaded_by_user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    uploaded_by_name = Column(String, nullable=False)

    uploaded_by_user = relationship("User", back_populates="uploaded_documents")
