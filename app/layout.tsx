import type { Metadata } from "next";
import { Fraunces, Manrope } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { ShortlistProvider } from "@/components/ShortlistContext";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  display: "swap",
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
});

const SITE = "https://p1compass.example";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: {
    default: "P1 Compass — Primary 1 school distance & ballot odds",
    template: "%s · P1 Compass",
  },
  description:
    "Enter your Singapore postal code to see every primary school within 2km, mapped by distance band, with multi-year MOE ballot history and a personalised read on your Phase 2C odds.",
  keywords: [
    "Primary 1 registration",
    "P1 ballot",
    "Singapore primary schools",
    "schools near postal code",
    "Phase 2C",
    "MOE balloting",
  ],
  openGraph: {
    title: "P1 Compass — know your Primary 1 odds",
    description:
      "Distance bands, ballot history and a personalised Phase 2C verdict for every primary school near you.",
    type: "website",
    siteName: "P1 Compass",
  },
  twitter: {
    card: "summary_large_image",
    title: "P1 Compass — know your Primary 1 odds",
    description:
      "Distance bands, ballot history and a personalised Phase 2C verdict for every primary school near you.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${manrope.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ShortlistProvider>
          <SiteHeader />
          <main className="flex-1">{children}</main>
          <SiteFooter />
        </ShortlistProvider>
        <Analytics />
      </body>
    </html>
  );
}
