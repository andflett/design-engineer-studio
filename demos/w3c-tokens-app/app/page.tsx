const kpis = [
  { label: "Page Views", value: "128,430", delta: "+14.2%", up: true },
  { label: "Unique Visitors", value: "34,210", delta: "+6.8%", up: true },
  { label: "Conversion Rate", value: "3.24%", delta: "+0.4%", up: true },
  { label: "Avg. Load Time", value: "1.2s", delta: "-0.3s", up: false },
];

const topPages = [
  { path: "/", views: "42,180", bounce: "32%" },
  { path: "/pricing", views: "18,320", bounce: "41%" },
  { path: "/docs/getting-started", views: "12,540", bounce: "28%" },
  { path: "/blog/release-v4", views: "9,870", bounce: "35%" },
  { path: "/changelog", views: "6,210", bounce: "44%" },
];

const alerts = [
  { text: "API latency spike detected", severity: "warning" },
  { text: "SSL certificate renews in 7 days", severity: "info" },
  { text: "Deployment v4.2.1 successful", severity: "success" },
];

export default function DashboardPage() {
  return (
    <>
      {/* KPI row — low elevation */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 16,
          marginBottom: 24,
        }}
      >
        {kpis.map((kpi) => (
          <div key={kpi.label} className="card card-low" style={{ border: "none" }}>
            <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 4 }}>
              {kpi.label}
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>{kpi.value}</div>
            <span
              className="badge"
              style={{
                background: kpi.up ? "#ecfdf5" : "#fef2f2",
                color: kpi.up ? "var(--color-success)" : "var(--color-danger)",
              }}
            >
              {kpi.delta}
            </span>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
        {/* Traffic table — medium elevation */}
        <div className="card card-medium" style={{ border: "none", padding: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "16px 20px",
              borderBottom: "1px solid var(--color-border)",
            }}
          >
            <span style={{ fontWeight: 600, fontSize: 14 }}>Top Pages</span>
            <button className="btn btn-outline" style={{ fontSize: 12, padding: "4px 12px" }}>
              Export
            </button>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ background: "#f9fafb", textAlign: "left" }}>
                <th style={{ padding: "10px 20px", fontWeight: 500, color: "var(--color-text-secondary)" }}>
                  Path
                </th>
                <th style={{ padding: "10px 20px", fontWeight: 500, color: "var(--color-text-secondary)" }}>
                  Views
                </th>
                <th style={{ padding: "10px 20px", fontWeight: 500, color: "var(--color-text-secondary)" }}>
                  Bounce
                </th>
              </tr>
            </thead>
            <tbody>
              {topPages.map((p) => (
                <tr key={p.path} style={{ borderBottom: "1px solid var(--color-border)" }}>
                  <td style={{ padding: "10px 20px", fontFamily: "monospace", fontSize: 13 }}>
                    {p.path}
                  </td>
                  <td style={{ padding: "10px 20px" }}>{p.views}</td>
                  <td style={{ padding: "10px 20px" }}>{p.bounce}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Right column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Alerts — high elevation */}
          <div className="card card-high" style={{ border: "none" }}>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12 }}>Alerts</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {alerts.map((a, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 12px",
                    borderRadius: "var(--radius)",
                    background:
                      a.severity === "warning"
                        ? "#fffbeb"
                        : a.severity === "success"
                          ? "#ecfdf5"
                          : "#eff6ff",
                    fontSize: 13,
                  }}
                >
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background:
                        a.severity === "warning"
                          ? "var(--color-warning)"
                          : a.severity === "success"
                            ? "var(--color-success)"
                            : "var(--color-accent)",
                    }}
                  />
                  {a.text}
                </div>
              ))}
            </div>
          </div>

          {/* Floating CTA — highest elevation */}
          <div
            className="card card-highest"
            style={{
              border: "none",
              background: "var(--color-accent)",
              color: "var(--color-accent-text)",
              textAlign: "center",
            }}
          >
            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 8 }}>
              Upgrade to Pro
            </div>
            <div style={{ fontSize: 13, opacity: 0.85, marginBottom: 16 }}>
              Unlock real-time analytics, custom reports, and team dashboards.
            </div>
            <button
              className="btn"
              style={{
                background: "white",
                color: "var(--color-accent)",
                width: "100%",
                fontWeight: 600,
              }}
            >
              Start Free Trial
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
