/** 应用外壳：桌面侧栏 + 移动端底栏 + 主题切换 + 标准徽章 */
import { ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useSettings } from '../../stores/settings';
import { ToastRegion } from '../../components/ui';
import { StandardProfileBadge } from '../../components/StandardProfileBadge';

const NAV = [
  { to: '/', label: '首页', icon: '🏠', end: true },
  { to: '/experiments', label: '实验', icon: '🔬' },
  { to: '/formulas', label: '公式', icon: 'ƒ' },
  { to: '/tools/statistics', label: '数据处理', icon: '📊', matchPrefix: '/tools' },
  { to: '/projects', label: '项目', icon: '🗂' },
  { to: '/settings', label: '设置', icon: '⚙' },
  { to: '/sources', label: '关于/规则', icon: '§' },
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
  const isProject = location.pathname.startsWith('/project/');
  return (
    <div className="app-shell">
      <aside className="app-sidebar" aria-label="主导航">
        <div className="brand">
          <span className="logo" aria-hidden>φ</span>
          <span>物理实验小助手</span>
        </div>
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            className={() => `nav-item${isActive(n.to, n.matchPrefix, location.pathname, n.end) ? ' active' : ''}`}
          >
            <span className="icon" aria-hidden>{n.icon}</span>
            {n.label}
          </NavLink>
        ))}
        <div className="sidebar-footer">
          <StandardProfileBadge />
          <div style={{ marginTop: 8 }}>
            <button
              className="btn btn-sm btn-ghost"
              onClick={() => setTheme('theme', theme === 'dark' ? 'light' : 'dark')}
              aria-label="切换主题"
            >
              {theme === 'dark' ? '☀ 亮色' : '🌙 暗色'}
            </button>
          </div>
          <div style={{ marginTop: 10, fontSize: 11 }}>数据仅保存在本浏览器</div>
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
            <span className="m-icon" aria-hidden>{n.icon}</span>
            {n.label}
          </NavLink>
        ))}
      </nav>
      <ToastRegion />
    </div>
  );
}
