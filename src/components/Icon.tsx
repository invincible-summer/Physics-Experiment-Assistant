/**
 * 手绘描边图标集 —— 24×24 viewBox，1.7px currentColor 描边，零依赖内联 SVG。
 * 约定（AGENTS.md §12）：图标仅作装饰（aria-hidden），永远与文字标签共存，
 * 不得用纯图标替代可读按钮文字。新增图标时在 ICON_PATHS 中登记并在此注释计数。
 * 当前 35 枚。
 */
import { ReactNode } from 'react';

export type IconName =
  | 'home' | 'flask' | 'function' | 'chart' | 'grid' | 'folder' | 'settings' | 'book'
  | 'calculator' | 'ruler' | 'wave' | 'target' | 'arrow-left' | 'arrow-right'
  | 'chevron-right' | 'chevron-down' | 'check' | 'alert' | 'info' | 'download' | 'upload'
  | 'copy' | 'plus' | 'trash' | 'undo' | 'redo' | 'search' | 'close' | 'send'
  | 'sun' | 'moon' | 'monitor' | 'panel-left' | 'clock' | 'pencil' | 'swap';

const I = {
  home: (
    <>
      <path d="M3.5 11.2 12 4l8.5 7.2" />
      <path d="M5.8 9.8V20h12.4V9.8" />
      <path d="M10 20v-5.2h4V20" />
    </>
  ),
  flask: (
    <>
      <path d="M9.2 3.2h5.6" />
      <path d="M10.2 3.2v5L5 17.6A2.1 2.1 0 0 0 6.9 20.8h10.2a2.1 2.1 0 0 0 1.9-3.2L13.8 8.2v-5" />
      <path d="M7.6 14.2h8.8" />
    </>
  ),
  function: (
    <>
      <path d="M15.5 4.5c-2.1 0-2.9 1.5-3.2 3.3l-1.8 11.4c-.3 1.5-1 2.6-2.9 2.6" />
      <path d="M6.8 10.2h8.4" />
    </>
  ),
  chart: (
    <>
      <path d="M4 4v15.2c0 .4.2.8.8.8H20" />
      <path d="M7.4 14.2l3.4-4.2 3 2.6 4.6-5.8" />
    </>
  ),
  grid: (
    <>
      <rect x="4" y="4.5" width="16" height="15" rx="1.6" />
      <path d="M4 9.7h16M4 14.8h16M12 4.5v15" />
    </>
  ),
  folder: (
    <>
      <path d="M3.5 7.2a2 2 0 0 1 2-2h4.1l2 2.4h6.9a2 2 0 0 1 2 2v7.9a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" />
    </>
  ),
  settings: (
    <>
      <path d="M4 7.2h16M4 12h16M4 16.8h16" />
      <circle cx="9.2" cy="7.2" r="1.9" className="icon-knob" />
      <circle cx="14.8" cy="12" r="1.9" className="icon-knob" />
      <circle cx="7.4" cy="16.8" r="1.9" className="icon-knob" />
    </>
  ),
  book: (
    <>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </>
  ),
  calculator: (
    <>
      <rect x="5.5" y="3.5" width="13" height="17" rx="1.8" />
      <path d="M8.5 7h7" />
      <path d="M8.7 11.2h.9M11.6 11.2h.9M14.5 11.2h.9M8.7 14.4h.9M11.6 14.4h.9M14.5 14.4h.9M8.7 17.4h.9M11.6 17.4h.9M14.5 17.4h.9" />
    </>
  ),
  ruler: (
    <>
      <rect x="2.8" y="9" width="18.4" height="6" rx="1.2" transform="rotate(-30 12 12)" />
      <path d="m8.6 15.4 1-1.7M11.4 13.2l1-1.7M14.2 11l1-1.7" transform="rotate(0 12 12)" />
    </>
  ),
  wave: (
    <path d="M2.8 12c1.8 0 1.8-6 3.8-6s2 12 3.9 12 1.9-12 3.9-12 1.9 6 3.8 6 1.8-6 3-6" />
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="7.6" />
      <circle cx="12" cy="12" r="3.6" />
      <circle cx="12" cy="12" r="0.4" className="icon-fill" />
    </>
  ),
  'arrow-left': (
    <>
      <path d="M19 12H5.4" />
      <path d="m10.2 6.8-5 5.2 5 5.2" />
    </>
  ),
  'arrow-right': (
    <>
      <path d="M5 12h13.6" />
      <path d="m13.8 6.8 5 5.2-5 5.2" />
    </>
  ),
  'chevron-right': <path d="m9.5 6.5 5.5 5.5-5.5 5.5" />,
  'chevron-down': <path d="m6.5 9.5 5.5 5.5 5.5-5.5" />,
  check: <path d="m4.8 12.6 4.6 4.7L19.2 6.8" />,
  alert: (
    <>
      <path d="M12 4.2 20.8 19a1.2 1.2 0 0 1-1 1.8H4.2a1.2 1.2 0 0 1-1-1.8z" />
      <path d="M12 9.8v4.2" />
      <circle cx="12" cy="16.9" r="0.4" className="icon-fill" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="8.2" />
      <path d="M12 11v5" />
      <circle cx="12" cy="7.8" r="0.4" className="icon-fill" />
    </>
  ),
  download: (
    <>
      <path d="M12 4v10.2" />
      <path d="m7.2 10.6 4.8 4.6 4.8-4.6" />
      <path d="M4.5 19.5h15" />
    </>
  ),
  upload: (
    <>
      <path d="M12 19.5V9.3" />
      <path d="m7.2 13.4 4.8-4.6 4.8 4.6" />
      <path d="M4.5 4.5h15" />
    </>
  ),
  copy: (
    <>
      <rect x="8.8" y="8.8" width="11" height="11.4" rx="1.8" />
      <path d="M15.2 5.5V5.2A1.7 1.7 0 0 0 13.5 3.5H5.7a1.7 1.7 0 0 0-1.7 1.7v7.8a1.7 1.7 0 0 0 1.7 1.7h.3" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  trash: (
    <>
      <path d="M4.5 7h15" />
      <path d="M9.3 7V4.8A1.3 1.3 0 0 1 10.6 3.5h2.8a1.3 1.3 0 0 1 1.3 1.3V7" />
      <path d="m6.6 7 .8 12.2a1.3 1.3 0 0 0 1.3 1.2h6.6a1.3 1.3 0 0 0 1.3-1.2L17.4 7" />
      <path d="M10.2 10.8v5.4M13.8 10.8v5.4" />
    </>
  ),
  undo: (
    <>
      <path d="m7.4 4.6-4 4 4 4" />
      <path d="M3.6 8.6h9.6a5.6 5.6 0 0 1 0 11.2H9" />
    </>
  ),
  redo: (
    <>
      <path d="m16.6 4.6 4 4-4 4" />
      <path d="M20.4 8.6h-9.6a5.6 5.6 0 0 0 0 11.2H15" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6.4" />
      <path d="m15.8 15.8 4.4 4.4" />
    </>
  ),
  close: <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />,
  send: (
    <>
      <path d="M20.8 3.2 11 13" />
      <path d="M20.8 3.2 14 20.8l-3-7.8-7.8-3z" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" />
    </>
  ),
  moon: (
    <path d="M20 13.6A8.2 8.2 0 1 1 10.4 4a6.6 6.6 0 0 0 9.6 9.6z" />
  ),
  monitor: (
    <>
      <rect x="3.5" y="4.5" width="17" height="12" rx="1.6" />
      <path d="M9.5 20.5h5M12 16.5v4" />
    </>
  ),
  'panel-left': (
    <>
      <rect x="3.5" y="4.5" width="17" height="15" rx="1.8" />
      <path d="M9.7 4.5v15" />
      <path d="m6.9 10.4-1.6 1.6 1.6 1.6" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.2" />
      <path d="M12 7.4V12l3.2 2" />
    </>
  ),
  pencil: (
    <>
      <path d="m4.5 19.5.9-4L16.6 4.3a2.05 2.05 0 0 1 2.9 0l.2.2a2.05 2.05 0 0 1 0 2.9L8.5 18.6z" />
      <path d="m14.6 6.3 3.1 3.1" />
    </>
  ),
  swap: (
    <>
      <path d="M4 8.2h13.6" />
      <path d="m14.2 4.6 3.8 3.6-3.8 3.6" />
      <path d="M20 15.8H6.4" />
      <path d="m9.8 12.2-3.8 3.6 3.8 3.6" />
    </>
  ),
} satisfies Record<string, ReactNode>;

export const ICON_NAMES = Object.keys(I) as IconName[];

export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg
      className="icon"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {I[name]}
    </svg>
  );
}
