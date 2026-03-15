import axios from "axios"

const API = axios.create({ baseURL: "http://127.0.0.1:8000" })

const authHeader = (token) => ({ headers: { Authorization: `Bearer ${token}` } })

const withQuery = (basePath, params = {}) => {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") search.set(key, String(value))
  })
  const qs = search.toString()
  return qs ? `${basePath}?${qs}` : basePath
}

export const getAdminOverview = (token) =>
  API.get("/admin/analytics/overview", authHeader(token))

export const getAdminStudentsDirectory = (token, params = {}) =>
  API.get(withQuery("/admin/analytics/students-directory", params), authHeader(token))

export const getAdminTeachersDirectory = (token, params = {}) =>
  API.get(withQuery("/admin/analytics/teachers-directory", params), authHeader(token))

export const getAdminFailureRates = (token, params = {}) =>
  API.get(withQuery("/admin/analytics/failure-rate", params), authHeader(token))

export const getAdminStudentHistory = (token, studentId, params = {}) =>
  API.get(withQuery(`/admin/analytics/students/${studentId}/history`, params), authHeader(token))

export const getAdminStudentSubjectBehaviour = (token, studentId) =>
  API.get(`/admin/analytics/students/${studentId}/subject-behaviour`, authHeader(token))

export const getAdminTeacherExamAnalytics = (token, teacherId, params = {}) =>
  API.get(withQuery(`/admin/analytics/teachers/${teacherId}/exams`, params), authHeader(token))
