import { useEffect, useMemo, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Bell, Check, LogOut, Trash2, User, X } from "lucide-react"
import { useAuth } from "../context/AuthContext"
import { approveAdmissionRequest, getAdmissionRequests, rejectAdmissionRequest } from "../api/auth"

export default function AdminDashboard() {
  const { user, token, logout } = useAuth()
  const navigate = useNavigate()

  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [actionMap, setActionMap] = useState({})
  const [notificationOpen, setNotificationOpen] = useState(false)
  const [notificationDismissed, setNotificationDismissed] = useState({})
  const [toast, setToast] = useState(null)
  const notificationRef = useRef(null)

  useEffect(() => {
    loadRequests()
  }, []) 

  useEffect(() => {
    function onPointerDown(event) {
      if (!notificationRef.current) return
      if (!notificationRef.current.contains(event.target)) {
        setNotificationOpen(false)
      }
    }
    document.addEventListener("mousedown", onPointerDown)
    return () => document.removeEventListener("mousedown", onPointerDown)
  }, [])

  function flash(message, type = "success") {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  async function loadRequests() {
    setLoading(true)
    try {
      const res = await getAdmissionRequests(token, "pending")
      setRequests(res.data || [])
    } catch (err) {
      flash(err?.response?.data?.detail || "Failed to load admission requests", "error")
    } finally {
      setLoading(false)
    }
  }

  async function handleAction(studentUserId, action) {
    setActionMap((prev) => ({ ...prev, [studentUserId]: action }))
    try {
      if (action === "approve") {
        await approveAdmissionRequest(token, studentUserId)
      } else {
        await rejectAdmissionRequest(token, studentUserId)
      }
      setRequests((prev) => prev.filter((r) => r.student_user_id !== studentUserId))
      setNotificationDismissed((prev) => ({ ...prev, [studentUserId]: true }))
      flash(action === "approve" ? "Admission approved" : "Admission declined")
    } catch (err) {
      flash(err?.response?.data?.detail || "Failed to update request", "error")
    } finally {
      setActionMap((prev) => {
        const next = { ...prev }
        delete next[studentUserId]
        return next
      })
    }
  }

  const notifications = useMemo(() => {
    return requests
      .filter((req) => !notificationDismissed[req.student_user_id])
      .map((req) => ({
        id: req.student_user_id,
        title: `${req.student_name} requested admission`,
        detail: `${req.reg_no} · ${req.student_email}`,
      }))
  }, [requests, notificationDismissed])

  function clearNotification(id) {
    setNotificationDismissed((prev) => ({ ...prev, [id]: true }))
  }

  function clearAllNotifications() {
    const flags = {}
    for (const item of requests) flags[item.student_user_id] = true
    setNotificationDismissed(flags)
  }

  return (
    <div className="min-h-screen bg-[#f4f6fb]">
      <header className="bg-white border-b border-gray-100 h-16 flex items-center px-4 lg:px-8 gap-4 sticky top-0 z-30 shadow-sm">
        <h1 className="text-base font-bold text-[#1a1a2e]">Admin Dashboard</h1>
        <div className="ml-auto flex items-center gap-2">
          <div className="relative" ref={notificationRef}>
            <button
              onClick={() => setNotificationOpen((v) => !v)}
              className="relative h-10 w-10 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 flex items-center justify-center"
              title="Admission notifications"
            >
              <Bell size={18} />
              {notifications.length > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#ff416c] text-white text-[10px] font-bold flex items-center justify-center">
                  {notifications.length}
                </span>
              )}
            </button>
            {notificationOpen && (
              <div className="absolute right-0 top-12 w-80 max-w-[85vw] bg-white border border-gray-100 shadow-xl rounded-xl p-2 z-40">
                <div className="flex items-center justify-between px-2 py-1.5">
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Notifications</p>
                  <button
                    onClick={clearAllNotifications}
                    className="h-7 w-7 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 flex items-center justify-center"
                    title="Clear all"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
                <div className="max-h-72 overflow-auto space-y-1">
                  {notifications.length === 0 ? (
                    <p className="px-2 py-4 text-sm text-gray-400 text-center">No new updates.</p>
                  ) : (
                    notifications.map((item) => (
                      <div key={item.id} className="flex items-start gap-2 rounded-lg border border-gray-100 px-2 py-2">
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-[#1a1a2e] leading-tight">{item.title}</p>
                          <p className="text-xs text-gray-500 mt-1">{item.detail}</p>
                        </div>
                        <button
                          onClick={() => clearNotification(item.id)}
                          className="h-7 w-7 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 flex items-center justify-center"
                          title="Clear"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="hidden sm:flex items-center gap-2 rounded-xl border border-gray-100 px-3 py-1.5">
            <User size={14} className="text-gray-500" />
            <p className="text-sm font-semibold text-[#1a1a2e] leading-tight">{user?.name || "Admin"}</p>
          </div>
          <button
            onClick={() => {
              logout()
              navigate("/")
            }}
            className="h-10 px-3 rounded-xl border border-red-200 text-red-500 hover:bg-red-50 text-sm font-semibold inline-flex items-center gap-1"
          >
            <LogOut size={14} /> Logout
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4 lg:p-8 space-y-6">
        <div>
          <h2 className="text-2xl font-extrabold text-[#1a1a2e]">Admission Requests</h2>
          <p className="text-sm text-gray-500 mt-1">Approve or decline pending student sign-up requests.</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <h3 className="font-bold text-[#1a1a2e]">Pending Queue</h3>
            <span className="text-xs font-semibold text-gray-500">{requests.length} pending</span>
          </div>

          {loading ? (
            <div className="px-6 py-8 text-sm text-gray-400">Loading…</div>
          ) : requests.length === 0 ? (
            <div className="px-6 py-8 text-sm text-gray-500">No pending admission requests.</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {requests.map((req) => {
                const actionLoading = !!actionMap[req.student_user_id]
                return (
                  <div key={req.student_user_id} className="px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
                    <div className="space-y-1 min-w-[220px]">
                      <p className="font-bold text-[#1a1a2e] leading-tight">{req.student_name}</p>
                      <p className="text-sm text-gray-600">Reg No: {req.reg_no}</p>
                      <p className="text-sm text-gray-500">{req.student_email}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleAction(req.student_user_id, "approve")}
                        disabled={actionLoading}
                        className="h-10 w-10 rounded-xl border border-emerald-200 text-emerald-600 hover:bg-emerald-50 disabled:opacity-60 flex items-center justify-center"
                        title="Approve"
                      >
                        <Check size={16} />
                      </button>
                      <button
                        onClick={() => handleAction(req.student_user_id, "reject")}
                        disabled={actionLoading}
                        className="h-10 w-10 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-60 flex items-center justify-center"
                        title="Decline"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </main>

      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl shadow-lg font-semibold text-sm text-white ${toast.type === "error" ? "bg-red-500" : "bg-[#1a1a2e]"}`}>
          {toast.message}
        </div>
      )}
    </div>
  )
}
