import { useEffect, useMemo, useState } from "react"
import { useAuth } from "../context/AuthContext"
import { useNavigate } from "react-router-dom"
import { BookOpen, ChevronDown, LayoutDashboard, LogOut, Menu, Shield, Trash2, User, X } from "lucide-react"
import { changePassword, deleteProfilePicture, getStudentProfile, updateStudentProfile, uploadProfilePicture } from "../api/auth"
import { getPublicAssessmentQuestions, getPublishedAssessments, submitStudentAttempt, updateProfile } from "../api/assessments"
import ChangePasswordModal from "../components/ChangePasswordModal"
import Avatar from "../components/dashboard/DashboardAvatar"
import ImagePreviewModal from "../components/dashboard/ImagePreviewModal"
import ProfileIdCard from "../components/dashboard/ProfileIdCard"
import ProfileDetailsSection from "../components/dashboard/ProfileDetailsSection"
import StudentExamList from "../components/student/StudentExamList"
import ExamInstructionsModal from "../components/student/ExamInstructionsModal"
import StudentExamRunner from "../components/student/StudentExamRunner"
import StudentExamResult from "../components/student/StudentExamResult"

export default function StudentDashboard() {
  const { user, token, logout, setUser } = useAuth()
  const navigate = useNavigate()

  const [activeTab, setActiveTab] = useState("dashboard")
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)

  const [changePasswordOpen, setChangePasswordOpen] = useState(false)
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [profilePictureUploading, setProfilePictureUploading] = useState(false)
  const [profilePictureDeleting, setProfilePictureDeleting] = useState(false)
  const [profileForm, setProfileForm] = useState({ name: "", email: "" })
  const [profileSaving, setProfileSaving] = useState(false)
  const [studentProfileForm, setStudentProfileForm] = useState({
    reg_no: "",
    college_email: "",
    department: "",
    division: "",
    class_roll_no: "",
    semester: "",
    year_of_joining: "",
  })
  const [studentProfileLoading, setStudentProfileLoading] = useState(false)
  const [studentProfileSaving, setStudentProfileSaving] = useState(false)
  const [publishedExams, setPublishedExams] = useState([])
  const [loadingPublishedExams, setLoadingPublishedExams] = useState(false)
  const [examSearchQuery, setExamSearchQuery] = useState("")
  const [examSubjectFilter, setExamSubjectFilter] = useState("")
  const [selectedExam, setSelectedExam] = useState(null)
  const [examQuestions, setExamQuestions] = useState([])
  const [examInstructionOpen, setExamInstructionOpen] = useState(false)
  const [examStage, setExamStage] = useState("list")
  const [startingExam, setStartingExam] = useState(false)
  const [attemptSubmitting, setAttemptSubmitting] = useState(false)
  const [examResult, setExamResult] = useState(null)
  const [imageModalSrc, setImageModalSrc] = useState(null)
  const [toast, setToast] = useState(null)

  const examInProgress = activeTab === "exams" && examStage === "attempt"

  const navItems = [
    { key: "dashboard", label: "Dashboard", Icon: LayoutDashboard },
    { key: "profile", label: "Profile", Icon: User },
    { key: "exams", label: "Exams", Icon: BookOpen },
  ]

  const examSubjectOptions = useMemo(() => {
    const unique = [...new Set((publishedExams || []).map((exam) => exam.subject).filter(Boolean))]
    unique.sort((a, b) => a.localeCompare(b))
    return unique
  }, [publishedExams])

  const filteredPublishedExams = useMemo(() => {
    const query = examSearchQuery.trim().toLowerCase()
    return (publishedExams || []).filter((exam) => {
      const matchesQuery = !query || exam.title?.toLowerCase().includes(query) || exam.subject?.toLowerCase().includes(query)
      const matchesSubject = !examSubjectFilter || exam.subject === examSubjectFilter
      return matchesQuery && matchesSubject
    })
  }, [publishedExams, examSearchQuery, examSubjectFilter])

  function flash(message, type = "success") {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  useEffect(() => {
    if (user) setProfileForm({ name: user.name || "", email: user.email || "" })
  }, [user])

  useEffect(() => {
    if (!token) return
    loadStudentProfile()
  }, [token]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!studentProfileForm.department || examSubjectFilter || examSubjectOptions.length === 0) return
    if (examSubjectOptions.includes(studentProfileForm.department)) {
      setExamSubjectFilter(studentProfileForm.department)
    }
  }, [studentProfileForm.department, examSubjectFilter, examSubjectOptions])

  useEffect(() => {
    if (!token || activeTab !== "exams" || examStage !== "list") return
    loadPublishedExams()
  }, [token, activeTab, examStage]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!examInProgress) return

    const onBeforeUnload = (event) => {
      event.preventDefault()
      event.returnValue = ""
    }

    const onPopState = () => {
      window.history.pushState(null, "", window.location.href)
    }

    window.history.pushState(null, "", window.location.href)
    window.addEventListener("beforeunload", onBeforeUnload)
    window.addEventListener("popstate", onPopState)

    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload)
      window.removeEventListener("popstate", onPopState)
    }
  }, [examInProgress])

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

  async function loadStudentProfile() {
    setStudentProfileLoading(true)
    try {
      const res = await getStudentProfile(token)
      const data = res.data || {}
      setStudentProfileForm({
        reg_no: data.reg_no || "",
        college_email: data.college_email || "",
        department: data.department || "",
        division: data.division || "",
        class_roll_no: data.class_roll_no || "",
        semester: data.semester == null ? "" : String(data.semester),
        year_of_joining: data.year_of_joining == null ? "" : String(data.year_of_joining),
      })
    } catch (err) {
      flash(err?.response?.data?.detail || "Failed to load student profile", "error")
    } finally {
      setStudentProfileLoading(false)
    }
  }

  async function loadPublishedExams() {
    setLoadingPublishedExams(true)
    try {
      const res = await getPublishedAssessments(token)
      setPublishedExams(res.data || [])
    } catch (err) {
      flash(err?.response?.data?.detail || "Failed to load published exams", "error")
    } finally {
      setLoadingPublishedExams(false)
    }
  }

  function openExamInstructions(exam) {
    if (examInProgress) return
    setSelectedExam(exam)
    setExamInstructionOpen(true)
  }

  async function startSelectedExam() {
    if (!selectedExam) return
    setStartingExam(true)
    try {
      const res = await getPublicAssessmentQuestions(token, selectedExam.id)
      const questions = res.data || []
      if (questions.length === 0) {
        flash("No questions available for this exam", "error")
        return
      }

      setExamQuestions(questions)
      setExamInstructionOpen(false)
      setExamStage("attempt")
      setSidebarCollapsed(true)
      setProfileMenuOpen(false)
      setSidebarOpen(false)
      flash("Exam started. Navigation is locked until completion.")
    } catch (err) {
      flash(err?.response?.data?.detail || "Failed to start exam", "error")
    } finally {
      setStartingExam(false)
    }
  }

  async function submitAttempt(payload) {
    if (!selectedExam) return
    setAttemptSubmitting(true)
    try {
      const res = await submitStudentAttempt(token, selectedExam.id, payload)
      setExamResult(res.data || null)
      setExamStage("result")
    } catch (err) {
      flash(err?.response?.data?.detail || "Failed to submit attempt", "error")
    } finally {
      setAttemptSubmitting(false)
    }
  }

  function resetExamFlow() {
    setExamStage("list")
    setSelectedExam(null)
    setExamQuestions([])
    setExamResult(null)
    setExamInstructionOpen(false)
    loadPublishedExams()
  }

  async function handleProfileSave() {
    setProfileSaving(true)
    try {
      const res = await updateProfile(token, profileForm)
      setUser(res.data)
      flash("Basic details updated")
    } catch (err) {
      flash(err?.response?.data?.detail || "Failed to update basic details", "error")
    } finally {
      setProfileSaving(false)
    }
  }

  async function handleStudentProfileSave() {
    setStudentProfileSaving(true)
    try {
      const payload = {
        reg_no: studentProfileForm.reg_no.trim() || null,
        college_email: studentProfileForm.college_email.trim() || null,
        department: studentProfileForm.department.trim() || null,
        division: studentProfileForm.division.trim() || null,
        class_roll_no: studentProfileForm.class_roll_no.trim() || null,
        semester: studentProfileForm.semester === "" ? null : parseInt(studentProfileForm.semester, 10),
        year_of_joining: studentProfileForm.year_of_joining === "" ? null : parseInt(studentProfileForm.year_of_joining, 10),
      }
      const res = await updateStudentProfile(token, payload)
      const data = res.data || {}
      setStudentProfileForm({
        reg_no: data.reg_no || "",
        college_email: data.college_email || "",
        department: data.department || "",
        division: data.division || "",
        class_roll_no: data.class_roll_no || "",
        semester: data.semester == null ? "" : String(data.semester),
        year_of_joining: data.year_of_joining == null ? "" : String(data.year_of_joining),
      })
      flash("Professional details updated")
    } catch (err) {
      flash(err?.response?.data?.detail || "Failed to update professional details", "error")
    } finally {
      setStudentProfileSaving(false)
    }
  }

  function handleLogout() {
    if (examInProgress) {
      flash("Complete the exam first. Navigation is locked.", "error")
      return
    }
    logout()
    navigate("/")
  }

  function goTab(key) {
    if (examInProgress && key !== "exams") {
      flash("Complete the exam first. Navigation is locked.", "error")
      return
    }
    setActiveTab(key)
    if (key === "exams") setSidebarCollapsed(true)
    setSidebarOpen(false)
    setProfileMenuOpen(false)
  }

  return (
    <div className="min-h-screen bg-[#f4f6fb] flex">
      {sidebarOpen && <div className="fixed inset-0 bg-black/40 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      <aside className={`fixed top-0 left-0 h-full w-64 bg-white/95 backdrop-blur border-r border-gray-200 shadow-xl z-50 flex flex-col transition-transform duration-300 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0 lg:sticky lg:top-0 lg:h-screen lg:shadow-none lg:z-auto lg:transition-all lg:duration-300 ${sidebarCollapsed ? "lg:w-20" : "lg:w-64"}`}>
        <div className="flex items-center gap-2.5 px-4 h-16 border-b border-gray-100 shrink-0">
          <button className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg disabled:opacity-50" onClick={() => setSidebarCollapsed((v) => !v)} disabled={examInProgress}>
            <Menu size={18} />
          </button>
          {!sidebarCollapsed && <span className="font-extrabold text-lg text-[#1a1a2e] tracking-tight">Argus.ai</span>}
          <button className="ml-auto p-1 text-gray-400 hover:text-gray-700 lg:hidden" onClick={() => setSidebarOpen(false)} disabled={examInProgress}>
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map(({ key, label, Icon }) => (
            <button
              key={key}
              onClick={() => goTab(key)}
              title={sidebarCollapsed ? label : undefined}
              disabled={examInProgress && key !== "exams"}
              className={`w-full flex items-center ${sidebarCollapsed ? "justify-center" : "gap-3"} px-4 py-2.5 rounded-xl font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed ${activeTab === key ? "bg-gradient-to-r from-[#ff4b2b] to-[#ff416c] text-white shadow-sm" : "text-gray-500 hover:bg-gray-50 hover:text-gray-800"}`}
            >
              <Icon size={17} /> {!sidebarCollapsed && label}
            </button>
          ))}
        </nav>

        <div className="mt-auto px-3 pb-4 border-t border-gray-100 pt-3 shrink-0 bg-gradient-to-b from-white to-gray-50/70 lg:mb-0">
          <div className={`flex items-center ${sidebarCollapsed ? "justify-center" : "gap-3"} px-3 py-2 mb-1`}>
            <Avatar name={user?.name} imagePath={user?.profile_picture_path} onClick={setImageModalSrc} fallback="S" />
            {!sidebarCollapsed && (
              <div className="min-w-0">
                <p className="text-sm font-bold text-[#1a1a2e] truncate">{user?.name || "Student"}</p>
                <p className="text-[10px] font-semibold text-[#ff4b2b] uppercase tracking-wider">Student</p>
              </div>
            )}
          </div>
          <button onClick={handleLogout} disabled={examInProgress} className={`w-full flex items-center ${sidebarCollapsed ? "justify-center" : "gap-2.5"} px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-500 hover:bg-red-50 hover:text-red-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}>
            <LogOut size={16} /> {!sidebarCollapsed && "Logout"}
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-gray-100 h-16 flex items-center px-4 lg:px-8 gap-4 sticky top-0 z-30 shadow-sm">
          <button className="p-2 text-gray-500 hover:text-gray-800 rounded-lg hover:bg-gray-100 lg:hidden disabled:opacity-50" onClick={() => setSidebarOpen(true)} disabled={examInProgress}>
            <Menu size={20} />
          </button>
          <h1 className="hidden lg:block text-base font-bold text-[#1a1a2e]">
            {navItems.find((item) => item.key === activeTab)?.label}
          </h1>

          <div className="ml-auto flex items-center gap-2">
            <div className="relative" onMouseLeave={() => setProfileMenuOpen(false)}>
              <button onClick={() => !examInProgress && setProfileMenuOpen((v) => !v)} onMouseEnter={() => !examInProgress && setProfileMenuOpen(true)} disabled={examInProgress} className="flex items-center gap-2 hover:bg-gray-50 rounded-xl px-3 py-1.5 transition-colors border border-transparent hover:border-gray-100 disabled:opacity-60 disabled:cursor-not-allowed">
                <Avatar name={user?.name} imagePath={user?.profile_picture_path} onClick={setImageModalSrc} fallback="S" />
                <div className="hidden sm:block text-left">
                  <p className="text-sm font-semibold text-[#1a1a2e] leading-tight">{user?.name || "Student"}</p>
                  <p className="text-[10px] uppercase tracking-wider text-[#ff4b2b] font-semibold">Student</p>
                </div>
                <ChevronDown size={14} className={`text-gray-400 transition-transform ${profileMenuOpen ? "rotate-180" : ""}`} />
              </button>
              {profileMenuOpen && (
                <div className="absolute right-0 top-12 w-48 bg-white border border-gray-100 shadow-xl rounded-xl p-1.5 z-40">
                  <button onClick={() => goTab("profile")} className="w-full flex items-center gap-2 px-3 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50 rounded-lg">
                    <User size={15} /> Profile
                  </button>
                  {user?.auth_provider === "local" && (
                    <button onClick={() => { setProfileMenuOpen(false); setChangePasswordOpen(true) }} className="w-full flex items-center gap-2 px-3 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50 rounded-lg">
                      <Shield size={15} /> Change Password
                    </button>
                  )}
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
                <h2 className="text-2xl font-extrabold text-[#1a1a2e]">Student Dashboard</h2>
                <p className="text-gray-500 text-sm mt-0.5">Overview of your account access and profile.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                <StatCard icon="👤" value={user?.name || "Student"} label="Account" />
                <StatCard icon="📧" value={user?.email || "—"} label="Email" />
                <StatCard icon="🎓" value="Student" label="Role" />
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-400 font-semibold">Exams</p>
                  <h3 className="text-lg font-bold text-[#1a1a2e]">Ready to attend a test?</h3>
                  <p className="text-sm text-gray-500 mt-0.5">Browse published exams and begin when prepared.</p>
                </div>
                <button
                  onClick={() => goTab("exams")}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#ff4b2b] to-[#ff416c] text-white text-sm font-semibold hover:opacity-90 transition"
                >
                  To attend test click here
                </button>
              </div>
            </>
          )}

          {activeTab === "exams" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-extrabold text-[#1a1a2e]">Exams</h2>
                <p className="text-gray-500 text-sm mt-0.5">Select a published exam, read instructions, and complete all questions.</p>
              </div>

              {examStage === "list" && (
                <StudentExamList
                  exams={filteredPublishedExams}
                  loading={loadingPublishedExams}
                  searchQuery={examSearchQuery}
                  onSearchQueryChange={setExamSearchQuery}
                  subjectFilter={examSubjectFilter}
                  onSubjectFilterChange={setExamSubjectFilter}
                  subjectOptions={examSubjectOptions}
                  onRefresh={loadPublishedExams}
                  onTakeExam={openExamInstructions}
                />
              )}

              {examStage === "attempt" && selectedExam && (
                <StudentExamRunner
                  exam={selectedExam}
                  questions={examQuestions}
                  onSubmitAttempt={submitAttempt}
                  submitting={attemptSubmitting}
                  onFlash={flash}
                />
              )}

              {examStage === "result" && (
                <StudentExamResult
                  examTitle={selectedExam?.title}
                  result={examResult}
                  onBackToExams={resetExamFlow}
                />
              )}
            </div>
          )}

          {activeTab === "profile" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-extrabold text-[#1a1a2e]">Profile</h2>
                <p className="text-gray-500 text-sm mt-0.5">Manage your personal and student profile details.</p>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 items-start">
                <div className="xl:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
                  <div className="flex items-center gap-4">
                    <Avatar name={user?.name} imagePath={user?.profile_picture_path} large onClick={setImageModalSrc} fallback="S" />
                    <div>
                      <p className="font-bold text-[#1a1a2e] text-lg">{user?.name || "Student"}</p>
                      <p className="text-xs font-semibold text-[#ff4b2b] uppercase tracking-wider">Student</p>
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

                  <hr className="border-gray-100" />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Field
                      label="Full Name"
                      value={profileForm.name}
                      onChange={(v) => setProfileForm((p) => ({ ...p, name: v }))}
                      placeholder="Your full name"
                    />
                    <Field
                      label="Email Address"
                      type="email"
                      value={profileForm.email}
                      onChange={(v) => setProfileForm((p) => ({ ...p, email: v }))}
                      placeholder="you@example.com"
                    />
                  </div>

                  <button
                    onClick={handleProfileSave}
                    disabled={profileSaving}
                    className="w-full md:w-auto px-6 py-2.5 bg-gradient-to-r from-[#ff4b2b] to-[#ff416c] text-white font-semibold rounded-xl hover:opacity-90 transition disabled:opacity-60"
                  >
                    {profileSaving ? "Saving…" : "Save Basic Details"}
                  </button>
                </div>

                <ProfileIdCard
                  title="Student ID Card"
                  name={user?.name || "Student"}
                  subtitle={studentProfileForm.college_email || user?.email || "No college email set"}
                  roleLabel="Student"
                  imagePath={user?.profile_picture_path}
                  avatarFallback="S"
                  onAvatarClick={setImageModalSrc}
                  rows={[
                    { label: "Reg No", value: studentProfileForm.reg_no },
                    { label: "Class Roll No", value: studentProfileForm.class_roll_no },
                    { label: "Department", value: studentProfileForm.department },
                    { label: "Division", value: studentProfileForm.division },
                    { label: "Semester", value: studentProfileForm.semester },
                    { label: "Year of Joining", value: studentProfileForm.year_of_joining },
                  ]}
                />
              </div>

              <ProfileDetailsSection
                title="Professional Details"
                description="Use these fields from your student profile."
                loading={studentProfileLoading}
                fields={[
                  {
                    label: "Registration Number",
                    value: studentProfileForm.reg_no,
                    onChange: (v) => setStudentProfileForm((p) => ({ ...p, reg_no: v })),
                    placeholder: "REG-2024-001",
                  },
                  {
                    label: "College Email",
                    type: "email",
                    value: studentProfileForm.college_email,
                    onChange: (v) => setStudentProfileForm((p) => ({ ...p, college_email: v })),
                    placeholder: "student@college.edu",
                  },
                  {
                    label: "Department",
                    value: studentProfileForm.department,
                    onChange: (v) => setStudentProfileForm((p) => ({ ...p, department: v })),
                    placeholder: "Computer Science",
                  },
                  {
                    label: "Division",
                    value: studentProfileForm.division,
                    onChange: (v) => setStudentProfileForm((p) => ({ ...p, division: v })),
                    placeholder: "A",
                  },
                  {
                    label: "Class Roll No",
                    value: studentProfileForm.class_roll_no,
                    onChange: (v) => setStudentProfileForm((p) => ({ ...p, class_roll_no: v })),
                    placeholder: "27",
                  },
                  {
                    label: "Semester",
                    type: "number",
                    value: studentProfileForm.semester,
                    onChange: (v) => setStudentProfileForm((p) => ({ ...p, semester: v })),
                    placeholder: "6",
                  },
                  {
                    label: "Year of Joining",
                    type: "number",
                    value: studentProfileForm.year_of_joining,
                    onChange: (v) => setStudentProfileForm((p) => ({ ...p, year_of_joining: v })),
                    placeholder: "2023",
                  },
                ]}
                onSave={handleStudentProfileSave}
                saving={studentProfileSaving}
                saveLabel="Save Professional Details"
              />
            </div>
          )}
        </main>
      </div>

      <ChangePasswordModal
        open={changePasswordOpen}
        onClose={() => setChangePasswordOpen(false)}
        onSubmit={handlePasswordSave}
        loading={passwordLoading}
      />

      {imageModalSrc && <ImagePreviewModal src={imageModalSrc} onClose={() => setImageModalSrc(null)} />}

      <ExamInstructionsModal
        exam={selectedExam}
        open={examInstructionOpen}
        onClose={() => !startingExam && setExamInstructionOpen(false)}
        onStart={startSelectedExam}
        loading={startingExam}
      />

      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl shadow-lg font-semibold text-sm text-white ${toast.type === "error" ? "bg-red-500" : "bg-[#1a1a2e]"}`}>
          {toast.message}
        </div>
      )}
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
        <p className="text-base md:text-lg font-extrabold text-[#1a1a2e] truncate max-w-[220px]">{value}</p>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mt-0.5">{label}</p>
      </div>
    </div>
  )
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
