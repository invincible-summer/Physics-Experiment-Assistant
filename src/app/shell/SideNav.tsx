/** 桌面左侧主导航：Brand + NavSection×n + SidebarFooter（唯一一条左侧主导航） */
import { useNavigate } from 'react-router-dom';
import { useSettings } from '../../stores/settings';
import { Icon, IconName } from '../../components/Icon';
import { BrandMark } from '../../components/BrandMark';
import { MarkdownInline } from '../../components/Markdown';
import { NAV_GROUPS } from './nav-config';
import { NavItem } from './NavItem';

const THEME_LABEL: Record<'system' | 'light' | 'dark', string> = {
  system: '跟随系统',
  light: '浅色',
  dark: '深色',
};
const THEME_ICON: Record<'system' | 'light' | 'dark', IconName> = {
  system: 'monitor',
  light: 'sun',
  dark: 'moon',
};
const THEME_ORDER: Array<'system' | 'light' | 'dark'> = ['system', 'light', 'dark'];

export function SideNav() {
  const collapsed = useSettings((s) => s.sidebarCollapsed);
  const theme = useSettings((s) => s.theme);
  const setPreference = useSettings((s) => s.set);
  const navigate = useNavigate();

  const nextTheme = THEME_ORDER[(THEME_ORDER.indexOf(theme) + 1) % THEME_ORDER.length];

  return (
    <aside className="app-sidebar" aria-label="主导航">
      <div className="sidebar-brand-row">
        <div className="brand">
          <span className="brand-mark" aria-hidden><BrandMark size={22} /></span>
          {!collapsed && (
            <span className="brand-copy">
              <span className="brand-name"><MarkdownInline>物理实验小助手</MarkdownInline></span>
              <span className="brand-sub"><MarkdownInline>Physics Lab</MarkdownInline></span>
            </span>
          )}
        </div>
        <button
          className="sidebar-toggle"
          onClick={() => setPreference('sidebarCollapsed', !collapsed)}
          aria-expanded={!collapsed}
          aria-label={collapsed ? '展开主导航' : '收起主导航'}
          title={collapsed ? '展开主导航' : '收起主导航'}
        >
          <Icon name="panel-left" size={15} />
        </button>
      </div>

      <div className="sidebar-content">
        {NAV_GROUPS.map((group) => (
          <div className="sidebar-group" key={group.key}>
            {!collapsed && (
              <div className="nav-caption"><MarkdownInline>{group.label}</MarkdownInline></div>
            )}
            {collapsed && <div className="sidebar-divider" />}
            <nav className="sidebar-nav" aria-label={group.label}>
              {group.items.map((item) => <NavItem key={item.to} item={item} collapsed={collapsed} />)}
            </nav>
          </div>
        ))}
      </div>

      <div className="sidebar-footer">
        {/* 轻量工具区：齿轮进入设置（替代原标准徽章入口），主题切换（plan §3.3） */}
        <div className="sidebar-tools">
          <button
            className="btn btn-sm btn-ghost sidebar-tool-btn"
            onClick={() => navigate('/settings')}
            title="设置"
            aria-label="设置"
          >
            <Icon name="settings" size={15} />
            {!collapsed && <MarkdownInline allowLinks={false}>设置</MarkdownInline>}
          </button>
          <button
            className="btn btn-sm btn-ghost sidebar-tool-btn sidebar-theme"
            onClick={() => setPreference('theme', nextTheme)}
            title={`当前主题${THEME_LABEL[theme]}，点击切换为${THEME_LABEL[nextTheme]}`}
            aria-label={`当前主题${THEME_LABEL[theme]}，点击切换为${THEME_LABEL[nextTheme]}`}
          >
            <Icon name={THEME_ICON[theme]} size={15} />
            {!collapsed && <MarkdownInline allowLinks={false}>{`主题：${THEME_LABEL[theme]}`}</MarkdownInline>}
          </button>
        </div>
        {!collapsed && (
          <div className="sidebar-privacy"><MarkdownInline>数据仅保存在本浏览器</MarkdownInline></div>
        )}
      </div>
    </aside>
  );
}
