import { useEffect, useState } from "react"

function toAbsoluteImageUrl(path) {
  if (!path) return null
  if (path.startsWith("http://") || path.startsWith("https://")) return path
  return `http://127.0.0.1:8000${path}`
}

export default function DashboardAvatar({
  name,
  imagePath,
  large = false,
  onClick,
  fallback = "U",
}) {
  const [imageFailed, setImageFailed] = useState(false)
  const cls = large ? "w-16 h-16 text-2xl" : "w-9 h-9 text-sm"
  const src = toAbsoluteImageUrl(imagePath)

  useEffect(() => {
    setImageFailed(false)
  }, [imagePath])

  if (src && !imageFailed) {
    return (
      <img
        src={src}
        alt={name || "Profile"}
        onClick={() => onClick && onClick(src)}
        onError={() => setImageFailed(true)}
        className={`${cls} rounded-full object-cover shrink-0 ${onClick ? "cursor-zoom-in" : ""}`}
      />
    )
  }

  return (
    <div className={`${cls} rounded-full bg-gradient-to-br from-[#ff4b2b] to-[#ff416c] flex items-center justify-center text-white font-bold shrink-0`}>
      {name?.[0]?.toUpperCase() ?? fallback}
    </div>
  )
}
