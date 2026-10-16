"""Criterion 15: an old database is backed up, then converted with every
expense and limit kept. It is then upgraded to accounts too (criterion 33,
tested in detail in test_login_migration.py). Every test here uses a
temporary file."""

import sqlite3

import pytest
from fastapi.testclient import TestClient

from app import migration
from app.main import app
from conftest import POSTGRES, bearer, sign_up

# The upgrade only ever applies to an old SQLite file on the laptop.
pytestmark = pytest.mark.skipif(POSTGRES, reason="only for the local SQLite file")

# The tables exactly as they were before categories could be managed
# (backend/app/db.py before this change).
OLD_SCHEMA = """
CREATE TABLE IF NOT EXISTS expenses (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    amount_paise INTEGER NOT NULL CHECK (amount_paise > 0),
    category     TEXT    NOT NULL CHECK (category IN ('Food', 'Transport', 'Shopping', 'Bills', 'Entertainment', 'Other')),
    date         TEXT    NOT NULL,
    note         TEXT    NOT NULL DEFAULT '',
    created_at   TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS category_limits (
    category    TEXT    PRIMARY KEY CHECK (category IN ('Food', 'Transport', 'Shopping', 'Bills', 'Entertainment', 'Other')),
    limit_paise INTEGER NOT NULL CHECK (limit_paise > 0)
);
"""

OLD_EXPENSES = [
    # (amount_paise, category, date, note, created_at)
    (1250, "Food", "2026-10-07", "Lunch", "2026-10-07T06:00:00+00:00"),
    (50000, "Bills", "2026-10-02", "", "2026-10-02T09:30:00+00:00"),
    (9900, "Shopping", "2026-09-28", "Socks", "2026-09-28T12:00:00+00:00"),
    (300, "Transport", "2026-08-15", "Bus", "2026-08-15T08:00:00+00:00"),
    (120000, "Entertainment", "2025-12-31", "New year", "2025-12-31T18:00:00+00:00"),
    (75, "Other", "2026-10-01", "Stamp", "2026-10-01T10:00:00+00:00"),
    (999, "Food", "2026-10-05", "Deleted later", "2026-10-05T10:00:00+00:00"),
]

OLD_LIMITS = [("Food", 500000), ("Bills", 40000)]

STARTING = ["Food", "Transport", "Shopping", "Bills", "Entertainment", "Other"]


def make_old_database(path):
    conn = sqlite3.connect(path)
    with conn:
        conn.executescript(OLD_SCHEMA)
        conn.executemany(
            "INSERT INTO expenses (amount_paise, category, date, note, created_at)"
            " VALUES (?, ?, ?, ?, ?)",
            OLD_EXPENSES,
        )
        # The highest id was deleted before upgrading; it must never be reused.
        conn.execute("DELETE FROM expenses WHERE note = 'Deleted later'")
        conn.executemany("INSERT INTO category_limits VALUES (?, ?)", OLD_LIMITS)
    conn.close()


def old_rows(path):
    conn = sqlite3.connect(path)
    expenses = conn.execute(
        "SELECT id, amount_paise, category, date, note, created_at FROM expenses ORDER BY id"
    ).fetchall()
    limits = conn.execute("SELECT category, limit_paise FROM category_limits ORDER BY category").fetchall()
    conn.close()
    return expenses, limits


def converted_rows(path):
    conn = sqlite3.connect(path)
    expenses = conn.execute(
        "SELECT e.id, e.amount_paise, c.name, e.date, e.note, e.created_at"
        " FROM expenses e JOIN categories c ON c.id = e.category_id ORDER BY e.id"
    ).fetchall()
    limits = conn.execute(
        "SELECT c.name, l.limit_paise FROM category_limits l"
        " JOIN categories c ON c.id = l.category_id ORDER BY c.name"
    ).fetchall()
    categories = [row[0] for row in conn.execute("SELECT name FROM categories ORDER BY id")]
    conn.close()
    return expenses, limits, categories


def backups(db_path):
    return sorted(db_path.parent.glob(f"{db_path.stem}.backup-before-categories-*.db"))


@pytest.fixture
def old_db(db_path):
    make_old_database(db_path)
    return db_path


def logged_in(client):
    """The first account to sign up takes the converted data."""
    client.headers.update(bearer(sign_up(client).json()["token"]))
    return client


def test_old_database_is_backed_up_byte_for_byte(old_db):
    original_bytes = old_db.read_bytes()

    with TestClient(app):
        pass

    [backup] = backups(old_db)
    assert backup.read_bytes() == original_bytes


def test_every_expense_and_limit_is_kept(old_db):
    expenses_before, limits_before = old_rows(old_db)

    with TestClient(app):
        pass

    expenses_after, limits_after, categories = converted_rows(old_db)
    assert len(expenses_before) == 6
    assert expenses_after == expenses_before
    assert limits_after == limits_before
    assert categories == STARTING


def test_converted_data_shows_through_the_api(old_db):
    with TestClient(app) as client:
        logged_in(client)
        listed = client.get("/api/expenses").json()
        summary = client.get("/api/summary").json()["categories"]

    assert [e["note"] for e in listed] == ["Lunch", "", "Stamp", "Socks", "Bus", "New year"]
    assert listed[0] == {
        "id": 1,
        "amount_paise": 1250,
        "category": "Food",
        "category_id": 1,
        "icon": "food",
        "date": "2026-10-07",
        "note": "Lunch",
    }
    food = next(row for row in summary if row["category"] == "Food")
    assert (food["spent_paise"], food["limit_paise"]) == (1250, 500000)
    bills = next(row for row in summary if row["category"] == "Bills")
    assert bills["over_limit"] is True


def test_deleted_expense_ids_are_still_never_reused(old_db):
    with TestClient(app) as client:
        new = logged_in(client).post(
            "/api/expenses",
            json={"amount_paise": 100, "category": "Food", "date": "2026-10-07"},
        ).json()

    # Ids 1-7 were given out before upgrading (7 was deleted), so the next is 8.
    assert new["id"] == 8


def test_second_start_does_not_convert_or_back_up_again(old_db):
    with TestClient(app):
        pass
    with TestClient(app):
        pass

    assert len(backups(old_db)) == 1
    assert migration.database_state(str(old_db)) == "current"


def test_failed_conversion_leaves_the_database_unchanged(old_db, monkeypatch):
    expenses_before, limits_before = old_rows(old_db)
    # Without "Other" among the starting categories, the "Other" expense
    # can't be matched, so the row-count check fails partway through.
    monkeypatch.setattr(migration, "STARTING_CATEGORIES", tuple(STARTING[:-1]))

    with pytest.raises(migration.MigrationError, match="Row counts changed"):
        with TestClient(app):
            pass

    assert migration.database_state(str(old_db)) == "old"
    assert old_rows(old_db) == (expenses_before, limits_before)
    assert len(backups(old_db)) == 1


def test_failed_backup_stops_before_changing_anything(old_db, monkeypatch):
    expenses_before, limits_before = old_rows(old_db)

    def broken_copy(source, destination):
        raise OSError("disk full")

    monkeypatch.setattr(migration.shutil, "copyfile", broken_copy)

    with pytest.raises(OSError, match="disk full"):
        with TestClient(app):
            pass

    assert migration.database_state(str(old_db)) == "old"
    assert old_rows(old_db) == (expenses_before, limits_before)


def test_old_database_is_also_upgraded_to_accounts(old_db):
    with TestClient(app):
        pass

    assert migration.database_state(str(old_db)) == "current"
    assert len(sorted(old_db.parent.glob(f"{old_db.stem}.backup-before-login-*.db"))) == 1
    conn = sqlite3.connect(old_db)
    try:
        found = conn.execute("SELECT user_id, icon FROM categories ORDER BY id").fetchall()
    finally:
        conn.close()
    icons = ["food", "transport", "shopping", "bills", "entertainment", "other"]
    assert found == [(None, icon) for icon in icons]


def test_brand_new_database_has_no_categories_until_the_first_sign_up_and_no_backup(db_path):
    with TestClient(app) as client:
        expenses, limits, categories = converted_rows(db_path)
        assert (expenses, limits, categories) == ([], [], [])

        sign_up(client)

    expenses, limits, categories = converted_rows(db_path)
    assert (expenses, limits) == ([], [])
    assert categories == STARTING
    assert sorted(db_path.parent.glob(f"{db_path.stem}.backup-*.db")) == []
