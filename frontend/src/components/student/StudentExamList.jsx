import { BookOpen, Clock, Filter, PlayCircle, RefreshCcw, Search, UserRound } from "lucide-react"

export default function StudentExamList({
  exams = [],
  loading = false,
  searchQuery,
  onSearchQueryChange,
  subjectFilter,
  onSubjectFilterChange,
  subjectOptions = [],
  onRefresh,
  onTakeExam,
}) {
  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 lg:p-5 space-y-3">
        <div className="flex flex-wrap items-center gap-2 justify-between">
          <div>
            <h3 className="font-bold text-[#1a1a2e]">Available Exams</h3>
            <p className="text-xs text-gray-500 mt-0.5">Discover published tests by teachers and start when ready.</p>
          </div>
          <button onClick={onRefresh} className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600 hover:underline">
            <RefreshCcw size={13} /> Refresh
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <label className="md:col-span-2 flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2.5 focus-within:ring-2 focus-within:ring-[#ff4b2b]/30 focus-within:border-[#ff4b2b]">
            <Search size={16} className="text-gray-400" />
            <input
              value={searchQuery}
              onChange={(event) => onSearchQueryChange(event.target.value)}
              placeholder="Search by exam title or subject"
              className="w-full text-sm text-[#1a1a2e] placeholder-gray-400 bg-transparent outline-none"
            />
          </label>

          <label className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2.5 focus-within:ring-2 focus-within:ring-[#ff4b2b]/30 focus-within:border-[#ff4b2b]">
            <Filter size={16} className="text-gray-400" />
            <select
              value={subjectFilter}
              onChange={(event) => onSubjectFilterChange(event.target.value)}
              className="w-full text-sm text-[#1a1a2e] bg-transparent outline-none"
            >
              <option value="">All Subjects</option>
              {subjectOptions.map((subject) => (
                <option key={subject} value={subject}>{subject}</option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-sm text-gray-400">Loading exams…</div>
      ) : exams.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center space-y-2">
          <p className="text-base font-semibold text-[#1a1a2e]">No exams found</p>
          <p className="text-sm text-gray-500">Try clearing filters or check back later for newly published exams.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-4">
          {exams.map((exam) => (
            <div key={exam.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-3 hover:-translate-y-0.5 transition-transform">
              <div className="space-y-1.5">
                <p className="text-base font-bold text-[#1a1a2e] leading-tight line-clamp-2">{exam.title}</p>
                <div className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-orange-50 text-[#ff4b2b]">
                  {exam.subject}
                </div>
              </div>

              <div className="flex flex-wrap gap-3 text-xs text-gray-500 font-semibold">
                <span className="inline-flex items-center gap-1"><Clock size={13} /> {exam.duration_minutes} min</span>
                <span className="inline-flex items-center gap-1"><BookOpen size={13} /> {exam.question_count} questions</span>
                <span className="inline-flex items-center gap-1"><UserRound size={13} /> {exam.teacher_name || "Teacher"}</span>
              </div>

              <button
                onClick={() => onTakeExam(exam)}
                className="mt-auto w-full py-2.5 rounded-xl bg-gradient-to-r from-[#ff4b2b] to-[#ff416c] text-white text-sm font-semibold inline-flex items-center justify-center gap-2 hover:opacity-90 transition"
              >
                <PlayCircle size={16} /> Take Exam
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
