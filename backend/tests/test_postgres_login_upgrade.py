"""Criterion 34: the online PostgreSQL database from before accounts is
upgraded in one all-or-nothing step, with every category, expense, and limit
kept, and the first account to sign up takes all of it
(specs/backend-spec.md, "Upgrading the online database to accounts").
Runs only against the throwaway PostgreSQL in TEST_DATABASE_URL."""

import psycopg
import pytest
from fastapi.testclient import TestClient

from app import migration
from app.main import app
from conftest import POSTGRES, TEST_DATABASE_URL, new_account

pytestmark = pytest.mark.skipif(not POSTGRES, reason="only for PostgreSQL (set TEST_DATABASE_URL)")

# The tables exactly as they are online before accounts (backend/app/db.py
# on main before this change).
BEFORE_LOGIN_SCHEMA = """
CREATE TABLE categories (
    id   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name TEXT   NOT NULL CHECK (char_length(name) BETWEEN 1 AND 30)
);
CREATE UNIQUE INDEX categories_name_ignoring_capitals ON categories (lower(name));

CREATE TABLE expenses (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    amount_paise BIGINT NOT NULL CHECK (amount_paise > 0),
    category_id  BIGINT NOT NULL REFERENCES categories (id),
    date         TEXT   NOT NULL,
    note         TEXT   NOT NULL DEFAULT '',
    created_at   TEXT   NOT NULL
);

CREATE TABLE category_limits (
    category_id BIGINT PRIMARY KEY REFERENCES categories (id),
    limit_paise BIGINT NOT NULL CHECK (limit_paise > 0)
);
"""

# Food renamed to Groceries keeps id 1 and the food icon; Pets (7) gets
# the tag; "Old" (8) was deleted, so 8 must never be given out again.
CATEGORIES = ["Groceries", "Transport", "Shopping", "Bills", "Entertainment", "Other", "Pets", "Old"]
ICONS = ["food", "transport", "shopping", "bills", "entertainment", "other", "tag"]
STARTING = ["Food", "Transport", "Shopping", "Bills", "Entertainment", "Other"]

EXPENSES = [
    # (amount_paise, category_id, date, note, created_at)
    (1250, 1, "2026-10-07", "Lunch", "2026-10-07T06:00:00+00:00"),
    (50000, 4, "2026-10-02", "", "2026-10-02T09:30:00+00:00"),
    (4000, 7, "2026-09-12", "Vet", "2026-09-12T12:00:00+00:00"),
    (999, 1, "2026-10-05", "Deleted later", "2026-10-05T10:00:00+00:00"),
]

LIMITS = [(1, 500000), (7, 3000)]


def raw(sql, params=None):
    """Runs SQL straight on the test database and returns any rows."""
    with psycopg.connect(TEST_DATABASE_URL, autocommit=True) as conn:
        cursor = conn.execute(sql, params)
        return cursor.fetchall() if cursor.description else None


def has_users_table():
    return raw("SELECT to_regclass('public.users') IS NOT NULL")[0][0]


def rows():
    """Everything that must survive the upgrade unchanged."""
    return (
        raw("SELECT id, name FROM categories ORDER BY id"),
        raw("SELECT id, amount_paise, category_id, date, note, created_at FROM expenses ORDER BY id"),
        raw("SELECT category_id, limit_paise FROM category_limits ORDER BY category_id"),
    )


@pytest.fixture
def before_login_db(db_path):
    """db_path has emptied the database; fill it as it is online today."""
    raw(BEFORE_LOGIN_SCHEMA)
    for name in CATEGORIES:
        raw("INSERT INTO categories (name) VALUES (%s)", (name,))
    for expense in EXPENSES:
        raw(
            "INSERT INTO expenses (amount_paise, category_id, date, note, created_at)"
            " VALUES (%s, %s, %s, %s, %s)",
            expense,
        )
    for limit in LIMITS:
        raw("INSERT INTO category_limits VALUES (%s, %s)", limit)
    # Deleted before upgrading; their ids must never be reused.
    raw("DELETE FROM expenses WHERE note = 'Deleted later'")
    raw("DELETE FROM categories WHERE name = 'Old'")
    return db_path


@pytest.fixture
def started(before_login_db):
    """The app started once on the old database, so it has been upgraded."""
    with TestClient(app):
        yield before_login_db


def test_every_category_expense_and_limit_is_kept(before_login_db):
    before = rows()

    with TestClient(app):
        pass

    assert has_users_table()
    assert rows() == before
    assert len(before[1]) == 3


def test_old_categories_are_unclaimed_and_get_icons_by_id(started):
    assert raw("SELECT user_id, icon FROM categories ORDER BY id") == [(None, icon) for icon in ICONS]


def test_unclaimed_data_is_hidden_until_someone_signs_up(started):
    with TestClient(app) as anonymous:
        assert anonymous.get("/api/expenses").status_code == 401


def test_the_first_account_to_sign_up_takes_all_of_it(started):
    first = new_account("first")

    listed = first.get("/api/expenses").json()
    assert [(e["note"], e["category"], e["icon"]) for e in listed] == [
        ("Lunch", "Groceries", "food"),
        ("", "Bills", "bills"),
        ("Vet", "Pets", "tag"),
    ]
    summary = first.get("/api/summary").json()["categories"]
    assert [row["category"] for row in summary] == CATEGORIES[:7]
    assert [row["icon"] for row in summary] == ICONS
    groceries, pets = summary[0], summary[6]
    assert (groceries["spent_paise"], groceries["limit_paise"]) == (1250, 500000)
    assert pets["limit_paise"] == 3000
    # No second set of starting categories was added for the first account.
    assert raw("SELECT COUNT(*) FROM categories WHERE user_id IS NULL")[0][0] == 0
    assert raw("SELECT COUNT(*) FROM categories")[0][0] == 7


def test_later_accounts_start_fresh_and_never_reuse_ids(started):
    first = new_account("first")
    second = new_account("second")

    summary = second.get("/api/summary").json()["categories"]
    assert [row["category"] for row in summary] == STARTING
    # Ids 1 to 8 were given out before upgrading (8 was deleted).
    assert [row["category_id"] for row in summary] == list(range(9, 15))
    assert second.get("/api/expenses").json() == []
    assert len(first.get("/api/expenses").json()) == 3
    # Expense ids 1 to 4 were given out (4 was deleted), so the next is 5.
    added = second.post(
        "/api/expenses", json={"amount_paise": 100, "category": "Food", "date": "2026-10-07"}
    ).json()
    assert added["id"] == 5


def test_names_are_unique_per_account_after_upgrading(started):
    first = new_account("first")
    second = new_account("second")

    assert first.post("/api/categories", json={"name": "pets"}).json()["error"]["code"] == "duplicate_category"
    assert second.post("/api/categories", json={"name": "Pets"}).status_code == 201


def test_a_second_start_changes_nothing(started):
    new_account("first")
    before = rows(), raw("SELECT id, username FROM users")

    with TestClient(app):
        pass

    assert (rows(), raw("SELECT id, username FROM users")) == before


def test_a_failed_upgrade_leaves_the_database_unchanged(before_login_db, monkeypatch):
    before = rows()
    # Losing a limit partway makes the row-count check fail.
    monkeypatch.setattr(
        migration, "POSTGRES_ADD_ACCOUNTS", migration.POSTGRES_ADD_ACCOUNTS + "DELETE FROM category_limits;"
    )

    with pytest.raises(migration.MigrationError, match="Row counts changed"):
        with TestClient(app):
            pass

    assert not has_users_table()
    assert raw(
        "SELECT column_name FROM information_schema.columns WHERE table_name = 'categories' ORDER BY ordinal_position"
    ) == [("id",), ("name",)]
    assert rows() == before
