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

    result = _call(system=SYSTEM, prompt=prompt, schema=SCHEMA, max_tokens=MAX_TOKENS)
    parsed = result["parsed"]
    return {
        "summary": _exactly(parsed.get("summary"), 3),
        "biggestChange": parsed["biggest_change"],
        "questions": _exactly(parsed.get("questions"), 3),
        "model": result["model"],
        "usage": result["usage"],
    }


def _call(system: str, prompt: str, schema: Dict[str, Any], max_tokens: int) -> Dict[str, Any]:
    """구조화 출력 한 번. 거절·파라미터 미지원 처리를 여기 모아 둔다."""
    client = _client()
    kwargs: Dict[str, Any] = {
        "model": MODEL,
        "max_tokens": max_tokens,
        "system": system,
        "output_config": {
            "effort": EFFORT,
            "format": {"type": "json_schema", "schema": schema},
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

    return {
        "parsed": json.loads(_text_of(message)),
        "model": getattr(message, "model", MODEL),
        "usage": {
            "input": getattr(message.usage, "input_tokens", None),
            "output": getattr(message.usage, "output_tokens", None),
        },
    }


MAX_INSTRUCTION_CHARS = 20_000
MAX_SAMPLE_CHARS = 40_000

AGENT_SCHEMA: Dict[str, Any] = {
    "type": "object",
    "properties": {
        "output": {
            "type": "string",
            "description": "지시문을 그대로 따랐을 때 나오는 결과물 전체.",
        },
        "issues": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "point": {"type": "string", "description": "지시문의 문제점"},
                    "fix": {"type": "string", "description": "고쳐 쓸 문장"},
                },
                "required": ["point", "fix"],
                "additionalProperties": False,
            },
            "description": "지시문을 실제로 따라 본 뒤 발견한 개선점. 최대 3개.",
        },
    },
    "required": ["output", "issues"],
    "additionalProperties": False,
}

AGENT_SYSTEM = (
    "너는 사용자가 만든 '업무용 미니 에이전트' 지시문을 시험해 주는 역할이다. "
    "두 가지를 한다. ① 그 지시문을 곧이곧대로 따라 샘플 입력을 처리한 결과를 낸다 — "
    "지시문이 허술하면 허술한 대로 나오게 두어라. 사용자가 그 결함을 봐야 한다. "
    "② 그렇게 직접 따라 본 경험을 근거로 지시문의 개선점을 짚는다. "
    "특히 지시문에 없어서 네가 임의로 판단해야 했던 지점을 우선 지적하라. "
    "일반론이 아니라 이번 실행에서 실제로 걸린 것만 쓴다. 한국어로 답하라."
)


def run_agent(instruction: str, sample: str) -> Dict[str, Any]:
    """사용자가 쓴 지시문을 샘플 입력에 실제로 적용해 보고, 개선점까지 돌려준다."""
    instruction = (instruction or "").strip()
    sample = (sample or "").strip()
    if not instruction:
        raise ValueError("지시문이 비어 있습니다.")
    if not sample:
        raise ValueError("시험할 샘플 입력이 비어 있습니다.")
    if len(instruction) > MAX_INSTRUCTION_CHARS:
        raise ValueError(f"지시문이 너무 깁니다. {MAX_INSTRUCTION_CHARS:,}자 이하로 줄여 주세요.")
    if len(sample) > MAX_SAMPLE_CHARS:
        raise ValueError(f"샘플 입력이 너무 깁니다. {MAX_SAMPLE_CHARS:,}자 이하로 줄여 주세요.")

    client = _client()
    prompt = (
        "아래 <지시문>을 그대로 따라 <샘플입력>을 처리하라. "
        "그 결과를 output에, 따라 하면서 발견한 지시문의 개선점을 issues에 담아라.\n\n"
        f"<지시문>\n{instruction}\n</지시문>\n\n"
        f"<샘플입력>\n{sample}\n</샘플입력>"
    )
    result = _call(
        system=AGENT_SYSTEM,
        prompt=prompt,
        schema=AGENT_SCHEMA,
        max_tokens=max(MAX_TOKENS, 6000),
    )
    return {
        "output": result["parsed"]["output"],
        "issues": _exactly(result["parsed"].get("issues"), 3),
        "model": result["model"],
        "usage": result["usage"],
    }


MAX_TRANSCRIPT_CHARS = 80_000

MEETING_SCHEMA: Dict[str, Any] = {
    "type": "object",
    "properties": {
        "tasks": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "task": {"type": "string", "description": "실행 과제"},
                    "owner": {"type": "string", "description": "담당자. 메모에 없으면 '미지정'"},
                    "due": {"type": "string", "description": "기한. 메모에 없으면 '미지정'"},
                    "prereq": {"type": "string", "description": "선행조건. 없으면 '없음'"},
                    "risk": {"type": "string", "description": "리스크. 없으면 '없음'"},
                },
                "required": ["task", "owner", "due", "prereq", "risk"],
                "additionalProperties": False,
            },
        },
        "urgent": {
            "type": "array",
            "items": {"type": "string"},
            "description": "이번 주 안에 하지 않으면 지연되는 것.",
        },
    },
    "required": ["tasks", "urgent"],
    "additionalProperties": False,
}

MEETING_SYSTEM = (
    "너는 회의 메모에서 실행 과제만 뽑아내는 역할이다. "
    "담당자나 기한이 메모에 없으면 반드시 '미지정'으로 두고, 절대 임의로 만들지 마라. "
    "메모에 없는 과제를 지어내지 마라 — 실제로 언급된 것만 뽑는다. "
    "받아쓰기 텍스트라 오탈자나 끊긴 문장이 있을 수 있다. 문맥으로 알아볼 수 있으면 "
    "정리해서 쓰되, 무슨 말인지 알 수 없는 부분을 추측으로 메우지는 마라. "
    "한국어로 답하라."
)


def extract_tasks(transcript: str) -> Dict[str, Any]:
    """회의 메모(또는 받아쓰기 텍스트)에서 실행 과제를 뽑는다."""
    transcript = (transcript or "").strip()
    if not transcript:
        raise ValueError("회의 내용이 비어 있습니다.")
    if len(transcript) > MAX_TRANSCRIPT_CHARS:
        raise ValueError(f"회의 내용이 너무 깁니다. {MAX_TRANSCRIPT_CHARS:,}자 이하로 줄여 주세요.")

    prompt = (
        "다음 회의 메모에서 실행 과제만 뽑아 표로 만들어라. "
        "열은 [과제 / 담당자 / 기한 / 선행조건 / 리스크]. "
        "담당자나 기한이 메모에 없으면 '미지정'으로 두고 절대 임의로 만들지 마라. "
        "마지막에 '이번 주 안에 안 하면 지연되는 것'을 urgent에 따로 정리하라.\n\n"
        f"<회의메모>\n{transcript}\n</회의메모>"
    )
    result = _call(
        system=MEETING_SYSTEM,
        prompt=prompt,
        schema=MEETING_SCHEMA,
        max_tokens=max(MAX_TOKENS, 6000),
    )
    parsed = result["parsed"]
    return {
        "tasks": list(parsed.get("tasks") or []),
        "urgent": list(parsed.get("urgent") or []),
        "model": result["model"],
        "usage": result["usage"],
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
