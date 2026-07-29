"""경험하기 코너용 Claude 호출 — 브라우저 대신 서버가 API 키를 쥔다.

브라우저에서 api.anthropic.com을 직접 부를 수 없다(CORS, 그리고 키를 사용자에게
노출하게 된다). 그래서 앱은 이 서버를 거치고, 키는 여기에만 있는다.

키가 없으면 503을 돌려준다. 앱은 그걸 신호로 받아 로컬 계산 요약으로 떨어진다 —
설치 없이도 카드가 동작해야 하기 때문이다.

환경변수:
    ANTHROPIC_API_KEY   필수. 없으면 이 기능만 꺼진다(서버 나머지는 정상).
    DZAI_AI_MODEL       기본 claude-opus-5
    DZAI_AI_EFFORT      low|medium|high|xhigh|max (기본 medium)
    DZAI_AI_MAX_TOKENS  기본 4000
    DZAI_AI_TIMEOUT     초, 기본 90
"""

from __future__ import annotations

import json
import os
from typing import Any, Dict, List

try:  # 선택 의존성 — 없으면 기능만 꺼진다
    import anthropic
except ImportError:  # pragma: no cover - 설치 여부에 따라 갈림
    anthropic = None  # type: ignore[assignment]

MODEL = os.environ.get("DZAI_AI_MODEL", "claude-opus-5")
EFFORT = os.environ.get("DZAI_AI_EFFORT", "medium")
MAX_TOKENS = int(os.environ.get("DZAI_AI_MAX_TOKENS", "4000"))
TIMEOUT = float(os.environ.get("DZAI_AI_TIMEOUT", "90"))

MAX_TABLE_CHARS = 60_000

# 카드 e1의 프롬프트를 그대로 구조화한 것 — 화면의 안내와 실제 동작이 어긋나면 안 된다
SYSTEM = (
    "너는 실무자가 붙여넣은 표를 임원 보고용으로 정리하는 분석 보조다. "
    "숫자는 반드시 주어진 표에서 인용하고, 표에 없는 값은 추정이라고 명시하라. "
    "표에서 읽을 수 없는 것은 지어내지 마라. 한국어로 답하라."
)

SCHEMA: Dict[str, Any] = {
    "type": "object",
    "properties": {
        "summary": {
            "type": "array",
            "items": {"type": "string"},
            "description": "핵심 3줄 요약. 정확히 3개.",
        },
        "biggest_change": {
            "type": "object",
            "properties": {
                "what": {"type": "string", "description": "가장 큰 변화 1건"},
                "why": {"type": "string", "description": "원인 가설"},
            },
            "required": ["what", "why"],
            "additionalProperties": False,
        },
        "questions": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "q": {"type": "string"},
                    "a": {"type": "string"},
                },
                "required": ["q", "a"],
                "additionalProperties": False,
            },
            "description": "임원이 물어볼 질문과 답. 3개.",
        },
    },
    "required": ["summary", "biggest_change", "questions"],
    "additionalProperties": False,
}


class AiUnavailable(RuntimeError):
    """키가 없거나 SDK가 없어 기능을 켤 수 없다 — 클라이언트는 로컬 폴백으로 간다."""


class AiRefused(RuntimeError):
    """모델이 응답을 거절했다."""


def status() -> Dict[str, Any]:
    if anthropic is None:
        return {"enabled": False, "reason": "sdk_missing", "model": MODEL}
    if not os.environ.get("ANTHROPIC_API_KEY"):
        return {"enabled": False, "reason": "no_api_key", "model": MODEL}
    return {"enabled": True, "reason": None, "model": MODEL, "effort": EFFORT}


def _client():
    if anthropic is None:
        raise AiUnavailable("anthropic SDK가 설치되어 있지 않습니다.")
    if not os.environ.get("ANTHROPIC_API_KEY"):
        raise AiUnavailable("ANTHROPIC_API_KEY가 설정되어 있지 않습니다.")
    return anthropic.Anthropic(timeout=TIMEOUT)


def _text_of(message) -> str:
    for block in message.content:
        if getattr(block, "type", None) == "text":
            return block.text
    return ""


def summarize_table(table: str, note: str = "") -> Dict[str, Any]:
    """표 텍스트를 3줄 요약 + 최대 변화 + 예상질문으로 정리한다."""
    table = (table or "").strip()
    if not table:
        raise ValueError("표 내용이 비어 있습니다.")
    if len(table) > MAX_TABLE_CHARS:
        raise ValueError(f"표가 너무 큽니다. {MAX_TABLE_CHARS:,}자 이하로 줄여 주세요.")

    client = _client()
    prompt = (
        "아래는 붙여넣은 표다. 임원 보고용으로 정리하라.\n"
        "① 핵심 3줄 요약 ② 가장 큰 변화 1건과 원인 가설 "
        "③ 임원이 물어볼 질문 3개를 예상해 답까지 달아라.\n"
    )
    if note.strip():
        prompt += f"\n[추가 맥락] {note.strip()}\n"
    prompt += f"\n<표>\n{table}\n</표>"

    kwargs: Dict[str, Any] = {
        "model": MODEL,
        "max_tokens": MAX_TOKENS,
        "system": SYSTEM,
        "output_config": {
            "effort": EFFORT,
            "format": {"type": "json_schema", "schema": SCHEMA},
        },
        "messages": [{"role": "user", "content": prompt}],
    }

    # 안전 분류기가 거절하면 서버가 대체 모델로 다시 태워 준다. 이 파라미터를
    # 모르는 SDK/엔드포인트도 있으므로, 거부당하면 빼고 한 번 더 시도한다.
    try:
        message = client.beta.messages.create(
            betas=["server-side-fallback-2026-07-01"], fallbacks="default", **kwargs
        )
    except Exception as exc:  # noqa: BLE001 - 파라미터 미지원만 걸러내고 나머지는 그대로 올린다
        if not _is_unsupported_param(exc):
            raise
        message = client.messages.create(**kwargs)

    if getattr(message, "stop_reason", None) == "refusal":
        detail = getattr(message, "stop_details", None)
        raise AiRefused(getattr(detail, "explanation", None) or "모델이 응답을 거절했습니다.")

    parsed = json.loads(_text_of(message))
    return {
        "summary": _exactly(parsed.get("summary"), 3),
        "biggestChange": parsed["biggest_change"],
        "questions": _exactly(parsed.get("questions"), 3),
        "model": getattr(message, "model", MODEL),
        "usage": {
            "input": getattr(message.usage, "input_tokens", None),
            "output": getattr(message.usage, "output_tokens", None),
        },
    }


def _exactly(items: Any, n: int) -> List[Any]:
    """항목 수는 스키마로 강제할 수 없다(배열 제약 미지원). 여기서 맞춘다."""
    items = list(items or [])
    return items[:n]


def _is_unsupported_param(exc: Exception) -> bool:
    if isinstance(exc, TypeError):
        return True
    text = str(exc).lower()
    return "fallback" in text and ("unexpected" in text or "unknown" in text or "not support" in text)
