import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Outfit } from "next/font/google";
import "./globals.css";
import { DebugConsole } from "@/components/DebugConsole";
import { ToastProvider } from "@/components/ui/ToastProvider";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: '--font-sans',
  display: 'swap',
});

const outfit = Outfit({
  subsets: ["latin"],
  variable: '--font-display',
  display: 'swap',
});

export const metadata: Metadata = {
  title: "Telepocket Dashboard",
  description: "Manage your Telepocket notes and links",
};

import Script from "next/script";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <Script
          src="https://telegram.org/js/telegram-web-app.js"
          strategy="beforeInteractive"
        />
      </head>
      <body className={`${plusJakarta.variable} ${outfit.variable}`}>
        <DebugConsole />
        <ToastProvider>
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
