import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import Cubes from "../components/Cubes"
import "../styles/role-select.css"

const ROLES = [
  {
    key: "student",
    label: "Student",
    description: "Take exams and track your performance",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
        <path d="M6 12v5c3 3 9 3 12 0v-5"/>
      </svg>
    ),
  },
  {
    key: "teacher",
    label: "Teacher",
    description: "Create exams and monitor student behaviour",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="20" height="14" rx="2"/>
        <path d="M8 21h8M12 17v4"/>
        <path d="M7 8h4M7 12h2"/>
        <path d="M15 8l2 2-2 2"/>
      </svg>
    ),
  },
  {
    key: "admin",
    label: "Admin",
    description: "Manage users, settings and the platform",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="4"/>
        <path d="M20 21a8 8 0 1 0-16 0"/>
        <circle cx="19" cy="19" r="3"/>
        <path d="M19 16v1M19 22v1M16 19h1M22 19h1"/>
      </svg>
    ),
  },
]

export default function RoleSelectPage() {
  const navigate = useNavigate()
  const [selected, setSelected] = useState(null)
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 600)

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth <= 600)
    window.addEventListener("resize", handler)
    return () => window.removeEventListener("resize", handler)
  }, [])

  function handleContinue() {
    if (!selected) return
    navigate("/auth", { state: { role: selected } })
  }

  return (
    <div className="role-page-root">
      {/* Cubes backdrop — desktop only */}
      {!isMobile && (
        <div className="role-cubes-backdrop">
          <Cubes
            className="w-full h-full"
            gridSize={14}
            maxAngle={40}
            radius={3}
            borderStyle="2px dotted rgba(13,27,62,0.35)"
            faceColor="#fff0f0"
            rippleColor="#ff4b2b"
            rippleSpeed={1.8}
            autoAnimate
            rippleOnClick
          />
        </div>
      )}

      {/* Role picker card */}
      <div className="role-card">
        <div className="role-card-header">
          <h1>Who are you?</h1>
          <p>Choose your role to get started</p>
        </div>

        <div className="role-options">
          {ROLES.map((r) => (
            <button
              key={r.key}
              className={`role-option${selected === r.key ? " role-option--active" : ""}`}
              onClick={() => setSelected(r.key)}
              type="button"
              aria-pressed={selected === r.key}
            >
              <span className="role-option-icon">{r.icon}</span>
              <span className="role-option-label">{r.label}</span>
              <span className="role-option-desc">{r.description}</span>
            </button>
          ))}
        </div>

        <button
          className="role-continue-btn"
          onClick={handleContinue}
          disabled={!selected}
          type="button"
        >
          Continue
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M13 6l6 6-6 6"/>
          </svg>
        </button>
      </div>
    </div>
  )
}
