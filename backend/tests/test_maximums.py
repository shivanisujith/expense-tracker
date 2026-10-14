"""The largest allowed amount and limit: Rs 10,00,00,000.00, which is
10,000,000,000 paise (goal-spec criterion 21, backend rules 1 and 8)."""

import pytest

from conftest import make_expense

MAX_PAISE = 10_000_000_000
TOO_LARGE = [MAX_PAISE + 1, 2**62, 2**63 - 1, 10**20]


def assert_too_large(response, code, field, message):
    assert response.status_code == 422
    assert response.json() == {"error": {"code": code, "message": message, "field": field}}


def assert_amount_too_large(response):
    assert_too_large(response, "amount_too_large", "amount_paise", "Amount is too large.")


def test_exactly_the_maximum_amount_is_accepted(client):
    response = client.post("/api/expenses", json=make_expense(amount_paise=MAX_PAISE))

    assert response.status_code == 201
    assert response.json()["amount_paise"] == MAX_PAISE


@pytest.mark.parametrize("amount", TOO_LARGE)
def test_adding_an_amount_above_the_maximum_is_refused(client, amount):
    assert_amount_too_large(client.post("/api/expenses", json=make_expense(amount_paise=amount)))
    assert client.get("/api/expenses").json() == []


@pytest.mark.parametrize("amount", TOO_LARGE)
def test_editing_to_an_amount_above_the_maximum_is_refused(client, amount):
    saved = client.post("/api/expenses", json=make_expense(amount_paise=1250)).json()

    response = client.put(f"/api/expenses/{saved['id']}", json=make_expense(amount_paise=amount))

    assert_amount_too_large(response)
    assert client.get("/api/expenses").json() == [saved]


def test_editing_to_exactly_the_maximum_is_accepted(client):
    saved = client.post("/api/expenses", json=make_expense(amount_paise=1250)).json()

    response = client.put(f"/api/expenses/{saved['id']}", json=make_expense(amount_paise=MAX_PAISE))

    assert response.status_code == 200
    assert response.json()["amount_paise"] == MAX_PAISE


def test_too_large_is_reported_before_problems_with_later_fields(client):
    body = make_expense(amount_paise=MAX_PAISE + 1, category="Nope", date="bad", note="x" * 101)
    assert_amount_too_large(client.post("/api/expenses", json=body))


def test_the_limit_can_be_exactly_the_maximum(client):
    response = client.put("/api/categories/1/limit", json={"limit_paise": MAX_PAISE})

    assert response.status_code == 200
    assert response.json()["limit_paise"] == MAX_PAISE


@pytest.mark.parametrize("limit", TOO_LARGE)
def test_a_limit_above_the_maximum_is_refused_and_the_old_limit_kept(client, limit):
    client.put("/api/categories/1/limit", json={"limit_paise": 500000})

    response = client.put("/api/categories/1/limit", json={"limit_paise": limit})

    assert_too_large(response, "limit_too_large", "limit_paise", "Limit is too large.")
    food = client.get("/api/summary").json()["categories"][0]
    assert food["limit_paise"] == 500000


def test_huge_amounts_can_no_longer_break_the_summary(client):
    # Two of these used to be saved, and their sum broke the summary for good.
    for _ in range(2):
        client.post("/api/expenses", json=make_expense(amount_paise=2**62))

    response = client.get("/api/summary")

    assert response.status_code == 200
    assert response.json()["total_spent_paise"] == 0


def test_many_maximum_amounts_still_add_up_exactly(client):
    for day in range(1, 8):
        for category in ("Food", "Bills", "Other"):
            body = make_expense(amount_paise=MAX_PAISE, category=category, date=f"2026-10-0{day}")
            assert client.post("/api/expenses", json=body).status_code == 201
    client.put("/api/categories/1/limit", json={"limit_paise": MAX_PAISE})

    summary = client.get("/api/summary").json()

    assert summary["total_spent_paise"] == 21 * MAX_PAISE
    food = summary["categories"][0]
    assert food["spent_paise"] == 7 * MAX_PAISE
    assert food["remaining_paise"] == -6 * MAX_PAISE
    assert food["over_limit"] is True
    assert client.get("/api/months/2026-10/total").json()["total_spent_paise"] == 21 * MAX_PAISE
