"""Criterion 33: a database from before accounts is backed up, then upgraded
with every category, expense, and limit kept, and the first account to
sign up takes all of it (specs/backend-spec.md, "Upgrading to accounts").
Every test here uses a temporary file."""

import sqlite3

import pytest
from fastapi.testclient import TestClient

from app import migration
from app.main import app
from conftest import POSTGRES, new_account

# The upgrade only ever applies to a SQLite file on the laptop.
pytestmark = pytest.mark.skipif(POSTGRES, reason="only for the local SQLite file")

# The tables exactly as they were before accounts (backend/app/db.py
# before this change).
BEFORE_LOGIN_SCHEMA = """
CREATE TABLE categories (
    id   INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT    NOT NULL UNIQUE COLLATE NOCASE CHECK (length(name) BETWEEN 1 AND 30)
);

CREATE TABLE expenses (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    amount_paise INTEGER NOT NULL CHECK (amount_paise > 0),
    category_id  INTEGER NOT NULL REFERENCES categories (id),
    date         TEXT    NOT NULL,
    note         TEXT    NOT NULL DEFAULT '',
    created_at   TEXT    NOT NULL
);

CREATE TABLE category_limits (
    category_id INTEGER PRIMARY KEY REFERENCES categories (id),
    limit_paise INTEGER NOT NULL CHECK (limit_paise > 0)
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


def make_before_login_database(path):
    conn = sqlite3.connect(path)
    with conn:
        conn.executescript(BEFORE_LOGIN_SCHEMA)
        conn.executemany("INSERT INTO categories (name) VALUES (?)", [(name,) for name in CATEGORIES])
        conn.executemany(
            "INSERT INTO expenses (amount_paise, category_id, date, note, created_at)"
            " VALUES (?, ?, ?, ?, ?)",
            EXPENSES,
        )
        conn.executemany("INSERT INTO category_limits VALUES (?, ?)", LIMITS)
        # Deleted before upgrading; their ids must never be reused.
        conn.execute("DELETE FROM expenses WHERE note = 'Deleted later'")
        conn.execute("DELETE FROM categories WHERE name = 'Old'")
    conn.close()


def rows(path):
    """Everything that must survive the upgrade unchanged."""
    conn = sqlite3.connect(path)
    try:
        return (
            conn.execute("SELECT id, name FROM categories ORDER BY id").fetchall(),
            conn.execute(
                "SELECT id, amount_paise, category_id, date, note, created_at FROM expenses ORDER BY id"
            ).fetchall(),
            conn.execute("SELECT category_id, limit_paise FROM category_limits ORDER BY category_id").fetchall(),
        )
    finally:
        conn.close()


def has_users_table(path):
    conn = sqlite3.connect(path)
    try:
        return conn.execute("SELECT 1 FROM sqlite_master WHERE name = 'users'").fetchone() is not None
    finally:
        conn.close()


def backups(db_path):
    return sorted(db_path.parent.glob(f"{db_path.stem}.backup-before-login-*.db"))


@pytest.fixture
def before_login_db(db_path):
    make_before_login_database(db_path)
    return db_path


@pytest.fixture
def started(before_login_db):
    """The app started once on the old file, so it has been upgraded."""
    with TestClient(app):
        yield before_login_db


def test_the_database_is_backed_up_byte_for_byte_first(before_login_db):
    original = before_login_db.read_bytes()

    with TestClient(app):
        pass

    [backup] = backups(before_login_db)
    assert backup.read_bytes() == original
    assert has_users_table(before_login_db)


def test_every_category_expense_and_limit_is_kept(before_login_db):
    before = rows(before_login_db)

    with TestClient(app):
        pass

    assert rows(before_login_db) == before
    assert len(before[1]) == 3


def test_old_categories_are_unclaimed_and_get_icons_by_id(started):
    conn = sqlite3.connect(started)
    try:
        found = conn.execute("SELECT user_id, icon FROM categories ORDER BY id").fetchall()
    finally:
        conn.close()
    assert found == [(None, icon) for icon in ICONS]


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
    conn = sqlite3.connect(started)
    try:
        assert conn.execute("SELECT COUNT(*) FROM categories WHERE user_id IS NULL").fetchone()[0] == 0
        assert conn.execute("SELECT COUNT(*) FROM categories").fetchone()[0] == 7
    finally:
        conn.close()


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


def test_a_second_start_does_not_upgrade_or_back_up_again(started):
    with TestClient(app):
        pass

    assert len(backups(started)) == 1
    assert migration.database_state(str(started)) == "current"


def test_a_failed_upgrade_leaves_the_database_unchanged(before_login_db, monkeypatch):
    before = rows(before_login_db)
    # Copying one category fewer makes the row-count check fail partway.
    monkeypatch.setattr(migration, "COPY_CATEGORIES", migration.COPY_CATEGORIES + " WHERE id <> 7")

    with pytest.raises(migration.MigrationError, match="Row counts changed"):
        with TestClient(app):
            pass

    assert not has_users_table(before_login_db)
    assert migration.database_state(str(before_login_db)) == "before_login"
    assert rows(before_login_db) == before
    assert len(backups(before_login_db)) == 1


def test_a_failed_backup_stops_before_changing_anything(before_login_db, monkeypatch):
    before = rows(before_login_db)

    def broken_copy(source, destination):
        raise OSError("disk full")

    monkeypatch.setattr(migration.shutil, "copyfile", broken_copy)

    with pytest.raises(OSError, match="disk full"):
        with TestClient(app):
            pass

    assert not has_users_table(before_login_db)
    assert rows(before_login_db) == before
