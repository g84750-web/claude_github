import { calcFastTrack, calcSimulation } from '../../../lib/simulator';
import { useApiStore } from '../../../store/useApiStore';
import { useExecStore } from '../../../store/useExecStore';
import { useProjectStore } from '../../../store/useProjectStore';
import { useSimStore } from '../../../store/useSimStore';
import { toast } from '../../../store/useToastStore';
import { clearSession } from '../../../lib/session';
import { Icon } from '../../ui/Icon';
import { Slider } from '../../ui/Slider';
import s from '../panel.module.css';

export function SimulatorTab() {
  const sim = useSimStore();
  const kpi = useExecStore((st) => st.kpi);
  const autoRatio = useExecStore((st) => st.autoRatio);
  const clearAll = useExecStore((st) => st.clearAll);
  const setApiKey = useApiStore((st) => st.setApiKey);
  const persistProject = useProjectStore((st) => st.persist);

  const out = calcSimulation({
    dauRate: sim.dauRate,
    draftRate: sim.draftRate,
    tcRate: sim.tcRate,
    pmProjects: sim.pmProjects,
  });
  const ft = calcFastTrack(sim.ftAnnualCount, autoRatio);

  /** 세션 전체 초기화 (설계서 4.9) */
  const resetSession = () => {
    const ok = window.confirm(
      '세션 실행 이력 및 화면 상태를 전체 초기화하시겠습니까?\n\n' +
        '• 실행 이력 삭제\n• 카드 상태 초기화\n' +
        '• 시뮬레이터 수치 리셋\n• AI 결과 패널 초기화'
    );
    if (!ok) return;

    clearSession(); // sessionStorage 전체 삭제 (API 키 포함)
    setApiKey(''); // API 키 입력값 비움
    clearAll(); // 이력 · 카드 상태 · 결과 패널 (빈 이력을 다시 기록)
    sim.resetToDefault(); // 슬라이더 기본값 애니메이션 복귀

    // 프로젝트 정보는 초기화 대상이 아니므로(설계서 4.9) 지워진 저장소에 다시 기록한다.
    // 이 재저장이 없으면 화면에는 남아 있는데 새로고침 시 조용히 사라진다.
    persistProject();

    toast('세션이 전체 초기화되었습니다');
  };

  const rows: Array<[string, string, string]> = [
    ['예상 공수 절감률', `${out.savingsRate}%`, '--green'],
    ['연간 절감 공수', `${out.annualSavedHours.toLocaleString()}h`, '--blue'],
    ['PM 관리 가능 프로젝트', `${out.pmCapacity}개`, '--purple'],
    ['설계서 1건당 초안', `${out.docHoursPerItem}h`, '--amber'],
  ];

  const ftRows: Array<[string, string, string]> = [
    ['적용 배율', `×${ft.multiplier}`, '--purple'],
    ['도입 후 연간 처리량', `${ft.afterCount}건`, '--green'],
    ['증가 건수', `+${ft.deltaCount}건`, '--blue'],
    ['1건당 기간 단축', `${ft.daysSavedPerItem}일`, '--amber'],
  ];

  const actualRows: Array<[string, string, string]> = [
    ['총 실행 건수', `${kpi.execCount}건`, '--t1'],
    ['누적 절감 공수', `${kpi.totalHours}h`, '--blue'],
    ['실제 DAU 달성률', `${kpi.dauRate}%`, '--amber'],
    ['A10 실행 건수', `${kpi.a10Count}건`, '--blue'],
    ['OmniEsol 실행 건수', `${kpi.oeCount}건`, '--green'],
  ];

  return (
    <div className={s.pane}>
      <div className={s.paneScroll}>
        <div className={s.sect}>
          <div className={s.sectTitle}>
            <Icon name="settingsAutomation" size={12} />
            공수 절감 시뮬레이터
          </div>

          <Slider
            label="AI 도구 활용률"
            value={sim.dauRate}
            min={10}
            max={100}
            step={5}
            onChange={(v) => sim.setValue('dauRate', v)}
          />
          <Slider
            label="AI 산출물 초안율"
            value={sim.draftRate}
            min={0}
            max={100}
            step={5}
            onChange={(v) => sim.setValue('draftRate', v)}
          />
          <Slider
            label="TC 자동화율"
            value={sim.tcRate}
            min={0}
            max={100}
            step={5}
            onChange={(v) => sim.setValue('tcRate', v)}
          />
          <Slider
            label="PM 관리 프로젝트 수"
            value={sim.pmProjects}
            min={1}
            max={5}
            step={1}
            unit="개"
            onChange={(v) => sim.setValue('pmProjects', v)}
          />

          <div className={s.simTable}>
            {rows.map(([label, value, color]) => (
              <div className={s.simRow} key={label}>
                <span className={s.simLabel}>{label}</span>
                <span className={s.simValue} style={{ color: `var(${color})` }}>
                  {value}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className={s.sect}>
          <div className={s.sectTitle}>
            <Icon name="trendingUp" size={12} />
            Fast Track 예측
          </div>

          <Slider
            label="현재 연간 처리 건수"
            value={sim.ftAnnualCount}
            min={5}
            max={100}
            step={5}
            unit="건"
            onChange={sim.setFtAnnualCount}
          />

          <div className={s.simTable}>
            {ftRows.map(([label, value, color]) => (
              <div className={s.simRow} key={label}>
                <span className={s.simLabel}>{label}</span>
                <span className={s.simValue} style={{ color: `var(${color})` }}>
                  {value}
                </span>
              </div>
            ))}
          </div>

          <p style={{ marginTop: 7, fontSize: 10, color: 'var(--t3)', lineHeight: 1.7 }}>
            배율은 실제 완전자동화(auto) 실행 비율 {Math.round(autoRatio * 100)}% 에 따라
            1.3 ~ 2.5 범위에서 동적으로 산출됩니다.
          </p>
        </div>

        <div className={s.sect}>
          <div className={s.sectTitle}>
            <Icon name="chartBar" size={12} />
            누적 실적
          </div>

          <div className={s.simTable}>
            {actualRows.map(([label, value, color]) => (
              <div className={s.simRow} key={label}>
                <span className={s.simLabel}>{label}</span>
                <span className={s.simValue} style={{ color: `var(${color})` }}>
                  {value}
                </span>
              </div>
            ))}
          </div>

          <button
            className={`${s.btn} ${s.btnDanger}`}
            style={{ width: '100%', marginTop: 9, justifyContent: 'center' }}
            onClick={resetSession}
          >
            <Icon name="trash" size={11} />
            세션 초기화
          </button>
        </div>
      </div>
    </div>
  );
}

export default SimulatorTab;
