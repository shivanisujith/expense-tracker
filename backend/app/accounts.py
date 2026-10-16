"""Passwords and sessions (specs/backend-spec.md, "Account rules" and
"Session rules")."""

import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError

from app import clock, db
from app.validation import ApiError

SESSION_LENGTH = timedelta(days=7)
TIME_FORMAT = "%Y-%m-%dT%H:%M:%SZ"

# Argon2id with the library's recommended settings. Each hash includes its
# own random salt and settings, so verify() needs nothing else.
_hasher = PasswordHasher()


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def password_matches(stored_hash: str, password: str) -> bool:
    try:
        return _hasher.verify(stored_hash, password)
    except (VerificationError, InvalidHashError):
        return False


def not_logged_in() -> ApiError:
    return ApiError(401, "not_logged_in", "Please log in to continue.")


def session_expired() -> ApiError:
    return ApiError(401, "session_expired", "Your session has expired. Please log in again.")


def wrong_login() -> ApiError:
    return ApiError(401, "wrong_login", "Username or password is incorrect.")


def _fingerprint(token: str) -> str:
    """Only this is stored, so a copied database file can't log anyone in."""
    return hashlib.sha256(token.encode()).hexdigest()


def _token_from_header(header: str | None) -> str | None:
    """The token from "Bearer <token>", or None if the header isn't that."""
    scheme, _, token = (header or "").partition(" ")
    token = token.strip()
    if scheme.lower() != "bearer" or not token:
        return None
    return token


def start_session(conn, user_id: int) -> tuple[str, str]:
    """Saves a new session; returns its token and when it ends. Runs inside
    the caller's transaction."""
    token = secrets.token_urlsafe(32)
    started = clock.now_utc().replace(microsecond=0)
    expires = started + SESSION_LENGTH
    conn.execute(
        "INSERT INTO sessions (user_id, token_hash, created_at, expires_at) VALUES (?, ?, ?, ?)",
        (user_id, _fingerprint(token), started.strftime(TIME_FORMAT), expires.strftime(TIME_FORMAT)),
    )
    return token, expires.strftime(TIME_FORMAT)


def logged_in_user(header: str | None) -> int:
    """The account id for an Authorization header, or a 401 ApiError."""
    token = _token_from_header(header)
    if token is None:
        raise not_logged_in()
    conn = db.connect()
    try:
        session = conn.execute(
            "SELECT id, user_id, expires_at FROM sessions WHERE token_hash = ?", (_fingerprint(token),)
        ).fetchone()
        if session is None:
            raise not_logged_in()
        expires = datetime.strptime(session["expires_at"], TIME_FORMAT).replace(tzinfo=timezone.utc)
        if clock.now_utc() >= expires:
            with conn.transaction():
                conn.execute("DELETE FROM sessions WHERE id = ?", (session["id"],))
            raise session_expired()
        return session["user_id"]
    finally:
        conn.close()


def end_session(header: str | None) -> None:
    """Logging out: deletes the session if there is one (rule A9)."""
    token = _token_from_header(header)
    if token is None:
        return
    conn = db.connect()
    try:
        with conn.transaction():
            conn.execute("DELETE FROM sessions WHERE token_hash = ?", (_fingerprint(token),))
    finally:
        conn.close()
