export default function TeacherAnalyticsDetailPanel({
  selectedTeacher,
  loading,
  data,
  subjectFilter,
  onSubjectFilterChange,
}) {
  const metrics = data?.metrics || {}
  const flags = data?.engagement_flags || {}
  const items = data?.items || []
  const subjects = data?.filters?.subjects || []

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="font-bold text-[#1a1a2e]">Teacher Drill-down</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            {selectedTeacher ? `${selectedTeacher.name} · ${selectedTeacher.email}` : "Select a teacher from directory"}
          </p>
        </div>
        <select
          value={subjectFilter}
          onChange={(event) => onSubjectFilterChange(event.target.value)}
          className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg bg-white"
          disabled={!selectedTeacher}
        >
          <option value="">All Subjects</option>
          {subjects.map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>
      </div>

      {!selectedTeacher ? (
        <div className="px-6 py-8 text-sm text-gray-500">Select a teacher to load exam analytics and engagement indicators.</div>
      ) : (
        <div className="p-6 space-y-5">
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
            <MetricCard label="Exams Created" value={metrics.total_exams_created ?? "—"} />
            <MetricCard label="Student Attempts" value={metrics.total_student_attempts ?? "—"} />
            <MetricCard label="Avg Exam Score" value={metrics.average_exam_score != null ? `${metrics.average_exam_score}%` : "—"} />
            <MetricCard label="Avg Completion" value={metrics.average_completion_rate != null ? `${metrics.average_completion_rate}%` : "—"} />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <FlagChip label="Inactive" active={!!flags.inactive_teacher} />
            <FlagChip label="Low Participation" active={!!flags.low_participation} />
            <FlagChip label="High Failure" active={!!flags.high_failure_rate} />
            <FlagChip label="No Recent Exams" active={!!flags.no_recent_exams} />
          </div>

          <div className="rounded-xl border border-gray-100 overflow-hidden">
            <div className="max-h-[40vh] overflow-auto divide-y divide-gray-100">
              {loading ? (
                <div className="px-4 py-6 text-sm text-gray-400">Loading teacher exam analytics…</div>
              ) : items.length === 0 ? (
                <div className="px-4 py-6 text-sm text-gray-500">No exams found for this teacher.</div>
              ) : (
                items.map((item) => (
                  <div key={item.exam_id} className="px-4 py-3 text-xs sm:text-sm flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-[#1a1a2e] truncate">{item.exam}</p>
                      <p className="text-gray-500 mt-0.5">{item.subject || "—"} · Attempts {item.attempts}</p>
                    </div>
                    <div className="text-right text-xs text-gray-500 shrink-0">
                      <p>Avg {item.avg_score != null ? `${item.avg_score}%` : "—"}</p>
                      <p className="mt-0.5">Fast {item.behaviour_summary.Fast_Response} · High {item.behaviour_summary.High_Revision}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function MetricCard({ label, value }) {
  return (
    <div className="rounded-xl border border-gray-100 px-4 py-3">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{label}</p>
      <p className="text-lg font-bold text-[#1a1a2e] mt-1">{value}</p>
    </div>
  )
}

function FlagChip({ label, active }) {
  return (
    <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${active ? "bg-red-100 text-red-700 border-red-200" : "bg-emerald-100 text-emerald-700 border-emerald-200"}`}>
      {label}: {active ? "Yes" : "No"}
    </span>
  )
}
