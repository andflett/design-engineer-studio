function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`bg-text/[0.06] rounded ${className}`} />;
}

export default function ShadowTokensPage() {
  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">Demo Site</h1>
        <div className="inline-flex items-center px-4 py-2 rounded-md">
          <Skeleton className="h-4 w-16" />
        </div>
      </div>

      {/* Stat cards — xs shadow */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-card rounded-lg shadow-xs p-5">
            <Skeleton className="h-3 w-20 mb-2" />
            <Skeleton className="h-7 w-10 mb-1.5" />
            <Skeleton className="h-3 w-24" />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-[2fr_1fr] gap-4 mb-6">
        {/* Table — sm shadow */}
        <div className="bg-card rounded-lg shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-6 w-16 rounded-md" />
          </div>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr>
                {["w-16", "w-24", "w-16", "w-14"].map((w, i) => (
                  <th key={i} className="text-left px-5 py-2.5 bg-surface">
                    <Skeleton className={`h-3 ${w}`} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[1, 2, 3, 4, 5].map((row) => (
                <tr key={row}>
                  <td className="px-5 py-2.5 border-t border-border"><Skeleton className="h-3 w-16" /></td>
                  <td className="px-5 py-2.5 border-t border-border"><Skeleton className="h-3 w-24" /></td>
                  <td className="px-5 py-2.5 border-t border-border"><Skeleton className="h-3 w-12" /></td>
                  <td className="px-5 py-2.5 border-t border-border"><Skeleton className="h-5 w-14 rounded-full" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-4">
          {/* Activity — md shadow */}
          <div className="bg-card rounded-lg shadow-md overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <Skeleton className="h-4 w-28" />
            </div>
            <div>
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className={`px-5 py-2.5 ${i < 5 ? "border-b border-border" : ""}`}
                >
                  <Skeleton className="h-3 w-full" />
                </div>
              ))}
            </div>
          </div>

          {/* Panel — lg shadow */}
          <div className="bg-card rounded-lg shadow-lg p-5 text-center">
            <Skeleton className="h-4 w-24 mx-auto mb-3" />
            <div className="grid grid-cols-2 gap-2">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-7 rounded-md" />
              ))}
            </div>
          </div>

          {/* Progress — xl shadow + inner shadow */}
          <div className="bg-card rounded-lg shadow-xl p-5">
            <Skeleton className="h-4 w-32 mb-3" />
            <div className="h-2 rounded-full shadow-inner bg-surface overflow-hidden">
              <div className="w-[83%] h-full bg-accent rounded-full" />
            </div>
            <Skeleton className="h-3 w-36 mt-2" />
          </div>
        </div>
      </div>
    </>
  );
}
