import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Living Intelligence | AI in Wealth Management",
  description: "Real-time competitive intelligence on AI across global wealth management",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#0A1628] text-[#F0F4F8] min-h-screen">
        {children}
      </body>
    </html>
  );
}
