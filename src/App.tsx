import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { ClassDetailPage } from './pages/ClassDetailPage'
import { ClassesPage } from './pages/ClassesPage'
import { HistoryPage } from './pages/HistoryPage'
import { HomePage } from './pages/HomePage'
import { LabelsPage } from './pages/LabelsPage'
import { LoginPage } from './pages/LoginPage'
import { ResultPage } from './pages/ResultPage'
import { ScanPage } from './pages/ScanPage'
import { SpikePage } from './pages/SpikePage'

const basename = import.meta.env.BASE_URL.replace(/\/$/, '')

export default function App() {
  return (
    <BrowserRouter basename={basename}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="classes" element={<ClassesPage />} />
          <Route path="classes/:classId" element={<ClassDetailPage />} />
          <Route path="classes/:classId/labels" element={<LabelsPage />} />
          <Route path="scan/:assignmentId" element={<ScanPage />} />
          <Route path="result/:assignmentId" element={<ResultPage />} />
          <Route path="history" element={<HistoryPage />} />
          <Route path="spike" element={<SpikePage />} />
          <Route path="login" element={<LoginPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
