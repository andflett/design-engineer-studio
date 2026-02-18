import "./globals.css";

export const metadata = {
  title: "Shadow Tokens — Tailwind CSS v4 Demo",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <aside className="fixed top-0 left-0 w-55 h-screen bg-card border-r border-border flex flex-col">
          <div className="px-5 pb-4 pt-5 font-bold text-[15px] border-b border-border mb-3">
            Shadow Studio
          </div>
          <ul className="flex flex-col gap-0.5 px-2">
            <li>
              <a href="/" className="flex items-center gap-2 px-3 py-2 rounded-md text-sm bg-accent text-accent-fg">
                Tokens
              </a>
            </li>
            <li>
              <a href="/" className="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-text-muted hover:bg-surface">
                Presets
              </a>
            </li>
            <li>
              <a href="/" className="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-text-muted hover:bg-surface">
                Settings
              </a>
            </li>
          </ul>
        </aside>
        <div className="ml-55 p-6 px-8">{children}</div>
      </body>
    </html>
  );
}
