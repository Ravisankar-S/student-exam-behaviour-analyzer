function formatDateTime(value) {
  if (!value) return "—"
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return "—"
  return parsed.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  })
}

export default function StudentAnalyticsDetailPanel({
  selectedStudent,
  loading,
  historyItems,
  filterOptions,
  filters,
  onFilterChange,
  onClearFilters,
  behaviourLoading,
  behaviourItems,
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="font-bold text-[#1a1a2e]">Student Drill-down</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            {selectedStudent ? `${selectedStudent.name} · ${selectedStudent.email}` : "Select a student from directory"}
          </p>
        </div>
        <button
          type="button"
          onClick={onClearFilters}
          className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
        >
          Clear Filters
        </button>
      </div>

      {!selectedStudent ? (
        <div className="px-6 py-8 text-sm text-gray-500">Select a student to load exam history and behaviour analytics.</div>
      ) : (
        <div className="p-6 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
            <input
              type="date"
              value={filters.startDate}
              onChange={(event) => onFilterChange("startDate", event.target.value)}
              className="px-3 py-2 text-xs border border-gray-200 rounded-lg"
            />
            <input
              type="date"
              value={filters.endDate}
              onChange={(event) => onFilterChange("endDate", event.target.value)}
              className="px-3 py-2 text-xs border border-gray-200 rounded-lg"
            />
            <select
              value={filters.subject}
              onChange={(event) => onFilterChange("subject", event.target.value)}
              className="px-3 py-2 text-xs border border-gray-200 rounded-lg bg-white"
            >
              <option value="">All Subjects</option>
              {(filterOptions.subjects || []).map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
            <select
              value={filters.teacherId}
              onChange={(event) => onFilterChange("teacherId", event.target.value)}
              className="px-3 py-2 text-xs border border-gray-200 rounded-lg bg-white"
            >
              <option value="">All Teachers</option>
              {(filterOptions.teachers || []).map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
            <select
              value={filters.assessmentId}
              onChange={(event) => onFilterChange("assessmentId", event.target.value)}
              className="px-3 py-2 text-xs border border-gray-200 rounded-lg bg-white"
            >
              <option value="">All Exams</option>
              {(filterOptions.exams || []).map((item) => (
                <option key={item.id} value={item.id}>{item.title}</option>
              ))}
            </select>
          </div>

          <div className="rounded-xl border border-gray-100 overflow-hidden">
            <div className="max-h-[34vh] overflow-auto divide-y divide-gray-100">
              {loading ? (
                <div className="px-4 py-6 text-sm text-gray-400">Loading student history…</div>
              ) : historyItems.length === 0 ? (
                <div className="px-4 py-6 text-sm text-gray-500">No matching attempts found.</div>
              ) : (
                historyItems.map((item) => (
                  <div key={item.attempt_id} className="px-4 py-3 text-xs sm:text-sm flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-[#1a1a2e] truncate">{item.exam}</p>
                      <p className="text-gray-500 mt-0.5">{item.subject || "—"} · {item.teacher}</p>
                    </div>
                    <div className="text-right text-xs text-gray-500 shrink-0">
                      <p>{formatDateTime(item.date)}</p>
                      <p className="mt-0.5">Score {item.score != null ? `${item.score}%` : "—"} · {item.behaviour_label}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-xl border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <p className="text-sm font-semibold text-[#1a1a2e]">Subject-wise Behaviour</p>
            </div>
            <div className="max-h-[30vh] overflow-auto divide-y divide-gray-100">
              {behaviourLoading ? (
                <div className="px-4 py-6 text-sm text-gray-400">Loading behaviour summary…</div>
              ) : behaviourItems.length === 0 ? (
                <div className="px-4 py-6 text-sm text-gray-500">No behaviour insights available yet.</div>
              ) : (
                behaviourItems.map((item) => (
                  <div key={item.subject} className="px-4 py-3 text-xs sm:text-sm flex items-center justify-between gap-3">
                    <p className="font-semibold text-[#1a1a2e]">{item.subject}</p>
                    <p className="text-gray-500 text-right">
                      Fast {item.Fast_Response} · High {item.High_Revision} · Delib {item.Deliberative} · Diseng {item.Disengaged}
                    </p>
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
