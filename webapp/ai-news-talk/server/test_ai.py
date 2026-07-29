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


# ── 미니 에이전트 시험 실행 ──────────────────────────────────
AGENT_GOOD = {
    "output": "① 요약 3줄\n- 매출 증가\n② 표\n③ 확인 필요: 없음",
    "issues": [
        {"point": "출력 ②의 표 열이 정해져 있지 않다", "fix": "[출력]에 '열은 [항목/값/비고]' 를 추가"},
        {"point": "단위가 지정되지 않았다", "fix": "'금액은 백만원 단위' 를 추가"},
    ],
}
INSTR = "너는 주간 리포트 전담 어시스턴트다.\n[역할] 표를 요약한다.\n[출력] 3줄\n[금지] 추측 금지"
SAMPLE = "1월 매출 100\n2월 매출 150"


def test_agent_run_returns_output_and_issues(client, monkeypatch):
    fake = FakeClient(_message(AGENT_GOOD))
    _install(monkeypatch, fake)
    r = client.post("/api/ai/agent-run", json={"instruction": INSTR, "sample": SAMPLE})
    assert r.status_code == 200
    body = r.json()
    assert body["output"] == AGENT_GOOD["output"]
    assert len(body["issues"]) == 2
    assert body["issues"][0]["fix"].startswith("[출력]")


def test_agent_run_sends_both_parts(client, monkeypatch):
    """지시문과 샘플이 둘 다 실려야 '실제로 따라 해 본' 결과가 나온다."""
    fake = FakeClient(_message(AGENT_GOOD))
    _install(monkeypatch, fake)
    client.post("/api/ai/agent-run", json={"instruction": INSTR, "sample": SAMPLE})
    _, kwargs = fake.calls[0]
    sent = kwargs["messages"][0]["content"]
    assert INSTR in sent and SAMPLE in sent
    assert kwargs["output_config"]["format"]["schema"]["properties"]["output"]["type"] == "string"


def test_agent_run_issues_trimmed_to_three(client, monkeypatch):
    many = dict(AGENT_GOOD, issues=[{"point": f"p{i}", "fix": f"f{i}"} for i in range(6)])
    _install(monkeypatch, FakeClient(_message(many)))
    body = client.post("/api/ai/agent-run", json={"instruction": INSTR, "sample": SAMPLE}).json()
    assert len(body["issues"]) == 3


@pytest.mark.parametrize("payload", [
    {"instruction": "  ", "sample": SAMPLE},
    {"instruction": INSTR, "sample": "  "},
    {"instruction": "x" * (ai.MAX_INSTRUCTION_CHARS + 1), "sample": SAMPLE},
    {"instruction": INSTR, "sample": "x" * (ai.MAX_SAMPLE_CHARS + 1)},
])
def test_agent_run_input_validation(client, monkeypatch, payload):
    _install(monkeypatch, FakeClient())
    assert client.post("/api/ai/agent-run", json=payload).status_code == 422


def test_agent_run_503_without_key(monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    c = TestClient(app_module.app)
    r = c.post("/api/ai/agent-run", json={"instruction": INSTR, "sample": SAMPLE})
    assert r.status_code == 503


# ── 회의록 → 실행 과제 ────────────────────────────────────────
MEET_GOOD = {
    "tasks": [
        {"task": "원가 자료 취합", "owner": "김과장", "due": "다음 주 수요일",
         "prereq": "없음", "risk": "없음"},
        {"task": "견적서 초안 공유", "owner": "미지정", "due": "이번 주 금요일",
         "prereq": "원가 자료 취합 완료", "risk": "지연 시 계약 일정 밀림"},
    ],
    "urgent": ["견적서 초안 공유"],
}
TRANSCRIPT = "김과장이 다음 주 수요일까지 원가 자료 취합하기로 했습니다. 견적서 초안은 이번 주 금요일까지 공유해 주세요."


def test_meeting_tasks_returns_rows_and_urgent(client, monkeypatch):
    _install(monkeypatch, FakeClient(_message(MEET_GOOD)))
    r = client.post("/api/ai/meeting-tasks", json={"transcript": TRANSCRIPT})
    assert r.status_code == 200
    body = r.json()
    assert len(body["tasks"]) == 2
    assert body["tasks"][0]["owner"] == "김과장"
    assert body["tasks"][1]["owner"] == "미지정"
    assert body["urgent"] == ["견적서 초안 공유"]


def test_meeting_prompt_forbids_inventing_owners(client, monkeypatch):
    """담당자를 지어내지 말라는 지시가 실제로 실려야 한다 — 이게 이 카드의 핵심."""
    fake = FakeClient(_message(MEET_GOOD))
    _install(monkeypatch, fake)
    client.post("/api/ai/meeting-tasks", json={"transcript": TRANSCRIPT})
    _, kwargs = fake.calls[0]
    assert "미지정" in kwargs["system"]
    assert "만들지 마라" in kwargs["system"]
    assert TRANSCRIPT in kwargs["messages"][0]["content"]
    cols = kwargs["output_config"]["format"]["schema"]["properties"]["tasks"]["items"]["properties"]
    assert set(cols) == {"task", "owner", "due", "prereq", "risk"}


def test_meeting_empty_rejected(client, monkeypatch):
    _install(monkeypatch, FakeClient())
    assert client.post("/api/ai/meeting-tasks", json={"transcript": "  "}).status_code == 422


def test_meeting_oversized_rejected(client, monkeypatch):
    _install(monkeypatch, FakeClient())
    r = client.post("/api/ai/meeting-tasks",
                    json={"transcript": "x" * (ai.MAX_TRANSCRIPT_CHARS + 1)})
    assert r.status_code == 422


def test_meeting_503_without_key(monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    c = TestClient(app_module.app)
    r = c.post("/api/ai/meeting-tasks", json={"transcript": TRANSCRIPT})
    assert r.status_code == 503


def test_meeting_empty_task_list_is_allowed(client, monkeypatch):
    """과제가 없는 회의도 있다 — 억지로 만들어 내지 않는 게 맞다."""
    _install(monkeypatch, FakeClient(_message({"tasks": [], "urgent": []})))
    body = client.post("/api/ai/meeting-tasks", json={"transcript": "잡담만 했습니다"}).json()
    assert body["tasks"] == [] and body["urgent"] == []


# ══════════════════════════════════════════════════════════════
# 📚 AI 사전 (/api/ai/doc-ask)
# ══════════════════════════════════════════════════════════════
DOC_GOOD = {
    "answer": "복귀일로부터 7영업일 이내입니다.",
    "found": True,
    "citations": [{"doc": "정산안내.docx", "quote": "복귀일로부터 7영업일 이내", "where": "2번째 문단"}],
    "missing": [],
}

PNG_B64 = "iVBORw0KGgoAAAANSUhEUg=="   # 내용은 상관없다 — 블록 모양만 본다


def _doc_body(**over):
    body = {
        "question": "정산 기한이 며칠인가요?",
        "docs": [{"name": "정산안내.docx", "kind": "text",
                  "text": "정산 기한은 복귀일로부터 7영업일 이내입니다."}],
    }
    body.update(over)
    return body


def test_doc_ask_503_without_key(monkeypatch):
    """키가 없으면 503 — 클라이언트는 이걸 받고 로컬 검색으로 내려간다."""
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    c = TestClient(app_module.app)
    assert c.post("/api/ai/doc-ask", json=_doc_body()).status_code == 503


def test_doc_ask_returns_answer_and_citations(client, monkeypatch):
    fake = FakeClient(message=_message(DOC_GOOD))
    _install(monkeypatch, fake)
    r = client.post("/api/ai/doc-ask", json=_doc_body())
    assert r.status_code == 200
    body = r.json()
    assert body["found"] is True
    assert body["answer"] == DOC_GOOD["answer"]
    assert body["citations"][0]["doc"] == "정산안내.docx"
    assert body["docs"] == 1
    assert body["model"] == "claude-opus-5"


def test_doc_ask_text_doc_is_labelled_with_filename(client, monkeypatch):
    """모델이 인용할 때 파일명을 맞히려면 파일명이 프롬프트에 있어야 한다."""
    fake = FakeClient(message=_message(DOC_GOOD))
    _install(monkeypatch, fake)
    client.post("/api/ai/doc-ask", json=_doc_body())
    content = fake.calls[0][1]["messages"][0]["content"]
    assert isinstance(content, list)
    joined = "".join(b.get("text", "") for b in content if b["type"] == "text")
    assert '파일명="정산안내.docx"' in joined
    assert "7영업일" in joined
    assert "정산 기한이 며칠인가요?" in joined


def test_doc_ask_pdf_becomes_document_block(client, monkeypatch):
    fake = FakeClient(message=_message(DOC_GOOD))
    _install(monkeypatch, fake)
    client.post("/api/ai/doc-ask", json=_doc_body(docs=[
        {"name": "규정.pdf", "kind": "pdf", "data": PNG_B64}]))
    content = fake.calls[0][1]["messages"][0]["content"]
    docs = [b for b in content if b["type"] == "document"]
    assert len(docs) == 1
    assert docs[0]["source"] == {"type": "base64", "media_type": "application/pdf", "data": PNG_B64}


def test_doc_ask_image_becomes_image_block(client, monkeypatch):
    fake = FakeClient(message=_message(DOC_GOOD))
    _install(monkeypatch, fake)
    client.post("/api/ai/doc-ask", json=_doc_body(docs=[
        {"name": "캡처.png", "kind": "image", "data": PNG_B64, "mediaType": "image/png"}]))
    content = fake.calls[0][1]["messages"][0]["content"]
    imgs = [b for b in content if b["type"] == "image"]
    assert len(imgs) == 1
    assert imgs[0]["source"]["media_type"] == "image/png"


def test_doc_ask_mixes_text_and_binary_in_one_request(client, monkeypatch):
    fake = FakeClient(message=_message(DOC_GOOD))
    _install(monkeypatch, fake)
    r = client.post("/api/ai/doc-ask", json=_doc_body(docs=[
        {"name": "표.xlsx", "kind": "text", "text": "항목\t한도\n숙박비\t120000"},
        {"name": "캡처.png", "kind": "image", "data": PNG_B64, "mediaType": "image/png"},
        {"name": "규정.pdf", "kind": "pdf", "data": PNG_B64},
    ]))
    assert r.json()["docs"] == 3
    kinds = [b["type"] for b in fake.calls[0][1]["messages"][0]["content"]]
    assert "image" in kinds and "document" in kinds and "text" in kinds


def test_doc_ask_system_forbids_inventing(client, monkeypatch):
    """이 카드의 핵심은 '문서에 없으면 없다고 말하는 것'이다."""
    fake = FakeClient(message=_message(DOC_GOOD))
    _install(monkeypatch, fake)
    client.post("/api/ai/doc-ask", json=_doc_body())
    system = fake.calls[0][1]["system"]
    assert "지어내지 마라" in system
    assert "문서에 없음" in system
    assert "사전 지식으로 문서를 보완하지 마라" in system


def test_doc_ask_uses_schema_and_model(client, monkeypatch):
    fake = FakeClient(message=_message(DOC_GOOD))
    _install(monkeypatch, fake)
    client.post("/api/ai/doc-ask", json=_doc_body())
    kwargs = fake.calls[0][1]
    assert kwargs["model"] == ai.MODEL
    fmt = kwargs["output_config"]["format"]
    assert fmt["type"] == "json_schema"
    props = fmt["schema"]["properties"]
    assert set(props) == {"answer", "found", "citations", "missing"}


def test_doc_ask_not_found_is_passed_through(client, monkeypatch):
    """모델이 '없다'고 하면 그대로 전달해야 한다 — 여기서 꾸미면 안 된다."""
    fake = FakeClient(message=_message(
        {"answer": "문서에 없음", "found": False, "citations": [],
         "missing": ["2026년 개정판 규정"]}))
    _install(monkeypatch, fake)
    body = client.post("/api/ai/doc-ask", json=_doc_body()).json()
    assert body["found"] is False
    assert body["answer"] == "문서에 없음"
    assert body["missing"] == ["2026년 개정판 규정"]


def test_doc_ask_refusal_maps_to_502(client, monkeypatch):
    fake = FakeClient(message=_message(
        DOC_GOOD, stop_reason="refusal",
        stop_details=SimpleNamespace(explanation="정책상 거절")))
    _install(monkeypatch, fake)
    assert client.post("/api/ai/doc-ask", json=_doc_body()).status_code == 502


@pytest.mark.parametrize("payload,frag", [
    ({"question": "", "docs": [{"name": "a.txt", "kind": "text", "text": "내용"}]}, "질문이 비어"),
    ({"question": "뭐지", "docs": []}, "첨부한 문서가 없"),
    ({"question": "뭐지", "docs": [{"name": "a.txt", "kind": "text", "text": "   "}]}, "읽을 수 있는 내용"),
])
def test_doc_ask_rejects_bad_input(client, monkeypatch, payload, frag):
    _install(monkeypatch, FakeClient(message=_message(DOC_GOOD)))
    r = client.post("/api/ai/doc-ask", json=payload)
    assert r.status_code == 422
    assert frag in r.json()["detail"]


def test_doc_ask_rejects_too_many_files(client, monkeypatch):
    _install(monkeypatch, FakeClient(message=_message(DOC_GOOD)))
    docs = [{"name": f"{i}.txt", "kind": "text", "text": "내용"} for i in range(ai.MAX_DOCS + 1)]
    r = client.post("/api/ai/doc-ask", json=_doc_body(docs=docs))
    assert r.status_code == 422
    assert "파일이 너무 많습니다" in r.json()["detail"]


def test_doc_ask_rejects_oversized_total_text(client, monkeypatch):
    _install(monkeypatch, FakeClient(message=_message(DOC_GOOD)))
    big = "가" * ai.MAX_DOC_TEXT_CHARS
    docs = [{"name": f"{i}.txt", "kind": "text", "text": big} for i in range(8)]
    r = client.post("/api/ai/doc-ask", json=_doc_body(docs=docs))
    assert r.status_code == 422
    assert "분량이 너무 많습니다" in r.json()["detail"]


def test_doc_ask_truncates_single_long_doc(client, monkeypatch):
    """한 파일이 길면 잘라서 보내되, 잘렸다는 사실을 프롬프트에 남긴다."""
    fake = FakeClient(message=_message(DOC_GOOD))
    _install(monkeypatch, fake)
    long_text = "나" * (ai.MAX_DOC_TEXT_CHARS + 500)
    r = client.post("/api/ai/doc-ask", json=_doc_body(docs=[
        {"name": "긴문서.txt", "kind": "text", "text": long_text}]))
    assert r.status_code == 200
    sent = "".join(b.get("text", "") for b in fake.calls[0][1]["messages"][0]["content"])
    assert "(이하 잘림)" in sent
    assert sent.count("나") <= ai.MAX_DOC_TEXT_CHARS + 10


def test_doc_ask_rejects_unsupported_image_type(client, monkeypatch):
    _install(monkeypatch, FakeClient(message=_message(DOC_GOOD)))
    r = client.post("/api/ai/doc-ask", json=_doc_body(docs=[
        {"name": "그림.bmp", "kind": "image", "data": PNG_B64, "mediaType": "image/bmp"}]))
    assert r.status_code == 422
    assert "지원하지 않는 이미지 형식" in r.json()["detail"]


def test_doc_ask_falls_back_when_beta_param_unsupported(client, monkeypatch):
    """fallbacks 파라미터를 모르는 SDK에서도 동작해야 한다."""
    fake = FakeClient(message=_message(DOC_GOOD), beta_error=TypeError("unexpected keyword 'fallbacks'"))
    _install(monkeypatch, fake)
    assert client.post("/api/ai/doc-ask", json=_doc_body()).status_code == 200
    assert [c[0] for c in fake.calls] == ["beta", "plain"]
