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


def _call(system: str, prompt: Any, schema: Dict[str, Any], max_tokens: int) -> Dict[str, Any]:
    """구조화 출력 한 번. 거절·파라미터 미지원 처리를 여기 모아 둔다.

    prompt은 문자열이거나 콘텐츠 블록 리스트다 — PDF·이미지는 블록으로 넣어야 한다.
    """
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


# ══════════════════════════════════════════════════════════════
# 📚 AI 사전 — 첨부한 문서에만 근거해서 답한다
#
# 표·문서(xlsx/docx/pptx/csv/txt)는 브라우저가 텍스트로 뽑아 보내고,
# PDF와 이미지는 원본 그대로 보내 모델이 직접 읽는다. 두 경로가 한 요청에 섞인다.
# ══════════════════════════════════════════════════════════════
MAX_DOCS = 12
MAX_DOC_TEXT_CHARS = 60_000        # 문서 하나
MAX_TOTAL_TEXT_CHARS = 300_000     # 전부 합쳐서
MAX_BINARY_BYTES = 20 * 1024 * 1024  # base64 문자열 길이 기준 (요청 한도 32MB 안쪽)
MAX_QUESTION_CHARS = 2_000

# 이미지·PDF는 API가 받는 형식이 정해져 있다. 그 밖은 브라우저가 변환해서 보낸다.
IMAGE_TYPES = {"image/jpeg", "image/png", "image/gif", "image/webp"}

DOC_SCHEMA: Dict[str, Any] = {
    "type": "object",
    "properties": {
        "answer": {
            "type": "string",
            "description": "첨부 문서에만 근거한 답변. 근거가 없으면 '문서에 없음'.",
        },
        "found": {
            "type": "boolean",
            "description": "문서에서 근거를 찾았으면 true, 못 찾았으면 false.",
        },
        "citations": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "doc": {"type": "string", "description": "근거가 있는 파일명"},
                    "quote": {"type": "string", "description": "근거가 된 원문. 그대로 인용한다."},
                    "where": {"type": "string", "description": "쪽·시트·항목 등 위치. 모르면 '위치 미상'."},
                },
                "required": ["doc", "quote", "where"],
                "additionalProperties": False,
            },
            "description": "답의 근거. 문서에서 찾았다면 최소 1개.",
        },
        "missing": {
            "type": "array",
            "items": {"type": "string"},
            "description": "답하려면 더 필요한 정보. 없으면 빈 배열.",
        },
    },
    "required": ["answer", "found", "citations", "missing"],
    "additionalProperties": False,
}

DOC_SYSTEM = (
    "너는 사내 'AI 사전'이다. 사용자가 첨부한 문서만 근거로 답한다.\n"
    "지켜야 할 것:\n"
    "① 첨부 문서에 없는 내용은 절대 지어내지 마라. 근거를 못 찾으면 found를 false로 두고 "
    "answer에 '문서에 없음'이라고 쓴 뒤, 무엇이 있어야 답할 수 있는지 missing에 적어라.\n"
    "② 일반 상식이나 사전 지식으로 문서를 보완하지 마라. 문서가 틀려 보여도 문서 내용을 그대로 전한다.\n"
    "③ 답의 근거가 된 대목은 citations에 원문 그대로 인용하라. 요약하거나 바꿔 쓰지 마라.\n"
    "④ 문서마다 파일명을 함께 줬다. 인용할 때 어느 파일인지 doc에 정확히 적어라.\n"
    "⑤ 표(시트)는 탭으로 구분된 텍스트로 들어온다. 숫자는 표의 값을 그대로 인용하고, "
    "계산이 필요하면 계산식을 answer에 함께 남겨라.\n"
    "한국어로 답하라."
)


def ask_docs(question: str, docs: List[Dict[str, Any]]) -> Dict[str, Any]:
    """첨부 문서에만 근거해 질문에 답한다."""
    question = (question or "").strip()
    if not question:
        raise ValueError("질문이 비어 있습니다.")
    if len(question) > MAX_QUESTION_CHARS:
        raise ValueError(f"질문이 너무 깁니다. {MAX_QUESTION_CHARS:,}자 이하로 줄여 주세요.")

    docs = list(docs or [])
    if not docs:
        raise ValueError("첨부한 문서가 없습니다. 파일을 먼저 올려 주세요.")
    if len(docs) > MAX_DOCS:
        raise ValueError(f"파일이 너무 많습니다. {MAX_DOCS}개 이하로 올려 주세요.")

    content: List[Dict[str, Any]] = []
    total_text = 0
    used = 0

    for doc in docs:
        name = str(doc.get("name") or "이름없음")[:200]
        kind = doc.get("kind")

        if kind == "text":
            text = (doc.get("text") or "").strip()
            if not text:
                continue
            if len(text) > MAX_DOC_TEXT_CHARS:
                text = text[:MAX_DOC_TEXT_CHARS] + "\n…(이하 잘림)"
            total_text += len(text)
            if total_text > MAX_TOTAL_TEXT_CHARS:
                raise ValueError(
                    f"문서 분량이 너무 많습니다. 합쳐서 {MAX_TOTAL_TEXT_CHARS:,}자 이하로 줄여 주세요."
                )
            content.append({"type": "text", "text": f'<문서 파일명="{name}">\n{text}\n</문서>'})
            used += 1

        elif kind in ("pdf", "image"):
            data = doc.get("data") or ""
            if not data:
                continue
            if len(data) > MAX_BINARY_BYTES:
                raise ValueError(f"'{name}' 파일이 너무 큽니다. 15MB 이하로 줄여 주세요.")
            media = doc.get("mediaType") or ""
            if kind == "image" and media not in IMAGE_TYPES:
                raise ValueError(f"'{name}'은(는) 지원하지 않는 이미지 형식입니다({media or '알 수 없음'}).")
            content.append({"type": "text", "text": f'<문서 파일명="{name}">'})
            content.append(
                {
                    "type": "document" if kind == "pdf" else "image",
                    "source": {
                        "type": "base64",
                        "media_type": "application/pdf" if kind == "pdf" else media,
                        "data": data,
                    },
                }
            )
            content.append({"type": "text", "text": "</문서>"})
            used += 1

    if not used:
        raise ValueError("읽을 수 있는 내용이 있는 파일이 없습니다.")

    content.append(
        {
            "type": "text",
            "text": (
                "위 문서에만 근거해서 아래 질문에 답하라. "
                "문서에 없으면 지어내지 말고 '문서에 없음'이라고 답하라.\n\n"
                f"<질문>\n{question}\n</질문>"
            ),
        }
    )

    result = _call(
        system=DOC_SYSTEM,
        prompt=content,
        schema=DOC_SCHEMA,
        max_tokens=max(MAX_TOKENS, 8000),
    )
    parsed = result["parsed"]
    return {
        "answer": parsed.get("answer") or "",
        "found": bool(parsed.get("found")),
        "citations": list(parsed.get("citations") or [])[:8],
        "missing": list(parsed.get("missing") or [])[:5],
        "docs": used,
        "model": result["model"],
        "usage": result["usage"],
    }


# ══════════════════════════════════════════════════════════════
# 🔍 경쟁사 발표 → 우리 관점 (카드 4)
# ══════════════════════════════════════════════════════════════
MAX_RIVAL_CHARS = 40_000

_POINT = {
    "type": "array",
    "items": {
        "type": "object",
        "properties": {
            "point": {"type": "string", "description": "지점 한 줄"},
            "why": {"type": "string", "description": "원문의 어느 대목을 근거로 그렇게 보는지"},
        },
        "required": ["point", "why"],
        "additionalProperties": False,
    },
}

RIVAL_SCHEMA: Dict[str, Any] = {
    "type": "object",
    "properties": {
        "threats": dict(_POINT, description="실제로 위협인 지점. 2개."),
        "hype": dict(_POINT, description="과장·마케팅 문구로 걸러야 할 지점. 2개."),
        "actions": {
            "type": "object",
            "properties": {
                "immediate": {"type": "array", "items": {"type": "string"}, "description": "즉시(1주 내) 할 일 2개"},
                "short": {"type": "array", "items": {"type": "string"}, "description": "단기(1분기) 2개"},
                "long": {"type": "array", "items": {"type": "string"}, "description": "중장기 2개"},
            },
            "required": ["immediate", "short", "long"],
            "additionalProperties": False,
        },
    },
    "required": ["threats", "hype", "actions"],
    "additionalProperties": False,
}

RIVAL_SYSTEM = (
    "너는 경쟁사 발표를 자사 관점으로 번역해 주는 분석 보조다. "
    "원문에 실제로 쓰인 내용만 근거로 삼아라 — 업계 소문이나 사전 지식으로 보태지 마라. "
    "근거 없는 낙관도, 근거 없는 위기감도 쓰지 마라. why에는 원문의 어느 대목 때문인지 밝혀라. "
    "발표문에서 '예정·계획·목표'인 것은 아직 일어나지 않은 일이다 — 현재의 위협과 구분해서 다뤄라. "
    "대응안은 실행 가능한 행동으로 쓴다('검토한다'가 아니라 무엇을 누가 언제까지). 한국어로 답하라."
)


def brief_rival(text: str, ours: str = "") -> Dict[str, Any]:
    """경쟁사 발표문을 위협·과장·대응안으로 정리한다."""
    text = (text or "").strip()
    if not text:
        raise ValueError("보도자료 원문이 비어 있습니다.")
    if len(text) > MAX_RIVAL_CHARS:
        raise ValueError(f"원문이 너무 깁니다. {MAX_RIVAL_CHARS:,}자 이하로 줄여 주세요.")

    ours = (ours or "").strip()[:60]
    prompt = (
        f"우리 회사는 {ours or 'ERP·그룹웨어·클라우드'} 사업을 한다. 그 관점에서 아래 발표문을 읽어라.\n"
        "① 실제로 위협인 지점 2개 ② 과장·마케팅으로 걸러야 할 지점 2개 "
        "③ 즉시/단기/중장기 대응안 각 2개.\n\n"
        f"<발표문>\n{text}\n</발표문>"
    )
    result = _call(system=RIVAL_SYSTEM, prompt=prompt, schema=RIVAL_SCHEMA,
                   max_tokens=max(MAX_TOKENS, 6000))
    parsed = result["parsed"]
    acts = parsed.get("actions") or {}
    return {
        "threats": _exactly(parsed.get("threats"), 3),
        "hype": _exactly(parsed.get("hype"), 3),
        "actions": {k: _exactly(acts.get(k), 3) for k in ("immediate", "short", "long")},
        "model": result["model"],
        "usage": result["usage"],
    }


# ══════════════════════════════════════════════════════════════
# ✍️ 고객 메일 3종 톤 (카드 6)
# ══════════════════════════════════════════════════════════════
MAX_MAIL_CHARS = 8_000

MAIL_SCHEMA: Dict[str, Any] = {
    "type": "object",
    "properties": {
        "polite": {"type": "string", "description": "정중·격식체 메일 전문"},
        "brief": {"type": "string", "description": "간결·실무체 메일 전문"},
        "persuasive": {"type": "string", "description": "설득·제안형 메일 전문"},
        "risks": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "t": {"type": "string", "description": "리스크 이름"},
                    "m": {"type": "string", "description": "무엇을 확인해야 하는지"},
                },
                "required": ["t", "m"],
                "additionalProperties": False,
            },
            "description": "보내기 전에 확인할 대외 리스크. 없으면 빈 배열.",
        },
    },
    "required": ["polite", "brief", "persuasive", "risks"],
    "additionalProperties": False,
}

MAIL_SYSTEM = (
    "너는 고객 안내 메일을 세 가지 어투로 작성하는 보조다. "
    "주어진 핵심 사실만 사용하라 — 일정 확정, 할인, 보장처럼 사실에 없는 약속은 절대 넣지 마라. "
    "사실이 모자라 문장을 채울 수 없으면 채우지 말고 그 자리를 비워라. "
    "세 버전 모두 같은 사실을 담되 어투만 다르게 한다. 각 400자 이내, 한국어 비즈니스 메일 형식. "
    "그리고 주어진 사실 자체에 대외 리스크가 있으면(승인이 필요한 금액 약속, 결과 보장, "
    "날짜 없는 속도 약속 등) risks에 짚어라. 한국어로 답하라."
)


def mail_tones(subject: str, facts: str, to: str = "", ask: str = "") -> Dict[str, Any]:
    """핵심 사실만으로 정중·간결·설득 3종 메일을 만든다."""
    subject = (subject or "").strip()
    facts = (facts or "").strip()
    if not subject:
        raise ValueError("용건을 한 줄로 적어 주세요.")
    if not facts:
        raise ValueError("전달할 핵심 사실을 한 줄에 하나씩 적어 주세요.")
    if len(subject) + len(facts) + len(to or "") + len(ask or "") > MAX_MAIL_CHARS:
        raise ValueError(f"입력이 너무 깁니다. 합쳐서 {MAX_MAIL_CHARS:,}자 이하로 줄여 주세요.")

    prompt = (
        f"받는 곳: {(to or '고객').strip()}\n"
        f"용건: {subject}\n"
        f"핵심 사실:\n{facts}\n"
        f"상대에게 바라는 것: {(ask or '확인 요청').strip()}\n\n"
        "위 사실만 사용해 ①정중·격식 ②간결·실무 ③설득·제안형 3가지 메일을 써라."
    )
    result = _call(system=MAIL_SYSTEM, prompt=prompt, schema=MAIL_SCHEMA,
                   max_tokens=max(MAX_TOKENS, 5000))
    parsed = result["parsed"]
    return {
        "tones": [
            {"k": "정중형", "desc": "격식·대외 공문", "text": parsed.get("polite") or ""},
            {"k": "간결형", "desc": "실무 담당자 간", "text": parsed.get("brief") or ""},
            {"k": "설득형", "desc": "제안·회신 유도", "text": parsed.get("persuasive") or ""},
        ],
        "risks": _exactly(parsed.get("risks"), 5),
        "model": result["model"],
        "usage": result["usage"],
    }


# ══════════════════════════════════════════════════════════════
# 🧮 수치 교차 확인 (카드 7)
#
# 산수는 브라우저가 직접 계산한다. 서버는 '전제와 맥락'만 본다 —
# 어떤 값을 어디서 가져왔는지, 정의가 흔들리지 않았는지.
# ══════════════════════════════════════════════════════════════
MAX_RECHECK_CHARS = 20_000

RECHECK_SCHEMA: Dict[str, Any] = {
    "type": "object",
    "properties": {
        "findings": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "claim": {"type": "string", "description": "문제가 될 수 있는 주장"},
                    "note": {"type": "string", "description": "전제·정의·출처에서 무엇이 불분명한지"},
                },
                "required": ["claim", "note"],
                "additionalProperties": False,
            },
            "description": "전제·정의·출처 관점의 지적. 없으면 빈 배열.",
        },
        "confidence": {"type": "string", "description": "이 답변을 그대로 쓸 수 있는지: 상 | 중 | 하"},
    },
    "required": ["findings", "confidence"],
    "additionalProperties": False,
}

RECHECK_SYSTEM = (
    "너는 숫자가 든 답변을 검토하는 역할이다. 단순 산수는 이미 별도로 다시 계산되었으니 "
    "네가 볼 것은 그 바깥이다 — 값의 출처가 밝혀져 있는지, 기간·범위·단위의 정의가 도중에 "
    "바뀌지 않았는지, 비교 대상이 같은 기준인지, 빠진 항목이 결론을 뒤집는지. "
    "산수가 맞는지 다시 따지지 마라. 문제가 없으면 findings를 빈 배열로 두고 confidence만 답하라. "
    "지적할 것이 없는데 억지로 만들어내지 마라. 한국어로 답하라."
)


def recheck_answer(answer: str) -> Dict[str, Any]:
    """숫자 답변의 전제·정의·출처를 짚는다 (산수는 클라이언트가 계산)."""
    answer = (answer or "").strip()
    if not answer:
        raise ValueError("검산할 답변이 비어 있습니다.")
    if len(answer) > MAX_RECHECK_CHARS:
        raise ValueError(f"답변이 너무 깁니다. {MAX_RECHECK_CHARS:,}자 이하로 줄여 주세요.")

    prompt = (
        "아래 답변에서 전제·정의·출처가 불분명한 지점을 짚어라. "
        "사칙연산 자체는 이미 따로 검산되었으니 다시 계산하지 마라.\n\n"
        f"<답변>\n{answer}\n</답변>"
    )
    result = _call(system=RECHECK_SYSTEM, prompt=prompt, schema=RECHECK_SCHEMA,
                   max_tokens=max(MAX_TOKENS, 4000))
    parsed = result["parsed"]
    return {
        "findings": _exactly(parsed.get("findings"), 6),
        "confidence": parsed.get("confidence") or "미표기",
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
