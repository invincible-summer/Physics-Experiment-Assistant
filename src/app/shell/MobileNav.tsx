/** 移动端底部主导航（≤900px 显示，与桌面侧栏共用 nav-config） */
import { NavLink } from 'react-router-dom';
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
          <MarkdownInline allowLinks={false}>{item.mobileLabel}</MarkdownInline>
        </NavLink>
      ))}
    </nav>
  );
}
