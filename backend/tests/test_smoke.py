def test_app_starts(client):
    response = client.get("/docs")
    assert response.status_code == 200
