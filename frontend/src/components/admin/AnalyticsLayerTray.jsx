import { useEffect, useRef, useState } from "react"
import { ChevronRight } from "lucide-react"

const layers = [
  {
    key: "students",
    title: "Student Directory",
  },
  {
    key: "teachers",
    title: "Teacher Directory",
  },
  {
    key: "failure",
    title: "Failure Rate Monitoring",
  },
]

export default function AnalyticsLayerTray({
  open,
  onOpenChange,
  activeLayer,
  onLayerChange,
  compact = false,
}) {
  const triggerRef = useRef(null)
  const panelRef = useRef(null)
  const closeTimerRef = useRef(null)
  const [panelStyle, setPanelStyle] = useState({})

  const triggerClass = compact
    ? "inline-flex items-center justify-center h-6 w-6 rounded-md text-[#1a1a2e] hover:bg-white/20"
    : "inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-[#1a1a2e] hover:bg-gray-50"

  useEffect(() => {
    if (!open) return

    function updatePanelPosition() {
      if (!triggerRef.current) return

      const rect = triggerRef.current.getBoundingClientRect()
      const panelWidth = Math.min(320, window.innerWidth - 24)
      const left = compact
        ? Math.min(rect.right + 8, window.innerWidth - panelWidth - 12)
        : Math.max(12, rect.right - panelWidth)
      const top = compact
        ? Math.max(12, Math.min(rect.top - 8, window.innerHeight - 260))
        : Math.max(12, Math.min(rect.bottom + 8, window.innerHeight - 260))

      setPanelStyle({
        position: "fixed",
        left: `${left}px`,
        top: `${top}px`,
        width: `${panelWidth}px`,
        zIndex: 1200,
      })
    }

    updatePanelPosition()
    window.addEventListener("resize", updatePanelPosition)
    window.addEventListener("scroll", updatePanelPosition, true)
    return () => {
      window.removeEventListener("resize", updatePanelPosition)
      window.removeEventListener("scroll", updatePanelPosition, true)
    }
  }, [open, compact])

  useEffect(() => {
    if (!open) return

    function onPointerDown(event) {
      if (triggerRef.current?.contains(event.target)) return
      if (panelRef.current?.contains(event.target)) return
      onOpenChange(false)
    }

    document.addEventListener("mousedown", onPointerDown)
    return () => document.removeEventListener("mousedown", onPointerDown)
  }, [open, onOpenChange])

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current)
    }
  }, [])

  function openNow() {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
    onOpenChange(true)
  }

  function closeSoon() {
    if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current)
    closeTimerRef.current = window.setTimeout(() => onOpenChange(false), 140)
  }

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={(event) => {
          event.stopPropagation()
          onOpenChange(!open)
        }}
        onMouseEnter={openNow}
        onMouseLeave={closeSoon}
        className={triggerClass}
      >
        <ChevronRight size={14} className="text-[#1a1a2e]" />
      </button>

      {open && (
        <div
          ref={panelRef}
          style={panelStyle}
          onMouseEnter={openNow}
          onMouseLeave={closeSoon}
          className="rounded-2xl border border-gray-100 bg-white p-2 shadow-xl"
        >
          {layers.map((layer) => (
            <button
              key={layer.key}
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                onLayerChange(layer.key)
                onOpenChange(false)
              }}
              className={`w-full rounded-xl px-3 py-2.5 text-left transition ${
                activeLayer === layer.key ? "bg-[#fff3f1]" : "hover:bg-gray-50"
              }`}
            >
              <p className="text-sm font-semibold text-[#1a1a2e]">{layer.title}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
