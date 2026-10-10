"""Upgrading a database from before categories could be managed.

Old format: `expenses.category` and `category_limits.category` hold one of
the six fixed names. Current format: both point to a row in `categories` by
id. See specs/backend-spec.md, "Upgrading an existing database".
"""

import filecmp
import logging
import shutil
import sqlite3
from datetime import datetime
from pathlib import Path

from app.validation import STARTING_CATEGORIES

logger = logging.getLogger(__name__)


class MigrationError(Exception):
    pass


def database_state(path: str) -> str:
    """'empty' (no tables yet), 'old' (needs converting) or 'current'."""
    conn = sqlite3.connect(path)
    try:
        columns = [row[1] for row in conn.execute("PRAGMA table_info(expenses)")]
    finally:
        conn.close()
    if not columns:
        return "empty"
    return "old" if "category" in columns else "current"


def backup_path_for(path: str) -> Path:
    original = Path(path)
    stamp = datetime.now().strftime("%Y-%m-%d-%H%M%S")
    return original.with_name(f"{original.stem}.backup-before-categories-{stamp}.db")


def make_backup(path: str) -> Path:
    """Copies the database file unchanged. Raises if it can't be done."""
    backup = backup_path_for(path)
    if backup.exists():
        raise MigrationError(f"Backup file already exists: {backup}")
    shutil.copyfile(path, backup)
    if not filecmp.cmp(path, backup, shallow=False):
        raise MigrationError(f"Backup copy does not match the database: {backup}")
    return backup


def upgrade_old_database(path: str, categories_table: str, expenses_and_limits_tables: str) -> None:
    backup = make_backup(path)
    logger.warning("Backed up the database to %s before converting it", backup)

    # isolation_level=None: we control the transaction ourselves, so every
    # step below is one all-or-nothing change.
    conn = sqlite3.connect(path, isolation_level=None)
    try:
        conn.execute("BEGIN")
        _convert(conn, categories_table, expenses_and_limits_tables)
        conn.execute("COMMIT")
    except Exception:
        conn.execute("ROLLBACK")
        raise
    finally:
        conn.close()
    logger.warning("Converted the database to support managing categories")


def _count(conn: sqlite3.Connection, table: str) -> int:
    return conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]


def _last_expense_id(conn: sqlite3.Connection) -> int:
    row = conn.execute("SELECT seq FROM sqlite_sequence WHERE name = 'expenses'").fetchone()
    return row[0] if row else 0


def _convert(conn: sqlite3.Connection, categories_table: str, expenses_and_limits_tables: str) -> None:
    expenses_before = _count(conn, "expenses")
    limits_before = _count(conn, "category_limits")
    # Ids are never reused, even ids of deleted expenses: remember the
    # highest id ever given out, not just the highest one still present.
    last_expense_id = _last_expense_id(conn)

    conn.execute(categories_table)
    conn.executemany(
        "INSERT INTO categories (name) VALUES (?)", [(name,) for name in STARTING_CATEGORIES]
    )

    conn.execute("ALTER TABLE expenses RENAME TO old_expenses")
    conn.execute("ALTER TABLE category_limits RENAME TO old_category_limits")
    for statement in expenses_and_limits_tables.split(";"):
        if statement.strip():
            conn.execute(statement)

    conn.execute(
        "INSERT INTO expenses (id, amount_paise, category_id, date, note, created_at)"
        " SELECT e.id, e.amount_paise, c.id, e.date, e.note, e.created_at"
        " FROM old_expenses e JOIN categories c ON c.name = e.category"
    )
    conn.execute(
        "INSERT INTO category_limits (category_id, limit_paise)"
        " SELECT c.id, l.limit_paise FROM old_category_limits l"
        " JOIN categories c ON c.name = l.category"
    )

    expenses_after = _count(conn, "expenses")
    limits_after = _count(conn, "category_limits")
    if (expenses_after, limits_after) != (expenses_before, limits_before):
        raise MigrationError(
            f"Row counts changed while converting: expenses {expenses_before} -> "
            f"{expenses_after}, limits {limits_before} -> {limits_after}"
        )

    conn.execute("DROP TABLE old_expenses")
    conn.execute("DROP TABLE old_category_limits")
    conn.execute("DELETE FROM sqlite_sequence WHERE name = 'expenses'")
    conn.execute(
        "INSERT INTO sqlite_sequence (name, seq) VALUES ('expenses', ?)",
        (max(last_expense_id, conn.execute("SELECT COALESCE(MAX(id), 0) FROM expenses").fetchone()[0]),),
    )
