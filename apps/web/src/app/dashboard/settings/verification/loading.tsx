export default function VerificationDocsLoading() {
  return (
    <div className="mx-auto max-w-2xl">
      <div className="skeleton h-8 w-48 mb-6" />
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="skeleton h-28 rounded-xl" />
        ))}
      </div>
    </div>
  )
}
