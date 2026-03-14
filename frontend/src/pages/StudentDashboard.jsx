import { useState } from "react"
import { useAuth } from "../context/AuthContext"
import { useNavigate } from "react-router-dom"
import { changePassword } from "../api/auth"
import ChangePasswordModal from "../components/ChangePasswordModal"

export default function StudentDashboard() {
  const { user, token, logout } = useAuth()
  const navigate = useNavigate()
  const [changePasswordOpen, setChangePasswordOpen] = useState(false)
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [toast, setToast] = useState(null)

  function flash(message, type = "success") {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  async function handlePasswordSave(data) {
    setPasswordLoading(true)
    try {
      await changePassword(token, data)
      setChangePasswordOpen(false)
      flash("Password updated")
    } catch (err) {
      throw err
    } finally {
      setPasswordLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f4f6fb] px-4 py-10">
      <div className="max-w-4xl mx-auto bg-white rounded-2xl border border-gray-100 shadow-sm p-6 md:p-8">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-extrabold text-[#1a1a2e]">Student Dashboard</h1>
            <p className="text-sm text-gray-500 mt-1">This is a dummy page scaffold for student flow.</p>
          </div>
          <div className="flex items-center gap-2">
            {user?.auth_provider === "local" && (
              <button
                onClick={() => setChangePasswordOpen(true)}
                className="px-4 py-2 rounded-xl border border-gray-200 text-gray-700 text-sm font-semibold hover:bg-gray-50"
              >
                Change Password
              </button>
            )}
            <button
              onClick={() => {
                logout()
                navigate("/")
              }}
              className="px-4 py-2 rounded-xl bg-[#1a1a2e] text-white text-sm font-semibold hover:bg-[#2a2a46]"
            >
              Logout
            </button>
          </div>
        </div>

        <div className="mt-6 rounded-xl border border-dashed border-gray-200 p-5 bg-gray-50">
          <p className="text-sm text-gray-600">Logged in as: <span className="font-semibold text-[#1a1a2e]">{user?.name || "Student"}</span></p>
          <p className="text-sm text-gray-600 mt-1">Email: <span className="font-semibold text-[#1a1a2e]">{user?.email || "—"}</span></p>
          <p className="text-sm text-gray-600 mt-1">Role: <span className="font-semibold text-[#1a1a2e]">{user?.role || "student"}</span></p>
        </div>
      </div>

      <ChangePasswordModal
        open={changePasswordOpen}
        onClose={() => setChangePasswordOpen(false)}
        onSubmit={handlePasswordSave}
        loading={passwordLoading}
      />

      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl shadow-lg font-semibold text-sm text-white ${toast.type === "error" ? "bg-red-500" : "bg-[#1a1a2e]"}`}>
          {toast.message}
        </div>
      )}
    </div>
  )
}
