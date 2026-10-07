import logging
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Any

from fastapi import Body, FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app import db
from app.validation import ApiError, invalid_request, validate_expense

logger = logging.getLogger(__name__)

EXPENSE_EXAMPLE = {"amount_paise": 1250, "category": "Food", "date": "2026-10-07", "note": "Lunch"}


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
    # Raised by FastAPI when the body is not valid JSON.
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
