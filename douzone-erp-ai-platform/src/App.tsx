import { useEffect } from 'react';
import { Layout } from './components/layout/Layout';
import { hydrateAll } from './store';

export default function App() {
  // 앱 기동 시 sessionStorage → 스토어 복원 (실행 이력 / 프로젝트 / API Key)
  useEffect(() => {
    hydrateAll();
  }, []);

  return <Layout />;
}
