export default function LandingHeader({ onGetStarted }) {
  return (
    <header className="landing-header">
      <div className="landing-brand">Argus.Ai</div>
      <button className="landing-top-cta" type="button" onClick={onGetStarted}>
        Get Started
      </button>
    </header>
  )
}
