
import pytest
from fastapi.testclient import TestClient

from app import db
from app.main import app
from conftest import count_expense_rows, make_expense

AMOUNT_ERROR = {
    "code": "invalid_amount",
    "message": "Amount is required and must be a whole number of paise greater than 0.",
    "field": "amount_paise",
}


def assert_error(response, status_code, code, field):
    assert response.status_code == status_code
    error = response.json()["error"]
    assert error["code"] == code
    assert error["field"] == field
    assert error["message"]


def assert_nothing_saved(client):
    assert client.get("/api/expenses").json() == []


# --- Adding a valid expense -------------------------------------------------

def test_add_valid_expense_returns_201_with_new_id(client):
    response = client.post("/api/expenses", json=make_expense())

    assert response.status_code == 201
    body = response.json()
    assert isinstance(body["id"], int)
    assert body == {
        "id": body["id"],
        "amount_paise": 1250,
        "category": "Food",
        "date": "2026-10-07",
        "note": "Lunch",
    }


def test_added_expense_survives_app_restart(client, db_path):
    """Criterion 1 (backend part): saved data is still there after a restart."""
    created = client.post("/api/expenses", json=make_expense()).json()

    # Read the database with a brand-new connection.
    assert count_expense_rows() == 1

    # Start the app again and list expenses.
    with TestClient(app) as restarted:
        assert restarted.get("/api/expenses").json() == [created]


def test_list_is_empty_at_first(client):
    response = client.get("/api/expenses")
    assert response.status_code == 200
    assert response.json() == []


# --- Amount (criterion 2) ---------------------------------------------------

@pytest.mark.parametrize(
    "amount",
    [0, -500, "abc", "1250", "", 12.5, 1250.0, True, False, None],
)
def test_bad_amount_is_refused_and_nothing_saved(client, amount):
    response = client.post("/api/expenses", json=make_expense(amount_paise=amount))

    assert response.status_code == 422
    assert response.json() == {"error": AMOUNT_ERROR}
    assert_nothing_saved(client)


def test_missing_amount_is_refused(client):
    body = make_expense()
    del body["amount_paise"]

    response = client.post("/api/expenses", json=body)

    assert response.status_code == 422
    assert response.json() == {"error": AMOUNT_ERROR}
    assert_nothing_saved(client)


def test_smallest_amount_is_accepted(client):
    response = client.post("/api/expenses", json=make_expense(amount_paise=1))
    assert response.status_code == 201


# --- Category (criterion 4) -------------------------------------------------

@pytest.mark.parametrize("category", ["food", "FOOD", "Travel", "", " Food", None, 1])
def test_category_not_in_fixed_list_is_refused(client, category):
    response = client.post("/api/expenses", json=make_expense(category=category))

    assert_error(response, 422, "invalid_category", "category")
    assert_nothing_saved(client)


def test_missing_category_is_refused(client):
    body = make_expense()
    del body["category"]

    response = client.post("/api/expenses", json=body)

    assert_error(response, 422, "invalid_category", "category")


@pytest.mark.parametrize(
    "category", ["Food", "Transport", "Shopping", "Bills", "Entertainment", "Other"]
)
def test_every_fixed_category_is_accepted(client, category):
    response = client.post("/api/expenses", json=make_expense(category=category))
    assert response.status_code == 201


# --- Date (criterion 3) -----------------------------------------------------

def test_future_date_is_refused(client):
    # Tests run as if today is 2026-10-07 (see conftest.py).
    response = client.post("/api/expenses", json=make_expense(date="2026-10-08"))

    assert response.status_code == 422
    assert response.json() == {
        "error": {
            "code": "future_date",
            "message": "Date cannot be in the future.",
            "field": "date",
        }
    }
    assert_nothing_saved(client)


@pytest.mark.parametrize("day", ["2026-10-07", "2026-10-06", "1990-01-01"])
def test_today_and_past_dates_are_accepted(client, day):
    response = client.post("/api/expenses", json=make_expense(date=day))
    assert response.status_code == 201


@pytest.mark.parametrize(
    "day",
    ["2026-02-30", "2026-13-01", "07-10-2026", "2026/10/07", "20261007", "", "yesterday", None, 20261007],
)
def test_bad_date_is_refused(client, day):
    response = client.post("/api/expenses", json=make_expense(date=day))

    assert_error(response, 422, "invalid_date", "date")
    assert_nothing_saved(client)


def test_missing_date_is_refused(client):
    body = make_expense()
    del body["date"]

    response = client.post("/api/expenses", json=body)

    assert_error(response, 422, "invalid_date", "date")


# --- Note -------------------------------------------------------------------

def test_note_of_100_characters_is_accepted(client):
    response = client.post("/api/expenses", json=make_expense(note="x" * 100))
    assert response.status_code == 201


def test_note_over_100_characters_is_refused(client):
    response = client.post("/api/expenses", json=make_expense(note="x" * 101))

    assert_error(response, 422, "note_too_long", "note")
    assert_nothing_saved(client)


def test_note_spaces_at_the_ends_are_trimmed(client):
    response = client.post("/api/expenses", json=make_expense(note="   Lunch  "))
    assert response.json()["note"] == "Lunch"


def test_trimmed_note_is_measured_after_trimming(client):
    response = client.post("/api/expenses", json=make_expense(note="  " + "x" * 100 + "  "))
    assert response.status_code == 201


@pytest.mark.parametrize("note", [None, "", "   "])
def test_empty_or_null_note_is_saved_as_empty_text(client, note):
    response = client.post("/api/expenses", json=make_expense(note=note))
    assert response.json()["note"] == ""


def test_missing_note_is_saved_as_empty_text(client):
    body = make_expense()
    del body["note"]

    response = client.post("/api/expenses", json=body)

    assert response.status_code == 201
    assert response.json()["note"] == ""


# --- Error order and unreadable requests -----------------------------------

@pytest.mark.parametrize(
    "changes, expected_code",
    [
        ({"amount_paise": 0, "category": "Travel", "date": "bad"}, "invalid_amount"),
        ({"category": "Travel", "date": "bad", "note": "x" * 101}, "invalid_category"),
        ({"date": "2026-10-08", "note": "x" * 101}, "future_date"),
    ],
)
def test_first_bad_field_in_contract_order_is_reported(client, changes, expected_code):
    response = client.post("/api/expenses", json=make_expense(**changes))
    assert response.json()["error"]["code"] == expected_code


@pytest.mark.parametrize("raw_body", ["not json", "{bad", ""])
def test_body_that_is_not_json_is_refused(client, raw_body):
    response = client.post(
        "/api/expenses", content=raw_body, headers={"Content-Type": "application/json"}
    )

    assert response.status_code == 422
    assert response.json() == {
        "error": {
            "code": "invalid_request",
            "message": "The request could not be read. Please try again.",
            "field": None,
        }
    }
    assert_nothing_saved(client)


@pytest.mark.parametrize("body", [[1, 2], "text", 5, None])
def test_body_that_is_not_an_object_is_refused(client, body):
    response = client.post("/api/expenses", json=body)

    assert_error(response, 422, "invalid_request", None)
    assert_nothing_saved(client)


def test_extra_fields_are_ignored(client):
    response = client.post("/api/expenses", json=make_expense(id=999, colour="red"))

    assert response.status_code == 201
    assert response.json()["id"] != 999
    assert "colour" not in response.json()


# --- List order -------------------------------------------------------------

def test_list_is_newest_date_first_then_most_recently_saved(client):
    oct_1 = client.post("/api/expenses", json=make_expense(date="2026-10-01")).json()
    oct_7_first = client.post("/api/expenses", json=make_expense(date="2026-10-07")).json()
    sep_28 = client.post("/api/expenses", json=make_expense(date="2026-09-28")).json()
    oct_7_second = client.post("/api/expenses", json=make_expense(date="2026-10-07")).json()

    listed = client.get("/api/expenses").json()

    assert listed == [oct_7_second, oct_7_first, oct_1, sep_28]


# --- Server errors and CORS -------------------------------------------------

def test_unexpected_failure_returns_server_error(client, monkeypatch):
    def broken_connect():
        raise RuntimeError("database is gone")

    monkeypatch.setattr(db, "connect", broken_connect)

    response = client.get("/api/expenses", headers={"Origin": "http://localhost:5173"})

    assert response.status_code == 500
    assert response.json() == {
        "error": {
            "code": "server_error",
            "message": "Something went wrong on the server. Please try again.",
            "field": None,
        }
    }
    # The browser needs this header to read the error instead of treating
    # it as "can't reach the server".
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"


def test_frontend_origin_is_allowed(client):
    response = client.get("/api/expenses", headers={"Origin": "http://localhost:5173"})
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"


# --- Editing (criterion 5) --------------------------------------------------

def food_spent(client):
    categories = client.get("/api/summary").json()["categories"]
    return next(row["spent_paise"] for row in categories if row["category"] == "Food")


def test_edit_replaces_all_fields_and_updates_list_and_summary(client):
    created = client.post("/api/expenses", json=make_expense(amount_paise=1000)).json()

    new_values = {"amount_paise": 2500, "category": "Bills", "date": "2026-10-05", "note": "Phone"}
    response = client.put(f"/api/expenses/{created['id']}", json=new_values)

    assert response.status_code == 200
    assert response.json() == {"id": created["id"], **new_values}
    assert client.get("/api/expenses").json() == [{"id": created["id"], **new_values}]
    assert food_spent(client) == 0


def test_edit_amount_changes_category_total(client):
    created = client.post("/api/expenses", json=make_expense(amount_paise=1000)).json()

    client.put(f"/api/expenses/{created['id']}", json=make_expense(amount_paise=4000))

    assert food_spent(client) == 4000


def test_edit_without_note_clears_the_note(client):
    created = client.post("/api/expenses", json=make_expense(note="Lunch")).json()
    body = make_expense()
    del body["note"]

    response = client.put(f"/api/expenses/{created['id']}", json=body)

    assert response.json()["note"] == ""


@pytest.mark.parametrize(
    "changes, expected_code",
    [
        ({"amount_paise": -1}, "invalid_amount"),
        ({"category": "Travel"}, "invalid_category"),
        ({"date": "2026-10-08"}, "future_date"),
        ({"note": "x" * 101}, "note_too_long"),
    ],
)
def test_edit_with_bad_values_is_refused_and_nothing_changes(client, changes, expected_code):
    created = client.post("/api/expenses", json=make_expense()).json()

    response = client.put(f"/api/expenses/{created['id']}", json=make_expense(**changes))

    assert response.status_code == 422
    assert response.json()["error"]["code"] == expected_code
    assert client.get("/api/expenses").json() == [created]


def test_edit_unknown_expense_is_not_found(client):
    response = client.put("/api/expenses/999", json=make_expense())

    assert response.status_code == 404
    assert response.json() == {
        "error": {
            "code": "expense_not_found",
            "message": "This expense no longer exists.",
            "field": None,
        }
    }


def test_edit_unknown_expense_with_bad_values_reports_not_found(client):
    response = client.put("/api/expenses/999", json=make_expense(amount_paise=0))
    assert_error(response, 404, "expense_not_found", None)


def test_edit_with_unreadable_body_is_refused(client):
    created = client.post("/api/expenses", json=make_expense()).json()

    response = client.put(
        f"/api/expenses/{created['id']}",
        content="{bad",
        headers={"Content-Type": "application/json"},
    )

    assert_error(response, 422, "invalid_request", None)


def test_edited_expense_keeps_its_place_among_same_date_expenses(client):
    first = client.post("/api/expenses", json=make_expense()).json()
    second = client.post("/api/expenses", json=make_expense()).json()

    edited = client.put(f"/api/expenses/{first['id']}", json=make_expense(note="Edited")).json()

    assert client.get("/api/expenses").json() == [second, edited]


# --- Deleting (criterion 5) -------------------------------------------------

def test_delete_removes_expense_from_list_and_summary(client):
    keep = client.post("/api/expenses", json=make_expense(amount_paise=1000)).json()
    remove = client.post("/api/expenses", json=make_expense(amount_paise=3000)).json()

    response = client.delete(f"/api/expenses/{remove['id']}")

    assert response.status_code == 204
    assert response.content == b""
    assert client.get("/api/expenses").json() == [keep]
    assert food_spent(client) == 1000


def test_delete_unknown_expense_is_not_found(client):
    response = client.delete("/api/expenses/999")
    assert_error(response, 404, "expense_not_found", None)


def test_delete_twice_is_not_found_the_second_time(client):
    created = client.post("/api/expenses", json=make_expense()).json()

    client.delete(f"/api/expenses/{created['id']}")
    response = client.delete(f"/api/expenses/{created['id']}")

    assert_error(response, 404, "expense_not_found", None)


def test_deleted_id_is_never_reused(client):
    created = client.post("/api/expenses", json=make_expense()).json()
    client.delete(f"/api/expenses/{created['id']}")

    new = client.post("/api/expenses", json=make_expense()).json()

    assert new["id"] != created["id"]


def test_unknown_category_message_does_not_list_names(client):
    response = client.post("/api/expenses", json=make_expense(category="Travel"))

    assert response.json() == {
        "error": {
            "code": "invalid_category",
            "message": "Category must be one of your categories.",
            "field": "category",
        }
    }
