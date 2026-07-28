import type { ExecRecord } from '../types/kpi';
import type { ProjectInfo } from '../types/project';

/**
 * 세션 저장소 래퍼
 *
 * [절대 제약]
 *  · localStorage 금지 — sessionStorage 만 사용한다(탭 종료 시 자동 폐기).
 *  · API Key 는 사용자 입력 → sessionStorage → 메모리 전달만 허용하며
 *    콘솔·네트워크 로그·에러 메시지 어디에도 값을 출력하지 않는다.
 */

const SESSION_KEY = 'dz_ai_v3';

export interface SessionData {
  execLog: ExecRecord[];
  projectInfo: Partial<ProjectInfo>;
  /** [보안] 값 자체를 로그로 남기지 않는다 */
  apiKey: string;
}

/** sessionStorage 가용 여부 (SSR·프라이빗 모드 방어) */
function store(): Storage | null {
  try {
    if (typeof sessionStorage === 'undefined') return null;
    return sessionStorage;
  } catch {
    return null;
  }
}

export function loadSession(): Partial<SessionData> {
  const s = store();
  if (!s) return {};
  try {
    const raw = s.getItem(SESSION_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Partial<SessionData>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    // 손상된 값은 조용히 버린다 — 내용을 로그로 남기지 않는다
    return {};
  }
}

export function saveSession(data: Partial<SessionData>): void {
  const s = store();
  if (!s) return;
  try {
    const prev = loadSession();
    s.setItem(SESSION_KEY, JSON.stringify({ ...prev, ...data }));
  } catch {
    // 저장 실패 시에도 데이터 내용을 로그에 남기지 않는다
    console.warn('[session] 세션 저장에 실패했습니다.');
  }
}

export function clearSession(): void {
  const s = store();
  if (!s) return;
  try {
    s.removeItem(SESSION_KEY);
  } catch {
    /* noop */
  }
}

/** API Key 저장 (값 로깅 금지) */
export function saveApiKey(apiKey: string): void {
  saveSession({ apiKey });
}

/** API Key 복원 — 없으면 빈 문자열 */
export function loadApiKey(): string {
  return loadSession().apiKey ?? '';
}

/** 라이브 모드 판정 — 20자 초과 시 실제 API 호출 */
export function isLiveMode(apiKey: string): boolean {
  return apiKey.trim().length > 20;
}

/** 로그·화면 표시용 마스킹 (앞 7자만 노출) */
export function maskApiKey(apiKey: string): string {
  const k = apiKey.trim();
  if (!k) return '';
  return `${k.slice(0, 7)}${'•'.repeat(Math.max(0, Math.min(24, k.length - 7)))}`;
}
