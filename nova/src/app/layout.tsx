import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import { COMPANY } from "@/lib/company";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-geist-sans" });

export const metadata: Metadata = {
  title: `${COMPANY.shortName} — ${COMPANY.productName}`,
  description: `${COMPANY.name} performance reviews, goals, and feedback — Microsoft Teams and web.`,
  icons: {
    icon: COMPANY.logoMarkPath,
    apple: COMPANY.logoMarkPath,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body
        className={`${inter.className} min-h-screen bg-background font-sans text-foreground antialiased`}
      >
        {children}
        <Toaster position="top-right" richColors closeButton />
      </body>
    </html>
  );
}
