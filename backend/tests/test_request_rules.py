"""Requests the backend can't read are refused with invalid_request, and
nothing is changed: a note that isn't text (backend rule 4), an id that
isn't a whole number (rules 6 and 20), and a body not labelled as JSON
(API contract, under the error table)."""

import json

import pytest

from conftest import make_expense

INVALID_REQUEST = {
    "error": {
        "code": "invalid_request",
        "message": "The request could not be read. Please try again.",
        "field": None,
    }
}


def assert_invalid_request(response):
    assert response.status_code == 422
    assert response.json() == INVALID_REQUEST


# --- A. A note that isn't text ----------------------------------------------


@pytest.mark.parametrize("note", [123, 12.5, True, ["Lunch"], {"text": "Lunch"}])
def test_adding_with_a_note_that_is_not_text_is_refused(client, note):
    assert_invalid_request(client.post("/api/expenses", json=make_expense(note=note)))
    assert client.get("/api/expenses").json() == []


@pytest.mark.parametrize("note", [123, ["Lunch"]])
def test_editing_with_a_note_that_is_not_text_is_refused(client, note):
    saved = client.post("/api/expenses", json=make_expense()).json()

    assert_invalid_request(client.put(f"/api/expenses/{saved['id']}", json=make_expense(note=note)))
    assert client.get("/api/expenses").json() == [saved]


# --- B. An id that isn't a whole number --------------------------------------

BAD_IDS = ["abc", "1.5", "Food", "1e3"]


@pytest.mark.parametrize("bad_id", BAD_IDS)
def test_editing_an_expense_id_that_is_not_a_number_is_refused(client, bad_id):
    saved = client.post("/api/expenses", json=make_expense()).json()

    assert_invalid_request(client.put(f"/api/expenses/{bad_id}", json=make_expense(amount_paise=99)))
    assert client.get("/api/expenses").json() == [saved]


@pytest.mark.parametrize("bad_id", BAD_IDS)
def test_deleting_an_expense_id_that_is_not_a_number_is_refused(client, bad_id):
    saved = client.post("/api/expenses", json=make_expense()).json()

    assert_invalid_request(client.delete(f"/api/expenses/{bad_id}"))
    assert client.get("/api/expenses").json() == [saved]


def test_a_bad_id_is_reported_before_a_bad_body(client):
    # Rule 6: the id is checked before any other check.
    assert_invalid_request(client.put("/api/expenses/abc", json=make_expense(amount_paise=0)))
    assert_invalid_request(client.put("/api/categories/abc", json={"name": ""}))
    assert_invalid_request(client.put("/api/categories/abc/limit", json={"limit_paise": 0}))


@pytest.mark.parametrize("bad_id", BAD_IDS)
def test_category_ids_that_are_not_numbers_are_refused_everywhere(client, bad_id):
    assert_invalid_request(client.put(f"/api/categories/{bad_id}", json={"name": "Pets"}))
    assert_invalid_request(client.delete(f"/api/categories/{bad_id}"))
    assert_invalid_request(client.put(f"/api/categories/{bad_id}/limit", json={"limit_paise": 100}))
    assert len(client.get("/api/summary").json()["categories"]) == 6


# --- C. A body that isn't labelled as JSON -----------------------------------

SENDERS = {
    "add expense": ("post", "/api/expenses", make_expense()),
    "edit expense": ("put", "/api/expenses/1", make_expense(amount_paise=99)),
    "set limit": ("put", "/api/categories/1/limit", {"limit_paise": 500000}),
    "add category": ("post", "/api/categories", {"name": "Pets"}),
    "rename category": ("put", "/api/categories/1", {"name": "Groceries"}),
}


@pytest.mark.parametrize("label", [None, "text/plain", "application/x-www-form-urlencoded"])
@pytest.mark.parametrize("request_name", SENDERS)
def test_a_valid_json_body_without_the_json_label_is_refused(client, request_name, label):
    client.post("/api/expenses", json=make_expense())  # expense 1, for editing
    before = (client.get("/api/expenses").json(), client.get("/api/summary").json())
    method, address, body = SENDERS[request_name]
    headers = {} if label is None else {"Content-Type": label}

    response = getattr(client, method)(address, content=json.dumps(body), headers=headers)

    assert_invalid_request(response)
    assert (client.get("/api/expenses").json(), client.get("/api/summary").json()) == before
