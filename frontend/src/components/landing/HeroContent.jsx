export default function HeroContent({ onGetStarted }) {
  return (
    <section className="hero-content">
      <div className="hero-pill">
        <span className="hero-pill-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M12 3l1.9 4.2L18 9l-4.1 1.8L12 15l-1.9-4.2L6 9l4.1-1.8L12 3z"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <span>The Future of Academic Freedom</span>
      </div>

      <h1 className="hero-title">
        Liberate Your <span className="hero-title-accent">Learning</span>
      </h1>

      <p className="hero-text">
        Beyond scores. <br></br>
        Argus.Ai analyzes how students think, respond, revise, and engage during online assessments
        using intelligent behavioural analytics.
      </p>

      <div className="hero-actions">
        <button className="hero-btn hero-btn-primary" type="button" onClick={onGetStarted}>
          Get Started
          <span aria-hidden="true">-&gt;</span>
        </button>
        
      </div>

      <div className="hero-social">
        <div className="avatar-stack" aria-hidden="true">
          <span className="avatar avatar-one" />
          <span className="avatar avatar-two" />
          <span className="avatar avatar-three" />
        </div>
        <span>Joined by 10,000+ students</span>
      </div>
    </section>
  )
}
