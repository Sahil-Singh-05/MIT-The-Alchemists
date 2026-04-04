import hashlib
import os
import secrets
from datetime import datetime, timedelta

from fastapi import HTTPException, Response, status
from dotenv import load_dotenv

load_dotenv()

SESSION_COOKIE_NAME = os.getenv("SESSION_COOKIE_NAME", "alchemist_session")
SESSION_TTL_DAYS = int(os.getenv("SESSION_TTL_DAYS", "7"))
ADMIN_EMPLOYEE_IDS = {
    item.strip().lower()
    for item in os.getenv("ALCHEMIST_ADMIN_EMPLOYEE_IDS", "").split(",")
    if item.strip()
}
ADMIN_EMAILS = {
    item.strip().lower()
    for item in os.getenv("ALCHEMIST_ADMIN_EMAILS", "").split(",")
    if item.strip()
}


def utcnow() -> datetime:
    return datetime.utcnow()


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    derived = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        120000,
    )
    return f"{salt}${derived.hex()}"


def verify_password(password: str, stored_hash: str) -> bool:
    try:
        salt, digest = stored_hash.split("$", 1)
    except ValueError:
        return False

    candidate = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        120000,
    ).hex()
    return secrets.compare_digest(candidate, digest)


def generate_session_token() -> str:
    return secrets.token_urlsafe(48)


def hash_session_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def session_expiry() -> datetime:
    return utcnow() + timedelta(days=SESSION_TTL_DAYS)


def set_session_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=token,
        httponly=True,
        samesite="lax",
        secure=False,
        max_age=SESSION_TTL_DAYS * 24 * 60 * 60,
        expires=SESSION_TTL_DAYS * 24 * 60 * 60,
        path="/",
    )


def clear_session_cookie(response: Response) -> None:
    response.delete_cookie(key=SESSION_COOKIE_NAME, path="/")


def resolve_role(employee_id: str, email: str) -> str:
    normalized_employee_id = employee_id.strip().lower()
    normalized_email = email.strip().lower()

    if normalized_employee_id in ADMIN_EMPLOYEE_IDS or normalized_email in ADMIN_EMAILS:
        return "admin"

    return "employee"


def invalid_credentials() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid employee ID, employee name, or password.",
    )
