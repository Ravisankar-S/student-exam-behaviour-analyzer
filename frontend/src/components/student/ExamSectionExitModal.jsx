import { AlertTriangle } from "lucide-react"

export default function ExamSectionExitModal({ open, onCancel, onConfirm }) {
  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onCancel}>
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl" onClick={(event) => event.stopPropagation()}>
        <div className="px-6 pt-6 pb-4">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-amber-100 text-amber-700 mb-3">
            <AlertTriangle size={18} />
          </div>
          <h3 className="font-bold text-[#1a1a2e] text-lg">Leave Exams Section?</h3>
          <p className="text-sm text-gray-600 mt-2">Are you sure you want to navigate outside the Exam Section ? </p>
        </div>

        <div className="px-6 pb-6 flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 border border-gray-200 text-gray-600 text-sm font-semibold rounded-xl hover:bg-gray-50 transition"
          >
            Stay Here
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 bg-gradient-to-r from-[#ff4b2b] to-[#ff416c] text-white text-sm font-semibold rounded-xl hover:opacity-90 transition"
          >
            Yes, Continue
          </button>
        </div>
      </div>
    </div>
  )
}
