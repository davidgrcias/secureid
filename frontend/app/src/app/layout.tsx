import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import ThemeSync from "@/components/layout/ThemeSync";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://secureid.local"),
  title: {
    default: "SecureID",
    template: "%s | SecureID"
  },
  description: "Platform tanda tangan digital, e-KYC, dan workflow dokumen enterprise.",
  openGraph: {
    title: "SecureID",
    description: "Platform tanda tangan digital, e-KYC, dan workflow dokumen enterprise.",
    type: "website",
    locale: "id_ID"
  },
  twitter: {
    card: "summary_large_image",
    title: "SecureID",
    description: "Platform tanda tangan digital, e-KYC, dan workflow dokumen enterprise."
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full bg-background text-on-surface">
        <ThemeSync />
        {children}
      </body>
    </html>
  );
}
