import os
import sqlite3
from pathlib import Path

from app import migration
from app.validation import STARTING_CATEGORIES

DEFAULT_DB_PATH = Path(__file__).resolve().parent.parent / "expenses.db"

# The current format (see specs/backend-spec.md, "Data stored"). The CHECK
# rules are a last safety net; validation.py gives the real errors.
CATEGORIES_TABLE = """
CREATE TABLE categories (
    id   INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT    NOT NULL UNIQUE COLLATE NOCASE CHECK (length(name) BETWEEN 1 AND 30)
);
"""

EXPENSES_AND_LIMITS_TABLES = """
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


def get_db_path() -> str:
    """Tests point EXPENSES_DB_PATH at a temporary file."""
    return os.environ.get("EXPENSES_DB_PATH", str(DEFAULT_DB_PATH))


def connect() -> sqlite3.Connection:
    conn = sqlite3.connect(get_db_path())
    conn.row_factory = sqlite3.Row
    # SQLite only checks REFERENCES rules when this is switched on.
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def starting_categories_sql() -> str:
    names = ", ".join(f"('{name}')" for name in STARTING_CATEGORIES)
    return f"INSERT INTO categories (name) VALUES {names};"


def init_db() -> None:
    """Brings the database file to the current format when the app starts."""
    path = get_db_path()
    state = migration.database_state(path)
    if state == "empty":
        _create_new_database(path)
    elif state == "old":
        migration.upgrade_old_database(path, CATEGORIES_TABLE, EXPENSES_AND_LIMITS_TABLES)


def _create_new_database(path: str) -> None:
    conn = sqlite3.connect(path)
    try:
        # One script, one transaction: tables and starting categories together.
        conn.executescript(
            "BEGIN;"
            + CATEGORIES_TABLE
            + EXPENSES_AND_LIMITS_TABLES
            + starting_categories_sql()
            + "COMMIT;"
        )
    finally:
        conn.close()


def category_ids(conn: sqlite3.Connection) -> dict[str, int]:
    """Current category names mapped to their ids."""
    return {row["name"]: row["id"] for row in conn.execute("SELECT id, name FROM categories")}
