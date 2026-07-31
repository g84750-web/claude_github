import { useEffect } from 'react';
import { useApiStore } from '../../store/useApiStore';
import { toast } from '../../store/useToastStore';
import { Badge } from '../ui/Badge';
import { Icon } from '../ui/Icon';
import s from './layout.module.css';

/**
 * API Key 입력 바.
 * [보안] type="password" 고정, 값은 sessionStorage 에만 저장하며 로그로 남기지 않는다.
 */
export function ApiBar() {
  const apiKey = useApiStore((st) => st.apiKey);
  const setApiKey = useApiStore((st) => st.setApiKey);
  const save = useApiStore((st) => st.save);
  const savedAt = useApiStore((st) => st.savedAt);
  const clearSavedFlag = useApiStore((st) => st.clearSavedFlag);
  const live = useApiStore((st) => st.isLive());
  const modeLabel = useApiStore((st) => st.modeLabel());

  // 저장 완료 피드백 2초 후 해제
  useEffect(() => {
    if (savedAt === null) return;
    const t = setTimeout(clearSavedFlag, 2000);
    return () => clearTimeout(t);
  }, [savedAt, clearSavedFlag]);

  const handleSave = () => {
    save();
    toast(apiKey.trim() ? 'API 키를 세션에 저장했습니다' : 'API 키를 비웠습니다');
  };

  return (
    <div className={s.apibar}>
      <label className={s.apiLabel} htmlFor="dz-api-key">
        <Icon name="key" size={12} />
        API Key
      </label>
      <input
        id="dz-api-key"
        className={s.apiInput}
        type="password"
        autoComplete="off"
        spellCheck={false}
        placeholder="sk-ant-..."
        value={apiKey}
        onChange={(e) => setApiKey(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleSave()}
      />
      <button
        className={`${s.apiBtn} ${savedAt !== null ? s.apiBtnSaved : ''}`}
        onClick={handleSave}
      >
        <Icon name={savedAt !== null ? 'check' : 'deviceFloppy'} size={12} />
        {savedAt !== null ? '저장됨' : '저장'}
      </button>

      <Badge
        colorVar={live ? '--green' : '--t3'}
        bgVar={live ? '--gbg' : '--s2'}
        title={live ? '실제 Claude API 를 호출합니다' : '목업 응답으로 동작합니다'}
      >
        {modeLabel}
      </Badge>

      <span className={s.hint}>
        API 키 입력 시 Claude 가 실제 결과물을 생성합니다 · 키는 탭 종료 시 폐기됩니다
      </span>
    </div>
  );
}

export default ApiBar;
