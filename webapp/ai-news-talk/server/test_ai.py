"""경험하기 AI 실행 엔드포인트 테스트.

실제 API 키 없이 도는 테스트다. SDK를 대역으로 갈아끼워 요청 형태와
응답 처리를 확인하고, 키가 없을 때 503으로 떨어지는지도 본다 —
클라이언트는 그 503을 신호로 로컬 계산으로 내려간다.
"""

from __future__ import annotations

import json
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

import ai
import app as app_module

GOOD = {
    "summary": ["첫 줄", "둘째 줄", "셋째 줄"],
    "biggest_change": {"what": "매출 급증", "why": "신규 계약 반영으로 추정"},
    "questions": [
        {"q": "질문1", "a": "답1"},
        {"q": "질문2", "a": "답2"},
        {"q": "질문3", "a": "답3"},
    ],
}

TABLE = "월\t매출\n1월\t1200\n2월\t1980"


def _message(payload=None, stop_reason="end_turn", stop_details=None):
    return SimpleNamespace(
        content=[SimpleNamespace(type="text", text=json.dumps(payload if payload is not None else GOOD))],
        stop_reason=stop_reason,
        stop_details=stop_details,
        model="claude-opus-5",
        usage=SimpleNamespace(input_tokens=120, output_tokens=340),
    )


class FakeClient:
    """호출 인자를 기록하는 대역. beta 경로 실패를 흉내낼 수 있다."""

    def __init__(self, message=None, beta_error=None):
        self.calls = []
        self._message = message or _message()
        self._beta_error = beta_error

        outer = self

        class _Messages:
            def create(self, **kwargs):
                outer.calls.append(("plain", kwargs))
                return outer._message

        class _BetaMessages:
            def create(self, **kwargs):
                outer.calls.append(("beta", kwargs))
                if outer._beta_error:
                    raise outer._beta_error
                return outer._message

        self.messages = _Messages()
        self.beta = SimpleNamespace(messages=_BetaMessages())


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
    monkeypatch.setattr(ai, "anthropic", SimpleNamespace(Anthropic=lambda **kw: None))
    return TestClient(app_module.app)


def _install(monkeypatch, fake):
    monkeypatch.setattr(ai, "_client", lambda: fake)


# ── 기능이 꺼져 있을 때 ────────────────────────────────────────
def test_status_reports_disabled_without_key(monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    c = TestClient(app_module.app)
    body = c.get("/api/ai/status").json()
    assert body["enabled"] is False
    assert body["reason"] in {"no_api_key", "sdk_missing"}
    assert body["model"]


def test_summarize_503_without_key(monkeypatch):
    """503이어야 클라이언트가 로컬 계산으로 떨어진다."""
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    c = TestClient(app_module.app)
    r = c.post("/api/ai/summarize", json={"table": TABLE})
    assert r.status_code == 503


def test_status_enabled_with_key(client):
    body = client.get("/api/ai/status").json()
    assert body["enabled"] is True
    assert body["model"] == ai.MODEL


# ── 정상 경로 ─────────────────────────────────────────────────
def test_summarize_returns_three_parts(client, monkeypatch):
    fake = FakeClient()
    _install(monkeypatch, fake)
    r = client.post("/api/ai/summarize", json={"table": TABLE})
    assert r.status_code == 200
    body = r.json()
    assert body["summary"] == GOOD["summary"]
    assert body["biggestChange"]["what"] == "매출 급증"
    assert len(body["questions"]) == 3
    assert body["model"] == "claude-opus-5"
    assert body["usage"]["output"] == 340


def test_request_shape(client, monkeypatch):
    """모델·구조화 출력·표 본문이 실제로 실려 나가는지."""
    fake = FakeClient()
    _install(monkeypatch, fake)
    client.post("/api/ai/summarize", json={"table": TABLE, "note": "3월 신규계약 반영"})

    kind, kwargs = fake.calls[0]
    assert kind == "beta"
    assert kwargs["model"] == ai.MODEL
    assert kwargs["output_config"]["format"]["type"] == "json_schema"
    assert kwargs["output_config"]["effort"] == ai.EFFORT
    assert kwargs["fallbacks"] == "default"
    assert "server-side-fallback-2026-07-01" in kwargs["betas"]
    sent = kwargs["messages"][0]["content"]
    assert TABLE in sent
    assert "3월 신규계약 반영" in sent
    assert "추정" in kwargs["system"]


def test_falls_back_to_plain_when_fallbacks_unsupported(client, monkeypatch):
    """fallbacks를 모르는 SDK에서도 요약은 되어야 한다."""
    fake = FakeClient(beta_error=TypeError("unexpected keyword argument 'fallbacks'"))
    _install(monkeypatch, fake)
    r = client.post("/api/ai/summarize", json={"table": TABLE})
    assert r.status_code == 200
    assert [k for k, _ in fake.calls] == ["beta", "plain"]
    assert "fallbacks" not in fake.calls[1][1]


def test_real_api_errors_are_not_swallowed(client, monkeypatch):
    """파라미터 미지원이 아닌 오류를 조용히 재시도하면 안 된다."""
    fake = FakeClient(beta_error=RuntimeError("upstream exploded"))
    _install(monkeypatch, fake)
    with pytest.raises(RuntimeError, match="upstream exploded"):
        client.post("/api/ai/summarize", json={"table": TABLE})
    assert [k for k, _ in fake.calls] == ["beta"]


# ── 거절·검증 ─────────────────────────────────────────────────
def test_refusal_becomes_502(client, monkeypatch):
    fake = FakeClient(_message(
        stop_reason="refusal",
        stop_details=SimpleNamespace(explanation="정책상 응답할 수 없습니다.", category="cyber"),
    ))
    _install(monkeypatch, fake)
    r = client.post("/api/ai/summarize", json={"table": TABLE})
    assert r.status_code == 502
    assert "정책상" in r.json()["detail"]


def test_empty_table_rejected(client, monkeypatch):
    _install(monkeypatch, FakeClient())
    assert client.post("/api/ai/summarize", json={"table": "   "}).status_code == 422


def test_oversized_table_rejected(client, monkeypatch):
    _install(monkeypatch, FakeClient())
    r = client.post("/api/ai/summarize", json={"table": "x" * (ai.MAX_TABLE_CHARS + 1)})
    assert r.status_code == 422


def test_extra_items_are_trimmed(client, monkeypatch):
    """스키마로 배열 길이를 강제할 수 없으므로 서버에서 잘라 준다."""
    payload = dict(GOOD, summary=["1", "2", "3", "4", "5"],
                   questions=GOOD["questions"] + [{"q": "q4", "a": "a4"}])
    _install(monkeypatch, FakeClient(_message(payload)))
    body = client.post("/api/ai/summarize", json={"table": TABLE}).json()
    assert len(body["summary"]) == 3
    assert len(body["questions"]) == 3
