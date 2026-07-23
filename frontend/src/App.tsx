import { Navigate, Route, Routes } from 'react-router-dom'

import { AppShell } from './components/layout/app-shell'
import { BoardPage } from './pages/board-page'
import { DashboardPage } from './pages/dashboard-page'
import { KpiPage } from './pages/kpi-page'
import { SettingsPage } from './pages/settings-page'

function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/board" element={<BoardPage />} />
        <Route path="/kpi" element={<KpiPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
    </AppShell>
  )
}

export default App
