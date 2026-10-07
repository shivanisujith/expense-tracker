import logging
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Any

from fastapi import Body, FastAPI, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app import clock, db
from app.validation import (
    CATEGORIES,
    ApiError,
    invalid_request,
    validate_category,
    validate_expense,
    validate_limit,
)

logger = logging.getLogger(__name__)

EXPENSE_EXAMPLE = {"amount_paise": 1250, "category": "Food", "date": "2026-10-07", "note": "Lunch"}
LIMIT_EXAMPLE = {"limit_paise": 500000}


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
    # Raised by FastAPI when the body is not valid JSON, or an expense id in
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


app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
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


@app.get("/api/expenses")
def list_expenses():
    conn = db.connect()
    try:
        rows = conn.execute(
            "SELECT * FROM expenses ORDER BY date DESC, created_at DESC, id DESC"
        ).fetchall()
    finally:
        conn.close()
    return [expense_to_dict(row) for row in rows]


@app.post("/api/expenses", status_code=201)
def add_expense(body: Any = Body(None, examples=[EXPENSE_EXAMPLE])):
    expense = validate_expense(body)
    conn = db.connect()
    try:
        with conn:
            cursor = conn.execute(
                "INSERT INTO expenses (amount_paise, category, date, note, created_at)"
                " VALUES (?, ?, ?, ?, ?)",
                (
                    expense["amount_paise"],
                    expense["category"],
                    expense["date"],
                    expense["note"],
                    datetime.now(timezone.utc).isoformat(),
                ),
            )
        row = conn.execute("SELECT * FROM expenses WHERE id = ?", (cursor.lastrowid,)).fetchone()
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
        expense = validate_expense(body)
        with conn:
            conn.execute(
                "UPDATE expenses SET amount_paise = ?, category = ?, date = ?, note = ?"
                " WHERE id = ?",
                (
                    expense["amount_paise"],
                    expense["category"],
                    expense["date"],
                    expense["note"],
                    expense_id,
                ),
            )
        row = conn.execute("SELECT * FROM expenses WHERE id = ?", (expense_id,)).fetchone()
    finally:
        conn.close()
    return expense_to_dict(row)


@app.delete("/api/expenses/{expense_id}", status_code=204)
def delete_expense(expense_id: int):
    conn = db.connect()
    try:
        with conn:
            cursor = conn.execute("DELETE FROM expenses WHERE id = ?", (expense_id,))
    finally:
        conn.close()
    if cursor.rowcount == 0:
        raise expense_not_found()
    return Response(status_code=204)


def is_over_limit(spent_paise: int, limit_paise: int | None) -> bool:
    # Spending exactly the limit is not over.
    return limit_paise is not None and spent_paise > limit_paise


@app.get("/api/summary")
def get_summary():
    month = clock.today_in_ist().strftime("%Y-%m")
    conn = db.connect()
    try:
        spent_rows = conn.execute(
            "SELECT category, SUM(amount_paise) AS spent FROM expenses"
            " WHERE substr(date, 1, 7) = ? GROUP BY category",
            (month,),
        ).fetchall()
        limit_rows = conn.execute("SELECT category, limit_paise FROM category_limits").fetchall()
    finally:
        conn.close()

    spent_by_category = {row["category"]: row["spent"] for row in spent_rows}
    limit_by_category = {row["category"]: row["limit_paise"] for row in limit_rows}

    categories = []
    for category in CATEGORIES:
        spent = spent_by_category.get(category, 0)
        limit = limit_by_category.get(category)
        categories.append(
            {
                "category": category,
                "spent_paise": spent,
                "limit_paise": limit,
                "remaining_paise": None if limit is None else limit - spent,
                "over_limit": is_over_limit(spent, limit),
            }
        )
    return {"month": month, "categories": categories}


@app.put("/api/limits/{category}")
def set_limit(category: str, body: Any = Body(None, examples=[LIMIT_EXAMPLE])):
    validate_category(category)
    limit_paise = validate_limit(body)
    conn = db.connect()
    try:
        with conn:
            conn.execute(
                "INSERT INTO category_limits (category, limit_paise) VALUES (?, ?)"
                " ON CONFLICT (category) DO UPDATE SET limit_paise = excluded.limit_paise",
                (category, limit_paise),
            )
    finally:
        conn.close()
    return {"category": category, "limit_paise": limit_paise}
