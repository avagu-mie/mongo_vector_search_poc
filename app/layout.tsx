import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MongoDB Vector Search PoC",
  description: "Semantic search with MongoDB Community Edition 8.2",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
