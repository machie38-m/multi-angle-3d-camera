import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Multi-Angle 3D Camera — Unlimited Image View Synthesis",
  description:
    "Upload any photo and re-render it from a new camera angle. Adjust azimuth, elevation, and distance with a live 3D orbit controller. Unlimited generations, powered by AI image editing.",
  keywords: [
    "3D camera",
    "multi-angle",
    "image to 3D",
    "novel view synthesis",
    "AI image edit",
    "azimuth elevation",
    "Qwen image alternative",
  ],
  authors: [{ name: "Z.ai" }],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
  openGraph: {
    title: "Multi-Angle 3D Camera — Unlimited",
    description:
      "Re-render any photo from a new camera angle. Azimuth, elevation, distance — all unlimited.",
    siteName: "Multi-Angle 3D Camera",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground min-h-screen`}
      >
        {children}
        <Toaster
          position="top-center"
          toastOptions={{
            style: {
              background: "oklch(0.18 0.01 240 / 0.95)",
              border: "1px solid oklch(1 0 0 / 0.10)",
              color: "oklch(0.98 0 0)",
              backdropFilter: "blur(12px)",
            },
          }}
        />
      </body>
    </html>
  );
}
