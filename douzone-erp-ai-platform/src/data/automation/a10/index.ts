import type { ModuleDataMap } from '../../../types/automation';
import { A10_MODULE_IDS } from '../../modules';
import { normalizeStageKeys } from '../../../lib/normalize';
import { FI } from './fi';
import { CO } from './co';
import { MM } from './mm';
import { SD } from './sd';
import { PP } from './pp';
import { HCM } from './hcm';
import { FA } from './fa';

/** A10 (Amaranth10) 자동화 항목 — 7개 모듈 × 5단계 = 35슬롯 */
export const A10_DATA: ModuleDataMap = normalizeStageKeys({
  FI,
  CO,
  MM,
  SD,
  PP,
  HCM,
  FA,
});

export { A10_MODULE_IDS };
