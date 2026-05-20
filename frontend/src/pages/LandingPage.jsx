import { useNavigate } from "react-router-dom"
import LandingHeader from "../components/landing/LandingHeader"
import HeroContent from "../components/landing/HeroContent"
import HeroVisual from "../components/landing/HeroVisual"
import heroImage from "../assets/asset1.png"
import "../styles/landing.css"

export default function LandingPage() {
  const navigate = useNavigate()

  function handleGetStarted() {
    navigate("/role-select")
  }

  return (
    <div className="landing-page">
      <div className="landing-shell">
        <LandingHeader onGetStarted={handleGetStarted} />
        <main className="landing-hero">
          <HeroContent onGetStarted={handleGetStarted} />
          <HeroVisual image={heroImage} />
        </main>
      </div>
    </div>
  )
}
