import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Reel2Real: from inspiration to a booked group trip",
  description: "Paste a travel reel. Get a day-wise plan, map and route, weather and packing list, group expenses with UPI settlement, and one-tap booking.",
};
export const viewport: Viewport = { themeColor: "#0B1F3A", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700;12..96,800&family=Figtree:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body>
        <header className="sticky top-0 z-40 border-b border-ink-100 bg-white/90 backdrop-blur">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-2.5">
            <Link href="/" className="flex items-center gap-2 font-display text-lg font-extrabold">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-signal text-sm text-white">R</span>
              Reel2Real
              <span className="hidden rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-700 sm:inline">MMT add-on prototype</span>
            </Link>
            <nav className="flex items-center gap-1 text-sm font-semibold text-ink-700">
              <Link className="rounded-md px-2.5 py-1.5 hover:bg-ink-50" href="/vault">Reel vault</Link>
              <Link className="rounded-md px-2.5 py-1.5 hover:bg-ink-50" href="/join">Join a trip</Link>
              <Link className="rounded-md px-2.5 py-1.5 hover:bg-ink-50" href="/about">Why this works</Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 pb-24 pt-6">{children}</main>
        <footer className="mx-auto max-w-7xl px-4 pb-10 text-xs text-ink-500">
          Independent concept prototype for a case study. Not affiliated with or endorsed by MakeMyTrip. Prices shown are indicative; live prices come from the booking partner.
        </footer>
      </body>
    </html>
  );
}
