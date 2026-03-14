import axios from "axios"

const API = axios.create({
  baseURL: "http://127.0.0.1:8000",
})


export const signup = (data) =>
  API.post("/auth/signup", data)

export const login = (data) =>
  API.post("/auth/login", data)

export const getMe = (token) =>
  API.get("/auth/me", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

export const changePassword = (token, data) =>
  API.patch("/auth/password", data, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

export const getStudents = (token, q = "") =>
  API.get(`/auth/students${q ? `?q=${encodeURIComponent(q)}` : ""}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

export const getTeacherProfile = (token) =>
  API.get("/auth/teacher-profile", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

export const updateTeacherProfile = (token, data) =>
  API.patch("/auth/teacher-profile", data, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

export const uploadProfilePicture = (token, file) => {
  const formData = new FormData()
  formData.append("file", file)
  return API.post("/auth/profile-picture", formData, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "multipart/form-data",
    },
  })
}

export const deleteProfilePicture = (token) =>
  API.delete("/auth/profile-picture", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

export const getAdmissionRequests = (token, status = "pending") =>
  API.get(`/auth/admission-requests?status=${encodeURIComponent(status)}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

export const approveAdmissionRequest = (token, studentUserId) =>
  API.post(`/auth/admission-requests/${studentUserId}/approve`, null, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

export const rejectAdmissionRequest = (token, studentUserId) =>
  API.post(`/auth/admission-requests/${studentUserId}/reject`, null, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })