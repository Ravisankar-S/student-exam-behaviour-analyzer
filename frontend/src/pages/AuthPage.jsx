import { useState } from "react"
import RoleToggle from "../components/RoleToggle"
import "../styles/auth.css"

export default function AuthPage() {
  const [role, setRole] = useState("student")
  const [isSignup, setIsSignup] = useState(false)

  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")

  return (
    <div className="auth-wrapper">
      <RoleToggle role={role} setRole={setRole} />

      <div className={`container${isSignup ? " right-panel-active" : ""}`}>

        {/* ── Sign In Panel ── */}
        <div className="form-container sign-in-container">
          <form onSubmit={e => e.preventDefault()}>
            <h1>Sign In</h1>
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
            <button type="submit" className="btn-submit">Sign In</button>
          </form>
        </div>

        {/* ── Sign Up Panel ── */}
        <div className="form-container sign-up-container">
          <form onSubmit={e => e.preventDefault()}>
            <h1>Create Account</h1>
            <input
              type="text"
              placeholder="Name"
              value={name}
              onChange={e => setName(e.target.value)}
            />
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
            <button type="submit" className="btn-submit">Sign Up</button>
          </form>
        </div>

        {/* ── Sliding Overlay ── */}
        <div className="overlay-container">
          <div className="overlay">

            {/* Left overlay panel — shown when Sign Up is active */}
            <div className="overlay-panel overlay-left">
              <h1>Welcome Back!</h1>
              <p>To keep connected with us please login with your personal info</p>
              <button className="btn-ghost" onClick={() => setIsSignup(false)}>
                Sign In
              </button>
            </div>

            {/* Right overlay panel — shown when Sign In is active */}
            <div className="overlay-panel overlay-right">
              <h1>Hello, Friend!</h1>
              <p>Enter your personal details and start your journey with us</p>
              <button className="btn-ghost" onClick={() => setIsSignup(true)}>
                Sign Up
              </button>
            </div>

          </div>
        </div>

      </div>
    </div>
  )
}