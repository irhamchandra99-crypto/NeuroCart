import type { Metadata } from "next";
import { Syne, Space_Grotesk } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Providers from "./providers";

const syne = Syne({
  subsets: ["latin"],
  variable: "--font-syne",
  weight: ["400", "600", "700", "800"],
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space",
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "NeuroCart — Autonomous AI Economy",
  description: "Onchain AI agent marketplace · ERC-8004 · x402 · Chainlink",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${syne.variable} ${spaceGrotesk.variable}`}>
      <body style={{ fontFamily: "var(--font-space), sans-serif", background: "#070707" }}>
        <Providers>
          <Navbar />
          {children}
        </Providers>
      </body>
    </html>
  );
}