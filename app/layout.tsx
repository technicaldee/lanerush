import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { Providers } from "./providers";

const siteUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://laneshift.game";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Lane Rush | MiniPay cUSD Quiz Runner",
    template: "%s | Lane Rush",
  },
  description:
    "MiniPay-first 3D quiz runner on Celo. Stake cUSD, play, and earn on-chain payouts with daily and weekly leaderboards.",
  applicationName: "Lane Rush",
  keywords: [
    "MiniPay",
    "Celo",
    "cUSD",
    "web3 game",
    "quiz runner",
    "on-chain leaderboard",
  ],
  authors: [{ name: "Lane Rush" }],
  creator: "Lane Rush",
  publisher: "Lane Rush",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "Lane Rush",
    title: "Lane Rush | MiniPay cUSD Quiz Runner",
    description:
      "Stake cUSD and race through a 3D quiz runner with on-chain rewards and leaderboard tracking.",
    images: [
      {
        url: "/logo.png",
        width: 1024,
        height: 1024,
        alt: "Lane Rush logo",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Lane Rush | MiniPay cUSD Quiz Runner",
    description:
      "MiniPay-first runner game on Celo with cUSD staking, payouts, and leaderboard.",
    images: ["/logo.png"],
  },
  icons: {
    icon: [{ url: "/logo.png", type: "image/png" }],
    apple: [{ url: "/logo.png" }],
    shortcut: ["/logo.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
