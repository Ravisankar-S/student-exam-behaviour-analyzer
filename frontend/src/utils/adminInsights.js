const severityRank = {
  critical: 0,
  warning: 1,
  info: 2,
}

const periodStart = {
  week: 7,
  month: 30,
}

function toTime(value) {
  if (!value) return null
  const parsed = new Date(value).getTime()
  return Number.isNaN(parsed) ? null : parsed
}

function isWithinPeriod(value, period, now) {
  if (!period || period === "all") return true
  const days = periodStart[period]
  if (!days) return true
  const time = toTime(value)
  if (time == null) return false
  return time >= now - days * 24 * 60 * 60 * 1000
}

function mean(values) {
  if (!values.length) return null
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function stdDev(values, avg) {
  if (!values.length || avg == null) return null
  const variance = values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / values.length
  return Math.sqrt(variance)
}

function percent(value) {
  return `${Number(value).toFixed(1)}%`
}

function teacherName(teacher) {
  return teacher?.name || teacher?.teacher?.name || "Unknown teacher"
}

function studentName(student) {
  return student?.name || student?.student?.name || "Unknown student"
}

export function sortAdminInsights(insights) {
  return [...(insights || [])].sort((a, b) => {
    const severityDiff = (severityRank[a.severity] ?? 9) - (severityRank[b.severity] ?? 9)
    if (severityDiff !== 0) return severityDiff
    return String(a.title || "").localeCompare(String(b.title || ""))
  })
}

export function computeAdminInsights(data = {}) {
  const now = data.now instanceof Date ? data.now.getTime() : toTime(data.now) || Date.now()
  const period = data.period || "all"
  const teachers = Array.isArray(data.teachers) ? data.teachers : []
  const students = Array.isArray(data.students) ? data.students : []
  const teacherDetails = data.teacherDetails || {}
  const studentHistories = data.studentHistories || {}
  const insights = []

  const teacherSummaries = teachers.map((teacher) => {
    const id = teacher.teacher_id || teacher.id
    const detail = id ? teacherDetails[id] : null
    const rawExams = Array.isArray(detail?.items) ? detail.items : []
    const exams = rawExams.filter((exam) => isWithinPeriod(exam.created_at || exam.date, period, now))
    const fallbackExamCount = Number(teacher.exams_created)
    const examCount = rawExams.length ? exams.length : (Number.isFinite(fallbackExamCount) ? fallbackExamCount : 0)
    const scores = exams
      .map((exam) => Number(exam.avg_score))
      .filter((score) => Number.isFinite(score))
    return {
      id,
      name: teacherName(teacher),
      examCount,
      avgScore: mean(scores),
      scoredExamCount: scores.length,
    }
  })

  const periodExamIds = new Set()
  Object.values(teacherDetails).forEach((detail) => {
    const exams = Array.isArray(detail?.items) ? detail.items : []
    exams.forEach((exam) => {
      if (isWithinPeriod(exam.created_at || exam.date, period, now)) {
        periodExamIds.add(exam.exam_id || exam.id || exam.exam)
      }
    })
  })
  const periodExamCount = periodExamIds.size || null

  const examCounts = teacherSummaries.map((teacher) => teacher.examCount).filter((count) => Number.isFinite(count))
  const avgExamCount = mean(examCounts)
  const examStdDev = stdDev(examCounts, avgExamCount)
  if (avgExamCount != null && examStdDev != null && examStdDev > 0) {
    const threshold = avgExamCount - 1.5 * examStdDev
    teacherSummaries.forEach((teacher) => {
      if (teacher.examCount < threshold) {
        insights.push({
          id: `teacher-low-participation-${teacher.id || teacher.name}`,
          severity: "warning",
          category: "participation",
          title: `${teacher.name} has created significantly fewer exams than peers`,
          detail: `Created ${teacher.examCount} exams against a peer average of ${avgExamCount.toFixed(1)}.`,
          affectedEntities: [teacher.name],
          metric: `${teacher.examCount} exams`,
        })
      }
    })
  }

  const teacherScoreAverages = teacherSummaries
    .filter((teacher) => teacher.avgScore != null)
    .map((teacher) => teacher.avgScore)
  const globalScoreAverage = mean(teacherScoreAverages)
  if (globalScoreAverage != null) {
    teacherSummaries.forEach((teacher) => {
      if (teacher.avgScore != null && teacher.scoredExamCount >= 3 && teacher.avgScore < globalScoreAverage - 15) {
        insights.push({
          id: `teacher-hard-exams-${teacher.id || teacher.name}`,
          severity: "warning",
          category: "difficulty",
          title: `${teacher.name}'s exams show consistently lower student performance`,
          detail: `${teacher.name}'s average is ${percent(teacher.avgScore)} vs the platform average of ${percent(globalScoreAverage)} across ${teacher.scoredExamCount} exams.`,
          affectedEntities: [teacher.name],
          metric: percent(teacher.avgScore),
        })
      }
    })
  }

  students.forEach((student) => {
    const id = student.student_id || student.id
    const history = Array.isArray(studentHistories[id]?.items) ? studentHistories[id].items : []
    const sortedHistory = [...history]
      .filter((attempt) => toTime(attempt.date) != null)
      .sort((a, b) => toTime(b.date) - toTime(a.date))
    const totalAttempts = sortedHistory.length || Number(student.exams_taken || 0)

    if (totalAttempts >= 2 && sortedHistory.length) {
      const lastAttemptTime = toTime(sortedHistory[0].date)
      const daysSilent = (now - lastAttemptTime) / (24 * 60 * 60 * 1000)
      if (daysSilent > 7) {
        insights.push({
          id: `student-disengagement-${id || studentName(student)}`,
          severity: daysSilent > 14 ? "critical" : "warning",
          category: "engagement",
          title: `${studentName(student)} has not participated in recent exams`,
          detail: `Last recorded attempt was ${Math.floor(daysSilent)} days ago after ${totalAttempts} prior attempts.`,
          affectedEntities: [studentName(student)],
          metric: `${Math.floor(daysSilent)} days silent`,
        })
      }
    }

    const availableExams = Number(periodExamCount ?? data.totalExams ?? data.overview?.total_exams)
    const periodAttempts = sortedHistory.filter((attempt) => isWithinPeriod(attempt.date, period, now)).length
    const taken = sortedHistory.length ? periodAttempts : Number(student.exams_taken)
    if (Number.isFinite(availableExams) && availableExams > 0 && Number.isFinite(taken)) {
      const participationRate = taken / availableExams
      if (participationRate < 0.4) {
        insights.push({
          id: `student-low-participation-${id || studentName(student)}`,
          severity: "info",
          category: "participation",
          title: `${studentName(student)} is participating in fewer than 40% of available exams`,
          detail: `Completed ${taken} of ${availableExams} available exams in the current period.`,
          affectedEntities: [studentName(student)],
          metric: percent(participationRate * 100),
        })
      }
    }
  })

  return sortAdminInsights(insights)
}
