import { useEffect, useState } from "react"
import { BookOpen, Clock, Filter, PlayCircle, RefreshCcw, Search, UserRound, X } from "lucide-react"

function getCloseNotice(availableUntil, nowTick = Date.now()) {
  if (!availableUntil) return null
  const end = new Date(availableUntil).getTime()
  if (!Number.isFinite(end)) return null

  const diff = end - nowTick
  if (diff <= 0) return "This exam has closed"

  const totalSec = Math.floor(diff / 1000)
  const days = Math.floor(totalSec / 86400)
  const hours = Math.floor((totalSec % 86400) / 3600)
  const mins = Math.floor((totalSec % 3600) / 60)
  const secs = totalSec % 60

  if (days > 0) return `Closes in ${days}d ${hours}h`
  return `Closes in ${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
}

export default function StudentExamList({
  exams = [],
  loading = false,
  searchQuery,
  onSearchQueryChange,
  subjectFilter,
  onSubjectFilterChange,
  subjectOptions = [],
  departmentFilter,
  onDepartmentFilterChange,
  departmentOptions = [],
  teacherFilter,
  onTeacherFilterChange,
  teacherOptions = [],
  onClearFilters,
  onRefresh,
  onTakeExam,
}) {
  const [nowTick, setNowTick] = useState(Date.now())

  useEffect(() => {
    const timer = window.setInterval(() => setNowTick(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

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

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
          <label className="xl:col-span-2 flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2.5 focus-within:ring-2 focus-within:ring-[#ff4b2b]/30 focus-within:border-[#ff4b2b]">
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

          <label className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2.5 focus-within:ring-2 focus-within:ring-[#ff4b2b]/30 focus-within:border-[#ff4b2b]">
            <Filter size={16} className="text-gray-400" />
            <select
              value={departmentFilter}
              onChange={(event) => onDepartmentFilterChange(event.target.value)}
              className="w-full text-sm text-[#1a1a2e] bg-transparent outline-none"
            >
              <option value="">All Departments</option>
              {departmentOptions.map((department) => (
                <option key={department} value={department}>{department}</option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2.5 focus-within:ring-2 focus-within:ring-[#ff4b2b]/30 focus-within:border-[#ff4b2b]">
            <UserRound size={16} className="text-gray-400" />
            <select
              value={teacherFilter}
              onChange={(event) => onTeacherFilterChange(event.target.value)}
              className="w-full text-sm text-[#1a1a2e] bg-transparent outline-none"
            >
              <option value="">All Teachers</option>
              {teacherOptions.map((teacher) => (
                <option key={teacher.id} value={teacher.id}>{teacher.name}</option>
              ))}
            </select>
          </label>

          <button
            onClick={onClearFilters}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition"
          >
            <X size={14} /> Clear
          </button>
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
          {exams.map((exam) => {
            const closeNotice = getCloseNotice(exam.available_until, nowTick)
            const isClosedBySchedule = closeNotice === "This exam has closed"
            const startTs = exam.available_from ? new Date(exam.available_from).getTime() : null
            const endTs = exam.available_until ? new Date(exam.available_until).getTime() : null
            const isWithinStart = startTs == null || nowTick >= startTs
            const isWithinEnd = endTs == null || nowTick < endTs
            const isCurrentlyActive = isWithinStart && isWithinEnd && !isClosedBySchedule
            return (
              <div key={exam.id} className={`relative bg-white rounded-2xl border shadow-sm p-5 flex flex-col gap-3 hover:-translate-y-0.5 transition-transform ${isCurrentlyActive ? "border-emerald-400" : "border-gray-100"}`}>
                {isCurrentlyActive && <span className="pointer-events-none absolute inset-0 rounded-2xl border border-emerald-300 animate-pulse" />}
                {closeNotice && (
                  <div className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border inline-flex w-fit ${closeNotice === "This exam has closed" ? "bg-red-100 text-red-700 border-red-200" : "bg-amber-100 text-amber-700 border-amber-200"}`}>
                    {closeNotice}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 rounded-xl border border-gray-100 p-3 bg-gray-50/60">
                  <div>
                    <p className="text-[11px] uppercase tracking-wider text-gray-400 font-semibold">Title</p>
                    <p className="text-sm font-semibold text-[#1a1a2e] leading-tight line-clamp-2 mt-0.5">{exam.title}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wider text-gray-400 font-semibold">Subject</p>
                    <p className="text-sm font-semibold text-[#1a1a2e] leading-tight line-clamp-2 mt-0.5">{exam.subject}</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3 text-xs text-gray-500 font-semibold">
                  <span className="inline-flex items-center gap-1"><Clock size={13} /> {exam.duration_minutes} min</span>
                  <span className="inline-flex items-center gap-1"><BookOpen size={13} /> {exam.question_count} questions</span>
                  <span className="inline-flex items-center gap-1"><UserRound size={13} /> {exam.teacher_name || "Teacher"}</span>
                </div>

                <button
                  onClick={() => onTakeExam(exam)}
                  disabled={isClosedBySchedule}
                  className="mt-auto w-full py-2.5 rounded-xl bg-gradient-to-r from-[#ff4b2b] to-[#ff416c] text-white text-sm font-semibold inline-flex items-center justify-center gap-2 hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <PlayCircle size={16} /> {isClosedBySchedule ? "Exam Closed" : "Take Exam"}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
