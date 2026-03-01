export default function LoginForm({ email, setEmail, password, setPassword }) {
  return (
    <>
      <input
        placeholder="Email"
        value={email}
        onChange={e => setEmail(e.target.value)}
      />
      <input
        placeholder="Password"
        type="password"
        value={password}
        onChange={e => setPassword(e.target.value)}
      />
      <button>Login</button>
    </>
  )
}