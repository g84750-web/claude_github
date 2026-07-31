import { useCallback, useEffect, useRef } from 'react';
import type { AutomationItem } from '../types/automation';
import type { ExecRecord } from '../types/kpi';
import { moduleName } from '../data/modules';
import { totalItemCount } from '../data/automation';
import { stageNameOf } from '../types/domain';
import { buildItemPrompt, streamMessage } from '../lib/anthropic';
import { buildMockResponse, typeOut } from '../lib/mockResponse';
import { deriveSimFromLog } from '../lib/simulator';
import { useApiStore } from '../store/useApiStore';
import { useAppStore } from '../store/useAppStore';
import { useExecStore } from '../store/useExecStore';
import { useSimStore } from '../store/useSimStore';
import { toast } from '../store/useToastStore';

/**
 * 자동화 항목 실행 오케스트레이션 (설계서 4.4 / 6.1)
 *
 * idle → running → done(성공) / error(실패)
 * 완료 시: 실행 이력 적재 → KPI 재계산 → 시뮬레이터 슬라이더 자동 동기화
 */
export function useRunItem() {
  const product = useAppStore((s) => s.product);
  const moduleId = useAppStore((s) => s.moduleId);
  const stageIndex = useAppStore((s) => s.stageIndex);
  const setTab = useAppStore((s) => s.setTab);

  const apiKey = useApiStore((s) => s.apiKey);
  const live = useApiStore((s) => s.isLive());

  const setCardState = useExecStore((s) => s.setCardState);
  const startResult = useExecStore((s) => s.startResult);
  const appendResultText = useExecStore((s) => s.appendResultText);
  const finishResult = useExecStore((s) => s.finishResult);
  const pushRecord = useExecStore((s) => s.pushRecord);

  const animateTo = useSimStore((s) => s.animateTo);

  /** 진행 중인 스트림/타이핑 취소 핸들 */
  const cancelRef = useRef<(() => void) | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  /** 진행 중인 항목 ID — 중단 시 카드 상태를 되돌리기 위해 보관한다 */
  const runningIdRef = useRef<string | null>(null);

  /**
   * 진행 중인 실행을 중단하고 해당 카드를 idle 로 되돌린다.
   * 되돌리지 않으면 카드가 'running' 에 고착되어 버튼이 비활성 상태로 남는다.
   */
  const abortRunning = useCallback(() => {
    cancelRef.current?.();
    abortRef.current?.abort();
    cancelRef.current = null;
    abortRef.current = null;

    const prevId = runningIdRef.current;
    runningIdRef.current = null;
    if (prevId) setCardState(prevId, 'idle');
    return prevId;
  }, [setCardState]);

  // 언마운트 시 진행 중 작업 정리 (상태 갱신 없이 타이머만 해제)
  useEffect(
    () => () => {
      cancelRef.current?.();
      abortRef.current?.abort();
    },
    []
  );

  const complete = useCallback(
    (item: AutomationItem) => {
      const record: ExecRecord = {
        // [제약] 실행 시각은 런타임 산출
        timestamp: new Date().toISOString(),
        product,
        moduleId,
        stageIndex,
        itemId: item.id,
        task: item.task,
        type: item.type,
        hours: item.hours,
        liveApi: live,
      };

      runningIdRef.current = null;
      pushRecord(record);
      setCardState(item.id, 'done');
      finishResult('done');

      // 실행 실적 기반 슬라이더 자동 동기화
      const log = useExecStore.getState().log;
      animateTo(deriveSimFromLog(log, totalItemCount()));
    },
    [animateTo, finishResult, live, moduleId, product, pushRecord, setCardState, stageIndex]
  );

  const run = useCallback(
    (item: AutomationItem) => {
      // 진행 중인 다른 실행을 중단하고 그 카드를 idle 로 복구한다
      abortRunning();

      runningIdRef.current = item.id;
      setCardState(item.id, 'running');
      startResult(item.id, item.task, live);
      setTab(0);

      if (live) {
        const controller = new AbortController();
        abortRef.current = controller;
        cancelRef.current = () => controller.abort();

        void streamMessage({
          apiKey,
          userMessage: buildItemPrompt(
            item,
            product,
            moduleId,
            moduleName(moduleId),
            stageNameOf(stageIndex)
          ),
          onDelta: appendResultText,
          onDone: () => complete(item),
          onError: (err) => {
            runningIdRef.current = null;
            setCardState(item.id, 'error');
            finishResult('error');
            appendResultText(`\n\n[오류] ${err.message}`);
            toast('AI 호출에 실패했습니다. 재시도해 주세요.', 'error');
          },
          signal: controller.signal,
        });
        return;
      }

      // 시뮬레이션 모드
      const text = buildMockResponse({
        item,
        product,
        moduleId,
        moduleName: moduleName(moduleId),
        stage: stageNameOf(stageIndex),
      });
      cancelRef.current = typeOut(text, appendResultText, () => complete(item));
    },
    [
      abortRunning,
      apiKey,
      appendResultText,
      complete,
      finishResult,
      live,
      moduleId,
      product,
      setCardState,
      setTab,
      stageIndex,
      startResult,
    ]
  );

  /** 진행 중 실행 중단 — 해당 카드는 idle 로 복구된다 */
  const cancel = useCallback(() => {
    abortRunning();
  }, [abortRunning]);

  return { run, cancel };
}
