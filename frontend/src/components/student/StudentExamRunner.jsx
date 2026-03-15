import { useEffect, useMemo, useRef, useState } from "react"
import { AlertTriangle, CheckCircle2, SkipForward } from "lucide-react"

function toAbsoluteImageUrl(path) {
  if (!path) return null
  if (path.startsWith("http://") || path.startsWith("https://")) return path
  return `http://127.0.0.1:8000${path}`
}

export default function StudentExamRunner({ exam, questions = [], onSubmitAttempt, submitting = false, onFlash }) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [selectedByQuestion, setSelectedByQuestion] = useState({})
  const [statusByQuestion, setStatusByQuestion] = useState({})
  const [startedAt] = useState(() => new Date().toISOString())
  const [remainingSeconds, setRemainingSeconds] = useState(() => Math.max(0, (exam?.duration_minutes || 60) * 60))
  const autoSubmittedRef = useRef(false)

  const currentQuestion = questions[currentIndex]
  const processedCount = Object.keys(statusByQuestion).length
  const progressPercent = questions.length ? Math.round((processedCount / questions.length) * 100) : 0
  const allHandled = processedCount === questions.length && questions.length > 0

  const selectedOption = currentQuestion ? selectedByQuestion[currentQuestion.id] : ""

  const summary = useMemo(() => {
    let attempted = 0
    let skipped = 0
    for (const status of Object.values(statusByQuestion)) {
      if (status === "answered") attempted += 1
      if (status === "skipped") skipped += 1
    }
    return { attempted, skipped }
  }, [statusByQuestion])

  useEffect(() => {
    const total = Math.max(0, (exam?.duration_minutes || 60) * 60)
    setRemainingSeconds(total)
    autoSubmittedRef.current = false
  }, [exam?.id, exam?.duration_minutes])

  function buildResponses() {
    return questions.map((question) => {
      const status = statusByQuestion[question.id]
      return {
        question_id: question.id,
        selected_option_id: status === "answered" ? selectedByQuestion[question.id] : null,
        skipped: status !== "answered",
      }
    })
  }

  function submitPayload(isAuto = false) {
    const responses = buildResponses()
    onSubmitAttempt({
      responses,
      started_at: startedAt,
      submitted_at: new Date().toISOString(),
      auto_submitted: isAuto,
    })
  }

  useEffect(() => {
    if (submitting || allHandled || questions.length === 0) return

    if (remainingSeconds <= 0 && !autoSubmittedRef.current) {
      autoSubmittedRef.current = true
      onFlash?.("Time is up. Exam submitted automatically.", "error")
      submitPayload(true)
      return
    }

    const timer = window.setInterval(() => {
      setRemainingSeconds((prev) => Math.max(0, prev - 1))
    }, 1000)

    return () => window.clearInterval(timer)
  }, [remainingSeconds, submitting, allHandled, questions.length]) // eslint-disable-line react-hooks/exhaustive-deps

  const minutesLeft = Math.floor(remainingSeconds / 60)
  const secondsLeft = remainingSeconds % 60
  const timerText = `${String(minutesLeft).padStart(2, "0")}:${String(secondsLeft).padStart(2, "0")}`

  function markAndAdvance(kind) {
    if (!currentQuestion) return

    if (kind === "answered" && !selectedOption) {
      onFlash?.("Select an option or use Skip", "error")
      return
    }

    const questionId = currentQuestion.id
    setStatusByQuestion((prev) => ({ ...prev, [questionId]: kind }))

    if (kind === "skipped") {
      setSelectedByQuestion((prev) => {
        const next = { ...prev }
        delete next[questionId]
        return next
      })
    }

    if (currentIndex < questions.length - 1) {
      setCurrentIndex((prev) => prev + 1)
    }
  }

  function goToQuestion(index) {
    if (index < 0 || index >= questions.length) return
    setCurrentIndex(index)
  }

  function handleFinalSubmit() {
    submitPayload(false)
  }

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 lg:p-5 space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs uppercase tracking-wider text-gray-400 font-semibold">Exam In Progress</p>
            <h3 className="font-bold text-[#1a1a2e] text-lg">{exam?.title}</h3>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500">Progress</p>
            <p className="text-sm font-bold text-[#1a1a2e]">{processedCount}/{questions.length} handled</p>
          <div className="text-right">
            <p className="text-xs text-gray-500">Time Left</p>
            <p className={`text-sm font-bold ${remainingSeconds <= 60 ? "text-red-600" : "text-[#1a1a2e]"}`}>{timerText}</p>
          </div>
          </div>
        </div>

        <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden">
          <div className="h-full bg-gradient-to-r from-[#ff4b2b] to-[#ff416c] transition-all" style={{ width: `${progressPercent}%` }} />
        </div>

        <div className="grid grid-cols-5 md:grid-cols-10 gap-2">
          {questions.map((question, index) => {
            const status = statusByQuestion[question.id]
            const cls = status === "answered"
              ? "bg-emerald-100 text-emerald-700 border-emerald-200"
              : status === "skipped"
                ? "bg-amber-100 text-amber-700 border-amber-200"
                : "bg-white text-gray-500 border-gray-200"

            return (
              <button
                key={question.id}
                onClick={() => goToQuestion(index)}
                className={`h-9 rounded-lg border text-xs font-bold transition ${cls} ${index === currentIndex ? "ring-2 ring-[#ff4b2b]/40" : ""}`}
              >
                {index + 1}
              </button>
            )
          })}
        </div>
      </div>

      {!allHandled && currentQuestion && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
          <div className="flex items-start justify-between gap-4">
            <p className="text-sm font-bold text-[#1a1a2e]">Q{currentIndex + 1}. {currentQuestion.question_text}</p>
            <span className="text-[11px] uppercase tracking-wide font-semibold text-gray-400 shrink-0">Single Choice</span>
          </div>

          {toAbsoluteImageUrl(currentQuestion.question_image_path) && (
            <img
              src={toAbsoluteImageUrl(currentQuestion.question_image_path)}
              alt="Question"
              className="w-full max-h-64 object-contain rounded-xl border border-gray-100 bg-gray-50"
            />
          )}

          <div className="space-y-2.5">
            {(currentQuestion.options || []).map((option, index) => (
              <button
                key={option.id}
                onClick={() => setSelectedByQuestion((prev) => ({ ...prev, [currentQuestion.id]: option.id }))}
                className={`w-full text-left rounded-xl border p-3.5 transition ${selectedOption === option.id ? "border-[#ff4b2b] bg-orange-50" : "border-gray-200 hover:border-gray-300 bg-white"}`}
              >
                <p className="text-sm text-[#1a1a2e]"><span className="font-bold mr-2">{String.fromCharCode(65 + index)}.</span>{option.option_text}</p>
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between gap-3 flex-wrap border-t border-gray-100 pt-4">
            <p className="text-xs font-semibold text-gray-500 inline-flex items-center gap-1.5"><AlertTriangle size={13} /> Submit or skip to move ahead.</p>
            <div className="flex gap-2.5 w-full sm:w-auto">
              <button
                onClick={() => markAndAdvance("skipped")}
                className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl border border-amber-200 text-amber-700 bg-amber-50 text-sm font-semibold hover:bg-amber-100 transition inline-flex items-center justify-center gap-1.5"
              >
                <SkipForward size={15} /> Skip
              </button>
              <button
                onClick={() => markAndAdvance("answered")}
                className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#ff4b2b] to-[#ff416c] text-white text-sm font-semibold hover:opacity-90 transition inline-flex items-center justify-center gap-1.5"
              >
                <CheckCircle2 size={15} /> Submit Answer
              </button>
            </div>
          </div>
        </div>
      )}

      {allHandled && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
          <h3 className="text-lg font-bold text-[#1a1a2e]">All questions handled</h3>
          <p className="text-sm text-gray-600">You have submitted or skipped every question. You can now finalize this attempt.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-xl border border-gray-200 p-4 bg-gray-50">
              <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Attempted</p>
              <p className="text-xl font-bold text-[#1a1a2e]">{summary.attempted}</p>
            </div>
            <div className="rounded-xl border border-gray-200 p-4 bg-gray-50">
              <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Skipped</p>
              <p className="text-xl font-bold text-[#1a1a2e]">{summary.skipped}</p>
            </div>
          </div>
          <button
            onClick={handleFinalSubmit}
            disabled={submitting}
            className="w-full md:w-auto px-6 py-2.5 rounded-xl bg-[#1a1a2e] text-white text-sm font-semibold hover:bg-[#2a2a46] transition disabled:opacity-60"
          >
            {submitting ? "Submitting…" : "Finish & View Result"}
          </button>
        </div>
      )}
    </div>
  )
}
