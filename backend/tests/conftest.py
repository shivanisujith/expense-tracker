from datetime import date

import pytest
from fastapi.testclient import TestClient

from app import clock
from app.main import app

# Every test runs as if today (in IST) is this date.
TODAY = date(2026, 10, 7)


@pytest.fixture
def db_path(tmp_path, monkeypatch):
    """A fresh, empty database file for each test, never the real one."""
    path = tmp_path / "test.db"
    monkeypatch.setenv("EXPENSES_DB_PATH", str(path))
    return path


@pytest.fixture(autouse=True)
def fixed_today(monkeypatch):
    monkeypatch.setattr(clock, "today_in_ist", lambda: TODAY)


@pytest.fixture
def client(db_path):
    with TestClient(app) as test_client:
        yield test_client


def make_expense(**changes):
    """A valid expense body; pass keyword arguments to change fields."""
    body = {"amount_paise": 1250, "category": "Food", "date": "2026-10-07", "note": "Lunch"}
    body.update(changes)
    return body
