export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}

export function StatCardSkeleton() {
  return (
    <div className="card px-5 py-4">
      <Skeleton className="h-3 w-20" />
      <Skeleton className="h-7 w-28 mt-2.5" />
      <Skeleton className="h-3 w-24 mt-2" />
    </div>
  );
}

export function ChartSkeleton({ height = 260 }: { height?: number }) {
  return (
    <div className="card px-5 py-4">
      <Skeleton className="h-4 w-40 mb-3" />
      <div className="skeleton w-full rounded-lg" style={{ height }} />
    </div>
  );
}

export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-3 border-b border-hairline">
        <Skeleton className="h-4 w-40" />
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-4 px-4 py-3 border-b border-hairline last:border-0">
          <Skeleton className="w-8 h-8 rounded-full" />
          {Array.from({ length: cols - 1 }).map((_, c) => (
            <Skeleton key={c} className="h-3.5 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function CardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card px-5 py-4">
          <div className="flex items-center gap-3">
            <Skeleton className="w-11 h-11 rounded-full" />
            <div className="flex-1">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-20 mt-2" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-4">
            {[0, 1, 2].map((k) => <Skeleton key={k} className="h-12 rounded-lg" />)}
          </div>
        </div>
      ))}
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="animate-page">
      <Skeleton className="h-6 w-48 mb-2" />
      <Skeleton className="h-4 w-72 mb-6" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[0, 1, 2, 3].map((i) => <StatCardSkeleton key={i} />)}
      </div>
      <ChartSkeleton />
    </div>
  );
}
