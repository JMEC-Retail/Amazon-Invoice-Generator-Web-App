import "./globals.css";

export const metadata = {
  title: "Amazon Orders & Invoices",
  description: "Simple UI for viewing Amazon orders and generating invoices",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-100">{children}</body>
    </html>
  );
}
