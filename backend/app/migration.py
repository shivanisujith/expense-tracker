"""Upgrading older database files, one step at a time.

1. From before categories could be managed ("old"): `expenses.category` and
   `category_limits.category` hold one of the six fixed names. Afterwards
   both point to a row in `categories` by id. See specs/backend-spec.md,
   "Upgrading an existing database".
2. From before accounts ("before_login"): categories have no owner. They
   are kept, unclaimed, until the first account signs up. See
   specs/backend-spec.md, "Upgrading to accounts".
3. The online PostgreSQL database from before accounts gets the same
   upgrade, in place. See specs/backend-spec.md, "Upgrading the online
   database to accounts".
"""

import filecmp
import logging
import shutil
import sqlite3
from datetime import datetime
from pathlib import Path

from app.validation import DEFAULT_ICON, STARTING_CATEGORIES, STARTING_ICONS

logger = logging.getLogger(__name__)


class MigrationError(Exception):
    pass


def database_state(path: str) -> str:
    """'empty' (no tables yet), 'old' (before categories could be managed),
    'before_login' (before accounts) or 'current'."""
    conn = sqlite3.connect(path)
    try:
        columns = [row[1] for row in conn.execute("PRAGMA table_info(expenses)")]
        has_users = conn.execute("SELECT 1 FROM sqlite_master WHERE name = 'users'").fetchone()
    finally:
        conn.close()
    if not columns:
        return "empty"
    if "category" in columns:
        return "old"
    return "current" if has_users else "before_login"


def backup_path_for(path: str, before: str = "categories") -> Path:
    original = Path(path)
    stamp = datetime.now().strftime("%Y-%m-%d-%H%M%S")
    return original.with_name(f"{original.stem}.backup-before-{before}-{stamp}.db")


def make_backup(path: str, before: str = "categories") -> Path:
    """Copies the database file unchanged. Raises if it can't be done."""
    backup = backup_path_for(path, before)
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


def _last_id(conn: sqlite3.Connection, table: str) -> int:
    """The highest id ever given out in a table, even if since deleted."""
    row = conn.execute("SELECT seq FROM sqlite_sequence WHERE name = ?", (table,)).fetchone()
    return row[0] if row else 0


def _keep_last_id(conn: sqlite3.Connection, table: str, last_id: int) -> None:
    """After rebuilding a table, makes sure no id up to last_id is reused."""
    highest = conn.execute(f"SELECT COALESCE(MAX(id), 0) FROM {table}").fetchone()[0]
    conn.execute("DELETE FROM sqlite_sequence WHERE name = ?", (table,))
    conn.execute("INSERT INTO sqlite_sequence (name, seq) VALUES (?, ?)", (table, max(last_id, highest)))


def _convert(conn: sqlite3.Connection, categories_table: str, expenses_and_limits_tables: str) -> None:
    expenses_before = _count(conn, "expenses")
    limits_before = _count(conn, "category_limits")
    # Ids are never reused, even ids of deleted expenses: remember the
    # highest id ever given out, not just the highest one still present.
    last_expense_id = _last_id(conn, "expenses")

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
    _keep_last_id(conn, "expenses", last_expense_id)


# Every category kept with its id and name, unclaimed (no user_id), and the
# icon chosen by id: 1 to 6 were the starting six, anything else is a tag.
_ICON_BY_ID = " ".join(f"WHEN {number} THEN '{icon}'" for number, icon in enumerate(STARTING_ICONS, 1))
COPY_CATEGORIES = (
    "INSERT INTO categories_new (id, user_id, name, icon)"
    f" SELECT id, NULL, name, CASE id {_ICON_BY_ID} ELSE '{DEFAULT_ICON}' END FROM categories"
)


def upgrade_to_accounts(path: str, users_and_sessions_tables: str, new_categories_table: str) -> None:
    """`new_categories_table` creates the current categories table under the
    name categories_new; it replaces the old one."""
    backup = make_backup(path, before="login")
    logger.warning("Backed up the database to %s before adding accounts", backup)

    # As above: one all-or-nothing change. Foreign keys are not switched on
    # in this connection, so the old categories table can be swapped out
    # while expenses and limits still point to it by name.
    conn = sqlite3.connect(path, isolation_level=None)
    try:
        conn.execute("BEGIN")
        _add_accounts(conn, users_and_sessions_tables, new_categories_table)
        conn.execute("COMMIT")
    except Exception:
        conn.execute("ROLLBACK")
        raise
    finally:
        conn.close()
    logger.warning("Upgraded the database to support accounts")


def _add_accounts(conn: sqlite3.Connection, users_and_sessions_tables: str, new_categories_table: str) -> None:
    tables = ("categories", "expenses", "category_limits")
    counts_before = [_count(conn, table) for table in tables]
    last_category_id = _last_id(conn, "categories")

    for statement in (users_and_sessions_tables + new_categories_table).split(";"):
        if statement.strip():
            conn.execute(statement)
    conn.execute(COPY_CATEGORIES)
    # The way SQLite recommends changing a table: build the new one, drop
    # the old one, then give the new one the old name.
    conn.execute("DROP TABLE categories")
    conn.execute("ALTER TABLE categories_new RENAME TO categories")
    _keep_last_id(conn, "categories", last_category_id)

    counts_after = [_count(conn, table) for table in tables]
    if counts_after != counts_before:
        raise MigrationError(
            f"Row counts changed while adding accounts: categories, expenses, limits "
            f"{counts_before} -> {counts_after}"
        )


# PostgreSQL can change a table in place, inside a transaction: the old
# categories gain an empty user_id (unclaimed) and an icon chosen by id,
# and names become unique per account instead of across the whole table.
POSTGRES_ADD_ACCOUNTS = f"""
ALTER TABLE categories ADD COLUMN user_id BIGINT REFERENCES users (id);
ALTER TABLE categories ADD COLUMN icon TEXT NOT NULL DEFAULT '{DEFAULT_ICON}';
UPDATE categories SET icon = CASE id {_ICON_BY_ID} ELSE '{DEFAULT_ICON}' END;
DROP INDEX categories_name_ignoring_capitals;
CREATE UNIQUE INDEX categories_name_ignoring_capitals ON categories (user_id, lower(name));
"""


def upgrade_postgres_to_accounts(conn, users_and_sessions_tables: str) -> None:
    """Must run inside conn.transaction(), so any failure undoes all of it.
    There is no file to back up: the Neon backup is made by hand first."""
    # Another server starting at the same moment waits here, then finds
    # the users table and leaves the database alone.
    conn.execute("LOCK TABLE categories, expenses, category_limits IN ACCESS EXCLUSIVE MODE")
    if conn.execute("SELECT to_regclass('public.users') IS NOT NULL").fetchone()[0]:
        return

    tables = ("categories", "expenses", "category_limits")
    counts_before = [_count(conn, table) for table in tables]
    conn.execute(users_and_sessions_tables)
    conn.execute(POSTGRES_ADD_ACCOUNTS)
    counts_after = [_count(conn, table) for table in tables]
    if counts_after != counts_before:
        raise MigrationError(
            f"Row counts changed while adding accounts: categories, expenses, limits "
            f"{counts_before} -> {counts_after}"
        )
    logger.warning("Upgraded the online database to support accounts")
