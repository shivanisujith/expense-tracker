import pytest

from conftest import insert_expense_row, make_expense

CATEGORY_ORDER = ["Food", "Transport", "Shopping", "Bills", "Entertainment", "Other"]


def summary_row(client, category):
    categories = client.get("/api/summary").json()["categories"]
    return next(row for row in categories if row["category"] == category)


def add(client, **changes):
    response = client.post("/api/expenses", json=make_expense(**changes))
    assert response.status_code == 201
    return response.json()


def category_id(client, name):
    return summary_row(client, name)["category_id"]


def set_limit(client, category, limit_paise):
    """Sets a limit by category name, looking up the category's id first."""
    return client.put(
        f"/api/categories/{category_id(client, category)}/limit", json={"limit_paise": limit_paise}
    )


# --- Summary shape ----------------------------------------------------------

def test_new_database_summary_lists_the_six_starting_categories_in_order(client):
    response = client.get("/api/summary")

    assert response.status_code == 200
    assert response.json() == {
        "month": "2026-10",
        "total_spent_paise": 0,
        "categories": [
            {
                "category_id": position + 1,
                "category": name,
                "spent_paise": 0,
                "limit_paise": None,
                "remaining_paise": None,
                "over_limit": False,
            }
            for position, name in enumerate(CATEGORY_ORDER)
        ],
    }


# --- Spent (criterion 6) ----------------------------------------------------

def test_spent_is_exact_sum_of_this_months_expenses(client):
    add(client, amount_paise=1250, date="2026-10-01")
    add(client, amount_paise=1, date="2026-10-07")
    add(client, amount_paise=99999, date="2026-10-03")
    add(client, category="Bills", amount_paise=50000)

    assert summary_row(client, "Food")["spent_paise"] == 1250 + 1 + 99999
    assert summary_row(client, "Bills")["spent_paise"] == 50000
    assert summary_row(client, "Transport")["spent_paise"] == 0


def test_spent_excludes_other_months(client, db_path):
    add(client, amount_paise=1000, date="2026-10-01")
    add(client, amount_paise=2000, date="2026-09-30")  # last month
    add(client, amount_paise=4000, date="2025-10-15")  # same month, last year

    # The API refuses future dates, so put a next-month row in directly.
    insert_expense_row(amount_paise=8000, date="2026-11-01", created_at="2026-10-07T00:00:00")

    assert summary_row(client, "Food")["spent_paise"] == 1000


def total_spent(client):
    return client.get("/api/summary").json()["total_spent_paise"]


def test_total_spent_equals_the_sum_of_all_categories(client):
    """Criterion 16."""
    add(client, amount_paise=1250, date="2026-10-01")
    add(client, category="Bills", amount_paise=50000, date="2026-10-07")
    add(client, category="Transport", amount_paise=1, date="2026-10-03")
    add(client, category="Other", amount_paise=7959, date="2026-10-05")
    client.post("/api/categories", json={"name": "Pets"})
    add(client, category="Pets", amount_paise=800, date="2026-10-06")

    categories = client.get("/api/summary").json()["categories"]

    assert total_spent(client) == sum(row["spent_paise"] for row in categories)
    assert total_spent(client) == 1250 + 50000 + 1 + 7959 + 800


def test_total_spent_excludes_other_months(client, db_path):
    """Criterion 16."""
    add(client, amount_paise=1000, date="2026-10-01")
    add(client, category="Bills", amount_paise=2500, date="2026-10-07")
    add(client, amount_paise=2000, date="2026-09-30")  # last month
    add(client, category="Bills", amount_paise=4000, date="2025-10-15")  # same month, last year
    insert_expense_row(amount_paise=8000, date="2026-11-01", created_at="2026-10-07T00:00:00")

    assert total_spent(client) == 1000 + 2500


def test_total_counts_by_expense_date_not_when_it_was_saved(client, db_path):
    """An expense dated last month but saved this month is not this month's."""
    add(client, amount_paise=9210, date="2026-10-02")
    # Added through the API today (7 Oct), but dated 23 Sep.
    add(client, amount_paise=200, date="2026-09-23")
    # The same again, written straight into the database with an October
    # "saved at" time, to be sure only the date matters.
    insert_expense_row(amount_paise=200, date="2026-09-23", created_at="2026-10-13T09:00:00+00:00")

    summary = client.get("/api/summary").json()

    assert summary["total_spent_paise"] == 9210
    assert sum(row["spent_paise"] for row in summary["categories"]) == 9210


def test_total_spent_follows_edits_and_deletes(client):
    expense = add(client, amount_paise=1000)
    add(client, category="Bills", amount_paise=500)

    client.put(f"/api/expenses/{expense['id']}", json=make_expense(amount_paise=3000))
    assert total_spent(client) == 3500

    client.delete(f"/api/expenses/{expense['id']}")
    assert total_spent(client) == 500


def test_total_spent_is_exact(client):
    add(client, amount_paise=10)
    add(client, category="Bills", amount_paise=20)

    assert total_spent(client) == 30


def test_money_sums_stay_exact(client):
    # 0.10 + 0.20 is not exactly 0.30 in floating point; paise must be.
    add(client, amount_paise=10)
    add(client, amount_paise=20)

    assert summary_row(client, "Food")["spent_paise"] == 30


# --- Limits and over-limit (criterion 7) ------------------------------------

def test_set_limit_returns_category_and_limit(client):
    response = set_limit(client, "Food", 500000)

    assert response.status_code == 200
    assert response.json() == {"category_id": 1, "category": "Food", "limit_paise": 500000}


def test_limit_shows_in_summary_with_remaining(client):
    set_limit(client, "Food", 500000)
    add(client, amount_paise=1250)

    assert summary_row(client, "Food") == {
        "category_id": 1,
        "category": "Food",
        "spent_paise": 1250,
        "limit_paise": 500000,
        "remaining_paise": 498750,
        "over_limit": False,
    }


def test_expense_that_goes_over_limit_is_saved_and_flagged(client):
    set_limit(client, "Bills", 40000)

    response = client.post("/api/expenses", json=make_expense(category="Bills", amount_paise=50000))

    assert response.status_code == 201
    assert len(client.get("/api/expenses").json()) == 1
    assert summary_row(client, "Bills") == {
        "category_id": 4,
        "category": "Bills",
        "spent_paise": 50000,
        "limit_paise": 40000,
        "remaining_paise": -10000,
        "over_limit": True,
    }


def test_spending_exactly_the_limit_is_not_over(client):
    set_limit(client, "Food", 10000)
    add(client, amount_paise=10000)

    row = summary_row(client, "Food")
    assert row["remaining_paise"] == 0
    assert row["over_limit"] is False


def test_one_paisa_over_the_limit_is_over(client):
    set_limit(client, "Food", 10000)
    add(client, amount_paise=10001)

    row = summary_row(client, "Food")
    assert row["remaining_paise"] == -1
    assert row["over_limit"] is True


def test_category_without_limit_is_never_over(client):
    add(client, amount_paise=99999999)

    row = summary_row(client, "Food")
    assert row["limit_paise"] is None
    assert row["remaining_paise"] is None
    assert row["over_limit"] is False


def test_other_months_do_not_count_towards_limit(client):
    set_limit(client, "Food", 10000)
    add(client, amount_paise=50000, date="2026-09-30")

    assert summary_row(client, "Food")["over_limit"] is False


def test_changing_a_limit_replaces_the_old_one(client):
    set_limit(client, "Food", 10000)
    add(client, amount_paise=15000)
    assert summary_row(client, "Food")["over_limit"] is True

    response = set_limit(client, "Food", 20000)

    assert response.json() == {"category_id": 1, "category": "Food", "limit_paise": 20000}
    row = summary_row(client, "Food")
    assert row["limit_paise"] == 20000
    assert row["remaining_paise"] == 5000
    assert row["over_limit"] is False


def test_limit_applies_to_one_category_only(client):
    set_limit(client, "Food", 10000)

    assert summary_row(client, "Transport")["limit_paise"] is None


def test_deleting_an_expense_can_clear_the_warning(client):
    set_limit(client, "Food", 10000)
    expense = add(client, amount_paise=15000)

    client.delete(f"/api/expenses/{expense['id']}")

    assert summary_row(client, "Food")["over_limit"] is False


# --- Refused limits ---------------------------------------------------------

def test_limit_for_unknown_category_id_is_not_found(client):
    response = client.put("/api/categories/999/limit", json={"limit_paise": 10000})

    assert response.status_code == 404
    assert response.json() == {
        "error": {
            "code": "category_not_found",
            "message": "This category no longer exists.",
            "field": None,
        }
    }


@pytest.mark.parametrize("bad_id", ["Food", "abc", "1.5"])
def test_limit_for_id_that_is_not_a_number_is_refused(client, bad_id):
    response = client.put(f"/api/categories/{bad_id}/limit", json={"limit_paise": 10000})

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "invalid_request"


def test_old_limit_address_no_longer_exists(client):
    response = client.put("/api/limits/Food", json={"limit_paise": 10000})
    assert response.status_code in (404, 405)


@pytest.mark.parametrize("limit", [0, -100, "abc", "10000", 12.5, True, None])
def test_bad_limit_amount_is_refused_and_nothing_changes(client, limit):
    set_limit(client, "Food", 10000)

    response = set_limit(client, "Food", limit)

    assert response.status_code == 422
    assert response.json() == {
        "error": {
            "code": "invalid_limit",
            "message": "Limit is required and must be a whole number of paise greater than 0.",
            "field": "limit_paise",
        }
    }
    assert summary_row(client, "Food")["limit_paise"] == 10000


def test_missing_limit_is_refused(client):
    response = client.put("/api/categories/1/limit", json={})
    assert response.json()["error"]["code"] == "invalid_limit"


def test_unknown_category_is_reported_before_bad_limit(client):
    response = client.put("/api/categories/999/limit", json={"limit_paise": 0})
    assert response.json()["error"]["code"] == "category_not_found"


@pytest.mark.parametrize("raw_body", ["{bad", ""])
def test_limit_with_unreadable_body_is_refused(client, raw_body):
    response = client.put(
        "/api/categories/1/limit", content=raw_body, headers={"Content-Type": "application/json"}
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "invalid_request"


def test_limit_body_that_is_not_an_object_is_refused(client):
    response = client.put("/api/categories/1/limit", json=[10000])
    assert response.json()["error"]["code"] == "invalid_request"
