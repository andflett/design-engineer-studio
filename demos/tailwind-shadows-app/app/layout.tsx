import "./globals.css";

export const metadata = {
  title: "Shadow Tokens — Tailwind CSS v4 Demo",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="p-6 px-8">{children}</div>
      </body>
    </html>
  );
}
