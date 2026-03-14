import { useEffect, useState } from "react"
import { useAuth } from "../context/AuthContext"
import { useNavigate } from "react-router-dom"
import { Trash2 } from "lucide-react"
import { changePassword, deleteProfilePicture, uploadProfilePicture } from "../api/auth"
import ChangePasswordModal from "../components/ChangePasswordModal"

function toAbsoluteImageUrl(path) {
  if (!path) return null
  if (path.startsWith("http://") || path.startsWith("https://")) return path
  return `http://127.0.0.1:8000${path}`
}

export default function StudentDashboard() {
  const { user, token, logout, setUser } = useAuth()
  const navigate = useNavigate()
  const [changePasswordOpen, setChangePasswordOpen] = useState(false)
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [profilePictureUploading, setProfilePictureUploading] = useState(false)
  const [profilePictureDeleting, setProfilePictureDeleting] = useState(false)
  const [imageModalSrc, setImageModalSrc] = useState(null)
  const [toast, setToast] = useState(null)

  function flash(message, type = "success") {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  async function handlePasswordSave(data) {
    setPasswordLoading(true)
    try {
      await changePassword(token, data)
      setChangePasswordOpen(false)
      flash("Password updated")
    } catch (err) {
      throw err
    } finally {
      setPasswordLoading(false)
    }
  }

  async function handleProfilePictureUpload(event) {
    const file = event.target.files?.[0]
    if (!file) return

    setProfilePictureUploading(true)
    try {
      const res = await uploadProfilePicture(token, file)
      setUser((prev) => ({
        ...(prev || {}),
        profile_picture_path: res.data?.profile_picture_path || prev?.profile_picture_path,
      }))
      flash("Profile picture updated")
    } catch (err) {
      flash(err?.response?.data?.detail || "Failed to upload profile picture", "error")
    } finally {
      event.target.value = ""
      setProfilePictureUploading(false)
    }
  }

  async function handleProfilePictureDelete() {
    setProfilePictureDeleting(true)
    try {
      await deleteProfilePicture(token)
      setUser((prev) => ({ ...(prev || {}), profile_picture_path: null }))
      flash("Profile picture removed")
    } catch (err) {
      flash(err?.response?.data?.detail || "Failed to remove profile picture", "error")
    } finally {
      setProfilePictureDeleting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f4f6fb] px-4 py-10">
      <div className="max-w-4xl mx-auto bg-white rounded-2xl border border-gray-100 shadow-sm p-6 md:p-8">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-extrabold text-[#1a1a2e]">Student Dashboard</h1>
            <p className="text-sm text-gray-500 mt-1">This is a dummy page scaffold for student flow.</p>
          </div>
          <div className="flex items-center gap-2">
            {user?.auth_provider === "local" && (
              <button
                onClick={() => setChangePasswordOpen(true)}
                className="px-4 py-2 rounded-xl border border-gray-200 text-gray-700 text-sm font-semibold hover:bg-gray-50"
              >
                Change Password
              </button>
            )}
            <button
              onClick={() => {
                logout()
                navigate("/")
              }}
              className="px-4 py-2 rounded-xl bg-[#1a1a2e] text-white text-sm font-semibold hover:bg-[#2a2a46]"
            >
              Logout
            </button>
          </div>
        </div>

        <div className="mt-6 rounded-xl border border-dashed border-gray-200 p-5 bg-gray-50">
          <div className="flex items-center gap-4 mb-4">
            <Avatar name={user?.name} imagePath={user?.profile_picture_path} large onClick={setImageModalSrc} />
            <div>
              <p className="font-bold text-[#1a1a2e]">{user?.name || "Student"}</p>
              <p className="text-xs font-semibold text-[#ff4b2b] uppercase tracking-wider">Student</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50">
              {profilePictureUploading ? "Uploading…" : "Upload Profile Picture"}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleProfilePictureUpload}
                disabled={profilePictureUploading}
                className="hidden"
              />
            </label>
            {user?.profile_picture_path && (
              <button
                type="button"
                onClick={handleProfilePictureDelete}
                disabled={profilePictureDeleting}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-red-200 text-red-500 hover:bg-red-50 disabled:opacity-60"
                title={profilePictureDeleting ? "Removing picture" : "Remove picture"}
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
          <p className="text-sm text-gray-600">Logged in as: <span className="font-semibold text-[#1a1a2e]">{user?.name || "Student"}</span></p>
          <p className="text-sm text-gray-600 mt-1">Email: <span className="font-semibold text-[#1a1a2e]">{user?.email || "—"}</span></p>
          <p className="text-sm text-gray-600 mt-1">Role: <span className="font-semibold text-[#1a1a2e]">{user?.role || "student"}</span></p>
        </div>
      </div>

      <ChangePasswordModal
        open={changePasswordOpen}
        onClose={() => setChangePasswordOpen(false)}
        onSubmit={handlePasswordSave}
        loading={passwordLoading}
      />

      {imageModalSrc && <ImagePreviewModal src={imageModalSrc} onClose={() => setImageModalSrc(null)} />}

      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl shadow-lg font-semibold text-sm text-white ${toast.type === "error" ? "bg-red-500" : "bg-[#1a1a2e]"}`}>
          {toast.message}
        </div>
      )}
    </div>
  )
}

function Avatar({ name, imagePath, large = false, onClick }) {
  const [imageFailed, setImageFailed] = useState(false)
  const cls = large ? "w-16 h-16 text-2xl" : "w-9 h-9 text-sm"
  const src = toAbsoluteImageUrl(imagePath)

  useEffect(() => {
    setImageFailed(false)
  }, [imagePath])

  if (src && !imageFailed) {
    return (
      <img
        src={src}
        alt={name || "Profile"}
        onClick={() => onClick && onClick(src)}
        onError={() => setImageFailed(true)}
        className={`${cls} rounded-full object-cover shrink-0 ${onClick ? "cursor-zoom-in" : ""}`}
      />
    )
  }

  return (
    <div className={`${cls} rounded-full bg-gradient-to-br from-[#ff4b2b] to-[#ff416c] flex items-center justify-center text-white font-bold shrink-0`}>
      {name?.[0]?.toUpperCase() ?? "S"}
    </div>
  )
}

function ImagePreviewModal({ src, onClose }) {
  return (
    <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div className="relative max-w-4xl w-full flex items-center justify-center" onClick={(event) => event.stopPropagation()}>
        <button
          onClick={onClose}
          className="absolute -top-10 right-0 text-white/90 hover:text-white text-sm font-semibold"
        >
          Close
        </button>
        <img src={src} alt="Preview" className="max-h-[85vh] w-auto max-w-full rounded-2xl border border-white/20" />
      </div>
    </div>
  )
}
