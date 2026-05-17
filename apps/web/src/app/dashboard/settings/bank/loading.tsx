export default function BankSettingsLoading() {
  return (
    <div className="mx-auto max-w-xl space-y-6 py-2">
      <div className="h-8 w-48 rounded-lg skeleton" />
      <div className="card-static space-y-4 p-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="h-4 w-24 rounded skeleton" />
            <div className="h-10 rounded-lg skeleton" />
          </div>
        ))}
      </div>
    </div>
  )
}
