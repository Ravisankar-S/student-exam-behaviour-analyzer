import axios from "axios"

const API = axios.create({ baseURL: "http://127.0.0.1:8000" })

const authHeader = (token) => ({ headers: { Authorization: `Bearer ${token}` } })

// ── Assessments ──────────────────────────────
export const getMyAssessments = (token) =>
  API.get("/assessments/mine", authHeader(token))

export const createAssessment = (token, data) =>
  API.post("/assessments/", data, authHeader(token))

export const updateAssessment = (token, id, data) =>
  API.patch(`/assessments/${id}`, data, authHeader(token))

export const deleteAssessment = (token, id) =>
  API.delete(`/assessments/${id}`, authHeader(token))

export const getAssessment = (token, id) =>
  API.get(`/assessments/${id}`, authHeader(token))

export const reorderAssessments = (token, ids) =>
  API.patch("/assessments/reorder", { ids }, authHeader(token))

export const getAssessmentAttempts = (token, id) =>
  API.get(`/assessments/${id}/attempts`, authHeader(token))

export const getTeacherActivityLogs = (token, limit = 100) =>
  API.get(`/assessments/activity-logs?limit=${limit}`, authHeader(token))

export const createTeacherActivityLog = (token, data) =>
  API.post("/assessments/activity-logs", data, authHeader(token))

export const getPublishedAssessments = (token, params = {}) => {
  const searchParams = new URLSearchParams()
  if (params.q) searchParams.set("q", params.q)
  if (params.subject) searchParams.set("subject", params.subject)
  const qs = searchParams.toString()
  return API.get(`/assessments/published${qs ? `?${qs}` : ""}`, authHeader(token))
}

export const getPublicAssessmentQuestions = (token, assessmentId) =>
  API.get(`/assessments/${assessmentId}/public-questions`, authHeader(token))

export const submitStudentAttempt = (token, assessmentId, data) =>
  API.post(`/assessments/${assessmentId}/submit-attempt`, data, authHeader(token))

// ── Questions ────────────────────────────────
export const getQuestions = (token, assessmentId) =>
  API.get(`/assessments/${assessmentId}/questions`, authHeader(token))

export const createQuestion = (token, assessmentId, data) =>
  API.post(`/assessments/${assessmentId}/questions`, data, authHeader(token))

export const updateQuestion = (token, assessmentId, questionId, data) =>
  API.patch(`/assessments/${assessmentId}/questions/${questionId}`, data, authHeader(token))

export const deleteQuestion = (token, assessmentId, questionId) =>
  API.delete(`/assessments/${assessmentId}/questions/${questionId}`, authHeader(token))

export const reorderQuestions = (token, assessmentId, ids) =>
  API.patch(`/assessments/${assessmentId}/questions/reorder`, { ids }, authHeader(token))

export const uploadQuestionImage = (token, assessmentId, file) => {
  const formData = new FormData()
  formData.append("file", file)
  return API.post(`/assessments/${assessmentId}/questions/upload-image`, formData, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "multipart/form-data",
    },
  })
}

// ── Profile ──────────────────────────────────
export const updateProfile = (token, data) =>
  API.patch("/auth/profile", data, authHeader(token))
