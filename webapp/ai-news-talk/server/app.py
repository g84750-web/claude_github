"""AI 글로벌 뉴스 톡 — 설정 동기화 API

동기화 코드 하나가 설정 한 벌을 가리킨다. 코드를 아는 사람이 곧
소유자이므로(계정 없음) 다음을 전제로 한다.

  · 배포 시 반드시 HTTPS 뒤에 둘 것 — 코드가 평문으로 오간다.
  · 조회 실패에는 IP 단위 속도 제한을 걸어 무작위 대입을 늦춘다.
  · 개인정보는 저장하지 않는다. 화면 설정과 학습 진행률만 담긴다.

실행:
    uvicorn webapp.ai_news_talk.server.app:app --reload
    (또는 이 디렉터리에서) uvicorn app:app --reload

환경변수:
    DZAI_SYNC_DB       SQLite 파일 경로 (기본 sync.db)
    DZAI_SYNC_ORIGINS  CORS 허용 오리진, 쉼표 구분 (기본 *)
    DZAI_SYNC_RPM      IP당 분당 허용 요청 수 (기본 60)
"""

from __future__ import annotations

import os
import threading
import time
from collections import defaultdict, deque
from typing import Any, Dict, Optional

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from ai import (  # type: ignore[import-not-found]
    AiRefused,
    AiUnavailable,
    extract_tasks,
    run_agent,
    summarize_table,
)
from ai import status as ai_status  # type: ignore[import-not-found]
from store import (  # type: ignore[import-not-found]
    InvalidCode,
    InvalidPayload,
    PayloadTooLarge,
    SyncStore,
)

DB_PATH = os.environ.get("DZAI_SYNC_DB", "sync.db")
ORIGINS = [o.strip() for o in os.environ.get("DZAI_SYNC_ORIGINS", "*").split(",") if o.strip()]
RATE_PER_MIN = int(os.environ.get("DZAI_SYNC_RPM", "60"))

app = FastAPI(
    title="AI 글로벌 뉴스 톡 — 설정 동기화 API",
    version="1.0.0",
    description="동기화 코드 기반으로 화면 설정과 학습 진행률을 기기 간에 공유한다.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

store = SyncStore(DB_PATH)


# ══════════════════════════════════════════════════════════════
# 속도 제한 — 코드 무작위 대입을 늦추기 위한 최소한의 방어
# ══════════════════════════════════════════════════════════════
class RateLimiter:
    def __init__(self, per_minute: int):
        self.per_minute = per_minute
        self._hits: Dict[str, deque] = defaultdict(deque)
        self._lock = threading.Lock()

    def check(self, key: str) -> bool:
        now = time.monotonic()
        with self._lock:
            q = self._hits[key]
            while q and now - q[0] > 60.0:
                q.popleft()
            if len(q) >= self.per_minute:
                return False
            q.append(now)
            return True

    def reset(self) -> None:
        with self._lock:
            self._hits.clear()


limiter = RateLimiter(RATE_PER_MIN)


def rate_limit(request: Request) -> None:
    client = request.client.host if request.client else "unknown"
    if not limiter.check(client):
        raise HTTPException(
            status_code=429,
            detail="요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요.",
        )


# ══════════════════════════════════════════════════════════════
# 스키마
# ══════════════════════════════════════════════════════════════
class CreateRequest(BaseModel):
    settings: Dict[str, Any] = Field(default_factory=dict, description="초기 설정 페이로드")


class PutRequest(BaseModel):
    settings: Dict[str, Any] = Field(..., description="저장할 설정 페이로드")
    baseRev: Optional[int] = Field(
        default=None,
        description="클라이언트가 알고 있는 서버 rev. 다르면 409로 거절한다.",
    )


class SyncResponse(BaseModel):
    code: str
    settings: Dict[str, Any]
    rev: int
    updatedAt: str
    createdAt: str


def _to_response(record) -> SyncResponse:
    return SyncResponse(
        code=record.code,
        settings=record.payload,
        rev=record.rev,
        updatedAt=record.updated_at,
        createdAt=record.created_at,
    )


# ══════════════════════════════════════════════════════════════
# 엔드포인트
# ══════════════════════════════════════════════════════════════
@app.get("/api/health")
def health() -> Dict[str, Any]:
    return {"ok": True, "service": "dzai-sync", "version": app.version}


@app.post("/api/sync", response_model=SyncResponse, status_code=201)
def create_sync(body: CreateRequest, _: None = Depends(rate_limit)) -> SyncResponse:
    """새 동기화 코드를 발급한다."""
    try:
        record = store.create(body.settings)
    except PayloadTooLarge as exc:
        raise HTTPException(status_code=413, detail=str(exc)) from exc
    except InvalidPayload as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return _to_response(record)


@app.get("/api/sync/{code}", response_model=SyncResponse)
def get_sync(code: str, _: None = Depends(rate_limit)) -> SyncResponse:
    """코드에 저장된 설정을 가져온다."""
    try:
        record = store.get(code)
    except InvalidCode as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    if record is None:
        raise HTTPException(status_code=404, detail="해당 동기화 코드를 찾을 수 없습니다.")
    return _to_response(record)


@app.put("/api/sync/{code}", response_model=SyncResponse)
def put_sync(code: str, body: PutRequest, _: None = Depends(rate_limit)) -> SyncResponse:
    """설정을 저장한다. baseRev가 서버와 다르면 409와 함께 서버 상태를 준다."""
    try:
        result = store.put(code, body.settings, body.baseRev)
    except InvalidCode as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except PayloadTooLarge as exc:
        raise HTTPException(status_code=413, detail=str(exc)) from exc
    except InvalidPayload as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    if result is None:
        raise HTTPException(status_code=404, detail="해당 동기화 코드를 찾을 수 없습니다.")

    if result.conflict:
        raise HTTPException(
            status_code=409,
            detail={
                "message": "다른 기기에서 먼저 저장했습니다.",
                "server": _to_response(result.record).model_dump(),
            },
        )

    return _to_response(result.record)


# ══════════════════════════════════════════════════════════════
# 경험하기 코너 — 실제 AI 실행
# ══════════════════════════════════════════════════════════════
class SummarizeRequest(BaseModel):
    table: str = Field(..., description="붙여넣은 표 (TSV/CSV 등 텍스트)")
    note: str = Field(default="", description="추가 맥락 (선택)")


@app.get("/api/ai/status")
def ai_enabled() -> Dict[str, Any]:
    """앱이 AI 실행 버튼을 켤지 말지 판단하는 데 쓴다."""
    return ai_status()


@app.post("/api/ai/summarize")
def ai_summarize(body: SummarizeRequest, _: None = Depends(rate_limit)) -> Dict[str, Any]:
    """표를 임원 보고용 3줄 요약으로 정리한다."""
    try:
        return summarize_table(body.table, body.note)
    except AiUnavailable as exc:
        # 503은 "서버는 살아 있는데 이 기능만 꺼져 있다"는 뜻 —
        # 클라이언트는 이걸 받고 로컬 계산으로 떨어진다.
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except AiRefused as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


class AgentRunRequest(BaseModel):
    instruction: str = Field(..., description="사용자가 작성한 에이전트 지시문")
    sample: str = Field(..., description="지시문을 시험할 샘플 입력")


@app.post("/api/ai/agent-run")
def ai_agent_run(body: AgentRunRequest, _: None = Depends(rate_limit)) -> Dict[str, Any]:
    """지시문을 샘플 입력에 실제로 적용해 보고 결과와 개선점을 돌려준다."""
    try:
        return run_agent(body.instruction, body.sample)
    except AiUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except AiRefused as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


class MeetingRequest(BaseModel):
    transcript: str = Field(..., description="회의 메모 또는 음성 받아쓰기 텍스트")


@app.post("/api/ai/meeting-tasks")
def ai_meeting_tasks(body: MeetingRequest, _: None = Depends(rate_limit)) -> Dict[str, Any]:
    """회의 내용에서 담당자·기한이 붙은 실행 과제를 뽑는다."""
    try:
        return extract_tasks(body.transcript)
    except AiUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except AiRefused as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@app.delete("/api/sync/{code}", status_code=204)
def delete_sync(code: str, _: None = Depends(rate_limit)) -> None:
    """코드와 저장된 설정을 완전히 삭제한다."""
    try:
        removed = store.delete(code)
    except InvalidCode as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    if not removed:
        raise HTTPException(status_code=404, detail="해당 동기화 코드를 찾을 수 없습니다.")
