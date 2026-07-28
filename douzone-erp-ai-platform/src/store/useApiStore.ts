import { create } from 'zustand';
import { isLiveMode, loadApiKey, saveApiKey } from '../lib/session';

interface ApiState {
  /** [보안] 화면 입력값 — 로그·직렬화 대상에서 제외한다 */
  apiKey: string;
  /** 저장 완료 피드백 (2초) */
  savedAt: number | null;

  setApiKey: (k: string) => void;
  save: () => void;
  clearSavedFlag: () => void;
  hydrate: () => void;

  /** 파생값 — 20자 초과 시 라이브 모드 */
  isLive: () => boolean;
  modeLabel: () => string;
}

export const useApiStore = create<ApiState>((set, get) => ({
  apiKey: '',
  savedAt: null,

  setApiKey: (k) => set({ apiKey: k }),

  save: () => {
    saveApiKey(get().apiKey);
    set({ savedAt: Date.now() });
  },

  clearSavedFlag: () => set({ savedAt: null }),

  hydrate: () => {
    const k = loadApiKey();
    if (k) set({ apiKey: k });
  },

  isLive: () => isLiveMode(get().apiKey),
  modeLabel: () => (isLiveMode(get().apiKey) ? 'Claude AI 모드' : '시뮬레이션 모드'),
}));
