"""Input rules from specs/backend-spec.md, with the error codes and messages
from specs/api-contract-spec.md."""

import re
from datetime import date

from app import clock

# A brand-new database starts with these, in this order. After that the
# categories live in the database and can be changed.
STARTING_CATEGORIES = ("Food", "Transport", "Shopping", "Bills", "Entertainment", "Other")
NOTE_MAX_LENGTH = 100

_DATE_PATTERN = re.compile(r"\d{4}-\d{2}-\d{2}")


class ApiError(Exception):
    def __init__(self, status_code: int, code: str, message: str, field: str | None = None):
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.message = message
        self.field = field

    def to_body(self) -> dict:
        return {"error": {"code": self.code, "message": self.message, "field": self.field}}


def invalid_request() -> ApiError:
    return ApiError(422, "invalid_request", "The request could not be read. Please try again.")


def validate_paise(value, field: str, code: str, message: str) -> int:
    # type() rather than isinstance(): True/False count as ints in Python.
    if type(value) is not int or value <= 0:
        raise ApiError(422, code, message, field)
    return value


def validate_category(value, category_ids: dict[str, int]) -> int:
    """`category_ids` maps each current category name to its id. Names must
    match exactly, capitals included. Returns the category's id."""
    if not isinstance(value, str) or value not in category_ids:
        raise ApiError(422, "invalid_category", "Category must be one of your categories.", "category")
    return category_ids[value]


def validate_date(value) -> str:
    if not isinstance(value, str) or not _DATE_PATTERN.fullmatch(value):
        raise _invalid_date()
    try:
        parsed = date.fromisoformat(value)
    except ValueError:
        raise _invalid_date()
    if parsed > clock.today_in_ist():
        raise ApiError(422, "future_date", "Date cannot be in the future.", "date")
    return value


def _invalid_date() -> ApiError:
    return ApiError(
        422,
        "invalid_date",
        "Date is required and must be a real date in YYYY-MM-DD form.",
        "date",
    )


def validate_note(value) -> str:
    if value is None:
        return ""
    if not isinstance(value, str):
        raise invalid_request()
    note = value.strip()
    if len(note) > NOTE_MAX_LENGTH:
        raise ApiError(422, "note_too_long", "Note must be 100 characters or fewer.", "note")
    return note


def validate_limit(body) -> int:
    if not isinstance(body, dict):
        raise invalid_request()
    return validate_paise(
        body.get("limit_paise"),
        "limit_paise",
        "invalid_limit",
        "Limit is required and must be a whole number of paise greater than 0.",
    )


def validate_expense(body, category_ids: dict[str, int]) -> dict:
    """Checks fields in the contract's order and raises the first error found.
    The result has `category_id` in place of the category name."""
    if not isinstance(body, dict):
        raise invalid_request()
    return {
        "amount_paise": validate_paise(
            body.get("amount_paise"),
            "amount_paise",
            "invalid_amount",
            "Amount is required and must be a whole number of paise greater than 0.",
        ),
        "category_id": validate_category(body.get("category"), category_ids),
        "date": validate_date(body.get("date")),
        "note": validate_note(body.get("note")),
    }
