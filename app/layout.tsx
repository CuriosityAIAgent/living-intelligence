import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI in Wealth Management",
  description: "Curated intelligence on AI across wealth management and financial services. Market developments, thought leadership, and competitive landscape.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
      </head>
      <body className="bg-white text-gray-900 min-h-screen">
        {children}
      </body>
    </html>
  );
}
