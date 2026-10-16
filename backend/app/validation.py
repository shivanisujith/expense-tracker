"""Input rules from specs/backend-spec.md, with the error codes and messages
from specs/api-contract-spec.md."""

import re
from datetime import date

from app import clock

# Each new account starts with these, in this order, with these icons.
# After that the categories live in the database and can be changed.
STARTING_CATEGORIES = ("Food", "Transport", "Shopping", "Bills", "Entertainment", "Other")
STARTING_ICONS = ("food", "transport", "shopping", "bills", "entertainment", "other")
DEFAULT_ICON = "tag"
PASSWORD_MIN_LENGTH = 8
PASSWORD_MAX_LENGTH = 64
NOTE_MAX_LENGTH = 100
CATEGORY_NAME_MAX_LENGTH = 30
MAX_CATEGORIES = 20
# Rs 10,00,00,000.00. Keeps every total exact, in SQLite and in the browser.
MAX_PAISE = 10_000_000_000

_DATE_PATTERN = re.compile(r"\d{4}-\d{2}-\d{2}")
_MONTH_PATTERN = re.compile(r"[0-9]{4}-(0[1-9]|1[0-2])")
_USERNAME_PATTERN = re.compile(r"[A-Za-z0-9_]{3,20}")


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


def validate_paise(value, field: str, code: str, message: str, too_large: tuple[str, str]) -> int:
    """`too_large` is the (code, message) for a value above MAX_PAISE."""
    # type() rather than isinstance(): True/False count as ints in Python.
    if type(value) is not int or value <= 0:
        raise ApiError(422, code, message, field)
    if value > MAX_PAISE:
        raise ApiError(422, *too_large, field)
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


def validate_month(value) -> str:
    """A month as YYYY-MM (rule 22 in specs/backend-spec.md)."""
    if not isinstance(value, str) or not _MONTH_PATTERN.fullmatch(value):
        raise ApiError(422, "invalid_month", "Month must be a real month in YYYY-MM form.", "month")
    return value


def validate_past_or_current_month(value) -> str:
    """A month as YYYY-MM that is not after the current month in IST (rule 23)."""
    month = validate_month(value)
    if month > clock.today_in_ist().strftime("%Y-%m"):
        raise ApiError(422, "future_month", "Month cannot be in the future.", "month")
    return month


def validate_limit(body) -> int:
    if not isinstance(body, dict):
        raise invalid_request()
    return validate_paise(
        body.get("limit_paise"),
        "limit_paise",
        "invalid_limit",
        "Limit is required and must be a whole number of paise greater than 0.",
        ("limit_too_large", "Limit is too large."),
    )


def validate_category_name(body, categories, own_id: int | None = None) -> str:
    """Checks a name for adding (own_id None) or renaming category own_id.
    `categories` is every current category as (id, name). Returns the
    trimmed name. Rules 12-14 in specs/backend-spec.md."""
    if not isinstance(body, dict):
        raise invalid_request()
    value = body.get("name")
    if not isinstance(value, str) or not value.strip():
        raise ApiError(422, "category_name_missing", "Please enter a category name.", "name")
    name = value.strip()
    if len(name) > CATEGORY_NAME_MAX_LENGTH:
        raise ApiError(
            422, "category_name_too_long", "Category name must be 30 characters or fewer.", "name"
        )
    for category_id, other_name in categories:
        # casefold() is lower() that also handles letters beyond English.
        if category_id != own_id and other_name.casefold() == name.casefold():
            raise ApiError(
                422, "duplicate_category", f"A category called {other_name} already exists.", "name"
            )
    return name


def read_login_details(body) -> tuple[str, str]:
    """The username with spaces at the ends removed, and the password
    exactly as typed. Missing or non-text is invalid_request (rules A6, A8)."""
    if not isinstance(body, dict):
        raise invalid_request()
    username, password = body.get("username"), body.get("password")
    if not isinstance(username, str) or not isinstance(password, str):
        raise invalid_request()
    return username.strip(), password


def validate_new_username(username: str) -> str:
    """Rule A1. Returns the username in lowercase, as it is saved."""
    # Checked before lowercasing, so only a to z, 0 to 9 and _ get through.
    if not _USERNAME_PATTERN.fullmatch(username):
        raise ApiError(
            422,
            "invalid_username",
            "Username must be 3 to 20 characters, using only letters, numbers and underscores.",
            "username",
        )
    return username.lower()


def validate_new_password(password: str, username: str) -> None:
    """Rules A3 and A4, in that order."""
    if len(password) < PASSWORD_MIN_LENGTH:
        raise ApiError(422, "password_too_short", "Password must be at least 8 characters.", "password")
    if len(password) > PASSWORD_MAX_LENGTH:
        raise ApiError(422, "password_too_long", "Password must be 64 characters or fewer.", "password")
    if password.casefold() == username.casefold():
        raise ApiError(
            422, "password_same_as_username", "Password can't be the same as your username.", "password"
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
            ("amount_too_large", "Amount is too large."),
        ),
        "category_id": validate_category(body.get("category"), category_ids),
        "date": validate_date(body.get("date")),
        "note": validate_note(body.get("note")),
    }
