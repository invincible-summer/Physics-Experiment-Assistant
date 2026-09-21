/**
 * 主导航声明式配置 —— 桌面侧栏、移动底栏共用单一数据源。
 * label：桌面展开态完整名；compactLabel：折叠态缩写（可读文字，不用纯图案）；
 * mobileLabel：移动底栏名；mobile=true 进入移动底栏（主入口）。
 * icon：手绘描边图标名（见 components/Icon.tsx），仅装饰，永远与文字共存。
 */
import type { IconName } from '../../components/Icon';

export interface NavItemDef {
  to: string;
  label: string;
  compactLabel: string;
  mobileLabel: string;
  icon: IconName;
  /** NavLink end（仅首页需要精确匹配） */
  end?: boolean;
  /** 进入移动端底部主导航 */
  mobile?: boolean;
}

export interface NavGroupDef {
  key: string;
  label: string;
  items: NavItemDef[];
}

export const NAV_GROUPS: NavGroupDef[] = [
  {
    key: 'workspace',
    label: '工作区',
    items: [
      { to: '/', label: '首页', compactLabel: '首页', mobileLabel: '首页', icon: 'home', end: true, mobile: true },
      { to: '/experiments', label: '实验工作台', compactLabel: '实验', mobileLabel: '实验', icon: 'flask', mobile: true },
      { to: '/formulas', label: '公式工作台', compactLabel: '公式', mobileLabel: '公式', icon: 'function', mobile: true },
      { to: '/tools', label: '数据处理工具', compactLabel: '工具', mobileLabel: '数据', icon: 'chart', mobile: true },
      { to: '/projects', label: '我的项目', compactLabel: '项目', mobileLabel: '项目', icon: 'folder', mobile: true },
    ],
  },
  {
    key: 'system',
    label: '系统',
    items: [
      { to: '/settings', label: '设置', compactLabel: '设置', mobileLabel: '设置', icon: 'settings' },
      { to: '/sources', label: '关于与规则', compactLabel: '规则', mobileLabel: '规则', icon: 'book' },
    ],
  },
];

/** 移动底栏主入口（≤5 个） */
export const MOBILE_NAV_ITEMS: NavItemDef[] = NAV_GROUPS.flatMap((g) => g.items).filter((i) => i.mobile);
