from fastapi import Cookie, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from auth_utils import SESSION_COOKIE_NAME, hash_session_token, utcnow
from database import get_db
from db_models import AuthSession, User


def get_current_auth_session(
    session_token: str | None = Cookie(default=None, alias=SESSION_COOKIE_NAME),
    db: Session = Depends(get_db),
) -> AuthSession:
    if not session_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required.")

    token_hash = hash_session_token(session_token)
    auth_session = (
        db.query(AuthSession)
        .options(joinedload(AuthSession.user))
        .filter(AuthSession.token_hash == token_hash)
        .first()
    )

    if (
        not auth_session
        or auth_session.revoked_at is not None
        or auth_session.expires_at <= utcnow()
        or not auth_session.user
        or not auth_session.user.is_active
    ):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session expired. Please sign in again.")

    auth_session.last_seen_at = utcnow()
    db.add(auth_session)
    db.commit()
    db.refresh(auth_session)
    return auth_session


def get_current_user(auth_session: AuthSession = Depends(get_current_auth_session)) -> User:
    return auth_session.user


def get_current_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access is required.")
    return user
