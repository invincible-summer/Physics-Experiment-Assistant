/**
 * PhysicsPlot — ECharts SVG 图表组件。
 * 轴名+单位+图名+数据点+拟合线区分；误差棒（custom series）；
 * 多系列颜色+符号双编码（不以颜色为唯一编码）；SVG/PNG 白底导出；
 * 主题感知配色；PlotChecklist 图表规范检查。
 */
import { useEffect, useMemo, useRef } from 'react';
import * as echarts from 'echarts';
import { Button, Notice, toast } from './ui';
import { useSettings } from '../stores/settings';
import { MarkdownInline, MarkdownList } from './Markdown';

export interface PlotSeries {
  name: string;
  points: { x: number; y: number }[];
  /** 数据点误差棒 */
  xError?: number[];
  yError?: number[];
  type: 'scatter' | 'line';
  /** 是否显示数据点标记（line 也可带 marker） */
  showSymbol?: boolean;
  /** 虚线（拟合线区分） */
  dashed?: boolean;
  color?: string;
  symbol?: 'circle' | 'rect' | 'triangle' | 'diamond' | 'cross' | 'none';
}

export interface PhysicsPlotProps {
  title: string;
  xLabel: string;
  yLabel: string;
  series: PlotSeries[];
  height?: number;
  /** 拟合注释（如 y = a + bx, r = 0.998） */
  annotations?: { text: string }[];
  xLog?: boolean;
  yLog?: boolean;
  /** 隐藏图例（单系列） */
  hideLegend?: boolean;
}

const FALLBACK_COLORS = ['#0b5cad', '#b3402f', '#1a7f37', '#7d3c98', '#9a6208', '#0e7490'];
const SERIES_SYMBOLS: Array<'circle' | 'rect' | 'triangle' | 'diamond'> = ['circle', 'rect', 'triangle', 'diamond'];

function cssVar(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

function seriesPalette(): string[] {
  return [
    cssVar('--series-1', FALLBACK_COLORS[0]),
    cssVar('--series-2', FALLBACK_COLORS[1]),
    cssVar('--series-3', FALLBACK_COLORS[2]),
    cssVar('--series-4', FALLBACK_COLORS[3]),
    cssVar('--series-5', FALLBACK_COLORS[4]),
    cssVar('--series-6', FALLBACK_COLORS[5]),
  ];
}

export function PhysicsPlot(props: PhysicsPlotProps) {
  const elRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);
  const { title, xLabel, yLabel, series, height = 340, annotations = [], xLog, yLog, hideLegend } = props;
  const theme = useSettings((s) => s.theme);
  const defaultPlotFormat = useSettings((s) => s.defaultPlotFormat);
  const plotWhiteBackground = useSettings((s) => s.plotWhiteBackground);

  const option = useMemo(() => {
    const ink2 = cssVar('--ink-2', '#5b574c');
    const ink3 = cssVar('--ink-3', '#918c7d');
    const line = cssVar('--line', '#e5e2d7');
    const palette = seriesPalette();
    const realSeries: echarts.SeriesOption[] = [];
    series.forEach((s, idx) => {
      const color = s.color ?? palette[idx % palette.length];
      const symbol = s.symbol ?? SERIES_SYMBOLS[idx % SERIES_SYMBOLS.length];
      const xData = s.points.map((p) => p.x);
      const yData = s.points.map((p) => p.y);
      realSeries.push({
        name: s.name,
        type: s.type === 'scatter' ? 'scatter' : 'line',
        data: s.points.map((p) => [p.x, p.y]),
        symbol: s.type === 'line' ? (s.showSymbol ? symbol : 'none') : symbol,
        symbolSize: 8,
        itemStyle: { color },
        lineStyle: s.dashed ? { type: 'dashed', color, width: 2 } : { color, width: 2 },
      });
      if (s.yError && s.yError.some((e) => e > 0)) {
        realSeries.push({
          name: `${s.name} 误差棒`,
          type: 'custom',
          renderItem: (_params, api) => {
            const i = _params.dataIndex;
            const x = api.coord([xData[i], yData[i]]);
            const yUp = api.coord([xData[i], yData[i] + (s.yError?.[i] ?? 0)]);
            const yDn = api.coord([xData[i], yData[i] - (s.yError?.[i] ?? 0)]);
            const style = { stroke: color, lineWidth: 1.4 };
            return {
              type: 'group',
              children: [
                { type: 'line', shape: { x1: x[0], y1: yUp[1], x2: x[0], y2: yDn[1] }, style },
                { type: 'line', shape: { x1: x[0] - 4, y1: yUp[1], x2: x[0] + 4, y2: yUp[1] }, style },
                { type: 'line', shape: { x1: x[0] - 4, y1: yDn[1], x2: x[0] + 4, y2: yDn[1] }, style },
              ],
            } as echarts.CustomSeriesRenderItemReturn;
          },
          data: xData.map((x, i) => [x, yData[i], s.yError?.[i] ?? 0]),
          silent: true,
          z: 1,
        });
      }
      if (s.xError && s.xError.some((e) => e > 0)) {
        realSeries.push({
          name: `${s.name} x误差`,
          type: 'custom',
          renderItem: (_params, api) => {
            const i = _params.dataIndex;
            const p = api.coord([xData[i], yData[i]]);
            const xR = api.coord([xData[i] + (s.xError?.[i] ?? 0), yData[i]]);
            const xL = api.coord([xData[i] - (s.xError?.[i] ?? 0), yData[i]]);
            const style = { stroke: color, lineWidth: 1.4 };
            return {
              type: 'group',
              children: [
                { type: 'line', shape: { x1: xL[0], y1: p[1], x2: xR[0], y2: p[1] }, style },
                { type: 'line', shape: { x1: xL[0], y1: p[1] - 4, x2: xL[0], y2: p[1] + 4 }, style },
                { type: 'line', shape: { x1: xR[0], y1: p[1] - 4, x2: xR[0], y2: p[1] + 4 }, style },
              ],
            } as echarts.CustomSeriesRenderItemReturn;
          },
          data: xData.map((x, i) => [x, yData[i], s.xError?.[i] ?? 0]),
          silent: true,
          z: 1,
        });
      }
    });

    return {
      animation: false,
      title: {
        text: title,
        left: 'center',
        top: 4,
        textStyle: { fontSize: 13.5, fontWeight: 650, color: ink2 },
      },
      legend: hideLegend || series.length <= 1 ? undefined : {
        top: 28,
        type: 'scroll',
        textStyle: { color: ink2 },
      },
      grid: { left: 62, right: 22, top: annotations.length > 0 ? 74 : 54, bottom: 44 },
      tooltip: { trigger: 'item' },
      xAxis: {
        name: xLabel,
        nameLocation: 'middle',
        nameGap: 28,
        nameTextStyle: { fontSize: 12.5, color: ink2 },
        type: xLog ? 'log' : 'value',
        scale: true,
        axisLine: { show: true, lineStyle: { color: ink3 } },
        axisLabel: { color: ink2 },
        splitLine: { show: false },
      },
      yAxis: {
        name: yLabel,
        nameLocation: 'middle',
        nameGap: 42,
        nameTextStyle: { fontSize: 12.5, color: ink2 },
        type: yLog ? 'log' : 'value',
        scale: true,
        axisLine: { show: true, lineStyle: { color: ink3 } },
        axisLabel: { color: ink2 },
        splitLine: { show: true, lineStyle: { color: line, opacity: 0.6 } },
      },
      toolbox: { show: false },
      series: realSeries,
    };
    // theme 作为依赖：主题切换后重建配色
  }, [title, xLabel, yLabel, series, annotations, xLog, yLog, hideLegend, theme]);

  useEffect(() => {
    if (!elRef.current) return;
    if (!chartRef.current) {
      chartRef.current = echarts.init(elRef.current, undefined, { renderer: 'svg' });
    }
    chartRef.current.setOption(option, true);
    if (annotations.length > 0 && chartRef.current) {
      chartRef.current.setOption({
        graphic: annotations.map((a, i) => ({
          type: 'text',
          left: 'center',
          top: 52 + i * 18,
          style: { text: a.text, fontSize: 12, fill: cssVar('--ink-2', '#5b574c') },
        })),
      });
    }
    const onResize = () => chartRef.current?.resize();
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
    };
  }, [option, annotations]);

  useEffect(() => {
    return () => {
      chartRef.current?.dispose();
      chartRef.current = null;
    };
  }, []);

  const exportSVG = () => {
    const chart = chartRef.current;
    if (!chart) return;
    const svgEl = chart.getDom().querySelector('svg');
    if (!svgEl) return;
    const clone = svgEl.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.querySelectorAll('[filter]').forEach((n) => n.remove());
    if (plotWhiteBackground) {
      const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      bg.setAttribute('width', '100%');
      bg.setAttribute('height', '100%');
      bg.setAttribute('fill', '#ffffff');
      clone.insertBefore(bg, clone.firstChild);
    }
    const blob = new Blob([clone.outerHTML], { type: 'image/svg+xml' });
    downloadBlob(blob, `${sanitize(title)}.svg`);
    toast('已导出 SVG 图');
  };

  const exportPNG = () => {
    const chart = chartRef.current;
    if (!chart) return;
    const url = chart.getDataURL({
      type: 'png',
      backgroundColor: plotWhiteBackground ? '#ffffff' : 'transparent',
      pixelRatio: 2,
    });
    const a = document.createElement('a');
    a.href = url;
    a.download = `${sanitize(title)}.png`;
    a.click();
    toast('已导出 PNG 图');
  };

  const [first, second] = defaultPlotFormat === 'png' ? ['png', 'svg'] as const : ['svg', 'png'] as const;
  const exporters = {
    svg: <Button key="svg" size="sm" variant={first === 'svg' ? 'default' : 'ghost'} onClick={exportSVG}>导出 SVG</Button>,
    png: <Button key="png" size="sm" variant={first === 'png' ? 'default' : 'ghost'} onClick={exportPNG}>导出 PNG</Button>,
  };

  return (
    <div>
      <div ref={elRef} style={{ width: '100%', height }} role="img" aria-label={`${title}：${xLabel} 对 ${yLabel} 图`} />
      <div className="row-right" style={{ marginTop: 4 }}>
        {exporters[first]}
        {exporters[second]}
      </div>
    </div>
  );
}

/** 图表规范检查：客观提示，不阻止导出 */
export function PlotChecklist({ title, xLabel, yLabel, series }: {
  title: string; xLabel: string; yLabel: string; series: PlotSeries[];
}) {
  const issues: string[] = [];
  if (!title.trim()) issues.push('缺少图名');
  if (/^x$/i.test(xLabel.trim())) issues.push('横轴是裸 "x"，应使用实际物理量名');
  if (/^y$/i.test(yLabel.trim())) issues.push('纵轴是裸 "y"，应使用实际物理量名');
  if (!/\(/.test(xLabel)) issues.push('横轴未标注单位');
  if (!/\(/.test(yLabel)) issues.push('纵轴未标注单位');
  const hasPoints = series.some((s) => s.type === 'scatter' || s.showSymbol);
  if (!hasPoints) issues.push('未显式显示数据点');
  if (issues.length === 0) {
    return (
      <Notice variant="success">
        <MarkdownInline>图表符合课程规范检查（轴名 / 单位 / 图名 / 数据点）</MarkdownInline>
      </Notice>
    );
  }
  return (
    <Notice variant="info" title="图表检查提示">
      <MarkdownList items={issues} />
    </Notice>
  );
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function sanitize(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '_').slice(0, 60);
}
