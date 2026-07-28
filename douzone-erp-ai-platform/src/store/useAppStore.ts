import { create } from 'zustand';
import { DEFAULT_MODULE, type ModuleId, type ProductId, type StageIndex } from '../types/domain';

export type TabIndex = 0 | 1 | 2 | 3 | 4;
export type LawTabIndex = 0 | 1 | 2 | 3;

interface AppState {
  product: ProductId;
  moduleId: ModuleId;
  stageIndex: StageIndex;
  activeTab: TabIndex;
  activeLawTab: LawTabIndex;

  setProduct: (p: ProductId) => void;
  setModule: (m: ModuleId) => void;
  setStage: (i: StageIndex) => void;
  setTab: (t: TabIndex) => void;
  setLawTab: (t: LawTabIndex) => void;
  /** 법령 탭의 특정 서브탭으로 이동 (카드 액션 버튼) */
  gotoLawTab: (t: LawTabIndex) => void;
}

export const useAppStore = create<AppState>((set) => ({
  product: 'A10',
  moduleId: DEFAULT_MODULE.A10,
  stageIndex: 0,
  activeTab: 0,
  activeLawTab: 0,

  /**
   * 제품 전환 시 기본 모듈과 1단계로 리셋한다 (설계서 4.1).
   * 항목 카드는 파생 selector 로 자동 리렌더된다.
   */
  setProduct: (p) => set({ product: p, moduleId: DEFAULT_MODULE[p], stageIndex: 0 }),
  setModule: (m) => set({ moduleId: m }),
  setStage: (i) => set({ stageIndex: i }),
  setTab: (t) => set({ activeTab: t }),
  setLawTab: (t) => set({ activeLawTab: t }),
  gotoLawTab: (t) => set({ activeTab: 3, activeLawTab: t }),
}));
