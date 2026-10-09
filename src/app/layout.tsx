import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Late Founders Command Center",
  description: "Every worksheet and AI tool for the course you are on.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
