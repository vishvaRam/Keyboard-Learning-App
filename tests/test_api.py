from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_index_serves_html():
    res = client.get("/")
    assert res.status_code == 200
    assert "Feel Piano" in res.text
    assert "tailwindcss.com" in res.text


def test_config_endpoint():
    res = client.get("/api/config")
    assert res.status_code == 200
    body = res.json()
    assert body["target_tolerance_ms"] == 120
    assert body["default_ghost_floor"] == 12


def test_keyboards_endpoint():
    res = client.get("/api/keyboards")
    names = [k["name"] for k in res.json()]
    assert "Yamaha PSR-E473" in names
    assert "Arturia MiniLab 3" in names


def test_progressions_listing():
    res = client.get("/api/progressions", params={"root_midi": 65})  # F
    assert res.status_code == 200
    body = res.json()
    # every family ships four options
    families = {}
    for p in body:
        families.setdefault(p["family"], []).append(p["id"])
    assert set(families) == {"pop", "nostalgic", "lofi"}
    assert all(len(ids) == 4 for ids in families.values()), families
    pop = next(p for p in body if p["id"] == "pop")
    assert [s["name"] for s in pop["steps"]] == ["F", "Dm", "A#", "C"]


def test_unknown_progression_404():
    assert client.get("/api/progressions/jazz").status_code == 404


def test_progression_midi():
    res = client.get("/api/progressions/nostalgic/midi", params={"root_midi": 60})
    chords = res.json()["chords"]
    assert chords[3] == {"roman": "iv", "notes": [65, 68, 72]}


def test_attempt_endpoint_grades():
    payload = {"step_index": 0, "notes": {"60": 90, "64": 90, "67": 90}, "ghost_notes": []}
    res = client.post("/api/progressions/pop/attempt", json=payload)
    assert res.status_code == 200
    assert res.json()["grade"] == "Perfect"


def test_session_summary_endpoint():
    res = client.post("/api/session/summary", json={"velocities": [70, 72, 68, 74], "ghosts": 0, "outliers": 0})
    assert res.status_code == 200
    assert res.json()["verdict"] == "Flat line"


def test_static_js_served():
    for name in ["audio.js", "midi.js", "keyboard-ui.js", "app.js", "roll.js", "progressions.js", "demos.js"]:
        res = client.get(f"/static/js/{name}")
        assert res.status_code == 200, name
