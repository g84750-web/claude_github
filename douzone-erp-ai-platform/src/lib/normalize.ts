import type { ModuleDataMap, StageItemMap } from '../types/automation';
import { STAGES, type StageName } from '../types/domain';

/**
 * [중요] 단계 키 표기 정규화
 *
 * 개발 이력상 '착수·분析', '착수·分析', '이행·安定化' 등 한자 혼용 오타로
 * 데이터 조회 실패가 반복 발생했다. 빌드 타임 검증(assertDataCompleteness) 과
 * 런타임 정규화(normalizeStageKeys) 로 이중 방어한다.
 *
 * 이 파일은 교정 대상 오표기를 변환표로 보유해야 하므로,
 * 제약 검증 스크립트(validate-constraints)의 한자 검사 예외로 등록되어 있다.
 * 그 외 어떤 소스에서도 한자 표기를 사용해서는 안 된다.
 */
const STAGE_KEY_VARIANTS: Record<string, StageName> = {
  '착수·분析': '착수·분석',
  '착수·分析': '착수·분석',
  '착수·分석': '착수·분석',
  '이행·安定化': '이행·안정화',
  '이행·안定化': '이행·안정화',
  '이행·安정화': '이행·안정화',
};

/** 단일 단계 키를 정본 표기로 교정 */
export function canonicalStageKey(key: string): string {
  return STAGE_KEY_VARIANTS[key] ?? key;
}

/**
 * 모듈 데이터의 단계 키를 정본 표기로 교정한다.
 * 같은 단계로 합쳐지는 키가 여러 개면 항목 배열을 병합하며,
 * 5단계 키는 항상 존재하도록 보장한다(미정의 시 빈 배열).
 */
export function normalizeStageKeys(data: ModuleDataMap): ModuleDataMap {
  const out: ModuleDataMap = {};

  for (const [modId, stages] of Object.entries(data)) {
    const fixed: Partial<StageItemMap> = {};

    for (const [key, items] of Object.entries(stages)) {
      const canonical = canonicalStageKey(key) as StageName;
      fixed[canonical] = [...(fixed[canonical] ?? []), ...items];
    }

    // 5단계 키 존재 보장
    for (const stage of STAGES) {
      if (!fixed[stage]) fixed[stage] = [];
    }

    out[modId] = fixed as StageItemMap;
  }

  return out;
}

/**
 * 빌드/테스트 타임 데이터 완전성 검증.
 * 모듈 누락 / 단계별 최소 건수 미달 / 비정규 단계 키 / 항목 필드 결손을 모두 잡는다.
 */
export function assertDataCompleteness(
  data: ModuleDataMap,
  moduleIds: readonly string[],
  minPerStage = 2
): void {
  const errors: string[] = [];
  const canonical = new Set<string>(STAGES);

  for (const modId of moduleIds) {
    const stages = data[modId];
    if (!stages) {
      errors.push(`모듈 누락: ${modId}`);
      continue;
    }

    // 비정규 단계 키 검사 — 실제 데이터 키를 정본 목록과 대조한다
    for (const key of Object.keys(stages)) {
      if (!canonical.has(key)) {
        errors.push(`${modId} : 비정규 단계 키 '${key}'`);
      }
    }

    for (const stage of STAGES) {
      const items = stages[stage];
      if (!items || items.length < minPerStage) {
        errors.push(
          `${modId} / ${stage} : ${items?.length ?? 0}건 (최소 ${minPerStage}건 필요)`
        );
        continue;
      }
      items.forEach((item, i) => {
        if (!item.id) errors.push(`${modId} / ${stage} #${i + 1} : id 누락`);
        if (!item.task) errors.push(`${modId} / ${stage} #${i + 1} : task 누락`);
        if (!item.tool) errors.push(`${modId} / ${stage} #${i + 1} : tool 누락`);
        if (!(item.hours > 0)) {
          errors.push(`${modId} / ${stage} #${i + 1} : hours 값 오류 (${item.hours})`);
        }
      });
    }
  }

  if (errors.length) {
    throw new Error(`[데이터 완전성 검증 실패]\n${errors.join('\n')}`);
  }
}

/** 항목 ID 전역 중복 검사 */
export function assertUniqueIds(...maps: ModuleDataMap[]): number {
  const seen = new Set<string>();
  const dup: string[] = [];

  for (const map of maps) {
    for (const stages of Object.values(map)) {
      for (const items of Object.values(stages)) {
        for (const item of items) {
          if (seen.has(item.id)) dup.push(item.id);
          seen.add(item.id);
        }
      }
    }
  }

  if (dup.length) throw new Error(`[ID 중복]\n${[...new Set(dup)].join(', ')}`);
  return seen.size;
}
