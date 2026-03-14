import { CheckCircle2, RotateCcw } from "lucide-react"

export default function StudentExamResult({ examTitle, result, onBackToExams }) {
  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 text-center space-y-3">
        <div className="mx-auto w-14 h-14 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
          <CheckCircle2 size={28} />
        </div>
        <h3 className="text-xl font-bold text-[#1a1a2e]">Exam Completed</h3>
        <p className="text-sm text-gray-600">{examTitle}</p>
        <p className="text-xs text-gray-500">Result page is currently a dummy preview. Detailed analytics can be added next.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <ResultCard label="Total Questions" value={result?.total_questions ?? 0} />
        <ResultCard label="Attempted" value={result?.attempted ?? 0} />
        <ResultCard label="Skipped" value={result?.skipped ?? 0} />
        <ResultCard label="Score" value={result?.score != null ? `${result.score}%` : "--"} />
      </div>

      <button
        onClick={onBackToExams}
        className="w-full md:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#ff4b2b] to-[#ff416c] text-white text-sm font-semibold hover:opacity-90 transition inline-flex items-center justify-center gap-1.5"
      >
        <RotateCcw size={15} /> Back to Exams
      </button>
    </div>
  )
}

function ResultCard({ label, value }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">{label}</p>
      <p className="text-xl font-bold text-[#1a1a2e] mt-1">{value}</p>
    </div>
  )
}
