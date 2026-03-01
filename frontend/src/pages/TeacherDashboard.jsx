import { useAuth } from "../context/AuthContext"
import { useNavigate } from "react-router-dom"
import "../styles/dashboard.css"

export default function TeacherDashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate("/")
  }

  return (
    <div className="dash-page">
      {/* ── Top bar ── */}
      <header className="dash-header">
        <div className="dash-brand">
          <span className="dash-logo">📊</span>
          <span className="dash-title">ExamSense</span>
        </div>
        <div className="dash-user">
          <span className="dash-avatar">{user?.name?.[0]?.toUpperCase() ?? "T"}</span>
          <div className="dash-user-info">
            <p className="dash-user-name">{user?.name ?? "Teacher"}</p>
            <p className="dash-user-role">Teacher</p>
          </div>
          <button className="dash-logout-btn" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>

      {/* ── Welcome banner ── */}
      <main className="dash-main">
        <section className="dash-welcome">
          <h1>Welcome back, {user?.name?.split(" ")[0] ?? "Teacher"}! 👋</h1>
          <p>Here's a snapshot of your classroom activity.</p>
        </section>

        {/* ── Stats cards ── */}
        <div className="dash-cards">
          <div className="dash-card">
            <span className="dash-card-icon">📝</span>
            <div>
              <p className="dash-card-value">—</p>
              <p className="dash-card-label">Exams Created</p>
            </div>
          </div>
          <div className="dash-card">
            <span className="dash-card-icon">👥</span>
            <div>
              <p className="dash-card-value">—</p>
              <p className="dash-card-label">Students Enrolled</p>
            </div>
          </div>
          <div className="dash-card">
            <span className="dash-card-icon">⚠️</span>
            <div>
              <p className="dash-card-value">—</p>
              <p className="dash-card-label">Behaviour Flags</p>
            </div>
          </div>
          <div className="dash-card">
            <span className="dash-card-icon">✅</span>
            <div>
              <p className="dash-card-value">—</p>
              <p className="dash-card-label">Exams Completed</p>
            </div>
          </div>
        </div>

        {/* ── Placeholder panel ── */}
        <section className="dash-panel">
          <h2>Recent Exam Activity</h2>
          <p className="dash-empty">No exams yet. This section will populate once exams are created.</p>
        </section>
      </main>
    </div>
  )
}
