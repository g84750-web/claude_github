import { create } from 'zustand';

export type ToastKind = 'ok' | 'warn' | 'error';

export interface ToastItem {
  id: number;
  message: string;
  kind: ToastKind;
}

interface ToastState {
  items: ToastItem[];
  show: (message: string, kind?: ToastKind, ms?: number) => void;
  dismiss: (id: number) => void;
}

let seq = 0;

export const useToastStore = create<ToastState>((set) => ({
  items: [],

  show: (message, kind = 'ok', ms = 2400) => {
    const id = ++seq;
    set((s) => ({ items: [...s.items, { id, message, kind }] }));
    setTimeout(() => set((s) => ({ items: s.items.filter((t) => t.id !== id) })), ms);
  },

  dismiss: (id) => set((s) => ({ items: s.items.filter((t) => t.id !== id) })),
}));

/** 컴포넌트 밖에서도 호출 가능한 단축 함수 */
export const toast = (message: string, kind: ToastKind = 'ok') =>
  useToastStore.getState().show(message, kind);
