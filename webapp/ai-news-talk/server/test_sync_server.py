"""설정 동기화 서버 테스트"""

from __future__ import annotations

import importlib
import sys
from pathlib import Path

import pytest

SERVER_DIR = Path(__file__).resolve().parent
if str(SERVER_DIR) not in sys.path:
    sys.path.insert(0, str(SERVER_DIR))

from store import (  # noqa: E402
    CODE_BODY_LEN,
    InvalidCode,
    InvalidPayload,
    PayloadTooLarge,
    SyncStore,
    generate_code,
    normalize_code,
)


# ══════════════════════════════════════════════════════════════
# 코드 발급 / 정규화
# ══════════════════════════════════════════════════════════════
def test_generated_code_format():
    code = generate_code()
    assert code.startswith("DZAI-")
    parts = code.split("-")
    assert len(parts) == 4
    assert all(len(p) == 4 for p in parts[1:])
    # 혼동되는 글자는 절대 나오지 않는다
    assert not set("IO01") & set("".join(parts[1:]))


def test_generated_codes_are_unique():
    codes = {generate_code() for _ in range(500)}
    assert len(codes) == 500


@pytest.mark.parametrize(
    "raw",
    ["DZAI-ABCD-EFGH-JKLM", "dzai-abcd-efgh-jklm", "ABCDEFGHJKLM", "abcd efgh jklm"],
)
def test_normalize_accepts_user_typing(raw):
    assert normalize_code(raw) == "DZAI-ABCD-EFGH-JKLM"


@pytest.mark.parametrize("raw", ["", "DZAI-ABC", "DZAI-ABCD-EFGH-JKLMN", "DZAI-IIII-OOOO-0000", 12345])
def test_normalize_rejects_bad_codes(raw):
    with pytest.raises(InvalidCode):
        normalize_code(raw)


# ══════════════════════════════════════════════════════════════
# 저장소
# ══════════════════════════════════════════════════════════════
@pytest.fixture
def store(tmp_path):
    return SyncStore(str(tmp_path / "test.db"))


def test_create_and_get_roundtrip(store):
    rec = store.create({"daily": True, "times": ["08:30"]})
    got = store.get(rec.code)
    assert got is not None
    assert got.payload == {"daily": True, "times": ["08:30"]}
    assert got.rev == 1


def test_get_unknown_code_returns_none(store):
    assert store.get(generate_code()) is None


def test_get_accepts_unformatted_code(store):
    rec = store.create({"a": 1})
    stripped = rec.code.replace("-", "").lower()
    assert store.get(stripped).payload == {"a": 1}


def test_put_increments_rev(store):
    rec = store.create({"n": 1})
    r1 = store.put(rec.code, {"n": 2})
    assert r1 is not None and not r1.conflict
    assert r1.record.rev == 2
    r2 = store.put(rec.code, {"n": 3})
    assert r2.record.rev == 3
    assert store.get(rec.code).payload == {"n": 3}


def test_put_unknown_code_returns_none(store):
    assert store.put(generate_code(), {"n": 1}) is None


def test_put_with_matching_base_rev_succeeds(store):
    rec = store.create({"n": 1})
    result = store.put(rec.code, {"n": 2}, base_rev=1)
    assert not result.conflict
    assert result.record.rev == 2


def test_put_with_stale_base_rev_conflicts(store):
    """다른 기기가 먼저 저장했으면 덮어쓰지 않고 서버 상태를 돌려준다."""
    rec = store.create({"n": 1})
    store.put(rec.code, {"n": 2})  # 기기 B가 먼저 저장 → rev 2

    result = store.put(rec.code, {"n": 99}, base_rev=1)  # 기기 A는 아직 rev 1
    assert result.conflict is True
    assert result.record.rev == 2
    assert result.record.payload == {"n": 2}
    # 서버 값이 보존됐는지 확인 — 충돌 시 절대 덮어쓰지 않는다
    assert store.get(rec.code).payload == {"n": 2}


def test_delete(store):
    rec = store.create({"n": 1})
    assert store.delete(rec.code) is True
    assert store.get(rec.code) is None
    assert store.delete(rec.code) is False


def test_payload_must_be_object(store):
    with pytest.raises(InvalidPayload):
        store.create(["not", "an", "object"])
    rec = store.create({})
    with pytest.raises(InvalidPayload):
        store.put(rec.code, "문자열")


def test_payload_size_limit(store):
    rec = store.create({})
    with pytest.raises(PayloadTooLarge):
        store.put(rec.code, {"blob": "가" * 70000})


def test_unicode_payload_roundtrip(store):
    payload = {"메모": "한글 설정 ✅", "emoji": "🌿"}
    rec = store.create(payload)
    assert store.get(rec.code).payload == payload


def test_purge_stale(store):
    store.create({"n": 1})
    assert store.purge_stale(days=30) == 0  # 방금 만든 건 남는다
    assert store.purge_stale(days=-1) == 1  # 미래 기준이면 전부 정리
    assert store.count() == 0


def test_data_survives_reopen(tmp_path):
    """프로세스를 다시 띄워도 데이터가 남아야 한다."""
    db = str(tmp_path / "persist.db")
    code = SyncStore(db).create({"n": 42}).code
    assert SyncStore(db).get(code).payload == {"n": 42}


# ══════════════════════════════════════════════════════════════
# HTTP API
# ══════════════════════════════════════════════════════════════
fastapi_testclient = pytest.importorskip(
    "fastapi.testclient", reason="fastapi가 설치되지 않아 API 테스트를 건너뜁니다."
)


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("DZAI_SYNC_DB", str(tmp_path / "api.db"))
    monkeypatch.setenv("DZAI_SYNC_RPM", "10000")
    sys.modules.pop("app", None)
    app_module = importlib.import_module("app")
    importlib.reload(app_module)
    with fastapi_testclient.TestClient(app_module.app) as c:
        c.app_module = app_module
        yield c


def test_health(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json()["ok"] is True


def test_api_create_returns_code(client):
    r = client.post("/api/sync", json={"settings": {"daily": True}})
    assert r.status_code == 201
    body = r.json()
    assert body["code"].startswith("DZAI-")
    assert body["rev"] == 1
    assert body["settings"] == {"daily": True}


def test_api_create_without_settings(client):
    r = client.post("/api/sync", json={})
    assert r.status_code == 201
    assert r.json()["settings"] == {}


def test_api_get_roundtrip(client):
    code = client.post("/api/sync", json={"settings": {"n": 1}}).json()["code"]
    r = client.get(f"/api/sync/{code}")
    assert r.status_code == 200
    assert r.json()["settings"] == {"n": 1}


def test_api_get_unknown_is_404(client):
    r = client.get(f"/api/sync/{generate_code()}")
    assert r.status_code == 404


def test_api_get_malformed_code_is_422(client):
    r = client.get("/api/sync/NOT-A-CODE")
    assert r.status_code == 422


def test_api_put_updates(client):
    code = client.post("/api/sync", json={"settings": {"n": 1}}).json()["code"]
    r = client.put(f"/api/sync/{code}", json={"settings": {"n": 2}, "baseRev": 1})
    assert r.status_code == 200
    assert r.json()["rev"] == 2
    assert client.get(f"/api/sync/{code}").json()["settings"] == {"n": 2}


def test_api_put_conflict_returns_server_state(client):
    """두 기기가 같은 rev에서 출발해 동시에 저장하면 뒤쪽이 409를 받는다."""
    code = client.post("/api/sync", json={"settings": {"n": 1}}).json()["code"]
    client.put(f"/api/sync/{code}", json={"settings": {"n": 2}, "baseRev": 1})

    r = client.put(f"/api/sync/{code}", json={"settings": {"n": 99}, "baseRev": 1})
    assert r.status_code == 409
    server = r.json()["detail"]["server"]
    assert server["rev"] == 2
    assert server["settings"] == {"n": 2}
    # 충돌한 쓰기는 반영되지 않아야 한다
    assert client.get(f"/api/sync/{code}").json()["settings"] == {"n": 2}


def test_api_put_without_base_rev_is_last_write_wins(client):
    code = client.post("/api/sync", json={"settings": {"n": 1}}).json()["code"]
    r = client.put(f"/api/sync/{code}", json={"settings": {"n": 7}})
    assert r.status_code == 200
    assert r.json()["settings"] == {"n": 7}


def test_api_put_unknown_is_404(client):
    r = client.put(f"/api/sync/{generate_code()}", json={"settings": {}})
    assert r.status_code == 404


def test_api_put_oversized_is_413(client):
    code = client.post("/api/sync", json={}).json()["code"]
    r = client.put(f"/api/sync/{code}", json={"settings": {"blob": "가" * 70000}})
    assert r.status_code == 413


def test_api_delete(client):
    code = client.post("/api/sync", json={"settings": {"n": 1}}).json()["code"]
    assert client.delete(f"/api/sync/{code}").status_code == 204
    assert client.get(f"/api/sync/{code}").status_code == 404
    assert client.delete(f"/api/sync/{code}").status_code == 404


def test_api_rate_limit(client):
    """무작위 대입을 늦추기 위해 IP 단위로 제한한다."""
    client.app_module.limiter.per_minute = 5
    client.app_module.limiter.reset()
    try:
        codes = [generate_code() for _ in range(8)]
        statuses = [client.get(f"/api/sync/{c}").status_code for c in codes]
        assert 429 in statuses
        assert statuses[:5] == [404] * 5
    finally:
        client.app_module.limiter.per_minute = 10000
        client.app_module.limiter.reset()
