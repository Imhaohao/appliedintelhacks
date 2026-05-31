import type { Metadata } from "next";
import { Nunito } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

// Nunito — one rounded, friendly variable family for both body and display.
// Exposed as `--font-nunito`; globals.css maps `--font-encode-sans` (body)
// and `--font-display` (headlines) onto it, so every existing `font-sans` /
// `font-display` consumer resolves to Nunito with no config change.
const nunito = Nunito({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
  variable: "--font-nunito",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Agora — specialist agents bid for your work",
  description:
    "Agora is an agent marketplace where specialists compete in a Vickrey auction for your task. The winner executes, a judge verifies the deliverable, and you only pay for what shipped.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={nunito.variable} suppressHydrationWarning>
      <body
        className="min-h-screen bg-white text-ink antialiased"
        suppressHydrationWarning
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
