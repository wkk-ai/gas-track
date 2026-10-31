import type { Metadata, Viewport } from "next";
import "./globals.css";

const base = process.env.NEXT_PUBLIC_BASE_PATH || "";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f5f7" },
    { media: "(prefers-color-scheme: dark)", color: "#0d1014" },
  ],
};

export const metadata: Metadata = {
  title: "Gas Track",
  description: "Controle de abastecimentos e consumo",
  manifest: `${base}/manifest.json`,
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Gas Track" },
  icons: {
    icon: [{ url: `${base}/icon.svg`, type: "image/svg+xml" }],
    apple: [{ url: `${base}/apple-touch-icon.png`, sizes: "180x180" }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased min-h-dvh">{children}</body>
    </html>
  );
}
