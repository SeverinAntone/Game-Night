import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppChrome } from "@/components/AppChrome";
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
        <AppChrome player={player}>{children}</AppChrome>
      </body>
    </html>
  );
}
