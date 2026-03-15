export default function FullScreenLoader({ label = "Checking your session…" }) {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#f4f6fb]">
      <div className="flex flex-col items-center gap-3">
        <div className="h-10 w-10 rounded-full border-4 border-[#ff4b2b]/20 border-t-[#ff4b2b] animate-spin" />
        <p className="text-sm font-semibold text-gray-600">{label}</p>
      </div>
    </div>
  )
}
