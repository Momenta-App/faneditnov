import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { Header } from "./components/Header";
import { Footer } from "./components/Footer";
import { ModalRenderer } from "./components/ModalRenderer";
import { AuthGuard } from "./components/AuthGuard";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Sportsclips.io - TikTok Fan Edits",
  description: "Upload and explore TikTok fan edits, creators, videos, hashtags, and sounds",
  icons: {
    icon: [
      { url: "/favicon.ico", type: "image/x-icon" },
    ],
    shortcut: "/favicon.ico",
    apple: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} antialiased`}>
        <Providers>
          <AuthGuard>
            <a href="#main-content" className="skip-link">
              Skip to main content
            </a>
            <Header />
            <main id="main-content" className="min-h-screen">
              {children}
            </main>
            <Footer />
            <ModalRenderer />
            <div aria-live="polite" className="sr-only" aria-atomic="true" />
          </AuthGuard>
        </Providers>
      </body>
    </html>
  );
}
