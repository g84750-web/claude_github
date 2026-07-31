import { describe, expect, it, vi } from 'vitest';
import { buildMockLawResponse, buildMockResponse, typeOut, type MockContext } from './mockResponse';
import { hasUnresolvedToken } from './tokens';
import type { AutomationType } from '../types/automation';

const BASE = new Date(2026, 4, 22, 12, 0, 0);

const ctx = (type: AutomationType): MockContext => ({
  item: {
    id: 'FI-0-01',
    type,
    task: '3개년 비교재무제표 범위 확인 ({ppy}~{cy}년)',
    tool: '비교재무 분석 AI',
    hours: 3,
  },
  product: 'A10',
  moduleId: 'FI',
  moduleName: '재무회계',
  stage: '착수·분석',
  base: BASE,
});

describe('buildMockResponse — 3타입', () => {
  const types: AutomationType[] = ['auto', 'semi', 'asst'];

  it.each(types)('%s 타입 응답을 생성한다', (t) => {
    const out = buildMockResponse(ctx(t));
    expect(out.length).toBeGreaterThan(200);
    expect(out).toContain('시뮬레이션 모드');
  });

  it.each(types)('%s 응답 헤더에 기준일·비교연도를 동적 삽입한다', (t) => {
    const out = buildMockResponse(ctx(t));
    expect(out).toContain('2026-05-22');
    expect(out).toContain('2024/2025/2026');
  });

  it('타입별로 서로 다른 본문 구조를 갖는다', () => {
    expect(buildMockResponse(ctx('auto'))).toContain('처리 체크리스트');
    expect(buildMockResponse(ctx('semi'))).toContain('담당자 확인 체크리스트');
    expect(buildMockResponse(ctx('asst'))).toContain('K-IFRS 18 체크포인트');
  });

  it('항목 문자열의 날짜 토큰을 치환한다', () => {
    const out = buildMockResponse(ctx('semi'));
    expect(hasUnresolvedToken(out)).toBe(false);
  });

  it('절감 공수를 항목 값으로 표기한다', () => {
    expect(buildMockResponse(ctx('auto'))).toContain('약 3시간');
  });
});

describe('buildMockLawResponse', () => {
  it('질의와 기준일을 포함한다', () => {
    const out = buildMockLawResponse('K-IFRS 18 도입 일정은?', BASE);
    expect(out).toContain('K-IFRS 18 도입 일정은?');
    expect(out).toContain('2026-05-22');
    expect(hasUnresolvedToken(out)).toBe(false);
  });
});

describe('typeOut', () => {
  it('전체 텍스트를 조각으로 나눠 출력한 뒤 완료한다', () => {
    vi.useFakeTimers();
    const text = '가나다라마바사아자차';
    let acc = '';
    let done = '';
    typeOut(text, (c) => (acc += c), (f) => (done = f), 4, 5);
    vi.advanceTimersByTime(5 * 10);
    expect(acc).toBe(text);
    expect(done).toBe(text);
    vi.useRealTimers();
  });

  it('취소 시 출력이 중단된다', () => {
    vi.useFakeTimers();
    const text = 'a'.repeat(400);
    let acc = '';
    const cancel = typeOut(text, (c) => (acc += c), () => {}, 4, 5);
    vi.advanceTimersByTime(5 * 3);
    cancel();
    vi.advanceTimersByTime(5 * 200);
    expect(acc.length).toBeLessThan(text.length);
    vi.useRealTimers();
  });

  it('빈 문자열도 완료 콜백을 호출한다', () => {
    vi.useFakeTimers();
    let done: string | null = null;
    typeOut('', () => {}, (f) => (done = f), 4, 5);
    vi.advanceTimersByTime(10);
    expect(done).toBe('');
    vi.useRealTimers();
  });
});
