"""Criteria 24 to 31: signing up, logging in and out, how passwords are
stored, and what happens without a valid session (specs/backend-spec.md,
"Account rules" and "Session rules")."""

import hashlib
from datetime import timedelta

import pytest
from fastapi.testclient import TestClient

from app.main import app
from conftest import (
    PASSWORD,
    POSTGRES,
    START,
    bearer,
    log_in,
    make_expense,
    new_account,
    query,
    sign_up,
)

STARTING = ["Food", "Transport", "Shopping", "Bills", "Entertainment", "Other"]
STARTING_ICONS = ["food", "transport", "shopping", "bills", "entertainment", "other"]


def error(code, message, field=None):
    return {"error": {"code": code, "message": message, "field": field}}


NOT_LOGGED_IN = error("not_logged_in", "Please log in to continue.")
SESSION_EXPIRED = error("session_expired", "Your session has expired. Please log in again.")
WRONG_LOGIN = error("wrong_login", "Username or password is incorrect.")
INVALID_REQUEST = error("invalid_request", "The request could not be read. Please try again.")
INVALID_USERNAME = error(
    "invalid_username",
    "Username must be 3 to 20 characters, using only letters, numbers and underscores.",
    "username",
)
USERNAME_TAKEN = error("username_taken", "That username is already taken.", "username")
PASSWORD_TOO_SHORT = error("password_too_short", "Password must be at least 8 characters.", "password")
PASSWORD_TOO_LONG = error("password_too_long", "Password must be 64 characters or fewer.", "password")
PASSWORD_SAME = error(
    "password_same_as_username", "Password can't be the same as your username.", "password"
)


def user_count():
    return query("SELECT COUNT(*) FROM users")[0][0]


def session_count():
    return query("SELECT COUNT(*) FROM sessions")[0][0]


def me(client, token):
    return client.get("/api/auth/me", headers=bearer(token))


# --- 24. Signing up -----------------------------------------------------------


def test_sign_up_creates_the_account_and_logs_in(anon_client):
    response = sign_up(anon_client, "Shivani_1")

    assert response.status_code == 201
    body = response.json()
    assert set(body) == {"username", "token", "expires_at"}
    assert body["username"] == "shivani_1"
    assert body["expires_at"] == "2026-10-14T06:00:00Z"
    assert isinstance(body["token"], str) and len(body["token"]) >= 40
    assert me(anon_client, body["token"]).json() == {"username": "shivani_1"}
    assert user_count() == 1


def test_still_logged_in_after_reloading(anon_client):
    token = sign_up(anon_client).json()["token"]
    saved = anon_client.post("/api/expenses", json=make_expense(), headers=bearer(token)).json()

    # A fresh client is like reopening the page with the saved token.
    with TestClient(app, headers=bearer(token)) as reopened:
        assert reopened.get("/api/auth/me").json() == {"username": "tester"}
        assert reopened.get("/api/expenses").json() == [saved]


def test_a_new_account_starts_with_the_six_starting_categories(anon_client):
    alice = new_account("alice")

    rows = alice.get("/api/summary").json()["categories"]
    assert [row["category"] for row in rows] == STARTING
    assert [row["icon"] for row in rows] == STARTING_ICONS
    assert all(row["spent_paise"] == 0 and row["limit_paise"] is None for row in rows)
    assert alice.get("/api/expenses").json() == []


def test_spaces_around_the_username_are_removed(anon_client):
    assert sign_up(anon_client, "  Bob_7  ").json()["username"] == "bob_7"
    assert log_in(anon_client, "bob_7").status_code == 200


# --- 25. Username and password rules -----------------------------------------

BAD_USERNAMES = ["", "   ", "ab", "ab   ", "a" * 21, "has space", "dash-name", "dot.name", "émile", "name!"]


@pytest.mark.parametrize("username", BAD_USERNAMES)
def test_a_badly_formed_username_is_refused(anon_client, username):
    response = sign_up(anon_client, username)

    assert response.status_code == 422
    assert response.json() == INVALID_USERNAME
    assert user_count() == 0


@pytest.mark.parametrize("username", ["abc", "a" * 20, "A_1", "___", "Mixed_Case_99"])
def test_usernames_at_the_edges_of_the_rules_are_accepted(anon_client, username):
    response = sign_up(anon_client, username)

    assert response.status_code == 201
    assert response.json()["username"] == username.lower()


@pytest.mark.parametrize(
    "password, expected",
    [("", PASSWORD_TOO_SHORT), ("x" * 7, PASSWORD_TOO_SHORT), ("x" * 65, PASSWORD_TOO_LONG)],
)
def test_a_password_of_the_wrong_length_is_refused(anon_client, password, expected):
    response = sign_up(anon_client, "tester", password)

    assert response.status_code == 422
    assert response.json() == expected
    assert user_count() == 0


@pytest.mark.parametrize("password", ["x" * 8, "y" * 64, "        ", "has spaces in it"])
def test_passwords_at_the_edges_of_the_rules_are_accepted(anon_client, password):
    assert sign_up(anon_client, "tester", password).status_code == 201


@pytest.mark.parametrize("password", ["tester99", "TESTER99", "Tester99"])
def test_a_password_the_same_as_the_username_is_refused(anon_client, password):
    response = sign_up(anon_client, "Tester99", password)

    assert response.status_code == 422
    assert response.json() == PASSWORD_SAME
    assert user_count() == 0


def test_rules_are_checked_in_order(anon_client):
    # A1 before A3: a bad username is reported before a short password.
    assert sign_up(anon_client, "ab", "short").json() == INVALID_USERNAME
    # A3 before A4: "abcdef" is too short, and also the same as the username.
    assert sign_up(anon_client, "abcdef", "abcdef").json() == PASSWORD_TOO_SHORT
    # A2 before A3: a taken username is reported before a short password.
    sign_up(anon_client, "taken")
    assert sign_up(anon_client, "taken", "short").json() == USERNAME_TAKEN


BAD_BODIES = [
    {"password": PASSWORD},
    {"username": "tester"},
    {"username": None, "password": PASSWORD},
    {"username": 12345, "password": PASSWORD},
    {"username": "tester", "password": 12345678},
    {"username": ["tester"], "password": PASSWORD},
    ["tester", PASSWORD],
    "tester",
]


@pytest.mark.parametrize("body", BAD_BODIES)
def test_a_missing_or_non_text_username_or_password_is_unreadable(anon_client, body):
    for address in ("/api/auth/signup", "/api/auth/login"):
        response = anon_client.post(address, json=body)
        assert response.status_code == 422
        assert response.json() == INVALID_REQUEST
    assert user_count() == 0


# --- 26. Taken usernames ------------------------------------------------------


@pytest.mark.parametrize("again", ["shivani", "SHIVANI", "  Shivani  "])
def test_a_taken_username_is_refused_ignoring_capitals(anon_client, again):
    sign_up(anon_client, "Shivani")

    response = sign_up(anon_client, again, "another password")

    assert response.status_code == 422
    assert response.json() == USERNAME_TAKEN
    assert user_count() == 1


# --- 27. Passwords are stored only as Argon2 hashes --------------------------


def test_only_an_argon2_hash_of_the_password_is_stored(anon_client):
    sign_up(anon_client, "alice")

    [(stored,)] = query("SELECT password_hash FROM users")
    assert stored.startswith("$argon2id$")
    assert PASSWORD not in stored


def test_the_same_password_gives_different_hashes(anon_client):
    sign_up(anon_client, "alice")
    sign_up(anon_client, "bob")

    hashes = [row[0] for row in query("SELECT password_hash FROM users")]
    assert len(set(hashes)) == 2


def test_only_a_fingerprint_of_the_token_is_stored(anon_client):
    token = sign_up(anon_client).json()["token"]

    [(token_hash,)] = query("SELECT token_hash FROM sessions")
    assert token_hash == hashlib.sha256(token.encode()).hexdigest()


@pytest.mark.skipif(POSTGRES, reason="reads the SQLite file itself")
def test_the_database_file_never_contains_the_password_or_token(anon_client, db_path):
    password = "unmistakable-password-42"
    token = sign_up(anon_client, "alice", password).json()["token"]
    log_in(anon_client, "alice", password)

    contents = db_path.read_bytes()
    assert password.encode() not in contents
    assert token.encode() not in contents


# --- 28. Logging in -----------------------------------------------------------


def test_log_in_starts_a_new_session(anon_client):
    first = sign_up(anon_client).json()["token"]

    response = log_in(anon_client)

    assert response.status_code == 200
    body = response.json()
    assert body["username"] == "tester"
    assert body["expires_at"] == "2026-10-14T06:00:00Z"
    assert body["token"] != first
    assert me(anon_client, body["token"]).status_code == 200
    assert me(anon_client, first).status_code == 200


@pytest.mark.parametrize("username", ["TESTER", "  tester ", "Tester"])
def test_log_in_ignores_capitals_and_spaces_in_the_username(anon_client, username):
    sign_up(anon_client)

    assert log_in(anon_client, username).status_code == 200


def test_wrong_username_and_wrong_password_look_the_same(anon_client):
    sign_up(anon_client)

    wrong_password = log_in(anon_client, "tester", "not the password")
    wrong_username = log_in(anon_client, "nobody", PASSWORD)

    assert wrong_password.status_code == wrong_username.status_code == 401
    assert wrong_password.json() == wrong_username.json() == WRONG_LOGIN
    assert session_count() == 1  # only the one from signing up


@pytest.mark.parametrize("attempt", ["", "A GOOD PASSWORD", " a good password", "a good password "])
def test_the_password_must_match_exactly(anon_client, attempt):
    sign_up(anon_client)

    assert log_in(anon_client, "tester", attempt).json() == WRONG_LOGIN


# --- 29. Logging out ----------------------------------------------------------


def test_after_logging_out_the_token_is_refused(anon_client):
    token = sign_up(anon_client).json()["token"]
    other = log_in(anon_client).json()["token"]

    response = anon_client.post("/api/auth/logout", headers=bearer(token))

    assert response.status_code == 204
    assert me(anon_client, token).json() == NOT_LOGGED_IN
    assert anon_client.get("/api/expenses", headers=bearer(token)).json() == NOT_LOGGED_IN
    # Only that session ended; another browser stays logged in.
    assert me(anon_client, other).status_code == 200
    assert session_count() == 1


@pytest.mark.parametrize("headers", [{}, bearer("made-up-token"), {"Authorization": "nonsense"}])
def test_logging_out_without_a_valid_session_still_succeeds(anon_client, headers):
    sign_up(anon_client)

    assert anon_client.post("/api/auth/logout", headers=headers).status_code == 204
    assert session_count() == 1


def test_logging_out_twice_or_after_expiry_still_succeeds(anon_client, now):
    token = sign_up(anon_client).json()["token"]
    assert anon_client.post("/api/auth/logout", headers=bearer(token)).status_code == 204
    assert anon_client.post("/api/auth/logout", headers=bearer(token)).status_code == 204

    expired = log_in(anon_client).json()["token"]
    now.value = START + timedelta(days=8)
    assert anon_client.post("/api/auth/logout", headers=bearer(expired)).status_code == 204
    assert session_count() == 0


# --- 30. Every data request needs a valid session ----------------------------

DATA_REQUESTS = [
    ("get", "/api/expenses", None),
    ("get", "/api/expenses?month=2026-10", None),
    ("post", "/api/expenses", make_expense(amount_paise=99)),
    ("put", "/api/expenses/1", make_expense(amount_paise=99)),
    ("delete", "/api/expenses/1", None),
    ("get", "/api/summary", None),
    ("put", "/api/categories/1/limit", {"limit_paise": 99}),
    ("post", "/api/categories", {"name": "Pets"}),
    ("put", "/api/categories/1", {"name": "Groceries"}),
    ("delete", "/api/categories/2", None),
    ("get", "/api/months", None),
    ("get", "/api/months/2026-10/total", None),
    ("get", "/api/auth/me", None),
]

BAD_HEADERS = {
    "no header": {},
    "unknown token": bearer("made-up-token"),
    "empty token": {"Authorization": "Bearer "},
    "no Bearer word": {"Authorization": "made-up-token"},
    "other scheme": {"Authorization": "Basic dGVzdGVyOnB3"},
}


def snapshot(client):
    return (
        client.get("/api/expenses").json(),
        client.get("/api/summary").json(),
        client.get("/api/months").json(),
    )


@pytest.mark.parametrize("header_name", BAD_HEADERS)
@pytest.mark.parametrize("method, address, body", DATA_REQUESTS)
def test_every_data_request_needs_a_valid_session(anon_client, method, address, body, header_name):
    owner = new_account("owner")
    owner.post("/api/expenses", json=make_expense())  # expense 1
    owner.put("/api/categories/1/limit", json={"limit_paise": 500000})
    before = snapshot(owner)
    token = BAD_HEADERS[header_name]

    kwargs = {"headers": token} if body is None else {"headers": token, "json": body}
    response = getattr(anon_client, method)(address, **kwargs)

    assert response.status_code == 401
    assert response.json() == NOT_LOGGED_IN
    assert snapshot(owner) == before


@pytest.mark.parametrize(
    "method, address, kwargs",
    [
        ("put", "/api/expenses/abc", {"json": make_expense()}),
        ("put", "/api/categories/abc/limit", {"json": {"limit_paise": 0}}),
        ("post", "/api/expenses", {"content": "{not json", "headers": {"Content-Type": "application/json"}}),
        ("post", "/api/expenses", {"content": "{}", "headers": {"Content-Type": "text/plain"}}),
        ("get", "/api/months/2026-13/total", {}),
        ("get", "/api/expenses?month=September", {}),
    ],
)
def test_the_session_is_checked_before_anything_else(anon_client, method, address, kwargs):
    response = getattr(anon_client, method)(address, **kwargs)

    assert response.status_code == 401
    assert response.json() == NOT_LOGGED_IN


def test_sign_up_and_log_in_need_no_session(anon_client):
    assert sign_up(anon_client).status_code == 201
    assert log_in(anon_client).status_code == 200


# --- 31. Sessions end after 7 days -------------------------------------------


def test_a_session_works_until_7_days_after_logging_in(anon_client, now):
    token = sign_up(anon_client).json()["token"]

    now.value = START + timedelta(days=7) - timedelta(seconds=1)
    assert me(anon_client, token).status_code == 200

    now.value = START + timedelta(days=7)
    assert me(anon_client, token).json() == SESSION_EXPIRED


def test_an_expired_session_is_refused_and_deleted(anon_client, now):
    token = sign_up(anon_client).json()["token"]
    anon_client.post("/api/expenses", json=make_expense(), headers=bearer(token))
    now.value = START + timedelta(days=7, hours=1)

    response = anon_client.post("/api/expenses", json=make_expense(), headers=bearer(token))

    assert response.status_code == 401
    assert response.json() == SESSION_EXPIRED
    assert session_count() == 0
    # Its row is gone, so it is now simply unknown.
    assert me(anon_client, token).json() == NOT_LOGGED_IN
    # Nothing was added, and logging in again shows the data.
    fresh = log_in(anon_client).json()["token"]
    assert len(anon_client.get("/api/expenses", headers=bearer(fresh)).json()) == 1


def test_using_a_session_does_not_extend_it(anon_client, now):
    token = sign_up(anon_client).json()["token"]
    for day in range(1, 7):
        now.value = START + timedelta(days=day)
        assert me(anon_client, token).status_code == 200

    now.value = START + timedelta(days=7)
    assert me(anon_client, token).json() == SESSION_EXPIRED


def test_a_new_log_in_gets_a_new_7_days(anon_client, now):
    sign_up(anon_client)
    now.value = START + timedelta(days=6)
    token = log_in(anon_client).json()["token"]

    now.value = START + timedelta(days=12)
    assert me(anon_client, token).status_code == 200
