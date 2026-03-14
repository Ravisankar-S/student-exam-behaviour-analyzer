import { AlertTriangle, BookOpen, Clock, ShieldAlert, X } from "lucide-react"

export default function ExamInstructionsModal({ exam, open, onClose, onStart, loading = false }) {
  if (!open || !exam) return null

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-xl shadow-xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="font-bold text-[#1a1a2e]">Exam Instructions</h3>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100" disabled={loading}>
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-2">
            <p className="font-bold text-[#1a1a2e] text-base">{exam.title}</p>
            <div className="flex flex-wrap gap-3 text-xs font-semibold text-gray-600">
              <span className="inline-flex items-center gap-1"><BookOpen size={13} /> {exam.subject}</span>
              <span className="inline-flex items-center gap-1"><Clock size={13} /> {exam.duration_minutes} min</span>
              <span className="inline-flex items-center gap-1"><AlertTriangle size={13} /> {exam.question_count} questions</span>
            </div>
          </div>

          <ul className="space-y-2 text-sm text-gray-700 list-disc pl-5">
            <li>Read each question carefully before selecting an option.</li>
            <li>You can either submit or skip each question; no question can be left untouched.</li>
            <li>Do not navigate away during the exam. Navigation is locked until completion.</li>
            <li className="flex items-start gap-2 list-none pl-0"><ShieldAlert size={15} className="mt-0.5 text-[#ff416c]" /> Avoid unfair means while taking the test.</li>
          </ul>
        </div>

        <div className="px-6 pb-5 flex gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 py-2.5 border border-gray-200 text-gray-600 text-sm font-semibold rounded-xl hover:bg-gray-50 transition disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            onClick={onStart}
            disabled={loading}
            className="flex-1 py-2.5 bg-gradient-to-r from-[#ff4b2b] to-[#ff416c] text-white text-sm font-semibold rounded-xl hover:opacity-90 transition disabled:opacity-60"
          >
            {loading ? "Starting…" : "Start Exam"}
          </button>
        </div>
      </div>
    </div>
  )
}
