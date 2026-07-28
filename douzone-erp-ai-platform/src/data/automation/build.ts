import type { AutomationItem, StageItemMap } from '../../types/automation';
import { STAGES, type StageName } from '../../types/domain';

/** 데이터 파일 작성용 원본 항목 — id 는 빌더가 부여한다 */
export type RawItem = Omit<AutomationItem, 'id'>;

/** 단계명 → 원본 항목 배열 */
export type RawStageMap = Record<StageName, RawItem[]>;

/**
 * 모듈 원본 데이터에 결정론적 ID 를 부여한다.
 * ID 규칙: `{모듈ID}-{단계인덱스}-{순번 2자리}` (예: 'FI-0-01')
 *
 * 수기로 ID 를 적지 않으므로 중복·오타가 구조적으로 발생하지 않는다.
 */
export function buildModuleData(moduleId: string, raw: RawStageMap): StageItemMap {
  const out = {} as StageItemMap;
  STAGES.forEach((stage, stageIndex) => {
    const items = raw[stage] ?? [];
    out[stage] = items.map((item, i) => ({
      id: `${moduleId}-${stageIndex}-${String(i + 1).padStart(2, '0')}`,
      ...item,
    }));
  });
  return out;
}

/** 단계 맵의 전체 항목 수 */
export function countItems(map: StageItemMap): number {
  return STAGES.reduce((acc, s) => acc + (map[s]?.length ?? 0), 0);
}
