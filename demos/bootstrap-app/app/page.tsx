function Skeleton({ width, height = 12 }: { width: number | string; height?: number }) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius: 4,
        background: "currentColor",
        opacity: 0.06,
      }}
    />
  );
}

export default function ShadowTokensPage() {
  return (
    <>
      <div className="d-flex align-items-center justify-content-between mb-4">
        <h1 className="h5 fw-bold mb-0">Demo Site</h1>
        <Skeleton width={80} height={32} />
      </div>

      {/* Stat cards — shadow-sm */}
      <div className="row g-3 mb-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="col-sm-6 col-xl-3">
            <div className="card shadow-sm border-0">
              <div className="card-body">
                <Skeleton width={80} height={10} />
                <div className="my-2">
                  <Skeleton width={40} height={24} />
                </div>
                <Skeleton width={96} height={10} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="row g-3">
        {/* Table — default shadow */}
        <div className="col-lg-8">
          <div className="card shadow border-0 overflow-hidden">
            <div className="card-header bg-transparent d-flex align-items-center justify-content-between py-3 border-bottom">
              <Skeleton width={112} height={14} />
              <Skeleton width={64} height={24} />
            </div>
            <div className="card-body p-0">
              <table className="table table-hover mb-0">
                <thead className="table-light">
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
          </div>
        </div>

        {/* Right column */}
        <div className="col-lg-4 d-flex flex-column gap-3">
          {/* Activity — shadow-lg */}
          <div className="card shadow-lg border-0 overflow-hidden">
            <div className="card-header bg-transparent py-3 border-bottom">
              <Skeleton width={112} height={14} />
            </div>
            <div className="card-body p-0">
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className={`px-3 py-2 ${i < 5 ? "border-bottom" : ""}`}
                >
                  <Skeleton width="100%" height={10} />
                </div>
              ))}
            </div>
          </div>

          {/* Panel — shadow */}
          <div className="card shadow border-0 text-center">
            <div className="card-body">
              <Skeleton width={96} height={14} />
              <div className="row g-2 mt-2">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="col-6">
                    <Skeleton width="100%" height={28} />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Progress — inset shadow */}
          <div
            className="card border-0"
            style={{ boxShadow: "var(--bs-box-shadow-lg, 0 1rem 3rem rgba(0,0,0,.175))" }}
          >
            <div className="card-body">
              <Skeleton width={128} height={14} />
              <div
                className="mt-2 rounded-pill overflow-hidden"
                style={{
                  height: 8,
                  boxShadow: "var(--bs-box-shadow-inset, inset 0 1px 2px rgba(0,0,0,.075))",
                  background: "var(--bs-secondary-bg, #e9ecef)",
                }}
              >
                <div
                  className="rounded-pill"
                  style={{
                    width: "83%",
                    height: "100%",
                    background: "var(--bs-primary, #6366f1)",
                  }}
                />
              </div>
              <div className="mt-2">
                <Skeleton width={144} height={10} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
