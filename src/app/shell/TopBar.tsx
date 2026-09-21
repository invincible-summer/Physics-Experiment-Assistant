/** 页面顶栏容器（工作台等页面注入返回/标题/徽标/操作按钮） */
import { ReactNode } from 'react';

export function TopBar({ children }: { children: ReactNode }) {
  return (
    <header className="topbar">
      <div className="topbar-inner">{children}</div>
    </header>
  );
}
