import { useEffect, useRef, useState } from 'react';
import { LAW_QUERY_SYSTEM, streamMessage } from '../../../lib/anthropic';
import { buildMockLawResponse, typeOut } from '../../../lib/mockResponse';
import { useApiStore } from '../../../store/useApiStore';
import { toast } from '../../../store/useToastStore';
import { Icon } from '../../ui/Icon';
import s from '../panel.module.css';

const PRESETS = [
  'K-IFRS 18 도입 시 재무제표 템플릿에서 바꿔야 할 항목은?',
  '전자세금계산서 의무 확대 대상 판정 기준을 알려줘',
  '수정 분개 자동화 시 누락되기 쉬운 유형은?',
  '3개년 비교재무제표 재작성이 필요한 경우는?',
  'Pillar 2 실효세율 산출에 필요한 데이터는?',
];

export function AiQueryPane() {
  const apiKey = useApiStore((st) => st.apiKey);
  const live = useApiStore((st) => st.isLive());

  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [busy, setBusy] = useState(false);

  const cancelRef = useRef<(() => void) | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(
    () => () => {
      cancelRef.current?.();
      abortRef.current?.abort();
    },
    []
  );

  useEffect(() => {
    const el = bodyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [answer]);

  const ask = (q: string) => {
    const query = q.trim();
    if (!query || busy) return;

    cancelRef.current?.();
    abortRef.current?.abort();

    setAnswer('');
    setBusy(true);

    if (live) {
      const controller = new AbortController();
      abortRef.current = controller;
      cancelRef.current = () => controller.abort();

      void streamMessage({
        apiKey,
        system: LAW_QUERY_SYSTEM(),
        userMessage: query,
        maxTokens: 1200,
        onDelta: (d) => setAnswer((prev) => prev + d),
        onDone: () => setBusy(false),
        onError: (err) => {
          setBusy(false);
          setAnswer((prev) => `${prev}\n\n[오류] ${err.message}`);
          toast('AI 조회에 실패했습니다', 'error');
        },
        signal: controller.signal,
      });
      return;
    }

    const text = buildMockLawResponse(query);
    cancelRef.current = typeOut(
      text,
      (d) => setAnswer((prev) => prev + d),
      () => setBusy(false)
    );
  };

  return (
    <div className={s.paneScroll}>
      <div className={s.query}>
        <input
          className={s.queryInput}
          placeholder="법령·회계기준에 대해 질문하세요"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && ask(question)}
          aria-label="법령 질의"
        />
        <button
          className={`${s.btn} ${s.btnPrimary}`}
          onClick={() => ask(question)}
          disabled={busy || !question.trim()}
        >
          <Icon name={busy ? 'loader' : 'send'} size={11} spin={busy} />
          조회
        </button>
      </div>

      <div className={s.presets}>
        {PRESETS.map((p) => (
          <button
            key={p}
            className={s.preset}
            onClick={() => {
              setQuestion(p);
              ask(p);
            }}
            disabled={busy}
          >
            {p.length > 26 ? `${p.slice(0, 26)}…` : p}
          </button>
        ))}
      </div>

      <div ref={bodyRef} className={`${s.answer} ${busy ? s.resTyping : ''}`}>
        {answer || (
          <span style={{ color: 'var(--t3)' }}>
            질문을 입력하거나 위 예시를 선택하면 답변이 스트리밍됩니다.
            {!live && ' (API 키 미입력 — 시뮬레이션 모드)'}
          </span>
        )}
      </div>
    </div>
  );
}

export default AiQueryPane;
