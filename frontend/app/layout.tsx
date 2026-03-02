import type { Metadata } from "next";
import { Syne, Space_Grotesk } from "next/font/google";
import { headers } from "next/headers";
import { cookieToInitialState } from "wagmi";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Providers from "./providers";
import { wagmiConfig } from "@/lib/wagmi";

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

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookie = (await headers()).get("cookie");
  const initialState = cookieToInitialState(wagmiConfig, cookie);

  return (
    <html lang="en" className={`${syne.variable} ${spaceGrotesk.variable}`}>
      <body style={{ fontFamily: "var(--font-space), sans-serif", background: "#070707" }}>
        <Providers initialState={initialState}>
          <Navbar />
          {children}
        </Providers>
      </body>
    </html>
  );
}
