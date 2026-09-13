import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";
import { NavTabs, NavRail } from "@/components/Nav";
import { SwipeNav } from "@/components/SwipeNav";
import { WhoAmI } from "@/components/WhoAmI";
import { currentPlayer } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Game Night",
  description: "Ratings, rivalries and receipts for board game night.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Game Night" },
  icons: { icon: "/icon.svg", apple: "/icon-192.png" },
};

export const viewport: Viewport = {
  themeColor: "#0d0f18",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const me = await currentPlayer();
  const player = me ? { name: me.name } : null;

  return (
    <html lang="en">
      <body className="min-h-dvh">
        <div className="mx-auto flex min-h-dvh w-full max-w-6xl md:gap-6 md:px-6">
          <NavRail player={player} />
          <div className="flex min-w-0 flex-1 flex-col">
            <header className="sticky top-0 z-40 -mx-0 border-b border-white/5 bg-ink-950/70 px-4 py-3 backdrop-blur-lg md:hidden">
              <div className="flex items-center justify-between">
                <Link href="/" className="font-display text-lg font-extrabold tracking-tight">
                  <span className="text-grape-400">🎲</span> Game Night
                </Link>
                <WhoAmI player={player} />
              </div>
            </header>
            <main className="flex-1 px-4 pb-28 pt-4 md:px-0 md:pb-12 md:pt-8">{children}</main>
          </div>
        </div>
        <NavTabs />
        <SwipeNav />
      </body>
    </html>
  );
}
