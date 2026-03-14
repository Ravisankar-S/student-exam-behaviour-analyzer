import { useEffect, useMemo, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  Bell,
  Check,
  LayoutDashboard,
  LogOut,
  Menu,
  RotateCcw,
  Shield,
  User,
  Users,
  UserCheck,
  X,
  Trash2,
  ChevronDown,
} from "lucide-react"
import { useAuth } from "../context/AuthContext"
import {
  approveAdmissionRequest,
  changePassword,
  createTeacher,
  deleteProfilePicture,
  getAdmissionRequests,
  getTeachers,
  rejectAdmissionRequest,
  uploadProfilePicture,
} from "../api/auth"
import { updateProfile } from "../api/assessments"
import ChangePasswordModal from "../components/ChangePasswordModal"
import Avatar from "../components/dashboard/DashboardAvatar"
import ImagePreviewModal from "../components/dashboard/ImagePreviewModal"

function formatTime(value) {
  if (!value) return "—"
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return "—"
  return parsed.toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  })
}

export default function AdminDashboard() {
  const { user, token, logout, setUser } = useAuth()
  const navigate = useNavigate()

  const [activeTab, setActiveTab] = useState("dashboard")
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const [changePasswordOpen, setChangePasswordOpen] = useState(false)
  const [passwordLoading, setPasswordLoading] = useState(false)

  const [studentRequests, setStudentRequests] = useState([])
  const [studentDecisionLogs, setStudentDecisionLogs] = useState([])
  const [teachers, setTeachers] = useState([])
  const [loadingStudentRequests, setLoadingStudentRequests] = useState(false)
  const [loadingStudentDecisionLogs, setLoadingStudentDecisionLogs] = useState(false)
  const [loadingTeachers, setLoadingTeachers] = useState(false)
  const [studentActionMap, setStudentActionMap] = useState({})

  const [createTeacherOpen, setCreateTeacherOpen] = useState(false)
  const [teacherCreating, setTeacherCreating] = useState(false)
  const [teacherForm, setTeacherForm] = useState({
    employee_id: "",
    name: "",
    college_email: "",
    designation: "",
    department: "",
  })
  const [profileForm, setProfileForm] = useState({ name: "", email: "" })
  const [profileSaving, setProfileSaving] = useState(false)
  const [profilePictureUploading, setProfilePictureUploading] = useState(false)
  const [profilePictureDeleting, setProfilePictureDeleting] = useState(false)
  const [imageModalSrc, setImageModalSrc] = useState(null)

  const [notificationOpen, setNotificationOpen] = useState(false)
  const [notificationDismissed, setNotificationDismissed] = useState({})
  const [toast, setToast] = useState(null)
  const notificationRef = useRef(null)

  const navItems = [
    { key: "dashboard", label: "Dashboard", Icon: LayoutDashboard },
    { key: "profile", label: "Profile", Icon: User },
    { key: "students", label: "Manage Students", Icon: Users },
    { key: "faculty", label: "Manage Faculty", Icon: UserCheck },
  ]

  useEffect(() => {
    if (user) setProfileForm({ name: user.name || "", email: user.email || "" })
  }, [user])

  useEffect(() => {
    loadStudentsData()
    loadFacultyData()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    function onPointerDown(event) {
      if (!notificationRef.current) return
      if (!notificationRef.current.contains(event.target)) setNotificationOpen(false)
    }
    document.addEventListener("mousedown", onPointerDown)
    return () => document.removeEventListener("mousedown", onPointerDown)
  }, [])

  function flash(message, type = "success") {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3200)
  }

  async function loadStudentsData() {
    await Promise.all([loadStudentRequests(), loadStudentDecisionLogs()])
  }

  async function loadFacultyData() {
    await loadTeachers()
  }

  async function loadTeachers() {
    setLoadingTeachers(true)
    try {
      const res = await getTeachers(token)
      setTeachers(res.data || [])
    } catch (err) {
      flash(err?.response?.data?.detail || "Failed to load teachers", "error")
    } finally {
      setLoadingTeachers(false)
    }
  }

  async function loadStudentRequests() {
    setLoadingStudentRequests(true)
    try {
      const res = await getAdmissionRequests(token, "pending")
      setStudentRequests(res.data || [])
    } catch (err) {
      flash(err?.response?.data?.detail || "Failed to load student requests", "error")
    } finally {
      setLoadingStudentRequests(false)
    }
  }

  async function loadStudentDecisionLogs() {
    setLoadingStudentDecisionLogs(true)
    try {
      const [approvedRes, rejectedRes] = await Promise.all([
        getAdmissionRequests(token, "approved"),
        getAdmissionRequests(token, "rejected"),
      ])
      const merged = [...(approvedRes.data || []), ...(rejectedRes.data || [])]
      merged.sort((a, b) => new Date(b.reviewed_at || b.created_at || 0).getTime() - new Date(a.reviewed_at || a.created_at || 0).getTime())
      setStudentDecisionLogs(merged)
    } catch (err) {
      flash(err?.response?.data?.detail || "Failed to load student decision logs", "error")
    } finally {
      setLoadingStudentDecisionLogs(false)
    }
  }

  async function handleStudentAction(studentUserId, action) {
    setStudentActionMap((prev) => ({ ...prev, [studentUserId]: action }))
    try {
      if (action === "approve") {
        await approveAdmissionRequest(token, studentUserId)
      } else {
        await rejectAdmissionRequest(token, studentUserId)
      }
      setStudentRequests((prev) => prev.filter((req) => req.student_user_id !== studentUserId))
      setNotificationDismissed((prev) => ({ ...prev, [studentUserId]: true }))
      await loadStudentDecisionLogs()
      flash(action === "approve" ? "Student approved" : "Student request rejected")
    } catch (err) {
      flash(err?.response?.data?.detail || "Failed to update student request", "error")
    } finally {
      setStudentActionMap((prev) => {
        const next = { ...prev }
        delete next[studentUserId]
        return next
      })
    }
  }

  async function handleCreateTeacher(event) {
    event.preventDefault()
    if (!teacherForm.name.trim() || !teacherForm.college_email.trim()) {
      flash("Name and college email are required", "error")
      return
    }

    setTeacherCreating(true)
    try {
      const payload = {
        employee_id: teacherForm.employee_id.trim() || null,
        name: teacherForm.name.trim(),
        college_email: teacherForm.college_email.trim(),
        designation: teacherForm.designation.trim() || null,
        department: teacherForm.department.trim() || null,
      }
      await createTeacher(token, payload)
      setCreateTeacherOpen(false)
      setTeacherForm({ employee_id: "", name: "", college_email: "", designation: "", department: "" })
      await loadTeachers()
      flash("Faculty account created and password email sent")
    } catch (err) {
      flash(err?.response?.data?.detail || "Failed to create faculty account", "error")
    } finally {
      setTeacherCreating(false)
    }
  }

  async function handleProfileSave() {
    setProfileSaving(true)
    try {
      const res = await updateProfile(token, profileForm)
      setUser(res.data)
      flash("Profile updated")
    } catch (err) {
      flash(err?.response?.data?.detail || "Failed to update profile", "error")
    } finally {
      setProfileSaving(false)
    }
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

  async function handleProfilePictureUpload(event) {
    const file = event.target.files?.[0]
    if (!file) return

    setProfilePictureUploading(true)
    try {
      const res = await uploadProfilePicture(token, file)
      setUser((prev) => ({
        ...(prev || {}),
        profile_picture_path: res.data?.profile_picture_path || prev?.profile_picture_path,
      }))
      flash("Profile picture updated")
    } catch (err) {
      flash(err?.response?.data?.detail || "Failed to upload profile picture", "error")
    } finally {
      event.target.value = ""
      setProfilePictureUploading(false)
    }
  }

  async function handleProfilePictureDelete() {
    setProfilePictureDeleting(true)
    try {
      await deleteProfilePicture(token)
      setUser((prev) => ({ ...(prev || {}), profile_picture_path: null }))
      flash("Profile picture removed")
    } catch (err) {
      flash(err?.response?.data?.detail || "Failed to remove profile picture", "error")
    } finally {
      setProfilePictureDeleting(false)
    }
  }

  function clearNotification(id) {
    setNotificationDismissed((prev) => ({ ...prev, [id]: true }))
  }

  function clearAllNotifications() {
    const next = {}
    for (const item of notifications) next[item.id] = true
    setNotificationDismissed((prev) => ({ ...prev, ...next }))
  }

  function goTab(key) {
    setActiveTab(key)
    setSidebarOpen(false)
    setProfileMenuOpen(false)
  }

  function handleLogout() {
    logout()
    navigate("/")
  }

  const notifications = useMemo(() => {
    const student = studentRequests.map((req) => ({
      id: req.student_user_id,
      title: `${req.student_name} requested student access`,
      detail: `${req.reg_no} · ${req.student_email}`,
      tab: "students",
    }))
    return student.filter((item) => !notificationDismissed[item.id])
  }, [studentRequests, notificationDismissed])

  const sectionTitle = navItems.find((item) => item.key === activeTab)?.label

  return (
    <div className="min-h-screen bg-[#f4f6fb] flex">
      {sidebarOpen && <div className="fixed inset-0 bg-black/40 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      <aside className={`fixed top-0 left-0 h-full w-64 bg-white/95 backdrop-blur border-r border-gray-200 shadow-xl z-50 flex flex-col transition-transform duration-300 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0 lg:sticky lg:top-0 lg:h-screen lg:shadow-none lg:z-auto lg:transition-all lg:duration-300 ${sidebarCollapsed ? "lg:w-20" : "lg:w-64"}`}>
        <div className="flex items-center gap-2.5 px-4 h-16 border-b border-gray-100 shrink-0">
          <button className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg" onClick={() => setSidebarCollapsed((v) => !v)}>
            <Menu size={18} />
          </button>
          {!sidebarCollapsed && <span className="font-extrabold text-lg text-[#1a1a2e] tracking-tight">Argus.ai</span>}
          <button className="ml-auto p-1 text-gray-400 hover:text-gray-700 lg:hidden" onClick={() => setSidebarOpen(false)}>
            <X size={18} />
          </button>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map(({ key, label, Icon }) => (
            <button
              key={key}
              onClick={() => goTab(key)}
              title={sidebarCollapsed ? label : undefined}
              className={`w-full flex items-center ${sidebarCollapsed ? "justify-center" : "gap-3"} px-4 py-2.5 rounded-xl font-semibold text-sm transition-all ${activeTab === key ? "bg-gradient-to-r from-[#ff4b2b] to-[#ff416c] text-white shadow-sm" : "text-gray-500 hover:bg-gray-50 hover:text-gray-800"}`}
            >
              <Icon size={17} /> {!sidebarCollapsed && label}
            </button>
          ))}

        </nav>
        <div className="mt-auto px-3 pb-4 border-t border-gray-100 pt-3 shrink-0 bg-gradient-to-b from-white to-gray-50/70 lg:mb-0">
          <div className={`flex items-center ${sidebarCollapsed ? "justify-center" : "gap-3"} px-3 py-2 mb-1`}>
            <Avatar name={user?.name} imagePath={user?.profile_picture_path} onClick={setImageModalSrc} fallback="A" />
            {!sidebarCollapsed && (
              <div className="min-w-0">
                <p className="text-sm font-bold text-[#1a1a2e] truncate">{user?.name || "Admin"}</p>
                <p className="text-[10px] font-semibold text-[#ff4b2b] uppercase tracking-wider">Admin</p>
              </div>
            )}
          </div>
          <button onClick={handleLogout} className={`w-full flex items-center ${sidebarCollapsed ? "justify-center" : "gap-2.5"} px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-500 hover:bg-red-50 hover:text-red-500 transition-colors`}>
            <LogOut size={16} /> {!sidebarCollapsed && "Logout"}
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-gray-100 h-16 flex items-center px-4 lg:px-8 gap-4 sticky top-0 z-30 shadow-sm">
          <button className="p-2 text-gray-500 hover:text-gray-800 rounded-lg hover:bg-gray-100 lg:hidden" onClick={() => setSidebarOpen(true)}>
            <Menu size={20} />
          </button>
          <h1 className="hidden lg:block text-base font-bold text-[#1a1a2e]">
            {sectionTitle}
          </h1>
          <div className="ml-auto flex items-center gap-2">
            <div className="relative" ref={notificationRef}>
              <button onClick={() => setNotificationOpen((v) => !v)} className="relative h-10 w-10 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 flex items-center justify-center" title="Notifications">
                <Bell size={18} />
                {notifications.length > 0 && <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#ff416c] text-white text-[10px] font-bold flex items-center justify-center">{notifications.length}</span>}
              </button>
              {notificationOpen && (
                <div className="absolute right-0 top-12 w-80 max-w-[85vw] bg-white border border-gray-100 shadow-xl rounded-xl p-2 z-40">
                  <div className="flex items-center justify-between px-2 py-1.5">
                    <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Notifications</p>
                    <button onClick={clearAllNotifications} className="h-7 w-7 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 flex items-center justify-center" title="Clear all">
                      <Trash2 size={13} />
                    </button>
                  </div>
                  <div className="max-h-72 overflow-auto space-y-1">
                    {notifications.length === 0 ? (
                      <p className="px-2 py-4 text-sm text-gray-400 text-center">No new updates.</p>
                    ) : (
                      notifications.map((item) => (
                        <div key={item.id} className="flex items-start gap-2 rounded-lg border border-gray-100 px-2 py-2">
                          <button
                            onClick={() => {
                              setNotificationOpen(false)
                              goTab(item.tab)
                            }}
                            className="flex-1 text-left"
                          >
                            <p className="text-sm font-semibold text-[#1a1a2e] leading-tight">{item.title}</p>
                            <p className="text-xs text-gray-500 mt-1">{item.detail}</p>
                          </button>
                          <button onClick={() => clearNotification(item.id)} className="h-7 w-7 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 flex items-center justify-center" title="Clear">
                            <X size={13} />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="relative" onMouseLeave={() => setProfileMenuOpen(false)}>
              <button onClick={() => setProfileMenuOpen((v) => !v)} onMouseEnter={() => setProfileMenuOpen(true)} className="flex items-center gap-2 hover:bg-gray-50 rounded-xl px-3 py-1.5 transition-colors border border-transparent hover:border-gray-100">
                <Avatar name={user?.name} imagePath={user?.profile_picture_path} onClick={setImageModalSrc} fallback="A" />
                <div className="hidden sm:block text-left">
                  <p className="text-sm font-semibold text-[#1a1a2e] leading-tight">{user?.name || "Admin"}</p>
                  <p className="text-[10px] uppercase tracking-wider text-[#ff4b2b] font-semibold">Admin</p>
                </div>
                <ChevronDown size={14} className={`text-gray-400 transition-transform ${profileMenuOpen ? "rotate-180" : ""}`} />
              </button>
              {profileMenuOpen && (
                <div className="absolute right-0 top-12 w-48 bg-white border border-gray-100 shadow-xl rounded-xl p-1.5 z-40">
                  <button onClick={() => goTab("profile")} className="w-full flex items-center gap-2 px-3 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50 rounded-lg">
                    <User size={15} /> Profile
                  </button>
                  <button onClick={() => { setProfileMenuOpen(false); setChangePasswordOpen(true) }} className="w-full flex items-center gap-2 px-3 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50 rounded-lg">
                    <Shield size={15} /> Change Password
                  </button>
                  <button onClick={handleLogout} className="w-full flex items-center gap-2 px-3 py-2 text-sm font-semibold text-red-500 hover:bg-red-50 rounded-lg">
                    <LogOut size={15} /> Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-8 max-w-7xl w-full mx-auto space-y-6">
          {activeTab === "dashboard" && (
            <>
              <div>
                <h2 className="text-2xl font-extrabold text-[#1a1a2e]">Admin Overview</h2>
                <p className="text-gray-500 text-sm mt-0.5">Manage onboarding and accounts across the platform.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                <StatCard icon="🎓" value={studentRequests.length} label="Student Requests" />
                <StatCard icon="👨‍🏫" value={teachers.length} label="Faculty Accounts" />
                <StatCard icon="🔔" value={studentRequests.length} label="Pending Reviews" />
              </div>
            </>
          )}

          {activeTab === "profile" && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4 max-w-2xl">
              <h3 className="font-bold text-[#1a1a2e] text-lg">Profile</h3>
              <div className="flex items-center gap-4">
                <Avatar name={user?.name} imagePath={user?.profile_picture_path} large onClick={setImageModalSrc} fallback="A" />
                <div>
                  <p className="font-bold text-[#1a1a2e] text-lg">{user?.name || "Admin"}</p>
                  <p className="text-xs font-semibold text-[#ff4b2b] uppercase tracking-wider">Admin</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50">
                  {profilePictureUploading ? "Uploading…" : "Upload Profile Picture"}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleProfilePictureUpload}
                    disabled={profilePictureUploading}
                    className="hidden"
                  />
                </label>
                {user?.profile_picture_path && (
                  <button
                    type="button"
                    onClick={handleProfilePictureDelete}
                    disabled={profilePictureDeleting}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-red-200 text-red-500 hover:bg-red-50 disabled:opacity-60"
                    title={profilePictureDeleting ? "Removing picture" : "Remove picture"}
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Full Name" value={profileForm.name} onChange={(value) => setProfileForm((prev) => ({ ...prev, name: value }))} placeholder="Your full name" />
                <Field label="Email Address" type="email" value={profileForm.email} onChange={(value) => setProfileForm((prev) => ({ ...prev, email: value }))} placeholder="you@example.com" />
              </div>
              <button onClick={handleProfileSave} disabled={profileSaving} className="px-6 py-2.5 bg-gradient-to-r from-[#ff4b2b] to-[#ff416c] text-white font-semibold rounded-xl hover:opacity-90 transition disabled:opacity-60">
                {profileSaving ? "Saving…" : "Save Basic Details"}
              </button>
            </div>
          )}

          {activeTab === "students" && (
            <div className="space-y-5">
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                  <h3 className="font-bold text-[#1a1a2e]">Manage Students</h3>
                  <button onClick={loadStudentsData} className="text-xs font-semibold text-gray-600 inline-flex items-center gap-1 hover:underline">
                    <RotateCcw size={13} /> Refresh
                  </button>
                </div>
                {loadingStudentRequests ? (
                  <LoadingRow text="Loading student requests…" />
                ) : studentRequests.length === 0 ? (
                  <EmptyRow text="No pending student requests." />
                ) : (
                  <div className="divide-y divide-gray-100">
                    {studentRequests.map((req) => {
                      const loading = !!studentActionMap[req.student_user_id]
                      return (
                        <RequestRow
                          key={req.student_user_id}
                          title={req.student_name}
                          subtitle={`Reg No: ${req.reg_no}`}
                          detail={req.student_email}
                          loading={loading}
                          onApprove={() => handleStudentAction(req.student_user_id, "approve")}
                          onReject={() => handleStudentAction(req.student_user_id, "reject")}
                        />
                      )
                    })}
                  </div>
                )}
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100">
                  <h3 className="font-bold text-[#1a1a2e]">Student Decision Log</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Includes approved and rejected records with IST time.</p>
                </div>
                {loadingStudentDecisionLogs ? (
                  <LoadingRow text="Loading student decision log…" />
                ) : studentDecisionLogs.length === 0 ? (
                  <EmptyRow text="No reviewed student requests yet." />
                ) : (
                  <div className="max-h-[45vh] overflow-y-auto divide-y divide-gray-100">
                    {studentDecisionLogs.map((req) => (
                      <DecisionLogRow
                        key={req.id || req.student_user_id}
                        title={req.student_name}
                        subtitle={`Reg No: ${req.reg_no}`}
                        detail={req.student_email}
                        status={req.status}
                        reviewedAt={req.reviewed_at}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "faculty" && (
            <div className="space-y-5">
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-[#1a1a2e]">Registered Faculty Accounts</h3>
                    <p className="text-xs text-gray-500 mt-0.5">All currently registered teacher accounts.</p>
                  </div>
                  <button
                    onClick={() => setCreateTeacherOpen(true)}
                    className="px-4 py-2 bg-gradient-to-r from-[#ff4b2b] to-[#ff416c] text-white text-sm font-semibold rounded-xl hover:opacity-90 transition"
                  >
                    Add Faculty
                  </button>
                </div>
                {loadingTeachers ? (
                  <LoadingRow text="Loading faculty accounts…" />
                ) : teachers.length === 0 ? (
                  <EmptyRow text="No faculty accounts yet." />
                ) : (
                  <div className="max-h-[60vh] overflow-y-auto divide-y divide-gray-100">
                    {teachers.map((teacher) => (
                      <TeacherAccountRow key={teacher.id} teacher={teacher} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl shadow-lg font-semibold text-sm text-white ${toast.type === "error" ? "bg-red-500" : "bg-[#1a1a2e]"}`}>
          {toast.message}
        </div>
      )}

      <ChangePasswordModal
        open={changePasswordOpen}
        onClose={() => setChangePasswordOpen(false)}
        onSubmit={handlePasswordSave}
        loading={passwordLoading}
      />

      <AddFacultyModal
        open={createTeacherOpen}
        form={teacherForm}
        setForm={setTeacherForm}
        loading={teacherCreating}
        onClose={() => setCreateTeacherOpen(false)}
        onSubmit={handleCreateTeacher}
      />

      {imageModalSrc && <ImagePreviewModal src={imageModalSrc} onClose={() => setImageModalSrc(null)} />}
    </div>
  )
}

function StatCard({ icon, value, label }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#ff4b2b] to-[#ff416c] flex items-center justify-center text-xl shrink-0">
        {icon}
      </div>
      <div>
        <p className="text-2xl font-extrabold text-[#1a1a2e]">{value}</p>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mt-0.5">{label}</p>
      </div>
    </div>
  )
}

function RequestRow({ title, subtitle, detail, loading, onApprove, onReject }) {
  return (
    <div className="px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
      <div className="space-y-1 min-w-[220px]">
        <p className="font-bold text-[#1a1a2e] leading-tight">{title}</p>
        <p className="text-sm text-gray-600">{subtitle}</p>
        <p className="text-sm text-gray-500">{detail}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button onClick={onApprove} disabled={loading} className="h-10 w-10 rounded-xl border border-emerald-200 text-emerald-600 hover:bg-emerald-50 disabled:opacity-60 flex items-center justify-center" title="Approve">
          <Check size={16} />
        </button>
        <button onClick={onReject} disabled={loading} className="h-10 w-10 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-60 flex items-center justify-center" title="Reject">
          <X size={16} />
        </button>
      </div>
    </div>
  )
}

function DecisionLogRow({ title, subtitle, detail, status, reviewedAt }) {
  const isApproved = status === "approved"
  const statusText = isApproved ? "Accepted" : "Rejected"
  const badgeClass = isApproved
    ? "bg-emerald-100 text-emerald-700 border-emerald-200"
    : "bg-red-100 text-red-700 border-red-200"

  return (
    <div className="px-6 py-4 flex items-start justify-between gap-4 flex-wrap">
      <div className="space-y-1 min-w-[220px]">
        <p className="font-bold text-[#1a1a2e] leading-tight">{title}</p>
        <p className="text-sm text-gray-600">{subtitle}</p>
        <p className="text-sm text-gray-500">{detail}</p>
      </div>
      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider text-right space-y-1">
        <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-bold tracking-normal ${badgeClass}`}>
          {statusText}
        </span>
        <div>
          Reviewed: <span className="text-[#1a1a2e] normal-case tracking-normal">{formatTime(reviewedAt)}</span>
        </div>
      </div>
    </div>
  )
}

function TeacherAccountRow({ teacher }) {
  return (
    <div className="px-6 py-4 flex items-start justify-between gap-4 flex-wrap">
      <div className="space-y-1 min-w-[240px]">
        <p className="font-bold text-[#1a1a2e] leading-tight">{teacher.name}</p>
        <p className="text-sm text-gray-600">{teacher.teacher_profile?.college_email || teacher.email}</p>
        <p className="text-sm text-gray-500">
          {teacher.teacher_profile?.designation || "Designation not set"}
          {teacher.teacher_profile?.department ? ` · ${teacher.teacher_profile.department}` : ""}
        </p>
      </div>
      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider text-right space-y-1">
        <div>
          Employee ID: <span className="text-[#1a1a2e] normal-case tracking-normal">{teacher.teacher_profile?.employee_id || "—"}</span>
        </div>
      </div>
    </div>
  )
}

function LoadingRow({ text }) {
  return <div className="px-6 py-8 text-sm text-gray-400">{text}</div>
}

function EmptyRow({ text }) {
  return <div className="px-6 py-8 text-sm text-gray-500">{text}</div>
}

function Field({ label, value, onChange, placeholder, type = "text" }) {
  return (
    <div>
      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-[#1a1a2e] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#ff4b2b]/30 focus:border-[#ff4b2b] transition"
      />
    </div>
  )
}

function AddFacultyModal({ open, form, setForm, loading, onClose, onSubmit }) {
  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="font-bold text-[#1a1a2e]">Add Faculty Account</h3>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>

        <form className="px-6 py-5 grid grid-cols-1 md:grid-cols-2 gap-4" onSubmit={onSubmit}>
          <Field label="Employee ID" value={form.employee_id} onChange={(value) => setForm((prev) => ({ ...prev, employee_id: value }))} placeholder="EMP-001" />
          <Field label="Name" value={form.name} onChange={(value) => setForm((prev) => ({ ...prev, name: value }))} placeholder="Faculty name" />
          <Field label="College Email" type="email" value={form.college_email} onChange={(value) => setForm((prev) => ({ ...prev, college_email: value }))} placeholder="faculty@college.edu" />
          <Field label="Designation" value={form.designation} onChange={(value) => setForm((prev) => ({ ...prev, designation: value }))} placeholder="Assistant Professor" />
          <div className="md:col-span-2">
            <Field label="Department" value={form.department} onChange={(value) => setForm((prev) => ({ ...prev, department: value }))} placeholder="Computer Science" />
          </div>

          <div className="md:col-span-2 flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 border border-gray-200 text-gray-600 text-sm font-semibold rounded-xl hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !form.name.trim() || !form.college_email.trim()}
              className="px-5 py-2.5 bg-gradient-to-r from-[#ff4b2b] to-[#ff416c] text-white text-sm font-semibold rounded-xl hover:opacity-90 transition disabled:opacity-60"
            >
              {loading ? "Creating…" : "Create Faculty"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
