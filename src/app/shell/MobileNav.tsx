/** 移动端底部主导航（≤900px 显示，与桌面侧栏共用 nav-config）：图标 + 文字标签 */
import { NavLink } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import { MarkdownInline } from '../../components/Markdown';
import { MOBILE_NAV_ITEMS } from './nav-config';

export function MobileNav() {
  return (
    <nav className="mobile-nav" aria-label="移动端主导航">
      {MOBILE_NAV_ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) => `m-item${isActive ? ' active' : ''}`}
        >
          <Icon name={item.icon} />
          <MarkdownInline allowLinks={false}>{item.mobileLabel}</MarkdownInline>
        </NavLink>
      ))}
    </nav>
  );
}
