export default function AuthSlider({ isSignup, toggle, children }) {
  return (
    <div className={`auth-container ${isSignup ? "signup" : ""}`}>
      <div className="form-box">
        {children}
        <p onClick={toggle}>
          {isSignup ? "Already have an account? Login" : "New user? Signup"}
        </p>
      </div>
    </div>
  )
}