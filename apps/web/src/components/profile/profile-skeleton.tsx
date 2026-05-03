export function ProfileSkeleton() {
  return (
    <div className="space-y-6">
      <div className="card-static flex items-center gap-4 p-6">
        <div className="h-16 w-16 rounded-full skeleton" />
        <div className="space-y-2">
          <div className="h-5 w-40 skeleton" />
          <div className="h-4 w-24 skeleton" />
        </div>
      </div>
      <div className="card-static space-y-4 p-6">
        <div className="h-4 w-20 skeleton" />
        <div className="h-10 w-full skeleton" />
        <div className="h-4 w-20 skeleton" />
        <div className="h-10 w-full skeleton" />
        <div className="h-10 w-32 skeleton" />
      </div>
    </div>
  )
}
