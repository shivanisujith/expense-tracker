"""Adding, renaming and deleting categories (criteria 9-14)."""

import pytest
from fastapi.testclient import TestClient

from app.main import app
from conftest import make_expense

STARTING = ["Food", "Transport", "Shopping", "Bills", "Entertainment", "Other"]


def summary(client):
    return client.get("/api/summary").json()["categories"]


def names(client):
    return [row["category"] for row in summary(client)]


def category_id(client, name):
    return next(row["category_id"] for row in summary(client) if row["category"] == name)


def add_category(client, name):
    return client.post("/api/categories", json={"name": name})


def rename(client, name, new_name):
    return client.put(f"/api/categories/{category_id(client, name)}", json={"name": new_name})


def delete(client, name):
    return client.delete(f"/api/categories/{category_id(client, name)}")


def assert_error(response, status_code, code, message, field=None):
    assert response.status_code == status_code
    assert response.json() == {"error": {"code": code, "message": message, "field": field}}


# --- Adding (criterion 9) ---------------------------------------------------

def test_new_category_is_added_at_the_end_with_no_limit(client):
    response = add_category(client, "Pets")

    assert response.status_code == 201
    assert response.json() == {"id": 7, "name": "Pets"}
    assert names(client) == STARTING + ["Pets"]
    assert summary(client)[-1] == {
        "category_id": 7,
        "category": "Pets",
        "spent_paise": 0,
        "limit_paise": None,
        "remaining_paise": None,
        "over_limit": False,
    }


def test_new_category_can_be_used_for_expenses_and_limits(client):
    add_category(client, "Pets")

    expense = client.post("/api/expenses", json=make_expense(category="Pets", amount_paise=700))
    limit = client.put(f"/api/categories/{category_id(client, 'Pets')}/limit", json={"limit_paise": 500})

    assert expense.status_code == 201
    assert expense.json()["category"] == "Pets"
    assert limit.status_code == 200
    pets = summary(client)[-1]
    assert (pets["spent_paise"], pets["limit_paise"], pets["over_limit"]) == (700, 500, True)


def test_new_category_survives_a_restart(client):
    add_category(client, "Pets")

    with TestClient(app) as restarted:
        assert [row["category"] for row in restarted.get("/api/summary").json()["categories"]] == (
            STARTING + ["Pets"]
        )


def test_name_is_trimmed(client):
    response = add_category(client, "   Pets  ")

    assert response.json()["name"] == "Pets"
    assert names(client)[-1] == "Pets"


def test_name_of_exactly_30_characters_is_accepted(client):
    response = add_category(client, "x" * 30)
    assert response.status_code == 201


def test_any_characters_are_allowed(client):
    response = add_category(client, "Kids & school / fees 🎒")

    assert response.status_code == 201
    assert names(client)[-1] == "Kids & school / fees 🎒"


# --- Refused names (criterion 10) -------------------------------------------

MISSING = ("category_name_missing", "Please enter a category name.")
TOO_LONG = ("category_name_too_long", "Category name must be 30 characters or fewer.")


@pytest.mark.parametrize(
    "body, expected",
    [
        ({"name": ""}, MISSING),
        ({"name": "   "}, MISSING),
        ({}, MISSING),
        ({"name": None}, MISSING),
        ({"name": 5}, MISSING),
        ({"name": "x" * 31}, TOO_LONG),
        ({"name": "  " + "x" * 31 + "  "}, TOO_LONG),
    ],
)
def test_bad_new_name_is_refused_and_nothing_changes(client, body, expected):
    response = client.post("/api/categories", json=body)

    assert_error(response, 422, *expected, field="name")
    assert names(client) == STARTING


@pytest.mark.parametrize("name", ["Food", "food", "FOOD", " fOoD "])
def test_duplicate_name_ignoring_capitals_is_refused(client, name):
    response = add_category(client, name)

    assert_error(
        response, 422, "duplicate_category", "A category called Food already exists.", field="name"
    )
    assert names(client) == STARTING


@pytest.mark.parametrize(
    "new_name, expected",
    [
        ("", MISSING),
        ("   ", MISSING),
        ("x" * 31, TOO_LONG),
        ("bills", ("duplicate_category", "A category called Bills already exists.")),
    ],
)
def test_bad_rename_is_refused_and_nothing_changes(client, new_name, expected):
    response = rename(client, "Food", new_name)

    assert_error(response, 422, *expected, field="name")
    assert names(client) == STARTING


def test_renaming_to_own_name_with_different_capitals_is_allowed(client):
    add_category(client, "pets")

    response = rename(client, "pets", "Pets")

    assert response.status_code == 200
    assert response.json() == {"id": 7, "name": "Pets"}
    assert names(client)[-1] == "Pets"


# --- Renaming (criterion 11) ------------------------------------------------

def test_rename_keeps_expenses_in_every_month_and_the_limit(client):
    client.post("/api/expenses", json=make_expense(amount_paise=1250, date="2026-10-07"))
    client.post("/api/expenses", json=make_expense(amount_paise=900, date="2026-08-03"))
    client.put("/api/categories/1/limit", json={"limit_paise": 5000})

    response = rename(client, "Food", "  Groceries ")

    assert response.status_code == 200
    assert response.json() == {"id": 1, "name": "Groceries"}
    assert [e["category"] for e in client.get("/api/expenses").json()] == ["Groceries", "Groceries"]
    groceries = summary(client)[0]
    assert groceries == {
        "category_id": 1,
        "category": "Groceries",
        "spent_paise": 1250,
        "limit_paise": 5000,
        "remaining_paise": 3750,
        "over_limit": False,
    }


def test_renamed_category_keeps_its_place(client):
    rename(client, "Shopping", "Clothes")
    assert names(client) == ["Food", "Transport", "Clothes", "Bills", "Entertainment", "Other"]


def test_after_rename_old_name_is_refused_and_new_name_works(client):
    rename(client, "Food", "Groceries")

    old = client.post("/api/expenses", json=make_expense(category="Food"))
    new = client.post("/api/expenses", json=make_expense(category="Groceries"))

    assert old.json()["error"]["code"] == "invalid_category"
    assert new.status_code == 201


# --- Deleting (criteria 12 and 13) ------------------------------------------

def test_delete_category_used_by_expenses_is_refused_with_the_count(client):
    for day in ["2026-10-01", "2026-10-02", "2026-09-15", "2025-01-20"]:
        client.post("/api/expenses", json=make_expense(date=day))

    response = delete(client, "Food")

    assert_error(response, 422, "category_in_use", "Can't delete Food: 4 expenses use it.")
    assert names(client) == STARTING


def test_delete_message_for_exactly_one_expense(client):
    # A single expense from an earlier month still counts.
    client.post("/api/expenses", json=make_expense(category="Bills", date="2026-01-10"))

    response = delete(client, "Bills")

    assert_error(response, 422, "category_in_use", "Can't delete Bills: 1 expense uses it.")


def test_delete_unused_category_removes_it_and_its_limit(client):
    add_category(client, "Pets")
    pets_id = category_id(client, "Pets")
    client.put(f"/api/categories/{pets_id}/limit", json={"limit_paise": 500})

    response = client.delete(f"/api/categories/{pets_id}")

    assert response.status_code == 204
    assert response.content == b""
    assert names(client) == STARTING
    refused = client.post("/api/expenses", json=make_expense(category="Pets"))
    assert refused.json()["error"]["code"] == "invalid_category"
    # Its limit is gone too: a new "Pets" starts with no limit.
    add_category(client, "Pets")
    assert summary(client)[-1]["limit_paise"] is None


def test_deleting_a_starting_category_is_allowed_when_unused(client):
    response = delete(client, "Other")

    assert response.status_code == 204
    assert names(client) == STARTING[:-1]


def test_deleted_category_id_is_never_reused(client):
    add_category(client, "Pets")
    delete(client, "Pets")

    response = add_category(client, "Plants")

    assert response.json()["id"] == 8


# --- Limits on the number of categories (criterion 14) ----------------------

def test_last_remaining_category_cannot_be_deleted(client):
    for name in STARTING[1:]:
        delete(client, name)

    response = delete(client, "Food")

    assert_error(response, 422, "last_category", "You must keep at least one category.")
    assert names(client) == ["Food"]


def test_a_21st_category_cannot_be_added(client):
    for number in range(14):
        assert add_category(client, f"Extra {number}").status_code == 201
    assert len(names(client)) == 20

    response = add_category(client, "One too many")

    assert_error(response, 422, "too_many_categories", "You can have at most 20 categories.")
    assert len(names(client)) == 20


def test_after_deleting_one_of_20_another_can_be_added(client):
    for number in range(14):
        add_category(client, f"Extra {number}")
    delete(client, "Extra 0")

    assert add_category(client, "Replacement").status_code == 201


# --- Not found, unreadable requests, and the order of checks ----------------

def test_rename_unknown_category_is_not_found(client):
    response = client.put("/api/categories/999", json={"name": "Pets"})
    assert_error(response, 404, "category_not_found", "This category no longer exists.")


def test_delete_unknown_category_is_not_found(client):
    response = client.delete("/api/categories/999")
    assert_error(response, 404, "category_not_found", "This category no longer exists.")


@pytest.mark.parametrize("method", ["put", "delete"])
def test_id_that_is_not_a_number_is_refused(client, method):
    kwargs = {"json": {"name": "Pets"}} if method == "put" else {}

    response = getattr(client, method)("/api/categories/Food", **kwargs)

    assert response.json()["error"]["code"] == "invalid_request"


@pytest.mark.parametrize("raw_body", ["{bad", ""])
def test_unreadable_body_is_refused(client, raw_body):
    response = client.post(
        "/api/categories", content=raw_body, headers={"Content-Type": "application/json"}
    )
    assert response.json()["error"]["code"] == "invalid_request"


def test_body_that_is_not_an_object_is_refused(client):
    response = client.post("/api/categories", json=["Pets"])
    assert response.json()["error"]["code"] == "invalid_request"


def test_adding_checks_the_name_before_the_count(client):
    for number in range(14):
        add_category(client, f"Extra {number}")

    assert add_category(client, "").json()["error"]["code"] == "category_name_missing"
    assert add_category(client, "food").json()["error"]["code"] == "duplicate_category"


def test_renaming_checks_not_found_before_the_name(client):
    response = client.put("/api/categories/999", json={"name": ""})
    assert response.json()["error"]["code"] == "category_not_found"


def test_deleting_checks_last_category_before_in_use(client):
    for name in STARTING[1:]:
        delete(client, name)
    client.post("/api/expenses", json=make_expense())

    response = delete(client, "Food")

    assert response.json()["error"]["code"] == "last_category"
