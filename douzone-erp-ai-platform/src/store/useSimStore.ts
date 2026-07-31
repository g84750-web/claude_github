import { create } from 'zustand';
import { FT_DEFAULT_ANNUAL_COUNT, SIM_DEFAULTS, animateValue, type SimInput } from '../lib/simulator';

/**
 * 공수 시뮬레이터 슬라이더 상태.
 * 항목 실행 시 실제 실적 기반으로 자동 동기화되며(설계서 3.4),
 * 세션 초기화 시 기본값으로 애니메이션 복귀한다(설계서 4.9).
 */

type Cancel = () => void;

interface SimState extends SimInput {
  /** Fast Track 기준 연간 처리 건수 */
  ftAnnualCount: number;

  setValue: <K extends keyof SimInput>(k: K, v: number) => void;
  setFtAnnualCount: (v: number) => void;
  /** 실적 기반 값으로 ease-out 애니메이션 이동 */
  animateTo: (partial: Partial<SimInput>) => void;
  /** 기본값으로 애니메이션 복귀 */
  resetToDefault: () => void;
  /** 진행 중인 애니메이션 중단 */
  cancelAnimations: () => void;
}

const SLIDER_KEYS: Array<keyof SimInput> = ['dauRate', 'draftRate', 'tcRate', 'pmProjects'];

export const useSimStore = create<SimState>((set, get) => {
  const cancels = new Map<keyof SimInput, Cancel>();

  const stopAll = () => {
    cancels.forEach((c) => c());
    cancels.clear();
  };

  const animateKey = (k: keyof SimInput, to: number) => {
    cancels.get(k)?.();
    const from = get()[k];
    if (from === to) return;
    const cancel = animateValue(from, to, (v) => set({ [k]: v } as Pick<SimState, keyof SimInput>));
    cancels.set(k, cancel);
  };

  return {
    ...SIM_DEFAULTS,
    ftAnnualCount: FT_DEFAULT_ANNUAL_COUNT,

    setValue: (k, v) => {
      cancels.get(k)?.();
      set({ [k]: v } as Pick<SimState, keyof SimInput>);
    },

    setFtAnnualCount: (v) => set({ ftAnnualCount: v }),

    animateTo: (partial) => {
      for (const k of SLIDER_KEYS) {
        const to = partial[k];
        if (typeof to === 'number') animateKey(k, to);
      }
    },

    resetToDefault: () => {
      for (const k of SLIDER_KEYS) animateKey(k, SIM_DEFAULTS[k]);
      set({ ftAnnualCount: FT_DEFAULT_ANNUAL_COUNT });
    },

    cancelAnimations: stopAll,
  };
});
