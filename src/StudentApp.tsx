import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { StudentLayout } from './components/StudentLayout'
import { JoinPage } from './pages/student/JoinPage'
import { StudentHomePage } from './pages/student/StudentHomePage'
import { StudentRemindersPage } from './pages/student/StudentRemindersPage'

const basename = import.meta.env.BASE_URL.replace(/\/$/, '')

export default function StudentApp() {
  return (
    <BrowserRouter basename={basename}>
      <Routes>
        <Route element={<StudentLayout />}>
          <Route index element={<StudentHomePage />} />
          <Route path="join" element={<JoinPage />} />
          <Route path="reminders" element={<StudentRemindersPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
