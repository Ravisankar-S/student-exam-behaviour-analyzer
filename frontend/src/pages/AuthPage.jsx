import { useState, useEffect } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import Cubes from "../components/Cubes"
import "../styles/auth.css"
import { signup, login, getMe } from "../api/auth"
import { useAuth } from "../context/AuthContext"

/* ── Password strength scorer (OWASP-aligned) ─────────────────────────
   Returns { score: 0-4, label, color }
   0 = too short  1 = weak  2 = fair  3 = strong  4 = very strong       */
function scorePassword(pw) {
  if (!pw || pw.length < 8) return { score: 0, label: "Too short", color: "#e53e3e" }
  let score = 0
  if (pw.length >= 12)           score++
  if (/[A-Z]/.test(pw))          score++
  if (/[0-9]/.test(pw))          score++
  if (/[^A-Za-z0-9]/.test(pw))  score++
  const labels = ["Weak", "Fair", "Good", "Strong"]
  const colors = ["#e53e3e", "#dd6b20", "#d69e2e", "#38a169"]
  return { score, label: labels[score - 1] ?? "Weak", color: colors[score - 1] ?? colors[0] }
}

/* ── Eye icon ──────────────────────────────────────────────────────── */
function EyeIcon({ visible }) {
  return visible ? (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  ) : (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  )
}

/* ── Password input with visibility toggle ─────────────────────────── */
function PasswordInput({ id, name, placeholder, value, onChange, autoComplete, error }) {
  const [visible, setVisible] = useState(false)
  return (
    <div className={`input-wrapper${error ? " input-error" : ""}`}>
      <input
        id={id}
        name={name}
        type={visible ? "text" : "password"}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        autoComplete={autoComplete}
        required
        minLength={8}
        maxLength={128}
        spellCheck={false}
        aria-describedby={error ? `${id}-err` : undefined}
      />
      <button
        type="button"
        className="eye-btn"
        onClick={() => setVisible(v => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
        tabIndex={-1}
      >
        <EyeIcon visible={visible} />
      </button>
      {error && <span className="field-error" id={`${id}-err`} role="alert">{error}</span>}
    </div>
  )
}

export default function AuthPage() {
  const location = useLocation()
  const role = location.state?.role ?? "student"
  const [isSignup, setIsSignup] = useState(false)

  /* ── Responsive cube grid size ── */
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 600)
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth <= 600)
    window.addEventListener("resize", handler)
    return () => window.removeEventListener("resize", handler)
  }, [])

  /* ── Sign-in state ── */
  const [siEmail, setSiEmail]     = useState("")
  const [siPassword, setSiPassword] = useState("")
  const [siErrors, setSiErrors]   = useState({})

  /* ── Sign-up state ── */
  const [suName, setSuName]           = useState("")
  const [suEmail, setSuEmail]         = useState("")
  const [suPassword, setSuPassword]   = useState("")
  const [suConfirm, setSuConfirm]     = useState("")
  const [suTerms, setSuTerms]         = useState(false)
  const [suErrors, setSuErrors]       = useState({})
  const [siApiError, setSiApiError]   = useState("")
  const [suApiError, setSuApiError]   = useState("")
  const [siLoading, setSiLoading]     = useState(false)
  const [suLoading, setSuLoading]     = useState(false)

  const { setToken } = useAuth()
  const navigate = useNavigate()
  const pwStrength = scorePassword(suPassword)

  /* ── Sign-in validation + API call ─────────────────────────────── */
  async function handleSignIn(e) {
    e.preventDefault()
    setSiApiError("")
    const errs = {}
    if (!siEmail)    errs.email    = "Email is required."
    if (!siPassword) errs.password = "Password is required."
    setSiErrors(errs)
    if (Object.keys(errs).length) return

    setSiLoading(true)
    try {
      const res = await login({ email: siEmail, password: siPassword })
      const token = res.data.access_token
      localStorage.setItem("token", token)
      setToken(token)             // updates AuthContext globally
      const meRes = await getMe(token)
      const userRole = meRes.data.role
      navigate(`/dashboard/${userRole}`)
    } catch (err) {
      setSiApiError(
        err.response?.data?.detail || "Invalid credentials. Please try again."
      )
    } finally {
      setSiLoading(false)
    }
  }

  /* ── Sign-up validation (OWASP A07 — input validation) ─────────── */
  async function handleSignUp(e) {
    e.preventDefault()
    const errs = {}
    const nameTrimmed = suName.trim()

    if (!nameTrimmed || nameTrimmed.length < 2)
      errs.name = "Full name must be at least 2 characters."
    if (nameTrimmed.length > 100)
      errs.name = "Name must not exceed 100 characters."

    if (!suEmail)
      errs.email = "Email is required."

    if (suPassword.length < 8)
      errs.password = "Password must be at least 8 characters."
    if (!/[A-Z]/.test(suPassword))
      errs.password = "Password must contain at least one uppercase letter."
    if (!/[0-9]/.test(suPassword))
      errs.password = "Password must contain at least one digit."
    if (!/[^A-Za-z0-9]/.test(suPassword))
      errs.password = "Password must contain at least one special character."

    if (suPassword !== suConfirm)
      errs.confirm = "Passwords do not match."

    if (!suTerms)
      errs.terms = "You must agree to the Terms of Service."

    setSuErrors(errs)
    if (Object.keys(errs).length) return

    setSuLoading(true)
    setSuApiError("")
    try {
      await signup({
        name: nameTrimmed,
        email: suEmail,
        password: suPassword,
        role,
      })
      // clear form and switch to sign-in
      setSuName(""); setSuEmail(""); setSuPassword(""); setSuConfirm(""); setSuTerms(false)
      setIsSignup(false)
    } catch (err) {
      setSuApiError(
        err.response?.data?.detail || "Signup failed. Please try again."
      )
    } finally {
      setSuLoading(false)
    }
  }

  return (
    <div className="auth-page-root">
      {/* ── Cubes backdrop (desktop only) ────────────────────── */}
      {!isMobile && (
        <div className="cubes-backdrop">
          <Cubes
            className="w-full h-full"
            gridSize={14}
            maxAngle={40}
            radius={3}
            borderStyle="1px solid rgba(13,27,62,0.35)"
            faceColor="#fff0f0"
            rippleColor="#ff4b2b"
            rippleSpeed={1.8}
            autoAnimate
            rippleOnClick
          />
        </div>
      )}

      {/* ── Auth content ─────────────────────────────────────── */}
      <div className="auth-wrapper">

      <div className={`container${isSignup ? " right-panel-active" : ""}`}>

        {/* ══ Sign In Panel ══════════════════════════════════════════ */}
        <div className="form-container sign-in-container">
          <form onSubmit={handleSignIn} noValidate autoComplete="on">
            <h1>Sign In</h1>
            <p className="form-sub">Sign in as <strong>{role}</strong></p>

            {/* Email */}
            <div className={`input-wrapper${siErrors.email ? " input-error" : ""}`}>
              <input
                id="si-email"
                name="email"
                type="email"
                placeholder="Email address"
                value={siEmail}
                onChange={e => setSiEmail(e.target.value)}
                autoComplete="username"
                required
                maxLength={254}
                inputMode="email"
                aria-describedby={siErrors.email ? "si-email-err" : undefined}
              />
              {siErrors.email && (
                <span className="field-error" id="si-email-err" role="alert">{siErrors.email}</span>
              )}
            </div>

            {/* Password */}
            <PasswordInput
              id="si-password"
              name="password"
              placeholder="Password"
              value={siPassword}
              onChange={e => setSiPassword(e.target.value)}
              autoComplete="current-password"
              error={siErrors.password}
            />

            <div className="form-links">
              <a href="#" className="forgot-link" tabIndex={0}>Forgot password?</a>
            </div>

            {siApiError && (
              <span className="api-error" role="alert">{siApiError}</span>
            )}

            <button type="submit" className="btn-submit" disabled={siLoading}>
              {siLoading ? "Signing in…" : "Sign In"}
            </button>
          </form>
        </div>

        {/* ══ Sign Up Panel ══════════════════════════════════════════ */}
        <div className="form-container sign-up-container">
          <form onSubmit={handleSignUp} noValidate autoComplete="on">
            <h1>Create Account</h1>
            <p className="form-sub">Joining as <strong>{role}</strong></p>

            {/* Full Name */}
            <div className={`input-wrapper${suErrors.name ? " input-error" : ""}`}>
              <input
                id="su-name"
                name="name"
                type="text"
                placeholder="Full name"
                value={suName}
                onChange={e => setSuName(e.target.value)}
                autoComplete="name"
                required
                minLength={2}
                maxLength={100}
                aria-describedby={suErrors.name ? "su-name-err" : undefined}
              />
              {suErrors.name && (
                <span className="field-error" id="su-name-err" role="alert">{suErrors.name}</span>
              )}
            </div>

            {/* Email */}
            <div className={`input-wrapper${suErrors.email ? " input-error" : ""}`}>
              <input
                id="su-email"
                name="email"
                type="email"
                placeholder="Email address"
                value={suEmail}
                onChange={e => setSuEmail(e.target.value)}
                autoComplete="email"
                required
                maxLength={254}
                inputMode="email"
                aria-describedby={suErrors.email ? "su-email-err" : undefined}
              />
              {suErrors.email && (
                <span className="field-error" id="su-email-err" role="alert">{suErrors.email}</span>
              )}
            </div>

            {/* Password + strength meter */}
            <PasswordInput
              id="su-password"
              name="password"
              placeholder="Password (min 8 chars)"
              value={suPassword}
              onChange={e => setSuPassword(e.target.value)}
              autoComplete="new-password"
              error={suErrors.password}
            />
            {suPassword && (
              <div className="pw-strength" aria-live="polite">
                <div className="pw-strength-bar">
                  {[1,2,3,4].map(i => (
                    <span
                      key={i}
                      className="pw-strength-seg"
                      style={{ background: i <= pwStrength.score ? pwStrength.color : "#ddd" }}
                    />
                  ))}
                </div>
                <span className="pw-strength-label" style={{ color: pwStrength.color }}>
                  {pwStrength.label}
                </span>
              </div>
            )}

            {/* Confirm Password */}
            <PasswordInput
              id="su-confirm"
              name="confirm_password"
              placeholder="Confirm password"
              value={suConfirm}
              onChange={e => setSuConfirm(e.target.value)}
              autoComplete="new-password"
              error={suErrors.confirm}
            />

            {/* Terms */}
            <label className={`terms-label${suErrors.terms ? " terms-error" : ""}`}>
              <input
                type="checkbox"
                checked={suTerms}
                onChange={e => setSuTerms(e.target.checked)}
                required
              />
              <span>I agree to the <a href="#" tabIndex={0}>Terms of Service</a> and <a href="#" tabIndex={0}>Privacy Policy</a></span>
            </label>
            {suErrors.terms && (
              <span className="field-error" role="alert">{suErrors.terms}</span>
            )}

            {suApiError && (
              <span className="api-error" role="alert">{suApiError}</span>
            )}

            <button type="submit" className="btn-submit" disabled={suLoading}>
              {suLoading ? "Creating account…" : "Create Account"}
            </button>
          </form>
        </div>

        {/* ══ Sliding Overlay ════════════════════════════════════════ */}
        <div className="overlay-container">
          <div className="overlay">
            <div className="overlay-panel overlay-left">
              <h1>Welcome Back!</h1>
              <p>Already have an account? Sign in to continue your journey.</p>
              <button className="btn-ghost" onClick={() => setIsSignup(false)}>Sign In</button>
            </div>
            <div className="overlay-panel overlay-right">
              <h1>Hello, Friend!</h1>
              <p>New here? Create an account and start your journey with us.</p>
              <button className="btn-ghost" onClick={() => setIsSignup(true)}>Sign Up</button>
            </div>
          </div>
        </div>

      </div>
      </div>
    </div>
  )
}