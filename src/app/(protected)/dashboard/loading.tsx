export default function DashboardLoading() {
  return (
    <div className="p-8 max-w-7xl animate-pulse">
      <header className="flex items-baseline justify-between mb-8">
        <div>
          <div className="h-3 w-16 bg-steel-200 rounded mb-2" />
          <div className="h-8 w-40 bg-steel-200 rounded" />
        </div>
        <div className="h-10 w-32 bg-steel-200 rounded" />
      </header>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="panel p-4">
            <div className="h-2 w-16 bg-steel-200 rounded mb-3" />
            <div className="h-7 w-12 bg-steel-200 rounded" />
          </div>
        ))}
      </div>
      <div className="panel">
        <div className="px-5 py-4 border-b border-steel-200">
          <div className="h-5 w-32 bg-steel-200 rounded" />
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="px-5 py-4 border-b border-steel-100 flex gap-6">
            <div className="h-4 w-14 bg-steel-200 rounded" />
            <div className="h-4 w-32 bg-steel-200 rounded" />
            <div className="h-4 w-24 bg-steel-200 rounded" />
            <div className="h-4 w-20 bg-steel-200 rounded" />
            <div className="h-4 w-10 bg-steel-200 rounded" />
            <div className="h-4 w-20 bg-steel-200 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
