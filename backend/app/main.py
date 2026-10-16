import logging
import os
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Any

from fastapi import Body, Depends, FastAPI, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app import accounts, clock, db
from app.validation import (
    DEFAULT_ICON,
    MAX_CATEGORIES,
    ApiError,
    invalid_request,
    read_login_details,
    validate_category_name,
    validate_expense,
    validate_limit,
    validate_month,
    validate_new_password,
    validate_new_username,
    validate_past_or_current_month,
)

logger = logging.getLogger(__name__)

EXPENSE_EXAMPLE = {"amount_paise": 1250, "category": "Food", "date": "2026-10-07", "note": "Lunch"}
LIMIT_EXAMPLE = {"limit_paise": 500000}
CATEGORY_EXAMPLE = {"name": "Pets"}
ACCOUNT_EXAMPLE = {"username": "shivani", "password": "a long password"}


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


# Sign up and log in start a session; log out works with or without one.
# Every other /api address needs a valid session.
OPEN_ADDRESSES = {"/api/auth/signup", "/api/auth/login", "/api/auth/logout"}


# Session rules S1-S5: checked before anything else about the request, even
# before its body is read, so a request without a session learns and changes
# nothing. Added first, so it sits inside the error handler and CORS below.
@app.middleware("http")
async def require_session(request: Request, call_next):
    path = request.url.path
    if path.startswith("/api/") and path not in OPEN_ADDRESSES:
        try:
            request.state.user_id = accounts.logged_in_user(request.headers.get("Authorization"))
        except ApiError as error:
            return JSONResponse(status_code=error.status_code, content=error.to_body())
    return await call_next(request)


def current_user(request: Request) -> int:
    """The logged-in account's id, found by require_session."""
    return request.state.user_id


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
    allow_headers=["Content-Type", "Authorization"],
)


@app.post("/api/auth/signup", status_code=201)
def sign_up(body: Any = Body(None, examples=[ACCOUNT_EXAMPLE])):
    username, password = read_login_details(body)
    username = validate_new_username(username)
    conn = db.connect()
    try:
        if conn.execute("SELECT 1 FROM users WHERE username = ?", (username,)).fetchone():
            raise ApiError(422, "username_taken", "That username is already taken.", "username")
        validate_new_password(password, username)
        password_hash = accounts.hash_password(password)
        # Rule A7: the account, its categories, and its session together.
        with conn.transaction():
            user_id = conn.execute(
                "INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, ?) RETURNING id",
                (username, password_hash, clock.now_utc().strftime(accounts.TIME_FORMAT)),
            ).fetchone()["id"]
            # Old data from before accounts goes to the first account.
            claimed = conn.execute("UPDATE categories SET user_id = ? WHERE user_id IS NULL", (user_id,))
            if claimed.rowcount == 0:
                db.add_starting_categories(conn, user_id)
            token, expires_at = accounts.start_session(conn, user_id)
    finally:
        conn.close()
    return {"username": username, "token": token, "expires_at": expires_at}


@app.post("/api/auth/login")
def log_in(body: Any = Body(None, examples=[ACCOUNT_EXAMPLE])):
    username, password = read_login_details(body)
    conn = db.connect()
    try:
        user = conn.execute(
            "SELECT id, username, password_hash FROM users WHERE username = ?", (username.lower(),)
        ).fetchone()
        # The same answer for a wrong username as for a wrong password.
        if user is None or not accounts.password_matches(user["password_hash"], password):
            raise accounts.wrong_login()
        with conn.transaction():
            token, expires_at = accounts.start_session(conn, user["id"])
    finally:
        conn.close()
    return {"username": user["username"], "token": token, "expires_at": expires_at}


@app.post("/api/auth/logout", status_code=204)
def log_out(request: Request):
    accounts.end_session(request.headers.get("Authorization"))
    return Response(status_code=204)


@app.get("/api/auth/me")
def who_is_logged_in(user_id: int = Depends(current_user)):
    conn = db.connect()
    try:
        user = conn.execute("SELECT username FROM users WHERE id = ?", (user_id,)).fetchone()
    finally:
        conn.close()
    return {"username": user["username"]}


def expense_to_dict(row) -> dict:
    return {
        "id": row["id"],
        "amount_paise": row["amount_paise"],
        "category": row["category"],
        "category_id": row["category_id"],
        "icon": row["icon"],
        "date": row["date"],
        "note": row["note"],
    }


# An expense belongs to the account that owns its category (ownership rules
# O1-O3). Every query below is limited to one account with this; its first
# value is the account's id.
OWN_EXPENSES = " FROM expenses e JOIN categories c ON c.id = e.category_id WHERE c.user_id = ?"

# Expenses store a category id; responses show the category's current name.
EXPENSE_WITH_CATEGORY_NAME = (
    "SELECT e.id, e.amount_paise, c.name AS category, e.category_id, c.icon, e.date, e.note" + OWN_EXPENSES
)


def fetch_expense(conn, user_id: int, expense_id: int):
    return conn.execute(EXPENSE_WITH_CATEGORY_NAME + " AND e.id = ?", (user_id, expense_id)).fetchone()


@app.get("/api/expenses")
def list_expenses(month: str | None = None, user_id: int = Depends(current_user)):
    # Without a month, every expense; with one, only those dated in it.
    where, params = "", (user_id,)
    if month is not None:
        where, params = " AND substr(e.date, 1, 7) = ?", (user_id, validate_month(month))
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
def add_expense(body: Any = Body(None, examples=[EXPENSE_EXAMPLE]), user_id: int = Depends(current_user)):
    conn = db.connect()
    try:
        expense = validate_expense(body, db.category_ids(conn, user_id))
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
        row = fetch_expense(conn, user_id, new_id)
    finally:
        conn.close()
    return expense_to_dict(row)


def expense_not_found() -> ApiError:
    return ApiError(404, "expense_not_found", "This expense no longer exists.")


@app.put("/api/expenses/{expense_id}")
def edit_expense(
    expense_id: int,
    body: Any = Body(None, examples=[EXPENSE_EXAMPLE]),
    user_id: int = Depends(current_user),
):
    conn = db.connect()
    try:
        # A missing expense, or another account's, is reported before any
        # problem with the new values.
        if conn.execute("SELECT 1" + OWN_EXPENSES + " AND e.id = ?", (user_id, expense_id)).fetchone() is None:
            raise expense_not_found()
        expense = validate_expense(body, db.category_ids(conn, user_id))
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
        row = fetch_expense(conn, user_id, expense_id)
    finally:
        conn.close()
    return expense_to_dict(row)


@app.delete("/api/expenses/{expense_id}", status_code=204)
def delete_expense(expense_id: int, user_id: int = Depends(current_user)):
    conn = db.connect()
    try:
        with conn.transaction():
            cursor = conn.execute(
                "DELETE FROM expenses WHERE id = ?"
                " AND category_id IN (SELECT id FROM categories WHERE user_id = ?)",
                (expense_id, user_id),
            )
    finally:
        conn.close()
    if cursor.rowcount == 0:
        raise expense_not_found()
    return Response(status_code=204)


def is_over_limit(spent_paise: int, limit_paise: int | None) -> bool:
    # Spending exactly the limit is not over.
    return limit_paise is not None and spent_paise > limit_paise


def month_total(conn, user_id: int, month: str) -> int:
    """Everything spent in a month, by expense date, whatever the category."""
    return conn.execute(
        "SELECT CAST(COALESCE(SUM(e.amount_paise), 0) AS BIGINT)" + OWN_EXPENSES + " AND substr(e.date, 1, 7) = ?",
        (user_id, month),
    ).fetchone()[0]


def previous_month(month: str) -> str:
    """The month before a YYYY-MM month: "2026-01" -> "2025-12"."""
    year, number = int(month[:4]), int(month[5:])
    return f"{year - 1}-12" if number == 1 else f"{year:04d}-{number - 1:02d}"


def month_insight(conn, user_id: int, month: str) -> dict:
    """How a month compares with the month before, and where most went
    (backend-spec "Insight for a month"). Everything is by expense date."""
    before = previous_month(month)
    before_has_expenses = conn.execute(
        "SELECT COUNT(*)" + OWN_EXPENSES + " AND substr(e.date, 1, 7) = ?", (user_id, before)
    ).fetchone()[0] > 0
    difference = (
        month_total(conn, user_id, month) - month_total(conn, user_id, before) if before_has_expenses else None
    )

    spent_rows = conn.execute(
        "SELECT c.id, c.name, c.icon, CAST(SUM(e.amount_paise) AS BIGINT) AS spent" + OWN_EXPENSES
        + " AND substr(e.date, 1, 7) = ? GROUP BY c.id, c.name, c.icon ORDER BY c.id",
        (user_id, month),
    ).fetchall()
    most = max((row["spent"] for row in spent_rows), default=None)
    biggest = [
        {"category_id": row["id"], "category": row["name"], "icon": row["icon"]}
        for row in spent_rows
        if row["spent"] == most
    ]
    return {"previous_month": before, "difference_paise": difference, "biggest_categories": biggest}


@app.get("/api/months")
def list_months(user_id: int = Depends(current_user)):
    conn = db.connect()
    try:
        rows = conn.execute(
            "SELECT DISTINCT substr(e.date, 1, 7) AS month" + OWN_EXPENSES + " ORDER BY month DESC",
            (user_id,),
        ).fetchall()
    finally:
        conn.close()
    return [row["month"] for row in rows]


@app.get("/api/months/{month}/total")
def get_month_total(month: str, user_id: int = Depends(current_user)):
    month = validate_past_or_current_month(month)
    conn = db.connect()
    try:
        total_spent = month_total(conn, user_id, month)
        insight = month_insight(conn, user_id, month)
    finally:
        conn.close()
    return {"month": month, "total_spent_paise": total_spent, "insight": insight}


@app.get("/api/summary")
def get_summary(user_id: int = Depends(current_user)):
    month = clock.today_in_ist().strftime("%Y-%m")
    conn = db.connect()
    try:
        category_rows = conn.execute(
            "SELECT id, name, icon FROM categories WHERE user_id = ? ORDER BY id", (user_id,)
        ).fetchall()
        spent_rows = conn.execute(
            "SELECT e.category_id, CAST(SUM(e.amount_paise) AS BIGINT) AS spent" + OWN_EXPENSES
            + " AND substr(e.date, 1, 7) = ? GROUP BY e.category_id",
            (user_id, month),
        ).fetchall()
        limit_rows = conn.execute(
            "SELECT l.category_id, l.limit_paise FROM category_limits l"
            " JOIN categories c ON c.id = l.category_id WHERE c.user_id = ?",
            (user_id,),
        ).fetchall()
        total_spent = month_total(conn, user_id, month)
        insight = month_insight(conn, user_id, month)
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
                "icon": category["icon"],
                "spent_paise": spent,
                "limit_paise": limit,
                "remaining_paise": None if limit is None else limit - spent,
                "over_limit": is_over_limit(spent, limit),
            }
        )
    return {
        "month": month,
        "total_spent_paise": total_spent,
        "insight": insight,
        "categories": categories,
    }


def category_not_found() -> ApiError:
    return ApiError(404, "category_not_found", "This category no longer exists.")


def fetch_category(conn, user_id: int, category_id: int):
    """None for a missing category, and for another account's (rule O2)."""
    return conn.execute(
        "SELECT id, name, icon FROM categories WHERE id = ? AND user_id = ?", (category_id, user_id)
    ).fetchone()


@app.put("/api/categories/{category_id}/limit")
def set_limit(
    category_id: int,
    body: Any = Body(None, examples=[LIMIT_EXAMPLE]),
    user_id: int = Depends(current_user),
):
    conn = db.connect()
    try:
        # A missing category is reported before any problem with the limit.
        category = fetch_category(conn, user_id, category_id)
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


def all_categories(conn, user_id: int) -> list[tuple[int, str]]:
    """The account's own categories (rule O4)."""
    rows = conn.execute("SELECT id, name FROM categories WHERE user_id = ?", (user_id,))
    return [(row["id"], row["name"]) for row in rows]


@app.post("/api/categories", status_code=201)
def add_category(body: Any = Body(None, examples=[CATEGORY_EXAMPLE]), user_id: int = Depends(current_user)):
    conn = db.connect()
    try:
        categories = all_categories(conn, user_id)
        name = validate_category_name(body, categories)
        if len(categories) >= MAX_CATEGORIES:
            raise ApiError(422, "too_many_categories", "You can have at most 20 categories.")
        with conn.transaction():
            new_id = conn.execute(
                "INSERT INTO categories (user_id, name, icon) VALUES (?, ?, ?) RETURNING id",
                (user_id, name, DEFAULT_ICON),
            ).fetchone()["id"]
    finally:
        conn.close()
    return {"id": new_id, "name": name, "icon": DEFAULT_ICON}


@app.put("/api/categories/{category_id}")
def rename_category(
    category_id: int,
    body: Any = Body(None, examples=[CATEGORY_EXAMPLE]),
    user_id: int = Depends(current_user),
):
    conn = db.connect()
    try:
        category = fetch_category(conn, user_id, category_id)
        if category is None:
            raise category_not_found()
        name = validate_category_name(body, all_categories(conn, user_id), own_id=category_id)
        # Expenses and the limit point to the id, so they stay with the category.
        with conn.transaction():
            conn.execute("UPDATE categories SET name = ? WHERE id = ?", (name, category_id))
    finally:
        conn.close()
    return {"id": category_id, "name": name, "icon": category["icon"]}


def category_in_use(name: str, expense_count: int) -> ApiError:
    uses = "1 expense uses" if expense_count == 1 else f"{expense_count} expenses use"
    return ApiError(422, "category_in_use", f"Can't delete {name}: {uses} it.")


@app.delete("/api/categories/{category_id}", status_code=204)
def delete_category(category_id: int, user_id: int = Depends(current_user)):
    conn = db.connect()
    try:
        category = fetch_category(conn, user_id, category_id)
        if category is None:
            raise category_not_found()
        if conn.execute("SELECT COUNT(*) FROM categories WHERE user_id = ?", (user_id,)).fetchone()[0] == 1:
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
