import type { SVGProps } from 'react';

export type IconName =
  | 'home'
  | 'experiment'
  | 'formula'
  | 'chart'
  | 'projects'
  | 'settings'
  | 'book'
  | 'sun'
  | 'moon'
  | 'shield'
  | 'arrowRight'
  | 'arrowLeft'
  | 'search'
  | 'download'
  | 'panelRight'
  | 'calculator'
  | 'spark';

export function Icon({
  name,
  size = 18,
  strokeWidth = 1.8,
  ...props
}: SVGProps<SVGSVGElement> & { name: IconName; size?: number; strokeWidth?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': props['aria-label'] ? undefined : true,
  };

  const body = (() => {
    switch (name) {
      case 'home':
        return <><path d="M3.5 10.5 12 3.8l8.5 6.7" /><path d="M5.5 9.5v10.7h13V9.5" /><path d="M9.5 20.2v-6h5v6" /></>;
      case 'experiment':
        return <><path d="M9 3v5.2L4.8 18a2.1 2.1 0 0 0 1.9 3h10.6a2.1 2.1 0 0 0 1.9-3L15 8.2V3" /><path d="M8 3h8" /><path d="M7.3 15h9.4" /></>;
      case 'formula':
        return <><path d="M17.5 4H7l5 8-5 8h10.5" /><path d="M15.5 9.2h3.5" /></>;
      case 'chart':
        return <><path d="M4 20V10" /><path d="M10 20V4" /><path d="M16 20v-7" /><path d="M22 20H2" /></>;
      case 'projects':
        return <><path d="M3 7.5h7l2 2h9v9.5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" /><path d="M3 7.5V5a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v2.5" /></>;
      case 'settings':
        return <><path d="M4 6h10" /><path d="M18 6h2" /><circle cx="16" cy="6" r="2" /><path d="M4 12h2" /><path d="M10 12h10" /><circle cx="8" cy="12" r="2" /><path d="M4 18h8" /><path d="M16 18h4" /><circle cx="14" cy="18" r="2" /></>;
      case 'book':
        return <><path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H11v17H6.5A2.5 2.5 0 0 0 4 21.5Z" /><path d="M20 4.5A2.5 2.5 0 0 0 17.5 2H13v17h4.5a2.5 2.5 0 0 1 2.5 2.5Z" /></>;
      case 'sun':
        return <><circle cx="12" cy="12" r="3.5" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>;
      case 'moon':
        return <path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5 8.8 8.8 0 1 0 20.5 14.2Z" />;
      case 'shield':
        return <><path d="M12 3 4.5 6v5.4c0 4.7 3 7.8 7.5 9.6 4.5-1.8 7.5-4.9 7.5-9.6V6Z" /><path d="m9 12 2 2 4-4" /></>;
      case 'arrowRight':
        return <><path d="M5 12h14" /><path d="m14 7 5 5-5 5" /></>;
      case 'arrowLeft':
        return <><path d="M19 12H5" /><path d="m10 7-5 5 5 5" /></>;
      case 'search':
        return <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4.5 4.5" /></>;
      case 'download':
        return <><path d="M12 3v12" /><path d="m7.5 11 4.5 4.5 4.5-4.5" /><path d="M4 20h16" /></>;
      case 'panelRight':
        return <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M15 4v16" /></>;
      case 'calculator':
        return <><rect x="5" y="2.5" width="14" height="19" rx="2" /><path d="M8 6.5h8" /><path d="M8 11h1M12 11h1M16 11h1M8 15h1M12 15h1M16 15h1M8 19h1M12 19h5" /></>;
      case 'spark':
        return <><path d="m12 3 1.2 4.1L17 9l-3.8 1.9L12 15l-1.2-4.1L7 9l3.8-1.9Z" /><path d="m18.5 14 .7 2.3 2.3.7-2.3.7-.7 2.3-.7-2.3-2.3-.7 2.3-.7Z" /></>;
    }
  })();

  return <svg {...common} {...props}>{body}</svg>;
}
