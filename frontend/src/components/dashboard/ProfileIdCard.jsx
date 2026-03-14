import Avatar from "./DashboardAvatar"

function hasValue(value) {
  if (value === null || value === undefined) return false
  if (typeof value === "string") return value.trim().length > 0
  return true
}

export default function ProfileIdCard({
  title,
  name,
  subtitle,
  roleLabel,
  imagePath,
  avatarFallback,
  onAvatarClick,
  rows = [],
}) {
  const visibleRows = rows.filter((row) => row?.alwaysShow || hasValue(row?.value))

  return (
    <div className="bg-gradient-to-br from-[#1a1a2e] to-[#2a2a46] rounded-2xl p-6 text-white shadow-sm">
      <p className="text-xs uppercase tracking-wider text-white/70 font-semibold">{title}</p>
      <div className="mt-4 flex items-center gap-3">
        <Avatar name={name} imagePath={imagePath} onClick={onAvatarClick} fallback={avatarFallback} />
        <div>
          <p className="font-bold text-lg leading-tight">{name}</p>
          <p className="text-sm text-white/70">{subtitle}</p>
        </div>
      </div>
      <div className="mt-5 space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-white/70">Role</span>
          <span className="font-semibold">{roleLabel}</span>
        </div>
        {visibleRows.map((row) => (
          row.fullWidth ? (
            <div key={row.label}>
              <p className="text-white/70">{row.label}</p>
              <p className="font-semibold leading-snug">{row.value}</p>
            </div>
          ) : (
            <div key={row.label} className="flex justify-between gap-4">
              <span className="text-white/70">{row.label}</span>
              <span className="font-semibold text-right">{row.value}</span>
            </div>
          )
        ))}
      </div>
    </div>
  )
}