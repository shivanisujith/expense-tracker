"""The database layer works the same on SQLite and PostgreSQL
(specs/backend-spec.md, "Data stored", "Starting an empty online database"
and "Settings")."""

from fastapi.testclient import TestClient

from app import db
from app.main import allowed_origins, app
from conftest import POSTGRES, make_expense, query, sign_up

MAX_PAISE = 10_000_000_000


def test_the_test_database_is_the_one_in_use(db_path):
    assert (db.get_database_url() is not None) == POSTGRES


def test_sums_are_whole_numbers_not_decimals(client):
    # PostgreSQL's SUM gives a decimal type; the API must still send whole paise.
    for day in ("2026-10-01", "2026-10-02", "2026-09-30"):
        client.post("/api/expenses", json=make_expense(amount_paise=MAX_PAISE, date=day))

    summary = client.get("/api/summary").json()
    month_total = client.get("/api/months/2026-09/total").json()

    assert type(summary["total_spent_paise"]) is int
    assert summary["total_spent_paise"] == 2 * MAX_PAISE
    assert type(summary["categories"][0]["spent_paise"]) is int
    assert type(month_total["total_spent_paise"]) is int
    # The API's JSON has no decimal point either.
    assert '"total_spent_paise":20000000000,' in client.get("/api/summary").text


def test_new_ids_come_back_from_inserts(client):
    first = client.post("/api/expenses", json=make_expense()).json()
    second = client.post("/api/expenses", json=make_expense()).json()
    category = client.post("/api/categories", json={"name": "Pets"}).json()

    assert type(first["id"]) is int and second["id"] == first["id"] + 1
    assert category == {"id": 7, "name": "Pets", "icon": "tag"}


def test_restarting_keeps_data_and_adds_no_second_set_of_categories(client):
    client.post("/api/categories", json={"name": "Pets"})
    saved = client.post("/api/expenses", json=make_expense(category="Pets")).json()

    with TestClient(app, headers=client.headers) as restarted:
        names = [row["category"] for row in restarted.get("/api/summary").json()["categories"]]
        assert names == ["Food", "Transport", "Shopping", "Bills", "Entertainment", "Other", "Pets"]
        assert restarted.get("/api/expenses").json() == [saved]


def test_a_failed_change_saves_nothing(client):
    # The database refuses the second insert (unknown category id), so the
    # first one, in the same transaction, must not be saved either.
    conn = db.connect()
    try:
        try:
            with conn.transaction():
                conn.execute(
                    "INSERT INTO expenses (amount_paise, category_id, date, note, created_at)"
                    " VALUES (100, 1, '2026-10-01', '', 'x')"
                )
                conn.execute(
                    "INSERT INTO expenses (amount_paise, category_id, date, note, created_at)"
                    " VALUES (100, 999, '2026-10-01', '', 'x')"
                )
        except Exception:
            pass
        else:
            raise AssertionError("the database should refuse an unknown category id")
    finally:
        conn.close()

    assert client.get("/api/expenses").json() == []


def test_names_are_unique_ignoring_capitals_in_the_database_too(client):
    # The backend checks this first (rule 14); this is the database's own net.
    # The client's account is user 1, owning Food.
    conn = db.connect()
    try:
        try:
            with conn.transaction():
                conn.execute("INSERT INTO categories (user_id, name) VALUES (1, 'FOOD')")
        except Exception:
            pass
        else:
            raise AssertionError("the database should refuse FOOD when Food exists")
    finally:
        conn.close()


def test_another_account_may_have_the_same_name_in_the_database(client):
    sign_up(client, "second")  # user 2, with its own Food
    assert query("SELECT COUNT(*) FROM categories WHERE lower(name) = 'food'") == [(2,)]


def test_usernames_are_unique_in_the_database_too(client):
    conn = db.connect()
    try:
        try:
            with conn.transaction():
                conn.execute(
                    "INSERT INTO users (username, password_hash, created_at) VALUES ('tester', 'x', 'x')"
                )
        except Exception:
            pass
        else:
            raise AssertionError("the database should refuse a second 'tester'")
    finally:
        conn.close()


def test_rows_can_be_read_by_name_or_position(client):
    conn = db.connect()
    try:
        row = conn.execute("SELECT id, name FROM categories ORDER BY id").fetchone()
    finally:
        conn.close()
    assert (row["id"], row["name"]) == (1, "Food")
    assert (row[0], row[1]) == (1, "Food")


def test_cors_allows_the_authorization_header(client):
    response = client.options(
        "/api/expenses",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "authorization, content-type",
        },
    )
    assert response.status_code == 200
    assert "authorization" in response.headers["access-control-allow-headers"].lower()


def test_the_default_database_file_is_the_experiment_one(monkeypatch):
    # On the experiment/login branch, forgetting EXPENSES_DB_PATH must never
    # lead to the real expenses.db.
    monkeypatch.delenv("EXPENSES_DB_PATH", raising=False)
    assert db.get_db_path().endswith("/backend/expenses-login.db")


def test_allowed_origins_default_to_the_local_page(monkeypatch):
    monkeypatch.delenv("ALLOWED_ORIGINS", raising=False)
    assert allowed_origins() == ["http://localhost:5173"]


def test_allowed_origins_come_from_the_setting(monkeypatch):
    monkeypatch.setenv("ALLOWED_ORIGINS", " https://shivanisujith.github.io , http://localhost:5173,")
    assert allowed_origins() == ["https://shivanisujith.github.io", "http://localhost:5173"]


def test_an_empty_database_url_means_sqlite(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "")
    assert db.get_database_url() is None
