/** 根应用：Hash 路由（GitHub Pages 兼容）+ 主题同步 + ToastRegion */
import { useEffect } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './shell/AppShell';
import { ToastRegion } from '../components/ui';
import { useSettings } from '../stores/settings';
import { HomePage } from '../features/home/HomePage';
import { ExperimentsPage, NewExperimentProjectPage } from '../features/experiments/ExperimentsPage';
import { ProjectWorkbenchPage } from '../features/experiments/ProjectWorkbenchPage';
import { FormulasPage, FormulaDetailPage } from '../features/formulas/FormulasPage';
import { StatisticsPage } from '../features/tools/StatisticsPage';
import { RegressionPage } from '../features/tools/RegressionPage';
import { UncertaintyPage } from '../features/tools/UncertaintyPage';
import { WeightedMeanPage } from '../features/tools/WeightedMeanPage';
import { CalculatorPage } from '../features/tools/CalculatorPage';
import { UnitsPage } from '../features/tools/UnitsPage';
import { ProjectsPage } from '../features/projects/ProjectsPage';
import { SettingsPage } from '../features/settings/SettingsPage';
import { SourcesPage } from '../features/sources/SourcesPage';

/** 把设置中的 theme（system/light/dark）同步到 <html data-theme>，跟随系统时监听系统变化 */
function useThemeSync() {
  const theme = useSettings((s) => s.theme);
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
}

export function App() {
  useThemeSync();
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<AppShell><HomePage /></AppShell>} />
        <Route path="/experiments" element={<AppShell><ExperimentsPage /></AppShell>} />
        <Route path="/experiments/:experimentId/new" element={<AppShell><NewExperimentProjectPage /></AppShell>} />
        <Route path="/project/:projectId" element={<ProjectWorkbenchPage />} />
        <Route path="/formulas" element={<AppShell><FormulasPage /></AppShell>} />
        <Route path="/formulas/:formulaId" element={<AppShell><FormulaDetailPage /></AppShell>} />
        <Route path="/tools/statistics" element={<AppShell><StatisticsPage /></AppShell>} />
        <Route path="/tools/regression" element={<AppShell><RegressionPage /></AppShell>} />
        <Route path="/tools/uncertainty" element={<AppShell><UncertaintyPage /></AppShell>} />
        <Route path="/tools/weighted-mean" element={<AppShell><WeightedMeanPage /></AppShell>} />
        <Route path="/tools/calculator" element={<AppShell><CalculatorPage /></AppShell>} />
        <Route path="/tools/units" element={<AppShell><UnitsPage /></AppShell>} />
        <Route path="/projects" element={<AppShell><ProjectsPage /></AppShell>} />
        <Route path="/settings" element={<AppShell><SettingsPage /></AppShell>} />
        <Route path="/sources" element={<AppShell><SourcesPage /></AppShell>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <ToastRegion />
    </HashRouter>
  );
}
