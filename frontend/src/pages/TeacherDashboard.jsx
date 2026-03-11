import { useState, useEffect } from "react"
import { useAuth } from "../context/AuthContext"
import { useNavigate } from "react-router-dom"
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
} from "@dnd-kit/core"
import {
  SortableContext, rectSortingStrategy, useSortable, arrayMove,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import {
  LayoutDashboard, BookOpen, User, LogOut, Menu, X, Plus,
  Edit2, Trash2, Eye, EyeOff, Clock, Users, BookMarked,
  ChevronRight, AlertCircle, GripVertical, HelpCircle, ListFilter, RotateCcw, ChevronDown,
} from "lucide-react"
import {
  getMyAssessments, createAssessment, updateAssessment,
  deleteAssessment, reorderAssessments, updateProfile,
} from "../api/assessments"
import { changePassword } from "../api/auth"

// ── Subject colour palette ───────────────────
const SUBJECT_COLORS = [
  { bg: "bg-violet-100", text: "text-violet-700" },
  { bg: "bg-blue-100",   text: "text-blue-700"   },
  { bg: "bg-emerald-100",text: "text-emerald-700" },
  { bg: "bg-amber-100",  text: "text-amber-700"   },
  { bg: "bg-pink-100",   text: "text-pink-700"    },
  { bg: "bg-cyan-100",   text: "text-cyan-700"    },
  { bg: "bg-orange-100", text: "text-orange-700"  },
  { bg: "bg-teal-100",   text: "text-teal-700"    },
]
function subjectColor(subject = "") {
  let hash = 0
  for (const c of subject) hash = (hash * 31 + c.charCodeAt(0)) & 0xffff
  return SUBJECT_COLORS[hash % SUBJECT_COLORS.length]
}

// ─────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────
export default function TeacherDashboard() {
  const { user, setUser, token, logout } = useAuth()
  const navigate = useNavigate()

  const [activeTab, setActiveTab]         = useState("dashboard")
  const [sidebarOpen, setSidebarOpen]     = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const [exams, setExams]                 = useState([])
  const [loadingExams, setLoadingExams]   = useState(true)
  const [showCreate, setShowCreate]       = useState(false)
  const [editingExam, setEditingExam]     = useState(null)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [toast, setToast]                 = useState(null)
  const [formLoading, setFormLoading]     = useState(false)
  const [reorderMode, setReorderMode]     = useState(false)
  const [examFilters, setExamFilters]     = useState({
    query: "",
    subject: "all",
    status: "all",
  })

  const blankForm = { title: "", subject: "", duration_minutes: 60, published: true }
  const [formData, setFormData]           = useState(blankForm)
  const [profileForm, setProfileForm]     = useState({ name: "", email: "" })
  const [profileLoading, setProfileLoading] = useState(false)
  const [passwordForm, setPasswordForm]   = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  })
  const [passwordLoading, setPasswordLoading] = useState(false)

  const sensors = useSensors(useSensor(PointerSensor, {
    activationConstraint: { distance: 8 },
  }))

  useEffect(() => { loadExams() }, [])
  useEffect(() => {
    if (user) setProfileForm({ name: user.name || "", email: user.email || "" })
  }, [user])

  async function loadExams() {
    setLoadingExams(true)
    try {
      const res = await getMyAssessments(token)
      setExams(res.data)
    } catch {
      flash("Failed to load exams", "error")
    } finally {
      setLoadingExams(false)
    }
  }

  function flash(message, type = "success") {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3500)
  }

  async function handleCreate() {
    if (!formData.title.trim() || !formData.subject.trim()) return
    setFormLoading(true)
    try {
      await createAssessment(token, formData)
      await loadExams()
      setShowCreate(false)
      setFormData(blankForm)
      flash("Exam created")
    } catch {
      flash("Failed to create exam", "error")
    } finally {
      setFormLoading(false)
    }
  }

  function openEdit(exam) {
    setEditingExam(exam)
    setFormData({
      title: exam.title,
      subject: exam.subject,
      duration_minutes: exam.duration_minutes,
      published: exam.published,
    })
  }

  async function handleEdit() {
    if (!formData.title.trim() || !formData.subject.trim()) return
    setFormLoading(true)
    try {
      await updateAssessment(token, editingExam.id, formData)
      await loadExams()
      setEditingExam(null)
      flash("Exam updated")
    } catch {
      flash("Failed to update exam", "error")
    } finally {
      setFormLoading(false)
    }
  }

  async function handleDelete(id) {
    try {
      await deleteAssessment(token, id)
      setDeleteConfirm(null)
      await loadExams()
      flash("Exam deleted")
    } catch {
      flash("Failed to delete exam", "error")
    }
  }

  async function handleTogglePublish(exam) {
    try {
      await updateAssessment(token, exam.id, { published: !exam.published })
      setExams(prev => prev.map(e => e.id === exam.id ? { ...e, published: !e.published } : e))
      flash(exam.published ? "Exam unpublished" : "Exam is now live")
    } catch {
      flash("Failed to update", "error")
    }
  }

  async function handleDragEnd(event) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = exams.findIndex(e => e.id === active.id)
    const newIndex = exams.findIndex(e => e.id === over.id)
    const reordered = arrayMove(exams, oldIndex, newIndex)
    setExams(reordered)
    try {
      await reorderAssessments(token, reordered.map(e => e.id))
    } catch {
      flash("Failed to save order", "error")
      loadExams()
    }
  }

  async function handleProfileSave() {
    setProfileLoading(true)
    try {
      const res = await updateProfile(token, profileForm)
      setUser(res.data)
      flash("Profile updated")
    } catch (err) {
      flash(err?.response?.data?.detail || "Failed to update profile", "error")
    } finally {
      setProfileLoading(false)
    }
  }

  async function handlePasswordSave() {
    if (!passwordForm.current_password || !passwordForm.new_password || !passwordForm.confirm_password) {
      flash("Please fill all password fields", "error")
      return
    }
    if (passwordForm.new_password.length < 6) {
      flash("New password must be at least 6 characters", "error")
      return
    }
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      flash("New password and confirm password do not match", "error")
      return
    }

    setPasswordLoading(true)
    try {
      await changePassword(token, {
        current_password: passwordForm.current_password,
        new_password: passwordForm.new_password,
      })
      setPasswordForm({ current_password: "", new_password: "", confirm_password: "" })
      flash("Password updated")
    } catch (err) {
      flash(err?.response?.data?.detail || "Failed to update password", "error")
    } finally {
      setPasswordLoading(false)
    }
  }

  function handleLogout() { logout(); navigate("/") }

  const totalExams     = exams.length
  const publishedExams = exams.filter(e => e.published).length
  const totalAttempts  = exams.reduce((s, e) => s + (e.attempt_count || 0), 0)
  const totalQuestions = exams.reduce((s, e) => s + (e.question_count || 0), 0)
  const subjectOptions = [...new Set(exams.map(e => e.subject).filter(Boolean))].sort()
  const filteredExams = exams.filter((exam) => {
    const query = examFilters.query.trim().toLowerCase()
    const byQuery = !query
      || exam.title.toLowerCase().includes(query)
      || exam.subject.toLowerCase().includes(query)
    const bySubject = examFilters.subject === "all" || exam.subject === examFilters.subject
    const byStatus = examFilters.status === "all"
      || (examFilters.status === "published" && exam.published)
      || (examFilters.status === "draft" && !exam.published)
    return byQuery && bySubject && byStatus
  })

  const navItems = [
    { key: "profile",   label: "Profile",   Icon: User },
    { key: "dashboard", label: "Dashboard", Icon: LayoutDashboard },
    { key: "exams",     label: "My Exams",  Icon: BookOpen },
  ]

  function goTab(key) {
    setActiveTab(key)
    if (key !== "exams") setReorderMode(false)
    setSidebarOpen(false)
    setProfileMenuOpen(false)
  }

  const sharedCardProps = {
    onEdit: openEdit,
    onDelete: (id) => setDeleteConfirm(id),
    onTogglePublish: handleTogglePublish,
    onQuestions: (id) => navigate(`/dashboard/teacher/exam/${id}/questions`),
  }

  return (
    <div className="min-h-screen bg-[#f4f6fb] flex">

      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/40 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ── Sidebar ── */}
      <aside className={`
        fixed top-0 left-0 h-full w-64 bg-white/95 backdrop-blur border-r border-gray-200 shadow-xl z-50
        flex flex-col transition-transform duration-300
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
        lg:translate-x-0 lg:sticky lg:top-0 lg:h-screen lg:shadow-none lg:z-auto lg:transition-all lg:duration-300
        ${sidebarCollapsed ? "lg:w-20" : "lg:w-64"}
      `}>
        <div className="flex items-center gap-2.5 px-4 h-16 border-b border-gray-100 shrink-0">
          <button
            className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
            onClick={() => setSidebarCollapsed((v) => !v)}
          >
            <Menu size={18} />
          </button>
          {!sidebarCollapsed && <span className="font-extrabold text-lg text-[#1a1a2e] tracking-tight">Argus.ai</span>}
          <button className="ml-auto p-1 text-gray-400 hover:text-gray-700 lg:hidden" onClick={() => setSidebarOpen(false)}>
            <X size={18} />
          </button>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map(({ key, label, Icon }) => (
            <button key={key} onClick={() => goTab(key)}
              title={sidebarCollapsed ? label : undefined}
              className={`w-full flex items-center ${sidebarCollapsed ? "justify-center" : "gap-3"} px-4 py-2.5 rounded-xl font-semibold text-sm transition-all
                ${activeTab === key
                  ? "bg-gradient-to-r from-[#ff4b2b] to-[#ff416c] text-white shadow-sm"
                  : "text-gray-500 hover:bg-gray-50 hover:text-gray-800"}`}>
              <Icon size={17} />{!sidebarCollapsed && label}
            </button>
          ))}
        </nav>
        <div className="mt-auto px-3 pb-4 border-t border-gray-100 pt-3 shrink-0 bg-gradient-to-b from-white to-gray-50/70 lg:mb-0">
          <div className={`flex items-center ${sidebarCollapsed ? "justify-center" : "gap-3"} px-3 py-2 mb-1`}>
            <Avatar name={user?.name} />
            {!sidebarCollapsed && (
              <div className="min-w-0">
                <p className="text-sm font-bold text-[#1a1a2e] truncate">{user?.name}</p>
                <p className="text-[10px] font-semibold text-[#ff4b2b] uppercase tracking-wider">Teacher</p>
              </div>
            )}
          </div>
          <button onClick={handleLogout}
            className={`w-full flex items-center ${sidebarCollapsed ? "justify-center" : "gap-2.5"} px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-500 hover:bg-red-50 hover:text-red-500 transition-colors`}
            title={sidebarCollapsed ? "Logout" : undefined}
          >
            <LogOut size={16} /> {!sidebarCollapsed && "Logout"}
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-gray-100 h-16 flex items-center px-4 lg:px-8 gap-4 sticky top-0 z-30 shadow-sm">
          <button className="p-2 text-gray-500 hover:text-gray-800 rounded-lg hover:bg-gray-100 lg:hidden" onClick={() => setSidebarOpen(true)}>
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2 lg:hidden">
            <span className="text-xl">📊</span>
            <span className="font-extrabold text-base text-[#1a1a2e]">Argus.ai</span>
          </div>
          <h1 className="hidden lg:block text-base font-bold text-[#1a1a2e]">
            {navItems.find(n => n.key === activeTab)?.label}
          </h1>
          <div className="ml-auto relative" onMouseLeave={() => setProfileMenuOpen(false)}>
            <button
              onClick={() => setProfileMenuOpen((v) => !v)}
              onMouseEnter={() => setProfileMenuOpen(true)}
              className="flex items-center gap-2 hover:bg-gray-50 rounded-xl px-3 py-1.5 transition-colors border border-transparent hover:border-gray-100"
            >
              <Avatar name={user?.name} />
              <div className="hidden sm:block text-left">
                <p className="text-sm font-semibold text-[#1a1a2e] leading-tight">{user?.name}</p>
                <p className="text-[10px] uppercase tracking-wider text-[#ff4b2b] font-semibold">Teacher</p>
              </div>
              <ChevronDown size={14} className={`text-gray-400 transition-transform ${profileMenuOpen ? "rotate-180" : ""}`} />
            </button>
            {profileMenuOpen && (
              <div className="absolute right-0 top-12 w-44 bg-white border border-gray-100 shadow-xl rounded-xl p-1.5 z-40 animate-in fade-in-0 zoom-in-95 duration-150">
                <button
                  onClick={() => goTab("profile")}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50 rounded-lg"
                >
                  <User size={15} /> Profile
                </button>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm font-semibold text-red-500 hover:bg-red-50 rounded-lg"
                >
                  <LogOut size={15} /> Logout
                </button>
              </div>
            )}
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-8 max-w-7xl w-full mx-auto">

          {/* ─ Dashboard ─ */}
          {activeTab === "dashboard" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-extrabold text-[#1a1a2e]">Welcome back, {user?.name?.split(" ")[0]}!</h2>
                <p className="text-gray-500 text-sm mt-0.5">Here's what's happening with your exams.</p>
              </div>
              <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
                <StatCard icon="📝" value={totalExams}     label="Total Exams"    gradient="from-[#ff4b2b] to-[#ff416c]" />
                <StatCard icon="✅" value={publishedExams}  label="Published"      gradient="from-emerald-400 to-emerald-600" />
                <StatCard icon="👥" value={totalAttempts}   label="Total Attempts" gradient="from-blue-400 to-blue-600" />
                <StatCard icon="❓" value={totalQuestions}  label="Questions Set"  gradient="from-violet-400 to-violet-600" />
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                  <h3 className="font-bold text-[#1a1a2e]">Recent Exams</h3>
                  <button onClick={() => goTab("exams")}
                    className="text-xs font-semibold text-[#ff4b2b] flex items-center gap-1 hover:underline">
                    View all <ChevronRight size={13} />
                  </button>
                </div>
                {loadingExams ? <LoadingRow /> : exams.length === 0 ? (
                  <EmptyExams onCreate={() => setShowCreate(true)} />
                ) : (
                  <div className="p-4">
                    <ExamCardsGrid exams={exams.slice(0, 6)} sensors={sensors} onDragEnd={handleDragEnd} reorderEnabled={false} {...sharedCardProps} />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ─ My Exams ─ */}
          {activeTab === "exams" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <h2 className="text-2xl font-extrabold text-[#1a1a2e]">My Exams</h2>
                  <p className="text-gray-500 text-sm mt-0.5">
                    {filteredExams.length} of {exams.length} exam{exams.length !== 1 ? "s" : ""}
                    {reorderMode && filteredExams.length > 1 && <span className="text-gray-400"> · drag cards to reorder</span>}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => setReorderMode(v => !v)}
                    disabled={filteredExams.length < 2}
                    className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl border transition
                      ${reorderMode
                        ? "bg-[#1a1a2e] text-white border-[#1a1a2e]"
                        : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"}
                      disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    <ListFilter size={16} /> {reorderMode ? "Done Reordering" : "Reorder Exams"}
                  </button>
                  <button onClick={() => setShowCreate(true)}
                    className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#ff4b2b] to-[#ff416c] text-white text-sm font-semibold rounded-xl hover:opacity-90 transition shadow-sm">
                    <Plus size={16} /> Create New Exam
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 lg:p-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <Field
                    label="Subject"
                    value={examFilters.subject}
                    onChange={(v) => setExamFilters((p) => ({ ...p, subject: v }))}
                    type="select"
                    options={[{ value: "all", label: "All" }, ...subjectOptions.map(s => ({ value: s, label: s }))]}
                  />
                  <Field
                    label="Status"
                    value={examFilters.status}
                    onChange={(v) => setExamFilters((p) => ({ ...p, status: v }))}
                    type="select"
                    options={[
                      { value: "all", label: "All" },
                      { value: "published", label: "Published" },
                      { value: "draft", label: "Draft" },
                    ]}
                  />
                  <div className="sm:col-span-2">
                    <Field
                      label="Search"
                      value={examFilters.query}
                      onChange={(v) => setExamFilters((p) => ({ ...p, query: v }))}
                      placeholder="Search by exam title or subject"
                    />
                  </div>
                </div>
                <div className="flex justify-end mt-3">
                  <button
                    type="button"
                    onClick={() => setExamFilters({ query: "", subject: "all", status: "all" })}
                    className="inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
                  >
                    <RotateCcw size={14} /> Reset Filters
                  </button>
                </div>
              </div>

              {loadingExams ? (
                <div className="bg-white rounded-2xl p-10 flex items-center justify-center text-gray-400 text-sm">Loading…</div>
              ) : exams.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <EmptyExams onCreate={() => setShowCreate(true)} />
                </div>
              ) : filteredExams.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center text-gray-500 text-sm">
                  No exams match the selected filters.
                </div>
              ) : (
                <ExamCardsGrid exams={filteredExams} sensors={sensors} onDragEnd={handleDragEnd} reorderEnabled={reorderMode} {...sharedCardProps} />
              )}
            </div>
          )}

          {/* ─ Profile ─ */}
          {activeTab === "profile" && (
            <div className="space-y-6 max-w-xl">
              <div>
                <h2 className="text-2xl font-extrabold text-[#1a1a2e]">Profile</h2>
                <p className="text-gray-500 text-sm mt-0.5">Manage your account details.</p>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
                <div className="flex items-center gap-4">
                  <Avatar name={user?.name} large />
                  <div>
                    <p className="font-bold text-[#1a1a2e] text-lg">{user?.name}</p>
                    <p className="text-xs font-semibold text-[#ff4b2b] uppercase tracking-wider">Teacher</p>
                  </div>
                </div>
                <hr className="border-gray-100" />
                <div className="space-y-4">
                  <Field label="Full Name" value={profileForm.name}
                    onChange={(v) => setProfileForm(p => ({ ...p, name: v }))} placeholder="Your full name" />
                  <Field label="Email Address" type="email" value={profileForm.email}
                    onChange={(v) => setProfileForm(p => ({ ...p, email: v }))} placeholder="you@example.com" />
                </div>
                <button onClick={handleProfileSave} disabled={profileLoading}
                  className="w-full py-2.5 bg-gradient-to-r from-[#ff4b2b] to-[#ff416c] text-white font-semibold rounded-xl hover:opacity-90 transition disabled:opacity-60">
                  {profileLoading ? "Saving…" : "Save Changes"}
                </button>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-3">
                <h3 className="font-bold text-[#1a1a2e] text-sm">Change Password</h3>
                {user?.auth_provider === "local" ? (
                  <>
                    <Field
                      label="Current Password"
                      type="password"
                      value={passwordForm.current_password}
                      onChange={(v) => setPasswordForm(p => ({ ...p, current_password: v }))}
                      placeholder="Enter current password"
                    />
                    <Field
                      label="New Password"
                      type="password"
                      value={passwordForm.new_password}
                      onChange={(v) => setPasswordForm(p => ({ ...p, new_password: v }))}
                      placeholder="Minimum 6 characters"
                    />
                    <Field
                      label="Confirm New Password"
                      type="password"
                      value={passwordForm.confirm_password}
                      onChange={(v) => setPasswordForm(p => ({ ...p, confirm_password: v }))}
                      placeholder="Re-enter new password"
                    />
                    <button
                      onClick={handlePasswordSave}
                      disabled={passwordLoading}
                      className="w-full py-2.5 bg-[#1a1a2e] text-white font-semibold text-sm rounded-xl hover:bg-[#252542] transition disabled:opacity-60"
                    >
                      {passwordLoading ? "Updating…" : "Update Password"}
                    </button>
                  </>
                ) : (
                  <p className="text-sm text-gray-500">Password is managed by your sign-in provider.</p>
                )}
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-3">
                <h3 className="font-bold text-[#1a1a2e] text-sm">Account Info</h3>
                {[
                  ["Provider", user?.auth_provider || "local"],
                  ["Role", user?.role],
                  ["Exams", totalExams],
                  ["Questions Set", totalQuestions],
                  ["Total Attempts", totalAttempts],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between text-sm py-0.5">
                    <span className="text-gray-500">{k}</span>
                    <span className="font-semibold text-[#1a1a2e] capitalize">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ── Modals ── */}
      {showCreate && (
        <ExamFormModal title="Create Exam" formData={formData} setFormData={setFormData}
          onClose={() => { setShowCreate(false); setFormData(blankForm) }}
          onSubmit={handleCreate} loading={formLoading} submitLabel="Create Exam" />
      )}
      {editingExam && (
        <ExamFormModal title="Edit Exam" formData={formData} setFormData={setFormData}
          onClose={() => setEditingExam(null)}
          onSubmit={handleEdit} loading={formLoading} submitLabel="Save Changes" />
      )}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <AlertCircle size={20} className="text-red-500" />
              </div>
              <div>
                <h3 className="font-bold text-[#1a1a2e]">Delete Exam?</h3>
                <p className="text-xs text-gray-500">All questions and attempts will be permanently deleted.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)}
                className="flex-1 py-2 border border-gray-200 text-gray-600 text-sm font-semibold rounded-xl hover:bg-gray-50 transition">
                Cancel
              </button>
              <button onClick={() => handleDelete(deleteConfirm)}
                className="flex-1 py-2 bg-red-500 text-white text-sm font-semibold rounded-xl hover:bg-red-600 transition">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl shadow-lg font-semibold text-sm text-white ${toast.type === "error" ? "bg-red-500" : "bg-[#1a1a2e]"}`}>
          {toast.message}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
// Cards grid with DnD context
// ─────────────────────────────────────────────
function ExamCardsGrid({ exams, sensors, onDragEnd, onEdit, onDelete, onTogglePublish, onQuestions, reorderEnabled }) {
  const grid = (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
      {exams.map(exam => (
        <ExamCard key={exam.id} exam={exam}
          onEdit={onEdit}
          onDelete={onDelete}
          onTogglePublish={onTogglePublish}
          onQuestions={onQuestions}
          reorderEnabled={reorderEnabled}
        />
      ))}
    </div>
  )

  if (!reorderEnabled) return grid

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={exams.map(e => e.id)} strategy={rectSortingStrategy}>
        {grid}
      </SortableContext>
    </DndContext>
  )
}

// ─────────────────────────────────────────────
// Individual sortable exam card
// ─────────────────────────────────────────────
function ExamCard({ exam, onEdit, onDelete, onTogglePublish, onQuestions, reorderEnabled }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: exam.id, disabled: !reorderEnabled })
  const col = subjectColor(exam.subject)

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`bg-white rounded-2xl border border-gray-100 flex flex-col overflow-hidden
        hover:shadow-md transition-all duration-200 select-none
        ${isDragging ? "opacity-40 scale-95 shadow-2xl z-50" : "shadow-sm"}`}
    >
      {/* Coloured top bar */}
      <div className="h-1 bg-gradient-to-r from-[#ff4b2b] to-[#ff416c]" />

      <div className="p-5 flex flex-col flex-1 gap-3">
        {/* Row 1: subject tag · status pill · drag handle */}
        <div className="flex items-center justify-between gap-2">
          <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${col.bg} ${col.text}`}>
            {exam.subject}
          </span>
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={() => onTogglePublish(exam)}
              className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold transition-colors
                ${exam.published
                  ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                  : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}>
              {exam.published ? <Eye size={10} /> : <EyeOff size={10} />}
              {exam.published ? "Live" : "Draft"}
            </button>
            {reorderEnabled && (
              <button {...attributes} {...listeners}
                className="p-1 text-gray-300 hover:text-gray-500 rounded cursor-grab active:cursor-grabbing touch-none ml-0.5"
                title="Drag to reorder">
                <GripVertical size={15} />
              </button>
            )}
          </div>
        </div>

        {/* Title */}
        <h3 className="font-bold text-[#1a1a2e] text-base leading-snug line-clamp-2 flex-1">{exam.title}</h3>

        {/* Stats row */}
        <div className="flex items-center gap-3 text-xs text-gray-400 font-semibold">
          <span className="flex items-center gap-1"><Clock size={11} />{exam.duration_minutes}m</span>
          <span className="flex items-center gap-1"><HelpCircle size={11} />{exam.question_count || 0} Qs</span>
          <span className="flex items-center gap-1"><Users size={11} />{exam.attempt_count || 0}</span>
        </div>

        {/* Action row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-gray-50 mt-auto">
          <button onClick={() => onQuestions(exam.id)}
            className="flex items-center justify-center gap-1.5 py-2 bg-gradient-to-r from-[#ff4b2b] to-[#ff416c] text-white text-xs font-bold rounded-xl hover:opacity-90 transition">
            <HelpCircle size={13} /> Go to Questions
          </button>
          <button onClick={() => onDelete(exam.id)}
            className="flex items-center justify-center gap-1.5 py-2 bg-red-500 text-white text-xs font-bold rounded-xl hover:bg-red-600 transition-colors" title="Delete">
            <Trash2 size={13} /> Delete
          </button>
          <button onClick={() => onEdit(exam)}
            className="sm:col-span-2 p-2 text-gray-500 hover:text-[#ff4b2b] hover:bg-orange-50 rounded-xl transition-colors text-xs font-semibold border border-gray-100" title="Edit">
            <span className="inline-flex items-center gap-1"><Edit2 size={13} /> Edit Exam</span>
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────
function Avatar({ name, large = false }) {
  const cls = large ? "w-16 h-16 text-2xl" : "w-9 h-9 text-sm"
  return (
    <div className={`${cls} rounded-full bg-gradient-to-br from-[#ff4b2b] to-[#ff416c] flex items-center justify-center text-white font-bold shrink-0`}>
      {name?.[0]?.toUpperCase() ?? "T"}
    </div>
  )
}

function StatCard({ icon, value, label, gradient, className = "" }) {
  return (
    <div className={`bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4 hover:-translate-y-0.5 transition-transform ${className}`}>
      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center text-xl shrink-0`}>
        {icon}
      </div>
      <div>
        <p className="text-2xl font-extrabold text-[#1a1a2e]">{value}</p>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mt-0.5">{label}</p>
      </div>
    </div>
  )
}

function LoadingRow() {
  return <div className="flex items-center justify-center py-14 text-gray-400 text-sm">Loading…</div>
}

function EmptyExams({ onCreate }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 gap-3 text-gray-400">
      <BookMarked size={34} strokeWidth={1.5} />
      <p className="text-sm">No exams yet.</p>
      <button onClick={onCreate}
        className="mt-1 px-5 py-2 bg-gradient-to-r from-[#ff4b2b] to-[#ff416c] text-white text-sm font-semibold rounded-xl hover:opacity-90 transition">
        + Create your first exam
      </button>
    </div>
  )
}

function ExamFormModal({ title, formData, setFormData, onClose, onSubmit, loading, submitLabel }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="font-bold text-[#1a1a2e]">{title}</h3>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <Field label="Exam Title" value={formData.title}
            onChange={(v) => setFormData(p => ({ ...p, title: v }))} placeholder="e.g. Midterm Algebra" required />
          <Field label="Subject" value={formData.subject}
            onChange={(v) => setFormData(p => ({ ...p, subject: v }))} placeholder="e.g. Mathematics" required />
          <Field label="Duration (minutes)" type="number" value={formData.duration_minutes}
            onChange={(v) => setFormData(p => ({ ...p, duration_minutes: parseInt(v) || 60 }))} placeholder="60" />
          <div className="flex items-center justify-between py-2 gap-3">
            <div>
              <p className="text-sm font-semibold text-[#1a1a2e]">Publish Immediately</p>
              <p className="text-xs text-gray-400">Students can see published exams</p>
            </div>
            <button
              type="button"
              onClick={() => setFormData(p => ({ ...p, published: !p.published }))}
              className={`relative inline-flex h-7 w-12 items-center rounded-full p-0.5 transition-all ${formData.published ? "bg-gradient-to-r from-[#ff4b2b] to-[#ff416c]" : "bg-gray-200"}`}
            >
              <span className={`h-6 w-6 rounded-full bg-white shadow transition-transform ${formData.published ? "translate-x-5" : "translate-x-0"}`} />
            </button>
          </div>
        </div>
        <div className="px-6 pb-5 flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-2.5 border border-gray-200 text-gray-600 text-sm font-semibold rounded-xl hover:bg-gray-50 transition">
            Cancel
          </button>
          <button onClick={onSubmit} disabled={loading || !formData.title.trim() || !formData.subject.trim()}
            className="flex-1 py-2.5 bg-gradient-to-r from-[#ff4b2b] to-[#ff416c] text-white text-sm font-semibold rounded-xl hover:opacity-90 transition disabled:opacity-50">
            {loading ? "Saving…" : submitLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, value, onChange, placeholder, type = "text", required = false, options = [] }) {
  return (
    <div>
      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {type === "select" ? (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-[#1a1a2e] bg-white focus:outline-none focus:ring-2 focus:ring-[#ff4b2b]/30 focus:border-[#ff4b2b] transition"
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      ) : (
        <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
          className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-[#1a1a2e] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#ff4b2b]/30 focus:border-[#ff4b2b] transition" />
      )}
    </div>
  )
}
