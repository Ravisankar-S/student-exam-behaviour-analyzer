import { useEffect, useState } from "react"
import { Eye, EyeOff, X } from "lucide-react"

export default function ChangePasswordModal({ open, onClose, onSubmit, loading }) {
  const [form, setForm] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  })
  const [errors, setErrors] = useState({})
  const [apiError, setApiError] = useState("")
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  useEffect(() => {
    if (!open) return
    setForm({ current_password: "", new_password: "", confirm_password: "" })
    setErrors({})
    setApiError("")
    setShowCurrent(false)
    setShowNew(false)
    setShowConfirm(false)
  }, [open])

  if (!open) return null

  function validate() {
    const nextErrors = {}

    if (!form.current_password) nextErrors.current_password = "Current password is required."
    if (!form.new_password) nextErrors.new_password = "New password is required."
    if (form.new_password && form.new_password.length < 8) nextErrors.new_password = "Use at least 8 characters."
    if (form.new_password && form.new_password.length > 128) nextErrors.new_password = "Password is too long."
    if (form.current_password && form.new_password && form.current_password === form.new_password) {
      nextErrors.new_password = "New password must be different from current password."
    }
    if (!form.confirm_password) nextErrors.confirm_password = "Please confirm your new password."
    if (form.new_password && form.confirm_password && form.new_password !== form.confirm_password) {
      nextErrors.confirm_password = "Passwords do not match."
    }

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setApiError("")
    if (!validate()) return

    try {
      await onSubmit({
        current_password: form.current_password,
        new_password: form.new_password,
      })
    } catch (error) {
      setApiError(error?.response?.data?.detail || "Unable to change password right now.")
    }
  }

  return (
    <div className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-md bg-white rounded-2xl border border-gray-100 shadow-xl" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label="Change password">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h3 className="font-bold text-[#1a1a2e]">Change Password</h3>
            <p className="text-xs text-gray-500 mt-0.5">Use a strong password you don’t reuse elsewhere.</p>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100" aria-label="Close change password modal">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <PasswordField
            id="current-password"
            label="Current Password"
            value={form.current_password}
            visible={showCurrent}
            onVisibilityToggle={() => setShowCurrent((state) => !state)}
            onChange={(value) => setForm((state) => ({ ...state, current_password: value }))}
            error={errors.current_password}
            autoComplete="current-password"
          />

          <PasswordField
            id="new-password"
            label="New Password"
            value={form.new_password}
            visible={showNew}
            onVisibilityToggle={() => setShowNew((state) => !state)}
            onChange={(value) => setForm((state) => ({ ...state, new_password: value }))}
            error={errors.new_password}
            autoComplete="new-password"
          />

          <PasswordField
            id="confirm-password"
            label="Confirm New Password"
            value={form.confirm_password}
            visible={showConfirm}
            onVisibilityToggle={() => setShowConfirm((state) => !state)}
            onChange={(value) => setForm((state) => ({ ...state, confirm_password: value }))}
            error={errors.confirm_password}
            autoComplete="new-password"
          />

          {apiError && (
            <div className="text-sm font-semibold text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
              {apiError}
            </div>
          )}

          <div className="flex items-center gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-gray-200 text-gray-600 text-sm font-semibold rounded-xl hover:bg-gray-50 transition">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="flex-1 py-2.5 bg-[#1a1a2e] text-white text-sm font-semibold rounded-xl hover:bg-[#252542] transition disabled:opacity-60">
              {loading ? "Updating…" : "Update Password"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function PasswordField({ id, label, value, visible, onVisibilityToggle, onChange, error, autoComplete }) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          maxLength={128}
          className={`w-full px-4 py-2.5 pr-11 border rounded-xl text-sm text-[#1a1a2e] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#ff4b2b]/30 transition ${error ? "border-red-300 bg-red-50" : "border-gray-200 focus:border-[#ff4b2b]"}`}
        />
        <button type="button" onClick={onVisibilityToggle} className="absolute inset-y-0 right-0 px-3 text-gray-400 hover:text-gray-600" aria-label={visible ? "Hide password" : "Show password"}>
          {visible ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
      {error && <p className="mt-1 text-xs font-semibold text-red-500">{error}</p>}
    </div>
  )
}
