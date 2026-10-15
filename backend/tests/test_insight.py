"""The insight for a month (goal-spec criterion 23, backend-spec "Insight
for a month") and the category id on every expense."""

from conftest import insert_expense_row, make_expense


def add(client, amount_paise, date, category="Food", note=""):
    body = make_expense(amount_paise=amount_paise, date=date, category=category, note=note)
    response = client.post("/api/expenses", json=body)
    assert response.status_code == 201
    return response.json()


def summary_insight(client):
    return client.get("/api/summary").json()["insight"]


def month_insight(client, month):
    response = client.get(f"/api/months/{month}/total")
    assert response.status_code == 200
    return response.json()["insight"]


def biggest(insight):
    return [row["category"] for row in insight["biggest_categories"]]


# --- The difference from the month before ------------------------------------


def test_less_than_the_month_before_is_negative_and_exact(client):
    # The API contract's example: Rs 512.50 in October, Rs 1,132.50 in September.
    add(client, 1250, "2026-10-01")
    add(client, 50000, "2026-10-05", category="Bills")
    add(client, 113249, "2026-09-10")
    add(client, 1, "2026-09-30", category="Other")

    insight = summary_insight(client)

    assert insight["previous_month"] == "2026-09"
    assert insight["difference_paise"] == -62000


def test_more_than_the_month_before_is_positive(client):
    add(client, 30000, "2026-10-02")
    add(client, 10000, "2026-09-02")
    assert summary_insight(client)["difference_paise"] == 20000


def test_exactly_the_same_is_zero(client):
    add(client, 4321, "2026-10-02")
    add(client, 4000, "2026-09-02")
    add(client, 321, "2026-09-03", category="Bills")
    assert summary_insight(client)["difference_paise"] == 0


def test_no_difference_when_the_month_before_has_no_expenses(client):
    add(client, 5000, "2026-10-02")
    add(client, 7000, "2026-08-15")  # two months back doesn't count

    insight = summary_insight(client)

    assert insight["previous_month"] == "2026-09"
    assert insight["difference_paise"] is None


def test_a_month_with_nothing_spent_still_compares_with_the_month_before(client):
    add(client, 921000, "2026-09-02")
    insight = summary_insight(client)
    assert insight["difference_paise"] == -921000
    assert insight["biggest_categories"] == []


def test_january_compares_with_december_of_the_year_before(client):
    add(client, 2000, "2026-01-10")
    add(client, 500, "2025-12-31")

    insight = month_insight(client, "2026-01")

    assert insight["previous_month"] == "2025-12"
    assert insight["difference_paise"] == 1500


def test_difference_stays_exact_with_large_amounts(client):
    add(client, 10_000_000_000, "2026-10-01")
    add(client, 10_000_000_000, "2026-10-02", category="Bills")
    add(client, 1, "2026-09-01")
    assert summary_insight(client)["difference_paise"] == 19_999_999_999


def test_months_count_by_expense_date_not_when_saved(client):
    add(client, 9210, "2026-10-02")
    # Dated in September but saved in October: it belongs to September.
    insert_expense_row(amount_paise=200, date="2026-09-23", created_at="2026-10-13T10:00:00+00:00")

    insight = summary_insight(client)

    assert insight["difference_paise"] == 9010
    assert biggest(insight) == ["Food"]


# --- The biggest categories ----------------------------------------------------


def test_one_biggest_category_with_its_id_and_name(client):
    add(client, 3000, "2026-10-01", category="Food")
    add(client, 2000, "2026-10-02", category="Food")
    add(client, 4999, "2026-10-03", category="Bills")

    assert summary_insight(client)["biggest_categories"] == [{"category_id": 1, "category": "Food"}]


def test_a_tie_names_every_tied_category_in_category_order(client):
    add(client, 500, "2026-10-01", category="Other")
    add(client, 500, "2026-10-02", category="Food")
    add(client, 500, "2026-10-03", category="Bills")
    add(client, 499, "2026-10-04", category="Transport")

    assert biggest(summary_insight(client)) == ["Food", "Bills", "Other"]


def test_no_biggest_category_when_nothing_was_spent(client):
    add(client, 500, "2026-08-01")
    insight = summary_insight(client)
    assert insight == {"previous_month": "2026-09", "difference_paise": None, "biggest_categories": []}


def test_biggest_category_uses_the_current_name_after_a_rename(client):
    add(client, 500, "2026-10-01", category="Food")
    client.put("/api/categories/1", json={"name": "Groceries"})

    assert summary_insight(client)["biggest_categories"] == [{"category_id": 1, "category": "Groceries"}]


def test_biggest_category_can_be_one_you_created(client):
    client.post("/api/categories", json={"name": "Pets"})
    add(client, 800, "2026-10-01", category="Pets")
    add(client, 700, "2026-10-01", category="Food")

    assert summary_insight(client)["biggest_categories"] == [{"category_id": 7, "category": "Pets"}]


def test_other_months_dont_affect_the_biggest_category(client):
    add(client, 100, "2026-10-01", category="Food")
    add(client, 99999, "2026-09-01", category="Bills")
    add(client, 99999, "2025-10-01", category="Bills")  # same month, last year
    assert biggest(summary_insight(client)) == ["Food"]


# --- Every month's total has its insight --------------------------------------


def test_a_past_months_total_has_its_own_insight(client):
    add(client, 9210, "2026-09-05", category="Food")
    add(client, 100, "2026-09-06", category="Bills")
    add(client, 20000, "2026-08-05", category="Shopping")
    add(client, 50, "2026-10-01", category="Other")

    assert client.get("/api/months/2026-09/total").json() == {
        "month": "2026-09",
        "total_spent_paise": 9310,
        "insight": {
            "previous_month": "2026-08",
            "difference_paise": 9310 - 20000,
            "biggest_categories": [{"category_id": 1, "category": "Food"}],
        },
    }


def test_the_current_months_total_and_the_summary_agree(client):
    add(client, 300, "2026-10-01", category="Bills")
    add(client, 300, "2026-10-01", category="Food")
    add(client, 100, "2026-09-01")

    assert month_insight(client, "2026-10") == summary_insight(client)


def test_insight_follows_edits_and_deletes(client):
    food = add(client, 1000, "2026-10-01", category="Food")
    add(client, 500, "2026-10-02", category="Bills")
    add(client, 2000, "2026-09-01")

    client.put(f"/api/expenses/{food['id']}", json=make_expense(amount_paise=100, date="2026-10-01"))
    insight = summary_insight(client)
    assert (insight["difference_paise"], biggest(insight)) == (600 - 2000, ["Bills"])

    client.delete(f"/api/expenses/{food['id']}")
    insight = summary_insight(client)
    assert (insight["difference_paise"], biggest(insight)) == (500 - 2000, ["Bills"])


# --- category_id on every expense ----------------------------------------------


def test_every_expense_has_its_category_id(client):
    added = add(client, 1250, "2026-10-01", category="Bills", note="Phone")
    assert added == {
        "id": added["id"],
        "amount_paise": 1250,
        "category": "Bills",
        "category_id": 4,
        "date": "2026-10-01",
        "note": "Phone",
    }

    edited = client.put(
        f"/api/expenses/{added['id']}", json=make_expense(category="Other", date="2026-09-01")
    ).json()
    assert (edited["category"], edited["category_id"]) == ("Other", 6)

    assert client.get("/api/expenses").json()[0]["category_id"] == 6
    assert client.get("/api/expenses", params={"month": "2026-09"}).json()[0]["category_id"] == 6


def test_a_category_id_sent_by_the_page_is_ignored(client):
    # Only the name decides the category; category_id is just for display.
    added = client.post("/api/expenses", json={**make_expense(category="Food"), "category_id": 4}).json()
    assert (added["category"], added["category_id"]) == ("Food", 1)


def test_starting_categories_have_ids_1_to_6_and_new_ones_7_up(client):
    rows = client.get("/api/summary").json()["categories"]
    assert [(row["category_id"], row["category"]) for row in rows] == [
        (1, "Food"), (2, "Transport"), (3, "Shopping"), (4, "Bills"), (5, "Entertainment"), (6, "Other"),
    ]
    assert client.post("/api/categories", json={"name": "Pets"}).json()["id"] == 7
