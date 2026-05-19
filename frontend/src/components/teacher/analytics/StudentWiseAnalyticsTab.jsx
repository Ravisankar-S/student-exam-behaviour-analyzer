import { useEffect, useMemo, useRef, useState } from "react"
import { BrainCircuit, ChevronLeft, ChevronRight, Layers3, X } from "lucide-react"
import { getStudentProfileById } from "../../../api/auth"

const PAGE_SIZE = 8

function formatDateTime(value) {
  if (!value) return "-"
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return "-"
  return parsed.toLocaleString()
}

function getAttemptTimestamp(attempt) {
  return new Date(
    attempt.submitted_at
    || attempt.started_at
    || attempt.exam_available_from
    || attempt.exam_created_at
    || 0
  ).getTime()
}

function formatConfidence(confidence) {
  if (confidence == null) return "Unavailable"
  if (confidence <= 1) return `${Math.round(confidence * 100)}%`
  return `${Math.round(confidence)}%`
}

function DetailField({ label, value }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50/70 px-3 py-2">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">{label}</p>
      <p className="text-sm font-semibold text-[#1a1a2e] mt-0.5 break-words">{value || "-"}</p>
    </div>
  )
}

function AnalysisModal({ attempt, onClose }) {
  if (!attempt) return null

  const structuredLabel = attempt.supervised_class || attempt.behavior || "Unavailable"
  const clusterLabel = attempt.unsupervised_cluster != null
    ? `Cluster ${attempt.unsupervised_cluster}`
    : "Unavailable"

  return (
    <div className="fixed inset-0 bg-black/45 z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl rounded-2xl border border-gray-200 bg-white shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h4 className="font-bold text-[#1a1a2e] text-lg">Exam Analysis Details</h4>
            <p className="text-xs text-gray-500 mt-0.5">{attempt.exam_title || "Untitled Exam"} · {attempt.exam_subject || "No Subject"}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700"
          >
            <X size={18} />
          </button>
        </div>
        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4 bg-gradient-to-br from-white via-orange-50/40 to-blue-50/50">
          <div className="rounded-2xl border border-orange-200 bg-orange-50/70 p-4">
            <div className="flex items-center gap-2 mb-2">
              <BrainCircuit size={17} className="text-orange-500" />
              <h5 className="font-bold text-[#1a1a2e]">Structured Analysis</h5>
            </div>
            <p className="text-xs text-gray-500 mb-1">Supervised learning output</p>
            <p className="text-sm font-semibold text-[#1a1a2e]">Label: {structuredLabel}</p>
            <p className="text-sm font-semibold text-[#1a1a2e] mt-1">Confidence: {formatConfidence(attempt.supervised_confidence)}</p>
          </div>

          <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Layers3 size={17} className="text-blue-500" />
              <h5 className="font-bold text-[#1a1a2e]">Cluster Analysis</h5>
            </div>
            <p className="text-xs text-gray-500 mb-1">Unsupervised learning output</p>
            <p className="text-sm font-semibold text-[#1a1a2e]">Cluster: {clusterLabel}</p>
            <p className="text-sm font-semibold text-[#1a1a2e] mt-1">Distance: {attempt.unsupervised_distance != null ? attempt.unsupervised_distance.toFixed(4) : "Unavailable"}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function StudentWiseAnalyticsTab({
  students,
  exams,
  allTeacherAttempts,
  token,
  loading,
  initialStudentId,
  onStudentSelect,
}) {
  const [filters, setFilters] = useState({
    name: "",
    department: "all",
    identifier: "",
  })
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedStudentId, setSelectedStudentId] = useState(initialStudentId || null)
  const [showDetail, setShowDetail] = useState(Boolean(initialStudentId))
  const [profileLoading, setProfileLoading] = useState(false)
  const [studentProfile, setStudentProfile] = useState(null)
  const [profileError, setProfileError] = useState("")
  const [selectedAttempt, setSelectedAttempt] = useState(null)
  const milestoneCanvasRef = useRef(null)

  useEffect(() => {
    if (!initialStudentId) return
    setSelectedStudentId(initialStudentId)
    setShowDetail(true)
    setSelectedAttempt(null)
  }, [initialStudentId])

  useEffect(() => {
    setCurrentPage(1)
  }, [filters.name, filters.department, filters.identifier])

  useEffect(() => {
    if (!showDetail || !selectedStudentId || !token) {
      setStudentProfile(null)
      setProfileError("")
      return
    }

    let cancelled = false

    async function loadStudentProfile() {
      setProfileLoading(true)
      setProfileError("")
      try {
        const res = await getStudentProfileById(token, selectedStudentId)
        if (!cancelled) {
          setStudentProfile(res.data || null)
        }
      } catch (err) {
        if (!cancelled) {
          setStudentProfile(null)
          setProfileError(err?.response?.data?.detail || "Failed to load student profile")
        }
      } finally {
        if (!cancelled) {
          setProfileLoading(false)
        }
      }
    }

    loadStudentProfile()
    return () => {
      cancelled = true
    }
  }, [showDetail, selectedStudentId, token])

  const totalPublishedExams = exams.length

  const attendedExamIdsByStudent = useMemo(() => {
    const map = new Map()
    allTeacherAttempts.forEach((attempt) => {
      if (!attempt.student_id || !attempt.exam_id) return
      if (!map.has(attempt.student_id)) {
        map.set(attempt.student_id, new Set())
      }
      map.get(attempt.student_id).add(attempt.exam_id)
    })
    return map
  }, [allTeacherAttempts])

  const departmentOptions = useMemo(() => {
    const departments = [...new Set(students.map((student) => student.department).filter(Boolean))]
    departments.sort((a, b) => a.localeCompare(b))
    return departments
  }, [students])

  const studentRows = useMemo(() => {
    return students.map((student) => {
      const attendedExams = attendedExamIdsByStudent.get(student.id)?.size || 0
      const missedExams = Math.max(totalPublishedExams - attendedExams, 0)
      return {
        ...student,
        attendedExams,
        missedExams,
      }
    })
  }, [students, attendedExamIdsByStudent, totalPublishedExams])

  const filteredRows = useMemo(() => {
    const nameQuery = filters.name.trim().toLowerCase()
    const identifierQuery = filters.identifier.trim().toLowerCase()

    return studentRows.filter((row) => {
      const nameMatch = !nameQuery || row.name?.toLowerCase().includes(nameQuery)
      const departmentMatch = filters.department === "all" || row.department === filters.department
      const identifiers = [
        row.email,
        row.reg_no,
        row.college_email,
        row.class_roll_no,
        row.division,
        row.semester != null ? String(row.semester) : "",
        row.year_of_joining != null ? String(row.year_of_joining) : "",
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()

      const identifierMatch = !identifierQuery || identifiers.includes(identifierQuery)
      return nameMatch && departmentMatch && identifierMatch
    })
  }, [studentRows, filters])

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE))
  const pageStart = (currentPage - 1) * PAGE_SIZE
  const pageRows = filteredRows.slice(pageStart, pageStart + PAGE_SIZE)

  const selectedStudent = studentRows.find((student) => student.id === selectedStudentId) || null
  const milestoneAttempts = useMemo(() => {
    if (!selectedStudent) return []
    return allTeacherAttempts
      .filter((attempt) => attempt.student_id === selectedStudent.id)
      .sort((a, b) => getAttemptTimestamp(a) - getAttemptTimestamp(b))
  }, [allTeacherAttempts, selectedStudent])

  useEffect(() => {
    if (!showDetail || milestoneAttempts.length === 0 || !milestoneCanvasRef.current) return
    const canvas = milestoneCanvasRef.current
    requestAnimationFrame(() => {
      canvas.scrollTop = canvas.scrollHeight
    })
  }, [showDetail, selectedStudentId, milestoneAttempts.length])

  function openStudentDetail(studentId) {
    setSelectedStudentId(studentId)
    setShowDetail(true)
    setSelectedAttempt(null)
    if (typeof onStudentSelect === "function") {
      onStudentSelect(studentId)
    }
  }

  function resetFilters() {
    setFilters({ name: "", department: "all", identifier: "" })
    setCurrentPage(1)
  }

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-gray-400 text-sm text-center">
        Loading student analytics...
      </div>
    )
  }

  if (!showDetail) {
    return (
      <div className="space-y-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Student Name</label>
              <input
                value={filters.name}
                onChange={(event) => setFilters((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Search by student name"
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#ff4b2b]/20"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Department</label>
              <select
                value={filters.department}
                onChange={(event) => setFilters((prev) => ({ ...prev, department: event.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#ff4b2b]/20"
              >
                <option value="all">All Departments</option>
                {departmentOptions.map((department) => (
                  <option key={department} value={department}>{department}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-gray-500 mb-1">Student Identifier</label>
              <input
                value={filters.identifier}
                onChange={(event) => setFilters((prev) => ({ ...prev, identifier: event.target.value }))}
                placeholder="Email, Reg No, Roll No, Division, Semester"
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#ff4b2b]/20"
              />
            </div>
          </div>
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={resetFilters}
              className="px-3 py-2 rounded-lg text-sm font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50"
            >
              Reset Filters
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h4 className="font-bold text-[#1a1a2e]">Students</h4>
            <p className="text-xs text-gray-500">
              Showing {pageRows.length} of {filteredRows.length}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold">Student Name</th>
                  <th className="text-left px-4 py-3 font-semibold">Department</th>
                  <th className="text-left px-4 py-3 font-semibold">Total Exams Published</th>
                  <th className="text-left px-4 py-3 font-semibold">Total Exams Attended</th>
                  <th className="text-left px-4 py-3 font-semibold">Total Exams Missed</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((row) => (
                  <tr key={row.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => openStudentDetail(row.id)}
                        className="text-left"
                      >
                        <p className="font-semibold text-[#1a1a2e] hover:text-[#ff4b2b]">{row.name}</p>
                        <p className="text-xs text-gray-400">{row.reg_no || row.email}</p>
                      </button>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{row.department || "-"}</td>
                    <td className="px-4 py-3 text-gray-600">{totalPublishedExams}</td>
                    <td className="px-4 py-3 text-gray-600">{row.attendedExams}</td>
                    <td className="px-4 py-3 text-gray-600">{row.missedExams}</td>
                  </tr>
                ))}
                {pageRows.length === 0 && (
                  <tr>
                    <td className="px-4 py-6 text-gray-400" colSpan={5}>No students match these filters.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
            <p className="text-xs text-gray-500">Page {currentPage} of {totalPages}</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                disabled={currentPage === 1}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-600 disabled:opacity-50"
              >
                <ChevronLeft size={14} /> Prev
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                disabled={currentPage === totalPages}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-600 disabled:opacity-50"
              >
                Next <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <div>
          <h4 className="font-bold text-[#1a1a2e] text-lg">Student Detail View</h4>
          <p className="text-sm text-gray-500">Profile details and exam-by-exam analysis milestones.</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setShowDetail(false)
            setSelectedAttempt(null)
          }}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50"
        >
          <ChevronLeft size={15} /> Back to Student List
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
        {profileLoading ? (
          <p className="text-sm text-gray-500">Loading student profile...</p>
        ) : profileError ? (
          <p className="text-sm text-red-500">{profileError}</p>
        ) : (
          <>
            <div>
              <h5 className="font-bold text-[#1a1a2e] text-base">Student Profile</h5>
              <p className="text-sm text-gray-500 mt-0.5">Fetched from the student's own profile records.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <DetailField label="Name" value={studentProfile?.name || selectedStudent?.name} />
              <DetailField label="Email" value={studentProfile?.email || selectedStudent?.email} />
              <DetailField label="Department" value={studentProfile?.student_profile?.department || selectedStudent?.department} />
              <DetailField label="Registration No" value={studentProfile?.student_profile?.reg_no || selectedStudent?.reg_no} />
              <DetailField label="College Email" value={studentProfile?.student_profile?.college_email || selectedStudent?.college_email} />
              <DetailField label="Division" value={studentProfile?.student_profile?.division || selectedStudent?.division} />
              <DetailField label="Class Roll No" value={studentProfile?.student_profile?.class_roll_no || selectedStudent?.class_roll_no} />
              <DetailField label="Semester" value={studentProfile?.student_profile?.semester != null ? String(studentProfile?.student_profile?.semester) : selectedStudent?.semester != null ? String(selectedStudent?.semester) : "-"} />
              <DetailField label="Year of Joining" value={studentProfile?.student_profile?.year_of_joining != null ? String(studentProfile?.student_profile?.year_of_joining) : selectedStudent?.year_of_joining != null ? String(selectedStudent?.year_of_joining) : "-"} />
              <DetailField label="Total Exams Published" value={String(totalPublishedExams)} />
              <DetailField label="Total Exams Attended" value={String(selectedStudent?.attendedExams || 0)} />
              <DetailField label="Total Exams Missed" value={String(selectedStudent?.missedExams || 0)} />
            </div>
          </>
        )}
      </div>

      <div className="space-y-3">
        <div>
          <h5 className="font-bold text-[#1a1a2e] text-base">Exam Analysis Journey</h5>
          <p className="text-sm text-gray-500 mt-0.5">Scrollable milestone canvas with latest entry auto-focused.</p>
        </div>
        {milestoneAttempts.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 text-sm text-gray-500">
            No attempted exams found for this student yet.
          </div>
        ) : (
          <div className="bg-gradient-to-br from-[#fff7ed] via-white to-[#eef2ff] rounded-2xl border border-gray-100 shadow-sm p-5">
            <div ref={milestoneCanvasRef} className="relative h-[440px] overflow-y-auto pr-2">
              <div className="relative space-y-4 pb-4">
                <div className="absolute left-[18px] top-2 bottom-2 w-0.5 bg-gradient-to-b from-orange-300 via-pink-300 to-indigo-300" />
                {milestoneAttempts.map((attempt, index) => (
                  <div key={attempt.id || `${attempt.student_id}-${index}`} className="relative pl-12">
                    <span className="absolute left-[10px] top-6 h-4 w-4 rounded-full border-2 border-white bg-gradient-to-r from-[#ff4b2b] to-[#ff416c] shadow" />
                    <button
                      type="button"
                      onClick={() => setSelectedAttempt(attempt)}
                      className="w-full text-left rounded-2xl border border-gray-200 bg-white/95 p-4 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-bold text-[#1a1a2e]">{attempt.exam_title || `Exam ${index + 1}`}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{formatDateTime(attempt.submitted_at || attempt.started_at)}</p>
                        </div>
                        <span className="shrink-0 px-2.5 py-1 rounded-full bg-[#1a1a2e] text-white text-xs font-semibold">
                          {attempt.score != null ? `${Math.round(attempt.score)}%` : "N/A"}
                        </span>
                      </div>

                      <div className="mt-2 flex flex-wrap gap-2">
                        <span className="inline-flex items-center px-2 py-1 rounded-full bg-gray-100 text-gray-700 text-[11px] font-semibold">
                          {attempt.exam_subject || "No Subject"}
                        </span>
                        <span className="inline-flex items-center px-2 py-1 rounded-full bg-orange-100 text-orange-700 text-[11px] font-semibold">
                          Structured: {attempt.supervised_class || attempt.behavior || "Unavailable"}
                        </span>
                        <span className="inline-flex items-center px-2 py-1 rounded-full bg-blue-100 text-blue-700 text-[11px] font-semibold">
                          Cluster: {attempt.unsupervised_cluster != null ? attempt.unsupervised_cluster : "Unavailable"}
                        </span>
                      </div>
                    </button>

                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {selectedAttempt && (
        <AnalysisModal
          attempt={selectedAttempt}
          onClose={() => setSelectedAttempt(null)}
        />
      )}
    </div>
  )
}
