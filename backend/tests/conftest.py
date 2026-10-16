import os
from datetime import date, datetime, timezone
from types import SimpleNamespace
from urllib.parse import urlparse

import psycopg
import pytest
from fastapi.testclient import TestClient

from app import clock, db
from app.main import app

# Every test runs as if today (in IST) is this date.
TODAY = date(2026, 10, 7)
# ...and starts at this moment in UTC (11:30 in IST, the same day), which
# is when sessions begin. Tests move it with `now.value = ...`.
START = datetime(2026, 10, 7, 6, 0, 0, tzinfo=timezone.utc)
PASSWORD = "a good password"

# Normally the tests use temporary SQLite files. With TEST_DATABASE_URL set
# (as in CI), they run against a throwaway PostgreSQL instead.
TEST_DATABASE_URL = os.environ.get("TEST_DATABASE_URL")
POSTGRES = bool(TEST_DATABASE_URL)

# The tests delete every table, so they refuse any database that isn't on
# this computer, such as the real online one.
if POSTGRES and urlparse(TEST_DATABASE_URL).hostname not in {"localhost", "127.0.0.1"}:
    raise pytest.UsageError(
        "TEST_DATABASE_URL must be a throwaway PostgreSQL on this computer (localhost)."
    )


def _empty_postgres():
    with psycopg.connect(TEST_DATABASE_URL, autocommit=True) as conn:
        conn.execute("DROP TABLE IF EXISTS category_limits, expenses, categories, sessions, users CASCADE")


@pytest.fixture(autouse=True)
def database_choice(monkeypatch):
    """Points the app at the test database. A DATABASE_URL already set in
    the shell is never used, so tests can't reach a real database."""
    if POSTGRES:
        monkeypatch.setenv("DATABASE_URL", TEST_DATABASE_URL)
    else:
        monkeypatch.delenv("DATABASE_URL", raising=False)


@pytest.fixture
def db_path(tmp_path, monkeypatch):
    """A fresh, empty database for each test, never the real one: a new
    SQLite file, or freshly emptied PostgreSQL tables."""
    path = tmp_path / "test.db"
    monkeypatch.setenv("EXPENSES_DB_PATH", str(path))
    if POSTGRES:
        _empty_postgres()
    return path


@pytest.fixture(autouse=True)
def fixed_today(monkeypatch):
    monkeypatch.setattr(clock, "today_in_ist", lambda: TODAY)


@pytest.fixture(autouse=True)
def now(monkeypatch):
    """The current UTC time for sessions. Set `now.value` to move it."""
    state = SimpleNamespace(value=START)
    monkeypatch.setattr(clock, "now_utc", lambda: state.value)
    return state


def sign_up(client, username="tester", password=PASSWORD):
    return client.post("/api/auth/signup", json={"username": username, "password": password})


def log_in(client, username="tester", password=PASSWORD):
    return client.post("/api/auth/login", json={"username": username, "password": password})


def bearer(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def anon_client(db_path):
    """A started app with nobody logged in."""
    with TestClient(app) as test_client:
        yield test_client


def new_account(username, password=PASSWORD):
    """Signs up and returns a client that sends the new token with every
    request. Needs the app started already (for example by anon_client)."""
    response = sign_up(TestClient(app), username, password)
    assert response.status_code == 201, response.text
    return TestClient(app, headers=bearer(response.json()["token"]))


def query(sql, params=()):
    """Reads rows straight from the test database, as tuples."""
    conn = db.connect()
    try:
        return [tuple(row) for row in conn.execute(sql, params).fetchall()]
    finally:
        conn.close()


@pytest.fixture
def client(db_path):
    """A started app, logged in as a new account. Being the first account,
    it owns the six starting categories, with ids 1 to 6."""
    with TestClient(app) as test_client:
        response = sign_up(test_client)
        assert response.status_code == 201, response.text
        test_client.headers.update(bearer(response.json()["token"]))
        yield test_client


def make_expense(**changes):
    """A valid expense body; pass keyword arguments to change fields."""
    body = {"amount_paise": 1250, "category": "Food", "date": "2026-10-07", "note": "Lunch"}
    body.update(changes)
    return body


def insert_expense_row(amount_paise, date, created_at, category_id=1):
    """Writes an expense straight into the database, skipping the API's
    checks (for example to store a future date, or a chosen "saved at")."""
    conn = db.connect()
    try:
        with conn.transaction():
            conn.execute(
                "INSERT INTO expenses (amount_paise, category_id, date, note, created_at)"
                " VALUES (?, ?, ?, '', ?)",
                (amount_paise, category_id, date, created_at),
            )
    finally:
        conn.close()


def count_expense_rows():
    conn = db.connect()
    try:
        return conn.execute("SELECT COUNT(*) FROM expenses").fetchone()[0]
    finally:
        conn.close()
