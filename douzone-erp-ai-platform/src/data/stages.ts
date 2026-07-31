import { STAGES, type StageName, type StageIndex } from '../types/domain';

export { STAGES };
export type { StageName, StageIndex };

/** 단계 메타 — 사이드바 번호 표시용 */
export interface StageDef {
  index: StageIndex;
  name: StageName;
  /** 화면 표시 번호 (1-base) */
  no: number;
}

export const STAGE_DEFS: readonly StageDef[] = STAGES.map((name, i) => ({
  index: i as StageIndex,
  name,
  no: i + 1,
}));

/** 빈 단계 맵 생성 — 5단계 키를 항상 보장 */
export function emptyStageMap<T>(): Record<StageName, T[]> {
  return {
    [STAGES[0]]: [],
    [STAGES[1]]: [],
    [STAGES[2]]: [],
    [STAGES[3]]: [],
    [STAGES[4]]: [],
  } as Record<StageName, T[]>;
}
