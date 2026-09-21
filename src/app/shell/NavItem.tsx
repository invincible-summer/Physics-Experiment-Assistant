/** 单个主导航项：NavLink 激活逻辑集中在此（前缀匹配由 NavLink 内建完成）；图标纯装饰 */
import { NavLink } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import { MarkdownInline } from '../../components/Markdown';
import type { NavItemDef } from './nav-config';

export function NavItem({ item, collapsed = false }: { item: NavItemDef; collapsed?: boolean }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
      title={collapsed ? item.label : undefined}
      aria-label={collapsed ? item.label : undefined}
    >
      <Icon name={item.icon} />
      <span className="nav-item-text">
        <MarkdownInline allowLinks={false}>{item.label}</MarkdownInline>
      </span>
    </NavLink>
  );
}
