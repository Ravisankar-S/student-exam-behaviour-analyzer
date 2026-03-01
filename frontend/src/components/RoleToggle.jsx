export default function RoleToggle({ role, setRole }) {
  const roles = ["student", "teacher", "admin"]

  return (
    <div className="role-toggle">
      {roles.map(r => (
        <button
          key={r}
          className={role === r ? "active" : ""}
          onClick={() => setRole(r)}
        >
          {r.toUpperCase()}
        </button>
      ))}
    </div>
  )
}