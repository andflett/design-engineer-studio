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

      {/* Stat cards — xs shadow */}
      <div className="grid-4 mb-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="card" style={{ boxShadow: "var(--shadow-xs)" }}>
            <div className="card-body">
              <Skeleton width={80} height={10} />
              <div style={{ margin: "8px 0" }}>
                <Skeleton width={40} height={24} />
              </div>
              <Skeleton width={96} height={10} />
            </div>
          </div>
        ))}
      </div>

      <div className="grid-2-1 mb-6">
        {/* Table — sm shadow */}
        <div className="card" style={{ boxShadow: "var(--shadow-sm)", padding: 0 }}>
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
          {/* Activity — md shadow */}
          <div className="card" style={{ boxShadow: "var(--shadow-md)", padding: 0 }}>
            <div className="card-header">
              <Skeleton width={112} height={14} />
            </div>
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                style={{
                  padding: "10px 20px",
                  borderBottom: i < 5 ? "1px solid var(--gray-200)" : "none",
                }}
              >
                <Skeleton width="100%" height={10} />
              </div>
            ))}
          </div>

          {/* Panel — lg shadow */}
          <div
            className="card"
            style={{ boxShadow: "var(--shadow-lg)", textAlign: "center" }}
          >
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

          {/* Progress — xl shadow + inner shadow */}
          <div className="card" style={{ boxShadow: "var(--shadow-xl)" }}>
            <Skeleton width={128} height={14} />
            <div
              style={{
                height: 8,
                borderRadius: "var(--radius-full)",
                boxShadow: "var(--shadow-inner)",
                background: "var(--gray-100)",
                overflow: "hidden",
                marginTop: 12,
              }}
            >
              <div
                style={{
                  width: "83%",
                  height: "100%",
                  background: "var(--indigo-500)",
                  borderRadius: "var(--radius-full)",
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
