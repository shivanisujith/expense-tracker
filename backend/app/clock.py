from datetime import date, datetime, timezone
from zoneinfo import ZoneInfo

IST = ZoneInfo("Asia/Kolkata")


def today_in_ist() -> date:
    """Today's date in India time. Tests replace this to fix "today"."""
    return datetime.now(IST).date()


def now_utc() -> datetime:
    """The current moment in UTC, for sessions. Tests replace this too."""
    return datetime.now(timezone.utc)
