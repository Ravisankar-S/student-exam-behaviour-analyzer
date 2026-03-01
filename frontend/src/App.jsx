import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import AuthPage from './pages/AuthPage'
import TeacherDashboard from './pages/TeacherDashboard'

/* Redirects to /login if not authenticated; also guards by role */
function ProtectedRoute({ children, allowedRole }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="loading-screen">Loading…</div>
  if (!user)   return <Navigate to="/" replace />
  if (allowedRole && user.role !== allowedRole) return <Navigate to="/" replace />
  return children
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<AuthPage />} />
      <Route
        path="/dashboard/teacher"
        element={
          <ProtectedRoute allowedRole="teacher">
            <TeacherDashboard />
          </ProtectedRoute>
        }
      />
      {/* Catch-all → back to auth */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
