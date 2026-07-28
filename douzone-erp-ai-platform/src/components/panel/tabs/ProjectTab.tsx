import { useState } from 'react';
import { STAGES } from '../../../data/stages';
import { fetchProjectFromApi, useProjectStore } from '../../../store/useProjectStore';
import { toast } from '../../../store/useToastStore';
import type { AppliedProduct, ConnStatus, ProjectInfo } from '../../../types/project';
import { Icon, type IconName } from '../../ui/Icon';
import s from '../panel.module.css';

const APPLIED: Array<{ v: AppliedProduct; label: string }> = [
  { v: 'A10', label: 'Amaranth10' },
  { v: 'OE', label: 'OmniEsol' },
  { v: 'BOTH', label: '양쪽 모두' },
];

const CONN_META: Record<ConnStatus, { cls: string; icon: IconName; label: string }> = {
  idle: { cls: s.connIdle, icon: 'point', label: '연결 대기' },
  testing: { cls: s.connTesting, icon: 'loader', label: '연결 테스트 중' },
  success: { cls: s.connOk, icon: 'circleCheck', label: '연결 성공' },
  failed: { cls: s.connFail, icon: 'alertCircle', label: '연결 실패' },
};

function ViewSection() {
  const info = useProjectStore((st) => st.info);
  const setView = useProjectStore((st) => st.setView);

  const rows: Array<[string, string, boolean]> = [
    ['프로젝트명', info.projectName, false],
    ['프로젝트 코드', info.projectCode, false],
    ['고객사', info.clientName, false],
    ['PM', info.pmName, false],
    ['기간', [info.startDate, info.endDate].filter(Boolean).join(' ~ '), false],
    ['현재 단계', info.currentStage, false],
    ['적용 제품', APPLIED.find((a) => a.v === info.appliedProduct)?.label ?? '', false],
    ['고객사 홈페이지', info.clientHomepageUrl, true],
    ['PMS', info.pmsUrl, true],
    ['데모 서버', info.demoServerUrl, true],
    ['비고', info.note, false],
  ];

  return (
    <div className={s.sect}>
      <div className={s.sectTitle}>
        <Icon name="building" size={12} />
        프로젝트 정보
      </div>
        {rows
          .filter(([, v]) => Boolean(v))
          .map(([label, value, isUrl]) => (
            <div className={s.viewRow} key={label}>
              <span className={s.viewLabel}>{label}</span>
              <span className={s.viewValue}>
                {isUrl ? (
                  <a
                    className={s.viewUrl}
                    href={value}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {value}
                  </a>
                ) : (
                  value
                )}
              </span>
            </div>
          ))}
      <div className={s.actions}>
        <button className={s.btn} onClick={() => setView('edit')}>
          <Icon name="edit" size={11} />
          수정
        </button>
      </div>
    </div>
  );
}

function ManualForm() {
  const info = useProjectStore((st) => st.info);
  const setField = useProjectStore((st) => st.setField);
  const save = useProjectStore((st) => st.save);
  const reset = useProjectStore((st) => st.reset);
  const [errors, setErrors] = useState<string[]>([]);

  const set = <K extends keyof ProjectInfo>(k: K) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => setField(k, e.target.value as ProjectInfo[K]);

  const handleSave = () => {
    const r = save();
    setErrors(r.errors);
    toast(
      r.ok ? '프로젝트 정보를 저장했습니다' : '필수 항목을 확인해 주세요',
      r.ok ? 'ok' : 'warn'
    );
  };

  return (
    <>
      <div className={s.sect}>
        <div className={s.sectTitle}>
          <Icon name="forms" size={12} />
          기본 정보
        </div>

        <div className={s.field}>
          <label className={s.required} htmlFor="p-name">
            프로젝트명
          </label>
          <input id="p-name" value={info.projectName} onChange={set('projectName')} />
        </div>

        <div className={s.grid2}>
          <div className={s.field}>
            <label htmlFor="p-code">프로젝트 코드</label>
            <input
              id="p-code"
              placeholder="PRJ-YYYY-NNN"
              value={info.projectCode}
              onChange={set('projectCode')}
            />
          </div>
          <div className={s.field}>
            <label className={s.required} htmlFor="p-client">
              고객사명
            </label>
            <input id="p-client" value={info.clientName} onChange={set('clientName')} />
          </div>
        </div>

        <div className={s.grid2}>
          <div className={s.field}>
            <label htmlFor="p-pm">PM</label>
            <input id="p-pm" value={info.pmName} onChange={set('pmName')} />
          </div>
          <div className={s.field}>
            <label htmlFor="p-applied">적용 제품</label>
            <select id="p-applied" value={info.appliedProduct} onChange={set('appliedProduct')}>
              {APPLIED.map((a) => (
                <option key={a.v} value={a.v}>
                  {a.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className={s.grid2}>
          <div className={s.field}>
            <label htmlFor="p-start">시작일</label>
            <input id="p-start" type="date" value={info.startDate} onChange={set('startDate')} />
          </div>
          <div className={s.field}>
            <label htmlFor="p-end">종료일</label>
            <input
              id="p-end"
              type="date"
              min={info.startDate || undefined}
              value={info.endDate}
              onChange={set('endDate')}
            />
          </div>
        </div>

        <div className={s.field}>
          <label htmlFor="p-stage">현재 단계</label>
          <select id="p-stage" value={info.currentStage} onChange={set('currentStage')}>
            <option value="">선택 안 함</option>
            {STAGES.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className={s.sect}>
        <div className={s.sectTitle}>
          <Icon name="link" size={12} />
          관련 URL
        </div>
        <div className={s.field}>
          <label htmlFor="p-home">고객사 홈페이지</label>
          <input
            id="p-home"
            type="url"
            placeholder="https://"
            value={info.clientHomepageUrl}
            onChange={set('clientHomepageUrl')}
          />
        </div>
        <div className={s.field}>
          <label htmlFor="p-pms">PMS URL</label>
          <input
            id="p-pms"
            type="url"
            placeholder="https://"
            value={info.pmsUrl}
            onChange={set('pmsUrl')}
          />
        </div>
        <div className={s.field}>
          <label htmlFor="p-demo">데모 서버 URL</label>
          <input
            id="p-demo"
            type="url"
            placeholder="https://"
            value={info.demoServerUrl}
            onChange={set('demoServerUrl')}
          />
        </div>
      </div>

      <div className={s.sect}>
        <div className={s.sectTitle}>
          <Icon name="notes" size={12} />
          비고
        </div>
        <div className={s.field}>
          <textarea
            aria-label="비고"
            value={info.note}
            onChange={set('note')}
            placeholder="특이사항, 이슈, 참고 메모"
          />
        </div>

        {errors.length > 0 && (
          <ul className={s.errorList}>
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        )}

        <div className={s.actions}>
          <button className={`${s.btn} ${s.btnPrimary}`} onClick={handleSave}>
            <Icon name="deviceFloppy" size={11} />
            저장
          </button>
          <button
            className={s.btn}
            onClick={() => {
              reset();
              setErrors([]);
              toast('프로젝트 정보를 초기화했습니다');
            }}
          >
            <Icon name="refresh" size={11} />
            초기화
          </button>
        </div>
      </div>
    </>
  );
}

function ApiForm() {
  const conn = useProjectStore((st) => st.conn);
  const setConnField = useProjectStore((st) => st.setConnField);
  const status = useProjectStore((st) => st.connStatus);
  const message = useProjectStore((st) => st.connMessage);
  const setConnStatus = useProjectStore((st) => st.setConnStatus);
  const setField = useProjectStore((st) => st.setField);

  const meta = CONN_META[status];

  const test = async () => {
    if (!conn.endpointUrl.trim()) {
      setConnStatus('failed', '엔드포인트 URL 을 입력해 주세요.');
      return;
    }
    setConnStatus('testing');
    try {
      const partial = await fetchProjectFromApi(conn);
      for (const [k, v] of Object.entries(partial)) {
        if (v) setField(k as keyof typeof partial, v as never);
      }
      setConnStatus('success', '프로젝트 정보를 불러왔습니다.');
      toast('API 에서 프로젝트 정보를 가져왔습니다');
    } catch (err) {
      // [보안] 토큰 값은 메시지에 포함하지 않는다
      setConnStatus('failed', err instanceof Error ? err.message : '연결에 실패했습니다.');
      toast('API 연결에 실패했습니다', 'error');
    }
  };

  return (
    <div className={s.sect}>
      <div className={s.sectTitle}>
        <Icon name="api" size={12} />
        API 연동 설정
      </div>

      <div className={s.field}>
        <label htmlFor="c-url">엔드포인트 URL</label>
        <input
          id="c-url"
          type="url"
          placeholder="https://"
          value={conn.endpointUrl}
          onChange={(e) => setConnField('endpointUrl', e.target.value)}
        />
      </div>
      <div className={s.field}>
        <label htmlFor="c-token">Bearer 토큰</label>
        <input
          id="c-token"
          type="password"
          autoComplete="off"
          value={conn.bearerToken}
          onChange={(e) => setConnField('bearerToken', e.target.value)}
        />
      </div>
      <div className={s.field}>
        <label htmlFor="c-pid">프로젝트 ID</label>
        <input
          id="c-pid"
          value={conn.projectId}
          onChange={(e) => setConnField('projectId', e.target.value)}
        />
      </div>

      <div className={s.actions}>
        <button
          className={`${s.btn} ${s.btnPrimary}`}
          onClick={test}
          disabled={status === 'testing'}
        >
          <Icon name="plug" size={11} spin={status === 'testing'} />
          연결 테스트
        </button>
      </div>

      <div className={`${s.connStatus} ${meta.cls}`}>
        <Icon name={meta.icon} size={12} spin={status === 'testing'} />
        {message || meta.label}
      </div>

      <p style={{ marginTop: 8, fontSize: 10, color: 'var(--t3)', lineHeight: 1.7 }}>
        A10 / OmniEsol API 스펙 확정 전까지 응답은 어댑터 레이어에서 매핑합니다.
        토큰은 메모리에만 유지되며 저장·로그 대상이 아닙니다.
      </p>
    </div>
  );
}

export function ProjectTab() {
  const mode = useProjectStore((st) => st.mode);
  const setMode = useProjectStore((st) => st.setMode);
  const view = useProjectStore((st) => st.view);

  const body =
    mode === 'api' ? <ApiForm /> : view === 'view' ? <ViewSection /> : <ManualForm />;

  return (
    <div className={s.pane}>
      <div className={s.paneScroll}>
        <div className={s.modeToggle}>
          <button
            className={`${s.modeBtn} ${mode === 'manual' ? s.modeActive : ''}`}
            onClick={() => setMode('manual')}
          >
            수동등록
          </button>
          <button
            className={`${s.modeBtn} ${mode === 'api' ? s.modeActive : ''}`}
            onClick={() => setMode('api')}
          >
            API 연동
          </button>
        </div>

        {body}
      </div>
    </div>
  );
}

export default ProjectTab;
