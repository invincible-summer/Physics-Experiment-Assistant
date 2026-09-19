/** 应用外壳：桌面侧栏 + 移动端主导航 + 主题切换 + 标准徽章 */
import { ReactNode, useEffect } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useSettings } from '../../stores/settings';
import { ToastRegion } from '../../components/ui';
import { StandardProfileBadge } from '../../components/StandardProfileBadge';
import { Icon, IconName } from '../../components/Icon';

type NavItem = {
  to: string;
  label: string;
  icon: IconName;
  end?: boolean;
  matchPrefix?: string;
};

const PRIMARY_NAV: NavItem[] = [
  { to: '/', label: '首页', icon: 'home', end: true },
  { to: '/experiments', label: '实验', icon: 'experiment' },
  { to: '/formulas', label: '公式', icon: 'formula' },
  { to: '/tools/statistics', label: '数据处理', icon: 'chart', matchPrefix: '/tools' },
  { to: '/projects', label: '项目', icon: 'projects' },
];

const SECONDARY_NAV: NavItem[] = [
  { to: '/settings', label: '设置', icon: 'settings' },
  { to: '/sources', label: '规则来源', icon: 'book' },
];

function isActive(to: string, matchPrefix?: string, pathname?: string, end?: boolean) {
  if (matchPrefix) return (pathname ?? '').startsWith(matchPrefix);
  if (end) return pathname === to;
  return (pathname ?? '').startsWith(to);
}

function NavItemLink({ item, pathname }: { item: NavItem; pathname: string }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={() => `nav-item${isActive(item.to, item.matchPrefix, pathname, item.end) ? ' active' : ''}`}
    >
      <span className="icon" aria-hidden><Icon name={item.icon} size={18} /></span>
      <span>{item.label}</span>
    </NavLink>
  );
}

export function AppShell({ children, topbar }: { children: ReactNode; topbar?: ReactNode }) {
  const theme = useSettings((s) => s.theme);
  const setTheme = useSettings((s) => s.set);
  const location = useLocation();

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  }, [theme]);

  const toggleTheme = () => setTheme('theme', theme === 'dark' ? 'light' : 'dark');

  return (
    <div className="app-shell">
      <aside className="app-sidebar" aria-label="主导航">
        <Link className="brand" to="/" aria-label="物理实验小助手首页">
          <span className="logo" aria-hidden><Icon name="experiment" size={20} strokeWidth={1.9} /></span>
          <span className="brand-copy">
            <strong>物理实验小助手</strong>
            <small>PHYSICS LAB</small>
          </span>
        </Link>

        <div className="nav-section-label">工作区</div>
        <div className="nav-stack">
          {PRIMARY_NAV.map((item) => <NavItemLink key={item.to} item={item} pathname={location.pathname} />)}
        </div>

        <div className="nav-section-label nav-section-secondary">偏好与资料</div>
        <div className="nav-stack">
          {SECONDARY_NAV.map((item) => <NavItemLink key={item.to} item={item} pathname={location.pathname} />)}
        </div>

        <div className="sidebar-footer">
          <StandardProfileBadge />
          <div className="privacy-note">
            <Icon name="shield" size={15} />
            <span>数据仅保存在本浏览器</span>
          </div>
          <button
            className="sidebar-theme-button"
            onClick={toggleTheme}
            aria-label="切换主题"
          >
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={16} />
            <span>{theme === 'dark' ? '切换到亮色' : '切换到暗色'}</span>
          </button>
        </div>
      </aside>

      <div className="app-main">
        <header className="mobile-header">
          <Link className="mobile-brand" to="/">
            <span className="logo" aria-hidden><Icon name="experiment" size={18} /></span>
            <span>物理实验</span>
          </Link>
          <div className="mobile-header-actions">
            <NavLink className="mobile-icon-link" to="/sources" aria-label="规则来源">
              <Icon name="book" size={19} />
            </NavLink>
            <NavLink className="mobile-icon-link" to="/settings" aria-label="设置">
              <Icon name="settings" size={19} />
            </NavLink>
            <button className="mobile-icon-link" onClick={toggleTheme} aria-label="切换主题">
              <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={19} />
            </button>
          </div>
        </header>
        {topbar && <header className="topbar">{topbar}</header>}
        {children}
      </div>

      <nav className="mobile-nav" aria-label="移动端主导航">
        {PRIMARY_NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={() => `m-item${isActive(item.to, item.matchPrefix, location.pathname, item.end) ? ' active' : ''}`}
          >
            <span className="m-icon" aria-hidden><Icon name={item.icon} size={20} /></span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
      <ToastRegion />
    </div>
  );
}
