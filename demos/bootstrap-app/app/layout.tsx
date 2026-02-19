import "../scss/main.scss";

export const metadata = {
  title: "Shadow Tokens — Bootstrap Demo",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="container-fluid py-4 px-4" style={{ maxWidth: 1200 }}>
          {children}
        </div>
      </body>
    </html>
  );
}
