from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from auth_utils import (
    clear_session_cookie,
    generate_session_token,
    hash_password,
    hash_session_token,
    invalid_credentials,
    resolve_role,
    session_expiry,
    set_session_cookie,
    utcnow,
    verify_password,
)
from database import get_db
from db_models import AuthSession, User
from dependencies import get_current_auth_session, get_current_user
from models.auth import AuthResponse, LoginRequest, SessionDescriptor, SessionListResponse, SignUpRequest, UserProfile

router = APIRouter(prefix="/auth", tags=["Auth"])


def _to_user_profile(user: User) -> UserProfile:
    return UserProfile(
        id=user.id,
        employee_name=user.employee_name,
        email=user.email,
        phone_number=user.phone_number or "",
        employee_id=user.employee_id,
        role=user.role,
        created_at=user.created_at.isoformat(),
    )


def _to_session_descriptor(session: AuthSession, current_session_id: str | None = None) -> SessionDescriptor:
    return SessionDescriptor(
        id=session.id,
        created_at=session.created_at.isoformat(),
        last_seen_at=session.last_seen_at.isoformat(),
        expires_at=session.expires_at.isoformat(),
        user_agent=session.user_agent or "",
        ip_address=session.ip_address or "",
        is_current=session.id == current_session_id,
    )


def _create_auth_session(db: Session, user: User, request: Request) -> tuple[AuthSession, str]:
    raw_token = generate_session_token()
    auth_session = AuthSession(
        user_id=user.id,
        token_hash=hash_session_token(raw_token),
        expires_at=session_expiry(),
        user_agent=request.headers.get("user-agent", ""),
        ip_address=request.client.host if request.client else "",
    )
    db.add(auth_session)
    db.commit()
    db.refresh(auth_session)
    return auth_session, raw_token


@router.post("/signup", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def signup(body: SignUpRequest, request: Request, response: Response, db: Session = Depends(get_db)):
    existing_user = (
        db.query(User)
        .filter((User.email == body.email.strip().lower()) | (User.employee_id == body.employee_id.strip()))
        .first()
    )
    if existing_user:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email or employee ID already exists.")

    user = User(
        employee_name=body.employee_name.strip(),
        email=body.email.strip().lower(),
        phone_number=body.phone_number.strip(),
        employee_id=body.employee_id.strip(),
        password_hash=hash_password(body.password),
        role=resolve_role(body.employee_id, body.email),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    auth_session, raw_token = _create_auth_session(db, user, request)
    set_session_cookie(response, raw_token)
    return AuthResponse(user=_to_user_profile(user), session=_to_session_descriptor(auth_session, auth_session.id))


@router.post("/login", response_model=AuthResponse)
async def login(body: LoginRequest, request: Request, response: Response, db: Session = Depends(get_db)):
    employee_id = body.employee_id.strip()
    employee_name = body.employee_name.strip().lower()

    user = db.query(User).filter(User.employee_id == employee_id).first()
    if not user or not verify_password(body.password, user.password_hash):
        raise invalid_credentials()

    if employee_name and user.employee_name.strip().lower() != employee_name:
        raise invalid_credentials()

    auth_session, raw_token = _create_auth_session(db, user, request)
    set_session_cookie(response, raw_token)
    return AuthResponse(user=_to_user_profile(user), session=_to_session_descriptor(auth_session, auth_session.id))


@router.get("/me", response_model=AuthResponse)
async def me(auth_session: AuthSession = Depends(get_current_auth_session)):
    return AuthResponse(
        user=_to_user_profile(auth_session.user),
        session=_to_session_descriptor(auth_session, auth_session.id),
    )


@router.get("/sessions", response_model=SessionListResponse)
async def list_sessions(
    auth_session: AuthSession = Depends(get_current_auth_session),
    db: Session = Depends(get_db),
):
    sessions = (
        db.query(AuthSession)
        .filter(AuthSession.user_id == auth_session.user_id, AuthSession.revoked_at.is_(None))
        .order_by(AuthSession.created_at.desc())
        .all()
    )
    return SessionListResponse(
        sessions=[_to_session_descriptor(item, auth_session.id) for item in sessions if item.expires_at > utcnow()]
    )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    response: Response,
    auth_session: AuthSession = Depends(get_current_auth_session),
    db: Session = Depends(get_db),
):
    auth_session.revoked_at = utcnow()
    db.add(auth_session)
    db.commit()
    clear_session_cookie(response)
    response.status_code = status.HTTP_204_NO_CONTENT
    return None


@router.post("/logout-all", status_code=status.HTTP_204_NO_CONTENT)
async def logout_all(
    response: Response,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    sessions = (
        db.query(AuthSession)
        .filter(AuthSession.user_id == current_user.id, AuthSession.revoked_at.is_(None))
        .all()
    )
    now = utcnow()
    for session in sessions:
        session.revoked_at = now
        db.add(session)
    db.commit()
    clear_session_cookie(response)
    response.status_code = status.HTTP_204_NO_CONTENT
    return None


@router.delete("/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_session(
    session_id: str,
    response: Response,
    auth_session: AuthSession = Depends(get_current_auth_session),
    db: Session = Depends(get_db),
):
    target = (
        db.query(AuthSession)
        .filter(AuthSession.id == session_id, AuthSession.user_id == auth_session.user_id)
        .first()
    )
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found.")

    target.revoked_at = utcnow()
    db.add(target)
    db.commit()

    if target.id == auth_session.id:
        clear_session_cookie(response)

    response.status_code = status.HTTP_204_NO_CONTENT
    return None
