import { useMemo, useState } from "react"
import {
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

const PIE_COLORS = ["#2563eb", "#0ea5e9", "#14b8a6", "#f59e0b", "#ef4444", "#7c3aed", "#db2777"]
const CLUSTER_COLORS = ["#1d4ed8", "#0f766e", "#be123c", "#7c2d12", "#4338ca", "#15803d", "#9f1239"]

function formatClusterName(clusterValue) {
  if (clusterValue === null || clusterValue === undefined) return "No Cluster"
  return `Cluster ${clusterValue}`
}

function normalizeClassLabel(value) {
  if (value === null || value === undefined || value === "") return "Unclassified"
  return String(value)
}

function StudentListPanel({ title, students, onStudentNavigate }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100">
        <h4 className="font-bold text-[#1a1a2e] text-sm">{title}</h4>
      </div>
      <div className="max-h-72 overflow-y-auto divide-y divide-gray-100">
        {students.length === 0 ? (
          <div className="px-4 py-6 text-sm text-gray-500">No students found for this selection.</div>
        ) : (
          students.map((student) => (
            <div key={`${student.student_id}-${student.attempt_id}`} className="px-4 py-3 flex items-center justify-between gap-3 text-sm">
              <div className="min-w-0">
                <button
                  type="button"
                  onClick={() => onStudentNavigate(student.student_id)}
                  className="font-semibold text-blue-700 hover:underline text-left"
                >
                  {student.student_name || "Unknown Student"}
                </button>
                <p className="text-xs text-gray-500 truncate">{student.student_email || "No email"}</p>
              </div>
              <p className="text-xs font-semibold text-gray-500">Score {student.score ?? "-"}%</p>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default function ExamWiseAnalyticsTab({
  exams,
  examAttemptsMap,
  loading,
  onStudentNavigate,
}) {
  const [query, setQuery] = useState("")
  const [subjectFilter, setSubjectFilter] = useState("all")
  const [selectedExamId, setSelectedExamId] = useState(null)
  const [selectedClassLabel, setSelectedClassLabel] = useState(null)
  const [selectedClusterValue, setSelectedClusterValue] = useState(null)

  const subjectOptions = useMemo(
    () => [...new Set((exams || []).map((item) => item.subject).filter(Boolean))].sort(),
    [exams]
  )

  const filteredExams = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return (exams || []).filter((exam) => {
      const byQuery = !normalized
        || exam.title.toLowerCase().includes(normalized)
        || exam.subject.toLowerCase().includes(normalized)
      const bySubject = subjectFilter === "all" || exam.subject === subjectFilter
      return byQuery && bySubject
    })
  }, [exams, query, subjectFilter])

  const selectedExam = useMemo(
    () => (exams || []).find((exam) => exam.id === selectedExamId) || null,
    [exams, selectedExamId]
  )

  const selectedExamAttempts = useMemo(
    () => (selectedExam ? (examAttemptsMap[selectedExam.id] || []) : []),
    [examAttemptsMap, selectedExam]
  )

  const classDistribution = useMemo(() => {
    const grouped = new Map()
    selectedExamAttempts.forEach((attempt) => {
      const classLabel = normalizeClassLabel(attempt.supervised_class)
      const current = grouped.get(classLabel) || { classLabel, count: 0, students: [] }
      current.count += 1
      current.students.push(attempt)
      grouped.set(classLabel, current)
    })
    return Array.from(grouped.values()).sort((a, b) => b.count - a.count)
  }, [selectedExamAttempts])

  const clusterDistribution = useMemo(() => {
    const grouped = new Map()
    selectedExamAttempts.forEach((attempt) => {
      const clusterValue = attempt.unsupervised_cluster ?? null
      const key = clusterValue === null ? "no-cluster" : String(clusterValue)
      const current = grouped.get(key) || {
        key,
        clusterValue,
        clusterLabel: formatClusterName(clusterValue),
        count: 0,
        students: [],
        scatterData: [],
      }
      current.count += 1
      current.students.push(attempt)
      current.scatterData.push({
        x: Number(attempt.avg_time_sec || 0),
        y: Number(attempt.score || 0),
        student_id: attempt.student_id,
        student_name: attempt.student_name,
      })
      grouped.set(key, current)
    })
    return Array.from(grouped.values()).sort((a, b) => b.count - a.count)
  }, [selectedExamAttempts])

  const classPanelData = useMemo(
    () => classDistribution.find((item) => item.classLabel === selectedClassLabel) || null,
    [classDistribution, selectedClassLabel]
  )

  const clusterPanelData = useMemo(
    () => clusterDistribution.find((item) => item.clusterValue === selectedClusterValue) || null,
    [clusterDistribution, selectedClusterValue]
  )

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-sm text-gray-500 text-center">
        Loading analysis data...
      </div>
    )
  }

  if (!selectedExam) {
    return (
      <div className="space-y-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 lg:p-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by exam name or subject"
              className="md:col-span-2 w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm"
            />
            <select
              value={subjectFilter}
              onChange={(event) => setSubjectFilter(event.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white"
            >
              <option value="all">All Subjects</option>
              {subjectOptions.map((subject) => (
                <option key={subject} value={subject}>{subject}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredExams.map((exam) => (
            <button
              key={exam.id}
              type="button"
              onClick={() => {
                setSelectedExamId(exam.id)
                setSelectedClassLabel(null)
                setSelectedClusterValue(null)
              }}
              className="text-left bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition"
            >
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Exam</p>
              <h3 className="text-lg font-bold text-[#1a1a2e] mt-1 line-clamp-2">{exam.title}</h3>
              <p className="text-sm text-gray-600 mt-1">{exam.subject}</p>
              <p className="text-xs text-gray-500 mt-3">{exam.attempt_count || 0} attempts</p>
            </button>
          ))}
        </div>

        {filteredExams.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-sm text-gray-500">
            No exams match your filters.
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-xl font-extrabold text-[#1a1a2e]">{selectedExam.title}</h3>
          <p className="text-sm text-gray-500">{selectedExam.subject} · {selectedExamAttempts.length} attempts</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setSelectedExamId(null)
            setSelectedClassLabel(null)
            setSelectedClusterValue(null)
          }}
          className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-50"
        >
          Back to Exams
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 lg:p-5">
          <h4 className="font-bold text-[#1a1a2e] text-sm mb-4">Class Distribution (Supervised Model)</h4>
          {classDistribution.length === 0 ? (
            <p className="text-sm text-gray-500">No supervised class data available for this exam.</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={classDistribution}
                  dataKey="count"
                  nameKey="classLabel"
                  outerRadius={96}
                  onClick={(entry) => setSelectedClassLabel(entry?.classLabel || null)}
                >
                  {classDistribution.map((entry, index) => (
                    <Cell key={entry.classLabel} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value, _name, payload) => [value, payload?.payload?.classLabel || "Class"]} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 lg:p-5">
          <h4 className="font-bold text-[#1a1a2e] text-sm mb-4">Cluster Analysis (K-Means)</h4>
          {clusterDistribution.length === 0 ? (
            <p className="text-sm text-gray-500">No cluster data available for this exam.</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={300}>
                <ScatterChart>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis type="number" dataKey="x" name="Average Time" unit="s" />
                  <YAxis type="number" dataKey="y" name="Score" unit="%" domain={[0, 100]} />
                  <Tooltip cursor={{ strokeDasharray: "3 3" }} />
                  <Legend />
                  {clusterDistribution.map((cluster, index) => (
                    <Scatter
                      key={cluster.key}
                      name={cluster.clusterLabel}
                      data={cluster.scatterData}
                      fill={CLUSTER_COLORS[index % CLUSTER_COLORS.length]}
                    />
                  ))}
                </ScatterChart>
              </ResponsiveContainer>
              <div className="mt-3 flex flex-wrap gap-2">
                {clusterDistribution.map((cluster) => (
                  <button
                    key={cluster.key}
                    type="button"
                    onClick={() => setSelectedClusterValue(cluster.clusterValue)}
                    className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${selectedClusterValue === cluster.clusterValue ? "bg-[#1a1a2e] text-white border-[#1a1a2e]" : "bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100"}`}
                  >
                    {cluster.clusterLabel}: {cluster.count}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <StudentListPanel
          title={classPanelData ? `${classPanelData.classLabel} Students` : "Select a class slice to view students"}
          students={classPanelData?.students || []}
          onStudentNavigate={onStudentNavigate}
        />

        <StudentListPanel
          title={clusterPanelData ? `${clusterPanelData.clusterLabel} Students` : "Select a cluster to view students"}
          students={clusterPanelData?.students || []}
          onStudentNavigate={onStudentNavigate}
        />
      </div>
    </div>
  )
}
