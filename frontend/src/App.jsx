import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import RoleSelectPage from './pages/RoleSelectPage'
import AuthPage from './pages/AuthPage'
import TeacherDashboard from './pages/TeacherDashboard'
import ClickSpark from './components/ClickSpark'

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
    <ClickSpark
      sparkColor="#ff4b2b"
      sparkSize={10}
      sparkRadius={20}
      sparkCount={8}
      duration={450}
    >
      <Routes>
      <Route path="/" element={<RoleSelectPage />} />
      <Route path="/auth" element={<AuthPage />} />
      <Route
        path="/dashboard/teacher"
        element={
          <ProtectedRoute allowedRole="teacher">
            <TeacherDashboard />
          </ProtectedRoute>
        }
      />
      {/* Catch-all → back to role select */}
      <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ClickSpark>
  )
}
