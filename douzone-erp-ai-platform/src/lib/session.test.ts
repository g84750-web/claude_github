import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearSession,
  isLiveMode,
  loadApiKey,
  loadSession,
  maskApiKey,
  saveApiKey,
  saveSession,
} from './session';
import type { ExecRecord } from '../types/kpi';
import type { StageIndex } from '../types/domain';

const rec: ExecRecord = {
  timestamp: new Date(2026, 4, 22, 10, 0, 0).toISOString(),
  product: 'A10',
  moduleId: 'FI',
  stageIndex: 0 as StageIndex,
  itemId: 'FI-0-01',
  task: '재무 프로세스 인터뷰 자동 구조화',
  type: 'semi',
  hours: 3,
  liveApi: false,
};

beforeEach(() => {
  sessionStorage.clear();
});

describe('session — 저장 / 복원 / 삭제', () => {
  it('비어 있으면 빈 객체를 반환한다', () => {
    expect(loadSession()).toEqual({});
  });

  it('저장한 실행 이력을 복원한다', () => {
    saveSession({ execLog: [rec] });
    expect(loadSession().execLog).toEqual([rec]);
  });

  it('부분 저장 시 기존 값을 보존한다', () => {
    saveSession({ execLog: [rec] });
    saveSession({ projectInfo: { projectName: '더존 ERP 구축' } });
    const s = loadSession();
    expect(s.execLog).toHaveLength(1);
    expect(s.projectInfo?.projectName).toBe('더존 ERP 구축');
  });

  it('삭제 후에는 빈 객체가 된다', () => {
    saveSession({ execLog: [rec] });
    clearSession();
    expect(loadSession()).toEqual({});
  });

  it('손상된 JSON 은 조용히 무시한다', () => {
    sessionStorage.setItem('dz_ai_v3', '{ 깨진 JSON');
    expect(loadSession()).toEqual({});
  });

  it('localStorage 는 사용하지 않는다', () => {
    saveSession({ execLog: [rec] });
    expect(localStorage.length).toBe(0);
  });
});

describe('API Key', () => {
  const key = 'sk-ant-테스트키값1234567890abcdef';

  it('저장 후 복원된다', () => {
    saveApiKey(key);
    expect(loadApiKey()).toBe(key);
  });

  it('미저장 시 빈 문자열을 반환한다', () => {
    expect(loadApiKey()).toBe('');
  });

  it('sessionStorage 에만 저장된다', () => {
    saveApiKey(key);
    expect(localStorage.getItem('dz_ai_v3')).toBeNull();
    expect(sessionStorage.getItem('dz_ai_v3')).toContain('apiKey');
  });

  it('20자 초과 시 라이브 모드로 판정한다', () => {
    expect(isLiveMode(key)).toBe(true);
    expect(isLiveMode('짧은키')).toBe(false);
    expect(isLiveMode('   ')).toBe(false);
    expect(isLiveMode('a'.repeat(20))).toBe(false);
    expect(isLiveMode('a'.repeat(21))).toBe(true);
  });

  it('마스킹은 앞 7자만 남긴다', () => {
    const masked = maskApiKey(key);
    expect(masked.startsWith(key.slice(0, 7))).toBe(true);
    expect(masked).not.toContain(key.slice(7));
    expect(maskApiKey('')).toBe('');
  });
});
