import "./globals.css";

export const metadata = {
  title: "Projects — CSS Variables Demo",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <aside className="sidebar">
          <div className="sidebar-brand">Workspace</div>
          <ul className="sidebar-nav">
            <li>
              <a href="/" className="sidebar-link active">
                Projects
              </a>
            </li>
            <li>
              <a href="/" className="sidebar-link">
                Team
              </a>
            </li>
            <li>
              <a href="/" className="sidebar-link">
                Settings
              </a>
            </li>
          </ul>
        </aside>
        <div className="main">{children}</div>
      </body>
    </html>
  );
}
