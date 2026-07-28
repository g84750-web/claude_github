import { create } from 'zustand';
import {
  EMPTY_PROJECT,
  type ApiConnConfig,
  type ConnStatus,
  type ProjectInfo,
  type ProjectInputMode,
} from '../types/project';
import { todayISO } from '../lib/date';
import { loadSession, saveSession } from '../lib/session';

export type ProjectViewMode = 'edit' | 'view';

interface ProjectState {
  info: ProjectInfo;
  mode: ProjectInputMode;
  view: ProjectViewMode;
  conn: ApiConnConfig;
  connStatus: ConnStatus;
  connMessage: string;

  setField: <K extends keyof ProjectInfo>(k: K, v: ProjectInfo[K]) => void;
  setMode: (m: ProjectInputMode) => void;
  setView: (v: ProjectViewMode) => void;
  setConnField: <K extends keyof ApiConnConfig>(k: K, v: ApiConnConfig[K]) => void;
  setConnStatus: (s: ConnStatus, message?: string) => void;

  save: () => { ok: boolean; errors: string[] };
  reset: () => void;
  hydrate: () => void;

  /** 필수 항목 충족 여부 — 비교검증 탭 활성화 조건 */
  isSaved: () => boolean;
}

const EMPTY_CONN: ApiConnConfig = { endpointUrl: '', bearerToken: '', projectId: '' };

const URL_RE = /^https?:\/\/.+/i;

/** 저장 전 필수·형식 검증 (설계서 4.7) */
export function validateProject(info: ProjectInfo): string[] {
  const errors: string[] = [];
  if (!info.projectName.trim()) errors.push('프로젝트명은 필수입니다.');
  if (!info.clientName.trim()) errors.push('고객사명은 필수입니다.');
  if (info.startDate && info.endDate && info.endDate < info.startDate) {
    errors.push('종료일은 시작일 이후여야 합니다.');
  }
  const urls: Array<[keyof ProjectInfo, string]> = [
    ['clientHomepageUrl', '고객사 홈페이지'],
    ['pmsUrl', 'PMS URL'],
    ['demoServerUrl', '데모 서버 URL'],
  ];
  for (const [field, label] of urls) {
    const v = String(info[field] ?? '').trim();
    if (v && !URL_RE.test(v)) errors.push(`${label}은(는) http:// 또는 https:// 로 시작해야 합니다.`);
  }
  return errors;
}

function initialInfo(): ProjectInfo {
  return { ...EMPTY_PROJECT, startDate: todayISO() };
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  info: initialInfo(),
  mode: 'manual',
  view: 'edit',
  conn: { ...EMPTY_CONN },
  connStatus: 'idle',
  connMessage: '',

  setField: (k, v) => set((s) => ({ info: { ...s.info, [k]: v } })),
  setMode: (m) => set({ mode: m }),
  setView: (v) => set({ view: v }),
  setConnField: (k, v) => set((s) => ({ conn: { ...s.conn, [k]: v } })),
  setConnStatus: (s, message = '') => set({ connStatus: s, connMessage: message }),

  save: () => {
    const info = get().info;
    const errors = validateProject(info);
    if (errors.length === 0) {
      saveSession({ projectInfo: info });
      set({ view: 'view' });
    }
    return { ok: errors.length === 0, errors };
  },

  reset: () => {
    saveSession({ projectInfo: {} });
    set({ info: initialInfo(), view: 'edit', connStatus: 'idle', connMessage: '' });
  },

  hydrate: () => {
    const { projectInfo } = loadSession();
    if (projectInfo && Object.keys(projectInfo).length > 0) {
      const info = { ...initialInfo(), ...projectInfo };
      set({ info, view: validateProject(info).length === 0 ? 'view' : 'edit' });
    }
  },

  isSaved: () => validateProject(get().info).length === 0,
}));

/**
 * API 연동 어댑터 — 실제 A10/OmniEsol API 스펙 확정 전까지 이 함수만 교체하면 된다.
 * [보안] bearerToken 값은 로그로 남기지 않는다.
 */
export function mapApiResponseToProjectInfo(json: unknown): Partial<ProjectInfo> {
  const j = (json ?? {}) as Record<string, unknown>;
  const pick = (...keys: string[]): string => {
    for (const k of keys) {
      const v = j[k];
      if (typeof v === 'string' && v.trim()) return v;
    }
    return '';
  };
  return {
    projectName: pick('projectName', 'project_name', 'name'),
    projectCode: pick('projectCode', 'project_code', 'code'),
    clientName: pick('clientName', 'client_name', 'customer'),
    pmName: pick('pmName', 'pm_name', 'manager'),
    startDate: pick('startDate', 'start_date').slice(0, 10),
    endDate: pick('endDate', 'end_date').slice(0, 10),
    clientHomepageUrl: pick('clientHomepageUrl', 'homepage_url'),
    pmsUrl: pick('pmsUrl', 'pms_url'),
    demoServerUrl: pick('demoServerUrl', 'demo_url'),
    note: pick('note', 'remark'),
  };
}

/** 프로젝트 API 조회 */
export async function fetchProjectFromApi(cfg: ApiConnConfig): Promise<Partial<ProjectInfo>> {
  const res = await fetch(cfg.endpointUrl, {
    headers: {
      Authorization: `Bearer ${cfg.bearerToken}`,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) throw new Error(`API 응답 오류: ${res.status}`);
  return mapApiResponseToProjectInfo(await res.json());
}
