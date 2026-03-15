import { useState, useEffect } from "react"
import { useAuth } from "../context/AuthContext"
import { useNavigate, useParams } from "react-router-dom"
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
} from "@dnd-kit/core"
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import {
  ArrowLeft, Plus, Edit2, Trash2, GripVertical, AlertCircle, X,
  CheckCircle2, HelpCircle, Image, MinusCircle,
  LayoutDashboard, User, Menu, LogOut,
} from "lucide-react"
import {
  getAssessment, getQuestions, createQuestion, updateQuestion,
  deleteQuestion, reorderQuestions, uploadQuestionImage,
} from "../api/assessments"

const blankQForm = { question_text: "", question_image_path: "", options: ["", "", "", ""], correct_index: 0 }

function optionLabel(index) {
  return index < 26 ? String.fromCharCode(65 + index) : `${index + 1}`
}

function toAbsoluteImageUrl(path) {
  if (!path) return null
  if (path.startsWith("http://") || path.startsWith("https://")) return path
  return `http://127.0.0.1:8000${path}`
}

export default function ExamQuestionsPage() {
  const { examId } = useParams()
  const { token, user, logout } = useAuth()
  const navigate = useNavigate()

  const [exam, setExam]               = useState(null)
  const [questions, setQuestions]     = useState([])
  const [loading, setLoading]         = useState(true)
  const [showForm, setShowForm]       = useState(false)
  const [editingQ, setEditingQ]       = useState(null)
  const [qForm, setQForm]             = useState(blankQForm)
  const [formLoading, setFormLoading] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [toast, setToast]             = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [questionImageUploading, setQuestionImageUploading] = useState(false)
  const [imageModalSrc, setImageModalSrc] = useState(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  useEffect(() => { loadAll() }, [examId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadAll() {
    setLoading(true)
    try {
      const [examRes, qRes] = await Promise.all([
        getAssessment(token, examId),
        getQuestions(token, examId),
      ])
      setExam(examRes.data)
      setQuestions(qRes.data)
    } catch {
      flash("Failed to load exam", "error")
    } finally {
      setLoading(false)
    }
  }

  async function loadQuestions() {
    const res = await getQuestions(token, examId)
    setQuestions(res.data)
  }

  function flash(message, type = "success") {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3500)
  }

  function openAdd() {
    setEditingQ(null)
    setQForm(blankQForm)
    setShowForm(true)
  }

  function openEdit(q) {
    const opts = q.options?.length ? q.options.map((o) => o.option_text || "") : ["", "", "", ""]
    let correctIdx = 0
    q.options.forEach((o, i) => {
      if (o.is_correct) correctIdx = i
    })
    if (opts.length < 2) {
      while (opts.length < 2) opts.push("")
    }
    setQForm({
      question_text: q.question_text,
      question_image_path: q.question_image_path || "",
      options: opts,
      correct_index: correctIdx,
    })
    setEditingQ(q)
    setShowForm(true)
  }

  function isFormValid() {
    if (!qForm.question_text.trim()) return false
    return qForm.options.filter(o => o.trim()).length >= 2
  }

  function buildPayload() {
    const filledOptions = qForm.options
      .map((text, i) => ({ text: text.trim(), originalIndex: i }))
      .filter(o => o.text)
    const correctFilled = filledOptions.findIndex(o => o.originalIndex === qForm.correct_index)
    return {
      question_text: qForm.question_text.trim(),
      question_image_path: qForm.question_image_path || null,
      options: filledOptions.map((o, i) => ({
        option_text: o.text,
        is_correct: i === (correctFilled >= 0 ? correctFilled : 0),
      })),
    }
  }

  async function handleQuestionImageUpload(event) {
    const file = event.target.files?.[0]
    if (!file) return

    setQuestionImageUploading(true)
    try {
      const res = await uploadQuestionImage(token, examId, file)
      setQForm((prev) => ({
        ...prev,
        question_image_path: res.data?.question_image_path || prev.question_image_path,
      }))
      flash("Question image uploaded")
    } catch (err) {
      flash(err?.response?.data?.detail || "Failed to upload image", "error")
    } finally {
      event.target.value = ""
      setQuestionImageUploading(false)
    }
  }

  async function handleSubmit() {
    if (!isFormValid()) return
    setFormLoading(true)
    try {
      const payload = buildPayload()
      if (editingQ) {
        await updateQuestion(token, examId, editingQ.id, payload)
        flash("Question updated")
      } else {
        await createQuestion(token, examId, payload)
        flash("Question added")
      }
      await loadQuestions()
      setShowForm(false)
    } catch {
      flash("Failed to save question", "error")
    } finally {
      setFormLoading(false)
    }
  }

  async function handleDelete(id) {
    try {
      await deleteQuestion(token, examId, id)
      setDeleteConfirm(null)
      await loadQuestions()
      flash("Question deleted")
    } catch {
      flash("Failed to delete", "error")
    }
  }

  async function handleDragEnd(event) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = questions.findIndex(q => q.id === active.id)
    const newIndex = questions.findIndex(q => q.id === over.id)
    const reordered = arrayMove(questions, oldIndex, newIndex)
    setQuestions(reordered)
    try {
      await reorderQuestions(token, examId, reordered.map(q => q.id))
    } catch {
      flash("Failed to save order", "error")
      loadQuestions()
    }
  }

  function handleLogout() {
    logout()
    navigate("/")
  }

  return (
    <div className="min-h-screen bg-[#f4f6fb] flex">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/40 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

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
          <button
            onClick={() => navigate("/dashboard/teacher")}
            title={sidebarCollapsed ? "Dashboard" : undefined}
            className={`w-full flex items-center ${sidebarCollapsed ? "justify-center" : "gap-3"} px-4 py-2.5 rounded-xl font-semibold text-sm text-gray-500 hover:bg-gray-50 hover:text-gray-800 transition-all`}
          >
            <LayoutDashboard size={17} /> {!sidebarCollapsed && "Dashboard"}
          </button>
          <button
            onClick={() => navigate("/dashboard/teacher")}
            title={sidebarCollapsed ? "Profile" : undefined}
            className={`w-full flex items-center ${sidebarCollapsed ? "justify-center" : "gap-3"} px-4 py-2.5 rounded-xl font-semibold text-sm text-gray-500 hover:bg-gray-50 hover:text-gray-800 transition-all`}
          >
            <User size={17} /> {!sidebarCollapsed && "Profile"}
          </button>
          <button
            title={sidebarCollapsed ? "Manage Questions" : undefined}
            className={`w-full flex items-center ${sidebarCollapsed ? "justify-center" : "gap-3"} px-4 py-2.5 rounded-xl font-semibold text-sm bg-gradient-to-r from-[#ff4b2b] to-[#ff416c] text-white shadow-sm transition-all`}
          >
            <HelpCircle size={17} /> {!sidebarCollapsed && "Manage Questions"}
          </button>
        </nav>

        <div className="mt-auto px-3 pb-4 border-t border-gray-100 pt-3 shrink-0 bg-gradient-to-b from-white to-gray-50/70">
          <div className={`flex items-center ${sidebarCollapsed ? "justify-center" : "gap-3"} px-3 py-2 mb-1`}>
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#ff4b2b] to-[#ff416c] flex items-center justify-center text-white font-bold shrink-0">
              {user?.name?.[0]?.toUpperCase() ?? "T"}
            </div>
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

      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-gray-100 shadow-sm sticky top-0 z-30">
          <div className="max-w-5xl mx-auto px-4 lg:px-8 h-16 flex items-center gap-3">
            <button className="p-2 text-gray-500 hover:text-gray-800 rounded-lg hover:bg-gray-100 lg:hidden" onClick={() => setSidebarOpen(true)}>
              <Menu size={20} />
            </button>
            <button
              onClick={() => navigate("/dashboard/teacher")}
              className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
            >
              <ArrowLeft size={20} />
            </button>

            {exam ? (
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="min-w-0">
                  <h1 className="font-bold text-[#1a1a2e] text-base truncate leading-tight">{exam.title}</h1>
                  <p className="text-[11px] text-gray-400 font-semibold">{exam.subject} · {exam.duration_minutes}m</p>
                </div>
              </div>
            ) : (
              <div className="flex-1 h-8 w-48 bg-gray-100 rounded-lg animate-pulse" />
            )}

            <button
              onClick={openAdd}
              className="ml-auto flex items-center gap-2 px-3 lg:px-4 py-2 bg-gradient-to-r from-[#ff4b2b] to-[#ff416c] text-white text-xs lg:text-sm font-semibold rounded-xl hover:opacity-90 transition shadow-sm shrink-0"
            >
              <Plus size={15} /> Add Question
            </button>
          </div>
        </header>

        <main className="max-w-5xl w-full mx-auto px-4 lg:px-8 py-6">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="bg-white rounded-2xl h-32 animate-pulse border border-gray-100 shadow-sm" />
              ))}
            </div>
          ) : questions.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center justify-center py-20 gap-4 text-gray-400">
              <HelpCircle size={40} strokeWidth={1.5} />
              <p className="text-sm font-medium">No questions yet.</p>
              <button
                onClick={openAdd}
                className="px-5 py-2 bg-gradient-to-r from-[#ff4b2b] to-[#ff416c] text-white text-sm font-semibold rounded-xl hover:opacity-90 transition"
              >
                + Add your first question
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-gray-400 font-semibold pl-1">
                {questions.length} question{questions.length !== 1 ? "s" : ""}
                {questions.length > 1 && <span className="text-gray-300 font-normal"> · drag to reorder</span>}
              </p>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={questions.map(q => q.id)} strategy={verticalListSortingStrategy}>
                  {questions.map((q, idx) => (
                    <QuestionCard
                      key={q.id}
                      question={q}
                      index={idx}
                      onViewImage={setImageModalSrc}
                      onEdit={openEdit}
                      onDelete={(id) => setDeleteConfirm(id)}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            </div>
          )}
        </main>
      </div>

      {/* ── Question Form Modal ── */}
      {showForm && (
        <QuestionFormModal
          editingQ={editingQ}
          qForm={qForm}
          setQForm={setQForm}
          onViewImage={setImageModalSrc}
          onUploadImage={handleQuestionImageUpload}
          imageUploading={questionImageUploading}
          onClose={() => setShowForm(false)}
          onSubmit={handleSubmit}
          loading={formLoading}
          isValid={isFormValid()}
        />
      )}

      {/* ── Delete Confirm ── */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <AlertCircle size={20} className="text-red-500" />
              </div>
              <div>
                <h3 className="font-bold text-[#1a1a2e]">Delete Question?</h3>
                <p className="text-xs text-gray-500">This action cannot be undone.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 py-2 border border-gray-200 text-gray-600 text-sm font-semibold rounded-xl hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="flex-1 py-2 bg-red-500 text-white text-sm font-semibold rounded-xl hover:bg-red-600 transition"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast ── */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl shadow-lg font-semibold text-sm text-white
          ${toast.type === "error" ? "bg-red-500" : "bg-[#1a1a2e]"}`}>
          {toast.message}
        </div>
      )}

      {imageModalSrc && (
        <ImagePreviewModal src={imageModalSrc} onClose={() => setImageModalSrc(null)} />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
// Sortable question card
// ─────────────────────────────────────────────
function QuestionCard({ question, index, onViewImage, onEdit, onDelete }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: question.id })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`bg-white rounded-2xl border border-gray-100 overflow-hidden transition-all duration-200 select-none
        ${isDragging ? "opacity-40 scale-[0.98] shadow-2xl z-50" : "shadow-sm hover:shadow-md"}`}
    >
      <div className="h-1 bg-gradient-to-r from-[#ff4b2b] to-[#ff416c]" />
      <div className="p-5">
        <div className="flex items-start gap-3">
          {/* Question number */}
          <span className="w-7 h-7 rounded-full bg-gradient-to-br from-[#ff4b2b] to-[#ff416c] text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
            {index + 1}
          </span>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-[#1a1a2e] text-sm leading-snug mb-3">{question.question_text}</p>
            {question.question_image_path && (
              <div className="mb-3 space-y-2">
                <img
                  src={toAbsoluteImageUrl(question.question_image_path)}
                  alt="Question"
                  onClick={() => onViewImage?.(toAbsoluteImageUrl(question.question_image_path))}
                  className="w-full max-h-44 rounded-xl object-cover border border-gray-100 cursor-zoom-in"
                />
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => onViewImage?.(toAbsoluteImageUrl(question.question_image_path))}
                    className="text-[11px] font-semibold text-gray-600 hover:text-gray-700"
                  >
                    View picture
                  </button>
                </div>
              </div>
            )}
            <div className="space-y-1.5">
              {question.options.map((opt, i) => (
                <div
                  key={opt.id || i}
                  className={`flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-xs font-medium
                    ${opt.is_correct
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                      : "bg-gray-50 text-gray-500 border border-transparent"}`}
                >
                  <span className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0
                    ${opt.is_correct ? "bg-emerald-500 text-white" : "bg-gray-200 text-gray-500"}`}>
                    {optionLabel(i)}
                  </span>
                  <span className="flex-1">{opt.option_text}</span>
                  {opt.is_correct && <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />}
                </div>
              ))}
            </div>
          </div>

          {/* Actions column */}
          <div className="flex flex-col items-center gap-1 shrink-0">
            <button
              {...attributes} {...listeners}
              className="p-1.5 text-gray-300 hover:text-gray-500 rounded-lg cursor-grab active:cursor-grabbing touch-none"
              title="Drag to reorder"
            >
              <GripVertical size={16} />
            </button>
            <button
              onClick={() => onEdit(question)}
              className="p-1.5 text-gray-400 hover:text-[#ff4b2b] hover:bg-orange-50 rounded-lg transition-colors"
              title="Edit"
            >
              <Edit2 size={14} />
            </button>
            <button
              onClick={() => onDelete(question.id)}
              className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
              title="Delete"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// Add / Edit question modal
// ─────────────────────────────────────────────
function QuestionFormModal({ editingQ, qForm, setQForm, onViewImage, onUploadImage, imageUploading, onClose, onSubmit, loading, isValid }) {
  function addOption() {
    setQForm((prev) => ({
      ...prev,
      options: [...prev.options, ""],
    }))
  }

  function removeOption(index) {
    setQForm((prev) => {
      if (prev.options.length <= 2) return prev
      const options = prev.options.filter((_, i) => i !== index)
      let correctIndex = prev.correct_index
      if (index < correctIndex) correctIndex -= 1
      if (index === correctIndex) correctIndex = 0
      return {
        ...prev,
        options,
        correct_index: Math.min(correctIndex, options.length - 1),
      }
    })
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl max-h-[90vh] flex flex-col">
        {/* Head */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <h3 className="font-bold text-[#1a1a2e]">{editingQ ? "Edit Question" : "Add Question"}</h3>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5 overflow-y-auto flex-1">
          {/* Question text */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
              Question <span className="text-red-400">*</span>
            </label>
            <textarea
              rows={3}
              value={qForm.question_text}
              onChange={(e) => setQForm(p => ({ ...p, question_text: e.target.value }))}
              placeholder="Enter your question here…"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-[#1a1a2e] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#ff4b2b]/30 focus:border-[#ff4b2b] transition resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Question Picture</label>
            {qForm.question_image_path ? (
              <div className="space-y-2">
                <img
                  src={toAbsoluteImageUrl(qForm.question_image_path)}
                  alt="Question preview"
                  onClick={() => onViewImage?.(toAbsoluteImageUrl(qForm.question_image_path))}
                  className="w-full max-h-52 rounded-xl border border-gray-200 object-cover cursor-zoom-in"
                />
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => onViewImage?.(toAbsoluteImageUrl(qForm.question_image_path))}
                    className="text-xs font-semibold text-gray-600 hover:text-gray-700"
                  >
                    View picture
                  </button>
                  <button
                    type="button"
                    onClick={() => setQForm((p) => ({ ...p, question_image_path: "" }))}
                    className="text-xs font-semibold text-red-500 hover:text-red-600"
                  >
                    Remove picture
                  </button>
                </div>
              </div>
            ) : (
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50">
                <Image size={15} /> {imageUploading ? "Uploading…" : "Upload question picture"}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={onUploadImage}
                  disabled={imageUploading}
                  className="hidden"
                />
              </label>
            )}
          </div>

          {/* Options */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
              Answer Options <span className="text-red-400">*</span>
              <span className="text-gray-400 normal-case font-normal ml-1">(fill at least 2)</span>
            </label>
            <div className="space-y-2.5">
              {qForm.options.map((opt, i) => (
                <div key={i} className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setQForm(p => ({ ...p, correct_index: i }))}
                    title="Mark as correct answer"
                    className={`w-7 h-7 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors
                      ${qForm.correct_index === i
                        ? "border-emerald-500 bg-emerald-500 text-white"
                        : "border-gray-300 hover:border-emerald-400 text-transparent hover:text-emerald-400"}`}
                  >
                    <CheckCircle2 size={14} />
                  </button>
                  <span className="w-6 h-6 rounded-full bg-gray-100 text-gray-500 text-xs font-bold flex items-center justify-center shrink-0">
                    {optionLabel(i)}
                  </span>
                  <input
                    type="text"
                    value={opt}
                    onChange={(e) => setQForm(p => {
                      const opts = [...p.options]
                      opts[i] = e.target.value
                      return { ...p, options: opts }
                    })}
                    placeholder={`Option ${optionLabel(i)}`}
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm text-[#1a1a2e] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#ff4b2b]/30 focus:border-[#ff4b2b] transition"
                  />
                  <button
                    type="button"
                    onClick={() => removeOption(i)}
                    disabled={qForm.options.length <= 2}
                    className="text-gray-400 hover:text-red-500 disabled:opacity-40 disabled:cursor-not-allowed"
                    title="Remove option"
                  >
                    <MinusCircle size={18} />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addOption}
              className="mt-3 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50"
            >
              <Plus size={14} /> Add Option
            </button>
            <p className="text-[11px] text-gray-400 mt-2">
              Click the circle to mark the correct answer. Minimum 2 options required.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-5 pt-4 flex gap-3 border-t border-gray-100 shrink-0">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 border border-gray-200 text-gray-600 text-sm font-semibold rounded-xl hover:bg-gray-50 transition"
          >
            Cancel
          </button>
          <button
            onClick={onSubmit}
            disabled={loading || !isValid}
            className="flex-1 py-2.5 bg-gradient-to-r from-[#ff4b2b] to-[#ff416c] text-white text-sm font-semibold rounded-xl hover:opacity-90 transition disabled:opacity-50"
          >
            {loading ? "Saving…" : editingQ ? "Save Changes" : "Add Question"}
          </button>
        </div>
      </div>
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
