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
  title: "«Браво» — соціонічний симулятор торгової мережі",
  description:
    "Гра-симулятор: ви власник мережі продуктових магазинів «Браво». На ринку праці немає всіх 16 типів соціоніки — набирайте команду з того, що є, і проводьте її крізь бізнес-кризи.",
  keywords: ["соціоніка", "симулятор", "мережа магазинів", "управління командою", "інтертипні стосунки", "бізнес-гра"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="uk" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
      </body>
    </html>
  );
}
