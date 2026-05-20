export default function HeroVisual({ image }) {
  return (
    <section className="hero-visual">
      <div className="hero-card">
        <div className="status-pill">
          <span className="status-dot" />
          <span>System Online</span>
        </div>

        <img
          className="hero-image"
          src={image}
          alt="Students celebrating in a study lounge"
        />

        <div className="efficiency-badge">
          <span className="badge-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
              <path d="M8.5 12.5l2.4 2.4 4.6-5.3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <div>
            <span className="badge-label">Assessment</span>
            <span className="badge-value">Beyond Scores</span>
          </div>
        </div>
      </div>
    </section>
  )
}
