import logging
import os
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Any

from fastapi import Body, FastAPI, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app import clock, db
from app.validation import (
    MAX_CATEGORIES,
    ApiError,
    invalid_request,
    validate_category_name,
    validate_expense,
    validate_limit,
    validate_month,
    validate_past_or_current_month,
)

logger = logging.getLogger(__name__)

EXPENSE_EXAMPLE = {"amount_paise": 1250, "category": "Food", "date": "2026-10-07", "note": "Lunch"}
LIMIT_EXAMPLE = {"limit_paise": 500000}
CATEGORY_EXAMPLE = {"name": "Pets"}


@asynccontextmanager
async def lifespan(app: FastAPI):
    db.init_db()
    yield


app = FastAPI(title="Expense Tracker", lifespan=lifespan)


@app.exception_handler(ApiError)
async def handle_api_error(request: Request, exc: ApiError):
    return JSONResponse(status_code=exc.status_code, content=exc.to_body())


@app.exception_handler(RequestValidationError)
async def handle_unreadable_request(request: Request, exc: RequestValidationError):
    # Raised by FastAPI when the body is not valid JSON, or an id in
    # the address is not a whole number.
    error = invalid_request()
    return JSONResponse(status_code=error.status_code, content=error.to_body())


# Added before CORS so it sits inside it: 500 responses still carry the CORS
# headers, and the browser can tell "server error" from "can't reach server".
@app.middleware("http")
async def handle_unexpected_error(request: Request, call_next):
    try:
        return await call_next(request)
    except Exception:
        logger.exception("Unexpected error")
        error = ApiError(500, "server_error", "Something went wrong on the server. Please try again.")
        return JSONResponse(status_code=error.status_code, content=error.to_body())


def allowed_origins() -> list[str]:
    """Page addresses allowed to use the backend (CORS), from ALLOWED_ORIGINS:
    the GitHub Pages site online, the local dev server by default."""
    setting = os.environ.get("ALLOWED_ORIGINS", "http://localhost:5173")
    return [origin.strip() for origin in setting.split(",") if origin.strip()]


app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins(),
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Content-Type"],
)


def expense_to_dict(row) -> dict:
    return {
        "id": row["id"],
        "amount_paise": row["amount_paise"],
        "category": row["category"],
        "date": row["date"],
        "note": row["note"],
    }


# Expenses store a category id; responses show the category's current name.
EXPENSE_WITH_CATEGORY_NAME = (
    "SELECT e.id, e.amount_paise, c.name AS category, e.date, e.note"
    " FROM expenses e JOIN categories c ON c.id = e.category_id"
)


def fetch_expense(conn, expense_id: int):
    return conn.execute(EXPENSE_WITH_CATEGORY_NAME + " WHERE e.id = ?", (expense_id,)).fetchone()


@app.get("/api/expenses")
def list_expenses(month: str | None = None):
    # Without a month, every expense; with one, only those dated in it.
    where, params = "", ()
    if month is not None:
        where, params = " WHERE substr(e.date, 1, 7) = ?", (validate_month(month),)
    conn = db.connect()
    try:
        rows = conn.execute(
            EXPENSE_WITH_CATEGORY_NAME + where + " ORDER BY e.date DESC, e.created_at DESC, e.id DESC",
            params,
        ).fetchall()
    finally:
        conn.close()
    return [expense_to_dict(row) for row in rows]


@app.post("/api/expenses", status_code=201)
def add_expense(body: Any = Body(None, examples=[EXPENSE_EXAMPLE])):
    conn = db.connect()
    try:
        expense = validate_expense(body, db.category_ids(conn))
        with conn.transaction():
            new_id = conn.execute(
                "INSERT INTO expenses (amount_paise, category_id, date, note, created_at)"
                " VALUES (?, ?, ?, ?, ?) RETURNING id",
                (
                    expense["amount_paise"],
                    expense["category_id"],
                    expense["date"],
                    expense["note"],
                    datetime.now(timezone.utc).isoformat(),
                ),
            ).fetchone()["id"]
        row = fetch_expense(conn, new_id)
    finally:
        conn.close()
    return expense_to_dict(row)


def expense_not_found() -> ApiError:
    return ApiError(404, "expense_not_found", "This expense no longer exists.")


@app.put("/api/expenses/{expense_id}")
def edit_expense(expense_id: int, body: Any = Body(None, examples=[EXPENSE_EXAMPLE])):
    conn = db.connect()
    try:
        # A missing expense is reported before any problem with the new values.
        if conn.execute("SELECT 1 FROM expenses WHERE id = ?", (expense_id,)).fetchone() is None:
            raise expense_not_found()
        expense = validate_expense(body, db.category_ids(conn))
        with conn.transaction():
            conn.execute(
                "UPDATE expenses SET amount_paise = ?, category_id = ?, date = ?, note = ?"
                " WHERE id = ?",
                (
                    expense["amount_paise"],
                    expense["category_id"],
                    expense["date"],
                    expense["note"],
                    expense_id,
                ),
            )
        row = fetch_expense(conn, expense_id)
    finally:
        conn.close()
    return expense_to_dict(row)


@app.delete("/api/expenses/{expense_id}", status_code=204)
def delete_expense(expense_id: int):
    conn = db.connect()
    try:
        with conn.transaction():
            cursor = conn.execute("DELETE FROM expenses WHERE id = ?", (expense_id,))
    finally:
        conn.close()
    if cursor.rowcount == 0:
        raise expense_not_found()
    return Response(status_code=204)


def is_over_limit(spent_paise: int, limit_paise: int | None) -> bool:
    # Spending exactly the limit is not over.
    return limit_paise is not None and spent_paise > limit_paise


def month_total(conn, month: str) -> int:
    """Everything spent in a month, by expense date, whatever the category."""
    return conn.execute(
        "SELECT CAST(COALESCE(SUM(amount_paise), 0) AS BIGINT) FROM expenses"
        " WHERE substr(date, 1, 7) = ?",
        (month,),
    ).fetchone()[0]


@app.get("/api/months")
def list_months():
    conn = db.connect()
    try:
        rows = conn.execute(
            "SELECT DISTINCT substr(date, 1, 7) AS month FROM expenses ORDER BY month DESC"
        ).fetchall()
    finally:
        conn.close()
    return [row["month"] for row in rows]


@app.get("/api/months/{month}/total")
def get_month_total(month: str):
    month = validate_past_or_current_month(month)
    conn = db.connect()
    try:
        total_spent = month_total(conn, month)
    finally:
        conn.close()
    return {"month": month, "total_spent_paise": total_spent}


@app.get("/api/summary")
def get_summary():
    month = clock.today_in_ist().strftime("%Y-%m")
    conn = db.connect()
    try:
        category_rows = conn.execute("SELECT id, name FROM categories ORDER BY id").fetchall()
        spent_rows = conn.execute(
            "SELECT category_id, CAST(SUM(amount_paise) AS BIGINT) AS spent FROM expenses"
            " WHERE substr(date, 1, 7) = ? GROUP BY category_id",
            (month,),
        ).fetchall()
        limit_rows = conn.execute("SELECT category_id, limit_paise FROM category_limits").fetchall()
        total_spent = month_total(conn, month)
    finally:
        conn.close()

    spent_by_category = {row["category_id"]: row["spent"] for row in spent_rows}
    limit_by_category = {row["category_id"]: row["limit_paise"] for row in limit_rows}

    categories = []
    for category in category_rows:
        spent = spent_by_category.get(category["id"], 0)
        limit = limit_by_category.get(category["id"])
        categories.append(
            {
                "category_id": category["id"],
                "category": category["name"],
                "spent_paise": spent,
                "limit_paise": limit,
                "remaining_paise": None if limit is None else limit - spent,
                "over_limit": is_over_limit(spent, limit),
            }
        )
    return {"month": month, "total_spent_paise": total_spent, "categories": categories}


def category_not_found() -> ApiError:
    return ApiError(404, "category_not_found", "This category no longer exists.")


def fetch_category(conn, category_id: int):
    return conn.execute("SELECT id, name FROM categories WHERE id = ?", (category_id,)).fetchone()


@app.put("/api/categories/{category_id}/limit")
def set_limit(category_id: int, body: Any = Body(None, examples=[LIMIT_EXAMPLE])):
    conn = db.connect()
    try:
        # A missing category is reported before any problem with the limit.
        category = fetch_category(conn, category_id)
        if category is None:
            raise category_not_found()
        limit_paise = validate_limit(body)
        with conn.transaction():
            conn.execute(
                "INSERT INTO category_limits (category_id, limit_paise) VALUES (?, ?)"
                " ON CONFLICT (category_id) DO UPDATE SET limit_paise = excluded.limit_paise",
                (category_id, limit_paise),
            )
    finally:
        conn.close()
    return {"category_id": category_id, "category": category["name"], "limit_paise": limit_paise}


def all_categories(conn) -> list[tuple[int, str]]:
    return [(row["id"], row["name"]) for row in conn.execute("SELECT id, name FROM categories")]


@app.post("/api/categories", status_code=201)
def add_category(body: Any = Body(None, examples=[CATEGORY_EXAMPLE])):
    conn = db.connect()
    try:
        categories = all_categories(conn)
        name = validate_category_name(body, categories)
        if len(categories) >= MAX_CATEGORIES:
            raise ApiError(422, "too_many_categories", "You can have at most 20 categories.")
        with conn.transaction():
            new_id = conn.execute(
                "INSERT INTO categories (name) VALUES (?) RETURNING id", (name,)
            ).fetchone()["id"]
    finally:
        conn.close()
    return {"id": new_id, "name": name}


@app.put("/api/categories/{category_id}")
def rename_category(category_id: int, body: Any = Body(None, examples=[CATEGORY_EXAMPLE])):
    conn = db.connect()
    try:
        if fetch_category(conn, category_id) is None:
            raise category_not_found()
        name = validate_category_name(body, all_categories(conn), own_id=category_id)
        # Expenses and the limit point to the id, so they stay with the category.
        with conn.transaction():
            conn.execute("UPDATE categories SET name = ? WHERE id = ?", (name, category_id))
    finally:
        conn.close()
    return {"id": category_id, "name": name}


def category_in_use(name: str, expense_count: int) -> ApiError:
    uses = "1 expense uses" if expense_count == 1 else f"{expense_count} expenses use"
    return ApiError(422, "category_in_use", f"Can't delete {name}: {uses} it.")


@app.delete("/api/categories/{category_id}", status_code=204)
def delete_category(category_id: int):
    conn = db.connect()
    try:
        category = fetch_category(conn, category_id)
        if category is None:
            raise category_not_found()
        if conn.execute("SELECT COUNT(*) FROM categories").fetchone()[0] == 1:
            raise ApiError(422, "last_category", "You must keep at least one category.")
        expense_count = conn.execute(
            "SELECT COUNT(*) FROM expenses WHERE category_id = ?", (category_id,)
        ).fetchone()[0]
        if expense_count > 0:
            raise category_in_use(category["name"], expense_count)
        with conn.transaction():
            conn.execute("DELETE FROM category_limits WHERE category_id = ?", (category_id,))
            conn.execute("DELETE FROM categories WHERE id = ?", (category_id,))
    finally:
        conn.close()
    return Response(status_code=204)
