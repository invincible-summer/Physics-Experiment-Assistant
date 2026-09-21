/**
 * 应用外壳：纯布局组合 —— SideNav（唯一左导航）+ TopBar 插槽 + 内容区 + MobileNav。
 * 不内联导航 JSX；导航结构见 nav-config.ts / SideNav.tsx。
 */
import { ReactNode } from 'react';
import { useSettings } from '../../stores/settings';
import { SideNav } from './SideNav';
import { TopBar } from './TopBar';
import { MobileNav } from './MobileNav';

export function AppShell({ children, topbar, wide = false }: {
  children: ReactNode;
  topbar?: ReactNode;
  /** 工作台等需要全宽内容区的页面 */
  wide?: boolean;
}) {
  const collapsed = useSettings((s) => s.sidebarCollapsed);
  return (
    <div className={`app-shell${collapsed ? ' is-collapsed' : ''}`}>
      <SideNav />
      <div className="app-main">
        {topbar && <TopBar>{topbar}</TopBar>}
        <main className={`app-content${wide ? ' wide' : ''}`}>{children}</main>
      </div>
      <MobileNav />
    </div>
  );
}
