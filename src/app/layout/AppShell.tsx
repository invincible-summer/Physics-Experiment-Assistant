/** 应用外壳：可折叠桌面边栏 + 移动端底栏 + 主题切换 + 标准徽章 */
import { ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useSettings } from '../../stores/settings';
import { ToastRegion } from '../../components/ui';
import { StandardProfileBadge } from '../../components/StandardProfileBadge';
import { MarkdownInline } from '../../components/Markdown';

type NavGroup = 'workspace' | 'system';

const NAV = [
  { to: '/', label: '首页', compactLabel: '⌂', mobileLabel: '首页', group: 'workspace' as NavGroup, end: true },
  { to: '/experiments', label: '实验', compactLabel: '⚗', mobileLabel: '实验', group: 'workspace' as NavGroup },
  { to: '/formulas', label: '公式', compactLabel: 'ƒ', mobileLabel: '公式', group: 'workspace' as NavGroup },
  { to: '/tools/statistics', label: '数据处理', compactLabel: 'Σ', mobileLabel: '数据', group: 'workspace' as NavGroup, matchPrefix: '/tools' },
  { to: '/projects', label: '项目', compactLabel: '▣', mobileLabel: '项目', group: 'workspace' as NavGroup },
  { to: '/settings', label: '设置', compactLabel: '⚙', mobileLabel: '设置', group: 'system' as NavGroup },
  { to: '/sources', label: '关于 / 规则', compactLabel: '§', mobileLabel: '规则', group: 'system' as NavGroup },
];

function isActive(to: string, matchPrefix?: string, pathname?: string, end?: boolean) {
  if (matchPrefix) return (pathname ?? '').startsWith(matchPrefix);
  if (end) return pathname === to;
  return (pathname ?? '').startsWith(to);
}

export function AppShell({ children, topbar }: { children: ReactNode; topbar?: ReactNode }) {
  const theme = useSettings((s) => s.theme);
  const sidebarCollapsed = useSettings((s) => s.sidebarCollapsed);
  const setPreference = useSettings((s) => s.set);
  const location = useLocation();

  const renderNavGroup = (group: NavGroup, caption: string) => (
    <div className="sidebar-group">
      <div className="nav-caption"><MarkdownInline>{caption}</MarkdownInline></div>
      <nav className="sidebar-nav" aria-label={caption}>
        {NAV.filter((n) => n.group === group).map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            title={sidebarCollapsed ? n.label : undefined}
            className={() => `nav-item${isActive(n.to, n.matchPrefix, location.pathname, n.end) ? ' active' : ''}`}
          >
            <span className="nav-mark" aria-hidden>
              <MarkdownInline>{n.compactLabel}</MarkdownInline>
            </span>
            <span className="nav-label"><MarkdownInline>{n.label}</MarkdownInline></span>
          </NavLink>
        ))}
      </nav>
    </div>
  );

  return (
    <div className={`app-shell${sidebarCollapsed ? ' sidebar-collapsed' : ''}`}>
      <aside className="app-sidebar" aria-label="主导航">
        <div className="sidebar-brand-row">
          <div className="brand" title={sidebarCollapsed ? '物理实验小助手' : undefined}>
            <span className="logo" aria-hidden>φ</span>
            <span className="brand-copy">
              <strong><MarkdownInline>物理实验小助手</MarkdownInline></strong>
              <span><MarkdownInline>Physics Lab Workspace</MarkdownInline></span>
            </span>
          </div>
          <button
            className="sidebar-collapse-toggle"
            onClick={() => setPreference('sidebarCollapsed', !sidebarCollapsed)}
            aria-expanded={!sidebarCollapsed}
            aria-label={sidebarCollapsed ? '展开主边栏' : '收起主边栏'}
            title={sidebarCollapsed ? '展开主边栏' : '收起主边栏'}
          >
            <MarkdownInline allowLinks={false}>{sidebarCollapsed ? '›' : '‹'}</MarkdownInline>
          </button>
        </div>

        <div className="sidebar-content">
          {renderNavGroup('workspace', '工作区')}
          <div className="sidebar-divider" />
          {renderNavGroup('system', '系统')}
        </div>

        <div className="sidebar-footer">
          <div className="sidebar-profile"><StandardProfileBadge /></div>
          <button
            className="btn btn-sm btn-ghost sidebar-theme"
            onClick={() => setPreference('theme', theme === 'dark' ? 'light' : 'dark')}
            title={sidebarCollapsed ? (theme === 'dark' ? '切换到亮色' : '切换到暗色') : undefined}
          >
            <span className="sidebar-theme-mark" aria-hidden>
              <MarkdownInline allowLinks={false}>{theme === 'dark' ? '☀' : '◐'}</MarkdownInline>
            </span>
            <span className="sidebar-theme-label">
              <MarkdownInline allowLinks={false}>{theme === 'dark' ? '切换到亮色' : '切换到暗色'}</MarkdownInline>
            </span>
          </button>
          <div className="sidebar-privacy"><MarkdownInline>数据仅保存在本浏览器</MarkdownInline></div>
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
            <MarkdownInline>{n.mobileLabel}</MarkdownInline>
          </NavLink>
        ))}
      </nav>
      <ToastRegion />
    </div>
  );
}
