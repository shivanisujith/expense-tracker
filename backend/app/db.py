"""The database: SQLite on the laptop and in tests, PostgreSQL online.

Which one is used depends on the DATABASE_URL setting (specs/backend-spec.md,
"Data stored" and "Settings"). Both get the same tables and rules, and the
rest of the backend talks to either through the same small Connection.
"""

import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path

import psycopg

from app import migration
from app.validation import DEFAULT_ICON, STARTING_CATEGORIES, STARTING_ICONS

# On the experiment/login branch the default is a separate file, so the
# real expenses.db is never used by mistake (specs/backend-spec.md, "Settings").
DEFAULT_DB_PATH = Path(__file__).resolve().parent.parent / "expenses-login.db"

# The current format (see specs/backend-spec.md, "Data stored"). The CHECK
# rules are a last safety net; validation.py gives the real errors.
USERS_AND_SESSIONS_TABLES = """
CREATE TABLE users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT    NOT NULL UNIQUE CHECK (length(username) BETWEEN 3 AND 20),
    password_hash TEXT    NOT NULL,
    created_at    TEXT    NOT NULL
);

CREATE TABLE sessions (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users (id),
    token_hash TEXT    NOT NULL UNIQUE,
    created_at TEXT    NOT NULL,
    expires_at TEXT    NOT NULL
);
"""


def categories_table(name: str = "categories") -> str:
    """user_id is empty only for old data not yet claimed by an account.
    Names are unique within one account, ignoring capitals."""
    return f"""
CREATE TABLE {name} (
    id      INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users (id),
    name    TEXT    NOT NULL CHECK (length(name) BETWEEN 1 AND 30),
    icon    TEXT    NOT NULL DEFAULT '{DEFAULT_ICON}',
    UNIQUE (user_id, name COLLATE NOCASE)
);
"""


CATEGORIES_TABLE = categories_table()

# The categories table from before accounts. Very old files are first
# converted to this, then upgraded to accounts.
CATEGORIES_TABLE_BEFORE_LOGIN = """
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

# The same tables in PostgreSQL. Identity ids are never reused, BIGINT holds
# whole paise, and the index makes names unique per account ignoring capitals.
POSTGRES_TABLES = f"""
CREATE TABLE users (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    username      TEXT   NOT NULL UNIQUE CHECK (char_length(username) BETWEEN 3 AND 20),
    password_hash TEXT   NOT NULL,
    created_at    TEXT   NOT NULL
);

CREATE TABLE sessions (
    id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id    BIGINT NOT NULL REFERENCES users (id),
    token_hash TEXT   NOT NULL UNIQUE,
    created_at TEXT   NOT NULL,
    expires_at TEXT   NOT NULL
);

CREATE TABLE categories (
    id      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT REFERENCES users (id),
    name    TEXT   NOT NULL CHECK (char_length(name) BETWEEN 1 AND 30),
    icon    TEXT   NOT NULL DEFAULT '{DEFAULT_ICON}'
);
CREATE UNIQUE INDEX categories_name_ignoring_capitals ON categories (user_id, lower(name));

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


def get_database_url() -> str | None:
    """Set online (a secret, kept in Render's settings). Unset means SQLite."""
    return os.environ.get("DATABASE_URL") or None


def get_db_path() -> str:
    """Tests point EXPENSES_DB_PATH at a temporary file."""
    return os.environ.get("EXPENSES_DB_PATH", str(DEFAULT_DB_PATH))


class Row:
    """A PostgreSQL row readable like sqlite3.Row: row["name"] or row[0]."""

    def __init__(self, names: list[str], values: tuple):
        self._names = names
        self._values = values

    def __getitem__(self, key):
        if isinstance(key, str):
            return self._values[self._names.index(key)]
        return self._values[key]

    def keys(self) -> list[str]:
        return list(self._names)


def _row_factory(cursor):
    names = [column.name for column in cursor.description or []]
    return lambda values: Row(names, values)


class Connection:
    """One connection to either database. SQL is written with `?` for
    values, as SQLite expects; for PostgreSQL it becomes `%s`."""

    def __init__(self, raw, is_postgres: bool):
        self._raw = raw
        self.is_postgres = is_postgres

    def execute(self, sql: str, params=()):
        if self.is_postgres:
            # With no values, psycopg also allows several statements at once.
            return self._raw.execute(sql.replace("?", "%s"), params or None)
        return self._raw.execute(sql, params)

    @contextmanager
    def transaction(self):
        """Everything inside happens together, or not at all."""
        if self.is_postgres:
            with self._raw.transaction():
                yield
        else:
            with self._raw:
                yield

    def close(self) -> None:
        self._raw.close()


def connect() -> Connection:
    url = get_database_url()
    if url:
        # autocommit: each statement on its own is saved straight away, and
        # transaction() groups several into one all-or-nothing change.
        raw = psycopg.connect(url, autocommit=True, row_factory=_row_factory)
        return Connection(raw, is_postgres=True)
    raw = sqlite3.connect(get_db_path())
    raw.row_factory = sqlite3.Row
    # SQLite only checks REFERENCES rules when this is switched on.
    raw.execute("PRAGMA foreign_keys = ON")
    return Connection(raw, is_postgres=False)


def init_db() -> None:
    """Brings the database to the current format when the app starts."""
    if get_database_url():
        _init_postgres()
        return
    path = get_db_path()
    state = migration.database_state(path)
    if state == "empty":
        _create_new_database(path)
        return
    if state == "old":
        migration.upgrade_old_database(path, CATEGORIES_TABLE_BEFORE_LOGIN, EXPENSES_AND_LIMITS_TABLES)
        state = "before_login"
    if state == "before_login":
        migration.upgrade_to_accounts(path, USERS_AND_SESSIONS_TABLES, categories_table("categories_new"))


def _create_new_database(path: str) -> None:
    conn = sqlite3.connect(path)
    try:
        # One script, one transaction. Categories come with each sign-up.
        conn.executescript(
            "BEGIN;" + USERS_AND_SESSIONS_TABLES + CATEGORIES_TABLE + EXPENSES_AND_LIMITS_TABLES + "COMMIT;"
        )
    finally:
        conn.close()


def _init_postgres() -> None:
    """An empty online database gets the tables in one step. One that has
    them already is left alone, so restarts and redeploys keep every row."""
    conn = connect()
    try:
        with conn.transaction():
            exists = conn.execute("SELECT to_regclass('public.categories') IS NOT NULL").fetchone()[0]
            if not exists:
                conn.execute(POSTGRES_TABLES)
    finally:
        conn.close()


def add_starting_categories(conn: Connection, user_id: int) -> None:
    """A new account's six starting categories, in order, with their icons."""
    for name, icon in zip(STARTING_CATEGORIES, STARTING_ICONS):
        conn.execute("INSERT INTO categories (user_id, name, icon) VALUES (?, ?, ?)", (user_id, name, icon))


def category_ids(conn: Connection, user_id: int) -> dict[str, int]:
    """The account's current category names mapped to their ids."""
    rows = conn.execute("SELECT id, name FROM categories WHERE user_id = ?", (user_id,))
    return {row["name"]: row["id"] for row in rows}
