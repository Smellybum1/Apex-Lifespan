import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Apex Lifespan",
  description: "Evidence intelligence for healthspan interventions."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
