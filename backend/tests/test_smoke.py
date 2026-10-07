from fastapi.testclient import TestClient

from app.main import app


def test_app_starts():
    client = TestClient(app)
    response = client.get("/docs")
    assert response.status_code == 200
