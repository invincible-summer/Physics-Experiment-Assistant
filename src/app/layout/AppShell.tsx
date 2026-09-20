/** 应用外壳：桌面文本导航 + 移动端底栏 + 主题切换 + 标准徽章 */
import { ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useSettings } from '../../stores/settings';
import { ToastRegion } from '../../components/ui';
import { StandardProfileBadge } from '../../components/StandardProfileBadge';

const NAV = [
  { to: '/', label: '首页', mobileLabel: '首页', end: true },
  { to: '/experiments', label: '实验', mobileLabel: '实验' },
  { to: '/formulas', label: '公式', mobileLabel: '公式' },
  { to: '/tools/statistics', label: '数据处理', mobileLabel: '数据', matchPrefix: '/tools' },
  { to: '/projects', label: '项目', mobileLabel: '项目' },
  { to: '/settings', label: '设置', mobileLabel: '设置' },
  { to: '/sources', label: '关于 / 规则', mobileLabel: '规则' },
];

function isActive(to: string, matchPrefix?: string, pathname?: string, end?: boolean) {
  if (matchPrefix) return (pathname ?? '').startsWith(matchPrefix);
  if (end) return pathname === to;
  return (pathname ?? '').startsWith(to);
}

export function AppShell({ children, topbar }: { children: ReactNode; topbar?: ReactNode }) {
  const theme = useSettings((s) => s.theme);
  const setTheme = useSettings((s) => s.set);
  const location = useLocation();

  return (
    <div className="app-shell">
      <aside className="app-sidebar" aria-label="主导航">
        <div className="brand">
          <span className="logo" aria-hidden>φ</span>
          <span className="brand-copy">
            <strong>物理实验小助手</strong>
            <span>Physics Lab Workspace</span>
          </span>
        </div>

        <div className="nav-caption">工作区</div>
        <nav className="sidebar-nav">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={() => `nav-item${isActive(n.to, n.matchPrefix, location.pathname, n.end) ? ' active' : ''}`}
            >
              {n.label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <StandardProfileBadge />
          <button
            className="btn btn-sm btn-ghost sidebar-theme"
            onClick={() => setTheme('theme', theme === 'dark' ? 'light' : 'dark')}
          >
            {theme === 'dark' ? '切换到亮色' : '切换到暗色'}
          </button>
          <div className="sidebar-privacy">数据仅保存在本浏览器</div>
        </div>
      </aside>

      <div className="app-main">
        {topbar && <header className="topbar">{topbar}</header>}
        {children}
      </div>

      <nav className="mobile-nav" aria-label="移动端导航">
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            className={() => `m-item${isActive(n.to, n.matchPrefix, location.pathname, n.end) ? ' active' : ''}`}
          >
            {n.mobileLabel}
          </NavLink>
        ))}
      </nav>
      <ToastRegion />
    </div>
  );
}
