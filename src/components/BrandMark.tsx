/**
 * BrandMark — 产品标识（内联 SVG，几何线稿）。
 * 意象：同心干涉环（波动/干涉/等厚条纹）+ 一道穿过测量点的波形（示波/声波/振动）。
 * 由信号源与测量点两层含义组成，呼应"实验工作台"，不使用星芒/火花一类通用 AI 图形。
 * 装饰性使用（旁侧必有文字标题）；独立使用时可传 title 变成有名字的图像。
 */
export function BrandMark({ size = 36, title }: { size?: number; title?: string }) {
  return (
    <svg
      className="brand-svg"
      width={size}
      height={size}
      viewBox="0 0 36 36"
      fill="none"
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      <circle cx="18" cy="16" r="5" stroke="#ffffff" strokeOpacity="0.95" strokeWidth="1.7" />
      <circle cx="18" cy="16" r="9.2" stroke="#ffffff" strokeOpacity="0.6" strokeWidth="1.5" />
      <circle cx="18" cy="16" r="13.2" stroke="#ffffff" strokeOpacity="0.3" strokeWidth="1.35" />
      <path
        d="M2.8 23.6 Q6.2 18.6 9.6 23.6 T16.4 23.6 T23.2 23.6 T30 23.6 T33.2 23.6"
        stroke="#ffd166"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
      <circle cx="18" cy="16" r="1.7" fill="#ffffff" />
    </svg>
  );
}
