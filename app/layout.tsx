import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Styling App",
  description: "Your virtual closet",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black",
    title: "Styling App",
  },
};

export const viewport: Viewport = {
  themeColor: "#2b2b2e",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
