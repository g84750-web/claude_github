import type { AutomationItem, ModuleDataMap } from '../../types/automation';
import type { ModuleId, ProductId, StageIndex } from '../../types/domain';
import { STAGES } from '../../types/domain';
import { A10_DATA, A10_MODULE_IDS } from './a10';
import { OE_DATA, OE_MODULE_IDS } from './omniesol';

export { A10_DATA, A10_MODULE_IDS, OE_DATA, OE_MODULE_IDS };

export const DATA_BY_PRODUCT: Record<ProductId, ModuleDataMap> = {
  A10: A10_DATA,
  OE: OE_DATA,
};

/** 제품·모듈·단계로 자동화 항목 조회 (미정의 시 빈 배열) */
export function itemsOf(
  product: ProductId,
  moduleId: ModuleId,
  stageIndex: StageIndex
): AutomationItem[] {
  const stage = STAGES[stageIndex];
  return DATA_BY_PRODUCT[product]?.[moduleId]?.[stage] ?? [];
}

/** 모듈의 5단계 전체 항목 수 (사이드바 카운터) */
export function moduleItemCount(product: ProductId, moduleId: ModuleId): number {
  const stages = DATA_BY_PRODUCT[product]?.[moduleId];
  if (!stages) return 0;
  return STAGES.reduce((acc, s) => acc + (stages[s]?.length ?? 0), 0);
}

/** 전체 자동화 항목 총 개수 (KPI 분모) */
export function totalItemCount(
  a10: ModuleDataMap = A10_DATA,
  oe: ModuleDataMap = OE_DATA
): number {
  const count = (d: ModuleDataMap) =>
    Object.values(d).reduce(
      (acc, stages) => acc + Object.values(stages).reduce((a, arr) => a + arr.length, 0),
      0
    );
  return count(a10) + count(oe);
}

/** 전 항목 평탄화 (검증·조회용) */
export function allItems(): Array<{
  product: ProductId;
  moduleId: ModuleId;
  stageIndex: StageIndex;
  item: AutomationItem;
}> {
  const out: ReturnType<typeof allItems> = [];
  (Object.keys(DATA_BY_PRODUCT) as ProductId[]).forEach((product) => {
    const map = DATA_BY_PRODUCT[product];
    Object.entries(map).forEach(([moduleId, stages]) => {
      STAGES.forEach((stage, si) => {
        (stages[stage] ?? []).forEach((item) => {
          out.push({
            product,
            moduleId: moduleId as ModuleId,
            stageIndex: si as StageIndex,
            item,
          });
        });
      });
    });
  });
  return out;
}
