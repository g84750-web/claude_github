import { create } from 'zustand';
import type { CardState } from '../types/automation';
import type { ExecRecord, KpiSnapshot } from '../types/kpi';
import { totalItemCount } from '../data/automation';
import { autoRatio, calcKpi } from '../lib/kpi';
import { loadSession, saveSession } from '../lib/session';

export type ResultStatus = 'idle' | 'running' | 'done' | 'error';

export interface CurrentResult {
  itemId: string;
  task: string;
  text: string;
  status: ResultStatus;
  /** 실제 API 호출 여부 */
  liveApi: boolean;
}

interface ExecState {
  log: ExecRecord[];
  cardStates: Record<string, CardState>;
  currentResult: CurrentResult | null;

  pushRecord: (r: ExecRecord) => void;
  setCardState: (itemId: string, s: CardState) => void;
  resetCardStates: () => void;

  startResult: (itemId: string, task: string, liveApi: boolean) => void;
  appendResultText: (delta: string) => void;
  finishResult: (status: ResultStatus) => void;
  clearResult: () => void;

  clearAll: () => void;
  hydrate: () => void;

  /**
   * 실행 이력이 바뀔 때만 갱신되는 KPI 스냅샷.
   *
   * 파생 함수(`kpi()`)로 두면 셀렉터가 호출마다 새 객체를 만들어,
   * 스트리밍 중 5ms 마다 발생하는 `appendResultText` 에도
   * 전 항목 순회 + 로그 6회 통과가 구독 컴포넌트 수만큼 반복된다.
   * 상태로 보관해 이력 변경 시점에만 계산한다.
   */
  kpi: KpiSnapshot;
  autoRatio: number;
  totalItems: number;
}

/** 실행 이력만 세션에 동기화한다 (프로젝트·API Key 는 각자 스토어가 관리) */
function persist(log: ExecRecord[]) {
  saveSession({ execLog: log });
}

/** 전 항목 수는 정적 데이터에서 나오므로 모듈 로드 시 한 번만 계산한다 */
const TOTAL_ITEMS = totalItemCount();

/** 이력 변경 시 함께 갱신할 파생값 묶음 */
function derive(log: ExecRecord[]) {
  return {
    log,
    kpi: calcKpi(log, TOTAL_ITEMS),
    autoRatio: autoRatio(log),
  };
}

export const useExecStore = create<ExecState>((set) => ({
  log: [],
  cardStates: {},
  currentResult: null,
  kpi: calcKpi([], TOTAL_ITEMS),
  autoRatio: 0,
  totalItems: TOTAL_ITEMS,

  pushRecord: (r) =>
    set((s) => {
      const log = [...s.log, r];
      persist(log);
      return derive(log);
    }),

  setCardState: (itemId, st) =>
    set((s) => ({ cardStates: { ...s.cardStates, [itemId]: st } })),

  resetCardStates: () => set({ cardStates: {} }),

  startResult: (itemId, task, liveApi) =>
    set({ currentResult: { itemId, task, text: '', status: 'running', liveApi } }),

  appendResultText: (delta) =>
    set((s) =>
      s.currentResult
        ? { currentResult: { ...s.currentResult, text: s.currentResult.text + delta } }
        : {}
    ),

  finishResult: (status) =>
    set((s) => (s.currentResult ? { currentResult: { ...s.currentResult, status } } : {})),

  clearResult: () => set({ currentResult: null }),

  /** 세션 전체 초기화 (설계서 4.9) */
  clearAll: () => {
    persist([]);
    set({ ...derive([]), cardStates: {}, currentResult: null });
  },

  /** sessionStorage → 스토어 복원 */
  hydrate: () => {
    const { execLog } = loadSession();
    if (Array.isArray(execLog) && execLog.length > 0) {
      // 복원된 이력의 항목은 완료 상태로 표시
      const cardStates: Record<string, CardState> = {};
      for (const r of execLog) cardStates[r.itemId] = 'done';
      set({ ...derive(execLog), cardStates });
    }
  },
}));
