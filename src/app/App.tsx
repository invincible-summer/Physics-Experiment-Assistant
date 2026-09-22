/** 根应用：Hash 路由（GitHub Pages 兼容）+ 外观同步 + ToastRegion。
 * 公式库（300 条定义 + 计算器）与重页面均路由级 lazy，不进首页初始 chunk（plan §8.3）。 */
import { lazy, useEffect } from 'react';
import { LazyPage } from './LazyPage';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './shell/AppShell';
import { ToastRegion } from '../components/ui';
import { useSettings } from '../stores/settings';
import { HomePage } from '../features/home/HomePage';
import { ExperimentsPage, NewExperimentProjectPage } from '../features/experiments/ExperimentsPage';
import { StatisticsPage } from '../features/tools/StatisticsPage';
import { ToolsIndexPage } from '../features/tools/ToolsIndexPage';
import { UncertaintyPage } from '../features/tools/UncertaintyPage';
import { CalculatorPage } from '../features/tools/CalculatorPage';
import { UnitsPage } from '../features/tools/UnitsPage';
import { ProjectsPage } from '../features/projects/ProjectsPage';
import { SettingsPage } from '../features/settings/SettingsPage';

const FormulasPage = lazy(() => import('../features/formulas/FormulasPage').then(m => ({ default: m.FormulasPage })));
const FormulaDetailPage = lazy(() => import('../features/formulas/FormulasPage').then(m => ({ default: m.FormulaDetailPage })));
const SourcesPage = lazy(() => import('../features/sources/SourcesPage').then(m => ({ default: m.SourcesPage })));
const ProjectWorkbenchPage = lazy(() => import('../features/experiments/ProjectWorkbenchPage').then(m => ({ default: m.ProjectWorkbenchPage })));
const RegressionPage = lazy(() => import('../features/tools/RegressionPage').then(m => ({ default: m.RegressionPage })));
const WeightedMeanPage = lazy(() => import('../features/tools/WeightedMeanPage').then(m => ({ default: m.WeightedMeanPage })));
const PlotterPage = lazy(() => import('../features/tools/PlotterPage').then(m => ({ default: m.PlotterPage })));

/** 把外观偏好（主题 + 字号档位）同步到 <html data-theme / data-font-scale>；跟随系统时监听系统变化 */
function useAppearanceSync() {
  const theme = useSettings((s) => s.theme);
  const fontScale = useSettings((s) => s.fontScale);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && mq.matches);
      document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme]);
  useEffect(() => {
    document.documentElement.dataset.fontScale = String(fontScale);
  }, [fontScale]);
}

export function App() {
  useAppearanceSync();
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<AppShell><HomePage /></AppShell>} />
        <Route path="/experiments" element={<AppShell><ExperimentsPage /></AppShell>} />
        <Route path="/experiments/:experimentId/new" element={<AppShell><NewExperimentProjectPage /></AppShell>} />
        <Route path="/project/:projectId" element={<LazyPage><ProjectWorkbenchPage /></LazyPage>} />
        <Route path="/formulas" element={<AppShell><LazyPage><FormulasPage /></LazyPage></AppShell>} />
        <Route path="/formulas/:formulaId" element={<AppShell><LazyPage><FormulaDetailPage /></LazyPage></AppShell>} />
        <Route path="/tools" element={<AppShell><ToolsIndexPage /></AppShell>} />
        <Route path="/tools/statistics" element={<AppShell><StatisticsPage /></AppShell>} />
        <Route path="/tools/regression" element={<AppShell><LazyPage><RegressionPage /></LazyPage></AppShell>} />
        <Route path="/tools/uncertainty" element={<AppShell><UncertaintyPage /></AppShell>} />
        <Route path="/tools/weighted-mean" element={<AppShell><LazyPage><WeightedMeanPage /></LazyPage></AppShell>} />
        <Route path="/tools/calculator" element={<AppShell><CalculatorPage /></AppShell>} />
        <Route path="/tools/units" element={<AppShell><UnitsPage /></AppShell>} />
        <Route path="/tools/plotter" element={<AppShell><LazyPage><PlotterPage /></LazyPage></AppShell>} />
        <Route path="/projects" element={<AppShell><ProjectsPage /></AppShell>} />
        <Route path="/settings" element={<AppShell><SettingsPage /></AppShell>} />
        <Route path="/sources" element={<AppShell><LazyPage><SourcesPage /></LazyPage></AppShell>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <ToastRegion />
    </HashRouter>
  );
}
