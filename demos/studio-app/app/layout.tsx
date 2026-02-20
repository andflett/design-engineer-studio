import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Component Studio Demo",
  description: "Demo app for Component Studio",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <nav className="border-b bg-background">
          <div className="mx-auto flex h-14 max-w-5xl items-center gap-6 px-4">
            <a href="/" className="text-sm font-semibold">
              Demo App
            </a>
            <a
              href="/dashboard"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Dashboard
            </a>
            <a
              href="/settings"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Settings
            </a>
            <a
              href="/blog"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Blog
            </a>
          </div>
        </nav>
        <main>{children}</main>
      </body>
    </html>
  );
}
