export default function ImagePreviewModal({ src, onClose }) {
  if (!src) return null

  return (
    <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div className="relative max-w-4xl w-full flex items-center justify-center" onClick={(event) => event.stopPropagation()}>
        <button
          onClick={onClose}
          className="absolute -top-10 right-0 text-white/90 hover:text-white text-sm font-semibold"
        >
          Close
        </button>
        <img src={src} alt="Preview" className="max-h-[85vh] w-auto max-w-full rounded-2xl border border-white/20" />
      </div>
    </div>
  )
}
