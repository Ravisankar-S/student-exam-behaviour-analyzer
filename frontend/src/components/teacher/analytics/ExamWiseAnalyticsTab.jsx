import { useMemo, useState } from "react"
import SankeyBridgeChart from "./SankeyBridgeChart"

const CLUSTER_COLORS = ["#1d4ed8", "#0f766e", "#be123c", "#7c2d12", "#4338ca", "#15803d", "#9f1239"]
const CLASS_COLORS = ["#2563eb", "#0ea5e9", "#14b8a6", "#f59e0b", "#ef4444", "#7c3aed", "#db2777"]

function formatClusterName(clusterValue) {
  if (clusterValue === null || clusterValue === undefined) return "No Cluster"
  return `Cluster ${clusterValue}`
}

function normalizeClassLabel(value) {
  if (value === null || value === undefined || value === "") return "Unclassified"
  return String(value)
}

export default function ExamWiseAnalyticsTab({
  exams,
  examAttemptsMap,
  loading,
}) {
  const [query, setQuery] = useState("")
  const [subjectFilter, setSubjectFilter] = useState("all")
  const [selectedExamId, setSelectedExamId] = useState(null)
  const [chartViewMode, setChartViewMode] = useState("combined")

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
                setChartViewMode("combined")
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
            setChartViewMode("combined")
          }}
          className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-50"
        >
          Back to Exams
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 lg:p-5">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
          <h4 className="font-bold text-[#1a1a2e] text-sm">Model Bridge Analysis</h4>
          <div className="inline-flex bg-gray-50 border border-gray-200 rounded-xl p-1">
            {[
              { key: "combined", label: "Combined View" },
              { key: "supervised", label: "Supervised Only" },
              { key: "clusters", label: "Clusters Only" },
            ].map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setChartViewMode(item.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${chartViewMode === item.key ? "bg-[#1a1a2e] text-white" : "text-gray-600 hover:bg-white"}`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <SankeyBridgeChart attempts={selectedExamAttempts} viewMode={chartViewMode} />

        <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Supervised classes</p>
            <div className="flex flex-wrap gap-2">
              {classDistribution.length === 0 ? (
                <p className="text-sm text-gray-500">No supervised class data available.</p>
              ) : classDistribution.map((item, index) => (
                <div
                  key={item.classLabel}
                  className="px-2.5 py-1 rounded-full text-xs font-semibold border bg-gray-50 text-gray-700 border-gray-200"
                >
                  <span className="inline-block h-2 w-2 rounded-full mr-1.5" style={{ backgroundColor: CLASS_COLORS[index % CLASS_COLORS.length] }} />
                  {item.classLabel}: {item.count}
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">KMeans clusters</p>
            <div className="flex flex-wrap gap-2">
              {clusterDistribution.length === 0 ? (
                <p className="text-sm text-gray-500">No cluster data available.</p>
              ) : clusterDistribution.map((cluster, index) => (
                <div
                  key={cluster.key}
                  className="px-2.5 py-1 rounded-full text-xs font-semibold border bg-gray-50 text-gray-700 border-gray-200"
                >
                  <span className="inline-block h-2 w-2 rounded-full mr-1.5" style={{ backgroundColor: CLUSTER_COLORS[index % CLUSTER_COLORS.length] }} />
                  {cluster.clusterLabel}: {cluster.count}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
