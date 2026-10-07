from datetime import date, datetime
from zoneinfo import ZoneInfo

IST = ZoneInfo("Asia/Kolkata")


def today_in_ist() -> date:
    """Today's date in India time. Tests replace this to fix "today"."""
    return datetime.now(IST).date()
