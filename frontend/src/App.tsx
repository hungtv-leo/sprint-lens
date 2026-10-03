import { Navigate, Route, Routes } from 'react-router-dom'

import { AppShell } from './components/layout/app-shell'
import { BoardPage } from './pages/board-page'
import { DashboardPage } from './pages/dashboard-page'
import { KpiPage } from './pages/kpi-page'
import { OpsCasesPage } from './pages/ops-cases-page'

function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/board" element={<BoardPage />} />
        <Route path="/kpi" element={<KpiPage />} />
        <Route path="/ops/cases" element={<OpsCasesPage />} />
        <Route path="/ops" element={<Navigate to="/ops/cases" replace />} />
        <Route path="/settings" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </AppShell>
  )
}

export default App
