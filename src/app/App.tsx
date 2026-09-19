/** 根应用：Hash 路由（GitHub Pages 兼容，plan.md §18） */
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './layout/AppShell';
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

export function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Shell><HomePage /></Shell>} />
        <Route path="/experiments" element={<Shell><ExperimentsPage /></Shell>} />
        <Route path="/experiments/:experimentId/new" element={<Shell><NewExperimentProjectPage /></Shell>} />
        <Route path="/project/:projectId" element={<ProjectWorkbenchPage />} />
        <Route path="/formulas" element={<Shell><FormulasPage /></Shell>} />
        <Route path="/formulas/:formulaId" element={<Shell><FormulaDetailPage /></Shell>} />
        <Route path="/tools/statistics" element={<Shell><StatisticsPage /></Shell>} />
        <Route path="/tools/regression" element={<Shell><RegressionPage /></Shell>} />
        <Route path="/tools/uncertainty" element={<Shell><UncertaintyPage /></Shell>} />
        <Route path="/tools/weighted-mean" element={<Shell><WeightedMeanPage /></Shell>} />
        <Route path="/tools/calculator" element={<Shell><CalculatorPage /></Shell>} />
        <Route path="/tools/units" element={<Shell><UnitsPage /></Shell>} />
        <Route path="/projects" element={<Shell><ProjectsPage /></Shell>} />
        <Route path="/settings" element={<Shell><SettingsPage /></Shell>} />
        <Route path="/sources" element={<Shell><SourcesPage /></Shell>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
