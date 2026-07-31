import type { ModuleDataMap } from '../../../types/automation';
import { OE_MODULE_IDS } from '../../modules';
import { normalizeStageKeys } from '../../../lib/normalize';
import { FIN } from './fin';
import { TAX } from './tax';
import { HRM } from './hrm';
import { PUR } from './pur';
import { SLS } from './sls';
import { RPT } from './rpt';

/** OmniEsol 자동화 항목 — 6개 모듈 × 5단계 = 30슬롯 */
export const OE_DATA: ModuleDataMap = normalizeStageKeys({
  FIN,
  TAX,
  HRM,
  PUR,
  SLS,
  RPT,
});

export { OE_MODULE_IDS };
