import os
import sqlite3
from pathlib import Path

from app.validation import CATEGORIES

DEFAULT_DB_PATH = Path(__file__).resolve().parent.parent / "expenses.db"

_category_list = ", ".join(f"'{name}'" for name in CATEGORIES)

# The CHECK rules are a last safety net; validation.py gives the real errors.
SCHEMA = f"""
CREATE TABLE IF NOT EXISTS expenses (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    amount_paise INTEGER NOT NULL CHECK (amount_paise > 0),
    category     TEXT    NOT NULL CHECK (category IN ({_category_list})),
    date         TEXT    NOT NULL,
    note         TEXT    NOT NULL DEFAULT '',
    created_at   TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS category_limits (
    category    TEXT    PRIMARY KEY CHECK (category IN ({_category_list})),
    limit_paise INTEGER NOT NULL CHECK (limit_paise > 0)
);
"""


def get_db_path() -> str:
    """Tests point EXPENSES_DB_PATH at a temporary file."""
    return os.environ.get("EXPENSES_DB_PATH", str(DEFAULT_DB_PATH))


def connect() -> sqlite3.Connection:
    conn = sqlite3.connect(get_db_path())
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    conn = connect()
    try:
        conn.executescript(SCHEMA)
    finally:
        conn.close()
