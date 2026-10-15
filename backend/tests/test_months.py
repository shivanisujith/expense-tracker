"""Choosing a month: the filtered expense list, the months list, and the
total for one month (goal-spec criteria 17 and 19)."""

import pytest

from conftest import insert_expense_row, make_expense

BAD_MONTHS = ["2026-9", "2026-13", "2026-00", "September", "2026-09-01", "202609", " 2026-09", ""]


def add(client, amount_paise, date, category="Food", note=""):
    response = client.post(
        "/api/expenses", json=make_expense(amount_paise=amount_paise, date=date, category=category, note=note)
    )
    assert response.status_code == 201
    return response.json()


def assert_error(response, code, message):
    assert response.status_code == 422
    assert response.json() == {"error": {"code": code, "message": message, "field": "month"}}


INVALID_MONTH = "Month must be a real month in YYYY-MM form."


# --- Expense list, filtered by month (criterion 19) -------------------------


def test_list_for_a_month_has_only_that_months_expenses_newest_first(client):
    sep_early = add(client, 100, "2026-09-02")
    oct_one = add(client, 200, "2026-10-01")
    sep_late = add(client, 300, "2026-09-30")
    sep_same_day_later = add(client, 400, "2026-09-30")
    add(client, 500, "2025-09-15")  # same month number, other year

    response = client.get("/api/expenses", params={"month": "2026-09"})

    assert response.status_code == 200
    assert [e["id"] for e in response.json()] == [sep_same_day_later["id"], sep_late["id"], sep_early["id"]]
    assert oct_one not in response.json()


def test_list_without_a_month_still_has_every_expense(client):
    ids = [add(client, 100, date)["id"] for date in ("2026-08-01", "2026-09-01", "2026-10-01")]

    response = client.get("/api/expenses")

    assert [e["id"] for e in response.json()] == list(reversed(ids))


def test_list_for_a_month_with_no_expenses_is_empty(client):
    add(client, 100, "2026-10-01")
    assert client.get("/api/expenses", params={"month": "2026-07"}).json() == []


def test_list_for_a_future_month_is_empty_not_refused(client):
    add(client, 100, "2026-10-01")
    response = client.get("/api/expenses", params={"month": "2026-11"})
    assert response.status_code == 200
    assert response.json() == []


def test_list_counts_expenses_by_date_not_when_they_were_saved(client, db_path):
    add(client, 100, "2026-10-02")
    insert_expense_row(amount_paise=200, date="2026-09-23", created_at="2026-10-13T10:00:00+00:00")

    october = client.get("/api/expenses", params={"month": "2026-10"}).json()
    september = client.get("/api/expenses", params={"month": "2026-09"}).json()

    assert [e["amount_paise"] for e in october] == [100]
    assert [e["amount_paise"] for e in september] == [200]


def test_list_for_a_month_shows_current_category_names(client):
    add(client, 100, "2026-09-05", category="Food")
    add(client, 200, "2026-10-05", category="Food")
    client.put("/api/categories/1", json={"name": "Groceries"})

    [expense] = client.get("/api/expenses", params={"month": "2026-09"}).json()

    assert expense["category"] == "Groceries"


@pytest.mark.parametrize("month", BAD_MONTHS)
def test_list_refuses_a_badly_formatted_month(client, month):
    assert_error(client.get("/api/expenses", params={"month": month}), "invalid_month", INVALID_MONTH)


# --- Months with expenses ----------------------------------------------------


def test_months_lists_each_month_with_expenses_once_newest_first(client):
    for date in ("2026-09-23", "2026-10-02", "2026-07-01", "2026-09-01", "2025-12-31"):
        add(client, 100, date)

    response = client.get("/api/months")

    assert response.status_code == 200
    assert response.json() == ["2026-10", "2026-09", "2026-07", "2025-12"]


def test_months_is_empty_with_no_expenses(client):
    assert client.get("/api/months").json() == []


def test_months_follow_edits_and_deletes(client):
    expense = add(client, 100, "2026-08-10")
    add(client, 100, "2026-10-01")

    client.put(f"/api/expenses/{expense['id']}", json=make_expense(amount_paise=100, date="2026-06-10"))
    assert client.get("/api/months").json() == ["2026-10", "2026-06"]

    client.delete(f"/api/expenses/{expense['id']}")
    assert client.get("/api/months").json() == ["2026-10"]


# --- Total for one month (criterion 17) --------------------------------------


def test_month_total_is_the_exact_sum_of_that_months_expenses(client):
    add(client, 9210, "2026-09-02", category="Food")
    add(client, 1, "2026-09-30", category="Bills")
    add(client, 333, "2026-09-15", category="Other")
    add(client, 5000, "2026-10-01")
    add(client, 7000, "2026-08-31")
    add(client, 8000, "2025-09-10")

    response = client.get("/api/months/2026-09/total")

    assert response.status_code == 200
    assert response.json()["month"] == "2026-09"
    assert response.json()["total_spent_paise"] == 9544


def test_month_total_counts_by_expense_date_not_when_it_was_saved(client, db_path):
    add(client, 9210, "2026-10-02")
    insert_expense_row(amount_paise=200, date="2026-09-23", created_at="2026-10-13T10:00:00+00:00")

    assert client.get("/api/months/2026-09/total").json()["total_spent_paise"] == 200
    assert client.get("/api/months/2026-10/total").json()["total_spent_paise"] == 9210


def test_month_total_is_zero_for_a_month_with_no_expenses(client):
    add(client, 100, "2026-10-01")
    response = client.get("/api/months/2026-05/total").json()
    assert (response["month"], response["total_spent_paise"]) == ("2026-05", 0)


def test_month_total_for_the_current_month_matches_the_summary(client):
    for amount, date in ((1250, "2026-10-01"), (50000, "2026-10-07"), (999, "2026-09-30")):
        add(client, amount, date)

    total = client.get("/api/months/2026-10/total").json()["total_spent_paise"]

    assert total == client.get("/api/summary").json()["total_spent_paise"] == 51250


def test_month_total_stays_exact_with_large_amounts(client):
    add(client, 99_999_999_99, "2026-09-01")
    add(client, 1, "2026-09-02")
    assert client.get("/api/months/2026-09/total").json()["total_spent_paise"] == 100_000_000_00


def test_month_total_follows_edits_and_deletes(client):
    expense = add(client, 1000, "2026-09-10")
    client.put(f"/api/expenses/{expense['id']}", json=make_expense(amount_paise=2500, date="2026-09-10"))
    assert client.get("/api/months/2026-09/total").json()["total_spent_paise"] == 2500

    client.delete(f"/api/expenses/{expense['id']}")
    assert client.get("/api/months/2026-09/total").json()["total_spent_paise"] == 0


@pytest.mark.parametrize("month", ["2026-11", "2027-01", "9999-12"])
def test_month_total_refuses_a_future_month(client, month):
    response = client.get(f"/api/months/{month}/total")
    assert_error(response, "future_month", "Month cannot be in the future.")


@pytest.mark.parametrize("month", [m for m in BAD_MONTHS if m.strip()])
def test_month_total_refuses_a_badly_formatted_month(client, month):
    response = client.get(f"/api/months/{month}/total")
    assert_error(response, "invalid_month", INVALID_MONTH)
