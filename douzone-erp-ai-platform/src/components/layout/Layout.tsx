import { CenterPanel } from '../center/CenterPanel';
import { RightPanel } from '../panel/RightPanel';
import { Sidebar } from '../sidebar/Sidebar';
import { Toast } from '../ui/Toast';
import { ApiBar } from './ApiBar';
import { StatusBar } from './StatusBar';
import { TopBar } from './TopBar';
import s from './layout.module.css';

export function Layout() {
  return (
    <div className={s.shell}>
      <TopBar />
      <ApiBar />
      <div className={s.layout}>
        <Sidebar />
        <CenterPanel />
        <RightPanel />
      </div>
      <StatusBar />
      <Toast />
    </div>
  );
}

export default Layout;
