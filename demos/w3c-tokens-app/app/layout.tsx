import "./globals.css";

export const metadata = {
  title: "Analytics — W3C Design Tokens Demo",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 24px",
            background: "var(--color-surface)",
            borderBottom: "1px solid var(--color-border)",
            boxShadow: "var(--shadow-low)",
          }}
        >
          <span style={{ fontWeight: 700, fontSize: 15 }}>Metrics</span>
          <nav style={{ display: "flex", gap: 16, fontSize: 14 }}>
            <a href="/" style={{ color: "var(--color-accent)", textDecoration: "none" }}>
              Dashboard
            </a>
          </nav>
        </header>
        <main style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 20px" }}>
          {children}
        </main>
      </body>
    </html>
  );
}
