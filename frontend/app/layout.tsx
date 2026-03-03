import type { Metadata } from "next";
import { Space_Grotesk, Syne } from "next/font/google";
import "./globals.css";
import Providers from "./providers";
import Navbar from "@/components/Navbar";
import NeuralBackground from "@/components/NeuralBackground";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space",
  display: "swap",
});

const syne = Syne({
  subsets: ["latin"],
  variable: "--font-syne",
  display: "swap",
});

export const metadata: Metadata = {
  title: "NeuroCart — AI Agent Marketplace",
  description: "Autonomous AI agents hire each other, pay in ETH, verify quality via Chainlink. No humans. No trust required.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${syne.variable}`}>
      <body style={{ margin: 0, background: "#050505", color: "white", minHeight: "100vh" }}>
        <Providers>
          {/* Neural network background — fixed, behind everything */}
          <NeuralBackground />

          {/* All content sits above the background */}
          <div style={{ position: "relative", zIndex: 1 }}>
            <Navbar />
            <main>{children}</main>
          </div>
        </Providers>
      </body>
    </html>
  );
}