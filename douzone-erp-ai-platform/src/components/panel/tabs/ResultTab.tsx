import { useEffect, useRef } from 'react';
import { todayISO } from '../../../lib/date';
import { useAppStore } from '../../../store/useAppStore';
import { useExecStore, type ResultStatus } from '../../../store/useExecStore';
import { toast } from '../../../store/useToastStore';
import { Badge } from '../../ui/Badge';
import { Icon } from '../../ui/Icon';
import s from '../panel.module.css';

const STATUS_META: Record<ResultStatus, { label: string; colorVar: string; bgVar: string }> = {
  idle: { label: '대기', colorVar: '--t3', bgVar: '--s2' },
  running: { label: '실행 중', colorVar: '--amber', bgVar: '--abg' },
  done: { label: '완료', colorVar: '--green', bgVar: '--gbg' },
  error: { label: '오류', colorVar: '--red', bgVar: '--rbg' },
};

export function ResultTab() {
  const result = useExecStore((st) => st.currentResult);
  const setTab = useAppStore((st) => st.setTab);
  const bodyRef = useRef<HTMLDivElement>(null);

  // 스트리밍 중 자동 스크롤
  useEffect(() => {
    const el = bodyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [result?.text]);

  if (!result) {
    return (
      <div className={s.pane}>
        <div className={s.resPlaceholder}>
          <Icon name="sparkles" size={22} />
          AI 자동화 항목 옆의
          <br />
          <strong style={{ color: 'var(--purple)' }}>실행</strong> 버튼을 클릭하면
          <br />
          Claude AI 가 결과물을 생성합니다.
          <br />
          <br />
          <span style={{ fontSize: 10, color: 'var(--t3)' }}>
            API 키 없이도 시뮬레이션 모드로 동작합니다.
          </span>
        </div>
      </div>
    );
  }

  const meta = STATUS_META[result.status];

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(result.text);
      toast('결과를 클립보드에 복사했습니다');
    } catch {
      toast('클립보드 복사에 실패했습니다', 'error');
    }
  };

  const handleSave = () => {
    const blob = new Blob([result.text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    // [제약] 파일명 날짜는 런타임 산출
    a.download = `${result.itemId}_${todayISO()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast('결과를 파일로 저장했습니다');
  };

  return (
    <div className={s.pane}>
      <div className={s.resHead}>
        <span className={s.resName} title={result.task}>
          {result.task}
        </span>
        <Badge colorVar={meta.colorVar} bgVar={meta.bgVar}>
          {meta.label}
        </Badge>
      </div>

      <div
        ref={bodyRef}
        className={`${s.resBody} ${result.status === 'running' ? s.resTyping : ''}`}
      >
        {result.text}
      </div>

      <div className={s.resActions}>
        <button className={s.btn} onClick={handleCopy} disabled={!result.text}>
          <Icon name="copy" size={11} />
          복사
        </button>
        <button className={s.btn} onClick={handleSave} disabled={!result.text}>
          <Icon name="download" size={11} />
          저장
        </button>
        <button
          className={`${s.btn} ${s.btnPrimary}`}
          style={{ marginLeft: 'auto' }}
          onClick={() => setTab(1)}
        >
          <Icon name="history" size={11} />
          이력
        </button>
      </div>
    </div>
  );
}

export default ResultTab;
