import { act, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useRunItem } from './useRunItem';
import { useAppStore } from '../store/useAppStore';
import { useExecStore } from '../store/useExecStore';
import type { AutomationItem } from '../types/automation';

/**
 * 실행 오케스트레이션 회귀 테스트.
 * 카드 상태 전이는 사용자가 직접 복구할 수 없는 영역이라 반드시 고정한다.
 */

const ITEM_A: AutomationItem = {
  id: 'FI-0-01',
  type: 'semi',
  task: '항목 A',
  tool: 'Claude API',
  hours: 3,
};
const ITEM_B: AutomationItem = {
  id: 'FI-0-02',
  type: 'auto',
  task: '항목 B',
  tool: '매핑 AI',
  hours: 4,
};

/** 훅을 렌더해 run/cancel 핸들을 노출한다 */
function mountRunner() {
  const api: { run?: (i: AutomationItem) => void; cancel?: () => void } = {};
  function Probe() {
    const { run, cancel } = useRunItem();
    api.run = run;
    api.cancel = cancel;
    return null;
  }
  render(<Probe />);
  return api as { run: (i: AutomationItem) => void; cancel: () => void };
}

const cardState = (id: string) => useExecStore.getState().cardStates[id] ?? 'idle';

beforeEach(() => {
  sessionStorage.clear();
  useExecStore.getState().clearAll();
  useAppStore.setState({ product: 'A10', moduleId: 'FI', stageIndex: 0, activeTab: 0 });
});

describe('useRunItem — 카드 상태 전이', () => {
  it('실행 시 running, 완료 시 done 으로 전이하고 이력을 남긴다', () => {
    vi.useFakeTimers();
    const { run } = mountRunner();

    act(() => run(ITEM_A));
    expect(cardState(ITEM_A.id)).toBe('running');

    act(() => void vi.advanceTimersByTime(20_000));
    expect(cardState(ITEM_A.id)).toBe('done');
    expect(useExecStore.getState().log.map((r) => r.itemId)).toEqual([ITEM_A.id]);
    vi.useRealTimers();
  });

  it('진행 중 다른 항목을 실행하면 이전 카드가 idle 로 복구된다', () => {
    vi.useFakeTimers();
    const { run } = mountRunner();

    act(() => run(ITEM_A));
    act(() => void vi.advanceTimersByTime(30)); // A 진행 중
    expect(cardState(ITEM_A.id)).toBe('running');

    act(() => run(ITEM_B)); // A 완료 전에 B 실행

    // A 는 running 에 갇히지 않고 재시도 가능한 idle 이어야 한다
    expect(cardState(ITEM_A.id)).toBe('idle');
    expect(cardState(ITEM_B.id)).toBe('running');

    act(() => void vi.advanceTimersByTime(20_000));
    expect(cardState(ITEM_B.id)).toBe('done');
    // 중단된 A 는 이력에 남지 않는다
    expect(useExecStore.getState().log.map((r) => r.itemId)).toEqual([ITEM_B.id]);
    vi.useRealTimers();
  });

  it('중단 후 같은 항목을 다시 실행하면 정상 완료된다', () => {
    vi.useFakeTimers();
    const { run, cancel } = mountRunner();

    act(() => run(ITEM_A));
    act(() => void vi.advanceTimersByTime(30));
    act(() => cancel());
    expect(cardState(ITEM_A.id)).toBe('idle');

    act(() => run(ITEM_A));
    act(() => void vi.advanceTimersByTime(20_000));
    expect(cardState(ITEM_A.id)).toBe('done');
    vi.useRealTimers();
  });

  it('실행 시 AI 결과 탭으로 전환한다', () => {
    vi.useFakeTimers();
    useAppStore.setState({ activeTab: 4 });
    const { run } = mountRunner();

    act(() => run(ITEM_A));
    expect(useAppStore.getState().activeTab).toBe(0);
    act(() => void vi.advanceTimersByTime(20_000));
    vi.useRealTimers();
  });
});

describe('useExecStore — KPI 재계산 억제', () => {
  it('스트리밍 델타는 KPI 객체를 재생성하지 않는다', () => {
    const before = useExecStore.getState().kpi;

    useExecStore.getState().startResult('FI-0-01', '항목 A', false);
    for (let i = 0; i < 50; i++) useExecStore.getState().appendResultText('가나다라');

    // 이력이 변하지 않았으므로 동일 객체여야 한다 (셀렉터가 리렌더를 유발하지 않음)
    expect(useExecStore.getState().kpi).toBe(before);
  });

  it('이력이 바뀌면 KPI 가 갱신된다', () => {
    const before = useExecStore.getState().kpi;

    useExecStore.getState().pushRecord({
      timestamp: new Date(2026, 4, 22, 10, 0, 0).toISOString(),
      product: 'A10',
      moduleId: 'FI',
      stageIndex: 0,
      itemId: ITEM_A.id,
      task: ITEM_A.task,
      type: ITEM_A.type,
      hours: ITEM_A.hours,
      liveApi: false,
    });

    const after = useExecStore.getState().kpi;
    expect(after).not.toBe(before);
    expect(after.execCount).toBe(1);
    expect(after.totalHours).toBe(3);
  });
});
