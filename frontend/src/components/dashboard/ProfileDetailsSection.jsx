function FieldInput({ label, value, onChange, placeholder, type = "text" }) {
  return (
    <div>
      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-[#1a1a2e] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#ff4b2b]/30 focus:border-[#ff4b2b] transition"
      />
    </div>
  )
}

export default function ProfileDetailsSection({
  title,
  description,
  loading = false,
  fields = [],
  onSave,
  saveLabel = "Save",
  saving = false,
  disableSave = false,
  saveButtonClassName = "w-full md:w-auto px-6 py-2.5 bg-gradient-to-r from-[#ff4b2b] to-[#ff416c] text-white font-semibold rounded-xl hover:opacity-90 transition disabled:opacity-60",
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="font-bold text-[#1a1a2e] text-base">{title}</h3>
          <p className="text-sm text-gray-500">{description}</p>
        </div>
        {loading && <span className="text-xs text-gray-400 font-semibold">Loading…</span>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {fields.map((field) => (
          <div key={field.label} className={field.wrapperClassName || ""}>
            <FieldInput
              label={field.label}
              value={field.value}
              onChange={field.onChange}
              placeholder={field.placeholder}
              type={field.type}
            />
          </div>
        ))}
      </div>

      <button
        onClick={onSave}
        disabled={saving || disableSave}
        className={saveButtonClassName}
      >
        {saving ? "Saving…" : saveLabel}
      </button>
    </div>
  )
}