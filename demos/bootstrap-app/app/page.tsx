const stats = [
  { label: "Total Revenue", value: "$48,290", change: "+12.5%", up: true },
  { label: "Active Users", value: "2,845", change: "+8.2%", up: true },
  { label: "Bounce Rate", value: "24.3%", change: "-3.1%", up: false },
  { label: "Avg. Session", value: "4m 32s", change: "+1.8%", up: true },
];

const orders = [
  { id: "#3201", customer: "Olivia Martin", amount: "$320.00", status: "Completed" },
  { id: "#3202", customer: "James Chen", amount: "$185.00", status: "Processing" },
  { id: "#3203", customer: "Sophia Lee", amount: "$540.00", status: "Completed" },
  { id: "#3204", customer: "Liam Walker", amount: "$92.00", status: "Pending" },
  { id: "#3205", customer: "Emma Davis", amount: "$415.00", status: "Completed" },
];

export default function HomePage() {
  return (
    <>
      {/* Stat cards — shadow-sm */}
      <div className="row g-3 mb-4">
        {stats.map((s) => (
          <div key={s.label} className="col-sm-6 col-xl-3">
            <div className="card shadow-sm border-0 h-100">
              <div className="card-body">
                <p className="text-muted small mb-1">{s.label}</p>
                <h4 className="fw-bold mb-1">{s.value}</h4>
                <span className={`badge ${s.up ? "bg-success-subtle text-success" : "bg-danger-subtle text-danger"}`}>
                  {s.change}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="row g-3">
        {/* Orders table — default shadow */}
        <div className="col-lg-8">
          <div className="card shadow border-0">
            <div className="card-header bg-white d-flex align-items-center justify-content-between py-3">
              <h6 className="mb-0 fw-semibold">Recent Orders</h6>
              <button className="btn btn-sm btn-outline-primary">View All</button>
            </div>
            <div className="card-body p-0">
              <table className="table table-hover mb-0">
                <thead className="table-light">
                  <tr>
                    <th>Order</th>
                    <th>Customer</th>
                    <th>Amount</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.id}>
                      <td className="fw-medium">{o.id}</td>
                      <td>{o.customer}</td>
                      <td>{o.amount}</td>
                      <td>
                        <span
                          className={`badge rounded-pill ${
                            o.status === "Completed"
                              ? "bg-success-subtle text-success"
                              : o.status === "Processing"
                                ? "bg-primary-subtle text-primary"
                                : "bg-warning-subtle text-warning"
                          }`}
                        >
                          {o.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Sidebar widgets — shadow-lg */}
        <div className="col-lg-4 d-flex flex-column gap-3">
          <div className="card shadow-lg border-0">
            <div className="card-body">
              <h6 className="fw-semibold mb-3">Quick Actions</h6>
              <div className="d-grid gap-2">
                <button className="btn btn-primary">New Order</button>
                <button className="btn btn-outline-secondary">Generate Report</button>
                <button className="btn btn-outline-secondary">Invite Team Member</button>
              </div>
            </div>
          </div>

          <div className="card shadow border-0">
            <div className="card-body">
              <h6 className="fw-semibold mb-3">Activity Feed</h6>
              <ul className="list-unstyled mb-0">
                {[
                  "Olivia completed order #3201",
                  "New user signup: James Chen",
                  "Report generated for Q4",
                  "System update deployed",
                ].map((item, i) => (
                  <li
                    key={i}
                    className={`py-2 small ${i < 3 ? "border-bottom" : ""}`}
                  >
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Inset shadow example */}
          <div
            className="card border-0"
            style={{ boxShadow: "var(--bs-box-shadow-inset, inset 0 1px 2px rgba(0,0,0,.075))" }}
          >
            <div className="card-body text-center">
              <small className="text-muted">Inset shadow card</small>
              <p className="mb-0 fw-semibold">$12,450</p>
              <small className="text-muted">Monthly target progress</small>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
