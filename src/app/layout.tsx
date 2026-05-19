import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Titillium_Web } from "next/font/google";
import "./globals.css";

// Display face. Semantically still "--font-boldonse" so the ~104 inline
// `fontFamily: var(--font-boldonse)` call sites + the `[style*="Boldonse"]`
// globals.css selector keep working untouched — only the loaded typeface
// changes (design_handoff_phase11/ADDENDUM §A: broadcast Titillium Web Black).
const display = Titillium_Web({
  weight: ["400", "600", "700", "900"],
  subsets: ["latin"],
  variable: "--font-boldonse",
  display: "swap",
  fallback: ["ui-sans-serif", "system-ui", "sans-serif"],
});

export const metadata: Metadata = {
  title: "F1 Fantasy",
  description: "Private P1/P2/P3 prediction league",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable} ${display.variable} h-full antialiased`}
    >
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
