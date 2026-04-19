export default function TableLoading() {
  return (
    <div className="p-8 max-w-7xl animate-pulse">
      <header className="flex items-baseline justify-between mb-6">
        <div>
          <div className="h-3 w-16 bg-steel-200 rounded mb-2" />
          <div className="h-8 w-36 bg-steel-200 rounded" />
        </div>
        <div className="h-10 w-32 bg-steel-200 rounded" />
      </header>
      <div className="panel">
        <div className="px-5 py-3 border-b border-steel-200 flex gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-3 w-16 bg-steel-200 rounded" />
          ))}
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="px-5 py-4 border-b border-steel-100 flex gap-6">
            <div className="h-4 w-14 bg-steel-200 rounded" />
            <div className="h-4 w-32 bg-steel-200 rounded" />
            <div className="h-4 w-24 bg-steel-200 rounded" />
            <div className="h-4 w-20 bg-steel-200 rounded" />
            <div className="h-4 w-16 bg-steel-200 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
