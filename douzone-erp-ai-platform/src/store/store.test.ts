import { beforeEach, describe, expect, it } from 'vitest';
import { hydrateAll, useAppStore, useApiStore, useExecStore, useProjectStore, useSimStore } from './index';
import { validateProject } from './useProjectStore';
import { SIM_DEFAULTS } from '../lib/simulator';
import { EMPTY_PROJECT } from '../types/project';
import type { ExecRecord } from '../types/kpi';
import type { StageIndex } from '../types/domain';

const rec = (i: number, type: ExecRecord['type'] = 'auto'): ExecRecord => ({
  timestamp: new Date(2026, 4, 22, 10, 0, i).toISOString(),
  product: 'A10',
  moduleId: 'FI',
  stageIndex: 0 as StageIndex,
  itemId: `FI-0-${String(i).padStart(2, '0')}`,
  task: `항목 ${i}`,
  type,
  hours: 2,
  liveApi: false,
});

beforeEach(() => {
  sessionStorage.clear();
  useExecStore.getState().clearAll();
  useProjectStore.getState().reset();
  useApiStore.setState({ apiKey: '', savedAt: null });
  useAppStore.setState({ product: 'A10', moduleId: 'FI', stageIndex: 0, activeTab: 0, activeLawTab: 0 });
  useSimStore.setState({ ...SIM_DEFAULTS, ftAnnualCount: 20 });
});

describe('useAppStore', () => {
  it('제품 전환 시 기본 모듈·1단계로 리셋한다', () => {
    const s = useAppStore.getState();
    s.setModule('FA');
    s.setStage(4);
    s.setProduct('OE');

    const next = useAppStore.getState();
    expect(next.product).toBe('OE');
    expect(next.moduleId).toBe('FIN');
    expect(next.stageIndex).toBe(0);
  });

  it('A10 으로 돌아오면 FI 가 기본이다', () => {
    useAppStore.getState().setProduct('OE');
    useAppStore.getState().setProduct('A10');
    expect(useAppStore.getState().moduleId).toBe('FI');
  });

  it('법령 카드 액션은 탭3 + 지정 서브탭으로 이동한다', () => {
    useAppStore.getState().gotoLawTab(2);
    expect(useAppStore.getState().activeTab).toBe(3);
    expect(useAppStore.getState().activeLawTab).toBe(2);
  });
});

describe('useExecStore', () => {
  it('실행 이력을 누적하고 KPI 를 재계산한다', () => {
    const s = useExecStore.getState();
    s.pushRecord(rec(1, 'auto'));
    s.pushRecord(rec(2, 'semi'));

    const kpi = useExecStore.getState().kpi;
    expect(kpi.execCount).toBe(2);
    expect(kpi.totalHours).toBe(4);
    expect(kpi.autoCount).toBe(1);
    expect(kpi.semiCount).toBe(1);
    expect(kpi.draftRate).toBe(50);
  });

  it('실행 이력을 sessionStorage 에 동기화한다', () => {
    useExecStore.getState().pushRecord(rec(1));
    expect(sessionStorage.getItem('dz_ai_v3')).toContain('FI-0-01');
  });

  it('복원 시 해당 카드가 완료 상태가 된다', () => {
    useExecStore.getState().pushRecord(rec(1));
    useExecStore.setState({ log: [], cardStates: {} });

    hydrateAll();
    const s = useExecStore.getState();
    expect(s.log).toHaveLength(1);
    expect(s.cardStates['FI-0-01']).toBe('done');
  });

  it('카드 상태 머신을 전이한다', () => {
    const s = useExecStore.getState();
    s.setCardState('FI-0-01', 'running');
    expect(useExecStore.getState().cardStates['FI-0-01']).toBe('running');
    s.setCardState('FI-0-01', 'error');
    expect(useExecStore.getState().cardStates['FI-0-01']).toBe('error');
  });

  it('결과 스트리밍 텍스트를 누적한다', () => {
    const s = useExecStore.getState();
    s.startResult('FI-0-01', '테스트 항목', false);
    s.appendResultText('가나');
    s.appendResultText('다라');
    s.finishResult('done');

    const r = useExecStore.getState().currentResult;
    expect(r?.text).toBe('가나다라');
    expect(r?.status).toBe('done');
  });

  it('전체 초기화 시 이력·카드·결과가 모두 비워진다', () => {
    const s = useExecStore.getState();
    s.pushRecord(rec(1));
    s.setCardState('FI-0-01', 'done');
    s.startResult('FI-0-01', '테스트', false);

    s.clearAll();
    const next = useExecStore.getState();
    expect(next.log).toEqual([]);
    expect(next.cardStates).toEqual({});
    expect(next.currentResult).toBeNull();
    expect(next.kpi.execCount).toBe(0);
  });
});

describe('useProjectStore', () => {
  it('필수 항목 미입력 시 저장을 거부한다', () => {
    const { ok, errors } = useProjectStore.getState().save();
    expect(ok).toBe(false);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('필수 항목 입력 후 저장하면 보기 모드로 전환된다', () => {
    const s = useProjectStore.getState();
    s.setField('projectName', '더존 ERP 구축');
    s.setField('clientName', '테스트 고객사');

    const { ok } = useProjectStore.getState().save();
    expect(ok).toBe(true);
    expect(useProjectStore.getState().view).toBe('view');
    expect(sessionStorage.getItem('dz_ai_v3')).toContain('더존 ERP 구축');
  });

  it('시작일 기본값은 실행일이며 하드코딩되지 않는다', () => {
    const start = useProjectStore.getState().info.startDate;
    expect(start).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(start.slice(0, 4)).toBe(String(new Date().getFullYear()));
  });

  it('URL 형식과 기간 역전을 검증한다', () => {
    const base = { ...EMPTY_PROJECT, projectName: 'P', clientName: 'C' };
    expect(validateProject({ ...base, pmsUrl: 'ftp://x' })).toHaveLength(1);
    expect(validateProject({ ...base, pmsUrl: 'https://pms.example.com' })).toHaveLength(0);
    expect(
      validateProject({ ...base, startDate: '2026-05-22', endDate: '2026-01-01' })
    ).toHaveLength(1);
  });
});

describe('useApiStore', () => {
  const key = 'sk-ant-키값1234567890abcdefghij';

  it('키 길이로 모드를 판정한다', () => {
    expect(useApiStore.getState().isLive()).toBe(false);
    expect(useApiStore.getState().modeLabel()).toBe('시뮬레이션 모드');

    useApiStore.getState().setApiKey(key);
    expect(useApiStore.getState().isLive()).toBe(true);
    expect(useApiStore.getState().modeLabel()).toBe('Claude AI 모드');
  });

  it('저장 후 세션에서 복원된다', () => {
    useApiStore.getState().setApiKey(key);
    useApiStore.getState().save();
    useApiStore.setState({ apiKey: '' });

    hydrateAll();
    expect(useApiStore.getState().apiKey).toBe(key);
  });
});

describe('useSimStore', () => {
  it('기본 슬라이더 값으로 시작한다', () => {
    const s = useSimStore.getState();
    expect(s.dauRate).toBe(70);
    expect(s.draftRate).toBe(50);
    expect(s.tcRate).toBe(40);
    expect(s.pmProjects).toBe(2);
  });

  it('수동 조작은 즉시 반영된다', () => {
    useSimStore.getState().setValue('dauRate', 95);
    expect(useSimStore.getState().dauRate).toBe(95);
  });
});
