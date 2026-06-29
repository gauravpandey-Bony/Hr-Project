import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import { getDefaultCompanyContext } from "@/lib/company.server";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-geist-sans" });

export async function generateMetadata(): Promise<Metadata> {
  const company = await getDefaultCompanyContext();
  return {
    title: `${company.shortName} — ${company.productName}`,
    description: `${company.name} performance reviews, goals, and feedback — Microsoft Teams and web.`,
    icons: {
      icon: company.logoMarkPath,
      apple: company.logoMarkPath,
    },
  };
}

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
