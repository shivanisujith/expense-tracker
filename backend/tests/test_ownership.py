"""Criterion 32: each account sees and changes only its own data, even when
it guesses another account's ids (specs/backend-spec.md, "Ownership
rules")."""

import pytest

from conftest import make_expense, new_account

EXPENSE_NOT_FOUND = {
    "error": {"code": "expense_not_found", "message": "This expense no longer exists.", "field": None}
}
CATEGORY_NOT_FOUND = {
    "error": {"code": "category_not_found", "message": "This category no longer exists.", "field": None}
}
MISSING_ID = 999999


@pytest.fixture
def alice(anon_client):
    """Signs up first, so her starting six get ids 1 to 6."""
    client = new_account("alice")
    client.post("/api/categories", json={"name": "Pets"})
    client.post("/api/expenses", json=make_expense(amount_paise=1250, category="Food"))
    client.post("/api/expenses", json=make_expense(amount_paise=4000, category="Pets", date="2026-09-12"))
    client.put("/api/categories/1/limit", json={"limit_paise": 500000})
    return client


@pytest.fixture
def bob(alice):
    """Signs up second, after Alice's Pets (id 7), so his starting six get
    ids 8 to 13."""
    return new_account("bob")


def everything(client):
    return (
        client.get("/api/expenses").json(),
        client.get("/api/summary").json(),
        client.get("/api/months").json(),
        client.get("/api/months/2026-09/total").json(),
    )


def id_of(client, name):
    rows = client.get("/api/summary").json()["categories"]
    return next(row["category_id"] for row in rows if row["category"] == name)


def alice_expense_id(alice):
    return alice.get("/api/expenses").json()[0]["id"]


# --- Seeing only your own data -------------------------------------------------


def test_a_second_account_sees_none_of_the_first_accounts_data(alice, bob):
    assert bob.get("/api/expenses").json() == []
    assert bob.get("/api/expenses", params={"month": "2026-09"}).json() == []
    assert bob.get("/api/months").json() == []
    assert bob.get("/api/months/2026-09/total").json() == {
        "month": "2026-09",
        "total_spent_paise": 0,
        "insight": {"previous_month": "2026-08", "difference_paise": None, "biggest_categories": []},
    }
    summary = bob.get("/api/summary").json()
    assert summary["total_spent_paise"] == 0
    assert summary["insight"] == {"previous_month": "2026-09", "difference_paise": None, "biggest_categories": []}
    assert [row["category"] for row in summary["categories"]] == [
        "Food", "Transport", "Shopping", "Bills", "Entertainment", "Other",
    ]
    assert [row["category_id"] for row in summary["categories"]] == list(range(8, 14))
    assert all(row["limit_paise"] is None and row["spent_paise"] == 0 for row in summary["categories"])


def test_each_account_sees_only_its_own_totals_and_insight(alice, bob):
    bob.post("/api/expenses", json=make_expense(amount_paise=777, category="Bills"))

    alice_summary = alice.get("/api/summary").json()
    bob_summary = bob.get("/api/summary").json()

    assert alice_summary["total_spent_paise"] == 1250
    assert alice_summary["insight"]["biggest_categories"] == [
        {"category_id": 1, "category": "Food", "icon": "food"}
    ]
    assert alice_summary["insight"]["difference_paise"] == 1250 - 4000
    assert bob_summary["total_spent_paise"] == 777
    assert bob_summary["insight"]["biggest_categories"] == [
        {"category_id": 11, "category": "Bills", "icon": "bills"}
    ]
    assert bob_summary["insight"]["difference_paise"] is None
    assert alice.get("/api/months").json() == ["2026-10", "2026-09"]
    assert bob.get("/api/months").json() == ["2026-10"]
    assert [e["amount_paise"] for e in alice.get("/api/expenses").json()] == [1250, 4000]


def test_adding_as_one_account_changes_nothing_for_the_other(alice, bob):
    before = everything(alice)

    bob.post("/api/expenses", json=make_expense(amount_paise=50, category="Food"))
    bob.post("/api/categories", json={"name": "Garden"})
    bob.put(f"/api/categories/{id_of(bob, 'Food')}/limit", json={"limit_paise": 100})

    assert everything(alice) == before


# --- Guessing another account's ids ---------------------------------------------


def test_editing_another_accounts_expense_is_not_found(alice, bob):
    before = everything(alice)
    stolen = alice_expense_id(alice)

    response = bob.put(f"/api/expenses/{stolen}", json=make_expense(amount_paise=1, category="Food"))

    assert response.status_code == 404
    assert response.json() == EXPENSE_NOT_FOUND
    missing = bob.put(f"/api/expenses/{MISSING_ID}", json=make_expense(amount_paise=1, category="Food"))
    assert (missing.status_code, missing.json()) == (404, EXPENSE_NOT_FOUND)
    assert everything(alice) == before
    assert bob.get("/api/expenses").json() == []


def test_editing_another_accounts_expense_with_bad_values_is_still_not_found(alice, bob):
    # "Not found" comes before checking the values, as for a missing id.
    response = bob.put(f"/api/expenses/{alice_expense_id(alice)}", json=make_expense(amount_paise=0))

    assert response.json() == EXPENSE_NOT_FOUND


def test_deleting_another_accounts_expense_is_not_found(alice, bob):
    before = everything(alice)

    response = bob.delete(f"/api/expenses/{alice_expense_id(alice)}")

    assert response.status_code == 404
    assert response.json() == EXPENSE_NOT_FOUND
    assert everything(alice) == before


@pytest.mark.parametrize("name", ["Food", "Pets"])
def test_changing_another_accounts_category_is_not_found(alice, bob, name):
    before = everything(alice)
    stolen = id_of(alice, name)

    attempts = [
        bob.put(f"/api/categories/{stolen}", json={"name": "Mine now"}),
        bob.delete(f"/api/categories/{stolen}"),
        bob.put(f"/api/categories/{stolen}/limit", json={"limit_paise": 1}),
    ]

    for response in attempts:
        assert response.status_code == 404
        assert response.json() == CATEGORY_NOT_FOUND
    assert everything(alice) == before


def test_another_accounts_category_ids_look_exactly_like_missing_ones(alice, bob):
    stolen, missing = id_of(alice, "Pets"), MISSING_ID
    for method, suffix, body in [
        ("put", "", {"name": "X"}),
        ("delete", "", None),
        ("put", "/limit", {"limit_paise": 1}),
    ]:
        kwargs = {} if body is None else {"json": body}
        a = getattr(bob, method)(f"/api/categories/{stolen}{suffix}", **kwargs)
        b = getattr(bob, method)(f"/api/categories/{missing}{suffix}", **kwargs)
        assert (a.status_code, a.json()) == (b.status_code, b.json())


# --- Categories belong to one account -------------------------------------------


def test_an_expense_can_only_use_your_own_categories(alice, bob):
    # "Pets" exists, but only for Alice.
    response = bob.post("/api/expenses", json=make_expense(category="Pets"))

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "invalid_category"
    assert bob.get("/api/expenses").json() == []


def test_an_edit_can_only_move_an_expense_to_your_own_categories(alice, bob):
    mine = bob.post("/api/expenses", json=make_expense()).json()

    response = bob.put(f"/api/expenses/{mine['id']}", json=make_expense(category="Pets"))

    assert response.json()["error"]["code"] == "invalid_category"
    assert bob.get("/api/expenses").json() == [mine]


def test_category_names_are_unique_per_account(alice, bob):
    # Bob may have a "Pets" too, but not a second "Food" of his own.
    assert bob.post("/api/categories", json={"name": "pets"}).status_code == 201
    duplicate = bob.post("/api/categories", json={"name": "food"})
    assert duplicate.json()["error"]["message"] == "A category called Food already exists."
    # Renaming one of his to a name only Alice has is fine.
    assert bob.put(f"/api/categories/{id_of(bob, 'Other')}", json={"name": "Garden"}).status_code == 200
    alice.post("/api/categories", json={"name": "Garden"})
    assert "Garden" in [row["category"] for row in alice.get("/api/summary").json()["categories"]]


def test_the_20_category_limit_counts_per_account(alice, bob):
    for number in range(13):  # Alice had 7, now 20
        assert alice.post("/api/categories", json={"name": f"A{number}"}).status_code == 201
    assert alice.post("/api/categories", json={"name": "One too many"}).status_code == 422

    assert bob.post("/api/categories", json={"name": "Still fine"}).status_code == 201


def test_the_last_category_rule_counts_per_account(alice, bob):
    for name in ["Transport", "Shopping", "Bills", "Entertainment", "Other"]:
        assert bob.delete(f"/api/categories/{id_of(bob, name)}").status_code == 204

    last = bob.delete(f"/api/categories/{id_of(bob, 'Food')}")

    assert last.json()["error"]["code"] == "last_category"
    assert len(alice.get("/api/summary").json()["categories"]) == 7


def test_deleting_a_category_counts_only_your_own_expenses(alice, bob):
    # Bob's Food has no expenses, even though Alice's Food has one.
    assert bob.delete(f"/api/categories/{id_of(bob, 'Food')}").status_code == 204
    in_use = alice.delete("/api/categories/1")
    assert in_use.json()["error"]["message"] == "Can't delete Food: 1 expense uses it."
