from datetime import datetime, timezone

from fastapi.testclient import TestClient

from datasetdoctor.api.main import app

client = TestClient(app)


def test_01_create_insight():
    payload = {
        "task_id": "test_task",
        "title": "Test Title",
        "category": "Testing",
        "content": "Test content",
        "image_url": "test.png",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    response = client.post("/api/v1/insights", json=payload)

    # 1. Verify the POST was successful
    assert response.status_code == 200
    assert "saved" in response.json()["message"]

    # 2. Verify the database write immediately
    verify = client.get("/api/v1/insights/test_task")
    assert verify.status_code == 200, "Database write failed or was not committed"


def test_02_get_insight():
    # Verify the record exists and has correct data
    response = client.get("/api/v1/insights/test_task")
    assert response.status_code == 200
    data = response.json()
    assert data["task_id"] == "test_task"
