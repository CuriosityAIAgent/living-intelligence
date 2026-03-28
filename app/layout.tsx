import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Living Intelligence — AI in Wealth Management",
  description: "37 wealth management firms. 7 AI capability dimensions. Every development verified, analysed, and updated weekly.",
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
      <body className="bg-white text-gray-900 min-h-screen flex flex-col">
        <div className="flex-1">{children}</div>
      </body>
    </html>
  );
}
