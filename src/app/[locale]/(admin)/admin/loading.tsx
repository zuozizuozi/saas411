export default function AdminLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <div className="h-9 w-56 animate-pulse rounded bg-muted" />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-32 animate-pulse rounded-xl border bg-card" />
        ))}
      </div>
      <span className="sr-only">正在加载管理员页面</span>
    </div>
  );
}
