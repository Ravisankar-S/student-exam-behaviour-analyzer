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
  ChevronRight, AlertCircle, GripVertical, HelpCircle, ListFilter, RotateCcw, ChevronDown, BarChart3,
} from "lucide-react"
import {
  getMyAssessments, createAssessment, updateAssessment,
  deleteAssessment, reorderAssessments, updateProfile, getAssessmentAttempts,
} from "../api/assessments"
import {
  changePassword,
  getStudents,
  getTeacherProfile,
  updateTeacherProfile,
  uploadProfilePicture,
  deleteProfilePicture,
} from "../api/auth"
import ChangePasswordModal from "../components/ChangePasswordModal"
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ScatterChart,
  Scatter,
} from "recharts"

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

const BEHAVIOR_LABELS = ["Fast_Response", "High_Revision", "Deliberative", "Disengaged"]

function hashText(text = "") {
  let hash = 0
  for (let i = 0; i < text.length; i += 1) {
    hash = ((hash << 5) - hash) + text.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

function durationMinutesFromAttempt(attempt, fallbackDuration = 60) {
  if (attempt?.started_at && attempt?.submitted_at) {
    const ms = new Date(attempt.submitted_at).getTime() - new Date(attempt.started_at).getTime()
    if (ms > 0) return ms / 60000
  }
  return fallbackDuration * 0.72
}

function toAbsoluteImageUrl(path) {
  if (!path) return null
  if (path.startsWith("http://") || path.startsWith("https://")) return path
  return `http://127.0.0.1:8000${path}`
}

function enrichAttemptDummy(attempt, fallbackDuration = 60) {
  const seed = hashText(`${attempt.id}-${attempt.student_id}-${attempt.score ?? 0}`)
  const behavior = BEHAVIOR_LABELS[seed % BEHAVIOR_LABELS.length]
  const durationMin = durationMinutesFromAttempt(attempt, fallbackDuration)
  const avgTimeSec = Math.max(8, Math.round((durationMin * 60) / (8 + (seed % 8))))
  const revisions = behavior === "High_Revision"
    ? 4 + (seed % 5)
    : behavior === "Deliberative"
      ? 2 + (seed % 3)
      : behavior === "Disengaged"
        ? 1 + (seed % 2)
        : seed % 2
  const navigationJumps = behavior === "Disengaged"
    ? 6 + (seed % 6)
    : behavior === "High_Revision"
      ? 4 + (seed % 4)
      : 1 + (seed % 4)
  const anomaly = (attempt.score ?? 0) < 25 || navigationJumps >= 9 || (attempt.score ?? 0) > 95 && durationMin < 8

  return {
    ...attempt,
    behavior,
    avg_time_sec: avgTimeSec,
    revisions,
    navigation_jumps: navigationJumps,
    duration_min: durationMin,
    anomaly,
  }
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
  const [analyticsTab, setAnalyticsTab]   = useState("exam")
  const [selectedExamAnalytics, setSelectedExamAnalytics] = useState(null)
  const [examAttemptsMap, setExamAttemptsMap] = useState({})
  const [students, setStudents] = useState([])
  const [selectedStudentId, setSelectedStudentId] = useState(null)
  const [studentFilters, setStudentFilters] = useState({ query: "", behavior: "all", participation: "all" })
  const [loadingAnalytics, setLoadingAnalytics] = useState(false)
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
  const [changePasswordOpen, setChangePasswordOpen] = useState(false)
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [teacherProfileForm, setTeacherProfileForm] = useState({
    employee_id: "",
    college_email: "",
    department: "",
    designation: "",
    subjects: "",
    office_room: "",
    year_of_joining: "",
  })
  const [teacherProfileLoading, setTeacherProfileLoading] = useState(false)
  const [teacherProfileSaving, setTeacherProfileSaving] = useState(false)
  const [profilePictureUploading, setProfilePictureUploading] = useState(false)
  const [profilePictureDeleting, setProfilePictureDeleting] = useState(false)
  const [imageModalSrc, setImageModalSrc] = useState(null)

  const sensors = useSensors(useSensor(PointerSensor, {
    activationConstraint: { distance: 8 },
  }))

  useEffect(() => { loadExams() }, [])
  useEffect(() => {
    if (user) setProfileForm({ name: user.name || "", email: user.email || "" })
  }, [user])
  useEffect(() => {
    if (activeTab === "analytics") loadAnalyticsData()
  }, [activeTab, exams.length]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (activeTab === "profile" && user?.role === "teacher") {
      loadTeacherProfile()
    }
  }, [activeTab, user?.role]) // eslint-disable-line react-hooks/exhaustive-deps

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
      const normalizedYear = teacherProfileForm.year_of_joining === ""
        ? null
        : parseInt(teacherProfileForm.year_of_joining, 10)

      const res = await updateProfile(token, profileForm)
      await updateTeacherProfile(token, { year_of_joining: Number.isNaN(normalizedYear) ? null : normalizedYear })
      setUser(res.data)
      flash("Profile updated")
    } catch (err) {
      flash(err?.response?.data?.detail || "Failed to update profile", "error")
    } finally {
      setProfileLoading(false)
    }
  }

  async function loadAnalyticsData() {
    setLoadingAnalytics(true)
    try {
      const attemptsEntries = await Promise.all(
        exams.map(async (exam) => {
          const res = await getAssessmentAttempts(token, exam.id)
          return [exam.id, (res.data || []).map((attempt) => enrichAttemptDummy(attempt, exam.duration_minutes))]
        })
      )
      setExamAttemptsMap(Object.fromEntries(attemptsEntries))
      const studentsRes = await getStudents(token)
      setStudents(studentsRes.data || [])
    } catch {
      flash("Failed to load analytics", "error")
    } finally {
      setLoadingAnalytics(false)
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

  async function loadTeacherProfile() {
    setTeacherProfileLoading(true)
    try {
      const res = await getTeacherProfile(token)
      const data = res.data || {}
      setTeacherProfileForm({
        employee_id: data.employee_id || "",
        college_email: data.college_email || "",
        department: data.department || "",
        designation: data.designation || "",
        subjects: data.subjects || "",
        office_room: data.office_room || "",
        year_of_joining: data.year_of_joining != null ? String(data.year_of_joining) : "",
      })
    } catch {
      flash("Failed to load teacher profile", "error")
    } finally {
      setTeacherProfileLoading(false)
    }
  }

  async function handleTeacherProfileSave() {
    setTeacherProfileSaving(true)
    try {
      const normalizedYear = teacherProfileForm.year_of_joining === ""
        ? null
        : parseInt(teacherProfileForm.year_of_joining, 10)

      await updateTeacherProfile(token, {
        ...teacherProfileForm,
        year_of_joining: Number.isNaN(normalizedYear) ? null : normalizedYear,
      })
      flash("Teacher profile updated")
    } catch (err) {
      flash(err?.response?.data?.detail || "Failed to update teacher profile", "error")
    } finally {
      setTeacherProfileSaving(false)
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
  const allTeacherAttempts = exams.flatMap((exam) =>
    (examAttemptsMap[exam.id] || []).map((attempt) => ({
      ...attempt,
      exam_id: exam.id,
      exam_title: exam.title,
      exam_duration: exam.duration_minutes,
    }))
  )
  const studentStatsMap = allTeacherAttempts.reduce((acc, attempt) => {
    const key = attempt.student_id
    if (!acc[key]) {
      acc[key] = {
        tests: 0,
        totalScore: 0,
        totalTime: 0,
        totalRevisions: 0,
        totalJumps: 0,
        behaviorCounts: {},
      }
    }
    acc[key].tests += 1
    acc[key].totalScore += (attempt.score || 0)
    acc[key].totalTime += (attempt.avg_time_sec || 0)
    acc[key].totalRevisions += (attempt.revisions || 0)
    acc[key].totalJumps += (attempt.navigation_jumps || 0)
    acc[key].behaviorCounts[attempt.behavior] = (acc[key].behaviorCounts[attempt.behavior] || 0) + 1
    return acc
  }, {})

  const studentRows = students.map((student) => {
    const stats = studentStatsMap[student.id]
    if (!stats) {
      return {
        ...student,
        tests: 0,
        avgScore: 0,
        avgTime: 0,
        avgRevisions: 0,
        avgJumps: 0,
        behavior: "N/A",
      }
    }
    const behavior = Object.entries(stats.behaviorCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "N/A"
    return {
      ...student,
      tests: stats.tests,
      avgScore: Math.round(stats.totalScore / stats.tests),
      avgTime: Math.round(stats.totalTime / stats.tests),
      avgRevisions: Number((stats.totalRevisions / stats.tests).toFixed(1)),
      avgJumps: Number((stats.totalJumps / stats.tests).toFixed(1)),
      behavior,
    }
  })

  const filteredStudentRows = studentRows.filter((row) => {
    const query = studentFilters.query.trim().toLowerCase()
    const byQuery = !query
      || row.name.toLowerCase().includes(query)
      || row.email.toLowerCase().includes(query)
    const byBehavior = studentFilters.behavior === "all" || row.behavior === studentFilters.behavior
    const byParticipation = studentFilters.participation === "all"
      || (studentFilters.participation === "attempted" && row.tests > 0)
      || (studentFilters.participation === "not_attempted" && row.tests === 0)
    return byQuery && byBehavior && byParticipation
  })

  const selectedStudent = filteredStudentRows.find((s) => s.id === selectedStudentId)
    || studentRows.find((s) => s.id === selectedStudentId)
    || null

  const selectedStudentAttempts = selectedStudent
    ? allTeacherAttempts.filter((attempt) => attempt.student_id === selectedStudent.id)
    : []

  const navItems = [
    { key: "dashboard", label: "Dashboard", Icon: LayoutDashboard },
    { key: "profile",   label: "Profile",   Icon: User },
    { key: "exams",     label: "My Exams",  Icon: BookOpen },
    { key: "analytics", label: "Analytics", Icon: BarChart3 },
  ]

  function goTab(key) {
    setActiveTab(key)
    if (key !== "exams") setReorderMode(false)
    if (key !== "analytics") {
      setSelectedExamAnalytics(null)
      setSelectedStudentId(null)
    }
    setSidebarOpen(false)
    setProfileMenuOpen(false)
  }

  const sharedCardProps = {
    onEdit: openEdit,
    onDelete: (id) => setDeleteConfirm(id),
    onTogglePublish: handleTogglePublish,
    onQuestions: (id) => navigate(`/dashboard/teacher/exam/${id}/questions`),
  }

  function buildExamAnalytics(exam) {
    if (!exam) return null
    const attempts = examAttemptsMap[exam.id] || []
    const totalAttemptsCount = attempts.length
    const uniqueStudents = new Set(attempts.map((a) => a.student_id)).size
    const avgScore = totalAttemptsCount ? Math.round(attempts.reduce((sum, a) => sum + (a.score || 0), 0) / totalAttemptsCount) : 0
    const completionRate = totalAttemptsCount
      ? Math.round((attempts.filter((a) => !!a.submitted_at).length / totalAttemptsCount) * 100)
      : 0
    const avgTimeTakenSec = totalAttemptsCount
      ? Math.round(attempts.reduce((sum, a) => sum + (a.avg_time_sec || 0), 0) / totalAttemptsCount)
      : 0
    const anomalyFlags = attempts.filter((a) => a.anomaly).length

    const behaviorDistribution = BEHAVIOR_LABELS.map((label) => ({
      label,
      value: attempts.filter((a) => a.behavior === label).length,
    }))

    const questionCount = Math.max(exam.question_count || 0, 8)
    const spikeQuestion = (hashText(exam.id) % questionCount) + 1
    const timePerQuestion = Array.from({ length: questionCount }).map((_, idx) => {
      const qNo = idx + 1
      const base = 22 + ((hashText(`${exam.id}-${qNo}`) % 13))
      const spikeBoost = qNo === spikeQuestion ? 35 : 0
      return { question: `Q${qNo}`, avg_time_sec: base + spikeBoost }
    })

    const revisionFrequency = [
      { range: "0", value: attempts.filter((a) => (a.revisions || 0) === 0).length },
      { range: "1-2", value: attempts.filter((a) => (a.revisions || 0) >= 1 && (a.revisions || 0) <= 2).length },
      { range: "3-5", value: attempts.filter((a) => (a.revisions || 0) >= 3 && (a.revisions || 0) <= 5).length },
      { range: ">5", value: attempts.filter((a) => (a.revisions || 0) > 5).length },
    ]

    const navigationPattern = [
      { band: "Low (0-2)", value: attempts.filter((a) => (a.navigation_jumps || 0) <= 2).length },
      { band: "Medium (3-5)", value: attempts.filter((a) => (a.navigation_jumps || 0) >= 3 && (a.navigation_jumps || 0) <= 5).length },
      { band: "High (6+)", value: attempts.filter((a) => (a.navigation_jumps || 0) >= 6).length },
    ]

    const scoreDistribution = [
      { range: "0-20", value: attempts.filter((a) => (a.score || 0) <= 20).length },
      { range: "21-40", value: attempts.filter((a) => (a.score || 0) >= 21 && (a.score || 0) <= 40).length },
      { range: "41-60", value: attempts.filter((a) => (a.score || 0) >= 41 && (a.score || 0) <= 60).length },
      { range: "61-80", value: attempts.filter((a) => (a.score || 0) >= 61 && (a.score || 0) <= 80).length },
      { range: "81-100", value: attempts.filter((a) => (a.score || 0) >= 81).length },
    ]

    const studentTable = attempts
      .map((attempt) => ({
        studentName: attempt.student_name || "Unknown",
        studentEmail: attempt.student_email || "",
        score: Math.round(attempt.score || 0),
        avgTime: attempt.avg_time_sec || 0,
        revisions: attempt.revisions || 0,
        behavior: attempt.behavior,
      }))
      .sort((a, b) => b.score - a.score)

    const scatterData = attempts.map((attempt) => ({
      avgTime: attempt.avg_time_sec || 0,
      accuracy: Math.round(attempt.score || 0),
      anomaly: !!attempt.anomaly,
    }))

    return {
      totalAttemptsCount,
      uniqueStudents,
      avgScore,
      completionRate,
      avgTimeTakenSec,
      anomalyFlags,
      behaviorDistribution,
      timePerQuestion,
      revisionFrequency,
      navigationPattern,
      scoreDistribution,
      studentTable,
      scatterData,
    }
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
            <Avatar name={user?.name} imagePath={user?.profile_picture_path} onClick={setImageModalSrc} />
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
          <div className="ml-auto flex items-center gap-2">
            <div className="relative" onMouseLeave={() => setProfileMenuOpen(false)}>
              <button
                onClick={() => setProfileMenuOpen((v) => !v)}
                onMouseEnter={() => setProfileMenuOpen(true)}
                className="flex items-center gap-2 hover:bg-gray-50 rounded-xl px-3 py-1.5 transition-colors border border-transparent hover:border-gray-100"
              >
                <Avatar name={user?.name} imagePath={user?.profile_picture_path} onClick={setImageModalSrc} />
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
                  {user?.auth_provider === "local" && (
                    <button
                      onClick={() => {
                        setChangePasswordOpen(true)
                        setProfileMenuOpen(false)
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50 rounded-lg"
                    >
                      <svg viewBox="0 0 24 24" fill="none" className="w-[15px] h-[15px]" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <rect x="3" y="11" width="18" height="10" rx="2" />
                        <path d="M7 11V8a5 5 0 0 1 10 0v3" />
                      </svg>
                      Change Password
                    </button>
                  )}
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm font-semibold text-red-500 hover:bg-red-50 rounded-lg"
                  >
                    <LogOut size={15} /> Logout
                  </button>
                </div>
              )}
            </div>
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

          {/* ─ Analytics ─ */}
          {activeTab === "analytics" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <h2 className="text-2xl font-extrabold text-[#1a1a2e]">Analytics</h2>
                  <p className="text-gray-500 text-sm mt-0.5">Exam performance + behavior analytics (demo scaffold).</p>
                </div>
                <div className="inline-flex bg-white border border-gray-200 rounded-xl p-1">
                  <button
                    onClick={() => { setAnalyticsTab("exam"); setSelectedStudentId(null) }}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${analyticsTab === "exam" ? "bg-[#1a1a2e] text-white" : "text-gray-600 hover:bg-gray-50"}`}
                  >
                    Exam Analytics
                  </button>
                  <button
                    onClick={() => { setAnalyticsTab("student"); setSelectedExamAnalytics(null) }}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${analyticsTab === "student" ? "bg-[#1a1a2e] text-white" : "text-gray-600 hover:bg-gray-50"}`}
                  >
                    Student Analytics
                  </button>
                </div>
              </div>

              {loadingAnalytics ? (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-gray-400 text-sm text-center">Loading analytics…</div>
              ) : analyticsTab === "exam" ? (
                selectedExamAnalytics ? (
                  (() => {
                    const exam = exams.find((e) => e.id === selectedExamAnalytics)
                    const analytics = buildExamAnalytics(exam)
                    if (!exam || !analytics) {
                      return <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-sm text-gray-500">Exam analytics unavailable.</div>
                    }
                    return (
                      <div className="space-y-6">
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <div>
                            <h3 className="text-xl font-extrabold text-[#1a1a2e]">{exam.title}</h3>
                            <p className="text-sm text-gray-500">{exam.subject} · {exam.duration_minutes} min · {analytics.totalAttemptsCount} attempts</p>
                          </div>
                          <button
                            onClick={() => setSelectedExamAnalytics(null)}
                            className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-50"
                          >
                            Back to Exam Cards
                          </button>
                        </div>

                        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                          <StatCard icon="👥" value={analytics.uniqueStudents} label="Students Attempted" gradient="from-blue-400 to-blue-600" className="!p-4" />
                          <StatCard icon="🎯" value={`${analytics.avgScore}%`} label="Average Score" gradient="from-emerald-400 to-emerald-600" className="!p-4" />
                          <StatCard icon="✅" value={`${analytics.completionRate}%`} label="Completion Rate" gradient="from-violet-400 to-violet-600" className="!p-4" />
                          <StatCard icon="⏱️" value={`${analytics.avgTimeTakenSec}s`} label="Avg Time" gradient="from-amber-400 to-amber-600" className="!p-4" />
                          <StatCard icon="🚩" value={analytics.anomalyFlags} label="Anomaly Flags" gradient="from-rose-400 to-rose-600" className="!p-4" />
                        </div>

                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                          <ChartCard title="Behavior Classification Distribution">
                            <ResponsiveContainer width="100%" height={280}>
                              <PieChart>
                                <Pie data={analytics.behaviorDistribution} dataKey="value" nameKey="label" outerRadius={90}>
                                  {analytics.behaviorDistribution.map((entry) => (
                                    <Cell key={entry.label} fill={entry.label === "Fast_Response" ? "#10b981" : entry.label === "High_Revision" ? "#f59e0b" : entry.label === "Deliberative" ? "#3b82f6" : "#ef4444"} />
                                  ))}
                                </Pie>
                                <Tooltip />
                                <Legend />
                              </PieChart>
                            </ResponsiveContainer>
                          </ChartCard>

                          <ChartCard title="Time Spent per Question">
                            <ResponsiveContainer width="100%" height={280}>
                              <LineChart data={analytics.timePerQuestion}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                <XAxis dataKey="question" />
                                <YAxis />
                                <Tooltip />
                                <Line type="monotone" dataKey="avg_time_sec" stroke="#ff4b2b" strokeWidth={2.5} dot={{ r: 3 }} />
                              </LineChart>
                            </ResponsiveContainer>
                          </ChartCard>

                          <ChartCard title="Revision Frequency">
                            <ResponsiveContainer width="100%" height={260}>
                              <BarChart data={analytics.revisionFrequency}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                <XAxis dataKey="range" />
                                <YAxis allowDecimals={false} />
                                <Tooltip />
                                <Bar dataKey="value" fill="#6366f1" radius={[8, 8, 0, 0]} />
                              </BarChart>
                            </ResponsiveContainer>
                          </ChartCard>

                          <ChartCard title="Navigation Patterns">
                            <ResponsiveContainer width="100%" height={260}>
                              <BarChart data={analytics.navigationPattern}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                <XAxis dataKey="band" />
                                <YAxis allowDecimals={false} />
                                <Tooltip />
                                <Bar dataKey="value" fill="#14b8a6" radius={[8, 8, 0, 0]} />
                              </BarChart>
                            </ResponsiveContainer>
                          </ChartCard>

                          <ChartCard title="Score Distribution">
                            <ResponsiveContainer width="100%" height={260}>
                              <BarChart data={analytics.scoreDistribution}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                <XAxis dataKey="range" />
                                <YAxis allowDecimals={false} />
                                <Tooltip />
                                <Bar dataKey="value" fill="#f97316" radius={[8, 8, 0, 0]} />
                              </BarChart>
                            </ResponsiveContainer>
                          </ChartCard>

                          <ChartCard title="Anomaly Detection (Dummy Scatter)">
                            <ResponsiveContainer width="100%" height={260}>
                              <ScatterChart>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                <XAxis type="number" dataKey="avgTime" name="Average Time" unit="s" />
                                <YAxis type="number" dataKey="accuracy" name="Accuracy" unit="%" />
                                <Tooltip cursor={{ strokeDasharray: "3 3" }} />
                                <Scatter name="Attempts" data={analytics.scatterData} fill="#3b82f6" />
                              </ScatterChart>
                            </ResponsiveContainer>
                          </ChartCard>
                        </div>

                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                          <div className="px-5 py-4 border-b border-gray-100">
                            <h4 className="font-bold text-[#1a1a2e]">Student Behavior Table</h4>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="min-w-full text-sm">
                              <thead className="bg-gray-50 text-gray-500">
                                <tr>
                                  <th className="text-left px-4 py-3 font-semibold">Student</th>
                                  <th className="text-left px-4 py-3 font-semibold">Score</th>
                                  <th className="text-left px-4 py-3 font-semibold">Avg Time</th>
                                  <th className="text-left px-4 py-3 font-semibold">Revisions</th>
                                  <th className="text-left px-4 py-3 font-semibold">Behavior Label</th>
                                </tr>
                              </thead>
                              <tbody>
                                {analytics.studentTable.map((row, idx) => (
                                  <tr key={`${row.studentEmail}-${idx}`} className="border-t border-gray-100">
                                    <td className="px-4 py-3">
                                      <p className="font-semibold text-[#1a1a2e]">{row.studentName}</p>
                                      <p className="text-xs text-gray-400">{row.studentEmail}</p>
                                    </td>
                                    <td className="px-4 py-3 text-[#1a1a2e] font-semibold">{row.score}%</td>
                                    <td className="px-4 py-3 text-gray-600">{row.avgTime}s</td>
                                    <td className="px-4 py-3 text-gray-600">{row.revisions}</td>
                                    <td className="px-4 py-3">
                                      <span className="px-2 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">{row.behavior}</span>
                                    </td>
                                  </tr>
                                ))}
                                {analytics.studentTable.length === 0 && (
                                  <tr>
                                    <td className="px-4 py-6 text-gray-400" colSpan={5}>No attempts available for this exam.</td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    )
                  })()
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                      {exams.map((exam) => {
                        const quick = buildExamAnalytics(exam)
                        const dominantBehavior = quick?.behaviorDistribution
                          ?.slice()
                          .sort((a, b) => b.value - a.value)?.[0]?.label || "N/A"

                        return (
                          <div key={exam.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
                            <div>
                              <p className="text-xs text-gray-400 font-semibold uppercase">{exam.subject}</p>
                              <h3 className="font-bold text-[#1a1a2e] text-lg mt-1">{exam.title}</h3>
                              <p className="text-sm text-gray-500 mt-1">{exam.duration_minutes} min · {exam.question_count || 0} questions · {exam.attempt_count || 0} attempts</p>
                            </div>

                            <div className="flex flex-wrap gap-2">
                              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700">
                                Attempts: {quick?.totalAttemptsCount || 0}
                              </span>
                              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-violet-50 text-violet-700">
                                Behavior: {dominantBehavior}
                              </span>
                              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700">
                                Anomalies: {quick?.anomalyFlags || 0}
                              </span>
                            </div>

                            <button
                              onClick={() => setSelectedExamAnalytics(exam.id)}
                              className="w-full py-2.5 rounded-xl text-sm font-semibold bg-[#1a1a2e] text-white hover:bg-[#2a2a46]"
                            >
                              View Analytics
                            </button>
                          </div>
                        )
                      })}
                      {exams.length === 0 && (
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-gray-500 text-sm">Create an exam first to view analytics.</div>
                      )}
                    </div>

                    {exams.length > 0 && (
                      <div className="bg-white rounded-xl border border-gray-100 px-4 py-3 text-xs text-gray-600 flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-gray-700 mr-1">Behavior Legend:</span>
                        <span className="px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 font-semibold">Fast_Response</span>
                        <span className="px-2 py-1 rounded-full bg-amber-50 text-amber-700 font-semibold">High_Revision</span>
                        <span className="px-2 py-1 rounded-full bg-blue-50 text-blue-700 font-semibold">Deliberative</span>
                        <span className="px-2 py-1 rounded-full bg-rose-50 text-rose-700 font-semibold">Disengaged</span>
                      </div>
                    )}
                  </div>
                )
              ) : (
                <div className="space-y-4">
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      <Field
                        label="Search Student"
                        value={studentFilters.query}
                        onChange={(v) => setStudentFilters((p) => ({ ...p, query: v }))}
                        placeholder="Name or email"
                      />
                      <Field
                        label="Behavior"
                        value={studentFilters.behavior}
                        onChange={(v) => setStudentFilters((p) => ({ ...p, behavior: v }))}
                        type="select"
                        options={[{ value: "all", label: "All" }, ...BEHAVIOR_LABELS.map((b) => ({ value: b, label: b }))]}
                      />
                      <Field
                        label="Participation"
                        value={studentFilters.participation}
                        onChange={(v) => setStudentFilters((p) => ({ ...p, participation: v }))}
                        type="select"
                        options={[
                          { value: "all", label: "All" },
                          { value: "attempted", label: "Attempted" },
                          { value: "not_attempted", label: "Not Attempted" },
                        ]}
                      />
                      <div className="flex items-end">
                        <button
                          onClick={() => setStudentFilters({ query: "", behavior: "all", participation: "all" })}
                          className="w-full py-2.5 rounded-xl text-sm font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50"
                        >
                          Reset Filters
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="px-5 py-4 border-b border-gray-100">
                      <h4 className="font-bold text-[#1a1a2e]">Students</h4>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead className="bg-gray-50 text-gray-500">
                          <tr>
                            <th className="text-left px-4 py-3 font-semibold">Student</th>
                            <th className="text-left px-4 py-3 font-semibold">Tests Taken</th>
                            <th className="text-left px-4 py-3 font-semibold">Avg Score</th>
                            <th className="text-left px-4 py-3 font-semibold">Avg Time</th>
                            <th className="text-left px-4 py-3 font-semibold">Behavior</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredStudentRows.map((row) => (
                            <tr
                              key={row.id}
                              onClick={() => setSelectedStudentId(row.id)}
                              className={`border-t border-gray-100 cursor-pointer ${selectedStudentId === row.id ? "bg-orange-50" : "hover:bg-gray-50"}`}
                            >
                              <td className="px-4 py-3">
                                <p className="font-semibold text-[#1a1a2e]">{row.name}</p>
                                <p className="text-xs text-gray-400">{row.email}</p>
                              </td>
                              <td className="px-4 py-3 text-gray-600">{row.tests}</td>
                              <td className="px-4 py-3 text-gray-600">{row.tests ? `${row.avgScore}%` : "—"}</td>
                              <td className="px-4 py-3 text-gray-600">{row.tests ? `${row.avgTime}s` : "—"}</td>
                              <td className="px-4 py-3 text-gray-600">{row.behavior}</td>
                            </tr>
                          ))}
                          {filteredStudentRows.length === 0 && (
                            <tr>
                              <td className="px-4 py-6 text-gray-400" colSpan={5}>No students match these filters.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {selectedStudent && (
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
                      <div>
                        <h4 className="font-bold text-[#1a1a2e] text-lg">{selectedStudent.name}</h4>
                        <p className="text-sm text-gray-500">{selectedStudent.email}</p>
                      </div>
                      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                        <StatCard icon="🧪" value={selectedStudent.tests} label="Tests Taken" gradient="from-blue-400 to-blue-600" className="!p-4" />
                        <StatCard icon="🎯" value={selectedStudent.tests ? `${selectedStudent.avgScore}%` : "—"} label="Avg Score" gradient="from-emerald-400 to-emerald-600" className="!p-4" />
                        <StatCard icon="⏱️" value={selectedStudent.tests ? `${selectedStudent.avgTime}s` : "—"} label="Avg Time" gradient="from-amber-400 to-amber-600" className="!p-4" />
                        <StatCard icon="🔁" value={selectedStudent.tests ? selectedStudent.avgRevisions : "—"} label="Avg Revisions" gradient="from-violet-400 to-violet-600" className="!p-4" />
                        <StatCard icon="🧠" value={selectedStudent.behavior} label="Behavior" gradient="from-rose-400 to-rose-600" className="!p-4" />
                      </div>
                      <ChartCard title="Scores Across Teacher Exams">
                        <ResponsiveContainer width="100%" height={250}>
                          <BarChart data={selectedStudentAttempts.map((a) => ({ exam: a.exam_title, score: Math.round(a.score || 0) }))}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                            <XAxis dataKey="exam" hide={selectedStudentAttempts.length > 5} />
                            <YAxis domain={[0, 100]} />
                            <Tooltip />
                            <Bar dataKey="score" fill="#3b82f6" radius={[8, 8, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </ChartCard>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ─ Profile ─ */}
          {activeTab === "profile" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-extrabold text-[#1a1a2e]">Profile</h2>
                <p className="text-gray-500 text-sm mt-0.5">Manage your personal and professional account details.</p>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 items-start">
                <div className="xl:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
                  <div className="flex items-center gap-4">
                    <Avatar name={user?.name} imagePath={user?.profile_picture_path} large onClick={setImageModalSrc} />
                    <div>
                      <p className="font-bold text-[#1a1a2e] text-lg">{user?.name}</p>
                      <p className="text-xs font-semibold text-[#ff4b2b] uppercase tracking-wider">Teacher</p>
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
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Field label="Full Name" value={profileForm.name}
                      onChange={(v) => setProfileForm(p => ({ ...p, name: v }))} placeholder="Your full name" />
                    <Field label="Email Address" type="email" value={profileForm.email}
                      onChange={(v) => setProfileForm(p => ({ ...p, email: v }))} placeholder="you@example.com" />
                    <Field
                      label="Year of Joining"
                      type="number"
                      value={teacherProfileForm.year_of_joining}
                      onChange={(v) => setTeacherProfileForm((p) => ({ ...p, year_of_joining: v }))}
                      placeholder="2022"
                    />
                  </div>
                  <button onClick={handleProfileSave} disabled={profileLoading}
                    className="w-full md:w-auto px-6 py-2.5 bg-gradient-to-r from-[#ff4b2b] to-[#ff416c] text-white font-semibold rounded-xl hover:opacity-90 transition disabled:opacity-60">
                    {profileLoading ? "Saving…" : "Save Basic Details"}
                  </button>
                </div>

                <div className="bg-gradient-to-br from-[#1a1a2e] to-[#2a2a46] rounded-2xl p-6 text-white shadow-sm">
                  <p className="text-xs uppercase tracking-wider text-white/70 font-semibold">Teacher ID Card</p>
                  <div className="mt-4 flex items-center gap-3">
                    <Avatar name={user?.name} imagePath={user?.profile_picture_path} onClick={setImageModalSrc} />
                    <div>
                      <p className="font-bold text-lg leading-tight">{user?.name}</p>
                      <p className="text-sm text-white/70">{teacherProfileForm.college_email || "No college email set"}</p>
                    </div>
                  </div>
                  <div className="mt-5 space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-white/70">Role</span><span className="font-semibold">Teacher</span></div>
                    <div className="flex justify-between"><span className="text-white/70">Exams</span><span className="font-semibold">{totalExams}</span></div>
                    {teacherProfileForm.employee_id && (
                      <div className="flex justify-between"><span className="text-white/70">Employee ID</span><span className="font-semibold">{teacherProfileForm.employee_id}</span></div>
                    )}
                    {teacherProfileForm.department && (
                      <div className="flex justify-between"><span className="text-white/70">Department</span><span className="font-semibold text-right">{teacherProfileForm.department}</span></div>
                    )}
                    {teacherProfileForm.designation && (
                      <div className="flex justify-between"><span className="text-white/70">Designation</span><span className="font-semibold text-right">{teacherProfileForm.designation}</span></div>
                    )}
                    {teacherProfileForm.office_room && (
                      <div className="flex justify-between"><span className="text-white/70">Office</span><span className="font-semibold text-right">{teacherProfileForm.office_room}</span></div>
                    )}
                    {teacherProfileForm.subjects && (
                      <div>
                        <p className="text-white/70">Subjects</p>
                        <p className="font-semibold leading-snug">{teacherProfileForm.subjects}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <h3 className="font-bold text-[#1a1a2e] text-base">Professional Details</h3>
                    <p className="text-sm text-gray-500">Use these fields for teacher identity and subject mapping.</p>
                  </div>
                  {teacherProfileLoading && <span className="text-xs text-gray-400 font-semibold">Loading…</span>}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  <Field
                    label="Employee ID"
                    value={teacherProfileForm.employee_id}
                    onChange={(v) => setTeacherProfileForm((p) => ({ ...p, employee_id: v }))}
                    placeholder="EMP-1024"
                  />
                  <Field
                    label="College Email"
                    type="email"
                    value={teacherProfileForm.college_email}
                    onChange={(v) => setTeacherProfileForm((p) => ({ ...p, college_email: v }))}
                    placeholder="teacher@college.edu"
                  />
                  <Field
                    label="Department"
                    value={teacherProfileForm.department}
                    onChange={(v) => setTeacherProfileForm((p) => ({ ...p, department: v }))}
                    placeholder="Computer Science"
                  />
                  <Field
                    label="Designation"
                    value={teacherProfileForm.designation}
                    onChange={(v) => setTeacherProfileForm((p) => ({ ...p, designation: v }))}
                    placeholder="Assistant Professor"
                  />
                  <div className="md:col-span-2">
                    <Field
                      label="Subjects"
                      value={teacherProfileForm.subjects}
                      onChange={(v) => setTeacherProfileForm((p) => ({ ...p, subjects: v }))}
                      placeholder="DBMS, Data Structures, Operating Systems"
                    />
                  </div>
                  <Field
                    label="Office Room"
                    value={teacherProfileForm.office_room}
                    onChange={(v) => setTeacherProfileForm((p) => ({ ...p, office_room: v }))}
                    placeholder="Block B · Room 214"
                  />
                </div>

                <button
                  onClick={handleTeacherProfileSave}
                  disabled={teacherProfileSaving || teacherProfileLoading}
                  className="w-full md:w-auto px-6 py-2.5 bg-[#1a1a2e] text-white font-semibold rounded-xl hover:bg-[#252542] transition disabled:opacity-60"
                >
                  {teacherProfileSaving ? "Saving…" : "Save Professional Details"}
                </button>
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-3">
                <h3 className="font-bold text-[#1a1a2e] text-sm">Account Info</h3>
                {[
                  ["Personal Email", profileForm.email || "—"],
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

      {imageModalSrc && (
        <ImagePreviewModal src={imageModalSrc} onClose={() => setImageModalSrc(null)} />
      )}

      <ChangePasswordModal
        open={changePasswordOpen}
        onClose={() => setChangePasswordOpen(false)}
        onSubmit={handlePasswordSave}
        loading={passwordLoading}
      />
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
function Avatar({ name, imagePath, large = false, onClick }) {
  const [imageFailed, setImageFailed] = useState(false)
  const cls = large ? "w-16 h-16 text-2xl" : "w-9 h-9 text-sm"
  const src = toAbsoluteImageUrl(imagePath)

  useEffect(() => {
    setImageFailed(false)
  }, [imagePath])

  if (src && !imageFailed) {
    return (
      <img
        src={src}
        alt={name || "Profile"}
        onClick={() => onClick && onClick(src)}
        onError={() => setImageFailed(true)}
        className={`${cls} rounded-full object-cover shrink-0 ${onClick ? "cursor-zoom-in" : ""}`}
      />
    )
  }

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

function ChartCard({ title, children }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 lg:p-5">
      <h4 className="font-bold text-[#1a1a2e] text-sm mb-4">{title}</h4>
      {children}
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

function ImagePreviewModal({ src, onClose }) {
  return (
    <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div className="relative max-w-4xl w-full flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={onClose}
          className="absolute -top-10 right-0 text-white/90 hover:text-white text-sm font-semibold"
        >
          Close
        </button>
        <img src={src} alt="Preview" className="max-h-[85vh] w-auto max-w-full rounded-2xl border border-white/20" />
      </div>
    </div>
  )
}
