import "./globals.css";

export const metadata = {
  title: "Shadow Tokens — W3C Design Tokens Demo",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="page-wrapper">{children}</div>
      </body>
    </html>
  );
}
