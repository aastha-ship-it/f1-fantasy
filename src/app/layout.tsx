import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Boldonse } from "next/font/google";
import "./globals.css";

const boldonse = Boldonse({
  weight: "400",
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
      className={`${GeistSans.variable} ${GeistMono.variable} ${boldonse.variable} h-full antialiased`}
    >
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
