import type { A10ModuleId, ModuleDef, ModuleId, OEModuleId, ProductId } from '../types/domain';

/** A10 (Amaranth10) 모듈 7종 */
export const A10_MODULES: readonly ModuleDef[] = [
  { id: 'FI', name: '재무회계', nameEn: 'Financial Accounting', product: 'A10' },
  { id: 'CO', name: '관리회계', nameEn: 'Controlling', product: 'A10' },
  { id: 'MM', name: '구매·자재', nameEn: 'Materials Mgmt', product: 'A10' },
  { id: 'SD', name: '영업·유통', nameEn: 'Sales & Distribution', product: 'A10' },
  { id: 'PP', name: '생산관리', nameEn: 'Production Planning', product: 'A10' },
  { id: 'HCM', name: '인사·급여', nameEn: 'Human Capital Mgmt', product: 'A10' },
  { id: 'FA', name: '고정자산', nameEn: 'Fixed Assets', product: 'A10' },
] as const;

/** OmniEsol 모듈 6종 */
export const OE_MODULES: readonly ModuleDef[] = [
  { id: 'FIN', name: '재무관리', nameEn: 'Financial Management', product: 'OE' },
  { id: 'TAX', name: '세무신고', nameEn: 'Tax Reporting', product: 'OE' },
  { id: 'HRM', name: '인사급여', nameEn: 'HR & Payroll', product: 'OE' },
  { id: 'PUR', name: '구매관리', nameEn: 'Procurement', product: 'OE' },
  { id: 'SLS', name: '영업CRM', nameEn: 'Sales & CRM', product: 'OE' },
  { id: 'RPT', name: '경영보고', nameEn: 'BI & Reporting', product: 'OE' },
] as const;

export const MODULES_BY_PRODUCT: Record<ProductId, readonly ModuleDef[]> = {
  A10: A10_MODULES,
  OE: OE_MODULES,
};

export const A10_MODULE_IDS = A10_MODULES.map((m) => m.id) as readonly A10ModuleId[];
export const OE_MODULE_IDS = OE_MODULES.map((m) => m.id) as readonly OEModuleId[];

const ALL_MODULES = [...A10_MODULES, ...OE_MODULES];

/** 모듈 정의 조회 */
export function findModule(id: ModuleId): ModuleDef | undefined {
  return ALL_MODULES.find((m) => m.id === id);
}

/** 모듈 한글명 조회 (미정의 시 ID 반환) */
export function moduleName(id: ModuleId): string {
  return findModule(id)?.name ?? id;
}

/** 해당 모듈이 속한 제품 판정 */
export function productOfModule(id: ModuleId): ProductId {
  return findModule(id)?.product ?? 'A10';
}
