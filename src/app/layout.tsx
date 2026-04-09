import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AI Thursdays",
  description: "Track ideas, assign research topics, and collaborate with your AI study group",
  openGraph: {
    title: "AI Thursdays — Idle Tuesday on Thursdays",
    description: "Track ideas. Assign topics. Collaborate with your AI study group.",
    url: "https://idletuesday.ai/Thursdays/",
    siteName: "AI Thursdays",
    images: [
      {
        url: "https://idletuesday.ai/Thursdays/og-image.png",
        width: 1200,
        height: 630,
        alt: "AI Thursdays",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "AI Thursdays — Idle Tuesday on Thursdays",
    description: "Track ideas. Assign topics. Collaborate with your AI study group.",
    images: ["https://idletuesday.ai/Thursdays/og-image.png"],
  },
  icons: {
    icon: "/Thursdays/icon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
