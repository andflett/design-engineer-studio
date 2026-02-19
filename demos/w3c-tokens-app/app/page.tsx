function Skeleton({ width, height = 12 }: { width: number | string; height?: number }) {
  return (
    <div
      className="skeleton"
      style={{ width, height, borderRadius: 4 }}
    />
  );
}

export default function ShadowTokensPage() {
  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Demo Site</h1>
        <Skeleton width={80} height={32} />
      </div>

      {/* Stat cards — low shadow */}
      <div className="grid-4 mb-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="card card-low">
            <Skeleton width={80} height={10} />
            <div style={{ margin: "8px 0" }}>
              <Skeleton width={40} height={24} />
            </div>
            <Skeleton width={96} height={10} />
          </div>
        ))}
      </div>

      <div className="grid-2-1 mb-6">
        {/* Table — medium shadow */}
        <div className="card card-medium" style={{ padding: 0 }}>
          <div className="card-header">
            <Skeleton width={112} height={14} />
            <Skeleton width={64} height={24} />
          </div>
          <table className="table">
            <thead>
              <tr>
                {[64, 96, 64, 56].map((w, i) => (
                  <th key={i}>
                    <Skeleton width={w} height={10} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[1, 2, 3, 4, 5].map((row) => (
                <tr key={row}>
                  <td><Skeleton width={64} height={10} /></td>
                  <td><Skeleton width={96} height={10} /></td>
                  <td><Skeleton width={48} height={10} /></td>
                  <td><Skeleton width={56} height={18} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Right column */}
        <div className="flex-col gap-16">
          {/* Activity — high shadow */}
          <div className="card card-high" style={{ padding: 0 }}>
            <div className="card-header">
              <Skeleton width={112} height={14} />
            </div>
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                style={{
                  padding: "10px 20px",
                  borderBottom: i < 5 ? "1px solid var(--color-border)" : "none",
                }}
              >
                <Skeleton width="100%" height={10} />
              </div>
            ))}
          </div>

          {/* Panel — highest shadow */}
          <div className="card card-highest" style={{ textAlign: "center" }}>
            <Skeleton width={96} height={14} />
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 8,
                marginTop: 12,
              }}
            >
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} width="100%" height={28} />
              ))}
            </div>
          </div>

          {/* Progress — highest shadow */}
          <div className="card card-highest">
            <Skeleton width={128} height={14} />
            <div
              style={{
                height: 8,
                borderRadius: 9999,
                background: "var(--color-border)",
                overflow: "hidden",
                marginTop: 12,
              }}
            >
              <div
                style={{
                  width: "83%",
                  height: "100%",
                  background: "var(--color-accent)",
                  borderRadius: 9999,
                }}
              />
            </div>
            <div style={{ marginTop: 8 }}>
              <Skeleton width={144} height={10} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
