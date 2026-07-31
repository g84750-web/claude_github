export { useAppStore } from './useAppStore';
export type { TabIndex, LawTabIndex } from './useAppStore';
export { useExecStore } from './useExecStore';
export type { CurrentResult, ResultStatus } from './useExecStore';
export {
  useProjectStore,
  validateProject,
  fetchProjectFromApi,
  mapApiResponseToProjectInfo,
} from './useProjectStore';
export type { ProjectViewMode } from './useProjectStore';
export { useApiStore } from './useApiStore';
export { useSimStore } from './useSimStore';

import { useApiStore } from './useApiStore';
import { useExecStore } from './useExecStore';
import { useProjectStore } from './useProjectStore';

/** 앱 기동 시 sessionStorage → 전 스토어 복원 */
export function hydrateAll(): void {
  useExecStore.getState().hydrate();
  useProjectStore.getState().hydrate();
  useApiStore.getState().hydrate();
}
