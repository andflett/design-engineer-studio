const metrics = [
  { label: "Active Projects", value: "12", sub: "3 due this week" },
  { label: "Team Members", value: "8", sub: "2 pending invites" },
  { label: "Completed", value: "64", sub: "This quarter" },
  { label: "Overdue", value: "3", sub: "Needs attention" },
];

const projects = [
  { name: "Website Redesign", owner: "Sarah K.", status: "On Track", priority: "High" },
  { name: "Mobile App v2", owner: "James L.", status: "At Risk", priority: "High" },
  { name: "API Migration", owner: "Priya M.", status: "On Track", priority: "Medium" },
  { name: "Design System", owner: "Alex C.", status: "Completed", priority: "Medium" },
  { name: "CI/CD Pipeline", owner: "Maria R.", status: "On Track", priority: "Low" },
];

const activity = [
  "Sarah pushed 3 commits to website-redesign",
  "James opened PR #142 for mobile-app",
  "Priya completed API auth migration",
  "Alex published design-system v1.2",
  "Maria added staging environment",
];

export default function ProjectsPage() {
  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Projects</h1>
        <button className="btn btn-primary">New Project</button>
      </div>

      {/* Stat cards — xs shadow */}
      <div className="grid-4 mb-6">
        {metrics.map((m) => (
          <div
            key={m.label}
            className="card"
            style={{ boxShadow: "var(--shadow-xs)", border: "none" }}
          >
            <div className="card-body">
              <div className="text-sm text-muted" style={{ marginBottom: 4 }}>
                {m.label}
              </div>
              <div style={{ fontSize: 28, fontWeight: 700, marginBottom: 2 }}>{m.value}</div>
              <div className="text-sm text-muted">{m.sub}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid-2-1 mb-6">
        {/* Projects table — sm shadow */}
        <div className="card" style={{ boxShadow: "var(--shadow-sm)", border: "none" }}>
          <div className="card-header">
            <span className="card-title">All Projects</span>
            <button className="btn btn-ghost btn-sm">Filter</button>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>Project</th>
                <th>Owner</th>
                <th>Status</th>
                <th>Priority</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => (
                <tr key={p.name}>
                  <td className="text-bold">{p.name}</td>
                  <td>{p.owner}</td>
                  <td>
                    <span
                      className={`badge ${
                        p.status === "On Track"
                          ? "badge-green"
                          : p.status === "At Risk"
                            ? "badge-amber"
                            : p.status === "Completed"
                              ? "badge-green"
                              : "badge-red"
                      }`}
                    >
                      {p.status}
                    </span>
                  </td>
                  <td className="text-sm text-muted">{p.priority}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Right column */}
        <div className="flex-col gap-16">
          {/* Activity — md shadow */}
          <div className="card" style={{ boxShadow: "var(--shadow-md)", border: "none" }}>
            <div className="card-header">
              <span className="card-title">Recent Activity</span>
            </div>
            <div className="card-body" style={{ padding: 0 }}>
              {activity.map((item, i) => (
                <div
                  key={i}
                  style={{
                    padding: "10px 20px",
                    fontSize: 13,
                    borderBottom: i < activity.length - 1 ? "1px solid var(--gray-200)" : "none",
                  }}
                >
                  {item}
                </div>
              ))}
            </div>
          </div>

          {/* Floating panel — lg shadow */}
          <div className="card" style={{ boxShadow: "var(--shadow-lg)", border: "none" }}>
            <div className="card-body" style={{ textAlign: "center" }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
                Quick Add
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 8,
                }}
              >
                <button className="btn btn-ghost btn-sm">Task</button>
                <button className="btn btn-ghost btn-sm">Milestone</button>
                <button className="btn btn-ghost btn-sm">Document</button>
                <button className="btn btn-ghost btn-sm">Meeting</button>
              </div>
            </div>
          </div>

          {/* xl shadow + inner shadow */}
          <div className="card" style={{ boxShadow: "var(--shadow-xl)", border: "none" }}>
            <div className="card-body">
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>
                Storage Usage
              </div>
              <div
                style={{
                  height: 8,
                  borderRadius: "var(--radius-full)",
                  boxShadow: "var(--shadow-inner)",
                  background: "var(--gray-100)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: "68%",
                    height: "100%",
                    background: "var(--indigo-500)",
                    borderRadius: "var(--radius-full)",
                  }}
                />
              </div>
              <div className="text-sm text-muted" style={{ marginTop: 8 }}>
                6.8 GB of 10 GB used
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
