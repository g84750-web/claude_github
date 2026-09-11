"""AI 글로벌 뉴스 톡 — 설정 동기화 저장소

동기화 코드 1개당 설정 페이로드 1개를 SQLite에 보관한다.
계정·비밀번호 없이 코드 자체가 자격증명이므로, 코드는 추측하기 어려운
길이로 발급하고 조회 실패는 호출한 쪽에서 속도 제한을 걸 수 있도록
예외 대신 None으로 알린다.
"""

from __future__ import annotations

import json
import secrets
import sqlite3
import threading
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, Optional

# 사람이 받아적기 쉽도록 혼동되는 글자(I, O, 0, 1)를 뺀 32자 알파벳
CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
CODE_PREFIX = "DZAI"
CODE_GROUPS = 3
CODE_GROUP_LEN = 4

# 32^12 ≈ 1.15e18 — 무작위 대입으로 찾기 어려운 공간
CODE_BODY_LEN = CODE_GROUPS * CODE_GROUP_LEN

MAX_PAYLOAD_BYTES = 64 * 1024


class PayloadTooLarge(ValueError):
    """페이로드가 허용 크기를 넘었다."""


class InvalidPayload(ValueError):
    """페이로드가 JSON 객체가 아니다."""


class InvalidCode(ValueError):
    """동기화 코드 형식이 올바르지 않다."""


@dataclass
class Record:
    code: str
    payload: Dict[str, Any]
    rev: int
    updated_at: str
    created_at: str


@dataclass
class PutResult:
    """저장 결과. conflict=True면 record는 서버의 현재 상태다."""

    record: Record
    conflict: bool


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def generate_code() -> str:
    """DZAI-XXXX-XXXX-XXXX 형식의 동기화 코드를 발급한다."""
    body = "".join(secrets.choice(CODE_ALPHABET) for _ in range(CODE_BODY_LEN))
    groups = [body[i : i + CODE_GROUP_LEN] for i in range(0, CODE_BODY_LEN, CODE_GROUP_LEN)]
    return "-".join([CODE_PREFIX] + groups)


def normalize_code(raw: str) -> str:
    """사용자가 입력한 코드를 정규형으로 바꾼다.

    대소문자, 하이픈, 공백을 흡수한다. 형식이 맞지 않으면 InvalidCode.
    """
    if not isinstance(raw, str):
        raise InvalidCode("코드는 문자열이어야 합니다.")

    cleaned = "".join(ch for ch in raw.upper() if ch.isalnum())
    if cleaned.startswith(CODE_PREFIX):
        cleaned = cleaned[len(CODE_PREFIX) :]

    if len(cleaned) != CODE_BODY_LEN:
        raise InvalidCode("코드는 %d자여야 합니다." % CODE_BODY_LEN)
    if any(ch not in CODE_ALPHABET for ch in cleaned):
        raise InvalidCode("코드에 사용할 수 없는 문자가 있습니다.")

    groups = [cleaned[i : i + CODE_GROUP_LEN] for i in range(0, CODE_BODY_LEN, CODE_GROUP_LEN)]
    return "-".join([CODE_PREFIX] + groups)


def validate_payload(payload: Any) -> str:
    """페이로드를 검증하고 직렬화한 문자열을 돌려준다."""
    if not isinstance(payload, dict):
        raise InvalidPayload("설정 페이로드는 JSON 객체여야 합니다.")

    text = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    if len(text.encode("utf-8")) > MAX_PAYLOAD_BYTES:
        raise PayloadTooLarge(
            "설정 크기가 한도(%dKB)를 넘었습니다." % (MAX_PAYLOAD_BYTES // 1024)
        )
    return text


_SCHEMA = """
CREATE TABLE IF NOT EXISTS sync_data (
    code         TEXT PRIMARY KEY,
    payload      TEXT NOT NULL,
    rev          INTEGER NOT NULL DEFAULT 1,
    created_at   TEXT NOT NULL,
    updated_at   TEXT NOT NULL,
    last_seen_at TEXT NOT NULL
);
"""


class SyncStore:
    """동기화 데이터 저장소.

    SQLite 연결은 호출마다 열고 닫는다. 요청량이 크지 않고, 연결을
    공유하지 않으면 스레드 안전성을 따로 관리할 필요가 없다.
    """

    def __init__(self, db_path: str = "sync.db"):
        self.db_path = db_path
        self._lock = threading.Lock()
        if db_path != ":memory:":
            Path(db_path).parent.mkdir(parents=True, exist_ok=True)
        # :memory: 는 연결마다 별도 DB가 되므로 공유 연결을 하나 유지한다
        self._shared: Optional[sqlite3.Connection] = None
        if db_path == ":memory:":
            self._shared = sqlite3.connect(":memory:", check_same_thread=False)
            self._shared.row_factory = sqlite3.Row
        self._init_schema()

    @contextmanager
    def _conn(self):
        if self._shared is not None:
            with self._lock:
                yield self._shared
            return

        conn = sqlite3.connect(self.db_path, timeout=10)
        conn.row_factory = sqlite3.Row
        try:
            conn.execute("PRAGMA journal_mode=WAL")
            yield conn
        finally:
            conn.close()

    def _init_schema(self) -> None:
        with self._conn() as conn:
            conn.executescript(_SCHEMA)
            conn.commit()

    # ── 조회 ────────────────────────────────────────────────
    def get(self, code: str) -> Optional[Record]:
        code = normalize_code(code)
        with self._conn() as conn:
            row = conn.execute(
                "SELECT code, payload, rev, created_at, updated_at FROM sync_data WHERE code = ?",
                (code,),
            ).fetchone()
            if row is None:
                return None
            conn.execute(
                "UPDATE sync_data SET last_seen_at = ? WHERE code = ?", (_now(), code)
            )
            conn.commit()

        return Record(
            code=row["code"],
            payload=json.loads(row["payload"]),
            rev=row["rev"],
            updated_at=row["updated_at"],
            created_at=row["created_at"],
        )

    # ── 발급 ────────────────────────────────────────────────
    def create(self, payload: Optional[Dict[str, Any]] = None) -> Record:
        """새 동기화 코드를 발급한다. 충돌 시 최대 5회 재시도."""
        text = validate_payload(payload if payload is not None else {})
        now = _now()

        for _ in range(5):
            code = generate_code()
            try:
                with self._conn() as conn:
                    conn.execute(
                        "INSERT INTO sync_data (code, payload, rev, created_at, updated_at, last_seen_at)"
                        " VALUES (?, ?, 1, ?, ?, ?)",
                        (code, text, now, now, now),
                    )
                    conn.commit()
            except sqlite3.IntegrityError:
                continue  # 극히 드문 코드 충돌 — 다시 뽑는다

            return Record(
                code=code,
                payload=json.loads(text),
                rev=1,
                updated_at=now,
                created_at=now,
            )

        raise RuntimeError("동기화 코드 발급에 실패했습니다.")

    # ── 저장 ────────────────────────────────────────────────
    def put(
        self,
        code: str,
        payload: Dict[str, Any],
        base_rev: Optional[int] = None,
    ) -> Optional[PutResult]:
        """페이로드를 저장한다.

        base_rev를 주면 서버 rev와 다를 때 저장하지 않고 conflict=True와
        함께 서버의 현재 상태를 돌려준다(낙관적 동시성 제어).
        코드가 없으면 None.
        """
        code = normalize_code(code)
        text = validate_payload(payload)
        now = _now()

        with self._conn() as conn:
            row = conn.execute(
                "SELECT code, payload, rev, created_at, updated_at FROM sync_data WHERE code = ?",
                (code,),
            ).fetchone()
            if row is None:
                return None

            if base_rev is not None and base_rev != row["rev"]:
                return PutResult(
                    record=Record(
                        code=row["code"],
                        payload=json.loads(row["payload"]),
                        rev=row["rev"],
                        updated_at=row["updated_at"],
                        created_at=row["created_at"],
                    ),
                    conflict=True,
                )

            new_rev = row["rev"] + 1
            conn.execute(
                "UPDATE sync_data SET payload = ?, rev = ?, updated_at = ?, last_seen_at = ?"
                " WHERE code = ?",
                (text, new_rev, now, now, code),
            )
            conn.commit()
            created_at = row["created_at"]

        return PutResult(
            record=Record(
                code=code,
                payload=json.loads(text),
                rev=new_rev,
                updated_at=now,
                created_at=created_at,
            ),
            conflict=False,
        )

    # ── 삭제 ────────────────────────────────────────────────
    def delete(self, code: str) -> bool:
        code = normalize_code(code)
        with self._conn() as conn:
            cur = conn.execute("DELETE FROM sync_data WHERE code = ?", (code,))
            conn.commit()
            return cur.rowcount > 0

    # ── 유지보수 ────────────────────────────────────────────
    def purge_stale(self, days: int) -> int:
        """days일 이상 조회되지 않은 항목을 정리하고 삭제 건수를 돌려준다."""
        cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat(
            timespec="seconds"
        )
        with self._conn() as conn:
            cur = conn.execute("DELETE FROM sync_data WHERE last_seen_at < ?", (cutoff,))
            conn.commit()
            return cur.rowcount

    def count(self) -> int:
        with self._conn() as conn:
            return conn.execute("SELECT COUNT(*) AS n FROM sync_data").fetchone()["n"]
